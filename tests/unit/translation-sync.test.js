'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {verifySnapshot, validateBaseline, validateCurrentPatch, selectCurrentPatch, validateGameplayVerification, buildReference, generateScript, readBreeding, digest} = require('../../scripts/sync-monster-reference');
const ROOT = path.resolve(__dirname, '../..');
const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/monster-baseline.json'), 'utf8'));
const breeding = readBreeding();
const revision = 'a'.repeat(40), publicRevision = 'b'.repeat(40);
const gameplayProof = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/gameplay-verification.json'), 'utf8'));
const currentPatch = () => ({version: 'v1.0.73', edition: 'current', published_at: '2026-11-06T07:45:18Z', source_revision: 'c'.repeat(40), package_sha256: 'd'.repeat(64)});

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
  for(const skill of JSON.parse(fs.readFileSync(path.join(ROOT,'scripts/skill-name-bindings.json'),'utf8')))
    add('text/system.json',skill.source_id,{translations:{current:{english:skill.spelling}}});
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
  menu.raw.translations.gameboy = {english_lines:[prefix+'Classic Gate 6~8F']};
  menu.raw.translations.current.english_lines = menu.raw.translations.current.english_lines.map(line => line.startsWith(prefix) ? prefix + 'Reviewed Gate 6~8F' : line);
  const result = buildReference(baseline, breeding, comparison, manifest, publicRevision);
  assert.equal(result.species[0].current_name, 'New Drake Slime');
  assert.equal(result.species[0].short_name, 'NewDrake');
  assert.ok(result.species[0].aliases.includes('Classic 0'));
  assert.ok(result.species[0].aliases.includes('Drake Slime'));
  assert.equal(result.species[0].library.text, 'A newly reviewed description.');
  assert.equal(result.species[0].skills.terry[0].name, 'Reviewed skill');
  assert.ok(result.species[0].locations.some(r => r.name === 'Reviewed Gate' && r.floors === '6–8F'));
  const renamedLocation = result.species[0].locations.find(r => r.context_id === location.context_id && r.game === location.game);
  assert.ok(renamedLocation.aliases.includes(location.name));
  assert.ok(renamedLocation.aliases.includes('Classic Gate'));
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

test('translation refresh preserves unused gate classification by native context and retains the raw pools', () => {
  const {comparison, manifest} = fixture();
  const labels = comparison.rows.find(row => row.id === 'm_exe_09202c').raw.translations.current.english_lines;
  for (let i=0; i<labels.length; i++) {
    if (/^7[A-D]:/.test(labels[i])) labels[i] = labels[i].replace('Hidden Gate', 'Renamed gate');
  }
  const result = buildReference(baseline, breeding, comparison, manifest, publicRevision);
  const pools = result.species.flatMap(monster => monster.locations);
  const unused = pools.filter(location => location.availability === 'unused');
  assert.equal(unused.length, 20);
  assert.deepEqual([...new Set(unused.map(location => location.context_id))].sort(), [122,123,124,125]);
  for (const location of unused) {
    assert.equal(location.game, 'terry');
    assert.equal(location.kind, 'wild');
    assert.equal(location.name, 'Renamed gate');
    assert.ok(location.source.archive_index);
    assert.ok(location.levels.length);
  }
  assert.equal(pools.length, baseline.species.reduce((count, monster) => count + monster.locations.length, 0));
  assert.ok(pools.some(location => location.game === 'terry' && location.context_id === 121 && !location.availability));
  assert.ok(pools.some(location => location.game === 'cobi' && location.kind === 'wild' && !location.availability));
  assert.ok(baseline.species.every(monster => monster.locations.every(location => !location.availability)));
});

test('current release metadata has a strict public-only schema and remains separate from wording', () => {
  const f = fixture();
  f.manifest.current_patch = currentPatch();
  const snapshot = verifySnapshot(f.bytes, Buffer.from(JSON.stringify(f.manifest)));
  const result = buildReference(baseline, breeding, snapshot.comparison, snapshot.manifest, publicRevision);
  assert.equal(result.metadata.current_patch.version, 'v1.0.73');
  assert.equal(result.metadata.current_patch.source_revision, 'c'.repeat(40));
  assert.equal(result.metadata.translation_revision, revision);
  assert.equal(result.metadata.gameplay_version, baseline.metadata.gameplay_version);
  assert.equal(result.metadata.gameplay_verification, null);
  assert.equal(validateCurrentPatch(undefined), null);
  for (const candidate of [
    {...currentPatch(), author: 'must not be published'},
    {...currentPatch(), release_url: 'https://private.invalid/'},
    {...currentPatch(), version: 'v73'},
    {...currentPatch(), edition: 'gameboy'},
    {...currentPatch(), published_at: '2026-02-31T07:45:18Z'},
    {...currentPatch(), source_revision: 'main'},
    {...currentPatch(), package_sha256: 'invalid'},
  ]) assert.throws(() => validateCurrentPatch(candidate), /Translation sync:/);
});

