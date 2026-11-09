const {test,expect} = require('@playwright/test');
let url;
test.beforeAll(async () => { url = await (await import('../helpers/modes')).startGuideServer(); });
test.afterAll(async () => { await (await import('../helpers/modes')).stopGuideServer(); });

test('starter and recruit names connect the walkthrough, character search and nickname directory', async ({page}) => {
  await page.goto(url+'#field-guide?kind=story&entry=story-terry-opening');
  const steps=page.locator('#guide-article .article-steps');
  await expect(steps.getByRole('link',{name:'Slib',exact:true})).toHaveAttribute('href',/entry=npc-surabou/);
  await steps.getByRole('link',{name:'Healie / Hale',exact:true}).click();
  await expect(page.locator('#article-title')).toHaveText('Healie / Hale');
  await expect(page.locator('#guide-article')).toContainText('Default nickname · Hale');
  await page.goto(url+'#field-guide?q=Surabou');
  await expect(page.locator('.guide-row').first()).toContainText('Slib');
  await page.goto(url+'#field-guide?q=Biino');
  await page.locator('.guide-row').filter({hasText:'Default monster nicknames'}).click();
  const table=page.getByRole('table',{name:'Default monster nicknames'});
  await expect(table.getByRole('rowheader',{name:'Biino'})).toBeVisible();
  await table.getByRole('row').filter({has:page.getByRole('rowheader',{name:'Hale',exact:true})})
    .getByRole('link',{name:'Healie / Hale'}).click();
  await expect(page.locator('#article-title')).toHaveText('Healie / Hale');
});

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
  await page.getByLabel('Search the guide').fill('buy herb');
  await expect(page.locator('.guide-row').first()).toContainText('Medicinal Herb');
  await expect(page.locator('.guide-row').first()).toContainText('10 G');
  await page.getByLabel('Search the guide').fill('dracy');
  await expect(page.locator('.guide-row').filter({has:page.getByText('Dracky',{exact:true})}).first()).toHaveAttribute('href',/^#monster\?id=/);
  await page.getByLabel('Search the guide').fill('how to breed');
  await expect(page.locator('.guide-row').first()).toHaveAttribute('href','#pair-finder');
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
  await expect(page.locator('.skill-combat-facts')).toContainText('MP cost');
  await expect(page.locator('.skill-combat-facts')).toContainText('All enemies');
  await page.goto(url+'#field-guide?kind=skill&q=Blazemore');
  await page.locator('.guide-row').first().click();
  await expect(page.locator('.skill-learners')).toContainText('No monster lists this as a natural skill');
  await expect(page.locator('.skill-progression').getByRole('link',{name:'Blazemost',exact:true})).toBeVisible();
  await page.locator('.skill-progression').getByRole('link',{name:'Blaze',exact:true}).click();
  await expect(page.locator('#article-title')).toHaveText('Blaze');
  await expect(page.locator('.skill-learner-list svg').first()).toBeVisible();
  await expect(page.locator('.skill-profile .monster-japanese')).toHaveText('メラ');
  await page.locator('.skill-campaign[open] a').first().click();
  await page.locator('#monster-skills a').filter({hasText:/^Blaze$/}).click();
  await expect(page.locator('#article-title')).toHaveText('Blaze');
});

test('the offline skill profile fits a narrow screen and connects combination ingredients', async ({page}) => {
  const {FILE_URL}=await import('../helpers/modes');
  await page.setViewportSize({width:320,height:760});
  await page.emulateMedia({colorScheme:'dark'});
  await page.goto(FILE_URL+'#field-guide?entry=skill-e0d3b');
  await expect(page.locator('#article-title')).toHaveText('MegaMagic');
  await expect(page.locator('.skill-combat-facts')).toContainText('All remaining MP');
  const related=page.locator('.skill-progression');
  await expect(related.getByRole('link')).toHaveCount(5);
  await expect(page.getByRole('navigation',{name:'Adjacent skills'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await related.getByRole('link',{name:'Blazemost',exact:true}).click();
  await expect(page.locator('.skill-progression').getByRole('link',{name:'MegaMagic',exact:true})).toBeVisible();
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
  await page.locator('#guide-settings summary').click();
  await page.getByLabel('Show story spoilers').uncheck();
  await page.reload();
  await page.locator('#guide-settings summary').click();
  await expect(page.getByLabel('Show story spoilers')).not.toBeChecked();
  await page.locator('#guide-settings summary').click();
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
  await expect(page.locator('.encounters')).toContainText('Dracky');
  await page.locator('.encounters .monster-link').first().click();
  await expect(page.locator('#monster')).toBeVisible();
});

test('gate routes connect floor rosters, arena progress, boss records and tactics', async ({page}) => {
  await page.setViewportSize({width:320,height:760});
  await page.goto(url+'#field-guide?entry=location-departure-gate');
  const first=page.locator('.route-roster tbody tr').first();
  await expect(first).toContainText(/1.4/);
  for (const name of ['Antbear','Dracky','Slime']) await expect(first.getByRole('link',{name,exact:true})).toHaveAttribute('href',/^#monster\?id=/);
  await expect(first).toContainText('Lv. 1');
  await page.goto(url+'#field-guide?entry=story-terry-early-arena');
  await expect(page.getByRole('heading',{name:'Arena and gate order'})).toBeVisible();
  await page.locator('.route-section').getByRole('link',{name:'Golem',exact:true}).click();
  await expect(page.locator('.boss-art[data-monster-index="248"]')).toBeVisible();
  await expect(page.locator('.battle-stats')).toContainText('HP100');
  await expect(page.locator('.battle-stats')).toContainText('Attack45');
  await expect(page.locator('.battle-member')).toContainText('Lv. 7');
  await expect(page.locator('.battle-member a[href*="skill-"]')).toHaveCount(3);
  await page.locator('.article-lead').getByRole('link',{name:'Sleep Hit'}).click();
  await expect(page.locator('#article-title')).toHaveText('Sleep Hit');
  await page.goto(url+'#field-guide?entry=boss-dark-master');
  await expect(page.locator('.battle-adventure')).toHaveText(['Cobi','Tara']);
  await expect(page.locator('.battle-member')).toHaveCount(6);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('regional filters distinguish encounter pools and keep their rosters shareable', async ({page}) => {
  await page.goto(url+'#atlas?tab=encounters&game=cobi&region=water&q=Sea+Field');
  const sea=page.locator('.atlas-scroll a').filter({has:page.getByText('Sea Field',{exact:true})});
  await expect(sea).toHaveCount(1);
  await sea.click();
  await expect(page.locator('#atlas-location')).toHaveText('Sea Field');
  const pool=page.getByLabel('Encounter pool');
  const options=await pool.locator('option').allTextContents();
  expect(options.length).toBeGreaterThan(1);
  expect(new Set(options).size).toBe(options.length);
  await pool.selectOption({index:1});
  const address=page.url(), chosen=await pool.inputValue();
  await page.goto(address);
  await expect(pool).toHaveValue(chosen);
});
