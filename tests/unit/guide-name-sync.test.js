'use strict';

const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {buildGuideNames} = require('../../scripts/guide-names');
const {apply} = require('../../js/current-names');

function fixture() {
  const revision = 'a'.repeat(40);
  const rows = [];
  const system = 'text/system.json', dialogue = 'dialogue/main/0000_1999.json';
  function source(catalog, table, id, title, labels=[], indices=[]) {
    const edition = {english:title+'<END>', english_short:title.slice(0,7)+'<END>'};
    rows.push({catalog,table,id,current:title,labels,indices,source_revision:revision,
      raw:{id,japanese:'テスト<END>',translations:{current:edition,gameboy:{english:'Classic '+title+'<END>'}}}});
  }
  source(system,'items','herb','Healing Herb',['Items'],[362]);
  source('menus/general.json','menu_text.json','m_exe_08b68c','One ally: 30-40 HP restored.',['Menus']);
  rows.at(-1).raw.translations.current={english_lines:['One ally:', '30-40 HP restored.']};
  source(system,'system','sleep','Slumber',['Skills and spells'],[474]);
  source('menus/general.json','menu_text.json','m_exe_123456','Drifts into sleep.',['Menus']);
  rows.at(-1).raw.translations.current={english_lines:['Puts one','enemy to sleep.']};
  source(dialogue,'dialogue','village','Reed Village',['Location names']);
  source('text/location_titles.json','location_titles','village','Reed Vlg',['Location names']);
  source(dialogue,'dialogue','npc','Mira: Welcome, traveler.');
  source(dialogue,'dialogue','name','You found the Crystal Bell!');
  const item={id:'item-1',kind:'item',title:'Medicinal Herb',source_ids:['herb','m_exe_08b68c'],summary:'Heals an ally.',
    details:['Take Medicinal Herbs.','Terry shops sell it for 25 G. Willow Village.'],prices:[{game:'dqm1',buy:25,gold_pass:22,locations:['Willow Village']}]};
  const field={provenance:{},entries:[item],skill_requirements:{1:{level:2}}};
  const world={provenance:{},entries:[
    {id:'chapter',kind:'story',title:'A bell for Willow Village',source_ids:['npc'],region:'Willow Village',
      summary:'Find Mia, bring the Sky Bell and pack Medicinal Herbs.',details:['Mia uses Sleep.'],places:['Willow Village']},
    {id:'camp',kind:'story',title:'Sleep before departure',summary:'Sleep here.',source_ids:[],details:[]},
    {id:'npc',kind:'npc',title:'Mia',summary:'Meet Mia.',source_ids:['npc'],details:[]}
  ]};
  const atlas={maps:[{id:'map-1-2',title:'Willow Village',titleRow:'dialogue:village',exits:[{to:'map-3-4'}]}]};
  const skillBindings=[{id:1,spelling:'Sleep',source_id:'sleep',description_source_id:'m_exe_123456',
    affected_entries:['chapter']}];
  const terms=[
    {spelling:'Mia',aliases:['Miya'],source_id:'npc',catalog:dialogue,extract:'speaker',speaker_line:0,affected_entries:['npc','chapter']},
    {spelling:'Sky Bell',source_id:'name',catalog:dialogue,extract:'phrase',prefix:'You found the ',suffix:'!',affected_entries:['chapter']},
    {spelling:'Willow Village',source_id:'village',catalog:dialogue,extract:'full',affected_entries:['chapter']}
  ];
  return {comparison:{rows},revision,field,world,atlas,skillBindings,worldBindings:{terms},species:[],originalSpecies:[]};
}

