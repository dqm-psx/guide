"""Read recruitment records from the original and Current PSX discs.

Includes listed wild encounters, verified fixed bosses and ordinary foreign
master pools. Unused gate records and unbound story formations are excluded.
Labels and translated names remain connected to the existing guide indexes.
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
spec = importlib.util.spec_from_file_location("field_routes", ROOT / "scripts/build-field-routes.py")
field_routes = importlib.util.module_from_spec(spec)
spec.loader.exec_module(field_routes)
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
    (5502, 0x8014D6A0, 0x8014D77C, OVERLAY, "", "consumed-item appeal bonus"),
    (5498, 0x800EBE51, 0x800EBE76, 0x800EB010, "274cd4607844a6653f2f83ded4fb465deb514faf688aa659e2d3f6a2819d074c", "successful item consumption script"),
    (None, 0x80041EF8, 0x80041F04, world.PSX_EXE_BIAS, "", "fixed encounter selects scene mode one"),
    (None, 0x80042220, 0x80042288, world.PSX_EXE_BIAS, "d9ebf083de06003ea23d0c7e126fb32ebac077e64009b416ba888a12788f20f8", "fixed battle callback"),
    (5499, 0x8018C120, 0x8018C18C, 0x8018C0B8, "", "boss and foreign-master battle mode"),
    (5502, 0x8014D1B4, 0x8014D1E4, OVERLAY, "", "fixed-boss meat rejection"),
    (5502, 0x8014C278, 0x8014C3FC, OVERLAY, "e84864a7917ccb6b464cd2d175923347790b5081000d62515f363e1e2309dc9a", "item target eligibility"),
    (5502, 0x80127784, 0x80127B6C, OVERLAY, "564d7d200e55a1160253af5ac51fa3e042cf8f73ab8b4ca3cd6cb1892d5bb267", "recovery item handlers"),
]
# These locations are generated at runtime by js/locations.js. Resolve their
# display labels from the same first ordinary encounter rather than a second
# independently maintained translation list.
SIDE_GATE_CONTEXTS = {"bazaar": 10, "well": 19, "farm": 31, "arena-left": 45,
                      "medal": 60, "library": 75, "bazaar-edge": 110,
                      "arena-right": 114, "stubborn-old-man": 118}


def read_js_json(path):
    text = path.read_text(encoding="utf8")
    return json.JSONDecoder().raw_decode(text.split("=", 1)[1].lstrip())[0]


def u32(data, offset):
    return struct.unpack_from("<I", data, offset)[0]


def group_resource(disc, group, slot):
    groups = struct.unpack_from("<24I", disc.exe, 0x8008E1AC - world.PSX_EXE_BIAS)
    start, end = groups[group:group + 2]
    require(0 <= slot < (end - start) // 4, "Invalid native group slot")
    return u32(disc.exe, start - world.PSX_EXE_BIAS + slot * 4)


def context_resource(disc, campaign, context):
    return group_resource(disc, 17 + campaign, context)


def enemy_rows(disc, resource):
    raw = disc.resource(resource)
    formations, enemies, images, animations = struct.unpack_from("<4I", raw)
    require(16 <= formations < enemies < images <= animations < len(raw), "Invalid encounter header")
    require((enemies - formations) % 16 == 0 and (images - enemies) % 52 == 0, "Invalid encounter records")
    return [raw[at:at + 52] for at in range(enemies, images, 52)]


def section(disc, resource, address):
    raw = disc.resource(resource)
    descriptor = struct.unpack_from("<HHHBBII", raw, address - world.SCRIPT_BASE)
    scene, area, pointer = descriptor[2], descriptor[3], descriptor[5]
    require(0 <= pointer - world.SCRIPT_BASE + 6 < len(raw), "Invalid area descriptor")
    return scene, area, raw[pointer - world.SCRIPT_BASE + 6]


def fixed_calls(script):
    """Literal fixed battle calls, including separate choices and phases."""
    calls = []
    for at in range(3, len(script) - 4):
        if script[at:at + 5] == bytes.fromhex("04 20 22 04 80") and script[at - 3:at - 1] == b"\x70\x00":
            require(script[at - 1] > 0, "Boss event unexpectedly requests an ordinary group")
            calls.append((at, script[at - 1]))
    return calls


def fixed_formations(raw, ids):
    first, records, images, _ = struct.unpack_from("<4I", raw)
    result = []
    for form in sorted(set(ids)):
        at = first + form * 16
        require(first < at <= records - 16, "Invalid fixed formation")
        # Fixed parties have three actor slots. Ordinary formation lists can
        # contain five species candidates and must not be read as live parties.
        positions = struct.unpack_from("<5h", raw, at + 6)
        require(positions[3:] == (-1, -1), "Fixed formation has unsupported trailing slots")
        indices = [index for index in positions[:3] if index >= 0]
        require(indices and all(records + index * 52 < images for index in indices), "Invalid fixed enemy")
        result.append({"id": form, "enemyRecordIndices": indices})
    return result


def boss_specs(current, original, references):
    articles = {row["id"]: row for row in world.handbook()[1]}
    gates = read_js_json(ROOT / "data/gate-generation.js")["entries"]
    wild_labels = {(row["game"], row["context_id"]): row["name"] for mon in references["species"] for row in mon["locations"]}
    for location, gate in gates.items():
        address = 0x80117068 + (gate["gateId"] - 1) * 16
        room = section(original, 18, address)
        require(room == section(current, 18, address), "Gate final destination changed")
        scene, area, context = room
        script_resource = group_resource(original, 0, scene)
        require(script_resource == group_resource(current, 0, scene), "Gate event binding changed")
        calls = fixed_calls(original.resource(script_resource))
        require(calls == fixed_calls(current.resource(script_resource)), "Gate battle calls changed")
        if gate.get("availability") == "unused":
            require(not calls, "Unused gate acquired a working boss event")
            continue
        require(calls, "Active gate lost its boss event")
        side = location.removeprefix("location-").removesuffix("-gate")
        title = articles[location]["title"] if location in articles else wild_labels[("terry", SIDE_GATE_CONTEXTS[side])]
        yield {"campaign": "terry", "contextId": context, "kind": "boss", "locationId": location,
               "title": title, "floor": gate["finalFloor"], "formationIds": sorted({form for _, form in calls}),
               "scriptResource": script_resource, "scriptCalls": [offset for offset, _ in calls]}
    # Reuse the guide's reviewed native room/event bindings. These exclude
    # ordinary monsters in the same resource and unrelated castle/ship guards.
    for key, (source, address, scene, area, call, *_rest) in field_routes.WORLD_FIGHTS.items():
        room = section(original, source, address)
        require(room == section(current, source, address) and room[:2] == (scene, area), "Story boss destination changed")
        script_resource = group_resource(original, 0, scene)
        require(script_resource == group_resource(current, 0, scene), "Story event binding changed")
        signature = bytes.fromhex("70 00 01 04 20 22 04 80")
        for disc in (current, original):
            require(disc.resource(script_resource)[call - 3:call + 5] == signature, "Reviewed story boss call changed")
        article_id = "boss-" + key
        article = articles[article_id]
        for campaign in CAMPAIGNS[1:]:
            yield {"campaign": campaign, "contextId": room[2], "kind": "boss", "locationId": article_id,
                   "title": article["places"][0] + " · " + article["title"], "formationIds": [1],
                   "scriptResource": script_resource, "scriptCalls": [call]}


def build(image, original_image):
    require(world.digest(image) == world.V73_HASH, "Expected verified v1.0.73 Current disc")
    require(world.digest(original_image) == world.native.RETAIL_SHA256, "Expected retail Japanese disc")
    current, original = world.Disc(image), world.Disc(original_image)
    code_spans = []
    for resource, start, end, base, expected, purpose in GUARDS:
        a = (current.exe if resource is None else current.resource(resource))[start - base:end - base]
        b = (original.exe if resource is None else original.resource(resource))[start - base:end - base]
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
    encounters, record_bytes, all_record_bytes = [], bytearray(), bytearray()
    def add_encounter(specification, indices=None, formations=None):
        campaign, context = specification["campaign"], specification["contextId"]
        game = CAMPAIGNS.index(campaign)
        resource = context_resource(current, game, context)
        require(context_resource(original, game, context) == resource, "Encounter resource binding changed")
        rows = enemy_rows(current, resource)
        require(rows == enemy_rows(original, resource), "Enemy records differ between discs")
        chosen = range(len(rows)) if indices is None else sorted(set(indices))
        enemies = []
        for record_index in chosen:
            require(0 <= record_index < len(rows), "Selected enemy is outside native record table")
            row = rows[record_index]
            family, member, recruitment_class = row[:3]
            require((family, member) in species, "Unknown encounter species")
            require(0 <= recruitment_class <= 7 and 1 <= row[42] <= 99, "Invalid enemy recruitment record")
            index = species[(family, member)]
            hp, mp = struct.unpack_from("<2H", row, 16)
            enemy = {"recordIndex": record_index, "speciesIndex": index, "level": row[42],
                     "recruitmentClass": recruitment_class, "speciesRank": ranks[index], "maxHp": hp, "maxMp": mp}
            if formations is not None:
                enemy["formationIds"] = [form["id"] for form in formations if record_index in form["enemyRecordIndices"]]
            enemies.append(enemy)
            all_record_bytes.extend(row)
            if specification["kind"] == "wild":
                record_bytes.extend(row)
        mode = {"wild": 0, "boss": 1, "master": 3}[specification["kind"]]
        entry = {**specification, "resource": resource, "battleMode": mode, "meatAllowed": mode != 1,
                 "maxEnemies": max(len(form["enemyRecordIndices"]) for form in formations) if formations else 3,
                 "enemies": enemies}
        if formations is not None:
            entry["formations"] = formations
        encounters.append(entry)
    for campaign, context in contexts:
        if campaign == "terry" and context in UNUSED_TERRY_CONTEXTS:
            continue
        add_encounter({"campaign": campaign, "contextId": context, "kind": "wild"})
    for spec in boss_specs(current, original, references):
        campaign = CAMPAIGNS.index(spec["campaign"])
        resource = context_resource(current, campaign, spec["contextId"])
        forms = fixed_formations(current.resource(resource), spec.pop("formationIds"))
        require(forms == fixed_formations(original.resource(resource), [form["id"] for form in forms]), "Fixed boss formation changed")
        add_encounter(spec, [index for form in forms for index in form["enemyRecordIndices"]], forms)
    master_counts = []
    for game, campaign in enumerate(CAMPAIGNS):
        base_at = 0x800C712C - world.PSX_EXE_BIAS + game
        base = original.exe[base_at]
        require(base == current.exe[base_at], "Foreign-master context base changed")
        candidate_total = 0
        for rank in range(20):
            count_at = 0x800AB4AC - world.PSX_EXE_BIAS + game * 20 + rank
            count = original.exe[count_at]
            require(count == current.exe[count_at] and count > 0, "Foreign-master pool count changed")
            add_encounter({"campaign": campaign, "contextId": base + rank, "kind": "master", "masterRank": rank,
                           "locationId": "field-wandering-masters", "title": "Foreign master · Rank " + str(rank)}, range(count))
            require(all(enemy["recruitmentClass"] not in (0, 7) and enemy["speciesRank"] != 7 for enemy in encounters[-1]["enemies"]),
                    "Ordinary master recruitment eligibility changed")
            candidate_total += count
        master_counts.append(candidate_total)
    require(master_counts == [236, 270, 270], "Foreign-master pool coverage changed")
    require(len({(row["campaign"], row["contextId"]) for row in encounters}) == len(encounters), "Ambiguous calculator encounter IDs")
    counts_by_kind = {kind: {"contexts": sum(row["kind"] == kind for row in encounters),
                             "enemyRecords": sum(len(row["enemies"]) for row in encounters if row["kind"] == kind)}
                      for kind in ("wild", "boss", "master")}
    return {
        "schemaVersion": 2,
        "provenance": {
            "version": "v1.0.73", "currentDiscSha256": world.V73_HASH,
            "originalDiscSha256": world.native.RETAIL_SHA256,
            "manualRevision": MANUAL_REVISION,
            "method": "Native joining and item instructions, species ranks, listed wild records, reviewed fixed boss formations and all ordinary foreign-master pools match the Japanese original and Current English v1.0.73. Native callback and joining harnesses exercise the documented rules.",
            "scope": "Conditional joining chance for the selected eligible defeated candidate. Encounter frequency, candidate selection order, scripted restrictions and party/farm capacity are not calculated.",
            "codeSpans": code_spans, "wildEnemyRecordsSha256": hashlib.sha256(record_bytes).hexdigest(),
            "enemyRecordsSha256": hashlib.sha256(all_record_bytes).hexdigest(), "countsByKind": counts_by_kind,
            "contexts": len(encounters), "enemyRecords": sum(len(row["enemies"]) for row in encounters),
            "excludedTerryContexts": sorted(UNUSED_TERRY_CONTEXTS),
        },
        "rules": {"initialAppeal": 10, "maximumAppeal": 32767, "rankDenominators": denominators, "finalGate": [2870, 4096]},
        # Effect bonus plus the successful consumption callback's five points.
        "meats": [{"itemId": item, "appeal": value} for item, value in ((25, 15), (26, 35), (27, 105), (28, 405))],
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
