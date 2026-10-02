const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('../helpers/load-scripts');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function createPlanner() {
  const context = loadScripts([
    path.join(REPO_ROOT, 'data', 'breeding-data.js'),
    path.join(REPO_ROOT, 'js', 'planner-core.js'),
    path.join(REPO_ROOT, 'js', 'recipe-planner.js'),
  ]);
  return context.DQMRecipePlanner.create(context.DATA, context.DQMPlannerCore);
}

// Objects created inside the vm context have a different Object.prototype,
// so deep comparisons round-trip through JSON first.
const plain = value => JSON.parse(JSON.stringify(value));

// Navigate from the root following a slot path (0 = pedigree child, 1 = mate child).
function nodeAtPath(plan, path) {
  let id = plan.rootId;
  for (const slot of path) {
    const node = plan.nodes.find(n => n.id === id);
    assert.ok(node, 'a node exists at path ' + JSON.stringify(path));
    assert.ok(node.children, 'the node at path ' + JSON.stringify(path) + ' is expanded');
    id = node.children[slot];
  }
  return plan.nodes.find(n => n.id === id);
}

// A cycle-free chain of 12 expansions from species 2 (Winged Slime). Each recipe
// produces the node's species and leads to the next chain species.
const depthChain = [
  { path: [], recipe: [0, 97] },
  { path: [1], recipe: [89, 65] },
  { path: [1, 1], recipe: [62, 258] },
  { path: [1, 1, 0], recipe: [57, 177] },
  { path: [1, 1, 0, 1], recipe: [169, 260] },
  { path: [1, 1, 0, 1, 1], recipe: [259, 57] },
  { path: [1, 1, 0, 1, 1, 0], recipe: [261, 33] },
  { path: [1, 1, 0, 1, 1, 0, 1], recipe: [34, 226] },
  { path: [1, 1, 0, 1, 1, 0, 1, 0], recipe: [26, 266] },
  { path: [1, 1, 0, 1, 1, 0, 1, 0, 1], recipe: [261, 234] },
  { path: [1, 1, 0, 1, 1, 0, 1, 0, 1, 1], recipe: [227, 258] },
  { path: [1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0], recipe: [228, 26] },
];
// The 13th expansion along the chain would create children at depth 13.
const depthOverflow = { path: [1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 0], recipe: [235, 57] };