test('a current patch rename propagates to stable cards, search aliases, reviewed prose, and shop locations', () => {
  const f=fixture();
  const result=buildGuideNames(f);
  const skill={id:1,system_entry_id:'sleep',name:'Slumber'};
  const reference={guide_names:result,metadata:{source_url:'https://github.com/dqm-psx/translations',public_revision:f.revision},
    species:[{skills:{terry:[skill]}}]};
  apply(reference,f.field,f.world,f.atlas);
  const item=f.field.entries[0], chapter=f.world.entries[0];
  assert.equal(item.id,'item-1');
  assert.equal(item.title,'Healing Herb');
  assert.equal(item.menuDescription,'One ally: 30-40 HP restored.');
  assert.ok(item.aliases.includes('Medicinal Herb'));
  assert.equal(item.names.editions.gameboy.full,'Classic Healing Herb');
  assert.equal(item.names.japanese,'テスト');
  assert.equal(item.details[0],'Take Healing Herbs.');
  assert.deepEqual(item.prices,[{game:'dqm1',buy:25,gold_pass:22,locations:['Reed Village']}]);
  assert.match(item.details[1],/Reed Village\.$/);
  assert.equal(chapter.summary,'Find Mira, bring the Crystal Bell and pack Healing Herbs.');
  assert.equal(chapter.details[0],'Mira uses Slumber.');
  assert.equal(f.world.entries[1].summary,'Sleep here.');
  assert.equal(chapter.region,'Reed Village');
  assert.deepEqual(chapter.places,['Reed Village']);
  assert.ok(f.world.entries[2].aliases.includes('Miya'));
  assert.equal(f.atlas.maps[0].title,'Reed Village');
  assert.ok(f.atlas.maps[0].aliases.includes('Willow Village'));
  assert.ok(f.atlas.maps[0].aliases.includes('Reed Vlg'));
  assert.deepEqual(f.atlas.maps[0].exits,[{to:'map-3-4'}]);
  assert.deepEqual(f.field.skill_requirements,{1:{level:2}});
  assert.equal(f.field.skill_names[1].minimum_level,2);
  assert.equal(f.field.skill_names[1].description,'Puts one enemy to sleep.');
  assert.equal(f.field.skill_names[1].description_source_id,'m_exe_123456');
  assert.ok(skill.aliases.includes('Sleep'));
});

test('wording refresh reaches rich article text and tables without changing section identities or sources',()=>{
  const f=fixture();
  f.world.entries[0].sections=[{id:'keep-this-id',title:'Mia and Sky Bell',paragraphs:['Mia uses Sleep.'],bullets:['Bring Medicinal Herb.'],
    table:{caption:'Sky Bell',columns:['Mia','Item'],rows:[['Sleep','Sky Bell']]},links:['npc'],sources:[{label:'Original evidence',url:'https://example.com/Mia'}]}];
  const section=buildGuideNames(f).entries.chapter.sections[0];
  assert.equal(section.id,'keep-this-id');
  assert.equal(section.title,'Mira and Crystal Bell');
  assert.deepEqual(section.paragraphs,['Mira uses Slumber.']);
  assert.deepEqual(section.bullets,['Bring Healing Herb.']);
  assert.deepEqual(section.table,{caption:'Crystal Bell',columns:['Mira','Item'],rows:[['Slumber','Crystal Bell']]});
  assert.deepEqual(section.links,['npc']);
  assert.equal(section.sources[0].url,'https://example.com/Mia');
});

