'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  docsOnly, fingerprintTree, contentFingerprint, validManifest, planUpdate, deployedManifest,
} = require('../../scripts/update-guide');

const ROOT = path.resolve(__dirname, '../..');
const sha = character => character.repeat(40);
const hash = character => character.repeat(64);
const manifest = overrides => ({
  schema_version: 1,
  guide_revision: sha('a'),
  source_fingerprint: hash('b'),
  public_revision: sha('c'),
  content_sha256: hash('d'),
  ...overrides,
});
const entry = (file, blob = sha('a'), mode = '100644') => `${mode} blob ${blob}\t${file}\0`;

function temporaryDirectory(t) {
  const parent = path.resolve(os.tmpdir());
  const directory = fs.mkdtempSync(path.join(parent, 'dqm-guide-update-test-'));
  t.after(() => {
    // Restrict recursive cleanup to the exact temporary directory we created.
    assert.equal(path.dirname(directory), parent);
    assert.ok(path.basename(directory).startsWith('dqm-guide-update-test-'));
    fs.rmSync(directory, { recursive: true, force: true });
  });
  return directory;
}

function write(directory, file, text) {
  const target = path.join(directory, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, text);
}

function response(text, split = Math.ceil(text.length / 2)) {
  return {
    ok: true,
    body: (async function* () {
      yield Buffer.from(text.slice(0, split));
      yield Buffer.from(text.slice(split));
    })(),
  };
}

test('documentation exemption is narrow and renamed code retains its old application path', () => {
  assert.equal(docsOnly(['README.md', 'LICENSE', 'LICENSE.md', 'LICENSE.txt', 'docs/guide.md', 'docs/nested/notes.md']), true);
  assert.equal(docsOnly([]), true);
  for (const file of ['index.html', 'js/reference.js', 'README.txt', 'CHANGELOG.md', 'docs/index.html', 'docs/example.js', 'docs/settings.json', 'docs/Guide.MD', 'other/README.md', '.github/workflows/ci.yml']) {
    assert.equal(docsOnly(['README.md', file]), false, file);
  }
  // pr-plan uses Git --no-renames, which exposes both paths of a rename.
  assert.equal(docsOnly(['js/retired.js', 'docs/retired.md']), false);
  assert.equal(docsOnly(['docs/old.md', 'docs/new.md']), true);
});

test('source identity ignores only documentation and includes unknown paths and file modes', () => {
  const application = entry('index.html') + entry('js/reference.js', sha('b'));
  const fingerprint = fingerprintTree(application);
  assert.equal(fingerprintTree(entry('js/reference.js', sha('b')) + entry('index.html')), fingerprint);
  assert.equal(fingerprintTree(application + entry('README.md') + entry('docs/nested/notes.md')), fingerprint);
  assert.equal(fingerprintTree(application + entry('README.md', sha('f'))), fingerprint);
  assert.notEqual(fingerprintTree(application + entry('unexpected/new-input.cfg')), fingerprint);
  assert.notEqual(fingerprintTree(application + entry('docs/example.js')), fingerprint);
  assert.notEqual(fingerprintTree(entry('index.html') + entry('js/reference.js', sha('b'), '100755')), fingerprint);
  assert.notEqual(fingerprintTree(entry('index.html') + entry('js/reference.js', sha('f'))), fingerprint);
  assert.throws(() => fingerprintTree(''), /No application inputs/);
  assert.throws(() => fingerprintTree(entry('README.md')), /No application inputs/);
  assert.throws(() => fingerprintTree('not a Git tree entry\0'), /Invalid Git tree entry/);
});

test('no-op requires matching source, publication bytes and public revision while docs commit hashes may differ', () => {
  const previous = manifest();
  const current = manifest({ guide_revision: sha('e') });
  assert.equal(planUpdate(current, previous), 'none');
  assert.equal(planUpdate(manifest({ source_fingerprint: hash('e') }), previous), 'full');
  assert.equal(planUpdate(manifest({ content_sha256: hash('e') }), previous), 'translation');
  assert.equal(planUpdate(manifest({ public_revision: sha('e') }), previous), 'translation');
  assert.equal(planUpdate(manifest({ public_revision: sha('e'), content_sha256: hash('f') }), previous), 'translation');
  assert.deepEqual(previous, manifest());
});

test('missing or invalid deployed identities force full validation and invalid prepared identities are rejected', () => {
  const invalid = [
    undefined, null, [], {},
    manifest({ schema_version: 2 }),
    manifest({ guide_revision: 'main' }),
    manifest({ public_revision: '' }),
    manifest({ source_fingerprint: sha('b') }),
    manifest({ content_sha256: 'not-a-hash' }),
    ...['guide_revision', 'source_fingerprint', 'public_revision', 'content_sha256'].flatMap(field => [
      manifest({ [field]: [manifest()[field]] }),
      manifest({ [field]: { toString: () => manifest()[field] } }),
    ]),
    { ...manifest(), extra: 'unrecognized metadata' },
  ];
  assert.equal(validManifest(manifest()), true);
  for (const previous of invalid) {
    assert.equal(validManifest(previous), false);
    assert.equal(planUpdate(manifest(), previous), 'full');
    assert.throws(() => planUpdate(previous, manifest()), /Invalid prepared deployment identity/);
  }
});

