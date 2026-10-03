const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

let serverUrl = null;

let STATE_KEY; let LEGACY_TEAM_KEY; let SPRITE_KEY;
test.beforeAll(async () => {
  ({STATE_KEY, LEGACY_TEAM_KEY, LEGACY_SPRITE_KEY: SPRITE_KEY} = (await import('../helpers/keys.js')).default);
});

test.beforeAll(async () => {
  const { startGuideServer } = await import('../helpers/modes');
  serverUrl = await startGuideServer();
});

test.afterAll(async () => {
  const { stopGuideServer } = await import('../helpers/modes');
  await stopGuideServer();
});

const legacyTeam = () => ({
  version: 1,
  game: 'dqm1-2-ps1-v61',
  entries: [
    { id: 'm-seed-1', speciesIndex: 11, sex: 'male', plus: 0, nickname: '' },
    { id: 'm-seed-2', speciesIndex: 99, sex: 'female', plus: 2, nickname: 'Drake' },
  ],
});

const readStored = (page, key) => page.evaluate(k => localStorage.getItem(k), key);

// Teams are filed under the game being viewed, so the select renders optgroups:
// the active game's teams first, unassigned teams second. Option order is
// therefore not creation order, which makes flat indexes unsafe to select on.
const expectTeamGroups = async (select, expected) =>
  assert.deepEqual(await select.evaluate(node => [...node.querySelectorAll('optgroup')]
    .map(group => [group.label, [...group.querySelectorAll('option')].map(option => option.textContent)])), expected);

const addMonster = async (page, speciesIndex) => {
  await page.selectOption('#planner-add-species', String(speciesIndex));
  await page.click('#planner-add-button');
};

