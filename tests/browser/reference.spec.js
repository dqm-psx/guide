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

    test('pair finder shows the default Slime + Dracky base result', async ({ page }) => {
      await page.goto(url());
      await expect(page.locator('#pedigree')).toHaveValue('11');
      await expect(page.locator('#mate')).toHaveValue('99');
      await expect(page.locator('#result-name')).toHaveText('Winged Slime');
      await expect(page.locator('#pair-description')).toHaveText('Slime + Dracky');
      await expect(page.locator('#reverse-name')).toHaveText('Picky');
    });

    test('swap button reverses the parents and updates the result', async ({ page }) => {
      await page.goto(url());
      await page.click('#swap');
      await expect(page.locator('#pedigree')).toHaveValue('99');
      await expect(page.locator('#mate')).toHaveValue('11');
      await expect(page.locator('#result-name')).toHaveText('Picky');
      await expect(page.locator('#pair-description')).toHaveText('Dracky + Slime');
      await expect(page.locator('#reverse-name')).toHaveText('Winged Slime');
    });

    test('reverse-finder Try pair path shows the + rule note for Spotted Slime', async ({ page }) => {
      await page.goto(url());
      await page.selectOption('#target', '1');
      await page.selectOption('#reverse-pedigree-family', '0');
      await page.selectOption('#reverse-mate-family', '0');
      const tryPair = page.locator('#reverse-rows button[data-a="1"][data-b="1"]');
      await expect(tryPair).toHaveCount(1);
      await tryPair.click();
      const note = page.locator('#pair-plus-note');
      await expect(note).toBeVisible();
      await expect(note).toHaveText('Confirmed + rule: Spotted King if either parent is +4 or higher. See conditional results below.');
      await expect(page.locator('#result-name')).toHaveText('Spotted Slime');
      const noteStyle = await note.evaluate(el => {
        const style = getComputedStyle(el);
        return { color: style.color, marginTop: style.marginTop, fontWeight: style.fontWeight };
      });
      expect(noteStyle.color).toBe('rgb(9, 105, 94)');
      expect(noteStyle.marginTop).toBe('12px');
      expect(noteStyle.fontWeight).toBe('650');
    });

    test('conditional results render the plus table and the room rules details block', async ({ page }) => {
      await page.goto(url());
      await expect(page.locator('#plus-rules tr')).toHaveCount(10);
      await expect(page.locator('#flag-rules tr')).toHaveCount(26);
      await expect(page.locator('#flag-rules-title')).toContainText('26 title-screen Breeding room rules');
    });

    test('species index filters by name query and family', async ({ page }) => {
      await page.goto(url());
      await expect(page.locator('#species-count')).toHaveText('315 matching species');
      await page.fill('#species-search', 'Spotted Slime');
      await expect(page.locator('#species-count')).toHaveText('1 matching species');
      await expect(page.locator('#species-rows tr')).toHaveCount(1);
      await expect(page.locator('#species-rows tr td').first()).toContainText('Spotted Slime');
      await page.fill('#species-search', '');
      await page.selectOption('#species-family', '1');
      await expect(page.locator('#species-count')).toHaveText('31 matching species');
      const familyCells = page.locator('#species-rows tr td:nth-child(3)');
      const rowCount = await familyCells.count();
      for (let i = 0; i < rowCount; i++) {
        await expect(familyCells.nth(i)).toHaveText('Dragon');
      }
    });

    test('include extra / internal toggles the species count', async ({ page }) => {
      await page.goto(url());
      await expect(page.locator('#species-count')).toHaveText('315 matching species');
      await page.check('#show-internal');
      await expect(page.locator('#species-count')).toHaveText('326 matching species');
      await page.uncheck('#show-internal');
      await expect(page.locator('#species-count')).toHaveText('315 matching species');
    });

    test('keyboard: tabbing to the sprite style buttons switches sprites', async ({ page }) => {
      await page.goto(url());
      await expect(page.locator('#pedigree-sprite img')).toHaveAttribute('data-sprite-kind', 'portrait');
      for (let i = 0; i < 30; i++) {
        await page.keyboard.press('Tab');
        const focused = await page.evaluate(() => document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.spriteStyle : undefined);
        if (focused === 'overworld') break;
      }
      await page.keyboard.press('Enter');
      await expect(page.locator('#pair-finder button[data-sprite-style="overworld"]')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#pair-finder button[data-sprite-style="portrait"]')).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('#pedigree-sprite img')).toHaveAttribute('data-sprite-kind', 'overworld');
    });

    test('planner navigation shows the planner and hides the reference sections', async ({ page }) => {
      await page.goto(url());
      await expect(page.locator('#pair-finder')).toBeVisible();
      await expect(page.locator('#team-planner')).toBeHidden();
      await page.click('#planner-nav-link');
      await expect(page.locator('#team-planner')).toBeVisible();
      for (const id of ['pair-finder', 'offspring-finder', 'conditional-rules', 'species-index', 'about']) {
        await expect(page.locator('#' + id)).toBeHidden();
      }
      await page.focus('#planner-tab-roster');
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('#planner-tab-breeding')).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('#planner-tab-roster')).toHaveAttribute('aria-selected', 'false');
      await expect(page.locator('#planner-breeding')).toBeVisible();
      await expect(page.locator('#planner-roster')).toBeHidden();
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('#planner-tab-everything')).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('#planner-everything')).toBeVisible();
    });
  });
}
