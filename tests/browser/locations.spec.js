const {test,expect} = require('@playwright/test');
let url;
test.beforeAll(async () => { url = await (await import('../helpers/modes')).startGuideServer(); });
test.afterAll(async () => { await (await import('../helpers/modes')).stopGuideServer(); });

test('Terry’s directory covers every gate and links its unlock and encounter floors',async ({page})=>{
  await page.goto(url+'#guide?kind=location&game=dqm1');
  const directory=page.locator('#guide-directory');
  await expect(directory.getByRole('heading',{name:'Terry’s gates'})).toBeVisible();
  await expect(directory.locator('a[href*="entry=location-"]')).toHaveCount(32);
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
  await page.goto(url+'#guide?kind=location&game=dqm2');
  const worlds=page.locator('.world-stop');
  await expect(worlds.getByRole('heading')).toHaveText(['GreatLog','Desert World','Water World','Ice World','Sky World','World Between Worlds']);
  await expect(worlds.nth(2).getByRole('link',{name:'Pirate Key'})).toHaveAttribute('href',/entry=quest-win-the-pirate-key/);
  await worlds.nth(2).getByRole('link',{name:'Walkthrough'}).click();
  await expect(page.locator('#article-title')).toHaveText('Cobi & Tara walkthrough');
  await page.goBack();
  await worlds.nth(2).getByRole('link',{name:'Ghost Ship'}).click();
  await expect(page.locator('#atlas-location')).toHaveText('Ghost Ship');
  await page.evaluate(()=>localStorage.setItem('dqm-guide-story-spoilers','hide'));
  await page.goto(url+'#guide?kind=location&game=dqm2');
  await page.reload();
  await expect(worlds.first()).toContainText('GreatLog');
  await expect(worlds.nth(2)).toContainText('spoiler hidden');
  await expect(worlds.nth(2).getByRole('link',{name:'Ghost Ship'})).toHaveCount(0);
});
