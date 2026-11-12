const test=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {loadScripts}=require('../helpers/load-scripts');
const root=path.join(__dirname,'../..');
const {SKILL_LEARNING_REFERENCE:reference,DATA}=loadScripts([
  path.join(root,'data/skill-learning-reference.js'),path.join(root,'data/breeding-data.js')]);
const model=require('../../js/skill-learning').create(reference);
const stats=Object.fromEntries(reference.statKeys.map(key=>[key,999]));
const base={speciesIndex:11,campaign:'terry',level:99,stats,atLevelCap:false};

test('natural Slime growth counts newly reached levels and leaves unknown starting stats unknown',()=>{
  const result=model.project({speciesIndex:11,level:1,targetLevel:10,stats:{hp:10,mp:990}});
  assert.deepEqual(result.gains,{hp:72,mp:17,attack:37,defense:37,agility:17,intelligence:36});
  assert.equal(result.projectedStats.hp,82);
  assert.equal(result.projectedStats.mp,999);
  assert.equal(result.projectedStats.attack,null);
  assert.equal(result.experience,521);
  const none=model.project({speciesIndex:11,level:10,targetLevel:10,stats:{hp:82}});
  assert.equal(none.experience,0);
  assert.equal(none.gains.hp,0);
});

test('Balzack uses distinct native breeding and ordinary recruitment limits',()=>{
  const options={speciesIndex:235,level:1,targetLevel:50,stats:{}};
  const recruited=model.project(options);
  assert.deepEqual(recruited.cap,{min:48,max:52,source:'ordinary-recruit',status:'uncertain'});
  const bred=model.project({...options,origin:'bred',plus:0});
  assert.deepEqual(bred.cap,{min:45,max:45,source:'bred',status:'above'});
  assert.equal(model.project({...options,origin:'bred',plus:2}).cap.max,51);
  assert.equal(model.project({...options,level:60,targetLevel:60}).cap.min,60);
  assert.throws(()=>model.project({...options,origin:'bred',level:50}),RangeError);
  assert.equal(model.project({...options,origin:'bred',level:50,levelCap:60}).cap.max,60);
});

test('each native direct-skill minimum is sufficient and every positive requirement matters',()=>{
  for(const skill of reference.skills){
    const values={...Object.fromEntries(reference.statKeys.map(key=>[key,0])),...skill.requirements};
    const level=values.level;delete values.level;
    const options={speciesIndex:11,skillId:skill.skillId,level,stats:values,inheritedSkills:[skill.skillId]};
    assert.equal(model.check(options).status,'ready');
    for(const [key,value] of Object.entries(skill.requirements)){
      if(key==='level'&&value===1)continue;
      const below=key==='level'?{...options,level:value-1}:{...options,stats:{...values,[key]:value-1}};
      assert.equal(model.check(below).learnableNow,false,`skill ${skill.skillId}, ${key}`);
    }
  }
});

test('access, numerical thresholds and training location are separate conditions',()=>{
  assert.equal(model.check({...base,skillId:1}).status,'missing-route');
  const natural={...base,skillId:4,level:3,stats:{mp:11,intelligence:23}};
  assert.equal(model.check(natural).status,'ready');
  assert.equal(model.check({...natural,stats:{mp:11}}).status,'unknown-stats');
  assert.equal(model.check({...natural,stats:{mp:10,intelligence:23}}).status,'requirements-short');
  assert.equal(model.check({...natural,location:'farm'}).status,'farm');
  assert.equal(model.check({...natural,location:'hibernation'}).status,'hibernation');
  assert.equal(model.check({...natural,atLevelCap:true}).status,'level-cap');
  assert.equal(model.check({...base,skillId:4}).status,'ready','reaching level99 can still have a learning check');
});

