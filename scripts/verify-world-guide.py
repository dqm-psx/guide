"""Verify the handbook's cited PSX records against the Current v1.0.73 disc.

Inputs are the local patched BIN, release manifest, and the public comparison
and manifest files identified in the handbook. No game text or disc assets
are written. The coordinate index contains only table slots and evidence hashes.
"""
import argparse
from collections import Counter
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import struct

ROOT = Path(__file__).resolve().parents[1]
_spec = importlib.util.spec_from_file_location("native", ROOT / "scripts/sync-verify-native.py")
native = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(native)
require = native.require

PSX_EXE_BIAS = 0x8000F800
SCRIPT_BASE = 0x800EB010
PHYSICAL = 0x1FFFFFFF
# These are the installed v1.0.73 resident loader's table bounds. Both loader
# references and the instruction that specifies its length are checked below.
FIXUP_OFFSET = 0x3A330
FIXUP_COUNT = 337
V73_HASH = "c7fd48e4decd7747a3e8b72ff052960b4ae0943ad61b6a95c57c946791cba812"
PUNCTUATION = {0x24:" ", 0x27:"-", 0x28:".", 0x29:",", 0x2A:"?", 0x2B:"!",
               0x2C:"~", 0x2D:"&", 0x2E:"*", 0x30:":", 0x31:"○", 0x32:"×",
               0x33:"△", 0x34:"□", 0x35:"/", 0x3B:"+", 0x5A:"'", 0x5B:'"',
               0x5C:"(", 0x5D:")", 0x5E:";", 0x5F:"%", 0x60:"=", 0x61:"[",
               0x62:"]", 0x63:"#", 0x64:"@", 0x65:"_", 0x66:"⚿"}
GLYPHS = {**dict(enumerate("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ")),
          **dict(enumerate("abcdefghijklmnopqrstuvwxyz", start=0x40)), **PUNCTUATION}
# Approved wording correction in the later public export. Only these messages,
# only this complete word, and only an otherwise exact text match are accepted.
HEALIE_IDS = {"s0ac3d800_330b", "s0ac3d800_3332", "s0ac3d800_335c",
              "s0ac3d800_33cd", "s0ac3d800_3440", "s0ac3d800_3466",
              "s0ac3d800_38f4", "s0ac3d800_3bc0", "s0b1d9000_011c"}


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def canonical(value):
    return digest(json.dumps(value, ensure_ascii=False, separators=(",", ":")).encode())


def read_json(path):
    return json.loads(Path(path).read_bytes())


def handbook():
    source = (ROOT / "data/world-guide.js").read_text(encoding="utf-8")
    match = re.search(r"^  provenance: (.+),$", source, re.MULTILINE)
    require(match, "Handbook provenance missing")
    start = source.index("  entries: [") + len("  entries: ")
    entries, end = json.JSONDecoder().raw_decode(source[start:])
    require(source[start+end:].strip() == "};", "Unexpected handbook format")
    return json.loads(match.group(1)), entries


def sentence(value):
    return " ".join(value.split())


def message(data, pos):
    result = []
    require(0 <= pos < len(data), "Invalid message pointer")
    stop = min(pos + 8192, len(data))
    while pos < stop:
        code = data[pos]
        pos += 1
        if code in GLYPHS:
            result.append(GLYPHS[code])
        elif code == 0xFF or 0xE2 <= code <= 0xEB:
            return sentence("".join(result))
        elif code == 0xF0:
            result.append("{PLAYER}")
        elif code == 0xFA:
            require(pos < stop, "Missing substitution argument")
            result.append("{VARIABLE:%02X}" % data[pos])
            pos += 1
        elif code in (0xF3, 0xF4, 0xFC, 0xFD, 0xFE):
            result.append(" ")
        elif code in (0xED, 0xF2, 0xF6, 0xF7, 0xF8, 0xF9):
            require(pos < stop, "Missing message control argument")
            pos += 1  # Menus, timing, sound and voice commands have no displayed glyph.
        else:
            require(code in (0xEC, 0xEE, 0xEF, 0xF1, 0xF5), "Unsupported visible glyph or message control")
    raise ValueError("Unterminated native message")


def menu_lines(data, pos):
    result = []
    require(0 <= pos < len(data), "Invalid key-description pointer")
    stop = min(pos + 8192, len(data))
    while pos < stop and data[pos] == 0xFE:
        pos += 3  # FE followed by the two-byte screen coordinate.
        line = []
        while pos < stop and data[pos] not in (0xFE, 0xFF):
            require(data[pos] in GLYPHS, "Unsupported key-description glyph")
            line.append(GLYPHS[data[pos]])
            pos += 1
        result.append("".join(line))
    require(result and pos < stop and data[pos] == 0xFF, "Unterminated key description")
    return sentence(" ".join(result))


