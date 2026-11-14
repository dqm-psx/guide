"""Export the eleven native 10x10 monster-family glyphs without resampling."""
import argparse
import hashlib
import importlib.util
import json
import struct
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("native", ROOT / "scripts/sync-verify-native.py")
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)
FONT_SHA256 = "1086ad724326325e944d6dfc0e543c563a5593a8622fdff53a969408b5baf0c3"
FAMILIES = ("Slime", "Dragon", "Beast", "Bird", "Plant", "Bug", "Demon", "Zombie", "Material", "Water", "Boss (????)")


def build(source):
    raw = source.read_bytes()
    if hashlib.sha256(raw).hexdigest() != FONT_SHA256:
        raise ValueError("Expected original Japanese archive resource 5542 (FONT)")
    decoded = native.decompress(raw)
    if decoded[:4] != bytes.fromhex("0d105200"):
        raise ValueError("Unexpected FONT texture directory")
    blocks, offset = [], 4
    for _ in range(82):
        size_flags, x, y, width, height = struct.unpack_from("<I4H", decoded, offset)
        size, flags = size_flags & 0xffffff, size_flags >> 24
        blocks.append((flags, x, y, width, height, decoded[offset + 12:offset + 12 + size]))
        offset += 12 + ((size + 3) // 4) * 4
    icons, palette = blocks[1], blocks[46]
    if icons[:5] != (4, 960, 366, 28, 10) or palette[:5] != (6, 256, 510, 16, 1):
        raise ValueError("Native family glyph or CLUT placement changed")
    colors = []
    for color in struct.unpack("<16H", palette[5]):
        rgb = [(color >> shift) & 31 for shift in (0, 5, 10)]
        colors.append(tuple((v << 3) | (v >> 2) for v in rgb) + (255 if color else 0,))
    atlas = Image.new("RGBA", (112, 10))
    atlas.putdata([colors[index] for byte in icons[5] for index in (byte & 15, byte >> 4)])
    manifest = {}
    for index, name in enumerate(FAMILIES):
        image = atlas.crop((index * 10, 0, index * 10 + 10, 10))
        relative = "media/family-" + str(index) + ".webp"
        image.save(ROOT / relative, lossless=True, exact=True, method=6)
        with Image.open(ROOT / relative) as saved:
            if saved.convert("RGBA").tobytes() != image.tobytes():
                raise ValueError("Family sprite pixel mismatch: " + name)
        manifest[index] = {"src": relative, "width": 10, "height": 10}
    (ROOT / "data/family-icons.js").write_text(
        "// Original PSX family glyphs: FONT 5542, block 1, CLUT 0x7F90.\n"
        "globalThis.FAMILY_ICONS = " + json.dumps(manifest, separators=(",", ":")) + ";\n", encoding="utf8")
    print("Exported 11 exact 10x10 family icons (lossless WebP).")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("font_resource", type=Path, help="Extracted original Japanese archive resource 5542")
    build(parser.parse_args().font_resource)
