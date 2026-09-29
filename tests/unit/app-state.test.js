'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('../helpers/load-scripts');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const context = loadScripts([
  path.join(REPO_ROOT, 'data', 'breeding-data.js'),
  path.join(REPO_ROOT, 'js', 'planner-core.js'),
  path.join(REPO_ROOT, 'js', 'app-state.js'),
  path.join(REPO_ROOT, 'js', 'storage.js'),
]);
const core = context.DQMPlannerCore.create(context.DATA);
const api = context.DQMAppState.create(context.DATA, core);
const DQMStorage = context.DQMStorage;

// Objects created inside the vm context have a different Object.prototype,
// so deepStrictEqual comparisons round-trip through JSON first.
const plain = value => JSON.parse(JSON.stringify(value));

function assertCode(fn, code) {
  let thrown = null;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown, 'expected the call to throw');
  assert.equal(thrown.code, code);
  assert.equal(typeof thrown.message, 'string');
}

const legacyTeam = () => ({
  version: 1,
  game: 'dqm1-2-ps1-v61',
  entries: [
    { id: 'm-1', speciesIndex: 11, sex: 'male', plus: 0, nickname: '' },
    { id: 'm-2', speciesIndex: 99, sex: 'female', plus: 4, nickname: 'Drake' },
  ],
});

const legacyEntries = () => [
  { id: 'm-1', speciesIndex: 11, sex: 'male', plus: 0, nickname: '', favorite: false },
  { id: 'm-2', speciesIndex: 99, sex: 'female', plus: 4, nickname: 'Drake', favorite: false },
];

test('defaultState validates, holds one named team, and round-trips through toJSON', () => {
  const state = api.defaultState();
  const normalized = api.normalizeDocument(state);
  assert.equal(normalized.teams.length, 1);
  assert.equal(normalized.teams[0].name, 'My team');
  assert.equal(normalized.spriteStyle, 'portrait');
  assert.deepEqual(plain(normalized.favoriteSpeciesIndices), []);
  assert.equal(normalized.activeTeamId, normalized.teams[0].id);
  assert.equal(normalized.teams[0].entries.length, 0);
  assert.equal(normalized.teams[0].targets.length, 0);
  assert.equal(normalized.teams[0].activeTargetId, null);

  const summary = api.summarize(state);
  assert.deepEqual(plain(summary), { teams: 1, entries: 0, targets: 0, favorites: 0 });

  const text = api.toJSON(state);
  assert.ok(text.endsWith('\n'));
  assert.deepEqual(plain(api.parseDocument(text)), plain(state));
  assert.deepEqual(plain(api.normalizeDocument(JSON.parse(text))), plain(state));
});

test('defaultState returns a fresh document on every call', () => {
  const first = api.defaultState();
  const second = api.defaultState();
  assert.notEqual(first, second);
  assert.notEqual(first.teams[0].id, second.teams[0].id);
});

test('migrateFromLegacy migrates a legacy team and the sprite style', () => {
  const state = api.migrateFromLegacy({
    teamText: JSON.stringify(legacyTeam()),
    spriteText: 'overworld',
  });
  assert.equal(state.spriteStyle, 'overworld');
  assert.equal(state.teams.length, 1);
  assert.equal(state.teams[0].name, 'My team');
  assert.equal(state.activeTeamId, state.teams[0].id);
  assert.deepEqual(plain(state.teams[0].entries), legacyEntries());
});

test('migrateFromLegacy falls back to the default document for malformed legacy input', () => {
  for (const teamText of ['not json', '', '   ', '{"version":1', '[]', 'null']) {
    const state = api.migrateFromLegacy({ teamText, spriteText: 'portrait' });
    assert.equal(state.teams.length, 1);
    assert.equal(state.teams[0].name, 'My team');
    assert.equal(state.teams[0].entries.length, 0);
    assert.equal(state.spriteStyle, 'portrait');
    assert.equal(state.activeTeamId, state.teams[0].id);
  }
  const spriteOnly = api.migrateFromLegacy({ teamText: '{{{', spriteText: 'overworld' });
  assert.equal(spriteOnly.spriteStyle, 'overworld');
  assert.equal(spriteOnly.teams[0].entries.length, 0);
});