def table_message(data, desc, slot, base):
    _, offsets, pool = struct.unpack_from("<III", data, desc)
    wide = bool(pool & 0x20000000)
    offsets = (offsets & PHYSICAL) - base
    pool = (pool & PHYSICAL) - base
    width = 4 if wide else 2
    at = offsets + width * slot
    require(0 <= at <= len(data)-width and 0 <= pool < len(data), "Message table outside storage")
    value = struct.unpack_from("<I" if wide else "<H", data, at)[0]
    return message(data, pool + value)


class Disc:
    def __init__(self, raw):
        self.raw = raw
        self.exe = native.extent(raw, 93985, 899072)
        self.resources = {}

    def resource(self, index):
        if index not in self.resources:
            offset, size = struct.unpack_from("<II", self.exe, 0x7EA10 + index*8)
            require(0 <= index < 6025 and offset % 2048 == 0, "Invalid archive entry")
            self.resources[index] = native.extent(self.raw, 23 + offset//2048, size)
        return self.resources[index]

    def resident_memory(self):
        # Locate the sector-aligned, checksummed resident header on the release
        # disc. Setup installs EXE and opening resource pointers before menus run.
        at = self.raw.find(b"DQMENG02")
        require(at >= 0 and at % 2352 == 24+512, "Resident header unavailable")
        lba = at//2352
        header = native.extent(self.raw, lba, 2048)[512:]
        size, base = struct.unpack_from("<II", header, 8)
        require(16 <= size <= 0x20000 and 0x80100000 <= base < 0x80200000, "Invalid resident layout")
        blob = native.extent(self.raw, lba, size + 512)[512:]
        mem = bytearray(0x200000)
        mem[0x10000:0x10000+len(self.exe)-0x800] = self.exe[0x800:]
        start = base & PHYSICAL
        require(start+size <= len(mem), "Resident exceeds memory")
        mem[start:start+size] = blob
        opening = self.resource(5574)
        require(len(opening) == FIXUP_OFFSET + FIXUP_COUNT * 8 + 4, "Unexpected loader extent")
        addr = SCRIPT_BASE + FIXUP_OFFSET
        instructions = struct.pack("<II", 0x3C120000 | addr >> 16, 0x36520000 | addr & 0xFFFF)
        require(opening[:FIXUP_OFFSET].count(instructions) == 2, "Loader does not reference this fixup table")
        count_load = struct.pack("<II", 0x3C110000, 0x36310000 | FIXUP_COUNT)
        require(opening[:FIXUP_OFFSET].count(count_load+instructions) == 1, "Unexpected relocation count")
        for target, relative in struct.iter_unpack("<II", opening[FIXUP_OFFSET:-4]):
            require(0x80010000 <= target < 0x80200000 and target % 4 == 0, "Invalid relocation target")
            require(relative & 0xDFFE0000 == 0 and (relative & 0x1FFFF) < size, "Invalid relocation")
            struct.pack_into("<I", mem, target & PHYSICAL, base + relative)
        return mem


def verify(image, release, comparison_bytes, public_manifest):
    provenance, entries = handbook()
    index = read_json(ROOT/"scripts/world-disc-index.json")
    patch = public_manifest["current_patch"]
    require(release["version"] == patch["version"] == "v1.0.73" and release["edition"] == patch["edition"] == "current", "Expected the v1.0.73 Current release")
    require(release["source_commit"] == patch["source_revision"] and release["archive"]["sha256"] == patch["package_sha256"], "Release does not match public metadata")
    require(digest(image) == release["patched_bin_sha256"] == V73_HASH and release["original_bin_sha256"] == native.RETAIL_SHA256, "Unexpected disc identity")
    comparison_hash = digest(comparison_bytes)
    require(comparison_hash == public_manifest["published_sha256"]["comparison-data.json"] == provenance["comparison_sha256"], "Unexpected public wording snapshot")
    comparison = json.loads(comparison_bytes)
    require(comparison["builder_revision"] == public_manifest["translation_revision"] and len(comparison["rows"]) == public_manifest["row_count"], "Snapshot revisions/counts differ")
    ids = {s for entry in entries for s in entry["source_ids"]}
    categories = ["script_slots", "system_slots", "service_descriptor_slots", "menu_pointer_offsets"]
    indexed = [s for category in categories for s in index[category]]
    require(len(set(indexed)) == len(indexed) and set(indexed) == ids, "Coverage does not match all handbook citations")
    rows = {}
    for row in comparison["rows"]:
        if row["id"] in ids and row["catalog"] != "text/location_titles.json":
            require(row["id"] not in rows and row["source_revision"] == public_manifest["translation_revision"], "Duplicate or stale source row")
            rows[row["id"]] = row
    identities = [[s,rows[s]["catalog"],rows[s]["raw"]["japanese"]] for s in sorted(ids)]
    require(canonical(identities) == index["source_identity_sha256"], "Citation identities changed")
    disc = Disc(image)
    runtime = disc.resident_memory()
    variants = set()
    short_names = 0
    slot_counts = Counter()
    for source_id, slots in index["script_slots"].items():
        expected = sentence(rows[source_id]["current"])
        for rid, slot in slots:
            actual = table_message(disc.resource(rid), index["script_descriptors"][str(rid)], slot, SCRIPT_BASE & PHYSICAL)
            if actual != expected:
                require(source_id in HEALIE_IDS and re.sub(r"\bHale\b", "Healie", actual) == expected, "Unreviewed script wording difference: " + source_id)
                variants.add(source_id)
            slot_counts["dialogue"] += 1
    for source_id, slots in index["system_slots"].items():
        current = rows[source_id]["raw"]["translations"]["current"]
        expected = current.get("english_short", current["english"]).removesuffix("<END>")
        if expected != rows[source_id]["current"]:
            short_names += 1
        for slot in slots:
            actual = table_message(runtime, (PSX_EXE_BIAS & PHYSICAL) + index["system_descriptor"]+8, slot, 0)
            require(actual == expected, "Native menu label differs: "+source_id)
            slot_counts["system"] += 1
    for source_id, slots in index["service_descriptor_slots"].items():
        for desc, slot in slots:
            actual = table_message(runtime, (PSX_EXE_BIAS & PHYSICAL)+desc+8, slot, 0)
            require(actual == sentence(rows[source_id]["current"]), "Native service dialogue differs: "+source_id)
            slot_counts["service"] += 1
    for source_id, pointers in index["menu_pointer_offsets"].items():
        expected = sentence(rows[source_id]["current"])
        for offset in pointers:
            pointer = struct.unpack_from("<I", runtime, (PSX_EXE_BIAS & PHYSICAL)+offset)[0]
            require(menu_lines(runtime, pointer & PHYSICAL) == expected, "Native key description differs: "+source_id)
            slot_counts["key_descriptions"] += 1
    require(variants == HEALIE_IDS, "Reviewed release wording differences changed")
    guards = Counter()
    for guard in index["progression_guards"]:
        raw = disc.exe if guard["region"]=="exe" else disc.resource(guard["region"])
        start = guard["offset"]
        size = guard["length"]
        require(0 <= start < start+size <= len(raw) and digest(raw[start:start+size]) == guard["sha256"], "Progression evidence changed: "+guard["meaning"])
        guards[guard["group"]] += 1
    return {
        "schema_version":1, "version":release["version"], "edition":release["edition"],
        "source_revision":release["source_commit"], "package_sha256":patch["package_sha256"],
        "patched_bin_sha256":V73_HASH, "public_revision":provenance["public_revision"], "comparison_sha256":comparison_hash,
        "world_entries_sha256":canonical(entries), "native_index_sha256":canonical(index),
        "verified":{"articles":len(entries), "articles_by_kind":dict(sorted(Counter(e["kind"] for e in entries).items())),
                    "cited_records":len(ids), "source_categories":{k:len(index[k]) for k in categories},
                    "native_slots":dict(sorted(slot_counts.items())), "dialogue_resources":len(index["script_descriptors"]),
                    "abbreviated_system_names":short_names, "progression_spans":dict(sorted(guards.items()))},
        "wording_differences":[{"release_spelling":"Hale","public_spelling":"Healie","source_ids":sorted(variants)}],
        "scope":"All cited records for the campaign, quest, NPC, boss and location articles were resolved in the v1.0.73 Current disc. Text verification compares visible wording and substitutions across all native slots. Native guards cover the two spirit rewards, fixed story keys, the Sky Key audience, the farm egg window and the arena round selector. The articles summarize script clues; this proof does not simulate every event path, validate boss stats, or verify map and sprite art."
    }


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for key in ("bin", "release-manifest", "comparison", "source-manifest"):
        parser.add_argument("--"+key, required=True, type=Path)
    parser.add_argument("--output", type=Path, default=ROOT/"data/world-verification.json")
    args = parser.parse_args()
    proof = verify(args.bin.read_bytes(), read_json(args.release_manifest), args.comparison.read_bytes(), read_json(args.source_manifest))
    args.output.write_text(json.dumps(proof, ensure_ascii=False, indent=2)+"\n", encoding="utf-8")
    print(f'Verified {proof["version"]}: {proof["verified"]["articles"]} handbook entries, {proof["verified"]["cited_records"]} source records.')
