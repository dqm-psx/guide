"""Build the guide's named map index from the PSX Master's Reference export.

Usage: python scripts/build-player-atlas.py path/to/site/dist
Requires Pillow only for this optional asset rebuild.
"""
import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image


def build(source, root):
    maps = json.loads((source / "data/maps.json").read_text(encoding="utf-8"))
    coverage = json.loads((source / "data/coverage.json").read_text(encoding="utf-8"))
    proofs = {(r["scene"], r["map"]): r for r in coverage["mapGraphics"]}
    named = {m["id"]: m for m in maps if m.get("nativeTitle") and m.get("image")}
    output = root / "maps"
    output.mkdir(exist_ok=True)
    rows = []
    encoded = {}
    for key, m in named.items():
        proof = proofs[m["scene"], m["map"]]
        raw = (source / m["image"]).read_bytes()
        original = hashlib.sha256(raw).hexdigest()
        if original != proof["sha256"]:
            raise ValueError(f"Unverified render: {key}")
        if original not in encoded:
            with Image.open(io.BytesIO(raw)) as image:
                if image.size != (m["width"] * 8, m["height"] * 8):
                    raise ValueError(f"Unexpected coordinates: {key}")
                image.thumbnail((1100, 1100), Image.Resampling.NEAREST)
                stream = io.BytesIO()
                image.save(stream, "WEBP", lossless=True, method=3)
            data = stream.getvalue()
            name = hashlib.sha256(data).hexdigest()[:20] + ".webp"
            (output / name).write_bytes(data)
            encoded[original] = name
        exits = []
        for link in m.get("connections", []):
            target = link.get("mapId")
            if target not in named:
                continue
            cells = link.get("event_cells") or []
            cell = cells[len(cells) // 2] if cells else None
            exit_info = {"to": target}
            if cell and link.get("event_cell_units") == "16-pixel tiles":
                x = (cell["x"] + 0.5) * 2 / m["width"]
                y = (cell["y"] + 0.5) * 2 / m["height"]
                if 0 < x < 1 and 0 < y < 1:
                    exit_info.update(x=round(x, 4), y=round(y, 4))
            if exit_info not in exits:
                exits.append(exit_info)
        rows.append(dict(id=key, title=m["nativeTitle"], scene=m["scene"], area=m["map"],
                         image=encoded[original], exits=exits))
    manifest = {"source": "PSX v1.0.66 static map extraction", "maps": rows}
    (root / "data/player-atlas.js").write_text(
        "globalThis.PLAYER_ATLAS = " + json.dumps(manifest, ensure_ascii=True, separators=(",", ":")) + ";\n",
        encoding="utf-8")
    print(f"{len(rows)} named maps, {len(set(encoded.values()))} distinct renders.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    build(parser.parse_args().source, Path(__file__).resolve().parents[1])