// A breadth-first expansion sequence from species 2. The first 49 expansions
// reach 99 nodes; the 50th would exceed MAX_PLAN_NODES (100).
const wideTreeExpansions = [
  { path: [], recipe: [0, 89] },
  { path: [0], recipe: [1, 26] },
  { path: [1], recipe: [90, 1] },
  { path: [0, 0], recipe: [4, 57] },
  { path: [0, 1], recipe: [27, 1] },
  { path: [1, 0], recipe: [91, 26] },
  { path: [1, 1], recipe: [0, 57] },
  { path: [0, 0, 0], recipe: [3, 143] },
  { path: [0, 0, 1], recipe: [58, 3] },
  { path: [0, 1, 0], recipe: [28, 57] },
  { path: [0, 1, 1], recipe: [4, 57] },
  { path: [1, 0, 0], recipe: [92, 57] },
  { path: [1, 0, 1], recipe: [27, 0] },
  { path: [1, 1, 0], recipe: [3, 26] },
  { path: [1, 1, 1], recipe: [58, 3] },
  { path: [0, 0, 0, 0], recipe: [5, 117] },
  { path: [0, 0, 0, 1], recipe: [144, 3] },
  { path: [0, 0, 1, 0], recipe: [59, 26] },
  { path: [0, 0, 1, 1], recipe: [4, 117] },
  { path: [0, 1, 0, 0], recipe: [29, 90] },
  { path: [0, 1, 0, 1], recipe: [58, 1] },
  { path: [0, 1, 1, 0], recipe: [3, 143] },
  { path: [0, 1, 1, 1], recipe: [58, 3] },
  { path: [1, 0, 0, 0], recipe: [93, 116] },
  { path: [1, 0, 0, 1], recipe: [58, 1] },
  { path: [1, 0, 1, 0], recipe: [28, 57] },
  { path: [1, 0, 1, 1], recipe: [1, 27] },
  { path: [1, 1, 0, 0], recipe: [4, 117] },
  { path: [1, 1, 0, 1], recipe: [27, 3] },
  { path: [1, 1, 1, 0], recipe: [59, 26] },
  { path: [1, 1, 1, 1], recipe: [0, 117] },
  { path: [0, 0, 0, 0, 0], recipe: [6, 169] },
  { path: [0, 0, 0, 0, 1], recipe: [116, 26] },
  { path: [0, 0, 0, 1, 0], recipe: [145, 26] },
  { path: [0, 0, 0, 1, 1], recipe: [5, 117] },
  { path: [0, 0, 1, 0, 0], recipe: [60, 89] },
  { path: [0, 0, 1, 0, 1], recipe: [27, 3] },
  { path: [0, 0, 1, 1, 0], recipe: [5, 143] },
  { path: [0, 0, 1, 1, 1], recipe: [116, 26] },
  { path: [0, 1, 0, 0, 0], recipe: [30, 116] },
  { path: [0, 1, 0, 0, 1], recipe: [89, 29] },
  { path: [0, 1, 0, 1, 0], recipe: [59, 28] },
  { path: [0, 1, 0, 1, 1], recipe: [4, 59] },
  { path: [0, 1, 1, 0, 0], recipe: [5, 117] },
  { path: [0, 1, 1, 0, 1], recipe: [144, 3] },
  { path: [0, 1, 1, 1, 0], recipe: [59, 28] },
  { path: [0, 1, 1, 1, 1], recipe: [4, 117] },
  { path: [1, 0, 0, 0, 0], recipe: [94, 143] },
  { path: [1, 0, 0, 0, 1], recipe: [117, 0] },
  { path: [1, 0, 0, 1, 0], recipe: [59, 26] },
];

test('ordered parents are preserved and named from the data', () => {
  const planner = createPlanner();
  const result = planner.suggestions(0, { context: 'shrine', pageSize: 100 });
  const forward = result.items.find(r => r.parents[0] === 0 && r.parents[1] === 1);
  assert.ok(forward, 'Drake Slime suggestions include Drake Slime + Spotted Slime');
  assert.equal(forward.parentNames[0], 'Drake Slime');
  assert.equal(forward.parentNames[1], 'Spotted Slime');
  const reverse = result.items.find(r => r.parents[0] === 1 && r.parents[1] === 0);
  assert.equal(reverse, undefined, 'the reversed pair produces Spotted Slime, not Drake Slime');
});

test('plus threshold recipes appear in shrine but not base', () => {
  const planner = createPlanner();
  const shrine = planner.suggestions(17, { context: 'shrine', pageSize: 100 });
  const plus = shrine.items.find(r => r.kind === 'plus_threshold');
  assert.ok(plus, 'Spotted King has a plus_threshold recipe in shrine');
  assert.deepEqual(plain(plus.parents), [1, 1]);
  assert.equal(plus.minPlus, 4);
  assert.ok(plus.condition.length > 0, 'the plus recipe carries a condition');
  const base = planner.suggestions(17, { context: 'base', pageSize: 100 });
  assert.equal(base.items.find(r => r.kind === 'plus_threshold'), undefined, 'no plus recipe in base context');
  assert.equal(base.items.find(r => r.parents[0] === 1 && r.parents[1] === 1), undefined, 'the pair is not a base candidate in base context');
});

