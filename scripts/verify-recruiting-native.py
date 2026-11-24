"""Focused original-BIN evidence; no patched binaries or emulator save files.

Runs native item-menu preparation and the four item bytecode callbacks using
Unicorn. The success/consumption script branch is verified byte for byte before
following it. Rendering/animation portions of the script are not executed.
Also checks menu target eligibility, group recovery, item break branches and
every ordinary wandering-master strength-tier candidate pool.
"""
import argparse
import collections
import hashlib
import json
from pathlib import Path
import struct
import sys

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--bin', type=Path, required=True, help='Original Japanese raw BIN')
parser.add_argument('--python-packages', type=Path, help='Optional directory containing Unicorn')
parser.add_argument('--output', type=Path, default=Path(__file__).with_name('results.json'))
args = parser.parse_args()
if args.python_packages:
    sys.path.insert(0, str(args.python_packages))
from unicorn import Uc, UC_ARCH_MIPS, UC_MODE_MIPS32, UC_MODE_LITTLE_ENDIAN
from unicorn.mips_const import (UC_MIPS_REG_GP, UC_MIPS_REG_SP, UC_MIPS_REG_RA,
                               UC_MIPS_REG_PC, UC_MIPS_REG_A0, UC_MIPS_REG_A1)

OUTPUT = args.output
source = args.bin.read_bytes()
SOURCE_SHA256 = 'a1217657786430ac1c3ad71f16cdadb65d47b0df9a7e30278900651c1f1eec29'
assert hashlib.sha256(source).hexdigest() == SOURCE_SHA256