test('importAny imports a legacy team export as a single named team', () => {
  const result = api.importAny(JSON.stringify(legacyTeam()));
  assert.equal(result.kind, 'legacy');
  assert.equal(result.summary.teams, 1);
  assert.equal(result.summary.entries, 2);
  assert.equal(result.state.teams.length, 1);
  assert.equal(result.state.teams[0].name, 'My team');
  assert.equal(result.state.activeTeamId, result.state.teams[0].id);
  assert.deepEqual(plain(result.state.teams[0].entries), legacyEntries());
});

test('importAny imports a full backup as a full document', () => {
  const state = api.addTeam(api.defaultState(), 'Second');
  const result = api.importAny(api.toJSON(state));
  assert.equal(result.kind, 'full');
  assert.equal(result.summary.teams, 2);
  assert.deepEqual(plain(result.state), plain(state));
});

test('teamFromLegacy accepts a full document and extracts its first team', () => {
  let state = api.defaultState();
  state = api.addEntry(state, state.teams[0].id, { speciesIndex: 5, sex: 'male', plus: 1, nickname: '' });
  const extracted = api.teamFromLegacy(state, 'Extracted');
  assert.equal(extracted.name, 'Extracted');
  assert.equal(extracted.entries.length, 1);
  assert.equal(extracted.entries[0].speciesIndex, 5);
  assert.equal(extracted.activeTargetId, null);
  assert.deepEqual(plain(extracted.targets), []);

  // A document whose first team has no entries is rejected.
  assertCode(() => api.teamFromLegacy(api.defaultState()), 'invalid');
});

test('parseLegacyTeam parses text and rejects invalid JSON', () => {
  const team = api.parseLegacyTeam(JSON.stringify(legacyTeam()), 'Old save');
  assert.equal(team.name, 'Old save');
  assert.equal(team.entries.length, 2);
  assertCode(() => api.parseLegacyTeam('nope'), 'invalid');
});

test('a mutated document survives a full backup round trip', () => {
  let state = api.defaultState();
  const teamId = state.teams[0].id;
  state = api.addTeam(state, 'Second team');
  state = api.addEntry(state, teamId, { speciesIndex: 11, sex: 'male', plus: 3, nickname: 'Bud', favorite: true });
  state = api.setSpeciesFavorite(state, 11, true);
  state = api.setSpeciesFavorite(state, 7, true);
  state = api.addTarget(state, teamId, 99);
  const targetId = state.teams[0].targets[0].id;
  state = api.setTargetPlan(state, teamId, targetId, {
    id: 'n1', speciesIndex: 99, status: 'needed',
    children: [{ id: 'n2', speciesIndex: 11, status: 'ready' }],
  });

  const text = api.toJSON(state);
  const imported = api.importAny(text);
  assert.equal(imported.kind, 'full');
  assert.deepEqual(plain(imported.state), plain(state));
  assert.deepEqual(plain(api.normalizeDocument(JSON.parse(text))), plain(state));
  assert.equal(imported.summary.teams, 2);
  assert.equal(imported.summary.entries, 1);
  assert.equal(imported.summary.targets, 1);
  assert.equal(imported.summary.favorites, 2);
});

