const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FILE_URL = 'file://' + path.join(REPO_ROOT, 'index.html');
let serverUrl = null;

const STORAGE_KEY = 'dqm-guide-state-v61-v1';
const SPRITE_STYLE_KEY = 'dqm-guide-sprite-style-v1';

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

    test('saved team under the existing storage key renders after reload', async ({ page }) => {
      const team = {
        version: 1,
        game: 'dqm1-2-ps1-v61',
        entries: [
          { id: 'm-seed-1', speciesIndex: 11, sex: 'male', plus: 0, nickname: '' },
          { id: 'm-seed-2', speciesIndex: 99, sex: 'female', plus: 2, nickname: 'Drake' },
        ],
      };
      await page.addInitScript(seed => {
        localStorage.setItem('dqm-guide-team-v61-v1', JSON.stringify(seed));
      }, team);
      await page.goto(url() + '#team-planner');
      await page.reload();
      await expect(page.locator('#planner-males .planner-card')).toHaveCount(1);
      await expect(page.locator('#planner-females .planner-card')).toHaveCount(1);
      await expect(page.locator('#planner-males .planner-card-name')).toHaveText('Slime');
      await expect(page.locator('#planner-females .planner-card-name')).toHaveText('Drake');
    });

    test('export team downloads the versioned JSON document', async ({ page }) => {
      const team = {
        version: 1,
        game: 'dqm1-2-ps1-v61',
        entries: [
          { id: 'm-seed-1', speciesIndex: 11, sex: 'male', plus: 3, nickname: 'Slimo' },
        ],
      };
      await page.addInitScript(seed => {
        localStorage.setItem('dqm-guide-team-v61-v1', JSON.stringify(seed));
      }, team);
      await page.goto(url() + '#team-planner');
      if (!(await page.locator('#planner-data-tools').evaluate(el => el.open))) {
        await page.locator('#planner-data-tools > summary').click();
      }
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.click('#planner-export'),
      ]);
      assert.equal(download.suggestedFilename(), 'DQM-guide-team-v61.json');
      const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
      assert.equal(exported.version, 2);
      assert.equal(exported.game, 'dqm1-2-ps1-v61');
      assert.equal(exported.entries.length, 1);
      assert.equal(exported.entries[0].nickname, 'Slimo');
    });

    test('import team adds the imported team as a new named team', async ({ page }) => {
      const team = {
        version: 1,
        game: 'dqm1-2-ps1-v61',
        entries: [
          { id: 'm-imp-1', speciesIndex: 13, sex: 'female', plus: 5, nickname: 'Healy' },
          { id: 'm-imp-2', speciesIndex: 199, sex: 'male', plus: 0, nickname: '' },
        ],
      };
      const tmp = path.join(os.tmpdir(), 'dqm-guide-import-test.json');
      fs.writeFileSync(tmp, JSON.stringify(team));
      await page.goto(url() + '#team-planner');
      if (!(await page.locator('#planner-data-tools').evaluate(el => el.open))) {
        await page.locator('#planner-data-tools > summary').click();
      }
      await page.setInputFiles('#planner-import', tmp);
      await expect(page.locator('#planner-team-select option')).toHaveCount(2);
      await expect(page.locator('#planner-team-select option')).toHaveText(['My team', 'dqm-guide-import-test']);
      await expect(page.locator('#planner-females .planner-card')).toHaveCount(1);
      await expect(page.locator('#planner-males .planner-card')).toHaveCount(1);
      await expect(page.locator('#planner-females .planner-card-name')).toHaveText('Healy');
      const saved = JSON.parse(await page.evaluate(key => localStorage.getItem(key), STORAGE_KEY));
      assert.equal(saved.version, 2);
      assert.equal(saved.teams.length, 2);
      assert.equal(saved.teams[1].name, 'dqm-guide-import-test');
      assert.equal(saved.teams[1].entries.length, 2);
      assert.equal(saved.activeTeamId, saved.teams[1].id);
    });

    test('sprite style preference persists under its storage key', async ({ page }) => {
      await page.goto(url());
      await page.click('button[data-sprite-style="overworld"]');
      await expect(page.locator('#pedigree-sprite img')).toHaveAttribute('data-sprite-kind', 'overworld');
      await page.reload();
      await expect(page.locator('#pedigree-sprite img')).toHaveAttribute('data-sprite-kind', 'overworld');
      const stored = await page.evaluate(key => localStorage.getItem(key), SPRITE_STYLE_KEY);
      assert.equal(stored, 'overworld');
    });

    test('add, edit, switch sex, remove, and undo a monster', async ({ page }) => {
      await page.goto(url() + '#team-planner');
      await page.selectOption('#planner-add-species', '11');
      await page.click('#planner-add-button');
      await expect(page.locator('#planner-males .planner-card')).toHaveCount(1);
      await expect(page.locator('#planner-males .planner-card-name')).toHaveText('Slime');

      await page.click('#planner-males button[data-member-edit]');
      await page.fill('#planner-add-nickname', 'Slimo');
      await page.click('#planner-add-button');
      await expect(page.locator('#planner-males .planner-card-name')).toHaveText('Slimo');

      await page.click('#planner-males button[data-member-switch]');
      await expect(page.locator('#planner-females .planner-card')).toHaveCount(1);
      await expect(page.locator('#planner-males .planner-card')).toHaveCount(0);
      await page.click('#planner-undo');
      await expect(page.locator('#planner-males .planner-card')).toHaveCount(1);
      await expect(page.locator('#planner-females .planner-card')).toHaveCount(0);

      await page.click('#planner-males button[data-member-remove]');
      await expect(page.locator('#planner-males .planner-card')).toHaveCount(0);
      await page.click('#planner-undo');
      await expect(page.locator('#planner-males .planner-card')).toHaveCount(1);
      await expect(page.locator('#planner-males .planner-card-name')).toHaveText('Slimo');
    });

    test('breeding table opens directly at full width and preserves filters through Back', async ({ page }) => {
      await page.setViewportSize({ width: 1600, height: 1000 });
      await page.goto(url() + '#breeding-table');
      await expect(page.locator('#breeding-table')).toBeVisible();
      await expect(page.locator('#planner-all-grid tbody tr')).toHaveCount(12);
      await expect(page.locator('#planner-all-grid thead th')).toHaveCount(13);
      await expect(page.locator('.view:visible')).toHaveCount(1);
      const dimensions = await page.locator('#planner-all-grid').evaluate(grid => ({
        width: grid.getBoundingClientRect().width,
        maxHeight: getComputedStyle(grid).maxHeight,
        clientHeight: grid.clientHeight,
        scrollHeight: grid.scrollHeight,
        boxed: Boolean(grid.closest('.panel')),
        documentWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.width).toBeGreaterThan(1500);
      expect(dimensions.maxHeight).toBe('none');
      expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.clientHeight + 1);
      expect(dimensions.boxed).toBe(false);
      expect(dimensions.documentWidth).toBeLessThanOrEqual(1600);

      await page.fill('#planner-row-search', 'Slime');
      await page.fill('#planner-column-plus', '4');
      await page.click('#planner-row-next');
      const rowRange = await page.locator('#planner-row-range').textContent();
      const cell = page.locator('#planner-all-grid button[data-planner-pair]').first();
      const pedigree = await cell.getAttribute('data-a');
      const mate = await cell.getAttribute('data-b');
      await cell.click();
      await expect(page.locator('#planner-all-detail-host #planner-pair-detail')).toBeVisible();
      await page.click('#planner-copy-pairing');
      await expect(page.locator('#planner-pair-copy-status')).toBeVisible();
      await expect(page.locator('#planner-pair-copy-status')).toContainText('Pedigree');
      await page.click('#planner-inspect-reference');
      await expect(page.locator('#pair-finder')).toBeVisible();
      await expect(page.locator('#pedigree')).toHaveValue(pedigree);
      await expect(page.locator('#mate')).toHaveValue(mate);
      await page.goBack();
      await expect(page.locator('#breeding-table')).toBeVisible();
      await expect(page.locator('#planner-row-search')).toHaveValue('Slime');
      await expect(page.locator('#planner-column-plus')).toHaveValue('4');
      await expect(page.locator('#planner-row-range')).toHaveText(rowRange);

      // The same detail controls must still work after returning to a team grid.
      await page.click('.nav a[href="#team-planner"]');
      await page.click('#planner-demo');
      await page.click('#planner-tab-breeding');
      await page.locator('#planner-male-grid button[data-planner-pair]').first().click();
      await expect(page.locator('#planner-team-detail-host #planner-pair-detail')).toBeVisible();
      await expect(page.locator('#breeding-table')).toBeHidden();
      await page.click('.nav a[href="#breeding-table"]');
      await expect(page.locator('#planner-row-range')).toHaveText(rowRange);
      await page.locator('#planner-all-grid button[data-planner-pair]').first().click();
      await expect(page.locator('#planner-all-detail-host #planner-pair-detail')).toBeVisible();
      await expect(page.locator('#team-planner')).toBeHidden();
    });

    test('breeding table scrolls columns without clipping rows on a narrow screen', async ({ page }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(url() + '#breeding-table');
      const grid = page.locator('#planner-all-grid');
      await expect(grid.locator('tbody tr')).toHaveCount(12);
      const dimensions = await grid.evaluate(element => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        clientHeight: element.clientHeight,
        scrollHeight: element.scrollHeight,
        maxHeight: getComputedStyle(element).maxHeight,
        documentWidth: document.documentElement.scrollWidth,
      }));
      expect(dimensions.documentWidth).toBeLessThanOrEqual(390);
      expect(dimensions.scrollWidth).toBeGreaterThan(dimensions.clientWidth);
      expect(dimensions.maxHeight).toBe('none');
      expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.clientHeight + 1);
      await grid.locator('tbody tr').first().locator('button').last().click();
      await expect(page.locator('#planner-all-detail-host #planner-pair-detail')).toBeVisible();
      expect(await grid.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    });

    test('team breeding and breeding table pagination work', async ({ page }) => {
      await page.goto(url() + '#team-planner');
      await page.click('#planner-demo');
      await expect(page.locator('#planner-males .planner-card')).toHaveCount(2);
      await expect(page.locator('#planner-females .planner-card')).toHaveCount(3);

      await page.click('#planner-tab-breeding');
      await expect(page.locator('#planner-breeding')).toBeVisible();
      await expect(page.locator('#planner-roster')).toBeHidden();
      await expect(page.locator('#planner-male-grid tbody tr')).toHaveCount(2);
      await expect(page.locator('#planner-female-grid tbody tr')).toHaveCount(3);

      await page.click('.nav a[href="#breeding-table"]');
      await expect(page.locator('#breeding-table')).toBeVisible();
      await expect(page.locator('#team-planner')).toBeHidden();
      await expect(page.locator('#planner-row-range')).toHaveText('Rows 1–12 of 315');
      await expect(page.locator('#planner-row-prev')).toBeDisabled();
      await page.click('#planner-row-next');
      await expect(page.locator('#planner-row-range')).toHaveText('Rows 13–24 of 315');
      await expect(page.locator('#planner-row-prev')).toBeEnabled();
      await page.click('#planner-row-prev');
      await expect(page.locator('#planner-row-range')).toHaveText('Rows 1–12 of 315');
    });
  });
}
