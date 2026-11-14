'use strict';

// Public translation data is commit-pinned. Reviewed release metadata is a
// tracked input so publication can reproduce it without another live lookup.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const REPOSITORY = 'dqm-psx/translations';
const SHA = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const VERSION = /^v\d+\.\d+\.\d+$/;
const STATS = ['hp', 'mp', 'attack', 'defense', 'agility', 'intelligence'];

function requireValue(value, message) {
  if (!value) throw new Error(`Translation sync: ${message}`);
}
function digest(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function clean(value, label, maximum = 400) {
  requireValue(typeof value === 'string', `${label} must be text`);
  const result = value.replace(/<END>/g, '').trim();
  requireValue(result.length > 0 && result.length <= maximum && !/[<>\x00-\x08\x0b\x0c\x0e-\x1f]/.test(result), `${label} is not plain text`);
  return result;
}
function readBreeding(file = path.join(ROOT, 'data/breeding-data.js')) {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, {timeout: 3000});
  return JSON.parse(JSON.stringify(context.DATA));
}

function readNativeLearning(file = path.join(ROOT, 'data/skill-learning-reference.js')) {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, {timeout: 3000});
  const reference = JSON.parse(JSON.stringify(context.SKILL_LEARNING_REFERENCE));
  requireValue(reference.schemaVersion === 1 && reference.species.length === 315 &&
    reference.provenance.originalDiscSha256 === 'a1217657786430ac1c3ad71f16cdadb65d47b0df9a7e30278900651c1f1eec29',
  'unsupported native learning reference');
  return reference;
}

function exactKeys(value, keys, label) {
  requireValue(value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join('|') === [...keys].sort().join('|'), `${label} fields differ`);
}
function validateCurrentPatch(value) {
  if (value == null) return null; // Historical public snapshots have no release summary.
  const keys = ['version', 'edition', 'published_at', 'source_revision', 'package_sha256'];
  exactKeys(value, keys, 'current patch');
  requireValue(typeof value.version === 'string' && value.version.length <= 32 && VERSION.test(value.version) && value.edition === 'current', 'invalid current patch version or edition');
  requireValue(typeof value.published_at === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value.published_at) && Number.isFinite(Date.parse(value.published_at)) && new Date(value.published_at).toISOString().replace('.000Z', 'Z') === value.published_at, 'invalid current patch publication date');
  requireValue(typeof value.source_revision === 'string' && SHA.test(value.source_revision) && typeof value.package_sha256 === 'string' && SHA256.test(value.package_sha256), 'invalid current patch source or checksum');
  return Object.fromEntries(keys.map(key => [key, value[key]]));
}

function selectCurrentPatch(published, reviewed) {
  const source = validateCurrentPatch(published);
  const snapshot = validateCurrentPatch(reviewed);
  if (!source || !snapshot) return source || snapshot;
  const sourceVersion = source.version.slice(1).split('.').map(BigInt);
  const reviewedVersion = snapshot.version.slice(1).split('.').map(BigInt);
  for (let i = 0; i < sourceVersion.length; i++) {
    if (sourceVersion[i] !== reviewedVersion[i]) return sourceVersion[i] > reviewedVersion[i] ? source : snapshot;
  }
  requireValue(source.source_revision === snapshot.source_revision && source.package_sha256 === snapshot.package_sha256,
    'current patch conflicts with the reviewed release; review this version\'s source and package');
  return snapshot;
}