test('room rules apply only in the room context and override the base table', () => {
  const planner = createPlanner();
  const shrine = planner.suggestions(19, { context: 'shrine', pageSize: 200 });
  assert.equal(shrine.items.find(r => r.kind === 'flag_gated'), undefined, 'no room recipe in shrine');
  const room = planner.suggestions(19, { context: 'room', pageSize: 200 });
  const angel = room.items.find(r => r.kind === 'flag_gated' && r.parents[0] === 13 && r.parents[1] === null);
  assert.ok(angel, 'Angel Slime has the wildcard room recipe in room context');
  assert.equal(angel.familyWildcard, true);
  assert.equal(angel.mateFamilyIndex, 7);
  assert.equal(angel.parentNames[1], 'Any Zombie-family monster');

  // A pair whose room override changes the offspring is excluded from the base target.
  const winged = planner.suggestions(2, { context: 'room', pageSize: 1000 });
  assert.equal(winged.items.find(r => r.parents[0] === 11 && r.parents[1] === 101), undefined,
    'Slime + Giant Chicken is excluded from Winged Slime in room context (the override wins)');
  const egg = planner.suggestions(25, { context: 'room', pageSize: 200 });
  const wonder = egg.items.find(r => r.kind === 'flag_gated' && r.parents[0] === 11 && r.parents[1] === 101);
  assert.ok(wonder, 'Wonder Egg has the concrete room recipe');
  assert.equal(wonder.familyWildcard, false);

  // A wildcard override also excludes the base target: Healer Slime + any Zombie no longer yields species 6.
  const species6 = planner.suggestions(6, { context: 'room', pageSize: 1000 });
  assert.equal(species6.items.find(r => r.parents[0] === 13 && r.parents[1] === 199), undefined,
    'Healer Slime + Ghost is excluded from species 6 in room context');
});

test('ranking puts roster recipes first and breaks ties deterministically', () => {
  const planner = createPlanner();
  const result = planner.suggestions(17, { context: 'shrine', rosterSpecies: [9], pageSize: 100 });
  assert.equal(result.items[0].parents[0], 9, 'a recipe using the roster species sorts first');
  assert.equal(result.items[0].rosterParents.length, 1);
  const plusIndex = result.items.findIndex(r => r.kind === 'plus_threshold');
  assert.ok(plusIndex > 0, 'the plus recipe sorts after roster recipes');

  const empty = planner.suggestions(17, { context: 'shrine', pageSize: 100 });
  const i50 = empty.items.findIndex(r => r.parents[0] === 9 && r.parents[1] === 50);
  const i51 = empty.items.findIndex(r => r.parents[0] === 9 && r.parents[1] === 51);
  assert.ok(i50 !== -1 && i51 !== -1 && i50 < i51, '[9,50] sorts before [9,51]');
  const plusIdx = empty.items.findIndex(r => r.kind === 'plus_threshold');
  assert.ok(i50 < plusIdx, 'base sorts before plus_threshold on equal roster and missing counts');
});

test('expand prevents cycles', () => {
  const planner = createPlanner();
  const r089 = planner.findRecipe(2, 'shrine', [0, 89]);
  const r126 = planner.findRecipe(0, 'shrine', [1, 26]);
  const r257 = planner.findRecipe(1, 'shrine', [2, 57]);
  let plan = planner.createPlan(2, 'shrine');
  plan = planner.expand(plan, plan.rootId, r089);
  const child0 = plan.nodes[0].children[0];
  plan = planner.expand(plan, child0, r126);
  const child0Node = plan.nodes.find(n => n.id === child0);
  const child1 = child0Node.children[0];
  assert.throws(() => planner.expand(plan, child1, r257), err => err.code === 'invalid',
    'expanding a descendant into an ancestor species is rejected');

  const selfCycle = planner.createPlan(0, 'shrine');
  const r01 = planner.findRecipe(0, 'shrine', [0, 1]);
  assert.throws(() => planner.expand(selfCycle, selfCycle.rootId, r01), err => err.code === 'invalid',
    'a child equal to the node itself is a cycle');
});

