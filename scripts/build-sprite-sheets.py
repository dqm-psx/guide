"""Export lossless PSX sprite sheets and the small set of Guide home illustrations."""
import argparse
import base64
import hashlib
import io
import json
import struct
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PER_SHEET = 64
COLUMNS = 8
HOME_PORTRAITS = {11: "slime", 25: "wonder-egg", 62: "grizzly",
                  138: "treeface", 141: "warubou", 142: "watabou"}


def source_images(filename):
    script = (ROOT / "data" / filename).read_text(encoding="utf8")
    rows = json.loads(script.split("=", 1)[1].strip().rstrip(";"))
    images = {}
    for key, data_url in rows.items():
        prefix, payload = data_url.split(",", 1)
        if prefix != "data:image/png;base64":
            raise ValueError("Expected native PNG input")
        images[int(key)] = Image.open(io.BytesIO(base64.b64decode(payload, validate=True))).convert("RGBA")
    return images


def save_lossless(image, path):
    dest = ROOT / path
    image.save(dest, lossless=True, exact=True, method=6)
    with Image.open(dest) as decoded:
        if decoded.convert("RGBA").tobytes() != image.tobytes():
            raise ValueError("Lossy sprite: " + str(path))


def save_adventure_log(disc):
    # Terry's memory-card browser icon in the Japanese retail raw BIN. Just its
    # 16-color CLUT and 16x16 4-bit image are needed, independent of save data.
    with disc.open("rb") as stream:
        stream.seek(166420488)
        art = stream.read(160)
    if hashlib.sha256(art).hexdigest() != "1805d2a71ed4abae4fab944baaba0ef9752b83125fca6fa4469d2c282c20f1b8":
        raise ValueError("Unexpected Adventure Log icon in the retail disc")
    palette = []
    for color in struct.unpack_from("<16H", art):
        rgb = [(color >> shift) & 31 for shift in (0, 5, 10)]
        palette.append(tuple((v << 3) | (v >> 2) for v in rgb) + (255 if color else 0,))
    icon = Image.new("RGBA", (16, 16))
    icon.putdata([palette[index] for byte in art[32:] for index in (byte & 15, byte >> 4)])
    save_lossless(icon, "media/adventure-log.webp")


def pack(kind, images):
    sheets = []
    frames = {}
    ids = sorted(images)
    for start in range(0, len(ids), PER_SHEET):
        group = ids[start:start + PER_SHEET]
        width = max(images[i].width for i in group)
        height = max(images[i].height for i in group)
        rows = (len(group) + COLUMNS - 1) // COLUMNS
        sheet = Image.new("RGBA", (width * min(COLUMNS, len(group)), height * rows))
        for n, i in enumerate(group):
            x, y = n % COLUMNS * width, n // COLUMNS * height
            sheet.paste(images[i], (x, y))
            frames[i] = [len(sheets), x, y, *images[i].size]
        path = "media/sprites-%s-%d.webp" % (kind, len(sheets))
        save_lossless(sheet, path)
        sheets.append([path, *sheet.size])
    return {"sheets": sheets, "frames": frames}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--retail-disc", type=Path, help="also rebuild the PS1 Adventure Log icon from the retail BIN")
    args = parser.parse_args()
    portraits = source_images("monster-sprites.js")
    for species, name in HOME_PORTRAITS.items():
        image = portraits[species]
        save_lossless(image.crop(image.getchannel("A").getbbox()), f"media/{name}.webp")
    if args.retail_disc:
        save_adventure_log(args.retail_disc)
    styles = {"portrait": pack("portrait", portraits), "overworld": pack("overworld", source_images("overworld-sprites.js"))}
    (ROOT / "data/sprite-sheets.js").write_bytes(
        ("globalThis.SPRITE_SHEETS = " + json.dumps(styles, separators=(",", ":")) + ";\n").encode())
