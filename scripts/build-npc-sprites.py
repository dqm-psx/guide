"""Build guide portraits from reviewed actors and both authenticated PSX discs.

A talk-table slot can represent several different people over the story. Never
use its initial artwork to identify one of those people. Re-decode each selected
portrait from the native graphics and compare it to the Japanese original.
"""
import argparse
import base64
import hashlib
import importlib.util
import io
import json
import mmap
import struct
from contextlib import ExitStack
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("world", ROOT / "scripts/verify-world-guide.py")
world = importlib.util.module_from_spec(spec)
spec.loader.exec_module(world)
require = world.require
JAPANESE = "a1217657786430ac1c3ad71f16cdadb65d47b0df9a7e30278900651c1f1eec29"
OUTPUT = ROOT / "data/npc-sprites.js"
EVIDENCE = ROOT / "docs/npc-sprite-evidence.json"

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
    "bunny": (5671, 169, "resident-r5671-fa11c-a15-tdd6-b5663-s15", "Hi! I'm Bunny!"),
    "laura": (73, 102, "resident-r73-f5d78-a2-t7b-b4116-s2", "I am Laura, princess of Radatome."),
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
    "petitbou": (131, 414, "resident-r131-f15998-a3-t2b6-b2842-s3", "Petitbou: Staying here"),
    "teto": (5661, 1250, "resident-r5661-f15754-a16-tf6f-b5644-s16", "Teto:"),
    "machiko": (5661, 1411, "resident-r5661-f17a38-a3-t2398-b5653-s3", "Machiko: My Living Statue"),
    "queen-of-the-mermaids": (141, 331, "resident-r141-fa928-a0-t46d-b2886-s0", "I am the queen of the mermaids"),
    "king-of-northden": (136, 598, "resident-r136-feebc-a9-t85e-b2897-s9", "King: Ah, our savior,"),
}


# These unnamed service/quest roles are identified by their own conversation,
# rather than a visual guess or a name spoken by another actor.
ROLE_ACTORS = {
    "greatlog-key-appraiser": (133, 987, "resident-r133-f135b4-a0-t93c-b2858-s0", "This is the key shop. I appraise keys."),
    "bazaar-cook": (5671, 104, "resident-r5671-fa11c-a8-t74b-b5663-s8", "Do you have a monster that can make fire?"),
    "bazaar-muscleman": (5671, 205, "resident-r5671-fa11c-a9-tafb-b5663-s9", "Do you know the skill Summon?"),
    "well-professor": (5630, 1380, "resident-r5630-f15f04-a0-tbd8-b5607-s0", "I need a monster with a lightning skill"),
    "greattree-storage-apprentice": (5630, 1212, "great-tree-bank-apprentice", "Our first-rate security will protect your valuables!"),
}


def source_bytes(data, offset, hex_value):
    expected = bytes.fromhex(hex_value)
    return bool(expected) and data[offset:offset + len(expected)] == expected


def speaker_actor(key, named_id, catalog, supplement, actors, disc, descriptors, original):
    resource, slot, actor_id, spoken = SPEAKERS[key]
    records = catalog if actor_id in catalog else supplement
    named, actor = records[named_id], records[actor_id]
    speakers = {speaker["id"] for row in actor["dialogue"] for speaker in row.get("speakers", [])}
    require(speakers == {named_id},
            f"{key}: a shared conversation host cannot identify a person's initial sprite")
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
    for native_disc in (disc, original):
        require(native_disc.resource(source["origin_resource"])[opcode:opcode + 3] ==
                bytes((0x29, source["group"], source["message"])), f"{key}: dialogue instruction changed")
    setup = actor["source"]
    if records is supplement:
        require(any(line["source_id"] in proof["messageSourceIds"] for proof in setup["recoveredPrefixProofs"]),
                f"{key}: actor talk script does not reach this message")
        setup = setup["appearances"][0]
    for native_disc in (disc, original):
        native_scene = native_disc.resource(resource)
        # The patch moves Teto beside the table (70,76 -> 62,81) so that
        # conversation geometry works. His actor/sprite/talk slots are unchanged.
        definition = ("03041000000046004c00000000000000"
                      if key == "teto" and native_disc is original else setup["definition_hex"])
        require(source_bytes(native_scene, setup["definition_offset"], definition) and
                source_bytes(native_scene, setup["talk_pointer_offset"], setup["talk_pointer_hex"]),
                f"{key}: actor or talk selector changed")
    portrait = actors[actor_id]
    archive_index = portrait["artwork"][0]["source"]["archiveIndex"]
    joins = [join for join in setup["sprite_joins"] if join["sprite_archive_index"] == archive_index]
    for native_disc in (disc, original):
        require(joins and all(source_bytes(native_disc.resource(j["source_resource"]), j["source_offset"], j["native_hex"])
                              and source_bytes(native_disc.resource(j["source_resource"]), j["setup_offset"], j["setup_hex"])
                              for j in joins), f"{key}: actor artwork assignment changed")
    return portrait


