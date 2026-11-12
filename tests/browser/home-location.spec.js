const {test,expect} = require('@playwright/test');
let url;
test.beforeAll(async()=>{url=await (await import('../helpers/modes')).startGuideServer();});
test.afterAll(async()=>{await (await import('../helpers/modes')).stopGuideServer();});

test('home shows the native room and contextual Milly sprite without gate-only information',async({page})=>{
  await page.setViewportSize({width:375,height:839});
  await page.goto(url+'#field-guide?kind=location&game=dqm1&entry=location-terry-home');
  await expect(page.locator('#article-title')).toHaveText('Terry & Milly’s home');
  await expect(page.locator('.location-maps img').first()).toBeVisible();
  await expect(page.locator('.location-maps')).toContainText('Your Room');
  await expect(page.locator('#guide-article')).not.toContainText('An entrance for this gate has not been verified');
  await expect(page.locator('.gate-facts,.gate-generation')).toHaveCount(0);
  const contacts=page.locator('.location-characters');
  await expect(contacts.locator('li')).toHaveCount(4);
  const milly=contacts.locator('a[href*="entry=npc-milly"]');
  const homeSprite=await page.evaluate(()=>NPC_SPRITES['npc-milly'].variants.find(v=>v.id==='home').image);
  await expect(milly.locator('img')).toHaveAttribute('src',homeSprite);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  await page.evaluate(()=>localStorage.setItem('dqm-guide-story-spoilers','hide'));
  await page.reload();
  await expect(milly.locator('img')).toHaveAttribute('src',homeSprite);
  await milly.click();
  await expect(page.locator('#guide-reveal')).toBeVisible();
  await expect(page.locator('.npc-appearances')).toHaveCount(0);
});

test('home characters expose their opening dialogue and Milly’s two distinct appearances',async({page})=>{
  for (const id of ['npc-milly','npc-watabou','npc-warubou']) {
    await page.goto(url+'#field-guide?entry='+id);
    const opening=await page.evaluate(id=>CHARACTER_DIALOGUE.entries[id][0],id);
    const dialogue=page.locator('.character-dialogue');
    await dialogue.locator('> summary').click();
    const scene=dialogue.locator('> details').first();
    await scene.locator('> summary').click();
    await expect(scene.locator('.spoken-lines li').first()).toHaveText(opening.passages[0]);
    await expect(scene.locator('.spoken-lines li').first()).toBeVisible();
    await expect(page.locator('.character-locations a[href*="entry=location-terry-home"]')).toBeVisible();
    if (id==='npc-milly') {
      await expect(page.locator('.npc-appearances figure')).toHaveCount(2);
      await expect(page.locator('.npc-appearances figcaption')).toHaveText(['At home',"Queen's Room"]);
      const images=await page.locator('.npc-appearances img').evaluateAll(rows=>rows.map(row=>row.src));
      expect(images[0]).not.toBe(images[1]);
    }
  }
});

test('the atlas associates home with Terry and links back to the location',async({page})=>{
  await page.goto(url+'#atlas?game=terry&region=terry-home&map=map-103-0');
  await expect(page.locator('#atlas-location')).toHaveText('Your Room');
  await expect(page.locator('#atlas-detail a[href*="entry=location-terry-home"]').first()).toBeVisible();
  await expect(page.locator('#atlas-index a[href*="map=map-103-0"]')).toBeVisible();
  const milly=page.locator('#atlas-detail .location-characters a[href*="entry=npc-milly"]');
  const homeSprite=await page.evaluate(()=>NPC_SPRITES['npc-milly'].variants.find(v=>v.id==='home').image);
  await expect(milly.locator('img')).toHaveAttribute('src',homeSprite);
  await page.evaluate(()=>localStorage.setItem('dqm-guide-story-spoilers','hide'));
  await page.reload();
  await expect(milly.locator('img')).toHaveAttribute('src',homeSprite);
  await page.locator('#atlas-game').selectOption('cobi');
  await expect(page.locator('#atlas-index a[href*="map=map-103-0"]')).toHaveCount(0);
  await expect(page.locator('#atlas-region option[value="terry-home"]')).toHaveCount(0);
});
