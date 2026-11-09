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
  for (const file of ['breeding-data','monster-reference','handbook-reference','world-guide','field-guide','player-atlas','field-routes','skill-descriptions','npc-sprites','sprite-sheets']) {
    vm.runInContext(assets.get('data/'+file+'.js').toString(),db,{timeout:5000});
  }
  vm.runInContext(assets.get('js/current-names.js').toString(),db,{timeout:5000});
  vm.runInContext(assets.get('js/planner-core.js').toString(),db,{timeout:5000});
  const planner = db.DQMPlannerCore.create(db.DATA);
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
  const readable = {terry:'Terry',cobi:'Cobi',tara:'Tara'};
  const articleLink = id => {
    const article = articles.get(id);
    return article ? link('articles/'+id+'/',article.title) : '';
  };
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
    const related=(row.related || []).map(id=>articles.get(id)).filter(Boolean).map(r=>link('articles/'+r.id+'/',r.title));
    const places=[...new Set([...(row.map_ids || []),...(routeData.maps || [])].map(id=>maps.get(id)).filter(Boolean).map(mapLink))];
    const steps=(routeData.stages || []).map(stage=>[stage.arena,...stage.gates].map(articleLink).filter(Boolean).join(' → '));
    const guideLinks=[routeData.gate,routeData.boss,routeData.arena,...(routeData.supplies || [])].filter(Boolean).map(articleLink)
      .concat((routeData.skills || []).map(id=>names[id]).filter(Boolean).map(skillLink));
    const details=(row.details || []).filter(line=>!stock.length || !/shops sell it for/i.test(line));
    add('articles',row.id,row.title,row.summary,art+details.map(paragraph).join('')+
      list('Walkthrough',steps)+list('Wild encounters',[...new Set(encounterList(routeData.encounters))])+
      list('Encounter base stats',battleList(routeData.fights))+list('In this guide',guideLinks)+list('Shops',stock)+list('Maps',places)+list('Monsters',(row.species_ids || []).map(id=>bySpecies.get(id)).filter(Boolean).map(monsterLink))+
      list('Related entries',related),'#field-guide?entry='+row.id,['story','ending'].includes(row.spoiler));
  }
  for (const [id,name] of Object.entries(names)) {
    const effect=db.SKILL_DESCRIPTIONS[id];
    const learner=species.filter(m=>Object.values(m.skills).some(group=>group.some(s=>s.id===Number(id))));
    const prereq=[effect.upgradesFrom,...(effect.combination || [])].filter(Boolean).map(k=>names[k]).filter(Boolean);
    const stats=db.FIELD_GUIDE.skill_requirements[id] || {};
    add('skills',name.id,name.title,name.description || effect.description,
      paragraph('MP cost: '+effect.mpCost+' · Target: '+effect.target)+list('Minimum learning stats',Object.entries(stats).map(([k,v])=>escape(k+' · '+v)))+
      list('Related skills',prereq.map(skillLink))+list('Natural learners',learner.map(monsterLink)),'#field-guide?kind=skill&entry=skill-'+name.id);
  }
  const firstParents=new Map();
  for (const a of db.DATA.species.filter(s=>s.playable)) {
    for (const b of db.DATA.species.filter(s=>s.playable)) {
      const outcome=planner.result(a.index,b.index).resultIndex;
      if (outcome===a.index || outcome===b.index) continue;
      if (!firstParents.has(outcome)) firstParents.set(outcome,[]);
      const pairs=firstParents.get(outcome);
      if (pairs.length<3) pairs.push([a.index,b.index]);
    }
  }
  for (const m of species.filter(m=>m.current_name && (m.system_entry_id || db.DATA.species[m.index]?.playable))) {
    const skillIds=new Set(Object.values(m.skills).flat().map(s=>s.id));
    const locations=(m.locations || []).filter(l=>l.kind==='wild').map(l=>escape([readable[l.game],l.name,l.floors,'Lv. '+l.levels.join(', ')].filter(Boolean).join(' · ')));
    const pairs=(firstParents.get(m.index) || []).map(([a,b])=>monsterLink(bySpecies.get(a))+' × '+monsterLink(bySpecies.get(b)));
    const desc=m.library?.text || [m.display_name, db.DATA.species[m.index]?.family_display, 'PlayStation monster profile'].filter(Boolean).join(' · ');
    add('monsters',m.index,m.display_name,desc,paragraph([m.short_name,m.japanese].filter(Boolean).join(' · '))+list('Wild encounters',[...new Set(locations)])+
      list('Parents for a first copy at the ordinary shrine (+0)',pairs)+paragraph(m.stats?.base_level_limit ? 'Base level limit: '+m.stats.base_level_limit : '')+
      list('Natural skills',[...skillIds].map(id=>names[id]).filter(Boolean).map(skillLink)),'#monster?id='+m.index);
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
  const kinds={articles:'Walkthroughs & reference',monsters:'Monster library',skills:'Skills',places:'Map atlas'};
  function documentFor(p) {
    const title=escape(p.title+' · DQM1&2 PSX Player Guide');
    const url=base+p.path;
    const depth='../'.repeat(p.path.split('/').filter(Boolean).length);
    const description=escape(p.description);
    const spoilerPreference = p.guarded ? '<script>try{if(localStorage.getItem("dqm-guide-story-spoilers")==="hide"){document.documentElement.classList.add("hide-story");document.title="Story entry · DQM1&2 PSX Player Guide"}}catch{}</script>' : '';
    const shield = p.guarded ? '<section class="entry-shield"><h1>Story entry</h1><button type="button" onclick="document.documentElement.classList.remove(\'hide-story\')">Reveal this entry</button></section>' : '';
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><base href="'+depth+'"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title>'+
      '<meta name="description" content="'+description+'"><link rel="canonical" href="'+url+'"><meta property="og:url" content="'+url+'"><meta property="og:type" content="article"><meta property="og:title" content="'+title+'"><meta property="og:description" content="'+description+'"><meta property="og:image" content="'+base+'icons/guide-card.png"><meta name="twitter:card" content="summary_large_image">'+
      spoilerPreference+'<link rel="stylesheet" href="'+versioned('css/entry-page.css')+'"></head><body><header>'+link('./','DQM1&2 PSX Player Guide')+'</header><main><nav>'+link('entries/','Guide index')+'</nav>'+shield+'<div class="entry-content"><h1>'+escape(p.title)+'</h1>'+paragraph(p.description)+p.body+
      (p.route ? '<p>'+link('index.html'+p.route,'Open in the player guide')+'</p>' : '')+'</div></main>'+
      (p.route ? '<script defer src="'+versioned(script)+'" data-route="'+escape(p.route)+'"></script>' : '')+'</body></html>';
  }
  for (const p of pages) assets.set(p.path+'index.html',Buffer.from(documentFor(p)));
  const directory={title:'Guide index',path:'entries/',description:'Browse every guide entry by topic.',body:Object.entries(kinds).map(([kind,label])=>list(label,pages.filter(p=>p.kind===kind).sort((a,b)=>a.title.localeCompare(b.title,'en')).map(p=>link(p.path,p.title)))).join('')};
  assets.set('entries/index.html',Buffer.from(documentFor(directory)));
  assets.set('sitemap.xml',Buffer.from('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+['','entries/',...pages.map(p=>p.path)].map(path=>'<url><loc>'+base+path+'</loc></url>').join('')+'</urlset>'));

  return assets;
}
module.exports={addEntryPages};
