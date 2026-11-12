const {test,expect}=require('@playwright/test');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
let url;
test.beforeAll(async()=>{url=await(await import('../helpers/modes')).startGuideServer();});
test.afterAll(async()=>{await(await import('../helpers/modes')).stopGuideServer();});

test('learning checks preserve unknown stats, show growth, and round-trip a shared plan',async({page})=>{
  await page.goto(url+'#skill-planner?species=11&skill=4&level=3&target=10&mp=11');
  await expect(page.locator('#training-readiness')).toContainText('Enter the missing base stats');
  await expect(page.locator('#training-growth')).toContainText('Unknown');
  await page.locator('#training-intelligence').fill('23');
  await expect(page.locator('.training-status').first()).toContainText('Requirements met');
  await expect(page.locator('.training-earliest')).toContainText('Lv 4');
  const saved=page.url();
  await page.goto(url+'#field-guide');await page.goto(saved);
  await expect(page.locator('#training-intelligence')).toHaveValue('23');
  await expect(page.locator('.training-status').first()).toContainText('Requirements met');
  await page.locator('#training-location').selectOption('farm');
  await expect(page.locator('.training-status').first()).toContainText('Farm training');
  await page.locator('#training-level').fill('3.5');
  await expect(page.locator('#training-errors')).toBeVisible();
  await expect(page.locator('#training-readiness')).toBeEmpty();
  await expect(page.locator('#training-copy')).toBeDisabled();
});

test('individual and bred caps differ from ordinary recruitment and reaching a cap still allows learning',async({page})=>{
  await page.goto(url+'#skill-planner?species=235&skill=4&level=1&target=50');
  await expect(page.locator('#training-growth')).toContainText('Level 48–52');
  await page.locator('#training-origin').selectOption('bred');
  await expect(page.locator('#training-growth')).toContainText('Level 45 cap');
  await expect(page.locator('.training-status').nth(1)).toContainText('exceeds the level cap');
  await page.locator('#training-plus').fill('2');
  await expect(page.locator('#training-growth')).toContainText('Level 51 cap');
  await page.goto(url+'#skill-planner?species=11&skill=4&level=2&target=3&cap=3&mp=11&intelligence=23');
  await expect(page.locator('.training-status').nth(1)).toContainText('Requirements met');
  await page.locator('#training-level').fill('3');
  await expect(page.locator('.training-status').first()).toContainText('At its level cap');
  await expect(page.locator('.training-status').nth(1)).toContainText('At its level cap');
});

test('native combination-order warning cannot turn into an ordinary ready result',async({page})=>{
  await page.goto(url+'#skill-planner?species=11&skill=135&level=30&target=30&known=42,104,133&hp=0&mp=130&attack=0&defense=0&agility=0&intelligence=150');
  await expect(page.locator('.training-status').first()).toHaveAttribute('data-status','combination-order');
  await expect(page.locator('#training-readiness')).toContainText('original game then reads different requirements');
  await page.locator('#training-hp').fill('72');await page.locator('#training-attack').fill('68');await page.locator('#training-agility').fill('82');
  await expect(page.locator('.training-status').first()).toHaveAttribute('data-status','ready');
});

test('parent candidates use native base forms and keep the chosen species',async({page})=>{
  await page.goto(url+'#skill-planner?species=11&skill=1&pa=0&pa_skills=3');
  await page.locator('.training-inheritance>summary').click();
  await page.locator('.training-parent-builder>summary').click();
  await page.locator('#training-use-parents').click();
  await expect(page.locator('#training-inherited-list')).toContainText('Blaze');
  await expect(page.locator('#training-inherited-list')).not.toContainText('Blazemost');
  expect(new URLSearchParams(new URL(page.url()).hash.split('?')[1]).get('species')).toBe('11');
  await expect(page.locator('#training-routes')).toContainText('Candidate skill');
});

