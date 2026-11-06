const { test, expect } = require('@playwright/test');
let serverUrl;
test.beforeAll(async () => { serverUrl = await (await import('../helpers/modes')).startGuideServer(); });
test.afterAll(async () => { await (await import('../helpers/modes')).stopGuideServer(); });

test('a linked monster opens its native library, stats and campaign reference', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(serverUrl + '#species-index');
  await page.locator('#species-search').fill('Slime');
  await page.locator('#species-rows a[href="#monster?id=11"]').click();
  await expect(page.locator('#monster')).toBeVisible();
  await expect(page.locator('#species-index')).toBeHidden();
  await expect(page.locator('#monster-heading')).toHaveText(await page.evaluate(() => DATA.species.find(s => s.index === 11).display_name));
  await expect(page.locator('.monster-library-quote p')).toHaveText(await page.evaluate(() => MONSTER_REFERENCE.species.find(s => s.index === 11).library.text));
  await expect(page.locator('#monster-growth-level')).toHaveValue('40');
  await expect(page.locator('#monster-skills li')).toHaveCount(3);
  await page.locator('#monster-campaign').selectOption('cobi');
  await expect(page.locator('#monster-locations')).toContainText(await page.evaluate(() => MONSTER_REFERENCE.species.find(s => s.index === 11).locations.find(place => place.game === 'cobi').name));
  await expect(page.locator('.monster-growth-row')).toHaveCount(6);
  expect(errors).toEqual([]);
});

test('growth controls show accumulated base gains without counting level-one starting stats', async ({ page }) => {
  await page.goto(serverUrl + '#monster?id=11');
  const slider = page.locator('#monster-growth-level');
  await slider.focus();
  await slider.press('Home');
  await expect(slider).toHaveValue('1');
  await expect(page.locator('.monster-growth-row').first().locator('strong')).toHaveText('+0');
  await slider.press('ArrowRight');
  await expect(slider).toHaveValue('2');
  await expect(page.locator('.monster-growth-row').first().locator('strong')).toHaveText('+8');
  await expect(slider).toBeFocused();
  await slider.press('End');
  await expect(slider).toHaveValue('99');
  await expect(page.locator('#monster-growth > .hint')).toContainText('exceeds');
});

