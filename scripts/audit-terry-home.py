"""Verify Terry's opening home against original Japanese and English v1.0.73.

Read-only; reports native identities and hashes without publishing disc bytes.
"""
import argparse
import importlib.util
import json
import mmap
import struct
from contextlib import ExitStack
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("atlas", ROOT / "scripts/build-player-atlas.py")
atlas = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(atlas)
SPEC = importlib.util.spec_from_file_location("world", ROOT / "scripts/verify-world-guide.py")
world = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(world)
JAPANESE = "a1217657786430ac1c3ad71f16cdadb65d47b0df9a7e30278900651c1f1eec29"


def audit(original, current, comparison):
    index = atlas.read_json(atlas.INDEX)
    spec = index["scenes"]["103"]
    item = next(row for row in index["maps"] if row[:2] == [103, 0])
    atlas.require(spec == [5587, 29944, {"source": "executable", "offset": 720876}],
                  "Home scene/title binding changed")
    atlas.require(item == [103, 0, 5578, 4204, 0, "static_extra_pools.json:e0affe4_0000", "map-103-0"],
                  "Home entrance binding changed")
    with ExitStack() as stack:
        discs = []
        for path, expected in [(original, JAPANESE), (current, world.V73_HASH)]:
            handle = stack.enter_context(path.open("rb"))
            image = stack.enter_context(mmap.mmap(handle.fileno(), 0, access=mmap.ACCESS_READ))
            discs.append(atlas.Disc(image, expected))
        old, new = discs
        old_room, room = old.resource(5587), new.resource(5587)
        atlas.require(old_room == room, "Opening room event/layout resource differs")
        entries = []
        for resource, offset in [(5578, 0x106C), (5377, 0x3080), (5630, 0x1D034)]:
            blocks = [disc.resource(resource)[offset:offset+16] for disc in discs]
            atlas.require(blocks[0] == blocks[1], "Home arrival differs")
            atlas.require(struct.unpack_from("<HHHBB", blocks[0])[:4] == (15, 38, 103, 0),
                          "Arrival does not select the opening room")
            entries.append({"resource": resource, "offset": offset, "sha256": atlas.sha(blocks[0])})
        tiles = new.group_entry(15, 38)
        atlas.require(old.group_entry(15, 38) == tiles and old.resource(tiles) == new.resource(tiles),
                      "Opening room tile bank differs")
        native = atlas.native_map(new, spec, item)
        atlas.require(native["doors"] == [] and struct.unpack_from("<I", room, 29944+8)[0] == 0,
                      "Opening room acquired ordinary doorway transitions")
        rows = [row for row in atlas.read_json(comparison)["rows"]
                if row["id"].startswith("e0affe4_") and row["current"].strip()]
        atlas.require(len(rows) == 37 and len({row["id"] for row in rows}) == 37 and
                      all(row["catalog"] == "text/static_pools.json" for row in rows),
                      "Expected the complete 37-entry public room text binding")
        offsets = struct.unpack_from("<118H", old.exe, 0xAF72C)
        memory = new.resident_memory()
        for row in rows:
            original_offset = int(row["id"].split("_")[1], 16)
            slots = [slot for slot, value in enumerate(offsets) if value == original_offset]
            atlas.require(slots, "Static room message lost its native slot")
            for slot in slots:
                actual = world.table_message(memory, 0xBF7EC, slot, 0)
                atlas.require(actual == world.sentence(row["current"]), "Static room wording mismatch: " + row["id"])
        atlas.require(native["title"] == world.table_message(memory, 0xBF7EC, 0, 0), "Map title differs")
        return {"passed": True, "originalSha256": JAPANESE, "currentSha256": world.V73_HASH,
                "map": "map-103-0", "sceneResource": 5587, "sceneSha256": atlas.sha(room),
                "tileResource": tiles, "tileSha256": atlas.sha(new.resource(tiles)),
                "sizeInTiles": native["size"], "ordinaryDoorways": 0,
                "staticMessagesChecked": len(rows), "arrivalRecords": entries}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--original-bin", type=Path, required=True)
    parser.add_argument("--current-bin", type=Path, required=True)
    parser.add_argument("--comparison", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(audit(args.original_bin, args.current_bin, args.comparison), indent=2))
