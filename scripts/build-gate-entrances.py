"""Build Terry's entrance pins from authenticated native map events and code.

Unlike FIELD_ROUTES' final-area maps, these are the hub portals that begin an
adventure. Coordinates belong to an exact native layout, never its placeId.
The event decoder is resident 800622f4; kind 3 is codes 19..27 and 0x97..0x9a.
Three locked portals are installed by native 80060558 calls rather than the
base event grid. Their arguments are decoded below, not estimated from art.
The alternate farm layout uses its gate-12 dispatcher and the exact tile
positions of the native completed-gate marker; no access condition is inferred.

Usage: python scripts/build-gate-entrances.py --bin <current English BIN> --check
The Japanese original and atlas baseline are also accepted for comparison.
No disc bytes, source paths, or save-state access claims are published.
"""
import argparse
import importlib.util
import json
import mmap
import struct
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("atlas", ROOT / "scripts/build-player-atlas.py")
atlas = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(atlas)
require = atlas.require
OUTPUT = ROOT / "data/gate-entrances.js"
PREFIX = "globalThis.GATE_ENTRANCES = "
JAPANESE = "a1217657786430ac1c3ad71f16cdadb65d47b0df9a7e30278900651c1f1eec29"

# Original gate IDs, in native world-definition order. The chamber plaque
# dialogue independently establishes the named B1/B2/B3 positions.
GATES = [None, "departure", "townsperson-s", "guardian", "memory", "confusion",
         "bazaar", "peace", "courage", "well", "strength", "anger", "farm",
         "joy", "wisdom", "arena-left", "happiness", "temptation", "medal",
         "lost", "judgment", "library", "mirror", "ambition", "destruction",
         "manipulation", "domination", "extinction", "sleep", "bazaar-edge",
         "arena-right", "stubborn-old-man"]

# The exact native consumers establish event-kind semantics, room-to-gate
# dispatch, and dynamic collision writes. Fail closed if a release changes
# those consumers; a translation-name refresh alone cannot reverify them.
GUARDS = [
    (None, 0x800622F4, 0x800627F4, "23eb384565139923d244cddf8d491b9138a0041f49fb2902cf584e4550a98de8"),
    (None, 0x8006A784, 0x8006A820, "5ee8176ac6994cce97012e67fa6d7e5d1c7eb0883f7fb7475a472e1bf7fcd68c"),
    (5630, 0x800FDA9C, 0x800FDAF0, "46df1d101d4e0a151a0239d9b9590a20ea28db73806ba9506c403156032088c5"),
    (5630, 0x800FE16C, 0x800FE1BC, "28f37b8649d653255dd76f9280ef5968c19330f9cebcdd3fc649758f67f993cf"),
    (5630, 0x800FDBE4, 0x800FDC00, "2dc6f55f240a82f9f03ac558ed61992e78a82bb57550582cb1d66b49d63ad228"),
    (5630, 0x800FDEF0, 0x800FDF0C, "d04e9eebfcc34e7c75b80cbfff88f3117d04d48b5359c84e1d7b1c7649744d8e"),
    (5630, 0x800FE388, 0x800FE3A4, "13ef00ba42a5596b900a02001ab58e47ba8bb011f31272e2efb58a4600d536f7"),
    (5630, 0x800FE590, 0x800FE5AC, "79a9e1cfd9a3e356649015104442a9d241a2bc36606cf76cfb4f0495ba33bb72"),
    (5661, 0x800FCF3C, 0x800FCF90, "6f57ea55bd2839312a146ec46f76ad2c53a652835bf082d5189bd06c567fcf5d"),
    (5671, 0x800F379C, 0x800F37F0, "6b452ea569e498d32bc8d514423d93f19df76c0e8959903e85b4ddf8608bc90a"),
    (5671, 0x800F3BD0, 0x800F3C28, "1073204bc19f1ce4c2f3184733d954b71f0fb8b0cdc18719628cc0c775661640"),
    (5688, 0x800FB330, 0x800FB34C, "7c664a51c1e10d02a250161eb10b9eaf5a5e844cdcff872d8fb920a3b97e8510"),
    (5688, 0x800FC01C, 0x800FC084, "1c9388e88f5f0a78987a2785f3e51089e4d0c97cec6f905b7eb1ec963c74c638"),
    (5688, 0x800FC12C, 0x800FC148, "7c664a51c1e10d02a250161eb10b9eaf5a5e844cdcff872d8fb920a3b97e8510"),
    (5698, 0x800F213C, 0x800F2158, "2357286606e28f06d8618d36ddbe26c8c8f33cfe1ebfe0409a66ed2a2859af47"),
    (5698, 0x800F2548, 0x800F2564, "eef624115635f4444dfa350b4a0c9bd73354d5467ab6ab8eb72532ebd0a4c024"),
    (5698, 0x800F2C8C, 0x800F2CA8, "a3b63af190c90458b00a6603dae94f1dc029f02da4487accaaff1eb03428ef5e"),
]


