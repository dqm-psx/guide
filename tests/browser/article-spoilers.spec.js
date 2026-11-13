const {test,expect}=require('@playwright/test');
let url;
const article='#field-guide?kind=mechanic&entry=field-restored-content';
const section='#article-section-cobi-tara-worlds';
const spoiler='GreatLog temporarily believes Kameha has solved its problem.';
test.beforeAll(async()=>{url=await(await import('../helpers/modes')).startGuideServer();});
test.afterAll(async()=>{await(await import('../helpers/modes')).stopGuideServer();});

test('a direct story subsection stays hidden until explicitly revealed, including after reload',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('dqm-guide-story-spoilers','hide'));
  await page.goto(url+article+'&section=cobi-tara-worlds');
  await expect(page.locator(section)).toBeInViewport();
  await expect(page.locator('#guide-article')).not.toContainText(spoiler);
  await expect(page.locator('#guide-article')).not.toContainText('before defeating Battle Rex');
  await expect(page.locator('#article-section-which-edition').locator('..')).toContainText('Japanese PlayStation');
  await page.getByRole('button',{name:'Reveal this section',exact:true}).click();
  await expect(page.locator(section)).toBeFocused();
  await expect(page.locator('#guide-article')).toContainText(spoiler);
  expect(await page.evaluate(()=>localStorage.getItem('dqm-guide-story-spoilers'))).toBe('hide');
  await page.reload();
  await expect(page.locator('#guide-article')).not.toContainText(spoiler);
  await expect(page.getByRole('button',{name:'Reveal this section',exact:true})).toBeVisible();
});

test('spoiler preference filters comparison search matches and excerpts as well as article content',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('dqm-guide-story-spoilers','hide'));
  const query='#field-guide?kind=mechanic&q='+encodeURIComponent('temporarily believes Kameha');
  await page.goto(url+query);
  await expect(page.locator('#guide-directory')).not.toContainText(spoiler);
  await expect(page.locator('#guide-directory a[href*="entry=field-restored-content"]')).toHaveCount(0);
  await page.locator('#guide-settings > summary').click();
  await page.locator('#guide-spoilers').check();
  await expect(page.locator('#guide-directory')).toContainText(spoiler);
  await page.locator('#guide-spoilers').uncheck();
  await expect(page.locator('#guide-directory')).not.toContainText(spoiler);
  await page.goto(url+article);
  await page.locator('#guide-settings > summary').click();
  await page.locator('#guide-spoilers').check();
  await expect(page.locator('#guide-article')).toContainText(spoiler);
  await page.locator('#guide-spoilers').uncheck();
  await expect(page.locator('#guide-article')).not.toContainText(spoiler);
});
