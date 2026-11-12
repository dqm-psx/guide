const {test,expect}=require('@playwright/test');
let url;
test.beforeAll(async()=>{url=await(await import('../helpers/modes')).startGuideServer();});
test.afterAll(async()=>{await(await import('../helpers/modes')).stopGuideServer();});

test('mechanics topics, comparison sections and search keep their context',async({page})=>{
  await page.setViewportSize({width:375,height:812});
  await page.goto(url+'#field-guide?kind=mechanic');
  await page.getByRole('navigation',{name:'Mechanics topics'}).getByRole('link',{name:'PSX & the English patch'}).click();
  await expect(page.locator('.handbook-chapter')).toHaveCount(1);
  await page.locator('.handbook-chapter').getByRole('link',{name:'Game Boy, PlayStation and English patch differences'}).click();
  const toc=page.getByRole('navigation',{name:'In this article'});
  await toc.locator('summary').click();
  await toc.getByRole('link',{name:/Foreign masters/}).click();
  await expect(page.locator('#article-section-foreign-master-differences')).toBeFocused();
  await page.reload();
  await expect(page.locator('#article-section-foreign-master-differences')).toBeInViewport();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(375);
  await page.locator('.guide-back').click();
  await expect(page.locator('.handbook-chapter')).toHaveCount(1);
  await page.getByLabel('Search the guide').fill('transfer password');
  await expect(page.getByRole('table',{name:'Mechanics articles'})).toContainText('Game Boy, PlayStation');
});

test('battle mechanics connect explanations, skill pages and the calculator',async({page})=>{
  await page.goto(url+'#field-guide?kind=mechanic&topic=battle');
  await page.getByRole('link',{name:'Damage, Defense and resistance',exact:true}).click();
  await expect(page.getByRole('table',{name:'Base damage in ordinary wild battles'})).toContainText('12–15');
  await page.locator('.article-topic-links').getByRole('link',{name:'Blaze',exact:true}).click();
  await expect(page.locator('#article-title')).toHaveText('Blaze');
  await page.goBack();
  await page.getByRole('link',{name:'Open the damage calculator →',exact:true}).click();
  await expect(page.locator('#combat-planner-heading')).toBeVisible();
  await page.getByRole('link',{name:'Damage & resistance',exact:true}).click();
  await expect(page.locator('#article-title')).toHaveText('Damage, Defense and resistance');
});

test('native monster images are individually addressable in both styles',async({page,request})=>{
  await page.goto(url+'#monster?id=0');
  const portrait=page.locator('.monster-profile-art img');
  await expect(portrait).toHaveAttribute('src',/media\/monster-portrait-0\.webp/);
  const size=await portrait.evaluate(async image=>{await image.decode();return {width:image.naturalWidth,height:image.naturalHeight,source:image.src};});
  expect(size.width).toBeGreaterThan(0);
  const response=await request.get(size.source);
  expect(response.ok()).toBe(true);
  expect(response.headers()['content-type']).toContain('image/webp');
  await page.locator('#guide-settings summary').click();
  await page.locator('#guide-settings [data-sprite-style="overworld"]').click();
  await expect(portrait).toHaveAttribute('src',/media\/monster-overworld-0\.webp/);
  await expect(page.locator('.monster-profile-art svg')).toHaveCount(0);
});

test('maps opened from a walkthrough return to that chapter',async({page})=>{
  await page.goto(url+'#field-guide?kind=story&game=dqm2&entry=story-pirate-mermaids');
  const part=page.locator('.walk-part').filter({has:page.locator('#story-pirate-mermaids')});
  await part.locator('.walk-context a[href*="map=map-"]').first().click();
  await expect(page.locator('.atlas-chapter-back')).toBeVisible();
  await page.locator('.atlas-chapter-back').click();
  await expect(page.locator('#story-pirate-mermaids')).toBeFocused();
});
