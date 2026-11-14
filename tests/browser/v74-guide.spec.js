const {test,expect}=require('@playwright/test');
let url;
test.beforeAll(async()=>{url=await(await import('../helpers/modes')).startGuideServer();});
test.afterAll(async()=>{await(await import('../helpers/modes')).stopGuideServer();});

test('shared Aibou quest is reachable in either campaign and links back to both walkthroughs',async({page})=>{
  for(const game of ['dqm1','dqm2']) {
    await page.goto(url+'#field-guide?kind=quest&purpose=postgame&game='+game);
    await expect(page.locator('.quest-campaign')).toHaveCount(1);
    await page.locator('.quest-directory a[href*="entry=quest-aibou-egg"]').click();
    await expect(page.locator('#guide-article')).toContainText('312');
    await expect(page.locator('#guide-article')).toContainText('99 Tiny Medals');
    await expect(page.locator('#guide-article')).toContainText('Translation only');
    await expect(page.locator('#guide-article a[href*="story-terry-postgame"]').first()).toBeVisible();
    await expect(page.locator('#guide-article a[href*="story-greatlog-postgame"]').first()).toBeVisible();
  }
});

test('Terry item filters include Enhanced Arena rewards without inventing shops',async({page})=>{
  await page.goto(url+'#field-guide?kind=item&game=dqm1&q=Spellblade');
  const row=page.locator('tr[data-entry="item-92"]');
  await expect(row).toContainText('Enhanced v1.0.74');
  await expect(row).toContainText('No confirmed shop');
  await row.locator('th a').click();
  const sources=page.locator('.item-sources');
  await expect(sources).toContainText('GreatTree Survival Arena');
  await expect(sources).toContainText('GreatTree Pro Classes A, S, Starry Night');
  await sources.locator('a[href*="field-greattree-arena"]').first().click();
  await expect(page.locator('#article-title')).toContainText('GreatTree Arena');
  await expect(page.locator('#guide-article')).toContainText('revenge');
});

test('current release and historical native verification stay separate',async({page})=>{
  await page.goto(url+'#sources');
  await expect(page.locator('#sources')).toContainText('v1.0.74');
  await expect(page.locator('#sources')).toContainText('v1.0.73');
  await expect(page.locator('#sources a[href="https://github.com/dqm-psx/patch/releases/tag/v1.0.74"]')).toBeVisible();
});
