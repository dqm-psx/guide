const {test, expect} = require('@playwright/test');
let url;
test.beforeAll(async () => {url = await (await import('../helpers/modes')).startGuideServer();});
test.afterAll(async () => {await (await import('../helpers/modes')).stopGuideServer();});

test('Aibou is discoverable without enabling internal slots and explains its released egg exchange', async ({page}) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(url + '#species-index');
  await expect(page.locator('#library-extra-slots')).not.toBeChecked();
  await page.locator('#species-search').fill('Aibou');
  const row = page.locator('#species-rows tr');
  await expect(row).toHaveCount(1);
  await expect(row).toContainText('Enhanced reward');
  await expect(row).not.toContainText('Extra / internal');
  await row.locator('a[href="#monster?id=323"]').click();
  await expect(page.locator('#monster-heading')).toHaveText('Aibou');
  const acquire = page.locator('.monster-acquire');
  await expect(acquire).toContainText('Enhanced v1.0.74');
  await expect(acquire).toContainText('312');
  await expect(acquire).toContainText('99');
  await expect(acquire.locator('a[href="#field-guide?entry=quest-aibou-egg"]')).toBeVisible();
  await expect(page.locator('.monster-internal')).toHaveCount(0);
  await expect(page.locator('.monster-breeding')).toHaveCount(0);
  await expect(page.locator('#monster [data-species-pedigree], #monster [data-species-mate]')).toHaveCount(0);
  await expect(page.locator('#monster-skills li')).toHaveCount(3);
  await expect(page.locator('.monster-growth-row')).toHaveCount(6);
  await page.locator('#monster-campaign').selectOption('tara');
  await expect(page.locator('#monster-skills li')).toHaveCount(3);
  await expect(acquire.locator('a[href="#field-guide?entry=quest-aibou-egg"]')).toBeVisible();
  expect(await page.evaluate(() => ({playable:DATA.species[323].playable, count:DATA.species.filter(s => s.playable !== false).length}))).toEqual({playable:false, count:315});
  expect(errors).toEqual([]);
});

test('Survival egg rewards appear alongside existing breeding and encounters', async ({page}) => {
  await page.goto(url + '#monster?id=23');
  const index = await page.evaluate(() => Number(Object.keys(DQM_PATCH_REWARDS.species).find(index => index !== '323')));
  await page.goto(url + '#monster?id=' + index);
  await expect(page.locator('.monster-patch-rewards')).toContainText('Enhanced v1.0.74');
  await expect(page.locator('.monster-patch-rewards a[href="#field-guide?entry=field-greattree-arena"]')).toBeVisible();
  await expect(page.locator('.acquire-columns')).toBeVisible();
  await expect(page.locator('.monster-breeding')).toBeVisible();
});
