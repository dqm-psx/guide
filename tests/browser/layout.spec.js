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
    await page.goto(FILE_URL);

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
    await page.goto(FILE_URL + '#rules-guide');
    await expect(page.locator('#rules-guide')).toBeVisible();

    const spacing = await page.evaluate(() => ({
      conditional: getComputedStyle(document.querySelector('#conditional-rules')).scrollMarginTop,
      about: getComputedStyle(document.querySelector('#about')).scrollMarginTop,
      section: getComputedStyle(document.querySelector('.section')).scrollMarginTop,
      viewHeading: getComputedStyle(document.querySelector('.view > h2')).scrollMarginTop,
      matrixPanel: getComputedStyle(document.querySelector('.planner-matrix-panel')).scrollMarginTop,
      html: getComputedStyle(document.documentElement).scrollPaddingTop,
    }));
    for (const value of Object.values(spacing)) expect(value).toBe('76px');
  });

  test('the nav still holds only element children, as five direct links', async ({ page }) => {
    await page.goto(FILE_URL);

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
    expect(shape.childTypes.length).toBe(5);
    expect(shape.childTypes).toEqual(shape.childTypes.map(() => 1));
    expect(shape.allLinks).toBe(true);
    expect(shape.hrefs).toEqual([
      '#pair-finder',
      '#offspring-finder',
      '#species-index',
      '#team-planner',
      '#rules-guide',
    ]);
    expect(shape.gap).toBeGreaterThan(0);
  });

  test('the empty-filter block is styled and its recovery button is visible', async ({ page }) => {
    await page.goto(FILE_URL + '#offspring-finder');
    await expect(page.locator('#offspring-finder')).toBeVisible();

    // The renderer builds this block at runtime; mount the same markup to
    // check the styling it will receive.
    await page.evaluate(() => {
      const host = document.querySelector('#offspring-finder');
      const fixture = document.createElement('div');
      fixture.id = 'layout-empty-fixture';
      fixture.innerHTML =
        '<div class="filter-empty">' +
        '<p class="filter-empty-message">No monsters match these filters.</p>' +
        '<p class="filter-empty-active">Active filters:</p>' +
        '<p class="filter-chips"><span class="filter-chip">Family: Slime</span><span class="filter-chip">Rank: A</span></p>' +
        '<button class="filter-clear" type="button" data-clear-filters="reverse">Clear filters</button>' +
        '</div>';
      host.appendChild(fixture);
    });

    await expect(page.locator('#layout-empty-fixture .filter-empty .filter-clear')).toBeVisible();
    await expect(page.locator('#layout-empty-fixture .filter-chip')).toHaveCount(2);

    const styles = await page.evaluate(() => {
      const root = document.querySelector('#layout-empty-fixture');
      return {
        textAlign: getComputedStyle(root.querySelector('.filter-empty')).textAlign,
        messageColor: getComputedStyle(root.querySelector('.filter-empty-message')).color,
        chipRadius: getComputedStyle(root.querySelector('.filter-chip')).borderRadius,
      };
    });
    expect(styles.textAlign).toBe('center');
    expect(styles.messageColor).toBe('rgb(22, 49, 67)');
    expect(styles.chipRadius).toBe('20px');
  });
});
