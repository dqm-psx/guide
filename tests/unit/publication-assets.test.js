'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {versionAssets} = require('../../scripts/sync-stage-site');
const root = path.resolve(__dirname, '../..');
const workerSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const precacheOf = worker => JSON.parse(worker.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1]);
const cacheVersion = worker => worker.match(/const CACHE_VERSION = "([^"]+)";/)[1];
function sourceAssets() {
  const files = [...precacheOf(workerSource).map(file => file.slice(2)), 'sw.js', '.nojekyll'];
  return new Map(files.map(file => [file, fs.readFileSync(path.join(root, file))]));
}
function scriptURL(html, file) {
  return [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]).find(url => url.split('?')[0] === file);
}

test('published assets, manifest icons and offline keys share exact fingerprinted URLs', () => {
  const source = sourceAssets();
  const published = versionAssets(source);
  const html = published.get('index.html').toString();
  const precache = precacheOf(published.get('sw.js').toString());
  const keys = new Set(precache.map(ref => new URL(ref, 'https://example.com/guide/sw.js').href));
  for (const tag of html.matchAll(/<(?:script|link|img)\s[^>]*>/g)) {
    const url = tag[0].match(/(?:src|href)="([^"]+)"/)?.[1];
    if (!url || /^(https?:|\/\/|#)/.test(url)) continue;
    assert.match(url, /\?v=[0-9a-f]{16}$/);
    assert.ok(keys.has(new URL(url, 'https://example.com/guide/').href), `uncached published asset ${url}`);
    assert.ok(published.has(url.split('?')[0]));
  }
  assert.ok(keys.has('https://example.com/guide/index.html'));
  const brandImage = html.match(/<img[^>]+src="(icons\/icon-192\.png[^\"]*)"/);
  assert.ok(brandImage, 'the visible brand image must be tested as an offline asset');
  assert.match(brandImage[1], /\?v=[0-9a-f]{16}$/);
  assert.ok(keys.has(new URL(brandImage[1], 'https://example.com/guide/').href));
  const manifest = JSON.parse(published.get('manifest.webmanifest'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  for (const icon of manifest.icons) {
    assert.match(icon.src, /\?v=[0-9a-f]{16}$/);
    assert.ok(keys.has(new URL(icon.src, 'https://example.com/guide/').href));
  }
  assert.match(cacheVersion(published.get('sw.js').toString()), /^content-[0-9a-f]{16}$/);
  assert.equal(source.get('index.html').toString(), fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
  assert.deepEqual([...versionAssets(source)], [...published]);
  assert.deepEqual([...versionAssets(published)], [...published]);
});

test('a translation-only update changes its URL and offline cache but retains unchanged asset URLs', () => {
  const original = sourceAssets();
  const before = versionAssets(original);
  const updated = new Map(original);
  updated.set('data/monster-reference.js', Buffer.from(original.get('data/monster-reference.js').toString() + '\n// New translation snapshot\n'));
  const after = versionAssets(updated);
  const firstHTML = before.get('index.html').toString(), nextHTML = after.get('index.html').toString();
  assert.notEqual(scriptURL(firstHTML, 'data/monster-reference.js'), scriptURL(nextHTML, 'data/monster-reference.js'));
  assert.equal(scriptURL(firstHTML, 'js/router.js'), scriptURL(nextHTML, 'js/router.js'));
  assert.notEqual(cacheVersion(before.get('sw.js').toString()), cacheVersion(after.get('sw.js').toString()));
  const newURL = scriptURL(nextHTML, 'data/monster-reference.js');
  assert.ok(precacheOf(after.get('sw.js').toString()).includes('./' + newURL));
  assert.ok(!precacheOf(after.get('sw.js').toString()).includes('./' + scriptURL(firstHTML, 'data/monster-reference.js')));
});

test('packaging rejects a missing referenced file instead of publishing a broken offline bundle', () => {
  const files = sourceAssets();
  files.delete('js/router.js');
  assert.throws(() => versionAssets(files), /Missing referenced asset: js\/router.js/);
});

test('worker revalidates the HTTP cache and keeps cache writes alive through completion', async () => {
  const handlers = {}, pending = [], cached = new Map();
  const url = 'https://example.com/guide/data/monster-reference.js';
  const stale = {ok: true, type: 'basic', body: 'old HTTP-cache snapshot', clone() {return this;}};
  const fresh = {ok: true, type: 'basic', body: 'current network snapshot', clone() {return this;}};
  cached.set(url, stale);
  let fetchOptions, releaseWrite, putStarted;
  const writing = new Promise(resolve => { putStarted = resolve; });
  const writeGate = new Promise(resolve => { releaseWrite = resolve; });
  const cache = {
    async match(key) {return cached.get(typeof key === 'string' ? key : key.url);},
    async put(key, value) {putStarted(); await writeGate; cached.set(typeof key === 'string' ? key : key.url, value);},
  };
  const context = vm.createContext({URL, Request, Response,
    self: {location: {href: 'https://example.com/guide/sw.js', origin: 'https://example.com'}, addEventListener(name, listener) {handlers[name] = listener;}},
    caches: {async open() {return cache;}},
    fetch: async (_request, options) => {fetchOptions = options; return options?.cache === 'no-cache' ? fresh : stale;},
  });
  vm.runInContext(workerSource, context);
  let response;
  const request = {method: 'GET', mode: 'no-cors', url};
  handlers.fetch({request, respondWith(value) {response = value;}, waitUntil(value) {pending.push(value);}});
  assert.equal((await response).body, 'current network snapshot');
  assert.equal(fetchOptions.cache, 'no-cache');
  await writing;
  assert.equal(pending.length, 1);
  assert.equal(cached.get(url).body, 'old HTTP-cache snapshot');
  releaseWrite(); await Promise.all(pending);
  assert.equal(cached.get(url).body, 'current network snapshot');
  context.fetch = async () => {throw new Error('offline');};
  handlers.fetch({request, respondWith(value) {response = value;}, waitUntil() {}});
  assert.equal((await response).body, 'current network snapshot');
});

test('installation reloads precached files instead of copying stale browser HTTP responses', async () => {
  const handlers = {}; let completion, requests, skipped = false;
  const context = vm.createContext({URL, Request,
    self: {location: {href: 'https://example.com/guide/sw.js'}, addEventListener(name, listener) {handlers[name] = listener;}, async skipWaiting() {skipped = true;}},
    caches: {async open() {return {async addAll(value) {requests = value;}};}},
  });
  vm.runInContext(workerSource, context);
  handlers.install({waitUntil(value) {completion = value;}});
  await completion;
  assert.equal(skipped, true);
  assert.equal(requests.length, precacheOf(workerSource).length);
  assert.ok(requests.every(request => request.cache === 'reload'));
  assert.ok(requests.some(request => request.url === 'https://example.com/guide/data/monster-reference.js'));
});
