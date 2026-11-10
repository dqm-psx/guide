const path = require('node:path');
const {test,expect} = require('@playwright/test');
const loadStagedData = require('./staged-data');
let server, url, shipped;

test.beforeAll(async () => {
  shipped=loadStagedData(path.resolve(__dirname,'../../site-dist'));
  const {startServer} = await import('../helpers/serve.js');
  const started = await startServer({root:path.resolve(__dirname,'../../site-dist'),prefix:'/guide/'});
  server=started.server;
  url=started.baseURL;
});
test.afterAll(async () => {
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
});

test('published gate characters and boss conversations work without JavaScript',async ({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false});
  try {
    const page=await context.newPage();
    await page.goto(url+'articles/location-townsperson-s-gate/');
    const princess=page.locator('.entry-location-characters a[href="articles/npc-laura/"]');
    await expect(princess).toHaveText(shipped.entry('npc-laura').title);
    await expect(princess.locator('img')).toBeVisible();
    await princess.click();
    await page.locator('.character-dialogue > summary').click();
    await expect(page.locator('.spoken-lines')).toContainText(shipped.dialogue['npc-laura'][0].passages[0]);
    await page.goto(url+'articles/boss-dragon/');
    await page.locator('.character-dialogue > summary').click();
    await expect(page.locator('.spoken-lines').first()).toContainText(shipped.dialogue['boss-dragon'][0].passages[0]);
  } finally {await context.close();}
});

test('published location and map pages connect their maps and guide context without JavaScript',async ({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false});
  try {
    const page=await context.newPage();
    await page.goto(url+'articles/location-water-world/');
    const maps=page.locator('.location-maps');
    await expect(maps.locator('img')).toHaveCount(1);
    await expect(maps.locator('img')).toHaveAttribute('alt',shipped.map('map-18-1').title+' map');
    expect((await maps.boundingBox()).y).toBeLessThan((await page.locator('#location-encounters').boundingBox()).y);
    await maps.locator('a[href="places/map-29-1/"]').click();
    await expect(page.locator('.entry-map')).toBeVisible();
    await expect(page.locator('a[href="articles/location-water-world/"]')).toBeVisible();
    await expect(page.locator('a[href="walkthroughs/cobi-tara/#story-pirate-mermaids"]')).toBeVisible();
    await expect(page.locator('a[href="articles/boss-ghost-ship-pirates/"]')).toBeVisible();
    await page.locator('a[href="articles/location-water-world/#location-encounters"]').click();
    await expect(page.locator('#location-encounters')).toBeInViewport();
    await page.goto(url+'articles/location-guardian-gate/');
    await expect(page.locator('.location-maps')).toContainText('Entrance');
    await expect(page.locator('.location-maps .entry-gate-label')).toHaveText(await page.locator('.entry-content h1').textContent());
    await expect(page.locator('.location-maps .entry-map')).toHaveCount(2);
    const finalArea=page.locator('.entry-gate-map[data-map-role="final"]');
    await expect(finalArea).toContainText('Final area');
    await expect(finalArea.locator('a[href="places/map-73-0/"]')).toBeVisible();
    await expect(finalArea.locator('.entry-map')).toBeVisible();
    await expect(page.locator('.entry-gate-facts')).toContainText('Arena requirement');
    await expect(page.locator('.entry-gate-facts a[href="articles/quest-arena-dqm1-g/"]')).toHaveText('Win Class G or higher');
    await expect(page.locator('.entry-boss-link .entry-portrait')).toHaveCount(1);
    await expect(page.locator('.entry-boss-link')).toHaveText(shipped.entry('boss-golem').title);
    await expect(page.locator('.entry-content > h1 + p')).toHaveCount(0);
    const summary=page.locator('.entry-gate-summary');
    await expect(summary.locator('#location-encounters table')).toBeVisible();
    expect((await summary.boundingBox()).y+(await summary.boundingBox()).height).toBeLessThanOrEqual((await page.locator('.location-maps').boundingBox()).y);
    await expect(page.getByRole('navigation',{name:'Locations and maps'}).locator('a').first()).toHaveAttribute('href','entries/#locations-dqm1');
    await page.getByRole('navigation',{name:'Locations and maps'}).locator('a').first().click();
    await expect(page.locator('#locations-dqm1')).toBeInViewport();
    await page.goto(url+'entries/');
    const locations=page.locator('#locations');
    await expect(locations.getByRole('heading',{name:'Locations & maps'})).toBeVisible();
    await locations.getByText('All maps',{exact:true}).click();
    await expect(locations.locator('a[href="places/map-29-1/"]')).toHaveCount(2);
  } finally { await context.close(); }
});