test('normalizeDocument rejects newer, invalid, and wrong-game documents', () => {
  let state = api.defaultState();
  const teamId = state.teams[0].id;
  state = api.addEntry(state, teamId, { speciesIndex: 11, sex: 'male', plus: 0, nickname: '' });
  state = api.addEntry(state, teamId, { speciesIndex: 99, sex: 'female', plus: 4, nickname: 'Drake' });
  state = api.addTarget(state, teamId, 50);

  const newerError = (() => {
    try {
      api.normalizeDocument({ ...plain(state), version: 3 });
      return null;
    } catch (error) {
      return error;
    }
  })();
  assert.ok(api.isNewerError(newerError));
  assert.equal(api.errorCode(newerError), 'newer');
  assert.equal(api.errorCode(new Error('plain')), undefined);
  assert.equal(api.errorCode(null), undefined);

  assertCode(() => api.normalizeDocument({ ...plain(state), version: 2 }), 'newer');
  assertCode(() => api.importAny(JSON.stringify({ ...plain(state), version: 2 })), 'newer');
  // A newer version is reported before any other interpretation of the file.
  assertCode(() => api.importAny('{"version":2,"teams":[]}'), 'newer');
  assertCode(() => api.importAny('{"version":2,"entries":[]}'), 'newer');
  assertCode(() => api.normalizeDocument({ ...plain(state), version: 'x' }), 'invalid');
  assertCode(() => api.normalizeDocument({ ...plain(state), game: 'dqm1-2-ps1-v60' }), 'game');
  assertCode(() => api.importAny(JSON.stringify({ ...plain(state), game: 'other' })), 'game');

  const base = () => plain(state);
  let doc = base();
  delete doc.teams[0].entries[0].id;
  assertCode(() => api.normalizeDocument(doc), 'invalid');

  doc = base();
  doc.teams[0].entries[1] = { ...doc.teams[0].entries[0] };
  assertCode(() => api.normalizeDocument(doc), 'invalid');

  doc = base();
  doc.teams[0].entries[0].speciesIndex = 315;
  assertCode(() => api.normalizeDocument(doc), 'invalid');

  doc = base();
  doc.teams[0].entries[0].sex = 'other';
  assertCode(() => api.normalizeDocument(doc), 'invalid');

  doc = base();
  doc.teams[0].entries[0].plus = 256;
  assertCode(() => api.normalizeDocument(doc), 'invalid');

  doc = base();
  doc.teams[0].entries[0].nickname = 42;
  assertCode(() => api.normalizeDocument(doc), 'invalid');

  doc = base();
  delete doc.teams[0].entries[0].favorite;
  assertCode(() => api.normalizeDocument(doc), 'invalid');

  doc = base();
  doc.teams[0].targets.push({ ...doc.teams[0].targets[0] });
  assertCode(() => api.normalizeDocument(doc), 'invalid');

  doc = base();
  doc.activeTeamId = 'missing';
  assertCode(() => api.normalizeDocument(doc), 'invalid');

  doc = base();
  doc.teams[0].activeTargetId = 'missing';
  assertCode(() => api.normalizeDocument(doc), 'invalid');

  doc = base();
  doc.favoriteSpeciesIndices = [11, 11];
  assertCode(() => api.normalizeDocument(doc), 'invalid');

  doc = base();
  doc.spriteStyle = 'pixel';
  assertCode(() => api.normalizeDocument(doc), 'invalid');

  doc = base();
  doc.teams = [];
  assertCode(() => api.normalizeDocument(doc), 'invalid');

  doc = base();
  doc.teams[0].targets[0].speciesIndex = 315;
  assertCode(() => api.normalizeDocument(doc), 'invalid');

  doc = base();
  doc.teams[0].targets[0].plan = [1, 2];
  assertCode(() => api.normalizeDocument(doc), 'invalid');

  assertCode(() => api.importAny('{"foo":1}'), 'invalid');
  assertCode(() => api.importAny('not json'), 'invalid');
  assertCode(() => api.parseDocument('not json'), 'invalid');
  assertCode(() => api.parseDocument('{"version":2}'), 'newer');
  assertCode(() => api.parseDocument('x'.repeat(api.MAX_IMPORT_LENGTH + 1)), 'invalid');
});

test('normalizeDocument sorts favorite species indices', () => {
  const doc = { ...plain(api.defaultState()), favoriteSpeciesIndices: [20, 3, 9] };
  assert.deepEqual(plain(api.normalizeDocument(doc).favoriteSpeciesIndices), [3, 9, 20]);
});

test('mutators enforce the team, entry, and target limits', () => {
  let state = api.defaultState();
  const teamId = state.teams[0].id;
  for (let i = 0; i < api.MAX_ENTRIES; i += 1) {
    state = api.addEntry(state, teamId, { speciesIndex: i % 315, sex: 'male', plus: 0, nickname: '' });
  }
  assert.equal(state.teams[0].entries.length, 100);
  assertCode(() => api.addEntry(state, teamId, { speciesIndex: 1, sex: 'male', plus: 0, nickname: '' }), 'limit');

  for (let i = state.teams.length; i < api.MAX_TEAMS; i += 1) state = api.addTeam(state, 'Team ' + i);
  assert.equal(state.teams.length, 20);
  assertCode(() => api.addTeam(state, 'One too many'), 'limit');

  let targetState = api.defaultState();
  const targetTeamId = targetState.teams[0].id;
  for (let i = 0; i < api.MAX_TARGETS; i += 1) {
    targetState = api.addTarget(targetState, targetTeamId, i);
  }
  assert.equal(targetState.teams[0].targets.length, 50);
  assertCode(() => api.addTarget(targetState, targetTeamId, 50), 'limit');

  const manyTeams = [];
  for (let i = 0; i < api.MAX_TEAMS + 1; i += 1) {
    manyTeams.push({ id: 't-' + i, name: 'T' + i, entries: [], activeTargetId: null, targets: [] });
  }
  assertCode(() => api.normalizeDocument({ ...plain(api.defaultState()), teams: manyTeams }), 'limit');
});

