const {test} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {loadScripts} = require('../helpers/load-scripts');
const {block, card, finishBlock, planningBlock, putBits} = require('../helpers/psx-save');
const {read} = require('../../js/save-import');
const species = loadScripts([path.join(__dirname, '../../data/breeding-data.js')]).DATA.species;
const reference = loadScripts([path.join(__dirname, '../../data/save-reference.js')]).SAVE_REFERENCE;

test('reads the packed party indices, ranch and storage with native family/member IDs', () => {
  const save = read(block(2), species).saves[0];
  assert.equal(save.campaign, 'DQM2 · Tara');
  assert.equal(save.game, 'dqm2');
  assert.deepEqual(save.entries.map(({saveDetails,...entry})=>entry), [
    {speciesIndex: 26, nickname: 'Bob', sex: 'male', plus: 12, level: 30, location: 'party'},
    {speciesIndex: 0, nickname: '', sex: 'female', plus: 9, level: 10, location: 'farm'},
    {speciesIndex: 1, nickname: 'G', sex: 'male', plus: 0, level: 5, location: 'farm'},
  ]);
  assert.deepEqual(save.skipped, {eggs: 2, unavailable: 1, unsupported: 1});
  assert.equal(save.unreadableNames, 1);
});

test('restores base stats, equipped stats, individual cap and all resistance channels without editing input',()=>{
  const bytes=planningBlock(2),before=Buffer.from(bytes);
  const save=read(bytes,species,reference).saves[0],entry=save.entries[0],details=entry.saveDetails;
  assert.deepEqual(bytes,before);
  assert.equal(save.campaignKey,'tara');
  assert.equal(details.levelCap,55);assert.equal(details.campaign,'tara');assert.equal(details.equipmentId,69);
  assert.deepEqual(details.baseStats,{hp:450,mp:220,attack:180,defense:155,agility:300,intelligence:277});
  assert.deepEqual(details.battleStats,{...details.baseStats,attack:230});
  assert.equal(details.currentHp,237);assert.equal(details.currentMp,85);
  assert.deepEqual(details.resistances,Array.from({length:27},(_,i)=>i%8));
  assert.deepEqual(details.knownSkills,[4,reference.specialSkills[0]]);
  assert.deepEqual(details.inheritedSkills,[...new Set([...reference.naturalSkills.dqm2[26].filter(Boolean),4,10,23])]);
  assert.deepEqual(save.entries.map(row=>row.saveDetails.trainingLocation),['party','farm','hibernation']);
  assert.ok(!JSON.stringify(save).includes('masterId'));
});

test('rejects unsupported skill selectors and unknown numeric fields instead of inventing values',()=>{
  const bytes=planningBlock(),at=0x250+2*136;
  putBits(bytes,at+0x20,0,5,30); // Normal selector outside 25-slot pool.
  putBits(bytes,at+0x0c,0,10,1000);putBits(bytes,at+4,25,7,20);
  putBits(bytes,at+8,0,10,0);putBits(bytes,at+8,10,10,1023);
  const details=read(finishBlock(bytes),species,reference).saves[0].entries[0].saveDetails;
  assert.equal(details.knownSkills,null);assert.equal(details.baseStats.hp,null);assert.equal(details.levelCap,null);
  assert.equal(details.currentHp,0);assert.equal(details.currentMp,null);
  const old=read(planningBlock(),species).saves[0].entries[0].saveDetails;
  assert.equal(old.knownSkills,null);assert.equal(old.inheritedSkills,null);assert.equal(old.battleStats.attack,null);
});

test('only offers live game directory entries, retaining good saves beside damaged ones', () => {
  const bytes = card([[1, 11, block()], [3, 4, block(1)], [6, 3, block()], [8, 8, block()], [9, 9, block()]]);
  bytes[6 * 128] = 0xa1; // Deleted save still has valid data bytes.
  bytes[8 * 8192 + 512] ^= 1;
  bytes[9 * 128 + 127] ^= 1;
  bytes.set(block(), 7 * 8192); // Orphaned data without a live directory entry.
  const result = read(bytes, species);
  assert.deepEqual(result.saves.map(s => [s.slot, s.game]), [[4, 'dqm2'], [11, 'dqm1']]);
  assert.match(result.errors.join(' '), /Slot 8.*checksum.*Slot 9.*directory/);
  const single = Buffer.concat([bytes.subarray(3 * 128, 4 * 128), bytes.subarray(3 * 8192, 4 * 8192)]);
  assert.equal(read(single, species).saves[0].slot, 4);
});

test('validates signature, native checksum ranges, campaign, party and file boundaries', () => {
  const valid = block();
  valid[0x1fc7] ^= 77;
  valid[0x1fe8] ^= 77;
  assert.equal(read(valid, species).saves[0].entries.length, 3);
  valid[0x1fc8] ^= 77;
  assert.throws(() => read(valid, species), /checksum/);
  const foreign = block();
  foreign[0x100] = 0;
  assert.throws(() => read(foreign, species), /does not contain/);
  const invalid = block(3);
  assert.throws(() => read(invalid, species), /campaign/);
  const wrongParty = block();
  wrongParty[0x150] = 3;
  assert.throws(() => read(finishBlock(wrongParty), species), /roster slot/);
  assert.throws(() => read(valid.subarray(1), species), /128 KiB/);
  assert.throws(() => read(card([]), species), /No active/);
});
