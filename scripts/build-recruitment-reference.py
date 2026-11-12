"""Read named wild recruitment records from the original and Current PSX discs.

Only guide-listed wild contexts are included. The retained unused gate records
are excluded. Labels and translated names remain in the existing guide indexes.
Use --check to compare the checked-in artifact without writing it.
"""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("world", ROOT / "scripts/verify-world-guide.py")
world = importlib.util.module_from_spec(spec)
spec.loader.exec_module(world)
require = world.require
OVERLAY = 0x80114CB8
CAMPAIGNS = ("terry", "cobi", "tara")
UNUSED_TERRY_CONTEXTS = {122, 123, 124, 125}
MANUAL_REVISION = "0548201759747b6e00b1897c96aa2555ac8303a0"

# The v1.0.66 native harnesses executed these decision, final-RNG and feeding
# instructions. Equality transfers that evidence; it does not claim to emulate
# every story restriction or simultaneous-defeat order.
GUARDS = [
    (104, 0x80121320, 0x80121734, OVERLAY, "42055fb56b9791684dfb48381b8fed4d8adf146b1f1b2f664c6d3474fe14cbac", "joining decision"),
    (104, 0x80121864, 0x801218D0, OVERLAY, "ff9d343fbd025ce54636f64fea72b99500eb62c5fe4ba30fe72a44ce6b55a4e1", "final random gate"),
    (104, 0x8011B0C4, 0x8011B0E0, OVERLAY, "bb18bea689803c4d5dfae340975261dd88295ce179954cc1d97ba8134704fa10", "first-collection denominators"),
    (5502, 0x80128020, 0x801288CC, OVERLAY, "523f2b7333530f6fdf43a4304d4359c61c92a5750b2a7c2d7626d391b7f91bdd", "food handlers and shared appeal"),
    (5499, 0x8018C250, 0x8018C320, 0x8018C0B8, "f7f1352f8418478c9a477d4a6af03908f04b041175ab4f5d4d1c5eac13aeddd1", "initial appeal and battle mode"),
    (104, 0x801212C0, 0x80121320, OVERLAY, "720154a2400b558efb908424794b846f8997ce50cd03987481eb3abaea37ecb9", "candidate eligibility prechecks"),
    (5502, 0x80147FE0, 0x80148038, OVERLAY, "", "selected defeated candidate updater"),
    (5499, 0x8018C91C, 0x8018C934, 0x8018C0B8, "", "encounter recruitment-class copy"),
]


def read_js_json(path):
    text = path.read_text(encoding="utf8")
    return json.JSONDecoder().raw_decode(text.split("=", 1)[1].lstrip())[0]


def u32(data, offset):
    return struct.unpack_from("<I", data, offset)[0]


