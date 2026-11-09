"""Join handbook routes to native PSX field maps, wild encounters and supplies.

Generate from the locally authenticated Current v1.0.73 BIN. Only stable guide
IDs, reviewed navigation facts and counts are published. --check compares the
result to the checked-in data.
"""
import argparse
from collections import defaultdict
import importlib.util
import json
from pathlib import Path
import re
import struct

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("world", ROOT / "scripts/verify-world-guide.py")
world = importlib.util.module_from_spec(spec)
spec.loader.exec_module(world)
require = world.require

GATES = {
    "departure": (1, 1), "townsperson-s": (2, 3), "guardian": (4, 5), "memory": (6, 7),
    "confusion": (8, 9), "peace": (13, 15), "courage": (16, 18), "strength": (23, 26),
    "anger": (27, 30), "joy": (35, 39), "wisdom": (40, 44), "happiness": (50, 54),
    "temptation": (55, 59), "lost": (65, 69), "judgment": (70, 74), "mirror": (80, 85),
    "ambition": (86, 89), "destruction": (90, 93), "manipulation": (94, 97),
    "domination": (98, 101), "extinction": (102, 105), "sleep": (106, 109),
}
# Scene ranges reflect the verified campaign field-map blocks. Names come from
# their guide articles or native map labels after each public translation refresh.
REGIONS = {
    "greattree": [6, 7, 8, 9, 10, 11], "greatlog": [12, 13, 14, 15, 16, 21],
    "desert": [17, 22, 23, 24, 102], "water": [18, 25, 26, 27, 28, 29, 30],
    "ice": [19, *range(31, 41)], "sky": [*range(41, 51)], "between": [51, 52],
    "gate-ends": [*range(71, 102)],
}
WORLDS = {"desert-world": (1, 9), "water-world": (10, 28), "ice-world": (29, 46),
          "sky-world": (47, 68), "world-between-worlds": (69, 70)}
CHAPTER_ROSTERS = {
    "desert-assia": (1, 9), "desert-mirage": (1, 7), "pirate-mermaids": (10, 22),
    "pirate-mirror": (23, 28), "ice-northden": (29, 40), "ice-westernia": (29, 42),
    "ice-eastoria": (43, 45), "sky-ugor": (47, 62), "sky-treasures": (63, 68),
    "between-worlds": (69, 70),
}
RANK_GATES = {"g": ["townsperson-s", "guardian"], "f": ["memory", "confusion"],
              "e": ["peace", "courage"], "d": ["strength", "anger"], "c": ["joy", "wisdom"],
              "b": ["happiness", "temptation"], "a": ["lost", "judgment"], "s": ["mirror"]}
CHAPTER_RANKS = {"terry-early-arena": ["g", "f", "e"], "terry-anger": ["d"],
                 "terry-upper-arena": ["c", "b", "a", "s"]}
OPTIONAL = {"quest-fire-at-the-bazaar": (10, 12), "quest-the-well-professor-s-experiment": (19, 22),
            "quest-open-the-library-s-inner-room": (75, 79), "quest-show-the-golden-slime": (118, 121),
            "quest-summon-entertainment-at-the-bazaar": (110, 113)}
# Only explicitly mentioned items and moves. The boss strategy's own wording
# distinguishes a boss attack, an en-route hazard and a recommended counter.
EXTRA = {
    "boss-dragon": ([1], [64]), "boss-golem": ([], [97]), "boss-great-sabrecat": ([], [98]),
    "boss-treeface": ([7, 8], []), "boss-big-eye": ([], [69, 17]),
    "boss-living-statue": ([7], [16]), "boss-battle-rex": ([], [107]), "boss-funky-bird": ([10], [120]),
    "boss-sky-dragon": ([], [66]), "boss-jamiras": ([], [19]), "boss-demon-servant": ([], [35]),
    "boss-akbar": ([], [138, 9]), "story-terry-early-arena": ([47, 40, 31], []),
    "story-desert-mirage": ([48, 54], []), "story-pirate-mermaids": ([49, 89], []),
    "story-pirate-mirror": ([49, 55], []), "story-ice-northden": ([50, 55], []),
    "story-ice-westernia": ([51], []), "story-ice-shield": ([50, 56], []),
    "story-ice-eastoria": ([52], []), "story-sky-treasures": ([59, 58, 57], []),
    "story-between-worlds": ([54, 55, 56], []),
}


def js_data(path, prefix):
    source = path.read_text(encoding="utf-8")
    return json.JSONDecoder().raw_decode(source.split(prefix, 1)[1].lstrip())[0]


def normalized(name):
    return " ".join(name.lower().replace("’", "'").split())