test('adding a duplicate species target activates it without growing the list', () => {
  let state = api.defaultState();
  const teamId = state.teams[0].id;
  state = api.addTarget(state, teamId, 11);
  const firstId = state.teams[0].targets[0].id;
  state = api.addTarget(state, teamId, 99);
  assert.equal(state.teams[0].activeTargetId, state.teams[0].targets[1].id);
  state = api.addTarget(state, teamId, 11);
  assert.equal(state.teams[0].targets.length, 2);
  assert.equal(state.teams[0].activeTargetId, firstId);
});

test('entry favorites survive updates, follow removals, and leave targets unaffected', () => {
  let state = api.defaultState();
  const teamId = state.teams[0].id;
  state = api.addEntry(state, teamId, { speciesIndex: 11, sex: 'male', plus: 0, nickname: '', favorite: true });
  const entryId = state.teams[0].entries[0].id;
  assert.equal(state.teams[0].entries[0].favorite, true);

  state = api.updateEntry(state, teamId, entryId, { nickname: 'Star' });
  assert.equal(state.teams[0].entries[0].favorite, true);
  assert.equal(state.teams[0].entries[0].nickname, 'Star');

  state = api.setEntryFavorite(state, teamId, entryId, false);
  assert.equal(state.teams[0].entries[0].favorite, false);

  state = api.addTarget(state, teamId, 11);
  state = api.removeEntry(state, teamId, entryId);
  assert.equal(state.teams[0].entries.length, 0);
  assert.equal(state.teams[0].targets.length, 1);
});

test('species favorites toggle both ways and stay sorted and unique', () => {
  let state = api.defaultState();
  state = api.setSpeciesFavorite(state, 9, true);
  assert.deepEqual(plain(state.favoriteSpeciesIndices), [9]);
  state = api.setSpeciesFavorite(state, 3, true);
  state = api.setSpeciesFavorite(state, 20, true);
  assert.deepEqual(plain(state.favoriteSpeciesIndices), [3, 9, 20]);
  state = api.setSpeciesFavorite(state, 9, true);
  assert.deepEqual(plain(state.favoriteSpeciesIndices), [3, 9, 20]);
  state = api.toggleSpeciesFavorite(state, 9);
  assert.deepEqual(plain(state.favoriteSpeciesIndices), [3, 20]);
  state = api.toggleSpeciesFavorite(state, 9);
  assert.deepEqual(plain(state.favoriteSpeciesIndices), [3, 9, 20]);
  assertCode(() => api.setSpeciesFavorite(state, 315, true), 'invalid');
  assertCode(() => api.toggleSpeciesFavorite(state, 315), 'invalid');
  assertCode(() => api.setSpeciesFavorite(state, 11, 'yes'), 'invalid');
});

test('targets stay isolated within a team', () => {
  let state = api.defaultState();
  const teamId = state.teams[0].id;
  state = api.addTarget(state, teamId, 11);
  state = api.addTarget(state, teamId, 99);
  const [first, second] = state.teams[0].targets;
  assert.equal(state.teams[0].activeTargetId, second.id);

  state = api.setTargetPlan(state, teamId, first.id, { id: 'n1', speciesIndex: 11 });
  assert.deepEqual(plain(state.teams[0].targets[0].plan), { id: 'n1', speciesIndex: 11 });
  assert.equal(state.teams[0].targets[1].plan, null);

  state = api.setActiveTarget(state, teamId, first.id);
  assert.equal(state.teams[0].activeTargetId, first.id);

  state = api.removeTarget(state, teamId, first.id);
  assert.equal(state.teams[0].targets.length, 1);
  assert.equal(state.teams[0].activeTargetId, second.id);

  state = api.removeTarget(state, teamId, second.id);
  assert.equal(state.teams[0].targets.length, 0);
  assert.equal(state.teams[0].activeTargetId, null);
});

