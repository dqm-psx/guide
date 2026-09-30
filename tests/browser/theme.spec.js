const path = require('node:path');
const { test, expect } = require('@playwright/test');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FILE_URL = 'file://' + path.join(REPO_ROOT, 'index.html');
let serverUrl = null;

const THEME_KEY = 'dqm-guide-theme-v1';
const LIGHT_BG = 'rgb(247, 245, 238)';
const DARK_BG = 'rgb(13, 19, 22)';

test.beforeAll(async () => {
  const { startGuideServer } = await import('../helpers/modes');
  serverUrl = await startGuideServer();
});

test.afterAll(async () => {
  const { stopGuideServer } = await import('../helpers/modes');
  await stopGuideServer();
});

const themeOf = page => page.evaluate(() => document.documentElement.dataset.theme);
const bgOf = page => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

// The page must work opened directly from disk and served under /guide/.
for (const name of ['file', 'server']) {
  test.describe(name, () => {
    const url = () => (name === 'file' ? FILE_URL : serverUrl);

    test('a bare load is light', async ({ page }) => {
      await page.goto(url());
      expect(await themeOf(page)).toBe('light');
      expect(await bgOf(page)).toBe(LIGHT_BG);
    });

    test('choosing Dark applies and persists', async ({ page }) => {
      await page.goto(url());
      await page.click('button[data-theme-choice="dark"]');
      expect(await themeOf(page)).toBe('dark');
      await expect(page.locator('button[data-theme-choice="dark"]')).toHaveAttribute('aria-pressed', 'true');
      for (const choice of ['system', 'light']) {
        await expect(page.locator('button[data-theme-choice="' + choice + '"]')).toHaveAttribute('aria-pressed', 'false');
      }
      const darkBg = await bgOf(page);
      expect(darkBg).not.toBe(LIGHT_BG);
      expect(darkBg).toBe(DARK_BG);

      await page.reload();
      expect(await themeOf(page)).toBe('dark');
      await expect(page.locator('button[data-theme-choice="dark"]')).toHaveAttribute('aria-pressed', 'true');
    });

    test('the theme-color meta follows the chosen theme', async ({ page }) => {
      const themeColor = () => page.evaluate(() => document.querySelector('meta[name="theme-color"]').content);
      await page.goto(url());
      expect(await themeColor()).toBe('#163143');
      await page.click('button[data-theme-choice="dark"]');
      expect(await themeColor()).toBe('#0a1013');
      await page.click('button[data-theme-choice="light"]');
      expect(await themeColor()).toBe('#163143');
    });

    test('choosing System follows the emulated system', async ({ page }) => {
      await page.goto(url());
      await page.click('button[data-theme-choice="system"]');
      await expect(page.locator('button[data-theme-choice="system"]')).toHaveAttribute('aria-pressed', 'true');

      await page.emulateMedia({ colorScheme: 'dark' });
      await page.reload();
      expect(await themeOf(page)).toBe('dark');
      expect(await bgOf(page)).toBe(DARK_BG);

      await page.emulateMedia({ colorScheme: 'light' });
      await page.reload();
      expect(await themeOf(page)).toBe('light');
      expect(await bgOf(page)).toBe(LIGHT_BG);

      await page.emulateMedia({ colorScheme: null });
    });

    test('the stored choice survives reload', async ({ page }) => {
      await page.addInitScript(key => localStorage.setItem(key, 'dark'), THEME_KEY);
      await page.goto(url());
      expect(await themeOf(page)).toBe('dark');
      await expect(page.locator('button[data-theme-choice="dark"]')).toHaveAttribute('aria-pressed', 'true');
    });
  });
}