def all_wild(disc):
    baseline = world.read_json(ROOT / "data/monster-baseline.json")
    groups = struct.unpack_from("<24I", disc.exe, 0x8008E1AC - world.PSX_EXE_BIAS)
    contexts = {}
    checked_resources = set()
    count = 0
    for species in baseline["species"]:
        for loc in species["locations"]:
            if loc["kind"] != "wild":
                continue
            game, context = loc["game"], loc["context_id"]
            base = groups[{"terry": 17, "cobi": 18, "tara": 19}[game]] - world.PSX_EXE_BIAS
            rid = struct.unpack_from("<I", disc.exe, base + context * 4)[0]
            src = loc["source"]
            require(rid == src["archive_index"], "Native encounter resource changed")
            data = disc.resource(rid)
            if rid not in checked_resources:
                require(world.digest(data) == src["sha256"], "Wild encounter resource changed")
                checked_resources.add(rid)
            _, start, end, _ = struct.unpack_from("<4I", data)
            levels = set()
            for index in src["enemy_records"]:
                at = start + index * 52
                require(start <= at <= end - 52 and tuple(data[at:at+2]) == (species["family_id"], species["member"]),
                        "Native encounter species changed")
                levels.add(data[at + 42])
            require(sorted(levels) == loc["levels"], "Native encounter levels changed")
            label = (loc["name"], loc["floors"])
            require(contexts.setdefault((game, context), label) == label, "Inconsistent floor or area label")
            count += 1
    return contexts, count


# Index in the gate-ending destination table, fixed formation, script call.
# The Mirror Gate has three successive formations; this is Durran's own fight.
TERRY_FIGHTS = {
    "dragon": (1, 1, 0x75), "golem": (2, 1, 0x6F), "great-sabrecat": (3, 1, 0x5B),
    "treeface": (4, 2, 0x4B7), "fang-slime": (6, 1, 0x8F), "big-eye": (7, 1, 0x5F),
    "living-statue": (9, 1, 0x81), "battle-rex": (10, 2, 0x8A), "funky-bird": (12, 1, 0x77),
    "sky-dragon": (13, 1, 0x5B), "jamiras": (15, 1, 0xD8), "demon-servant": (16, 1, 0x77),
    "dark-horn": (18, 1, 0x87), "akbar": (19, 1, 0xAC), "durran": (21, 3, 0x3C4),
}
# Fixed room transition, expected scene/variant, and the battle call with a
# cited message in that event. Temporary forms, other floors and other boss
# stages require their own verified bindings.
WORLD_FIGHTS = {
    "dam-builder": (2162, 0x800FEB24, 102, 0, 0x92, 0x7E, "s004c3000_03c0"),
    "bandit-leader": (139, 0x800F599C, 24, 2, 0x1C2, 0x1AF, "s00488000_02ff"),
    "western-cape-dancer": (106, 0x800F8F78, 27, 0, 0x55, 0x40, "s00530000_006f"),
    "ghost-ship-pirates": (140, 0x800F568C, 29, 4, 0x1A3, 0x18E, "s00494000_0320"),
    "northden-impostor": (136, 0x800FDECC, 34, 2, 0xFB4, 0xF5F, "s0044a800_1ef3"),
    "yuna-puppet": (148, 0x800FC894, 37, 2, 0x6B1, 0x6B8, "s004ee000_1ecd"),
    "spring-attacker": (124, 0x800FDE1C, 36, 0, 0x5E, 0x4D, "s004d6000_065a"),
    "lake-tower-wizard": (126, 0x800F5084, 32, 3, 0x211, 0x251, "s00368000_0524"),
    "dead-king": (109, 0x800FAE30, 42, 8, 0x21C, 0x209, "s002d3000_053c"),
    "small-cave-guardian": (127, 0x800F4558, 48, 1, 0x89, 0x76, "s00373000_025e"),
    "sky-impostor": (111, 0x800F93F0, 43, 8, 0x264, 0x239, "s002e4800_0421"),
    "dark-master": (108, 0x800F299C, 52, 0, 0x1D5, 0x1C0, "s002f4000_032d"),
    "darck": (112, 0x800F62D8, 52, 3, 0x2E2, 0x2BD, "s002f4000_069a"),
}
# Native area-indexed script directory and selected actor entry. These keep
# other pirates, castle guards and their encounters out of the named boss result.
ROOM_EVENTS = {"ghost-ship-pirates": (4, 0, 0x95), "spring-attacker": (8, 0, 0x28),
               "dead-king": (4, 0, 0x1CE), "sky-impostor": (4, 0, 0x1AE)}


