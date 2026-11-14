'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const {loadScripts} = require('../helpers/load-scripts');
const {DQMOffspringResistances:model} = loadScripts([path.join(__dirname,'../../js/offspring-resistances.js')]);

const parent = changes => ({
  sourceStatus:'save',speciesIndex:1,level:10,plus:0,
  baseStats:{hp:20,mp:10},resistances:Array(27).fill(7),...changes,
});
const reference = {species:[
  {speciesId:1,familyId:0,savedResistances:Array(27).fill(3)},
  {speciesId:2,familyId:1,savedResistances:Array.from({length:27},(_,i)=>i%8)},
]};
const predict = (a,b) => model.predict(a,b,2,reference);

test('hatchling stats come from base stats and one shared modifier, with exact or partial inputs', () => {
  const save = {
    naturalSkills:{terry:[[],[1,2,3],[4,5,6]],dqm2:[[],[2,3,4],[10,11,12]]},
    hatch:{speciesRanks:[0,5,4], personalityMatches:[[2],[]], baseSkillIds:Array.from({length:170},(_,id)=>id)},
  };
  const baseStats = {hp:60,mp:0,attack:83,defense:126,agility:888,intelligence:999};
  const a = parent({baseStats,campaign:'terry',personalityId:1,wildness:25,knownSkills:[7,8,9,10,11]});
  const b = {...a,personalityId:2,knownSkills:[12,13,14,15,16]};
  const stats = (first, second) => model.predict(first,second,2,reference,save).stats;
  // 16 distinct candidates, compatibility, summed rank 10, summed wildness 50.
  const best = stats(a,b);
  assert.equal(best.minPercent,120);
  assert.equal(best.maxPercent,120);
  assert.deepEqual(Object.values(best.values).map(pair=>pair[0]),[36,1,49,76,533,599]);
  assert.equal(stats(b,a).minPercent,115); // The personality lookup is ordered.
  assert.equal(stats(a,{...b,wildness:24}).minPercent,115);
  assert.equal(stats(a,{...b,speciesIndex:2}).minPercent,115);
  save.hatch.baseSkillIds[16] = 7; // Two learned upgrades with the same base count only once.
  assert.equal(stats(a,b).minPercent,115);
  const partial = stats({...a,personalityId:null,wildness:null},b);
  assert.deepEqual(Array.from(partial.values.hp),[32,35]);
  assert.deepEqual(Array.from(partial.values.mp),[1,1]);
  assert.equal(stats({...a,baseStats:{...baseStats,defense:null}},b).values.defense,null);
  assert.ok(model.predict({...a,resistances:null},b,2,reference,save).stats);
  assert.equal(model.predict({...a,sourceStatus:'manual'},b,2,reference,save).stats,undefined);
});

test('the forecast uses the resulting child +, child base, channel coefficients and inherited grade cap', () => {
  const first = parent(), mate = parent();
  assert.equal(predict(first,mate).plus,2);
  const highMp = parent({baseStats:{hp:20,mp:40}});
  assert.equal(predict(first,highMp).plus,3);
  // The native test compares the truncated starting stats: both here round to 10.
  assert.equal(predict(first,parent({baseStats:{hp:20,mp:31}})).plus,2);
  const high = parent({plus:99,level:99});
  const result = predict(high,high);
  assert.equal(result.plus,99);
  assert.deepEqual(Array.from(result.grades.slice(0,8),r=>r.grade),[6,6,6,6,6,6,6,7]);
  assert.equal(predict(first,mate).grades[0].grade,2);
  assert.equal(predict(first,mate).grades[7].grade,7);
});

test('missing individual data cannot silently become species resistance or an invented +', () => {
  for (const a of [parent({sourceStatus:'changed'}),parent({sourceStatus:'manual'}),
    parent({resistances:null}),parent({resistances:Array(27)}),parent({speciesIndex:999})]) {
    assert.ok(predict(a,parent()).reason);
  }
  assert.ok(predict(parent({level:9}),parent()).reason);
  const missing = parent({baseStats:{hp:null,mp:99}});
  assert.ok(predict(missing,parent()).reason);
  // A gap in HP/MP cannot affect an already capped +.
  assert.equal(predict(missing,parent({plus:99})).plus,99);
});