test('setTargetPlan enforces the plan size, node, and depth bounds', () => {
  let state = api.defaultState();
  const teamId = state.teams[0].id;
  state = api.addTarget(state, teamId, 11);
  const targetId = state.teams[0].targets[0].id;

  const deep = { id: 'root' };
  let node = deep;
  for (let i = 0; i < api.MAX_PLAN_DEPTH + 1; i += 1) {
    node.children = [{ id: 'n' + i }];
    node = node.children[0];
  }
  assertCode(() => api.setTargetPlan(state, teamId, targetId, deep), 'limit');

  const wide = { id: 'root', children: [] };
  for (let i = 0; i < api.MAX_PLAN_NODES + 1; i += 1) wide.children.push({ id: 'n' + i });
  assertCode(() => api.setTargetPlan(state, teamId, targetId, wide), 'limit');

  const circular = { id: 'root' };
  circular.children = [circular];
  assertCode(() => api.setTargetPlan(state, teamId, targetId, circular), 'invalid');

  state = api.setTargetPlan(state, teamId, targetId, null);
  assert.equal(state.teams[0].targets[0].plan, null);
});

test('teams switch, rename, and delete with the active team preserved', () => {
  let state = api.defaultState();
  const firstId = state.teams[0].id;
  state = api.addTeam(state, 'Second');
  const secondId = state.teams[1].id;
  state = api.addEntry(state, secondId, { speciesIndex: 5, sex: 'female', plus: 2, nickname: '' });
  state = api.addTarget(state, secondId, 50);

  state = api.setActiveTeam(state, secondId);
  assert.equal(state.activeTeamId, secondId);

  state = api.renameTeam(state, secondId, '  Renamed  ');
  assert.equal(state.teams[1].name, 'Renamed');

  state = api.deleteTeam(state, secondId);
  assert.equal(state.teams.length, 1);
  assert.equal(state.activeTeamId, firstId);
  assert.equal(state.teams[0].entries.length, 0);
  assert.equal(state.teams[0].targets.length, 0);

  state = api.deleteTeam(state, firstId);
  assert.equal(state.teams.length, 1);
  assert.equal(state.teams[0].name, 'My team');
  assert.notEqual(state.teams[0].id, firstId);
  assert.equal(state.activeTeamId, state.teams[0].id);
  assert.equal(state.teams[0].entries.length, 0);
  assert.equal(state.teams[0].targets.length, 0);
  assert.deepEqual(plain(api.normalizeDocument(state)), plain(state));

  assertCode(() => api.renameTeam(state, 'missing', 'X'), 'invalid');
  assertCode(() => api.deleteTeam(state, 'missing'), 'invalid');
  assertCode(() => api.setActiveTeam(state, 'missing'), 'invalid');
  assertCode(() => api.addEntry(state, 'missing', { speciesIndex: 1, sex: 'male', plus: 0, nickname: '' }), 'invalid');
});

test('team names are trimmed and sliced to the maximum length', () => {
  const padded = api.addTeam(api.defaultState(), '   Padded name   ');
  assert.equal(padded.teams[1].name, 'Padded name');
  const long = api.addTeam(api.defaultState(), 'x'.repeat(100));
  assert.equal(long.teams[1].name.length, api.MAX_NAME_LENGTH);
  assertCode(() => api.addTeam(api.defaultState(), '   '), 'invalid');
  assertCode(() => api.addTeam(api.defaultState(), ''), 'invalid');
  assertCode(() => api.addTeam(api.defaultState(), 42), 'invalid');
});

test('insertTeam appends a validated team without changing the active team', () => {
  let state = api.defaultState();
  const firstId = state.activeTeamId;
  const team = api.parseLegacyTeam(JSON.stringify(legacyTeam()), 'Imported');
  state = api.insertTeam(state, team);
  assert.equal(state.teams.length, 2);
  assert.equal(state.teams[1].name, 'Imported');
  assert.equal(state.teams[1].entries.length, 2);
  assert.equal(state.activeTeamId, firstId);
  assert.deepEqual(plain(api.normalizeDocument(state)), plain(state));
  assertCode(() => api.insertTeam(state, { ...team, id: state.teams[0].id }), 'invalid');
  let full = api.defaultState();
  for (let i = 1; i < api.MAX_TEAMS; i += 1) full = api.addTeam(full, 'T' + i);
  assertCode(() => api.insertTeam(full, team), 'limit');
});

