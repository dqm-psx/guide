"""Check PSX duration and repeated-skill rules in retail and English v1.0.73.

Read-only native inputs. Emits addresses and hashes, not disc assets or paths.
"""
import argparse
import importlib.util
import json
from pathlib import Path

SPEC = importlib.util.spec_from_file_location(
    "learning_audit", Path(__file__).with_name("audit-learning-mechanics.py"))
audit = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(audit)

audit.SPANS = (
    ("status expiration and adjacent cleanup", 5502, 0x8014C760, 0x8014DDB0),
    ("repeated command tracking", 5502, 0x80143EF4, 0x80144060),
    ("repeated command resistance adjustment", 5502, 0x80126FA4, 0x80127148),
    ("repeated command damage adjustment", 5502, 0x80127148, 0x8012726C),
    ("22 status duration limits", 5502, 0x80115964, 0x8011597A),
    ("resistance by repeated-use count", 5502, 0x80114DA4, 0x80114DC4),
)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--original-bin", type=Path, required=True)
    parser.add_argument("--current-bin", type=Path, required=True)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    report = audit.audit([args.original_bin, args.current_bin])
    report["scope"] = ("Byte comparison of native duration and repeated-action routines/tables. "
                       "Not a full battle replay or a handheld code comparison.")
    content = json.dumps(report, indent=2) + "\n"
    if args.output:
        args.output.write_text(content, encoding="utf8")
    else:
        print(content, end="")
