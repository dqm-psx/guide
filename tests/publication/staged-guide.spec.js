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

  const assets = await page.evaluate(() => Array.from(document.querySelectorAll('script[src], link[rel="stylesheet"], link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="manifest"], .brand img[src], .hero-map img[src]'))
    .map(element => element.src || element.href));
  expect(assets.length).toBeGreaterThan(10);
  for (const asset of assets) {
    expect(asset.startsWith(url), 'Asset mounted under /guide/: ' + asset).toBe(true);
    expect(new URL(asset).searchParams.get('v'), 'Content identity: ' + asset).toMatch(/^[a-f0-9]{16}$/);
  }
  expect(await page.evaluate(() => Boolean(window.DATA || window.GUIDE_REFERENCE || window.MONSTER_REFERENCE))).toBe(false);
  const guideNames = shipped.reference.guide_names;
  expect(guideNames.coverage.items).toBe(Object.keys(guideNames.items).length);
  expect(guideNames.coverage.maps).toBe(Object.keys(guideNames.maps).length);
  await page.locator('.hero-map').click();
  await page.locator('.map-image img').evaluate(img => img.decode());
  await expect(page.locator('.map-doors a').first()).toBeVisible();
  expect(await page.evaluate(() => Boolean(window.DATA || window.MONSTER_REFERENCE))).toBe(false);
  const named = await page.evaluate(() => ({
    item: FIELD_GUIDE.entries.find(row => row.id === 'item-41'),
    skill: FIELD_GUIDE.skill_names[1],
    map: PLAYER_ATLAS.maps[0],
    revision: WORLD_GUIDE.provenance.name_public_revision
  }));
  expect(named.item.title).toBe(guideNames.items['item-41'].title);
  expect(named.item.names).toEqual(guideNames.items['item-41'].names);
  expect(named.skill).toMatchObject({title: guideNames.skills[1].title, description: guideNames.skills[1].description});
  expect(named.skill.description.length).toBeGreaterThan(0);
  expect(named.map.title).toBe(guideNames.maps[named.map.id].title);
  expect(named.revision).toBe(shipped.reference.metadata.public_revision);
  expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
  expect(await page.locator('.brand img').evaluate(image => image.complete && image.naturalWidth > 0)).toBe(true);
  await page.evaluate(() => { location.hash = 'pair-finder'; });
  await expect(page.locator('#pair-finder #result-name a')).toBeVisible();
  const currentNames = await page.evaluate(() => DATA.species.map(entry => [entry.index, entry.name, entry.display_name]));
  expect(currentNames).toEqual(shipped.data.species.map(entry => [entry.index, entry.name, entry.display_name]));
  expect(await page.evaluate(() => Boolean(window.MONSTER_REFERENCE))).toBe(false);
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
  await expect(page.locator('#monster-skills li a')).toHaveText(record.skills.terry.map(skill => skill.name));
  await expect(page.locator('#monster-skills .skill-minimum')).toHaveText(record.skills.terry.map(skill =>
    'Min. level ' + shipped.reference.guide_names.skills[skill.id].minimum_level));

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

test('downloading the guide keeps its tools, atlas and profiles usable offline', async ({ page, context }) => {
  const check = audit(page, context);
  await page.goto(url + '#monster?id=11');
  await waitForOfflineCache(page);
  await page.locator('#guide-settings > summary').click();
  await page.locator('#download-offline').click();
  await expect(page.locator('#offline-status')).toHaveText('Ready to use offline.', {timeout: 30000});
  await page.locator('#guide-settings > summary').click();
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
    await page.goto(url+'entries/');
    await expect(page.getByRole('heading',{name:'Guide index',exact:true})).toBeVisible();
    await page.getByRole('link',{name:'Bang',exact:true}).first().click();
    await expect(page.locator('#article-title')).toHaveText('Bang');
    check.assertClean();
  } finally { await context.setOffline(false); }
});

test('real entry URLs expose crawlable references and open the matching interactive tool',async ({browser,page})=>{
  const entry = 'skills/e0c2b/';
  const staticContext = await browser.newContext({javaScriptEnabled:false});
  try {
    const reader = await staticContext.newPage();
    await reader.goto(url+'articles/boss-golem/');
    await expect(reader.getByRole('heading',{level:1})).toHaveText('Golem');
    await expect(reader.locator('main')).toContainText('HP 100');
    await expect(reader.getByRole('link',{name:'Guardian Gate'}).first()).toBeVisible();
    await reader.goto(url+entry);
    await expect(reader.getByRole('heading',{level:1})).toHaveText('Bang');
    await expect(reader.locator('main')).toContainText('MP cost');
    await expect(reader.locator('meta[property="og:image"]')).toHaveAttribute('content',/guide-card\.png$/);
    await expect(reader.locator('link[rel="canonical"]')).toHaveAttribute('href','https://dqm-psx.github.io/guide/'+entry);
    const sitemap = await (await reader.request.get(url+'sitemap.xml')).text();
    const paths = [...sitemap.matchAll(/<loc>https:\/\/dqm-psx\.github\.io\/guide\/([^<]*)<\/loc>/g)].map(m=>m[1]);
    expect(paths.length).toBeGreaterThan(800);
    expect(new Set(paths).size).toBe(paths.length);
    expect(paths.filter(p=>!fs.existsSync(path.join(STAGED_ROOT,p,'index.html')))).toEqual([]);
  } finally {await staticContext.close();}
  await page.goto(url+entry);
  await expect(page.locator('#article-title')).toHaveText('Bang');
  await expect(page).toHaveURL(url+entry);
  await page.evaluate(() => Object.defineProperty(navigator,'clipboard',{configurable:true,
    value:{writeText:async text=>{ window.copiedEntry = text; }}}));
  await page.getByRole('button',{name:'Copy entry link'}).click();
  await expect(page.locator('#entry-copy-status')).toHaveText('Entry link copied.');
  expect(await page.evaluate(()=>window.copiedEntry)).toBe(url+entry);
  await page.locator('.nav a[href="#species-index"]').click();
  await expect(page.locator('#species-rows a').first()).toBeVisible();
  await page.goBack();
  await expect(page.locator('#article-title')).toHaveText('Bang');
  await page.goto(url+'monsters/11/');
  await expect(page.locator('#monster-heading')).toHaveText(name(11));
  await page.getByRole('button',{name:'Use as pedigree'}).click();
  await expect(page.locator('#pair-finder')).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(url+'monsters/11/');
  await expect(page.locator('#monster-heading')).toBeVisible();
  await expect(page.locator('#monster-heading')).toHaveText(name(11));
});

