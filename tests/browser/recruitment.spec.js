const {test,expect} = require('@playwright/test');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
let url;
test.beforeAll(async()=>{ url = await (await import('../helpers/modes')).startGuideServer(); });
test.afterAll(async()=>{ await (await import('../helpers/modes')).stopGuideServer(); });
const route = '#field-guide?entry=field-recruitment';

test('native examples compare extra meat, collection history and the Orb, and survive a shared link',async({page})=>{
  await page.goto(url+route);
  await page.locator('[data-recruit-example="20"]').click();
  await expect(page.locator('.recruit-chance strong')).toHaveText('8.47%');
  await expect(page.locator('#recruit-collected')).toBeChecked();
  await expect(page.locator('#recruit-comparison')).toContainText('23.87%');
  await page.locator('#recruit-meat-28').fill('2');
  await expect(page.locator('.recruit-chance strong')).toHaveText('23.87%');
  const saved = page.url();
  expect(new URLSearchParams(new URL(saved).hash.split('?')[1]).has('rc_q')).toBe(false);
  await page.goto(url);
  await page.goto(saved);
  await expect(page.locator('.recruit-chance strong')).toHaveText('23.87%');
  await expect(page.locator('#recruit-area')).toHaveValue('terry-22');
  await expect(page.locator('#recruit-meat-28')).toHaveValue('2');
  await page.locator('#recruit-orb').check();
  await expect(page.locator('.recruit-chance strong')).toHaveText('100%');
  await page.locator('.recruit-details summary').click();
  await expect(page.locator('#recruit-breakdown')).not.toContainText('feeding multiplier');
  await page.locator('[data-recruit-example="11"]').click();
  await expect(page.locator('.recruit-chance strong')).toHaveText('70.07%');
  await expect(page.locator('#recruit-comparison')).toContainText('No change');
  await page.locator('#recruit-collected').uncheck();
  await expect(page.locator('.recruit-chance strong')).toHaveText('77.55%');
});

test('species links honor exact IDs when names overlap or match another species alias',async({page})=>{
  // Slime is a substring of Spotted Slime; a profile link must keep its exact ID.
  for (const [id,campaign] of [[11,'cobi'],[11,'tara'],[0,'terry']]) {
    await page.goto(url+route+'&rc_species='+id+'&rc_game='+campaign);
    await expect(page.locator('.recruit-monster a')).toHaveAttribute('href','#monster?id='+id);
    expect(new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('rc_species')).toBe(String(id));
  }
  await page.goto(url+'#monster?id=11');
  await page.locator('#monster-campaign').selectOption('cobi');
  await page.getByRole('link',{name:'Check wild recruitment chances'}).click();
  await expect(page.locator('.recruit-monster a')).toHaveAttribute('href','#monster?id=11');
  await expect(page.locator('#recruit-game')).toHaveValue('cobi');
  await page.locator('#recruit-game').selectOption('tara');
  await expect(page.locator('.recruit-monster a')).toHaveAttribute('href','#monster?id=11');
});

test('blocked encounter remains zero with maximum meat and Starry Orb',async({page})=>{
  await page.goto(url+route+'&rc_game=cobi&rc_area=75&rc_species=183&rc_orb=1&rc_28=99');
  await expect(page.locator('.recruit-chance strong')).toHaveText('0%');
  await expect(page.locator('#recruit-result')).toContainText('Normal recruitment is blocked');
  await expect(page.locator('#recruit-comparison')).toBeEmpty();
  await page.locator('#recruit-orb').uncheck();
  await expect(page.locator('.recruit-chance strong')).toHaveText('0%');
});

test('filters, invalid counts and unavailable links recover without leaving stale probabilities',async({page})=>{
  await page.goto(url+route+'&rc_area=999999');
  await expect(page.locator('#recruit-link-note')).toBeVisible();
  await page.locator('#recruit-search').fill('no such encounter');
  await expect(page.locator('#recruit-empty')).toBeVisible();
  await expect(page.locator('#recruit-copy')).toBeDisabled();
  await expect(page.locator('.recruit-chance')).toHaveCount(0);
  await page.locator('#recruit-clear-search').click();
  await page.locator('#recruit-search').fill('メタルスライム');
  await expect(page.locator('.recruit-monster a')).toHaveAttribute('href','#monster?id=20');
  await page.locator('#recruit-meat-28').fill('1.5');
  await expect(page.locator('#recruit-result')).toHaveText('Enter a whole-number meat count from 0 to 99.');
  await expect(page.locator('#recruit-meat-28')).toHaveAttribute('aria-invalid','true');
  await expect(page.locator('#recruit-copy')).toBeDisabled();
  await expect(page.locator('#recruit-comparison')).toBeEmpty();
  await page.locator('#recruit-reset').click();
  await expect(page.locator('.recruit-chance strong')).toBeVisible();
});

test('clipboard rejection provides a selectable calculation URL',async({page})=>{
  await page.goto(url+route+'&rc_game=tara&rc_species=11&rc_owned=1&rc_28=1');
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('Denied'))}}));
  await page.locator('#recruit-copy').click();
  const fallback = page.locator('#recruit-share-url');
  await expect(fallback).toBeVisible();
  await expect(fallback).toHaveValue(page.url());
  await expect(fallback).toBeFocused();
});

test('calculator fits narrow screens in both themes and works directly from disk',async({page})=>{
  const errors=[]; page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:320,height:780});
  await page.goto(pathToFileURL(path.resolve(__dirname,'../../index.html')).href+route);
  await page.locator('[data-recruit-example="20"]').click();
  for (const theme of ['light','dark']) {
    await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);
    await expect(page.locator('.recruit-chance strong')).toHaveText('8.47%');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    for (const id of ['recruit-area','recruit-enemy','recruit-meat-28']) {
      const box=await page.locator('#'+id).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x+box.width).toBeLessThanOrEqual(320);
    }
  }
  expect(errors).toEqual([]);
});

test('new mechanics remain reachable from skills, monster profiles and meat pages',async({page})=>{
  await page.goto(url+'#field-guide?kind=skill');
  await page.getByRole('link',{name:'Inheritance & learning',exact:true}).click();
  await expect(page.locator('#article-title')).toHaveText('How do offspring inherit and learn skills?');
  await expect(page.locator('#guide-article')).toContainText('farm');
  await page.goto(url+'#field-guide?entry=item-28');
  await page.getByRole('link',{name:'Compare meat and recruitment chances'}).click();
  await expect(page.locator('#recruitment-calculator')).toBeVisible();
});
