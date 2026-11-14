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
