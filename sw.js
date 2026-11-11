"use strict";

// CacheStorage names are origin-wide, so scope the prefix to this
// installation's path. Two copies of the guide on one origin (say, two GitHub
// Pages project paths) then own separate caches and never delete each other's;
// an unrelated project's caches are never touched at all.
const CACHE_PREFIX = "dqm-guide:" + new URL("./", self.location.href).pathname;
const CACHE_VERSION = "reference-2026-11-06-refresh";
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;

// Every asset the page loads. Kept as a plain JSON array so
// tests/unit/offline-assets.test.js can check it without running the worker.
// Relative URLs resolve against this file, which sits at the site scope root.
const PRECACHE = [
  "./index.html",
  "./manifest.webmanifest",
  "./css/guide.css",
  "./css/entry-page.css",
  "./css/player-guide.css",
  "./css/reference-tables.css",
  "./css/my-game.css",
  "./media/greattree.webp",
  "./media/terry.webp",
  "./media/cobi.webp",
  "./media/tara.webp",
  "./media/adventure-log.webp",
  "./media/watabou.webp",
  "./media/warubou.webp",
  "./media/wonder-egg.webp",
  "./media/treeface.webp",
  "./media/slime.webp",
  "./media/grizzly.webp",
  "./media/sprites-portrait-0.webp",
  "./media/sprites-portrait-1.webp",
  "./media/sprites-portrait-2.webp",
  "./media/sprites-portrait-3.webp",
  "./media/sprites-portrait-4.webp",
  "./media/sprites-portrait-5.webp",
  "./media/sprites-overworld-0.webp",
  "./media/sprites-overworld-1.webp",
  "./media/sprites-overworld-2.webp",
  "./media/sprites-overworld-3.webp",
  "./media/sprites-overworld-4.webp",
  "./media/sprites-overworld-5.webp",
  "./data/home-names.js",
  "./data/handbook-reference.js",
  "./data/field-routes.js",
  "./data/gate-entrances.js",
  "./data/gate-generation.js",
  "./data/player-atlas.js",
  "./data/world-guide.js",
  "./data/field-guide.js",
  "./data/recruitment-reference.js",
  "./js/recruitment.js",
  "./js/recruitment-ui.js",
  "./css/mechanics-tools.css",
  "./data/npc-sprites.js",
  "./data/character-dialogue.js",
  "./js/character-dialogue.js",
  "./data/skill-descriptions.js",
  "./data/item-reference.js",
  "./data/item-art.js",
  "./js/current-names.js",
  "./js/walkthrough.js",
  "./js/locations.js",
  "./js/place-context.js",
  "./js/gate-generation.js",
  "./js/sortable-index.js",
  "./js/mechanics-index.js",
  "./js/skill-index.js",
  "./js/item-index.js",
  "./js/save-import.js",
  "./js/player-guide.js",
  "./js/player-atlas.js",
  "./css/workbench.css",
  "./css/breeding-tree.css",
  "./css/monster-reference.css",
  "./css/features.css",
  "./css/dark-mode.css",
  "./data/breeding-data.js",
  "./data/breeding-names.js",
  "./data/monster-reference.js",
  "./data/sprite-sheets.js",
  "./js/asset-loader.js",
  "./js/entry-page.js",
  "./js/guide-shell.js",
  "./js/guide-settings.js",
  "./js/monster-picker.js",
  "./js/sprites.js",
  "./js/storage.js",
  "./js/session.js",
  "./js/reference.js",
  "./js/planner-core.js",
  "./js/recipe-planner.js",
  "./js/app-state.js",
  "./js/planner-ui.js",
  "./js/router.js",
  "./js/breeding-tree.js",
  "./js/monster-reference.js",
  "./js/matrix-tools.js",
  "./js/theme.js",
  "./js/offline.js",
  "./icons/icon-32.png",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

const scope = new URL('./', self.location.href);
const shell = new URL('index.html', scope).href;
const fullDownload = new URL('.offline-complete', scope).href;
const assetURLs = PRECACHE.map(path=>new URL(path, scope).href);
const known = new Set(assetURLs);
const knownPaths = new Set(assetURLs.map(url=>new URL(url).pathname));
const referencePages = new Map(assetURLs.filter(url=>new URL(url).pathname.endsWith('/index.html'))
  .map(url=>[new URL(url).pathname,url]));
const immutable = url => url.searchParams.has('v') || /\/[a-f0-9]{20,64}\.webp$/.test(url.pathname);
const ownCache = key => key.startsWith(CACHE_PREFIX) && !key.slice(CACHE_PREFIX.length).includes("/");
const inflight = new Map();

// Pages serves a physical file for every query string. An older open tab
// can therefore receive newer bytes at its old URL just after a deploy.
async function checkFingerprint(url,response) {
  const version = new URL(url).searchParams.get('v');
  if (!version || !/^[a-f0-9]{16}$/.test(version)) return;
  const digest = await crypto.subtle.digest('SHA-256',await response.clone().arrayBuffer());
  const actual = Array.from(new Uint8Array(digest,0,8),byte=>byte.toString(16).padStart(2,'0')).join('');
  if (actual!==version) throw Error('Guide updated. Reload to open the latest version.');
}

async function storeAsset(url, cache) {
  const cached = await cache.match(url);
  if (cached) return cached;
  if (!inflight.has(url)) {
    const load = fetch(url,{cache:immutable(new URL(url)) ? 'force-cache' : 'default'}).then(async response => {
      if (!response.ok) throw Error('Could not cache '+new URL(url).pathname);
      await checkFingerprint(url,response);
      await cache.put(url,response.clone());
      return response;
    }).finally(()=>inflight.delete(url));
    inflight.set(url,load);
  }
  return (await inflight.get(url)).clone();
}

async function install() {
  const current = await caches.open(CACHE_NAME);
  const previous = (await caches.keys()).filter(key=>ownCache(key) && key!==CACHE_NAME);
  const seen = new Set();
  let complete = false;
  for (const key of previous) {
    const past = await caches.open(key);
    complete ||= Boolean(await past.match(fullDownload));
    for (const request of await past.keys()) {
      const url = new URL(request.url);
      seen.add(url.pathname);
      if (known.has(url.href) && immutable(url)) await current.put(request,await past.match(request));
    }
  }
  const response = await fetch(shell,{cache:previous.length ? 'no-cache' : 'default'});
  if (!response.ok) throw Error('Could not install the guide');
  await current.put(shell,response.clone());
  const html = await response.text();
  const used = new Set();
  for (const tag of html.matchAll(/<(?:script|link|img)\b[^>]*?\b(?:src|href)=["']([^"']+)["']/gi)) {
    used.add(new URL(tag[1],scope).href);
  }
  const warm = assetURLs.filter(url=>url!==shell && (complete || used.has(url) || seen.has(new URL(url).pathname)));
  for (let i=0;i<warm.length;i+=8) await Promise.all(warm.slice(i,i+8).map(url=>storeAsset(url,current)));
  if (complete) await current.put(fullDownload,new Response('complete'));
  await self.skipWaiting();
}
self.addEventListener('install',event=>event.waitUntil(install()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  for (const key of await caches.keys()) if (key!==CACHE_NAME && ownCache(key)) await caches.delete(key);
  await self.clients.claim();
})()));

