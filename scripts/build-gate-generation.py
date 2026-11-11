"""Extract PSX gate terrains, floor counts and terminal destinations.

The ordinary terrain selector, graph generator, world definitions and terminal
descriptors are native PSX data. Thumbnail labels describe inspected game art;
they are not Game Boy names. Each thumbnail is one unmodified 15x12-tile room
pattern, not a generated floor or a route that a player can follow.

Special-room selections describe the authenticated Current English release.
The patch restores five room families absent from the original selector. Byte
overflow in the native cumulative-weight selector is preserved: positive raw
weights alone do not establish that a destination can actually be selected.

Usage: --bin <Current English BIN> --write / --check
Optional --original-bin verifies ordinary generation and final destinations
against the original Japanese disc, without equating special-room editions.
"""
import argparse
from collections import defaultdict
import importlib.util
import json
import mmap
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("entrances", ROOT / "scripts/build-gate-entrances.py")
entrances = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(entrances)
atlas = entrances.atlas
require = atlas.require
PREFIX = "globalThis.GATE_GENERATION = "
OUTPUT = ROOT / "data/gate-generation.js"
GATES = entrances.GATES + ["hidden"]
TERRAINS = ["Rocky cave", "Ice cave", "Lava cave", "Mossy cave", "Brick dungeon",
            "Stone temple", "Forest paths", "Grassland", "Marshland", "Desert",
            "Flowered grassland", "Volcanic wasteland"]
ROOM_FAMILIES = [
    ("treasure", "Treasure room", range(12, 18), True),
    ("forest", "Forest maze", [18], True),
    ("church", "Church", [19], False),
    ("shop", "Shop", [20], False),
    ("colosseum", "Colosseum", [21], True),
    ("maze", "Maze", range(22, 25), True),
    ("sliding", "Sliding-tile puzzle", range(25, 28), True),
]
RESTORED = {**{k: (104, k-12) for k in range(12, 18)}, 18: (105, 4), 21: (108, 0),
            **{k: (109, k-22) for k in range(22, 25)},
            **{k: (110, k-25) for k in range(25, 28)}}
GUARDS = [
    (None, 0x8003EB8C, 0x8003ED48, "801895113e7308165233090bc8503fc36e72595952849f6f5e521365774ee143"),
    (None, 0x80038E88, 0x80038F48, "6e63f65be565f99560cb8c0fc61853cd9986e87a0d6577379f1d43b2c33529b5"),
    (None, 0x8003CBCC, 0x8003CE20, "183da60a63b86b883b467d69989379f77c930b3d88ed0b6405b496154e99cbbb"),
    (18, 0x800F08C4, 0x800F0930, "9339b1942073972089016a91381b1e1bab15b1f7eb75eec70f54c0c5d248e6ef"),
    (18, 0x800F0B1C, 0x800F139C, "927a07adc4d7c2f55f5fc2ad66303dcf55c998c982f5766605ff1411ca11d8b6"),
]
# Reviewed single fixed-battle calls in final-room scripts. Medal's alternatives
# and Destruction's return-visit sequence are retained separately below.
BOSSES = {1: (0x5B, 13, "npc-healie"), 6: (0x5B, 186, None), 9: (0x5F, 182, None),
          15: (0x3F4, 152, None), 21: (0x4B, 35, None), 23: (0x83, 290, None),
          25: (0x4B, 296, None), 26: (0x4B, 297, None), 27: (0x6A, 299, None),
          28: (0x77, 301, None), 29: (0xD2, 302, None), 30: (0x81, 304, None),
          31: (0xC4, 305, None)}