function validateGameplayVerification(value, baseline, breeding) {
  if (value == null) return null;
  const keys = ['schema_version', 'version', 'edition', 'source_revision', 'patched_bin_sha256', 'package_sha256', 'baseline_sha256', 'breeding_sha256', 'verified', 'scope'];
  exactKeys(value, keys, 'gameplay verification');
  requireValue(value.schema_version === 1 && typeof value.version === 'string' && value.version.length <= 32 && VERSION.test(value.version) && value.edition === 'current', 'invalid gameplay verification version');
  requireValue(typeof value.source_revision === 'string' && SHA.test(value.source_revision), 'invalid gameplay source revision');
  for (const key of ['patched_bin_sha256', 'package_sha256', 'baseline_sha256', 'breeding_sha256']) requireValue(typeof value[key] === 'string' && SHA256.test(value[key]), `invalid gameplay ${key}`);
  requireValue(value.baseline_sha256 === digest(Buffer.from(JSON.stringify(baseline))) && value.breeding_sha256 === digest(Buffer.from(JSON.stringify(breeding))), 'gameplay proof does not match the shipped native data');
  const expected = {
    ordered_pairings: breeding.species.length ** 2,
    stat_profiles: baseline.species.filter(s => s.stats.status === 'verified').length,
    standard_stat_profiles: baseline.species.filter(s => breeding.species[s.index].playable && s.stats.status === 'verified').length,
    library_mappings: baseline.species.filter(s => s.library.status === 'verified').length,
    rule_code_spans: breeding.runtime_rules.verification.length,
    context_code_spans: breeding.runtime_rules.context_verification.verification.length,
  };
  exactKeys(value.verified, Object.keys(expected), 'gameplay coverage');
  for (const key of Object.keys(expected)) requireValue(value.verified[key] === expected[key], `gameplay ${key} coverage differs`);
  return {...Object.fromEntries(keys.filter(key => !['verified', 'scope'].includes(key)).map(key => [key, value[key]])), verified: {...value.verified}, scope: clean(value.scope, 'gameplay verification scope', 1000)};
}

function verifySnapshot(comparisonBytes, manifestBytes) {
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  requireValue(manifest.schema_version === 2, 'unsupported source manifest schema');
  requireValue(manifest.published_sha256?.['comparison-data.json'] === digest(comparisonBytes), 'comparison hash differs from source manifest');
  const comparison = JSON.parse(comparisonBytes.toString('utf8'));
  requireValue(comparison.schema_version === 2 && Array.isArray(comparison.rows), 'unsupported comparison schema');
  requireValue(SHA.test(manifest.translation_revision) && comparison.builder_revision === manifest.translation_revision, 'source revisions do not agree');
  requireValue(comparison.rows.length === manifest.row_count, 'source row count differs');
  requireValue(typeof manifest.updated_from_builder_at === 'string' && Number.isFinite(Date.parse(manifest.updated_from_builder_at)), 'missing source update date');
  validateCurrentPatch(manifest.current_patch);
  return {comparison, manifest};
}

function validateBaseline(baseline, breeding) {
  requireValue(baseline.schema_version === 1 && baseline.species.length === 326, 'native reference inventory differs');
  requireValue(breeding.species.length === 326, 'breeding roster inventory differs');
  const ids = new Set();
  for (const monster of baseline.species) {
    const species = breeding.species[monster.index];
    requireValue(species && !ids.has(monster.index), 'duplicate or invalid native species index');
    ids.add(monster.index);
    for (const key of ['system_entry_id', 'system_slot', 'family_id', 'member', 'japanese']) {
      requireValue(species[key] === monster[key], `native identity differs for species ${monster.index}`);
    }
    if (species.playable) {
      requireValue(monster.stats.status === 'verified' && Number.isInteger(monster.stats.base_level_limit) && monster.stats.base_level_limit >= 1 && monster.stats.base_level_limit <= 99, `missing native stats for species ${monster.index}`);
      for (const stat of STATS) requireValue(Array.isArray(monster.stats.growth[stat]) && monster.stats.growth[stat].length === 99 && monster.stats.growth[stat].every(n => Number.isInteger(n) && n >= 0 && n <= 20), `invalid native ${stat} gains for species ${monster.index}`);
    }
  }
  requireValue(baseline.species.filter(s => s.library.status === 'verified').length === 312, 'native library inventory differs');
}

