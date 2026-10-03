const assert = require('node:assert/strict');
const { test, expect } = require('@playwright/test');

let serverUrl = null;

let STATE_KEY; let SESSION_KEY;
test.beforeAll(async () => {
  ({STATE_KEY, SESSION_KEY} = (await import('../helpers/keys.js')).default);
});

test.beforeAll(async () => {
  const { startGuideServer } = await import('../helpers/modes');
  serverUrl = await startGuideServer();
});

test.afterAll(async () => {
  const { stopGuideServer } = await import('../helpers/modes');
  await stopGuideServer();
});

const addMonster = async (page, speciesIndex, sex, location) => {
  await page.check(sex === 'female' ? '#planner-sex-female' : '#planner-sex-male');
  await page.check(location === 'farm' ? '#planner-location-farm' : '#planner-location-party');
  await page.selectOption('#planner-add-species', String(speciesIndex));
  await page.click('#planner-add-button');
};

// Served mode: the page under /guide/, the way GitHub Pages mounts it.
// The file:// contract is pinned by tests/browser/file-mode.spec.js.
test.describe('served', () => {
  const url = () => serverUrl;

  test('a shared URL opens the same pair and wins over the saved session (item 6)', async ({ page }) => {
    // A session with a different pair must not beat the shared link.
    await page.addInitScript(({ key, saved }) => {
      localStorage.setItem(key, JSON.stringify(saved));
    }, { key: SESSION_KEY, saved: { version: 1, pair: { a: 11, b: 99 } } });
    await page.goto(url() + '#pair-finder?a=1&b=13');
    await expect(page.locator('#pedigree')).toHaveValue('1');
    await expect(page.locator('#mate')).toHaveValue('13');
    await expect(page.locator('#result-name')).toHaveText(await page.evaluate(() => {
      const value = DATA.matrix[1][13];
      return DATA.species.find(s => s.index === value).display_name;
    }));
  });

  test('pair finder selections and filters restore across reloads (item 10)', async ({ page }) => {
    await page.goto(url() + '#pair-finder');
    await page.selectOption('#pedigree', '1');
    await page.selectOption('#mate', '13');
    await page.fill('#pedigree-search', 'Spotted');
    // Leave the view; the next load carries no URL parameters, so the
    // session is the only source of the pair.
    await page.goto(url() + '#species-index');
    await page.goto(url() + '#pair-finder');
    await expect(page.locator('#pedigree')).toHaveValue('1');
    await expect(page.locator('#mate')).toHaveValue('13');
    await expect(page.locator('#pedigree-search')).toHaveValue('Spotted');
  });

  test('pairings chosen on the bare homepage become shareable URLs (item 6)', async ({ page }) => {
    await page.goto(url());
    await page.selectOption('#pedigree', '1');
    await page.selectOption('#mate', '13');
    await expect.poll(() => page.evaluate(() => location.hash)).toBe('#pair-finder?a=1&b=13');
    // A recipient opening that URL sees the same pair.
    const recipient = await page.context().newPage();
    await recipient.goto(url() + '#pair-finder?a=1&b=13');
    await expect(recipient.locator('#pedigree')).toHaveValue('1');
    await expect(recipient.locator('#mate')).toHaveValue('13');
    await recipient.close();
  });

  test('hash navigation and Back/Forward re-apply shared parameters (item 6)', async ({ page }) => {
    await page.goto(url() + '#pair-finder?a=1&b=13');
    await expect(page.locator('#pedigree')).toHaveValue('1');
    await page.evaluate(() => { location.hash = '#pair-finder?a=11&b=99'; });
    await expect(page.locator('#pedigree')).toHaveValue('11');
    await expect(page.locator('#mate')).toHaveValue('99');
    await page.goBack();
    await expect(page.locator('#pedigree')).toHaveValue('1');
    await expect(page.locator('#mate')).toHaveValue('13');

    await page.evaluate(() => { location.hash = '#offspring-finder?target=17'; });
    await expect(page.locator('#offspring-finder')).toBeVisible();
    await expect(page.locator('#target')).toHaveValue('17');
    await page.evaluate(() => { location.hash = '#offspring-finder?target=11'; });
    await expect(page.locator('#target')).toHaveValue('11');
  });

  test('a shared internal-slot pairing ignores the saved visibility filter (item 6)', async ({ page }) => {
    await page.addInitScript(({ key, saved }) => {
      localStorage.setItem(key, JSON.stringify(saved));
    }, { key: SESSION_KEY, saved: { version: 1, showInternal: false } });
    await page.goto(url() + '#pair-finder?a=315&b=13');
    await expect(page.locator('#show-internal')).toBeChecked();
    await expect(page.locator('#pedigree')).toHaveValue('315');
    await expect(page.locator('#mate')).toHaveValue('13');
  });

  test('offspring hash navigation refreshes the pin action and summary', async ({ page }) => {
    await page.addInitScript(({ key }) => {
      localStorage.setItem(key, JSON.stringify({ version: 1, showInternal: true }));
    }, { key: SESSION_KEY });
    await page.goto(url() + '#offspring-finder?target=315');
    await expect(page.locator('#target')).toHaveValue('315');
    await expect(page.locator('#target-pin')).toBeDisabled();

    await page.evaluate(() => { location.hash = '#offspring-finder?target=11'; });
    await expect(page.locator('#target')).toHaveValue('11');
    await expect(page.locator('#target-pin')).toBeEnabled();
    await expect(page.locator('#target-pin')).toHaveText('Pin Slime');
    await expect(page.locator('#target-active-summary')).toContainText('Viewing Slime');
    await page.click('#target-pin');
    await expect(page.locator('#target-active-summary')).toHaveText('Active target: Slime');
    await expect(page.locator('#target-view-plan')).toContainText('View plan for Slime');

    await page.goBack();
    await expect(page.locator('#target')).toHaveValue('315');
    await expect(page.locator('#target-pin')).toBeDisabled();
    await expect(page.locator('#target-pin')).toHaveText('Pin current offspring');
    await page.goForward();
    await expect(page.locator('#target')).toHaveValue('11');
    await expect(page.locator('#target-pin')).toBeEnabled();
    await expect(page.locator('#target-pin')).toHaveText('Pin Slime');
  });

  test('an internal pairing hash refreshes the name index and offspring options', async ({ page }) => {
    await page.goto(url() + '#offspring-finder');
    await expect(page.locator('#show-internal')).not.toBeChecked();
    await page.fill('#target-search', 'Tattsu');
    await expect(page.locator('#target')).toHaveValue('');
    await expect(page.locator('#target option[value="315"]')).toHaveCount(0);
    const fullCount = await page.evaluate(() => DATA.species.length);

    await page.evaluate(() => { location.hash = '#pair-finder?a=315&b=13'; });
    await expect(page.locator('#show-internal')).toBeChecked();
    await expect(page.locator('#pedigree')).toHaveValue('315');
    await expect(page.locator('#target option[value="315"]')).toHaveCount(1);
    await expect(page.locator('#target-active-summary')).toContainText('Viewing Tattsu');
    await page.click('.nav a[href="#species-index"]');
    await expect(page.locator('#species-count')).toHaveText(fullCount + ' matching species');
  });

  test('reload keeps saved parent-search filters while applying the saved pair (item 10)', async ({ page }) => {
    await page.goto(url() + '#pair-finder');
    await page.fill('#pedigree-search', 'Spotted');
    // The pairing mirrors itself into the URL; a reload must honor that pair
    // without wiping the compatible saved search filter.
    await expect.poll(() => page.evaluate(() => location.hash)).toContain('a=');
    await page.reload();
    await expect(page.locator('#pedigree-search')).toHaveValue('Spotted');
    await expect(page.locator('#pedigree-search')).toBeVisible();
  });

  test('the name index drives the pair finder and Find parents (item 7)', async ({ page }) => {
    await page.goto(url() + '#species-index');
    await page.fill('#species-search', 'Healer Slime');
    await page.click('button[data-species-pedigree="13"]');
    await expect(page.locator('#pair-finder')).toBeVisible();
    await expect(page.locator('#pedigree')).toHaveValue('13');

    await page.click('.nav a[href="#species-index"]');
    await page.fill('#species-search', 'Dracky');
    await page.click('button[data-species-mate="99"]');
    await expect(page.locator('#pair-finder')).toBeVisible();
    await expect(page.locator('#mate')).toHaveValue('99');

    await page.click('.nav a[href="#species-index"]');
    await page.fill('#species-search', 'Slime');
    await page.click('button[data-species-parents="11"]');
    await expect(page.locator('#offspring-finder')).toBeVisible();
    await expect(page.locator('#target')).toHaveValue('11');
  });

  test('the pairing result links to its other parent combinations (item 7)', async ({ page }) => {
    await page.goto(url() + '#pair-finder');
    const link = page.locator('#result-find-parents');
    await expect(link).toBeVisible();
    await expect(link).toContainText('Find parents for Winged Slime');
    await link.click();
    await expect(page.locator('#offspring-finder')).toBeVisible();
    await expect(page.locator('#target')).toHaveValue('2');
    await expect(page.locator('#target')).toBeFocused();
  });

  test('conditional recipes appear as labeled groups beside base pairs (item 8)', async ({ page }) => {
    await page.goto(url() + '#offspring-finder');
    await page.selectOption('#target', '17'); // Spotted King, produced by a + rule
    await expect(page.locator('#reverse-rows')).toContainText('Base table pairs');
    await expect(page.locator('#reverse-rows')).toContainText('Confirmed + value recipes');
    await expect(page.locator('#reverse-rows button[data-recipe-a]').first()).toBeVisible();

    await page.selectOption('#target', '19'); // Angel Slime, produced by a room rule
    await expect(page.locator('#reverse-rows')).toContainText('Breeding room recipes');
    await expect(page.locator('#reverse-rows button[data-recipe-pedigree]').first()).toBeVisible();
  });

  test('inspected pairs build a recent history that reopens a pair (item 9)', async ({ page }) => {
    await page.goto(url() + '#pair-finder');
    await page.selectOption('#pedigree', '1');
    await page.selectOption('#mate', '13');
    await page.selectOption('#pedigree', '11');
    await page.selectOption('#mate', '99');
    await expect(page.locator('#recent-pairs')).toBeVisible();
    const spotted = page.locator('#recent-pairs-list .recent-pair', { hasText: 'Spotted Slime' }).first();
    await expect(spotted).toBeVisible();
    await spotted.click();
    await expect(page.locator('#pedigree')).toHaveValue('1');
    await expect(page.locator('#mate')).toHaveValue('13');
  });

  test('empty results show the active filters and a clear action (item 11)', async ({ page }) => {
    await page.goto(url() + '#species-index');
    await page.fill('#species-search', 'zzzz-not-a-species');
    const empty = page.locator('#species-rows .filter-empty');
    await expect(empty).toBeVisible();
    await expect(empty.locator('.filter-chip')).toContainText('Name: zzzz-not-a-species');
    await empty.locator('.filter-clear').click();
    await expect(page.locator('#species-search')).toHaveValue('');
    await expect(page.locator('#species-rows tr').first()).toBeVisible();

    await page.goto(url() + '#offspring-finder');
    await page.selectOption('#target', '2');
    await page.fill('#reverse-search', 'zzzz-not-a-parent');
    const pairEmpty = page.locator('#reverse-rows .filter-empty');
    await expect(pairEmpty).toBeVisible();
    await expect(pairEmpty).toContainText('Parent name: zzzz-not-a-parent');
    await pairEmpty.locator('.filter-clear').click();
    await expect(page.locator('#reverse-search')).toHaveValue('');
  });

  test('copy pairing writes a readable, labeled line (item 17)', async ({ page }) => {
    await page.goto(url() + '#pair-finder');
    const copy = page.locator('#copy-pairing');
    await expect(copy).toHaveAttribute('data-copy-text', /Winged Slime \(base result\)/);
    await copy.click();
    await expect(copy).toHaveAttribute('data-copy-text', /Pedigree Slime \+ Mate Dracky/);
    // A pair a conditional rule can change says so.
    await page.selectOption('#pedigree', '1');
    await page.selectOption('#mate', '1');
    await expect(copy).toHaveAttribute('data-copy-text', /base result; \+ rule gives Spotted King/);
  });

  test('wide breeding grids keep row and column labels pinned (item 12)', async ({ page }) => {
    await page.goto(url() + '#team-planner');
    await page.click('#planner-demo');
    await page.click('#planner-tab-breeding');
    await expect(page.locator('#planner-male-grid tbody th').first()).toBeVisible();
    const positions = await page.evaluate(() => ({
      head: getComputedStyle(document.querySelector('#planner-male-grid thead th')).position,
      row: getComputedStyle(document.querySelector('#planner-male-grid tbody th')).position,
    }));
    expect(positions.head).toBe('sticky');
    expect(positions.row).toBe('sticky');
  });

  test('one click files an unassigned team and its stabled monsters (switch fix)', async ({ page }) => {
    await page.goto(url() + '#team-planner');
    const file = page.locator('#planner-file-game');
    await expect(file).toBeVisible();
    await expect(file).toHaveText('File under DQM1');

    await addMonster(page, 11, 'male', 'party');
    await addMonster(page, 99, 'female', 'farm');
    await expect(page.locator('#planner-team-summary')).toContainText('1 party · 1 farm');

    // Switching games leaves an unassigned team visible, but the one-click
    // action files it (party and stabled monsters together) under that game.
    await page.click('#planner-game-dqm2');
    await expect(file).toHaveText('File under DQM2');
    await page.click('#planner-file-game');
    await expect(page.locator('#planner-message')).toContainText('filed under DQM2');
    await expect(page.locator('#planner-team-game')).toHaveValue('dqm2');
    await expect(file).toBeHidden();
    const stored = JSON.parse(await page.evaluate(key => localStorage.getItem(key), STATE_KEY));
    assert.equal(stored.activeGame, 'dqm2');
    assert.equal(stored.teams[0].game, 'dqm2');
    assert.deepEqual(stored.teams[0].entries.map(entry => entry.location), ['party', 'farm']);

    // DQM1 now has no team of its own: an empty one, then the filed roster
    // with its stabled monster comes back on the return trip.
    await page.click('#planner-game-dqm1');
    await expect(page.locator('#planner-females .planner-card')).toHaveCount(0);
    await page.click('#planner-game-dqm2');
    await expect(page.locator('#planner-males .planner-card-name')).toHaveText('Slime');
    await expect(page.locator('#planner-females > .planner-card-list').nth(1).locator('.planner-card-name')).toHaveText('Dracky');
  });
});
