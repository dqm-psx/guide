const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {loadScripts} = require('../helpers/load-scripts');
const {calculate, rules, meats, healingItems} = require('../../js/recruitment');
const root = path.join(__dirname, '../..');
const {RECRUITMENT_REFERENCE: reference, GUIDE_REFERENCE: guide, MONSTER_REFERENCE: monsters} = loadScripts([
  path.join(root, 'data/recruitment-reference.js'),
  path.join(root, 'data/handbook-reference.js'),
  path.join(root, 'data/monster-reference.js'),
]);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);

// Native thresholds are counted in the manual's sirloin-stacking harness.
// The full item path additionally reaches ConsumeItem (+5 per successful use).
test('one and two consumed Sirloins use the full native item score', () => {
  const slime = reference.encounters.find(row => row.campaign === 'terry' && row.contextId === 1).enemies[0];
  const metal = reference.encounters.find(row => row.campaign === 'terry' && row.contextId === 22).enemies[1];
  assert.equal(slime.speciesIndex, 11);
  assert.equal(metal.speciesIndex, 20);
  for (const count of [1, 2]) {
    const result = calculate({...slime, collected: true, meats: {28: count}});
    close(result.probability, 1435 / 2048);
    assert.equal(result.appeal, count === 1 ? 415 : 820);
    assert.equal(result.adjustedAppeal, count === 1 ? 103 : 205);
  }
  const one = calculate({...metal, collected: true, meats: {28: 1}});
  const two = calculate({...metal, collected: true, meats: {28: 2}});
  close(one.probability, 2255 / 26624);
  close(two.probability, 205 / 832);
  assert.equal(one.adjustedAppeal, 20);
  assert.equal(two.adjustedAppeal, 41);
});

test('each consumed meat includes the shared five-point item bonus', () => {
  const options = {recruitmentClass: 6, speciesRank: 6, collected: true};
  for (const [item, score] of [[25, 25], [26, 45], [27, 115], [28, 415]]) {
    assert.equal(calculate({...options, meats: {[item]: 1}}).appeal, score);
  }
});

test('successful recovery items bound the native half-roll and one consumption bonus', () => {
  const options = {recruitmentClass: 5, speciesRank: 5, battleMode: 1};
  const herbs = calculate({...options, healing: {1: 10}});
  assert.deepEqual(herbs.appealRange, [210, 260]);
  assert.deepEqual(herbs.adjustedAppealRange, [26, 32]);
  close(herbs.probabilityRange[0], .01 + .99 * (17 / 91 * 2870 / 4096));
  close(herbs.probabilityRange[1], .01 + .99 * (23 / 91 * 2870 / 4096));
  assert.equal(herbs.probability, herbs.probabilityRange[0]);
  for (const [item, range] of [[1, [30, 35]], [2, [45, 50]], [4, [25, 30]]]) {
    const result = calculate({...options, healing: {[item]: 1}});
    assert.deepEqual(result.appealRange, range);
  }
  assert.deepEqual(healingItems.find(item => item.itemId === 4).recoveryRange, [20, 30]);
  assert.deepEqual(calculate({...options, healing: {1: 0}}).appealRange, [10, 10]);
});

test('full recovery uses missing points, rounding each Dew target before one consumption bonus', () => {
  const options = {recruitmentClass: 3, speciesRank: 5};
  assert.deepEqual(calculate({...options, healing: {3: 1}, recoveryPerUse: {3: 400}}).appealRange, [215, 215]);
  assert.deepEqual(calculate({...options, healing: {5: 1}, recoveryPerUse: {5: 80}}).appealRange, [55, 55]);
  const group = calculate({...options, healing: {3: 2}, recoveryPerUse: {3: [3, 3, 0]}});
  assert.deepEqual(group.appealRange, [24, 24]);
  const mixed = calculate({...options, healing: {1: 2, 3: 1, 4: 1, 5: 2},
    recoveryPerUse: {3: [100, 200, 300], 5: 79}});
  assert.deepEqual(mixed.appealRange, [458, 473]);
});

test('Sage’s Stone bounds all healed targets and a possible single break bonus', () => {
  const options = {recruitmentClass: 5, speciesRank: 5, battleMode: 1};
  assert.deepEqual(calculate({...options, healing: {11: 1}}).appealRange, [40, 50]);
  const group = calculate({...options, healing: {11: 1}, healedTargets: {11: 3}});
  assert.deepEqual(group.appealRange, [100, 120]);
  // Original callback examples: three rolls 69/65/70 + break give score116;
  // rolls63/61/67 without break give104. The five-point bonus is not per target.
  for (const nativeScore of [104, 116]) {
    assert.ok(nativeScore >= group.appealRange[0] && nativeScore <= group.appealRange[1]);
  }
  assert.deepEqual(calculate({...options, healing: {11: 2}, healedTargets: {11: 3}}).appealRange, [190, 230]);
});