test('planner fits phones, loads from disk, and offers a fallback copy link',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:320,height:800});
  await page.goto(pathToFileURL(path.resolve(__dirname,'../../index.html')).href+'#skill-planner?species=11&skill=4&level=1&target=10');
  await expect(page.locator('#training-growth')).toContainText('521 EXP');
  for(const theme of ['light','dark']){
    await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('Denied'))}}));
  await page.locator('#training-copy').click();
  await expect(page.locator('#training-share-url')).toHaveValue(page.url());
  await expect(page.locator('#training-share-url')).toBeFocused();
  expect(errors).toEqual([]);
});

test('monster and skill links carry the selected IDs and campaign',async({page})=>{
  await page.goto(url+'#monster?id=313');
  await page.locator('#monster-campaign').selectOption('terry');
  await page.locator('#monster-skill-planner').click();
  await expect(page.locator('#training-species')).toHaveValue('313');
  await expect(page.locator('#training-campaign')).toHaveValue('terry');
  const blazeEntry=await page.evaluate(()=>GUIDE_REFERENCE.guide_names.skills[1].id);
  await page.goto(url+'#field-guide?kind=skill&entry=skill-'+blazeEntry);
  await page.getByRole('link',{name:'Check when your monster can learn this'}).click();
  await expect(page.locator('#training-skill')).toHaveValue('1');
});

test('malformed shared IDs and unknown numeric text cannot silently become another plan',async({page})=>{
  await page.goto(url+'#skill-planner?species=1e1&skill=4&known=1e0&mp=invalid');
  await expect(page.locator('#training-errors')).toContainText('unsupported values');
  await expect(page.locator('#training-readiness')).toBeEmpty();
  await expect(page.locator('#training-copy')).toBeDisabled();
  await page.locator('#training-reset-link').click();
  await expect(page.locator('#training-species')).toHaveValue('11');
  await expect(page.locator('#training-mp')).toHaveValue('');
  await expect(page.locator('#training-errors')).toBeHidden();
  await expect(page.locator('#training-copy')).toBeEnabled();
  expect(new URLSearchParams(new URL(page.url()).hash.split('?')[1]).has('known')).toBe(false);
});

test('a copied parent pool is invalidated by parent edits and survives a verified shared link',async({page})=>{
  await page.goto(url+'#skill-planner?species=11&skill=1&pa=0&pa_skills=3');
  await page.locator('.training-inheritance>summary').click();
  await page.locator('.training-parent-builder>summary').click();
  await page.locator('#training-use-parents').click();
  const saved=page.url();
  expect(new URLSearchParams(new URL(saved).hash.split('?')[1]).get('pool')).toBe('parents');
  await page.locator('#training-parent-a-skills-pick').selectOption('21');
  await page.locator('#training-parent-a-skills-add').click();
  await expect(page.locator('#training-errors')).toContainText('Rebuild the inherited skill pool');
  await expect(page.locator('#training-copy')).toBeDisabled();
  await page.locator('#training-use-parents').click();
  await expect(page.locator('#training-errors')).toBeHidden();
  await page.goto(url+'#field-guide');await page.goto(saved);
  await expect(page.locator('#training-errors')).toBeHidden();
  await expect(page.locator('#training-inherited-list')).toContainText('Blaze');
  await page.locator('#training-campaign').selectOption('cobi');
  await expect(page.locator('#training-errors')).toContainText('Rebuild the inherited skill pool');
});

test('changing species clears individualized inputs and capped gains add up',async({page})=>{
  await page.goto(url+'#skill-planner?species=11&skill=4&level=1&target=10&mp=990&known=21&inherited=1&cap=50');
  const mpRow=page.locator('#training-growth tbody tr').filter({has:page.getByRole('rowheader',{name:'Max MP',exact:true})});
  await expect(mpRow).toContainText('990');await expect(mpRow).toContainText('+9');await expect(mpRow).toContainText('999');
  await page.locator('#training-species').selectOption('0',{force:true});
  await expect(page.locator('#training-mp')).toHaveValue('');
  await expect(page.locator('#training-cap')).toHaveValue('');
  await expect(page.locator('#training-known-list')).toBeEmpty();
  await expect(page.locator('#training-inherited-list')).toBeEmpty();
  await expect(page.locator('#training-state-note')).toContainText('Species changed');
});