def role_actor(key, catalog, actors, disc, descriptors, original):
    resource, slot, actor_id, spoken = ROLE_ACTORS[key]
    actor = catalog[actor_id]
    setup = actor["source"]
    if "sprite_joins" not in setup:
        setup = next(place["source"] for place in actor["locations"] if "sprite_joins" in place["source"])
    text = world.table_message(disc.resource(resource), descriptors[str(resource)], slot,
                               world.SCRIPT_BASE & world.PHYSICAL)
    require(spoken in text, f"{key}: role-identifying conversation changed")
    matches = [row for row in actor["dialogue"] if spoken in row["text"]]
    require(len(matches) == 1, f"{key}: ambiguous role-identifying conversation")
    source = matches[0]["source"]
    opcode = source.get("event_opcode_offset")
    if opcode is None:
        opcode = source["opcode_address"] - world.SCRIPT_BASE
    portrait = actors[actor_id]
    archive = portrait["artwork"][0]["source"]["archiveIndex"]
    joins = [j for j in setup["sprite_joins"] if j["sprite_archive_index"] == archive]
    for native_disc in (disc, original):
        scene = native_disc.resource(resource)
        require(scene[opcode:opcode + 3] == bytes((0x29, source["group"], source["message"])),
                f"{key}: role dialogue instruction changed")
        require(source_bytes(scene, setup["definition_offset"], setup["definition_hex"]) and
                source_bytes(scene, setup["talk_pointer_offset"], setup["talk_pointer_hex"]),
                f"{key}: actor or talk selector changed")
        require(joins and all(source_bytes(native_disc.resource(j["source_resource"]), j["source_offset"], j["native_hex"])
                              and source_bytes(native_disc.resource(j["source_resource"]), j["setup_offset"], j["setup_hex"])
                              for j in joins), f"{key}: artwork assignment changed")
    return portrait


