'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {addEntryPages} = require('../../scripts/build-entry-pages');
const {loadScripts} = require('../helpers/load-scripts');
const {growthAt} = require('../../js/monster-reference');
const root = path.resolve(__dirname, '../..');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const sourceFiles = JSON.parse(worker.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1]);
const assets = new Map(sourceFiles.map(file => [file.slice(2), fs.readFileSync(path.join(root, file))]));
addEntryPages(assets);
const {COMBAT_REFERENCE: combat, MONSTER_REFERENCE: monsters} = loadScripts([
  path.join(root, 'data/combat-reference.js'), path.join(root, 'data/monster-reference.js'),
]);
const page = index => assets.get('monsters/' + index + '/index.html')?.toString();
const resistanceTable = (html, mode) => html.match(new RegExp('<table[^>]*data-resistance-context="' + mode + '"[\\s\\S]*?</table>'))?.[0];

test('every named static monster page has all 27 companion grades and a separate wild comparison', () => {
  for (const monster of combat.species) {
    const html = page(monster.speciesId);
    assert.ok(html, 'missing static monster ' + monster.speciesId);
    assert.match(html, /<h2>Stats &amp; growth<\/h2>/);
    assert.match(html, /<h2>Resistances<\/h2>/);
    for (const mode of ['saved', 'wild']) {
      const table = resistanceTable(html, mode);
      assert.ok(table);
      assert.equal([...table.matchAll(/<tr data-channel="/g)].length, 27);
      for (const [index, grade] of monster[mode + 'Resistances'].entries()) {
        assert.match(table, new RegExp('<tr data-channel="' + (index + 1) + '"><th scope="row">[^<]+</th><td>' + grade + ' / ' + (mode === 'saved' ? 7 : 3) + '</td>'));
      }
    }
    assert.match(html, /<details[^>]*><summary>Compare ordinary wild monsters<\/summary>/);
  }
  assert.equal(page(325), undefined, 'the unauthenticated internal slot must not gain a public species page');
});

test('static resistance percentages distinguish action scales and avoid claiming status immunity', () => {
  const html = page(0), table = resistanceTable(html, 'saved');
  assert.match(table, /Blaze \/ Big Bang<\/th><td>2 \/ 7<\/td><td><span>75% \(spell scale\)<\/span><span>70% \(breath scale\)<\/span>/);
  assert.match(table, /Sacrifice \/ Body Slam<\/th><td>7 \/ 7<\/td><td><span class="entry-note">Effect-specific<\/span>/);
  assert.match(html, /grade 7 does not guarantee immunity to every effect/);
  assert.match(html, /href="articles\/field-breed\/"/);
});

test('static growth lists all six gains, verified EXP, exact levels and distinct breeding versus recruitment caps', () => {
  const slime = monsters.species.find(monster => monster.index === 11);
  const html = page(11);
  for (const stat of growthAt(slime.stats, 40)) {
    assert.ok(html.includes('<dt>' + stat.label + '</dt><dd>+' + stat.total + '</dd>'));
  }
  assert.match(html, /<dt>Base level cap<\/dt><dd>40<\/dd>/);
  assert.match(html, /<dt>Usual recruitment cap<\/dt><dd>38–42<\/dd>/);
  assert.match(html, /<dt>Total EXP at level 40<\/dt><dd>[\d,]+<\/dd>/);
  assert.match(html, /<summary>EXP and stat gains by level<\/summary>/);
  assert.match(html, /<tr><th scope="row">1<\/th><td>0<\/td><td>—<\/td>/);
  assert.match(html, /<tr><th scope="row">99<\/th><td>[\d,]+<\/td>/);
  assert.match(page(235), /<dt>Base level cap<\/dt><dd>45<\/dd>/);
  assert.match(page(235), /<dt>Usual recruitment cap<\/dt><dd>48–52<\/dd>/);
});

test('special static entries expose verified data without invented caps, growth or stale resistance warnings', () => {
  const aibou = page(323);
  assert.match(aibou, /<dt>Total EXP at level 40<\/dt>/);
  assert.match(aibou, /data-resistance-context="saved"/);
  assert.doesNotMatch(aibou, /<dt>(?:Base level cap|Usual recruitment cap)<\/dt>/);
  const extra = page(315);
  assert.match(extra, /Verified growth and EXP data are unavailable for this extra entry/);
  assert.match(extra, /data-resistance-context="saved"/);
  assert.doesNotMatch(extra, /<dt>Total EXP/);
  for (const html of [aibou, extra]) {
    assert.doesNotMatch(html, /resistance values have not yet been verified|undefined|NaN/);
  }
});
