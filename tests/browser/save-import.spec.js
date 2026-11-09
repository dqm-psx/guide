const {test, expect} = require('@playwright/test');
let url, fixture;
test.beforeAll(async () => {
  const {startGuideServer} = await import('../helpers/modes');
  fixture = await import('../helpers/psx-save');
  url = await startGuideServer();
});
test.afterAll(async () => {
  const {stopGuideServer} = await import('../helpers/modes');
  await stopGuideServer();
});

test('previews a local card, creates a team in its campaign and uses it in both parent orders', async ({page}) => {
  const writes = [];
  page.on('request', req => { if (req.method() !== 'GET') writes.push(req.method()); });
  await page.goto(url + '#team-planner');
  const team = page.locator('#planner-team-select');
  const original = await team.inputValue();
  const card = fixture.card([[1, 5, fixture.block()], [2, 7, fixture.block(2)]]);
  const file = {name: 'example.mcd', mimeType: 'application/octet-stream', buffer: card};
  await page.getByRole('button', {name: 'Import a PlayStation save', exact: true}).setInputFiles(file);
  await expect(page.locator('#save-import-status')).toContainText('2 saves');
  await page.getByLabel('Save slot', {exact: true}).selectOption({index: 1});
  await expect(page.locator('#save-import-summary')).toContainText('1 party · 2 farm');
  await expect(page.locator('#save-import-summary')).toContainText('2 unhatched eggs');
  await page.getByText('Review monsters (3)').click();
  await expect(page.locator('#save-import-summary th[scope="row"]').first()).toContainText('Bob');
  await page.getByLabel('Use English-patch monster nicknames').uncheck();
  await expect(page.locator('#save-import-summary')).not.toContainText('Bob');
  await page.getByLabel('Use English-patch monster nicknames').check();
  await expect(team).toHaveValue(original);
  await page.getByRole('button', {name: 'Create team from save'}).click();
  await expect(team.locator('option:checked')).toHaveText('DQM2 · Tara · Slot 7');
  await expect(page.locator('#planner-males')).toContainText('Lv 30');
  await expect(page.locator('#planner-males').getByRole('link', {name: 'Bob'})).toHaveAttribute('href', '#monster?id=26');
  await page.getByRole('tab', {name: 'Team breeding'}).click();
  await page.getByLabel('Include farm monsters').check();
  await expect(page.locator('#planner-male-grid a[href="#monster?id=26"]')).toBeVisible();
  await expect(page.locator('#planner-female-grid a[href="#monster?id=0"]')).toBeVisible();
  await page.reload();
  await expect(team.locator('option:checked')).toHaveText('DQM2 · Tara · Slot 7');
  await expect(team.locator('option[value="' + original + '"]')).toHaveCount(1);
  expect(writes).toEqual([]);
});

test('rejects damaged bytes and cancellation leaves the current team available', async ({page}) => {
  await page.goto(url + '#team-planner');
  const team = page.locator('#planner-team-select');
  const original = await team.inputValue();
  const file = {name: 'slot.sav', mimeType: 'application/octet-stream', buffer: fixture.block()};
  const input = page.getByRole('button', {name: 'Import a PlayStation save', exact: true});
  await input.setInputFiles(file);
  await page.locator('#save-import-cancel').click();
  await expect(page.locator('#save-import-preview')).toBeHidden();
  file.buffer[0x1000] ^= 1;
  await input.setInputFiles(file);
  await expect(page.locator('#save-import-status')).toContainText('checksum');
  await expect(page.locator('#save-import-preview')).toBeHidden();
  await expect(team).toHaveValue(original);
});