def palette(raw):
    return [((v & 31) * 255 // 31, ((v >> 5) & 31) * 255 // 31,
             ((v >> 10) & 31) * 255 // 31, 0 if v == 0 else 255)
            for v in struct.unpack("<16H", raw)]


def indexed(raw, colors, width, height):
    values = [n for value in raw for n in (value & 15, value >> 4)]
    require(len(values) == width * height, "Wrong native sprite dimensions")
    image = Image.new("RGBA", (width, height))
    image.putdata([colors[n] for n in values])
    return image


def native_frame(raw, slot=None):
    if slot is None:
        decoded = world.native.decompress(raw)
        require(len(decoded) == 0x1E20, "Unexpected playable-character graphics")
        return indexed(decoded[32:], palette(decoded[:32]), 60, 256).crop((0, 0, 20, 32))
    require(0 <= slot < 32 and len(raw) >= 1568, "Invalid native actor slot")
    image_set = raw[1024 + slot]
    pointer = struct.unpack_from("<I", raw, 1056 + image_set * 16)[0]
    decoded = world.native.decompress(raw[1568 + pointer:])
    require(len(decoded) in (512, 1536), "Unexpected actor graphics")
    width = 32 if 16 <= image_set < 20 and len(decoded) == 1536 else len(decoded) // 16
    image = indexed(decoded, palette(raw[slot * 32:(slot + 1) * 32]), width, len(decoded) * 2 // width)
    return image.crop((0, 0, 32, 32))


def verify_source(disc, original, source, pixels):
    archive = source["archiveIndex"]
    raw = disc.resource(archive)
    require(hashlib.sha256(raw).hexdigest() == source["resourceSha256"], "Character artwork changed")
    require(raw == original.resource(archive), "Character artwork differs from the Japanese original")
    for native_disc in (disc, original):
        group = struct.unpack_from("<I", native_disc.exe, 0x8008E1AC - world.PSX_EXE_BIAS + 6 * 4)[0]
        require(struct.unpack_from("<I", native_disc.exe,
                                   group - world.PSX_EXE_BIAS + source["resourceEntry"] * 4)[0] == archive,
                "Character resource-group assignment changed")
    decoded = native_frame(raw, source.get("actorSpriteSlot"))
    published = Image.open(io.BytesIO(pixels)).convert("RGBA")
    require(decoded.size == published.size and decoded.tobytes() == published.tobytes(),
            "Portrait does not match the selected native frame")
    proof = {key: source[key] for key in ("archiveIndex", "resourceEntry", "resourceSha256")}
    proof.update(portraitSha256=hashlib.sha256(pixels).hexdigest(), frameSize=list(decoded.size))
    return proof


def milly_portrait(disc, original, descriptors, wiki):
    """Queen's Room actor 4 has Milly's own conversation, not a rotating arena host."""
    current = disc.resource(5661)
    # Actor set 2 enables the fourth slot after Starry Night. Its definition
    # selects sprite slot 4; its installed talk pointer begins at 0x3430.
    proofs = [(5661, 0x17DC8, "05000000002d1080"),
              (5661, 0x17D90, "e82c1080"),
              (5661, 0x17CD8, "03040400000014001300000000000000"),
              (5661, 0x124, "40e40e80"),
              (5661, 0x347F, "29155d"),
              (5630, 0x1CDB0, "070011000b000600707d108000000000"),
              (5630, 0x1CD60, "c28f0e020f000000")]
    for archive, offset, expected in proofs:
        for native_disc in (disc, original):
            require(source_bytes(native_disc.resource(archive), offset, expected),
                    f"Milly: native actor/conversation proof changed at {archive}:{offset:X}")
    require(current[0x3430:0x34E6] == original.resource(5661)[0x3430:0x34E6],
            "Milly: original conversation bytecode differs")
    text = world.table_message(current, descriptors["5661"], 1371, world.SCRIPT_BASE & world.PHYSICAL)
    require(text.startswith("Milly:") and "Skeleton Swordsman" in text,
            "Milly: Queen's Room conversation no longer identifies her")
    packs = world.read_json(wiki / "research/npc-graphics.json")["packs"]
    pack = next(row for row in packs if row["archive_index"] == 5659)
    source = {"archiveIndex": 5659, "actorSpriteSlot": 4,
              "resourceEntry": pack["resource_entry"], "resourceSha256": pack["source_sha256"]}
    output = io.BytesIO()
    native_frame(disc.resource(5659), 4).save(output, format="PNG")
    return output.getvalue(), source


def milly_home_portrait(disc, original):
    """Opening-room actor 0 is Milly in her nightdress, not the later outfit."""
    scene = disc.resource(5587)
    require(scene == original.resource(5587) and hashlib.sha256(scene).hexdigest() ==
            "69a5fc274f7204545e014a23f9fde392cd535971f5ab5b70222dbe1ff8c0a351",
            "Opening-room actors or event script changed")
    require(source_bytes(scene, 0x6B2C, "00000000080000000000000000000000"),
            "Opening Milly no longer selects actor sprite slot 0")
    require(source_bytes(scene, 0xA3, "390070800b13") and source_bytes(scene, 0xE2, "290100"),
            "Opening Milly initialization/message changed")
    # Intro, ending and postgame return all load this room with NPC selector
    # 177. The native directory reserves its first 20 entries, so this selects
    # group 6 entry 197, graphics resource 5585.
    arrivals = [(5578, 0x106C, "0f0026006700000074c00e8000000000", 0x1064),
                (5377, 0x3080, "0f0026006700000080e00e8000000000", 0x3070),
                (5630, 0x1D034, "0f00260067000000ec7f108018000000", 0x1CFDC)]
    for native_disc in (disc, original):
        for archive, offset, arrival, setup in arrivals:
            raw = native_disc.resource(archive)
            require(source_bytes(raw, offset, arrival) and source_bytes(raw, setup, "c08ff802b1000000"),
                    "Opening-room sprite assignment changed")
    # Group 1 starts at slot 93. The original offset identifies the public
    # e0affe4_019b record; the patched resident contains its translated text.
    require(struct.unpack_from("<H", original.exe, 0xAF72C + 93 * 2)[0] == 0x19B,
            "Opening Milly message identity changed")
    text = world.table_message(disc.resident_memory(), 0xBF7EC, 93, 0)
    require(text.startswith("Milly:") and "It's bedtime!" in text,
            "Opening-room message no longer identifies Milly")
    source = {"archiveIndex": 5585, "actorSpriteSlot": 0, "resourceEntry": 197,
              "resourceSha256": "42049380b50e2e2044fd50d3bc01f4b879cc1f02d51961657e2bfcb814dcb895"}
    output = io.BytesIO()
    native_frame(disc.resource(5585), 0).save(output, format="PNG")
    return output.getvalue(), source


def build(wiki, image, original_image):
    release = json.loads((ROOT / "data/gameplay-verification.json").read_bytes())
    require(hashlib.sha256(image).hexdigest() == release["patched_bin_sha256"], "Wrong disc")
    disc = world.Disc(image)
    require(hashlib.sha256(original_image).hexdigest() == JAPANESE, "Wrong Japanese disc")
    original = world.Disc(original_image)
    descriptors = world.read_json(ROOT / "scripts/world-disc-index.json")["script_descriptors"]
    audit = json.loads((wiki / "research/character-artwork-reference.json").read_bytes())
    actors = {actor["id"]: actor for actor in audit["characters"]}
    characters = world.read_json(wiki / "research/character-native-catalog.json")["characters"]
    catalog = {character["id"]: character for character in characters}
    recovered = world.read_json(wiki / "research/character-service-additions.json")
    supplement = {record["id"]: record for record in recovered["characters"] + recovered["characterUpdates"]}
    _, entries = world.handbook()
    art = {}
    evidence = {}
    for entry in entries:
        if entry["kind"] != "npc":
            continue
        key = entry["id"].removeprefix("npc-")
        if key in ("healie", "surabou"):
            # Their character pages identify a species, but no distinct actor sprite.
            require(len(entry["species_ids"]) == 1, "Ambiguous companion species")
            art[entry["id"]] = {"species": entry["species_ids"][0]}
            continue
        if key == "milly":
            pixels, source = milly_portrait(disc, original, descriptors, wiki)
            proof = verify_source(disc, original, source, pixels)
            proof.update(actorSlot=4, sceneResource=5661, mapId="map-11-6", actorIndex=4,
                         talkOffset=0x3430, messageSlot=1371, identity="Milly's Queen's Room conversation")
            art[entry["id"]] = {"image": "data:image/png;base64," + base64.b64encode(pixels).decode("ascii"),
                                "role": "actor"}
            home_pixels, home_source = milly_home_portrait(disc, original)
            home_proof = verify_source(disc, original, home_source, home_pixels)
            home_proof.update(actorSlot=0, sceneResource=5587, mapId="map-103-0", actorIndex=0,
                              messageSlot=93, sourceId="e0affe4_019b", identity="Milly's opening-room conversation")
            art[entry["id"]]["variants"] = [
                {"id": "home", "label": "At home", "mapIds": ["map-103-0"], "role": "actor", "spoiler": "none",
                 "image": "data:image/png;base64," + base64.b64encode(home_pixels).decode("ascii")},
                {"id": "queens-room", "label": "Queen's Room", "mapIds": ["map-11-6"],
                 "image": art[entry["id"]]["image"], "role": "actor", "spoiler": "ending"}]
            proof["variants"] = {"home": home_proof, "queens-room": dict(proof)}
            evidence[entry["id"]] = proof
            continue
        named_id = ACTORS.get(key, key)
        actor = (speaker_actor(key, named_id, catalog, supplement, actors, disc, descriptors, original)
                 if key in SPEAKERS else role_actor(key, catalog, actors, disc, descriptors, original)
                 if key in ROLE_ACTORS else actors[named_id])
        portrait = actor["primarySprite"]
        if not portrait:
            continue
        record = actor["artwork"][0]
        source = record["source"]
        pixels = (wiki / portrait["path"]).read_bytes()
        require(hashlib.sha256(pixels).hexdigest() == portrait["sha256"], "Portrait checksum mismatch")
        proof = verify_source(disc, original, source, pixels)
        if "actorSpriteSlot" in source:
            proof["actorSlot"] = source["actorSpriteSlot"]
        if key in SPEAKERS:
            archive, slot, _, _ = SPEAKERS[key]
            proof.update(sceneResource=archive, messageSlot=slot, identity="Single named speaker in the actor conversation")
        elif key in ROLE_ACTORS:
            archive, slot, _, _ = ROLE_ACTORS[key]
            proof.update(sceneResource=archive, messageSlot=slot, identity="Service or quest role identified by its own actor conversation")
        else:
            proof["identity"] = "Reviewed actor or playable-hero identity"
        evidence[entry["id"]] = proof
        art[entry["id"]] = {"image": "data:image/png;base64," + base64.b64encode(pixels).decode("ascii"),
                            "role": "hero" if record.get("frames") else "actor"}
    receipt = {"schemaVersion": 1, "currentDiscSha256": release["patched_bin_sha256"],
               "originalDiscSha256": JAPANESE, "scope": "Native resource assignments and exact portrait pixels match both discs. Shared conversation hosts are not person identities.",
               "portraits": evidence}
    return "globalThis.NPC_SPRITES = " + json.dumps(art, indent=2) + ";\n", json.dumps(receipt, indent=2) + "\n"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--wiki", required=True, type=Path)
    parser.add_argument("--bin", required=True, type=Path)
    parser.add_argument("--original-bin", required=True, type=Path)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    with ExitStack() as stack:
        images = []
        for path in (args.bin, args.original_bin):
            stream = stack.enter_context(path.open("rb"))
            images.append(stack.enter_context(mmap.mmap(stream.fileno(), 0, access=mmap.ACCESS_READ)))
        sprites, receipt = build(args.wiki, *images)
        for path, content in ((OUTPUT, sprites), (EVIDENCE, receipt)):
            if args.check:
                require(path.read_text(encoding="utf8") == content, f"Stale {path.name}")
            else:
                path.write_bytes(content.encode())
        print("Verified native NPC/hero portraits and Milly's home variant against both discs.")
