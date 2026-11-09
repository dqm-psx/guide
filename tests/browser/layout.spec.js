const path = require('node:path');
const { test, expect } = require('@playwright/test');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FILE_URL = 'file://' + path.join(REPO_ROOT, 'index.html');

// Layout and styling for the feature layer (css/features.css). A missing
// stylesheet 404s quietly, so these checks read the computed values the
// browser actually applied rather than the file contents. Nothing here needs
// the static server, so it runs once against the shipped file, fast.
test.describe('sticky chrome and feature surfaces', () => {
  test('the main navigation sticks to the top of the viewport', async ({ page }) => {
    await page.goto(FILE_URL + '#species-index');

    const bar = await page.evaluate(() => {
      const style = getComputedStyle(document.querySelector('.nav'));
      return { position: style.position, top: style.top, zIndex: Number(style.zIndex) };
    });
    expect(bar.position).toBe('sticky');
    expect(bar.top).toBe('0px');
    // Above the panels and the matrix's own sticky headers (z-index 3).
    expect(bar.zIndex).toBeGreaterThan(5);

    // Scroll well past the bar and it is still pinned to the very top.
    await page.evaluate(() => window.scrollTo({ top: 1200, behavior: 'instant' }));
    await expect
      .poll(() => page.evaluate(() => Math.round(document.querySelector('.nav').getBoundingClientRect().top)))
      .toBe(0);
  });

  test('anchor targets clear the sticky bar', async ({ page }) => {
    await page.goto(FILE_URL + '#conditional-rules');
    await expect(page.locator('#offspring-finder')).toBeVisible();

    const spacing = await page.evaluate(() => ({
      conditional: getComputedStyle(document.querySelector('#breeding-conditions')).scrollMarginTop,
      names: getComputedStyle(document.querySelector('#name-guide')).scrollMarginTop,
      section: getComputedStyle(document.querySelector('.section')).scrollMarginTop,
      viewHeading: getComputedStyle(document.querySelector('#breeding-table-heading')).scrollMarginTop,
      matrixPanel: getComputedStyle(document.querySelector('.planner-matrix-panel')).scrollMarginTop,
      html: getComputedStyle(document.documentElement).scrollPaddingTop,
    }));
    const offsets = Object.values(spacing);
    for (const value of offsets) expect(parseFloat(value)).toBeGreaterThan(0);
    // Every anchor target clears the same sticky chrome.
    expect(new Set(offsets).size).toBe(1);
  });

  test('hover opens one navigation menu at a time and exposes every destination', async ({ page }) => {
    await page.goto(FILE_URL);
    const destinations = {
      adventure: ['#field-guide','#field-guide?kind=story','#field-guide?kind=quest','#field-guide?kind=boss','#atlas','#field-guide?kind=location','#atlas?tab=encounters'],
      reference: ['#field-guide?kind=npc','#field-guide?kind=item','#field-guide?kind=tool','#field-guide?kind=skill','#field-guide?kind=mechanic'],
      breeding: ['#pair-finder','#breeding-tree','#breeding-table'],
    };
    await expect(page.locator('.nav-links:visible')).toHaveCount(0);
    for (const [name,hrefs] of Object.entries(destinations)) {
      const trigger = page.locator('#' + name + '-nav-trigger');
      const menu = page.locator('#' + name + '-nav-links');
      await trigger.hover();
      // Pin Adventure before moving to Reference to check that the new menu
      // dismisses even a menu that would otherwise remain open on pointerleave.
      if (name === 'adventure') await trigger.click();
      await expect(trigger).toHaveAttribute('aria-expanded','true');
      await expect(menu).toBeVisible();
      await expect(page.locator('.nav-links:visible')).toHaveCount(1);
      await expect(page.locator('.nav-trigger[aria-expanded="true"]')).toHaveCount(1);
      expect(await menu.locator('a').evaluateAll(links => links.map(a => a.getAttribute('href')))).toEqual(hrefs);
      await menu.locator('a').last().hover();
      await expect(menu).toBeVisible();
    }
    await expect(page.locator('#breeding-nav-links a')).toHaveText(['Breeding lookup','Breeding tree','Breeding table']);
    await page.locator('.masthead').hover();
    await expect(page.locator('.nav-links:visible')).toHaveCount(0);
    await expect(page.locator('.nav-trigger[aria-expanded="true"]')).toHaveCount(0);
    await expect(page.locator('footer a[href="https://dqm-psx.github.io/translations/"]')).toBeVisible();
  });
});