test('rich skill references refresh without rewriting Defense stats or historical handheld names', () => {
  const f = fixture();
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../../data/field-guide.js'),'utf8'), context);
  const ids = ['field-restored-content','field-damage-and-resistance'];
  const articles = JSON.parse(JSON.stringify(context.FIELD_GUIDE.entries.filter(row => ids.includes(row.id))));
  articles.find(row => row.id === ids[0]).sections.find(section => section.id === 'learning-changes')
    .bullets[1] += ' Its Defense stat is a separate value.';
  f.field.entries.push(...articles);
  const relevantSkills = [1,4,7,15,22,23,24,40,42,64,72,73,74,102,103,104,105,130,133,134,135,136];
  const authoredBindings = JSON.parse(fs.readFileSync(path.join(__dirname,'../../scripts/skill-name-bindings.json'),'utf8'));
  f.skillBindings = authoredBindings.filter(row => relevantSkills.includes(row.id));
  for (const binding of f.skillBindings) {
    f.field.skill_requirements[binding.id] = {level:2};
    const title = binding.id === 40 ? 'Ward Break' : 'Current ' + binding.spelling;
    f.comparison.rows.push({catalog:'text/system.json',table:'system',id:binding.source_id,
      current:title,labels:['Skills and spells'],indices:[473+binding.id],source_revision:f.revision,
      raw:{id:binding.source_id,japanese:'テスト<END>',translations:{current:{english:title+'<END>'}}}});
    f.comparison.rows.push({catalog:'menus/general.json',table:'menu_text.json',id:binding.description_source_id,
      current:'Description.',labels:['Menus'],source_revision:f.revision,
      raw:{id:binding.description_source_id,japanese:'テスト<END>',translations:{current:{english_lines:['Description.']}}}});
  }
  const before = structuredClone(articles);
  const result = buildGuideNames(f);
  apply({guide_names:result,species:[]},f.field,f.world,f.atlas);
  const comparison = articles.find(row => row.id === ids[0]);
  const learning = comparison.sections.find(section => section.id === 'learning-changes');
  const previousLearning = before[0].sections.find(section => section.id === 'learning-changes');
  assert.deepEqual(learning.table.rows.map(cells => cells[0]),
    ['Current Blaze','Current Firebal','Current Bang','Current Heal','Current Healmore','Current Healall']);
  assert.deepEqual(learning.table.rows.map(cells => cells.slice(1)), previousLearning.table.rows.map(cells => cells.slice(1)));
  assert.equal(learning.bullets[0], previousLearning.bullets[0], 'Historical TatsuCall chain keeps the printed GBC labels');
  assert.match(learning.bullets[1], /Current Summon Deago requires Current Summon Tattsu, Ward Break and Current Focus Spirit/);
  assert.match(learning.bullets[1], /Its Defense stat is a separate value/);
  assert.match(learning.bullets[2], /Current Summon Samshin.*Current Speedup.*Current Charge Power.*Current Summon Bazoo.*Current Thordain.*Current Wave of Darkness/);
  assert.match(learning.bullets[3], /Current Summon Tattsu/);
  assert.doesNotMatch(JSON.stringify(learning), /Current Current/);
  const foreign = comparison.sections.find(section => section.id === 'foreign-master-differences');
  const strength=foreign.table.rows.find(row=>row[0]==='Terry: opponent strength')[2];
  assert.match(strength, /HP, MP, Attack and Defense/);
  assert.doesNotMatch(strength, /Ward Break/);

  const damage = articles.find(row => row.id === ids[1]);
  assert.equal(damage.title, 'Damage, Defense and resistance');
  assert.match(damage.summary, /Attack and Defense/);
  const normal = damage.sections.find(section => section.id === 'normal-attacks');
  assert.deepEqual(normal, before[1].sections.find(section => section.id === 'normal-attacks'));
  const ranges = damage.sections.find(section => section.id === 'spell-breath-ranges');
  assert.deepEqual(ranges.table.rows, [['Current Blaze','12–15','7–12'],['Current Fire Breath','14–22','10–16']]);
  assert.match(damage.sections.find(section => section.id === 'resistance').paragraphs[0], /your Current Blaze.*enemy’s Current Blaze/);
  const family = damage.sections.find(section => section.id === 'level-and-family');
  assert.equal(family.rows[0][0], 'Current Wind Sickle, Current Vacuum Wave and Current Lightning');
  assert.equal(family.rows[1][0], 'Current Grand Cross');
  assert.match(family.rows[1][1], /monster’s Current Grand Cross/);
  assert.equal(family.rows[2][0], 'Current Gigaslash');
  for (const [index, article] of articles.entries()) {
    assert.deepEqual(article.sections.map(section => [section.id,section.links,section.sources]),
      before[index].sections.map(section => [section.id,section.links,section.sources]));
  }
});

test('missing, stale, duplicated or ambiguous source data cannot replace the released wording', () => {
  const edits=[
    f=>{ f.comparison.rows=f.comparison.rows.filter(r=>r.id!=='herb'); },
    f=>{ f.comparison.rows[0].indices=[363]; },
    f=>{ f.comparison.rows[0].source_revision='b'.repeat(40); },
    f=>{ f.comparison.rows.push(f.comparison.rows[0]); },
    f=>{ f.comparison.rows[0].raw.translations.current.english='<script>Home'; },
    f=>{ f.comparison.rows.find(r=>r.id==='m_exe_123456').raw.translations.current.english_lines=['', ' ']; },
    f=>{ f.comparison.rows.find(r=>r.id==='m_exe_123456').table='wrong-table.json'; },
    f=>{ f.comparison.rows.find(r=>r.id==='npc').current='Narration without an identified speaker.'; },
    f=>{ f.comparison.rows.find(r=>r.id==='name').current='You found the Bell!\nYou found the Orb!'; },
    f=>{ f.atlas.maps[0].titleRow='dialogue:unrelated'; }
  ];
  for (const edit of edits) {
    const f=fixture(); edit(f);
    assert.throws(()=>buildGuideNames(f),/Guide name sync/);
    assert.equal(f.field.entries[0].title,'Medicinal Herb');
  }
});