test('addEntry validates the monster and generates unique ids', () => {
  let state = api.defaultState();
  const teamId = state.teams[0].id;
  state = api.addEntry(state, teamId, { speciesIndex: 11, sex: 'male', plus: 0, nickname: '' });
  state = api.addEntry(state, teamId, { speciesIndex: 11, sex: 'female', plus: 0, nickname: '' });
  assert.notEqual(state.teams[0].entries[0].id, state.teams[0].entries[1].id);
  assertCode(() => api.addEntry(state, teamId, { speciesIndex: 315, sex: 'male', plus: 0, nickname: '' }), 'invalid');
  assertCode(() => api.addEntry(state, teamId, { sex: 'male' }), 'invalid');
});

test('updateEntry preserves the entry id and validates patches', () => {
  let state = api.defaultState();
  const teamId = state.teams[0].id;
  state = api.addEntry(state, teamId, { speciesIndex: 11, sex: 'male', plus: 0, nickname: '' });
  const entryId = state.teams[0].entries[0].id;
  state = api.updateEntry(state, teamId, entryId, { id: 'hacked', plus: 9 });
  assert.equal(state.teams[0].entries[0].id, entryId);
  assert.equal(state.teams[0].entries[0].plus, 9);
  assertCode(() => api.updateEntry(state, teamId, entryId, { sex: 'other' }), 'invalid');
  assertCode(() => api.updateEntry(state, teamId, 'missing', { plus: 1 }), 'invalid');
});

test('setSpriteStyle validates the style', () => {
  assert.equal(api.setSpriteStyle(api.defaultState(), 'overworld').spriteStyle, 'overworld');
  assertCode(() => api.setSpriteStyle(api.defaultState(), 'pixel'), 'invalid');
});

test('findTeam and findTarget locate saved records', () => {
  let state = api.defaultState();
  const teamId = state.teams[0].id;
  state = api.addTarget(state, teamId, 11);
  const targetId = state.teams[0].targets[0].id;
  assert.equal(api.findTeam(state, teamId).id, teamId);
  assert.equal(api.findTeam(state, 'missing'), null);
  assert.equal(api.findTarget(state, teamId, targetId).speciesIndex, 11);
  assert.equal(api.findTarget(state, teamId, 'missing'), null);
  assert.equal(api.findTarget(state, 'missing', targetId), null);
});

test('makeId generates unique ids that match the required pattern', () => {
  const pattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
  const seen = new Set();
  for (let i = 0; i < 100; i += 1) {
    const id = api.makeId('t-');
    assert.ok(pattern.test(id), 'id must match the pattern: ' + id);
    assert.ok(!['constructor', 'prototype'].includes(id));
    assert.ok(!seen.has(id), 'ids must be unique');
    seen.add(id);
  }
});

test('mutators never mutate their inputs', () => {
  const deepFreeze = value => {
    if (value && typeof value === 'object') {
      Object.freeze(value);
      for (const key of Object.keys(value)) deepFreeze(value[key]);
    }
    return value;
  };
  const original = deepFreeze(api.defaultState());
  const teamId = original.teams[0].id;
  const snapshot = plain(original);

  let state = api.addTeam(original, 'Frozen');
  state = api.addEntry(state, teamId, { speciesIndex: 1, sex: 'male', plus: 0, nickname: '' });
  state = api.setSpeciesFavorite(state, 1, true);
  state = api.addTarget(state, teamId, 2);
  state = api.setSpriteStyle(state, 'overworld');
  state = api.renameTeam(state, teamId, 'Still frozen');
  state = api.setActiveTeam(state, state.teams[1].id);

  assert.deepEqual(plain(original), snapshot);
  assert.equal(original.teams.length, 1);
  assert.equal(original.spriteStyle, 'portrait');
  assert.equal(state.teams.length, 2);
});

function fakeStorage() {
  const map = new Map();
  return {
    map,
    getItem(key) { return map.has(key) ? map.get(key) : null; },
    setItem(key, value) { map.set(key, String(value)); },
    removeItem(key) { map.delete(key); },
  };
}

function fakeEventTarget() {
  const listeners = [];
  return {
    listeners,
    addEventListener(type, listener) { listeners.push({ type, listener }); },
    removeEventListener(type, listener) {
      const index = listeners.findIndex(entry => entry.type === type && entry.listener === listener);
      if (index !== -1) listeners.splice(index, 1);
    },
    fire(event) {
      for (const entry of listeners.slice()) {
        if (entry.type === 'storage') entry.listener(event);
      }
    },
  };
}

