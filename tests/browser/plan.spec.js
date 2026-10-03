const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

let serverUrl = null;

let STORAGE_KEY; let LEGACY_TEAM_KEY;
test.beforeAll(async () => {
  ({STATE_KEY: STORAGE_KEY, LEGACY_TEAM_KEY} = (await import('../helpers/keys.js')).default);
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

  // Seed the legacy team key so the app migrates a roster on first load.
  const seedTeam = async (page, entries) => {
    const team = {
      version: 1,
      game: 'dqm1-2-ps1-v61',
      entries: entries.map((e, i) => ({
        id: 'm-seed-' + i,
        speciesIndex: e.speciesIndex,
        sex: e.sex,
        plus: e.plus || 0,
        nickname: e.nickname || '',
      })),
    };
    await page.addInitScript(({ seed, key }) => {
      localStorage.setItem(key, JSON.stringify(seed));
    }, { seed: team, key: LEGACY_TEAM_KEY });
  };

  // Navigate to the suggestion by id, paging forward until it is visible.
  const useSuggestionById = async (page, suggestionId) => {
    const button = page.locator('button[data-suggestion-use="' + suggestionId + '"]');
    for (let i = 0; i < 60; i++) {
      if (await button.isVisible().catch(() => false)) break;
      const next = page.locator('#plan-suggestions-next');
      if (await next.isDisabled()) break;
      await next.click();
    }
    await button.click();
  };

  // The plan panel lives in the planner's Targets & plans tab. A reload
  // returns to that tab's view, but not to the tab itself.
  const openPlan = async (page) => {
    await page.click('#planner-nav-link');
    await page.click('#planner-tab-targets');
    await expect(page.locator('#planner-targets')).toBeVisible();
  };

  // Pin an offspring in Find parents, then take the "View plan" path into
  // the planner, where the target list and the plan are.
  const pinTarget = async (page, speciesIndex) => {
    await page.click('.nav a[href="#offspring-finder"]');
    await expect(page.locator('#offspring-finder')).toBeVisible();
    await page.selectOption('#target', String(speciesIndex));
    await page.click('#target-pin');
    await page.click('#target-view-plan');
    await expect(page.locator('#planner-targets')).toBeVisible();
  };

  // Find a node card by the exact species name shown in its own header.
  // Uses a direct child selector so a parent card does not match merely
  // because a descendant child card carries the name.
  const nodeCard = (page, name) =>
    page.locator('#plan-tree .plan-node').filter({ has: page.locator(':scope > .plan-node-header > .plan-node-name', { hasText: name }) }).first();

  const readStored = (page, key) => page.evaluate(k => localStorage.getItem(k), key);

  test('shows the empty plan state when no target is pinned', async ({ page }) => {
    await page.goto(url() + '#team-planner');
    await openPlan(page);
    await expect(page.locator('#plan-empty')).toBeVisible();
    await expect(page.locator('#plan-body')).toBeHidden();
  });

  test('pin a target, choose the top suggestion, and see the recipe with ordered parents and two children', async ({ page }) => {
    await page.goto(url() + '#offspring-finder');
    await pinTarget(page, 2); // Winged Slime
    await expect(page.locator('#plan-body')).toBeVisible();
    await expect(page.locator('#plan-tree .plan-node')).toHaveCount(1);

    // The top suggestion for Winged Slime is Drake Slime + Picky.
    await useSuggestionById(page, 'base:shrine:0:89');

    // The tree shows the recipe with parents in order and two child requirements.
    await expect(page.locator('#plan-tree .plan-node')).toHaveCount(3);
    const rootCard = page.locator('#plan-tree .plan-node').first();
    await expect(rootCard.locator('.plan-node-parents')).toContainText('Drake Slime');
    await expect(rootCard.locator('.plan-node-kind')).not.toHaveText('');

    const children = rootCard.locator('.plan-node-children .plan-node');
    await expect(children).toHaveCount(2);
    await expect(children.nth(0)).toContainText('Drake Slime');
    await expect(children.nth(0)).toContainText(/Pedigree/i);
    await expect(children.nth(1)).toContainText('Picky');
    await expect(children.nth(1)).toContainText(/Mate/i);
  });

  test('expand a child and reject a cycle-creating recipe', async ({ page }) => {
    await page.goto(url() + '#offspring-finder');
    await pinTarget(page, 2); // Winged Slime

    // Expand root with Drake Slime + Picky.
    await useSuggestionById(page, 'base:shrine:0:89');
    await expect(page.locator('#plan-tree .plan-node')).toHaveCount(3);

    // Expand Drake Slime through another recipe (Spotted Slime + Dragon Kid).
    const drakeCard = nodeCard(page, 'Drake Slime');
    await drakeCard.locator('button[data-node-choose]').click();
    await useSuggestionById(page, 'base:shrine:1:26');
    await expect(page.locator('#plan-tree .plan-node')).toHaveCount(5);

    // Attempt a recipe that would create a cycle: Spotted Slime + Drake Slime
    // (Drake Slime is already an ancestor of Spotted Slime).
    const spottedCard = nodeCard(page, 'Spotted Slime');
    await spottedCard.locator('button[data-node-choose]').click();
    await useSuggestionById(page, 'base:shrine:0:57');

    // The error is shown and the plan is unchanged.
    await expect(page.locator('#plan-message')).toContainText('cycle');
    await expect(page.locator('#plan-tree .plan-node')).toHaveCount(5);
  });

  test('status and note persist across reload', async ({ page }) => {
    await page.goto(url() + '#offspring-finder');
    await pinTarget(page, 2); // Winged Slime
    await useSuggestionById(page, 'base:shrine:0:89');
    await expect(page.locator('#plan-tree .plan-node')).toHaveCount(3);

    const rootCard = page.locator('#plan-tree .plan-node').first();
    const children = rootCard.locator('.plan-node-children .plan-node');
    const drakeCard = children.nth(0);
    const pickyCard = children.nth(1);

    await drakeCard.locator('select[data-node-status]').selectOption('ready');
    await drakeCard.locator('textarea[data-node-note]').fill('first step');
    await pickyCard.locator('select[data-node-status]').selectOption('completed');
    await pickyCard.locator('textarea[data-node-note]').fill('second step');
    // Blur so the note change events fire before reloading.
    await page.locator('#plan-heading').click();

    await page.reload();

    const rootCard2 = page.locator('#plan-tree .plan-node').first();
    const children2 = rootCard2.locator('.plan-node-children .plan-node');
    await expect(children2.nth(0).locator('select[data-node-status]')).toHaveValue('ready');
    await expect(children2.nth(0).locator('textarea[data-node-note]')).toHaveValue('first step');
    await expect(children2.nth(1).locator('select[data-node-status]')).toHaveValue('completed');
    await expect(children2.nth(1).locator('textarea[data-node-note]')).toHaveValue('second step');
  });

  test('roster links are hints and duplicate links warn; completing a node clears the warning', async ({ page }) => {
    await seedTeam(page, [
      { speciesIndex: 1, sex: 'male', plus: 0, nickname: 'Spottie' }, // Spotted Slime
    ]);
    await page.goto(url() + '#offspring-finder');
    await pinTarget(page, 17); // Spotted King

    // Expand with the plus recipe: Spotted Slime + Spotted Slime.
    await useSuggestionById(page, 'plus_threshold:shrine:1:1');
    await expect(page.locator('#plan-tree .plan-node')).toHaveCount(3);

    const rootCard = page.locator('#plan-tree .plan-node').first();
    const children = rootCard.locator('.plan-node-children .plan-node');
    const firstChild = children.nth(0);
    const secondChild = children.nth(1);

    // Link the roster entry to the first child.
    await firstChild.locator('select[data-node-roster]').selectOption('m-seed-0');

    // The roster hint appears and the status is unchanged.
    await expect(firstChild.locator('select[data-node-roster]')).toHaveValue('m-seed-0');
    await expect(firstChild.locator('select[data-node-status]')).toHaveValue('needed');

    // Link the same entry to the second child.
    await secondChild.locator('select[data-node-roster]').selectOption('m-seed-0');

    // The duplicate warning appears.
    await expect(page.locator('#plan-warnings')).not.toHaveText('');

    // Completing a node clears its usage.
    await firstChild.locator('select[data-node-status]').selectOption('completed');
    await expect(page.locator('#plan-warnings')).toHaveText('');
  });

  test('marking a node available ranks the available parent first in suggestions', async ({ page }) => {
    await page.goto(url() + '#offspring-finder');
    await pinTarget(page, 2); // Winged Slime
    const firstBefore = page.locator('#plan-suggestions button[data-suggestion-use]').first();
    await expect(firstBefore).toHaveAttribute('data-suggestion-use', 'base:shrine:0:89');

    // Build the route through Spotted Slime + Picky.
    await useSuggestionById(page, 'base:shrine:1:89');
    await expect(page.locator('#plan-tree .plan-node')).toHaveCount(3);

    // Return the suggestion pager to the first page.
    while (await page.locator('#plan-suggestions-prev').isEnabled()) {
      await page.locator('#plan-suggestions-prev').click();
    }

    // Mark Spotted Slime available without a roster link.
    const spotted = nodeCard(page, 'Spotted Slime');
    await spotted.locator('button[data-node-available]').click();

    // The suggestions now rank the available parent first.
    const firstAfter = page.locator('#plan-suggestions button[data-suggestion-use]').first();
    await expect(firstAfter).toHaveAttribute('data-suggestion-use', 'base:shrine:1:89');
  });

  test('replace a recipe keeps an unrelated branch and offers undo', async ({ page }) => {
    await page.goto(url() + '#offspring-finder');
    await pinTarget(page, 2); // Winged Slime
    await useSuggestionById(page, 'base:shrine:0:89');
    await expect(page.locator('#plan-tree .plan-node')).toHaveCount(3);

    const rootCard = page.locator('#plan-tree .plan-node').first();
    const children = rootCard.locator('.plan-node-children .plan-node');
    const drakeCard = children.nth(0);
    const pickyCard = children.nth(1);

    // Set a status and note on Picky (the unrelated branch).
    await pickyCard.locator('select[data-node-status]').selectOption('ready');
    await pickyCard.locator('textarea[data-node-note]').fill('keep this');
    await page.locator('#plan-heading').click();

    // Expand Drake Slime through another recipe.
    await drakeCard.locator('button[data-node-choose]').click();
    await useSuggestionById(page, 'base:shrine:1:26');
    await expect(page.locator('#plan-tree .plan-node')).toHaveCount(5);

    // Replace Drake Slime's recipe with Spotted Slime + species 27.
    const drakeCard2 = nodeCard(page, 'Drake Slime');
    await drakeCard2.locator('button[data-node-replace]').click();
    await expect(page.locator('#plan-replace-warning')).toBeVisible();
    await page.click('#plan-replace-confirm');
    await useSuggestionById(page, 'base:shrine:1:27');

    // The undo button is shown.
    await expect(page.locator('#plan-undo-recipe')).toBeVisible();

    // The unrelated branch keeps its status and note.
    const pickyCard2 = nodeCard(page, 'Picky');
    await expect(pickyCard2.locator('select[data-node-status]')).toHaveValue('ready');
    await expect(pickyCard2.locator('textarea[data-node-note]')).toHaveValue('keep this');

    // Undo restores the previous recipe and progress.
    await page.locator('#plan-undo-recipe').click();
    await expect(page.locator('#plan-undo-recipe')).toBeHidden();
    const drakeCard3 = nodeCard(page, 'Drake Slime');
    await expect(drakeCard3.locator('.plan-node-parents')).toContainText('Spotted Slime');
  });

  test('replacing a recipe refuses a cycle-creating recipe', async ({ page }) => {
    await page.goto(url() + '#offspring-finder');
    await pinTarget(page, 2);
    await useSuggestionById(page, 'base:shrine:0:89');
    const drake = nodeCard(page, 'Drake Slime');
    await drake.locator('button[data-node-choose]').click();
    await useSuggestionById(page, 'base:shrine:1:26');
    await expect(page.locator('#plan-tree .plan-node')).toHaveCount(5);

    // Drake Slime + Drake Slime would make Drake Slime its own ancestor.
    const drake2 = nodeCard(page, 'Drake Slime');
    await drake2.locator('button[data-node-replace]').click();
    await page.click('#plan-replace-confirm');
    await useSuggestionById(page, 'base:shrine:0:0');
    await expect(page.locator('#plan-message')).toContainText('cycle');
    await expect(page.locator('#plan-tree .plan-node')).toHaveCount(5);
  });

  test('a stale suggestion cannot replace a branch without confirmation', async ({ page }) => {
    await page.goto(url() + '#offspring-finder');
    await pinTarget(page, 2);
    await useSuggestionById(page, 'base:shrine:0:89');
    await expect(page.locator('#plan-tree .plan-node')).toHaveCount(3);

    // The suggestions still target the expanded root; clicking another one
    // would remove its branch, so it must warn first.
    await useSuggestionById(page, 'base:shrine:0:90');
    await expect(page.locator('#plan-replace-warning')).toBeVisible();
    await expect(page.locator('#plan-tree .plan-node')).toHaveCount(3);
    const parents = page.locator('#plan-tree .plan-node').first().locator(':scope > .plan-node-recipe > .plan-node-parents');
    await expect(parents).toContainText('Drake Slime');

    await page.click('#plan-replace-confirm');
    await expect(page.locator('#plan-replace-warning')).toBeHidden();
    await expect(parents).not.toContainText('Picky');
    await expect(page.locator('#plan-tree .plan-node')).toHaveCount(3);
  });

  test('a replacement can be cancelled and keeps the branch', async ({ page }) => {
    await page.goto(url() + '#offspring-finder');
    await pinTarget(page, 2);
    await useSuggestionById(page, 'base:shrine:0:89');
    const drake = nodeCard(page, 'Drake Slime');
    await drake.locator('button[data-node-choose]').click();
    await useSuggestionById(page, 'base:shrine:1:26');
    await expect(page.locator('#plan-tree .plan-node')).toHaveCount(5);

    const drake2 = nodeCard(page, 'Drake Slime');
    await drake2.locator('button[data-node-replace]').click();
    await expect(page.locator('#plan-replace-warning')).toBeVisible();
    await expect(page.locator('#plan-replace-warning-text')).toContainText(/remove|depend/i);
    await page.click('#plan-replace-cancel');
    await expect(page.locator('#plan-replace-warning')).toBeHidden();
    await expect(page.locator('#plan-tree .plan-node')).toHaveCount(5);
    await expect(nodeCard(page, 'Drake Slime').locator('.plan-node-parents')).toContainText('Spotted Slime + Mate Dragon Kid');
    await expect(page.locator('#plan-message')).not.toHaveText('');
  });

  test('status changes and collapse return focus to the node', async ({ page }) => {
    await page.goto(url() + '#offspring-finder');
    await pinTarget(page, 2);
    await useSuggestionById(page, 'base:shrine:0:89');
    const rootCard = page.locator('#plan-tree .plan-node').first();
    const status = rootCard.locator(':scope > select[data-node-status]');
    await status.selectOption('ready');
    await expect(status).toBeFocused();

    await rootCard.locator('button[data-node-collapse]').click();
    await expect(page.locator('#plan-tree .plan-node').first().locator(':scope > select[data-node-status]')).toBeFocused();
  });

  test('room recipes appear only in the room context', async ({ page }) => {
    await page.goto(url() + '#offspring-finder');
    await pinTarget(page, 19); // Angel Slime

    // In shrine context, the top suggestion is a base recipe.
    const firstShrine = page.locator('#plan-suggestions button[data-suggestion-use]').first();
    await expect(firstShrine).toHaveAttribute('data-suggestion-use', 'base:shrine:11:222');

    // Switch to the room context.
    await page.locator('#plan-context').selectOption('room');

    // The room recipe now appears first.
    const firstRoom = page.locator('#plan-suggestions button[data-suggestion-use]').first();
    await expect(firstRoom).toHaveAttribute('data-suggestion-use', 'flag_gated:room:13:family7');

    // Switch back to shrine.
    await page.locator('#plan-context').selectOption('shrine');
    const firstShrine2 = page.locator('#plan-suggestions button[data-suggestion-use]').first();
    await expect(firstShrine2).toHaveAttribute('data-suggestion-use', 'base:shrine:11:222');
  });

  test('base recipes show the unknown caveat and plus recipes show the required +N condition', async ({ page }) => {
    await page.goto(url() + '#offspring-finder');
    await pinTarget(page, 2); // Winged Slime
    await useSuggestionById(page, 'base:shrine:0:89');

    // The base recipe shows the unknown caveat.
    const rootCard = page.locator('#plan-tree .plan-node').first();
    await expect(rootCard.locator('.plan-node-unknowns').first()).not.toHaveText('');

    // Pin Spotted King and expand with the plus recipe.
    await pinTarget(page, 17); // Spotted King
    await useSuggestionById(page, 'plus_threshold:shrine:1:1');

    // The plus recipe shows the required +N condition.
    const rootCard2 = page.locator('#plan-tree .plan-node').first();
    await expect(rootCard2.locator('.plan-node-condition')).toContainText(/\+4/);
    await expect(rootCard2.locator('.plan-node-unknowns').last()).toContainText(/zero/);
  });

  test('full backup round trip restores the plan, statuses, notes, and roster links', async ({ page }) => {
    await seedTeam(page, [
      { speciesIndex: 0, sex: 'male', plus: 0, nickname: 'Drake' }, // Drake Slime
    ]);
    await page.goto(url() + '#offspring-finder');
    await pinTarget(page, 2); // Winged Slime
    await useSuggestionById(page, 'base:shrine:0:89');
    await expect(page.locator('#plan-tree .plan-node')).toHaveCount(3);

    const rootCard = page.locator('#plan-tree .plan-node').first();
    const children = rootCard.locator('.plan-node-children .plan-node');
    const drakeCard = children.nth(0);
    const pickyCard = children.nth(1);

    // Set statuses and notes.
    await drakeCard.locator('select[data-node-status]').selectOption('ready');
    await drakeCard.locator('textarea[data-node-note]').fill('breed first');
    await pickyCard.locator('select[data-node-status]').selectOption('needed');
    await pickyCard.locator('textarea[data-node-note]').fill('find a Picky');
    await page.locator('#plan-heading').click();

    // Link the roster entry to Drake Slime.
    await drakeCard.locator('select[data-node-roster]').selectOption('m-seed-0');

    // Export the full backup from the My monsters tab of the team planner.
    await page.click('#planner-nav-link');
    await page.click('#planner-tab-roster');
    if (!(await page.locator('#planner-data-tools').evaluate(el => el.open))) {
      await page.locator('#planner-data-tools > summary').click();
    }
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#planner-backup-export'),
    ]);
    assert.equal(download.suggestedFilename(), 'DQM-guide-backup-v61.json');
    const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    assert.equal(exported.teams[0].targets.length, 1);
    assert.equal(exported.teams[0].targets[0].plan.nodes.length, 3);

    // Change the current document so the replace is observable.
    await page.click('#planner-nav-link');
    await page.selectOption('#planner-add-species', '11');
    await page.click('#planner-add-button');
    await expect(page.locator('#planner-males .planner-card')).toHaveCount(2);

    // Reimport the backup.
    const tmp = path.join(os.tmpdir(), 'dqm-guide-backup-plan-test.json');
    fs.writeFileSync(tmp, JSON.stringify(exported));
    if (!(await page.locator('#planner-data-tools').evaluate(el => el.open))) {
      await page.locator('#planner-data-tools > summary').click();
    }
    await page.setInputFiles('#planner-backup-import', tmp);
    await expect(page.locator('#planner-import-preview')).toBeVisible();
    await page.click('#planner-import-confirm');

    // The plan, statuses, notes, and roster links are restored.
    await openPlan(page);
    const rootCard2 = page.locator('#plan-tree .plan-node').first();
    const children2 = rootCard2.locator('.plan-node-children .plan-node');
    await expect(children2.nth(0).locator('select[data-node-status]')).toHaveValue('ready');
    await expect(children2.nth(0).locator('textarea[data-node-note]')).toHaveValue('breed first');
    await expect(children2.nth(0).locator('select[data-node-roster]')).toHaveValue('m-seed-0');
    await expect(children2.nth(1).locator('select[data-node-status]')).toHaveValue('needed');
    await expect(children2.nth(1).locator('textarea[data-node-note]')).toHaveValue('find a Picky');
  });

  test('node controls have accessible names and the suggestion pager is keyboard operable', async ({ page }) => {
    await page.goto(url() + '#offspring-finder');
    await pinTarget(page, 2); // Winged Slime

    // Node controls have accessible names.
    const rootCard = page.locator('#plan-tree .plan-node').first();
    await expect(rootCard.locator('select[data-node-status]')).toHaveAttribute('aria-label', 'Status for Winged Slime');
    await expect(rootCard.locator('textarea[data-node-note]')).toHaveAttribute('aria-label', 'Note for Winged Slime');

    // Plan steps are operable from the keyboard: Enter opens the suggestions.
    const choose = rootCard.locator('button[data-node-choose]');
    await choose.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#plan-suggestions-for')).toContainText('Recipe options for Winged Slime');
    await page.locator('#plan-suggestions-clear').click();

    // The summary announces via role="status".
    await expect(page.locator('#plan-summary')).toHaveAttribute('role', 'status');
    await expect(page.locator('#plan-mismatch')).toHaveAttribute('role', 'alert');

    // Expand to get children with roster selects.
    await useSuggestionById(page, 'base:shrine:0:89');
    const drakeCard = nodeCard(page, 'Drake Slime');
    await expect(drakeCard.locator('select[data-node-roster]')).toHaveAttribute('aria-label', 'Link roster entry for Drake Slime');

    // The suggestion pager is operable by keyboard.
    const nextButton = page.locator('#plan-suggestions-next');
    await nextButton.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('#plan-suggestions-page')).toContainText('Page 2');
  });

  test('a structurally invalid plan does not crash the page and offers a clear control', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(key => {
      const doc = {
        version: 1,
        game: 'dqm1-2-ps1-v61',
        spriteStyle: 'portrait',
        favoriteSpeciesIndices: [],
        activeTeamId: 'team-1',
        teams: [{
          id: 'team-1',
          name: 'Test Team',
          entries: [],
          activeTargetId: 't-bad',
          targets: [{
            id: 't-bad',
            speciesIndex: 2,
            plan: {
              speciesIndex: 2,
              context: 'shrine',
              rootId: 'n0',
              nodes: [
                { id: 'n0', speciesIndex: 2, recipe: null, fulfillment: { choice: 'recipe', rosterEntryId: null }, status: 'needed', note: '', children: null, parent: null },
                { id: 'n0', speciesIndex: 11, recipe: null, fulfillment: { choice: 'recipe', rosterEntryId: null }, status: 'needed', note: '', children: null, parent: null }
              ]
            }
          }]
        }]
      };
      localStorage.setItem(key, JSON.stringify(doc));
    }, STORAGE_KEY);
    await page.goto(url() + '#team-planner');
    await openPlan(page);

    // The page does not crash and shows a message with a clear control.
    await expect(page.locator('#plan-mismatch')).toBeVisible();
    await expect(page.locator('#plan-mismatch')).not.toHaveText('');
    await expect(page.locator('#plan-clear')).toBeVisible();

    // Typing a note on an unreadable plan must not throw or lose data.
    await page.locator('#plan-tree .plan-node').first().locator(':scope > textarea[data-node-note]').fill('typed on a broken plan');
    assert.deepEqual(errors, []);

    // Clearing the plan starts fresh.
    await page.locator('#plan-clear').click();
    await expect(page.locator('#plan-mismatch')).toBeHidden();
    await expect(page.locator('#plan-tree .plan-node')).toHaveCount(1);
  });

  test('switching a room plan to shrine flags the recipe without offering to delete it', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url() + '#offspring-finder');
    await pinTarget(page, 19); // Angel Slime
    await page.selectOption('#plan-context', 'room');
    await useSuggestionById(page, 'flag_gated:room:13:family7');
    await expect(page.locator('#plan-tree .plan-node')).toHaveCount(3);

    const rootCard = page.locator('#plan-tree .plan-node').first();
    await rootCard.locator(':scope > textarea[data-node-note]').fill('keep me');
    await page.locator('#plan-heading').click();

    // The family-wildcard mate cannot be expanded and must not crash the page.
    const mateCard = rootCard.locator('.plan-node-children .plan-node').nth(1);
    await expect(mateCard.locator('.plan-node-hint')).toBeVisible();
    await expect(mateCard.locator('button[data-node-choose]')).toHaveCount(0);
    assert.deepEqual(errors, []);

    // Switching to shrine flags the stored room recipe.
    await page.selectOption('#plan-context', 'shrine');
    await expect(page.locator('#plan-tree .plan-node')).toHaveCount(3);
    await expect(page.locator('#plan-mismatch')).toBeVisible();
    await expect(page.locator('#plan-clear')).toBeHidden();
    const rootAfter = page.locator('#plan-tree .plan-node').first();
    await expect(rootAfter).toHaveClass(/is-incompatible/);
    await expect(rootAfter.locator('.plan-node-incompatible')).toContainText(/does not apply/i);
    await expect(rootAfter.locator(':scope > textarea[data-node-note]')).toHaveValue('keep me');

    // Switching back clears the flag and keeps the progress.
    await page.selectOption('#plan-context', 'room');
    await expect(page.locator('#plan-mismatch')).toBeHidden();
    await expect(page.locator('#plan-tree .plan-node')).toHaveCount(3);
    await expect(page.locator('#plan-tree .plan-node').first().locator(':scope > textarea[data-node-note]')).toHaveValue('keep me');
  });

  test.describe('broken-plan backup imports', () => {
    const base = () => ({
      version: 1, game: 'dqm1-2-ps1-v61', spriteStyle: 'portrait',
      favoriteSpeciesIndices: [], activeTeamId: 't-1',
    });
    const node = over => ({
      recipe: null, fulfillment: { choice: 'recipe', rosterEntryId: null },
      status: 'needed', note: '', children: null, parent: null, ...over,
    });

    // Duplicate node IDs make the plan unreadable.
    const duplicateIds = {
      ...base(),
      teams: [{
        id: 't-1', name: 'Bad', entries: [], activeTargetId: 'tg-1',
        targets: [{
          id: 'tg-1', speciesIndex: 2,
          plan: {
            speciesIndex: 2, context: 'shrine', rootId: 'n0',
            nodes: [
              node({ id: 'n0', speciesIndex: 2 }),
              node({ id: 'n0', speciesIndex: 11 }),
            ],
          },
        }],
      }],
    };

    // A structurally broken plan that also carries a flagged (recoverable)
    // recipe must still be rejected: a flag never bypasses validation.
    const flaggedAndBroken = {
      ...base(),
      teams: [{
        id: 't-1', name: 'Bad', entries: [], activeTargetId: 'tg-1',
        targets: [{
          id: 'tg-1', speciesIndex: 19,
          plan: {
            speciesIndex: 19, context: 'shrine', rootId: 'n0',
            nodes: [
              node({ id: 'n0', speciesIndex: 19, recipe: { parents: [13, null], kind: 'flag_gated', context: 'room', condition: '', minPlus: null }, children: ['n1', 'n2'] }),
              node({ id: 'n1', speciesIndex: 13, parent: 'n0' }),
              node({ id: 'n2', speciesIndex: null, parent: 'n0' }),
              node({ id: 'n0', speciesIndex: 19 }),
            ],
          },
        }],
      }],
    };

    // The plan describes a different species than its target.
    const wrongSpecies = {
      ...base(),
      teams: [{
        id: 't-1', name: 'Wrong', entries: [], activeTargetId: 'tg-1',
        targets: [{
          id: 'tg-1', speciesIndex: 2,
          plan: {
            speciesIndex: 17, context: 'shrine', rootId: 'n0',
            nodes: [node({ id: 'n0', speciesIndex: 17 })],
          },
        }],
      }],
    };

    // Each case needs a fresh page so an earlier rejection cannot satisfy
    // its assertions while this file is still being read.
    for (const [name, bad] of [['duplicate-ids', duplicateIds], ['flagged', flaggedAndBroken], ['wrong-species', wrongSpecies]]) {
      test(`${name} is rejected and leaves the document intact`, async ({ page }) => {
        await page.goto(url() + '#team-planner');
        await page.selectOption('#planner-add-species', '11');
        await page.click('#planner-add-button');
        await expect(page.locator('#planner-males .planner-card')).toHaveCount(1);
        const before = await readStored(page, STORAGE_KEY);

        await page.locator('#planner-data-tools > summary').click();
        await expect(page.locator('#planner-backup-message')).toHaveText('');
        await page.setInputFiles('#planner-backup-import', {
          name: `${name}.json`,
          mimeType: 'application/json',
          buffer: Buffer.from(JSON.stringify(bad)),
        });

        await expect(page.locator('#planner-backup-message')).toContainText('Import failed');
        await expect(page.locator('#planner-backup-import')).toHaveValue('');
        await expect(page.locator('#planner-import-preview')).toBeHidden();
        assert.equal(await readStored(page, STORAGE_KEY), before);
        await expect(page.locator('#planner-males .planner-card')).toHaveCount(1);
      });
    }
  });

  test('plans are independent per target', async ({ page }) => {
    await page.goto(url() + '#offspring-finder');
    await pinTarget(page, 2); // Winged Slime
    await useSuggestionById(page, 'base:shrine:0:89');
    await expect(page.locator('#plan-tree .plan-node')).toHaveCount(3);

    await pinTarget(page, 17); // Spotted King becomes active
    await expect(page.locator('#plan-tree .plan-node')).toHaveCount(1);
    await expect(page.locator('#plan-tree .plan-node').first().locator(':scope > .plan-node-header > .plan-node-name')).toHaveText('Spotted King');

    await page.locator('#target-list .target-item').filter({ hasText: 'Winged Slime' }).locator('button[data-target-switch]').click();
    await expect(page.locator('#plan-tree .plan-node')).toHaveCount(3);
    await expect(page.locator('#plan-tree .plan-node').first().locator(':scope > .plan-node-recipe > .plan-node-parents')).toContainText('Drake Slime');

    const doc = JSON.parse(await readStored(page, STORAGE_KEY));
    const wing = doc.teams[0].targets.find(t => t.speciesIndex === 2);
    const king = doc.teams[0].targets.find(t => t.speciesIndex === 17);
    assert.equal(wing.plan.nodes.length, 3);
    assert.equal(king.plan.nodes.length, 1);
    assert.notEqual(wing.plan.rootId, king.plan.rootId);
  });

  test('a plan change is a single saved write and viewing writes nothing', async ({ page }) => {
    await page.goto(url() + '#offspring-finder');
    await pinTarget(page, 2);
    await useSuggestionById(page, 'base:shrine:0:89');
    await page.evaluate(() => {
      window.__writes = 0;
      const original = localStorage.setItem.bind(localStorage);
      localStorage.setItem = (...args) => { window.__writes += 1; return original(...args); };
    });

    const child = page.locator('#plan-tree .plan-node').first().locator('.plan-node-children .plan-node').first();
    await child.locator('select[data-node-status]').selectOption('ready');
    assert.equal(await page.evaluate(() => window.__writes), 1);

    await page.locator('#plan-suggestions-next').click();
    assert.equal(await page.evaluate(() => window.__writes), 1);
  });

  test('node and suggestion actions have descriptive accessible names', async ({ page }) => {
    await page.goto(url() + '#offspring-finder');
    await pinTarget(page, 2);
    const firstSuggestion = page.locator('#plan-suggestions button[data-suggestion-use]').first();
    await expect(firstSuggestion).toHaveAttribute('aria-label', /^Use recipe: Pedigree .+ \+ Mate .+/);
    const rootCard = page.locator('#plan-tree .plan-node').first();
    await expect(rootCard.locator('button[data-node-choose]')).toHaveAttribute('aria-label', 'Choose recipe for Winged Slime');
    await expect(rootCard.locator('button[data-node-available]')).toHaveAttribute('aria-label', 'Mark Winged Slime available without a roster link');
  });

  test('suggestion buttons for twin forms have unique accessible names', async ({ page }) => {
    await page.goto(url() + '#offspring-finder');
    await pinTarget(page, 9); // King Slime: two Dragonlord forms on the first page
    const labels = await page.locator('#plan-suggestions button[data-suggestion-use]')
      .evaluateAll(buttons => buttons.map(button => button.getAttribute('aria-label')));
    assert.ok(labels.length > 1);
    assert.equal(new Set(labels).size, labels.length);
  });

  test('expanding a plan after reload keeps node ids unique', async ({ page }) => {
    await page.goto(url() + '#offspring-finder');
    await pinTarget(page, 2);
    await useSuggestionById(page, 'base:shrine:0:89');
    await expect(page.locator('#plan-tree .plan-node')).toHaveCount(3);

    await page.reload();
    await openPlan(page);
    await expect(page.locator('#plan-tree .plan-node')).toHaveCount(3);

    const drake = nodeCard(page, 'Drake Slime');
    await drake.locator('button[data-node-choose]').click();
    await useSuggestionById(page, 'base:shrine:1:26');
    await expect(page.locator('#plan-tree .plan-node')).toHaveCount(5);
    await expect(page.locator('#plan-message')).toContainText('Drake Slime');
  });

  test('a note typed without blurring persists across a reload', async ({ page }) => {
    await page.goto(url() + '#offspring-finder');
    await pinTarget(page, 2);
    await useSuggestionById(page, 'base:shrine:0:89');
    const rootCard = page.locator('#plan-tree .plan-node').first();
    await rootCard.locator(':scope > textarea[data-node-note]').fill('no blur');

    await page.reload();
    await openPlan(page);
    await expect(page.locator('#plan-tree .plan-node').first().locator(':scope > textarea[data-node-note]')).toHaveValue('no blur');

    // Blurring normalizes the box to the stored, trimmed value.
    const note = page.locator('#plan-tree .plan-node').first().locator(':scope > textarea[data-node-note]');
    await note.fill('  spaced  ');
    await page.locator('#plan-heading').click();
    await expect(note).toHaveValue('spaced');
  });

  test('a base recipe superseded by a room override is flagged in the room context', async ({ page }) => {
    await page.goto(url() + '#offspring-finder');
    await pinTarget(page, 2);
    await useSuggestionById(page, 'base:shrine:11:101');
    await expect(page.locator('#plan-mismatch')).toBeHidden();

    await page.selectOption('#plan-context', 'room');
    await expect(page.locator('#plan-mismatch')).toBeVisible();
    await expect(page.locator('#plan-mismatch')).toContainText(/Breeding room/i);
    await expect(page.locator('#plan-clear')).toBeHidden();
    await expect(page.locator('#plan-tree .plan-node').first()).toHaveClass(/is-incompatible/);
    await expect(page.locator('#plan-tree .plan-node')).toHaveCount(3);
  });

  test('a family-wildcard room override flags a base recipe in the room context', async ({ page }) => {
    await page.goto(url() + '#offspring-finder');
    await pinTarget(page, 6); // Bubble Slime
    await useSuggestionById(page, 'base:shrine:13:199'); // Healer Slime + Ghost
    await expect(page.locator('#plan-mismatch')).toBeHidden();

    await page.selectOption('#plan-context', 'room');
    await expect(page.locator('#plan-mismatch')).toContainText(/Breeding room/i);
    await expect(page.locator('#plan-clear')).toBeHidden();
    await expect(page.locator('#plan-tree .plan-node').first()).toHaveClass(/is-incompatible/);
  });

  test('switching a base plan to the room context keeps it usable without a clear', async ({ page }) => {
    await page.goto(url() + '#offspring-finder');
    await pinTarget(page, 2);
    await useSuggestionById(page, 'base:shrine:0:89');
    await page.selectOption('#plan-context', 'room');
    await expect(page.locator('#plan-mismatch')).toBeHidden();
    await expect(page.locator('#plan-clear')).toBeHidden();
    await expect(page.locator('#plan-tree .plan-node')).toHaveCount(3);
    await expect(page.locator('#plan-tree .plan-node').first().locator(':scope > .plan-node-recipe > .plan-node-context')).toContainText(/Breeding room/i);
  });

  test('a stored plan for a different species is flagged on load', async ({ page }) => {
    const doc = {
      version: 1, game: 'dqm1-2-ps1-v61', spriteStyle: 'portrait', favoriteSpeciesIndices: [], activeTeamId: 't-1',
      teams: [{
        id: 't-1', name: 'Wrong', entries: [], activeTargetId: 'tg-1',
        targets: [{
          id: 'tg-1', speciesIndex: 2,
          plan: {
            speciesIndex: 17, context: 'shrine', rootId: 'n0',
            nodes: [{ id: 'n0', speciesIndex: 17, recipe: null, fulfillment: { choice: 'recipe', rosterEntryId: null }, status: 'needed', note: '', children: null, parent: null }],
          },
        }],
      }],
    };
    await page.addInitScript(({ key, doc }) => localStorage.setItem(key, JSON.stringify(doc)), { key: STORAGE_KEY, doc });
    await page.goto(url() + '#team-planner');
    await openPlan(page);

    await expect(page.locator('#plan-body')).toBeVisible();
    await expect(page.locator('#plan-mismatch')).toBeVisible();
    await expect(page.locator('#plan-mismatch')).toContainText('could not be read');
    await expect(page.locator('#plan-clear')).toBeVisible();
  });
});
