"""Check retail/v74 resistance inheritance bytes and execute the native loop.

Requires caller-supplied disc images and Unicorn. Does not build a patch or
write disc/game state. The JSON result is suitable for the evidence document.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import struct
import sys

ROOT = Path(__file__).resolve().parents[1]
V74 = "04b30048a0dc1c207801041a410925aba0283da6793ba3989b98f46a38543b15"
DIVISORS = [60, 75, 90, 105, 120, 150, 180]


def expected(base, parent_a, parent_b, plus):
    return 7 if base == 7 else min(6, base + (10*(parent_a+parent_b)+3*plus)//DIVISORS[base])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--original-bin', type=Path, required=True)
    parser.add_argument('--bin', type=Path, required=True, help='Published v1.0.74 Enhanced BIN')
    parser.add_argument('--python-packages', type=Path)
    args = parser.parse_args()
    if args.python_packages:
        sys.path.insert(0, str(args.python_packages))
    from unicorn import Uc, UC_ARCH_MIPS, UC_MODE_MIPS32, UC_MODE_LITTLE_ENDIAN
    from unicorn import mips_const as reg
    spec = importlib.util.spec_from_file_location('world', ROOT/'scripts/verify-world-guide.py')
    world = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(world)
    original_raw, current_raw = args.original_bin.read_bytes(), args.bin.read_bytes()
    world.require(world.digest(original_raw) == world.native.RETAIL_SHA256, 'Unexpected retail disc')
    world.require(world.digest(current_raw) == V74, 'Unexpected v1.0.74 Enhanced disc')
    original, current = world.Disc(original_raw), world.Disc(current_raw)
    bias = world.PSX_EXE_BIAS
    spans = []
    for start, end, purpose in [
        (0x80049094, 0x8004A328, 'offspring constructor'),
        (0x80049C90, 0x80049D7C, '27-channel resistance inheritance'),
        (0x80010A14, 0x80010A24, 'resistance coefficients'),
    ]:
        a, b = original.exe[start-bias:end-bias], current.exe[start-bias:end-bias]
        world.require(a == b and len(a) == end-start, 'Native bytes changed: '+purpose)
        spans.append({'start':hex(start), 'end':hex(end), 'purpose':purpose, 'sha256':world.digest(a)})
    species = original.resource(3657)
    world.require(species == current.resource(3657), 'Shared species resistance table changed')
    scales = {}
    for name, start, values in [('spell',0x801756D8,[100,85,75,65,50,30,15,0]),
                               ('breath',0x801756E0,[100,80,70,60,40,30,10,0])]:
        offset = start-0x80114CB8
        a, b = original.resource(5502)[offset:offset+8], current.resource(5502)[offset:offset+8]
        world.require(a == b and list(a) == values, 'Damage scale changed: '+name)
        scales[name] = list(a)
    coefficients = original.exe[0x80010A14-bias:0x80010A24-bias]
    world.require(coefficients.hex() == '02010502030107020401050106010701', 'Coefficient table changed')
    reports = []
    for label, disc in [('retail Japanese', original), ('English v1.0.74 Enhanced', current)]:
        cpu = Uc(UC_ARCH_MIPS, UC_MODE_MIPS32 | UC_MODE_LITTLE_ENDIAN)
        cpu.mem_map(0, 0x200000)
        cpu.mem_write(0x10000, disc.exe[0x800:])
        parent_a, parent_b, child, base_table = 0x180000, 0x180100, 0x180200, 0x181000
        gp, sp = 0x190000, 0x1FF000
        cpu.mem_write(sp+0xB0, coefficients)
        cpu.mem_write(gp+0x784, struct.pack('<I', base_table | 0x80000000))

        def check(bases, first, second, plus):
            cpu.mem_write(base_table+4, bytes(bases))
            cpu.mem_write(parent_a+0xC0, bytes(first))
            cpu.mem_write(parent_b+0xC0, bytes(second))
            cpu.mem_write(child+0x0E, bytes([plus]))
            cpu.mem_write(child+0xC0, b'\xff'*27)
            for name, value in {'S3':parent_a, 'S4':parent_b, 'FP':child, 'GP':gp, 'SP':sp}.items():
                cpu.reg_write(getattr(reg, 'UC_MIPS_REG_'+name), value | 0x80000000)
            cpu.reg_write(reg.UC_MIPS_REG_S2, 0)
            cpu.reg_write(reg.UC_MIPS_REG_T1, 0)
            cpu.emu_start(0x80049C90, 0x80049D7C, count=5000)
            world.require(cpu.reg_read(reg.UC_MIPS_REG_PC) == 0x80049D7C, 'Native resistance loop did not finish')
            output = bytes(cpu.mem_read(child+0xC0, 27))
            want = bytes(expected(b, a, c, plus) for b,a,c in zip(bases,first,second))
            world.require(output == want, 'Native resistance result differs from documented formula')

        cases = 0
        for base in range(8):
            for first in range(8):
                for second in range(8):
                    for plus in range(100):
                        check([base]*27, [first]*27, [second]*27, plus)
                        cases += 1
        # Different values in adjacent channels catch offset/stride mistakes.
        for plus in (0, 1, 20, 50, 73, 74, 99):
            check([i%8 for i in range(27)], [(i+2)%8 for i in range(27)], [(i+5)%8 for i in range(27)], plus)
            cases += 1
        reports.append({'disc':label, 'cases':cases, 'channelsPerCase':27})
    print(json.dumps({'passed':True, 'originalDiscSha256':world.native.RETAIL_SHA256,
        'currentDiscSha256':V74, 'matchingSpans':spans, 'speciesAttributesSha256':world.digest(species),
        'coefficientHex':coefficients.hex(), 'divisors':DIVISORS, 'damagePercentScales':scales,
        'nativeRuns':reports,
        'scope':'Exact resistance instruction loop, every base/parent grade and child plus 0-99; no complete game or disc build.'}, indent=2))


if __name__ == '__main__':
    main()