test('the verified home title follows static-pool translations without accepting arbitrary static text as a map', () => {
  const f=fixture();
  const row={catalog:'text/static_pools.json',table:'static_extra_pools.json',id:'e0affe4_0000',
    source_revision:f.revision,current:'Our Room',labels:['Fixed text pools'],
    raw:{id:'e0affe4_0000',japanese:'じぶんのへや<END>',translations:{current:{english:'Our Room<END>'}}}};
  f.comparison.rows.push(row);
  const home={id:'map-103-0',title:'Your Room',titleRow:'static_extra_pools.json:e0affe4_0000',exits:[]};
  f.atlas.maps.push(home);
  const names=buildGuideNames(f);
  assert.equal(names.maps[home.id].title,'Our Room');
  apply({guide_names:names,species:[]},f.field,f.world,f.atlas);
  assert.equal(home.title,'Our Room');
  assert.equal(home.id,'map-103-0');
  assert.deepEqual(home.exits,[]);
  home.id='map-104-0';
  assert.throws(()=>buildGuideNames(f),/Guide name sync/);
});

test('a gate rename keeps old and edition names searchable and preserves its portal and final-map relationships', () => {
  const f=fixture(), id='location-townsperson-s-gate', sourceId='e169f';
  f.comparison.rows.push({catalog:'text/system.json',table:'system',id:sourceId,source_revision:f.revision,
    labels:['Gate names'],raw:{id:sourceId,japanese:'まちびとのとびら<END>',translations:{
      current:{english:'Gate of Awaiting<END>',english_short:'Awaiting<END>'},
      gameboy:{english:'Villager Gate<END>'},delocalized:{english:'Awaiting Gate<END>'},
      vibecoded:{english:"Townsperson's Gate<END>"}
    }}});
  f.world.entries.push({id,kind:'location',game:'dqm1',title:"Townsperson's Gate",source_ids:[sourceId],
    summary:"Reach Townsperson’s Gate.",details:[],places:["Townsperson's Gate"]});
  f.world.entries[0].details.push("Visit Townsperson’s Gate after the arena.");
  const mapBefore=structuredClone(f.atlas.maps[0]);
  apply({guide_names:buildGuideNames(f),species:[]},f.field,f.world,f.atlas);
  const gate=f.world.entries.find(row=>row.id===id);
  assert.equal(gate.title,'Gate of Awaiting');
  assert.equal(gate.summary,'Reach Gate of Awaiting.');
  assert.equal(f.world.entries[0].details.at(-1),'Visit Gate of Awaiting after the arena.');
  assert.deepEqual(gate.places,['Gate of Awaiting']);
  for (const alias of ["Townsperson's Gate",'Gate of Awaiting','Awaiting','Villager Gate','Awaiting Gate','まちびとのとびら']) {
    assert.ok(gate.aliases.includes(alias),alias);
  }
  const context=vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../../js/place-context.js'),'utf8'),context);
  const places=context.DQMPlaceContext.create({entries:f.world.entries,maps:[...f.atlas.maps,
    {id:'map-72-0',placeId:'map-72-0',title:'Swamp Cave'}],
    entrances:{entries:{[id]:[{map:mapBefore.id,x:.2,y:.6}]}},
    generation:{entries:{[id]:{finalMaps:['map-72-0']}}}});
  assert.equal(places.entrancesForMap(mapBefore.id)[0].location.title,'Gate of Awaiting');
  assert.equal(places.locationForMap('map-72-0').id,id);
  assert.deepEqual(Array.from(places.mapsForLocation(id),map=>map.id),[mapBefore.id,'map-72-0']);
  assert.deepEqual(f.atlas.maps[0].exits,mapBefore.exits);
});