// Served mode: the page under /guide/, the way GitHub Pages mounts it.
// The file:// contract is pinned by tests/browser/file-mode.spec.js.
test.describe('served', () => {
  const url = () => serverUrl;

  test('first load migrates the legacy team and sprite keys without changing them', async ({ page }) => {
    const team = legacyTeam();
    await page.addInitScript(({ teamKey, spriteKey, team, sprite }) => {
      localStorage.setItem(teamKey, JSON.stringify(team));
      localStorage.setItem(spriteKey, sprite);
    }, { teamKey: LEGACY_TEAM_KEY, spriteKey: SPRITE_KEY, team, sprite: 'overworld' });
    await page.goto(url() + '#team-planner');
    await expect(page.locator('#planner-males .planner-card')).toHaveCount(1);
    await expect(page.locator('#planner-females .planner-card')).toHaveCount(1);
    await expect(page.locator('#planner-males .planner-card-name')).toHaveText('Slime');
    await expect(page.locator('#planner-females .planner-card-name')).toHaveText('Drake');
    const stored = JSON.parse(await readStored(page, STATE_KEY));
    assert.equal(stored.teams.length, 1);
    assert.equal(stored.teams[0].entries.length, 2);
    assert.equal(stored.spriteStyle, 'overworld');
    await expect(page.locator('#team-planner button[data-sprite-style="overworld"]')).toHaveAttribute('aria-pressed', 'true');
    // The old keys are left untouched.
    assert.equal(await readStored(page, LEGACY_TEAM_KEY), JSON.stringify(team));
    assert.equal(await readStored(page, SPRITE_KEY), 'overworld');
  });

  test('teams: create, rename, switch, delete, and keyboard', async ({ page }) => {
    await page.goto(url() + '#team-planner');
    await expect(page.locator('#planner-team-select option')).toHaveCount(1);

    // Create a team through the name form.
    await page.click('#planner-team-new');
    await expect(page.locator('#planner-team-name-form')).toBeVisible();
    await page.fill('#planner-team-name', 'Breeders');
    await page.click('#planner-team-name-save');
    await expect(page.locator('#planner-team-select option')).toHaveCount(2);
    await expectTeamGroups(page.locator('#planner-team-select'), [
      ['DQM1 teams', ['Breeders']],
      ['Unassigned teams', ['My team']],
    ]);
    await expect(page.locator('#planner-message')).not.toHaveText('');
    await expect(page.locator('#planner-team-summary')).toContainText('Breeders');

    // The new team is active: a monster added now belongs to it.
    await addMonster(page, 11);
    await expect(page.locator('#planner-males .planner-card')).toHaveCount(1);

    // Rename with the keyboard: Enter submits the form.
    await page.click('#planner-team-rename');
    await page.fill('#planner-team-name', 'Renamed');
    await page.keyboard.press('Enter');
    await expectTeamGroups(page.locator('#planner-team-select'), [
      ['DQM1 teams', ['Renamed']],
      ['Unassigned teams', ['My team']],
    ]);
    await expect(page.locator('#planner-message')).not.toHaveText('');

    // Switching teams switches the active roster.
    await page.selectOption('#planner-team-select', { label: 'My team' });
    await expect(page.locator('#planner-message')).not.toHaveText('');
    await expect(page.locator('#planner-males .planner-card')).toHaveCount(0);
    await page.selectOption('#planner-team-select', { label: 'Renamed' });
    await expect(page.locator('#planner-males .planner-card')).toHaveCount(1);

    // Escape cancels the name form.
    await page.click('#planner-team-rename');
    await page.fill('#planner-team-name', 'Nope');
    await page.keyboard.press('Escape');
    await expect(page.locator('#planner-team-name-form')).toBeHidden();
    await expectTeamGroups(page.locator('#planner-team-select'), [
      ['DQM1 teams', ['Renamed']],
      ['Unassigned teams', ['My team']],
    ]);

    // Delete the second team; the first becomes active again.
    await page.click('#planner-team-delete');
    await expect(page.locator('#planner-team-select option')).toHaveCount(1);
    await expect(page.locator('#planner-message')).not.toHaveText('');
    await expect(page.locator('#planner-males .planner-card')).toHaveCount(0);
    await expect(page.locator('#planner-team-delete')).toBeDisabled();
  });

  test('roster favorites: star toggles, survive edits, follow deletions, and filter', async ({ page }) => {
    await page.goto(url() + '#team-planner');
    await addMonster(page, 11);
    await page.check('#planner-sex-female');
    await addMonster(page, 99);
    await expect(page.locator('#planner-males .planner-card')).toHaveCount(1);
    await expect(page.locator('#planner-females .planner-card')).toHaveCount(1);

    // Star the male monster.
    const star = page.locator('#planner-males button[data-member-favorite]');
    await expect(star).toHaveAttribute('aria-pressed', 'false');
    await expect(star).toHaveAttribute('aria-label', 'Favorite Slime');
    await star.click();
    await expect(star).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#planner-message')).not.toHaveText('');

    // Editing the entry keeps the star.
    await page.click('#planner-males button[data-member-edit]');
    await page.fill('#planner-add-nickname', 'Star');
    await page.click('#planner-add-button');
    await expect(page.locator('#planner-males .planner-card-name')).toHaveText('Star');
    await expect(page.locator('#planner-males button[data-member-favorite]')).toHaveAttribute('aria-pressed', 'true');

    // Deleting the entry removes the favorite.
    await page.click('#planner-males button[data-member-remove]');
    await expect(page.locator('#planner-males button[data-member-favorite]')).toHaveCount(0);

    // The favorites filter shows only starred entries per column.
    const femaleStar = page.locator('#planner-females button[data-member-favorite]');
    await femaleStar.click();
    await expect(femaleStar).toHaveAttribute('aria-pressed', 'true');
    await page.check('#planner-roster-favorites');
    await expect(page.locator('#planner-males .planner-card')).toHaveCount(0);
    await expect(page.locator('#planner-females .planner-card')).toHaveCount(1);
    await expect(page.locator('#planner-males .planner-empty')).toBeVisible();
    await page.uncheck('#planner-roster-favorites');
    await expect(page.locator('#planner-females .planner-card')).toHaveCount(1);
  });

  test('full backup round trips and a malformed import changes nothing', async ({ page }) => {
    await page.goto(url() + '#team-planner');
    await addMonster(page, 11);
    await page.click('#planner-team-new');
    await page.fill('#planner-team-name', 'Second');
    await page.click('#planner-team-name-save');
    await page.check('#planner-sex-female');
    await addMonster(page, 99);

    // Export the full backup.
    if (!(await page.locator('#planner-data-tools').evaluate(el => el.open))) {
      await page.locator('#planner-data-tools > summary').click();
    }
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#planner-backup-export'),
    ]);
    assert.equal(download.suggestedFilename(), 'DQM-guide-backup-v61.json');
    const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    assert.equal(exported.version, 2);
    assert.equal(exported.game, 'dqm1-2-ps1-v61');
    assert.equal(exported.activeGame, 'dqm1');
    assert.equal(exported.teams.length, 2);
    assert.equal(exported.teams[0].entries.length, 1);
    assert.equal(exported.teams[1].entries.length, 1);
    assert.equal(exported.activeTeamId, exported.teams[1].id);

    // Add a target so the round trip covers targets too.
    exported.teams[1].targets.push({ id: 't-target-1', speciesIndex: 50, plan: null });
    exported.teams[1].activeTargetId = 't-target-1';
    const tmp = path.join(os.tmpdir(), 'dqm-guide-backup-test.json');
    fs.writeFileSync(tmp, JSON.stringify(exported));

    // Change the current document so the replace is observable.
    await addMonster(page, 13);
    await expect(page.locator('#planner-females .planner-card')).toHaveCount(2);
    await expect(page.locator('#planner-females .planner-card-name')).toHaveText(['Dracky', 'Healer Slime']);

    // Import the backup and confirm the preview counts.
    if (!(await page.locator('#planner-data-tools').evaluate(el => el.open))) {
      await page.locator('#planner-data-tools > summary').click();
    }
    await page.setInputFiles('#planner-backup-import', tmp);
    await expect(page.locator('#planner-import-preview')).toBeVisible();
    await expect(page.locator('#planner-import-preview-text')).toContainText(/\d+ teams?/);
    await page.click('#planner-import-confirm');
    await expect(page.locator('#planner-import-preview')).toBeHidden();
    await expect(page.locator('#planner-females .planner-card')).toHaveCount(1);
    await expect(page.locator('#planner-females .planner-card-name')).toHaveText('Dracky');
    const stored = JSON.parse(await readStored(page, STATE_KEY));
    assert.equal(stored.teams.length, 2);
    assert.equal(stored.teams[1].targets.length, 1);
    assert.equal(stored.activeTeamId, stored.teams[1].id);

    // A malformed file shows an error and leaves the document intact.
    const storedBefore = await readStored(page, STATE_KEY);
    fs.writeFileSync(tmp, 'not json{{{');
    if (!(await page.locator('#planner-data-tools').evaluate(el => el.open))) {
      await page.locator('#planner-data-tools > summary').click();
    }
    await page.setInputFiles('#planner-backup-import', tmp);
    // The earlier export left a message; wait for this import's rejection.
    await expect(page.locator('#planner-backup-message')).toContainText('Import failed');
    await expect(page.locator('#planner-backup-import')).toHaveValue('');
    await expect(page.locator('#planner-import-preview')).toBeHidden();
    await expect(page.locator('#planner-females .planner-card')).toHaveCount(1);
    assert.equal(await readStored(page, STATE_KEY), storedBefore);
  });

  test('a newer stored document is never overwritten', async ({ page }) => {
    const stored = { ...legacyTeam(), version: 3 };
    await page.addInitScript(({ key, doc }) => {
      localStorage.setItem(key, JSON.stringify(doc));
    }, { key: STATE_KEY, doc: stored });
    await page.goto(url() + '#team-planner');
    await expect(page.locator('#app-storage-error')).toBeVisible();
    await expect(page.locator('#app-storage-error-text')).not.toHaveText('');
    await expect(page.locator('#app-storage-error-download')).toBeVisible();
    await expect(page.locator('#app-storage-error-fresh')).toBeVisible();
    const before = await readStored(page, STATE_KEY);

    // Clicking around mutates the session but must not write.
    await addMonster(page, 11);
    await expect(page.locator('#planner-males .planner-card')).toHaveCount(1);
    await page.click('#team-planner button[data-sprite-style="overworld"]');
    await expect(page.locator('#team-planner button[data-sprite-style="overworld"]')).toHaveAttribute('aria-pressed', 'true');
    assert.equal(await readStored(page, STATE_KEY), before);
  });

  test('the blocked-document download contains the stored value', async ({ page }) => {
    const doc = { ...legacyTeam(), version: 3 };
    await page.addInitScript(({ key, doc }) => localStorage.setItem(key, JSON.stringify(doc)), { key: STATE_KEY, doc });
    await page.goto(url() + '#team-planner');
    await expect(page.locator('#app-storage-error')).toBeVisible();
    const stored = await readStored(page, STATE_KEY);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#app-storage-error-download'),
    ]);
    assert.equal(download.suggestedFilename(), 'DQM-guide-saved-data.json');
    assert.equal(fs.readFileSync(await download.path(), 'utf8'), stored);
  });

  test('start fresh requires two clicks, clears the banner, and saves', async ({ page }) => {
    const doc = { ...legacyTeam(), version: 3 };
    await page.addInitScript(({ key, doc }) => localStorage.setItem(key, JSON.stringify(doc)), { key: STATE_KEY, doc });
    await page.goto(url() + '#team-planner');
    await expect(page.locator('#app-storage-error')).toBeVisible();
    const before = await readStored(page, STATE_KEY);

    // The first click only asks for confirmation and must not write.
    await page.click('#app-storage-error-fresh');
    await expect(page.locator('#app-storage-error-fresh')).not.toHaveText('');
    assert.equal(await readStored(page, STATE_KEY), before);

    // The second click replaces the document, clears the banner, and saves.
    await page.click('#app-storage-error-fresh');
    await expect(page.locator('#app-storage-error')).toBeHidden();
    const after = JSON.parse(await readStored(page, STATE_KEY));
    assert.equal(after.version, 2);
    assert.equal(after.teams.length, 1);
    await addMonster(page, 11);
    const saved = JSON.parse(await readStored(page, STATE_KEY));
    assert.equal(saved.teams[0].entries.length, 1);
  });

  test('a newer backup file is rejected without blocking saving', async ({ page }) => {
    await page.goto(url() + '#team-planner');
    await addMonster(page, 11);
    const before = await readStored(page, STATE_KEY);
    const newer = {
      version: 3,
      game: 'dqm1-2-ps1-v61',
      spriteStyle: 'portrait',
      favoriteSpeciesIndices: [],
      activeTeamId: 't-newer',
      teams: [{ id: 't-newer', name: 'Newer', entries: [], activeTargetId: null, targets: [] }],
    };
    const tmp = path.join(os.tmpdir(), 'dqm-guide-newer-backup.json');
    fs.writeFileSync(tmp, JSON.stringify(newer));
    if (!(await page.locator('#planner-data-tools').evaluate(el => el.open))) {
      await page.locator('#planner-data-tools > summary').click();
    }
    await page.setInputFiles('#planner-backup-import', tmp);
    await expect(page.locator('#planner-backup-message')).not.toHaveText('');

    // Importing a file must not be treated as a stored-document conflict.
    assert.equal(await readStored(page, STATE_KEY), before);
    await expect(page.locator('#app-storage-error')).toBeHidden();

    // Saving still works after the rejected import.
    await addMonster(page, 99);
    const after = JSON.parse(await readStored(page, STATE_KEY));
    assert.equal(after.teams[0].entries.length, 2);
  });

  test('the roster favorites filter narrows each column to starred entries', async ({ page }) => {
    await page.goto(url() + '#team-planner');
    await addMonster(page, 11);
    await addMonster(page, 99);
    await addMonster(page, 13);
    await expect(page.locator('#planner-males .planner-card')).toHaveCount(3);

    const stars = page.locator('#planner-males button[data-member-favorite]');
    await stars.nth(0).click();
    await stars.nth(2).click();
    await page.check('#planner-roster-favorites');
    await expect(page.locator('#planner-males .planner-card')).toHaveCount(2);
    await expect(page.locator('#planner-males .planner-card-name')).toHaveText(['Slime', 'Healer Slime']);
  });

  test('storage unavailable keeps the session usable and offers export', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem = () => { throw new Error('blocked'); };
    });
    await page.goto(url() + '#team-planner');
    await expect(page.locator('#app-storage-error')).toBeVisible();
    await expect(page.locator('#app-storage-error-text')).not.toHaveText('');
    // Unavailable storage offers no in-banner rescue buttons.
    await expect(page.locator('#app-storage-error-download')).toBeHidden();
    await expect(page.locator('#app-storage-error-fresh')).toBeHidden();

    // The page is still usable.
    await addMonster(page, 11);
    await expect(page.locator('#planner-males .planner-card')).toHaveCount(1);

    // Export works from the in-memory document.
    if (!(await page.locator('#planner-data-tools').evaluate(el => el.open))) {
      await page.locator('#planner-data-tools > summary').click();
    }
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#planner-backup-export'),
    ]);
    assert.equal(download.suggestedFilename(), 'DQM-guide-backup-v61.json');
    const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    assert.equal(exported.teams.length, 1);
    assert.equal(exported.teams[0].entries.length, 1);
  });

  test('the team select is labeled and switching announces', async ({ page }) => {
    await page.goto(url() + '#team-planner');
    await page.click('#planner-team-new');
    await page.fill('#planner-team-name', 'Second');
    await page.click('#planner-team-name-save');
    await expectTeamGroups(page.locator('#planner-team-select'), [
      ['DQM1 teams', ['Second']],
      ['Unassigned teams', ['My team']],
    ]);

    // The native team select is focusable and labeled for keyboard use; the
    // app announces the resulting switch through its status message.
    const select = page.locator('#planner-team-select');
    await select.focus();
    await expect(select).toBeFocused();
    await expect(page.locator('label[for="planner-team-select"]')).toBeVisible();
    await select.selectOption({ label: 'My team' });
    await expect(page.locator('#planner-message')).not.toHaveText('');
  });

  test('keyboard: stars, team select, and import preview announce state', async ({ page }) => {
    await page.goto(url() + '#team-planner');
    await addMonster(page, 11);

    // The star is reachable and toggles with the keyboard.
    const star = page.locator('#planner-males button[data-member-favorite]');
    await star.focus();
    await page.keyboard.press('Enter');
    await expect(star).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('#planner-message')).not.toHaveText('');

    // Team creation announces through the status message.
    await page.click('#planner-team-new');
    await page.fill('#planner-team-name', 'Second');
    await page.click('#planner-team-name-save');
    await expect(page.locator('#planner-message')).not.toHaveText('');
    // Switch back to the team holding the monster so it is on screen.
    await page.selectOption('#planner-team-select', { label: 'My team' });
    await expect(page.locator('#planner-males .planner-card')).toHaveCount(1);

    // The import preview announces its counts and is keyboard-operable.
    const tmp = path.join(os.tmpdir(), 'dqm-guide-backup-kb.json');
    fs.writeFileSync(tmp, JSON.stringify({
      version: 1,
      game: 'dqm1-2-ps1-v61',
      spriteStyle: 'portrait',
      favoriteSpeciesIndices: [],
      activeTeamId: 't-other',
      teams: [{ id: 't-other', name: 'Other', entries: [], activeTargetId: null, targets: [] }],
    }));
    if (!(await page.locator('#planner-data-tools').evaluate(el => el.open))) {
      await page.locator('#planner-data-tools > summary').click();
    }
    await page.setInputFiles('#planner-backup-import', tmp);
    await expect(page.locator('#planner-import-preview')).toBeVisible();
    await expect(page.locator('#planner-import-preview-text')).toContainText(/\d+ teams?/);
    // The confirm button is focused; Tab reaches Cancel and Enter cancels.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page.locator('#planner-import-preview')).toBeHidden();
    await expect(page.locator('#planner-males .planner-card')).toHaveCount(1);
  });

  test('cross-tab: a team created in one tab appears in another', async ({ page }) => {
    const context = page.context();
    const pageB = await context.newPage();
    await page.goto(url() + '#team-planner');
    await pageB.goto(url() + '#team-planner');
    await expect(pageB.locator('#planner-team-select option')).toHaveCount(1);

    // Create a team in page A; page B adopts it through the storage event.
    await page.click('#planner-team-new');
    await page.fill('#planner-team-name', 'Shared');
    await page.click('#planner-team-name-save');
    await expect(pageB.locator('#planner-team-select option')).toHaveCount(2);
    await expectTeamGroups(pageB.locator('#planner-team-select'), [
      ['DQM1 teams', ['Shared']],
      ['Unassigned teams', ['My team']],
    ]);
    await expect(pageB.locator('#planner-message')).not.toHaveText('');
    await pageB.close();
  });

  test('cross-tab: a valid save clears an oversized-document warning and restores export', async ({ page }) => {
    await page.goto(url() + '#team-planner');
    await addMonster(page, 11);
    const pageB = await page.context().newPage();
    await pageB.goto(url() + '#team-planner');
    const savedBefore = await readStored(page, STATE_KEY);

    // Build real, validated plans within the per-plan bounds. The compact
    // import fits the reader limit, but formatting the whole collection for
    // storage exceeds it, leaving page A with an unsaved oversized document.
    const fixture = await page.evaluate(() => {
      const core = DQMPlannerCore.create(DATA);
      const app = DQMAppState.create(DATA, core);
      const planner = DQMRecipePlanner.create(DATA, core);
      let plan = planner.createPlan(300, 'shrine');
      const tried = new Set();
      while (plan.nodes.length < 99) {
        const node = plan.nodes.find(item => !item.children && !tried.has(item.id) && item.speciesIndex !== null);
        if (!node) break;
        tried.add(node.id);
        for (const recipe of planner.suggestions(node.speciesIndex, { context: 'shrine', pageSize: 100 }).items) {
          try {
            plan = planner.expand(plan, node.id, recipe);
            break;
          } catch {
            // Skip recipes that repeat an ancestor or exceed the depth bound.
          }
        }
      }
      for (const node of plan.nodes) plan = planner.setNote(plan, node.id, 'x'.repeat(500));
      planner.validate(plan);
      const state = app.defaultState();
      state.teams = Array.from({ length: 20 }, (_, index) => ({
        id: 't-large-' + index, name: 'Large team ' + index, game: 'dqm1', entries: [],
        activeTargetId: 'goal', targets: [{ id: 'goal', speciesIndex: 300, plan }],
      }));
      state.activeTeamId = state.teams[0].id;
      const normalized = app.normalizeDocument(state);
      return {
        text: JSON.stringify(normalized),
        formattedLength: (JSON.stringify(normalized, null, 2) + '\n').length,
        limit: app.MAX_IMPORT_LENGTH,
      };
    });
    assert.ok(fixture.text.length < fixture.limit);
    assert.ok(fixture.formattedLength > fixture.limit);
    await page.locator('#planner-data-tools > summary').click();
    await page.setInputFiles('#planner-backup-import', {
      name: 'large-backup.json', mimeType: 'application/json', buffer: Buffer.from(fixture.text),
    });
    await expect(page.locator('#planner-import-preview')).toBeVisible();
    await page.click('#planner-import-confirm');
    await expect(page.locator('#app-storage-error-text')).not.toHaveText('');
    await expect(page.locator('#planner-save-status')).not.toHaveText('');
    // Too-large offers no in-banner rescue buttons.
    await expect(page.locator('#app-storage-error-download')).toBeHidden();
    await expect(page.locator('#app-storage-error-fresh')).toBeHidden();
    assert.equal(await readStored(page, STATE_KEY), savedBefore);
    await expect(page.locator('#planner-males .planner-card')).toHaveCount(0);

    // Page B still has the previous saved roster. Its normal save must
    // replace page A's oversized session and clear every stale warning.
    await addMonster(pageB, 99);
    await expect(page.locator('#planner-message')).not.toHaveText('');
    await expect(page.locator('#planner-males .planner-card-name')).toHaveText(['Slime', 'Dracky']);
    await expect(page.locator('#app-storage-error')).toBeHidden();
    await expect(page.locator('#planner-save-status')).toContainText(/[Ss]aved/);
    const recovered = await readStored(page, STATE_KEY);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#planner-backup-export'),
    ]);
    assert.equal(download.suggestedFilename(), 'DQM-guide-backup-v61.json');
    assert.deepEqual(JSON.parse(fs.readFileSync(await download.path(), 'utf8')), JSON.parse(recovered));
    await pageB.close();
  });

  test('cross-tab: a valid document clears a newer-document block', async ({ page }) => {
    const context = page.context();
    const pageB = await context.newPage();
    await page.goto(url() + '#team-planner');
    await pageB.goto(url() + '#team-planner');

    // Page A writes a newer document; page B must block and not overwrite it.
    await page.evaluate(key => localStorage.setItem(key, JSON.stringify({ version: 3, game: 'dqm1-2-ps1-v61' })), STATE_KEY);
    await expect(pageB.locator('#app-storage-error')).toBeVisible();
    await expect(pageB.locator('#app-storage-error-text')).not.toHaveText('');
    const newerRaw = await readStored(page, STATE_KEY);

    // Page A writes a valid document; page B must recover and save again.
    const valid = {
      version: 1,
      game: 'dqm1-2-ps1-v61',
      spriteStyle: 'portrait',
      favoriteSpeciesIndices: [],
      activeTeamId: 't-recover',
      teams: [{ id: 't-recover', name: 'Recovered', entries: [], activeTargetId: null, targets: [] }],
    };
    await page.evaluate(({ key, doc }) => localStorage.setItem(key, JSON.stringify(doc)), { key: STATE_KEY, doc: valid });
    await expect(pageB.locator('#app-storage-error')).toBeHidden();
    await expect(pageB.locator('#planner-team-select option')).toHaveText(['Recovered']);

    // Page B can now save again.
    await pageB.click('#planner-team-new');
    await pageB.fill('#planner-team-name', 'After recovery');
    await pageB.click('#planner-team-name-save');
    const saved = JSON.parse(await readStored(pageB, STATE_KEY));
    assert.equal(saved.teams.length, 2);
    assert.notEqual(await readStored(page, STATE_KEY), newerRaw);
    await pageB.close();
  });
});
