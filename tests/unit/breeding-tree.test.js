const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('../helpers/load-scripts');
const root = path.resolve(__dirname, '../..');
function setup() {
  const ctx = loadScripts(['data/breeding-data.js', 'js/planner-core.js', 'js/recipe-planner.js', 'js/breeding-tree.js'].map(file => path.join(root, file)));
  return { ctx, tree: ctx.DQMBreedingTreeCore.create(ctx.DATA, ctx.DQMRecipePlanner, ctx.DQMPlannerCore), core: ctx.DQMPlannerCore.create(ctx.DATA) };
}
const plain = value => JSON.parse(JSON.stringify(value));

test('branches retain ordered parents and independently expand both sides', () => {
  const { tree, core } = setup();
  let plan = tree.createPlan(290, 'shrine');
  const rootRecipe = tree.candidates(plan, '').items.find(recipe => recipe.parents.every(index => index !== null));
  plan = tree.choose(plan, '', rootRecipe.id);
  assert.equal(tree.at(plan, '0').speciesIndex, rootRecipe.parents[0]);
  assert.equal(tree.at(plan, '1').speciesIndex, rootRecipe.parents[1]);
  assert.equal(core.result(...rootRecipe.parents, 0, 0, 'shrine').resultIndex, 290);
  const leftRecipe = tree.candidates(plan, '0').items[0];
  const rightRecipe = tree.candidates(plan, '1').items[0];
  assert.ok(leftRecipe && rightRecipe);
  plan = tree.choose(plan, '0', leftRecipe.id);
  plan = tree.choose(plan, '1', rightRecipe.id);
  assert.equal(plan.nodes.length, 7);
  assert.equal(tree.at(plan, '00').speciesIndex, leftRecipe.parents[0]);
  assert.equal(tree.at(plan, '11').speciesIndex, rightRecipe.parents[1]);
});

test('circular parents are excluded and cannot be applied through a crafted link', () => {
  const { tree, ctx } = setup();
  const plan = tree.createPlan(11, 'shrine');
  const all = ctx.DQMRecipePlanner.create(ctx.DATA, ctx.DQMPlannerCore).suggestions(11, { pageSize: 100000 }).items;
  const loop = all.find(recipe => recipe.parents.includes(11));
  assert.ok(loop);
  assert.ok(tree.candidates(plan, '').excluded > 0);
  assert.ok(tree.candidates(plan, '').items.every(recipe => !recipe.parents.includes(11)));
  assert.throws(() => tree.choose(plan, '', loop.id), /loop/);
  assert.throws(() => tree.restore({ version: 1, target: 11, context: 'shrine', branches: [['', loop.id, 0]] }), /loop/);
});

test('room wildcard recipes stay family requirements and do not leak into shrine context', () => {
  const { tree } = setup();
  let plan = tree.createPlan(19, 'room');
  const recipe = tree.candidates(plan, '').items.find(item => item.familyWildcard);
  assert.ok(recipe);
  plan = tree.choose(plan, '', recipe.id);
  assert.equal(tree.at(plan, '1').speciesIndex, null);
  assert.equal(tree.candidates(plan, '1').items.length, 0);
  assert.match(tree.conditions(recipe), /Two-save Breeding room only/);
  assert.ok(tree.candidates(tree.createPlan(19, 'shrine'), '').items.every(item => item.kind !== 'flag_gated'));
  const roundTrip = tree.restore(plain(tree.snapshot(plan, new Set())));
  assert.equal(tree.at(roundTrip.plan, '1').speciesIndex, null);
});

test('threshold conditions use either parent and base outcomes retain the upper bound', () => {
  const { tree, core } = setup();
  const plan = tree.createPlan(9, 'shrine');
  const recipe = tree.candidates(plan, '').items.find(item => item.kind === 'plus_threshold' && item.parents[0] === 11);
  assert.ok(recipe);
  assert.equal(core.result(11, 11, 4, 0, 'shrine').resultIndex, 9);
  assert.match(tree.conditions(recipe), /Either parent must be \+4/);
  assert.match(tree.conditions({ kind: 'base', context: 'shrine', parents: [11, 11] }), /Both parents must be below \+4/);
  assert.match(tree.conditions({ kind: 'base', context: 'base', parents: [11, 11] }), /not applied/);
});

