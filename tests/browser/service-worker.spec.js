const { test, expect } = require('@playwright/test');

let serverUrl = null;

test.beforeAll(async () => {
  const { startGuideServer } = await import('../helpers/modes');
  serverUrl = await startGuideServer();
});

test.afterAll(async () => {
  const { stopGuideServer } = await import('../helpers/modes');
  await stopGuideServer();
});

// Service workers need a secure context, so this is the served copy only;
// tests/browser/offline.spec.js covers the file:// copy, where the worker
// stays out of the way on purpose.
test('a visited copy reloads and works with the network offline', async ({ page, context }) => {
  const online = await page.goto(serverUrl);
  expect(online.ok()).toBeTruthy();
  const expectedHtml = await online.text();

  // The worker registers on load; controller is set once it has activated and
  // claimed this page, which happens after the install cache is filled.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 20000 });

  await context.setOffline(true);
  try {
    const reloaded = await page.reload();

    // The document must come from the service worker cache, not the browser's
    // opportunistic HTTP cache.
    expect(reloaded).not.toBeNull();
    expect(reloaded.fromServiceWorker()).toBeTruthy();

    // Preserve the actual served shell, regardless of editable header wording.
    expect(await reloaded.text()).toBe(expectedHtml);
    // The data-driven tools still populate after the offline reload.
    const slots = await page.evaluate(() => DATA.species.length);
    await expect(page.locator('#coverage-summary')).toContainText(`${slots} table slots`);
    await expect(page.locator('#pedigree option').first()).toBeAttached();
    await expect(page.locator('#mate option').first()).toBeAttached();

    // A hash route resolves offline too, because only the shell is fetched.
    await page.goto(serverUrl + '#species-index');
      await expect(page.locator('#species-index')).toBeVisible();
      await expect(page.locator('#species-rows tr').first()).toBeAttached();
  } finally {
    await context.setOffline(false);
  }
});

test('offline updates ignore retained legacy and unrelated cache entries', async ({ page, context, request }) => {
  // Seed the origin before the guide can register its worker. These caches
  // therefore precede the new installation in CacheStorage's lookup order.
  const seedUrl = new URL('cache-upgrade-seed.html', serverUrl).href;
  await page.route(seedUrl, route => route.fulfill({
    contentType: 'text/html',
    body: '<html><body>Cache upgrade setup</body></html>',
  }));
  await page.goto(seedUrl);
  const cacheNames = ['legacy-guide-cache', 'other-project-cache'];
  await page.evaluate(async ({ names, guideUrl }) => {
    for (const name of names) {
      const cache = await caches.open(name);
      await cache.put(guideUrl, new Response('Stale HTML from ' + name, {
        headers: { 'Content-Type': 'text/html' },
      }));
      await cache.put(new URL('js/app-state.js', guideUrl).href, new Response('Stale script from ' + name, {
        headers: { 'Content-Type': 'application/javascript' },
      }));
    }
  }, { names: cacheNames, guideUrl: serverUrl });

  const scriptUrl = new URL('js/app-state.js', serverUrl).href;
  const currentScript = await request.get(scriptUrl);
  expect(currentScript.ok()).toBeTruthy();
  const expectedScript = await currentScript.text();
  const currentPage = await request.get(serverUrl);
  expect(currentPage.ok()).toBeTruthy();
  const expectedHtml = await currentPage.text();
  await page.goto(serverUrl);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 20000 });

  await context.setOffline(true);
  try {
    const reloaded = await page.reload();
    expect(reloaded.fromServiceWorker()).toBeTruthy();
    expect(await reloaded.text()).toBe(expectedHtml);
    const slots = await page.evaluate(() => DATA.species.length);
    await expect(page.locator('#coverage-summary')).toContainText(`${slots} table slots`);
    const offlineScript = await page.evaluate(url => fetch(url).then(response => response.text()), scriptUrl);
    expect(offlineScript).toBe(expectedScript);

    // Read isolation must not rely on destroying caches this installation
    // cannot own, including the ambiguous legacy cache from earlier releases.
    const retained = await page.evaluate(async ({ names, guideUrl }) => {
      const keys = await caches.keys();
      return Promise.all(names.map(async name => ({
        name,
        exists: keys.includes(name),
        html: await (await (await caches.open(name)).match(guideUrl)).text(),
      })));
    }, { names: cacheNames, guideUrl: serverUrl });
    expect(retained).toEqual(cacheNames.map(name => ({ name, exists: true, html: 'Stale HTML from ' + name })));
  } finally {
    await context.setOffline(false);
  }
});

test('activation deletes only caches this installation owns', async ({ page }) => {
  await page.goto(serverUrl);
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 20000 });

  // Drop the current registration, then seed a stale cache this installation
  // owns, a guide nested under this path, and an unrelated project's cache
  // before a fresh install/activate cycle.
  const seeded = await page.evaluate(async () => {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
    const prefix = 'dqm-guide:' + new URL('./', location.href).pathname;
    const stale = prefix + 'v0-stale';
    const nested = prefix + 'other/v1';
    await caches.open(stale);
    await caches.open(nested);
    await caches.open('other-project-cache');
    return { stale, nested };
  });
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, null, { timeout: 20000 });
  await page.waitForFunction(name => caches.keys().then(keys => !keys.includes(name)), seeded.stale, { timeout: 20000 });

  const keys = await page.evaluate(() => caches.keys());
  // The stale cache this installation owns is gone; the nested guide and the
  // unrelated project are untouched.
  expect(keys).not.toContain(seeded.stale);
  expect(keys).toContain(seeded.nested);
  expect(keys).toContain('other-project-cache');
});

test('the manifest and worker are served from the site', async ({ request }) => {
  const manifest = await request.get(new URL('manifest.webmanifest', serverUrl).href);
  expect(manifest.ok()).toBeTruthy();
  const body = await manifest.json();
  expect(body.start_url).toBe('./');
  expect(body.scope).toBe('./');
  expect(body.icons.length).toBeGreaterThan(0);

  const worker = await request.get(new URL('sw.js', serverUrl).href);
  expect(worker.ok()).toBeTruthy();
  expect(await worker.text()).toContain('CACHE_NAME');
});
