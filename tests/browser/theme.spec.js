const path = require('node:path');
const { test, expect } = require('@playwright/test');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FILE_URL = 'file://' + path.join(REPO_ROOT, 'index.html');
let serverUrl = null;

let THEME_KEY;
test.beforeAll(async () => {
  ({THEME_KEY} = (await import('../helpers/keys.js')).default);
});
const brightness = rgb => {
  const m = rgb.match(/\d+/g);
  return m ? (Number(m[0]) + Number(m[1]) + Number(m[2])) / 3 : null;
};

// Light theme must be light-colored, dark theme dark-colored, and they must
// differ — the exact hex values belong to the stylesheets, not this test.
const isLightBg = bg => brightness(bg) !== null && brightness(bg) > 150;
const isDarkBg = bg => brightness(bg) !== null && brightness(bg) < 80;

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
      expect(isLightBg(await bgOf(page))).toBe(true);
    });

    test('choosing Dark applies and persists', async ({ page }) => {
      await page.goto(url());
      const initialBg = await bgOf(page);
      await page.click('button[data-theme-choice="dark"]');
      expect(await themeOf(page)).toBe('dark');
      await expect(page.locator('button[data-theme-choice="dark"]')).toHaveAttribute('aria-pressed', 'true');
      for (const choice of ['system', 'light']) {
        await expect(page.locator('button[data-theme-choice="' + choice + '"]')).toHaveAttribute('aria-pressed', 'false');
      }
      expect(await bgOf(page)).not.toBe(initialBg);
      expect(isDarkBg(await bgOf(page))).toBe(true);

      await page.reload();
      expect(await themeOf(page)).toBe('dark');
      await expect(page.locator('button[data-theme-choice="dark"]')).toHaveAttribute('aria-pressed', 'true');
    });

    test('the theme-color meta follows the chosen theme', async ({ page }) => {
      const themeColor = () => page.evaluate(() => document.querySelector('meta[name="theme-color"]').content);
      await page.goto(url());
      const lightMeta = await themeColor();
      expect(lightMeta).toMatch(/^#[0-9a-f]{6}$/i);
      await page.click('button[data-theme-choice="dark"]');
      const darkMeta = await themeColor();
      expect(darkMeta).not.toBe(lightMeta);
      // The dark theme's chrome color must itself read as dark.
      const hexChannels = s => [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
      const [r, g, b] = hexChannels(darkMeta);
      expect((r + g + b) / 3).toBeLessThan(80);
      await page.click('button[data-theme-choice="light"]');
      expect(await themeColor()).toBe(lightMeta);
    });

    test('choosing System follows the emulated system', async ({ page }) => {
      await page.goto(url());
      await page.click('button[data-theme-choice="system"]');
      await expect(page.locator('button[data-theme-choice="system"]')).toHaveAttribute('aria-pressed', 'true');

      await page.emulateMedia({ colorScheme: 'dark' });
      await page.reload();
      expect(await themeOf(page)).toBe('dark');
      expect(isDarkBg(await bgOf(page))).toBe(true);

      await page.emulateMedia({ colorScheme: 'light' });
      await page.reload();
      expect(await themeOf(page)).toBe('light');
      expect(isLightBg(await bgOf(page))).toBe(true);

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
