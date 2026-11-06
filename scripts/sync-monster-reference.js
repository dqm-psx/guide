'use strict';

// Only public, commit-pinned translation data is read. No remote code is run.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const REPOSITORY = 'dqm-psx/translations';
const SHA = /^[a-f0-9]{40}$/;
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

function verifySnapshot(comparisonBytes, manifestBytes) {
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  requireValue(manifest.schema_version === 2, 'unsupported source manifest schema');
  requireValue(manifest.published_sha256?.['comparison-data.json'] === digest(comparisonBytes), 'comparison hash differs from source manifest');
  const comparison = JSON.parse(comparisonBytes.toString('utf8'));
  requireValue(comparison.schema_version === 2 && Array.isArray(comparison.rows), 'unsupported comparison schema');
  requireValue(SHA.test(manifest.translation_revision) && comparison.builder_revision === manifest.translation_revision, 'source revisions do not agree');
  requireValue(comparison.rows.length === manifest.row_count, 'source row count differs');
  requireValue(typeof manifest.updated_from_builder_at === 'string' && Number.isFinite(Date.parse(manifest.updated_from_builder_at)), 'missing source update date');
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

function buildReference(baseline, breeding, comparison, manifest, publicRevision) {
  validateBaseline(baseline, breeding);
  requireValue(SHA.test(publicRevision), 'public source must be pinned to a full commit');
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
      location.name = parts ? parts[1].trim() : label;
      location.floors = parts ? parts[2].replace('~', '–') : null;
    }
    return monster;
  });
  return {schema_version: 1, metadata: {
    gameplay_version: baseline.metadata.gameplay_version,
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

function generateScript(reference) {
  const json = JSON.stringify(reference).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return `// Generated by scripts/sync-monster-reference.js; do not hand-edit.\n` +
    `globalThis.MONSTER_REFERENCE = ${json};\n` +
    `(function () {\n  if (!globalThis.DATA) return;\n  for (const row of MONSTER_REFERENCE.species) {\n    const species = DATA.species[row.index];\n    if (!species || species.system_entry_id !== row.system_entry_id) throw new Error('Monster reference identity mismatch');\n    species.name = row.current_name;\n    species.short_name = row.short_name;\n    species.display_name = row.display_name;\n    species.aliases = row.aliases;\n  }\n  for (const rule of DATA.runtime_rules?.rules || []) {\n    rule.pedigree_name = DATA.species[rule.pedigree_index].display_name;\n    rule.offspring_name = DATA.species[rule.offspring_index].display_name;\n    rule.mate_name = rule.mate_index == null\n      ? 'Any ' + DATA.families.find(family => family.id === rule.mate_family_index).display_name + '-family monster'\n      : DATA.species[rule.mate_index].display_name;\n  }\n  DATA.metadata.names = 'Current English patch names from the public translation snapshot. Gameplay provenance is independent.';\n  DATA.metadata.translation_sync = MONSTER_REFERENCE.metadata;\n})();\n`;
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
  const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/monster-baseline.json'), 'utf8'));
  const reference = buildReference(baseline, readBreeding(), comparison, manifest, publicRevision);
  const script = generateScript(reference);
  const output = path.resolve(options['--output'] || path.join(ROOT, 'data/monster-reference.js'));
  if (options['--check']) {
    requireValue(fs.readFileSync(output, 'utf8') === script, 'generated reference is out of date');
  } else if (!fs.existsSync(output) || fs.readFileSync(output, 'utf8') !== script) {
    fs.writeFileSync(output + '.tmp', script, 'utf8');
    fs.renameSync(output + '.tmp', output);
  }
  console.log(`Validated ${reference.metadata.coverage.named_species} names, ${reference.metadata.coverage.library_entries} captions, and 315 native stat profiles; public source ${publicRevision}.`);
}

module.exports = {verifySnapshot, validateBaseline, buildReference, generateScript, readBreeding, digest, STATS};
if (require.main === module) main(process.argv.slice(2)).catch(error => { console.error(error.message); process.exitCode = 1; });