test('deployed identity reads bypass caches and accept only a complete valid streamed manifest', async () => {
  let requested;
  const expected = manifest();
  const actual = await deployedManifest(async (url, options) => {
    requested = { url: new URL(url), options };
    return response(JSON.stringify(expected), 17);
  });
  assert.deepEqual(actual, expected);
  assert.equal(requested.url.origin, 'https://dqm-psx.github.io');
  assert.equal(requested.url.pathname, '/guide/deployment-manifest.json');
  assert.match(requested.url.searchParams.get('check'), /^\d+$/);
  assert.equal(requested.options.cache, 'no-store');
  assert.equal(requested.options.redirect, 'error');
  assert.equal(requested.options.headers['Cache-Control'], 'no-cache');
  assert.equal(requested.options.headers.Accept, 'application/json');
  assert.ok(requested.options.signal instanceof AbortSignal);
  assert.equal(requested.options.signal.aborted, false);
});

test('network, HTTP, stream, size and malformed deployment failures all fall back to full validation', async () => {
  const failures = [
    ['network error', async () => { throw new Error('offline'); }],
    ['HTTP error', async () => ({ ok: false })],
    ['missing body', async () => ({ ok: true, body: null })],
    ['invalid JSON', async () => response('{')],
    ['old schema', async () => response(JSON.stringify(manifest({ schema_version: 0 })))],
    ['partial manifest', async () => response(JSON.stringify({ schema_version: 1 }))],
    ['extra metadata', async () => response(JSON.stringify({ ...manifest(), unrelated: true }))],
    ['oversize response', async () => response(' '.repeat(4097) + JSON.stringify(manifest()))],
    ['interrupted stream', async () => ({ ok: true, body: (async function* () { yield Buffer.from('{'); throw new Error('connection closed'); })() })],
  ];
  for (const [label, fetcher] of failures) {
    const previous = await deployedManifest(fetcher);
    assert.equal(previous, null, label);
    assert.equal(planUpdate(manifest(), previous), 'full', label);
  }
});

test('publication identity is deterministic, excludes its own manifest, and changes with application bytes', t => {
  const first = temporaryDirectory(t);
  const second = temporaryDirectory(t);
  write(first, 'index.html', '<h1>Guide</h1>');
  write(first, 'js/reference.js', 'const version = 1;');
  write(second, 'js/reference.js', 'const version = 1;');
  write(second, 'index.html', '<h1>Guide</h1>');
  const original = contentFingerprint(first);
  assert.equal(contentFingerprint(first), original);
  assert.equal(contentFingerprint(second), original);
  write(first, 'deployment-manifest.json', JSON.stringify(manifest()));
  assert.equal(contentFingerprint(first), original);
  write(first, 'deployment-manifest.json', JSON.stringify(manifest({ guide_revision: sha('f') })));
  assert.equal(contentFingerprint(first), original);
  write(first, 'js/reference.js', 'const version = 2;');
  assert.notEqual(contentFingerprint(first), original);
});

test('publication identity rejects a directory without its index', t => {
  const directory = temporaryDirectory(t);
  write(directory, 'js/reference.js', 'const version = 1;');
  assert.throws(() => contentFingerprint(directory), /Missing staged application/);
});

test('publication identity rejects symlinked assets instead of hashing outside the staged tree', t => {
  const directory = temporaryDirectory(t);
  write(directory, 'index.html', '<h1>Guide</h1>');
  write(directory, 'assets/style.css', 'body{}');
  try {
    // Windows directory junctions do not require developer-mode symlink rights.
    fs.symlinkSync(path.join(directory, 'assets'), path.join(directory, 'linked-assets'), process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (!['EPERM', 'EACCES', 'ENOSYS', 'ENOTSUP'].includes(error.code)) throw error;
    t.skip('This environment does not permit symlink creation');
    return;
  }
  assert.throws(() => contentFingerprint(directory), /must not be symlinks/);
});

test('CI and publication browser images match the locked Playwright package', () => {
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'package-lock.json'), 'utf8'));
  const version = lock.packages['node_modules/@playwright/test'].version;
  for (const file of ['ci.yml', 'publish-guide.yml']) {
    const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows', file), 'utf8');
    const images = [...workflow.matchAll(/image:\s*mcr\.microsoft\.com\/playwright:v([^\s]+)-noble/g)];
    assert.ok(images.length > 0, `${file} must declare its browser image`);
    for (const image of images) assert.equal(image[1], version, file);
  }
});
