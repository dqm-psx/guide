'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {verifySnapshot, validateBaseline, buildReference, generateScript, readBreeding, digest} = require('../../scripts/sync-monster-reference');
const ROOT = path.resolve(__dirname, '../..');
const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/monster-baseline.json'), 'utf8'));
const breeding = readBreeding();
const revision = 'a'.repeat(40), publicRevision = 'b'.repeat(40);

function fixture() {
  const rows = new Map();
  function add(catalog, id, raw, extra = {}) {
    const key = `${catalog}:${id}`;
    if (!rows.has(key)) rows.set(key, {catalog, id, raw: {id, ...raw}, source_revision: revision, ...extra});
    return rows.get(key);
  }
  for (const native of baseline.species) {
    const source = breeding.species[native.index];
    if (source.system_entry_id) add('text/system.json', source.system_entry_id, {
      japanese: source.japanese + '<END>', translations: {
        current: {english: source.name + '<END>', english_short: source.short_name + '<END>'},
        gameboy: {english: `Classic ${source.index}<END>`},
      },
    }, {indices: [source.system_slot]});
    if (native.library.source?.text_id) add('text/monster_captions.json', native.library.source.text_id, {translations: {current: {english_full: native.library.text}}});
    for (const skills of Object.values(native.skills)) for (const skill of skills) add('text/system.json', skill.system_entry_id, {translations: {current: {english: skill.name}}});
    for (const location of native.locations) {
      if (location.kind !== 'wild') continue;
      const row = add('menus/general.json', location.source.text_id, {translations: {current: {english_lines: []}}});
      const prefix = location.context_id.toString(16).toUpperCase().padStart(2, '0') + ':';
      const lines = row.raw.translations.current.english_lines;
      if (!lines.some(line => line.startsWith(prefix))) lines.push(prefix + location.name + (location.floors ? ' ' + location.floors.replace('–', '~') : ''));
    }
  }
  const comparison = {schema_version: 2, builder_revision: revision, rows: [...rows.values()]};
  const bytes = Buffer.from(JSON.stringify(comparison));
  const manifest = {schema_version: 2, translation_revision: revision, updated_from_builder_at: '2026-11-05T12:00:00Z', row_count: comparison.rows.length, published_sha256: {'comparison-data.json': digest(bytes)}};
  return {comparison, manifest, bytes, manifestBytes: Buffer.from(JSON.stringify(manifest))};
}

test('manifest verification rejects mismatched bytes, revisions, counts and schemas', () => {
  const f = fixture();
  assert.equal(verifySnapshot(f.bytes, f.manifestBytes).manifest.translation_revision, revision);
  assert.throws(() => verifySnapshot(Buffer.from('{}'), f.manifestBytes), /hash differs/);
  for (const [field, value, expected] of [['translation_revision', 'c'.repeat(40), /revisions/], ['row_count', 1, /row count/], ['schema_version', 99, /schema/], ['updated_from_builder_at', 'not-a-date', /date/]]) {
    assert.throws(() => verifySnapshot(f.bytes, Buffer.from(JSON.stringify({...f.manifest, [field]: value}))), expected);
  }
});

test('a wording refresh updates names, aliases, library, skills and locations by stable IDs without changing gameplay', () => {
  const {comparison, manifest} = fixture();
  const name = comparison.rows.find(r => r.id === 'e0001');
  name.raw.translations.current = {english: 'New Drake Slime<END>', english_short: 'NewDrake<END>'};
  const library = comparison.rows.find(r => r.id === 'library_monster_000');
  library.raw.translations.current.english_full = 'A newly reviewed description.';
  const skillId = baseline.species[0].skills.terry[0].system_entry_id;
  comparison.rows.find(r => r.id === skillId).raw.translations.current.english = 'Reviewed skill';
  const location = baseline.species[0].locations.find(r => r.kind === 'wild');
  const menu = comparison.rows.find(r => r.id === location.source.text_id);
  const prefix = location.context_id.toString(16).toUpperCase().padStart(2, '0') + ':';
  menu.raw.translations.current.english_lines = menu.raw.translations.current.english_lines.map(line => line.startsWith(prefix) ? prefix + 'Reviewed Gate 6~8F' : line);
  const result = buildReference(baseline, breeding, comparison, manifest, publicRevision);
  assert.equal(result.species[0].current_name, 'New Drake Slime');
  assert.equal(result.species[0].short_name, 'NewDrake');
  assert.ok(result.species[0].aliases.includes('Classic 0'));
  assert.ok(result.species[0].aliases.includes('Drake Slime'));
  assert.equal(result.species[0].library.text, 'A newly reviewed description.');
  assert.equal(result.species[0].skills.terry[0].name, 'Reviewed skill');
  assert.ok(result.species[0].locations.some(r => r.name === 'Reviewed Gate' && r.floors === '6–8F'));
  assert.deepEqual(result.species.map(s => s.stats), baseline.species.map(s => s.stats));
  assert.equal(result.species[290].display_name, result.species[290].current_name + ' (form 1)');
  assert.equal(result.species[291].display_name, result.species[291].current_name + ' (form 2)');
  const data = structuredClone(breeding);
  const matrixBefore = JSON.stringify(data.matrix);
  const context = vm.createContext({DATA: data});
  vm.runInContext(generateScript(result), context);
  assert.equal(data.species[0].name, 'New Drake Slime');
  assert.equal(data.species[0].index, 0);
  assert.equal(JSON.stringify(data.matrix), matrixBefore);
  for (const rule of data.runtime_rules.rules) {
    assert.equal(rule.pedigree_name, data.species[rule.pedigree_index].display_name);
    assert.equal(rule.offspring_name, data.species[rule.offspring_index].display_name);
    if (rule.mate_index != null) assert.equal(rule.mate_name, data.species[rule.mate_index].display_name);
  }
  assert.equal(generateScript(result), generateScript(buildReference(baseline, breeding, comparison, manifest, publicRevision)));
});