test('a newer release never advances the independently verified gameplay version', () => {
  const f = fixture();
  f.manifest.current_patch = {...currentPatch(), version: 'v1.0.74'};
  const result = buildReference(baseline, breeding, f.comparison, f.manifest, publicRevision, gameplayProof);
  assert.equal(result.metadata.current_patch.version, 'v1.0.74');
  assert.equal(result.metadata.gameplay_verification.version, gameplayProof.version);
  assert.equal(result.metadata.gameplay_verification.patched_bin_sha256, gameplayProof.patched_bin_sha256);
  assert.equal(result.metadata.gameplay_version, 'v1.0.61-CURRENT');
  assert.equal(result.metadata.gameplay_verification.verified.ordered_pairings, 106276);
  assert.equal(result.metadata.gameplay_verification.verified.standard_stat_profiles, 315);
  for (const corrupt of [
    p => {p.baseline_sha256 = '0'.repeat(64);},
    p => {p.breeding_sha256 = '0'.repeat(64);},
    p => {p.verified.library_mappings = 311;},
    p => {p.verified.extra = 1;},
    p => {p.local_path = '/private/path';},
  ]) {
    const invalid = structuredClone(gameplayProof); corrupt(invalid);
    assert.throws(() => validateGameplayVerification(invalid, baseline, breeding), /Translation sync:/);
  }
  const changedBaseline = structuredClone(baseline);
  changedBaseline.species[0].stats.growth.hp[1] += 1;
  assert.throws(() => validateGameplayVerification(gameplayProof, changedBaseline, breeding), /does not match/);
});

test('reviewed release metadata survives stale exports and permits a newer public release', () => {
  const reviewed = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/current-patch.json'), 'utf8'));
  assert.deepEqual(selectCurrentPatch(currentPatch(), reviewed), reviewed);
  assert.deepEqual(selectCurrentPatch(undefined, reviewed), reviewed);
  assert.deepEqual(selectCurrentPatch(reviewed, reviewed), reviewed);
  assert.equal(selectCurrentPatch(null, null), null);
  const newer = {...reviewed, version: 'v1.0.100', source_revision: 'a'.repeat(40), package_sha256: 'b'.repeat(64)};
  assert.deepEqual(selectCurrentPatch(newer, reviewed), newer);
  for (const field of ['source_revision','package_sha256']) {
    const conflicting = {...reviewed, [field]: currentPatch()[field]};
    assert.throws(()=>selectCurrentPatch(conflicting, reviewed), /conflicts with the reviewed release/);
  }
  assert.throws(()=>selectCurrentPatch(currentPatch(), {...reviewed, author:'not public metadata'}), /fields differ/);
  const f = fixture();
  f.manifest.current_patch = selectCurrentPatch(currentPatch(), reviewed);
  const reference = buildReference(baseline, breeding, f.comparison, f.manifest, publicRevision, gameplayProof);
  assert.equal(reference.metadata.current_patch.version, reviewed.version);
  assert.equal(reference.metadata.gameplay_verification.version, gameplayProof.version);
  assert.equal(reference.metadata.translation_revision, revision);
});

test('reissuing a release version cannot reuse gameplay proof for a different package or source', () => {
  const f = fixture();
  f.manifest.current_patch = {...currentPatch(), version: gameplayProof.version,
    source_revision: gameplayProof.source_revision, package_sha256: gameplayProof.package_sha256};
  assert.equal(buildReference(baseline, breeding, f.comparison, f.manifest, publicRevision, gameplayProof).metadata.current_patch.version, gameplayProof.version);
  for (const [field, value] of [['source_revision', 'e'.repeat(40)], ['package_sha256', 'f'.repeat(64)]]) {
    const manifest = structuredClone(f.manifest);
    manifest.current_patch[field] = value;
    assert.throws(() => buildReference(baseline, breeding, f.comparison, manifest, publicRevision, gameplayProof), /does not match this version's released package/);
  }
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

test('translation regeneration preserves native campaign skill sets and slot order for extra species', () => {
  const {comparison,manifest}=fixture();
  const reference=buildReference(baseline,breeding,comparison,manifest,publicRevision);
  assert.deepEqual(reference.species[312].skills.terry.map(skill=>skill.id),[25,30,27]);
  assert.deepEqual(reference.species[313].skills.terry.map(skill=>skill.id),[65,61,63]);
  assert.deepEqual(reference.species[313].skills.cobi.map(skill=>skill.id),[61,63,64]);
  assert.deepEqual(reference.species[313].skills.tara.map(skill=>skill.id),[61,63,64]);
  assert.equal(reference.species[313].skills_source.reference,'data/skill-learning-reference.js');
  assert.equal(reference.species[313].skills.terry[0].system_entry_id,'e0d52');
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