BOSS_GUARDS = [
    (None, atlas.BIAS, 0x80016788, 0x80016794, "3a3f7eb4c48d87584ee2984d626cf1d9ffc3df5f80fc0668442fd683917610d7"),
    (None, atlas.BIAS, 0x8003FD0C, 0x8003FD38, "c56af0371a098e3007dc0acd12f81e2fa35a21ef25f6b285c895bfd4825e5721"),
    (None, atlas.BIAS, 0x80042220, 0x80042288, "d9ebf083de06003ea23d0c7e126fb32ebac077e64009b416ba888a12788f20f8"),
    (5499, 0x8018C0B8, 0x8018C330, 0x8018CBC8, "facb85a2f7ccfb7d4db523b72863c12f3eed35a1a43b06f741c72e1123c772ec"),
    # Medal has three separate interaction/victory continuations, all setting
    # completion flag 7 and returning home. Destruction's first victory sets
    # flag 5 and returns home; its next-visit script requires flag 5 set and
    # flag 6 clear before introducing the second boss. The repeat interaction
    # uses that same second formation once flag 6 has been set.
    # Exclude the inline translated nickname between these two code spans.
    (88, atlas.BASE, 0x800EB01C, 0x800EB095, "2dd956f64f7a1a08460a928e91fb0100a1006691df2a11c4b408c27d8781808e"),
    (88, atlas.BASE, 0x800EB09B, 0x800EB530, "c6411013e8656d99e3bd79f813b1f8b8151dbc88f6d770a4a70429ec54c36ebc"),
    (94, atlas.BASE, 0x800EB024, 0x800EB396, "f0ce6d083ee7f6f3c749598dc19354da96f73450728e8029eea87144c5a50f04"),
]
MULTI_BOSSES = {
    18: {"calls": [(0xBB, 3, 9, 1), (0xF7, 2, 149, 1), (0x133, 1, 122, 1)],
         "label": "Boss choices", "note": "Choose one of three encounters.", "relationship": "alternatives"},
    24: {"calls": [(0x6E, 1, 293, 1), (0x37D, 2, 294, 2)],
         "label": "Boss sequence", "note": "Defeat the first boss, then return to fight the second.",
         "relationship": "return-visit"},
}


def at(exe, address, length):
    return atlas.span(exe, address-atlas.BIAS, length)


def native_selection(weights, value):
    total = 0
    for index, weight in enumerate(weights):
        total = (total + weight) & 255
        if value < total:
            return index
    return len(weights)


def possible_selections(weights):
    total = sum(weights) & 255
    return {native_selection(weights, value) for value in range(max(1, total))}


def ordinary_fingerprint(disc):
    """All source bytes that determine the ordinary terrain/terminal metadata."""
    overlay = disc.resource(18)
    records = [at(disc.exe, 0x800A85D4, 32*4), at(disc.exe, 0x800A8654, 16*12),
               at(disc.exe, 0x800BC710, 12), at(disc.exe, 0x800C7118, 3),
               atlas.span(overlay, 0x80117068-atlas.BASE, 32*16),
               atlas.span(overlay, 0x801173F0-atlas.BASE, 12*4)]
    for layout in range(12):
        entry = struct.unpack_from("<H", overlay, 0x801173F0-atlas.BASE+layout*4)[0]
        records.append(disc.resource(disc.group_entry(16, entry)))
        table = 0x801172E8 if layout < 7 else 0x8011736C
        pointer = struct.unpack_from("<I", overlay, table-atlas.BASE+4)[0]
        records.append(disc.unpack_asset(18, pointer))
    return atlas.sha(b"".join(records))


def verify_special_dispatch(overlay):
    """Read the actual restored descriptor selected by each patched jump slot."""
    for kind, destination in RESTORED.items():
        address = struct.unpack_from("<I", overlay, 0x800F0324-atlas.BASE+kind*4)[0]
        if kind == 21:  # Native patch clears its 48-byte battle scratch first.
            clear = struct.unpack_from("<14I", overlay, address-atlas.BASE)
            require(clear[:2] == (0x3C08801F, 0x35087FD0) and
                    clear[2:] == tuple(0xAD000000+n for n in range(0, 48, 4)),
                    "Colosseum entry scratch differs")
            address += 56
        code = struct.unpack_from("<14I", overlay, address-atlas.BASE)
        require(code[0] >> 16 == 0x3C0A and code[1] >> 16 == 0x354A,
                "Unknown restored-room destination load")
        pointer = ((code[0] & 65535) << 16) | (code[1] & 65535)
        require(code[2:] == (0x3C098011, 0x35298A30, 0x8D470000, 0x8D480004,
                            0xAD270000, 0xAD280004, 0x8D470008, 0x8D48000C,
                            0xAD270008, 0xAD28000C, 0x0803C4ED, 0x3C10800C),
                "Restored-room descriptor copy differs")
        group, _, scene, area, spawn, _, flags = struct.unpack_from("<HHHBBII", overlay, pointer-atlas.BASE)
        require(group == 15 and (scene, area) == destination and spawn == 0 and flags == 0,
                "Restored-room target differs")
    for kind, address, target in [(19, 0x801172C8, 106), (20, 0x801172D8, 107)]:
        descriptor = struct.unpack_from("<HHHBBII", overlay, address-atlas.BASE)
        require(descriptor[2:5] == (target, 0, 0), "Retail special-room target differs")


