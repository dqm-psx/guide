const {test,expect} = require('@playwright/test');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
let url;
test.beforeAll(async()=>{ url = await (await import('../helpers/modes')).startGuideServer(); });
test.afterAll(async()=>{ await (await import('../helpers/modes')).stopGuideServer(); });
const route = '#field-guide?entry=field-recruitment';

test('Recruiting keeps existing calculation links and shows boss reference details directly',async({page})=>{
  await page.addInitScript(()=>localStorage.setItem('dqm-guide-story-spoilers','hide'));
  await page.setViewportSize({width:320,height:780});
  await page.goto(url+'#field-guide?kind=mechanic&entry=field-recruitment&rc_game=terry&rc_area=1&rc_species=11&rc_enemy=0');
  await expect(page.locator('#article-title')).toHaveText('Recruiting');
  await expect(page.locator('#recruit-area')).toHaveValue('terry-1');
  await expect(page.locator('.recruit-monster a')).toHaveAttribute('href','#monster?id=11');
  const healing = page.locator('#article-section-healing-recruitment').locator('..');
  await expect(healing).toContainText('At full HP the healing fails');
  await expect(healing).toContainText('20–25');
  const masters = page.locator('#article-section-foreign-master-recruitment').locator('..');
  await expect(masters).toContainText('Meat works in these battles');
  await expect(page.locator('.recruit-scope')).toContainText('Healing your own party');
  const bosses = page.locator('#article-section-terry-boss-list').locator('..');
  await expect(bosses).toContainText('Big Eye');
  await expect(bosses).toContainText('Dark Horn');
  await expect(bosses).toContainText('Mirror Gate');
  await expect(page.locator('#article-section-dark-horn-example')).toHaveCount(0);
  await expect(page.locator('#article-section-wild-recruitment-calculator')).toHaveCount(0);
  await expect(page.locator('.recruit-examples')).toHaveCount(0);
  await expect(page.locator('.recruit-heading > span')).toHaveCount(0);
  await expect(page.locator('#guide-article [data-reveal-section]')).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(await page.evaluate(()=>localStorage.getItem('dqm-guide-story-spoilers'))).toBe('hide');
  await masters.getByRole('link',{name:'Foreign masters and their monsters',exact:true}).click();
  await page.getByRole('link',{name:'Recruiting',exact:true}).last().click();
  await expect(page.locator('#article-title')).toHaveText('Recruiting');
});

test('native meat calculations compare extra items, collection history and the Orb, and survive a shared link',async({page})=>{
  await page.goto(url+route+'&rc_game=terry&rc_area=22&rc_species=20&rc_owned=1&rc_28=1');
  await expect(page.locator('.recruit-chance strong')).toHaveText('8.47%');
  await expect(page.locator('#recruit-collected')).toBeChecked();
  await expect(page.locator('#recruit-comparison')).toContainText('24.64%');
  await page.locator('#recruit-meat-28').fill('2');
  await expect(page.locator('.recruit-chance strong')).toHaveText('24.64%');
  const saved = page.url();
  expect(new URLSearchParams(new URL(saved).hash.split('?')[1]).has('rc_q')).toBe(false);
  await page.goto(url);
  await page.goto(saved);
  await expect(page.locator('.recruit-chance strong')).toHaveText('24.64%');
  await expect(page.locator('#recruit-area')).toHaveValue('terry-22');
  await expect(page.locator('#recruit-meat-28')).toHaveValue('2');
  await page.locator('#recruit-orb').check();
  await expect(page.locator('.recruit-chance strong')).toHaveText('100%');
  await page.locator('.recruit-details summary').click();
  await expect(page.locator('#recruit-breakdown')).not.toContainText('feeding multiplier');
  await page.goto(url+'#recruiting?rc_game=terry&rc_area=1&rc_species=11&rc_owned=1&rc_28=1');
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
  await expect(page.locator('#recruit-result')).toHaveText('Enter a whole-number item count from 0 to 99.');
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
  await page.goto(pathToFileURL(path.resolve(__dirname,'../../index.html')).href+route+'&rc_game=terry&rc_area=22&rc_species=20&rc_owned=1&rc_28=1');
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
  await page.getByRole('link',{name:'Compare items and recruitment chances'}).click();
  await expect(page.locator('#recruitment-calculator')).toBeVisible();
});