def context_resource(disc, campaign, context):
    groups = struct.unpack_from("<24I", disc.exe, 0x8008E1AC - world.PSX_EXE_BIAS)
    start, end = groups[17 + campaign:19 + campaign]
    require(0 <= context < (end - start) // 4, "Invalid encounter context")
    return u32(disc.exe, start - world.PSX_EXE_BIAS + context * 4)


def enemy_rows(disc, resource):
    raw = disc.resource(resource)
    formations, enemies, images, animations = struct.unpack_from("<4I", raw)
    require(16 <= formations < enemies < images <= animations < len(raw), "Invalid encounter header")
    require((enemies - formations) % 16 == 0 and (images - enemies) % 52 == 0, "Invalid encounter records")
    return [raw[at:at + 52] for at in range(enemies, images, 52)]


def build(image, original_image):
    require(world.digest(image) == world.V73_HASH, "Expected verified v1.0.73 Current disc")
    require(world.digest(original_image) == world.native.RETAIL_SHA256, "Expected retail Japanese disc")
    current, original = world.Disc(image), world.Disc(original_image)
    code_spans = []
    for resource, start, end, base, expected, purpose in GUARDS:
        a = current.resource(resource)[start - base:end - base]
        b = original.resource(resource)[start - base:end - base]
        actual = hashlib.sha256(a).hexdigest()
        require(a == b and len(a) == end - start, f"Native recruitment span changed: {purpose}")
        require(not expected or actual == expected, f"Native proof changed: {purpose}")
        code_spans.append({"resource": resource, "start": hex(start), "end": hex(end), "sha256": actual, "purpose": purpose})
    denominators = list(struct.unpack_from("<7I", current.resource(104), 0x8011B0C4 - OVERLAY))
    require(denominators == [2, 4, 9, 20, 33, 100, 200], "Recruitment denominator table changed")
    references = read_js_json(ROOT / "data/handbook-reference.js")
    native_species = read_js_json(ROOT / "data/monster-reference.js")["species"]
    species = {(row["family_id"], row["member"]): row["index"] for row in native_species
               if row["family_id"] is not None and row["member"] is not None}
    ranks = {}
    for disc in (current, original):
        resource = disc.resource(104)
        for (family, member), index in species.items():
            row = u32(resource, 0x80124518 - OVERLAY + family * 4) + member * 12 - OVERLAY
            rank = resource[row]
            require(0 <= rank <= 7, "Invalid species recruitment rank")
            require(index not in ranks or ranks[index] == rank, "Species rank differs between discs")
            ranks[index] = rank
    contexts = sorted({(row["game"], row["context_id"]) for mon in references["species"]
                       for row in mon["locations"] if row["kind"] == "wild"})
    encounters, record_bytes = [], bytearray()
    for campaign, context in contexts:
        if campaign == "terry" and context in UNUSED_TERRY_CONTEXTS:
            continue
        game = CAMPAIGNS.index(campaign)
        resource = context_resource(current, game, context)
        require(context_resource(original, game, context) == resource, "Encounter resource binding changed")
        rows = enemy_rows(current, resource)
        require(rows == enemy_rows(original, resource), "Wild enemy records differ between discs")
        enemies = []
        for row in rows:
            family, member, recruitment_class = row[:3]
            require((family, member) in species, "Unknown wild species")
            require(0 <= recruitment_class <= 7 and 1 <= row[42] <= 99, "Invalid wild recruitment record")
            index = species[(family, member)]
            enemies.append({"speciesIndex": index, "level": row[42], "recruitmentClass": recruitment_class, "speciesRank": ranks[index]})
            record_bytes.extend(row)
        encounters.append({"campaign": campaign, "contextId": context, "kind": "wild", "enemies": enemies})
    return {
        "schemaVersion": 1,
        "provenance": {
            "version": "v1.0.73", "currentDiscSha256": world.V73_HASH,
            "originalDiscSha256": world.native.RETAIL_SHA256,
            "manualRevision": MANUAL_REVISION,
            "method": "Native joining and feeding instructions, species ranks and listed wild enemy records match the Japanese original and Current English v1.0.73. The matching decision code was exercised by the v1.0.66 native harness.",
            "scope": "Conditional joining chance for the selected eligible defeated candidate. Encounter frequency, candidate selection order, scripted restrictions and party/farm capacity are not calculated.",
            "codeSpans": code_spans, "wildEnemyRecordsSha256": hashlib.sha256(record_bytes).hexdigest(),
            "contexts": len(encounters), "enemyRecords": sum(len(row["enemies"]) for row in encounters),
            "excludedTerryContexts": sorted(UNUSED_TERRY_CONTEXTS),
        },
        "rules": {"initialAppeal": 10, "maximumAppeal": 32767, "rankDenominators": denominators, "finalGate": [2870, 4096]},
        "meats": [{"itemId": item, "appeal": value} for item, value in ((25, 10), (26, 30), (27, 100), (28, 400))],
        "encounters": encounters,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bin", type=Path, required=True)
    parser.add_argument("--original-bin", type=Path, required=True)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    result = build(args.bin.read_bytes(), args.original_bin.read_bytes())
    output = ROOT / "data/recruitment-reference.js"
    text = "// Generated from verified native PSX records; see docs/recruitment-evidence.md.\n"
    text += "globalThis.RECRUITMENT_REFERENCE = " + json.dumps(result, ensure_ascii=True, separators=(",", ":")) + ";\n"
    if args.check:
        require(output.read_text(encoding="utf8") == text, "Recruitment reference is stale")
    else:
        output.write_text(text, encoding="utf8")
    print(json.dumps({"contexts": result["provenance"]["contexts"], "enemyRecords": result["provenance"]["enemyRecords"], "check": args.check}))


if __name__ == "__main__":
    main()
