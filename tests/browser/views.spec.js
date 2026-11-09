const fs = require('node:fs');
const path = require('node:path');
const { test, expect } = require('@playwright/test');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const FILE_URL = 'file://' + path.join(REPO_ROOT, 'index.html');
let serverUrl = null;

test.beforeAll(async () => {
  const { startGuideServer } = await import('../helpers/modes');
  serverUrl = await startGuideServer();
});

test.afterAll(async () => {
  const { stopGuideServer } = await import('../helpers/modes');
  await stopGuideServer();
});

const VIEWS = [
  { hash: '#field-guide', id: 'field-guide' },
  { hash: '#atlas', id: 'atlas' },
  { hash: '#pair-finder', id: 'pair-finder' },
  { hash: '#offspring-finder', id: 'offspring-finder' },
  { hash: '#breeding-tree', id: 'breeding-tree' },
  { hash: '#breeding-table', id: 'breeding-table' },
  { hash: '#species-index', id: 'species-index' },
  { hash: '#team-planner', id: 'team-planner' },
];

// Every view id must be one of the view wrappers, and exactly one is displayed.
async function expectSingleView(page, id) {
  for (const view of VIEWS) {
    if (view.id === id) await expect(page.locator('#' + view.id)).toBeVisible();
    else await expect(page.locator('#' + view.id)).toBeHidden();
  }
}

