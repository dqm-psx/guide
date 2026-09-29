const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FILE_URL = 'file://' + path.join(REPO_ROOT, 'index.html');
let serverUrl = null;

const STATE_KEY = 'dqm-guide-state-v61-v1';
const LEGACY_TEAM_KEY = 'dqm-guide-team-v61-v1';
const SPRITE_KEY = 'dqm-guide-sprite-style-v1';

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

const addMonster = async (page, speciesIndex) => {
  await page.selectOption('#planner-add-species', String(speciesIndex));
  await page.click('#planner-add-button');
};

// The page must work opened directly from disk and served under /guide/.
for (const name of ['file', 'server']) {
  test.describe(name, () => {
    const url = () => (name === 'file' ? FILE_URL : serverUrl);

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
      await expect(page.locator('#planner-team-select option')).toHaveText(['My team', 'Breeders']);
      await expect(page.locator('#planner-message')).toContainText('Created team "Breeders"');
      await expect(page.locator('#planner-team-summary')).toContainText('monsters in Breeders');

      // The new team is active: a monster added now belongs to it.
      await addMonster(page, 11);
      await expect(page.locator('#planner-males .planner-card')).toHaveCount(1);

      // Rename with the keyboard: Enter submits the form.
      await page.click('#planner-team-rename');
      await page.fill('#planner-team-name', 'Renamed');
      await page.keyboard.press('Enter');
      await expect(page.locator('#planner-team-select option')).toHaveText(['My team', 'Renamed']);
      await expect(page.locator('#planner-message')).toContainText('Renamed team to "Renamed"');

      // Switching teams switches the active roster.
      await page.selectOption('#planner-team-select', { index: 0 });
      await expect(page.locator('#planner-message')).toContainText('Switched to team "My team"');
      await expect(page.locator('#planner-males .planner-card')).toHaveCount(0);
      await page.selectOption('#planner-team-select', { index: 1 });
      await expect(page.locator('#planner-males .planner-card')).toHaveCount(1);

      // Escape cancels the name form.
      await page.click('#planner-team-rename');
      await page.fill('#planner-team-name', 'Nope');
      await page.keyboard.press('Escape');
      await expect(page.locator('#planner-team-name-form')).toBeHidden();
      await expect(page.locator('#planner-team-select option')).toHaveText(['My team', 'Renamed']);

      // Delete the second team; the first becomes active again.
      await page.click('#planner-team-delete');
      await expect(page.locator('#planner-team-select option')).toHaveCount(1);
      await expect(page.locator('#planner-message')).toContainText('Deleted team "Renamed"');
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
      await expect(page.locator('#planner-message')).toContainText('Favorited Slime');

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
      await expect(page.locator('#planner-males .planner-empty')).toContainText('No favorites yet');
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
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('#planner-backup-export'),
      ]);
      assert.equal(download.suggestedFilename(), 'DQM-guide-backup-v61.json');
      const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
      assert.equal(exported.version, 1);
      assert.equal(exported.game, 'dqm1-2-ps1-v61');
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
      await page.setInputFiles('#planner-backup-import', tmp);
      await expect(page.locator('#planner-import-preview')).toBeVisible();
      await expect(page.locator('#planner-import-preview-text')).toContainText('2 teams and 1 targets (0 favorites, 2 monsters)');
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
      await page.setInputFiles('#planner-backup-import', tmp);
      await expect(page.locator('#planner-backup-message')).toContainText('Import failed');
      await expect(page.locator('#planner-females .planner-card')).toHaveCount(1);
      assert.equal(await readStored(page, STATE_KEY), storedBefore);
    });

    test('a newer stored document is never overwritten', async ({ page }) => {
      const stored = { ...legacyTeam(), version: 2 };
      await page.addInitScript(({ key, doc }) => {
        localStorage.setItem(key, JSON.stringify(doc));
      }, { key: STATE_KEY, doc: stored });
      await page.goto(url() + '#team-planner');
      await expect(page.locator('#app-storage-error')).toBeVisible();
      await expect(page.locator('#app-storage-error-text')).toContainText('newer version');
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

    test('storage unavailable keeps the session usable and offers export', async ({ page }) => {
      await page.addInitScript(() => {
        localStorage.setItem = () => { throw new Error('blocked'); };
      });
      await page.goto(url() + '#team-planner');
      await expect(page.locator('#app-storage-error')).toBeVisible();
      await expect(page.locator('#app-storage-error-text')).toContainText('unavailable');

      // The page is still usable.
      await addMonster(page, 11);
      await expect(page.locator('#planner-males .planner-card')).toHaveCount(1);

      // Export works from the in-memory document.
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('#planner-backup-export'),
      ]);
      assert.equal(download.suggestedFilename(), 'DQM-guide-backup-v61.json');
      const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
      assert.equal(exported.teams.length, 1);
      assert.equal(exported.teams[0].entries.length, 1);
    });

    test('keyboard: stars, team select, and import preview announce state', async ({ page }) => {
      await page.goto(url() + '#team-planner');
      await addMonster(page, 11);

      // The star is reachable and toggles with the keyboard.
      const star = page.locator('#planner-males button[data-member-favorite]');
      await star.focus();
      await page.keyboard.press('Enter');
      await expect(star).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#planner-message')).toContainText('Favorited Slime');

      // Team creation announces through the status message.
      await page.click('#planner-team-new');
      await page.fill('#planner-team-name', 'Second');
      await page.click('#planner-team-name-save');
      await expect(page.locator('#planner-message')).toContainText('Created team "Second"');
      // Switch back to the first team so its monster is on screen.
      await page.selectOption('#planner-team-select', { index: 0 });
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
      await page.setInputFiles('#planner-backup-import', tmp);
      await expect(page.locator('#planner-import-preview')).toBeVisible();
      await expect(page.locator('#planner-import-preview-text')).toContainText('1 teams and 0 targets (0 favorites, 0 monsters)');
      // The confirm button is focused; Tab reaches Cancel and Enter cancels.
      await page.keyboard.press('Tab');
      await page.keyboard.press('Enter');
      await expect(page.locator('#planner-import-preview')).toBeHidden();
      await expect(page.locator('#planner-males .planner-card')).toHaveCount(1);
    });

    if (name === 'server') {
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
        await expect(pageB.locator('#planner-team-select option')).toHaveText(['My team', 'Shared']);
        await expect(pageB.locator('#planner-message')).toContainText('Updated from another tab');
        await pageB.close();
      });
    }
  });
}
