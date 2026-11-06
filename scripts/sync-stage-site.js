'use strict';

// Publish only the browser application, never local inputs, source catalogs,
// build scripts, test output, Git history, or the native extraction baseline.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const digest = value => crypto.createHash('sha256').update(value).digest('hex').slice(0, 16);

function versionAssets(input) {
  const assets = new Map(input);
  function read(file) {
    if (!assets.has(file)) throw new Error(`Missing publication asset: ${file}`);
    return assets.get(file).toString('utf8');
  }
  function versionedURL(url) {
    const file = url.replace(/^\.\//, '').split(/[?#]/, 1)[0];
    if (!assets.has(file)) throw new Error(`Missing referenced asset: ${file}`);
    return url.split(/[?#]/, 1)[0] + '?v=' + digest(assets.get(file));
  }
  // Manifest icons must use the same URLs as the precache, including when an
  // installed copy starts offline. Scope and start_url stay unchanged.
  const manifest = JSON.parse(read('manifest.webmanifest'));
  manifest.icons = manifest.icons.map(icon => ({...icon, src: versionedURL(icon.src)}));
  assets.set('manifest.webmanifest', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
  const html = read('index.html').replace(/(<(?:script|link|img)\b[^>]*?\b(?:src|href)=)(["'])([^"']+)\2/gi,
    (match, prefix, quote, url) => /^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(url)
      ? match : prefix + quote + versionedURL(url) + quote);
  assets.set('index.html', Buffer.from(html));

  const originalWorker = read('sw.js');
  const match = originalWorker.match(/const PRECACHE = (\[[\s\S]*?\]);/);
  if (!match) throw new Error('Missing worker precache declaration');
  const precache = JSON.parse(match[1]).map(url => url === './index.html' ? url : versionedURL(url));
  let worker = originalWorker.replace(match[0], 'const PRECACHE = ' + JSON.stringify(precache, null, 2) + ';');
  // Hash all application identities plus the shell and worker implementation.
  // Changing only the translation snapshot therefore rotates the offline cache.
  const versionDeclaration = /const CACHE_VERSION = "[^"]+";/;
  if (!versionDeclaration.test(worker)) throw new Error('Missing worker version declaration');
  const version = 'content-' + digest(html + '\n' + worker.replace(versionDeclaration, 'const CACHE_VERSION = "CONTENT";'));
  worker = worker.replace(versionDeclaration, `const CACHE_VERSION = "${version}";`);
  assets.set('sw.js', Buffer.from(worker));
  return assets;
}

function stageSite() {
  const root = path.resolve(__dirname, '..');
  const destination = path.resolve(root, 'site-dist');
  if (path.dirname(destination) !== root || path.basename(destination) !== 'site-dist') throw new Error('Invalid publication directory');
  const assets = new Map();
  for (const file of ['index.html', 'manifest.webmanifest', 'sw.js', '.nojekyll']) assets.set(file, fs.readFileSync(path.join(root, file)));
  const allowedExtensions = {css: new Set(['.css']), js: new Set(['.js']), data: new Set(['.js']), icons: new Set(['.png', '.svg', '.ico'])};
  for (const [directory, extensions] of Object.entries(allowedExtensions)) {
    for (const entry of fs.readdirSync(path.join(root, directory), {withFileTypes: true})) {
      if (directory === 'data' && entry.name === 'monster-baseline.json' && entry.isFile()) continue;
      if (!entry.isFile() || !extensions.has(path.extname(entry.name))) throw new Error(`Unexpected publication asset: ${directory}/${entry.name}`);
      assets.set(directory + '/' + entry.name, fs.readFileSync(path.join(root, directory, entry.name)));
    }
  }
  const published = versionAssets(assets);
  if (fs.existsSync(destination)) {
    if (fs.lstatSync(destination).isSymbolicLink()) throw new Error('Publication directory must not be a symlink');
    // The resolved, fixed child directory above is the only recursive target.
    fs.rmSync(destination, {recursive: true});
  }
  fs.mkdirSync(destination);
  for (const [file, bytes] of published) {
    fs.mkdirSync(path.dirname(path.join(destination, file)), {recursive: true});
    fs.writeFileSync(path.join(destination, file), bytes);
  }
  console.log('Prepared browser-only site-dist/ with fingerprinted assets and offline cache.');
}

module.exports = {versionAssets};
if (require.main === module) stageSite();