test('replaceRecipe swaps only the dependent branch and offers undo', () => {
  const planner = createPlanner();
  const r089 = planner.findRecipe(2, 'shrine', [0, 89]);
  const r126 = planner.findRecipe(0, 'shrine', [1, 26]);
  const r326 = planner.findRecipe(0, 'shrine', [3, 26]);
  let plan = planner.createPlan(2, 'shrine');
  plan = planner.expand(plan, plan.rootId, r089);
  const rootNode = plan.nodes[0];
  const child0 = rootNode.children[0];
  const child89 = rootNode.children[1];
  plan = planner.expand(plan, child0, r126);
  plan = planner.setStatus(plan, child89, 'ready');
  plan = planner.setNote(plan, child89, '  keep this note  ');
  const result = planner.replaceRecipe(plan, child0, r326);
  const replaced = result.plan;
  const untouched = replaced.nodes.find(n => n.id === child89);
  assert.equal(untouched.status, 'ready', 'the untouched branch keeps its status');
  assert.equal(untouched.note, 'keep this note', 'the untouched branch keeps its trimmed note');
  const replacedNode = replaced.nodes.find(n => n.id === child0);
  assert.deepEqual(plain(replacedNode.recipe.parents), [3, 26], 'the node recipe is replaced');
  const grandkids = replacedNode.children.map(id => replaced.nodes.find(n => n.id === id));
  assert.deepEqual(plain(grandkids.map(n => n.speciesIndex)), [3, 26], 'the dependent branch is new');
  assert.equal(replaced.nodes.some(n => n.speciesIndex === 1), false, 'the old branch is gone');
  const restored = result.undo();
  const restoredNode = restored.nodes.find(n => n.id === child0);
  assert.deepEqual(plain(restoredNode.recipe.parents), [1, 26], 'undo restores the previous recipe');
});

test('status and notes survive expanding an unrelated branch and validate', () => {
  const planner = createPlanner();
  const r089 = planner.findRecipe(2, 'shrine', [0, 89]);
  const r901 = planner.findRecipe(89, 'shrine', [90, 1]);
  let plan = planner.createPlan(2, 'shrine');
  plan = planner.expand(plan, plan.rootId, r089);
  const rootNode = plan.nodes[0];
  const child0 = rootNode.children[0];
  const child89 = rootNode.children[1];
  plan = planner.setStatus(plan, child0, 'completed');
  plan = planner.setNote(plan, child0, 'first step');
  plan = planner.expand(plan, child89, r901);
  const after = plan.nodes.find(n => n.id === child0);
  assert.equal(after.status, 'completed');
  assert.equal(after.note, 'first step');
  assert.doesNotThrow(() => planner.validate(plan));
});

test('roster links are hints and duplicateRosterWarnings flags reuse', () => {
  const planner = createPlanner();
  const r089 = planner.findRecipe(2, 'shrine', [0, 89]);
  let plan = planner.createPlan(2, 'shrine');
  plan = planner.expand(plan, plan.rootId, r089);
  const rootNode = plan.nodes[0];
  const child0 = rootNode.children[0];
  const child89 = rootNode.children[1];
  plan = planner.setFulfillment(plan, child0, { choice: 'roster', rosterEntryId: 'entry-1' });
  assert.equal(plan.nodes.find(n => n.id === child0).status, 'needed', 'a roster link does not change status');
  plan = planner.setFulfillment(plan, child89, { choice: 'roster', rosterEntryId: 'entry-1' });
  const warnings = planner.duplicateRosterWarnings(plan);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].entryId, 'entry-1');
  assert.deepEqual(plain(warnings[0].nodeIds.slice().sort()), plain([child0, child89].slice().sort()));
  plan = planner.setStatus(plan, child0, 'completed');
  assert.equal(planner.duplicateRosterWarnings(plan).length, 0, 'a completed usage is not a warning');
});

