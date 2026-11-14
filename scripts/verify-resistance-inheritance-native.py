"""Check retail/v74 resistance inheritance bytes and execute the native loop.

Requires caller-supplied disc images and Unicorn. Does not build a patch or
write disc/game state. The JSON result is suitable for the evidence document.
"""
import argparse
import importlib.util
from itertools import product
import json
from pathlib import Path
import struct
import sys

ROOT = Path(__file__).resolve().parents[1]
V74 = "04b30048a0dc1c207801041a410925aba0283da6793ba3989b98f46a38543b15"
DIVISORS = [60, 75, 90, 105, 120, 150, 180]
# One named action per channel in the guide, in native resistance array order.
CHANNEL_SKILL_IDS = [1, 4, 7, 10, 13, 16, 46, 47, 19, 50, 51, 52, 39, 43, 21,
                     61, 64, 69, 95, 96, 117, 122, 146, 147, 75, 103, 76]


def expected(base, parent_a, parent_b, plus):
    return 7 if base == 7 else min(6, base + (10*(parent_a+parent_b)+3*plus)//DIVISORS[base])


def verify_child_plus(cpu, reg, parents, child):
    for register, address in zip((reg.UC_MIPS_REG_S3, reg.UC_MIPS_REG_S4, reg.UC_MIPS_REG_FP),
                                 (*parents, child)):
        cpu.reg_write(register, address | 0x80000000)
    level_pairs = [(10, 10), (19, 20), (20, 20), (20, 39), (30, 30),
                   (39, 40), (40, 40), (49, 50), (50, 50), (99, 99)]
    plus_pairs = [(0, 0), (5, 4), (97, 98), (99, 99)]
    # Parent (maxHP, maxMP) include sums on either side of the quarter-stat rounding boundary.
    stat_pairs = [((1, 0), (1, 0)), ((6, 7), (5, 4)), ((6, 7), (5, 5)),
                  ((7, 6), (5, 5)), ((999, 999), (999, 999))]
    cases = 0
    for levels, pluses, same_family, stats in product(level_pairs, plus_pairs, (False, True), stat_pairs):
        families = (0, 0 if same_family else 1)
        for parent, family, level, plus, (hp, mp) in zip(parents, families, levels, pluses, stats):
            cpu.mem_write(parent + 0x0D, bytes([family, plus]))
            cpu.mem_write(parent + 0x9A, bytes([level]))
            cpu.mem_write(parent + 0xB4, struct.pack('<HH', hp, mp))
        child_hp, child_mp = (max(1, sum(values)//4) for values in zip(*stats))
        flags = [all(level % 10 == 0 for level in levels), same_family,
                 child_mp > child_hp, sum(pluses) % 2 == 0]
        wanted = min(99, max(pluses) + min(5, sum(levels)//20) + sum(flags)//2)
        for stat_bonus in range(5):
            cpu.emu_start(0x80049594, 0x800495F4, count=100)
            # The same 100–120% multiplier is applied to all six stats.
            cpu.reg_write(reg.UC_MIPS_REG_S1, stat_bonus)
            cpu.mem_write(child + 0x0E, b'\xff')
            cpu.emu_start(0x80049810, 0x80049BD0, count=500)
            actual = cpu.mem_read(child + 0x0E, 1)[0]
            if actual != wanted:
                raise ValueError(f'Native offspring + {actual} != {wanted} for levels {levels}, '
                                 f'+ {pluses}, families {families}, base stats {stats}, stat bonus {stat_bonus}')
            cases += 1
    return cases


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
        battle = disc.resource(5502)
        action_table = 0x80174824 - 0x80114CB8
        for channel, skill_id in enumerate(CHANNEL_SKILL_IDS, start=1):
            world.require(battle[action_table + 16*skill_id + 1] == channel,
                          f'Action {skill_id} no longer uses resistance channel {channel}')
        # Gigante uses the Sacrifice / Body Slam channel and has a nonzero
        # near-death threshold at grade 7, unlike ordinary spell damage.
        chance_table = 0x80175680 - 0x80114CB8
        world.require(battle[action_table + 16*214 + 1] == 15 and battle[chance_table + 5*8 + 7] == 30,
                      'Gigante resistance channel or grade-7 status threshold changed')
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
        plus_cases = verify_child_plus(cpu, reg, (parent_a, parent_b), child)
        reports.append({'disc':label, 'cases':cases, 'channelsPerCase':27,
                        'childPlusCases':plus_cases, 'channelActionIds':CHANNEL_SKILL_IDS})
    print(json.dumps({'passed':True, 'originalDiscSha256':world.native.RETAIL_SHA256,
        'currentDiscSha256':V74, 'matchingSpans':spans, 'speciesAttributesSha256':world.digest(species),
        'coefficientHex':coefficients.hex(), 'divisors':DIVISORS, 'damagePercentScales':scales,
        'nativeRuns':reports,
        'scope':'Offspring resistance loop, child + boundaries and action descriptor channel identities.'}, indent=2))


if __name__ == '__main__':
    main()