// Served mode: the page under /guide/, the way GitHub Pages mounts it.
// The file:// contract is pinned by tests/browser/file-mode.spec.js.
test.describe('served', () => {
  const url = () => serverUrl;

  test('every view id mounts a wrapper and only the Field guide starts visible', async ({ page }) => {
    await page.goto(url());
    for (const view of VIEWS) {
      await expect(page.locator('#' + view.id)).toHaveCount(1);
      await expect(page.locator('#' + view.id)).toHaveAttribute('data-view', view.id);
      await expect(page.locator('#' + view.id)).toHaveClass(/\bview\b/);
    }
    await expectSingleView(page, 'field-guide');
  });

  test('guidance appears beside the tool it explains and source details remain available', async ({ page }) => {
    await page.goto(url() + '#pair-finder');
    await expect(page.locator('#pair-finder #pair-guidance')).toBeVisible();
    await expect(page.locator('#pair-guidance')).toContainText(/pedigree|parent|order/i);
    await expect(page.locator('#rules-guide, #plus-rules, #flag-rules')).toHaveCount(0);

    await page.locator('#breeding-nav-trigger').click();
    await page.click('.nav a[href="#offspring-finder"]');
    await expect(page.locator('#offspring-finder #breeding-conditions')).toBeVisible();
    await expect(page.locator('#breeding-conditions')).toContainText('+');
    await expect(page.locator('#breeding-conditions')).toContainText(/Breeding room/i);

    await page.click('.nav a[href="#species-index"]');
    await expect(page.locator('#species-index #name-guide')).toBeVisible();
    const sources = page.locator('#species-index details').filter({ has: page.locator('#coverage-summary') });
    await sources.locator(':scope > summary').click();
    await expect(page.locator('#coverage-summary')).toBeVisible();
    const slots = await page.evaluate(() => DATA.species.length);
    const version = await page.evaluate(() => DATA.metadata.version);
    await expect(page.locator('#coverage-summary')).toContainText(`${slots} table slots`);
    await expect(page.locator('#source-version-summary')).toBeVisible();
    await expect(page.locator('#source-metadata')).toBeHidden();
    await sources.getByText('Technical provenance and original extraction', { exact: true }).click();
    await expect(page.locator('#source-metadata')).toBeVisible();
    await expect(page.locator('#source-metadata')).toContainText(version);
  });

  test('each guide nav link opens, titles and distinctly marks its own view', async ({ page }) => {
    await page.goto(url());
    const expected = {
      '#field-guide': 'Field guide',
      '#atlas': 'Map atlas',
      '#pair-finder': 'Find a pairing',
      '#offspring-finder': 'Find parents',
      '#breeding-tree': 'Breeding tree',
      '#breeding-table': 'Breeding table',
      '#species-index': 'Monster library',
      '#team-planner': 'My game',
    };
    for (const view of VIEWS) {
      await test.step(view.id, async () => {
        const link = page.locator('.nav a[href="' + view.hash + '"]');
        if (await link.locator('xpath=..').getAttribute('id') === 'breeding-nav-links') await page.locator('#breeding-nav-trigger').click();
        await expect(link).toBeVisible();
        await link.click();
        await expectSingleView(page, view.id);
        await expect(page).toHaveURL(new RegExp(view.hash + '$'));
        await expect(page).toHaveTitle(new RegExp('^' + expected[view.hash] + ' · '));
        const marks = await page.evaluate(() =>
          [...document.querySelectorAll('.nav a')].map(a => {
            const style = getComputedStyle(a);
            return {
              href: a.getAttribute('href'),
              active: a.classList.contains('nav-link-active'),
              current: a.getAttribute('aria-current'),
              color: style.color,
              shadow: style.boxShadow,
            };
          })
        );
        expect(marks.filter(mark => mark.href.startsWith('#')).map(mark => mark.href))
          .toEqual(VIEWS.map(entry => entry.hash));
        // The clicked link alone owns both the semantic and visual marks.
        expect(marks.filter(mark => mark.current === 'page').map(mark => mark.href)).toEqual([view.hash]);
        const marked = marks.filter(mark => mark.active);
        expect(marked.map(mark => mark.href)).toEqual([view.hash]);
        expect(marked[0].current).toBe('page');
        expect(marked[0].shadow).not.toBe('none');
        const inactiveColors = new Set();
        for (const mark of marks) {
          if (mark.href === view.hash) continue;
          expect(mark.current).toBe(null);
          if (mark.href.startsWith('#')) inactiveColors.add(mark.color);
          expect(mark.shadow).toBe('none');
        }
        expect(inactiveColors.size).toBe(1);
        expect(marked[0].color).not.toBe([...inactiveColors][0]);
      });
    }
  });

  test('a user-initiated switch focuses the view heading, a load does not', async ({ page }) => {
    const active = page => page.evaluate(() => document.activeElement && document.activeElement.id);
    // A direct load lands on the view without taking focus.
    await page.goto(url() + '#species-index');
    await expectSingleView(page, 'species-index');
    expect(await active(page)).toBe('');
    // A nav click moves focus to the destination heading.
    await page.click('.nav a[href="#team-planner"]');
    await expectSingleView(page, 'team-planner');
    await expect(page.locator('#planner-heading')).toBeFocused();
    expect(await active(page)).toBe('planner-heading');
  });

  test('DQMViews.go routes to a view, a handoff target, and an already open view', async ({ page }) => {
    await page.goto(url() + '#offspring-finder');
    await page.locator('#breeding-nav-trigger').click();
    await page.click('.nav a[href="#pair-finder"]');
    await page.selectOption('#pedigree', '11');
    await page.click('.nav a[href="#species-index"]');

    // A changed hash reveals the destination and focuses the named target.
    await page.evaluate(() => DQMViews.go('pair-finder', { focusId: 'result-name' }));
    await expectSingleView(page, 'pair-finder');
    await expect(page).toHaveURL(/#pair-finder$/);
    await expect(page.locator('#result-name')).toBeFocused();
    expect(await page.evaluate(() => DQMViews.current())).toBe('pair-finder');

    // The same destination again: no hashchange, so go() still works.
    await page.evaluate(() => DQMViews.go('pair-finder', { focusId: 'pedigree' }));
    await expectSingleView(page, 'pair-finder');
    await expect(page).toHaveURL(/#pair-finder$/);
    await expect(page.locator('#pedigree')).toBeFocused();
  });

  test('route parsing reads the view id and leaves later parameters alone', async ({ page }) => {
    await page.goto(url() + '#species-index?q=slime');
    await expectSingleView(page, 'species-index');
    // An alias with a parameter still resolves through the same rule.
    await page.goto(url() + '#about');
    await expectSingleView(page, 'species-index');
    expect(await page.evaluate(() => DQMViews.parse('#team-planner?tab=roster')))
      .toEqual({ id: 'team-planner', params: '?tab=roster' });
    expect(await page.evaluate(() => DQMViews.viewFor('#about')))
      .toBe('species-index');
    expect(await page.evaluate(() => DQMViews.viewFor('#nope')))
      .toBe('field-guide');
  });

  test('a repeated click on the current nav link stays put and takes focus', async ({ page }) => {
    await page.goto(url() + '#species-index');
    const link = page.locator('.nav a[href="#species-index"]');
    await link.click();
    await expectSingleView(page, 'species-index');
    await expect(page).toHaveURL(/#species-index$/);
    await expect(page.locator('#species-heading')).toBeFocused();
  });

  test('the skip link reaches the visible view and leaves the URL alone', async ({ page }) => {
    await page.goto(url() + '#team-planner');
    const skip = page.locator('a.skip');
    await skip.focus();
    await page.keyboard.press('Enter');
    await expectSingleView(page, 'team-planner');
    await expect(page).toHaveURL(/#team-planner$/);
    await expect(page.locator('#planner-heading')).toBeFocused();
    // The skip link reaches the view that is on screen, not a fixed one.
    expect(
      await page.evaluate(() => {
        const view = document.activeElement.closest('[data-view]');
        return view ? view.id : null;
      })
    ).toBe('team-planner');
  });

  test('the nav and skip link are reachable and usable with a keyboard', async ({ page }) => {
    await page.goto(url());
    await page.keyboard.press('Tab');
    await expect(page.locator('a.skip')).toBeFocused();
    // Tab forward through any controls above the nav (the theme picker) and
    // the links, stopping when Name index takes focus.
    let reached = false;
    for (let i = 0; i < 12 && !reached; i++) {
      await page.keyboard.press('Tab');
      reached = await page.evaluate(() => document.activeElement && document.activeElement.matches('.nav a[href="#species-index"]'));
    }
    expect(reached).toBe(true);
    await page.keyboard.press('Enter');
    await expectSingleView(page, 'species-index');
    await expect(page.locator('#species-heading')).toBeFocused();
  });

  test('a direct hash, a reload, and Back/Forward each show the intended view', async ({ page }) => {
    const titles = {
      'field-guide': 'Field guide',
      'species-index': 'Monster library',
    };
    // Every step lands on the same view, marked the same way, under the same
    // title: the URL is the only state a reload and a history move carry.
    const expectLanded = async id => {
      await expectSingleView(page, id);
      await expect(page.locator('.nav a[href="#' + id + '"]')).toHaveAttribute('aria-current', 'page');
      await expect(page).toHaveTitle(new RegExp('^' + titles[id] + ' · '));
    };
    await page.goto(url());
    await expectLanded('field-guide');
    await page.goto(url() + '#species-index');
    await expectLanded('species-index');
    await page.reload();
    await expectLanded('species-index');
    await page.goBack();
    await expectLanded('field-guide');
    await page.goForward();
    await expectLanded('species-index');
  });

  test('legacy guide hashes reach the matching contextual help and keep navigation focus', async ({ page }) => {
    await page.goto(url());
    const aliases = [
      { hash: '#rules-guide', view: 'offspring-finder', target: 'offspring-heading', heading: 'offspring-heading', title: 'Find parents' },
      { hash: '#conditional-rules', view: 'offspring-finder', target: 'breeding-conditions', heading: 'offspring-heading', title: 'Find parents' },
      { hash: '#about', view: 'species-index', target: 'name-guide', heading: 'species-heading', title: 'Monster library' },
    ];
    for (const alias of aliases) {
      await page.evaluate(hash => { location.hash = hash; }, alias.hash);
      await expectSingleView(page, alias.view);
      const link = page.locator('.nav a[href="#' + alias.view + '"]');
      await expect(link).toHaveClass(/\bnav-link-active\b/);
      await expect(link).toHaveAttribute('aria-current', 'page');
      await expect(page).toHaveTitle(new RegExp('^' + alias.title + ' · '));
      await expect(page.locator('#' + alias.target)).toBeVisible();
      await expect(page.locator('#' + alias.heading)).toBeFocused();
    }
    // A bookmark or reload must also land on the relocated help, even though
    // the browser cannot natively scroll to the removed legacy element ID.
    for (const alias of aliases) {
      await page.goto(url() + alias.hash);
      await page.reload();
      await expectSingleView(page, alias.view);
      await expect(page.locator('#' + alias.target)).toBeInViewport();
      await expect(page.locator('#' + alias.heading)).not.toBeFocused();
    }
  });

  test('an unknown hash falls back to the Field guide and marks its link', async ({ page }) => {
    await page.goto(url());
    await page.goto(url() + '#not-a-view');
    await expectSingleView(page, 'field-guide');
    await expect(page.locator('.nav a[href="#field-guide"]')).toHaveClass(/\bnav-link-active\b/);
  });

  test('a hidden view is display:none and has no box at all', async ({ page }) => {
    await page.goto(url() + '#team-planner');
    for (const view of VIEWS) {
      const state = await page.evaluate(id => {
        const element = document.getElementById(id);
        const rect = element.getBoundingClientRect();
        return {
          hidden: element.hidden,
          display: getComputedStyle(element).display,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
      }, view.id);
      if (view.id === 'team-planner') {
        expect(state.hidden).toBe(false);
        expect(state.display).not.toBe('none');
        expect(state.width).toBeGreaterThan(0);
      } else {
        expect(state.hidden).toBe(true);
        expect(state.display).toBe('none');
        expect(state.width).toBe(0);
        expect(state.height).toBe(0);
      }
    }
    // The rule is stated in the stylesheet, not left to the browser default
    // for [hidden]: a later display rule on a view class must not be able to
    // reveal a view the router has switched away from.
    const sheet = fs.readFileSync(path.join(REPO_ROOT, 'css', 'guide.css'), 'utf8');
    expect(sheet).toMatch(/\.view\[hidden\]\{display:none!important\}/);
  });

  test('contextual guidance and ordinary pair results remain usable without conditional rules', async ({ page }) => {
    // Remove only the optional rules before the reference renderer starts.
    await page.addInitScript(() => {
      let value;
      Object.defineProperty(globalThis, 'DATA', {
        configurable: true,
        get: () => value,
        set: next => {
          value = next;
          next.runtime_rules = { rules: [] };
        },
      });
    });
    await page.goto(url() + '#pair-finder');
    await expect(page.locator('#pair-guidance')).toBeVisible();
    await page.locator('#breeding-nav-trigger').click();
    await page.click('.nav a[href="#offspring-finder"]');
    await expectSingleView(page, 'offspring-finder');
    await expect(page.locator('#breeding-conditions')).toBeVisible();
    await expect(page.locator('#reverse-rows tr').first()).toBeVisible();
    await expect(page.locator('#reverse-rows')).toContainText('Base table pairs');
    await expect(page.locator('#reverse-rows')).not.toContainText('Confirmed + value recipes');
    await expect(page.locator('#offspring-heading')).toBeFocused();
    await page.click('.nav a[href="#species-index"]');
    await expect(page.locator('#name-guide')).toBeVisible();
  });

  test('views stay mounted across a switch, so their controls keep their state', async ({ page }) => {
    await page.goto(url());
    await page.goto(url() + '#species-index');
    await page.fill('#species-search', 'Slime');
    await page.locator('#breeding-nav-trigger').click();
    await page.click('.nav a[href="#pair-finder"]');
    await expectSingleView(page, 'pair-finder');
    await page.click('.nav a[href="#species-index"]');
    await expect(page.locator('#species-search')).toHaveValue('Slime');
  });
});

// Layout and media queries. These rules are the same whether the page was
// opened from disk or served, so they run once, against the shipped file.
test.describe('narrow screens and print', () => {
  test('the five primary destinations fit at 320px and breeding opens by keyboard', async ({ page }) => {
    await page.setViewportSize({width:320, height:640});
    await page.goto(FILE_URL);
    const primary = page.locator('.nav nav > a, #breeding-nav-trigger');
    expect(await primary.count()).toBe(5);
    const bounds = await primary.evaluateAll(items => items.map(a => {
      const r = a.getBoundingClientRect();
      return [r.left, r.right, r.top];
    }));
    expect(new Set(bounds.map(r=>Math.round(r[2]))).size).toBe(1);
    expect(bounds.every(([l,r])=>l>=0 && r<=320)).toBe(true);
    const trigger = page.getByRole('button', {name:'Breeding',exact:true});
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('link',{name:'Find a pairing',exact:true})).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(trigger).toBeFocused();
    await expect(trigger).toHaveAttribute('aria-expanded','false');
    await trigger.click();
    await page.locator('#breeding-nav-links a').nth(1).click();
    await expectSingleView(page,'offspring-finder');
    await expect(trigger).toHaveClass(/nav-link-active/);
    await expect(trigger).toHaveAttribute('aria-expanded','false');
  });

  test('a hidden view stays out of the way on a narrow screen too', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(FILE_URL + '#pair-finder');
    await expectSingleView(page, 'pair-finder');
    const shown = await page.evaluate(() =>
      [...document.querySelectorAll('.view')]
        .filter(view => getComputedStyle(view).display !== 'none')
        .map(view => view.id)
    );
    expect(shown).toEqual(['pair-finder']);
  });

  test('print shows the active view only, and names it', async ({ page }) => {
    await page.goto(FILE_URL + '#species-index');
    await page.emulateMedia({ media: 'print' });
    const printed = await page.evaluate(() =>
      [...document.querySelectorAll('.view')].map(view => ({
        id: view.id,
        display: getComputedStyle(view).display,
        height: Math.round(view.getBoundingClientRect().height),
      }))
    );
    for (const view of printed) {
      if (view.id === 'species-index') {
        expect(view.display).not.toBe('none');
        // The printed page holds real content, not an empty view.
        expect(view.height).toBeGreaterThan(0);
      } else {
        expect(view.display).toBe('none');
        expect(view.height).toBe(0);
      }
    }
    // The nav is not part of the printed page.
    expect(await page.evaluate(() => getComputedStyle(document.querySelector('.nav')).display)).toBe('none');
    // The full-width matrix has a normal visible heading on screen and in
    // print, and printing it still excludes the other mounted views.
    await page.goto(FILE_URL + '#breeding-table');
    await page.emulateMedia({ media: 'screen' });
    const heading = page.locator('#breeding-table-heading');
    await expect(heading).toBeVisible();
    expect((await heading.boundingBox()).width).toBeGreaterThan(100);
    await page.emulateMedia({ media: 'print' });
    await expectSingleView(page, 'breeding-table');
    await expect(heading).toBeVisible();
    await expect(page.locator('#planner-all-grid tbody tr').first()).toBeVisible();
    expect((await heading.boundingBox()).width).toBeGreaterThan(100);
  });

  test('tabbing never lands inside a hidden view', async ({ page }) => {
    await page.goto(FILE_URL + '#species-index');
    const seen = [];
    for (let i = 0; i < 40; i++) {
      await page.keyboard.press('Tab');
      const where = await page.evaluate(() => {
        const element = document.activeElement;
        if (!element || element === document.body) return null;
        const view = element.closest('[data-view]');
        return {
          id: element.id || element.tagName,
          view: view ? view.id : null,
          hidden: view ? view.hidden : false,
        };
      });
      if (where) seen.push(where);
    }
    expect(seen.length).toBeGreaterThan(3);
    for (const stop of seen) {
      expect(stop.hidden, 'focus landed inside hidden ' + stop.view + ' on ' + stop.id).toBe(false);
    }
  });
});