test('renaming a conditional-rule parent also updates human-readable rule labels', () => {
  const {comparison, manifest} = fixture();
  const pedigree = breeding.species[13];
  comparison.rows.find(r => r.id === pedigree.system_entry_id).raw.translations.current.english = 'Updated Healer';
  const data = structuredClone(breeding);
  const context = vm.createContext({DATA: data});
  vm.runInContext(generateScript(buildReference(baseline, breeding, comparison, manifest, publicRevision)), context);
  const rule = data.runtime_rules.rules.find(r => r.pedigree_index === 13 && r.mate_index == null);
  assert.equal(rule.pedigree_name, 'Updated Healer');
  assert.equal(rule.mate_name, 'Any Zombie-family monster');
  assert.equal(rule.offspring_index, 19);
  assert.equal(rule.condition, breeding.runtime_rules.rules.find(r => r.pedigree_index === 13 && r.mate_index == null).condition);
});

test('missing, duplicate, stale and mismatched identities fail closed', () => {
  for (const corrupt of [
    f => { f.comparison.rows = f.comparison.rows.filter(r => r.id !== 'e0001'); },
    f => { f.comparison.rows.push(structuredClone(f.comparison.rows.find(r => r.id === 'e0001'))); },
    f => { f.comparison.rows.find(r => r.id === 'e0001').indices = [999]; },
    f => { f.comparison.rows.find(r => r.id === 'e0001').raw.japanese = 'Wrong identity'; },
    f => { f.comparison.rows.find(r => r.id === 'e0001').source_revision = 'c'.repeat(40); },
    f => { f.comparison.rows.find(r => r.id === 'e0001').raw.translations.current.english = '<script>alert(1)</script>'; },
    f => { f.comparison.rows.find(r => r.id === 'library_monster_000').raw.translations.current.english_full = ''; },
  ]) {
    const f = fixture(); corrupt(f);
    assert.throws(() => buildReference(baseline, breeding, f.comparison, f.manifest, publicRevision), /Translation sync:/);
  }
});

test('native inventory and all standard stat profiles remain complete', () => {
  validateBaseline(baseline, breeding);
  const bad = structuredClone(baseline);
  bad.species[0].stats.growth.hp.pop();
  assert.throws(() => validateBaseline(bad, breeding), /invalid native hp/);
  assert.equal(baseline.species[20].stats.base_level_limit, 20);
  assert.equal(baseline.species[313].stats.base_level_limit, 7);
  assert.deepEqual(baseline.species[0].stats.growth.hp.slice(1, 11), [5, 3, 3, 3, 4, 5, 4, 5, 4, 3]);
  for (const index of [312, 313, 314]) assert.equal(baseline.species[index].library.status, 'not_in_library');
});

test('shipped bundle covers current names without embedding local paths or private export fields', () => {
  const text = fs.readFileSync(path.join(ROOT, 'data/monster-reference.js'), 'utf8');
  const context = vm.createContext({DATA: structuredClone(breeding)});
  vm.runInContext(text, context);
  const reference = context.MONSTER_REFERENCE;
  assert.equal(reference.metadata.coverage.named_species, 325);
  assert.equal(reference.metadata.coverage.library_entries, 312);
  assert.equal(reference.metadata.coverage.standard_species_with_verified_stats, 315);
  assert.match(reference.metadata.public_revision, /^[0-9a-f]{40}$/);
  for (const s of reference.species) {
    assert.equal(s.system_entry_id, breeding.species[s.index].system_entry_id);
    assert.equal(context.DATA.species[s.index].name, s.current_name);
  }
  assert.doesNotMatch(text, /[A-Za-z]:[\\/](?:Users|Documents)|source_file_sha256|builder_repository|@(?:gmail|outlook)\.com/i);
  assert.doesNotMatch(JSON.stringify(baseline), /[A-Za-z]:[\\/](?:Users|Documents)|@(?:gmail|outlook)\.com/i);
});