test('retained skills enable one upgrade step and upgrades do not need a ninth slot',()=>{
  assert.equal(model.check({...base,skillId:2,knownSkills:[1]}).status,'ready');
  assert.equal(model.check({...base,skillId:3,knownSkills:[1]}).status,'missing-route');
  assert.equal(model.check({...base,skillId:1,knownSkills:[3]}).supersededBy,3);
  const full=[1,21,32,33,34,35,36,37];
  assert.equal(model.check({...base,skillId:2,knownSkills:full}).replacementRequired,false);
  assert.equal(model.check({...base,skillId:4,knownSkills:full}).replacementRequired,true);
});

test('combination paths require exact retained skills after eligible upgrades',()=>{
  assert.equal(model.check({...base,skillId:32,knownSkills:[21,31]}).status,'ready');
  assert.equal(model.check({...base,skillId:32,knownSkills:[21]}).status,'missing-route');
  const upgraded=model.check({...base,skillId:80,knownSkills:[2,104]});
  assert.deepEqual(upgraded.automaticUpgrades,[{from:2,to:3}]);
  assert.equal(upgraded.status,'missing-route');
  assert.equal(model.check({...base,skillId:32,inheritedSkills:[32]}).status,'ready','an inherited direct route does not also require a recipe');
});

test('the native earlier-combination failure cannot be reported as a confirmed later offer',()=>{
  const options={speciesIndex:11,campaign:'terry',skillId:135,level:30,
    knownSkills:[42,104,133],stats:{hp:0,mp:130,attack:0,defense:0,agility:0,intelligence:150}};
  const affected=model.check(options);
  assert.equal(affected.status,'combination-order');
  assert.equal(affected.learnableNow,false);
  assert.ok(affected.warnings.length);
  assert.equal(model.check({...options,stats:{mp:130,intelligence:150}}).status,'unknown-stats');
  const fixed=model.check({...options,stats:{...options.stats,hp:72,attack:68,agility:82}});
  assert.equal(fixed.status,'ready');
  assert.equal(model.check({...options,inheritedSkills:[135]}).status,'ready');
});

test('inheritance preserves 25 native slots and reduces retained advanced skills through the explicit base table',()=>{
  const result=model.inherit({offspringSpeciesIndex:11,campaign:'terry',parents:[
    {speciesIndex:0,knownSkills:[3,135]},{speciesIndex:11,knownSkills:[]} ]});
  assert.equal(result.candidateSlots.length,25);
  assert.deepEqual(result.candidateSlots.slice(0,9),[4,61,127,59,64,137,4,61,127]);
  assert.deepEqual(result.candidateSlots.slice(9,11),[1,133]);
  assert.equal(result.candidateSkills.includes(135),false);
  assert.equal(result.candidateSkills.includes(133),true);
  assert.equal(result.candidateSkills.length,new Set(result.candidateSkills).size);
  const terry=model.check({...base,speciesIndex:313,skillId:65});
  const cobi=model.check({...base,speciesIndex:313,campaign:'cobi',skillId:65});
  assert.equal(terry.routes.some(row=>row.kind==='natural'),true);
  assert.equal(cobi.routes.some(row=>row.kind==='natural'),false);
});

test('invalid or unsupported inputs cannot quietly become a training forecast',()=>{
  for(const index of [315,323,324,-1,'11'])assert.throws(()=>model.project({speciesIndex:index,level:1,targetLevel:10}),RangeError);
  assert.throws(()=>model.project({speciesIndex:11,level:10,targetLevel:1}),RangeError);
  assert.throws(()=>model.project({speciesIndex:11,level:1,targetLevel:10,stats:{hp:1000}}),RangeError);
  assert.throws(()=>model.check({...base,skillId:4,knownSkills:[1,1]}),RangeError);
  assert.throws(()=>model.check({...base,skillId:4,knownSkills:[1,2,3,4,5,6,7,8,9]}),RangeError);
  assert.throws(()=>model.check({...base,skillId:4,stats:{wisdom:100}}),RangeError);
  assert.equal(reference.species.length,315);
  assert.ok(reference.species.every(row=>DATA.species[row.speciesIndex].playable));
});