def gate_code(code):
    return 19 <= code <= 27 or 0x97 <= code <= 0x9a


def dynamic_cells(raw, start, end):
    """Read immediate argument writes around calls to native collision setter.

    The selected, hash-guarded spans have no branch or computed argument. A
    call consumes its delay-slot argument write before the four values are
    read. 80060558 divides logical x/y by two to address a map cell.
    """
    registers = {0: 0}
    pending = False
    result = defaultdict(list)
    for (word,) in struct.iter_unpack("<I", raw[start-atlas.BASE:end-atlas.BASE]):
        op, source, target = word >> 26, (word >> 21) & 31, (word >> 16) & 31
        if op == 9 and source == 0:  # addiu register, zero, immediate
            registers[target] = struct.unpack("<h", struct.pack("<H", word & 65535))[0]
        elif op == 0 and (word & 63) == 0x21 and source == 0 and target == 0:
            registers[(word >> 11) & 31] = 0  # addu register, zero, zero
        if pending:
            require(all(r in registers for r in range(4, 8)), "Unknown collision call argument")
            x, y, code, selector = [registers[r] for r in range(4, 8)]
            require(gate_code(code), "Dynamic call no longer creates a gate event")
            result[selector].append((x // 2, y // 2))
            pending = False
        if word == 0x0C018156:  # jal 80060558
            pending = True
    require(not pending and sum(map(len, result.values())) == 4, "Incomplete portal collision patch")
    return result


def farm_marker_cells(raw):
    """Read area 1's four 80058e24 marker writes (grid x/y, not world x/y)."""
    registers, points, tiles = {}, [], []
    pending = False
    for (word,) in struct.iter_unpack("<I", raw[0x800FC01C-atlas.BASE:0x800FC084-atlas.BASE]):
        if word >> 26 == 9 and (word >> 21) & 31 == 0:
            registers[(word >> 16) & 31] = word & 65535
        if pending:
            require(all(r in registers for r in (5, 6, 7)), "Unknown farm marker argument")
            points.append((registers[5], registers[6]))
            tiles.append(registers[7])
            pending = False
        if word == 0x0C016389:  # jal 80058e24
            pending = True
    require(not pending and tiles == [0x11, 0x15, 0x19, 0x1D], "Farm completion marker changed")
    return {0: points}


def generate(disc):
    for rid, start, end, expected in GUARDS:
        raw, base = (disc.exe, atlas.BIAS) if rid is None else (disc.resource(rid), atlas.BASE)
        require(atlas.sha(atlas.span(raw, start-base, end-start)) == expected,
                f"Gate consumer changed at {start:08x}; review the native mapping")
    index = atlas.read_json(atlas.INDEX)
    published = json.loads((ROOT / "data/player-atlas.js").read_text(encoding="utf8").removeprefix(
        "globalThis.PLAYER_ATLAS = ").rstrip(";\n"))
    maps = {row["id"]: row for row in published["maps"]}
    entries, evidence = {}, []

    def add(scene, area, selectors, floor=None, patch=None, marker=False):
        rid, offset, _ = index["scenes"][str(scene)]
        require(disc.group_entry(0, scene) == rid, "Native scene resource changed")
        raw = disc.resource(rid)
        descriptor = struct.unpack_from("<7I", raw, offset + 28 * area)
        event_ptr, graphic_ptr = struct.unpack_from("<II", raw, descriptor[3]-atlas.BASE)
        events = disc.unpack_asset(rid, event_ptr)
        graphic = disc.unpack_asset(rid, graphic_ptr)
        version, left, top, width, height = struct.unpack_from("<5H", graphic)
        require((version, left, top) == (1, 0, 0), "Map coordinate origin changed")
        require(struct.unpack_from("<HH", events, 2) == (width, height) and
                len(events) == 8 + 2 * width * height, "Event grid dimensions changed")
        cells = defaultdict(list)
        for cell, (word,) in enumerate(struct.iter_unpack("<H", events[8:])):
            if gate_code(word >> 8):
                cells[word & 255].append((cell % width, cell // width))
        installed = farm_marker_cells(raw) if marker else dynamic_cells(raw, *patch) if patch else {}
        cells.update(installed)
        map_id = f"map-{scene}-{area}"
        require(map_id in maps, "Entrance map is not published")
        for selector, gate in selectors.items():
            points = cells[selector]
            require(points and len(points) == len(set(points)), "Missing or repeated gate cells")
            require(all(0 <= x < width and 0 <= y < height for x, y in points), "Pin outside map")
            # Check the same selector belongs to a real kind-3 destination,
            # rather than a similarly numbered plaque or decoration event.
            positions = [atlas.span(raw, descriptor[1]-atlas.BASE + n*10, 10) for n in range(48)]
            ordinal = next((n for n, p in enumerate(positions) if p[6:8] == bytes((3, selector))), None)
            require(ordinal is not None, "No native kind-3 portal selector")
            destination = struct.unpack_from("<HHHBBII", raw, descriptor[2]-atlas.BASE + ordinal*16)
            require(destination == (16, 0, 0, 0, 0, 0, 0), "Portal destination is no longer generated")
            key = "location-" + GATES[gate] + "-gate"
            xs, ys = zip(*points)
            record = {"map": map_id, "x": round((min(xs)+max(xs)+1)/(2*width), 8),
                      "y": round((min(ys)+max(ys)+1)/(2*height), 8)}
            if floor:
                record["floor"] = floor
            require(all(row["map"] != map_id for row in entries.get(key, [])), "Duplicate entrance mapping")
            entries.setdefault(key, []).append(record)
            evidence.append({"location": key, "gateId": gate, "map": map_id,
                             "resource": rid, "selector": selector, "cells": sorted(points),
                             "gridSize": [width, height],
                             "source": "native-completion-marker" if marker else
                             "native-call" if selector in installed else "event-grid"})

    room = disc.resource(5698)
    for area, table, count in [(0, 0x800F7D70, 13), (1, 0x800F7E3C, 3), (2, 0x800F80F8, 6)]:
        gates = struct.unpack_from("<" + "I"*count, room, table-atlas.BASE)
        require(all(0 < g < len(GATES) for g in gates), "Unknown chamber gate ID")
        add(9, area, dict(enumerate(gates)), floor="B"+str(area+1))
    add(6, 3, {0: 18}, patch=(0x800FDA9C, 0x800FDAF0))
    add(6, 5, {0: 21})
    add(6, 7, {0: 9}, patch=(0x800FE16C, 0x800FE1BC))
    add(6, 8, {0: 31})
    add(8, 0, {0: 6, 1: 29}, patch=(0x800F3BD0, 0x800F3C28))
    add(10, 0, {0: 12})
    add(10, 1, {0: 12}, marker=True)
    add(11, 1, {0: 15, 1: 30})
    require(len(entries) == 31 and len(evidence) == 32 and
            {e["gateId"] for e in evidence} == set(range(1, 32)),
            "Native entrance coverage is incomplete")
    return {"schema": 1, "entries": entries, "evidence": evidence,
            "scope": "Exact native hub portal positions. Story-state access and randomized gate floors are separate.",
            "unmapped": [{"location": "location-hidden-gate",
                          "reason": "An entrance for this encounter pool has not been verified."}]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bin", required=True, type=Path)
    parser.add_argument("--write", action="store_true")
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    proof = atlas.read_json(atlas.PROOF)
    with args.bin.open("rb") as handle, mmap.mmap(handle.fileno(), 0, access=mmap.ACCESS_READ) as image:
        digest = atlas.sha(image)
        require(digest in {JAPANESE, atlas.BASELINE, proof["patchedBinSha256"]},
                "Unknown disc; use the original or an authenticated atlas English release")
        output = generate(atlas.Disc(image, digest))
    text = PREFIX + json.dumps(output, ensure_ascii=False, separators=(",", ":")) + ";\n"
    if args.write:
        OUTPUT.write_text(text, encoding="utf8")
    if args.check:
        require(OUTPUT.read_text(encoding="utf8") == text, "Entrance data differs; regenerate and review")
    print(json.dumps({"gates": len(output["entries"]), "entrances": len(output["evidence"]), "nativeConsumers": len(GUARDS),
                      "chamberFloors": 3, "unmapped": len(output["unmapped"])}))


if __name__ == "__main__":
    main()
