'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
require('../../data/world-guide');
require('../../data/npc-sprites');
const evidence = require('../../docs/npc-sprite-evidence.json');

test('all character portraits have matching native evidence or a species identity', () => {
  const characters = WORLD_GUIDE.entries.filter(row => row.kind === 'npc');
  assert.deepEqual(Object.keys(NPC_SPRITES).sort(), characters.map(row => row.id).sort());
  assert.deepEqual(Object.keys(evidence.portraits).sort(),
    Object.keys(NPC_SPRITES).filter(id => NPC_SPRITES[id].image).sort());
  for (const character of characters) {
    const sprite = NPC_SPRITES[character.id];
    if (sprite.species !== undefined) {
      assert.deepEqual(character.species_ids, [sprite.species]);
      continue;
    }
    const proof = evidence.portraits[character.id];
    assert.match(sprite.image, /^data:image\/png;base64,/);
    const png = Buffer.from(sprite.image.split(',')[1], 'base64');
    assert.equal(createHash('sha256').update(png).digest('hex'), proof.portraitSha256, character.id);
    assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], proof.frameSize, character.id);
    assert.match(proof.resourceSha256, /^[0-9a-f]{64}$/);
    assert.ok(Number.isInteger(proof.archiveIndex) && Number.isInteger(proof.resourceEntry));
  }
});

test('Milly uses her Queen’s Room actor instead of the shared arena conversation host', () => {
  const proof = evidence.portraits['npc-milly'];
  assert.equal(proof.archiveIndex, 5659);
  assert.equal(proof.actorSlot, 4);
  assert.equal(proof.mapId, 'map-11-6');
  assert.equal(proof.sceneResource, 5661);
  assert.equal(proof.actorIndex, 4);
  assert.equal(proof.messageSlot, 1371);
  assert.deepEqual(proof.frameSize, [32, 32]);
});

test('native royal-sprite reuse and Terry’s Tife portrait retain their verified identities', () => {
  assert.equal(NPC_SPRITES['npc-laura'].image, NPC_SPRITES['npc-queen-of-greattree'].image);
  const laura = evidence.portraits['npc-laura'];
  assert.equal(laura.archiveIndex, 4116);
  assert.equal(laura.actorSlot, 2);
  assert.equal(laura.sceneResource, 73);
  assert.equal(laura.messageSlot, 102);
  const tife = evidence.portraits['npc-tife'];
  assert.equal(tife.archiveIndex, 5644);
  assert.equal(tife.actorSlot, 19);
  assert.equal(tife.sceneResource, 5661);
  assert.equal(tife.messageSlot, 1208);
});