def battle_record(disc, descriptor, indices, call, formation, expected, occurrences=1):
    script_resource = disc.group_entry(0, descriptor[2])
    script = disc.resource(script_resource)
    signature = bytes([0x70, 0, formation, 4, 0x20, 0x22, 4, 0x80])
    require(script[call-3:call+5] == signature and script.count(signature) == occurrences,
            "Reviewed fixed-battle call changed")
    overlay = disc.resource(18)
    context = overlay[descriptor[5]-atlas.BASE+6]
    resource = disc.group_entry(17, context)
    raw = disc.resource(resource)
    forms, records, images, _ = struct.unpack_from("<4I", raw)
    require(forms <= forms+formation*16 <= records-16, "Fixed boss formation missing")
    positions = [pos for pos in struct.unpack_from("<3h", raw, forms+formation*16+6) if pos != -1]
    require(len(positions) == 1, "Fixed boss is no longer a single monster")
    offset = records + positions[0]*52
    require(records <= offset <= images-52, "Fixed boss record outside enemy table")
    species = indices.get(tuple(raw[offset:offset+2]))
    require(species == expected, "Reviewed boss species changed")
    boss = {"species": species}
    return boss, {"scriptResource": script_resource, "battleCall": call,
                  "context": context, "enemyResource": resource, "formation": formation,
                  "record": positions[0], "species": species}


def fixed_boss(disc, gate, descriptor, indices):
    if gate not in BOSSES:
        return None, None
    call, expected, article = BOSSES[gate]
    boss, evidence = battle_record(disc, descriptor, indices, call, 1, expected)
    if article:
        boss["entry"] = article
    return boss, evidence


