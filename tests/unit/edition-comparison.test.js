'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const context=vm.createContext({});
for(const file of ['data/field-guide.js','js/mechanics-index.js']) {
  vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../..',file),'utf8'),context);
}
const guide=context.FIELD_GUIDE;
const comparison=guide.entries.find(row=>row.id==='field-restored-content');

test('public comparison describes released games and patch versions only',()=>{
  const patch=comparison.sections.find(section=>section.id==='english-settings-fixes');
  assert.doesNotMatch(JSON.stringify(comparison),/Delocalized|Game Boy translation edition|wording editions|Game Boy-named patch/i);
  assert.ok(patch.table.columns.includes('English patch v1.0.73'));
});

test('controls compare handheld and PSX behavior instead of PSX campaign cadence',()=>{
  const controls=comparison.sections.find(section=>section.id==='presentation-controls');
  assert.deepEqual(Array.from(controls.table.columns),['Part of play','Game Boy / Game Boy Color','Japanese PlayStation']);
  assert.ok(controls.table.rows.every(row=>row.length===3 && row.every(cell=>cell.trim())));
  assert.doesNotMatch(JSON.stringify(controls),/slower native movement|Movement feel|slower outdoor walking/);
  const traversal=controls.table.rows.find(row=>row[0].includes('traversal'));
  assert.match(traversal[1],/already grant.*A button/);
  assert.match(traversal[2],/Retains.*Triangle/);
  const battles=controls.table.rows.find(row=>row[0]==='Local battles');
  assert.match(battles[1],/two handheld systems.*Game Link Cable/);
  assert.match(battles[2],/one console.*one screen/);
});

test('travel, storage and breeding guidance belong to their mechanics topics',()=>{
  const index=context.DQMMechanicsIndex;
  const articles=guide.entries.filter(row=>row.kind==='mechanic');
  const render=topic=>index.handbook(articles,{
    escape:String,titleFor:row=>row.title,linkTo:id=>'<a href="#'+id+'">'+id+'</a>',
    activeTopic:topic,tools:false
  });
  assert.match(render('exploration'),/href="#field-movement-settings"/);
  assert.doesNotMatch(render('exploration'),/href="#field-triangle"/);
  assert.match(render('exploration'),/href="#field-storage"/);
  assert.doesNotMatch(render('exploration'),/href="#field-two-save-breeding"/);
  assert.match(render('raising'),/href="#field-two-save-breeding"/);
  assert.doesNotMatch(render('raising'),/href="#field-storage"/);
  assert.ok(!index.topics.some(topic=>topic.id==='saves'));
});
