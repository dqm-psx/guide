const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SW_PATH = path.join(REPO_ROOT, 'sw.js');
const HTML_PATH = path.join(REPO_ROOT, 'index.html');
const MANIFEST_PATH = path.join(REPO_ROOT, 'manifest.webmanifest');

function readWorker() {
  return fs.readFileSync(SW_PATH, 'utf8');
}

// sw.js is not a module, so read its list with the same JSON parser a test can
// trust: the array is plain string literals, which is also valid JSON.
function readPrecache() {
  const match = readWorker().match(/const PRECACHE = (\[[\s\S]*?\]);/);
  assert.ok(match, 'sw.js must declare const PRECACHE = [...];');
  return JSON.parse(match[1]);
}

function toFile(entry) {
  return path.join(REPO_ROOT, entry.replace(/^\.\//, ''));
}

test('the service worker is versioned', () => {
  const match = readWorker().match(/const CACHE_NAME = "([^"]+)"/);
  assert.ok(match, 'sw.js must declare const CACHE_NAME');
  assert.ok(match[1].trim().length > 0, 'CACHE_NAME must not be empty');
});

test('the precache list points at files that exist', () => {
  const precache = readPrecache();
  assert.ok(precache.length > 0);
  for (const entry of precache) {
    assert.ok(entry.startsWith('./'), `precache entry must be scope-relative: ${entry}`);
    assert.ok(fs.existsSync(toFile(entry)), `missing precached file: ${entry}`);
  }
});

test('the precache list has no duplicates and omits the worker itself', () => {
  const precache = readPrecache();
  assert.equal(new Set(precache).size, precache.length, 'duplicate precache entry');
  assert.ok(!precache.some(entry => entry.endsWith('sw.js')), 'the worker must not cache itself');
});

test('every asset index.html loads is precached', () => {
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  const precache = new Set(readPrecache());
  const refs = new Set();
  for (const match of html.matchAll(/<script[^>]+src="([^"]+)"/g)) refs.add(match[1]);
  for (const match of html.matchAll(/<link[^>]+href="([^"]+)"/g)) refs.add(match[1]);
  assert.ok(refs.size > 0, 'expected index.html to reference local assets');
  for (const ref of refs) {
    if (/^(https?:)?\/\//.test(ref) || ref.startsWith('data:') || ref.startsWith('#')) continue;
    assert.ok(precache.has('./' + ref.replace(/^\.\//, '')), `index.html loads an uncached asset: ${ref}`);
  }
});

test('the manifest is installable and its icons ship offline', () => {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  assert.ok(manifest.name && manifest.short_name);
  assert.equal(manifest.start_url, './', 'start_url must stay relative to the site scope');
  assert.equal(manifest.scope, './', 'scope must stay relative to the site scope');
  assert.ok(Array.isArray(manifest.icons) && manifest.icons.length > 0);
  assert.ok(manifest.icons.some(icon => icon.sizes === '192x192' && icon.type === 'image/png'));
  assert.ok(manifest.icons.some(icon => icon.sizes === '512x512' && icon.type === 'image/png'));

  const precache = new Set(readPrecache());
  for (const icon of manifest.icons) {
    assert.ok(fs.existsSync(path.join(REPO_ROOT, icon.src)), `missing manifest icon: ${icon.src}`);
    assert.ok(precache.has('./' + icon.src), `manifest icon is not precached: ${icon.src}`);
  }

  // The tab icon and the iOS home-screen icon are separate links, not manifest
  // entries, so check them here too.
  const html = fs.readFileSync(HTML_PATH, 'utf8');
  for (const size of ['icons/icon-32.png', 'icons/icon-180.png']) {
    assert.ok(html.includes(size), `index.html should reference ${size}`);
    assert.ok(fs.existsSync(path.join(REPO_ROOT, size)), `missing icon file: ${size}`);
    assert.ok(precache.has('./' + size), `icon is not precached: ${size}`);
  }
});
