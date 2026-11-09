const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test, expect } = require('@playwright/test');

const STAGED_ROOT = path.resolve(__dirname, '../../site-dist');
let server;
let url;
let shipped;
let precache;

test.beforeAll(async () => {
  if (!fs.existsSync(path.join(STAGED_ROOT, 'index.html'))) {
    throw new Error('Missing site-dist/index.html. Synchronize the reference and run node scripts/sync-stage-site.js before publication tests.');
  }
  // Expectations come from this exact artifact, not checked-in wording or a
  // hardcoded release version. Read the classic data scripts without a DOM.
  const context = vm.createContext({});
  for (const file of ['data/breeding-data.js', 'data/monster-reference.js']) {
    vm.runInContext(fs.readFileSync(path.join(STAGED_ROOT, file), 'utf8'), context, { timeout: 3000 });
  }
  shipped = JSON.parse(JSON.stringify({ data: context.DATA, reference: context.MONSTER_REFERENCE }));
  const worker = fs.readFileSync(path.join(STAGED_ROOT, 'sw.js'), 'utf8');
  const declaration = worker.match(/const PRECACHE = (\[[\s\S]*?\]);/);
  if (!declaration) throw new Error('Staged worker has no precache declaration.');
  precache = JSON.parse(declaration[1]).map(asset => ({
    asset,
    bytes: fs.statSync(path.join(STAGED_ROOT, asset.split('?')[0])).size,
  }));
  // Each worker owns its server. Serving the staged directory is read-only;
  // this suite never rebuilds or modifies an artifact during publication.
  const { startServer } = await import('../helpers/serve.js');
  const started = await startServer({ root: STAGED_ROOT, prefix: '/guide/' });
  server = started.server;
  url = started.baseURL;
});

test.afterAll(async () => {
  if (!server) return;
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
});

function audit(page, context) {
  const errors = [];
  const failures = [];
  const external = [];
  let online = true;
  page.on('pageerror', error => errors.push(error.message));
  context.on('requestfailed', request => {
    if (online) failures.push(request.url() + ': ' + request.failure()?.errorText);
  });
  context.on('response', response => {
    if (online && response.status() >= 400) failures.push(response.status() + ': ' + response.url());
  });
  context.on('request', request => {
    if (/^https?:/.test(request.url()) && !request.url().startsWith(url)) external.push(request.url());
  });
  return {
    offline() { online = false; },
    assertClean() {
      expect(errors, 'JavaScript errors in staged application').toEqual([]);
      expect(failures, 'Failed online application requests').toEqual([]);
      expect(external, 'Application requests outside its /guide/ origin').toEqual([]);
    },
  };
}

const species = index => shipped.data.species.find(entry => entry.index === index);
const reference = index => shipped.reference.species.find(entry => entry.index === index);
const name = index => species(index).display_name || species(index).name;
async function waitForOfflineCache(page) {
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 20000 });
}