def generate(disc, write):
    for rid, start, end, expected in GUARDS:
        raw, base = (disc.exe, atlas.BIAS) if rid is None else (disc.resource(rid), atlas.BASE)
        require(atlas.sha(atlas.span(raw, start-base, end-start)) == expected,
                f"Generation consumer changed at {start:08x}")
    for rid, base, start, end, expected in BOSS_GUARDS:
        raw = disc.exe if rid is None else disc.resource(rid)
        require(atlas.sha(atlas.span(raw, start-base, end-start)) == expected,
                "Native fixed-battle constructor changed")
    overlay = disc.resource(18)
    verify_special_dispatch(overlay)
    require(at(disc.exe, 0x800C7118, 3) == bytes([5, 0, 0]), "Ordinary generation branch changed")
    published = json.loads((ROOT / "data/player-atlas.js").read_text(encoding="utf8")
                           .removeprefix("globalThis.PLAYER_ATLAS = ").rstrip(";\n"))
    maps = {row["id"]: row for row in published["maps"]}
    previous = json.loads(OUTPUT.read_text(encoding="utf8").removeprefix(PREFIX).rstrip(";\n")) if OUTPUT.exists() else {}
    terrain_catalog, terrain_evidence = {}, []
    for layout, name in enumerate(TERRAINS):
        entry = struct.unpack_from("<H", overlay, 0x801173F0-atlas.BASE+4*layout)[0]
        require(at(disc.exe, 0x800BC710+layout, 1)[0] == entry, "Entry and next-floor terrains differ")
        resource = disc.group_entry(16, entry)
        table = 0x801172E8 if layout < 7 else 0x8011736C
        pointer = struct.unpack_from("<I", overlay, table-atlas.BASE+4)[0]
        graphic = disc.unpack_asset(18, pointer)
        require(struct.unpack_from("<5H", graphic) == (1, 0, 0, 240 if layout < 7 else 480, 12),
                "Native room-pattern sheet changed")
        sample = atlas.render(graphic, atlas.TileBank(disc.resource(resource))).crop((0, 0, 240, 192))
        key = f"terrain-{layout}"
        old_name = previous.get("terrains", {}).get(key, {}).get("image", "").removeprefix("maps/") or None
        image, pixels = atlas.image_file(sample, old_name, write)
        terrain_catalog[key] = {"name": name, "image": "maps/"+image,
                                "layout": "rooms" if layout < 7 else "open",
                                "variation": "Linked rooms and passages; room details vary." if layout < 7 else
                                "Open terrain with branching routes; landscape details vary.",
                                "patterns": 13 if layout < 7 else 5}
        terrain_evidence.append({"id": key, "layout": layout, "tileResource": resource,
                                 "patternTable": f"{table:08x}", "pattern": 0, "pixelsSha256": pixels})
    species_rows = atlas.read_json(ROOT / "data/monster-baseline.json")["species"]
    indices = {(row["family_id"], row["member"]): row["index"] for row in species_rows}
    entries, evidence = {}, []
    for gate in range(1, 33):
        profile, final_floor, special_profile, _ = at(disc.exe, 0x800A85D4+(gate-1)*4, 4)
        weights = list(at(disc.exe, 0x800A8654+profile*12, 12))
        require(profile < 16 and sum(weights) == 100 and final_floor > 1,
                "Unknown gate definition or ordinary weights")
        selected = possible_selections(weights)
        final_descriptor = struct.unpack_from("<HHHBBII", overlay, 0x80117068-atlas.BASE+(gate-1)*16)
        final_map = f"map-{final_descriptor[2]}-{final_descriptor[3]}"
        require(final_map in maps, "Terminal gate map is missing from the atlas")
        special_weights = list(at(disc.exe, 0x800A8714+special_profile*16, 16))
        eligible = list(range(3, final_floor, 3)) if special_profile else []
        choices = {kind+12 for kind in possible_selections(special_weights)} if eligible else set()
        # Hidden Gate is an encounter/definition record with no verified access.
        # Its empty special row would not select a normal special-room case.
        special = None if gate == 32 else {
            "interval": 3, "floors": eligible, "edition": "Current English patch",
            "rooms": [{"id": key, "name": name, "variants": len(choices.intersection(kinds)), "restored": restored}
                      for key, name, kinds, restored in ROOM_FAMILIES if choices.intersection(kinds)]}
        if gate != 32:
            require(choices <= set(range(12, 28)), "Special selector leaves known room cases")
        key = "location-"+GATES[gate]+"-gate"
        entries[key] = {"gateId": gate, "ordinaryFloors": [1, final_floor-1], "finalFloor": final_floor,
                        "finalMaps": [final_map], "terrains": [{"id": f"terrain-{i}", "weight": weights[i]}
                                                              for i in sorted(selected)], "specialFloors": special}
        if gate == 32:
            # Retained definition, not a playable route: see hidden-gate-evidence.md.
            entries[key]["availability"] = "unused"
        boss, boss_evidence = fixed_boss(disc, gate, final_descriptor, indices)
        if boss:
            entries[key]["boss"] = boss
        evidence.append({"location": key, "definition": [profile, final_floor, special_profile],
                         "ordinaryWeights": weights, "specialWeights": special_weights,
                         "finalDescriptor": list(final_descriptor)})
        if boss_evidence:
            evidence[-1]["boss"] = boss_evidence
        if gate in MULTI_BOSSES:
            spec = MULTI_BOSSES[gate]
            battles = [battle_record(disc, final_descriptor, indices, *call) for call in spec["calls"]]
            entries[key].update(bosses=[boss for boss, _ in battles], bossLabel=spec["label"], bossNote=spec["note"])
            evidence[-1]["bosses"] = {"relationship": spec["relationship"],
                                      "battles": [proof for _, proof in battles]}
    require(len(entries) == 32 and len(terrain_catalog) == 12, "Incomplete gate-generation coverage")
    return {"schema": 1, "terrains": terrain_catalog, "entries": entries,
            "notes": ["Room connections and landscape details change between visits.",
                      "Images show native terrain samples, not complete floors or fixed routes.",
                      "Special rooms can replace the listed floors; they are not guaranteed.",
                      "Special-room possibilities describe the Current English patch."],
            "evidence": {"ordinaryFingerprint": ordinary_fingerprint(disc), "terrains": terrain_evidence,
                         "gates": evidence, "consumerSpans": len(GUARDS)+len(BOSS_GUARDS),
                         "weightMeaning": "Relative native selection weights; not displayed as exact probabilities."}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bin", required=True, type=Path)
    parser.add_argument("--original-bin", type=Path)
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    proof = atlas.read_json(atlas.PROOF)
    with args.bin.open("rb") as handle, mmap.mmap(handle.fileno(), 0, access=mmap.ACCESS_READ) as image:
        digest = atlas.sha(image)
        require(digest in {atlas.BASELINE, proof["patchedBinSha256"]}, "Unknown English disc")
        output = generate(atlas.Disc(image, digest), args.write)
    if args.original_bin:
        with args.original_bin.open("rb") as handle, mmap.mmap(handle.fileno(), 0, access=mmap.ACCESS_READ) as image:
            original = atlas.Disc(image, entrances.JAPANESE)
            require(ordinary_fingerprint(original) == output["evidence"]["ordinaryFingerprint"],
                    "Ordinary generation or final destinations differ from Japanese original")
    text = PREFIX+json.dumps(output, ensure_ascii=False, separators=(",", ":"))+";\n"
    if args.write:
        OUTPUT.write_text(text, encoding="utf8")
    if args.check:
        require(OUTPUT.read_text(encoding="utf8") == text, "Gate generation data differs; review changes")
    print(json.dumps({"gates": len(output["entries"]), "terrains": len(output["terrains"]),
                      "finalMaps": sum(len(row["finalMaps"]) for row in output["entries"].values()),
                      "ordinaryJapaneseMatch": bool(args.original_bin)}))


if __name__ == "__main__":
    main()
