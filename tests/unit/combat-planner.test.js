'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const model=require('../../js/combat-planner');
const context={};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../../data/combat-reference.js'),'utf8'),context);
const ref=JSON.parse(JSON.stringify(context.COMBAT_REFERENCE));
const skill=id=>ref.skills.find(row=>row.skillId===id);
const subject=(familyId=0,code=0)=>({familyId,savedResistances:Array(27).fill(code),wildResistances:Array(27).fill(code)});

test('normal attacks retain low-damage branches, odd Defense and the nonmonotone envelope',()=>{
  for(const [a,d,expected] of [[0,0,[0,1]],[16,28,[0,1]],[16,26,[0,1]],[16,24,[1,3]],
    [100,99,[23,27]],[100,100,[23,27]],[999,999,[234,266]]]) assert.deepEqual(model.physicalRange(a,d),expected);
  assert.deepEqual(model.physicalEnvelope([14,16],[26,26]),[0,2], 'Interior Attack 15 exceeds both endpoint outcomes');
  assert.deepEqual(model.physicalRange(14,26),[0,1]);
  assert.deepEqual(model.physicalRange(16,26),[0,1]);
});

test('wild stat initialization preserves caps, minimums and the signed-halfword guard',()=>{
  assert.deepEqual(model.wildStatRange(0,'hp'),[1,1]);
  assert.deepEqual(model.wildStatRange(7,'defense'),[5,7]);
  assert.deepEqual(model.wildStatRange(999,'attack'),[799,999]);
  assert.deepEqual(model.wildStatRange(1000,'hp'),[800,1100]);
  assert.deepEqual(model.wildStatRange(30000,'hp'),[1,1]);
});

test('native action samples match spell, breath, level and family-bonus endpoints',()=>{
  // These endpoint pairs are actual MIPS-handler outputs in the pinned manual
  // report, re-executed against the retail and Current discs by our verifier.
  const samples=[
    [1,false,false,[9,11]],[1,true,false,[5,10]],
    [64,false,false,[9,15]],[64,true,false,[8,12]],
    [72,false,false,[45,60]],[72,true,false,[22,28]],
    [102,false,false,[126,147]],[102,false,true,[163,191]],
    [102,true,false,[72,112]],[102,true,true,[93,145]],
    [103,false,false,[262,307]],[103,false,true,[340,399]],
    [103,true,false,[229,272]],[103,true,true,[297,353]],
  ];
  for(const [id,enemyUser,bonus,expected] of samples) {
    const target=subject(id===102&&bonus?7:0,1),user=subject(id===103&&bonus?1:0);
    const result=model.skillOutcome(skill(id),{target,user,enemyUser,wildTarget:!enemyUser,level:20});
    assert.deepEqual(result.range,expected,JSON.stringify({id,enemyUser,bonus}));
    assert.equal(result.bonusApplies,bonus);
  }
});

test('companion overrides are explicit and do not mutate species baselines',()=>{
  const target=subject(0,0),before=JSON.stringify(target);
  const baseline=model.skillOutcome(skill(1),{target,wildTarget:false});
  const overridden=model.skillOutcome(skill(1),{target,wildTarget:false,resistanceCode:7});
  assert.deepEqual(baseline.range,[12,15]);
  assert.deepEqual(overridden.range,[0,0]);
  assert.equal(overridden.overriddenResistance,true);
  assert.equal(baseline.overriddenResistance,false);
  assert.equal(JSON.stringify(target),before);
  assert.deepEqual(model.scales,ref.scales);
});

test('encounter fixtures connect stable species, stats and resistance identities',()=>{
  const encounter=ref.encounters.find(row=>row.game==='terry'&&row.contextId===1),enemy=encounter.enemies[0];
  const target=ref.species.find(row=>row.speciesId===enemy.speciesId);
  assert.equal(enemy.index,0);
  assert.equal(enemy.speciesId,11);
  assert.deepEqual(model.physicalEnvelope([100,100],model.wildStatRange(enemy.stats.defense,'defense')),[45,53]);
  assert.deepEqual(model.skillOutcome(skill(1),{target}).range,[12,15]);
  assert.equal(ref.skills.length,36);
  assert.equal(ref.species.length,325);
  assert.equal(ref.encounters.length,283);
  for(const row of ref.encounters) {
    assert.ok(!(row.game==='terry'&&[122,123,124,125].includes(row.contextId)),'Unused gate is not a wild combat option');
    row.enemies.forEach((entry,index)=>{assert.equal(entry.index,index);assert.ok(ref.species.some(s=>s.speciesId===entry.speciesId));});
  }
});

test('unknown actions remain unsupported and invalid numbers cannot become damage guesses',()=>{
  assert.deepEqual(model.skillOutcome({skillId:22}),{kind:'unsupported'});
  assert.deepEqual(model.skillOutcome({skillId:999}),{kind:'unsupported'});
  for(const value of [null,undefined,false,'100',NaN,Infinity,-1,1000,1.5]) assert.throws(()=>model.physicalRange(value,10),RangeError);
  assert.throws(()=>model.physicalEnvelope([20,10],[0,10]),RangeError);
  assert.throws(()=>model.wildStatRange(10,'unknown'),RangeError);
  assert.throws(()=>model.skillOutcome(skill(1),{target:subject(),wildTarget:'false'}),TypeError);
  assert.throws(()=>model.skillOutcome(skill(1),{target:subject(),resistanceCode:4}),RangeError);
  assert.throws(()=>model.skillOutcome(skill(1),{target:subject(),wildTarget:false,resistanceCode:8}),RangeError);
  assert.throws(()=>model.skillOutcome(skill(1),{}),RangeError);
  assert.throws(()=>model.skillOutcome({...skill(1),resistanceChannelId:28},{target:subject()}),RangeError);
  assert.throws(()=>model.skillOutcome({...skill(1),scale:'unknown'},{target:subject()}),RangeError);
  assert.throws(()=>model.skillOutcome(skill(72),{target:subject(),level:0}),RangeError);
  assert.throws(()=>model.skillOutcome(skill(103),{target:subject()}),RangeError,'Gigaslash requires its user family');
});
