const test = require('node:test');
const assert = require('node:assert/strict');
const { create, growthAt, groupedLocations, routeIndex, safe } = require('../../js/monster-reference');
const { loadScripts } = require('../helpers/load-scripts');
const path = require('node:path');
const root = path.join(__dirname, '../..');
const { DATA, MONSTER_REFERENCE } = loadScripts([
  path.join(root, 'data/breeding-data.js'), path.join(root, 'data/monster-reference.js'),
]);
const model = create(DATA, MONSTER_REFERENCE);

test('first-copy examples exclude the target from both roles and resolve to the profiled species', () => {
  const attainable = new Set();
  for (const a of model.playable) for (const b of model.playable) {
    const target = DATA.matrix[a.index][b.index];
    if (target !== a.index && target !== b.index) attainable.add(target);
  }
  for (const entry of model.playable) {
    const recipes = model.firstRecipes(entry.index);
    assert.ok(recipes.length || !attainable.has(entry.index));
    for (const recipe of recipes) {
      assert.notEqual(recipe.a, entry.index);
      assert.notEqual(recipe.b, entry.index);
      const baseResult = DATA.matrix[recipe.a][recipe.b];
      if (baseResult === entry.index) continue;
      const matching = DATA.runtime_rules.rules.filter(r => r.offspring_index === entry.index && r.pedigree_index === recipe.a && r.mate_index === recipe.b);
      assert.ok(matching.some(rule => recipe.condition.includes(rule.kind === 'plus_threshold' ? '+' + rule.minimum_parent_plus : 'Breeding room')));
    }
  }
});

test('profile routes use stable non-negative species IDs and reject malformed IDs', () => {
  assert.equal(routeIndex('#monster?id=0'), 0);
  assert.equal(routeIndex('#monster?id=11'), 11);
  assert.equal(routeIndex('#monster/11'), 11);
  assert.equal(routeIndex('#MONSTER?id=11'), 11);
  assert.equal(routeIndex('#monster?id=11&campaign=terry'), 11);
  for (const hash of ['#monster', '#monster?id=', '#monster?id=-1', '#monster?id=1.5', '#monster?id=1e2', '#monster?id=Infinity', '#monster?id=9007199254740993', '#species-index?id=11']) assert.equal(routeIndex(hash), null);
  assert.equal(model.get(99999), null);
});

test('profile overlays preserve breeding identity while adding current text and verified stats', () => {
  const slime = model.get(11);
  assert.equal(slime.index, 11);
  assert.equal(slime.family_id, 0);
  assert.equal(slime.display_name, MONSTER_REFERENCE.species.find(entry => entry.index === 11).display_name);
  assert.equal(slime.stats.status, 'verified');
  assert.equal(slime.stats.base_level_limit, 40);
  assert.equal(slime.library.text, MONSTER_REFERENCE.species.find(entry => entry.index === 11).library.text);
  assert.ok(slime.skills.terry.length > 0);
  assert.equal(model.get(315).playable, false);
});

test('growth starts at level one with zero accumulated gains and adds each newly reached level exactly once', () => {
  const stats = model.get(11).stats;
  assert.equal(growthAt(stats, 1)[0].total, 0);
  assert.equal(growthAt(stats, 2)[0].total, 8);
  assert.equal(growthAt(stats, 3)[0].total, 14);
  assert.equal(growthAt(stats, 3)[0].gain, 6);
  assert.equal(growthAt(stats, 99)[0].total, stats.growth.hp.slice(1, 99).reduce((a, b) => a + b, 0));
  for (const level of [0, 100, 2.5, NaN]) assert.throws(() => growthAt(stats, level), RangeError);
  assert.equal(growthAt(null, 10)[0].total, null);
  assert.equal(growthAt({ status: 'unverified', growth: stats.growth }, 10)[0].total, null);
});

test('encounter grouping keeps campaigns, floors and kinds distinct while removing duplicate native contexts', () => {
  const locations = [
    { game: 'terry', name: 'A', floors: '1F', kind: 'wild', levels: [2, 1] },
    { game: 'terry', name: 'A', floors: '1F', kind: 'wild', levels: [2, 3] },
    { game: 'terry', name: 'A', floors: '2F', kind: 'wild', levels: [2] },
    { game: 'cobi', name: 'A', floors: '1F', kind: 'wild', levels: [4] },
  ];
  const groups = groupedLocations(locations, 'terry');
  assert.equal(groups.length, 2);
  assert.deepEqual(groups[0].levels, [1, 2, 3]);
  assert.deepEqual(locations[0].levels, [2, 1]);
  assert.equal(groupedLocations(locations, 'tara').length, 0);
});

test('unused encounter pools never become monster acquisition routes or encounter counts', () => {
  const hidden = {game:'terry', name:'Renamed secret gate', floors:'1–10F', kind:'wild', levels:[38], availability:'unused'};
  const reachable = {game:'terry', name:'A real gate', floors:'1–5F', kind:'wild', levels:[12]};
  const otherCampaign = {...reachable, game:'cobi', levels:[20]};
  const locations = [hidden, reachable, otherCampaign];
  assert.deepEqual(groupedLocations(locations, 'terry'), [reachable]);
  assert.deepEqual(groupedLocations(locations), [reachable, otherCampaign]);
  assert.deepEqual(groupedLocations([hidden], 'terry'), []);
  assert.equal(locations[0].availability, 'unused');
});

test('base breeding references count concrete ordered pairs and retain exact examples', () => {
  const sample = 11;
  for (const role of ['pedigree', 'mate']) {
    const groups = model.offspringGroups(sample, role);
    assert.equal(groups.reduce((sum, group) => sum + group.count, 0), model.playable.length);
    for (const group of groups) {
      assert.equal(DATA.matrix[group.a][group.b], group.index);
      assert.equal(role === 'pedigree' ? group.a : group.b, sample);
      assert.ok(model.get(group.index));
    }
  }
  const count = model.playable.reduce((sum, a) => sum + model.playable.filter(b => DATA.matrix[a.index][b.index] === sample).length, 0);
  assert.equal(model.parentCount(sample), count);
});

test('profile strings are escaped before HTML rendering', () => {
  assert.equal(safe('<img src=x onerror="bad()">'), '&lt;img src=x onerror=&quot;bad()&quot;&gt;');
});
test('merging foreign-master encounters keeps all ranks, including rank zero', () => {
  const master = {game:'terry', name:'Wandering master', floors:null, kind:'other'};
  const groups = groupedLocations([
    {...master, levels:[12], strength_ranks:[3,0]},
    {...master, levels:[20], strength_ranks:[5,3]},
    {...master, game:'cobi', levels:[18], strength_ranks:[4]},
  ], 'terry');
  assert.deepEqual(groups[0].strength_ranks, [0,3,5]);
  assert.deepEqual(groups[0].levels, [12,20]);
});
