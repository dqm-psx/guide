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

  test('the views and project navigation each expose their own destinations', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(FILE_URL);

    const project = page.getByRole('navigation', { name: 'DQM PSX project' });
    await expect(project.getByRole('link', { name: 'DQM PSX home' })).toHaveAttribute('href', 'https://dqm-psx.github.io/');
    await expect(project.getByRole('link', { name: 'Patch' })).toHaveAttribute('href', 'https://dqm-psx.github.io/#download');
    await expect(project.getByRole('link', { name: 'Translations' })).toHaveAttribute('href', 'https://dqm-psx.github.io/translations/');
    await expect(project.locator('[aria-current="page"]')).toHaveText('Guide');
    // All four labels fit a single row on a small phone.
    expect(await project.evaluate(nav => new Set([...nav.children].map(item => item.offsetTop)).size)).toBe(1);

    const shape = await page.evaluate(() => {
      const nav = document.querySelector('.nav nav');
      const children = [...nav.childNodes];
      return {
        childTypes: children.map(node => node.nodeType),
        hrefs: [...nav.children].map(child => child.getAttribute('href')),
        allLinks: [...nav.children].every(child => child.tagName === 'A'),
        gap: parseFloat(getComputedStyle(nav).columnGap),
      };
    });
    // Only element children: no spacer text nodes between the links.
    expect(shape.childTypes).toEqual(shape.childTypes.map(() => 1));
    expect(shape.allLinks).toBe(true);
    expect(shape.hrefs).toEqual([
      '#pair-finder',
      '#offspring-finder',
      '#breeding-tree',
      '#breeding-table',
      '#species-index',
      '#team-planner',
    ]);
    expect(shape.gap).toBeGreaterThan(0);
  });

});