test('expand enforces depth and node bounds', () => {
  const planner = createPlanner();
  let plan = planner.createPlan(2, 'shrine');
  for (let i = 0; i < depthChain.length; i++) {
    const step = depthChain[i];
    const node = nodeAtPath(plan, step.path);
    const recipe = planner.findRecipe(node.speciesIndex, 'shrine', step.recipe);
    plan = planner.expand(plan, node.id, recipe);
  }
  const deepest = nodeAtPath(plan, depthOverflow.path);
  const overflowRecipe = planner.findRecipe(deepest.speciesIndex, 'shrine', depthOverflow.recipe);
  assert.throws(() => planner.expand(plan, deepest.id, overflowRecipe), err => err.code === 'limit',
    'expanding past MAX_PLAN_DEPTH throws limit');

  let wide = planner.createPlan(2, 'shrine');
  for (let i = 0; i < wideTreeExpansions.length - 1; i++) {
    const step = wideTreeExpansions[i];
    const node = nodeAtPath(wide, step.path);
    const recipe = planner.findRecipe(node.speciesIndex, 'shrine', step.recipe);
    wide = planner.expand(wide, node.id, recipe);
  }
  assert.equal(wide.nodes.length, 99, '49 expansions reach 99 nodes');
  const last = wideTreeExpansions[wideTreeExpansions.length - 1];
  const lastNode = nodeAtPath(wide, last.path);
  const lastRecipe = planner.findRecipe(lastNode.speciesIndex, 'shrine', last.recipe);
  assert.throws(() => planner.expand(wide, lastNode.id, lastRecipe), err => err.code === 'limit',
    'expanding past MAX_PLAN_NODES throws limit');
});

test('validateContext flags tampered recipes without dropping notes or status', () => {
  const planner = createPlanner();
  const r089 = planner.findRecipe(2, 'shrine', [0, 89]);
  let plan = planner.createPlan(2, 'shrine');
  plan = planner.expand(plan, plan.rootId, r089);
  plan = planner.setNote(plan, plan.rootId, 'my note');
  plan = planner.setStatus(plan, plan.rootId, 'ready');
  const tampered = {
    ...plan,
    nodes: plan.nodes.map(n => n.id === plan.rootId
      ? { ...n, recipe: { parents: [0, 1], kind: 'base', context: 'shrine', condition: '', minPlus: null } }
      : n)
  };
  const flags = planner.validateContext(tampered);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].nodeId, plan.rootId);
  const root = tampered.nodes.find(n => n.id === plan.rootId);
  assert.equal(root.note, 'my note', 'the note is not dropped');
  assert.equal(root.status, 'ready', 'the status is not dropped');

  const roomRecipe = planner.findRecipe(19, 'room', [13, null]);
  const shrinePlan = planner.createPlan(19, 'shrine');
  const mismatched = {
    ...shrinePlan,
    nodes: shrinePlan.nodes.map(n => n.id === shrinePlan.rootId
      ? { ...n, recipe: { parents: [13, null], kind: 'flag_gated', context: 'room', condition: roomRecipe.condition, minPlus: null } }
      : n)
  };
  const contextFlags = planner.validateContext(mismatched);
  assert.equal(contextFlags.length, 1);
  assert.match(contextFlags[0].reason, /context/, 'a room recipe in a shrine plan is a context mismatch');
});

test('validate accepts API-built plans and rejects broken references', () => {
  const planner = createPlanner();
  const r089 = planner.findRecipe(2, 'shrine', [0, 89]);
  let plan = planner.createPlan(2, 'shrine');
  plan = planner.expand(plan, plan.rootId, r089);
  plan = planner.setStatus(plan, plan.nodes[0].children[0], 'ready');
  plan = planner.setNote(plan, plan.nodes[0].children[1], 'note');
  assert.doesNotThrow(() => planner.validate(plan));
  const broken = {
    ...plan,
    nodes: plan.nodes.map(n => n.id === plan.rootId ? { ...n, children: ['missing-id', n.children[1]] } : n)
  };
  assert.throws(() => planner.validate(broken), err => err.code === 'invalid');
});

