"""Verify or rebuild the static PSX atlas from two authenticated English discs.

The checked-in index records native addresses and dialogue IDs, never disc data.
Use --write to update the atlas, changed images and the verification receipt.
"""
import argparse
import hashlib
import importlib.util
import io
import json
import mmap
import struct
from collections import defaultdict
from contextlib import ExitStack
from functools import cache
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "scripts/atlas-native-index.json"
PROOF = ROOT / "scripts/atlas-verification.json"
BASE = 0x800EB010
BIAS = 0x8000F800
BASELINE = "69213c55d5c2957d2c0509ab7fc40f0e41d5ac2402adb2465fac63356da555ad"
PREFIX = "globalThis.PLAYER_ATLAS = "
SPEC = importlib.util.spec_from_file_location("native", Path(__file__).with_name("sync-verify-native.py"))
native = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(native)
require = native.require


def read_json(path):
    return json.loads(path.read_text(encoding="utf8"))


def sha(data):
    return hashlib.sha256(data).hexdigest()


def span(data, offset, size):
    require(0 <= offset <= len(data) - size, f"Native span outside resource: {offset} + {size}")
    return data[offset:offset + size]


class Disc:
    def __init__(self, image, expected):
        require(sha(image) == expected, "Disc does not match its expected SHA-256")
        self.image = image
        self.exe = native.extent(image, 93985, 899072)
        require(self.exe[:8] == b"PS-X EXE", "Missing native executable")
        self.groups = struct.unpack_from("<24I", self.exe, 0x8008E1AC - BIAS)

    @cache
    def resource(self, rid):
        require(0 <= rid < 6025, "Invalid archive index")
        offset, size = struct.unpack_from("<II", self.exe, 0x7EA10 + 8 * rid)
        require(offset % 2048 == 0, "Unaligned archive resource")
        return native.extent(self.image, 23 + offset // 2048, size)

    def group_entry(self, group, index):
        require(0 <= group < len(self.groups) - 1, "Unsupported resource group")
        at = self.groups[group] + 4 * index
        require(self.groups[group] <= at < self.groups[group + 1], "Resource index leaves its group")
        return struct.unpack("<I", span(self.exe, at - BIAS, 4))[0]

    @cache
    def unpack_asset(self, rid, address):
        data = self.resource(rid)
        require(BASE <= address < BASE + len(data), "Map asset outside its scene")
        return native.decompress(data[address - BASE:])


GLYPHS = {i: c for i, c in enumerate("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ")}
GLYPHS.update({64 + i: c for i, c in enumerate("abcdefghijklmnopqrstuvwxyz")})
GLYPHS.update({0x24: " ", 0x27: "-", 0x28: ".", 0x29: ",", 0x2a: "?", 0x2b: "!",
               0x2c: "~", 0x2d: "&", 0x2e: "*", 0x30: ":", 0x35: "/", 0x3b: "+",
               0x5a: "'", 0x5b: '"', 0x5c: "(", 0x5d: ")", 0x5e: ";", 0x5f: "%",
               0x60: "=", 0x61: "[", 0x62: "]", 0x63: "#", 0x64: "@", 0x65: "_"})


def title(raw, descriptor, area):
    group, offsets, pool = struct.unpack("<3I", span(raw, descriptor, 12))
    ordinal = struct.unpack("<H", span(raw, group - BASE + 2 * area, 2))[0]
    width = 4 if pool & 0x20000000 else 2
    offset = int.from_bytes(span(raw, offsets - BASE + ordinal * width, width), "little")
    at = (pool & ~0x20000000) - BASE + offset
    require(0 <= at < len(raw), "Title pointer outside scene")
    end = raw.find(b"\xff", at, at + 160)
    require(at < end and all(v in GLYPHS for v in raw[at:end]), "Unknown map title encoding")
    return ordinal, "".join(GLYPHS[v] for v in raw[at:end]), at, raw[at:end + 1]


def doorways(raw, descriptor, events, width, height):
    require(struct.unpack_from("<HH", events, 2) == (width, height) and
            len(events) == 8 + 2 * width * height, "Door grid dimensions differ")
    cells = defaultdict(list)
    for cell, (word,) in enumerate(struct.iter_unpack("<H", events[8:])):
        opcode = word >> 8
        if 1 <= opcode <= 18:
            cells[1 if opcode <= 9 else 2, word & 255].append((cell % width, cell // width, word))
    result = []
    for (kind, ident), positions in sorted(cells.items()):
        for ordinal in range(48):
            pos = span(raw, descriptor[1] - BASE + ordinal * 10, 10)
            if pos[6:8] == bytes((kind, ident)):
                break
        else:
            raise ValueError(f"No native selector for grid doorway {kind}/{ident}")
        record = span(raw, descriptor[2] - BASE + ordinal * 16, 16)
        result.append((kind, ident, ordinal, positions, pos.hex(), record.hex()))
    return result


def native_map(disc, scene, item):
    number, area, source, offset, expected_ordinal, _, _ = item
    rid, descriptor, text_descriptor = scene
    source_data = disc.exe if source is None else disc.resource(source)
    arrival = span(source_data, offset, 16)
    group, entry, target_scene, target_area, *_ = struct.unpack("<HHHBBII", arrival)
    require((number, area) == (target_scene, target_area), "Arrival selector points to another map")
    require(disc.group_entry(0, number) == rid, "Scene resource identity differs")
    tiles = disc.group_entry(group, entry)
    raw = disc.resource(rid)
    desc = struct.unpack("<7I", span(raw, descriptor + 28 * area, 28))
    event_ptr, gfx_ptr = struct.unpack("<II", span(raw, desc[3] - BASE, 8))
    graphic = disc.unpack_asset(rid, gfx_ptr)
    events = disc.unpack_asset(rid, event_ptr)
    version, x, y, w, h = struct.unpack_from("<5H", graphic)
    require((version, x, y) == (1, 0, 0) and 0 < w <= 128 and 0 < h <= 128 and
            len(graphic) == 10 + 8 * w * h, "Unexpected static map dimensions")
    ordinal, label, _, _ = title(raw, text_descriptor, area)
    require(ordinal == expected_ordinal, "Native title ordinal changed; review its public dialogue binding")
    return dict(tiles=tiles, graphic=graphic, events=events, doors=doorways(raw, desc, events, w, h),
                title=label, size=(w, h), arrival=arrival)


class TileBank:
    def __init__(self, data):
        self.data = data
        self.count = struct.unpack_from("<H", data, 2)[0]
        self.start = 4 + data[1] * 32
        require(data[0] == 1 and 0 < self.count <= 2048 and
                len(data) == self.start + self.count * 128 + 4, "Unsupported static tile bank")
        self.colors = [((v & 31) * 255 // 31, ((v >> 5) & 31) * 255 // 31,
                        ((v >> 10) & 31) * 255 // 31, 255 if v else 0)
                       for (v,) in struct.iter_unpack("<H", data[4:self.start])]
        self.images = {}

    def tile(self, word):
        if word not in self.images:
            index, palette = word & 2047, word >> 11
            require(index < self.count and palette < self.data[1], "Unavailable tile or palette")
            pixels = span(self.data, self.start + index * 128, 128)
            image = Image.new("RGBA", (16, 16))
            colors = self.colors[palette * 16:palette * 16 + 16]
            image.putdata([colors[n] for byte in pixels for n in (byte & 15, byte >> 4)])
            self.images[word] = image
        return self.images[word]


def render(graphic, bank):
    w, h = struct.unpack_from("<HH", graphic, 6)
    image = Image.new("RGBA", (16 * w, 16 * h))
    for cell, layers in enumerate(struct.iter_unpack("<4H", graphic[10:])):
        pos = (cell % w * 16, cell // w * 16)
        for word in layers[:3]:
            if word & 2047:
                image.alpha_composite(bank.tile(word), pos)
    return image


def image_file(full, existing_name, write):
    digest = sha(full.tobytes())
    full.thumbnail((1100, 1100), Image.Resampling.NEAREST)
    if existing_name:
        require(len(existing_name) == 25 and existing_name.endswith(".webp") and
                all(c in "0123456789abcdef" for c in existing_name[:20]), "Invalid atlas image name")
        path = ROOT / "maps" / existing_name
        if path.is_file() and existing_name == sha(path.read_bytes())[:20] + ".webp":
            with Image.open(path) as image:
                # Lossless WebP may change RGB under alpha zero. Compare premultiplied pixels
                # so every visible channel and the alpha mask are checked.
                if image.size == full.size and image.convert("RGBA").convert("RGBa").tobytes() == full.convert("RGBa").tobytes():
                    return existing_name, digest
    require(write, "A native map image is missing or differs; rebuild with --write")
    encoded = io.BytesIO()
    full.save(encoded, "WEBP", lossless=True, method=3)
    data = encoded.getvalue()
    name = sha(data)[:20] + ".webp"
    (ROOT / "maps" / name).write_bytes(data)
    return name, digest


def destination(disc, record, spec, size):
    group, entry, _, area, entrance, *_ = struct.unpack("<HHHBBII", record)
    rid, root, _ = spec
    raw = disc.resource(rid)
    descriptors = struct.unpack("<7I", span(raw, root + 28 * area, 28))
    arrival = span(raw, descriptors[1] - BASE + 10 * entrance, 10)
    face, x, y, *_ = struct.unpack("<HhhBBH", arrival)
    require(not face & ~0x87 and 0 <= x < size[0] * 2 and 0 <= y < size[1] * 2,
            "Door destination arrival coordinates leave its map")
    return disc.group_entry(group, entry), arrival.hex()


def join_doors(old, new, index, maps, output, shipped, write, changes):
    arrivals = []
    variants = {}
    for key, (past, current) in maps.items():
        w, h = current["size"]
        past_records = {(kind, ident): record for kind, ident, _, _, _, record in past["doors"]}
        for kind, ident, _, cells, _, encoded in current["doors"]:
            record = bytes.fromhex(encoded)
            _, _, scene, area, *_ = struct.unpack("<HHHBBII", record)
            target = f"map-{scene}-{area}"
            if target not in maps:
                continue
            a, b = maps[target]
            spec = index["scenes"][str(scene)]
            texture, arrival = destination(new, record, spec, b["size"])
            if past_records.get((kind, ident)) == encoded:
                prior_texture, prior_arrival = destination(old, record, spec, a["size"])
                if (prior_arrival != arrival or old.resource(prior_texture) != new.resource(texture)) and key not in changes["destinationArrivals"]:
                    changes["destinationArrivals"].append(key)
            x, y, _ = cells[len(cells) // 2]
            pin = dict(to=target, x=round((x + .5) / w, 4), y=round((y + .5) / h, 4))
            evidence = [key, kind, ident, target, texture, arrival]
            if texture != b["tiles"]:
                variant_id = f"tiles-{texture}"
                if (target, texture) not in variants:
                    existing = next((r["image"] for r in shipped[target].get("arrivalVariants", [])
                                     if r["id"] == variant_id), None)
                    art = render(b["graphic"], TileBank(new.resource(texture)))
                    name, digest = image_file(art, existing, write)
                    variant = dict(id=variant_id, image=name)
                    variant["from"] = []
                    variants[target, texture] = variant, digest
                    output[target].setdefault("arrivalVariants", []).append(variant)
                variant, digest = variants[target, texture]
                if key not in variant["from"]:
                    variant["from"].append(key)
                pin["variant"] = variant_id
                evidence.extend([variant["image"], digest])
            if pin not in output[key]["exits"]:
                output[key]["exits"].append(pin)
            arrivals.append(evidence)
    return arrivals


def json_digest(value):
    return sha(json.dumps(value, sort_keys=True, separators=(",", ":")).encode())


def inspect(args, old, new, manifest, index):
    old_ship = json.loads((ROOT / "data/player-atlas.js").read_text(encoding="utf8").removeprefix(PREFIX).rstrip(";\n"))
    shipped = {r["id"]: r for r in old_ship["maps"]}
    ids = {f"map-{r[0]}-{r[1]}" for r in index["maps"]}
    require(ids == shipped.keys() and len(ids) == len(index["maps"]), "Atlas identity inventory differs")
    native_supplement = set(index.get("nativeSupplementMaps", []))
    require(native_supplement <= ids, "Unknown supplemental native map")
    for guard in index["consumers"]:
        _, start, end, digest = guard
        for disc in (old, new):
            require(sha(span(disc.exe, start - BIAS, end - start)) == digest,
                    f"Native atlas code changed at {start:08x}; review the decoder")
    banks = {}
    baseline_banks = {}
    baseline_pixels = {}
    images = {}
    receipts = []
    deltas = defaultdict(list)
    output = {}
    maps = {}
    for item in index["maps"]:
        scene, area, _, _, _, title_row, place_id = item
        key = f"map-{scene}-{area}"
        spec = index["scenes"][str(scene)]
        a, b = native_map(old, spec, item), native_map(new, spec, item)
        maps[key] = (a, b)
        previous = old.resource(a["tiles"])
        current = new.resource(b["tiles"])
        differences = dict(titles=a["title"] != b["title"], graphics=a["graphic"] != b["graphic"],
                           tilesets=previous != current, eventGrids=a["events"] != b["events"],
                           doorways=a["doors"] != b["doors"], incomingSelectors=a["arrival"] != b["arrival"])
        for field, changed in differences.items():
            if changed:
                deltas[field].append(key)
        image_id = (sha(b["graphic"]), sha(current))
        old_name = shipped[key]["image"]
        if image_id not in images:
            if b["tiles"] not in banks:
                banks[b["tiles"]] = TileBank(current)
            images[image_id] = image_file(render(b["graphic"], banks[b["tiles"]]), old_name, args.write)
        name, full_digest = images[image_id]
        baseline_key = sha(a["graphic"]) + ":" + sha(previous)
        if key not in native_supplement and baseline_key not in baseline_pixels:
            if differences["graphics"] or differences["tilesets"]:
                if a["tiles"] not in baseline_banks:
                    baseline_banks[a["tiles"]] = TileBank(previous)
                baseline_pixels[baseline_key] = sha(render(a["graphic"], baseline_banks[a["tiles"]]).tobytes())
            else:
                baseline_pixels[baseline_key] = full_digest
        row = dict(id=key, title=b["title"], nativeTitle=b["title"], titleRow=title_row, placeId=place_id,
                   scene=scene, area=area, image=name, exits=[])
        if shipped[key].get("titleRow") == title_row and shipped[key].get("aliases"):
            row["title"] = shipped[key]["title"]
            row["aliases"] = shipped[key]["aliases"]
        output[key] = row
        receipts.append([key, b["title"], title_row, place_id, *image_id, full_digest, name,
                         sha(b["events"]), json_digest(b["doors"]), sha(b["arrival"])])
    require(json_digest(baseline_pixels) == index["sourcePixelsSha256"],
            "Native baseline pixels differ from the independently exported original map PNGs")
    arrivals = join_doors(old, new, index, maps, output, shipped, args.write, deltas)
    rows = list(output.values())
    art_files = {r["image"] for r in rows}
    art_files.update(v["image"] for r in rows for v in r.get("arrivalVariants", []))
    summary = dict(version=manifest["version"], baseline="v1.0.66", maps=len(rows),
                   places=len({r["placeId"] for r in rows}), scenes=len(index["scenes"]),
                   images=len(art_files), doorwaySelectors=sum(len(b["doors"]) for _, b in maps.values()),
                   exitPins=sum(len(r["exits"]) for r in rows), verifiedDestinations=len(arrivals),
                   arrivalVariants=sum(len(r.get("arrivalVariants", [])) for r in rows), runtimeSpans=len(index["consumers"]))
    proof = dict(**summary, sourceRevision=manifest["source_commit"],
                 baselineBinSha256=BASELINE, patchedBinSha256=manifest["patched_bin_sha256"],
                 nativeIndexSha256=json_digest(index), mapEvidenceSha256=json_digest(receipts),
                 destinationEvidenceSha256=json_digest(arrivals),
                 changesFromBaseline={k: v for k, v in sorted(deltas.items()) if v},
                 scope="Fixed named layouts, static background tile layers and palettes, scene title strings, "
                       "and grid-backed native doorway selectors. Scripted events, generated floors, "
                       "animated layers and story-state access are outside this proof.")
    if native_supplement:
        proof["nativeSupplementMaps"] = sorted(native_supplement)
        proof["scope"] += " Supplemental maps are verified from authenticated baseline/current native descriptors and assets; they are outside the independent PNG baseline fingerprint."
    atlas = dict(source=f"PSX {manifest['version']} verified static maps", verification=summary, maps=rows)
    require(args.write or read_json(PROOF) == proof, "Checked-in atlas verification receipt differs")
    # Public names and aliases are refreshed independently; the native identity, art and doors must still match.
    if args.write:
        (ROOT / "data/player-atlas.js").write_text(
            PREFIX + json.dumps(atlas, ensure_ascii=True, separators=(",", ":")) + ";\n", encoding="utf8")
        PROOF.write_text(json.dumps(proof, indent=2) + "\n", encoding="utf8")
    else:
        require(old_ship.get("verification") == summary and all(
            all(shipped[r["id"]].get(k) == v for k, v in r.items() if k != "title") for r in rows),
            "Shipped atlas differs from verified native outputs")
    print(json.dumps(proof, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bin", type=Path, required=True, help="Current edition patched raw 2352-byte-sector BIN")
    parser.add_argument("--release-manifest", type=Path, required=True)
    parser.add_argument("--baseline-bin", type=Path, required=True, help="Archived v1.0.66 English BIN")
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    manifest = read_json(args.release_manifest)
    require(manifest["edition"] == "current", "A current-edition release manifest is required")
    with ExitStack() as files:
        def disc(path, digest):
            handle = files.enter_context(path.open("rb"))
            image = files.enter_context(mmap.mmap(handle.fileno(), 0, access=mmap.ACCESS_READ))
            return Disc(image, digest)
        inspect(args, disc(args.baseline_bin, BASELINE), disc(args.bin, manifest["patched_bin_sha256"]),
                manifest, read_json(INDEX))


if __name__ == "__main__":
    main()
