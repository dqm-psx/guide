const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { loadScripts } = require('../helpers/load-scripts');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function createCore() {
  const context = loadScripts([
    path.join(REPO_ROOT, 'data', 'breeding-data.js'),
    path.join(REPO_ROOT, 'js', 'planner-core.js'),
  ]);
  return context.DQMPlannerCore.create(context.DATA);
}

const validDocument = () => ({
  version: 1,
  game: 'dqm1-2-ps1-v61',
  entries: [
    { id: 'm-1', speciesIndex: 11, sex: 'male', plus: 0, nickname: '' },
    { id: 'm-2', speciesIndex: 99, sex: 'female', plus: 4, nickname: 'Drake' },
  ],
});

// Objects created inside the vm context have a different Object.prototype,
// so deepStrictEqual comparisons round-trip through JSON first.
const plain = value => JSON.parse(JSON.stringify(value));

test('ordered base pair results agree for a symmetric pair', () => {
  const core = createCore();
  const forward = core.result(150, 157, 0, 0, 'base');
  const reverse = core.result(157, 150, 0, 0, 'base');
  assert.equal(forward.resultIndex, 159);
  assert.equal(reverse.resultIndex, 159);
  assert.equal(forward.ruleKind, 'base');
  assert.equal(reverse.ruleKind, 'base');
});

test('ordered base pair results differ when reversed', () => {
  const core = createCore();
  const forward = core.result(0, 1, 0, 0, 'base');
  const reverse = core.result(1, 0, 0, 0, 'base');
  assert.equal(forward.resultIndex, 0);
  assert.equal(reverse.resultIndex, 1);
  assert.notEqual(forward.resultIndex, reverse.resultIndex);
});

test('plus threshold rule applies at or above the minimum + value', () => {
  const core = createCore();
  const below = core.result(1, 1, 3, 0, 'shrine');
  assert.equal(below.resultIndex, 1);
  assert.equal(below.ruleKind, 'base');
  const atThreshold = core.result(1, 1, 4, 0, 'shrine');
  assert.equal(atThreshold.resultIndex, 17);
  assert.equal(atThreshold.ruleKind, 'plus_threshold');
  const mateAbove = core.result(1, 1, 0, 9, 'shrine');
  assert.equal(mateAbove.resultIndex, 17);
  assert.equal(mateAbove.ruleKind, 'plus_threshold');
});

test('flag_gated room override applies in the room context only', () => {
  const core = createCore();
  const room = core.result(13, 199, 0, 0, 'room');
  assert.equal(room.resultIndex, 19);
  assert.equal(room.ruleKind, 'flag_gated');
  const shrine = core.result(13, 199, 0, 0, 'shrine');
  assert.equal(shrine.resultIndex, 6);
  assert.equal(shrine.ruleKind, 'base');
  const base = core.result(13, 199, 0, 0, 'base');
  assert.equal(base.resultIndex, 6);
  assert.equal(base.ruleKind, 'base');
});

test('room override does not apply to the reversed order', () => {
  const core = createCore();
  const reverse = core.result(199, 13, 0, 0, 'room');
  assert.equal(reverse.resultIndex, 199);
  assert.equal(reverse.ruleKind, 'base');
});

test('room context takes precedence over a matching plus rule', () => {
  const core = createCore();
  const room = core.result(252, 252, 8, 8, 'room');
  assert.equal(room.resultIndex, 253);
  assert.equal(room.ruleKind, 'flag_gated');
  const shrine = core.result(252, 252, 8, 8, 'shrine');
  assert.equal(shrine.resultIndex, 253);
  assert.equal(shrine.ruleKind, 'plus_threshold');
});

test('result rejects unknown contexts and non-roster species', () => {
  const core = createCore();
  assert.throws(() => core.result(1, 1, 0, 0, 'arena'), /context/);
  assert.throws(() => core.result(1, 315, 0, 0, 'base'), /whole number from 0 to 314/);
  assert.throws(() => core.result(1, 1, 256, 0, 'base'), /whole number/);
});

test('normalizeState accepts a valid document', () => {
  const core = createCore();
  const normalized = core.normalizeState(validDocument());
  assert.equal(normalized.version, 2);
  assert.equal(normalized.game, 'dqm1-2-ps1-v61');
  assert.equal(normalized.entries.length, 2);
  assert.deepEqual(plain(normalized.entries[1]), { id: 'm-2', speciesIndex: 99, sex: 'female', plus: 4, nickname: 'Drake' });
});

test('normalizeState accepts version 1 and 2 and stamps the current version', () => {
  const core = createCore();
  const v1 = core.normalizeState(validDocument());
  const v2 = core.normalizeState({ ...validDocument(), version: 2 });
  assert.equal(v1.version, 2);
  assert.equal(v2.version, 2);
  assert.deepEqual(plain(v2.entries), plain(v1.entries));
});

test('normalizeState tolerates and drops the app-level location key', () => {
  const core = createCore();
  const doc = validDocument();
  doc.entries[0].location = 'farm';
  const normalized = core.normalizeState(doc);
  // The core owns the entry shape; app-state re-attaches and validates location.
  assert.deepEqual(plain(normalized.entries[0]), {
    id: 'm-1', speciesIndex: 11, sex: 'male', plus: 0, nickname: '',
  });
});

test('normalizeState rejects the wrong version', () => {
  const core = createCore();
  const doc = validDocument();
  doc.version = 3;
  assert.throws(() => core.normalizeState(doc), /version 1 or 2/);
  const missing = validDocument();
  delete missing.version;
  assert.throws(() => core.normalizeState(missing), /version 1 or 2/);
});

test('normalizeState rejects the wrong game', () => {
  const core = createCore();
  const doc = validDocument();
  doc.game = 'dqm1-2-ps1-v60';
  assert.throws(() => core.normalizeState(doc), /different game or patch/);
});

test('normalizeState rejects malformed entries', () => {
  const core = createCore();
  const doc = validDocument();
  doc.entries[0] = { id: 'm-1', speciesIndex: 11, sex: 'male', plus: 0 };
  assert.throws(() => core.normalizeState(doc), /id, speciesIndex, sex, plus, and nickname/);
});

test('normalizeState rejects duplicate IDs', () => {
  const core = createCore();
  const doc = validDocument();
  doc.entries[1].id = 'm-1';
  assert.throws(() => core.normalizeState(doc), /duplicate ID/);
});

test('normalizeState rejects unknown or non-playable species', () => {
  const core = createCore();
  const unknown = validDocument();
  unknown.entries[0].speciesIndex = 999;
  assert.throws(() => core.normalizeState(unknown), /whole number from 0 to 314/);
  const internal = validDocument();
  internal.entries[0].speciesIndex = 315;
  assert.throws(() => core.normalizeState(internal), /whole number from 0 to 314/);
});

test('parseState accepts a valid JSON string and rejects invalid input', () => {
  const core = createCore();
  const parsed = core.parseState(JSON.stringify(validDocument()));
  assert.equal(parsed.entries.length, 2);
  assert.throws(() => core.parseState('not json'), /not valid JSON/);
  assert.throws(() => core.parseState('{"version":3}'), /version 1 or 2/);
});