test('boss meat rejection survives stale input while foreign-master meat remains effective', () => {
  const options = {recruitmentClass: 5, speciesRank: 5, meats: {28: 5}, healing: {1: 10}};
  const boss = calculate({...options, battleMode: 1, meatAllowed: true});
  assert.equal(boss.meatAllowed, false);
  assert.deepEqual(boss.appealRange, [210, 260]);
  const master = calculate({...options, battleMode: 3});
  assert.equal(master.meatAllowed, true);
  assert.deepEqual(master.appealRange, [2235, 2285]);
  assert.deepEqual(calculate({...options, meatAllowed: false}).appealRange, boss.appealRange);
});

test('healing cannot bypass eligibility and saturated score ranges collapse correctly', () => {
  const boosted = {speciesRank: 5, battleMode: 1, healing: {1: 99, 3: 99, 11: 99},
    recoveryPerUse: {3: [65535, 65535, 65535]}, healedTargets: {11: 3}};
  for (const [recruitmentClass, probability] of [[0, 1], [7, 0]]) {
    const result = calculate({...boosted, recruitmentClass});
    assert.deepEqual(result.probabilityRange, [probability, probability]);
  }
  assert.deepEqual(calculate({...boosted, recruitmentClass: 5, speciesRank: 7}).probabilityRange, [0, 0]);
  assert.deepEqual(calculate({...boosted, recruitmentClass: 0, battleMode: 2}).probabilityRange, [0, 0]);
  const normal = calculate({...boosted, recruitmentClass: 6, collected: true});
  assert.deepEqual(normal.appealRange, [32767, 32767]);
  assert.deepEqual(normal.probabilityRange, [1435 / 2048, 1435 / 2048]);
  assert.deepEqual(calculate({...boosted, recruitmentClass: 5, orb: true}).probabilityRange, [1, 1]);
});

test('invalid healing counts, restored points and group sizes cannot yield a plausible chance', () => {
  const options = {recruitmentClass: 5, speciesRank: 5};
  for (const healing of [{6: 1}, {1: -1}, {2: .5}, {4: '1'}, {11: Infinity}]) {
    assert.throws(() => calculate({...options, healing}), RangeError);
  }
  assert.throws(() => calculate({...options, healing: []}), TypeError);
  assert.throws(() => calculate({...options, healing: {3: 1}}), /HP restored/);
  assert.throws(() => calculate({...options, healing: {5: 1}}), /MP restored/);
  for (const value of [[], [0, 0, 0], [1, 2, 3, 4], [1, -1], [1, .5]]) {
    assert.throws(() => calculate({...options, healing: {3: 1}, recoveryPerUse: {3: value}}), RangeError);
  }
  for (const value of [[10], -1, .5, 65536, '10']) {
    assert.throws(() => calculate({...options, healing: {5: 1}, recoveryPerUse: {5: value}}), RangeError);
  }
  assert.throws(() => calculate({...options, recoveryPerUse: []}), TypeError);
  assert.throws(() => calculate({...options, recoveryPerUse: {1: 30}}), RangeError);
  assert.throws(() => calculate({...options, healedTargets: []}), TypeError);
  assert.throws(() => calculate({...options, healedTargets: {3: 2}}), RangeError);
  for (const value of [0, 4, .5, '2']) {
    assert.throws(() => calculate({...options, healedTargets: {11: value}}), RangeError);
  }
  assert.throws(() => calculate({...options, meatAllowed: 'yes'}), TypeError);
});

test('first collection is a separate chance before the feeding check', () => {
  const options = {recruitmentClass: 6, speciesRank: 6};
  const first = calculate(options);
  assert.equal(first.firstCollectionChance, 1 / 200);
  assert.equal(first.feedingChance, 0);
  assert.equal(first.probability, 1 / 200);
  assert.equal(calculate({...options, collected: true}).probability, 0);
  const fed = calculate({...options, meats: {28: 1}});
  assert.equal(fed.adjustedAppeal, 25);
  close(fed.probability, 1 / 200 + 199 / 200 * (16 / 91 * 2870 / 4096));
});

test('shared appeal stacks different meats and saturates at the native signed-halfword cap', () => {
  const options = {recruitmentClass: 6, speciesRank: 6, collected: true};
  assert.equal(calculate({...options, meats: {25: 1, 26: 1, 27: 1, 28: 1}}).appeal, 570);
  assert.equal(calculate({...options, meats: {28: 80}}).appeal, 32410);
  for (const count of [81, 82, 99, 100, Number.MAX_SAFE_INTEGER]) {
    const result = calculate({...options, meats: {28: count}});
    assert.equal(result.appeal, 32767);
    close(result.probability, 1435 / 2048);
  }
});

