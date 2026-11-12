"""Execute pinned manual combat harnesses on both authenticated PSX discs.

Upstream harness files and research reports are never modified. Only the RNG
is substituted by the original harnesses; real action handlers run in CPU RAM.
"""
import argparse
from contextlib import redirect_stdout
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
MANUAL_INPUTS={
    "tools/verify_combat.py":"e291b3671747ed0f373cabffe07179403d0e18fa8ead0b8824b817837dd25997",
    "tools/verify_combat_planner.py":"f39893482c8c189695d616c4941fdebb598993c99f2858598517edff28d89b55",
    "site/dist/data/catalog.json":"41754ef5bb71d62a0552f4ed406a92cbcf2f8f6dc474317d9f568a501a5de20f",
    "research/game-data.json":"8b5b0eeca938788521e0758c944e97d70f309927ed192d4e0041ce628f927368",
}


def module_from(path,name):
    spec=importlib.util.spec_from_file_location(name,path)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


adapter=module_from(ROOT/"scripts/verify-recruitment-native.py","recruitment_native_adapter")


class Inputs(adapter.Inputs):
    def __truediv__(self,part):
        return Inputs(self.disc,self.manual,self.reports,self.path+"/"+str(part))

    def read_text(self,*args):
        if self.path not in ("/site/dist/data/catalog.json","/research/game-data.json"):
            raise ValueError("Unexpected native harness input: "+self.path)
        return (self.manual/self.path.lstrip("/")).read_text(*args)

    def write_text(self,content,*args):
        if self.path not in ("/research/combat-verification.json","/research/combat-planner-verification.json","/site/dist/data/combat-planner.json"):
            raise ValueError("Unexpected native harness output: "+self.path)
        self.reports[self.path]=json.loads(content)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manual",type=Path,required=True)
    parser.add_argument("--bin",type=Path,required=True)
    parser.add_argument("--original-bin",type=Path,required=True)
    parser.add_argument("--python-packages",type=Path)
    args=parser.parse_args()
    if args.python_packages:
        sys.path.insert(0,str(args.python_packages))
    builder=module_from(ROOT/"scripts/build-combat-reference.py","combat_builder")
    for name,expected in MANUAL_INPUTS.items():
        actual=hashlib.sha256((args.manual/name).read_text(encoding="utf8").encode()).hexdigest()
        builder.require(actual==expected,"Manual harness input changed: "+name)
    summaries=[]
    for label,path,expected in (("retail Japanese",args.original_bin,builder.world.native.RETAIL_SHA256),
                                ("English v1.0.73",args.bin,builder.world.V73_HASH)):
        raw=path.read_bytes()
        builder.require(builder.world.digest(raw)==expected,"Unexpected disc: "+label)
        disc,reports=builder.world.Disc(raw),{}
        for name in ("verify_combat","verify_combat_planner"):
            harness=module_from(args.manual/"tools"/(name+".py"),name)
            harness.ROOT=Inputs(disc,args.manual,reports)
            with redirect_stdout(io.StringIO()):
                harness.main()
        base=reports["/research/combat-verification.json"]
        planner=reports["/research/combat-planner-verification.json"]
        builder.require(base["passed"] and planner["verification"]["passed"],"Native combat check failed")
        summaries.append({"disc":label,"sha256":expected,"base":base,"planner":planner["verification"]})
    print(json.dumps({"passed":True,"discs":summaries},indent=2))


if __name__=="__main__":
    main()