test('bosses calculate healing ranges, refuse meat, and preserve blocked and automatic joins',async({page})=>{
  await page.goto(url+'#recruiting?rc_game=terry&rc_kind=boss&rc_area=146&rc_species=66&rc_28=1.5');
  await expect(page.locator('.recruit-monster a')).toHaveText('Dark Horn');
  await expect(page.locator('.recruit-chance strong')).toHaveText('1%');
  await expect(page.locator('#recruit-meat-28')).toBeDisabled();
  await expect(page.locator('#recruit-meat-note')).toBeVisible();
  await expect(page.locator('label[for="recruit-meat-25"]')).toContainText('+15');
  await expect(page.locator('label[for="recruit-heal-1"]')).toContainText('+20–25');
  await page.locator('#recruit-heal-1').fill('10');
  await expect(page.locator('.recruit-chance strong')).toHaveText('13.96%–18.53%');
  const saved=page.url();
  await page.reload();
  expect(page.url()).toBe(saved);
  await expect(page.locator('#recruit-heal-1')).toHaveValue('10');
  await expect(page.locator('.recruit-chance strong')).toHaveText('13.96%–18.53%');
  await expect(page.locator('#recruit-comparison')).not.toContainText('Sirloin');
  await page.locator('#recruit-orb').check();
  await expect(page.locator('.recruit-chance strong')).toHaveText('100%');
  await page.goto(url+'#recruiting?rc_game=terry&rc_kind=boss&rc_area=135&rc_species=84&rc_h1=99&rc_orb=1');
  await expect(page.locator('.recruit-chance strong')).toHaveText('0%');
  await page.goto(url+'#recruiting?rc_game=cobi&rc_kind=boss&rc_area=112');
  await expect(page.locator('.recruit-chance strong')).toHaveText('100%');
  expect(new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('rc_record')).toBe('4');
  await page.reload();
  await expect(page.locator('.recruit-monster a')).toHaveAttribute('href','#monster?id=255');
});

test('foreign-master pools support all adventures and stay distinct from a species boss record',async({page})=>{
  for (const [campaign,area] of [['terry',205],['cobi',164],['tara',164]]) {
    await page.goto(url+'#recruiting?rc_game='+campaign+'&rc_kind=master&rc_area='+area);
    await expect(page.locator('#recruit-location')).toContainText('Rank 0');
    await expect(page.locator('#recruit-area option')).toHaveCount(20);
    await expect(page.locator('#recruit-meat-28')).toBeEnabled();
    const before=Number((await page.locator('.recruit-chance strong').textContent()).replace('%',''));
    await page.locator('#recruit-meat-28').fill('2');
    const after=Number((await page.locator('.recruit-chance strong').textContent()).replace('%',''));
    expect(after).toBeGreaterThan(before);
  }
  await page.locator('#recruit-search').fill('Orochi');
  await expect(page.locator('.recruit-monster a')).toHaveText('Orochi');
  await expect(page.locator('.recruit-chance strong')).not.toHaveText('0%');
});

test('group healing uses real formations, validates visible inputs and shares restored amounts',async({page})=>{
  await page.goto(url+'#recruiting?rc_game=terry&rc_kind=boss&rc_area=149&rc_species=221');
  await expect(page.locator('#recruit-targets-11 option')).toHaveCount(2);
  await page.locator('#recruit-heal-3').fill('1');
  await expect(page.locator('#recruit-copy')).toBeDisabled();
  await page.locator('#recruit-recovery-3-0').fill('101');
  await page.locator('#recruit-recovery-3-1').fill('103');
  await expect(page.locator('#recruit-recovery-3-2')).toBeHidden();
  await page.locator('.recruit-details summary').click();
  await expect(page.locator('#recruit-breakdown')).toContainText('116');
  await page.reload();
  await expect(page.locator('#recruit-recovery-3-0')).toHaveValue('101');
  await expect(page.locator('#recruit-recovery-3-1')).toHaveValue('103');
  await page.locator('#recruit-heal-11').fill('1');
  await page.locator('#recruit-targets-11').selectOption('2');
  await page.locator('.recruit-details summary').click();
  await expect(page.locator('#recruit-breakdown')).toContainText('176–191');
  await page.locator('#recruit-recovery-3-0').fill('-1');
  await expect(page.locator('#recruit-copy')).toBeDisabled();
  await page.locator('#recruit-heal-3').fill('0');
  await expect(page.locator('#recruit-copy')).toBeEnabled();
  await expect(page.locator('#recruit-recovery-3-0')).toBeHidden();
  await page.goto(url+'#recruiting?rc_game=terry&rc_kind=boss&rc_area=149&rc_species=197&rc_t11=3');
  await expect(page.locator('#recruit-targets-11 option')).toHaveCount(1);
  await expect(page.locator('.recruit-chance strong')).toHaveText('0%');
});