def battle_records(disc, articles, routes, atlas):
    guards = [
        (disc.exe, world.PSX_EXE_BIAS, 0x80016788, 0x80016794, "3a3f7eb4c48d87584ee2984d626cf1d9ffc3df5f80fc0668442fd683917610d7"),
        (disc.exe, world.PSX_EXE_BIAS, 0x8003FD0C, 0x8003FD38, "c56af0371a098e3007dc0acd12f81e2fa35a21ef25f6b285c895bfd4825e5721"),
        (disc.exe, world.PSX_EXE_BIAS, 0x80042220, 0x80042288, "d9ebf083de06003ea23d0c7e126fb32ebac077e64009b416ba888a12788f20f8"),
        (disc.resource(5499), 0x8018C0B8, 0x8018C330, 0x8018CBC8, "facb85a2f7ccfb7d4db523b72863c12f3eed35a1a43b06f741c72e1123c772ec"),
    ]
    for raw, base, begin, end, digest in guards:
        require(0 <= begin-base < end-base <= len(raw), "Native code range outside resource")
        require(world.digest(raw[begin-base:end-base]) == digest, "Native field or enemy constructor changed")
    groups = struct.unpack_from("<24I", disc.exe, 0x8008E1AC - world.PSX_EXE_BIAS)
    baseline = world.read_json(ROOT / "data/monster-baseline.json")
    indices = {(r["family_id"], r["member"]): r["index"] for r in baseline["species"]}
    citations = world.read_json(ROOT / "scripts/world-disc-index.json")
    runtime = disc.resident_memory()
    map_ids = {m["id"] for m in atlas}
    def resource_at(group, slot):
        return struct.unpack_from("<I", disc.exe, groups[group]-world.PSX_EXE_BIAS+4*slot)[0]
    def section(src, address):
        record = disc.resource(src)
        _, _, scene, area, _, ptr, _ = struct.unpack_from("<HHHBBII", record, address - world.SCRIPT_BASE)
        return scene, area, record[ptr-world.SCRIPT_BASE+6]
    for key in [*TERRY_FIGHTS, *WORLD_FIGHTS]:
        article = "boss-" + key
        if key in TERRY_FIGHTS:
            index, formation, call = TERRY_FIGHTS[key]
            scene, area, context = section(18, 0x80117068+index*16)
            games = [("terry",17)]
        else:
            src, addr, expected_scene, expected_area, call, message, source_id = WORLD_FIGHTS[key]
            scene, area, context = section(src, addr)
            require((scene,area) == (expected_scene,expected_area), "Wrong story battle room")
            rid = resource_at(0,scene)
            event = disc.resource(rid)
            opcode, group, number = event[message:message+3]
            desc = citations["script_descriptors"][str(rid)]
            group_table = struct.unpack_from("<I",event,desc)[0] - world.SCRIPT_BASE
            slot = struct.unpack_from("<H",event,group_table+group*2)[0] + number
            require(opcode==0x29 and [rid,slot] in citations["script_slots"][source_id]
                    and source_id in articles[article]["source_ids"], "Boss dialogue does not identify this event")
            if key in ROOM_EVENTS:
                directory, actor, entry = ROOM_EVENTS[key]
                table = struct.unpack_from("<I", event, directory+area*4)[0] - world.SCRIPT_BASE
                start = struct.unpack_from("<I", event, table+actor*4)[0] - world.SCRIPT_BASE
                require(start == entry and start <= message < call, "Boss event is not in the reviewed room script")
            if key == "lake-tower-wizard":
                # The tower entrance script is shared. Both upper rooms with
                # a fixed formation select 112. Lower rooms only have wild group 0.
                require(context == section(126, 0x800F5164)[2] == 112, "Lake Tower upper battle context changed")
                for group in (18,19):
                    forms, records = struct.unpack_from("<II", disc.resource(resource_at(group,111)))
                    require(records-forms == 16, "Lake Tower lower floor acquired a fixed encounter")
            formation = 1
            games = [("cobi",18),("tara",19)]
        script = disc.resource(resource_at(0,scene))
        require(script[call-3:call+5] == bytes([0x70,0,formation,4,0x20,0x22,4,0x80]),
                "Fixed battle formation selection changed: "+key)
        route = routes.setdefault(article,{})
        route["fights"] = {}
        map_id = f"map-{scene}-{area}"
        if map_id in map_ids and key != "lake-tower-wizard":
            route["maps"] = [map_id,*[m for m in route.get("maps",[]) if m!=map_id]]
            if "gate" in route:
                routes[route["gate"]]["maps"] = [map_id]
        for game, group in games:
            raw=disc.resource(resource_at(group,context))
            forms, records, images, _ = struct.unpack_from("<4I",raw)
            start = forms + 16*formation
            require(forms <= start <= records-16, "Invalid formation")
            positions = struct.unpack_from("<3h",raw,start+6)
            party=[]
            for pos in positions:
                if pos == -1:
                    continue
                at = records+pos*52
                require(records <= at <= images-52, "Invalid encounter record")
                enemy = raw[at:at+52]
                moves=[]
                for num in enemy[10:16]:
                    if num not in (0,255):
                        move={"id":num}
                        if num>169:
                            move["label"] = world.table_message(runtime,(world.PSX_EXE_BIAS & world.PHYSICAL)+0x966F4+8,473+num,0)
                        if move not in moves:
                            moves.append(move)
                party.append({"species":indices[tuple(enemy[:2])],"level":enemy[42],
                              "stats":list(struct.unpack_from("<6H",enemy,16)),"skills":moves})
            require(party, "Empty boss formation")
            if articles[article]["species_ids"]:
                require(set(articles[article]["species_ids"]) == {m["species"] for m in party}, "Boss species mismatch: "+key)
            route["fights"][game] = party


