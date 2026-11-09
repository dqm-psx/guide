const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const REPO_ROOT = path.resolve(__dirname, '../..');
const LEGACY_CACHE = 'dqm-guide:/guide/upgrade-fixture-v0';
const oldAssets = new Map([
  ['js/router.js', Buffer.from('globalThis.previousGuideRouter = true;')],
  ['js/sprites.js', Buffer.from('globalThis.previousGuideSprites = true;')],
  ['css/guide.css', Buffer.from('body { --previous-guide-styles: cached; }')],
]);
const oldHtml = Buffer.from(`<!doctype html><html><head>
  <link rel="stylesheet" href="css/guide.css"></head><body>
  <h1>Previous guide installation</h1>
  <script src="js/router.js"></script><script src="js/sprites.js"></script>
  <script>navigator.serviceWorker.register('sw.js', {scope:'./'});</script>
  </body></html>`);
// Deliberately reproduce the old worker's default fetch cache mode. Keeping
// this worker active during publication makes fresh HTTP-cache entries matter;
// waiting for the new no-cache worker first would hide the original regression.
const oldWorker = Buffer.from(`
  const CACHE = ${JSON.stringify(LEGACY_CACHE)};
  self.addEventListener('install', event => event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll([
      './index.html', './js/router.js', './js/sprites.js', './css/guide.css'
    ])).then(() => self.skipWaiting())
  ));
  self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
  self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') return;
    event.respondWith(fetch(event.request).then(response => {
      const copy = response.clone();
      event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)));
      return response;
    }).catch(() => caches.open(CACHE).then(cache => cache.match(event.request))));
  });
`);

let server;
let baseUrl;
let published;
let workerCache;
let publicationLive = false;
let newWorkerLive = false;
const requests = [];

test.beforeAll(async () => {
  publicationLive = false;
  newWorkerLive = false;
  requests.length = 0;
  // Exercise the real publication transform, without racing another test's
  // site-dist directory or depending on a pre-existing build output.
  const { versionAssets } = await import('../../scripts/sync-stage-site.js');
  const source = new Map();
  for (const file of ['index.html', 'sw.js', 'manifest.webmanifest', '.nojekyll']) {
    source.set(file, fs.readFileSync(path.join(REPO_ROOT, file)));
  }
  for (const directory of ['js', 'css', 'data', 'icons', 'media', 'maps']) {
    for (const entry of fs.readdirSync(path.join(REPO_ROOT, directory), { withFileTypes: true })) {
      if (entry.isFile() && /\.(js|css|png|svg|ico|webp)$/.test(entry.name)) {
        const file = directory + '/' + entry.name;
        source.set(file, fs.readFileSync(path.join(REPO_ROOT, file)));
      }
    }
  }
  published = versionAssets(source);
  const version = published.get('sw.js').toString().match(/const CACHE_VERSION = "([^"]+)";/)[1];
  workerCache = 'dqm-guide:/guide/' + version;
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webp': 'image/webp' };
  server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    const file = url.pathname === '/guide/' ? 'index.html' : url.pathname.slice('/guide/'.length);
    requests.push(url.pathname + url.search);
    let bytes;
    if (url.pathname.startsWith('/guide/')) {
      if (file === 'sw.js') bytes = newWorkerLive ? published.get(file) : oldWorker;
      else if (!publicationLive && file === 'index.html') bytes = oldHtml;
      else if (!publicationLive && oldAssets.has(file)) bytes = oldAssets.get(file);
      else bytes = published.get(file);
    }
    if (!bytes) { response.writeHead(404); response.end('Not found'); return; }
    response.writeHead(200, {
      'Content-Type': (types[path.extname(file)] || 'text/plain') + '; charset=utf-8',
      // A document revalidation obtains the new shell while the previous
      // release's shared JS/CSS URLs remain fresh for another ten minutes.
      'Cache-Control': file === 'index.html' || file === 'sw.js' ? 'no-cache' : 'public, max-age=600',
    });
    response.end(bytes);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  baseUrl = 'http://127.0.0.1:' + server.address().port + '/guide/';
});