test('entry sharing selects the canonical URL when clipboard access is denied',async ({page})=>{
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{
    writeText:async ()=>{ throw new DOMException('Denied','NotAllowedError'); }
  }}));
  await page.goto(url+'index.html#field-guide?kind=boss&entry=boss-golem');
  const input=page.getByRole('textbox',{name:'Entry link to copy'});
  await page.getByRole('button',{name:'Copy entry link'}).click();
  await expect(input).toHaveValue(url+'articles/boss-golem/');
  await expect(input).toBeFocused();
  expect(await input.evaluate(el=>el.value.slice(el.selectionStart,el.selectionEnd))).toBe(url+'articles/boss-golem/');
  await page.locator('.nav a[href="#species-index"]').click();
  await expect(page.locator('#entry-share')).toBeHidden();
  await page.goBack();
  await expect(page.getByRole('button',{name:'Copy entry link'})).toBeVisible();
  await expect(input).toBeHidden();
});

test('published quests and characters can be followed with JavaScript disabled',async ({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false});
  try {
    const reader=await context.newPage();
    await reader.goto(url+'entries/');
    await reader.getByRole('link',{name:'Show monsters to the queen',exact:true}).click();
    const requests=reader.getByRole('heading',{name:'Monsters in request order'}).locator('..');
    await expect(requests.locator('ol li a')).toHaveCount(16);
    await reader.getByRole('link',{name:'Queen of GreatTree',exact:true}).click();
    const dialogue=reader.locator('.character-dialogue');
    await expect(dialogue).toContainText('A Winged Slime!');
    await expect(reader.getByRole('link',{name:'Show monsters to the queen',exact:true})).toHaveCount(1);
    await reader.goto(url+'articles/quest-sky-shield-and-flight/');
    const route=reader.locator('.entry-content > ol');
    await expect(route).toContainText('Prince Kameha’s friend');
    await expect(route).not.toContainText('bookcase');
    await reader.getByRole('link',{name:'Find the egg from the message in a bottle'}).click();
    await expect(reader.locator('.entry-content > ol')).toContainText('bookcase');
  } finally {await context.close();}
});

test('a direct entry respects saved spoilers and keeps its static reference when a tool fails', async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('dqm-guide-story-spoilers','hide'));
  await page.route('**/guide/index.html',route=>route.abort());
  await page.goto(url+'articles/story-greatlog-postgame/');
  await expect(page.getByRole('heading',{name:'Story entry'})).toBeVisible();
  await expect(page.locator('.entry-content')).toBeHidden();
  await page.getByRole('button',{name:'Reveal this entry'}).click();
  await expect(page.locator('.entry-content')).toBeVisible();
  await page.unroute('**/guide/index.html');
  await page.route('**/data/monster-reference.js*',route=>route.abort());
  await page.goto(url+'monsters/11/');
  await expect(page.getByRole('heading',{level:1,name:name(11),exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Open in the player guide'})).toBeVisible();
});

test('canonical walkthrough pages keep stage bookmarks with or without JavaScript',async({browser,page})=>{
  const path='walkthroughs/cobi-tara/#story-sky-treasures';
  const staticContext=await browser.newContext({javaScriptEnabled:false});
  try {
    const reader=await staticContext.newPage();
    await reader.goto(url+path);
    await expect(reader.getByRole('heading',{level:1})).toHaveText('Cobi & Tara walkthrough');
    await expect(reader.locator('#story-sky-treasures')).toBeInViewport();
    await expect(reader.locator('main')).toContainText('two right-hand tiles once each');
    await reader.getByRole('navigation',{name:'Jump to a stage'}).getByRole('link',{name:'Water World'}).click();
    await expect(reader.locator('#story-pirate-mermaids')).toBeInViewport();
  } finally { await staticContext.close(); }
  await page.goto(url+path);
  await expect(page.locator('#article-title')).toHaveText('Cobi & Tara walkthrough');
  await expect(page.locator('#story-sky-treasures')).toBeInViewport();
  await expect(page.locator('#story-between-worlds')).toBeAttached();
});
