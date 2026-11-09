"""Pack the original transparent PSX sprites into independently loadable lossless sheets."""
import base64
import io
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PER_SHEET = 64
COLUMNS = 8


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
        dest = ROOT / path
        sheet.save(dest, lossless=True, exact=True, method=6)
        with Image.open(dest) as decoded:
            # Compare the actual distributed file, including per-pixel alpha.
            if decoded.convert("RGBA").tobytes() != sheet.tobytes():
                raise ValueError("Lossy sprite sheet: " + path)
        sheets.append([path, *sheet.size])
    return {"sheets": sheets, "frames": frames}


if __name__ == "__main__":
    styles = {kind: pack(kind, source_images(filename)) for kind, filename in
              [("portrait", "monster-sprites.js"), ("overworld", "overworld-sprites.js")]}
    (ROOT / "data/sprite-sheets.js").write_bytes(
        ("globalThis.SPRITE_SHEETS = " + json.dumps(styles, separators=(",", ":")) + ";\n").encode())