test('generated side-gate articles retain encounter aliases after a wording refresh', () => {
  const context=vm.createContext({});
  const root=path.join(__dirname,'../..');
  for (const file of ['data/handbook-reference.js','data/world-guide.js','data/field-routes.js']) {
    vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),context);
  }
  for (const monster of context.GUIDE_REFERENCE.species) {
    for (const area of monster.locations) {
      if (area.game==='terry' && area.context_id===10) {
        area.name='Reviewed Bazaar Gate';
        area.aliases=['Bazaar Gate','Classic Bazaar Gate'];
      }
    }
  }
  vm.runInContext(fs.readFileSync(path.join(root,'js/locations.js'),'utf8'),context);
  const gate=context.WORLD_GUIDE.entries.find(row=>row.id==='location-bazaar-gate');
  assert.equal(gate.title,'Reviewed Bazaar Gate');
  assert.deepEqual(Array.from(gate.aliases),['Bazaar Gate','Classic Bazaar Gate']);
  assert.deepEqual(Array.from(context.FIELD_ROUTES.routes[gate.id].encounters.terry),[10,11,12]);
  assert.ok(gate.related.includes('quest-fire-at-the-bazaar'));
});

test('default nicknames track creation records independently of speakers, species and saved names', () => {
  const f=fixture();
  const catalog='patches/boss_names.json', id='boss_72_0011.english', nickname=catalog+':'+id;
  const seed={catalog,table:catalog,id,source_revision:f.revision,labels:['Boss nicknames'],
    raw:{id,japanese:'ホイミン',translations:{current:'Hale',delocalized:'Heal'}}};
  f.comparison.rows.push(seed);
  f.worldBindings.nickname_articles={[nickname]:'npc'};
  Object.assign(f.worldBindings.terms[0],{nickname,paired_in:['chapter','npc']});
  const generate=()=>buildGuideNames(f);
  assert.equal(generate().entries.npc.title,'Mira / Hale');
  seed.raw.translations.current='Nova';
  const update=generate();
  assert.equal(update.entries.npc.title,'Mira / Nova');
  assert.match(update.entries.chapter.summary,/Find Mira \/ Nova,/);
  assert.ok(update.entries.npc.aliases.includes('Heal'));
  f.worldBindings.terms[0].extract='nickname';
  assert.equal(generate().entries.npc.title,'Nova');
  const ref={guide_names:update,species:[]};
  apply(ref,f.field,f.world,f.atlas);
  apply(ref,f.field,f.world,f.atlas);
  assert.deepEqual(f.world.entries[2].default_nicknames,[f.field.default_nicknames[0]]);
  f.comparison.rows.pop();
  assert.throws(generate,/missing nickname/);
});

function battleComboFixture() {
  const f = fixture(), root = path.join(__dirname,'../..');
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(path.join(root,'data/field-guide.js'),'utf8'),context);
  const article = JSON.parse(JSON.stringify(context.FIELD_GUIDE.entries.find(row => row.id === 'field-battle-combos')));
  const comparison = JSON.parse(JSON.stringify(context.FIELD_GUIDE.entries.find(row => row.id === 'field-restored-content')));
  f.field.entries.push(article,comparison);
  f.skillBindings = JSON.parse(fs.readFileSync(path.join(root,'scripts/skill-name-bindings.json'),'utf8'));
  f.comboBindings = JSON.parse(fs.readFileSync(path.join(root,'scripts/battle-combo-name-bindings.json'),'utf8'));
  const renamedSkills = {15:'Thunderstorm',40:'Ward Break',106:'Sky Leap'};
  const renamedCombos = {208:'Thunder Chorus',215:'Twin Assault',217:'Great Magic',220:'Demon King Form'};
  function system(id,sourceId,title) {
    f.comparison.rows.push({catalog:'text/system.json',table:'system',id:sourceId,
      current:title,labels:['Skills and spells'],indices:[473+id],source_revision:f.revision,
      raw:{id:sourceId,japanese:'テスト<END>',translations:{current:{english:title+'<END>'}}}});
  }
  for (const bind of f.skillBindings) {
    f.field.skill_requirements[bind.id] = {level:2};
    system(bind.id,bind.source_id,renamedSkills[bind.id] || bind.spelling);
    f.comparison.rows.push({catalog:'menus/general.json',table:'menu_text.json',id:bind.description_source_id,
      current:'Description.',labels:['Menus'],source_revision:f.revision,
      raw:{id:bind.description_source_id,japanese:'テスト<END>',translations:{current:{english_lines:['Description.']}}}});
  }
  for (const bind of f.comboBindings) system(bind.id,bind.source_id,renamedCombos[bind.id] || bind.spelling);
  return {f,article,comparison};
}