test('room recipes require a room plan', () => {
  const planner = createPlanner();
  const roomRecipe = planner.findRecipe(19, 'room', [13, null]);
  const shrinePlan = planner.createPlan(19, 'shrine');
  assert.throws(() => planner.expand(shrinePlan, shrinePlan.rootId, roomRecipe), err => err.code === 'invalid',
    'a room recipe cannot be used in a shrine plan');
  const roomPlan = planner.createPlan(19, 'room');
  const expanded = planner.expand(roomPlan, roomPlan.rootId, roomRecipe);
  assert.deepEqual(plain(expanded.nodes[0].recipe.parents), [13, null]);
  const mateChild = expanded.nodes.find(n => n.parent === expanded.rootId && n.speciesIndex === null);
  assert.ok(mateChild, 'the wildcard mate child is a family-level requirement');
});

test('collapse removes a branch and clears the recipe', () => {
  const planner = createPlanner();
  const r089 = planner.findRecipe(2, 'shrine', [0, 89]);
  let plan = planner.createPlan(2, 'shrine');
  plan = planner.expand(plan, plan.rootId, r089);
  assert.equal(plan.nodes.length, 3);
  plan = planner.collapse(plan, plan.rootId);
  assert.equal(plan.nodes.length, 1);
  assert.equal(plan.nodes[0].recipe, null);
  assert.equal(plan.nodes[0].children, null);
});

test('planSummary counts statuses and depth', () => {
  const planner = createPlanner();
  const r089 = planner.findRecipe(2, 'shrine', [0, 89]);
  let plan = planner.createPlan(2, 'shrine');
  plan = planner.expand(plan, plan.rootId, r089);
  plan = planner.setStatus(plan, plan.nodes[0].children[0], 'completed');
  plan = planner.setStatus(plan, plan.nodes[0].children[1], 'ready');
  const summary = planner.planSummary(plan);
  assert.equal(summary.total, 3);
  assert.equal(summary.completed, 1);
  assert.equal(summary.ready, 1);
  assert.equal(summary.needed, 1);
  assert.equal(summary.depth, 1);
});

test('suggestions paginate', () => {
  const planner = createPlanner();
  const page0 = planner.suggestions(2, { context: 'shrine', page: 0, pageSize: 5 });
  assert.equal(page0.items.length, 5);
  assert.equal(page0.page, 0);
  assert.equal(page0.pageSize, 5);
  assert.equal(page0.pages, Math.ceil(page0.total / 5));
  const page1 = planner.suggestions(2, { context: 'shrine', page: 1, pageSize: 5 });
  assert.equal(page1.items.length, 5);
  const ids0 = new Set(page0.items.map(r => r.id));
  assert.ok(page1.items.every(r => !ids0.has(r.id)), 'pages do not overlap');
});

test('suggestionCount and findRecipe agree with suggestions', () => {
  const planner = createPlanner();
  const context = 'shrine';
  const count = planner.suggestionCount(17, context);
  const all = planner.suggestions(17, { context, pageSize: 1000 });
  assert.equal(count, all.total);
  const plus = all.items.find(r => r.kind === 'plus_threshold');
  const found = planner.findRecipe(17, context, plus.parents);
  assert.ok(found);
  assert.equal(found.id, plus.id);
  assert.equal(planner.findRecipe(17, context, [13, 101]), null);
});

test('every suggestion carries the dataset unknowns', () => {
  const planner = createPlanner();
  const result = planner.suggestions(0, { context: 'shrine', pageSize: 5 });
  for (const item of result.items) {
    const joined = item.unknowns.join(' ');
    assert.match(joined, /acquisition/i);
    assert.match(joined, /sex/i);
    assert.match(joined, /inherit/i);
    assert.match(joined, /eligibility/i);
  }
  const plus = planner.suggestions(17, { context: 'shrine', pageSize: 100 }).items.find(r => r.kind === 'plus_threshold');
  assert.ok(plus.unknowns.some(u => u.indexOf('minimum') !== -1), 'the plus recipe notes the + minimum');
});