test('the storage adapter reads, writes, and removes with an injected fake', () => {
  const store = fakeStorage();
  const adapter = DQMStorage.create({ storage: store, eventTarget: fakeEventTarget() });
  assert.equal(adapter.available(), true);
  assert.equal(adapter.write('k1', 'v1'), true);
  assert.equal(adapter.read('k1'), 'v1');
  assert.equal(store.map.get('k1'), 'v1');
  adapter.remove('k1');
  assert.equal(adapter.read('k1'), null);
  assert.equal(store.map.has('k1'), false);
  assert.equal(adapter.read('missing'), null);
});

test('the storage adapter survives a throwing storage', () => {
  const throwing = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('blocked'); },
    removeItem() { throw new Error('blocked'); },
  };
  const adapter = DQMStorage.create({ storage: throwing, eventTarget: fakeEventTarget() });
  assert.equal(adapter.available(), false);
  assert.equal(adapter.write('k', 'v'), false);
  assert.equal(adapter.read('k'), null);
  assert.doesNotThrow(() => adapter.remove('k'));
});

test('the storage adapter reports quota failures as a failed write', () => {
  const quota = {
    getItem() { return null; },
    setItem() {
      const error = new Error('quota exceeded');
      error.name = 'QuotaExceededError';
      throw error;
    },
    removeItem() {},
  };
  const adapter = DQMStorage.create({ storage: quota, eventTarget: fakeEventTarget() });
  assert.equal(adapter.available(), false);
  assert.equal(adapter.write('k', 'v'), false);
});

test('subscribe fires only for the matching key and unsubscribes cleanly', () => {
  const events = fakeEventTarget();
  const adapter = DQMStorage.create({ storage: fakeStorage(), eventTarget: events });
  const seen = [];
  const unsubscribe = adapter.subscribe('watched', value => seen.push(value));
  events.fire({ key: 'watched', newValue: 'a' });
  events.fire({ key: 'other', newValue: 'b' });
  assert.deepEqual(seen, ['a']);
  unsubscribe();
  assert.equal(events.listeners.length, 0);
  events.fire({ key: 'watched', newValue: 'c' });
  assert.deepEqual(seen, ['a']);
});

test('subscribe observes writes through a storage event', () => {
  const store = fakeStorage();
  const events = fakeEventTarget();
  const adapter = DQMStorage.create({ storage: store, eventTarget: events });
  const seen = [];
  adapter.subscribe('state', value => seen.push(value));
  adapter.write('state', '{"version":1}');
  events.fire({ key: 'state', newValue: store.map.get('state') });
  assert.deepEqual(seen, ['{"version":1}']);
});

test('subscribe is a no-op without an event target', () => {
  const adapter = DQMStorage.create({ storage: fakeStorage(), eventTarget: {} });
  const unsubscribe = adapter.subscribe('k', () => {});
  assert.doesNotThrow(() => unsubscribe());
});

test('create accepts either the DQMPlannerCore module or an instance', () => {
  const fromModule = context.DQMAppState.create(context.DATA, context.DQMPlannerCore);
  assert.equal(fromModule.summarize(fromModule.defaultState()).teams, 1);
  const fromInstance = context.DQMAppState.create(context.DATA, core);
  assert.equal(fromInstance.summarize(fromInstance.defaultState()).teams, 1);
});

test('setTargetPlan bounds real flat plan trees by parent depth and node count', () => {
  let state = api.defaultState();
  const teamId = state.teams[0].id;
  state = api.addTarget(state, teamId, 60);
  const targetId = state.teams[0].activeTargetId;
  const chain = [];
  for (let i = 0; i <= api.MAX_PLAN_DEPTH + 1; i += 1) {
    chain.push({ id: 'n' + i, parent: i === 0 ? null : 'n' + (i - 1) });
  }
  assertCode(() => api.setTargetPlan(state, teamId, targetId, { speciesIndex: 60, context: 'shrine', rootId: 'n0', nodes: chain }), 'limit');
  const wide = [];
  for (let i = 0; i <= api.MAX_PLAN_NODES; i += 1) wide.push({ id: 'w' + i, parent: null });
  assertCode(() => api.setTargetPlan(state, teamId, targetId, { speciesIndex: 60, context: 'shrine', rootId: 'w0', nodes: wide }), 'limit');
  const shallow = chain.slice(0, 3);
  state = api.setTargetPlan(state, teamId, targetId, { speciesIndex: 60, context: 'shrine', rootId: 'n0', nodes: shallow });
  assert.ok(state.teams[0].targets[0].plan);
});
