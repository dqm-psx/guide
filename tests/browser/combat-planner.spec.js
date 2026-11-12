const {test,expect}=require('@playwright/test');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
let url;
test.beforeAll(async()=>{url=await(await import('../helpers/modes')).startGuideServer();});
test.afterAll(async()=>{await(await import('../helpers/modes')).stopGuideServer();});

test('ordinary encounter rolls give separate outgoing and incoming ranges, with shareable state',async({page})=>{
  await page.goto(url+'#combat-planner?species=11&game=terry&area=1&enemy=0&skill=1&attack=100&defense=100');
  await expect(page.locator('#combat-link-note')).toBeHidden();
  await expect(page.locator('.combat-physical').first()).toContainText('45–53 damage');
  await expect(page.locator('.combat-physical').nth(1)).toContainText('0–1 damage');
  await expect(page.locator('.combat-damage').first()).toHaveText('12–15 damage');
  await expect(page.locator('#combat-results')).toContainText('HP 6–8 · Attack 6–8 · Defense 4–5');
  const saved=page.url();await page.goto(url);await page.goto(saved);
  await expect(page.locator('#combat-attack')).toHaveValue('100');
  await expect(page.locator('.combat-physical').first()).toContainText('45–53 damage');
  await page.locator('#combat-attack').fill('');
  await expect(page.locator('.combat-physical').first()).toContainText('Enter your Attack');
  await expect(page.locator('.combat-damage').first()).toHaveText('12–15 damage');
});

test('Metal Slime immunity differs from its enemy spell range and companion resistance',async({page})=>{
  await page.goto(url+'#combat-planner?species=11&game=terry&area=22&enemy=1&skill=1');
  await expect(page.locator('#combat-enemy')).toHaveValue('1');
  await expect(page.locator('.combat-damage').first()).toHaveText('0 damage');
  await expect(page.locator('#combat-incoming-result .combat-damage')).toHaveText('7–12 damage');
  await page.locator('#combat-resistance').selectOption('7');
  await expect(page.locator('#combat-incoming-result .combat-damage')).toHaveText('0 damage');
  await page.locator('#combat-defense').fill('-1');
  await expect(page.locator('#combat-errors')).toBeVisible();
  await expect(page.locator('#combat-results')).toBeEmpty();
  await expect(page.locator('#combat-copy')).toBeDisabled();
});

test('filters recover and the calculator works from disk on narrow screens',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.setViewportSize({width:320,height:800});
  await page.goto(pathToFileURL(path.resolve(__dirname,'../../index.html')).href+'#combat-planner');
  await expect(page.locator('#combat-errors')).toBeHidden();
  for(const theme of ['light','dark']){
    await page.evaluate(value=>document.documentElement.dataset.theme=value,theme);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await page.locator('#combat-search').fill('no such wild encounter');
  await expect(page.locator('#combat-empty')).toBeVisible();
  await expect(page.locator('#combat-results')).toBeEmpty();
  await page.locator('#combat-search').fill('Slime');
  await expect(page.locator('#combat-errors')).toBeHidden();
  await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:()=>Promise.reject(new Error('Denied'))}}));
  await page.locator('#combat-copy').click();
  await expect(page.locator('#combat-share-url')).toHaveValue(page.url());
  expect(errors).toEqual([]);
});

test('unsupported shared inputs need an explicit reset before showing replacement results',async({page})=>{
  await page.goto(url+'#combat-planner?species=1e2&game=terry&area=9999&skill=1&attack=garbage');
  await expect(page.locator('#combat-link-note')).toBeVisible();
  await expect(page.locator('#combat-results')).toBeEmpty();
  await expect(page.locator('#combat-copy')).toBeDisabled();
  await page.locator('#combat-accept-link').click();
  await expect(page.locator('#combat-errors')).toBeHidden();
  await expect(page.locator('.combat-damage').first()).toBeVisible();
});
