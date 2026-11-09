const {test, expect} = require('@playwright/test');
let url;
test.beforeAll(async () => { url = await (await import('../helpers/modes')).startGuideServer(); });
test.afterAll(async () => { await (await import('../helpers/modes')).stopGuideServer(); });

test('recipe list searches the whole filtered matrix and links its exact results', async ({page}) => {
  await page.goto(url + '#breeding-table');
  await page.selectOption('#planner-row-family','0');
  await page.selectOption('#planner-column-family','3');
  await page.fill('#matrix-result-search','WingSlime');
  await page.selectOption('#matrix-view','list');
  const expected = await page.evaluate(() => {
    const core = DQMPlannerCore.create(DATA);
    return DATA.species.filter(s=>s.playable!==false && s.family_id===0).flatMap(a=>
      DATA.species.filter(s=>s.playable!==false && s.family_id===3).filter(b=>core.result(a.index,b.index,0,0,'shrine').resultIndex===2));
  });
  await expect(page.locator('#matrix-filter-status')).toContainText(expected.length+' matching recipes');
  await expect(page.locator('#planner-all-grid tbody tr')).toHaveCount(Math.min(expected.length,48));
  await expect(page.locator('#planner-all-grid tbody tr').first().locator('td').nth(2).locator('a')).toHaveAttribute('href','#monster?id=2');
  await page.locator('#planner-all-grid button[data-planner-pair]').first().click();
  await expect(page.locator('#planner-pair-detail')).toBeVisible();
  await page.locator('#planner-all-grid tbody tr').first().locator('td').nth(2).locator('a').click();
  await expect(page.locator('#monster')).toBeVisible();
});

test('page size, swap and reset preserve ordered inputs and recover empty results', async ({page}) => {
  await page.goto(url+'#breeding-table');
  await page.selectOption('#matrix-page-size','8');
  await expect(page.locator('#planner-all-grid tbody tr')).toHaveCount(8);
  await expect(page.locator('#planner-all-grid thead th')).toHaveCount(9);
  await page.fill('#planner-row-search','Slime');
  await page.fill('#planner-column-search','Dracky');
  await page.fill('#planner-row-plus','4');
  await page.click('#matrix-swap-axes');
  await expect(page.locator('#planner-column-search')).toHaveValue('Slime');
  await expect(page.locator('#planner-column-plus')).toHaveValue('4');
  await expect(page.locator('#planner-row-search')).toHaveValue('Dracky');
  await page.fill('#matrix-result-search','no-such-monster');
  await page.selectOption('#matrix-view','list');
  await expect(page.locator('#planner-all-grid')).toContainText('No recipes match');
  await page.click('#matrix-reset');
  await expect(page.locator('#matrix-result-search')).toHaveValue('');
  await expect(page.locator('#planner-column-plus')).toHaveValue('0');
  await expect(page.locator('#planner-all-grid tbody tr')).toHaveCount(32);
});

test('matrix arrow navigation follows ordered rows and columns', async ({page}) => {
  await page.goto(url+'#breeding-table');
  const cells = page.locator('#planner-all-grid tbody tr').first().locator('button.planner-cell');
  await cells.first().focus();
  await cells.first().press('ArrowRight');
  await expect(cells.nth(1)).toBeFocused();
  await cells.nth(1).press('ArrowDown');
  await expect(page.locator('#planner-all-grid tbody tr').nth(1).locator('button.planner-cell').nth(1)).toBeFocused();
  await expect(page.locator('#planner-all-grid thead th').nth(2)).toHaveClass(/planner-crosshair/);
});

test('invalid plus values never render a guessed recipe', async ({page}) => {
  await page.goto(url+'#breeding-table');
  await page.selectOption('#matrix-view','list');
  await page.fill('#planner-row-plus','');
  await expect(page.locator('#planner-all-summary')).toContainText('whole + value');
  await expect(page.locator('#planner-all-grid tbody tr')).toHaveCount(0);
  await expect(page.locator('#planner-row-next')).toBeDisabled();
});

test('phone layout contains table scrolling and keeps profile navigation usable', async ({page}) => {
  await page.setViewportSize({width:360,height:780});
  await page.goto(url+'#breeding-table');
  await expect(page.locator('#matrix-view')).toHaveValue('list');
  await expect(page.locator('#matrix-view')).toBeHidden();
  await expect(page.locator('#planner-all-grid.matrix-list tbody a').first()).toBeVisible();
  expect(await page.locator('#planner-all-grid').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
  await page.locator('#matrix-filters summary').click();
  await expect(page.locator('#matrix-view')).toBeVisible();
  await page.selectOption('#matrix-view','grid');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.selectOption('#matrix-view','list');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.locator('#planner-all-grid tbody a').first().click();
  await expect(page.locator('#monster')).toBeVisible();
});

test('matrix applies entered plus thresholds and switches room overrides with context', async ({page}) => {
  await page.goto(url + '#breeding-table');
  const names = await page.evaluate(() => ({
    slime: DATA.species[11].name,
    king: DATA.species[9].display_name || DATA.species[9].name,
    healer: DATA.species[13].name,
    zombie: DATA.species.find(s => s.playable && s.family_id === 7).name,
    zombieId: DATA.species.find(s => s.playable && s.family_id === 7).index,
    angel: DATA.species[19].display_name || DATA.species[19].name,
  }));
  await page.fill('#planner-row-search', names.slime);
  await page.fill('#planner-column-search', names.slime);
  await page.selectOption('#matrix-page-size', '24');
  await page.fill('#planner-row-plus', '4');
  const slimePair = page.locator('#planner-all-grid [data-a="11"][data-b="11"]');
  await expect(slimePair).toContainText(names.king);
  await expect(slimePair).toContainText('+ rule');
  await page.selectOption('#planner-all-context', 'base');
  await expect(slimePair).not.toContainText('+ rule');
  await page.fill('#planner-row-search', names.healer);
  await page.fill('#planner-column-search', names.zombie);
  await page.selectOption('#planner-all-context', 'room');
  const roomPair = page.locator('#planner-all-grid [data-a="13"][data-b="' + names.zombieId + '"]');
  await expect(roomPair).toContainText(names.angel);
  await expect(roomPair).toContainText('Room rule');
  await page.selectOption('#planner-all-context', 'shrine');
  await expect(roomPair).not.toContainText('Room rule');
});