test('static map fallback hides story context while keeping the map available',async ({page})=>{
  await page.addInitScript(()=>localStorage.setItem('dqm-guide-story-spoilers','hide'));
  await page.route('**/guide/index.html',route=>route.abort());
  await page.goto(url+'places/map-29-1/');
  await expect(page.locator('.entry-map')).toBeVisible();
  await expect(page.locator('a[href="articles/location-water-world/"]')).toHaveCount(1);
  await expect(page.locator('a[href="articles/location-water-world/"]')).toBeHidden();
  await expect(page.locator('a[href="walkthroughs/cobi-tara/#story-pirate-mermaids"]')).toHaveCount(1);
  await expect(page.locator('a[href="walkthroughs/cobi-tara/#story-pirate-mermaids"]')).toBeHidden();
  await expect(page.getByRole('heading',{level:1})).toBeVisible();
  await expect(page.getByRole('link',{name:'Open in the player guide'})).toBeVisible();
});

test('published location links retain a selected map layout and encounter jump',async ({page})=>{
  await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{
    writeText:async ()=>{ throw new DOMException('Denied','NotAllowedError'); }
  }}));
  const article=url+'articles/location-water-world/';
  await page.goto(article+'#field-guide?entry=location-water-world&map=map-29-1');
  const viewer=page.locator('#location-map-browser');
  await expect(viewer.locator('[data-map-control="place"]')).toHaveValue('map-29-1');
  await expect(viewer.locator('[data-map-control="layout"]')).toHaveValue('map-29-1');
  const mapTitle=await viewer.locator('[data-map-control="title"]').textContent();
  const articleTitle=await page.locator('#article-title').textContent();
  await viewer.locator('[data-map-control="layout"]').selectOption('map-29-2');
  const expected=article+'#field-guide?entry=location-water-world&map=map-29-2';
  await expect(page).toHaveURL(expected);
  await expect.poll(()=>viewer.locator('.map-image img').evaluate(img=>img.complete && img.naturalWidth>0)).toBe(true);
  await page.getByRole('button',{name:'Copy entry link'}).click();
  const copy=page.locator('#entry-copy-url');
  await expect(copy).toHaveValue(expected);
  await expect(copy).toBeFocused();
  await page.goto(await copy.inputValue());
  await expect(page.locator('#article-title')).toHaveText(articleTitle);
  await expect(viewer.locator('[data-map-control="title"]')).toHaveText(mapTitle);
  await expect(viewer.locator('[data-map-control="place"]')).toHaveValue('map-29-1');
  await expect(viewer.locator('[data-map-control="layout"]')).toHaveValue('map-29-2');
  await page.goto(article+'#location-encounters');
  await expect(page.locator('#article-title')).toHaveText(articleTitle);
  await expect(page.locator('#location-encounters > h3')).toBeInViewport();
});

test('a revealed canonical article keeps its path and reveal when opening a map from its introduction',async ({page})=>{
  await page.addInitScript(()=>localStorage.setItem('dqm-guide-story-spoilers','hide'));
  const article=url+'articles/location-water-world/';
  await page.goto(article);
  await page.locator('#guide-reveal').click();
  await expect(page.locator('#location-map-browser')).toBeVisible();
  await page.locator('.article-lead').getByRole('link',{name:shipped.map('map-29-1').title,exact:true}).click();
  await expect(page).toHaveURL(article+'#field-guide?entry=location-water-world&map=map-29-1&section=maps');
  await expect(page.locator('#guide-reveal')).toHaveCount(0);
  await expect(page.locator('#article-title')).toHaveText(shipped.entry('location-water-world').title);
  const viewer=page.locator('#location-map-browser');
  await expect(viewer.locator('[data-map-control="place"]')).toHaveValue('map-29-1');
  await expect(viewer.locator('[data-map-control="title"]')).toHaveText(shipped.map('map-29-1').title);
  await expect(viewer).toBeFocused();
});

