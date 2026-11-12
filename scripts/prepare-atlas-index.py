"""Optional reconstruction of the atlas address/identity index from the original v1.0.66 reference export."""
import argparse
import importlib.util
import json
import mmap
from pathlib import Path

SPEC = importlib.util.spec_from_file_location("atlas", Path(__file__).with_name("build-player-atlas.py"))
atlas = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(atlas)


def generate(args, disc):
    maps = atlas.read_json(args.reference / "data/maps.json")
    coverage = atlas.read_json(args.reference / "data/coverage.json")
    images = {(m["scene"], m["map"]): m for m in coverage["mapGraphics"] if m.get("sha256")}
    directory = atlas.read_json(args.catalogs / "text_analysis_index.json")
    pools = {r["offset"]: r for r in atlas.read_json(args.catalogs / "text_analysis_scripts.json")["pools"]}
    occurrences = {}
    for filename in ("dialogue_catalog.json", "dialogue_extra_catalog.json"):
        for row in atlas.read_json(args.catalogs / filename)["entries"]:
            for target in row["occurrences"]:
                occurrences[target["pool"], target["offset"]] = row.get("reuse_primary_id") or row["id"]
    public = {r["id"]: r for r in atlas.read_json(args.comparison)["rows"] if r["table"].startswith("dialogue_full_")}
    groups, scenes, entries, pixels = {}, {}, [], {}
    for m in maps:
        if not m.get("nativeTitle") or not m.get("image"):
            continue
        scene, area, rid = m["scene"], m["map"], m["scene_resource"]
        pool = pools[directory[rid]["offset"]]
        ordinal, name, at, encoded = atlas.title(disc.resource(rid), pool["descriptor"], area)
        origin = m["titleSource"]
        atlas.require((name, at, len(encoded), atlas.sha(encoded)) ==
                      (m["nativeTitle"], origin["offset"], origin["bytes"], origin["sha256"]),
                      f"Published v1.0.66 title differs at {m['id']}")
        row = public[occurrences[pool["offset"], pool["offsets"][ordinal]]]
        spec = [rid, int(m["arrival"]["descriptor"], 16) - atlas.BASE, pool["descriptor"]]
        atlas.require(scenes.setdefault(scene, spec) == spec, "Inconsistent scene locators")
        source = m["source_resource"]
        offset = int(m["source_address"], 16) - (atlas.BIAS if source is None else atlas.BASE)
        item = [scene, area, source, offset, ordinal, row["table"] + ":" + row["id"],
                groups.setdefault((scene, name), m["id"])]
        entries.append(item)
        native = atlas.native_map(disc, spec, item)
        art = images[scene, area]
        tile_sha = atlas.sha(disc.resource(native["tiles"]))
        gfx_sha = atlas.sha(native["graphic"])
        atlas.require((native["tiles"], tile_sha, gfx_sha, atlas.sha(native["events"])) ==
                      (art["tileset_resource"], art["tileset_sha256"], art["graphic_sha256"], m["arrival"]["event_sha256"]),
                      "Original grid, palette, or texture differs")
        encoded_exits = [(r["event_kind"], r["event_id"], r["selector_index"],
                          [(c["x"], c["y"], c["word"]) for c in r["event_cells"]],
                          r["position_record_hex"], r["transition_record_hex"]) for r in m.get("connections", [])]
        atlas.require(native["doors"] == encoded_exits, f"Original selector evidence differs for {m['id']}")
        path = args.reference / m["image"]
        atlas.require(atlas.sha(path.read_bytes()) == art["sha256"], "Original PNG file differs")
        with atlas.Image.open(path) as png:
            atlas.require(png.size == (native["size"][0] * 16, native["size"][1] * 16), "Original image dimensions differ")
            digest = atlas.sha(png.convert("RGBA").tobytes())
        key = gfx_sha + ":" + tile_sha
        atlas.require(pixels.setdefault(key, digest) == digest, "Ambiguous source render")
    # The old export omitted maps whose native identity was verified later.
    # Retain those explicit additions and re-read their native descriptors;
    # reconstructing the baseline must not quietly remove them.
    supplements = atlas.read_json(atlas.INDEX)
    supplemental_ids = supplements.get("nativeSupplementMaps", [])
    present = {f"map-{item[0]}-{item[1]}" for item in entries}
    for item in supplements["maps"]:
        identity = f"map-{item[0]}-{item[1]}"
        if identity not in supplemental_ids or identity in present:
            continue
        spec = supplements["scenes"][str(item[0])]
        atlas.require(scenes.setdefault(item[0], spec) == spec, "Inconsistent supplemental scene locator")
        atlas.native_map(disc, spec, item)
        entries.append(item)
        present.add(identity)
    atlas.require(set(supplemental_ids) <= present, "Missing native supplemental map")
    entries.sort(key=lambda item: (item[0], item[1]))
    guards = [[g[k] for k in ("name", "start", "end", "sha256")]
              for g in atlas.read_json(args.consumer_evidence)["consumers"]]
    index = dict(schema=1, baseline="v1.0.66", baselineBinSha256=atlas.BASELINE,
                 sceneFields=["scene resource", "map descriptor offset", "native title descriptor offset"],
                 mapFields=["scene", "area", "incoming resource (null = executable)", "incoming offset",
                            "native title ordinal", "public dialogue row", "place representative"],
                 consumers=guards, scenes={str(k): v for k, v in sorted(scenes.items())}, maps=entries,
                 nativeSupplementMaps=supplemental_ids,
                 sourcePixelsSha256=atlas.json_digest(pixels))
    if args.write:
        fields = []
        for key, value in index.items():
            if isinstance(value, dict):
                rows = [json.dumps(k) + ": " + json.dumps(v) for k, v in value.items()]
                text = "{\n    " + ",\n    ".join(rows) + "\n  }"
            elif key in ("maps", "consumers"):
                text = "[\n    " + ",\n    ".join(map(json.dumps, value)) + "\n  ]"
            else:
                text = json.dumps(value)
            fields.append(json.dumps(key) + ": " + text)
        atlas.INDEX.write_text("{\n  " + ",\n  ".join(fields) + "\n}\n", encoding="utf8")
    else:
        atlas.require(index == atlas.read_json(atlas.INDEX), "Native layout index differs")
    print(f"Checked {len(entries)} original images, native map inputs, door tables and title bindings.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("baseline-bin", "reference", "catalogs", "comparison", "consumer-evidence"):
        parser.add_argument("--" + name, type=Path, required=True)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    with args.baseline_bin.open("rb") as handle, mmap.mmap(handle.fileno(), 0, access=mmap.ACCESS_READ) as image:
        generate(args, atlas.Disc(image, atlas.BASELINE))