test.afterAll(async () => {
  if (!server) return;
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
});

test('a returning browser upgrades fresh cached assets under the old worker, then works offline', async ({ page, context }) => {
  test.setTimeout(45000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  // Do not use page.route here: Playwright routing disables the HTTP cache.
  await page.goto(baseUrl + 'index.html');
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  expect(await page.evaluate(() => previousGuideRouter && previousGuideSprites)).toBe(true);
  expect(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--previous-guide-styles').trim())).toBe('cached');
  const hitsBefore = Object.fromEntries(Array.from(oldAssets.keys()).map(file => [file, requests.filter(url => url === '/guide/' + file).length]));
  // Verify these are real fresh browser HTTP-cache entries, not just mock
  // responses or CacheStorage seeds; a fetch through the legacy worker must
  // not contact our server a second time.
  await page.evaluate(async files => {
    await Promise.all(files.map(file => fetch(file).then(response => response.text())));
  }, Array.from(oldAssets.keys()));
  for (const file of oldAssets.keys()) expect(requests.filter(url => url === '/guide/' + file).length).toBe(hitsBefore[file]);

  publicationLive = true;
  // Use the directory URL so this is a full return visit, not a same-document
  // hash change from the bootstrap index.html URL.
  await page.goto(baseUrl + '#breeding-tree?target=290&context=shrine');
  await expect(page.locator('#breeding-tree')).toBeVisible();
  await expect(page.locator('.tree-node')).toHaveCount(3);
  expect(await page.evaluate(() => typeof previousGuideRouter)).toBe('undefined');
  expect(await page.evaluate(() => typeof previousGuideSprites)).toBe('undefined');
  expect(await page.evaluate(() => getComputedStyle(document.body).getPropertyValue('--previous-guide-styles').trim())).toBe('');
  expect(await page.evaluate(name => caches.has(name), LEGACY_CACHE)).toBe(true);
  expect(await page.evaluate(name => caches.has(name), workerCache)).toBe(false);
  for (const file of oldAssets.keys()) {
    // The old URL is still fresh and unrequested; the newly loaded asset has
    // a different content identity even though the legacy worker is active.
    expect(requests.filter(url => url === '/guide/' + file).length).toBe(hitsBefore[file]);
    expect(requests.some(url => url.startsWith('/guide/' + file + '?v='))).toBe(true);
  }
  await page.locator('.nav a[href="#species-index"]').click();
  await page.locator('#species-search').fill('Slime');
  await page.locator('#species-rows a[href="#monster?id=11"]').click();
  await expect(page.locator('#monster')).toBeVisible();
  const heading = await page.locator('#monster-heading').textContent();
  await expect(page.locator('.monster-library-quote p')).not.toBeEmpty();

  // Now permit the new worker to install its matching fingerprinted precache.
  newWorkerLive = true;
  await page.evaluate(async () => {
    const controllerChanged = new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
    const registration = await navigator.serviceWorker.getRegistration();
    await registration.update();
    await controllerChanged;
  });
  await page.waitForFunction(async ({ current, previous }) => {
    const keys = await caches.keys();
    return keys.includes(current) && !keys.includes(previous) && navigator.serviceWorker.controller !== null;
  }, { current: workerCache, previous: LEGACY_CACHE }, { timeout: 20000 });
  await context.setOffline(true);
  try {
    const offline = await page.reload();
    expect(offline.fromServiceWorker()).toBe(true);
    await expect(page.locator('#monster')).toBeVisible();
    await expect(page.locator('#monster-heading')).toHaveText(heading);
    await expect(page.locator('.monster-library-quote p')).not.toBeEmpty();
    expect(await page.locator('.brand img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    await page.locator('.nav a[href="#breeding-tree"]').click();
    await expect(page.locator('#breeding-tree')).toBeVisible();
    await expect(page.locator('.tree-node')).toHaveCount(3);
    expect(errors).toEqual([]);
  } finally { await context.setOffline(false); }
});
