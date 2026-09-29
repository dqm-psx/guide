const assert = require('node:assert/strict');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FILE_URL = 'file://' + path.join(REPO_ROOT, 'index.html');
let serverUrl = null;

const STORAGE_KEY = 'dqm-guide-state-v61-v1';

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

    test('exposes the DQMReference API', async ({ page }) => {
      await page.goto(url());
      const api = await page.evaluate(() => ({
        refresh: typeof DQMReference.refresh === 'function',
        selectTarget: typeof DQMReference.selectTarget === 'function',
        currentTargetIndex: typeof DQMReference.currentTargetIndex === 'function',
      }));
      assert.equal(api.refresh, true);
      assert.equal(api.selectTarget, true);
      assert.equal(api.currentTargetIndex, true);
    });

    test('species star toggles aria-pressed, label, and glyph and persists across reload', async ({ page }) => {
      await page.goto(url());
      const star = page.locator('button[data-species-favorite="11"]');
      await expect(star).toHaveAttribute('aria-pressed', 'false');
      await expect(star).toHaveAttribute('aria-label', 'Favorite Slime');
      await expect(star).toHaveText('☆');
      await star.click();
      await expect(star).toHaveAttribute('aria-pressed', 'true');
      await expect(star).toHaveAttribute('aria-label', 'Unfavorite Slime');
      await expect(star).toHaveText('★');
      await expect(page.locator('#planner-message')).toHaveText('Favorited Slime.');
      await page.reload();
      await expect(star).toHaveAttribute('aria-pressed', 'true');
      await expect(star).toHaveAttribute('aria-label', 'Unfavorite Slime');
      const stored = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
      assert.ok(JSON.parse(stored).favoriteSpeciesIndices.includes(11));
    });

    test('favorites-only filter shows only starred playable species', async ({ page }) => {
      await page.goto(url());
      await page.locator('button[data-species-favorite="11"]').click();
      await page.locator('button[data-species-favorite="1"]').click();
      await page.check('#species-favorites-only');
      await expect(page.locator('#species-count')).toHaveText('2 matching species');
      await expect(page.locator('#species-rows tr')).toHaveCount(2);
      const indices = await page.evaluate(() =>
        Array.from(document.querySelectorAll('#species-rows button[data-species-favorite]'))
          .map(button => Number(button.dataset.speciesFavorite)));
      assert.deepEqual(indices.sort((a, b) => a - b), [1, 11]);
    });

    test('star toggles with Enter and Space and announces', async ({ page }) => {
      await page.goto(url());
      const star = page.locator('button[data-species-favorite="11"]');
      await star.focus();
      await page.keyboard.press('Enter');
      await expect(star).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#planner-message')).toHaveText('Favorited Slime.');
      await star.focus();
      await page.keyboard.press('Space');
      await expect(star).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('#planner-message')).toHaveText('Unfavorited Slime.');
    });

    test('internal slots cannot be favorited (star is disabled)', async ({ page }) => {
      await page.goto(url());
      await page.check('#show-internal');
      await page.fill('#species-search', 'Tattsu');
      const internalIndex = await page.evaluate(() => DATA.species.find(s => s.playable === false).index);
      const star = page.locator('button[data-species-favorite="' + internalIndex + '"]');
      await expect(star).toBeDisabled();
    });

    test('pin adds the browsed offspring as the active target', async ({ page }) => {
      await page.goto(url());
      await page.selectOption('#target', '11');
      await page.click('#target-pin');
      const item = page.locator('#target-list .target-item');
      await expect(item).toHaveCount(1);
      await expect(item).toHaveClass(/is-active/);
      await expect(item.locator('.target-name')).toContainText('Slime');
      await expect(item.locator('button[data-target-switch]')).toHaveAttribute('aria-current', 'true');
      await expect(page.locator('#target-active-summary')).toHaveText('Active target: Slime');
      const openButton = item.locator('button[data-target-switch]');
      await expect(openButton).toHaveAttribute('aria-label', 'Open target Slime');
      await expect(item.locator('button[data-target-remove]')).toHaveAttribute('aria-label', 'Remove target Slime');
      await expect(openButton).toBeFocused();
    });

    test('pinning two targets and switching moves the active marker', async ({ page }) => {
      await page.goto(url());
      await page.selectOption('#target', '11');
      await page.click('#target-pin');
      await page.selectOption('#target', '99');
      await page.click('#target-pin');
      await expect(page.locator('#target-list .target-item')).toHaveCount(2);
      await expect(page.locator('#target-list .target-item').nth(1)).toHaveClass(/is-active/);
      await page.locator('#target-list .target-item').nth(0).locator('button[data-target-switch]').click();
      await expect(page.locator('#target')).toHaveValue('11');
      await expect(page.locator('#target-list .target-item').nth(0)).toHaveClass(/is-active/);
      await expect(page.locator('#target-list .target-item').nth(1)).not.toHaveClass(/is-active/);
    });

    test('browsing another species does not overwrite the active target', async ({ page }) => {
      await page.goto(url());
      await page.selectOption('#target', '11');
      await page.click('#target-pin');
      await expect(page.locator('#target-active-summary')).toHaveText('Active target: Slime');
      await page.selectOption('#target', '99');
      await expect(page.locator('#target-active-summary')).toContainText('Viewing Dracky');
      await expect(page.locator('#target-active-summary')).toContainText('Active target: Slime');
      await expect(page.locator('#target-list .target-item')).toHaveCount(1);
      await expect(page.locator('#target-list .target-item')).toHaveClass(/is-active/);
    });

    test('browsing updates the pin button label without changing the active target', async ({ page }) => {
      await page.goto(url());
      await page.selectOption('#target', '11');
      await page.click('#target-pin');
      await expect(page.locator('#target-pin')).toHaveText('Pin Slime');
      await page.selectOption('#target', '99');
      await expect(page.locator('#target-pin')).toHaveText('Pin Dracky');
      await expect(page.locator('#target-active-summary')).toContainText('Active target: Slime');
    });

    test('removing a target deletes it; removing the active target clears the active marker', async ({ page }) => {
      await page.goto(url());
      await page.selectOption('#target', '11');
      await page.click('#target-pin');
      await page.selectOption('#target', '99');
      await page.click('#target-pin');
      await expect(page.locator('#target-list .target-item')).toHaveCount(2);
      await page.locator('#target-list .target-item').nth(1).locator('button[data-target-remove]').click();
      await expect(page.locator('#target-list .target-item')).toHaveCount(1);
      await expect(page.locator('#target-list .target-item')).toHaveClass(/is-active/);
      await expect(page.locator('#target-active-summary')).toContainText('Active target: Slime');
      await page.locator('#target-list .target-item').nth(0).locator('button[data-target-remove]').click();
      await expect(page.locator('#target-list .target-item')).toHaveCount(0);
      await expect(page.locator('#target-active-summary')).toContainText('No active target yet');
    });

    test('pinned targets persist across reload', async ({ page }) => {
      await page.goto(url());
      await page.selectOption('#target', '11');
      await page.click('#target-pin');
      await page.reload();
      await expect(page.locator('#target-list .target-item')).toHaveCount(1);
      await expect(page.locator('#target-list .target-item')).toHaveClass(/is-active/);
      const stored = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
      const doc = JSON.parse(stored);
      assert.equal(doc.teams[0].targets.length, 1);
      assert.equal(doc.teams[0].targets[0].speciesIndex, 11);
      assert.equal(doc.teams[0].activeTargetId, doc.teams[0].targets[0].id);
    });

    test('targets are independent per team', async ({ page }) => {
      await page.goto(url());
      await page.selectOption('#target', '11');
      await page.click('#target-pin');
      await page.click('#planner-nav-link');
      await page.click('#planner-team-new');
      await page.fill('#planner-team-name', 'Team B');
      await page.click('#planner-team-name-save');
      const stored = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
      const doc = JSON.parse(stored);
      assert.equal(doc.teams.length, 2);
      assert.equal(doc.teams[0].targets.length, 1);
      assert.equal(doc.teams[1].targets.length, 0);
      assert.equal(doc.teams[1].activeTargetId, null);
      await page.evaluate(() => { location.hash = 'offspring-finder'; });
      await expect(page.locator('#target-list .target-item')).toHaveCount(0);
    });

    test('planner link opens the active target in the offspring finder', async ({ page }) => {
      await page.goto(url());
      await page.selectOption('#target', '11');
      await page.click('#target-pin');
      await page.click('#planner-nav-link');
      await expect(page.locator('#team-planner')).toBeVisible();
      const link = page.locator('#planner-open-target');
      await expect(link).toBeVisible();
      await expect(link).toContainText('Slime');
      await link.click();
      await expect(page.locator('#offspring-finder')).toBeVisible();
      await expect(page.locator('#team-planner')).toBeHidden();
      await expect(page.locator('#target')).toHaveValue('11');
    });

    test('internal slots cannot become targets', async ({ page }) => {
      await page.goto(url());
      await page.check('#show-internal');
      const internalIndex = await page.evaluate(() => DATA.species.find(s => s.playable === false).index);
      await page.selectOption('#target', String(internalIndex));
      await expect(page.locator('#target-pin')).toBeDisabled();
    });
  });
}
