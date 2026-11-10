'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
require('../../data/world-guide');
require('../../data/skill-descriptions');

const raw = fs.readFileSync(path.join(__dirname, '../../data/field-guide.js'), 'utf8');
const guide = JSON.parse(raw.slice('globalThis.FIELD_GUIDE = '.length, raw.lastIndexOf(';')));
const entries = new Map(guide.entries.map(entry => [entry.id, entry]));

test('field reference preserves native item identities and skips magic-key and reserved item slots', () => {
  const reserved = new Set([0, 62, 63, 93, 94, 95]);
  const expected = Array.from({ length: 97 }, (_, id) => id).filter(id => !reserved.has(id));
  const actual = guide.entries.filter(entry => entry.kind === 'item' || entry.kind === 'tool')
    .map(entry => Number(entry.id.replace('item-', '')));
  assert.deepEqual(actual, expected);
  assert.equal(entries.size, guide.entries.length);
  const articles = new Set([...entries.keys(), ...WORLD_GUIDE.entries.map(row => row.id)]);
  for (const entry of entries.values()) {
    assert.ok(entry.source_ids.length, entry.id);
    for (const id of entry.related || []) assert.ok(articles.has(id), entry.id + ' links to ' + id);
  }
});

test('campaign travel tools keep their alternate menu descriptions and exact shop prices', () => {
  const wing = entries.get('item-41');
  assert.ok(wing.source_ids.includes('m_exe_08bf60'));
  assert.match(wing.details.join(' '), /Terry: return to GreatTree\. Cobi \/ Tara: return to GreatLog/);
  assert.deepEqual(wing.prices.map(({ game, buy, gold_pass }) => [game, buy, gold_pass]),
    [['dqm1', 25, 22], ['dqm2', 25, 22]]);
  const tail = entries.get('item-31');
  assert.ok(tail.source_ids.includes('m_exe_08bf94'));
  assert.match(tail.summary, /capture history/);
  const staff = entries.get('item-40');
  assert.ok(staff.source_ids.includes('m_exe_08bf78'));
  assert.match(staff.details.join(' '), /magic door shrine/);
});

test('a shared accessory effect is distinct from a verified purchase location', () => {
  const belt = entries.get('item-65');
  assert.equal(belt.game, 'dqm2');
  assert.equal(belt.availability, 'class-documented');
  assert.equal(belt.prices, undefined);
  assert.match(belt.summary, /80/);
  const scale = entries.get('item-83');
  assert.equal(scale.availability, 'shop');
  assert.deepEqual(scale.prices.map(price => price.game), ['dqm2']);
});

test('every natural skill in the three campaigns has numeric learning thresholds under its native ID', () => {
  const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, '../../data/monster-baseline.json'), 'utf8'));
  for (const monster of baseline.species) {
    for (const skills of Object.values(monster.skills)) {
      for (const skill of skills) {
        const minimums = guide.skill_requirements[skill.id];
        assert.ok(minimums && Number.isInteger(minimums.level) && minimums.level > 0, skill.name);
        for (const value of Object.values(minimums)) assert.ok(Number.isInteger(value) && value > 0, skill.name);
      }
    }
  }
  assert.deepEqual(guide.skill_requirements[1], { level: 1, mp: 7, intelligence: 20 });
});

test('all native skills have a guide type and a resolved effect alongside their in-game text', () => {
  const types = new Set(['Damage', 'Healing', 'Status', 'Support', 'Utility']);
  assert.deepEqual(Object.keys(SKILL_DESCRIPTIONS), Object.keys(guide.skill_requirements));
  for (const [id, skill] of Object.entries(SKILL_DESCRIPTIONS)) {
    assert.ok(types.has(skill.type), id);
    assert.ok(skill.effect.trim() && skill.effect !== skill.description, id);
    assert.doesNotMatch(skill.effect, /[{}]/, id);
  }
  assert.match(SKILL_DESCRIPTIONS[1].effect, /12–15/);
  assert.match(SKILL_DESCRIPTIONS[22].effect, /30–40 HP/);
  assert.equal(SKILL_DESCRIPTIONS[61].mpCost, 'All remaining MP');
  assert.match(SKILL_DESCRIPTIONS[133].effect, /level 30 ally with 200 HP/);
  assert.match(SKILL_DESCRIPTIONS[159].effect, /500/);
});
