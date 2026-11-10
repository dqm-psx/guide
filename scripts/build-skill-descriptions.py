"""Recreate or check the learnable skill directory against the v1.0.73 PSX disc.

Supply --bin (Current patched disc) and --comparison (comparison-data.json at
the handbook's verified public revision). Use --check to compare the packaged
baseline without writing. The scheduled sync refreshes the wording separately.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("world", ROOT / "scripts/verify-world-guide.py")
world = importlib.util.module_from_spec(spec)
spec.loader.exec_module(world)
require = world.require

FIRST_ID, LAST_ID = 1, 169
NAME_SYSTEM_BASE = 473
NAME_DESCRIPTOR = 0x966F4
DESCRIPTION_TABLE = 0x8D284
FIELD_MP_COST = 0x9E320
OVERLAY_BASE = 0x80114CB8
COMBAT_TABLE = 0x80174824 - OVERLAY_BASE  # Resource 5502; 16 bytes per action.
SUMMON_TABLE = 0x80174044 - OVERLAY_BASE  # Resource 5502; 32 bytes per summon.
PRIOR_SKILL = 0x80128FF4 - OVERLAY_BASE  # Resource 104.
COMBINATION_TABLE = 0x801290A0 - OVERLAY_BASE
TARGETS = {
    0: "Field action", 17: "One enemy", 18: "All enemies",
    20: "Enemy targets selected by the action", 33: "One ally", 34: "All allies",
    64: "User", 128: "Special targeting", 255: "Unrestricted targeting",
}
SKILL_TYPES = {"Damage", "Healing", "Status", "Support", "Utility"}


def guide_effect(binding, combat, at):
    # Player-side rolls in the action record have a base and an inclusive spread.
    # The effect text describes how the command uses its roll (damage or healing).
    template = binding["effect"]
    require(binding["type"] in SKILL_TYPES and template, "Missing skill type or effect")
    fields = {}
    if "{roll}" in template:
        base = struct.unpack_from("<H", combat, at + 8)[0]
        spread = combat[at + 12]
        require(0 < base < 65535, "Unexpected base for a numeric skill effect")
        fields["roll"] = f"{base}–{base + spread}" if spread else str(base)
    if 133 <= binding["id"] <= 136:
        offset = SUMMON_TABLE + (binding["id"] - 133) * 32
        fields["summon_level"] = combat[offset + 13]
        fields["summon_hp"] = struct.unpack_from("<H", combat, offset + 16)[0]
    return template.format(**fields)


def pointer(data, offset):
    return struct.unpack_from("<I", data, offset)[0]


def combinations(learning):
    # FE opens a recipe, FD marks its result and FF ends the table.
    recipes = {}
    pos = COMBINATION_TABLE
    while learning[pos] != 0xFF:
        require(learning[pos] == 0xFE, "Invalid recipe start")
        pos += 1
        required = []
        while learning[pos] != 0xFD:
            skill_id = learning[pos]
            require(FIRST_ID <= skill_id <= LAST_ID and skill_id not in required, "Invalid recipe ingredient")
            required.append(skill_id)
            pos += 1
        target = learning[pos + 1]
        require(required and FIRST_ID <= target <= LAST_ID and target not in recipes and target not in required,
                "Invalid recipe result")
        recipes[target] = required
        pos += 2
    require(len(recipes) == 34, "Combination skill count changed")
    return recipes


def build(image, comparison_bytes):
    proof = world.read_json(ROOT / "data/world-verification.json")
    require(world.digest(image) == proof["patched_bin_sha256"] == world.V73_HASH, "Unexpected Current disc")
    require(world.digest(comparison_bytes) == proof["comparison_sha256"], "Unexpected public comparison snapshot")
    rows = {}
    for row in json.loads(comparison_bytes)["rows"]:
        if row["catalog"] in ("menus/general.json", "text/system.json"):
            key = (row["catalog"], row["id"])
            require(key not in rows and row["raw"]["id"] == row["id"], "Invalid public row identity")
            rows[key] = row

    bindings = world.read_json(ROOT / "scripts/skill-name-bindings.json")
    require([r["id"] for r in bindings] == list(range(FIRST_ID, LAST_ID + 1)), "Incomplete native skill IDs")
    disc = world.Disc(image)
    runtime = disc.resident_memory()
    combat = disc.resource(5502)
    learning = disc.resource(104)
    recipes = combinations(learning)
    exe_base = world.PSX_EXE_BIAS & world.PHYSICAL
    result = {}
    for binding in bindings:
        skill_id = binding["id"]
        name_id = binding["source_id"]
        source = rows[("text/system.json", name_id)]
        slot = NAME_SYSTEM_BASE + skill_id
        require(slot in source["indices"] and "Skills and spells" in source["labels"], "Wrong skill name slot")
        current = source["raw"]["translations"]["current"]
        expected_name = current.get("english_short", current["english"]).removesuffix("<END>")
        native_name = world.table_message(runtime, exe_base + NAME_DESCRIPTOR + 8, slot, 0)
        require(expected_name == native_name, "Native skill label differs: " + name_id)

        # The untranslated executable pointers identify the public menu records.
        # The installed resident fixups point these same slots to Current prose.
        offset = DESCRIPTION_TABLE + 4 * skill_id
        original = pointer(disc.exe, offset) - world.PSX_EXE_BIAS
        description_id = f"m_exe_{original:06x}"
        require(description_id == binding["description_source_id"], "Wrong skill description slot")
        menu = rows[("menus/general.json", description_id)]
        lines = menu["raw"]["translations"]["current"]["english_lines"]
        prose = world.sentence(" ".join(lines))
        native_text = world.menu_lines(runtime, pointer(runtime, exe_base + offset) & world.PHYSICAL)
        require(prose and prose == native_text == world.sentence(menu["current"]), "Description differs: " + description_id)

        at = COMBAT_TABLE + skill_id * 16
        battle_cost = combat[at]
        menu_cost = disc.exe[FIELD_MP_COST + skill_id]
        # These two tables encode "all remaining MP" with different sentinel values.
        require((battle_cost, menu_cost) == (255, 128) or (battle_cost == menu_cost < 128),
                "Combat and menu MP costs differ")
        target = combat[at + 3]
        require(target in TARGETS, "Unknown targeting code")
        entry = {"description": native_text, "description_source_id": description_id,
                 "type": binding["type"], "effect": guide_effect(binding, combat, at),
                 "mpCost": "All remaining MP" if menu_cost == 128 else menu_cost, "target": TARGETS[target]}
        prior = learning[PRIOR_SKILL + skill_id]
        if prior not in (254, 255):
            require(FIRST_ID <= prior <= LAST_ID and prior != skill_id, "Unexpected upgrade predecessor")
            entry["upgradesFrom"] = prior
        if skill_id in recipes:
            entry["combination"] = recipes[skill_id]
        result[skill_id] = entry
    require(len({row["description_source_id"] for row in result.values()}) == len(bindings),
            "Duplicate description identity")
    return result


def render(skills):
    values = ",\n".join(f"  {skill_id}: {json.dumps(row, ensure_ascii=False)}" for skill_id, row in skills.items())
    return ("/* Generated by scripts/build-skill-descriptions.py from Current v1.0.73.\n"
            "   Types and effects are guide notes. Skill keys and prerequisites use native learning IDs. */\n"
            "globalThis.SKILL_DESCRIPTIONS = {\n" + values + "\n};\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bin", required=True, type=Path)
    parser.add_argument("--comparison", required=True, type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    skills = build(args.bin.read_bytes(), args.comparison.read_bytes())
    output = ROOT / "data/skill-descriptions.js"
    source = render(skills)
    if args.check:
        require(output.read_text(encoding="utf-8") == source, "Skill descriptions differ from native output")
    else:
        output.write_bytes(source.encode("utf-8"))
    print(f"Built {len(skills)} skill entries against the verified v1.0.73 disc.")
