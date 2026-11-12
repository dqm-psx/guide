const {test,expect} = require('@playwright/test');
let url;
test.beforeAll(async () => { url = await (await import('../helpers/modes')).startGuideServer(); });
test.afterAll(async () => { await (await import('../helpers/modes')).stopGuideServer(); });

test('gate characters link their sprite to dialogue and back to the location',async ({page})=>{
  await page.goto(url+'#field-guide?entry=location-townsperson-s-gate');
  const princess=page.locator('.location-characters a[href*="entry=npc-laura"]');
  await expect(princess).toHaveText('Laura');
  await expect(princess.locator('img')).toBeVisible();
  await expect(page.locator('#location-map-browser a[href*="entry=npc-laura"]')).toHaveCount(0);
  await princess.click();
  await expect(page.locator('#article-title')).toHaveText('Laura');
  await expect(page.locator('.character-dialogue .spoken-lines')).toContainText('Laura');
  await page.locator('.character-locations a[href*="entry=location-townsperson-s-gate"]').click();
  await page.locator('.gate-boss-link[href*="entry=boss-dragon"]').click();
  await expect(page.locator('.character-dialogue')).toContainText('Grrrrooo');
  await expect(page.locator('.character-dialogue .spoken-lines li').first()).toBeVisible();
  await page.goto(url+'#atlas?map=map-72-0');
  await expect(page.locator('#atlas-detail .location-characters a[href*="entry=npc-laura"] img')).toBeVisible();
});

test('world characters and new boss dialogue respect spoiler settings and fit phones',async ({page})=>{
  await page.setViewportSize({width:375,height:839});
  await page.goto(url+'#field-guide?entry=location-water-world');
  await expect(page.locator('.location-characters a[href*="entry=npc-queen-of-the-mermaids"]')).toBeVisible();
  await page.goto(url+'#field-guide?entry=boss-hargon');
  await expect(page.locator('.character-dialogue')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.evaluate(()=>localStorage.setItem('dqm-guide-story-spoilers','hide'));
  await page.reload();
  await expect(page.locator('#guide-reveal')).toBeVisible();
  await expect(page.locator('.character-dialogue')).toHaveCount(0);
  await page.goto(url+'#atlas?map=map-72-0');
  await expect(page.locator('#atlas-detail a[href*="entry=npc-laura"]')).toHaveCount(0);
});

test('gate overview brings encounters above maps and returns to the filtered directory',async ({page})=>{
  await page.setViewportSize({width:1512,height:900});
  await page.goto(url+'#field-guide?kind=location&game=dqm1&entry=location-townsperson-s-gate');
  const article=page.locator('#guide-article');
  const navigation=article.getByRole('navigation',{name:'Locations and maps',exact:true});
  const back=navigation.getByRole('link',{name:'Back to Locations & maps',exact:true});
  await expect(back).toHaveText('←');
  await expect(navigation.locator('a').first()).toHaveAccessibleName('Back to Locations & maps');
  await expect(article.locator('.article-trail')).toHaveCount(0);
  const encounters=article.locator('#location-encounters');
  await expect(encounters.locator('.route-roster')).toBeVisible();
  const overviewBox=await article.locator('.gate-overview').boundingBox();
  const encountersBox=await encounters.boundingBox();
  expect(encountersBox.x).toBeGreaterThan(overviewBox.x);
  expect(encountersBox.y).toBeLessThan((await article.locator('.location-maps').boundingBox()).y);
  await page.setViewportSize({width:375,height:839});
  expect((await encounters.boundingBox()).y).toBeGreaterThan((await article.locator('.gate-overview').boundingBox()).y);
  expect((await encounters.boundingBox()).y).toBeLessThan((await article.locator('.location-maps').boundingBox()).y);
  await back.focus();
  await back.press('Enter');
  await expect(page).toHaveURL(/#field-guide\?kind=location&game=dqm1$/);
  await expect(page.locator('#guide-directory .gate-ranks')).toBeVisible();
});

test('Terry’s directory covers every gate and links its unlock and encounter floors',async ({page})=>{
  await page.goto(url+'#field-guide?kind=location&game=dqm1');
  const directory=page.locator('#guide-directory');
  await expect(directory.getByRole('heading',{name:'Terry’s gates'})).toBeVisible();
  await expect(directory.locator('a[href*="entry=location-"]:not([href*="entry=location-terry-home"])')).toHaveCount(32);
  await expect(directory.locator('a[href*="entry=location-terry-home"]')).toBeVisible();
  await expect(directory.locator('.gate-ranks>div').filter({hasText:'Win Class F'})).toContainText('Memory Gate');
  const medal=directory.locator('.town-gates li').filter({hasText:'Medal Gate'});
  await expect(medal.getByRole('link',{name:'Turn in 13 Tiny Medals'})).toHaveAttribute('href',/entry=quest-medal-gate/);
  await medal.getByRole('link',{name:'Medal Gate',exact:true}).click();
  await expect(page.locator('#article-title')).toHaveText('Medal Gate');
  await expect(page.locator('.route-roster a[href*="area=terry-60"]')).toBeVisible();
  await page.locator('.guide-back').click();
  await expect(directory.locator('.family-gates li')).toHaveCount(6);
  await page.getByLabel('Search the guide').fill('Farm Gate');
  await page.locator('.guide-row').first().click();
  await expect(page.locator('#article-title')).toHaveText('Farm Gate');
});

test('Cobi and Tara’s directory follows the keys and links places to the atlas',async ({page})=>{
  await page.goto(url+'#field-guide?kind=location&game=dqm2');
  const worlds=page.locator('.world-stop');
  await expect(worlds.getByRole('heading')).toHaveText(['GreatLog','Desert World','Water World','Ice World','Sky World','World Between Worlds']);
  await expect(worlds.nth(2).getByRole('link',{name:'Pirate Key'})).toHaveAttribute('href',/entry=quest-win-the-pirate-key/);
  await worlds.nth(2).getByRole('link',{name:'Walkthrough'}).click();
  await expect(page.locator('#article-title')).toHaveText('Cobi & Tara walkthrough');
  await page.goBack();
  await worlds.nth(2).getByRole('link',{name:'Ghost Ship'}).click();
  await expect(page.locator('#atlas-location')).toHaveText('Ghost Ship');
  await page.evaluate(()=>localStorage.setItem('dqm-guide-story-spoilers','hide'));
  await page.goto(url+'#field-guide?kind=location&game=dqm2');
  await page.reload();
  await expect(worlds.first()).toContainText('GreatLog');
  await expect(worlds.nth(2)).toContainText('spoiler hidden');
  await expect(worlds.nth(2).getByRole('link',{name:'Ghost Ship'})).toHaveCount(0);
});