def build(image):
    require(world.digest(image) == world.V73_HASH, "Expected the v1.0.73 Current disc")
    disc = world.Disc(image)
    contexts, encounter_count = all_wild(disc)
    _, entries = world.handbook()
    articles = {r["id"]: r for r in entries}
    atlas = js_data(ROOT / "data/player-atlas.js", "globalThis.PLAYER_ATLAS =")["maps"]
    by_title = defaultdict(dict)
    for m in atlas:
        by_title[normalized(m["title"])][m["placeId"]] = m
    routes = {}

    def route(key):
        require(key in articles, "Unknown article: " + key)
        return routes.setdefault(key, {})

    def add_encounters(key, campaigns, limits):
        groups = {}
        for game in campaigns:
            ids = list(range(limits[0], limits[1] + 1))
            require(all((game, i) in contexts for i in ids), "Unverified roster in " + key)
            groups[game] = ids
        route(key)["encounters"] = groups

    for slug, limits in GATES.items():
        key = "location-" + slug + "-gate"
        add_encounters(key, ["terry"], limits)
        boss = next((k for k in articles[key]["related"] if k.startswith("boss-")), None)
        if boss:
            route(key)["boss"] = boss
            route(boss)["gate"] = key
    for slug, limits in WORLDS.items():
        key = "location-" + slug
        add_encounters(key, ["cobi", "tara"], limits)
        route(key)["chapters"] = [k for k in articles[key]["related"] if k.startswith("story-")]
    for key, limits in CHAPTER_ROSTERS.items():
        add_encounters("story-" + key, ["cobi", "tara"], limits)
    for key, limits in OPTIONAL.items():
        add_encounters(key, ["terry"], limits)
    for chapter, ranks in CHAPTER_RANKS.items():
        stages = []
        for rank in ranks:
            arena = "quest-arena-dqm1-" + rank
            gates = ["location-" + slug + "-gate" for slug in RANK_GATES[rank]]
            route(arena)["gates"] = gates
            for gate in gates:
                route(gate)["arena"] = arena
            stages.append({"arena": arena, "gates": gates})
        route("story-" + chapter)["stages"] = stages
    for key, (items, skills) in EXTRA.items():
        if items:
            route(key)["supplies"] = ["item-" + str(i) for i in items]
        if skills:
            route(key)["skills"] = skills
    for a in entries:
        if a["kind"] not in ("story", "location", "boss"):
            continue
        found = []
        for title in a.get("places", []):
            matches = list(by_title[normalized(title)].values())
            if a["game"] == "dqm1":
                matches = [m for m in matches if m["scene"] in REGIONS["greattree"] + REGIONS["gate-ends"]]
            else:
                matches = [m for m in matches if m["scene"] < 70 or m["scene"] == 102]
            if len(matches) == 1 and matches[0]["placeId"] not in found:
                found.append(matches[0]["placeId"])
        if found:
            route(a["id"])["maps"] = found
    battle_records(disc, articles, routes, atlas)
    return {"schema_version": 1, "version": "v1.0.73", "wild_contexts": len(contexts),
            "species_encounters": encounter_count, "scenes": REGIONS, "routes": routes}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bin", type=Path, required=True)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    result = build(args.bin.read_bytes())
    out = ROOT / "data/field-routes.js"
    body = json.dumps(result, ensure_ascii=False, separators=(",", ":"))
    source = "// Generated by scripts/build-field-routes.py\nglobalThis.FIELD_ROUTES = " + body + ";\n"
    if args.check:
        require(out.read_text(encoding="utf-8") == source, "Guide routes differ from verified output")
    else:
        out.write_bytes(source.encode("utf-8"))
    print(f"Verified {result['wild_contexts']} wild contexts and {result['species_encounters']} species records.")
