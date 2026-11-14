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

ENGLISH_DISCS = {world.V73_HASH: 'English v1.0.73',
                 '04b30048a0dc1c207801041a410925aba0283da6793ba3989b98f46a38543b15': 'English v1.0.74 Enhanced'}

def build(image, original_image, *, expected_disc_hash=world.V73_HASH):
    world.require(expected_disc_hash in ENGLISH_DISCS and world.digest(image) == expected_disc_hash,
                  'Unexpected English disc')
    world.require(world.digest(original_image) == world.native.RETAIL_SHA256, 'Expected verified Japanese retail')
    disc, original = world.Disc(image), world.Disc(original_image)
    spans = []
    for start, end, purpose in [
        (0x80025600, 0x8002667C, 'monster save packing'),
        (0x80026900, 0x800278D0, 'monster save unpacking'),
        (0x800143DC, 0x800147C8, 'equipment restoration'),
        (0x8009A01C, 0x8009A03E, 'special learned-skill selectors'),
        (0x8009A040, 0x8009A040 + 170, 'base forms of inherited skills'),
        (0x800398C0, 0x80039B4C, 'appraised magic key metadata'),
        (0x800A6CAC, 0x800A6DEC, 'magic key prefix weights'),
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
    attributes, personality = (disc.resource(rid) for rid in (3657, 3658))
    world.require(attributes == original.resource(3657) and personality == original.resource(3658),
                  'Hatch stat bonus tables changed')
    hatch = {
        'speciesRanks':list(attributes[:325*32:32]),
        'personalityMatches':[[mate+1 for mate in range(27) if personality[first*27 + mate] == 3]
                              for first in range(27)],
        'baseSkillIds':list(disc.exe[0x8009A040-world.PSX_EXE_BIAS:0x8009A040-world.PSX_EXE_BIAS+170]),
    }
    # Appraised names are reconstructed from the saved seed and the two
    # catalog operands requested by the game (modifier group 22, theme 23).
    fixup_count = world.FIXUP_COUNT if expected_disc_hash == world.V73_HASH else 335
    runtime = disc.resident_memory(world.FIXUP_OFFSET, fixup_count)
    descriptor = 0xA5EFC
    group_table = struct.unpack_from('<I', runtime, descriptor)[0] & world.PHYSICAL
    first = struct.unpack_from('<4H', runtime, group_table + 22 * 2)
    world.require(first == (798,831,927,943), 'Unexpected magic key name groups')
    name_parts = lambda start,count: [world.table_message(runtime, descriptor, i, 0) for i in range(start,start+count)]
    weight_start = 0x800A6CAC - world.PSX_EXE_BIAS
    weights = [list(disc.exe[weight_start+i*32:weight_start+(i+1)*32]) for i in range(10)]
    world.require(all(sum(row)==100 for row in weights), 'Unexpected key name weights')
    keys = {'prefixes':name_parts(first[0],32),'nouns':name_parts(first[1],96),
            'fixed':name_parts(first[2],12),'weights':weights}
    return {'schemaVersion':1,'naturalSkills':natural,'hatch':hatch,'keys':keys,
            'specialSkills':list(disc.exe[0x8009A01C-world.PSX_EXE_BIAS:0x8009A03E-world.PSX_EXE_BIAS]),
            'accessories':accessories,
            'provenance':{'currentDiscSha256':expected_disc_hash,'originalDiscSha256':world.native.RETAIL_SHA256,'codeSpans':spans}}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bin',type=Path,required=True)
    parser.add_argument('--original-bin',type=Path,required=True)
    parser.add_argument('--check',action='store_true')
    args=parser.parse_args()
    image=args.bin.read_bytes()
    data=build(image,args.original_bin.read_bytes(),expected_disc_hash=world.digest(image))
    content='// Native save tables; see docs/save-planner-evidence.md.\nglobalThis.SAVE_REFERENCE = '+json.dumps(data,separators=(',',':'))+';\n'
    output=ROOT/'data/save-reference.js'
    if args.check:world.require(output.read_text('utf8')==content,'Save reference is stale')
    else:output.write_text(content,'utf8')
    print(json.dumps({'accessories':len(data['accessories']),'specialSkills':len(data['specialSkills']),'check':args.check}))


if __name__=='__main__':main()