self.addEventListener('message',event=>{
  const {type,urls} = event.data || {};
  if (!['warm','download','status'].includes(type)) return;
  event.waitUntil((async()=>{
    const cache = await caches.open(CACHE_NAME);
    const reply = data => event.ports[0]?.postMessage(data);
    try {
      if (type==='status') return reply({complete:Boolean(await cache.match(fullDownload))});
      const entries = type==='download' ? assetURLs : Array.isArray(urls) ? urls.filter(url=>known.has(url)) : [];
      // Bound concurrency on a phone, especially when the optional download includes the atlas.
      for (let i=0;i<entries.length;i+=8) await Promise.all(entries.slice(i,i+8).map(url=>storeAsset(url,cache)));
      if (type==='download') await cache.put(fullDownload,new Response('complete'));
      reply({complete:type==='download'});
    } catch { reply({error:true}); }
  })());
});

self.addEventListener('fetch',event=>{
  const request = event.request;
  const url = new URL(request.url);
  if (request.method!=='GET' || url.origin!==scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  if (request.mode==='navigate' || url.href===shell) {
    const root = url.pathname===scope.pathname || url.pathname===new URL(shell).pathname;
    const path = url.pathname.replace(/\/$/,'/index.html');
    const key = root ? shell : url.origin+path;
    event.respondWith((async()=>{
      const cache = await caches.open(CACHE_NAME);
      try {
        const response=await fetch(request,{cache:'no-cache'});
        if (response.ok) await cache.put(key,response.clone());
        return response;
      } catch {
        const cached=await cache.match(key) || (referencePages.has(path) && await cache.match(referencePages.get(path)));
        if (cached) return cached;
        if (!root) {
          // The shell can reconstruct unopened entry routes from their native IDs offline.
          const entry = url.pathname.slice(scope.pathname.length).match(/^(monsters|skills|places|articles)\/([\w-]+)\/(?:index\.html)?$/);
          if (entry) {
            const [kind,id]=entry.slice(1);
            const routes={monsters:'monster?id=',skills:'field-guide?kind=skill&entry=skill-',places:'atlas?map=',articles:'field-guide?entry='};
            return Response.redirect(scope.href+'#'+routes[kind]+id);
          }
        }
        return Response.error();
      }
    })());
    return;
  }
  if (known.has(url.href) && immutable(url)) {
    event.respondWith(caches.open(CACHE_NAME).then(cache=>storeAsset(url.href,cache)));
  } else if (known.has(url.href) || (knownPaths.has(url.pathname) && /^[a-f0-9]{16}$/.test(url.searchParams.get('v') || ''))) {
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE_NAME);
      try {
        const response=await fetch(request);
        if (response.ok) {
          await checkFingerprint(url.href,response);
          await cache.put(request,response.clone());
        }
        return response;
      } catch { return await cache.match(request) || Response.error(); }
    })());
  }
});
