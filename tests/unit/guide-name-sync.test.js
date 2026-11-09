'use strict';

const {test} = require('node:test');
const assert = require('node:assert/strict');
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
  source(system,'system','sleep','Slumber',['Skills and spells'],[474]);
  source('menus/general.json','menu_text.json','m_exe_123456','Drifts into sleep.',['Menus']);
  rows.at(-1).raw.translations.current={english_lines:['Puts one','enemy to sleep.']};
  source(dialogue,'dialogue','village','Reed Village',['Location names']);
  source('text/location_titles.json','location_titles','village','Reed Vlg',['Location names']);
  source(dialogue,'dialogue','npc','Mira: Welcome, traveler.');
  source(dialogue,'dialogue','name','You found the Crystal Bell!');
  const item={id:'item-1',kind:'item',title:'Medicinal Herb',source_ids:['herb'],summary:'Heals an ally.',
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
