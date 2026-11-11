const {expect} = require('@playwright/test');

async function openMonsterEditor(page) {
  const dialog=page.locator('#planner-entry-dialog');
  if (!(await dialog.isVisible())) {
    const button = page.locator('#planner-open-add');
    await (await button.isVisible() ? button : page.locator('[data-planner-open="add"]')).click();
  }
  await expect(dialog).toBeVisible();
}

async function closeMonsterEditor(page) {
  if (await page.locator('#planner-entry-dialog').isVisible()) await page.keyboard.press('Escape');
}

async function openTeamSettings(page) {
  await closeMonsterEditor(page);
  const details=page.locator('#manage-teams');
  if (!(await details.evaluate(node=>node.open))) await details.locator(':scope > summary').click();
}

async function memberAction(page, selector) {
  const button=typeof selector==='string' ? page.locator(selector) : selector;
  const menu=button.locator('xpath=ancestor::details[1]');
  if (await menu.count() && !(await menu.evaluate(node=>node.open))) await menu.locator(':scope > summary').click();
  await button.click();
}

module.exports={openMonsterEditor,closeMonsterEditor,openTeamSettings,memberAction};
