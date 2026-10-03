const path = require('node:path');
const { test, expect } = require('@playwright/test');

let serverUrl;
test.beforeAll(async () => {
  const { startGuideServer } = await import('../helpers/modes');
  serverUrl = await startGuideServer();
});
test.afterAll(async () => {
  const { stopGuideServer } = await import('../helpers/modes');
  await stopGuideServer();
});

for (const mode of ['file', 'server']) {
  const url = () => mode === 'file'
    ? 'file://' + path.resolve(__dirname, '../../index.html') : serverUrl;

  test(`${mode}: switch teams while staying in Targets & plans`, async ({ page }) => {
    await page.goto(url() + '#offspring-finder');
    await page.selectOption('#target', '11');
    await page.click('#target-pin');
    await page.click('#target-view-plan');
    const originalId = await page.locator('#planner-team-select').inputValue();
    await expect(page.locator('#planner-team-select')).toBeVisible();
    await page.click('#planner-team-new');
    await page.fill('#planner-team-name', 'Second team');
    await page.click('#planner-team-name-save');
    await expect(page.locator('#planner-targets')).toBeVisible();
    await expect(page.locator('#target-list li')).toHaveCount(0);
    await page.selectOption('#planner-team-select', originalId);
    await expect(page.locator('#planner-targets')).toBeVisible();
    await expect(page.locator('#target-list li')).toHaveCount(1);
    await expect(page.locator('#target-list')).toContainText('Slime');
    await page.click('#planner-tab-breeding');
    await expect(page.locator('#planner-team-select')).toBeVisible();
    await expect(page.locator('#team-planner [role="tab"]')).toHaveCount(3);
    await page.click('.nav a[href="#breeding-table"]');
    await expect(page.locator('#breeding-table')).toBeVisible();
    await expect(page.locator('#planner-team-select')).toBeHidden();
    await page.goBack();
    await expect(page.locator('#planner-breeding')).toBeVisible();
    await expect(page.locator('#planner-team-select')).toBeVisible();
  });

  test(`${mode}: backup tools sit below the roster and open with the keyboard`, async ({ page }) => {
    await page.goto(url() + '#team-planner');
    await expect(page.locator('#planner-backup-export')).toBeHidden();
    const afterRoster = await page.evaluate(() => Boolean(
      document.querySelector('.planner-roster-columns').compareDocumentPosition(
        document.querySelector('#planner-data-tools')) & Node.DOCUMENT_POSITION_FOLLOWING));
    expect(afterRoster).toBe(true);
    const summary = page.locator('#planner-data-tools > summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#planner-backup-export')).toBeVisible();
    const download = page.waitForEvent('download');
    await page.click('#planner-backup-export');
    expect((await download).suggestedFilename()).toBe('DQM-guide-backup-v61.json');
  });

  test(`${mode}: manage teams and data on a narrow screen`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(url() + '#team-planner');
    await page.click('#planner-team-new');
    await page.fill('#planner-team-name', 'Mobile team');
    await page.click('#planner-team-name-save');
    await page.click('#planner-tab-targets');
    await expect(page.locator('#planner-team-select')).toBeVisible();
    await expect(page.locator('#planner-targets')).toBeVisible();
    await page.click('#planner-tab-roster');
    await page.locator('#planner-data-tools > summary').click();
    await expect(page.locator('#planner-import')).toBeVisible();
    await expect(page.locator('#planner-backup-import')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
    await page.screenshot({ path: testInfo.outputPath('my-game-mobile.png'), fullPage: true });
  });
}
