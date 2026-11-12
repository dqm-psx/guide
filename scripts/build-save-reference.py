"""Build the compact native tables used by the read-only save importer."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import struct

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('world', ROOT / 'scripts/verify-world-guide.py')
world = importlib.util.module_from_spec(spec)
spec.loader.exec_module(world)


def build(image, original_image):
    world.require(world.digest(image) == world.V73_HASH, 'Expected verified English v1.0.73')
    world.require(world.digest(original_image) == world.native.RETAIL_SHA256, 'Expected verified Japanese retail')
    disc, original = world.Disc(image), world.Disc(original_image)
    spans = []
    for start, end, purpose in [
        (0x80025600, 0x8002667C, 'monster save packing'),
        (0x80026900, 0x800278D0, 'monster save unpacking'),
        (0x800143DC, 0x800147C8, 'equipment restoration'),
        (0x8009A01C, 0x8009A03E, 'special learned-skill selectors'),
        (0x800AD020 + 64*24, 0x800AD020 + 95*24, 'saved accessory records'),
    ]:
        a = disc.exe[start-world.PSX_EXE_BIAS:end-world.PSX_EXE_BIAS]
        b = original.exe[start-world.PSX_EXE_BIAS:end-world.PSX_EXE_BIAS]
        world.require(a == b and len(a) == end-start, 'Native save data changed: '+purpose)
        spans.append({'start':hex(start),'end':hex(end),'sha256':hashlib.sha256(a).hexdigest(),'purpose':purpose})
    natural = {}
    for campaign, resource in [('terry',3655), ('dqm2',3656)]:
        raw = disc.resource(resource)
        world.require(raw == original.resource(resource), 'Natural skill table changed')
        natural[campaign] = [list(raw[i:i+3]) for i in range(0,325*3,3)]
        world.require(all(len(row)==3 for row in natural[campaign]), 'Natural table too short')
    accessories = []
    for item in range(64,95):
        row = disc.exe[0x800AD020-world.PSX_EXE_BIAS+item*24:0x800AD020-world.PSX_EXE_BIAS+(item+1)*24]
        accessories.append({'itemId':item,'offset':row[2],'minimum':struct.unpack_from('<h',row,4)[0], 'maximum':struct.unpack_from('<h',row,6)[0]})
    return {'schemaVersion':1,'naturalSkills':natural,
            'specialSkills':list(disc.exe[0x8009A01C-world.PSX_EXE_BIAS:0x8009A03E-world.PSX_EXE_BIAS]),
            'accessories':accessories,
            'provenance':{'currentDiscSha256':world.V73_HASH,'originalDiscSha256':world.native.RETAIL_SHA256,'codeSpans':spans}}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bin',type=Path,required=True)
    parser.add_argument('--original-bin',type=Path,required=True)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    data=build(args.bin.read_bytes(),args.original_bin.read_bytes())
    content='// Native save tables; see docs/save-planner-evidence.md.\nglobalThis.SAVE_REFERENCE = '+json.dumps(data,separators=(',',':'))+';\n'
    output=ROOT/'data/save-reference.js'
    if args.check:world.require(output.read_text('utf8')==content,'Save reference is stale')
    else:output.write_text(content,'utf8')
    print(json.dumps({'accessories':len(data['accessories']),'specialSkills':len(data['specialSkills']),'check':args.check}))


if __name__=='__main__':main()
