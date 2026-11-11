const {test,expect} = require('@playwright/test');
let url;
test.beforeAll(async () => { url = await (await import('../helpers/modes')).startGuideServer(); });
test.afterAll(async () => { await (await import('../helpers/modes')).stopGuideServer(); });
const resultSpecies = (page,index) => expect(page.locator('#result-name a')).toHaveAttribute('href','#monster?id='+index);

test('My game inspection opens the same offspring and closes its modal',async ({page}) => {
  const {LEGACY_TEAM_KEY} = (await import('../helpers/keys.js')).default;
  await page.addInitScript(key => localStorage.setItem(key,JSON.stringify({
    version:1,game:'dqm1-2-ps1-v61',entries:[
      {id:'healer',speciesIndex:13,sex:'male',plus:7,nickname:''},
      {id:'ghost',speciesIndex:199,sex:'female',plus:2,nickname:''},
    ],
  })),LEGACY_TEAM_KEY);
  await page.goto(url+'#team-planner?tab=breeding');
  await page.selectOption('#planner-context','room');
  await page.locator('[data-planner-pair][data-a="13"][data-b="199"]').click();
  await expect(page.locator('#planner-pair-dialog')).toBeVisible();
  await page.click('#planner-inspect-reference');
  await expect(page.locator('#planner-pair-dialog')).toBeHidden();
  await expect(page.locator('#pair-finder')).toBeVisible();
  await resultSpecies(page,19);
  await expect(page.locator('#pair-pedigree-plus')).toHaveValue('7');
  await expect(page.locator('#pair-mate-plus')).toHaveValue('2');
  await expect(page.locator('#pair-context')).toHaveValue('room');
});

test('Find offspring preserves an owned pairing, its values, and the room rule in a shared URL',async ({page}) => {
  await page.goto(url+'#pair-finder');
  await page.waitForFunction(() => typeof DQMReference !== 'undefined');
  await page.evaluate(() => DQMReference.openPair({a:13,b:199,ap:7,bp:2,context:'room'}));
  await resultSpecies(page,19);
  await expect(page.locator('#pair-pedigree-plus')).toHaveValue('7');
  await expect(page.locator('#pair-mate-plus')).toHaveValue('2');
  await expect(page.locator('#pair-context')).toHaveValue('room');
  await expect(page.locator('#copy-pairing')).toHaveAttribute('data-copy-text',/\+7.*\+2.*Two-save Breeding room/);
  await expect(page).toHaveURL(/#pair-finder\?a=13&b=199&ap=7&bp=2&context=room$/);
  const recipient = await page.context().newPage();
  await recipient.goto(page.url());
  await resultSpecies(recipient,19);
  await expect(recipient.locator('#pair-context')).toHaveValue('room');
  await recipient.close();
  await page.click('#swap');
  await resultSpecies(page,199);
  await expect(page.locator('#pair-pedigree-plus')).toHaveValue('2');
  await expect(page.locator('#pair-mate-plus')).toHaveValue('7');
  await expect(page).toHaveURL(/a=199&b=13&ap=2&bp=7&context=room$/);
});

test('parent thresholds change the offspring and persist across sessions and recent pairings',async ({page}) => {
  await page.goto(url+'#pair-finder?a=1&b=1&ap=4');
  await resultSpecies(page,17);
  await page.selectOption('#pair-context','base');
  await resultSpecies(page,1);
  await page.selectOption('#pair-context','shrine');
  await resultSpecies(page,17);
  await page.goto(url+'#species-index');
  await page.reload();
  await page.goto(url+'#pair-finder');
  await expect(page.locator('#pair-pedigree-plus')).toHaveValue('4');
  await resultSpecies(page,17);
  await page.fill('#pair-pedigree-plus','0');
  await resultSpecies(page,1);
  await page.click('[data-recent-a="1"][data-recent-b="1"][data-recent-ap="4"][data-recent-context="shrine"]');
  await resultSpecies(page,17);
  await expect(page.locator('#pair-pedigree-plus')).toHaveValue('4');
});

test('conditional Find parents recipes open their actual offspring',async ({page}) => {
  await page.goto(url+'#offspring-finder?target=17');
  await page.click('[data-recipe-a="1"][data-recipe-b="1"]');
  await expect(page.locator('#pair-finder')).toBeVisible();
  await expect(page.locator('#pair-pedigree-plus')).toHaveValue('4');
  await resultSpecies(page,17);
  await page.goto(url+'#offspring-finder?target=19');
  await page.click('[data-recipe-pedigree="13"]');
  await expect(page.locator('#pair-context')).toHaveValue('room');
  await resultSpecies(page,19);
});

test('invalid parent values cannot present or share a stale result',async ({page}) => {
  await page.goto(url+'#pair-finder?a=1&b=1&ap=4');
  await resultSpecies(page,17);
  await page.fill('#pair-pedigree-plus','-1');
  await expect(page.locator('#result-name')).toHaveText('Check parent + values');
  await expect(page.locator('#result-detail')).toContainText('whole number from 0 to 255');
  await expect(page.locator('#copy-pairing')).toBeDisabled();
  await expect(page.locator('#result-find-parents')).toBeHidden();
  await expect(page).toHaveURL(/ap=4$/);
  await page.fill('#pair-pedigree-plus','3');
  await resultSpecies(page,1);
  await expect(page.locator('#copy-pairing')).toBeEnabled();
  await page.goto(url+'#pair-finder?a=1&b=1&ap=999&bp=-1&context=constructor');
  await expect(page.locator('#pair-pedigree-plus')).toHaveValue('0');
  await expect(page.locator('#pair-mate-plus')).toHaveValue('0');
  await expect(page.locator('#pair-context')).toHaveValue('shrine');
});

for (const width of [390,1440]) test('pair inputs and results stay readable at '+width+'px',async ({page},testInfo) => {
  await page.setViewportSize({width,height:950});
  await page.goto(url+'#pair-finder?a=13&b=199&ap=7&bp=2&context=room');
  await resultSpecies(page,19);
  await expect(page.locator('#pair-context')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const options = await page.locator('#pair-finder .pair-options').boundingBox();
  const result = await page.locator('#pair-result').boundingBox();
  if (width >= 1200) expect(result.x).toBeGreaterThan(options.x+options.width-1);
  else expect(result.y).toBeGreaterThan(options.y+options.height-1);
  await page.screenshot({path:testInfo.outputPath('pair-'+width+'.png'),fullPage:true});
});