test('the staged artifact boots with fingerprinted assets and its synchronized names', async ({ page, context }) => {
  const check = audit(page, context);
  const response = await page.goto(url);
  expect(response.ok()).toBe(true);
  await expect(page.locator('#field-guide')).toBeVisible();
  await expect(page.locator('.nav a[href="#field-guide"]')).toHaveAttribute('aria-current', 'page');
  await waitForOfflineCache(page);

  const assets = await page.evaluate(() => Array.from(document.querySelectorAll('script[src], link[href], .brand img[src], .hero-map img[src]'))
    .map(element => element.src || element.href));
  expect(assets.length).toBeGreaterThan(10);
  for (const asset of assets) {
    expect(asset.startsWith(url), 'Asset mounted under /guide/: ' + asset).toBe(true);
    expect(new URL(asset).searchParams.get('v'), 'Content identity: ' + asset).toMatch(/^[a-f0-9]{16}$/);
  }
  const currentNames = await page.evaluate(() => DATA.species.map(entry => [entry.index, entry.name, entry.display_name]));
  expect(currentNames).toEqual(shipped.data.species.map(entry => [entry.index, entry.name, entry.display_name]));
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  expect(await page.locator('.brand img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.locator('.hero-map').click();
  await page.locator('.map-image img').evaluate(img => img.decode());
  await expect(page.locator('.map-doors a').first()).toBeVisible();
  check.assertClean();
});

test('current-name search opens the matching library, growth, and provenance profile', async ({ page, context }) => {
  const check = audit(page, context);
  const index = 11;
  const record = reference(index);
  const metadata = shipped.reference.metadata;
  await page.goto(url + '#species-index');
  await page.locator('#species-search').fill(record.current_name);
  await page.locator('#species-rows a[href="#monster?id=' + index + '"]').click();
  await expect(page.locator('#monster')).toBeVisible();
  await expect(page.locator('#monster-heading')).toHaveText(name(index));
  await expect(page.locator('.monster-library-quote p')).toHaveText(record.library.text);
  const level = Math.min(99, Math.max(1, record.stats.base_level_limit));
  await expect(page.locator('#monster-growth-level')).toHaveValue(String(level));
  const stats = ['hp', 'mp', 'attack', 'defense', 'agility', 'intelligence'];
  await expect(page.locator('.monster-growth-row strong')).toHaveText(stats.map(stat =>
    '+' + record.stats.growth[stat].slice(1, level).reduce((sum, gain) => sum + gain, 0)));
  await expect(page.locator('#monster-skills li')).toHaveText(record.skills.terry.map(skill => skill.name));

  await page.locator('.monster-source > summary').click();
  const values = page.locator('.monster-source .source-versions dd');
  await expect(values.nth(0)).toHaveText(metadata.current_patch?.version || 'Not supplied by this snapshot');
  await expect(values.nth(1)).toContainText(metadata.updated_at.slice(0, 10));
  await expect(values.nth(2)).toHaveText(metadata.gameplay_verification?.version || metadata.gameplay_version || shipped.data.metadata.version);
  await expect(page.locator('.monster-source .source-versions a')).toHaveAttribute('href',
    'https://github.com/dqm-psx/translations/tree/' + metadata.public_revision);
  if (metadata.current_patch && metadata.gameplay_verification && metadata.current_patch.version !== metadata.gameplay_verification.version) {
    await expect(page.locator('.monster-source')).toContainText('The latest release has not yet had a separate gameplay verification.');
  }
  await waitForOfflineCache(page);
  check.assertClean();
});

test('ordered pairing results link correctly and a tree can expand a parent branch', async ({ page, context }) => {
  const check = audit(page, context);
  await page.goto(url + '#pair-finder?a=11&b=99');
  const forward = shipped.data.matrix[11][99];
  const reversed = shipped.data.matrix[99][11];
  await expect(page.locator('#result-name > a')).toHaveText(name(forward));
  await expect(page.locator('#result-name > a')).toHaveAttribute('href', '#monster?id=' + forward);
  await expect(page.locator('#reverse-name > a')).toHaveText(name(reversed));
  await page.locator('#swap').click();
  await expect(page.locator('#result-name > a')).toHaveText(name(reversed));
  await page.locator('#result-name > a').click();
  await expect(page.locator('#monster-heading')).toHaveText(name(reversed));

  await page.goto(url + '#monster?id=290');
  await page.locator('#monster .monster-primary').click();
  await expect(page.locator('#breeding-tree')).toBeVisible();
  await expect(page.locator('#tree-target')).toHaveValue('290');
  await expect(page.locator('.tree-node')).toHaveCount(3);
  await page.locator('[data-tree-select="0"]').click();
  await page.locator('[data-tree-recipe]:not([disabled])').first().click();
  await expect(page.locator('.tree-node')).toHaveCount(5);
  await expect(page).toHaveURL(/#breeding-tree\?.*branches=/);
  await waitForOfflineCache(page);
  check.assertClean();
});

test('a fresh staged install keeps every precached asset and its profile usable offline', async ({ page, context }) => {
  const check = audit(page, context);
  await page.goto(url + '#monster?id=11');
  await waitForOfflineCache(page);
  check.assertClean();
  check.offline();
  await context.setOffline(true);
  try {
    const response = await page.reload();
    expect(response.fromServiceWorker()).toBe(true);
    await expect(page.locator('#monster')).toBeVisible();
    await expect(page.locator('#monster-heading')).toHaveText(name(11));
    await expect(page.locator('.monster-library-quote p')).toHaveText(reference(11).library.text);
    expect(await page.locator('.brand img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
    const cached = await page.evaluate(async entries => Promise.all(entries.map(async ({ asset }) => {
      const response = await fetch(new URL(asset, location.href));
      return { asset, ok: response.ok, bytes: (await response.arrayBuffer()).byteLength };
    })), precache);
    expect(cached).toEqual(precache.map(entry => ({ ...entry, ok: true })));
    await page.locator('#monster .monster-primary').click();
    await expect(page.locator('#breeding-tree')).toBeVisible();
    await expect(page.locator('#tree-target')).toHaveValue('11');
    check.assertClean();
  } finally { await context.setOffline(false); }
});
