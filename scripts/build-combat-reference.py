"""Build numeric PSX damage inputs; names remain in the translated guide tables."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("recruitment", ROOT / "scripts/build-recruitment-reference.py")
recruitment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(recruitment)
world, require = recruitment.world, recruitment.require
BASE = 0x80114CB8
WILD_BASE = 0x8018C0B8
SKILL_IDS = list(range(1, 19)) + list(range(62, 78)) + [102, 103]
LEVEL_FORMULAS = {
    72: {"playerMultiplier": 3, "playerConstant": 10, "enemyNumerator": 3, "enemyDenominator": 2, "widthNumerator": 3, "widthDenominator": 20},
    73: {"playerMultiplier": 2, "playerConstant": 30, "enemyNumerator": 3, "enemyDenominator": 2, "widthNumerator": 1, "widthDenominator": 10},
    74: {"playerMultiplier": 2, "playerConstant": 20, "enemyNumerator": 3, "enemyDenominator": 2, "widthNumerator": 1, "widthDenominator": 10},
}


def build(image, original_image):
    require(world.digest(image) == world.V73_HASH, "Expected verified v1.0.73 Current disc")
    require(world.digest(original_image) == world.native.RETAIL_SHA256, "Expected retail Japanese disc")
    current, original = world.Disc(image), world.Disc(original_image)
    raw = current.resource(5502)
    original_combat = original.resource(5502)
    spans = []
    for start,end,purpose in [(0x8011EBF8,0x80127FFC,"normal attack, supported skill handlers and damage helpers"),
                              (0x80174824,0x80175A88,"action descriptors, damage scales and handler table")]:
        data = raw[start-BASE:end-BASE]
        require(data == original_combat[start-BASE:end-BASE], "Combat instructions differ: "+purpose)
        spans.append({"resource":5502,"start":hex(start),"end":hex(end),"purpose":purpose,"sha256":world.digest(data)})
    wild, saved = current.resource(5499), current.resource(3657)
    require(wild == original.resource(5499), "Wild initialization differs between discs")
    require(saved == original.resource(3657), "Species attributes differ between discs")
    scales = {
        "spell": {"wild": list(raw[0x801756B8-BASE:0x801756BC-BASE]), "saved": list(raw[0x801756D8-BASE:0x801756E0-BASE])},
        "breath": {"wild": list(raw[0x801756C0-BASE:0x801756C4-BASE]), "saved": list(raw[0x801756E0-BASE:0x801756E8-BASE])},
    }
    require(scales == {"spell": {"wild": [100,75,30,0], "saved": [100,85,75,65,50,30,15,0]},
                       "breath": {"wild": [100,70,30,0], "saved": [100,80,70,60,40,30,10,0]}}, "Damage scales changed")
    skills = []
    for skill_id in SKILL_IDS:
        at = 0x80174824 - BASE + skill_id * 16
        row = raw[at:at+16]
        normal, enemy, width, enemy_width = struct.unpack_from("<HHBB", row, 8)
        require(1 <= row[1] <= 27, "Invalid damage resistance channel")
        skill = {"skillId": skill_id, "mpCost": row[0], "resistanceChannelId": row[1], "targetCode": row[3],
                 "scale": "breath" if skill_id in list(range(62,72))+[76,102] else "spell",
                 "playerRange": [normal,normal+width], "enemyRange": [enemy,enemy+enemy_width]}
        if skill_id in LEVEL_FORMULAS:
            skill["levelFormula"] = LEVEL_FORMULAS[skill_id]
        if skill_id in (102,103):
            skill["familyBonus"] = {"subject": "target" if skill_id == 102 else "user", "familyId": 7 if skill_id == 102 else 1,
                                    "numerator": 13, "denominator": 10, "stage": "beforeResistance" if skill_id == 102 else "afterResistance"}
        skills.append(skill)
    guide_species = recruitment.read_js_json(ROOT / "data/monster-reference.js")["species"]
    valid = [row for row in guide_species if row["family_id"] is not None and row["member"] is not None]
    ids = {(row["family_id"],row["member"]): row["index"] for row in valid}
    pointers = struct.unpack_from("<11I", wild, 0x8018FF00-WILD_BASE)
    species = []
    for row in valid:
        index, family, member = row["index"], row["family_id"], row["member"]
        saved_codes = list(saved[index*32+4:index*32+31])
        at = pointers[family]-WILD_BASE+member*30
        wild_codes = list(wild[at+3:at+30])
        require(len(saved_codes) == len(wild_codes) == 27 and max(saved_codes) <= 7 and max(wild_codes) <= 3, "Invalid resistance record")
        species.append({"speciesId": index, "familyId": family, "savedResistances": saved_codes, "wildResistances": wild_codes})
    handbook = recruitment.read_js_json(ROOT / "data/handbook-reference.js")
    contexts = sorted({(row["game"],row["context_id"]) for mon in handbook["species"] for row in mon["locations"] if row["kind"] == "wild"})
    encounters, record_bytes = [], bytearray()
    for game, context in contexts:
        if game == "terry" and context in recruitment.UNUSED_TERRY_CONTEXTS:
            continue
        campaign = recruitment.CAMPAIGNS.index(game)
        resource = recruitment.context_resource(current,campaign,context)
        require(resource == recruitment.context_resource(original,campaign,context), "Encounter mapping differs")
        rows = recruitment.enemy_rows(current,resource)
        require(rows == recruitment.enemy_rows(original,resource), "Encounter data differs")
        enemies = []
        for index,row in enumerate(rows):
            require((row[0],row[1]) in ids and 1 <= row[42] <= 99, "Unknown wild enemy")
            stats = dict(zip(("hp","mp","attack","defense","agility","intelligence"),struct.unpack_from("<6H",row,16)))
            enemies.append({"index": index, "speciesId": ids[(row[0],row[1])], "level": row[42], "stats": stats, "actionIds": list(row[10:16])})
            record_bytes.extend(row)
        encounters.append({"game": game, "contextId": context, "resource": resource, "enemies": enemies})
    return {"schemaVersion": 1, "scales": scales, "skills": skills, "species": species, "encounters": encounters,
            "provenance": {"currentDiscSha256": world.V73_HASH, "originalDiscSha256": world.native.RETAIL_SHA256,
                "manualRevision": recruitment.MANUAL_REVISION, "combatResourceSha256": world.digest(raw),
                "originalCombatResourceSha256":world.digest(original_combat),"matchingCodeSpans":spans,
                "wildInitializationSha256": world.digest(wild), "speciesAttributesSha256": world.digest(saved),
                "enemyRecordsSha256": hashlib.sha256(record_bytes).hexdigest(),
                "excludedTerryContexts": sorted(recruitment.UNUSED_TERRY_CONTEXTS),
                "scope": "Normal physical attacks and 36 verified damage actions, successful unguarded hits without critical hits, evasion, charge, reflection, temporary modifiers or special battle rules. Wild stat rolls apply only to ordinary encounters. Saved resistance values are unbred species baselines."}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bin",type=Path,required=True)
    parser.add_argument("--original-bin",type=Path,required=True)
    parser.add_argument("--check",action="store_true")
    args = parser.parse_args()
    result = build(args.bin.read_bytes(),args.original_bin.read_bytes())
    text = "// Generated native PSX combat data; see docs/combat-evidence.md.\nglobalThis.COMBAT_REFERENCE = " + json.dumps(result,ensure_ascii=True,separators=(",",":")) + ";\n"
    path = ROOT / "data/combat-reference.js"
    if args.check:
        require(path.read_text(encoding="utf8") == text,"Combat reference is stale")
    else:
        path.write_text(text,encoding="utf8")
    print(json.dumps({"skills":len(result["skills"]),"species":len(result["species"]),"contexts":len(result["encounters"]),"check":args.check}))


if __name__ == "__main__":
    main()
