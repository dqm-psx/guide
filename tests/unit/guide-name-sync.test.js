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
