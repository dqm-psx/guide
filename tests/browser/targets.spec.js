const {openTeamSettings} = require('../helpers/planner-ui');
const assert = require('node:assert/strict');
const { test, expect } = require('@playwright/test');

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

// Served mode: the page under /guide/, the way GitHub Pages mounts it.
// The file:// contract is pinned by tests/browser/file-mode.spec.js.
test.describe('served', () => {
  const url = () => serverUrl;

  // The saved target list and the plan panel live in the planner's
  // Targets & plans tab.
  const openTargets = async page => {
    await page.click('#planner-nav-link');
    await page.click('#planner-tab-targets');
    await expect(page.locator('#planner-targets')).toBeVisible();
  };

  test('start and reopen breeding plans by searching directly in My game on a phone', async ({page}) => {
    await page.setViewportSize({width: 375, height: 812});
    await page.goto(url() + '#team-planner?tab=targets');
    const search = page.getByRole('combobox', {name:'Choose a breeding target'});
    const targets = page.locator('#target-list .target-item');
    const planNodes = page.locator('#plan-tree .plan-node');
    await expect(search).toBeVisible();
    await search.fill('zzzzzz');
    await expect(page.locator('#planner-targets')).toContainText('No matching monsters');
    await search.press('Enter');
    await expect(targets).toHaveCount(0);

    // Select a published menu alias using only the keyboard.
    await search.fill('WingSlime');
    await expect(page.getByRole('option', {name:/Winged Slime/})).toBeVisible();
    await search.press('Enter');
    await expect(targets).toHaveCount(1);
    await expect(planNodes).toContainText('Winged Slime');
    await page.locator('button[data-suggestion-use="base:shrine:0:89"]').click();
    await expect(planNodes).toHaveCount(3);

    // A second target starts its own plan without leaving the tab.
    await search.fill('ドラゴスライム');
    const choice = page.getByRole('option', {name:/Drake Slime/});
    await expect(choice).toBeInViewport();
    await choice.click();
    await expect(targets).toHaveCount(2);
    await expect(planNodes).toHaveCount(1);
    await expect(planNodes).toContainText('Drake Slime');
    await expect(page).toHaveURL(/#team-planner\?tab=targets$/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);

    // Choosing an existing target restores its edited recipe rather than creating a copy.
    await page.reload();
    await search.fill('Winged Slime');
    await search.press('Enter');
    await expect(targets).toHaveCount(2);
    await expect(planNodes).toHaveCount(3);
    await expect(planNodes.first()).toContainText('Picky');
    await expect(targets.filter({hasText:'Winged Slime'})).toHaveClass(/is-active/);
  });

  test('start a plan from a saved team’s pairings and keep it with that team', async ({page}) => {
    const {planningBlock} = await import('../helpers/psx-save');
    await page.goto(url() + '#team-planner?import=save');
    const teams = page.locator('#planner-team-select');
    const original = await teams.inputValue();
    await page.locator('#save-import-file').setInputFiles({
      name:'example.sav', mimeType:'application/octet-stream', buffer:planningBlock()
    });
    await page.locator('#save-import-apply').click();
    await page.click('#planner-tab-targets');
    const imported = await teams.inputValue();
    const choices = page.locator('#plan-team-choices');
    const suggestion = choices.getByRole('button').first();
    await expect(suggestion).toBeVisible();
    const name = (await suggestion.innerText()).trim();
    await suggestion.click();
    const active = page.locator('#target-list .is-active .target-name');
    await expect(active).toHaveText(name);
    await expect(page.locator('#plan-body')).toBeVisible();
    await teams.selectOption(original);
    await expect(choices).toBeHidden();
    await expect(page.locator('#target-list .target-item')).toHaveCount(0);
    await teams.selectOption(imported);
    await expect(active).toHaveText(name);
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
    await page.locator('#guide-settings > summary').click();
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

  test('browsing updates the pin label without overwriting the active target', async ({ page }) => {
    await page.goto(url() + '#offspring-finder');
    const [pinnedName, browsedName] = await page.evaluate(() => [11, 99].map(index => {
      const species = DATA.species.find(entry => entry.index === index);
      return species.display_name || species.name;
    }));
    await page.selectOption('#target', '11');
    await page.click('#target-pin');
    await expect(page.locator('#target-pin')).toHaveText('Pin ' + pinnedName);
    await expect(page.locator('#target-active-summary')).toContainText(pinnedName);
    await page.selectOption('#target', '99');
    await expect(page.locator('#target-pin')).toHaveText('Pin ' + browsedName);
    await expect(page.locator('#target-active-summary')).toContainText(browsedName);
    await expect(page.locator('#target-active-summary')).toContainText(pinnedName);
    await expect(page.locator('#target-list .target-item')).toHaveCount(1);
    await expect(page.locator('#target-list .target-item')).toHaveClass(/is-active/);
    await expect(page.locator('#target-list .target-name')).toHaveText(pinnedName);
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
    await expect(page.getByRole('combobox', {name:'Choose a breeding target'})).toBeFocused();
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
    await openTeamSettings(page);
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

  test('the active target links to its complete parent recipes', async ({ page }) => {
    await page.goto(url() + '#offspring-finder');
    await page.selectOption('#target', '11');
    await page.click('#target-pin');
    await openTargets(page);
    const link = page.locator('#planner-open-target');
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href','#offspring-finder?target=11');
    await link.click();
    await expect(page.locator('#offspring-finder')).toBeVisible();
    await expect(page.locator('#team-planner')).toBeHidden();
    await expect(page.locator('#target')).toHaveValue('11');
    await expect(page.locator('#offspring-heading')).toBeFocused();
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
    await expect(page.getByRole('combobox', {name:'Choose a breeding target'})).toBeVisible();
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
    await expect(page).toHaveURL(/#team-planner\?tab=targets$/);
    await expect(page.locator('#planner-targets')).toBeVisible();
    await expect(page.locator('#plan-body')).toBeVisible();
    await expect(page.locator('#plan-heading')).toBeFocused();
  });

  test('internal slots cannot become targets', async ({ page }) => {
    // "Include extra / internal slots" lives in the name index; the pin
    // control lives in Find parents. Both views are needed.
    await page.goto(url() + '#species-index');
    await page.locator('#guide-settings > summary').click();
    await page.check('#show-internal');
    const internalIndex = await page.evaluate(() => DATA.species.find(s => s.playable === false).index);
    await page.goto(url() + '#offspring-finder');
    await page.selectOption('#target', String(internalIndex));
    await expect(page.locator('#target-pin')).toBeDisabled();
  });
});
