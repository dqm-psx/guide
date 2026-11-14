const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {loadScripts}=require('../helpers/load-scripts');
const {planningBlock,candidateBlock}=require('../helpers/psx-save');
const {read}=require('../../js/save-import');
const {adapt,resolve}=require('../../js/owned-monsters');
const data=loadScripts(['data/breeding-data.js','data/save-reference.js'].map(file=>path.join(__dirname,'../..',file)));
function fixture(){const save=read(planningBlock(2),data.DATA.species,data.SAVE_REFERENCE).saves[0];return {id:'team1',game:'dqm2',campaign:save.campaignKey,entries:save.entries.map((entry,i)=>({...entry,id:'m'+i,favorite:false}))};}

test('both tools receive independent copies from a stable team/monster identity',()=>{
  const team=fixture(),before=JSON.stringify(team),document={teams:[team]};
  const learning=resolve(document,'team1','m0'),combat=resolve(document,'team1','m0');
  assert.equal(learning.campaign,'tara');assert.equal(learning.baseStats.attack,180);assert.equal(combat.battleStats.attack,230);
  learning.baseStats.attack=999;learning.knownSkills.push(169);combat.resistances[0]=7;
  assert.equal(JSON.stringify(team),before);assert.equal(resolve(document,'missing','m0'),null);assert.equal(resolve(document,'team1','deleted'),null);
  assert.equal(resolve(document,'team1','m2').location,'hibernation');
});
test('changed species, plus or level invalidates the entire saved calculator context',()=>{
  const team=fixture(),entry=team.entries[0];
  for(const change of [{speciesIndex:11},{plus:13},{level:31}]){
    const result=adapt({...entry,...change},team);
    assert.equal(result.sourceStatus,'changed');assert.equal(result.baseStats.attack,null);assert.equal(result.levelCap,null);assert.equal(result.resistances,null);assert.equal(result.knownSkills,null);
  }
  const moved=adapt({...team.entries[2],location:'party'},team);assert.equal(moved.location,'party');
});
test('unknown and tampered optional metadata stays unknown; DQM2 is not assumed to mean Cobi',()=>{
  const manual=adapt({speciesIndex:11,plus:0,location:'party',id:'m'},{id:'t',game:'dqm2'});
  assert.equal(manual.campaign,null);assert.equal(manual.level,null);assert.equal(manual.knownSkills,null);
  const team=fixture(),entry=team.entries[0];
  entry.saveDetails.baseStats.attack='999';entry.saveDetails.resistances[4]=8;entry.saveDetails.knownSkills=[4,4];entry.saveDetails.inheritedSkills=[170];entry.saveDetails.levelCap=20;
  const result=adapt(entry,team);
  assert.equal(result.baseStats.attack,null);assert.equal(result.resistances,null);assert.equal(result.knownSkills,null);assert.equal(result.inheritedSkills,null);assert.equal(result.levelCap,null);
});

test('guide backup export/import preserves the verified snapshot and optional campaign',()=>{
  const env=loadScripts(['data/breeding-data.js','js/planner-core.js','js/app-state.js'].map(file=>path.join(__dirname,'../..',file)));
  const app=env.DQMAppState.create(env.DATA,env.DQMPlannerCore),original=app.defaultState();
  const team={...fixture(),name:'Synthetic team',targets:[],activeTargetId:null};
  const state=app.insertTeam(original,team),restored=app.parseDocument(app.toJSON(state));
  const output=resolve(restored,'team1','m0');
  assert.deepEqual(output,adapt(team.entries[0],team));
});

test('a restored current candidate pool does not resurrect removed or upgraded natural slots',()=>{
  const reference=loadScripts([path.join(__dirname,'../../data/skill-learning-reference.js')]).SKILL_LEARNING_REFERENCE;
  const model=require('../../js/skill-learning').create(reference);
  for(const delta of [4,1]){
    const entry=read(candidateBlock(delta),data.DATA.species,data.SAVE_REFERENCE).saves[0].entries[0];
    const monster=adapt(entry,{id:'t',game:'dqm2'});
    assert.deepEqual(monster.inheritedSkills,delta===4?[]:[65]);assert.deepEqual(monster.knownSkills,[]);
    const options={speciesIndex:monster.speciesIndex,campaign:monster.campaign,level:monster.level,stats:monster.baseStats,knownSkills:monster.knownSkills,candidateSkills:monster.inheritedSkills};
    for(const skillId of [64,113,149])assert.equal(model.check({...options,skillId}).status,'missing-route');
    if(delta===1)assert.equal(model.check({...options,skillId:65}).status,'ready');
    const {candidateSkills,...manual}=options;
    assert.equal(model.check({...manual,skillId:64}).status,'ready','manual plans retain original species natural routes');
  }
});
