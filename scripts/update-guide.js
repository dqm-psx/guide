'use strict';

// Choose validation from the last successfully published site, never a cache
// entry or the checked-in wording snapshot. All downloaded text stays public.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const ROOT = path.resolve(__dirname, '..');
const MANIFEST = 'deployment-manifest.json';
const SHA = /^[a-f0-9]{40}$/;
const HASH = /^[a-f0-9]{64}$/;
const fields = ['schema_version', 'guide_revision', 'source_fingerprint', 'public_revision', 'content_sha256'];
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const requireValue = (value, message) => { if (!value) throw new Error(message); };
const isDocumentation = file => ['README.md', 'LICENSE', 'LICENSE.md', 'LICENSE.txt'].includes(file) || /^docs\/.+\.md$/.test(file);
const docsOnly = files => files.every(isDocumentation);

function git(...args) {
  return execFileSync('git', ['-c', `safe.directory=${ROOT}`, ...args], {cwd: ROOT, encoding: 'utf8'}).trimEnd();
}

function fingerprintTree(tree) {
  const entries = tree.split('\0').filter(Boolean).filter(entry => {
    const split = entry.indexOf('\t');
    requireValue(split > 0, 'Invalid Git tree entry');
    return !isDocumentation(entry.slice(split + 1));
  }).sort();
  requireValue(entries.length > 0, 'No application inputs in Git tree');
  return digest(JSON.stringify(entries));
}

function sourceFingerprint() {
  // Git blobs avoid platform-dependent checkout line endings. Unknown tracked
  // paths count as application inputs; docs are the only exclusion.
  return fingerprintTree(git('ls-tree', '-rz', '--full-tree', 'HEAD'));
}

function contentFingerprint(directory) {
  const entries = [];
  function visit(relative) {
    for (const item of fs.readdirSync(path.join(directory, relative), {withFileTypes: true})) {
      const file = relative ? `${relative}/${item.name}` : item.name;
      if (file === MANIFEST) continue; // No circular hash or deployment timestamp.
      requireValue(!item.isSymbolicLink(), 'Publication assets must not be symlinks');
      if (item.isDirectory()) visit(file);
      else {
        requireValue(item.isFile(), 'Unexpected publication entry');
        entries.push([file, digest(fs.readFileSync(path.join(directory, file)))]);
      }
    }
  }
  visit('');
  requireValue(entries.some(([file]) => file === 'index.html'), 'Missing staged application');
  return digest(JSON.stringify(entries.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)));
}

function validManifest(value) {
  return !!value && !Array.isArray(value) &&
    Object.keys(value).sort().join('|') === [...fields].sort().join('|') &&
    value.schema_version === 1 && fields.slice(1).every(field => typeof value[field] === 'string') && SHA.test(value.guide_revision) &&
    SHA.test(value.public_revision) && HASH.test(value.source_fingerprint) && HASH.test(value.content_sha256);
}

function planUpdate(current, previous) {
  requireValue(validManifest(current), 'Invalid prepared deployment identity');
  if (!validManifest(previous) || current.source_fingerprint !== previous.source_fingerprint) return 'full';
  return current.content_sha256 === previous.content_sha256 && current.public_revision === previous.public_revision
    ? 'none' : 'translation';
}

async function deployedManifest(fetcher = fetch) {
  try {
    const response = await fetcher(`https://dqm-psx.github.io/guide/${MANIFEST}?check=${Date.now()}`, {
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: {'Cache-Control': 'no-cache', Accept: 'application/json'},
    });
    if (!response.ok) return null;
    let body = '';
    for await (const chunk of response.body) {
      body += Buffer.from(chunk).toString('utf8');
      if (body.length > 4096) return null;
    }
    const value = JSON.parse(body);
    return validManifest(value) ? value : null;
  } catch {
    // Missing/old/unavailable metadata can only increase validation.
    return null;
  }
}

function run(script, ...args) {
  execFileSync(process.execPath, [path.join(ROOT, 'scripts', script), ...args], {cwd: ROOT, stdio: 'inherit'});
}

