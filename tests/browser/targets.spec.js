const assert = require('node:assert/strict');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FILE_URL = 'file://' + path.join(REPO_ROOT, 'index.html');
let serverUrl = null;

let STORAGE_KEY;
test.beforeAll(async () => {
  ({STATE_KEY: STORAGE_KEY} = (await import('../helpers/keys.js')).default);
});

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

    // The saved target list and the plan panel live in the planner's
    // Targets & plans tab.
    const openTargets = async page => {
      await page.click('#planner-nav-link');
      await page.click('#planner-tab-targets');
      await expect(page.locator('#planner-targets')).toBeVisible();
    };

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
      await page.goto(url() + '#species-index');
      const star = page.locator('button[data-species-favorite="11"]');
      await expect(star).toHaveAttribute('aria-pressed', 'false');
      await expect(star).toHaveAttribute('aria-label', 'Favorite Slime');
      await expect(star).toHaveText('☆');
      await star.click();
      await expect(star).toHaveAttribute('aria-pressed', 'true');
      await expect(star).toHaveAttribute('aria-label', 'Unfavorite Slime');
      await expect(star).toHaveText('★');
      await expect(page.locator('#planner-message')).toContainText('Slime');
      await page.reload();
      await expect(star).toHaveAttribute('aria-pressed', 'true');
      await expect(star).toHaveAttribute('aria-label', 'Unfavorite Slime');
      const stored = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
      assert.ok(JSON.parse(stored).favoriteSpeciesIndices.includes(11));
    });

    test('favorites-only filter shows only starred playable species', async ({ page }) => {
      await page.goto(url() + '#species-index');
      await page.locator('button[data-species-favorite="11"]').click();
      await page.locator('button[data-species-favorite="1"]').click();
      await page.check('#species-favorites-only');
      await expect(page.locator('#species-count')).toHaveText(/\d+ matching species/);
      await expect(page.locator('#species-rows tr')).toHaveCount(2);
      const indices = await page.evaluate(() =>
        Array.from(document.querySelectorAll('#species-rows button[data-species-favorite]'))
          .map(button => Number(button.dataset.speciesFavorite)));
      assert.deepEqual(indices.sort((a, b) => a - b), [1, 11]);
    });

    test('star toggles with Enter and Space and announces', async ({ page }) => {
      await page.goto(url() + '#species-index');
      const star = page.locator('button[data-species-favorite="11"]');
      await star.focus();
      await page.keyboard.press('Enter');
      await expect(star).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#planner-message')).toContainText('Slime');
      await expect(page.locator('#species-message')).toContainText('Slime');
      await expect(star).toBeFocused();
      await star.focus();
      await page.keyboard.press('Space');
      await expect(star).toHaveAttribute('aria-pressed', 'false');
      await expect(page.locator('#planner-message')).toContainText('Slime');
      await expect(page.locator('#species-message')).toContainText('Slime');
      await expect(star).toBeFocused();
    });

    test('target switching works with the keyboard', async ({ page }) => {
      await page.goto(url() + '#offspring-finder');
      await page.selectOption('#target', '11');
      await page.click('#target-pin');
      await page.selectOption('#target', '99');
      await page.click('#target-pin');
      await openTargets(page);
      const firstSwitch = page.locator('#target-list .target-item').nth(0).locator('button[data-target-switch]');
      await firstSwitch.focus();
      await page.keyboard.press('Enter');
      await expect(page.locator('#target-list .target-item').nth(0)).toHaveClass(/is-active/);
      await expect(page.locator('#target-active-summary')).toContainText('Slime');
    });

    test('internal slots cannot be favorited (star is disabled)', async ({ page }) => {
      await page.goto(url() + '#species-index');
      await page.check('#show-internal');
      await page.fill('#species-search', 'Tattsu');
      const internalIndex = await page.evaluate(() => DATA.species.find(s => s.playable === false).index);
      const star = page.locator('button[data-species-favorite="' + internalIndex + '"]');
      await expect(star).toBeDisabled();
    });

    test('pin adds the browsed offspring as the active target', async ({ page }) => {
      await page.goto(url() + '#offspring-finder');
      await page.selectOption('#target', '11');
      await page.click('#target-pin');
      // Focus follows the new path to the plan, not to a list row in the
      // planner view that is not on screen.
      await expect(page.locator('#target-view-plan')).toBeFocused();
      await expect(page.locator('#target-view-plan')).toBeVisible();
      await expect(page.locator('#target-active-summary')).toContainText('Slime');
      await openTargets(page);
      const item = page.locator('#target-list .target-item');
      await expect(item).toHaveCount(1);
      await expect(item).toHaveClass(/is-active/);
      await expect(item.locator('.target-name')).toContainText('Slime');
      await expect(item.locator('button[data-target-switch]')).toHaveAttribute('aria-current', 'true');
      const openButton = item.locator('button[data-target-switch]');
      await expect(openButton).toHaveAttribute('aria-label', 'Open target Slime');
      await expect(item.locator('button[data-target-remove]')).toHaveAttribute('aria-label', 'Remove target Slime');
    });

    test('pinning two targets and switching moves the active marker', async ({ page }) => {
      await page.goto(url() + '#offspring-finder');
      await page.selectOption('#target', '11');
      await page.click('#target-pin');
      await page.selectOption('#target', '99');
      await page.click('#target-pin');
      await openTargets(page);
      await expect(page.locator('#target-list .target-item')).toHaveCount(2);
      await expect(page.locator('#target-list .target-item').nth(1)).toHaveClass(/is-active/);
      await page.locator('#target-list .target-item').nth(0).locator('button[data-target-switch]').click();
      await expect(page.locator('#target')).toHaveValue('11');
      await expect(page.locator('#target-list .target-item').nth(0)).toHaveClass(/is-active/);
      await expect(page.locator('#target-list .target-item').nth(1)).not.toHaveClass(/is-active/);
    });

    test('re-pinning the same species reuses the existing target', async ({ page }) => {
      await page.goto(url() + '#offspring-finder');
      await page.selectOption('#target', '11');
      await page.click('#target-pin');
      await page.selectOption('#target', '99');
      await page.click('#target-pin');
      await page.selectOption('#target', '11');
      await page.click('#target-pin');
      await openTargets(page);
      await expect(page.locator('#target-list .target-item')).toHaveCount(2);
      await expect(page.locator('#target-list .target-item').nth(0)).toHaveClass(/is-active/);
      const doc = JSON.parse(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY));
      assert.equal(doc.teams[0].targets.length, 2);
      assert.equal(doc.teams[0].activeTargetId, doc.teams[0].targets[0].id);
    });

    test('browsing another species does not overwrite the active target', async ({ page }) => {
      await page.goto(url() + '#offspring-finder');
      await page.selectOption('#target', '11');
      await page.click('#target-pin');
      await expect(page.locator('#target-active-summary')).toContainText('Slime');
      await page.selectOption('#target', '99');
      await expect(page.locator('#target-active-summary')).toContainText('Dracky');
      await expect(page.locator('#target-active-summary')).toContainText('Slime');
      await expect(page.locator('#target-list .target-item')).toHaveCount(1);
      await expect(page.locator('#target-list .target-item')).toHaveClass(/is-active/);
    });

    test('browsing updates the pin button label without changing the active target', async ({ page }) => {
      await page.goto(url() + '#offspring-finder');
      await page.selectOption('#target', '11');
      await page.click('#target-pin');
      await expect(page.locator('#target-pin')).toHaveText(/Pin/);
      await page.selectOption('#target', '99');
      await expect(page.locator('#target-pin')).toHaveText(/Pin/);
      await expect(page.locator('#target-active-summary')).toContainText('Slime');
    });

    test('removing a target deletes it; removing the active target clears the active marker', async ({ page }) => {
      await page.goto(url() + '#offspring-finder');
      await page.selectOption('#target', '11');
      await page.click('#target-pin');
      await page.selectOption('#target', '99');
      await page.click('#target-pin');
      await openTargets(page);
      await expect(page.locator('#target-list .target-item')).toHaveCount(2);
      await page.locator('#target-list .target-item').nth(1).locator('button[data-target-remove]').click();
      await expect(page.locator('#target-list .target-item')).toHaveCount(1);
      await expect(page.locator('#target-list .target-item')).toHaveClass(/is-active/);
      await expect(page.locator('#target-active-summary')).toContainText('Slime');
      await page.locator('#target-list .target-item').nth(0).locator('button[data-target-remove]').click();
      await expect(page.locator('#target-list .target-item')).toHaveCount(0);
      await expect(page.locator('#target-active-summary')).not.toHaveText('');
      // Focus stays in this tab: the removed row is gone, so the tab takes it.
      await expect(page.locator('#planner-tab-targets')).toBeFocused();
    });

    test('pinned targets persist across reload', async ({ page }) => {
      await page.goto(url() + '#offspring-finder');
      await page.selectOption('#target', '11');
      await page.click('#target-pin');
      await page.reload();
      await openTargets(page);
      await expect(page.locator('#target-list .target-item')).toHaveCount(1);
      await expect(page.locator('#target-list .target-item')).toHaveClass(/is-active/);
      const stored = await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY);
      const doc = JSON.parse(stored);
      assert.equal(doc.teams[0].targets.length, 1);
      assert.equal(doc.teams[0].targets[0].speciesIndex, 11);
      assert.equal(doc.teams[0].activeTargetId, doc.teams[0].targets[0].id);
    });

    test('targets are independent per team', async ({ page }) => {
      await page.goto(url() + '#offspring-finder');
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
      await openTargets(page);
      await expect(page.locator('#target-list .target-item')).toHaveCount(0);
    });

    test('the Targets & plans tab links back to Find parents to choose another target', async ({ page }) => {
      await page.goto(url() + '#offspring-finder');
      await page.selectOption('#target', '11');
      await page.click('#target-pin');
      await openTargets(page);
      const link = page.locator('#planner-open-target');
      await expect(link).toBeVisible();
      await expect(link).toContainText(/parents/i);
      await expect(link).toContainText('Slime');
      await link.click();
      await expect(page.locator('#offspring-finder')).toBeVisible();
      await expect(page.locator('#team-planner')).toBeHidden();
      await expect(page.locator('#target')).toHaveValue('11');
      await expect(page.locator('#target')).toBeFocused();
    });

    test('the saved target list and the plan panel live in the planner Targets & plans tab', async ({ page }) => {
      await page.goto(url() + '#offspring-finder');
      // The pin control stays beside the offspring selector in Find parents.
      await expect(page.locator('#offspring-finder #target-pin')).toHaveCount(1);
      await expect(page.locator('#offspring-finder #target')).toHaveCount(1);
      // The list and the plan are not in that view at all.
      await expect(page.locator('#offspring-finder #target-list')).toHaveCount(0);
      await expect(page.locator('#offspring-finder #plan-panel')).toHaveCount(0);
      // They are in the planner's Targets & plans tab, with the same ids.
      await expect(page.locator('#planner-targets #target-list')).toHaveCount(1);
      await expect(page.locator('#planner-targets #plan-panel')).toHaveCount(1);
      await expect(page.locator('#planner-tab-targets')).toHaveText(/Targets/);
      await openTargets(page);
      await expect(page.locator('#plan-empty')).toBeVisible();
    });

    test('pinning offers a View plan path into the planner Targets & plans tab', async ({ page }) => {
      await page.goto(url() + '#offspring-finder');
      await expect(page.locator('#target-view-plan')).toBeHidden();
      await page.selectOption('#target', '2'); // Winged Slime
      await page.click('#target-pin');
      const viewPlan = page.locator('#target-view-plan');
      await expect(viewPlan).toBeVisible();
      await expect(viewPlan).toContainText('Winged Slime');
      await viewPlan.click();
      await expect(page.locator('#team-planner')).toBeVisible();
      await expect(page).toHaveURL(/#team-planner$/);
      await expect(page.locator('#planner-targets')).toBeVisible();
      await expect(page.locator('#plan-body')).toBeVisible();
      await expect(page.locator('#plan-heading')).toBeFocused();
    });

    test('internal slots cannot become targets', async ({ page }) => {
      // "Include extra / internal slots" lives in the name index; the pin
      // control lives in Find parents. Both views are needed.
      await page.goto(url() + '#species-index');
      await page.check('#show-internal');
      const internalIndex = await page.evaluate(() => DATA.species.find(s => s.playable === false).index);
      await page.goto(url() + '#offspring-finder');
      await page.selectOption('#target', String(internalIndex));
      await expect(page.locator('#target-pin')).toBeDisabled();
    });
  });
}