function buildReference(baseline, breeding, comparison, manifest, publicRevision, gameplayVerification = null) {
  validateBaseline(baseline, breeding);
  requireValue(SHA.test(publicRevision), 'public source must be pinned to a full commit');
  const currentPatch = validateCurrentPatch(manifest.current_patch);
  const verifiedGameplay = validateGameplayVerification(gameplayVerification, baseline, breeding);
  const nativeLearning = readNativeLearning();
  const naturalSkills = new Map(nativeLearning.species.map(row => [row.speciesIndex, row.naturalSkills]));
  const nativeSkillNames = new Map(JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/skill-name-bindings.json'), 'utf8'))
    .map(skill => [skill.id, {id:skill.id, name:skill.spelling, system_entry_id:skill.source_id}]));
  if (currentPatch && verifiedGameplay && currentPatch.version === verifiedGameplay.version) {
    requireValue(currentPatch.source_revision === verifiedGameplay.source_revision && currentPatch.package_sha256 === verifiedGameplay.package_sha256,
      'gameplay verification does not match this version\'s released package');
  }
  const rows = new Map();
  for (const row of comparison.rows) {
    if (!['text/system.json', 'text/monster_captions.json', 'menus/general.json'].includes(row.catalog)) continue;
    const key = `${row.catalog}:${row.id}`;
    requireValue(!rows.has(key), `duplicate source identity ${key}`);
    rows.set(key, row);
  }
  function getRow(catalog, id) {
    const row = rows.get(`${catalog}:${id}`);
    requireValue(row && row.raw?.id === id && row.source_revision === manifest.translation_revision, `missing or stale source ${catalog}:${id}`);
    requireValue(row.raw.translations?.current, `missing current edition for ${id}`);
    return row;
  }
  function systemName(id) {
    const row = getRow('text/system.json', id);
    return clean(row.raw.translations.current.english, `name ${id}`, 100);
  }
  const species = baseline.species.map(native => {
    const original = breeding.species[native.index];
    const monster = JSON.parse(JSON.stringify(native));
    // The original library fallback reused DQM2's set for extra species.
    // Use the independently compared campaign tables before translating names.
    const verifiedNatural = naturalSkills.get(monster.index);
    if (verifiedNatural) for (const [campaign, ids] of Object.entries(verifiedNatural)) {
      requireValue(ids.every(id => nativeSkillNames.has(id)), 'missing native skill identity');
      if (monster.skills[campaign].map(skill => skill.id).join(',') !== ids.join(',')) {
        monster.skills[campaign] = ids.map(id => ({...nativeSkillNames.get(id)}));
        monster.skills_source = {reference: 'data/skill-learning-reference.js', version: nativeLearning.provenance.version,
          method: 'Natural skill tables match Japanese retail and English v1.0.73; preserve campaign and native slot order.'};
      }
    }
    let currentName = original.name;
    let shortName = original.short_name;
    const aliases = [original.name, original.short_name, original.display_name];
    if (native.system_entry_id) {
      const row = getRow('text/system.json', native.system_entry_id);
      requireValue(clean(row.raw.japanese, 'Japanese identity') === native.japanese && row.indices?.includes(native.system_slot), `name identity differs for species ${native.index}`);
      const current = row.raw.translations.current;
      currentName = clean(current.english, 'current monster name', 100);
      shortName = clean(current.english_short || current.english, 'current menu name', 100);
      for (const edition of ['current', 'gameboy', 'delocalized', 'vibecoded']) {
        const wording = row.raw.translations[edition];
        if (!wording) continue;
        for (const field of ['english', 'english_short']) if (wording[field]) aliases.push(clean(wording[field], 'name alias', 100));
      }
    }
    monster.current_name = currentName;
    monster.short_name = shortName;
    // Form labels express native identity; keep them even if wording changes.
    const form = original.display_name.match(/ \(form \d+\)$/)?.[0] || '';
    monster.display_name = currentName + form;
    monster.aliases = [...new Set(aliases.filter(Boolean))];
    if (native.library.status === 'verified') {
      const row = getRow('text/monster_captions.json', native.library.source.text_id);
      monster.library = {text: clean(row.raw.translations.current.english_full, 'library description'), status: 'current_translation', source: {text_id: row.id, translation_revision: manifest.translation_revision}};
    }
    for (const skills of Object.values(monster.skills)) {
      for (const skill of skills) skill.name = systemName(skill.system_entry_id);
    }
    for (const location of monster.locations) {
      if (location.kind !== 'wild' || !location.source?.text_id) continue;
      const row = getRow('menus/general.json', location.source.text_id);
      const lines = row.raw.translations.current.english_lines;
      requireValue(Array.isArray(lines), `missing encounter labels ${row.id}`);
      const prefix = location.context_id.toString(16).toUpperCase().padStart(2, '0') + ':';
      const matches = lines.filter(line => typeof line === 'string' && line.startsWith(prefix));
      requireValue(matches.length === 1, `encounter context differs for ${row.id}:${prefix}`);
      const label = clean(matches[0].slice(prefix.length), 'encounter label');
      const parts = label.match(/^(.*?)\s*(\d+~\d+F)$/);
      const aliases = [location.name];
      location.name = parts ? parts[1].trim() : label;
      location.floors = parts ? parts[2].replace('~', '–') : null;
      for (const edition of ['gameboy','delocalized','vibecoded']) {
        const alternatives = row.raw.translations[edition]?.english_lines;
        if (!Array.isArray(alternatives)) continue;
        for (const line of alternatives.filter(line => typeof line === 'string' && line.startsWith(prefix))) {
          const text = clean(line.slice(prefix.length), 'encounter alias');
          const range = text.match(/^(.*?)\s*(\d+~\d+F)$/);
          aliases.push(range ? range[1].trim() : text);
        }
      }
      location.aliases = [...new Set(aliases.filter(alias => alias && alias !== location.name))];
      // Native gate 32 is unused. Keep its recorded encounter pools for the
      // unused-content article, but never offer them as acquisition routes.
      // Classify by native identity so a translation rename cannot undo this.
      if (location.game === 'terry' && location.context_id >= 122 && location.context_id <= 125) {
        location.availability = 'unused';
      }
    }
    return monster;
  });
  return {schema_version: 1, metadata: {
    gameplay_version: baseline.metadata.gameplay_version,
    current_patch: currentPatch,
    gameplay_verification: verifiedGameplay,
    translation_revision: manifest.translation_revision,
    public_revision: publicRevision,
    updated_at: manifest.updated_from_builder_at,
    source_url: `https://github.com/${REPOSITORY}/tree/${publicRevision}`,
    comparison_sha256: manifest.published_sha256['comparison-data.json'],
    baseline_sha256: digest(Buffer.from(JSON.stringify(baseline))),
    coverage: {species: species.length, named_species: species.filter(s => s.system_entry_id).length, library_entries: species.filter(s => s.library.text).length, standard_species_with_verified_stats: species.filter(s => s.index < 315 && s.stats.status === 'verified').length},
    scope: baseline.metadata.scope,
  }, species};
}

