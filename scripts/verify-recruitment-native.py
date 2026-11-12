"""Run the manual's native recruitment harnesses against retail and Current discs.

Requires Unicorn and a checkout of dqm-psx/manual at the revision documented in
docs/recruitment-evidence.md. No upstream source files or research outputs change.
"""
import argparse
from contextlib import redirect_stdout
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import struct
import sys

ROOT = Path(__file__).resolve().parents[1]
MANUAL_INPUTS = {
    "tools/verify_recruitment.py": "13aba17bf4a838fb1d5d4e1791dc7e849ae043eb5b12f7a10e04a97489eae163",
    "tools/verify_recruitment_eligibility.py": "07f31120d28f774f1495d370b5c9437a450da7bd9634e161fb7ed6fe0b464c29",
    "tools/verify_sirloin_stacking.py": "7162c081506b01f7c500cabd3e9921bb6fc587882fec2dad542df31e8632438d",
    "site/dist/data/encounters.json": "e3c58def610ece88d999667c8c9bc564ea141362de65ae0666f5654c5150cc04",
}


def module_from(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class Archive:
    """Resolve upstream archive slices through the disc's native resource index."""
    def __init__(self, disc):
        self.disc = disc
        self.index = {struct.unpack_from("<II", disc.exe, 0x7EA10 + i * 8): i for i in range(6025)}

    def __getitem__(self, key):
        return self.disc.resource(self.index[(key.start, key.stop - key.start)])


class Inputs:
    """Supply a disc and capture reports while keeping upstream harnesses intact."""
    def __init__(self, disc, manual, reports, path=""):
        self.disc, self.manual, self.reports, self.path = disc, manual, reports, path

    def __truediv__(self, part):
        return Inputs(self.disc, self.manual, self.reports, self.path + "/" + str(part))

    def read_bytes(self):
        if self.path == "/extracted/SLPM_870.50":
            return self.disc.exe
        if self.path == "/extracted/archive-current.bin":
            return Archive(self.disc)
        raise ValueError("Unexpected native harness input: " + self.path)

    def read_text(self, *args):
        if self.path != "/site/dist/data/encounters.json":
            raise ValueError("Unexpected native harness text input: " + self.path)
        return (self.manual / self.path.lstrip("/")).read_text(*args)

    def write_text(self, content, *args):
        if not self.path.startswith("/research/"):
            raise ValueError("Unexpected native harness output: " + self.path)
        self.reports[self.path] = json.loads(content)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manual", type=Path, required=True)
    parser.add_argument("--bin", type=Path, required=True)
    parser.add_argument("--original-bin", type=Path, required=True)
    parser.add_argument("--python-packages", type=Path, help="Optional directory containing Unicorn")
    args = parser.parse_args()
    if args.python_packages:
        sys.path.insert(0, str(args.python_packages))
    builder = module_from(ROOT / "scripts/build-recruitment-reference.py", "recruitment_builder")
    for name, expected in MANUAL_INPUTS.items():
        text = (args.manual / name).read_text(encoding="utf8")
        builder.require(hashlib.sha256(text.encode("utf8")).hexdigest() == expected,
                        "Manual input changed; use the documented revision: " + name)
    summaries = []
    for label, image, expected_hash in (
        ("retail Japanese", args.original_bin, builder.world.native.RETAIL_SHA256),
        ("English v1.0.73", args.bin, builder.world.V73_HASH),
    ):
        raw = image.read_bytes()
        builder.require(builder.world.digest(raw) == expected_hash, "Unexpected disc: " + label)
        disc, reports = builder.world.Disc(raw), {}
        for name in ("verify_recruitment", "verify_recruitment_eligibility", "verify_sirloin_stacking"):
            harness = module_from(args.manual / "tools" / (name + ".py"), name)
            harness.ROOT = Inputs(disc, args.manual, reports)
            with redirect_stdout(io.StringIO()):
                harness.main()
        decision = reports["/research/recruitment-verification.json"]
        eligibility = reports["/research/recruitment-eligibility.json"]
        stacking = reports["/research/sirloin-stacking-verification.json"]
        builder.require(all(row["passed"] for row in reports.values()), "Native harness failed")
        summaries.append({"disc": label, "sha256": expected_hash,
                          "decisionCases": decision["decisionCases"],
                          **eligibility["tested"],
                          "sirloinHandlerExecutions": stacking["sirloinHandlerExecutions"],
                          "sirloinDecisionCases": stacking["recruitmentDecisionExecutions"]})
    print(json.dumps({"passed": True, "discs": summaries}, indent=2))


if __name__ == "__main__":
    main()
