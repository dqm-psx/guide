const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { loadScripts } = require('../helpers/load-scripts');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FIXTURE_PATH = path.join(REPO_ROOT, 'tests', 'fixtures', 'data-hashes.json');

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const sorted = {};
    for (const key of Object.keys(value).sort()) sorted[key] = canonicalize(value[key]);
    return sorted;
  }
  return value;
}

function sha256(value) {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value)), 'utf8').digest('hex');
}

function loadData() {
  return loadScripts([
    path.join(REPO_ROOT, 'data', 'overworld-sprites.js'),
    path.join(REPO_ROOT, 'data', 'monster-sprites.js'),
    path.join(REPO_ROOT, 'data', 'breeding-data.js'),
  ]);
}

function readFixture() {
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf8'));
}

test('data scripts match the recorded pre-extraction baseline hashes', () => {
  const fixture = readFixture();
  const context = loadData();
  assert.equal(sha256(context.OVERWORLD_SPRITES), fixture.overworldSprites);
  assert.equal(sha256(context.MONSTER_SPRITES), fixture.monsterSprites);
  assert.equal(sha256(context.DATA), fixture.breedingData);
});

test('data counts match the recorded pre-extraction baseline', () => {
  const fixture = readFixture();
  const context = loadData();
  const data = context.DATA;
  const counts = {
    species: data.species.length,
    playable: data.species.filter(s => s.playable !== false).length,
    matrixRows: data.matrix.length,
    families: data.families.length,
    plusRules: data.runtime_rules.rules.filter(r => r.kind === 'plus_threshold').length,
    roomRules: data.runtime_rules.rules.filter(r => r.kind === 'flag_gated').length,
    monsterSprites: Object.keys(context.MONSTER_SPRITES).length,
    overworldSprites: Object.keys(context.OVERWORLD_SPRITES).length,
  };
  assert.deepEqual(counts, fixture.counts);
});

test('breeding data keeps the documented shape', () => {
  const { DATA } = loadData();
  assert.equal(DATA.schema_version, 1);
  assert.equal(DATA.metadata.version, 'v1.0.61-CURRENT');
  assert.equal(DATA.matrix.length, 326);
  for (const row of DATA.matrix) assert.equal(row.length, 326);
  assert.equal(DATA.runtime_rules.rules.length, 36);
});
