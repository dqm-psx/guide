const {test,expect} = require('@playwright/test');
let url;
test.beforeAll(async () => { url = await (await import('../helpers/modes')).startGuideServer(); });
test.afterAll(async () => { await (await import('../helpers/modes')).stopGuideServer(); });

test('item abbreviations lead to PSX shop prices and a shareable result', async ({page}) => {
  await page.goto(url);
  await page.getByLabel('Search the guide').fill('MedHerb');
  await page.locator('.guide-row').filter({hasText:'Medicinal Herb'}).click();
  await expect(page.locator('#article-title')).toHaveText('Medicinal Herb');
  await expect(page.locator('.item-names')).toContainText('やくそう');
  await expect(page.locator('.item-names')).toContainText('MediHerb');
  await expect(page.getByRole('table',{name:'Recorded shop prices'})).toContainText('GreatTree / Bazaar');
  await expect(page.getByRole('table',{name:'Recorded shop prices'})).toContainText('9 G');
  await page.reload();
  await expect(page.locator('#article-title')).toHaveText('Medicinal Herb');
  await page.getByRole('link',{name:'Back to guide'}).click();
  await expect(page.locator('#guide-search')).toHaveValue('MedHerb');
  await page.getByLabel('Search the guide').fill('やくそう');
  await expect(page.locator('.guide-row').first()).toContainText('Medicinal Herb');
});

test('event copies share an atlas entry while distinct places and dungeon layouts remain reachable', async ({page}) => {
  await page.goto(url+'#atlas?map=map-12-9&page=3');
  await expect(page.locator('#atlas-location')).toHaveText('GreatLog Storage');
  await page.getByLabel('Find a map').fill('GreatLog Storage');
  await expect(page.locator('.atlas-scroll a')).toHaveCount(1);
  await expect(page.locator('.atlas-scroll a')).toHaveAttribute('aria-current','true');
  await expect(page.locator('#atlas-layout-select')).toHaveCount(0);
  await page.getByLabel('Find a map').fill('Library');
  await expect(page.locator('.atlas-scroll a').filter({hasText:'GreatLog'})).toHaveCount(1);
  await expect(page.locator('.atlas-scroll a').filter({hasText:'GreatTree'})).toHaveCount(1);
  await page.goto(url+'#atlas?map=map-28-2');
  await expect(page.locator('#atlas-layout-select')).toHaveValue('map-28-2');
  await page.locator('#atlas-layout-select').selectOption('map-28-0');
  await expect(page).toHaveURL(/map=map-28-0/);
  await page.goto(url+'#atlas?map=map-48-1');
  await page.locator('.map-doors a[href*="variant="]').click();
  await expect(page.locator('#atlas-layout-select')).toHaveValue('map-48-0:tiles-2253');
  const alternate = await page.locator('.map-image img').getAttribute('src');
  await page.locator('#atlas-layout-select').selectOption('map-48-0');
  await expect(page.locator('.map-image img')).not.toHaveAttribute('src', alternate);
});

test('skill profiles explain the effect and link upgrades and learner profiles', async ({page}) => {
  await page.goto(url+'#field-guide?kind=skill&entry=skill-e0c2b');
  await expect(page.locator('#article-title')).toHaveText('Bang');
  await expect(page.locator('.article-lead')).toContainText(/explos|blast|explod/i);
  await expect(page.locator('.skill-facts')).toContainText('MP cost');
  await expect(page.locator('.skill-facts')).toContainText('All enemies');
  await page.goto(url+'#field-guide?kind=skill&q=Blazemore');
  await page.locator('.guide-row').first().click();
  await page.locator('.skill-facts a').filter({hasText:'Blaze'}).click();
  await expect(page.locator('#article-title')).toHaveText('Blaze');
  await page.locator('.skill-campaign[open] a').first().click();
  await page.locator('#monster-skills a').filter({hasText:/^Blaze$/}).click();
  await expect(page.locator('#article-title')).toHaveText('Blaze');
});

test('a character links to its native map, and doors continue into the atlas', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto(url+'#field-guide?entry=npc-pulio');
  await page.locator('#guide-article .npc-art').evaluate(img=>img.decode());
  await page.getByRole('link',{name:/Monster Farm/}).first().click();
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

test('story visibility persists and skill and encounter species lead to live profiles', async ({page}) => {
  await page.goto(url+'#field-guide?entry=boss-dragon');
  await expect(page.locator('#article-title')).toHaveText('Dragon');
  await page.getByLabel('Show story spoilers').uncheck();
  await page.reload();
  await expect(page.getByLabel('Show story spoilers')).not.toBeChecked();
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