function publicRevision() {
  const text = fs.readFileSync(path.join(ROOT, 'data/monster-reference.js'), 'utf8');
  const line = text.split('\n').find(line => line.startsWith('globalThis.MONSTER_REFERENCE = '));
  requireValue(line?.endsWith(';'), 'Invalid generated reference');
  const revision = JSON.parse(line.slice('globalThis.MONSTER_REFERENCE = '.length, -1)).metadata.public_revision;
  requireValue(SHA.test(revision), 'Invalid public translation revision');
  return revision;
}

function output(values) {
  const text = Object.entries(values).map(([key, value]) => {
    requireValue(/^[a-z_][a-z0-9_]*$/.test(key) && !/[\r\n]/.test(String(value)), 'Invalid workflow output');
    return `${key}=${value}\n`;
  }).join('');
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, text);
  process.stdout.write(text);
}

async function main(args) {
  const [command, ...rest] = args;
  if (command === 'pr-plan') {
    requireValue(rest.length === 2 && rest.every(value => SHA.test(value)), 'Expected base and head commit SHAs');
    // --no-renames exposes both names, so moving executable code to docs is
    // never mistaken for a documentation-only change.
    const files = git('diff', '--name-only', '--no-renames', '-z', ...rest).split('\0').filter(Boolean);
    output({docs_only: docsOnly(files)});
    return;
  }
  if (command === 'prepare') {
    requireValue(rest.length === 0, 'Unexpected prepare arguments');
    git('diff', '--exit-code', '--quiet', 'HEAD');
    const guide_revision = git('rev-parse', 'HEAD');
    const source_fingerprint = sourceFingerprint();
    const previous = await deployedManifest();
    run('sync-monster-reference.js');
    run('sync-stage-site.js');
    const current = {schema_version: 1, guide_revision, source_fingerprint,
      public_revision: publicRevision(), content_sha256: contentFingerprint(path.join(ROOT, 'site-dist'))};
    const mode = planUpdate(current, previous);
    output({mode, guide_revision, public_revision: current.public_revision, source_fingerprint, content_sha256: current.content_sha256});
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      mode === 'none' ? 'Guide and translations match the last successful deployment. No browser runner or deployment is needed.\n' :
      `Validation: **${mode}**. Guide revision: \`${guide_revision}\`. Public translation revision: \`${current.public_revision}\`.\n`);
    return;
  }
  if (command === 'verify') {
    const options = {};
    requireValue(rest.length % 2 === 0, 'Expected verification option values');
    const allowed = ['--guide-revision', '--public-revision', '--source-fingerprint', '--content-sha256', '--mode'];
    for (let i = 0; i < rest.length; i += 2) {
      requireValue(allowed.includes(rest[i]) && options[rest[i]] === undefined, 'Invalid verification option');
      options[rest[i]] = rest[i + 1];
    }
    const current = {schema_version: 1, guide_revision: options['--guide-revision'], public_revision: options['--public-revision'],
      source_fingerprint: options['--source-fingerprint'], content_sha256: options['--content-sha256']};
    requireValue(validManifest(current) && ['full', 'translation'].includes(options['--mode']), 'Invalid verification identity');
    git('diff', '--exit-code', '--quiet', 'HEAD');
    requireValue(git('rev-parse', 'HEAD') === current.guide_revision && sourceFingerprint() === current.source_fingerprint,
      'Validation checkout differs from the prepared guide');
    run('sync-monster-reference.js', '--public-revision', current.public_revision);
    run('sync-stage-site.js');
    requireValue(publicRevision() === current.public_revision && contentFingerprint(path.join(ROOT, 'site-dist')) === current.content_sha256,
      'Prepared publication changed between jobs');
    fs.writeFileSync(path.join(ROOT, 'site-dist', MANIFEST), JSON.stringify(current, null, 2) + '\n');
    return;
  }
  throw new Error('Expected pr-plan, prepare, or verify');
}

module.exports = {docsOnly, fingerprintTree, contentFingerprint, validManifest, planUpdate, deployedManifest};
if (require.main === module) main(process.argv.slice(2)).catch(error => {console.error(error.message); process.exitCode = 1;});
