"""Execute the retail PSX battle-combination selector with its actual callees.

Requires Unicorn. No game bytes are written and no patch/disc is built.
The complete original BIN and the owned battle overlay are authenticated.
"""
import argparse
import importlib.util
import json
from pathlib import Path
import struct
import sys

ROOT = Path(__file__).resolve().parents[1]
RECIPES = [
    (15, 15, 208), (3, 18, 209), (77, 103, 210), (73, 103, 211),
    (75, 103, 212), (103, 103, 213), (21, 112, 214), (106, 145, 215),
    (42, 98, 216), (29, 61, 217), (124, 160, 218), (117, 121, 219),
    (58, 60, 220), (129, 130, 221), (146, 156, 222), (50, 119, 223),
    (149, 150, 224), (52, 120, 225), (148, 152, 226), (138, 159, 227),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--original-bin', required=True, type=Path)
    parser.add_argument('--english-bin', type=Path, help='Optional released v1.0.74 Enhanced image')
    parser.add_argument('--cobi-rom', type=Path, help='Optional USA GBC ROM; requires --tara-rom')
    parser.add_argument('--tara-rom', type=Path, help='Optional USA GBC ROM; requires --cobi-rom')
    parser.add_argument('--python-deps', type=Path, help='Optional directory containing Unicorn')
    args = parser.parse_args()
    if args.python_deps:
        sys.path.insert(0, str(args.python_deps))
    from unicorn import Uc, UC_ARCH_MIPS, UC_MODE_MIPS32, UC_MODE_LITTLE_ENDIAN
    from unicorn.mips_const import UC_MIPS_REG_A0, UC_MIPS_REG_A1, UC_MIPS_REG_RA, UC_MIPS_REG_SP, UC_MIPS_REG_GP

    spec = importlib.util.spec_from_file_location('world', ROOT / 'scripts/verify-world-guide.py')
    world = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(world)
    gbc = None
    world.require(bool(args.cobi_rom) == bool(args.tara_rom), 'Supply both GBC ROMs for static comparison')
    if args.cobi_rom:
        cobi, tara = args.cobi_rom.read_bytes(), args.tara_rom.read_bytes()
        world.require(world.digest(cobi) == '8e38a7420ef5239c7196aa4fd4b1499e65db2823e875bbf8241bb2199e766d4e',
                      'Expected USA Cobi ROM')
        world.require(world.digest(tara) == 'fc6809c31ff69c889dee80c5f39f4d8069042a2b4d933edd83d1627c32e013cc',
                      'Expected USA Tara ROM')
        table = cobi[0x28c289:0x28c4c3]
        world.require(table == tara[0x28c289:0x28c4c3]
                      and world.digest(table) == '3a1c424237093934cffc3e55763ab485bdf80fd3115c0affad0298c7bac394e6',
                      'GBC combination table changed')
        recipes = {result: tuple(sorted((a, b))) for a, b, result in RECIPES}
        for a, b, c, version, result in struct.iter_unpack('5B', table):
            world.require(tuple(sorted(command for command in (a, b, c) if command != 255)) == recipes.get(result),
                          'GBC component pair differs from PSX')
            world.require(version == (1 if result < 218 else 0), 'GBC recipe version changed')
        world.require(cobi[0x28c243:0x28c245] == bytes.fromhex('fe01')
                      and tara[0x28c243:0x28c245] == bytes.fromhex('fe00'), 'GBC version selector changed')
        world.require([at for at in range(0x28c186, 0x28c289) if cobi[at] != tara[at]] == [0x28c244],
                      'Unexpected GBC scheduler/selector differences')
        gbc = {'scope': 'Static native recipe/selector audit; no GBC execution or effect verification',
               'cobiRomSha256': world.digest(cobi), 'taraRomSha256': world.digest(tara),
               'recipeRows': len(table) // 5, 'matchingPsxPairs': len(recipes),
               'versionFilter': 'Cobi 208–217; Tara 218–227; native battle mode 2 bypasses version check'}
    original = args.original_bin.read_bytes()
    world.require(world.digest(original) == world.native.RETAIL_SHA256, 'Expected Japanese retail BIN')
    disc = world.Disc(original)
    overlay = disc.resource(5502)
    world.require(world.digest(overlay) == 'f735caad8d1422a4b49495aab5affb10f4eee5fae923affda6e5cd1e30d6e224', 'Battle overlay changed')
    comparison = None
    if args.english_bin:
        english = args.english_bin.read_bytes()
        world.require(world.digest(english) == '04b30048a0dc1c207801041a410925aba0283da6793ba3989b98f46a38543b15',
                      'Expected released v1.0.74 Enhanced image')
        english_disc = world.Disc(english)
        english_overlay = english_disc.resource(5502)
        spans = [(0x801150d0, 0x80115170), (0x801256ec, 0x80126830),
                 (0x80126ed4, 0x80126f34), (0x8013ee60, 0x8013f7e0),
                 (0x8013f7e8, 0x8014029c), (0x801420a8, 0x8014b000),
                 (0x80175524, 0x80175664), (0x80179950, 0x80179c29)]
        for lo, hi in spans:
            start, end = lo - 0x80114cb8, hi - 0x80114cb8
            world.require(overlay[start:end] == english_overlay[start:end],
                          f'v74 changed combination evidence at {lo:08X}–{hi:08X}')
        comparison = {'englishBinSha256': world.digest(english),
                      'englishBattleOverlaySha256': world.digest(english_overlay),
                      'unchangedNativeSpans': [[hex(lo), hex(hi)] for lo, hi in spans],
                      'selectorPrologue': 'v74 local-battle Combos gate; executed in the cases below'}
        disc = english_disc
        overlay = english_overlay
    cpu = Uc(UC_ARCH_MIPS, UC_MODE_MIPS32 | UC_MODE_LITTLE_ENDIAN)
    cpu.mem_map(0, 0x200000)

    def write(address, data):
        cpu.mem_write(address & 0x1fffffff, bytes(data))

    def read(address, count=1):
        return bytes(cpu.mem_read(address & 0x1fffffff, count))

    def byte(address, value):
        write(address, [value])

    banks = [(0x80010000, disc.exe[0x800:]), (0x800eb010, disc.resource(5498)), (0x80114cb8, overlay)]

    def attempt(a, b, side, seed, mode=0, motivation=255, mp=999, sealed=False, combos=True):
        for address, data in banks:
            write(address, data)
        write(0x80110110, bytes(0x12e7))
        write(0x800c70a8, struct.pack('<I', seed))
        for slot, command in [(side * 4, a), (side * 4 + 1, b)]:
            status, stats = 0x80110700 + slot * 0x74, 0x801102b0 + slot * 0x88
            byte(status + 0x20, 1)
            byte(status + 0x22, command)
            if sealed:
                write(status + 0x14, struct.pack('<I', 0x1000000))
            byte(stats + 0x2d, motivation)
            byte(stats + 0x85, 1)
            write(stats + 10, struct.pack('<H', mp))
        byte(0x80110b80 + side, 255)
        byte(0x80110b84 + side, 255)
        byte(0x80110b16, 255)
        byte(0x80110ac6, mode)
        byte(0x801106fb, 2 if combos else 0)
        for register, value in [(UC_MIPS_REG_A0, side * 4), (UC_MIPS_REG_A1, side),
                                (UC_MIPS_REG_RA, 0x80001000), (UC_MIPS_REG_SP, 0x801ff000),
                                (UC_MIPS_REG_GP, 0x800c7050)]:
            cpu.reg_write(register, value)
        cpu.emu_start(0x8013f7e0, 0x80001000, count=100000)
        if read(0x80110b80 + side) == b'\xff':
            return None
        first = read(0x80110722 + side * 4 * 0x74)[0]
        second = read(0x80110722 + (side * 4 + 1) * 0x74)[0]
        world.require(first == second, 'Paired commands disagree')
        return first

    successes, blocked = 0, 0
    for a, b, result in RECIPES:
        for side in (0, 1):
            for first, second in [(a, b), (b, a)]:
                found = next((seed for seed in range(1, 1025) if attempt(first, second, side, seed) == result), None)
                world.require(found is not None, f'Recipe {result} did not form')
                successes += 1
                world.require(attempt(first, second, side, found, motivation=0) is None, 'Zero motivation formed a pair')
                blocked += 1
                if comparison:
                    world.require(attempt(first, second, side, found, mode=4, combos=False) is None,
                                  'v74 local battle formed a pair with Combos Off')
                    blocked += 1
                    world.require(attempt(first, second, side, found, combos=False) == result,
                                  'v74 local Combos setting changed ordinary adventure')
                    successes += 1
                if result == 220:
                    world.require(attempt(first, second, side, found, mode=4) is None, 'Combined transformation formed in local battle')
                    blocked += 1
                else:
                    world.require(attempt(first, second, side, found, mode=4) == result, 'Local mode changed ordinary pairing')
                    successes += 1
    for kwargs in [{'mp': 0}, {'sealed': True}]:
        world.require(all(attempt(15, 15, 0, seed, **kwargs) is None for seed in range(1, 65)), 'Blocked spell combination formed')
        blocked += 64
    compatibility = overlay[0x80179950 - 0x80114cb8:0x80179950 - 0x80114cb8 + 27 * 27]
    world.require(set(compatibility) == set(range(1, 10)), 'Unexpected compatibility bands')
    print(json.dumps({'originalBinSha256': world.digest(original), 'battleOverlaySha256': world.digest(overlay),
                      'recipes': len(RECIPES), 'successfulCases': successes, 'blockedCases': blocked,
                      'nativeRngAndCallees': True, 'compatibilityBands': sorted(set(compatibility)),
                      'releaseComparison': comparison,
                      'gameBoyComparison': gbc,
                      'scope': 'Isolated native pair selection, not complete battles or effect resolution'}, indent=2))


if __name__ == '__main__':
    main()
