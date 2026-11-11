"""Compare the guide's learning/growth evidence in retail and English v1.0.73.

Read-only: emits addresses and hashes, never game bytes or local source paths.
"""
import argparse
import hashlib
import importlib.util
import json
import mmap
from contextlib import ExitStack
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    "world", Path(__file__).with_name("verify-world-guide.py"))
world = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(world)

DISCS = (
    "a1217657786430ac1c3ad71f16cdadb65d47b0df9a7e30278900651c1f1eec29",
    "c7fd48e4decd7747a3e8b72ff052960b4ae0943ad61b6a95c57c946791cba812",
)
SPANS = (
    ("offspring construction", None, 0x80049094, 0x8004A328),
    ("party strength classifier", None, 0x80044434, 0x80044640),
    ("skill candidate scan and thresholds", 104, 0x801222DC, 0x80122838),
    ("farm experience", 104, 0x8011E950, 0x8011EF1C),
    ("party level-up preparation", 104, 0x8011FB38, 0x801200D4),
    ("party learning dispatch", 104, 0x801200D4, 0x80120688),
    ("text-speed dispatch", None, 0x80035074, 0x800350D4),
    ("text-speed manual wait", None, 0x800350D8, 0x800351A0),
    ("text-speed countdown table", None, 0x800C70E0, 0x800C70E7),
)


def audit(paths):
    with ExitStack() as stack:
        discs = []
        for path, expected in zip(paths, DISCS):
            handle = stack.enter_context(path.open("rb"))
            image = stack.enter_context(mmap.mmap(handle.fileno(), 0, access=mmap.ACCESS_READ))
            world.require(hashlib.sha256(image).hexdigest() == expected, "Unexpected disc hash")
            discs.append(world.Disc(image))
        rows = []
        for name, resource, start, end in SPANS:
            base = world.PSX_EXE_BIAS if resource is None else 0x80114CB8
            blocks = [(disc.exe if resource is None else disc.resource(resource))[start-base:end-base]
                      for disc in discs]
            world.require(all(len(block) == end-start for block in blocks), "Incomplete native span")
            world.require(blocks[0] == blocks[1], "Retail/current mechanics differ: " + name)
            rows.append({"name": name, "resource": resource, "start": hex(start),
                         "endExclusive": hex(end), "bytes": end-start,
                         "sha256": hashlib.sha256(blocks[0]).hexdigest()})
        return {"passed": True, "discSha256": list(DISCS), "identicalSpans": rows}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--original-bin", type=Path, required=True)
    parser.add_argument("--current-bin", type=Path, required=True)
    args = parser.parse_args()
    print(json.dumps(audit([args.original_bin, args.current_bin]), indent=2))
