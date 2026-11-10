'use strict';

const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const test=require('node:test');
const vm=require('node:vm');
const root=path.join(__dirname,'../..');
const data=vm.createContext({});
for (const file of ['data/handbook-reference.js','data/world-guide.js','data/field-routes.js',
  'data/player-atlas.js','data/gate-generation.js','js/locations.js']) {
  vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),data,{filename:file});
}
const generated=data.GATE_GENERATION;
const gates=generated.entries;

test('all native gate definitions have existing final maps, including nonsequential destinations',()=>{
  const maps=new Set(data.PLAYER_ATLAS.maps.map(row=>row.id));
  const articles=new Set(data.WORLD_GUIDE.entries.map(row=>row.id));
  assert.equal(Object.keys(gates).length,32);
  for (const [id,gate] of Object.entries(gates)) {
    assert.ok(articles.has(id),id);
    assert.deepEqual(Array.from(gate.ordinaryFloors),[1,gate.finalFloor-1]);
    assert.equal(gate.finalMaps.length,1);
    assert.ok(maps.has(gate.finalMaps[0]),gate.finalMaps[0]);
  }
  assert.equal(gates['location-anger-gate'].finalMaps[0],'map-83-0');
  assert.equal(gates['location-wisdom-gate'].finalMaps[0],'map-81-0');
  assert.equal(gates['location-farm-gate'].finalMaps[0],'map-6-11');
  assert.equal(gates['location-arena-left-gate'].finalMaps[0],'map-84-0');
  assert.equal(gates['location-hidden-gate'].finalMaps[0],'map-101-0');
  assert.equal(gates['location-hidden-gate'].specialFloors,null);
});

test('terrain possibilities use per-gate native weights and actual immutable artwork',()=>{
  assert.equal(Object.keys(generated.terrains).length,12);
  assert.deepEqual(Array.from(gates['location-departure-gate'].terrains,row=>[row.id,row.weight]),
    [['terrain-0',10],['terrain-6',10],['terrain-7',80]]);
  assert.equal(gates['location-departure-gate'].finalFloor,5);
  for (const gate of Object.values(gates)) {
    assert.equal(gate.terrains.reduce((sum,row)=>sum+row.weight,0),100);
    assert.equal(new Set(gate.terrains.map(row=>row.id)).size,gate.terrains.length);
    for (const terrain of gate.terrains) assert.ok(generated.terrains[terrain.id]);
  }
  for (const terrain of Object.values(generated.terrains)) {
    assert.match(terrain.image,/^maps\/[a-f0-9]{20}\.webp$/);
    const bytes=fs.readFileSync(path.join(root,terrain.image));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex').slice(0,20),
      path.basename(terrain.image,'.webp'));
    assert.equal(bytes.subarray(0,4).toString(),'RIFF');
    assert.equal(bytes.subarray(8,12).toString(),'WEBP');
    assert.equal(terrain.patterns,terrain.layout==='rooms'?13:5);
  }
});

test('special-floor possibilities respect final floors, native byte overflow and patch restorations',()=>{
  assert.deepEqual(Array.from(gates['location-departure-gate'].specialFloors.floors),[]);
  assert.deepEqual(Array.from(gates['location-townsperson-s-gate'].specialFloors.rooms,row=>row.id),['church']);
  assert.deepEqual(Array.from(gates['location-guardian-gate'].specialFloors.rooms,row=>row.id),['church']);
  const later=gates['location-confusion-gate'].specialFloors;
  assert.deepEqual(Array.from(later.floors),[3]); // Floor 6 is its fixed final room.
  assert.deepEqual(Array.from(later.rooms,row=>[row.id,row.variants]),
    [['treasure',6],['forest',1],['church',1],['shop',1],['colosseum',1],['maze',3],['sliding',3]]);
  assert.equal(later.edition,'Current English patch');
  assert.equal(later.rooms.find(row=>row.id==='shop').restored,false);
  assert.equal(later.rooms.find(row=>row.id==='forest').restored,true);
  for (const gate of Object.values(gates)) {
    for (const floor of gate.specialFloors?.floors || []) {
      assert.equal(floor%3,0);
      assert.ok(floor<gate.finalFloor);
    }
  }
});

test('native final battles distinguish individual bosses, alternatives and return-visit sequences',()=>{
  const bosses=Object.values(gates).filter(gate=>gate.boss);
  assert.equal(bosses.length,13);
  assert.equal(gates['location-departure-gate'].boss.species,13);
  assert.equal(gates['location-departure-gate'].boss.entry,'npc-healie');
  assert.equal(gates['location-arena-left-gate'].boss.species,152);
  assert.equal(gates['location-medal-gate'].boss,undefined);
  assert.equal(gates['location-destruction-gate'].boss,undefined);
  assert.equal(gates['location-hidden-gate'].boss,undefined);
  for (const gate of bosses) assert.ok(data.GUIDE_REFERENCE.species[gate.boss.species]);
  const medal=gates['location-medal-gate'];
  assert.deepEqual(Array.from(medal.bosses,boss=>boss.species),[9,149,122]);
  assert.equal(medal.bossLabel,'Boss choices');
  assert.equal(medal.bossNote,'Choose one of three encounters.');
  const destruction=gates['location-destruction-gate'];
  assert.deepEqual(Array.from(destruction.bosses,boss=>boss.species),[293,294]);
  assert.equal(destruction.bossLabel,'Boss sequence');
  assert.equal(destruction.bossNote,'Defeat the first boss, then return to fight the second.');
  assert.equal(generated.evidence.gates.find(row=>row.location==='location-medal-gate').bosses.relationship,'alternatives');
  assert.equal(generated.evidence.gates.find(row=>row.location==='location-destruction-gate').bosses.relationship,'return-visit');
});

test('supplemental Spirit’s Spring retains the original independent atlas fingerprint',()=>{
  const index=JSON.parse(fs.readFileSync(path.join(root,'scripts/atlas-native-index.json'),'utf8'));
  const proof=JSON.parse(fs.readFileSync(path.join(root,'scripts/atlas-verification.json'),'utf8'));
  assert.equal(index.sourcePixelsSha256,'e08c153ec4f1c7a675c3ce9914f23c62e7ef6e488718e6486e09e5d4e452fc36');
  assert.deepEqual(index.nativeSupplementMaps,['map-84-0']);
  assert.deepEqual(proof.nativeSupplementMaps,['map-84-0']);
  const row=data.PLAYER_ATLAS.maps.find(map=>map.id==='map-84-0');
  assert.equal(row.titleRow,'dialogue_full_0000_1999.json:s00208000_0000');
  assert.equal(row.scene,84);
});
