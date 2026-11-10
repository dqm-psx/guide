'use strict';

const vm = require('node:vm');
const crypto = require('node:crypto');
const base = 'https://dqm-psx.github.io/guide/';
const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link = (path,label) => '<a href="'+escape(path)+'">'+escape(label)+'</a>';
const list = (title,items) => items.length ? '<section><h2>'+escape(title)+'</h2><ul>'+items.map(item=>'<li>'+item+'</li>').join('')+'</ul></section>' : '';
const paragraph = text => text ? '<p>'+escape(text)+'</p>' : '';

function addEntryPages(assets) {
  const db=vm.createContext({});
  for (const file of ['breeding-data','monster-reference','handbook-reference','world-guide','field-guide','player-atlas','field-routes','skill-descriptions','npc-sprites','character-dialogue','sprite-sheets']) {
    vm.runInContext(assets.get('data/'+file+'.js').toString(),db,{timeout:5000});
  }
  vm.runInContext(assets.get('js/current-names.js').toString(),db,{timeout:5000});
  vm.runInContext(assets.get('js/walkthrough.js').toString(),db,{timeout:5000});
  vm.runInContext(assets.get('js/locations.js').toString(),db,{timeout:5000});
  vm.runInContext(assets.get('js/mechanics-index.js').toString(),db,{timeout:5000});
  vm.runInContext(assets.get('js/character-dialogue.js').toString(),db,{timeout:5000});
  vm.runInContext(assets.get('js/monster-reference.js').toString(),db,{timeout:5000});
  const profiles = db.DQMMonsterCore.create(db.DATA,db.MONSTER_REFERENCE);
  const script='js/entry-page.js';
  const versioned = file => file+'?v='+crypto.createHash('sha256').update(assets.get(file)).digest('hex').slice(0,16);
  const pages=[];
  function add(kind,id,title,description,body,route,guarded=false) {
    if (!/^[\w-]+$/.test(String(id))) throw Error('Invalid reference identity');
    pages.push({kind,id,title,description,body,route,guarded,path:kind+'/'+id+'/'});
  }
  const articles = new Map([...db.WORLD_GUIDE.entries,...db.FIELD_GUIDE.entries].map(r=>[r.id,r]));
  const maps = new Map(db.PLAYER_ATLAS.maps.map(r=>[r.id,r]));
  const names = db.FIELD_GUIDE.skill_names;
  const species = db.MONSTER_REFERENCE.species;
  const bySpecies = new Map(species.map(m=>[m.index,m]));
  const skillLink = n=>link('skills/'+n.id+'/',n.title);
  const monsterLink = m=>link('monsters/'+m.index+'/',m.display_name);
  const mapLink = m=>link('places/'+(m.placeId || m.id)+'/',m.title);
  const campaigns = ['terry','cobi','tara'];
  const readable = Object.fromEntries(campaigns.map(key=>[key,articles.get('npc-'+key).title]));
  const portraits = db.SPRITE_SHEETS.portrait;
  const sheets = portraits.sheets.map(([url,width,height])=>[versioned(url),width,height]);
  function portrait(index) {
    const frame = portraits.frames[index];
    if (!frame) return '';
    const [sheet,x,y,width,height] = frame;
    const [url,sheetWidth,sheetHeight] = sheets[sheet];
    return '<svg class="entry-portrait" aria-hidden="true" focusable="false" viewBox="0 0 '+width+' '+height+'"><svg width="'+width+'" height="'+height+
      '" viewBox="'+[x,y,width,height].join(' ')+'" overflow="hidden"><image href="'+escape(url)+'" width="'+sheetWidth+'" height="'+sheetHeight+'"/></svg></svg>';
  }
  function illustratedMonster(index) {
    const monster = bySpecies.get(index);
    return '<a class="entry-monster-link" href="monsters/'+index+'/">'+portrait(index)+'<span>'+escape(monster.display_name)+'</span></a>';
  }
  function campaignLists(title,idsForCampaign,renderId,empty) {
    const groups = new Map();
    for (const campaign of campaigns) {
      const ids = idsForCampaign(campaign);
      const key = ids.join(',');
      if (!groups.has(key)) groups.set(key,{ids,labels:[]});
      groups.get(key).labels.push(readable[campaign]);
    }
    return '<section><h2>'+escape(title)+'</h2>'+Array.from(groups.values(),({ids,labels})=>{
      const heading = groups.size > 1 ? '<h3>'+escape(labels.join(' & '))+'</h3>' : '';
      return heading+(ids.length ? '<ul class="entry-links">'+ids.map(id=>'<li>'+renderId(id)+'</li>').join('')+'</ul>' : paragraph(empty));
    }).join('')+'</section>';
  }
  function facts(entries) {
    return '<dl class="entry-facts">'+entries.map(([label,markup])=>'<div><dt>'+escape(label)+'</dt><dd>'+markup+'</dd></div>').join('')+'</dl>';
  }
  function linkArticle(id,label) {
    const article = articles.get(id);
    if (!article) return '';
    const path = article.kind === 'story' ? db.DQMWalkthrough.paths[article.game]+'#'+id : 'articles/'+id+'/';
    return link(path,label || article.title);
  }
  const articleLink = id => linkArticle(id);
  const adventures = {dqm1:readable.terry, dqm2:readable.cobi+' & '+readable.tara};
  for (const [game,label] of Object.entries(adventures)) {
    const path = db.DQMWalkthrough.paths[game];
    const content = db.DQMWalkthrough.render(game,{
      byId:articles, routes:db.FIELD_ROUTES.routes, escape, hidden:()=>false, title:row=>row.title,
      entryLink:articleLink, prose:escape,
      sectionLink:(row,name)=>link(path+'#'+row.id,name),
      campaignLink:(key,current)=>'<a href="'+db.DQMWalkthrough.paths[key]+'"'+(current ? ' aria-current="page"' : '')+'>'+escape(adventures[key])+'</a>',
      questIndexLink:link('entries/#quests-'+game,label+' quests'),
      places:id=>link('articles/'+id+'/','Locations and encounters')
    });
    const slug = path.split('/')[1];
    add('walkthroughs',slug,label+' walkthrough','',content,'#field-guide?kind=story&game='+game,true);
  }
  const encounters = new Map();
  for (const monster of species) for (const loc of monster.locations || []) {
    if (loc.kind !== 'wild') continue;
    const key = loc.game+'/'+loc.context_id;
    if (!encounters.has(key)) encounters.set(key,{location:loc,monsters:[]});
    encounters.get(key).monsters.push(monsterLink(monster)+' (Lv. '+escape(loc.levels.join(', '))+')');
  }
  function encounterList(groups) {
    return Object.entries(groups || {}).flatMap(([game,ids]) => ids.map(id => {
      const entry = encounters.get(game+'/'+id);
      if (!entry) return '';
      const {location,monsters} = entry;
      return escape([readable[game], location.name, location.floors].filter(Boolean).join(' · '))+' — '+monsters.join(', ');
    })).filter(Boolean);
  }
  function battleList(groups) {
    const statLabels = ['HP','MP','Attack','Defense','Agility','Intelligence'];
    return Object.entries(groups || {}).flatMap(([game,party]) => party.map(enemy => {
      const moves = enemy.skills.map(skill => names[skill.id] ? skillLink(names[skill.id]) : escape(skill.label)).filter(Boolean);
      const stats = enemy.stats.map((value,i) => statLabels[i]+' '+value);
      return readable[game]+' · '+monsterLink(bySpecies.get(enemy.species))+' · Lv. '+escape(enemy.level)+
        paragraph(stats.join(' · '))+(moves.length ? '<p>'+moves.join(', ')+'</p>' : '');
    }));
  }
  for (const row of articles.values()) {
    const routeData = db.FIELD_ROUTES?.routes?.[row.id] || {};
    const npcart=db.NPC_SPRITES[row.id]?.image;
    const image = row.image || npcart;
    const art = /^data:image\/png;base64,[a-zA-Z0-9+/=]+$/.test(image || '') ? '<img class="entry-icon" src="'+image+'" alt="">' : '';
    const stock=(row.prices || []).map(p=>escape(p.locations.join(', ')+' · '+p.buy+' G (Gold Pass '+p.gold_pass+' G)'));
    const quests = row.kind === 'npc' ? [...articles.values()].filter(quest=>quest.kind==='quest' &&
      (quest.related?.includes(row.id) || row.related?.includes(quest.id))) : [];
    const questChapters=db.DQMWalkthrough.chaptersForQuest(row,articles);
    const related=(row.related || []).filter(id=>!quests.some(quest=>quest.id===id) && !questChapters.some(stage=>stage.id===id))
      .map(articleLink).filter(Boolean);
    const places=[...new Set([...(row.map_ids || []),...(routeData.maps || [])].map(id=>maps.get(id)).filter(Boolean).map(mapLink))];
    const steps=(routeData.stages || []).map(stage=>[stage.arena,...stage.gates].map(articleLink).filter(Boolean).join(' → '));
    const guideLinks=[routeData.gate,routeData.boss,routeData.arena,...(routeData.supplies || [])].filter(Boolean).map(articleLink)
      .concat((routeData.skills || []).map(id=>names[id]).filter(Boolean).map(skillLink));
    const details=(row.details || []).filter(line=>!stock.length || !/shops sell it for/i.test(line));
    const nicknameNote=db.DQMNicknameMarkup(row,escape,articleLink);
    const stepsMarkup = row.kind==='quest' && details.length ? '<ol>'+details.map(step=>'<li>'+escape(step)+'</li>').join('')+'</ol>' : details.map(paragraph).join('');
    const requests = row.requested_species?.length ? '<section><h2>Monsters in request order</h2><ol>'+
      row.requested_species.map(id=>'<li>'+monsterLink(bySpecies.get(id))+'</li>').join('')+'</ol></section>' : '';
    const dialogue = db.DQMCharacterDialogue.markup(row,escape,quests.map(quest=>articleLink(quest.id)),true);
    const fullWalk = row.kind==='story' ? '<p>'+link(db.DQMWalkthrough.paths[row.game]+'#'+row.id,adventures[row.game]+' walkthrough')+'</p>' : '';
    const walkChapters = questChapters.length ? '<nav class="quest-chapters" aria-label="Walkthrough chapters"><strong>'+
      escape(adventures[row.game])+' walkthrough</strong> · '+questChapters.map(stage=>articleLink(stage.id)).join(' · ')+'</nav>' : '';
    add('articles',row.id,row.title,row.summary,fullWalk+art+db.DQMArticleSections(row,escape,escape,2)+nicknameNote+stepsMarkup+walkChapters+requests+
      list('Arena classes',(row.arena_classes || []).map(articleLink))+dialogue+
      list('Walkthrough',steps)+list('Wild encounters',[...new Set(encounterList(routeData.encounters))])+
      list('Encounter base stats',battleList(routeData.fights))+list('In this guide',guideLinks)+list('Shops',stock)+list('Maps',places)+list('Monsters',(row.species_ids || []).map(id=>bySpecies.get(id)).filter(Boolean).map(monsterLink))+
      list('Related entries',related),'#field-guide?entry='+row.id,['story','ending'].includes(row.spoiler));
  }
  for (const [id,name] of Object.entries(names)) {
    const effect=db.SKILL_DESCRIPTIONS[id];
    const skillFacts = [];
    if (effect.mpCost != null) skillFacts.push(['MP cost',escape(effect.mpCost)]);
    if (effect.target) skillFacts.push(['Target',escape(effect.target)]);
    if (names[effect.upgradesFrom]) skillFacts.push(['Upgrades from',skillLink(names[effect.upgradesFrom])]);
    const prereqs=(effect.combination || []).map(k=>names[k]).filter(Boolean);
    if (prereqs.length) skillFacts.push(['Requires skills',prereqs.map(skillLink).join(' + ')]);
    const stats=db.FIELD_GUIDE.skill_requirements[id] || {};
    const labels={level:'Level',hp:'HP',mp:'MP',attack:'Attack',defense:'Defense',agility:'Agility',intelligence:'Intelligence'};
    const minimums=Object.entries(stats).filter(([,value])=>value>0).map(([key,value])=>[labels[key] || key,escape(value)]);
    const learners=campaignLists('Natural learners',campaign=>species.filter(m=>m.skills[campaign]?.some(s=>s.id===Number(id))).map(m=>m.index),
      illustratedMonster,'No natural learners recorded.');
    add('skills',name.id,name.title,name.description || effect.description,
      (skillFacts.length ? facts(skillFacts) : '')+
      (minimums.length ? '<section><h2>Minimum learning stats</h2>'+facts(minimums)+'</section>' : '')+
      learners,'#field-guide?kind=skill&entry=skill-'+name.id);
  }
  for (const m of species.filter(m=>m.current_name && (m.system_entry_id || db.DATA.species[m.index]?.playable))) {
    const skills=campaignLists('Natural skills',campaign=>(m.skills[campaign] || []).map(s=>s.id),id=>{
      const level=db.FIELD_GUIDE.skill_requirements[id]?.level;
      const skill=names[id];
      return '<a class="entry-skill-link" href="skills/'+escape(skill.id)+'/"><span>'+escape(skill.title)+'</span><small>'+
        (Number.isInteger(level) ? 'Min. level '+level : 'Minimum level unverified')+'</small></a>';
    },'Natural skills unverified for this entry.');
    const locations=(m.locations || []).filter(l=>l.kind==='wild').map(l=>escape([readable[l.game],l.name,l.floors,'Lv. '+l.levels.join(', ')].filter(Boolean).join(' · ')));
    const masters=(m.locations || []).filter(l=>l.source?.native_selection && l.strength_ranks?.length).map(l=>
      escape(readable[l.game]+' · Strength rank '+l.strength_ranks.join(', ')+' · Lv. '+l.levels.join(', ')));
    const pairs=profiles.firstRecipes(m.index).map(recipe=>{
      const family=db.DATA.families.find(f=>f.id===recipe.family);
      const mate=recipe.b == null ? 'Any '+escape(family?.display_name || family?.name || 'matching')+' monster' : illustratedMonster(recipe.b);
      return '<li><div class="entry-parents">'+illustratedMonster(recipe.a)+'<span>+</span>'+mate+'</div>'+
        (recipe.condition ? '<small>'+escape(recipe.condition)+'</small>' : '')+'</li>';
    });
    const desc=m.library?.text || [m.display_name, db.DATA.species[m.index]?.family_display, 'PlayStation monster profile'].filter(Boolean).join(' · ');
    add('monsters',m.index,m.display_name,desc,skills+
      '<section><h2>First-copy breeding</h2>'+(pairs.length ? '<p class="entry-note">Pedigree + mate</p><ul class="entry-recipes">'+pairs.join('')+'</ul>' : paragraph('No recorded pairing produces a first copy.'))+'</section>'+
      list('Wild encounters',[...new Set(locations)])+
      (masters.length ? list('Wandering master teams',masters)+'<p>'+articleLink('field-wandering-masters')+'</p>' : '')+
      paragraph(m.stats?.base_level_limit ? 'Base level limit: '+m.stats.base_level_limit : ''),'#monster?id='+m.index);
  }
  const places=new Map();
  for (const row of maps.values()) {
    const id=row.placeId || row.id;
    if (!places.has(id)) places.set(id,[]);
    places.get(id).push(row);
  }
  for (const [id,rows] of places) {
    const row=maps.get(id);
    const destinations=[...new Set(rows.flatMap(r=>r.exits).map(e=>maps.get(e.to)).filter(m=>m && m.placeId!==id).map(mapLink))];
    const npcs=[...articles.values()].filter(a=>a.kind==='npc' && a.map_ids?.some(k=>maps.get(k)?.placeId===id));
    const desc=row.title+' map'+(destinations.length ? ' and connected locations' : '')+' in Dragon Quest Monsters 1 & 2 for PlayStation.';
    add('places',id,row.title,desc,'<img class="entry-map" alt="'+escape(row.title)+' map" src="maps/'+escape(row.image)+'">'+
      list('Connected places',destinations)+list('Characters',npcs.map(a=>link('articles/'+a.id+'/',a.title))),'#atlas?map='+id);
  }
  function documentFor(p) {
    const title=escape(p.title+' · DQM1&2 PSX Player Guide');
    const url=base+p.path;
    const depth='../'.repeat(p.path.split('/').filter(Boolean).length);
    const description=escape(p.description);
    const profile=p.kind==='skills' || p.kind==='monsters';
    const monster=p.kind==='monsters' ? bySpecies.get(p.id) : null;
    let introduction='<h1>'+escape(p.title)+'</h1>'+paragraph(p.description);
    if (monster) {
      const identity=[db.DATA.species[monster.index]?.family_display,monster.short_name!==monster.display_name && monster.short_name,monster.japanese].filter(Boolean);
      introduction='<div class="entry-identity">'+portrait(monster.index)+'<div><h1>'+escape(p.title)+'</h1>'+paragraph(identity.join(' · '))+'</div></div>'+
        '<div class="entry-library"><h2>In-game library</h2>'+paragraph(monster.library?.text || 'No in-game library entry.')+'</div>';
    }
    const spoilerPreference = p.guarded ? '<script>try{if(localStorage.getItem("dqm-guide-story-spoilers")==="hide"){document.documentElement.classList.add("hide-story");document.title="Story entry · DQM1&2 PSX Player Guide"}}catch{}</script>' : '';
    const shield = p.guarded ? '<section class="entry-shield"><h1>Story entry</h1><button type="button" onclick="document.documentElement.classList.remove(\'hide-story\')">Reveal this entry</button></section>' : '';
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><base href="'+depth+'"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title>'+
      '<meta name="description" content="'+description+'"><link rel="canonical" href="'+url+'"><meta property="og:url" content="'+url+'"><meta property="og:type" content="article"><meta property="og:title" content="'+title+'"><meta property="og:description" content="'+description+'"><meta property="og:image" content="'+base+'icons/guide-card.png"><meta name="twitter:card" content="summary_large_image">'+
      spoilerPreference+'<link rel="stylesheet" href="'+versioned('css/entry-page.css')+'"></head><body><header>'+link('./','DQM1&2 PSX Player Guide')+'</header><main><nav>'+link('entries/','Guide index')+'</nav>'+shield+'<div class="entry-content'+(profile ? ' entry-profile' : '')+'">'+introduction+p.body+
      (p.route ? '<p>'+link('index.html'+p.route,'Open in the player guide')+'</p>' : '')+'</div></main>'+
      (p.path==='entries/' ? '<script defer src="'+versioned('js/mechanics-index.js')+'"></script>' : '')+
      (p.route ? '<script defer src="'+versioned(script)+'" data-route="'+escape(p.route)+'"></script>' : '')+'</body></html>';
  }
  for (const p of pages) assets.set(p.path+'index.html',Buffer.from(documentFor(p)));
  const alpha = (a,b)=>a.title.localeCompare(b.title,'en');
  const entriesByKind = (kind,title)=>list(title,pages.filter(p=>p.kind===kind).sort(alpha).map(p=>link(p.path,p.title)));
  const directoryQuests = [];
  for (const [game,adventure] of Object.entries(adventures)) {
    const quests = [...articles.values()].filter(row=>row.game===game && row.quest_group);
    const groups = db.DQMWalkthrough.questPurposes.map(purpose=>{
      const ordered = quests.filter(row=>purpose.groups.includes(row.quest_group)).sort((a,b)=>a.quest_order-b.quest_order);
      if (!ordered.length) return '';
      return '<h3>'+escape(purpose.label)+'</h3><ul>'+ordered.map(row=>'<li>'+articleLink(row.id)+'</li>').join('')+'</ul>';
    });
    directoryQuests.push('<section id="quests-'+game+'"><h2>'+escape(adventure)+' quests</h2>'+
      link(db.DQMWalkthrough.paths[game],adventure+' walkthrough')+groups.join('')+'</section>');
  }
  const locations=db.DQMLocations.render('',{byId:articles,routes:db.FIELD_ROUTES.routes,escape,entryLink:linkArticle,
    mapLink:id=>mapLink(maps.get(id)),hidden:()=>false,adventures});
  const topics = {npc:'Characters', boss:'Bosses', mechanic:'Mechanics', item:'Items'};
  const topicLists = Object.entries(topics).map(([kind,title]) => {
    const members = [...articles.values()].filter(row=>row.kind===kind || (kind==='item' && row.kind==='tool'));
    if (kind === 'mechanic') {
      const table = db.DQMMechanicsIndex.render(members,{games:adventures,titleFor:row=>row.title,linkTo:linkArticle,escape});
      return '<section id="mechanics"><h2>Mechanics</h2>'+table+'</section>';
    }
    return list(title,members.sort(alpha).map(row=>articleLink(row.id)));
  });
  const directory={title:'Guide index',path:'entries/',description:'Browse every guide entry by topic.',
    body:[entriesByKind('walkthroughs','Walkthroughs'),'<section class="place-directory"><h2>Gates and worlds</h2>'+locations+'</section>',...directoryQuests,...topicLists,entriesByKind('monsters','Monster library'),
      entriesByKind('skills','Skills'),entriesByKind('places','Map atlas')].join('')};
  assets.set('entries/index.html',Buffer.from(documentFor(directory)));
  assets.set('sitemap.xml',Buffer.from('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+['','entries/',...pages.map(p=>p.path)].map(path=>'<url><loc>'+base+path+'</loc></url>').join('')+'</urlset>'));

  return assets;
}
module.exports={addEntryPages};
