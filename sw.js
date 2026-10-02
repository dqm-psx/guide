/* DQM-guide service worker.

   The page already needs no network once it is loaded; this worker makes the
   copy open at all on a later visit, offline, or from an installed icon. It is
   a classic worker with no imports, so it needs no build step and no bundler.

   Strategy: network-first, cache fallback.
   - Online, every load fetches the current files and refreshes the cache, so a
     deploy never strands a reader on old markup.
   - Offline, a load is answered from CACHE_NAME, which the install step fills
     with every shipped asset (see PRECACHE).

   Bump CACHE_NAME only when this file changes; activate() then drops the
   previous cache. Content-only edits need no bump, because network-first
   refreshes the cache on the next online load. Deletion is limited to caches
   this installation owns (its path-scoped prefix), because CacheStorage names
   are origin-wide and another project on the same origin may own other caches. */

"use strict";

// CacheStorage names are origin-wide, so scope the prefix to this
// installation's path. Two copies of the guide on one origin (say, two GitHub
// Pages project paths) then own separate caches and never delete each other's;
// an unrelated project's caches are never touched at all.
const CACHE_PREFIX = "dqm-guide:" + new URL("./", self.location.href).pathname;
const CACHE_VERSION = "v1.0.61-2";
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;

// Every asset the page loads. Kept as a plain JSON array so
// tests/unit/offline-assets.test.js can check it without running the worker.
// Relative URLs resolve against this file, which sits at the site scope root.
const PRECACHE = [
  "./index.html",
  "./manifest.webmanifest",
  "./css/guide.css",
  "./css/features.css",
  "./css/dark-mode.css",
  "./data/breeding-data.js",
  "./data/monster-sprites.js",
  "./data/overworld-sprites.js",
  "./js/sprites.js",
  "./js/storage.js",
  "./js/session.js",
  "./js/reference.js",
  "./js/planner-core.js",
  "./js/recipe-planner.js",
  "./js/app-state.js",
  "./js/planner-ui.js",
  "./js/router.js",
  "./js/theme.js",
  "./js/offline.js",
  "./icons/icon-32.png",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

const INDEX_URL = new URL("index.html", self.location.href).href;

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key =>
          key !== CACHE_NAME &&
          key.startsWith(CACHE_PREFIX) &&
          // A single version token only: a guide nested under this path keeps
          // its own caches, because its name continues with a slash.
          !key.slice(CACHE_PREFIX.length).includes("/")
        ).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch (error) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  // A navigation may arrive as the directory URL or as index.html; both read
  // and write the same cache entry so an offline load of either gets the shell.
  const cacheKey = request.mode === "navigate" ? INDEX_URL : request;

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.ok && response.type === "basic") {
          const copy = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(cacheKey, copy))
            .catch(() => {});
        }
        return response;
      })
      .catch(() =>
        // CacheStorage.match searches every origin cache in creation order.
        // Retained legacy or unrelated caches must not override this version.
        caches.open(CACHE_NAME).then(cache =>
          cache.match(cacheKey)
            .then(cached => cached || cache.match(INDEX_URL))
            .then(cached => cached || Response.error())
        )
      )
  );
});