test('exposes plan bounds and target statuses', () => {
  const planner = createPlanner();
  assert.equal(planner.MAX_PLAN_DEPTH, 12);
  assert.equal(planner.MAX_PLAN_NODES, 100);
  assert.deepEqual(plain(planner.TARGET_STATUSES), ['needed', 'ready', 'completed']);
});

test('create validates its inputs', () => {
  const context = loadScripts([
    path.join(REPO_ROOT, 'data', 'breeding-data.js'),
    path.join(REPO_ROOT, 'js', 'planner-core.js'),
    path.join(REPO_ROOT, 'js', 'recipe-planner.js'),
  ]);
  assert.throws(() => context.DQMRecipePlanner.create(null, context.DQMPlannerCore), err => err.code === 'invalid');
  assert.throws(() => context.DQMRecipePlanner.create(context.DATA, null), err => err.code === 'invalid');
});

test('room context prefers the room override over a plus rule for the same pair', () => {
  const planner = createPlanner();
  const samePair = item => item.parents[0] === 252 && item.parents[1] === 252;
  const room = planner.suggestions(253, { context: 'room', pageSize: 5000 }).items.filter(samePair);
  assert.equal(room.length, 1);
  assert.equal(room[0].kind, 'flag_gated');
  const shrine = planner.suggestions(253, { context: 'shrine', pageSize: 5000 }).items.filter(samePair);
  assert.equal(shrine.length, 1);
  assert.equal(shrine[0].kind, 'plus_threshold');
});

test('suggestions only use playable parents', () => {
  const planner = createPlanner();
  for (const context of ['base', 'shrine', 'room']) {
    for (const item of planner.suggestions(0, { context, pageSize: 5000 }).items) {
      assert.ok(item.parents[0] >= 0 && item.parents[0] < 315, 'pedigree is playable');
      assert.ok(item.parents[1] === null || (item.parents[1] >= 0 && item.parents[1] < 315), 'mate is playable or a wildcard');
    }
  }
});

test('ranking puts roster recipes first and keeps the documented tie order', () => {
  const planner = createPlanner();
  const all = planner.suggestions(0, { context: 'base', pageSize: 5000 }).items;
  const last = all[all.length - 1];
  const reranked = planner.suggestions(0, { context: 'base', rosterSpecies: last.parents, pageSize: 5000 }).items;
  assert.deepEqual([reranked[0].parents[0], reranked[0].parents[1]], [last.parents[0], last.parents[1]]);
  assert.ok(reranked[0].rosterParents.length > 0);
  const kindRank = { base: 0, plus_threshold: 1, flag_gated: 2 };
  for (let i = 1; i < all.length; i += 1) {
    const prev = all[i - 1];
    const cur = all[i];
    const cmp = kindRank[prev.kind] - kindRank[cur.kind] || prev.parents[0] - cur.parents[0] || prev.parents[1] - cur.parents[1];
    assert.ok(cmp <= 0, 'stable order at index ' + i);
  }
});

test('a recipe is canonicalized to the verified condition and flagged when tampered', () => {
  const planner = createPlanner();
  const plan = planner.createPlan(17, 'shrine');
  const expanded = planner.expand(plan, plan.rootId, { parents: [1, 1], kind: 'plus_threshold', context: 'shrine', condition: 'ignored', minPlus: 255 });
  const root = expanded.nodes.find(node => node.id === expanded.rootId);
  assert.equal(root.recipe.minPlus, 4);
  assert.match(root.recipe.condition, /\+4/);
  root.recipe.minPlus = 255;
  const flags = planner.validateContext(expanded);
  assert.ok(flags.some(flag => flag.nodeId === root.id), 'a tampered + threshold is flagged');
});

