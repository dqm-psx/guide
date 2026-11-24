'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {loadScripts} = require('../helpers/load-scripts');
const {RECRUITMENT_REFERENCE: reference, MONSTER_REFERENCE: monsters} = loadScripts([
  path.join(__dirname, '../../data/recruitment-reference.js'),
  path.join(__dirname, '../../data/monster-reference.js'),
]);
const encounter = (campaign, contextId) => reference.encounters.find(row => row.campaign === campaign && row.contextId === contextId);

test('expanded encounter identities retain the verified wild set and separate all three encounter kinds', () => {
  assert.equal(reference.schemaVersion, 2);
  assert.equal(reference.encounters.length, 400);
  assert.equal(new Set(reference.encounters.map(row => row.campaign + ':' + row.contextId)).size, 400);
  assert.equal(reference.provenance.enemyRecords, 1978);
  assert.equal(JSON.stringify(reference.provenance.countsByKind), JSON.stringify({
    wild: {contexts: 283, enemyRecords: 1131}, boss: {contexts: 57, enemyRecords: 71}, master: {contexts: 60, enemyRecords: 776},
  }));
  assert.equal(reference.provenance.wildEnemyRecordsSha256, 'bdb2769b4a4f880497165c486c014b33df57592091d89b25f649e4fbb65b6502');
  const species = new Set(monsters.species.map(row => row.index));
  for (const row of reference.encounters) {
    assert.equal(row.meatAllowed, row.kind !== 'boss');
    assert.equal(row.battleMode, {wild: 0, boss: 1, master: 3}[row.kind]);
    assert.ok(row.maxEnemies >= 1 && row.maxEnemies <= 3);
    assert.equal(new Set(row.enemies.map(enemy => enemy.recordIndex)).size, row.enemies.length);
    for (const enemy of row.enemies) {
      assert.ok(species.has(enemy.speciesIndex));
      assert.ok(Number.isInteger(enemy.maxHp) && enemy.maxHp > 0);
      assert.ok(Number.isInteger(enemy.maxMp) && enemy.maxMp >= 0);
    }
  }
});

test('boss choices and successive fights retain their real formations and source records', () => {
  const mirror = encounter('terry', 0x95);
  assert.deepEqual(JSON.parse(JSON.stringify(mirror.formations)), [
    {id: 1, enemyRecordIndices: [0, 0]}, {id: 2, enemyRecordIndices: [1]}, {id: 3, enemyRecordIndices: [2]},
  ]);
  assert.deepEqual(Array.from(mirror.enemies, row => row.recruitmentClass), [6, 7, 7]);
  const medal = encounter('terry', 0x91);
  assert.deepEqual(Array.from(medal.formations, row => Array.from(row.enemyRecordIndices)), [[0], [1], [2]]);
  assert.equal(medal.maxEnemies, 1);
  assert.deepEqual(Array.from(encounter('terry', 0x84).enemies, row => row.recordIndex), [1]);
  assert.deepEqual(Array.from(encounter('terry', 0x8d).enemies, row => row.recordIndex), [0, 1]);
  assert.equal(encounter('terry', 0x9f), undefined);
  for (const context of [122, 123, 124, 125]) assert.equal(encounter('terry', context), undefined);
  for (const row of reference.encounters.filter(row => row.kind === 'boss')) {
    const represented = new Set(row.formations.flatMap(form => form.enemyRecordIndices));
    assert.deepEqual(new Set(row.enemies.map(enemy => enemy.recordIndex)), represented);
    for (const enemy of row.enemies) {
      assert.deepEqual(Array.from(enemy.formationIds), Array.from(row.formations.filter(form => form.enemyRecordIndices.includes(enemy.recordIndex)), form => form.id));
    }
  }
});

test('Terry conditional and blocked bosses and both siblings story bosses keep native eligibility', () => {
  const darkHorn = encounter('terry', 0x92).enemies[0];
  assert.equal(darkHorn.speciesIndex, 66);
  assert.equal(darkHorn.recruitmentClass, 5);
  assert.equal(darkHorn.speciesRank, 5);
  assert.equal(darkHorn.maxHp, 2000);
  assert.equal(encounter('terry', 0x94).enemies[0].recruitmentClass, 7);
  for (const campaign of ['cobi', 'tara']) {
    assert.equal(reference.encounters.filter(row => row.kind === 'boss' && row.campaign === campaign).length, 13);
    assert.equal(encounter(campaign, 94).enemies[0].speciesIndex, 239);
    assert.equal(encounter(campaign, 94).enemies[0].recruitmentClass, 0);
    assert.equal(encounter(campaign, 112).enemies[0].recordIndex, 4);
    assert.equal(encounter(campaign, 112).enemies[0].speciesIndex, 255);
    assert.equal(encounter(campaign, 112).enemies[0].recruitmentClass, 0);
    assert.equal(encounter(campaign, 125).enemies[0].recruitmentClass, 7);
  }
  assert.deepEqual(Array.from(encounter('cobi', 124).enemies, row => row.speciesIndex), [193, 54, 111]);
  assert.deepEqual(Array.from(encounter('tara', 124).enemies, row => row.speciesIndex), [223, 167, 267]);
});

test('foreign masters include every native tier and candidate appearance without boss restrictions', () => {
  for (const [campaign, base, expected] of [['terry', 205, 236], ['cobi', 164, 270], ['tara', 164, 270]]) {
    const rows = reference.encounters.filter(row => row.kind === 'master' && row.campaign === campaign);
    assert.deepEqual(Array.from(rows, row => row.masterRank), Array.from({length: 20}, (_, rank) => rank));
    assert.equal(rows.reduce((sum, row) => sum + row.enemies.length, 0), expected);
    for (const row of rows) {
      assert.equal(row.contextId, base + row.masterRank);
      assert.equal(row.meatAllowed, true);
      assert.ok(row.enemies.every(enemy => enemy.recruitmentClass !== 7 && enemy.speciesRank !== 7));
    }
  }
  const knownMetal = encounter('terry', 205 + 5).enemies.find(row => row.speciesIndex === 20);
  assert.equal(knownMetal.level, 20);
  assert.equal(knownMetal.recruitmentClass, 6);
  assert.equal(reference.encounters.filter(row => row.kind === 'master').flatMap(row => row.enemies).filter(row => row.recruitmentClass === 3).length, 2);
});