function generateScript(reference, name = 'MONSTER_REFERENCE') {
  const json = JSON.stringify(reference).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return `// Generated by scripts/sync-monster-reference.js; do not hand-edit.\n` +
    `globalThis.${name} = ${json};\n` +
    `(function () {\n  if (!globalThis.DATA) return;\n  for (const row of ${name}.species) {\n    const species = DATA.species[row.index];\n    if (!species || species.system_entry_id !== row.system_entry_id) throw new Error('Monster reference identity mismatch');\n    species.name = row.current_name;\n    species.short_name = row.short_name;\n    species.display_name = row.display_name;\n    species.aliases = row.aliases;\n  }\n  for (const rule of DATA.runtime_rules?.rules || []) {\n    rule.pedigree_name = DATA.species[rule.pedigree_index].display_name;\n    rule.offspring_name = DATA.species[rule.offspring_index].display_name;\n    rule.mate_name = rule.mate_index == null\n      ? 'Any ' + DATA.families.find(family => family.id === rule.mate_family_index).display_name + '-family monster'\n      : DATA.species[rule.mate_index].display_name;\n  }\n  DATA.metadata.names = 'Current English patch names from the public translation snapshot. Gameplay provenance is independent.';\n  DATA.metadata.translation_sync = ${name}.metadata;\n})();\n`;
}

