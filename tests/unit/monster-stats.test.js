const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {create} = require('../../js/monster-stats');
const {loadScripts} = require('../helpers/load-scripts');
const root = path.join(__dirname, '../..');
const references = loadScripts([
  'data/combat-reference.js', 'data/skill-learning-reference.js',
  'data/monster-reference.js', 'js/offspring-resistances.js',
].map(file => path.join(root, file)));
const {COMBAT_REFERENCE: combat, SKILL_LEARNING_REFERENCE: learning, MONSTER_REFERENCE: monsters,
  DQMOffspringResistances: offspring} = references;
const model = create(combat, learning, offspring.channels);
const stats = index => monsters.species.find(row => row.index === index).stats;

test('all 325 authenticated species expose every base and wild resistance without inventing placeholder data', () => {
  assert.equal(combat.species.length, 325);
  for (const entry of combat.species) {
    for (const mode of ['saved', 'wild']) {
      const profile = model.resistances(entry.speciesId, mode);
      assert.equal(profile.maximumGrade, mode === 'saved' ? 7 : 3);
      assert.equal(profile.individual, false);
      assert.deepEqual(profile.rows.map(row => row.grade), [...entry[mode + 'Resistances']]);
      assert.deepEqual(profile.rows.map(row => row.label), [...offspring.channels]);
      assert.deepEqual(profile.rows.map(row => row.id), Array.from({length: 27}, (_, i) => i + 1));
    }
  }
  for (const index of [325, -1, null, '11', 99999]) assert.equal(model.resistances(index), null);
});

test('verified damage actions keep their distinct scales and status grades never become hit percentages', () => {
  // DragonSlime has grade 2 for Blaze / Big Bang: spell 75%, breath 70%.
  const dragon = model.resistances(0);
  assert.deepEqual(dragon.rows[0].damage, [{scale: 'spell', percent: 75}, {scale: 'breath', percent: 70}]);
  assert.deepEqual(model.resistances(0, 'wild').rows[0].damage, [{scale: 'spell', percent: 75}, {scale: 'breath', percent: 70}]);
  for (const channel of [4, 5, 27]) {
    assert.deepEqual(dragon.rows[channel - 1].damage.map(row => row.scale), ['spell', 'breath']);
  }
  for (const channel of [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 19, 20, 21, 22, 23, 24]) {
    assert.deepEqual(dragon.rows[channel - 1].damage, []);
  }
  // Grade 7 in Sacrifice / Body Slam is deliberately not described as immunity.
  assert.equal(dragon.rows[14].grade, 7);
  assert.deepEqual(dragon.rows[14].damage, []);
});

test('individual companion profiles preserve the base data and cannot be mistaken for wild tiers', () => {
  const before = JSON.stringify(combat);
  const individual = Array(27).fill(6);
  const profile = model.resistances(11, 'saved', individual);
  assert.equal(profile.individual, true);
  assert.ok(profile.rows.every(row => row.grade === 6));
  assert.deepEqual(profile.rows[0].damage, [{scale: 'spell', percent: 15}, {scale: 'breath', percent: 10}]);
  profile.rows[0].grade = 0;
  assert.equal(individual[0], 6);
  assert.equal(JSON.stringify(combat), before);
  assert.throws(() => model.resistances(11, 'wild', individual), TypeError);
  assert.throws(() => model.resistances(11, 'enemy'), RangeError);
  for (const bad of [[], Array(26).fill(1), Array(27).fill(8), Array(27).fill(null), Array(27)]) {
    assert.equal(model.resistances(11, 'saved', bad), null);
  }
});

test('unavailable or malformed resistance grades and scales remain unavailable', () => {
  const fixture = JSON.parse(JSON.stringify(combat));
  fixture.species[0].savedResistances = Array(27).fill(9);
  fixture.scales.spell.saved[2] = null;
  const broken = create(fixture, learning, offspring.channels);
  assert.equal(broken.resistances(0), null);
  assert.ok(broken.resistances(11).rows.every(row => row.damage.every(value => value.scale !== 'spell')));
  assert.throws(() => create({...combat, schemaVersion: 2}, learning, offspring.channels), TypeError);
  assert.throws(() => create(combat, learning, offspring.channels.slice(1)), TypeError);
});

test('EXP totals cover every verified species profile including Aibou and stop after level 99', () => {
  const verified = monsters.species.filter(row => row.stats.status === 'verified');
  assert.equal(verified.length, 317);
  for (const species of verified) {
    const curve = species.stats.experience_curve;
    for (const level of [1, 2, 40, 99]) {
      const value = model.experience(species.stats, level);
      assert.equal(value.total, learning.experienceByLevel[level][curve]);
      assert.equal(value.toNext, level === 99 ? null : learning.experienceByLevel[level + 1][curve] - value.total);
    }
  }
  assert.deepEqual(model.experience(stats(323), 1), {level: 1, total: 0, toNext: 2});
  assert.equal(model.experience(stats(325), 40), null);
  assert.equal(model.experience({...stats(11), experience_curve: 32}, 40), null);
  for (const level of [0, 100, 1.5, NaN, '40']) assert.throws(() => model.experience(stats(11), level), RangeError);
});

test('base and recruitment caps remain distinct and special species do not gain assumed recruitment rules', () => {
  assert.deepEqual(model.growthInfo(stats(11), 11), {
    baseLevelCap: 40, recruitmentCap: {min: 38, max: 42}, experienceCurve: stats(11).experience_curve,
  });
  assert.deepEqual(model.growthInfo(stats(235), 235), {
    baseLevelCap: 45, recruitmentCap: {min: 48, max: 52}, experienceCurve: 11,
  });
  assert.deepEqual(model.growthInfo(stats(323), 323), {
    baseLevelCap: null, recruitmentCap: null, experienceCurve: 0,
  });
  assert.equal(model.growthInfo(stats(325), 325), null);
});
