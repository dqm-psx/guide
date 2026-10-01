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
  await page.goto(serverUrl);

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

    // The shell came from the cache and the data-driven tools still populate.
    await expect(page.locator('.version')).toContainText('v1.0.61');
    await expect(page.locator('#coverage-summary')).toContainText('326 table slots');
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
