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

  test('desktop guide contents link directly to both adventures and stay in place when navigating', async ({ page }) => {
    await page.goto(FILE_URL);
    const nav = page.getByRole('navigation', {name:'Guide contents'});
    await expect(page.getByRole('button',{name:'Browse guide'})).toBeHidden();
    await expect(nav.getByRole('heading')).toHaveText(['Breeding tools','Reference','Places','Walkthroughs']);
    for (const name of ['Guide home','Terry','Cobi & Tara','Locations & maps','Characters','Monster library','My game']) {
      await expect(nav.getByRole('link',{name,exact:true})).toBeVisible();
    }
    const terry = nav.getByRole('link',{name:'Terry',exact:true});
    await terry.click();
    await expect(terry).toHaveAttribute('aria-current','page');
    await expect(page.locator('#article-title')).toBeFocused();
    const siblings = nav.getByRole('link',{name:'Locations & maps',exact:true});
    await siblings.click();
    await expect(siblings).toHaveAttribute('aria-current','page');
    await expect(page.locator('#directory-title')).toBeFocused();
    await page.goBack();
    await expect(terry).toHaveAttribute('aria-current','page');
    await expect(nav).toBeVisible();
  });

  test('Guide home leads with the five breeding shortcuts', async ({ page }) => {
    await page.goto(FILE_URL);
    const home = page.locator('#guide-home');
    await expect(home.getByRole('heading').first()).toHaveText('Breeding tools');
    await expect(home.getByRole('heading', {name:'Walkthroughs'})).toBeVisible();

    const tools = home.getByRole('region', {name:'Breeding tools'});
    const destinations = [
      ['Find offspring', '#pair-finder'],
      ['Find parents', '#offspring-finder'],
      ['Plan a breeding tree', '#breeding-tree'],
      ['Compare parent pairs', '#breeding-table'],
      ['Import a memory card', '#team-planner?import=save'],
    ];
    for (const [label, href] of destinations) {
      const shortcut = tools.getByRole('link', {name:label});
      await expect(shortcut).toBeVisible();
      await expect(shortcut).toHaveAttribute('href', href);
      const sprites = shortcut.locator('img');
      await expect(sprites.first()).toBeVisible();
      for (const sprite of await sprites.all()) {
        await expect(sprite).toHaveAttribute('alt', '');
        await sprite.evaluate(image => image.decode());
      }
    }
    await page.locator('a.skip').focus();
    await page.keyboard.press('Enter');
    await expect(home.getByRole('heading', {name:'Breeding tools'})).toBeFocused();
  });
});
