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

// Served mode: the page under /guide/, the way GitHub Pages mounts it.
// The file:// contract is pinned by tests/browser/file-mode.spec.js.
test.describe('served', () => {
  const url = () => serverUrl;

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
    await page.goto(url() + '#offspring-finder');
    await page.selectOption('#target', '1');
    await page.selectOption('#reverse-pedigree-family', '0');
    await page.selectOption('#reverse-mate-family', '0');
    const tryPair = page.locator('#reverse-rows button[data-a="1"][data-b="1"]');
    await expect(tryPair).toHaveCount(1);
    await tryPair.click();
    // "Try pair" hands off to Find a pairing itself.
    await expect(page.locator('#pair-finder')).toBeVisible();
    await expect(page).toHaveURL(/#pair-finder$/);
    const note = page.locator('#pair-plus-note');
    await expect(note).toBeVisible();
    await expect(note).toContainText(/Spotted Slime/);
    await expect(note).toContainText(/\+4/);
    await expect(page.locator('#result-name')).toHaveText('Spotted Slime');
    const noteStyle = await note.evaluate(el => {
      const style = getComputedStyle(el);
      return { color: style.color, marginTop: style.marginTop, fontWeight: style.fontWeight };
    });
    expect(noteStyle.color).not.toBe('rgb(0, 0, 0)');
    expect(parseFloat(noteStyle.marginTop)).toBeGreaterThan(0);
    expect(Number(noteStyle.fontWeight) >= 600 || noteStyle.fontWeight === 'bold').toBe(true);
  });

  test('Dragon Kid recipes show the exact plus boundary on both parents', async ({ page }) => {
    await page.goto(url() + '#offspring-finder?target=45');
    await page.selectOption('#reverse-pedigree-family', '1');
    await page.selectOption('#reverse-mate-family', '1');
    const baseRow = page.locator('#reverse-rows tr').filter({ has: page.locator('button[data-a="26"][data-b="26"]') });
    await expect(baseRow.locator('.breeding-rule-marker [aria-hidden="true"]')).toHaveText(['<+4', '<+4']);
    await expect(baseRow.locator('.breeding-rule-marker .sr-only')).toHaveText([' (below +4 for the base result)', ' (below +4 for the base result)']);
    const boundary = 'Ordinary breeding: both parents below +4 yield Dragon; either parent at +4 or higher yields Great Dragon. Check each parent separately; do not add their + values.';
    await expect(baseRow.locator('.breeding-rule-note')).toHaveText('Ordinary shrine: both below +4 give Dragon; either +4 or higher gives Great Dragon.');
    // Dragon + Dragon Kid has no exact + rule: a family match must not add one.
    const ordinaryRow = page.locator('#reverse-rows tr').filter({ has: page.locator('button[data-a="45"][data-b="26"]') });
    await expect(ordinaryRow).toHaveCount(1);
    await expect(ordinaryRow.locator('.breeding-rule-marker')).toHaveCount(0);
    await expect(ordinaryRow.locator('.breeding-rule-note')).toHaveCount(0);

    await baseRow.getByRole('button').click();
    await expect(page.locator('#result-name')).toHaveText('Dragon');
    await expect(page.locator('#pair-plus-note')).toHaveText(boundary);

    await page.goto(url() + '#offspring-finder?target=50');
    const upgradedRow = page.locator('#reverse-rows tr').filter({ has: page.locator('button[data-recipe-a="26"][data-recipe-b="26"]') });
    await expect(upgradedRow.locator('.breeding-rule-marker [aria-hidden="true"]')).toHaveText(['+4', '+4']);
    await expect(upgradedRow.locator('.breeding-rule-note')).toContainText(/\+4/);
  });

  test('Find parents explains Breeding room conditions beside the recipe', async ({ page }) => {
    await page.goto(url() + '#offspring-finder?target=25');
    await expect(page.locator('#reverse-rows')).toContainText(/Breeding room/i);
    const roomRow = page.locator('#reverse-rows tr').filter({ has: page.locator('button[data-recipe-a="11"][data-recipe-b="101"]') });
    await expect(roomRow.locator('.reverse-condition')).toContainText(/Breeding room/i);
    await expect(roomRow.locator('.reverse-condition')).toContainText(/ordinary shrine/i);
    await expect(roomRow.locator('.breeding-rule-marker')).toHaveCount(0);
  });

  test('species index filters by name query and family', async ({ page }) => {
    await page.goto(url() + '#species-index');
    const playable = await page.evaluate(() => DATA.species.filter(s => s.playable !== false).length);
    await expect(page.locator('#species-count')).toHaveText(`${playable} matching species`);
    await page.fill('#species-search', 'Spotted Slime');
    await expect(page.locator('#species-count')).toHaveText('1 matching species');
    await expect(page.locator('#species-rows tr')).toHaveCount(1);
    await expect(page.locator('#species-rows tr td:nth-child(2)')).toContainText('Spotted Slime');
    await page.fill('#species-search', '');
    await page.selectOption('#species-family', '1');
    const familyCount = await page.evaluate(() => DATA.species.filter(s => s.playable !== false && String(s.family_id) === '1').length);
    await expect(page.locator('#species-count')).toHaveText(`${familyCount} matching species`);
    const familyCells = page.locator('#species-rows tr td:nth-child(4)');
    const rowCount = await familyCells.count();
    for (let i = 0; i < rowCount; i++) {
      await expect(familyCells.nth(i)).toHaveText('Dragon');
    }
  });

  test('include extra / internal toggles the species count', async ({ page }) => {
    await page.goto(url() + '#species-index');
    const playable = await page.evaluate(() => DATA.species.filter(s => s.playable !== false).length);
    const total = await page.evaluate(() => DATA.species.length);
    await expect(page.locator('#species-count')).toHaveText(`${playable} matching species`);
    await page.check('#show-internal');
    await expect(page.locator('#species-count')).toHaveText(`${total} matching species`);
    await page.uncheck('#show-internal');
    await expect(page.locator('#species-count')).toHaveText(`${playable} matching species`);
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
    for (const id of ['pair-finder', 'offspring-finder', 'species-index', 'breeding-table']) {
      await expect(page.locator('#' + id)).toBeHidden();
    }
    await page.focus('#planner-tab-roster');
    // The arrow keys walk every tab, Targets & plans included.
    for (const tab of ['targets', 'breeding']) {
      await page.keyboard.press('ArrowRight');
      await expect(page.locator('#planner-tab-' + tab)).toHaveAttribute('aria-selected', 'true');
      await expect(page.locator('#planner-' + tab)).toBeVisible();
      await expect(page.locator('#planner-roster')).toBeHidden();
    }
    await expect(page.locator('#planner-tab-everything')).toHaveCount(0);
    await page.click('.nav a[href="#breeding-table"]');
    await expect(page.locator('#breeding-table')).toBeVisible();
    await expect(page.locator('#team-planner')).toBeHidden();
  });
});
