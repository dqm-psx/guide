'use strict';

// Publish only the browser application, never local inputs, source catalogs,
// build scripts, test output, Git history, or the native extraction baseline.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const destination = path.resolve(root, 'site-dist');
if (path.dirname(destination) !== root || path.basename(destination) !== 'site-dist') throw new Error('Invalid publication directory');
if (fs.existsSync(destination)) {
  if (fs.lstatSync(destination).isSymbolicLink()) throw new Error('Publication directory must not be a symlink');
  // The resolved, fixed child directory above is the only recursive target.
  fs.rmSync(destination, {recursive: true});
}
fs.mkdirSync(destination);
for (const file of ['index.html', 'manifest.webmanifest', 'sw.js', '.nojekyll']) {
  fs.copyFileSync(path.join(root, file), path.join(destination, file));
}
const allowedExtensions = {css: new Set(['.css']), js: new Set(['.js']), data: new Set(['.js']), icons: new Set(['.png', '.svg', '.ico'])};
for (const [directory, extensions] of Object.entries(allowedExtensions)) {
  fs.mkdirSync(path.join(destination, directory));
  for (const entry of fs.readdirSync(path.join(root, directory), {withFileTypes: true})) {
    if (directory === 'data' && entry.name === 'monster-baseline.json' && entry.isFile()) continue;
    if (!entry.isFile() || !extensions.has(path.extname(entry.name))) throw new Error(`Unexpected publication asset: ${directory}/${entry.name}`);
    fs.copyFileSync(path.join(root, directory, entry.name), path.join(destination, directory, entry.name));
  }
}
console.log('Prepared browser-only site-dist/ for GitHub Pages.');