async function download(url, maxBytes) {
  const response = await fetch(url, {headers: {'User-Agent': 'dqm-psx-guide-name-sync', Accept: 'application/vnd.github+json'}, signal: AbortSignal.timeout(120000)});
  requireValue(response.ok, `public download failed (${response.status})`);
  const chunks = []; let total = 0;
  for await (const chunk of response.body) {
    total += chunk.length;
    requireValue(total <= maxBytes, 'public snapshot exceeds size limit');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function main(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    requireValue(['--source-dir', '--public-revision', '--output', '--check'].includes(key), `unknown option ${key}`);
    options[key] = key === '--check' ? true : argv[++i];
    requireValue(options[key], `missing value for ${key}`);
  }
  let publicRevision = options['--public-revision'];
  let comparisonBytes, manifestBytes;
  if (options['--source-dir']) {
    requireValue(SHA.test(publicRevision), '--source-dir requires --public-revision');
    comparisonBytes = fs.readFileSync(path.join(options['--source-dir'], 'comparison-data.json'));
    manifestBytes = fs.readFileSync(path.join(options['--source-dir'], 'source-manifest.json'));
  } else {
    if (!publicRevision) {
      const commit = JSON.parse((await download(`https://api.github.com/repos/${REPOSITORY}/commits/main`, 1024 * 1024)).toString('utf8'));
      publicRevision = commit.sha;
    }
    requireValue(SHA.test(publicRevision), 'invalid public commit');
    const base = `https://raw.githubusercontent.com/${REPOSITORY}/${publicRevision}/`;
    [comparisonBytes, manifestBytes] = await Promise.all([download(base + 'comparison-data.json', 64 * 1024 * 1024), download(base + 'source-manifest.json', 1024 * 1024)]);
  }
  const {comparison, manifest} = verifySnapshot(comparisonBytes, manifestBytes);
  manifest.current_patch = selectCurrentPatch(manifest.current_patch,
    JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/current-patch.json'), 'utf8')));
  const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/monster-baseline.json'), 'utf8'));
  const proofPath = path.join(ROOT, 'data/gameplay-verification.json');
  const gameplayVerification = fs.existsSync(proofPath) ? JSON.parse(fs.readFileSync(proofPath, 'utf8')) : null;
  const breeding = readBreeding();
  const reference = buildReference(baseline, breeding, comparison, manifest, publicRevision, gameplayVerification);
  const {buildGuideNames, guideInputs} = require('./guide-names');
  const inputs = guideInputs(ROOT);
  reference.guide_names = buildGuideNames({...inputs, comparison, revision:manifest.translation_revision,
    species:reference.species, originalSpecies:breeding.species});
  const outputs = new Map([[path.resolve(options['--output'] || path.join(ROOT, 'data/monster-reference.js')), generateScript(reference)]]);
  if (!options['--output']) {
    const breedingNames = reference.species.map(({index, system_entry_id, current_name, display_name, short_name, aliases}) =>
      ({index, system_entry_id, current_name, display_name, short_name, aliases}));
    outputs.set(path.join(ROOT,'data/breeding-names.js'), generateScript({metadata:reference.metadata, species:breedingNames}, 'BREEDING_NAMES'));
    const species = reference.species.map(row => ({
      index: row.index, system_entry_id: row.system_entry_id, playable: breeding.species[row.index].playable,
      family_display: breeding.species[row.index].family_display, current_name: row.current_name, display_name: row.display_name,
      short_name: row.short_name, japanese: row.japanese, aliases: row.aliases,
      skills: Object.fromEntries(Object.entries(row.skills).map(([game, list]) =>
        [game, list.map(({id,system_entry_id}) => ({id,system_entry_id}))])),
      locations: row.locations.filter(loc => loc.kind === 'wild').map(({kind, game, context_id, name, aliases, floors, levels, availability}) =>
        ({kind, game, context_id, name, aliases, floors, levels, ...(availability ? {availability} : {})}))
    }));
    const names = reference.guide_names;
    const shell = {
      campaigns: Object.fromEntries(['terry','cobi','tara'].map(id => [id, names.entries['npc-'+id]?.title ||
        inputs.world.entries.find(row => row.id === 'npc-'+id).title])),
      places: Object.fromEntries(['map-6-0','map-12-0'].map(id => [id,names.maps[id].title]))
    };
    for (const [file, name, value] of [
      ['handbook-reference','GUIDE_REFERENCE',{species, guide_names:names, metadata:reference.metadata}],
      ['character-dialogue','CHARACTER_DIALOGUE',require('./build-character-dialogue').buildCharacterDialogue(comparison,manifest.translation_revision)],
      ['home-names','GUIDE_HOME',shell]
    ]) {
      outputs.set(path.join(ROOT,'data',file+'.js'), 'globalThis.' + name + ' = ' +
        JSON.stringify(value).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029') + ';\n');
    }
  }
  for (const [output, script] of outputs) {
    if (options['--check']) {
      requireValue(fs.readFileSync(output, 'utf8') === script, 'generated reference is out of date: '+path.basename(output));
    } else if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== script) {
      fs.writeFileSync(output + '.tmp', script, 'utf8');
      fs.renameSync(output + '.tmp', output);
    }
  }
  const coverage = reference.guide_names.coverage;
  console.log(`Validated ${reference.metadata.coverage.named_species} monster names, ${reference.guide_names.default_nicknames.length} default nicknames, ${coverage.items} items, ${coverage.skills} skills, ${coverage.maps} maps, and ${coverage.world_name_bindings} world-name bindings; public source ${publicRevision}.`);
}

module.exports = {verifySnapshot, validateBaseline, validateCurrentPatch, selectCurrentPatch, validateGameplayVerification, buildReference, generateScript, readBreeding, digest, STATS};
if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
