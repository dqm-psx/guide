const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {loadScripts} = require('../helpers/load-scripts');
const {calculate, rules, meats} = require('../../js/recruitment');
const root = path.join(__dirname, '../..');
const {RECRUITMENT_REFERENCE: reference, GUIDE_REFERENCE: guide, MONSTER_REFERENCE: monsters} = loadScripts([
  path.join(root, 'data/recruitment-reference.js'),
  path.join(root, 'data/handbook-reference.js'),
  path.join(root, 'data/monster-reference.js'),
]);
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);

// Fractions come from counted native MIPS outcomes in the manual's
// sirloin-stacking-verification.json, not from this JavaScript implementation.
test('one and two Sirloins reproduce native Slime and Metal Slime outcomes', () => {
  const slime = reference.encounters.find(row => row.campaign === 'terry' && row.contextId === 1).enemies[0];
  const metal = reference.encounters.find(row => row.campaign === 'terry' && row.contextId === 22).enemies[1];
  assert.equal(slime.speciesIndex, 11);
  assert.equal(metal.speciesIndex, 20);
  for (const count of [1, 2]) {
    const result = calculate({...slime, collected: true, meats: {28: count}});
    close(result.probability, 1435 / 2048);
    assert.equal(result.appeal, count === 1 ? 410 : 810);
    assert.equal(result.adjustedAppeal, count === 1 ? 102 : 202);
  }
  const one = calculate({...metal, collected: true, meats: {28: 1}});
  const two = calculate({...metal, collected: true, meats: {28: 2}});
  close(one.probability, 2255 / 26624);
  close(two.probability, 6355 / 26624);
  assert.equal(one.adjustedAppeal, 20);
  assert.equal(two.adjustedAppeal, 40);
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
  assert.equal(calculate({...options, meats: {25: 1, 26: 1, 27: 1, 28: 1}}).appeal, 550);
  assert.equal(calculate({...options, meats: {28: 81}}).appeal, 32410);
  for (const count of [82, 83, 99, 100, Number.MAX_SAFE_INTEGER]) {
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
    assert.equal(result.appeal, 4105);
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

test('native data includes only named guide wild contexts and retains stable species identities', () => {
  const expected = new Set(guide.species.flatMap(mon => mon.locations)
    .filter(row => row.kind === 'wild' && !(row.game === 'terry' && [122, 123, 124, 125].includes(row.context_id)))
    .map(row => `${row.game}:${row.context_id}`));
  const actual = reference.encounters.map(row => `${row.campaign}:${row.contextId}`);
  assert.deepEqual(new Set(actual), expected);
  assert.equal(actual.length, new Set(actual).size);
  assert.equal(reference.provenance.contexts, 283);
  assert.equal(reference.provenance.enemyRecords, 1131);
  assert.equal(reference.encounters.reduce((sum, row) => sum + row.enemies.length, 0), 1131);
  const species = new Set(monsters.species.map(row => row.index));
  for (const row of reference.encounters) {
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