test('profiles keep stable links across navigation and hand off selected species to breeding', async ({ page }) => {
  await page.goto(serverUrl + '#monster?id=11');
  await page.locator('.monster-breadcrumb nav a[href="#monster?id=12"]').click();
  await expect(page).toHaveURL(/#monster\?id=12$/);
  await page.goBack();
  await expect(page).toHaveURL(/#monster\?id=11$/);
  await expect(page.locator('#monster-heading')).toHaveText(await page.evaluate(() => DATA.species.find(s => s.index === 11).display_name));
  await page.locator('#monster [data-species-pedigree="11"]').click();
  await expect(page.locator('#pair-finder')).toBeVisible();
  await expect(page.locator('#pedigree')).toHaveValue('11');
  await page.locator('#result-name a').click();
  await expect(page.locator('#monster')).toBeVisible();
});

test('both pairing result headings link to the correct profiles and update after swapping', async ({ page }) => {
  await page.goto(serverUrl + '#pair-finder?a=11&b=99');
  const results = await page.evaluate(() => ({
    forward: DATA.matrix[11][99],
    reverse: DATA.matrix[99][11],
  }));
  expect(results.forward).not.toBe(results.reverse);
  for (const [heading, index] of [['result-name', results.forward], ['reverse-name', results.reverse]]) {
    const link = page.locator('#' + heading + ' > a.monster-link');
    await expect(link).toHaveAttribute('href', '#monster?id=' + index);
    const name = await link.textContent();
    await link.focus();
    await link.press('Enter');
    await expect(page.locator('#monster')).toBeVisible();
    await expect(page.locator('#monster-heading')).toHaveText(name);
    await expect(page).toHaveURL(new RegExp('#monster\\?id=' + index + '$'));
    await page.goBack();
    await expect(page.locator('#pair-finder')).toBeVisible();
  }
  await page.locator('#swap').click();
  await expect(page.locator('#result-name > a.monster-link')).toHaveAttribute('href', '#monster?id=' + results.reverse);
  await expect(page.locator('#reverse-name > a.monster-link')).toHaveAttribute('href', '#monster?id=' + results.forward);
});

test('unknown profiles recover and narrow screens keep the reference within the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(serverUrl + '#monster?id=99999');
  await expect(page.locator('#monster-heading')).toHaveText('Monster not found');
  await page.goto(serverUrl + '#monster?id=11');
  await expect(page.locator('#monster-heading')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('[data-monster-role="mate"]').click();
  await expect(page.locator('[data-monster-role="mate"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#monster-offspring .monster-offspring-row').first()).toBeVisible();
});

test('legacy profile URLs work and internal slots omit unsupported breeding trees', async ({ page }) => {
  await page.goto(serverUrl + '#monster/11');
  await expect(page.locator('#monster-heading')).toHaveText(await page.evaluate(() => DATA.species.find(s => s.index === 11).display_name));
  await page.goto(serverUrl + '#monster?id=315');
  await expect(page.locator('.monster-internal')).toBeVisible();
  await expect(page.locator('#monster .monster-primary')).toHaveCount(0);
  await expect(page.locator('#monster [data-species-parents]')).toHaveCount(0);
  await page.goto(serverUrl + '#monster/nonsense');
  await expect(page.locator('#monster-heading')).toHaveText('Monster not found');
});

test.describe('source provenance', () => {
  test.use({ serviceWorkers: 'block' });

  test('Sources and profiles distinguish a newer release from gameplay proof and handle missing metadata', async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let omitMetadata = false;
    const newerRelease = 'v99.0.0-unverified';
    await page.route('**/data/monster-reference.js*', async route => {
      const response = await route.fetch();
      const change = omitMetadata
        ? 'delete globalThis.MONSTER_REFERENCE.metadata;'
        : 'globalThis.MONSTER_REFERENCE.metadata.current_patch = {version: ' + JSON.stringify(newerRelease) + '};';
      await route.fulfill({ response, body: await response.text() + '\n' + change });
    });

    await page.goto(serverUrl + '#about');
    const expected = await page.evaluate(() => ({
      proof: MONSTER_REFERENCE.metadata.gameplay_verification.version,
      snapshot: MONSTER_REFERENCE.metadata.updated_at.slice(0, 10),
      baseline: DATA.metadata.version,
    }));
    expect(expected.proof).not.toBe(newerRelease);
    await page.getByText('Source, coverage, and verification', { exact: true }).click();
    const sources = page.locator('#source-version-summary');
    const value = (parent, label) => parent.locator('.source-versions > div').filter({ has: page.getByText(label, { exact: true }) }).locator('dd');
    await expect(value(sources, 'Latest English patch')).toHaveText(newerRelease);
    await expect(value(sources, 'Names & text snapshot')).toContainText(expected.snapshot);
    await expect(value(sources, 'Breeding & stats last verified')).toHaveText(expected.proof);
    await expect(sources).toContainText('The latest release has not yet had a separate gameplay verification.');

    await page.goto(serverUrl + '#monster?id=11');
    await page.locator('.monster-source > summary').click();
    const profile = page.locator('.monster-source');
    await expect(value(profile, 'Latest English patch')).toHaveText(newerRelease);
    await expect(value(profile, 'Breeding & stats last verified')).toHaveText(expected.proof);
    await expect(profile).toContainText('The latest release has not yet had a separate gameplay verification.');

    // Older or incomplete generated bundles must retain the original
    // gameplay attribution instead of borrowing the current release label.
    omitMetadata = true;
    await page.goto(serverUrl + '#about');
    await page.reload();
    await page.getByText('Source, coverage, and verification', { exact: true }).click();
    await expect(value(sources, 'Latest English patch')).toHaveText('Not supplied by this snapshot');
    await expect(value(sources, 'Names & text snapshot')).toHaveText('Not recorded');
    await expect(value(sources, 'Breeding & stats last verified')).toHaveText(expected.baseline);
    await expect(sources).toContainText('Gameplay retains its original extraction.');
    await expect(sources.locator('a')).toHaveCount(0);
    await page.goto(serverUrl + '#monster?id=11');
    await page.locator('.monster-source > summary').click();
    await expect(value(profile, 'Breeding & stats last verified')).toHaveText(expected.baseline);
    await expect(value(profile, 'Latest English patch')).toHaveText('Not supplied by this snapshot');
    expect(errors).toEqual([]);
  });
});
