const {test} = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {loadScripts} = require('../helpers/load-scripts');
const {block, card, finishBlock, planningBlock, putBits, adventureBlock} = require('../helpers/psx-save');
const {read, generatedKeyName} = require('../../js/save-import');
const species = loadScripts([path.join(__dirname, '../../data/breeding-data.js')]).DATA.species;
const reference = loadScripts([path.join(__dirname, '../../data/save-reference.js')]).SAVE_REFERENCE;

test('reads obtained species separately from the current roster, bank stocks, eggs and generated keys', () => {
  for (let campaign = 0; campaign < 3; campaign++) {
    const save = read(adventureBlock(campaign), species, reference).saves[0];
    const log = save.adventureLog;
    assert.deepEqual([log.hours,log.minutes,log.completed,log.gold,log.bankGold,log.depositedMedals],
      [19,12,true,12345,543210,17]);
    assert.deepEqual(log.bag,[{itemId:1,quantity:2},{itemId:44,quantity:1},{itemId:69,quantity:1}]);
    assert.deepEqual(log.vault,[{itemId:2,quantity:24},{itemId:44,quantity:3}]);
    assert.deepEqual(log.librarySpecies,[0,25,26,88,311]);
    assert.deepEqual(log.eggs,[{speciesIndex:0,plus:0,sex:null},{speciesIndex:0,plus:0,sex:'male'}]);
    assert.deepEqual(log.extraMonsters.map(({saveDetails,nickname,...row})=>row),
      [{speciesIndex:323,plus:11,level:20,sex:'female',location:'farm'}]);
    assert.equal(log.extraMonsters[0].saveDetails.experience,0);
    assert.equal(log.unidentified,1);
    assert.equal(log.unavailable,1);
    assert.ok(save.entries.every(row=>row.speciesIndex!==323));
    if (campaign === 0) assert.equal(log.keys,null);
    else {
      assert.deepEqual(log.keys.fixed,[0,1,2,4]);
      assert.deepEqual(log.keys.generated,[
        {slot:1,appraised:true,prefix:0,noun:0},{slot:20,appraised:false,prefix:null,noun:null}
      ]);
      assert.equal(generatedKeyName(log.keys.generated[0],reference),'Brif Desert Key');
      assert.equal(generatedKeyName(log.keys.generated[1],reference),null);
      assert.deepEqual([log.keys.appraised,log.keys.mysterious],[1,1]);
    }
  }
});

test('ignores family member zero, rare species outside the 312 entries, unused storage tail and ungifted keys', () => {
  const bytes = block(2);
  bytes.fill(255,0x222,0x24c);
  putBits(bytes,0x172,97*7,7,9);
  putBits(bytes,0x1ca,97*7,7,7);
  const log = read(finishBlock(bytes),species,reference).saves[0].adventureLog;
  assert.deepEqual(log.librarySpecies,Array.from({length:312},(_,i)=>i));
  assert.deepEqual(log.vault,[]);
  assert.deepEqual(log.bag,[]);
  assert.deepEqual(log.keys,{fixed:[],appraised:0,mysterious:0,generated:[]});
  for (let i=0;i<97;i++) {
    putBits(bytes,0x172,i*7,7,i+1);
    putBits(bytes,0x1ca,i*7,7,1);
  }
  const bank = read(finishBlock(bytes),species,reference).saves[0].adventureLog.vault;
  assert.equal(bank.length,97);
  assert.deepEqual(bank.at(-1),{itemId:97,quantity:1});
});

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

test('reads saved EXP, temperament, named parents and both grandparent branches',()=>{
  const {pedigreeBlock}=require('../helpers/psx-save');
  const entries=read(pedigreeBlock(),species,reference).saves[0].entries;
  const details=entries[0].saveDetails;
  assert.equal(details.experience,0x123456);
  assert.equal(details.experienceToNext,273);
  assert.equal(details.personalityId,8);
  assert.equal(details.wildness,22);
  assert.deepEqual(details.pedigree,[
    {speciesIndex:0,sex:'female',plus:7,nickname:'AB'},
    {speciesIndex:26,sex:'male',plus:15,nickname:'CD'},
    {speciesIndex:1,sex:'male'},null,null,{speciesIndex:0,sex:'female'}]);
  assert.deepEqual(entries[1].saveDetails.pedigree,Array(6).fill(null));
});

test('save location uses fixed atlas descriptors and arena wins respect the campaign',()=>{
  for (const variant of [0,1,2]) {
    const bytes=block(variant);
    bytes[0x1ef0]=0x22;bytes[0x1ef1]=0x02;bytes[0x1ef3]=0x28;
    bytes.writeUInt16LE(8,0x1f14);bytes[0x1f16]=2;
    const log=read(finishBlock(bytes),species,reference).saves[0].adventureLog;
    assert.deepEqual(log.savedMap,{scene:8,area:2});
    assert.deepEqual(log.arenaWins,variant===0?['g','s']:['kids','b']);
    bytes.writeUInt16LE(112,0x1f14);
    assert.equal(read(finishBlock(bytes),species,reference).saves[0].adventureLog.savedMap,undefined);
  }
});

test('a recorded extra-species ancestor keeps its name and its campaign-specific natural skills',()=>{
  const {adapt} = require('../../js/owned-monsters');
  for (const [variant, skills] of [[0,[102,155,156]],[2,[129,159,160]]]) {
    const bytes=planningBlock(variant), at=0x250+2*136;
    for (const bit of [0, 36]) {
      putBits(bytes,at+0x72,bit,6,34); // Aibou, native species index 323.
      putBits(bytes,at+0x72,bit+6,4,10);
    }
    for(let i=3;i<6;i++) putBits(bytes,at+0x40,i*3,3,0);
    putBits(bytes,at+0x20,0,5,3); // Learned selector points at the parent's first natural skill.
    const save=read(finishBlock(bytes),species,reference).saves[0];
    const owned=adapt(save.entries[0],save);
    assert.equal(owned.pedigree[0].speciesIndex,323);
    assert.equal(owned.pedigree[2].speciesIndex,323);
    assert.equal(owned.knownSkills[0],skills[0]);
    assert.ok(skills.every(id=>owned.inheritedSkills.includes(id)));
  }
});

test('an extra species keeps its saved stats, moves and pedigree outside the breeding roster',()=>{
  const {adventureBlock}=require('../helpers/psx-save');
  const bytes=adventureBlock(2), at=0x250+35*136;
  putBits(bytes,at+0x0c,0,10,777);
  putBits(bytes,at+0x58,0,24,123456);
  putBits(bytes,at+0x72,0,6,1);
  bytes.set([10,11,255,255,255],at+0x68);
  bytes.writeUInt16LE(0x1000,at+0x1c);
  const save=read(finishBlock(bytes),species,reference).saves[0];
  assert.ok(!save.entries.some(row=>row.speciesIndex===323));
  const [extra]=save.adventureLog.extraMonsters;
  assert.equal(extra.speciesIndex,323);
  assert.equal(extra.location,'hibernation');
  assert.equal(extra.saveDetails.location,'farm');
  assert.equal(extra.saveDetails.baseStats.hp,777);
  assert.equal(extra.saveDetails.experience,123456);
  assert.deepEqual(extra.saveDetails.knownSkills,[129]);
  assert.equal(extra.saveDetails.pedigree[0].nickname,'AB');
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