def extract(lba, size):
    assert (lba + (size + 2047) // 2048) * 2352 <= len(source)
    return b''.join(source[sector * 2352 + 24:sector * 2352 + 2072]
                    for sector in range(lba, lba + (size + 2047) // 2048))[:size]


exe = extract(93985, 899072)
entries = [struct.unpack_from('<II', exe, 0x7ea10 + index * 8) for index in range(6025)]


def resource(number):
    offset, size = entries[number]
    assert offset % 2048 == 0
    return extract(23 + offset // 2048, size)


primary = resource(5498)
actions = resource(5502)
results = resource(104)


def exe_read(address, size=4):
    at = address - 0x80010000 + 0x800
    return int.from_bytes(exe[at:at + size], 'little')


def image_read(image, address, base=0x80114cb8, size=4):
    return int.from_bytes(image[address - base:address - base + size], 'little')


# EBE51 checks the application-success flag. At EBE65, consume modes0/1/2
# branch to EBE76 (retain), EBE71 (consume), or EBE6B (break message then
# consume). EBE71 calls the native consumption routine. Failure skips all three.
SCRIPT_START, SCRIPT_END = 0x800ebe51, 0x800ebe76
SCRIPT_BYTES = bytes.fromhex(
    '60 00 dd 0b 11 80 06 00 1d 00 02 00 '
    '60 00 6b 01 11 80 06 00 11 00 0a 00 02 00 '
    '70 00 35 08 a0 18 04 a0 d6 14 80'
)
assert primary[SCRIPT_START - 0x800eb010:SCRIPT_END - 0x800eb010] == SCRIPT_BYTES
CONSUMPTION_TARGETS = [0x800ebe65 + index * 2 + struct.unpack_from('<h', SCRIPT_BYTES, 20 + index * 2)[0]
                       for index in range(3)]
assert CONSUMPTION_TARGETS == [0x800ebe76, 0x800ebe71, 0x800ebe6b]

# These immediate arguments reach the same native recovery routine28748.
# Guard the endpoints, rather than inferring them from a few random samples.
roll_guards = []
for item, low_at, high_at, low, high in (
    (1, 0x80127788, 0x80127794, 30, 40),
    (2, 0x80127848, 0x80127854, 60, 70),
    (4, 0x801279dc, 0x801279e8, 20, 30),
):
    assert image_read(actions, low_at) == 0x24040000 | low
    assert image_read(actions, high_at) == 0x24050000 | high
    roll_guards.append({'item': item, 'low_argument': hex(low_at),
                        'high_argument': hex(high_at), 'recovery_range': [low, high]})


class Native:
    def __init__(self, item_ids, enemy=True, mode=3, hp=100, max_hp=500,
                 mp=20, max_mp=100, score=10):
        self.cpu = Uc(UC_ARCH_MIPS, UC_MODE_MIPS32 | UC_MODE_LITTLE_ENDIAN)
        self.cpu.mem_map(0, 0x200000)
        self.write(0x80010000, exe[0x800:])
        self.write(0x800eb010, primary)
        self.write(0x80114cb8, actions)
        self.write(0x80110110, bytes(0x1300))
        self.target = int(enemy) * 4
        stats = 0x801102b0 + self.target * 0x88
        for address, value, size in (
            (0x800c70a8, 12345, 4),
            (0x800eb01e, 0, 1),
            (0x800c79a2, len(item_ids), 1),
            (0x80110152, len(item_ids), 1),
            (0x80110bd3, int(enemy), 1),
            (0x80110ac6, mode, 1),
            (0x80110aa8, score, 2),
            (0x80110700 + int(enemy) * 4 * 0x74 + 0x20, 1, 1),
            (stats + 4, hp, 2), (stats + 6, max_hp, 2),
            (stats + 10, mp, 2), (stats + 12, max_mp, 2),
            (0x80110162, int(not enemy), 1),
        ):
            self.put(address, value, size)
        self.write(0x800c7984, bytes(item_ids))
        self.write(0x80110ac8, bytes(range(8)))  # menu target list, party then enemy

    def write(self, address, data):
        self.cpu.mem_write(address & 0x1fffffff, bytes(data))

    def put(self, address, value, size=4):
        self.write(address, (value & ((1 << (size * 8)) - 1)).to_bytes(size, 'little'))

    def read(self, address, size=4):
        return int.from_bytes(self.cpu.mem_read(address & 0x1fffffff, size), 'little')

    def call(self, pc):
        for register, value in (
            (UC_MIPS_REG_GP, 0x800c7050),
            (UC_MIPS_REG_SP, 0x801ff000),
            (UC_MIPS_REG_RA, 0x80001000),
        ):
            self.cpu.reg_write(register, value)
        self.cpu.emu_start(pc, 0x80001000, count=100000)
        assert self.cpu.reg_read(UC_MIPS_REG_PC) == 0x80001000

    def validate_target(self, enemy=True):
        self.put(0x800ce1d0, int(enemy), 1)
        self.call(0x8014c278)
        return {'menu_result': self.read(0x800ce1d0, 1),
                'target_side': self.read(0x80110bd3, 1),
                'target_selector': self.read(0x80110162, 1),
                'target_span': self.read(0x8011016a, 1)}

    def consume_if_successful(self):
        mode = self.read(0x8011016b, 1)
        assert mode in (0, 1, 2)
        # The script's mode2 path displays a break message before this same
        # callback. We do not execute that presentation-only subroutine.
        consumed = self.read(0x80110bdd, 1) != 0 and mode in (1, 2)
        if consumed:
            self.call(0x8014d6a0)
        return consumed

    def item(self, group_target=True):
        before = self.read(0x80110aa8, 2)
        self.put(0x800ce1d0, 4 if group_target else 0, 1)
        self.call(0x8014bfa0)  # real menu callback selects item and consumption
        item = self.read(0x80110c0b, 1)
        consume_mode = self.read(0x8011016b, 1)
        self.call(0x8014cdb8)  # classify
        self.call(0x8014ce60)  # prepare
        prepare_message = self.read(0x800ce1d1, 1)
        assert prepare_message in (0, 1), (item, prepare_message)
        self.call(0x8014d280)  # apply
        applied = self.read(0x80110aa8, 2)
        success = self.read(0x80110bdd, 1)
        assert consume_mode == 1
        consumed = self.consume_if_successful()
        return {
            'item': item, 'score_before': before, 'score_after_apply': applied,
            'application_success': success, 'consume_mode': consume_mode,
            'prepare_message': prepare_message,
            'consumed': consumed,
            'score_after_consumption': self.read(0x80110aa8, 2),
            'remaining_bag_count': self.read(0x800c79a2, 1),
            'orb_flag': self.read(0x80110ac7, 1),
            'rolled_amount': self.read(0x8011017c, 2),
            'hp_after': self.read(0x801102b4 + self.target * 0x88, 2),
            'mp_after': self.read(0x801102ba + self.target * 0x88, 2),
        }

    def group_item(self, missing_hp, seed=12345):
        assert 1 <= len(missing_hp) <= 3
        self.put(0x800c70a8, seed)
        for index, missing in enumerate(missing_hp):
            target = 4 + index
            self.put(0x80110700 + target * 0x74 + 0x20, 1, 1)
            self.put(0x801102b4 + target * 0x88, 500 - missing, 2)
            self.put(0x801102b6 + target * 0x88, 500, 2)
        menu = self.validate_target()
        assert menu['menu_result'] == 4 and menu['target_span'] == 4
        self.call(0x8014bfa0)
        item, consume_mode = self.read(0x80110c0b, 1), self.read(0x8011016b, 1)
        self.call(0x8014cdb8)
        self.call(0x8014ce60)
        before = self.read(0x80110aa8, 2)
        targets = []
        # Group target spans visit four slots; only three enemy slots can be
        # present. Slot7 remains absent and must contribute no recovery bonus.
        for target in range(4, 8):
            previous = self.read(0x80110aa8, 2)
            self.put(0x80110bdb, target, 1)
            self.call(0x8014d280)
            bonus = self.read(0x80110aa8, 2) - previous
            if target < 4 + len(missing_hp):
                amount = 0 if missing_hp[target - 4] == 0 else self.read(0x8011017c, 2)
                assert bonus == amount // 2
                assert self.read(0x801102b4 + target * 0x88, 2) == min(500, 500 - missing_hp[target - 4] + amount)
                targets.append({'slot': target, 'missing_hp': missing_hp[target - 4],
                                'recovery_roll': amount, 'appeal_added': bonus})
            else:
                assert bonus == 0
        applied = self.read(0x80110aa8, 2)
        consumed = self.consume_if_successful()
        assert self.read(0x80110aa8, 2) == applied + (5 if consumed else 0)
        return {'item': item, 'seed': seed, 'menu': menu, 'consume_mode': consume_mode,
                'targets': targets, 'score_before': before, 'score_after_apply': applied,
                'score_after_consumption': self.read(0x80110aa8, 2), 'consumed': consumed,
                'remaining_bag_count': self.read(0x800c79a2, 1)}


item_cases = []
for item, expected in ((25, 25), (26, 45), (27, 115), (28, 415), (30, 4110)):
    result = Native([item]).item()
    assert result['score_after_consumption'] == expected
    assert result['remaining_bag_count'] == 0
    assert result['orb_flag'] == int(item == 30)
    item_cases.append(result)
double = Native([28, 28])
double_results = [double.item(), double.item()]
assert [r['score_after_consumption'] for r in double_results] == [415, 820]
assert [r['remaining_bag_count'] for r in double_results] == [1, 0]
ally_results = []
for item in range(25, 29):
    result = Native([item], enemy=False).item()
    assert result['score_after_apply'] == 10
    assert result['score_after_consumption'] == 15
    assert result['remaining_bag_count'] == 0
    ally_results.append(result)

healing_results = []
for name, item, enemy, hp, max_hp, mp, max_mp, score in (
    ('injured enemy Herb', 1, True, 100, 500, 20, 100, 10),
    ('enemy one HP missing Herb', 1, True, 499, 500, 20, 100, 10),
    ('enemy full HP Herb fails without consumption', 1, True, 500, 500, 20, 100, 10),
    ('injured ally Herb', 1, False, 100, 500, 20, 100, 100),
    ('injured enemy Amor Water', 2, True, 100, 500, 20, 100, 10),
    ('injured enemy full-healing item', 3, True, 100, 500, 20, 100, 10),
    ('enemy partial MP recovery', 4, True, 100, 500, 20, 100, 10),
    ('enemy full MP recovery', 5, True, 100, 500, 20, 100, 10),
):
    machine = Native([item], enemy=enemy, mode=1, hp=hp, max_hp=max_hp,
                     mp=mp, max_mp=max_mp, score=score)
    result = machine.item(group_target=False)
    amount = result['rolled_amount']
    failed = item == 1 and hp == max_hp
    assert result['application_success'] == int(not failed)
    assert result['remaining_bag_count'] == int(failed)
    expected_effect = 0 if failed else amount // 2 * (1 if enemy else -1)
    expected_after_apply = max(0, score + expected_effect)
    assert result['score_after_apply'] == expected_after_apply
    assert result['score_after_consumption'] == expected_after_apply + (0 if failed else 5)
    expected_hp = hp if failed or item in (4, 5) else min(max_hp, hp + amount)
    expected_mp = min(max_mp, mp + amount) if item in (4, 5) else mp
    assert result['hp_after'] == expected_hp
    assert result['mp_after'] == expected_mp
    healing_results.append({'case': name, **result})

target_menu_results = []
for item in (1, 2, 3, 4, 5, 11, 30):
    result = Native([item], mode=1).validate_target()
    assert result['target_side'] == 1
    group = item in (3, 11, 30)
    assert result['menu_result'] == (4 if group else 1)
    assert result['target_span'] == (4 if group else 1)
    target_menu_results.append({'item': item, **result})

group_healing_results = [
    Native([3], mode=1).group_item([3, 3, 0]),
    Native([3], mode=1).group_item([0, 0, 0]),
    Native([11], mode=1).group_item([400, 400, 400], seed=0),
    Native([11], mode=1).group_item([400, 400, 400], seed=1),
]
dew, full, broken, retained = group_healing_results
assert dew['score_after_apply'] == 12 and dew['score_after_consumption'] == 17
assert dew['remaining_bag_count'] == 0
assert full['score_after_consumption'] == 10 and full['remaining_bag_count'] == 1
assert broken['consume_mode'] == 2 and broken['score_after_consumption'] == 116
assert broken['remaining_bag_count'] == 0
assert retained['consume_mode'] == 0 and retained['score_after_consumption'] == 104
assert retained['remaining_bag_count'] == 1
assert image_read(actions, 0x80115900 + 11, size=1) == 20

orb_boss = Native([30], mode=1)
assert orb_boss.validate_target()['menu_result'] == 4
orb_boss_result = orb_boss.item()
assert orb_boss_result['prepare_message'] == 0
assert orb_boss_result['score_after_consumption'] == 4110 and orb_boss_result['orb_flag'] == 1

# Isolate the actual Heal command evaluation and its result commit. This does
# not claim that every target can be selected through the player's spell menu.
spell_results = []
for enemy in (False, True):
    machine = Native([], enemy=enemy, mode=1)
    command = 0x16
    at = 0x80174824 - 0x80114cb8 + command * 16
    machine.write(0x80110298, actions[at:at + 16])
    machine.put(0x80110b09, 0, 1)
    machine.put(0x80110b0a, machine.target, 1)
    machine.put(0x80110b0c, command, 1)
    machine.cpu.reg_write(UC_MIPS_REG_A0, 0)
    machine.cpu.reg_write(UC_MIPS_REG_A1, 0)
    machine.call(0x80127400)
    amount = machine.read(0x8011017c, 2)
    assert machine.read(0x8011011b, 1) == 2 and amount > 0
    assert machine.read(0x80110aa8, 2) == 10
    machine.call(0x80147488)
    assert machine.read(0x801102b4 + machine.target * 0x88, 2) == 100 + amount
    assert machine.read(0x80110aa8, 2) == 10
    spell_results.append({'target_side': 'enemy' if enemy else 'ally',
                          'healing_amount': amount, 'score_after': 10})

campaigns = []
all_candidates = []
for campaign, name in enumerate(('Terry', 'Cobi', 'Tara')):
    base = exe_read(0x800c712c + campaign, 1)
    table = exe_read(0x8008e1ac + (17 + campaign) * 4)
    counts = collections.Counter()
    tiers = []
    for tier in range(20):
        number = exe_read(table + (base + tier) * 4)
        data = resource(number)
        records = struct.unpack_from('<I', data, 4)[0]
        count = exe_read(0x800ab4ac + campaign * 20 + tier, 1)
        candidates = []
        for index in range(count):
            rec = data[records + index * 52:records + (index + 1) * 52]
            assert len(rec) == 52
            family, species, kind = rec[:3]
            meta = image_read(results, 0x80124518 + family * 4) + species * 12
            rank = image_read(results, meta, size=1)
            assert kind != 7 and rank != 7
            counts[kind] += 1
            candidate = {'record': index, 'family': family, 'species': species,
                         'recruitment_class': kind, 'species_rank': rank}
            candidates.append(candidate)
            all_candidates.append((campaign, tier, number, candidate))
        tiers.append({'tier': tier, 'resource': number, 'count': count,
                      'resource_sha256': hashlib.sha256(data).hexdigest(),
                      'candidates': candidates})
    campaigns.append({'campaign': name, 'context_base': base,
                      'candidate_appearances': sum(counts.values()),
                      'class_counts': dict(counts), 'tiers': tiers})
assert [(c['candidate_appearances'], c['class_counts']) for c in campaigns] == [
    (236, {5: 110, 3: 2, 6: 124}), (270, {5: 123, 6: 147}), (270, {5: 123, 6: 147})]
exceptions = [{'campaign': campaigns[c]['campaign'], 'tier': t, 'resource': n, **r}
              for c, t, n, r in all_candidates if r['recruitment_class'] == 3]
assert [(r['family'], r['species']) for r in exceptions] == [(8, 30), (8, 30)]

boss_encounters = []
table = exe_read(0x8008e1ac + 17 * 4)
for slot in range(0x80, 0xa0):
    number = exe_read(table + slot * 4)
    data = resource(number)
    groups, records, pictures, animations = struct.unpack_from('<4I', data)
    assert (pictures - records) % 52 == 0
    count = (pictures - records) // 52
    groups_count = (records - groups) // 16
    assert groups_count >= 1 and 0 <= groups <= records <= pictures <= animations <= len(data)
    parsed_records = []
    for index in range(count):
        family, species, kind = data[records + index * 52:records + index * 52 + 3]
        parsed_records.append({'index': index, 'family': family, 'species': species,
                               'class': kind})
    boss_encounters.append({
        'slot': hex(slot), 'resource': number,
        'sha256': hashlib.sha256(data).hexdigest(),
        'groups': [{'index': group, 'record_indices': list(struct.unpack_from('<5h', data, groups + group * 16 + 6))}
                   for group in range(groups_count)],
        'records': parsed_records,
    })
expected_boss_classes = (
    (0,), (0,), (0,), (0,), (4, 0), (0,), (0,), (7,),
    (6,), (7,), (7,), (0,), (0,), (4, 0), (0,), (7,),
    (7, 5, 7), (5, 5, 5), (5,), (7,), (7,), (6, 7, 7), (7,), (7, 7),
    (7,), (7,), (7,), (7,), (7,), (7,), (7,), (7,),
)
assert tuple(tuple(r['class'] for r in e['records']) for e in boss_encounters) == expected_boss_classes
assert boss_encounters[0x10]['groups'][1]['record_indices'] == [0, 1, 2, -1, -1]
assert boss_encounters[0x15]['groups'][1]['record_indices'] == [0, 0, -1, -1, -1]

guard_spans = []
for number, base, lo, hi, name in (
    (5498, 0x800eb010, 0x800ebe51, 0x800ebe76, 'item success/consumption bytecode'),
    (5502, 0x80114cb8, 0x8014bfa0, 0x8014c1cc, 'item menu preparation'),
    (5502, 0x80114cb8, 0x8014c278, 0x8014c3fc, 'item target eligibility'),
    (5502, 0x80114cb8, 0x80127784, 0x80127b6c, 'recovery item handlers and roll limits'),
    (5502, 0x80114cb8, 0x8014cdb8, 0x8014ce60, 'item classification'),
    (5502, 0x80114cb8, 0x8014ce60, 0x8014d280, 'item preparation'),
    (5502, 0x80114cb8, 0x8014d280, 0x8014d6a0, 'item application'),
    (5502, 0x80114cb8, 0x8014d6a0, 0x8014d76c, 'item consumption'),
):
    data = resource(number)[lo - base:hi - base]
    guard_spans.append({'resource': number, 'base': hex(base), 'start': hex(lo),
                        'end_exclusive': hex(hi), 'name': name,
                        'sha256': hashlib.sha256(data).hexdigest()})

output = {
    'source_sha256': SOURCE_SHA256,
    'method': 'Original MIPS callback execution; item script branches verified; no full UI or playthrough.',
    'item_callback_addresses': ['8014C278', '8014BFA0', '8014CDB8', '8014CE60', '8014D280', '8014D6A0'],
    'script_span': ['800EBE51', '800EBE76'],
    'script_sha256': hashlib.sha256(SCRIPT_BYTES).hexdigest(),
    'guard_spans': guard_spans,
    'native_item_chains_executed': len(item_cases) + len(double_results) + len(ally_results) + len(healing_results) + len(group_healing_results) + 1,
    'item_cases': item_cases,
    'two_sirloins': double_results,
    'ally_targeted_meats': ally_results,
    'healing_cases': healing_results,
    'recovery_roll_guards': roll_guards,
    'target_menu_cases': target_menu_results,
    'group_healing_cases': group_healing_results,
    'orb_boss_mode1': orb_boss_result,
    'native_spell_effect_and_commit_cases': spell_results,
    'candidate_pool_count': 60,
    'total_candidate_appearances': len(all_candidates),
    'class3_exceptions': exceptions,
    'campaigns': campaigns,
    'boss_encounters': boss_encounters,
    'boss_encounter_snapshot_checks': 32,
}
OUTPUT.write_text(json.dumps(output, indent=2) + '\n', encoding='utf-8')
print(json.dumps({k: v for k, v in output.items() if k not in ('campaigns', 'boss_encounters')}, indent=2))
print('Results:', OUTPUT)
