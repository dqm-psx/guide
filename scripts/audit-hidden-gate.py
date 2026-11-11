"""Read-only audit of the retained Hidden Gate terminal scene.

Authenticates the original Japanese and verified Current v1.0.73 discs. Prints
metadata and hashes; writes no disc bytes, pictures, or translated text.
This audits the terminal scene, not the reachability of its gate entrance.
"""
import argparse
import importlib.util
import json
import mmap
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("atlas", ROOT / "scripts/build-player-atlas.py")
atlas = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(atlas)
require = atlas.require
ORIGINAL = "a1217657786430ac1c3ad71f16cdadb65d47b0df9a7e30278900651c1f1eec29"
CURRENT = "c7fd48e4decd7747a3e8b72ff052960b4ae0943ad61b6a95c57c946791cba812"
HEADER = bytes.fromhex("6100000018b00e801cb00e800000000000000000")


def inspect(image, expected):
    disc = atlas.Disc(image, expected)
    definition = tuple(atlas.span(disc.exe, 0x800A85D4-atlas.BIAS+31*4, 4))
    require(definition == (15, 50, 15, 15), "Hidden Gate definition changed")
    overlay = disc.resource(18)
    terminal = struct.unpack_from("<HHHBBII", overlay, 0x80117068-atlas.BASE+31*16)
    require(terminal[:5] == (15, 30, 101, 0, 0), "Hidden Gate terminal changed")
    resource = disc.group_entry(0, terminal[2])
    require(resource == 102, "Terminal scene resource changed")
    raw = disc.resource(resource)
    require(raw[:20] == HEADER, "Terminal scene acquired an event script")
    directory = struct.unpack_from("<I", raw, 4)[0]-atlas.BASE
    script = struct.unpack_from("<I", raw, directory)[0]-atlas.BASE
    require((directory, script, raw[script]) == (8, 12, 0), "Empty script target changed")
    battle_calls = raw.count(bytes.fromhex("0420220480"))
    require(battle_calls == 0, "Terminal scene acquired a fixed-battle call")

    descriptor = struct.unpack_from("<7I", raw, 25088)
    event_pointer, _ = struct.unpack_from("<II", raw, descriptor[3]-atlas.BASE)
    events = disc.unpack_asset(resource, event_pointer)
    _, width, height, _ = struct.unpack_from("<4H", events)
    require((width, height) == (20, 15) and len(events) == 8+width*height*2,
            "Terminal event grid dimensions changed")
    event_opcodes = sorted({word >> 8 for word, in struct.iter_unpack("<H", events[8:])})
    require(event_opcodes == [0], "Terminal grid acquired an interaction or exit event")

    # Retained enemy data is not evidence of a reachable fight. Resolve its
    # identity explicitly: 0A10 means Deathmore, not Darkdrium (which is 0A13).
    context = overlay[terminal[5]-atlas.BASE+6]
    enemy_resource = disc.group_entry(17, context)
    enemy = disc.resource(enemy_resource)
    forms, records, _, _ = struct.unpack_from("<4I", enemy)
    slots = [slot for slot in struct.unpack_from("<3h", enemy, forms+16+6) if slot != -1]
    require((context, enemy_resource, slots) == (159, 4603, [0]), "Retained encounter data changed")
    identity = tuple(enemy[records:records+2])
    baseline = atlas.read_json(ROOT / "data/monster-baseline.json")["species"]
    species = next(row["index"] for row in baseline
                   if (row["family_id"], row["member"]) == identity)
    require(identity == (10, 16) and species == 305, "Retained formation identity changed")
    return raw, events, {
        "discSha256": expected,
        "gateId": 32,
        "definition": list(definition),
        "finalFloor": definition[1],
        "terminalScene": 101,
        "terminalArea": 0,
        "sceneResource": resource,
        "sceneResourceSha256": atlas.sha(raw),
        "scriptDirectoryOffset": directory,
        "scriptOffset": script,
        "scriptFirstOpcode": raw[script],
        "fixedBattleCalls": battle_calls,
        "eventGridSize": [width, height],
        "eventOpcodes": event_opcodes,
        "eventGridSha256": atlas.sha(events),
        "retainedEncounter": {
            "context": context, "resource": enemy_resource,
            "family": identity[0], "member": identity[1], "speciesIndex": species,
            "meaning": "Retained data only; the scene does not invoke this formation."
        }
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--original-bin", required=True, type=Path)
    parser.add_argument("--current-bin", required=True, type=Path)
    args = parser.parse_args()
    results = []
    for path, digest in [(args.original_bin, ORIGINAL), (args.current_bin, CURRENT)]:
        with path.open("rb") as handle, mmap.mmap(handle.fileno(), 0, access=mmap.ACCESS_READ) as image:
            results.append(inspect(image, digest))
    original, original_events, before = results[0]
    current, current_events, after = results[1]
    require(original_events == current_events, "Translated release changed the event grid")
    # The old resource body is preserved except for its allocation-size operand,
    # translated message offsets, and checksum. New text is appended after it.
    translation_ranges = [(0x5848, 0x584C), (0x6220, 0x62E8)]
    require(len(current) >= len(original), "Translated resource unexpectedly shrank")
    require(all(original[i] == current[i] for i in range(len(original)-4)
                if not any(start <= i < end for start, end in translation_ranges)),
            "Scene changed outside the reviewed translation/allocation fields")
    print(json.dumps({
        "schema": 1, "original": before, "current": after,
        "eventGridUnchanged": True,
        "originalBodyPreservedOutsideTranslationFields": True,
        "scope": "Terminal scene only. Dialogue and enemy data do not establish playable access."
    }, indent=2))


if __name__ == "__main__":
    main()
