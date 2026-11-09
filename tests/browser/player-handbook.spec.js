const {test,expect} = require('@playwright/test');
let url;
test.beforeAll(async () => { url = await (await import('../helpers/modes')).startGuideServer(); });
test.afterAll(async () => { await (await import('../helpers/modes')).stopGuideServer(); });

test('item abbreviations lead to PSX shop prices and a shareable result', async ({page}) => {
  await page.goto(url);
  await page.getByLabel('Search the guide').fill('MedHerb');
  await page.locator('.guide-row').filter({hasText:'Medicinal Herb'}).click();
  await expect(page.locator('#article-title')).toHaveText('Medicinal Herb');
  await expect(page.getByRole('table',{name:'Recorded shop prices'})).toContainText('GreatTree / Bazaar');
  await expect(page.getByRole('table',{name:'Recorded shop prices'})).toContainText('9 G');
  await page.reload();
  await expect(page.locator('#article-title')).toHaveText('Medicinal Herb');
  await page.getByRole('link',{name:'Back to guide'}).click();
  await expect(page.locator('#guide-search')).toHaveValue('MedHerb');
});

test('a character links to its native map, and doors continue into the atlas', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto(url+'#field-guide?entry=npc-pulio');
  await page.getByRole('link',{name:/Monster Farm · Map/}).first().click();
  await expect(page.locator('#atlas-location')).toHaveText('Monster Farm');
  await page.locator('.map-image img').evaluate(img=>img.decode());
  await page.getByRole('button',{name:'Zoom in'}).click();
  await expect(page.getByRole('button',{name:'Fit map'})).toHaveAttribute('aria-pressed','true');
  const door=page.locator('.map-doors a').first();
  const destination=await door.textContent();
  await door.click();
  await expect(page.locator('#atlas-location')).toHaveText(destination);
  await page.goBack();
  await expect(page.locator('#atlas-location')).toHaveText('Monster Farm');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('boss spoilers require a reveal; skill and encounter species lead to live profiles', async ({page}) => {
  await page.goto(url+'#field-guide?entry=boss-dragon');
  await expect(page.locator('#article-title')).not.toHaveText('Dragon');
  await page.getByRole('button',{name:'Reveal this entry'}).click();
  await expect(page.locator('#article-title')).toHaveText('Dragon');
  await page.goto(url+'#field-guide?kind=skill&q=Blaze');
  await page.locator('.guide-row').filter({has:page.getByText('Blaze',{exact:true})}).click();
  await expect(page.locator('.learning')).toContainText('Minimum learning stats');
  await page.locator('.skill-campaign[open] a').first().click();
  await expect(page.locator('#monster-heading')).toBeVisible();
  await page.goto(url+'#atlas?tab=encounters');
  await page.getByLabel('Find an area or monster').fill('Dracky');
  await page.locator('.atlas-scroll a').first().click();
  await expect(page.locator('.encounters')).toContainText('Dracky');
  await page.locator('.encounters .monster-link').first().click();
  await expect(page.locator('#monster')).toBeVisible();
});
