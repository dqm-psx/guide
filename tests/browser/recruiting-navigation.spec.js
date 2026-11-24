const {test,expect}=require('@playwright/test');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
let url;
test.beforeAll(async()=>{url=await(await import('../helpers/modes')).startGuideServer();});
test.afterAll(async()=>{await(await import('../helpers/modes')).stopGuideServer();});

test('Recruiting is a Reference destination with its own active link and focus',async({page})=>{
  await page.setViewportSize({width:794,height:892});
  await page.goto(url);
  await page.locator('#browse-toggle').click();
  const recruiting=page.locator('.nav a[href="#recruiting"]');
  await expect(recruiting.locator('..').getByRole('heading')).toHaveText('Reference');
  await recruiting.click();
  await expect(page.locator('#article-title')).toHaveText('Recruiting');
  await expect(page.locator('#article-title')).toBeFocused();
  await expect(recruiting).toHaveAttribute('aria-current','page');
  await expect(page.locator('.nav [aria-current="page"]')).toHaveCount(1);
  await expect(page.locator('#guide-article .guide-back')).toHaveCount(0);
  await expect(page.locator('#browse-toggle')).toHaveAttribute('aria-expanded','false');
  await expect(page).toHaveTitle(/^Recruiting · /);
  await expect(page.locator('#article-section-dark-horn-example')).toHaveCount(0);
  await expect(page.locator('#article-section-wild-recruitment-calculator')).toHaveCount(0);
  for(const id of ['joining-basics','healing-recruitment','terry-boss-rules','terry-boss-list','foreign-master-recruitment','save-states-and-patch']) {
    await expect(page.locator('#article-section-'+id)).toHaveCount(1);
  }
});

test('legacy recruitment links retain their selection and highlight Recruiting',async({page})=>{
  await page.goto(url+'#field-guide?entry=field-recruitment&rc_game=terry&rc_area=22&rc_species=20&rc_owned=1&rc_28=2');
  await expect(page.locator('#article-title')).toHaveText('Recruiting');
  await expect(page.locator('.nav a[href="#recruiting"]')).toHaveAttribute('aria-current','page');
  await expect(page.locator('#recruit-area')).toHaveValue('terry-22');
  await expect(page.locator('#recruit-meat-28')).toHaveValue('2');
  await expect(page.locator('#recruit-collected')).toBeChecked();
  await expect(page.locator('.recruit-chance strong')).toHaveText('24.64%');
  await page.reload();
  await expect(page.locator('#recruit-area')).toHaveValue('terry-22');
  await expect(page.locator('#recruit-meat-28')).toHaveValue('2');
});

test('a direct Recruiting route loads from disk and preserves subsection bookmarks',async({page})=>{
  const file=pathToFileURL(path.resolve(__dirname,'../../index.html')).href;
  await page.goto(file+'#recruiting?section=healing-recruitment');
  await expect(page.locator('#article-title')).toHaveText('Recruiting');
  await expect(page.locator('#article-section-healing-recruitment')).toBeInViewport();
  await page.reload();
  await expect(page.locator('#article-section-healing-recruitment')).toBeInViewport();
  await expect(page.locator('.nav a[href="#recruiting"]')).toHaveAttribute('aria-current','page');
});