test('battle combo renames update recipes and PSX prose without becoming learnable skills or changing stats and GBC evidence',()=>{
  const {f,article,comparison} = battleComboFixture();
  const priorRecipes = structuredClone(article.sections.find(section => section.id === 'combo-recipes').table.rows);
  const priorComparison = structuredClone(comparison.sections.find(section => section.id === 'battle-combo-changes'));
  const priorSourceIds = structuredClone(article.source_ids);
  const generated = buildGuideNames(f);
  assert.equal(Object.keys(generated.skills).length,169);
  assert.equal(generated.coverage.skills,169);
  assert.equal(generated.skills[208],undefined);
  assert.equal(generated.battle_combos.length,20);
  assert.deepEqual(generated.battle_combos[0],{id:208,title:'Thunder Chorus',source_id:'e1109',skills:[15,15]});
  assert.deepEqual(generated.battle_combos[7],{id:215,title:'Twin Assault',source_id:'e1137',skills:[106,145]});
  const requirements = structuredClone(f.field.skill_requirements);
  apply({guide_names:generated,species:[]},f.field,f.world,f.atlas);
  assert.deepEqual(f.field.skill_requirements,requirements);
  const recipes = article.sections.find(section => section.id === 'combo-recipes').table.rows;
  assert.deepEqual(recipes[0],['Thunder Chorus','Thunderstorm + Thunderstorm',priorRecipes[0][2]]);
  assert.equal(recipes[7][0],'Twin Assault');
  assert.equal(recipes[7][1],'Sky Leap + Geyser');
  assert.match(recipes[7][2],/Sky Leap user’s Attack.*target’s Defense/);
  assert.doesNotMatch(recipes[7][2],/Ward Break/);
  assert.equal(recipes[12][0],'Demon King Form');
  assert.equal(recipes[12][2],priorRecipes[12][2], 'Transformation stats are not the Defense skill');
  assert.equal(recipes[13][2],priorRecipes[13][2], 'Buffed Defense remains a stat');
  assert.equal(recipes[18][2],priorRecipes[18][2], 'Ordinary defense wording is unchanged');
  const introduction = article.sections.find(section => section.id === 'using-combos').paragraphs[0];
  assert.match(introduction,/For Thunder Chorus, both monsters choose Thunderstorm/);
  const compare = comparison.sections.find(section => section.id === 'battle-combo-changes');
  assert.equal(compare.table.rows[1][0],'Great Magic damage');
  assert.deepEqual(compare.table.rows.map(cells=>cells[1]),priorComparison.table.rows.map(cells=>cells[1]));
  assert.deepEqual(article.source_ids,priorSourceIds);
});

test('battle combo sync rejects changed identities, incomplete recipes and unreviewed component labels',()=>{
  const edits = [
    ({f})=>{ f.comboBindings.pop(); },
    ({f})=>{ f.comboBindings[0].id=207; },
    ({f})=>{ f.comboBindings[0].skills=[15,208]; },
    ({f})=>{ f.comparison.rows.find(row=>row.id==='e1109').indices=[680]; },
    ({article})=>{ article.sections.find(section=>section.id==='combo-recipes').table.rows.pop(); },
    ({article})=>{ article.sections.find(section=>section.id==='combo-recipes').table.rows[0][0]='Wrong combo'; },
    ({article})=>{ article.sections.find(section=>section.id==='combo-recipes').table.rows[0][1]='Bolt + Bolt'; },
  ];
  for (const edit of edits) {
    const state = battleComboFixture();
    edit(state);
    assert.throws(()=>buildGuideNames(state.f),/Guide name sync/);
  }
});
