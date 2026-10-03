const assert = require('node:assert/strict');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FILE_URL = 'file://' + path.join(REPO_ROOT, 'index.html');

// The page must work opened directly from disk: no server, no network, no
// service worker. These smoke tests pin that contract; everything else in
// the suite runs against a served copy under /guide/. This mirrors the
// assertion style of theme.spec.js: brightness comparisons, not hex literals.
const brightness = rgb => {
  const m = rgb.match(/\d+/g);
  return m ? (Number(m[0]) + Number(m[1]) + Number(m[2])) / 3 : null;
};

test.describe('file mode', () => {
  test('a bare load from disk renders the reference and parses its data', async ({ page }) => {
    await page.goto(FILE_URL);
    await expect(page.locator('#pair-finder')).toBeVisible();
    const slots = await page.evaluate(() => DATA.species.length);
    const version = await page.evaluate(() => DATA.metadata.version);
    await expect(page.locator('#coverage-summary')).toContainText(`${slots} table slots`);
    await expect(page.locator('#source-metadata')).toContainText(version);
  });

  test('the page issues no external requests and parses its data', async ({ page }) => {
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    await page.goto(FILE_URL);
    assert.ok(requests.length > 0, 'expected the page to issue requests for its own assets');
    for (const requestUrl of requests) {
      assert.ok(requestUrl.startsWith('file:'), `unexpected non-file request: ${requestUrl}`);
    }
  });

  test('the extracted stylesheet is loaded and applied', async ({ page }) => {
    await page.goto(FILE_URL);
    const applied = await page.evaluate(() => ({
      sheets: document.styleSheets.length,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      wrapMaxWidth: getComputedStyle(document.querySelector('.wrap')).maxWidth
    }));
    expect(applied.sheets).toBeGreaterThan(0);
    expect(applied.bodyBackground).not.toBe('rgba(0, 0, 0, 0)');
    expect(applied.bodyBackground).not.toBe('rgb(255, 255, 255)');
    expect(applied.wrapMaxWidth).not.toBe('none');
    expect(parseFloat(applied.wrapMaxWidth)).toBeGreaterThanOrEqual(600);
  });

  test('choosing Dark applies and persists across a reload', async ({ page }) => {
    await page.goto(FILE_URL);
    const bgOf = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const initialBg = await bgOf();
    await page.click('button[data-theme-choice="dark"]');
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
    expect(brightness(await bgOf())).toBeLessThan(80);
    expect(await bgOf()).not.toBe(initialBg);

    await page.reload();
    expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
    await expect(page.locator('button[data-theme-choice="dark"]')).toHaveAttribute('aria-pressed', 'true');
  });

  test('planner flows work from disk', async ({ page }) => {
    await page.goto(FILE_URL + '#offspring-finder');
    await page.selectOption('#target', '2'); // Winged Slime
    await page.click('#target-pin');
    await expect(page.locator('#target-view-plan')).toBeVisible();
    await page.click('#target-view-plan');
    await expect(page.locator('#team-planner')).toBeVisible();
    await expect(page.locator('#plan-body')).toBeVisible();
    await expect(page.locator('#plan-tree .plan-node')).toHaveCount(1);
  });
});