test('share state round-trips branches and collapsed state using only stable IDs', () => {
  const { tree } = setup();
  let plan = tree.createPlan(290, 'shrine');
  plan = tree.choose(plan, '', tree.candidates(plan, '').items[0].id);
  plan = tree.choose(plan, '0', tree.candidates(plan, '0').items[0].id);
  const state = plain(tree.snapshot(plan, new Set(['0'])));
  assert.deepEqual(Object.keys(state), ['version', 'target', 'context', 'branches']);
  const restored = tree.restore(state);
  assert.deepEqual(plain(tree.snapshot(restored.plan, restored.collapsed)), state);
  assert.equal(restored.plan.nodes.length, 5);
  assert.ok(restored.collapsed.has('0'));
});

test('changing one branch removes its obsolete descendants and preserves the sibling', () => {
  const { tree } = setup();
  let plan = tree.createPlan(290, 'shrine');
  plan = tree.choose(plan, '', tree.candidates(plan, '').items[0].id);
  const left = tree.candidates(plan, '0').items;
  plan = tree.choose(plan, '0', left[0].id);
  plan = tree.choose(plan, '1', tree.candidates(plan, '1').items[0].id);
  const sibling = plain(tree.at(plan, '1'));
  plan = tree.choose(plan, '0', left[1].id);
  assert.equal(plan.nodes.length, 7);
  assert.deepEqual(plain(tree.at(plan, '1')), sibling);
  plan = tree.clear(plan, '0');
  assert.equal(plan.nodes.length, 5);
  assert.equal(tree.at(plan, '00'), null);
});

test('malformed or outdated share trees are rejected before replacing a current tree', () => {
  const { tree } = setup();
  const good = { version: 1, target: 290, context: 'shrine', branches: [] };
  for (const invalid of [
    { ...good, target: 999 }, { ...good, target: '290' }, { ...good, version: 2 },
    { ...good, context: 'anything' }, { ...good, branches: [['constructor', 'base:shrine:0:1', 0]] },
    { ...good, branches: [['00', 'base:shrine:0:1', 0]] },
    { ...good, branches: new Array(32).fill(['', 'base:shrine:0:1', 0]) },
  ]) assert.throws(() => tree.restore(invalid));
});

test('every room family wildcard matches the concrete PSX result for every family member', () => {
  const { tree, ctx, core } = setup();
  let checked = 0;
  for (const rule of ctx.DATA.runtime_rules.rules.filter(item => item.kind === 'flag_gated' && item.mate_index === null)) {
    const plan = tree.createPlan(rule.offspring_index, 'room');
    const recipe = tree.candidates(plan, '').items.find(item => item.parents[0] === rule.pedigree_index && item.familyWildcard && item.mateFamilyIndex === rule.mate_family_index);
    if (!recipe) continue; // A rule containing its own target cannot be expanded into a tree.
    for (const mate of ctx.DATA.species.filter(item => item.playable && item.family_id === recipe.mateFamilyIndex)) {
      assert.equal(core.result(recipe.parents[0], mate.index, 0, 0, 'room').resultIndex, rule.offspring_index);
      checked++;
    }
  }
  assert.ok(checked > 0);
});

test('a branching tree cannot exceed its display node limit', () => {
  const { tree } = setup();
  let plan = tree.createPlan(2, 'shrine');
  const queue = [''];
  while (plan.nodes.length < tree.MAX_NODES) {
    const branch = queue.shift();
    assert.notEqual(branch, undefined);
    const recipe = tree.candidates(plan, branch).items[0];
    if (!recipe) continue;
    plan = tree.choose(plan, branch, recipe.id);
    queue.push(branch + '0', branch + '1');
  }
  const branch = queue.find(item => tree.candidates(plan, item).items.length > 0);
  assert.ok(branch);
  assert.throws(() => tree.choose(plan, branch, tree.candidates(plan, branch).items[0].id), /63-monster limit/);
  assert.equal(plan.nodes.length, 63);
});
