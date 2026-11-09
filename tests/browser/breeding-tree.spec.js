const { test, expect } = require('@playwright/test');
let serverUrl;
test.beforeAll(async () => { const { startGuideServer } = await import('../helpers/modes'); serverUrl = await startGuideServer(); });
test.afterAll(async () => { const { stopGuideServer } = await import('../helpers/modes'); await stopGuideServer(); });

test('deep-linked tree expands a parent and preserves the branches on reload', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(serverUrl + '#breeding-tree?target=290&context=shrine');
  await expect(page.locator('#breeding-tree')).toBeVisible();
  await expect(page.locator('#tree-target')).toHaveValue('290');
  await expect(page.locator('.tree-node')).toHaveCount(3);
  await page.locator('[data-tree-select="0"]').click();
  await page.locator('[data-tree-recipe]:not([disabled])').first().click();
  await expect(page.locator('.tree-node')).toHaveCount(5);
  await expect(page).toHaveURL(/branches=/);
  await page.reload();
  await expect(page.locator('.tree-node')).toHaveCount(5);
  await expect(page.locator('.tree-node a[href^="#monster?id="]')).toHaveCount(5);
  expect(errors).toEqual([]);
});

test('hiding a branch is reversible and Undo restores the earlier tree', async ({ page }) => {
  await page.goto(serverUrl + '#breeding-tree?target=290&context=shrine');
  await page.locator('[data-tree-collapse=""]').click();
  await expect(page.locator('.tree-node')).toHaveCount(1);
  await expect(page.locator('[data-tree-collapse=""]')).toHaveAttribute('aria-expanded', 'false');
  await page.locator('#tree-undo').click();
  await expect(page.locator('.tree-node')).toHaveCount(3);
  await expect(page.locator('#tree-target-combobox')).toBeFocused();
  await page.locator('#tree-clear').click();
  await expect(page.locator('.tree-node')).toHaveCount(1);
  await page.locator('#tree-undo').click();
  await expect(page.locator('.tree-node')).toHaveCount(3);
  await page.selectOption('#tree-context', 'room');
  await expect(page.locator('#tree-message')).toContainText('restarted');
  await page.locator('#tree-undo').click();
  await expect(page.locator('#tree-context')).toHaveValue('shrine');
});

test('mobile tree keeps the page within the viewport while the diagram scrolls', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(serverUrl + '#breeding-tree?target=290&context=shrine');
  await expect(page.locator('#tree-canvas')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(await page.locator('#tree-canvas').evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
  await page.locator('[data-tree-select="0"]').click();
  await expect(page.locator('#tree-recipes-heading')).toBeFocused();
  await page.fill('#tree-recipe-search', 'no-such-parent-zzzz');
  await expect(page.locator('#tree-recipe-list')).toContainText('No parent names match');
});

test('a team plan opens the same explored branches and a cleared tree stays clear in a shared link', async ({ page }) => {
  await page.goto(serverUrl + '#breeding-tree?target=290');
  await page.locator('[data-tree-select="0"]').click();
  await page.locator('[data-tree-recipe]:not([disabled])').first().click();
  const branches = await page.evaluate(() => new URLSearchParams(location.hash.split('?')[1]).get('branches'));
  await page.locator('#tree-owned').click();
  await expect(page.locator('#team-open-tree')).toBeVisible();
  await page.locator('#team-open-tree').click();
  await expect(page.locator('.tree-node')).toHaveCount(5);
  expect(await page.evaluate(() => new URLSearchParams(location.hash.split('?')[1]).get('branches'))).toBe(branches);
  await page.locator('[data-tree-select=""]').click();
  await page.locator('#tree-clear').click();
  await expect(page.locator('.tree-node')).toHaveCount(1);
  await page.reload();
  await expect(page.locator('.tree-node')).toHaveCount(1);
});

test('a malformed shared tree retains the saved tree and offers a usable view', async ({ page }) => {
  await page.goto(serverUrl + '#breeding-tree?target=290&context=shrine');
  await page.goto(serverUrl + '#breeding-tree?target=999&context=shrine');
  await expect(page.locator('#tree-message')).toContainText('unknown target');
  await expect(page.locator('#tree-target')).toHaveValue('290');
  await expect(page.locator('.tree-node')).toHaveCount(3);
});
