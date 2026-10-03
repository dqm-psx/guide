const assert = require('node:assert/strict');
const { test, expect } = require('@playwright/test');

let serverUrl = null;

test.beforeAll(async () => {
  const { startGuideServer } = await import('../helpers/modes');
  serverUrl = await startGuideServer();
});

test.afterAll(async () => {
  const { stopGuideServer } = await import('../helpers/modes');
  await stopGuideServer();
});

// Served mode checks: every request must stay on the origin, under the
// /guide/ prefix, the way GitHub Pages mounts the guide. The file://
// equivalents live in file-mode.spec.js.
test.describe('served', () => {
  test('the page issues no external requests and parses its data', async ({ page }) => {
    const requests = [];
    page.on('request', request => requests.push(request.url()));
    await page.goto(serverUrl);
    const slots = await page.evaluate(() => DATA.species.length);
    const version = await page.evaluate(() => DATA.metadata.version);
    await expect(page.locator('#coverage-summary')).toContainText(`${slots} table slots`);
    await expect(page.locator('#source-metadata')).toContainText(version);
    assert.ok(requests.length > 0, 'expected the page to issue requests for its own assets');
    const base = new URL(serverUrl);
    for (const requestUrl of requests) {
      const parsed = new URL(requestUrl);
      assert.equal(parsed.origin, base.origin, `cross-origin request: ${requestUrl}`);
      assert.ok(parsed.pathname.startsWith('/guide/'), `request outside the /guide/ prefix: ${requestUrl}`);
    }
  });

  test('the extracted stylesheet is loaded and applied', async ({ page }) => {
    await page.goto(serverUrl);
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
});