test('class, rank, Orb and battle-mode precedence match the native eligibility checks', () => {
  assert.equal(calculate({recruitmentClass: 0, speciesRank: 7}).probability, 1);
  for (const orb of [false, true]) {
    assert.equal(calculate({recruitmentClass: 7, speciesRank: 0, orb}).reason, 'blocked-class');
    assert.equal(calculate({recruitmentClass: 6, speciesRank: 7, orb}).reason, 'blocked-rank');
  }
  for (const battleMode of [0, 1, 3]) {
    const result = calculate({recruitmentClass: 6, speciesRank: 6, collected: true, orb: true, battleMode});
    assert.equal(result.reason, 'orb');
    assert.equal(result.probability, 1);
    assert.equal(result.appeal, 4110);
  }
  for (const battleMode of [2, 4, 7, 255]) {
    for (const recruitmentClass of [0, 6]) {
      const result = calculate({recruitmentClass, speciesRank: 6, orb: true, battleMode});
      assert.equal(result.reason, 'blocked-battle');
      assert.equal(result.probability, 0);
    }
  }
});

test('North Mountain Silver Devil records remain blocked even with meat and Starry Orb', () => {
  for (const campaign of ['cobi', 'tara']) {
    const enemy = reference.encounters.find(row => row.campaign === campaign && row.contextId === 75)
      .enemies.find(row => row.speciesIndex === 183);
    assert.equal(enemy.level, 47);
    assert.equal(enemy.recruitmentClass, 7);
    const result = calculate({...enemy, orb: true, meats: {28: 99}});
    assert.equal(result.probability, 0);
    assert.equal(result.reason, 'blocked-class');
  }
});

test('malformed inputs cannot silently produce a plausible percentage', () => {
  const valid = {recruitmentClass: 6, speciesRank: 6};
  for (const value of [-1, 8, 1.5, '6', NaN, undefined]) {
    assert.throws(() => calculate({...valid, recruitmentClass: value}), RangeError);
    assert.throws(() => calculate({...valid, speciesRank: value}), RangeError);
  }
  for (const value of [-1, 0.5, '1', Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => calculate({...valid, meats: {28: value}}), RangeError);
  }
  assert.throws(() => calculate({...valid, meats: {30: 1}}), RangeError);
  assert.throws(() => calculate({...valid, meats: []}), TypeError);
  assert.throws(() => calculate({...valid, collected: 'yes'}), TypeError);
  assert.throws(() => calculate({...valid, orb: 1}), TypeError);
  assert.throws(() => calculate({...valid, battleMode: 256}), RangeError);
});

test('expanded native data preserves the named wild contexts and their stable species identities', () => {
  const expected = new Set(guide.species.flatMap(mon => mon.locations)
    .filter(row => row.kind === 'wild' && !(row.game === 'terry' && [122, 123, 124, 125].includes(row.context_id)))
    .map(row => `${row.game}:${row.context_id}`));
  const wild = reference.encounters.filter(row => row.kind === 'wild');
  const actual = wild.map(row => `${row.campaign}:${row.contextId}`);
  assert.deepEqual(new Set(actual), expected);
  assert.equal(actual.length, new Set(actual).size);
  assert.equal(reference.provenance.countsByKind.wild.contexts, 283);
  assert.equal(reference.provenance.countsByKind.wild.enemyRecords, 1131);
  assert.equal(wild.reduce((sum, row) => sum + row.enemies.length, 0), 1131);
  const species = new Set(monsters.species.map(row => row.index));
  for (const row of wild) {
    assert.equal(row.kind, 'wild');
    assert.ok(row.enemies.length > 0);
    for (const enemy of row.enemies) {
      assert.ok(species.has(enemy.speciesIndex));
      assert.ok(Number.isInteger(enemy.level) && enemy.level >= 1 && enemy.level <= 99);
      for (const collected of [false, true]) {
        let previous = 0;
        for (const count of [0, 1, 2, 83]) {
          const result = calculate({...enemy, collected, meats: {28: count}});
          assert.ok(result.probability >= previous && result.probability <= 1);
          assert.equal(result.percent, result.probability * 100);
          previous = result.probability;
        }
      }
    }
  }
  assert.equal(JSON.stringify(reference.rules), JSON.stringify(rules));
  assert.equal(JSON.stringify(reference.meats), JSON.stringify(meats));
});
