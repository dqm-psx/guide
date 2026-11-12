"""Extract skill routes, thresholds and training curves from matching PSX discs."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("recruitment_builder", ROOT / "scripts/build-recruitment-reference.py")
shared = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shared)
world, require = shared.world, shared.require
BASE = 0x80114CB8
STATS = ["hp", "mp", "attack", "defense", "agility", "intelligence"]


def build(image, original_image):
    require(world.digest(image) == world.V73_HASH, "Expected verified Current v1.0.73")
    require(world.digest(original_image) == world.native.RETAIL_SHA256, "Expected verified Japanese retail")
    disc, original = world.Disc(image), world.Disc(original_image)
    raw, old = disc.resource(104), original.resource(104)
    guards = []
    for resource, start, end, purpose in [
        (104, 0x801222DC, 0x80122838, "candidate scan and threshold checks"),
        (104, 0x8011E950, 0x8011EF1C, "farm experience and growth"),
        (104, 0x8011FB38, 0x80120688, "party growth and learning"),
        (104, 0x80120B6C, 0x80120B9C, "ordinary recruitment level limit"),
        (None, 0x80049094, 0x8004A328, "offspring construction"),
        (None, 0x8009A040, 0x8009A040 + 170, "inherited base-skill IDs"),
        (104, 0x80124518, 0x80129200, "growth, experience and learning tables"),
    ]:
        base = BASE if resource else world.PSX_EXE_BIAS
        a = (disc.resource(resource) if resource else disc.exe)[start-base:end-base]
        b = (original.resource(resource) if resource else original.exe)[start-base:end-base]
        require(a == b and len(a) == end-start, "Native skill-learning data changed: " + purpose)
        guards.append({"resource": resource, "start": hex(start), "end": hex(end),
                       "sha256": hashlib.sha256(a).hexdigest(), "purpose": purpose})
    for resource in (3655, 3656, 3657):
        require(disc.resource(resource) == original.resource(resource), "Native species data changed")
    fields = ["level", *STATS]
    def requirements(pointer):
        start, values = pointer - BASE, {}
        pos = start
        while True:
            word = struct.unpack_from("<H", raw, pos)[0]
            pos += 2
            if word >> 12 >= 7:
                break
            require(word >> 12 < len(fields), "Unknown requirement opcode")
            if word & 4095:
                values[fields[word >> 12]] = word & 4095
        return values
    evolution = raw[0x80128FF4-BASE:0x80128FF4-BASE+171]
    base_ids = disc.exe[0x8009A040-world.PSX_EXE_BIAS:0x8009A040-world.PSX_EXE_BIAS+170]
    require(base_ids[0] == 0, "Empty inherited skill mapping changed")
    skills = []
    for skill_id in range(1, 170):
        prior = evolution[skill_id]
        pointer = struct.unpack_from("<I", raw, 0x80128AA4-BASE+skill_id*4)[0]
        require(base_ids[skill_id] in range(1, 170), "Unknown inherited base skill")
        skills.append({"skillId": skill_id, "requirements": requirements(pointer),
                       "upgradesFrom": prior if prior not in (254, 255) else None,
                       "baseSkillId": base_ids[skill_id], "combinations": []})
    combo_pointers = struct.unpack_from("<34I", raw, 0x80128F6C-BASE)
    pos, count, prior_target = 0x801290A0-BASE, 0, 0
    while raw[pos] != 255:
        require(raw[pos] == 254, "Unknown combination marker")
        pos += 1
        required = []
        while raw[pos] != 253:
            required.append(raw[pos])
            pos += 1
        pos += 1
        target = raw[pos]
        pos += 1
        require(1 <= target <= 169 and all(1 <= v <= 169 for v in required), "Unknown combination skill")
        require(target > prior_target, "Native combination order changed")
        prior_target = target
        skills[target-1]["combinations"].append({"requiredSkillIds": required,
                                               "requirements": requirements(combo_pointers[count])})
        count += 1
    require(count == 34, "Combination inventory changed")
    gains = [list(raw[0x801277C4-BASE+lv*32:0x801277C4-BASE+(lv+1)*32]) for lv in range(100)]
    experience = [list(struct.unpack_from("<32I", raw, 0x80124544-BASE+lv*128)) for lv in range(100)]
    native = shared.read_js_json(ROOT / "data/monster-reference.js")["species"]
    playable = {row["index"] for row in shared.read_js_json(ROOT / "data/breeding-data.js")["species"] if row["playable"]}
    attrs, first, second = [disc.resource(rid) for rid in (3657, 3655, 3656)]
    species = []
    for mon in native:
        if mon["stats"]["status"] != "verified" or mon["family_id"] is None or mon["index"] not in playable:
            continue
        index = mon["index"]
        pointer = struct.unpack_from("<I", raw, 0x80124518-BASE+mon["family_id"]*4)[0]
        offset = pointer-BASE + mon["member"]*12
        row = raw[offset:offset+12]
        require(row == old[offset:offset+12], "Species progression differs")
        if row[1] == 0:
            continue
        # Existing species growth profiles expose the recruitment-center cap;
        # breeding reads a separate attribute table (Balzack differs: 50/45).
        require(row[1] == mon["stats"]["base_level_limit"], "Guide recruitment cap differs")
        sets = {"terry": list(first[index*3:index*3+3]), "cobi": list(second[index*3:index*3+3]),
                "tara": list(second[index*3:index*3+3])}
        sets = {key: [v for v in values if v not in (0, 255)] for key, values in sets.items()}
        require(all(v in range(1,170) for values in sets.values() for v in values), "Unknown natural skill")
        # Preserve native table order and campaign distinctions, including the
        # extra species whose old library metadata reused DQM2's natural set.
        for stat, selector in zip(STATS, row[6:12]):
            require([gains[lv][selector] for lv in range(1,100)] == mon["stats"]["growth"][stat], "Guide growth differs")
        species.append({"speciesIndex": index, "naturalSkills": sets,
                        "growthCurveIndices": dict(zip(STATS, row[6:12])),
                        "experienceCurveIndex": row[2], "baseLevelCap": attrs[index*32+1],
                        "recruitLevelCapCenter": row[1]})
    return {"schemaVersion": 1, "statKeys": STATS, "skills": skills, "species": species,
            "growthByLevel": gains, "experienceByLevel": experience,
            "provenance": {"version": "v1.0.73", "currentDiscSha256": world.V73_HASH,
                           "originalDiscSha256": world.native.RETAIL_SHA256, "codeSpans": guards,
                           "skillCount": len(skills), "combinationCount": count, "speciesCount": len(species),
                           "scope": "Base-stat growth and skill readiness. Does not choose replacements, predict player acceptance or simulate every learning prompt."}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bin", type=Path, required=True)
    parser.add_argument("--original-bin", type=Path, required=True)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    result = build(args.bin.read_bytes(), args.original_bin.read_bytes())
    output = ROOT / "data/skill-learning-reference.js"
    content = "// Native PSX training data; see docs/skill-learning-evidence.md.\n"
    content += "globalThis.SKILL_LEARNING_REFERENCE = " + json.dumps(result,separators=(",",":")) + ";\n"
    if args.check:
        require(output.read_text("utf8") == content, "Skill learning reference is stale")
    else:
        output.write_text(content,"utf8")
    print(json.dumps({"skills":len(result["skills"]),"species":len(result["species"]),"combinations":34,"check":args.check}))


if __name__ == "__main__":
    main()
