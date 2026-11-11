"""Read-only native gate-32 access audit; outputs metadata, never disc bytes.

This does not establish arbitrary indirect-code unreachability. It enumerates
the native constructor's direct calls, jumps, and embedded address references,
checks the independently verified hub portals, and records the retained
resident 32-choice gate selector separately from ordinary entrances.
"""
import argparse
import importlib.util
import json
import mmap
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("entrances", ROOT / "scripts/build-gate-entrances.py")
entrances = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(entrances)
atlas = entrances.atlas

TARGETS = {
    "preparePortal": 0x8006A784,
    "prepareAlternate": 0x8006A6A4,
    "initializeGate": 0x8003EE38,
    "selectGateCallback": 0x8003F22C,
}


def references(raw, resource):
    result = []
    for name, target in TARGETS.items():
        for kind, word in [("address", target),
                           ("jal", 0x0C000000 | ((target & 0x0FFFFFFF) >> 2)),
                           ("j", 0x08000000 | ((target & 0x0FFFFFFF) >> 2))]:
            needle = struct.pack("<I", word)
            start = 0
            while True:
                at = raw.find(needle, start)
                if at < 0:
                    break
                if kind == "address" or at % 4 == 0:
                    result.append({"target": name, "kind": kind, "resource": resource,
                                   "offset": at, "address": f"{at + atlas.BIAS:08x}" if resource is None else None})
                start = at + 1
    return result


def audit(path):
    with path.open("rb") as handle, mmap.mmap(handle.fileno(), 0, access=mmap.ACCESS_READ) as image:
        digest = atlas.sha(image)
        proof = atlas.read_json(atlas.PROOF)
        atlas.require(digest in {entrances.JAPANESE, atlas.BASELINE, proof["patchedBinSha256"]}, "Unknown disc")
        disc = atlas.Disc(image, digest)
        portals = entrances.generate(disc)
        refs = references(disc.exe, None)
        for rid in range(6025):
            offset, size = struct.unpack_from("<II", disc.exe, 0x7EA10 + 8 * rid)
            raw = atlas.native.extent(image, 23 + offset // 2048, size)
            refs.extend(references(raw, rid))
        definition = list(disc.exe[0x800A8650-atlas.BIAS:0x800A8654-atlas.BIAS])
        thresholds = []
        row = disc.exe[0x800A8A10-atlas.BIAS:0x800A8A20-atlas.BIAS]
        for i in range(0, len(row), 2):
            if not row[i]:
                break
            thresholds.append({"firstFloor": row[i], "context": row[i+1]})
        end = disc.resource(18)
        destination = struct.unpack_from("<HHHBBII", end, 0x80117258-atlas.BASE)
        spans = {}
        for name, start, finish in [
            ("floorThresholdSelector", 0x8003EB44, 0x8003EB8C),
            ("initializeGate", 0x8003EE38, 0x8003EF0C),
            ("alternateEntry", 0x8006A6A4, 0x8006A784),
            ("gateSelectorCallback", 0x8003F22C, 0x8003F264),
            ("retainedGateSelectorScript", 0x800B3AD0, 0x800B3AFA),
        ]:
            spans[name] = {"start": f"{start:08x}", "end": f"{finish:08x}",
                           "sha256": atlas.sha(disc.exe[start-atlas.BIAS:finish-atlas.BIAS])}
        result = {"discSha256": digest, "archiveResourcesScanned": 6025,
                  "gateDefinition": definition, "encounterThresholds": thresholds,
                  "terminalDestination": {"group": destination[0], "entry": destination[1],
                                          "scene": destination[2], "area": destination[3]},
                  "normalPortalGateIds": sorted({r["gateId"] for r in portals["evidence"]}),
                  "constructorReferences": refs, "consumerSpans": spans,
                  "retainedSelector": {"script": "800b3ad0", "choices": 32,
                                       "callback": "8003f22c", "gateFormula": "selection + 1",
                                       "normalGameplayEntryVerified": False}}
        atlas.require(definition == [15, 50, 15, 15], "Hidden world definition changed")
        atlas.require(thresholds == [{"firstFloor": f, "context": c} for f, c in [(1,122),(11,123),(21,124),(31,125)]], "Hidden thresholds changed")
        atlas.require(destination[:4] == (15, 30, 101, 0), "Hidden final map changed")
        disc.resource.cache_clear()
        disc.unpack_asset.cache_clear()
        return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bin", type=Path, action="append", required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    rows = [audit(path) for path in args.bin]
    if len(rows) > 1:
        for row in rows[1:]:
            for field in ["gateDefinition", "encounterThresholds", "terminalDestination", "normalPortalGateIds", "constructorReferences", "consumerSpans"]:
                atlas.require(row[field] == rows[0][field], f"Original and patch differ: {field}")
    output = {"schema": 1, "editions": rows,
              "conclusion": "Gate 32 retains generation data and a 32-choice resident selector, but no ordinary hub portal. No normal gameplay access has been verified.",
              "floorLabelNote": "Native label 31–39F conflicts with final floor 50; context 125 continues from 31 through 49 before the terminal floor.",
              "limits": "Direct native calls/jumps and embedded pointer scan is not a proof against arbitrary indirect or corrupted-state entry."}
    text = json.dumps(output, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.write_text(text, encoding="utf8")
    print(text)


if __name__ == "__main__":
    main()
