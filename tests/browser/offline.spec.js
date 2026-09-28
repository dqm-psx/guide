const assert = require('node:assert/strict');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FILE_URL = 'file://' + path.join(REPO_ROOT, 'index.html');
let serverUrl = null;

test.beforeAll(async () => {
  const { startGuideServer } = await import('../helpers/modes');
  serverUrl = await startGuideServer();
});

test.afterAll(async () => {
  const { stopGuideServer } = await import('../helpers/modes');
  await stopGuideServer();
});

// The page must work opened directly from disk and served under /guide/.
for (const name of ['file', 'server']) {
  test.describe(name, () => {
    const url = () => (name === 'file' ? FILE_URL : serverUrl);

    test('the page issues no external requests and parses its data', async ({ page }) => {
      const requests = [];
      page.on('request', request => requests.push(request.url()));
      await page.goto(url());
      await expect(page.locator('#coverage-summary')).toContainText('326 table slots');
      await expect(page.locator('#source-metadata')).toContainText('v1.0.61-CURRENT');
      assert.ok(requests.length > 0, 'expected the page to issue requests for its own assets');
      if (name === 'file') {
        for (const requestUrl of requests) {
          assert.ok(requestUrl.startsWith('file:'), `unexpected non-file request: ${requestUrl}`);
        }
      } else {
        const base = new URL(url());
        for (const requestUrl of requests) {
          const parsed = new URL(requestUrl);
          assert.equal(parsed.origin, base.origin, `cross-origin request: ${requestUrl}`);
          assert.ok(parsed.pathname.startsWith('/guide/'), `request outside the /guide/ prefix: ${requestUrl}`);
        }
      }
    });

    test('the extracted stylesheet is loaded and applied', async ({ page }) => {
      await page.goto(url());
      const applied = await page.evaluate(() => ({
        sheets: document.styleSheets.length,
        bodyBackground: getComputedStyle(document.body).backgroundColor,
        wrapMaxWidth: getComputedStyle(document.querySelector('.wrap')).maxWidth
      }));
      expect(applied.sheets).toBeGreaterThan(0);
      expect(applied.bodyBackground).toBe('rgb(247, 245, 238)');
      expect(applied.wrapMaxWidth).toBe('1180px');
    });
  });
}
