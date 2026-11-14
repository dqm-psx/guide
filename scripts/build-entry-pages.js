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
  for (const file of ['breeding-data','monster-reference','handbook-reference','world-guide','field-guide','player-atlas','field-routes','gate-entrances','gate-generation','skill-descriptions','item-reference','item-art','npc-sprites','character-dialogue','sprite-images','family-icons','patch-rewards']) {
    vm.runInContext(assets.get('data/'+file+'.js').toString(),db,{timeout:5000});
  }
  vm.runInContext(assets.get('js/current-names.js').toString(),db,{timeout:5000});
  vm.runInContext(assets.get('js/walkthrough-context.js').toString(),db,{timeout:5000});
  vm.runInContext(assets.get('js/walkthrough.js').toString(),db,{timeout:5000});
  vm.runInContext(assets.get('js/locations.js').toString(),db,{timeout:5000});
  vm.runInContext(assets.get('js/place-context.js').toString(),db,{timeout:5000});
  vm.runInContext(assets.get('js/gate-generation.js').toString(),db,{timeout:5000});
  vm.runInContext(assets.get('js/sortable-index.js').toString(),db,{timeout:5000});
  vm.runInContext(assets.get('js/mechanics-index.js').toString(),db,{timeout:5000});
  vm.runInContext(assets.get('js/skill-index.js').toString(),db,{timeout:5000});
  vm.runInContext(assets.get('js/item-index.js').toString(),db,{timeout:5000});
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
  const placeContext = db.DQMPlaceContext.create({entries:[...articles.values()],routes:db.FIELD_ROUTES.routes,
    scenes:db.FIELD_ROUTES.scenes,maps:db.PLAYER_ATLAS.maps,entrances:db.GATE_ENTRANCES,generation:db.GATE_GENERATION});
  const names = db.FIELD_GUIDE.skill_names;
  const species = db.MONSTER_REFERENCE.species;
  const bySpecies = new Map(species.map(m=>[m.index,m]));
  const skillLink = n=>link('skills/'+n.id+'/',n.title);
  const monsterLink = m=>link('monsters/'+m.index+'/',m.display_name);
  const mapLink = m=>link('places/'+(m.placeId || m.id)+'/',m.title);
  const campaigns = ['terry','cobi','tara'];
  const readable = Object.fromEntries(campaigns.map(key=>[key,articles.get('npc-'+key).title]));
  const portraits = db.SPRITE_IMAGES.portrait;
  function portrait(index) {
    const image = portraits[index];
    if (!image) return '';
    return '<img class="entry-portrait" alt="" loading="lazy" decoding="async" src="'+escape(versioned(image.src))+'" width="'+image.width+'" height="'+image.height+'">';
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
  function articlePath(article) {
    if (article.redirect_to) {
      const target=articles.get(article.redirect_to);
      if (!target || target.redirect_to) throw Error('Invalid article redirect '+article.id);
      return articlePath(target)+(article.redirect_section?'#article-section-'+article.redirect_section:'');
    }
    return article.kind === 'story' ? db.DQMWalkthrough.paths[article.game]+'#'+article.id : 'articles/'+article.id+'/';
  }
  function linkArticle(id,label) {
    const article = articles.get(id);
    const skill = Object.values(names).find(skill=>'skill-'+skill.id===id);
    return article ? link(articlePath(article),label || article.title) : skill ? link('skills/'+skill.id+'/',label || skill.title) : '';
  }
  const articleLink = id => linkArticle(id);
  function articleProse(row,text) {
    const skills=(row.skill_ids || []).map(id=>names[id]).filter(Boolean);
    if (!skills.length) return escape(text);
    const byName=new Map(skills.map(skill=>[skill.title,skill]));
    const pattern=[...byName.keys()].sort((a,b)=>b.length-a.length).map(name=>name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
    const rx=new RegExp('(?<![\\p{L}\\p{N}])(?:'+pattern+')(?![\\p{L}\\p{N}])','gu');
    let result='',start=0;
    for (const match of text.matchAll(rx)) {
      result+=escape(text.slice(start,match.index))+skillLink(byName.get(match[0]));
      start=match.index+match[0].length;
    }
    return result+escape(text.slice(start));
  }
  const storyContext = row => ['story','ending'].includes(row.spoiler) ? ' data-story-context' : '';
  function contextLinks(title,rows,mapIds=[]) {
    if (!rows.length) return '';
    return '<section data-place-context'+(mapIds.length?' class="entry-location-characters"':'')+'><h2>'+escape(title)+'</h2><ul>'+rows.map(row=>{
      const base=db.NPC_SPRITES[row.id],contextual=base?.variants?.find(variant=>variant.mapIds.some(id=>mapIds.includes(id)));
      const sprite=contextual||base;
      const image=mapIds.length && sprite?.image ? '<img class="entry-character-sprite" alt="" src="'+escape(sprite.image)+'">' : '';
      return '<li'+(contextual?.spoiler==='none'?'':storyContext(row))+'><a href="'+escape(articlePath(row))+'">'+image+escape(row.title)+'</a></li>';
    }).join('')+'</ul></section>';
  }
  function locationCharacters(row) {
    if (row.kind!=='location') return '';
    const mapIds=placeContext.mapsForLocation(row.id).map(map=>map.id);
    const generation=db.GATE_GENERATION.entries[row.id];
    const bosses=new Set([db.FIELD_ROUTES.routes[row.id]?.boss,generation?.boss?.entry,...(generation?.bosses || []).map(record=>record.entry)]);
    return Object.entries(placeContext.charactersForLocation(row.id)).map(([key,characters])=>[key,characters.filter(character=>!bosses.has(character.id))]).map(([key,characters])=>characters.length ?
      '<section class="entry-location-characters" data-place-context><h2>'+(key==='here'?'Characters here':'Related characters')+'</h2><ul>'+
      characters.map(character=>{
        const base=db.NPC_SPRITES[character.id];
        const contextual=base?.variants?.find(variant=>variant.mapIds.some(id=>mapIds.includes(id)));
        const sprite=contextual || base;
        const image=sprite?.image ? '<img class="entry-character-sprite" alt="" src="'+escape(sprite.image)+'">' :
          sprite?.species!=null ? portrait(sprite.species) : '';
        return '<li'+(contextual?.spoiler==='none'?'':storyContext(character))+'><a href="'+escape(articlePath(character))+'">'+image+'<span>'+escape(character.title)+'</span></a></li>';
      }).join('')+'</ul></section>' : '').join('');
  }
  function markedMap(map,entrances=[],label=false) {
    const pins=entrances.map((entrance,i)=>{
      const position='left:'+entrance.x*100+'%;top:'+entrance.y*100+'%';
      const title=entrance.location.title;
      const edge=entrance.x<.25 ? ' gate-label-right' : entrance.x>.75 ? ' gate-label-left' : '';
      return label ? '<span class="entry-gate-label'+edge+(entrance.y<.15?' gate-label-below':'')+'" style="'+position+'" role="img" aria-label="Entrance to '+escape(title)+'"><span aria-hidden="true">'+escape(title)+'</span></span>' :
        '<a class="entry-gate-pin"'+storyContext(entrance.location)+' style="'+position+'" href="'+escape(articlePath(entrance.location))+'" aria-label="'+(i+1)+': '+escape(title)+'">'+(i+1)+'</a>';
    }).join('');
    return '<div class="entry-map-frame"><img class="entry-map" alt="'+escape(map.title)+' map" src="maps/'+escape(map.image)+'">'+pins+'</div>';
  }
  function gateLegend(entrances) {
    return entrances.length ? '<section data-place-context><h2>Travelers’ Gates</h2><ol class="entry-gate-legend">'+entrances.map((entrance,i)=>
      '<li value="'+(i+1)+'"'+storyContext(entrance.location)+'>'+articleLink(entrance.location.id)+
      (entrance.note ? ' — '+escape(entrance.note) : '')+'</li>').join('')+'</ol></section>' : '';
  }
  function locationMaps(row) {
    if (row.kind !== 'location') return '';
    const places=placeContext.mapsForLocation(row.id);
    if (!places.length) return '';
    const entrances=placeContext.entrancesForLocation(row.id);
    if (db.DQMLocations.isGate(row)) {
      const panels=places.map(place=>{
        const entrance=entrances.find(record=>(maps.get(record.map).placeId || record.map)===place.id);
        const map=entrance ? maps.get(entrance.map) : place;
        const caption=entrance ? link('places/'+place.id+'/#'+map.id,map.title+(entrance.floor ? ' · '+entrance.floor : '')) : mapLink(map);
        return '<figure class="entry-gate-map" data-map-role="'+(entrance?'entrance':'final')+'"><figcaption><strong>'+
          (entrance?'Entrance':row.availability==='unused'?'Unused final area':'Final area')+'</strong> · '+caption+'</figcaption>'+
          markedMap(map,entrance?[entrance]:[],true)+'</figure>';
      });
      return '<section class="location-maps" aria-label="Gate maps">'+
        '<div class="entry-gate-map-grid">'+panels.join('')+'</div></section>';
    }
    const first=placeContext.defaultMapForLocation(row.id);
    const firstPlace=first.placeId || first.id;
    const remaining=places.filter(map=>(map.placeId || map.id)!==firstPlace);
    return '<section class="location-maps"><h2>Maps</h2>'+
      '<figure>'+markedMap(first)+'<figcaption>'+mapLink(first)+'</figcaption></figure>'+
      (remaining.length ? '<ul>'+remaining.map(map=>'<li>'+mapLink(map)+'</li>').join('')+'</ul>' : '')+'</section>';
  }
  function gateFacts(row,data) {
    if (!db.DQMLocations.isGate(row)) return '';
    const entries=[];
    if (data.arena) {
      const rank=data.arena.split('-').at(-1).toUpperCase();
      entries.push(['Arena requirement',linkArticle(data.arena,'Win Class '+rank+(rank==='S'?'':' or higher'))]);
    }
    const generation=db.GATE_GENERATION.entries[row.id];
    const nativeBoss=generation?.boss;
    const boss=articles.get(data.boss) || articles.get(nativeBoss?.entry);
    const bossSpecies=boss?.species_ids?.[0] ?? nativeBoss?.species;
    const monster=bySpecies.get(bossSpecies);
    if (boss || monster) entries.push(['Gate boss','<a class="entry-boss-link" href="'+escape(boss?articlePath(boss):'monsters/'+monster.index+'/')+'">'+
      (monster ? portrait(monster.index) : '')+'<span>'+escape(boss?.title || monster.display_name)+'</span></a>']);
    else if (generation?.bosses?.length) {
      const links=generation.bosses.map(record=>{
        const monster=bySpecies.get(record.species), encounter=articles.get(record.entry);
        return '<a class="entry-boss-link" href="'+escape(encounter?articlePath(encounter):'monsters/'+monster.index+'/')+'">'+
          portrait(monster.index)+'<span>'+escape(encounter?.title || monster.display_name)+'</span></a>';
      });
      entries.push([generation.bossLabel,'<div class="entry-boss-list">'+links.join('')+'</div>'+paragraph(generation.bossNote)]);
    }
    return entries.length ? '<dl class="entry-gate-facts">'+entries.map(([label,value])=>'<div><dt>'+escape(label)+'</dt><dd>'+value+'</dd></div>').join('')+'</dl>' : '';
  }
  const adventures = {dqm1:readable.terry, dqm2:readable.cobi+' & '+readable.tara};
  const itemOptions = {escape, games:adventures, title:'Items', titleFor:row=>row.title, hidden:()=>false,
    entryLink:(id,html)=>'<a href="'+escape(articlePath(articles.get(id)))+'">'+html+'</a>',
    mapLink:(id,html)=>'<a href="places/'+escape(maps.get(id).placeId || id)+'/">'+html+'</a>'};
  for (const [game,label] of Object.entries(adventures)) {
    const path = db.DQMWalkthrough.paths[game];
    const content = db.DQMWalkthrough.render(game,{
      byId:articles, routes:db.FIELD_ROUTES.routes, escape, hidden:()=>false, title:row=>row.title,
      maps:db.PLAYER_ATLAS.maps,itemReferences:db.DQMItemReference.items,
      mapHref:map=>'places/'+(map.placeId || map.id)+'/',mapImage:map=>'maps/'+map.image,
      entryArt:(row,mapIds)=>{
        const base=db.NPC_SPRITES[row.id],contextual=base?.variants?.find(variant=>variant.mapIds.some(id=>mapIds.includes(id)));
        const sprite=contextual || base;
        return sprite?.image ? '<img alt="" src="'+escape(sprite.image)+'">' : row.species_ids?.length ? portrait(row.species_ids[0]) : '';
      },
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
  function gateEncounterTable(groups,unused=false) {
    const rows=Object.entries(groups || {}).flatMap(([game,ids])=>ids.map(id=>encounters.get(game+'/'+id)))
      .filter(Boolean).map(({location,monsters})=>'<tr><th scope="row">'+escape(location.floors)+'</th><td>'+monsters.join(' · ')+'</td></tr>');
    return rows.length ? '<section id="location-encounters" class="entry-gate-encounters"><h2>'+(unused?'Unused encounter records':'Wild encounters')+'</h2>'+
      '<table><thead><tr><th>Floors</th><th>Wild monsters</th></tr></thead><tbody>'+rows.join('')+'</tbody></table></section>' : '';
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
    if (row.redirect_to) continue;
    const routeData = db.FIELD_ROUTES?.routes?.[row.id] || {};
    const gate=db.DQMLocations.isGate(row);
    const contacts=new Set(Object.values(placeContext.charactersForLocation(row.id)).flat().map(character=>character.id));
    const characterLocations=row.kind==='npc' ? placeContext.locationsForCharacter(row.id) : [];
    const npcart=db.NPC_SPRITES[row.id]?.image;
    const item = db.DQMItemReference.items[row.id];
    const image = item ? db.DQMItemArt.imageFor(row) : row.image || npcart;
    const art = /^data:image\/png;base64,[a-zA-Z0-9+/=]+$/.test(image || '') ? '<img class="entry-icon" src="'+image+'" alt="">' : '';
    const appearances=db.NPC_SPRITES[row.id]?.variants;
    const identity = item ? db.DQMItemIndex.profileHeading(row,{escape,art,level:1}) : appearances?.length ?
      '<div class="entry-npc-appearances" aria-label="Character appearances">'+appearances.map(variant=>'<figure><img alt="'+escape(row.title+' · '+variant.label)+'" src="'+escape(variant.image)+'"><figcaption>'+escape(variant.label)+'</figcaption></figure>').join('')+'</div>' : art;
    const stock=(row.prices || []).map(p=>p.locations.map(location=>db.DQMItemIndex.shopLink(location,itemOptions)).join(', ')+
      escape(' · '+p.buy+' G (Gold Pass '+p.gold_pass+' G)'));
    const quests = row.kind === 'npc' ? [...articles.values()].filter(quest=>quest.kind==='quest' &&
      (quest.related?.includes(row.id) || row.related?.includes(quest.id))) : [];
    const questChapters=db.DQMWalkthrough.chaptersForQuest(row,articles);
    const related=(row.related || []).filter(id=>id!==routeData.gate && !characterLocations.some(location=>location.id===id) && !contacts.has(id) && !quests.some(quest=>quest.id===id) && !questChapters.some(stage=>stage.id===id) && !(gate && id===routeData.boss))
      .map(articleLink).filter(Boolean);
    const places=[...new Set([...(row.map_ids || []),...(routeData.maps || [])].map(id=>maps.get(id)).filter(Boolean).map(mapLink))];
    const steps=(routeData.stages || []).map(stage=>[stage.arena,...stage.gates].map(articleLink).filter(Boolean).join(' → '));
    const guideLinks=[routeData.gate,...(gate?[]:[routeData.boss,routeData.arena]),...(routeData.supplies || [])].filter(Boolean).map(articleLink)
      .concat((routeData.skills || []).map(id=>names[id]).filter(Boolean).map(skillLink));
    const details=db.DQMItemIndex.extraDetails(row).filter(line=>(!stock.length || !/shops sell it for/i.test(line)) && !(routeData.gate && /^Encounter: /u.test(line)));
    const nicknameNote=db.DQMNicknameMarkup(row,escape,articleLink);
    const stepsMarkup = row.kind==='quest' && details.length ? '<ol>'+details.map(step=>'<li>'+escape(step)+'</li>').join('')+'</ol>' : details.map(paragraph).join('');
    const requests = row.requested_species?.length ? '<section><h2>Monsters in request order</h2><ol>'+
      row.requested_species.map(id=>'<li>'+monsterLink(bySpecies.get(id))+'</li>').join('')+'</ol></section>' : '';
    const dialogue = db.DQMCharacterDialogue.markup(row,escape,quests.map(quest=>articleLink(quest.id)),true);
    const fullWalk = row.kind==='story' ? '<p>'+link(db.DQMWalkthrough.paths[row.game]+'#'+row.id,adventures[row.game]+' walkthrough')+'</p>' : '';
    const walkChapters = questChapters.length ? '<nav class="quest-chapters" aria-label="Walkthrough chapters"><strong>'+
      escape(adventures[row.game])+' walkthrough</strong> · '+questChapters.map(stage=>articleLink(stage.id)).join(' · ')+'</nav>' : '';
    const itemFacts = item ? db.DQMItemIndex.itemFacts(row,itemOptions) : '';
    const artCredit = item ? '<p class="item-art-credit">Artwork · '+escape(db.DQMItemArt.creditFor(row))+'</p>' : '';
    const gateLinks=[...new Set([...guideLinks,...related])];
    const gateSummary=gate ? '<div class="entry-gate-summary"><div class="entry-gate-overview"><h1>'+escape(row.title)+'</h1>'+
      paragraph(db.DQMLocations.leadFor(row))+gateFacts(row,routeData)+locationCharacters(row)+
      (gateLinks.length ? '<nav class="entry-gate-links" aria-label="Related guide entries">'+gateLinks.join('')+'</nav>' : '')+
      '</div>'+gateEncounterTable(routeData.encounters,row.availability==='unused')+'</div>' : '';
    const mapsAndFloors=gate ? '<div class="entry-gate-content">'+locationMaps(row)+db.DQMGateGeneration.render(row.id,{escape,headingLevel:2})+'</div>' : locationMaps(row);
    const calculatorLink=db.DQMMechanicsIndex.articleTool(row.id,escape);
    add('articles',row.id,row.title,db.DQMLocations.leadFor(row),gateSummary+fullWalk+identity+itemFacts+calculatorLink+db.DQMArticleSections(row,escape,text=>articleProse(row,text),2,null,{
      articleLink,compactContents:true,collapseSpoilers:true,sectionHref:id=>articlePath(row)+'#article-section-'+id
    })+nicknameNote+stepsMarkup+walkChapters+requests+mapsAndFloors+
      (gate?'':locationCharacters(row))+contextLinks('Locations',characterLocations)+
      list('Arena classes',(row.arena_classes || []).map(articleLink))+dialogue+
      list('Walkthrough',steps)+(gate?'':list('Wild encounters',[...new Set(encounterList(routeData.encounters))]).replace('<section>','<section id="location-encounters">'))+
      list('Encounter base stats',battleList(routeData.fights))+(gate?'':list('In this guide',guideLinks))+list('Shops',stock)+(row.kind==='location' ? '' : list('Maps',places))+list('Monsters',(row.species_ids || []).map(id=>bySpecies.get(id)).filter(Boolean).map(monsterLink))+
      (gate?'':list('Related entries',related))+artCredit,'#field-guide?entry='+row.id,['story','ending'].includes(row.spoiler));
  }
  const skillRows = [];
  for (const [id,name] of Object.entries(names)) {
    const skill=db.SKILL_DESCRIPTIONS[id];
    const description=name.description || skill.description;
    skillRows.push({id:name.id, name:name.title, description, type:skill.type, effect:skill.effect,
      mpCost:skill.mpCost, target:skill.target});
    const skillFacts = [['Effect',escape(skill.effect)],['Type',escape(skill.type)]];
    if (skill.mpCost != null) skillFacts.push(['MP cost',escape(skill.mpCost)]);
    if (skill.target) skillFacts.push(['Target',escape(skill.target)]);
    if (names[skill.upgradesFrom]) skillFacts.push(['Upgrades from',skillLink(names[skill.upgradesFrom])]);
    const prereqs=(skill.combination || []).map(k=>names[k]).filter(Boolean);
    if (prereqs.length) skillFacts.push(['Requires skills',prereqs.map(skillLink).join(' + ')]);
    const battleCombos=(db.MONSTER_REFERENCE.guide_names.battle_combos || []).filter(combo=>combo.skills.includes(Number(id)));
    if (battleCombos.length) skillFacts.push(['Battle combinations',battleCombos.map(combo=>
      link('articles/field-battle-combos/#article-section-combo-recipes',combo.title)).join(' · ')]);
    const stats=db.FIELD_GUIDE.skill_requirements[id] || {};
    const labels={level:'Level',hp:'HP',mp:'MP',attack:'Attack',defense:'Defense',agility:'Agility',intelligence:'Intelligence'};
    const minimums=Object.entries(stats).filter(([,value])=>value>0).map(([key,value])=>[labels[key] || key,escape(value)]);
    const learners=campaignLists('Natural learners',campaign=>species.filter(m=>m.skills[campaign]?.some(s=>s.id===Number(id))).map(m=>m.index),
      illustratedMonster,'No natural learners recorded.');
    add('skills',name.id,name.title,description,
      facts(skillFacts)+'<p>'+link('#skill-planner?skill='+id,'Check skill learning and growth')+'</p>'+
      (minimums.length ? '<section><h2>Minimum learning stats</h2>'+facts(minimums)+'</section>' : '')+
      learners,'#field-guide?kind=skill&entry=skill-'+name.id);
  }
  for (const m of species.filter(m=>m.current_name && (m.system_entry_id || db.DATA.species[m.index]?.playable))) {
    const rewards = db.DQM_PATCH_REWARDS?.species?.[m.index] || [];
    const rewardOnly = db.DATA.species[m.index]?.playable === false && rewards.length > 0;
    const rewardMarkup = list('Enhanced '+db.DQM_PATCH_REWARDS?.version+' rewards',rewards.map(reward=>
      linkArticle(reward.entry,reward.title || 'Reward details')+' — '+escape(reward.text)));
    const skills=campaignLists('Natural skills',campaign=>(m.skills[campaign] || []).map(s=>s.id),id=>{
      const level=db.FIELD_GUIDE.skill_requirements[id]?.level;
      const skill=names[id];
      return '<a class="entry-skill-link" href="skills/'+escape(skill.id)+'/"><span>'+escape(skill.title)+'</span><small>'+
        (Number.isInteger(level) ? 'Min. level '+level : 'Minimum level unverified')+'</small></a>';
    },'Natural skills unverified for this entry.');
    const locations=(m.locations || []).filter(l=>l.kind==='wild' && l.availability!=='unused').map(l=>escape([readable[l.game],l.name,l.floors,'Lv. '+l.levels.join(', ')].filter(Boolean).join(' · ')));
    const masters=(m.locations || []).filter(l=>l.source?.native_selection && l.strength_ranks?.length).map(l=>
      escape(readable[l.game]+' · Strength rank '+l.strength_ranks.join(', ')+' · Lv. '+l.levels.join(', ')));
    const pairs=profiles.firstRecipes(m.index).map(recipe=>{
      const family=db.DATA.families.find(f=>f.id===recipe.family);
      const mate=recipe.b == null ? 'Any '+escape(family?.display_name || family?.name || 'matching')+' monster' : illustratedMonster(recipe.b);
      return '<li><div class="entry-parents">'+illustratedMonster(recipe.a)+'<span>+</span>'+mate+'</div>'+
        (recipe.condition ? '<small>'+escape(recipe.condition)+'</small>' : '')+'</li>';
    });
    const desc=m.library?.text || [m.display_name, db.DATA.species[m.index]?.family_display, 'PlayStation monster profile'].filter(Boolean).join(' · ');
    add('monsters',m.index,m.display_name,desc,skills+rewardMarkup+(rewardOnly ? '' : '<p>'+link('#skill-planner?species='+m.index,'Plan skills and growth')+' · '+link('#combat-planner?species='+m.index,'Compare damage')+'</p>'+
      '<section><h2>First-copy breeding</h2>'+(pairs.length ? '<p class="entry-note">Pedigree + mate</p><ul class="entry-recipes">'+pairs.join('')+'</ul>' : paragraph('No recorded pairing produces a first copy.'))+'</section>')+
      list('Wild encounters',[...new Set(locations)])+
      (masters.length ? list('Wandering master teams',masters)+'<p>'+articleLink('field-wandering-masters')+'</p>' : '')+
      paragraph(m.stats?.base_level_limit ? (rewardOnly ? 'Base level cap: '+m.stats.base_level_limit+'.' : 'Usual recruitment level cap: '+Math.max(1,m.stats.base_level_limit-2)+'–'+Math.min(99,m.stats.base_level_limit+2)+'. Bred offspring use a separate base limit plus three times their + value.') : ''),'#monster?id='+m.index);
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
    const context=placeContext.contextForMap(id);
    const location=context.location;
    const overview=location ? '<section'+storyContext(location)+'><h2>'+linkArticle(location.id,location.title+' overview')+'</h2>'+paragraph(location.summary)+
      (db.FIELD_ROUTES.routes[location.id]?.encounters ? '<p>'+link(articlePath(location)+'#location-encounters',location.title+' encounters')+'</p>' : '')+'</section>' : '';
    const desc=row.title+' map'+(destinations.length ? ' and connected locations' : '')+' in Dragon Quest Monsters 1 & 2 for PlayStation.';
    const portalLayouts=rows.filter((map,i)=>placeContext.entrancesForMap(map.id).length && rows.findIndex(candidate=>candidate.image===map.image)===i);
    const mapContent=portalLayouts.length ? portalLayouts.map((map,i)=>{
      const entrances=placeContext.entrancesForMap(map.id);
      const floor=entrances.find(entrance=>entrance.floor)?.floor;
      return '<section class="entry-portal-layout" id="'+escape(map.id)+'">'+
        (floor ? '<h2>'+escape(floor+' · '+map.title)+'</h2>' : portalLayouts.length>1 ? '<h2>Layout '+(i+1)+'</h2>' : '')+
        markedMap(map,entrances)+gateLegend(entrances)+'</section>';
    }).join('') : markedMap(row);
    add('places',id,row.title,desc,mapContent+
      overview+contextLinks('Walkthrough',context.chapters)+contextLinks('Quests',context.quests)+contextLinks('Bosses',context.bosses)+
      list('Connected places',destinations)+contextLinks('Characters',context.characters,rows.map(map=>map.id)),'#atlas?map='+id);
  }
  function documentFor(p) {
    const title=escape(p.title+' · DQM1&2 PSX Player Guide');
    const url=base+p.path;
    const depth='../'.repeat(p.path.split('/').filter(Boolean).length);
    const description=escape(p.description);
    const profile=p.kind==='skills' || p.kind==='monsters';
    const monster=p.kind==='monsters' ? bySpecies.get(p.id) : null;
    const item = p.kind === 'articles' && db.DQMItemReference.items[p.id];
    const location=p.kind==='articles' && articles.get(p.id)?.kind==='location' ? articles.get(p.id) : null;
    const gate=db.DQMLocations.isGate(location);
    const locationNav=location ? '<nav class="entry-places-nav" aria-label="Locations and maps">'+
      '<a href="entries/#locations-'+location.game+'" aria-label="Back to '+escape(adventures[location.game])+(gate?' gates':' locations')+'" title="Back to locations"><span aria-hidden="true">←</span></a>'+
      link('entries/#locations','Overview')+link('entries/#locations-dqm1',adventures.dqm1+'’s gates')+
      link('entries/#locations-dqm2',adventures.dqm2+'’s worlds')+'</nav>' : '';
    let introduction=item || gate ? '' : '<h1>'+escape(p.title)+'</h1>'+paragraph(p.description);
    if (monster) {
      const species = db.DATA.species[monster.index];
      const icon = db.FAMILY_ICONS[species.family_id];
      const family = '<span class="family-label">'+(icon ? '<img class="family-icon" alt="" src="'+versioned(icon.src)+'" width="'+icon.width+'" height="'+icon.height+'">' : '')+escape(species.family_display || species.family)+' Family</span>';
      const identity=[monster.short_name!==monster.display_name && monster.short_name,monster.japanese].filter(Boolean);
      introduction='<div class="entry-identity">'+portrait(monster.index)+'<div><p>'+family+'</p><h1>'+escape(p.title)+'</h1>'+paragraph(identity.join(' · '))+'</div></div>'+
        '<div class="entry-library"><h2>In-game library</h2>'+paragraph(monster.library?.text || 'No in-game library entry.')+'</div>';
    }
    const spoilerPreference = p.guarded ? '<script>try{if(localStorage.getItem("dqm-guide-story-spoilers")==="hide"){document.documentElement.classList.add("hide-story");document.title="Story entry · DQM1&2 PSX Player Guide"}}catch{}</script>' : '';
    const shield = p.guarded ? '<section class="entry-shield"><h1>Story entry</h1><button type="button" onclick="document.documentElement.classList.remove(\'hide-story\')">Reveal this entry</button></section>' : '';
    const contextPreference = p.body.includes('data-story-context') ? '<script>try{if(localStorage.getItem("dqm-guide-story-spoilers")==="hide"){document.querySelectorAll("[data-story-context]").forEach(function(node){node.hidden=true});document.querySelectorAll("[data-place-context]").forEach(function(section){if(Array.from(section.querySelectorAll("li")).every(function(item){return item.hidden}))section.hidden=true})}}catch{}</script>' : '';
    return '<!doctype html><html lang="en"><head><meta charset="utf-8"><base href="'+depth+'"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title>'+
      '<meta name="description" content="'+description+'"><link rel="canonical" href="'+url+'"><meta property="og:url" content="'+url+'"><meta property="og:type" content="article"><meta property="og:title" content="'+title+'"><meta property="og:description" content="'+description+'"><meta property="og:image" content="'+base+'icons/guide-card.png"><meta name="twitter:card" content="summary_large_image">'+
      spoilerPreference+'<link rel="stylesheet" href="'+versioned('css/entry-page.css')+'">'+
      '<link rel="stylesheet" href="'+versioned('css/handbook.css')+'">'+
      (p.kind==='walkthroughs' ? '<link rel="stylesheet" href="'+versioned('css/walkthrough.css')+'">' : '')+
      (p.path==='entries/' || item ? '<link rel="stylesheet" href="'+versioned('css/reference-tables.css')+'">' : '')+
      '</head><body><header>'+link('./','DQM1&2 PSX Player Guide')+
      (p.path==='entries/' ? '' : '<nav aria-label="Guide navigation">'+link('entries/','Guide index')+'</nav>')+
      '</header><main'+(gate?' class="entry-gate-page"':'')+'>'+shield+'<div class="entry-content'+(profile ? ' entry-profile' : '')+(monster?' entry-monster-profile':'')+'">'+locationNav+introduction+p.body+
      (p.route ? '<p>'+link('index.html'+p.route,'Open in the player guide')+'</p>' : '')+'</div></main>'+
      (p.path==='entries/' ? ['js/sortable-index.js','js/mechanics-index.js','js/skill-index.js','js/item-index.js'].map(file=>
        '<script defer src="'+versioned(file)+'"></script>').join('') : '')+
      contextPreference+(p.route ? '<script defer src="'+versioned(script)+'" data-route="'+escape(p.route)+'"></script>' : '')+'</body></html>';
  }
  for (const p of pages) assets.set(p.path+'index.html',Buffer.from(documentFor(p)));
  for (const article of articles.values()) {
    if (!article.redirect_to) continue;
    const target=articles.get(article.redirect_to),url=base+articlePath(article);
    assets.set('articles/'+article.id+'/index.html',Buffer.from('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escape(target.title)+'</title><meta name="robots" content="noindex"><link rel="canonical" href="'+escape(url)+'"><meta http-equiv="refresh" content="0;url=../../'+escape(articlePath(article))+'"></head><body><p>'+link('../../'+articlePath(article),target.title)+'</p></body></html>'));
  }
  const alpha = (a,b)=>a.title.localeCompare(b.title,'en');
  const entriesByKind = (kind,title)=>list(title,pages.filter(p=>p.kind===kind).sort(alpha).map(p=>link(p.path,p.title)));
  const directoryQuests = [];
  for (const [game,adventure] of Object.entries(adventures)) {
    const quests = [...articles.values()].filter(row=>(row.game===game || row.game==='both') && row.quest_group);
    const groups = db.DQMWalkthrough.questPurposes.map(purpose=>{
      const ordered = quests.filter(row=>purpose.groups.includes(row.quest_group)).sort((a,b)=>a.quest_order-b.quest_order);
      if (!ordered.length) return '';
      return '<h3>'+escape(purpose.label)+'</h3><ul>'+ordered.map(row=>'<li>'+articleLink(row.id)+'</li>').join('')+'</ul>';
    });
    directoryQuests.push('<section id="quests-'+game+'"><h2>'+escape(adventure)+' quests</h2>'+
      link(db.DQMWalkthrough.paths[game],adventure+' walkthrough')+groups.join('')+'</section>');
  }
  let locationCampaign=0;
  const locations=db.DQMLocations.render('',{byId:articles,routes:db.FIELD_ROUTES.routes,escape,entryLink:linkArticle,
    mapLink:id=>mapLink(maps.get(id)),hidden:()=>false,adventures}).replace(/<section class="campaign-places">/g,
      ()=>'<section class="campaign-places" id="locations-'+['dqm1','dqm2'][locationCampaign++]+'">');
  const topics = {npc:'Characters', boss:'Bosses', mechanic:'Mechanics', item:'Items'};
  const topicLists = Object.entries(topics).map(([kind,title]) => {
    const members = [...articles.values()].filter(row=>!row.redirect_to && (row.kind===kind || (kind==='item' && row.kind==='tool')));
    if (kind === 'item') return '<section id="items"><h2>Items</h2>'+db.DQMItemIndex.render(members,itemOptions)+'</section>';
    if (kind === 'mechanic') {
      const table = db.DQMMechanicsIndex.render(members,{games:adventures,titleFor:row=>row.title,linkTo:linkArticle,escape});
      return '<section id="mechanics"><h2>Mechanics</h2>'+db.DQMMechanicsIndex.handbook(members,{escape,titleFor:row=>row.title,linkTo:linkArticle,tools:false})+'<details><summary>All articles</summary>'+table+'</details></section>';
    }
    return list(title,members.sort(alpha).map(row=>articleLink(row.id)));
  });
  const skillTable=db.DQMSkillIndex.render(skillRows,{escape,linkTo:(id,title)=>skillLink({id,title})});
  const directory={title:'Guide index',path:'entries/',description:'Browse every guide entry by topic.',
    body:[entriesByKind('walkthroughs','Walkthroughs'),'<section class="place-directory" id="locations"><h2>Locations &amp; maps</h2>'+locations+
      '<details><summary>All maps</summary>'+entriesByKind('places','Maps by name')+'</details></section>',...directoryQuests,...topicLists,entriesByKind('monsters','Monster library'),
      '<section id="skills"><h2>Skills</h2>'+skillTable+'</section>'].join('')};
  assets.set('entries/index.html',Buffer.from(documentFor(directory)));
  assets.set('sitemap.xml',Buffer.from('<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+['','entries/',...pages.map(p=>p.path)].map(path=>'<url><loc>'+base+path+'</loc></url>').join('')+'</urlset>'));

  return assets;
}
module.exports={addEntryPages};