test('a recipe cannot be stored under a context other than the plan context', () => {
  const planner = createPlanner();
  const plan = planner.createPlan(2, 'shrine');
  assert.throws(
    () => planner.expand(plan, plan.rootId, { parents: [0, 89], kind: 'base', context: 'room', condition: '', minPlus: null }),
    err => err.code === 'invalid'
  );
  const roomPlan = planner.createPlan(52, 'room');
  const expanded = planner.expand(roomPlan, roomPlan.rootId, { parents: [45, 97], kind: 'flag_gated', context: 'room', condition: '', minPlus: null });
  assert.ok(planner.validate(expanded));
  const shrinePlan = planner.createPlan(52, 'shrine');
  assert.throws(
    () => planner.expand(shrinePlan, shrinePlan.rootId, { parents: [45, 97], kind: 'flag_gated', context: 'room', condition: '', minPlus: null }),
    err => err.code === 'invalid'
  );
});

test('validate accepts a stored recipe whose context differs; validateContext flags it', () => {
  const planner = createPlanner();
  const roomPlan = planner.createPlan(19, 'room');
  const expanded = planner.expand(roomPlan, roomPlan.rootId, {
    parents: [13, null], kind: 'flag_gated', context: 'room', condition: '', minPlus: null,
  });
  // Switching the plan back to shrine keeps the stored room recipe in place.
  const switched = { ...expanded, context: 'shrine' };
  assert.ok(planner.validate(switched));
  const flags = planner.validateContext(switched);
  assert.equal(flags.length, 1);
  assert.equal(flags[0].nodeId, switched.rootId);
});

test('expanding a plan restored by a fresh instance does not reuse node ids', () => {
  const before = createPlanner();
  let plan = before.createPlan(2, 'shrine');
  plan = before.expand(plan, plan.rootId, before.findRecipe(2, 'shrine', [0, 89]));
  const drake = plan.nodes.find(node => node.speciesIndex === 0 && node.parent === plan.rootId);
  assert.ok(drake, 'the pedigree child exists');
  // A reload builds a new instance whose id counter restarts at zero.
  const after = createPlanner();
  const next = after.expand(plan, drake.id, after.findRecipe(0, 'shrine', [1, 26]));
  const ids = next.nodes.map(node => node.id);
  assert.equal(new Set(ids).size, ids.length, 'node ids stay unique after a reload');
  assert.ok(after.validate(next));
});

test('validateContext flags a base recipe that a Breeding room override supersedes', () => {
  const planner = createPlanner();
  const shrinePlan = planner.createPlan(2, 'shrine');
  const expanded = planner.expand(shrinePlan, shrinePlan.rootId, planner.findRecipe(2, 'shrine', [11, 101]));
  assert.equal(planner.validateContext(expanded).length, 0);
  const room = { ...expanded, context: 'room' };
  const flags = planner.validateContext(room);
  assert.equal(flags.length, 1);
  assert.match(flags[0].reason, /Breeding room override/);

  // The override also matches by mate family (Ghost belongs to the Zombie family).
  const wildPlan = planner.createPlan(6, 'shrine');
  const wildExpanded = planner.expand(wildPlan, wildPlan.rootId, planner.findRecipe(6, 'shrine', [13, 199]));
  assert.equal(planner.validateContext(wildExpanded).length, 0);
  const wildRoom = { ...wildExpanded, context: 'room' };
  assert.equal(planner.validateContext(wildRoom).length, 1);

  // The room override recipe is clean in the room context and flagged in shrine.
  const roomPlan = planner.createPlan(25, 'room');
  const expandedRoom = planner.expand(roomPlan, roomPlan.rootId, planner.findRecipe(25, 'room', [11, 101]));
  assert.equal(planner.validateContext(expandedRoom).length, 0);
  const backToShrine = { ...expandedRoom, context: 'shrine' };
  assert.equal(planner.validateContext(backToShrine).length, 1);
});
