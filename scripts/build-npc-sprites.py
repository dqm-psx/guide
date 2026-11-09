"""Build guide portraits from the local character artwork audit and the verified PSX disc."""
import argparse
import base64
import hashlib
import importlib.util
import json
import mmap
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("world", ROOT / "scripts/verify-world-guide.py")
world = importlib.util.module_from_spec(spec)
spec.loader.exec_module(world)
require = world.require

# Editorial IDs can differ from the physical actor record or the playable hero.
ACTORS = {
    "king-of-greattree": "great-tree-king", "greattree-name-master": "great-tree-name-master",
    "father": "dad", "mother": "mom", "king-of-assia": "king-scene-23",
    "king-of-northden": "king-scene-34", "king-of-westernia": "king-scene-37",
    "king-of-greatlog": "king-scene-15", "healie": "hale",
    "eastoria-botanist": "resident-r154-f9ecc-a15-ta8-b2915-s15",
    "greatlog-hibernation-attendant": "resident-r132-fc2fc-a0-tc14-b2838-s0",
    "greatlog-storage-clerk": "greatlog-bank-clerk", "greatlog-storage-customer": "greatlog-bank-customer",
    "greattree-egg-appraiser": "great-tree-egg-appraiser", "greattree-librarian": "great-tree-librarian",
    "greattree-storage-clerk": "great-tree-bank-clerk",
    "mud-hand-s-room-rock-paper-scissors-opponent": "resident-r5630-f1667c-a0-t1166-b5617-s0",
}

# Each line identifies the speaking field actor in this particular scene and story state.
# Some other conversations contain several speakers, including a king and his impostor.
SPEAKERS = {
    "queen-of-greattree": (5661, 1278, "resident-r5661-f17db8-a0-t2912-b5659-s0", "I am the queen of GreatTree"),
    "sanchi": (5630, 1317, "resident-r5630-f15a58-a6-t3ab-b5595-s6", "It's Sanchi."),
    "tife": (5661, 1208, "resident-r5661-f15754-a19-t1294-b5644-s19", "Tife:"),
    "kameha": (129, 363, "resident-r129-f9fbc-a8-t2e5-b2863-s8", "Kameha:"),
    "king-of-assia": (2162, 592, "resident-r2162-ffcbc-a0-t645-b4185-s0", "King: Ah, it's you!"),
    "king-of-westernia": (148, 388, "resident-r148-fe98c-a4-t2ff-b2912-s4", "King: Now that Yuna is herself again"),
    "queen-of-eastoria": (154, 469, "resident-r154-fa35c-a0-t5db-b2917-s0", "I am its queen."),
    "yuna": (148, 408, "resident-r148-feb7c-a1-t6e0-b2913-s1", "Yuna: Oh,"),
    "monster-professor": (131, 422, "resident-r131-f15cf8-a0-t30c-b2844-s0", "I am the Monster Professor"),
    "medal-collector": (133, 969, "resident-r133-f133a8-a0-t779-b2840-s0", "I'm the Medal Collector"),
    "king-of-greatlog": (129, 320, "resident-r129-f9fbc-a0-tf0-b2863-s0", "King: Why, it's"),
    "milly": (130, 977, "resident-r130-fc940-a5-ta93-b2852-s5", "Milly: Well?"),
    "petitbou": (131, 414, "resident-r131-f15998-a3-t2b6-b2842-s3", "Petitbou: Staying here"),
    "teto": (5661, 1250, "resident-r5661-f15754-a16-tf6f-b5644-s16", "Teto:"),
    "machiko": (5661, 1411, "resident-r5661-f17a38-a3-t2398-b5653-s3", "Machiko: My Living Statue"),
    "queen-of-the-mermaids": (141, 331, "resident-r141-fa928-a0-t46d-b2886-s0", "I am the queen of the mermaids"),
    "king-of-northden": (136, 598, "resident-r136-feebc-a9-t85e-b2897-s9", "King: Ah, our savior,"),
}


def source_bytes(data, offset, hex_value):
    expected = bytes.fromhex(hex_value)
    return bool(expected) and data[offset:offset + len(expected)] == expected


