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
  { hash: '#pair-finder', id: 'pair-finder' },
  { hash: '#offspring-finder', id: 'offspring-finder' },
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

// The page must work opened directly from disk and served under /guide/.
for (const name of ['file', 'server']) {
  test.describe(name, () => {
    const url = () => (name === 'file' ? FILE_URL : serverUrl);

    test('a bare page load shows only Find a pairing', async ({ page }) => {
      await page.goto(url());
      await expectSingleView(page, 'pair-finder');
    });

    test('every view id mounts a wrapper and only Find a pairing starts visible', async ({ page }) => {
      await page.goto(url());
      for (const view of VIEWS) {
        await expect(page.locator('#' + view.id)).toHaveCount(1);
        await expect(page.locator('#' + view.id)).toHaveAttribute('data-view', view.id);
        await expect(page.locator('#' + view.id)).toHaveClass(/\bview\b/);
      }
      await expect(page.locator('#offspring-finder')).toBeHidden();
      await expect(page.locator('#species-index')).toBeHidden();
      await expect(page.locator('#breeding-table')).toBeHidden();
      await expect(page.locator('#team-planner')).toBeHidden();
    });

    test('guidance appears beside the tool it explains and source details remain available', async ({ page }) => {
      await page.goto(url());
      await expect(page.locator('#pair-finder #pair-guidance')).toBeVisible();
      await expect(page.locator('#pair-guidance')).toContainText(/pedigree|parent|order/i);
      await expect(page.locator('#rules-guide, #plus-rules, #flag-rules')).toHaveCount(0);

      await page.click('.nav a[href="#offspring-finder"]');
      await expect(page.locator('#offspring-finder #breeding-conditions')).toBeVisible();
      await expect(page.locator('#breeding-conditions')).toContainText('+');
      await expect(page.locator('#breeding-conditions')).toContainText(/Breeding room/i);

      await page.click('.nav a[href="#species-index"]');
      await expect(page.locator('#species-index #name-guide')).toBeVisible();
      const sources = page.locator('#species-index details').filter({ has: page.locator('#coverage-summary') });
      await sources.locator('summary').click();
      await expect(page.locator('#coverage-summary')).toBeVisible();
      const slots = await page.evaluate(() => DATA.species.length);
      const version = await page.evaluate(() => DATA.metadata.version);
      await expect(page.locator('#coverage-summary')).toContainText(`${slots} table slots`);
      await expect(page.locator('#source-metadata')).toBeVisible();
      await expect(page.locator('#source-metadata')).toContainText(version);
    });

    test('each nav link opens its own view and marks itself current', async ({ page }) => {
      await page.goto(url());
      for (const view of VIEWS) {
        const link = page.locator('.nav a[href="' + view.hash + '"]');
        await expect(link).toBeVisible();
        await link.click();
        await expectSingleView(page, view.id);
        await expect(link).toHaveAttribute('aria-current', 'page');
        await expect(page).toHaveURL(new RegExp(view.hash + '$'));
        // Exactly one link is current, and it is the one that was clicked.
        const current = await page
          .locator('.nav a[aria-current="page"]')
          .evaluateAll(links => links.map(a => a.getAttribute('href')));
        expect(current).toEqual([view.hash]);
      }
    });

    test('each view sets the page title from its nav label', async ({ page }) => {
      await page.goto(url());
      const expected = {
        '#pair-finder': 'Find a pairing',
        '#offspring-finder': 'Find parents',
        '#breeding-table': 'Breeding table',
        '#species-index': 'Name index',
        '#team-planner': 'My game',
      };
      for (const view of VIEWS) {
        await page.goto(url() + view.hash);
        await expect(page).toHaveTitle(new RegExp('^' + expected[view.hash] + ' · '));
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
        .toBe('pair-finder');
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
        'pair-finder': 'Find a pairing',
        'species-index': 'Name index',
      };
      // Every step lands on the same view, marked the same way, under the same
      // title: the URL is the only state a reload and a history move carry.
      const expectLanded = async id => {
        await expectSingleView(page, id);
        await expect(page.locator('.nav a[href="#' + id + '"]')).toHaveAttribute('aria-current', 'page');
        await expect(page).toHaveTitle(new RegExp('^' + titles[id] + ' · '));
      };
      await page.goto(url());
      await expectLanded('pair-finder');
      await page.goto(url() + '#species-index');
      await expectLanded('species-index');
      await page.reload();
      await expectLanded('species-index');
      await page.goBack();
      await expectLanded('pair-finder');
      await page.goForward();
      await expectLanded('species-index');
    });

    test('legacy guide hashes reach the matching contextual help and keep navigation focus', async ({ page }) => {
      await page.goto(url());
      const aliases = [
        { hash: '#rules-guide', view: 'offspring-finder', target: 'offspring-heading', heading: 'offspring-heading', title: 'Find parents' },
        { hash: '#conditional-rules', view: 'offspring-finder', target: 'breeding-conditions', heading: 'offspring-heading', title: 'Find parents' },
        { hash: '#about', view: 'species-index', target: 'name-guide', heading: 'species-heading', title: 'Name index' },
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

    test('an unknown hash falls back to Find a pairing and marks its link', async ({ page }) => {
      await page.goto(url());
      await page.goto(url() + '#not-a-view');
      await expectSingleView(page, 'pair-finder');
      await expect(page.locator('.nav a[href="#pair-finder"]')).toHaveClass(/\bnav-link-active\b/);
    });

    test('the active style marks whichever link is current, not one fixed link', async ({ page }) => {
      await page.goto(url());
      for (const view of VIEWS) {
        await page.locator('.nav a[href="' + view.hash + '"]').click();
        await expectSingleView(page, view.id);
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
        expect(marks.map(mark => mark.href)).toEqual(VIEWS.map(entry => entry.hash));
        // Exactly one link is marked, and it is the clicked one.
        const marked = marks.filter(mark => mark.active);
        expect(marked.map(mark => mark.href)).toEqual([view.hash]);
        expect(marked[0].current).toBe('page');
        expect(marked[0].shadow).not.toBe('none');
        // The active link must read differently from the inactive ones.
        const inactiveColors = new Set();
        for (const mark of marks) {
          if (mark.href === view.hash) continue;
          expect(mark.current).toBe(null);
          inactiveColors.add(mark.color);
          expect(mark.shadow).toBe('none');
        }
        expect(inactiveColors.size).toBe(1);
        expect(marked[0].color).not.toBe([...inactiveColors][0]);
        expect(marked[0].shadow).not.toBe('none');
      }
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
      await page.goto(url());
      await expect(page.locator('#pair-guidance')).toBeVisible();
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

    test('the nav separates its links with CSS, not spacer text', async ({ page }) => {
      await page.goto(url());
      const nav = page.locator('.nav nav');
      await expect(nav).toHaveText(/^Find a pairing\s*Find parents\s*Breeding table\s*Name index\s*My game$/);
      // Only element children: no spacer text nodes left between the links.
      const childTypes = await page.evaluate(() => [...document.querySelector('.nav nav').childNodes].map(n => n.nodeType));
      expect(childTypes).toEqual(childTypes.map(() => 1));
      const gap = await page.evaluate(() => {
        const links = [...document.querySelectorAll('.nav nav a')].map(a => a.getBoundingClientRect());
        return {
          declared: parseFloat(getComputedStyle(document.querySelector('.nav nav')).columnGap),
          rendered: Math.round(links[1].left - links[0].right),
        };
      });
      expect(gap.declared).toBeGreaterThan(0);
      expect(gap.rendered).toBeGreaterThanOrEqual(gap.declared);
    });

    test('views stay mounted across a switch, so their controls keep their state', async ({ page }) => {
      await page.goto(url());
      await page.goto(url() + '#species-index');
      await page.fill('#species-search', 'Slime');
      await page.click('.nav a[href="#pair-finder"]');
      await expectSingleView(page, 'pair-finder');
      await page.click('.nav a[href="#species-index"]');
      await expect(page.locator('#species-search')).toHaveValue('Slime');
    });
  });
}

// Layout and media queries. These rules are the same whether the page was
// opened from disk or served, so they run once, against the shipped file.
test.describe('narrow screens and print', () => {
  test('the nav wraps at 320px instead of overflowing the page', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(FILE_URL);
    const links = page.locator('.nav nav a');
    await expect(links).toHaveCount(5);
    for (let i = 0; i < 5; i++) await expect(links.nth(i)).toBeVisible();
    // The links really do use more than one row at this width.
    const rows = new Set(await links.evaluateAll(items => items.map(a => Math.round(a.getBoundingClientRect().top))));
    expect(rows.size).toBeGreaterThan(1);
    const box = await page.evaluate(() => {
      const nav = document.querySelector('.nav nav');
      const navBox = nav.getBoundingClientRect();
      return {
        navScroll: nav.scrollWidth,
        navClient: nav.clientWidth,
        docScroll: document.documentElement.scrollWidth,
        docClient: document.documentElement.clientWidth,
        // Each link must sit inside the nav, with room for its own label.
        links: [...nav.querySelectorAll('a')].map(a => {
          const rect = a.getBoundingClientRect();
          const range = document.createRange();
          range.selectNodeContents(a);
          return {
            text: a.textContent,
            inside: rect.left >= navBox.left - 1 && rect.right <= navBox.right + 1,
            labelFits: range.getBoundingClientRect().height <= rect.height + 1,
          };
        }),
      };
    });
    // No horizontal scrollbar anywhere: the nav fits its box and so does the
    // document.
    expect(box.navScroll).toBeLessThanOrEqual(box.navClient);
    expect(box.docScroll).toBeLessThanOrEqual(box.docClient + 1);
    for (const link of box.links) {
      expect(link.inside, link.text + ' runs outside the nav').toBe(true);
      expect(link.labelFits, link.text + ' label is clipped').toBe(true);
    }
    // A wrapped link still navigates, and the active style follows it.
    await page.locator('.nav a[href="#team-planner"]').click();
    await expectSingleView(page, 'team-planner');
    await expect(page.locator('.nav a[href="#team-planner"]')).toHaveClass(/\bnav-link-active\b/);
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
