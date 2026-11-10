'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {versionAssets} = require('../../scripts/sync-stage-site');
const root = path.resolve(__dirname, '../..');
const workerSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const precacheOf = worker => JSON.parse(worker.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1]);
const cacheVersion = worker => worker.match(/const CACHE_VERSION = "([^"]+)";/)[1];
function sourceAssets() {
  const files = [...precacheOf(workerSource).map(file => file.slice(2)), 'sw.js', '.nojekyll'];
  return new Map(files.map(file => [file, fs.readFileSync(path.join(root, file))]));
}
function scriptURL(html, file) {
  const shell = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]);
  const lazy = Object.values(JSON.parse(html.match(/<script type="application\/json" id="guide-assets">([\s\S]*?)<\/script>/)[1])).flat();
  return [...shell,...lazy].find(url => url.split('?')[0] === file);
}

test('published assets, manifest icons and offline keys share exact fingerprinted URLs', () => {
  const source = sourceAssets();
  const published = versionAssets(source);
  const html = published.get('index.html').toString();
  const precache = precacheOf(published.get('sw.js').toString());
  const keys = new Set(precache.map(ref => new URL(ref, 'https://example.com/guide/sw.js').href));
  for (const tag of html.matchAll(/<(?:script|link|img)\s[^>]*>/g)) {
    const url = tag[0].match(/(?:src|href)="([^"]+)"/)?.[1];
    if (!url || /^(https?:|\/\/|#)/.test(url)) continue;
    assert.match(url, /\?v=[0-9a-f]{16}$/);
    assert.ok(keys.has(new URL(url, 'https://example.com/guide/').href), `uncached published asset ${url}`);
    assert.ok(published.has(url.split('?')[0]));
  }
  assert.ok(keys.has('https://example.com/guide/index.html'));
  const brandImage = html.match(/<img[^>]+src="(icons\/icon-192\.png[^\"]*)"/);
  assert.ok(brandImage, 'the visible brand image must be tested as an offline asset');
  assert.match(brandImage[1], /\?v=[0-9a-f]{16}$/);
  assert.ok(keys.has(new URL(brandImage[1], 'https://example.com/guide/').href));
  const manifest = JSON.parse(published.get('manifest.webmanifest'));
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  for (const icon of manifest.icons) {
    assert.match(icon.src, /\?v=[0-9a-f]{16}$/);
    assert.ok(keys.has(new URL(icon.src, 'https://example.com/guide/').href));
  }
  assert.match(cacheVersion(published.get('sw.js').toString()), /^content-[0-9a-f]{16}$/);
  assert.equal(source.get('index.html').toString(), fs.readFileSync(path.join(root, 'index.html'), 'utf8'));
  assert.deepEqual([...versionAssets(source)], [...published]);
  assert.deepEqual([...versionAssets(published)], [...published]);
});

test('a translation-only update changes its URL and offline cache but retains unchanged asset URLs', () => {
  const original = sourceAssets();
  const before = versionAssets(original);
  const updated = new Map(original);
  updated.set('data/monster-reference.js', Buffer.from(original.get('data/monster-reference.js').toString() + '\n// New translation snapshot\n'));
  const after = versionAssets(updated);
  const firstHTML = before.get('index.html').toString(), nextHTML = after.get('index.html').toString();
  assert.notEqual(scriptURL(firstHTML, 'data/monster-reference.js'), scriptURL(nextHTML, 'data/monster-reference.js'));
  assert.equal(scriptURL(firstHTML, 'js/router.js'), scriptURL(nextHTML, 'js/router.js'));
  assert.notEqual(cacheVersion(before.get('sw.js').toString()), cacheVersion(after.get('sw.js').toString()));
  const newURL = scriptURL(nextHTML, 'data/monster-reference.js');
  assert.ok(precacheOf(after.get('sw.js').toString()).includes('./' + newURL));
  assert.ok(!precacheOf(after.get('sw.js').toString()).includes('./' + scriptURL(firstHTML, 'data/monster-reference.js')));
});

test('a gate translation reaches static titles, portal labels, indexes and boss references without changing links', () => {
  const assets=sourceAssets();
  const id='location-townsperson-s-gate';
  assets.set('data/handbook-reference.js',Buffer.from(assets.get('data/handbook-reference.js').toString()+
    '\nGUIDE_REFERENCE.guide_names.entries["'+id+'"] = {title:"Gate of Awaiting",aliases:["Townsperson’s Gate"]};'+
    '\nGUIDE_REFERENCE.guide_names.entries["boss-dragon"] = {details:["Encounter: Gate of Awaiting."],places:["Gate of Awaiting"]};\n'));
  require('../../scripts/build-entry-pages').addEntryPages(assets);
  const article=assets.get('articles/'+id+'/index.html').toString();
  assert.match(article,/<h1[^>]*>Gate of Awaiting<\/h1>/);
  assert.match(article,/aria-label="Entrance to Gate of Awaiting"/);
  assert.match(article,/href="places\/map-72-0\/"/);
  const chamber=assets.get('places/map-9-0/index.html').toString();
  assert.match(chamber,new RegExp('href="articles/'+id+'/"[^>]*>Gate of Awaiting<'));
  const index=assets.get('entries/index.html').toString();
  assert.match(index,new RegExp('href="articles/'+id+'/"[^>]*>Gate of Awaiting<'));
  assert.match(assets.get('articles/boss-dragon/index.html').toString(),/Encounter: Gate of Awaiting\./);
});

test('packaging rejects a missing referenced file instead of publishing a broken offline bundle', () => {
  const files = sourceAssets();
  files.delete('js/router.js');
  assert.throws(() => versionAssets(files), /Missing referenced asset: js\/router.js/);
});

test('a fresh install caches the shell, coalesces immutable misses and serves subsequent hits locally', async () => {
  const {webcrypto} = require('node:crypto');
  const handlers = {}, storage = new Map(), requests = [];
  const base = 'https://example.com/guide/';
  const published = versionAssets(sourceAssets());
  const shell = published.get('index.html').toString();
  const url = new URL(scriptURL(shell,'data/monster-reference.js'),base).href;
  const responses = new Map([...published].map(([file,bytes])=>[file,bytes]));
  const cache = {
    async match(key) { return storage.get(key)?.clone(); },
    async put(key,response) { storage.set(key,response); },
  };
  const context = vm.createContext({URL,Request,Response,crypto:webcrypto,
    self:{location:{href:base+'sw.js'},addEventListener(name,callback){handlers[name]=callback;},async skipWaiting(){}},
    caches:{async keys(){return [];},async open(){return cache;}},
    fetch:async (input,options)=>{
      requests.push([input, options.cache]);
      const bytes=responses.get(new URL(input).pathname.slice('/guide/'.length));
      return new Response(bytes,{status:bytes ? 200 : 404});
    },
  });
  vm.runInContext(published.get('sw.js').toString(),context);
  let complete;
  handlers.install({waitUntil(value){complete=value;}});
  await complete;
  assert.ok(storage.has(base+'index.html'));
  assert.ok(!storage.has(url));
  function read() {
    let result;
    handlers.fetch({request:new Request(url),respondWith(response){result=response;}});
    return result;
  }
  const [one,two]=await Promise.all([read(),read()]);
  const first=await one.text();
  assert.equal(await two.text(),first);
  assert.equal(await (await read()).text(),first);
  assert.deepEqual(requests.filter(([input])=>input===url),[[url,'force-cache']]);
  storage.delete(url);
  responses.set('data/monster-reference.js',Buffer.from('a later deployment'));
  await assert.rejects(read(),/updated/);
  assert.ok(!storage.has(url));
});
