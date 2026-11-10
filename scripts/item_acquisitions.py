"""Item rewards read from English PS1 v1.0.73. See scripts/verify-world-guide.py for disc access."""
from collections import defaultdict
import json
from pathlib import Path
import struct


def reward_sources(disc, name_for_slot, world):
    """Return player-facing acquisition records keyed by native item ID."""
    sources = defaultdict(list)
    bias = 0x8000F800

    def read(address, size):
        return disc.exe[address - bias:address - bias + size]

    def add(item, game, text, entry=None):
        record = {"game": game, "text": text}
        if entry:
            record["entry"] = entry
        sources[item].append(record)

    for item, source in fixed_chests(disc, world):
        sources[item].append(source)

    # Resource 114: the English patch restores Terry's Treasure/Mimic floors.
    prizes = bytes.fromhex("0b 03 05 0c 1b 1c 25 24 26 27 26 27")
    if disc.resource(114).count(prizes) != 1:
        raise ValueError("Unrecognized Terry Treasure/Mimic prize table")
    for item in sorted(set(prizes)):
        add(item, "dqm1", "Open the prize chest on a Treasure/Mimic floor in Terry’s gates (English patch).",
            "field-restored-content")

    # Four classes, eight (weight, item) pairs each. FE draws uniformly from equipment.
    if read(0x8004CFF8, 12) != bytes.fromhex("40 00 04 24 0f 8f 00 0c 5c 00 05 24"):
        raise ValueError("GreatLog arena equipment prize range changed")
    for index, rank in enumerate("CBAS"):
        row = read(0x800B6D10 + index * 16, 16)
        if len(row) != 16 or sum(row[::2]) != 100:
            raise ValueError("Unrecognized GreatLog arena prize table")
        for weight, item in zip(row[::2], row[1::2]):
            if item == 0xFF:  # Magic Key (not a numbered item).
                continue
            for result in range(64, 93) if item == 0xFE else (item,):
                add(result, "dqm2", f"GreatLog arena: Class {rank} prize draw.",
                    f"quest-arena-dqm2-{rank.lower()}")

    # Each random Magic Key theme has eight slots; types 4 and 5 are caves and towers.
    # An appraisal can substitute another key for the item, so these are possible drops.
    chests = defaultdict(list)
    for theme in range(86):
        layout = read(0x800A65F4 + 8 * theme, 8)
        items = read(0x800A68BC + 8 * theme, 8)
        name = name_for_slot(831 + theme)
        if not name:
            raise ValueError(f"Missing Magic Key theme name {theme}")
        for slot in range(1, 7):
            site = {4: "cave", 5: "tower"}.get(layout[slot] & 15)
            if site and items[slot] and name not in chests[items[slot], site]:
                chests[items[slot], site].append(name)
    for (item, site), names in sorted(chests.items()):
        add(item, "dqm2", f"Random Magic Key {site} chests: {', '.join(names)}.")
    return dict(sources)


def fixed_chests(disc, world):
    """Group-zero chests, joined to reachable Cobi/Tara rooms in the PS1 atlas."""
    # Room descriptions and special access notes corroborated by the PS1
    # playthrough cited in maintaining-guide.md. Duplicate map variants share loot.
    rooms = {
        (15, 0): "GreatLog Castle", (15, 14): "GreatLog Treasury",
        (27, 0): "Cape Cave", (28, 1): "Volcanic Island Cave, B1F",
        (28, 2): "Volcanic Island Cave, B2F", (29, 2): "Ghost Ship, 2F",
        (30, 1): "East Lighthouse, 2F", (31, 4): "Border Mine, 2F",
        (32, 0): "Lake Tower, 1F", (32, 1): "Lake Tower, 2F",
        (32, 3): "Lake Tower, 4F", (32, 4): "Lake Tower, 5F",
        (43, 1): "Demon King’s Castle, 1F", (43, 3): "Demon King’s Castle, B2F",
        (43, 5): "Demon King’s Castle, B4F", (43, 7): "Demon King’s Castle, B6F",
        (46, 0): "Sage’s Tower, 1F", (48, 1): "Small Cave, B1F",
        (50, 0): "Western Mountain",
    }
    special = {
        11: "northeastern chest",
        14: "western chests via the deck rope; collect before taking the Moonstone",
        15: "western chests via the deck rope; collect before taking the Moonstone",
        16: "western chests via the deck rope; collect before taking the Moonstone",
        25: "chests beyond the damaging floor", 26: "chests beyond the damaging floor",
        106: "northwest chest", 107: "southeast chest",
    }
    index = json.loads(Path(__file__).with_name("atlas-native-index.json").read_bytes())
    base = world.SCRIPT_BASE
    first, second = struct.unpack_from("<II", disc.exe, 0x800ADC70 - world.PSX_EXE_BIAS)
    found = set()
    for (scene, area), label in rooms.items():
        resource, maps, _ = index["scenes"][str(scene)]
        raw = disc.resource(resource)
        assets, = struct.unpack_from("<I", raw, maps + 28 * area + 12)
        events, = struct.unpack_from("<I", raw, assets - base)
        grid = world.native.decompress(raw[events - base:])
        width, height = struct.unpack_from("<HH", grid, 2)
        if len(grid) != 8 + 2 * width * height:
            raise ValueError(f"Invalid event grid for {label}")
        slots = sorted({word & 255 for (word,) in struct.iter_unpack("<H", grid[8:])
                        if word >> 8 in (0x1D, 0x1E, 0x1F)})
        for slot in slots:
            if slot >= second - first:  # outside the bounded group-zero table
                continue
            item = disc.exe[first - world.PSX_EXE_BIAS + slot]
            if item in (0, 33):  # random key / special field event; not an inventory grant
                continue
            detail = special.get(slot, "treasure chest")
            if scene == 32:
                detail += " after clearing Ice World"
            elif scene == 29 and slot not in special:
                detail += "; collect before taking the Moonstone"
            elif scene == 28 and slot in (22, 23, 24):
                detail += " reached by flying from the northeast"
            if (item, scene, area, detail) not in found:
                found.add((item, scene, area, detail))
                yield item, {"game": "dqm2", "map": f"map-{scene}-{area}", "text": f"{label}: {detail}."}