def speaker_actor(key, named_id, catalog, supplement, actors, disc, descriptors):
    resource, slot, actor_id, spoken = SPEAKERS[key]
    records = catalog if actor_id in catalog else supplement
    named, actor = records[named_id], records[actor_id]
    matches = [row for row in actor["dialogue"] if row["source"].get("archive_index") == resource
               and row["source"].get("slot") == slot]
    require(len(matches) == 1, f"{key}: ambiguous actor dialogue slot")
    line = matches[0]
    source = line["source"]
    # The named speaker may have been identified by message bytes before its actor
    # was recovered. Join that record to the exact message and the reviewed actor.
    require(any(actor_id in row.get("related_character_ids", []) and
                all(row["source"].get(k) == source[k] for k in ("archive_index", "text_offset", "text_sha256"))
                for row in named["dialogue"]),
            f"{key}: speaking character and field actor disagree")
    scene = disc.resource(resource)
    text = world.table_message(scene, descriptors[str(resource)], slot, world.SCRIPT_BASE & world.PHYSICAL)
    require(spoken in text, f"{key}: current disc no longer identifies this speaker")
    opcode = source["opcode_address"] - world.SCRIPT_BASE
    require(disc.resource(source["origin_resource"])[opcode:opcode + 3] ==
            bytes((0x29, source["group"], source["message"])), f"{key}: dialogue instruction changed")
    setup = actor["source"]
    if records is supplement:
        require(any(line["source_id"] in proof["messageSourceIds"] for proof in setup["recoveredPrefixProofs"]),
                f"{key}: actor talk script does not reach this message")
        setup = setup["appearances"][0]
    require(source_bytes(scene, setup["definition_offset"], setup["definition_hex"]) and
            source_bytes(scene, setup["talk_pointer_offset"], setup["talk_pointer_hex"]),
            f"{key}: actor or talk selector changed")
    portrait = actors[actor_id]
    archive_index = portrait["artwork"][0]["source"]["archiveIndex"]
    joins = [join for join in setup["sprite_joins"] if join["sprite_archive_index"] == archive_index]
    require(joins and all(source_bytes(disc.resource(j["source_resource"]), j["source_offset"], j["native_hex"])
                          and source_bytes(disc.resource(j["source_resource"]), j["setup_offset"], j["setup_hex"])
                          for j in joins), f"{key}: actor artwork assignment changed")
    return portrait


def build(wiki, image):
    release = json.loads((ROOT / "data/gameplay-verification.json").read_bytes())
    require(hashlib.sha256(image).hexdigest() == release["patched_bin_sha256"], "Wrong disc")
    disc = world.Disc(image)
    descriptors = world.read_json(ROOT / "scripts/world-disc-index.json")["script_descriptors"]
    audit = json.loads((wiki / "research/character-artwork-reference.json").read_bytes())
    actors = {actor["id"]: actor for actor in audit["characters"]}
    characters = world.read_json(wiki / "research/character-native-catalog.json")["characters"]
    catalog = {character["id"]: character for character in characters}
    recovered = world.read_json(wiki / "research/character-service-additions.json")
    supplement = {record["id"]: record for record in recovered["characters"] + recovered["characterUpdates"]}
    _, entries = world.handbook()
    art = {}
    for entry in entries:
        if entry["kind"] != "npc":
            continue
        key = entry["id"].removeprefix("npc-")
        if key in ("healie", "surabou"):
            # Their character pages identify a species, but no distinct actor sprite.
            require(len(entry["species_ids"]) == 1, "Ambiguous companion species")
            art[entry["id"]] = {"species": entry["species_ids"][0]}
            continue
        named_id = ACTORS.get(key, key)
        actor = (speaker_actor(key, named_id, catalog, supplement, actors, disc, descriptors)
                 if key in SPEAKERS else actors[named_id])
        portrait = actor["primarySprite"]
        if not portrait:
            continue
        record = actor["artwork"][0]
        source = record["source"]
        resource = disc.resource(source["archiveIndex"])
        require(hashlib.sha256(resource).hexdigest() == source["resourceSha256"], "Character artwork changed")
        pixels = (wiki / portrait["path"]).read_bytes()
        require(hashlib.sha256(pixels).hexdigest() == portrait["sha256"], "Portrait checksum mismatch")
        art[entry["id"]] = {"image": "data:image/png;base64," + base64.b64encode(pixels).decode("ascii"),
                            "role": "hero" if record.get("frames") else "actor"}
    return "globalThis.NPC_SPRITES = " + json.dumps(art, indent=2) + ";\n"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--wiki", required=True, type=Path)
    parser.add_argument("--bin", required=True, type=Path)
    args = parser.parse_args()
    with args.bin.open("rb") as disc, mmap.mmap(disc.fileno(), 0, access=mmap.ACCESS_READ) as image:
        (ROOT / "data/npc-sprites.js").write_bytes(build(args.wiki, image).encode())
