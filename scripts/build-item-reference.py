"""Build the item directory from the Current PSX image and matching public text.

Use --check to verify the checked-in edition without rewriting it. Fixed-town
stock comes from the existing guide's map bindings, checked against the disc.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import re
import struct

from item_acquisitions import reward_sources

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("world", ROOT / "scripts/verify-world-guide.py")
world = importlib.util.module_from_spec(spec)
spec.loader.exec_module(world)
require = world.require
EXE_BASE = world.PSX_EXE_BIAS
EXE_RAM = EXE_BASE & world.PHYSICAL
ITEM_RECORDS = 0x9D820
MENUS = 0x8BFB0
ALTERNATE_MENU = {31: 99, 40: 98, 41: 97}
TOWNS = {122: "Hitano", 134: "GreatLog / Main Street", 135: "Nofo",
         136: "Northden Town", 138: "Pei Town", 142: "Port Ritz Town",
         149: "Wiston", 154: "Eastoria", 2162: "Assia", 5671: "GreatTree / Bazaar"}


def u32(data, offset):
    return struct.unpack_from("<I", data, offset)[0]


def menu(disc, runtime, rows, slot):
    offset = MENUS + slot * 4
    source_id = f"m_exe_{u32(disc.exe, offset) - EXE_BASE:06x}"
    native = world.menu_lines(runtime, u32(runtime, EXE_RAM + offset) & world.PHYSICAL)
    row = rows[source_id]
    lines = row["raw"]["translations"]["current"]["english_lines"]
    require(native == world.sentence(" ".join(lines)) == world.sentence(row["current"]),
            f"Item tooltip differs from the public patch at {source_id}")
    return source_id, native


def shops(disc):
    # Scene bytecode pushes the descriptor address immediately before opening
    # the shop. Multiple story stages can select different stocks in one town.
    inventory = {}
    for scene in TOWNS:
        data = disc.resource(scene)
        call = bytes.fromhex("3357570b80")
        position = data.find(call)
        require(position >= 0, f"Missing shop in scene {scene}")
        while position >= 0:
            require(data[position - 5] == 0x0C, "Missing shop argument")
            offset = u32(data, position - 4) - 0x800EB010
            require(0 <= offset < len(data) - 4, "Invalid shop address")
            mode, sell, buy, marker = data[offset:offset + 4]
            require(mode in (0, 1) and marker == 255 and buy == 100, "Unexpected fixed shop header")
            expected = 75 if scene in (5671, 134) else 80
            require(sell == expected, "Fixed-town resale rate changed")
            end = data.index(255, offset + 4)
            stock = set(data[offset + 4:end])
            require(stock and all(1 <= n <= 96 for n in stock), "Invalid fixed shop stock")
            inventory[(scene, offset)] = stock
            position = data.find(call, position + len(call))
    require(len(inventory) == 18, "Fixed stock count changed")
    # The item-shop floor M1_0109 in Terry's gates uses scene 117. Its
    # bytecode opens an EXE inventory, rather than a scene-relative one.
    floor = disc.resource(117)
    offset = 0x800AF9ED - EXE_BASE
    require(floor[29:39] == bytes.fromhex("0c ed f9 0a 80 33 57 57 0b 80"), "Gate shop call changed")
    require(disc.exe[offset:offset + 4] == bytes([0, 80, 100, 255]), "Gate shop rates changed")
    inventory[(117, offset)] = set(disc.exe[offset + 4:disc.exe.index(255, offset + 4)])
    return inventory


def verify_shops(row, item_id, base, stocks, discount):
    observed = {(scene, offset) for (scene, offset), stock in stocks.items() if item_id in stock}
    receipts = {f"PSX shop {scene}/{offset}" for scene, offset in observed}
    require(receipts == {s for s in row["source_ids"] if s.startswith("PSX shop ")},
            f"Shop references differ for {row['id']}")
    actual = {("dqm1" if scene in (117, 5671) else "dqm2",
               "Travelers’ Gate item-shop floor" if scene == 117 else TOWNS[scene]) for scene, _ in observed}
    listed = {(p["game"], town) for p in row.get("prices", []) for town in p["locations"]}
    require(actual == listed, f"Shop locations differ for {row['id']}")
    for price in row.get("prices", []):
        require((price["buy"], price["gold_pass"]) == (base, base * discount // 100),
                f"Purchase price differs for {row['id']}")


def guide_effect(n, lo, hi):
    if n in (1, 2, 4):
        stat = "MP" if n == 4 else "HP"
        return f"One dose restores {lo}–{hi} {stat} to one monster."
    if 13 <= n <= 18:
        stat = ["Attack", "Defense", "Agility", "Wisdom", "maximum HP", "maximum MP"][n - 13]
        require(lo == hi and lo > 0, "Seed bonus changed")
        return f"Permanently raises one monster’s {stat} by {lo}."
    if 19 <= n <= 24:
        trait = ["bravery", "kindness", "thoughtfulness"][(n - 19) // 2]
        require(lo == hi and abs(lo) == 50, "Book personality effect changed")
        action = "Raises" if lo > 0 else "Lowers"
        return f"{action} one monster’s {trait} by {abs(lo)}. Its displayed personality can take several books to change."
    if 25 <= n <= 28:
        rank = ["Weakest", "Second-weakest", "Second-strongest", "Strongest"][n - 25]
        return f"{rank} of the four ordinary recruitment meats. Feed the monster in battle and defeat it last."
    if 36 <= n <= 39:
        attack = ["wind", "lightning", "ice breath", "fire breath"][n - 36]
        return f"Deals {lo}–{hi} base {attack} damage before resistance. The staff can break after use."
    if 57 <= n <= 59:
        return "Bring all three Zenithian treasures to Hitano Castle to earn an audience with the Demon Lord."
    if 64 <= n <= 75 or n == 83:
        stat = "Defense" if n == 83 else ["maximum HP", "maximum MP", "Attack", "Defense", "Agility", "Wisdom"][(n - 64) // 2]
        require(lo == hi and lo > 0, "Accessory bonus changed")
        return f"Adds {lo} to the wearer’s {stat} while equipped."
    if 76 <= n <= 82:
        hazards = ["offensive spells", "fire and ice breath", "sleep, poison and confusion",
                   "sleep, curse, Surround and paralysis", "Beat, Sacrifice, curse and paralysis",
                   "water attacks", "effects that seal attacks"][n - 76]
        return f"Improves the wearer’s resistance to {hazards}."
    if n in (84, 85):
        stat = "HP" if n == 84 else "MP"
        return f"Walking restores {stat} to the monster wearing the ring."
    if 86 <= n <= 92:
        stat = ["maximum HP", "maximum MP", "Attack", "Defense", "Agility", "Wisdom", "maximum HP and MP"][n - 86]
        return f"Equip before leveling up to improve the monster’s {stat} growth."
    return {
        3: "One dose restores all missing HP to each living party member.",
        5: "One dose restores all missing MP to one monster.",
        6: "Removes poison from one monster.",
        7: "Allows one paralyzed monster to act again.",
        8: "Removes a curse from one monster.",
        9: "Wakes one sleeping monster so it can act again.",
        10: "Restores control of one confused monster.",
        11: "Heals every living party member in battle. The stone can be reused until it breaks.",
        12: "Brings one fallen monster back to life.",
        29: "Field use lowers a living ally’s wildness. The field-use routine leaves its poison status unchanged.",
        30: "Wins over an eligible monster in battle.",
        31: "Points toward the hole on Terry’s gate floors. In battle it checks whether you have caught the target before. Reusable.",
        32: "Temporarily suppresses wild encounters while traveling.",
        33: "Play it in the field to attract monsters for a battle. Reusable.",
        34: "Seals enemy spells in battle. The staff can break after use.",
        35: "Boosts one ally’s physical attack in battle. The staff can break after use.",
        40: "Takes Terry to the gateway on his current floor or Cobi and Tara to the magic door shrine. Consumed on use.",
        41: "Takes Terry home to GreatTree or Cobi and Tara home to GreatLog. Consumed on use.",
        42: "Returns the party to the entrance of the area. Consumed on use.",
        43: "Saves progress away from a usual save point. Each bookmark can be used once.",
        44: "Hand medals to GreatTree’s Medal Man or the collector in GreatLog for prizes.",
        45: "Carry the pass to buy goods for 90% of base price. Shops round down per item.",
        46: "Moves the magic door shrine to the chosen spot. A Return Staff can then take you there.",
        47: "Reveals the current gate floor’s map. A Mommonja Tail can point you to its gateway.",
        48: "Use it where Mirage Lake vanished so you can follow the king to the hideout.",
        49: "Set it in the East Lighthouse pedestal to open the sea route to the volcanic island.",
        50: "Show it to enter Northden Castle. Later, return it to the Spirit’s Spring for the Sky Shield.",
        51: "Bring the soul to Westernia Castle and defeat the puppet to restore Princess Yuna.",
        52: "Give it to Eastoria’s botanist to make nectar that restores the townspeople’s voices.",
        53: "Use it to disguise yourself as a monster at the rope bridge south of Funt.",
        54: "Give it to Warubou, then press Triangle beside water to cross on a shell.",
        55: "Take it to Warubou, then face a breakable rock and press Triangle to clear it.",
        56: "Take it to Warubou to learn to cross gaps by flying with Triangle.",
        60: "When examined, the stone gives off a faint blue light. Its quest use is unconfirmed.",
        61: "When examined, the ring dances on your palm. Its quest use is unconfirmed.",
        96: "Reverses one hatched monster’s sex. The mark is consumed.",
    }[n]


def quest(text, slug, game="dqm2"):
    return {"game": game, "text": text, "entry": "quest-" + slug}


STORY_SOURCES = {
    1: [{"game": "dqm1", "text": "GreatTree Castle gift. Leave room in your bag."},
        {"game": "dqm2", "text": "Mom gives you one at the Monster Farm."}],
    30: [{"game": "dqm2", "text": "Tara can trade 2 Tiny Medals for one at GreatLog’s medal exchange."}],
    48: [quest("Feed the hungry prisoner in Assia Dungeon.", "mirage-lake-and-the-sea-bell")],
    49: [quest("Open the chest on the Ghost Ship after defeating the pirates.", "recover-the-moonstone")],
    50: [quest("Examine the shield at the Spirit’s Spring near Northden and agree to help.", "free-the-king-of-northden")],
    51: [quest("Follow the vines from Yuna’s window to the Southern Forest.", "restore-yuna-s-soul-and-peace")],
    52: [quest("Pick the blue herb at the summit of Northern Mountain.", "eastoria-s-lost-voices")],
    53: [quest("Search the hollow behind Ugor’s grave in Funt Village.", "ugors-transform-staff")],
    54: [quest("Defeat the bandit leader’s servant in the Mirage Lake hideout to receive the king’s reward.", "mirage-lake-and-the-sea-bell")],
    55: [quest("Recover it after Kameha’s confrontation in Volcanic Island Cave.", "the-mirror-of-destruction")],
    56: [quest("Return the Spirit Mark to the Spirit’s Spring after restoring peace.", "sky-shield-and-flight")],
    57: [quest("Defeat the guardian and open the chest in Small Cave south of Hitano.", "gather-the-three-zenithian-treasures")],
    58: [quest("Fly through Wind Tower west of Hitano Castle to reach the chest.", "gather-the-three-zenithian-treasures")],
    59: [quest("Defeat the king of the dead and open the chest in the Castle of the Dead.", "gather-the-three-zenithian-treasures")],
    89: [quest("Speak to the mermaid queen after retrieving the Moonstone.", "mermaid-sailor-ring")],
}


def queen_rewards(disc, queen, system):
    # The queen's script visits these events in reverse storage order. Each
    # tests the species (member, family) and writes the reward's ID before
    # branching to the shared bag capacity check and item-grant routine.
    data = disc.resource(5661)
    awards = list(re.finditer(rb"\x70\x0a(.)\x70\x0b(.)\x08..\x74\x00\x00.\x00\x70\x01(.)"
                              rb"\x7f\x60\x78\x0c\x80\x80", data[0x2AC0:0x2F70], re.DOTALL))
    require(len(awards) == len(queen["requested_species"]) == 16, "Queen's reward count changed")
    species = {s["index"]: s for s in world.read_json(ROOT / "data/monster-baseline.json")["species"]}
    result = {}
    for step, (match, index) in enumerate(zip(reversed(awards), queen["requested_species"]), start=1):
        member, family, item = [v[0] for v in match.groups()]
        monster = species[index]
        require((member, family) == (monster["member"], monster["family_id"]), "Queen's species order differs")
        title = system[monster["system_entry_id"]]["raw"]["translations"]["current"]["english"].removesuffix("<END>")
        text = f"Show {title} to the Queen of GreatTree for request {step} of 16."
        result.setdefault(item, []).append(quest(text, "the-queen-s-monster-collection-requests", "dqm1"))
    return result


def build(image, comparison):
    proof = world.read_json(ROOT / "data/world-verification.json")
    require(world.digest(image) == proof["patched_bin_sha256"] == world.V73_HASH, "Unexpected Current disc")
    require(world.digest(comparison) == proof["comparison_sha256"], "Unexpected public comparison snapshot")
    rows = json.loads(comparison)["rows"]
    menus = {r["id"]: r for r in rows if r["catalog"] == "menus/general.json"}
    system = {r["id"]: r for r in rows if r["catalog"] == "text/system.json"}
    themes = {slot: r["raw"]["translations"]["current"] for r in rows if r["catalog"] == "text/system.json"
              and "Generated key themes" in r["labels"] for slot in r["indices"]}
    field = (ROOT / "data/field-guide.js").read_text(encoding="utf-8")
    entries = json.loads(field.split(" = ", 1)[1].strip().removesuffix(";"))["entries"]
    articles = {r["id"]: r for r in [*entries, *world.handbook()[1]]}
    disc = world.Disc(image)
    runtime = disc.resident_memory()
    inventory = shops(disc)
    def key_theme(slot):
        record = themes[slot]
        full = record["english"].removesuffix("<END>")
        short = record.get("english_short", record["english"]).removesuffix("<END>")
        require(short == world.table_message(runtime, EXE_RAM + 0x966F4 + 8, slot, 0),
                f"Magic Key theme differs from the native display in slot {slot}")
        return full if full == short else f"{full} ({short})"

    reward = reward_sources(disc, key_theme, world)
    queen = queen_rewards(disc, articles["quest-the-queen-s-monster-collection-requests"], system)
    # Native shop rate loader, sale eligibility test and campaign description selector.
    for address, size, expected in [
        (0x8004BD58, 52, "9d9a888aac4e0c026a4a9114362d07863e04f4834a00f00379e31b74830371ef"),
        (0x8004BDF8, 84, "29175403c7148f496f3e30ba2a1e578b95c7f05bc34bbc710301ea4188055c70"),
        (0x8002DF9C, 136, "cd998d001a4f04c3d20e311d13e987e09d1e733ede2dcb2fee6bf511f85b190c"),
    ]:
        at = address - EXE_BASE
        require(world.digest(disc.exe[at:at + size]) == expected, "Item consumer has changed")
    prefix = bytes.fromhex("70002d08df0205080078e9770c80")
    require(disc.exe[0xA5F86:0xA5F86 + len(prefix)] == prefix, "Gold Pass possession check changed")
    discount = disc.exe[0xA5F86 + len(prefix)]
    require(discount == 90, "Gold Pass discount changed")
    result = {}
    for row in entries:
        if row["kind"] not in ("item", "tool"):
            continue
        n = int(row["id"].removeprefix("item-"))
        at = ITEM_RECORDS + n * 24
        attributes, _, lo, hi = struct.unpack_from("<HHhh", disc.exe, at)
        base = u32(disc.exe, at + 20)
        source_id, description = menu(disc, runtime, menus, n)
        require(row["source_ids"][1] == source_id, f"Invalid native description binding for {n}")
        verify_shops(row, n, base, inventory, discount)
        sources = [*STORY_SOURCES.get(n, []), *queen.get(n, []), *reward.get(n, [])]
        # Gate-floor finds recorded in Renge's PS1 Terry playthrough, listed
        # separately from the special Treasure/Mimic layouts restored by the patch.
        if n in {3, 4, 5, 12, *range(13, 19), *range(25, 29), 34, *range(36, 40), 44}:
            sources.append({"game": "dqm1", "text": "Pick it up on the ordinary floors of Travelers’ Gates."})
        require(all(s["entry"] in articles for s in sources if "entry" in s), f"Broken source link for {n}")
        item = {"description": description, "effect": guide_effect(n, lo, hi),
                "sell": None if attributes & 0x0200 else {"capital": base * 75 // 100, "field": base * 80 // 100},
                "sources": sources}
        if n in ALTERNATE_MENU:
            alternate_id, alternate = menu(disc, runtime, menus, ALTERNATE_MENU[n])
            require(alternate_id in row["source_ids"], f"Missing alternate menu binding for {n}")
            item["descriptions"] = {"dqm1": description, "dqm2": alternate}
        result[row["id"]] = item
    require(len(result) == 91, "Item record count changed")
    return result


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bin", required=True, type=Path)
    parser.add_argument("--comparison", required=True, type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    items = build(args.bin.read_bytes(), args.comparison.read_bytes())
    output = ROOT / "data/item-reference.js"
    encoded = ",\n".join(f"  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)}" for k, v in items.items())
    source = ("/* Generated by scripts/build-item-reference.py against Current v1.0.73. */\n"
              "globalThis.DQMItemReference = {items: {\n" + encoded + "\n}};\n")
    if args.check:
        require(output.read_text(encoding="utf-8") == source, "Item directory differs from native output")
    else:
        output.write_bytes(source.encode("utf-8"))
    print(f"Verified {len(items)} item records, 94 menu descriptions, 18 town stocks and Terry’s gate shop.")