test('gate entrance links identify the portal on its exact chamber floor',async ({browser,page})=>{
  const context=await browser.newContext({javaScriptEnabled:false});
  try {
    const reader=await context.newPage();
    await reader.goto(url+'articles/location-ambition-gate/');
    const gateName=await reader.locator('.entry-content h1').textContent();
    const maps=reader.locator('.location-maps');
    await expect(maps.locator('.entry-gate-label')).toHaveText(gateName);
    const entranceImage=await maps.locator('[data-map-role="entrance"] .entry-map').getAttribute('src');
    await maps.locator('a[href="places/map-9-0/#map-9-2"]').click();
    const thirdFloor=reader.locator('#map-9-2');
    await expect(thirdFloor.getByRole('heading',{name:/B3/})).toBeInViewport();
    await expect(thirdFloor.locator('.entry-map')).toHaveAttribute('src',entranceImage);
    await expect(thirdFloor.locator('.entry-gate-pin')).toHaveCount(6);
    await expect(reader.locator('#map-9-0 .entry-gate-pin')).toHaveCount(13);
    await expect(reader.locator('#map-9-1 .entry-gate-pin')).toHaveCount(3);
    await thirdFloor.locator('.entry-gate-legend').getByRole('link',{name:gateName,exact:true}).click();
    await expect(reader.locator('.entry-content h1')).toHaveText(gateName);
  } finally { await context.close(); }
  await page.goto(url+'places/map-9-0/#map-9-2');
  await expect(page.locator('#atlas-layout-select')).toHaveValue('map-9-2');
});

test('published gates include native boss portraits and terrain examples without JavaScript',async ({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false});
  try {
    const page=await context.newPage();
    await page.goto(url+'articles/location-departure-gate/');
    await expect(page.locator('.entry-boss-link')).toHaveAttribute('href','articles/npc-healie/');
    await expect(page.locator('.entry-boss-link .entry-portrait')).toHaveCount(1);
    const floors=page.locator('.gate-generation');
    await expect(floors).toContainText('1–4F');
    await expect(floors).toContainText('final area is on 5F');
    await expect(floors.locator('.gate-terrain-list img')).toHaveCount(3);
    const terrain=floors.locator('.gate-terrain-list img').first();
    await terrain.scrollIntoViewIfNeeded();
    await expect.poll(()=>terrain.evaluate(img=>img.complete && img.naturalWidth>0)).toBe(true);
    const bounds=await terrain.boundingBox();
    expect(bounds.width/bounds.height).toBeCloseTo(5/4,2);
    await page.goto(url+'articles/location-arena-left-gate/');
    const final=page.locator('.entry-gate-map[data-map-role="final"]');
    await expect(final.locator('a')).toHaveAttribute('href','places/map-84-0/');
    await expect.poll(()=>final.locator('img').evaluate(img=>img.complete && img.naturalWidth>0)).toBe(true);
    await expect(page.locator('.entry-boss-link')).toHaveAttribute('href','monsters/152/');
    await page.goto(url+'articles/location-farm-gate/');
    await expect(page.locator('.entry-gate-map')).toHaveCount(2);
    const farmFinal=page.locator('.entry-gate-map[data-map-role="final"]');
    await expect(farmFinal.locator('a')).toHaveAttribute('href','places/map-6-11/');
    await expect.poll(()=>farmFinal.locator('img').evaluate(img=>img.complete && img.naturalWidth>0)).toBe(true);
  } finally { await context.close(); }
});

test('published gate boss choices and return visits stay distinct from a single party',async ({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false});
  try {
    const page=await context.newPage();
    for (const [gate,label,ids,note] of [
      ['medal','Boss choices',['boss-king-slime','boss-lips','boss-matango'],'Choose one of three encounters.'],
      ['destruction','Boss sequence',['boss-hargon','boss-shido'],'Defeat the first boss, then return to fight the second.']
    ]) {
      await page.goto(url+'articles/location-'+gate+'-gate/');
      const facts=page.locator('.entry-gate-facts');
      await expect(facts.locator('dt')).toHaveText(label);
      await expect(facts).toContainText(note);
      const bosses=facts.locator('.entry-boss-list .entry-boss-link');
      await expect(bosses).toHaveCount(ids.length);
      for (const [index,id] of ids.entries()) {
        await expect(bosses.nth(index)).toHaveAttribute('href','articles/'+id+'/');
        await expect(bosses.nth(index).locator('.entry-portrait')).toHaveCount(1);
        const name=await bosses.nth(index).textContent();
        await bosses.nth(index).click();
        await expect(page.locator('.entry-content h1')).toHaveText(name);
        await expect(page.locator('.character-dialogue')).toBeVisible();
        await page.goBack();
      }
    }
  } finally { await context.close(); }
});
