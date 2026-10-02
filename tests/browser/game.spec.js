const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
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

// Teams are filed under the game being viewed, so the select renders optgroups:
// the active game's teams first, unassigned teams second. Option order is
// therefore not creation order, which makes flat indexes unsafe to select on.
const expectTeamGroups = async (select, expected) =>
  assert.deepEqual(await select.evaluate(node => [...node.querySelectorAll('optgroup')]
    .map(group => [group.label, [...group.querySelectorAll('option')].map(option => option.textContent)])), expected);

const addMonster = async (page, speciesIndex, location) => {
  await page.check(location === 'farm' ? '#planner-location-farm' : '#planner-location-party');
  await page.selectOption('#planner-add-species', String(speciesIndex));
  await page.click('#planner-add-button');
};

// Rename the active team, which is how a test tells two teams apart when both
// would otherwise carry the default name.
const renameActiveTeam = async (page, name) => {
  await page.click('#planner-team-rename');
  await page.fill('#planner-team-name', name);
  await page.click('#planner-team-name-save');
};

// The page must work opened directly from disk and served under /guide/.
for (const name of ['file', 'server']) {
  test.describe(name, () => {
    const url = () => (name === 'file' ? FILE_URL : serverUrl);

    test('the switch filters the team dropdown and unassigned teams stay under both games', async ({ page }) => {
      await page.goto(url() + '#team-planner');

      // A fresh document has one unassigned team and is viewing DQM1.
      await expect(page.locator('#planner-game-dqm1')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#planner-team-game')).toHaveValue('');
      await expect(page.locator('#planner-team-game-hint')).toBeVisible();
      await expectTeamGroups(page.locator('#planner-team-select'), [
        ['Unassigned teams', ['My team']],
      ]);

      // A new team belongs to the game being viewed, so it joins the DQM1 group.
      await renameActiveTeam(page, 'DQM1 roster');
      await page.click('#planner-team-new');
      await page.fill('#planner-team-name', 'DQM1 second');
      await page.click('#planner-team-name-save');
      await expectTeamGroups(page.locator('#planner-team-select'), [
        ['DQM1 teams', ['DQM1 second']],
        ['Unassigned teams', ['DQM1 roster']],
      ]);

      // DQM2 has no teams of its own, but the unassigned one is still listed.
      await page.click('#planner-game-dqm2');
      await expect(page.locator('#planner-game-dqm2')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#planner-message')).toHaveText('Viewing DQM2.');
      await expectTeamGroups(page.locator('#planner-team-select'), [
        ['Unassigned teams', ['DQM1 roster']],
      ]);

      // Switching back restores the DQM1 group; the unassigned team stayed visible.
      await page.click('#planner-game-dqm1');
      await expectTeamGroups(page.locator('#planner-team-select'), [
        ['DQM1 teams', ['DQM1 second']],
        ['Unassigned teams', ['DQM1 roster']],
      ]);
    });

    test('a migrated version-1 team is unassigned, listed under both games, and keeps its monsters', async ({ page }) => {
      // Exactly what a version-1 document written by the app looks like: no
      // team game, no entry location, and a favorite flag on every monster.
      const doc = {
        version: 1,
        game: 'dqm1-2-ps1-v61',
        spriteStyle: 'portrait',
        favoriteSpeciesIndices: [],
        activeTeamId: 't-legacy',
        teams: [{
          id: 't-legacy',
          name: 'Old save',
          entries: [
            { id: 'm-1', speciesIndex: 11, sex: 'male', plus: 0, nickname: '', favorite: false },
            { id: 'm-2', speciesIndex: 99, sex: 'female', plus: 2, nickname: 'Drake', favorite: true },
          ],
          activeTargetId: 't-t1',
          targets: [{ id: 't-t1', speciesIndex: 50, plan: null }],
        }],
      };
      await page.addInitScript(({ key, saved }) => {
        localStorage.setItem(key, JSON.stringify(saved));
      }, { key: STORAGE_KEY, saved: doc });
      await page.goto(url() + '#team-planner');
      // A version-1 document is migrated, not blocked.
      await expect(page.locator('#app-storage-error')).toBeHidden();

      // Every monster survived, and it is a party monster under both games.
      await expect(page.locator('#planner-males .planner-card')).toHaveCount(1);
      await expect(page.locator('#planner-females .planner-card')).toHaveCount(1);
      await expect(page.locator('#planner-females button[data-member-favorite]')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#planner-team-summary')).toContainText('2 party · 0 farm');
      await expect(page.locator('#planner-team-game-hint')).toBeVisible();
      for (const game of ['dqm1', 'dqm2']) {
        await page.click('#planner-game-' + game);
        await expectTeamGroups(page.locator('#planner-team-select'), [
          ['Unassigned teams', ['Old save']],
        ]);
        await expect(page.locator('#planner-females .planner-card-name')).toHaveText('Drake');
      }

      // Its target is still there.
      await page.click('#planner-tab-targets');
      await expect(page.locator('#target-list .target-item')).toHaveCount(1);
      await expect(page.locator('#target-active-summary')).toContainText('Active target: Great Dragon');

      // Choosing a game files the whole team, monsters and target together.
      await page.click('#planner-tab-roster');
      await page.selectOption('#planner-team-game', 'dqm2');
      await expect(page.locator('#planner-message')).toContainText('filed under DQM2');
      await expect(page.locator('#planner-team-game-hint')).toBeHidden();
      await expect(page.locator('#planner-males .planner-card-name')).toHaveText('Slime');
      await page.click('#planner-tab-targets');
      await expect(page.locator('#target-list .target-item')).toHaveCount(1);

      // The migration is written back with the new fields.
      const stored = JSON.parse(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY));
      assert.equal(stored.version, 2);
      assert.equal(stored.activeGame, 'dqm2');
      assert.equal(stored.teams[0].game, 'dqm2');
      assert.deepEqual(stored.teams[0].entries.map(entry => entry.location), ['party', 'party']);
    });

    test('assigning the active team to DQM2 files it there and leaves the DQM1 list', async ({ page }) => {
      await page.goto(url() + '#team-planner');
      await renameActiveTeam(page, 'DQ2 run');
      await addMonster(page, 11, 'party');

      await page.selectOption('#planner-team-game', 'dqm2');
      await expect(page.locator('#planner-message')).toHaveText('Team "DQ2 run" filed under DQM2.');
      await expect(page.locator('#planner-team-game-hint')).toBeHidden();
      // The switch follows the active team, so it stays visible in the dropdown.
      await expect(page.locator('#planner-game-dqm2')).toHaveAttribute('aria-pressed', 'true');
      await expectTeamGroups(page.locator('#planner-team-select'), [
        ['DQM2 teams', ['DQ2 run']],
      ]);
      await expect(page.locator('#planner-males .planner-card')).toHaveCount(1);

      // DQM1 now has no team of its own, so switching creates a fresh empty one.
      await page.click('#planner-game-dqm1');
      await expect(page.locator('#planner-message')).toHaveText('Viewing DQM1.');
      await expect(page.locator('#planner-team-summary')).toContainText('0 / 100 monsters in My team (0 party · 0 farm)');
      await expect(page.locator('#planner-males .planner-card')).toHaveCount(0);
      await expect(page.locator('#planner-females .planner-empty')).toContainText('No female monsters yet');
      await expect(page.locator('#planner-team-game')).toHaveValue('dqm1');
      await expectTeamGroups(page.locator('#planner-team-select'), [
        ['DQM1 teams', ['My team']],
      ]);

      // Both teams are saved, and switching back finds the DQM2 roster intact.
      const stored = JSON.parse(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY));
      assert.equal(stored.teams.length, 2);
      assert.equal(stored.teams[0].game, 'dqm2');
      assert.equal(stored.teams[1].game, 'dqm1');
      await page.click('#planner-game-dqm2');
      await expect(page.locator('#planner-males .planner-card-name')).toHaveText('Slime');
      await expect(page.locator('#planner-team-summary')).toContainText('1 party · 0 farm');
    });

    test('unassigning a team brings it back under both games', async ({ page }) => {
      await page.goto(url() + '#team-planner');
      await renameActiveTeam(page, 'Filed');
      await page.selectOption('#planner-team-game', 'dqm1');
      await expectTeamGroups(page.locator('#planner-team-select'), [
        ['DQM1 teams', ['Filed']],
      ]);

      await page.selectOption('#planner-team-game', '');
      await expect(page.locator('#planner-message')).toHaveText('Team "Filed" is unassigned.');
      await expect(page.locator('#planner-team-game-hint')).toBeVisible();
      // The switch does not follow an unassignment: the team is still visible.
      await expect(page.locator('#planner-game-dqm1')).toHaveAttribute('aria-pressed', 'true');
      await expectTeamGroups(page.locator('#planner-team-select'), [
        ['Unassigned teams', ['Filed']],
      ]);
    });

    test('move to farm and back keeps the nickname, sex, + value, and favorite', async ({ page }) => {
      await page.goto(url() + '#team-planner');
      await page.selectOption('#planner-add-species', '11');
      await page.fill('#planner-add-plus', '3');
      await page.fill('#planner-add-nickname', 'Slimo');
      await page.click('#planner-add-button');
      await page.locator('#planner-males button[data-member-favorite]').click();
      await expect(page.locator('#planner-males .planner-card-meta')).toContainText('Slime +3');

      // The card starts in the party subsection of the male column.
      const partyList = page.locator('#planner-males > .planner-card-list').first();
      const farmList = page.locator('#planner-males > .planner-card-list').nth(1);
      await expect(partyList.locator('.planner-card-name')).toHaveText('Slimo');
      await expect(farmList.locator('.planner-card')).toHaveCount(0);
      await expect(page.locator('#planner-team-summary')).toContainText('1 party · 0 farm');

      const move = page.locator('#planner-males button[data-member-move]');
      await expect(move).toHaveText('Move to farm');
      await expect(move).toHaveAttribute('aria-label', 'Move Slimo · Slime +3 to the farm');
      await move.click();
      await expect(page.locator('#planner-message')).toHaveText('Moved Slimo to the farm. Nickname, sex, and + value kept.');
      await expect(partyList.locator('.planner-card')).toHaveCount(0);
      await expect(farmList.locator('.planner-card-name')).toHaveText('Slimo');
      await expect(farmList.locator('.planner-card-meta')).toContainText('Slime +3');
      await expect(farmList.locator('button[data-member-favorite]')).toHaveAttribute('aria-pressed', 'true');
      // Still the male column, and the summary counts it as a farm monster.
      await expect(page.locator('#planner-males .planner-card')).toHaveCount(1);
      await expect(page.locator('#planner-females .planner-card')).toHaveCount(0);
      await expect(page.locator('#planner-team-summary')).toContainText('0 party · 1 farm');
      await expect(page.locator('#planner-males .planner-location-heading')).toHaveText(['Party 0', 'Farm 1']);

      // Moving back is the same one-field move in reverse.
      const back = page.locator('#planner-males button[data-member-move]');
      await expect(back).toHaveText('Move to party');
      await back.click();
      await expect(page.locator('#planner-message')).toHaveText('Moved Slimo to the party. Nickname, sex, and + value kept.');
      await expect(partyList.locator('.planner-card-name')).toHaveText('Slimo');
      await expect(partyList.locator('.planner-card-meta')).toContainText('Slime +3');
      await expect(partyList.locator('button[data-member-favorite]')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#planner-males .planner-location-heading')).toHaveText(['Party 1', 'Farm 0']);
      await expect(page.locator('#planner-team-summary')).toContainText('1 party · 0 farm');
    });

    test('a monster added as a farm monster is filed on the farm from the start', async ({ page }) => {
      await page.goto(url() + '#team-planner');
      await page.check('#planner-sex-female');
      await addMonster(page, 99, 'farm');
      await expect(page.locator('#planner-females > .planner-card-list').nth(1).locator('.planner-card-name')).toHaveText('Dracky');
      await expect(page.locator('#planner-females > .planner-card-list').first().locator('.planner-card')).toHaveCount(0);
      await expect(page.locator('#planner-team-summary')).toContainText('0 party · 1 farm');

      // The form resets to party for the next monster.
      await expect(page.locator('#planner-location-party')).toBeChecked();
      await addMonster(page, 13, 'party');
      await expect(page.locator('#planner-females > .planner-card-list').first().locator('.planner-card-name')).toHaveText('Healer Slime');
      await expect(page.locator('#planner-team-summary')).toContainText('1 party · 1 farm');
    });

    test('the breeding grid excludes farm monsters until the toggle adds them, tagged', async ({ page }) => {
      await page.goto(url() + '#team-planner');
      await addMonster(page, 11, 'party');  // male, party
      await addMonster(page, 13, 'farm');   // male, farm
      await page.check('#planner-sex-female');
      await addMonster(page, 99, 'party');  // female, party
      await page.check('#planner-sex-male');
      await page.click('#planner-tab-breeding');
      await expect(page.locator('#planner-breeding')).toBeVisible();

      // Party only by default: the farm male is not a row or a column.
      await expect(page.locator('#planner-breeding-summary')).toContainText('2 ordered pairings · Ordinary shrine · party only');
      await expect(page.locator('#planner-male-grid tbody tr')).toHaveCount(1);
      await expect(page.locator('#planner-male-grid tbody th')).toHaveText(['Slime+0']);
      await expect(page.locator('#planner-female-grid thead th')).toHaveText(['Pedigree ↓Mate →', 'Slime+0']);
      await expect(page.locator('.planner-farm-tag')).toHaveCount(0);

      await page.check('#planner-breeding-include-farm');
      await expect(page.locator('#planner-breeding-summary')).toContainText('4 ordered pairings · Ordinary shrine · party + farm');
      await expect(page.locator('#planner-male-grid tbody tr')).toHaveCount(2);
      const farmRow = page.locator('#planner-male-grid tbody tr').nth(1).locator('th');
      await expect(farmRow).toContainText('Healer Slime');
      await expect(farmRow.locator('.planner-farm-tag')).toHaveText('Farm');
      // The farm male is now also a column in the female-pedigree grid, tagged there too.
      const farmColumn = page.locator('#planner-female-grid thead th').nth(2);
      await expect(farmColumn).toContainText('Healer Slime');
      await expect(farmColumn.locator('.planner-farm-tag')).toHaveText('Farm');
      await expect(page.locator('.planner-farm-tag')).toHaveCount(2);

      // Unchecking removes them again.
      await page.uncheck('#planner-breeding-include-farm');
      await expect(page.locator('#planner-male-grid tbody tr')).toHaveCount(1);
      await expect(page.locator('#planner-breeding-summary')).toContainText('party only');
      await expect(page.locator('.planner-farm-tag')).toHaveCount(0);
    });

    test('suggested recipes badge each roster parent with the location it is in', async ({ page }) => {
      await page.goto(url() + '#team-planner');
      // Drake Slime breeds Winged Slime with Picky; keep one parent in each place.
      await addMonster(page, 0, 'party');
      await page.check('#planner-sex-female');
      await addMonster(page, 89, 'farm');

      await page.click('.nav a[href="#offspring-finder"]');
      await page.selectOption('#target', '2');
      await page.click('#target-pin');
      await page.click('#target-view-plan');
      await expect(page.locator('#planner-targets')).toBeVisible();
      await expect(page.locator('#plan-body')).toBeVisible();

      // The top suggestion has both parents owned, so both carry a location badge.
      const top = page.locator('#plan-suggestions .plan-suggestion').first();
      await expect(top.locator('.plan-suggestion-parents')).toHaveText('Pedigree Drake Slime + Mate Picky');
      await expect(top.locator('.plan-suggestion-badge')).toHaveText(['Pedigree in party', 'Mate in farm']);
      // Nothing is missing, so the Missing badge stays away.
      await expect(top.locator('.plan-suggestion-badge', { hasText: 'Missing' })).toHaveCount(0);

      // Moving Drake Slime to the farm rewrites its badge and nothing else.
      await page.click('#planner-tab-roster');
      await page.locator('#planner-males button[data-member-move]').click();
      await page.click('#planner-tab-targets');
      const moved = page.locator('#plan-suggestions .plan-suggestion').first();
      await expect(moved.locator('.plan-suggestion-badge')).toHaveText(['Pedigree in farm', 'Mate in farm']);
    });

    test('a full backup exported from a game-and-farm save imports into a fresh page intact', async ({ page }) => {
      await page.goto(url() + '#team-planner');
      await renameActiveTeam(page, 'DQ2 run');
      await page.selectOption('#planner-team-game', 'dqm2');
      await addMonster(page, 11, 'party');
      await page.check('#planner-sex-female');
      await addMonster(page, 99, 'farm');

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
      assert.equal(exported.activeGame, 'dqm2');
      assert.equal(exported.teams.length, 1);
      assert.equal(exported.teams[0].name, 'DQ2 run');
      assert.equal(exported.teams[0].game, 'dqm2');
      assert.deepEqual(exported.teams[0].entries.map(entry => entry.location), ['party', 'farm']);

      // Wipe the browser and start from an empty document.
      await page.evaluate(key => localStorage.removeItem(key), STORAGE_KEY);
      await page.reload();
      await expectTeamGroups(page.locator('#planner-team-select'), [
        ['Unassigned teams', ['My team']],
      ]);

      const tmp = path.join(os.tmpdir(), 'dqm-guide-game-backup.json');
      fs.writeFileSync(tmp, JSON.stringify(exported));
      if (!(await page.locator('#planner-data-tools').evaluate(el => el.open))) {
        await page.locator('#planner-data-tools > summary').click();
      }
      await page.setInputFiles('#planner-backup-import', tmp);
      await expect(page.locator('#planner-import-preview')).toBeVisible();
      await page.click('#planner-import-confirm');
      await expect(page.locator('#planner-import-preview')).toBeHidden();

      // The game assignment, the location split, and the monsters all came back.
      await expect(page.locator('#planner-game-dqm2')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.locator('#planner-team-game')).toHaveValue('dqm2');
      await expectTeamGroups(page.locator('#planner-team-select'), [
        ['DQM2 teams', ['DQ2 run']],
      ]);
      await expect(page.locator('#planner-males > .planner-card-list').first().locator('.planner-card-name')).toHaveText('Slime');
      await expect(page.locator('#planner-females > .planner-card-list').nth(1).locator('.planner-card-name')).toHaveText('Dracky');
      await expect(page.locator('#planner-team-summary')).toContainText('1 party · 1 farm');

      const restored = JSON.parse(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY));
      assert.equal(restored.activeGame, 'dqm2');
      assert.equal(restored.teams[0].game, 'dqm2');
      assert.deepEqual(restored.teams[0].entries.map(entry => entry.location), ['party', 'farm']);
    });
  });
}
