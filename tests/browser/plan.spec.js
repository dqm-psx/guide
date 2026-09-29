const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FILE_URL = 'file://' + path.join(REPO_ROOT, 'index.html');
let serverUrl = null;

const STORAGE_KEY = 'dqm-guide-state-v61-v1';
const LEGACY_TEAM_KEY = 'dqm-guide-team-v61-v1';

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
      await page.addInitScript(seed => {
        localStorage.setItem('dqm-guide-team-v61-v1', JSON.stringify(seed));
      }, team);
    };

    // Navigate to the suggestion by id, paging forward until it is visible.
    const useSuggestionById = async (page, suggestionId) => {
      const button = page.locator('button[data-suggestion-use="' + suggestionId + '"]');
      for (let i = 0; i < 20; i++) {
        if (await button.isVisible().catch(() => false)) break;
        const next = page.locator('#plan-suggestions-next');
        if (await next.isDisabled()) break;
        await next.click();
      }
      await button.click();
    };

    const pinTarget = async (page, speciesIndex) => {
      await page.selectOption('#target', String(speciesIndex));
      await page.click('#target-pin');
    };

    // Find a node card by the exact species name shown in its own header.
    // Uses a direct child selector so a parent card does not match merely
    // because a descendant child card carries the name.
    const nodeCard = (page, name) =>
      page.locator('#plan-tree .plan-node').filter({ has: page.locator(':scope > .plan-node-header > .plan-node-name', { hasText: name }) }).first();

    const readStored = (page, key) => page.evaluate(k => localStorage.getItem(k), key);

    test('shows the empty plan state when no target is pinned', async ({ page }) => {
      await page.goto(url());
      await expect(page.locator('#plan-empty')).toBeVisible();
      await expect(page.locator('#plan-body')).toBeHidden();
    });

    test('pin a target, choose the top suggestion, and see the recipe with ordered parents and two children', async ({ page }) => {
      await page.goto(url());
      await pinTarget(page, 2); // Winged Slime
      await expect(page.locator('#plan-body')).toBeVisible();
      await expect(page.locator('#plan-tree .plan-node')).toHaveCount(1);

      // The top suggestion for Winged Slime is Drake Slime + Picky.
      await useSuggestionById(page, 'base:shrine:0:89');

      // The tree shows the recipe with parents in order and two child requirements.
      await expect(page.locator('#plan-tree .plan-node')).toHaveCount(3);
      const rootCard = page.locator('#plan-tree .plan-node').first();
      await expect(rootCard.locator('.plan-node-parents')).toContainText('Pedigree Drake Slime + Mate Picky');
      await expect(rootCard.locator('.plan-node-kind')).toHaveText('Base result');

      const children = rootCard.locator('.plan-node-children .plan-node');
      await expect(children).toHaveCount(2);
      await expect(children.nth(0)).toContainText('Drake Slime');
      await expect(children.nth(0)).toContainText('Pedigree');
      await expect(children.nth(1)).toContainText('Picky');
      await expect(children.nth(1)).toContainText('Mate');
    });

    test('expand a child and reject a cycle-creating recipe', async ({ page }) => {
      await page.goto(url());
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
      await page.goto(url());
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
      await page.goto(url());
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
      await expect(page.locator('#plan-warnings')).toContainText('needed by more than one unfinished step');

      // Completing a node clears its usage.
      await firstChild.locator('select[data-node-status]').selectOption('completed');
      await expect(page.locator('#plan-warnings')).toHaveText('');
    });

    test('marking a node available ranks the available parent first in suggestions', async ({ page }) => {
      await page.goto(url());
      await pinTarget(page, 2); // Winged Slime
      await useSuggestionById(page, 'base:shrine:0:89');
      await expect(page.locator('#plan-tree .plan-node')).toHaveCount(3);

      // Mark Drake Slime as available without a roster link.
      const drakeCard = nodeCard(page, 'Drake Slime');
      await drakeCard.locator('button[data-node-available]').click();

      // The suggestions for the target now rank the available parent first.
      const firstSuggestion = page.locator('#plan-suggestions button[data-suggestion-use]').first();
      await expect(firstSuggestion).toHaveAttribute('data-suggestion-use', 'base:shrine:0:89');
    });

    test('replace a recipe keeps an unrelated branch and offers undo', async ({ page }) => {
      await page.goto(url());
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
      await expect(drakeCard3.locator('.plan-node-parents')).toContainText('Pedigree Spotted Slime + Mate Dragon Kid');
    });

    test('room recipes appear only in the room context', async ({ page }) => {
      await page.goto(url());
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
      await page.goto(url());
      await pinTarget(page, 2); // Winged Slime
      await useSuggestionById(page, 'base:shrine:0:89');

      // The base recipe shows the unknown caveat.
      const rootCard = page.locator('#plan-tree .plan-node').first();
      await expect(rootCard.locator('.plan-node-unknowns').first()).toContainText('Acquisition, offspring sex, inherited + value, and breeding eligibility are not established by this table.');

      // Pin Spotted King and expand with the plus recipe.
      await pinTarget(page, 17); // Spotted King
      await useSuggestionById(page, 'plus_threshold:shrine:1:1');

      // The plus recipe shows the required +N condition.
      const rootCard2 = page.locator('#plan-tree .plan-node').first();
      await expect(rootCard2.locator('.plan-node-condition')).toContainText('Either parent +4 or higher');
    });

    test('full backup round trip restores the plan, statuses, notes, and roster links', async ({ page }) => {
      await seedTeam(page, [
        { speciesIndex: 0, sex: 'male', plus: 0, nickname: 'Drake' }, // Drake Slime
      ]);
      await page.goto(url());
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

      // Export the full backup from the team planner.
      await page.click('#planner-nav-link');
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
      await page.setInputFiles('#planner-backup-import', tmp);
      await expect(page.locator('#planner-import-preview')).toBeVisible();
      await page.click('#planner-import-confirm');

      // The plan, statuses, notes, and roster links are restored.
      await page.evaluate(() => { location.hash = 'offspring-finder'; });
      const rootCard2 = page.locator('#plan-tree .plan-node').first();
      const children2 = rootCard2.locator('.plan-node-children .plan-node');
      await expect(children2.nth(0).locator('select[data-node-status]')).toHaveValue('ready');
      await expect(children2.nth(0).locator('textarea[data-node-note]')).toHaveValue('breed first');
      await expect(children2.nth(0).locator('select[data-node-roster]')).toHaveValue('m-seed-0');
      await expect(children2.nth(1).locator('select[data-node-status]')).toHaveValue('needed');
      await expect(children2.nth(1).locator('textarea[data-node-note]')).toHaveValue('find a Picky');
    });

    test('node controls have accessible names and the suggestion pager is keyboard operable', async ({ page }) => {
      await page.goto(url());
      await pinTarget(page, 2); // Winged Slime

      // Node controls have accessible names.
      const rootCard = page.locator('#plan-tree .plan-node').first();
      await expect(rootCard.locator('select[data-node-status]')).toHaveAttribute('aria-label', 'Status for Winged Slime');
      await expect(rootCard.locator('textarea[data-node-note]')).toHaveAttribute('aria-label', 'Note for Winged Slime');

      // The summary announces via role="status".
      await expect(page.locator('#plan-summary')).toHaveAttribute('role', 'status');

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
      await page.goto(url());

      // The page does not crash and shows a message with a clear control.
      await expect(page.locator('#plan-mismatch')).toBeVisible();
      await expect(page.locator('#plan-mismatch')).toContainText('could not be read');
      await expect(page.locator('#plan-clear')).toBeVisible();

      // Clearing the plan starts fresh.
      await page.locator('#plan-clear').click();
      await expect(page.locator('#plan-mismatch')).toBeHidden();
      await expect(page.locator('#plan-tree .plan-node')).toHaveCount(1);
    });
  });
}
