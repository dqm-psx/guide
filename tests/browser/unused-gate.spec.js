const {test,expect} = require('@playwright/test');
let url;
test.beforeAll(async () => {url=await (await import('../helpers/modes')).startGuideServer();});
test.afterAll(async () => {await (await import('../helpers/modes')).stopGuideServer();});

test('retained gate records and dialogue are clearly separated from playable gates',async ({page})=>{
  await page.goto(url+'#field-guide?kind=location&game=dqm1');
  const directory=page.locator('#guide-directory');
  await expect(directory.getByRole('heading',{name:'Unused content',exact:true})).toBeVisible();
  await expect(directory.locator('.town-gates a[href*="location-hidden-gate"]')).toHaveCount(0);
  await directory.locator('a[href*="entry=location-hidden-gate"]').click();
  await expect(page.locator('.article-lead')).toContainText('not a gate you can unlock');
  await expect(page.locator('#location-encounters h3')).toHaveText('Unused encounter records');
  await expect(page.locator('#location-encounters tbody tr')).toHaveCount(4);
  await expect(page.locator('.gate-generation')).toContainText('49F');
  await expect(page.locator('.gate-generation')).toContainText('50F');
  await expect(page.locator('.gate-generation')).toContainText('39F');
  await expect(page.locator('.location-map-section[data-map-role="final"]')).toHaveAccessibleName(/^Unused final area/);
  await expect(page.locator('.location-map-section[data-map-role="entrance"]')).toHaveCount(0);
  await page.locator('#guide-article a[href*="entry=boss-darkdrium"]').first().click();
  await expect(page.locator('.article-lead')).toContainText('cannot be fought there during normal play');
  await expect(page.locator('.character-dialogue')).toBeVisible();
});

test('atlas labels retained maps and encounter pools as unused',async ({page})=>{
  await page.goto(url+'#atlas?tab=encounters&area=terry-122&q=Hidden');
  await expect(page.locator('#atlas-detail')).toContainText('Unused encounter records');
  await expect(page.locator('#atlas-index a[aria-current="true"]')).toContainText('Unused content');
  await page.locator('#atlas-pool').selectOption('terry-125');
  await expect(page.locator('#atlas-detail')).toContainText('not accessible in the Japanese game or English patch');
  await page.goto(url+'#atlas?map=map-101-0&q=Nameless');
  await expect(page.locator('#atlas-detail .atlas-caption')).toContainText('Unused content');
  await expect(page.locator('#atlas-index a[aria-current="true"]')).toContainText('Unused content');
});

test('Terry’s postgame route never sends players to the unused boss room',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('dqm-guide-story-spoilers','show'));
  await page.goto(url+'#field-guide?kind=story&game=dqm1&entry=story-terry-postgame');
  const chapter=page.locator('.walk-part').filter({has:page.locator('#story-terry-postgame')});
  await expect(chapter).toContainText('Watabou');
  await expect(chapter).not.toContainText('Nameless Place');
  await expect(chapter).not.toContainText('Darkdrium');
  await expect(chapter.locator('a[href*="map-101-0"]')).toHaveCount(0);
  await expect(chapter.locator('a[href*="location-sleep-gate"]').first()).toBeVisible();
});

test('monster profiles and hunting results never recommend the unused gate',async ({page})=>{
  await page.goto(url+'#monster?id=21');
  await expect(page.locator('#monster-locations')).toBeVisible();
  await expect(page.locator('#monster-locations')).not.toContainText('Hidden Gate');
  await page.goto(url+'#field-guide?q=monster');
  await expect(page.locator('#guide-directory')).toBeVisible();
  const expected=await page.evaluate(()=>{
    const monster=GUIDE_REFERENCE.species[21];
    const playable=monster.locations.find(row=>row.game==='terry' && row.availability!=='unused');
    // Encounter source order must not promote retained data into a route.
    monster.locations.sort((a,b)=>Number(b.availability==='unused')-Number(a.availability==='unused'));
    return {name:monster.display_name,context:playable.context_id};
  });
  await page.getByLabel('Search the guide').fill('find '+expected.name+' as terry');
  const result=page.locator('.guide-row').filter({hasText:expected.name}).first();
  await expect(result).toHaveAttribute('href',new RegExp('area=terry-'+expected.context+'(?:&|$)'));
  await expect(result).not.toContainText('Hidden Gate');
});
