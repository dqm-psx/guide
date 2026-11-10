const path = require('node:path');
const {test,expect} = require('@playwright/test');
let server, url;

test.beforeAll(async () => {
  const {startServer} = await import('../helpers/serve.js');
  const started = await startServer({root:path.resolve(__dirname,'../../site-dist'),prefix:'/guide/'});
  server=started.server;
  url=started.baseURL;
});
test.afterAll(async () => {
  server.closeAllConnections();
  await new Promise(resolve=>server.close(resolve));
});

test('published location and map pages connect their maps and guide context without JavaScript',async ({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false});
  try {
    const page=await context.newPage();
    await page.goto(url+'articles/location-water-world/');
    const maps=page.locator('.location-maps');
    await expect(maps.locator('img')).toHaveCount(1);
    await expect(maps.locator('img')).toHaveAttribute('alt','Water World map');
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
    await expect(page.locator('.location-maps')).toContainText('gate floors are generated');
    await expect(page.locator('.location-maps .entry-gate-label')).toHaveText(await page.locator('.entry-content h1').textContent());
    await expect(page.locator('.location-maps li').filter({has:page.locator('a[href="places/map-73-0/"]')})).toContainText('Final area');
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
  await page.locator('.article-lead').getByRole('link',{name:'Ghost Ship',exact:true}).click();
  await expect(page).toHaveURL(article+'#field-guide?entry=location-water-world&map=map-29-1&section=maps');
  await expect(page.locator('#guide-reveal')).toHaveCount(0);
  await expect(page.locator('#article-title')).toHaveText('Water World');
  const viewer=page.locator('#location-map-browser');
  await expect(viewer.locator('[data-map-control="place"]')).toHaveValue('map-29-1');
  await expect(viewer.locator('[data-map-control="title"]')).toHaveText('Ghost Ship');
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
    const entranceImage=await maps.locator('.entry-map').getAttribute('src');
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
