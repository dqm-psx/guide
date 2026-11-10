/* Player-facing articles and local search. URL parameters preserve a directory
   when opening an article, including after reloading or sharing its link. */
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const categories = DQMGuideShell.categories;
  const world = WORLD_GUIDE.entries, field = FIELD_GUIDE.entries;
  const campaigns = Object.fromEntries(['terry','cobi','tara'].map(key=>[key,world.find(r=>r.id==='npc-'+key).title]));
  const games = {dqm1:campaigns.terry, dqm2:campaigns.cobi+' & '+campaigns.tara, both:'Both games', system:'PSX skill'};
  const skills = new Map();
  for (const [nativeId, name] of Object.entries(FIELD_GUIDE.skill_names)) {
    const effect = SKILL_DESCRIPTIONS[nativeId];
    const id = 'skill-' + name.id;
    skills.set(id, {id, kind:'skill', title:name.title, nativeId:Number(nativeId), game:'system',
      summary:name.description || effect.description, effect, aliases:name.aliases, names:name.names,
      source_ids:[name.id,effect.description_source_id].filter(Boolean), learners:{terry:[],cobi:[],tara:[]}});
  }
  for (const monster of GUIDE_REFERENCE.species) {
    for (const [campaign,list] of Object.entries(monster.skills)) {
      for (const skill of list) {
        const id = 'skill-' + skill.system_entry_id;
        const row=skills.get(id);
        if (row.learners[campaign] && !row.learners[campaign].includes(monster.index)) row.learners[campaign].push(monster.index);
      }
    }
  }
  for (const row of skills.values()) {
    const dqm2 = row.learners.cobi.length || row.learners.tara.length;
    row.game = row.learners.terry.length ? (dqm2 ? 'both' : 'dqm1') : (dqm2 ? 'dqm2' : 'system');
  }
  const sortedSkills = Array.from(skills.values()).sort((a,b)=>a.title.localeCompare(b.title));
  const rows = [...world, ...field, ...sortedSkills];
  const byId = new Map(rows.map(row => [row.id, row]));
  const pageSize = 24;
  const spoilerKey = 'dqm-guide-story-spoilers';
  let reveal = true;
  try { reveal = localStorage.getItem(spoilerKey) !== 'hide'; } catch {}
  const individuallyRevealed = new Set();
  function params() {
    const query = new URLSearchParams((window.DQMEntryHash?.() || location.hash).split('?')[1] || '');
    if (query.get('kind') === 'mechanic') query.set('kind','article');
    return query;
  }
  function route(p) { const query = p.toString(); return '#guide' + (query ? '?' + query : ''); }
  function change(p, key, value) { if (value) p.set(key, value); else p.delete(key); }
  function linked(p, changes) {
    const next = new URLSearchParams(p);
    for (const [key, value] of Object.entries(changes)) change(next, key, value);
    return safe(route(next));
  }
  function normalized(value) { return String(value ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, ''); }
  const searchIndex = new Map(rows.map(row => [row.id, normalized([row.title, row.region, row.summary, row.category,row.effect?.target,
    ...(row.requested_species || []).map(id => GUIDE_REFERENCE.species[id].display_name),
    ...(row.nickname_rows || []).flatMap(name => name.aliases), ...(row.default_nicknames || []).flatMap(name => name.aliases),
    ...(row.sections || []).flatMap(section=>[section.title,section.intro,...(section.rows || []).flat()]),
    ...(row.details || []), ...(row.aliases || []), ...(row.places || []), ...(row.prices || []).flatMap(price=>price.locations)].join(' '))]));
  const monsters = GUIDE_REFERENCE.species.filter(row => row.current_name && (row.system_entry_id || row.playable)).map(row => ({
    id: 'monster-' + row.index, index: row.index, kind: 'monster', game: 'both', title: row.display_name,
    summary: row.family_display || 'Monster profile', aliases:[row.short_name,row.japanese,...(row.aliases || [])].filter(Boolean),
    text: normalized([row.display_name, row.short_name, row.japanese, ...(row.aliases || [])].join(' '))
  }));
  const chapterNumbers = new Map();
  for (const game of ['dqm1', 'dqm2']) rows.filter(r => r.kind === 'story' && r.game === game)
    .forEach((r, index) => chapterNumbers.set(r.id, index + 1));
  function guarded(row) { return !reveal && !individuallyRevealed.has(row.id) && (row.spoiler === 'ending' || row.spoiler === 'story'); }
  function safeTitle(row) {
    if (!guarded(row)) return row.title;
    if (chapterNumbers.has(row.id)) return 'Chapter ' + (row.order || chapterNumbers.get(row.id));
    if (row.kind === 'boss' && row.spoiler !== 'ending') return (row.places?.[0] || row.region || 'Field') + ' · boss encounter';
    if (row.kind === 'quest' && row.spoiler !== 'ending' && row.region) return row.region + ' · quest';
    return (row.kind === 'boss' ? 'Boss encounter' : row.kind === 'quest' ? 'Quest' : categories[row.kind] || 'Entry') + ' · spoiler hidden';
  }
  function otherNames(row) {
    if (!row.names) return '';
    const {japanese, current, short, editions} = row.names;
    const labels = {gameboy:'Game Boy-style patch', delocalized:'Delocalized patch', vibecoded:'Vibecoded patch'};
    const lines = [['Current menu', short !== current ? short : ''], ['Japanese', row.kind === 'skill' ? '' : japanese]].filter(([,v]) => v);
    const variants = new Map();
    for (const [edition, value] of Object.entries(editions || {})) {
      if (value.full === current && value.short === short) continue;
      const form = [value.full, value.short !== value.full && value.short ? value.short + ' (menu)' : ''].filter(Boolean).join(' · ');
      if (form) {
        if (!variants.has(form)) variants.set(form, []);
        variants.get(form).push(labels[edition] || edition);
      }
    }
    for (const [form, editions] of variants) lines.push([editions.join(' / '), form]);
    if (!lines.length) return '';
    return '<details class="item-names"><summary>Other names</summary><dl>' + lines.map(([k,v]) =>
      '<div><dt>' + safe(k) + '</dt><dd>' + safe(v) + '</dd></div>').join('') + '</dl></details>';
  }
  function learnerLists(row) {
    const groups = new Map();
    for (const [campaign, ids] of Object.entries(row.learners)) {
      if (!ids.length) continue;
      const key = ids.join(',');
      if (!groups.has(key)) groups.set(key, {ids, campaigns:[]});
      groups.get(key).campaigns.push(campaign);
    }
    if (!groups.size) return '<p class="hint">No monster lists this as a natural skill.</p>';
    return Array.from(groups.values()).map((group, index) => {
      const label = group.campaigns.map(key=>campaigns[key]).join(' · ');
      const learners = group.ids.map(id=>GUIDE_REFERENCE.species[id]).sort((a,b)=>a.display_name.localeCompare(b.display_name));
      return '<details class="skill-campaign"' + (index === 0 ? ' open' : '') + '><summary>' + safe(label) + ' · ' +
        learners.length + ' species</summary><ul class="skill-learner-list">' + learners.map(monster =>
        '<li>'+spriteLabel(monster.index,monster.display_name)+'</li>').join('') + '</ul></details>';
    }).join('');
  }
  function skillProfile(row,p) {
    const skillLink = nativeId => {
      const skill=FIELD_GUIDE.skill_names[nativeId];
      return '<a href="'+linked(p,{entry:'skill-'+skill.id})+'">'+safe(skill.title)+'</a>';
    };
    const ordinal=sortedSkills.indexOf(row);
    const adjacent=(r,direction)=>r ? '<a href="'+linked(p,{entry:r.id})+'" aria-label="'+direction+' skill: '+safe(r.title)+'">'+
      (direction==='Previous' ? '← ' : '')+safe(r.title)+(direction==='Next' ? ' →' : '')+'</a>' : '';
    const kind=p.get('kind') || (p.has('q') ? '' : 'skill');
    const back=p.has('q') ? 'Search results' : categories[kind] || 'Skills';
    const trail='<div class="monster-breadcrumb"><a href="'+linked(p,{entry:'',kind})+'">← '+safe(back)+'</a><nav aria-label="Adjacent skills">'+
      adjacent(sortedSkills[ordinal-1],'Previous')+adjacent(sortedSkills[ordinal+1],'Next')+'</nav></div>';
    const facts=[['MP cost',row.effect.mpCost],['Target',row.effect.target]].filter(([,v])=>v!=null);
    const header='<header class="monster-profile-header skill-profile-header"><div class="monster-profile-identity">'+
      '<h2 id="article-title" tabindex="-1">'+safe(row.title)+'</h2>'+
      (row.names?.japanese ? '<p class="monster-japanese" lang="ja">'+safe(row.names.japanese)+'</p>' : '')+otherNames(row)+'</div>'+
      '<dl class="skill-facts skill-combat-facts">'+facts.map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+safe(value)+'</dd></div>').join('')+'</dl></header>'+
      '<div class="monster-library-quote"><p class="article-lead">'+safe(row.summary)+'</p></div>';
    const labels={level:'Level',hp:'HP',mp:'MP',attack:'Attack',defense:'Defense',agility:'Agility',intelligence:'Intelligence'};
    const stats=Object.entries(FIELD_GUIDE.skill_requirements?.[row.nativeId] || {}).filter(([,value])=>value>0);
    const requirements=stats.length ? '<section class="monster-card learning skill-thresholds"><div class="monster-card-heading"><h3>Minimum learning stats</h3></div><dl>'+
      stats.map(([key,n])=>'<div><dt>'+safe(labels[key] || key)+'</dt><dd>'+safe(n)+'</dd></div>').join('')+'</dl></section>' : '';
    const progression=[];
    if (row.effect.upgradesFrom) progression.push(['Upgrades from',skillLink(row.effect.upgradesFrom)]);
    const next=sortedSkills.filter(skill=>skill.effect.upgradesFrom===row.nativeId);
    if (next.length) progression.push(['Upgrades to',next.map(skill=>skillLink(skill.nativeId)).join(' · ')]);
    if (row.effect.combination?.length) progression.push(['Requires skills',row.effect.combination.map(skillLink).join(' + ')]);
    const combinations=sortedSkills.filter(skill=>skill.effect.combination?.includes(row.nativeId));
    if (combinations.length) progression.push(['Used in combinations',combinations.map(skill=>skillLink(skill.nativeId)).join(' · ')]);
    const related=progression.length ? '<section class="monster-card skill-progression"><div class="monster-card-heading"><h3>Related skills</h3></div><dl class="skill-facts">'+
      progression.map(([label,value])=>'<div><dt>'+label+'</dt><dd>'+value+'</dd></div>').join('')+'</dl></section>' : '';
    return trail+header+'<div class="monster-profile-grid skill-profile-grid"><div class="skill-learning-column">'+requirements+related+'</div>'+
      '<section class="monster-card skill-learners"><div class="monster-card-heading"><h3>Natural learners</h3></div>'+learnerLists(row)+'</section></div>';
  }
  function artwork(row, thumbnail) {
    if (row.kind === 'boss') {
      const party = Object.values(FIELD_ROUTES.routes[row.id]?.fights || {}).flat();
      const species = new Set(row.species_ids?.length ? row.species_ids : party.map(enemy=>enemy.species));
      if (species.size === 1) return spriteGraphic([...species][0],'portrait','boss-art');
    }
    const npc = NPC_SPRITES[row.id];
    if (npc?.species != null) return spriteGraphic(npc.species,'overworld','npc-art');
    const image = npc?.image || row.image;
    if (!image || !/^data:image\/png;base64,/.test(image)) return '';
    const role = npc?.role === 'hero' ? 'Playable hero sprite' : npc?.species != null ? 'Monster species sprite' : 'Character sprite';
    return '<img class="' + (npc ? 'npc-art' : 'item-art') + '" alt="' +
      (!thumbnail && npc ? safe(role+' · '+row.title) : '') + '" src="' + safe(image) + '">';
  }
  function battleMarkup(fights,p) {
    if (!fights) return '';
    const groups=new Map();
    for (const [game,party] of Object.entries(fights)) {
      const key=JSON.stringify(party);
      if (!groups.has(key)) groups.set(key,{party,games:[]});
      groups.get(key).games.push(campaigns[game]);
    }
    const statLabels=['HP','MP','Attack','Defense','Agility','Intelligence'];
    const parties=Array.from(groups.values(),({party,games})=>{
      const members=party.map(enemy=>{
        const species=GUIDE_REFERENCE.species[enemy.species];
        const moves=enemy.skills.map(move=>{
          const skill=FIELD_GUIDE.skill_names[move.id];
          return skill ? '<a href="'+linked(p,{entry:'skill-'+skill.id})+'">'+safe(skill.title)+'</a>' : safe(move.label);
        });
        return '<div class="battle-member"><h4>'+spriteLabel(enemy.species,species.display_name)+' <small>Lv. '+enemy.level+'</small></h4>'+
          '<dl class="battle-stats">'+enemy.stats.map((n,i)=>'<div><dt>'+statLabels[i]+'</dt><dd>'+n+'</dd></div>').join('')+'</dl>'+
          (moves.length ? '<p><strong>Moves</strong> · '+moves.join(' · ')+'</p>' : '')+'</div>';
      }).join('');
      return (groups.size>1 ? '<h4 class="battle-adventure">'+safe(games.join(' & '))+'</h4>' : '')+members;
    }).join('');
    return '<section class="route-section battle-encounter"><h3>Encounter base stats</h3>'+parties+'</section>';
  }
  function routeMarkup(row, data, p) {
    if (!data) return '';
    const article = id => {
      const dest=byId.get(id);
      return dest ? '<a href="'+linked(p,{entry:id})+'">'+safe(safeTitle(dest))+'</a>' : '';
    };
    const stageLinks=(data.stages || []).map(stage=>'<li>'+article(stage.arena)+'<ul>'+stage.gates.map(id=>{
      const boss=FIELD_ROUTES.routes[id].boss;
      return '<li>'+article(id)+(boss ? ' · '+article(boss) : '')+'</li>';
    }).join('')+'</ul></li>').join('');
    const chapters=(data.chapters || []).map(id=>'<li>'+article(id)+'</li>').join('');
    const notes=[];
    if (data.arena) notes.push(['Arena class',article(data.arena)]);
    if (data.boss) notes.push(['Gate boss',article(data.boss)]);
    if (data.gate) notes.push(['Gate',article(data.gate)]);
    if (data.gates) notes.push(['Gates',data.gates.map(article).join(' · ')]);
    if (data.supplies) notes.push(['Items',data.supplies.map(article).join(' · ')]);
    if (data.skills) notes.push(['Skills mentioned',data.skills.map(id=>article('skill-'+FIELD_GUIDE.skill_names[id].id)).join(' · ')]);
    const campaignsForRoute=window.DQMAtlas.routeAreas(data.encounters);
    const tables=campaignsForRoute.map(({campaign,areas})=>{
      const unique=new Map();
      for (const area of areas) unique.set(JSON.stringify([area.title,area.pool.signature]),area.pool.area);
      const rows=[...unique.values()].map(a=>{
        const unlabeled=a.group.pools.length>1 && !a.floors ? ' · Pool '+(a.group.pools.indexOf(a.pool)+1) : '';
        const floor=campaign==='terry' && a.floors ? a.floors : a.title+(a.floors ? ' · '+a.floors : unlabeled);
        return '<tr><th scope="row"><a href="#atlas?tab=encounters&amp;area='+safe(a.id)+'">'+safe(floor)+'</a></th><td>'+
          [...a.roster].map(([id,levels])=>'<span><a href="#monster?id='+id+'">'+safe(GUIDE_REFERENCE.species[id].display_name)+'</a> <small>Lv. '+
          [...levels].sort((a,b)=>a-b).join(', ')+'</small></span>').join(' · ')+'</td></tr>';
      }).join('');
      const table='<table class="route-roster"><thead><tr><th>Area / floors</th><th>Wild monsters</th></tr></thead><tbody>'+rows+'</tbody></table>';
      if (campaignsForRoute.length===1 && unique.size<=8) return table;
      return '<details class="route-campaign"><summary>'+safe(campaigns[campaign])+' · '+unique.size+' encounter pools</summary>'+table+'</details>';
    }).join('');
    return (stageLinks ? '<section class="route-section"><h3>Arena and gate order</h3><ol>'+stageLinks+'</ol></section>' : '')+
      (chapters ? '<section class="route-section"><h3>Walkthrough</h3><ol>'+chapters+'</ol></section>' : '')+
      (notes.length ? '<dl class="skill-facts">'+notes.map(([title,value])=>'<div><dt>'+title+'</dt><dd>'+value+'</dd></div>').join('')+'</dl>' : '')+
      battleMarkup(data.fights,p)+(tables ? '<section class="route-section"><h3>Wild encounters</h3>'+tables+'</section>' : '');
  }
  function linkedProse(line, row, data, p, used) {
    const terms=new Map();
    const fold=label=>label.toLowerCase().replace(/[’‘]/g,"'");
    function add(label,href,id) {
      if (label?.length>=3 && !terms.has(fold(label))) terms.set(fold(label),{href,id});
    }
    const destinations=[...(row.related || []),...(data?.supplies || []),data?.gate,data?.boss,
      ...(data?.skills || []).map(id=>'skill-'+FIELD_GUIDE.skill_names[id].id)];
    for (const id of destinations) {
      const dest=byId.get(id);
      if (!dest || guarded(dest)) continue;
      for (const name of [dest.title,...(dest.aliases || [])]) add(name,linked(p,{entry:dest.id}),dest.id);
    }
    for (const map of window.DQMAtlas.placesForMaps([...(row.map_ids || []),...(data?.maps || [])])) {
      add(map.title,'#atlas?map='+safe(map.id));
    }
    if (!terms.size) return safe(line);
    const pattern=[...terms.keys()].sort((a,b)=>b.length-a.length)
      .map(name=>name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replaceAll("'","['’‘]")).join('|');
    const rx=new RegExp('(?<![\\p{L}\\p{N}])(?:'+pattern+')(?![\\p{L}\\p{N}])','giu');
    let text='',start=0;
    for (const m of line.matchAll(rx)) {
      const {href,id}=terms.get(fold(m[0]));
      if (id && used) used.add(id);
      text+=safe(line.slice(start,m.index))+'<a href="'+href+'">'+safe(m[0])+'</a>';
      start=m.index+m[0].length;
    }
    return text+safe(line.slice(start));
  }
  function walkthroughPath(p) {
    const game = DQMWalkthrough.gameFor(p,byId);
    return game ? DQMWalkthrough.paths[game]+(p.has('entry') ? '#'+p.get('entry') : '') : '';
  }
  function renderWalkthrough(game,p) {
    const article = el('guide-article');
    article.classList.remove('skill-profile');
    const heading = games[game]+' walkthrough';
    const sectionParams = new URLSearchParams({kind:'story',game});
    const entryLink = (id,label) => {
      const dest = byId.get(id);
      return dest ? '<a href="'+linked(p,{entry:id})+'">'+safe(label || safeTitle(dest))+'</a>' : '';
    };
    const walk = DQMWalkthrough.render(game,{
      byId, routes:FIELD_ROUTES.routes, escape:safe, title:safeTitle, hidden:guarded,
      campaignLink:(key,current) => '<a href="'+linked(sectionParams,{game:key})+'"'+
        (current ? ' aria-current="page"' : '')+'>'+safe(games[key])+'</a>',
      sectionLink:(row,label) => '<a href="'+linked(sectionParams,{entry:row.id})+'">'+safe(label)+'</a>',
      entryLink, prose:(line,row,data,used) => linkedProse(line,row,data,p,used),
      places:id => entryLink(id,'Locations and encounters')
    });
    const back = p.has('q') ? linked(p,{entry:''}) : '#guide';
    article.innerHTML = '<a class="guide-back" href="'+back+'">'+(p.has('q') ? 'Back to results' : 'Guide home')+'</a>'+
      '<h2 id="article-title" tabindex="-1">'+safe(heading)+'</h2>'+walk;
    for (const button of article.querySelectorAll('[data-reveal-stage]')) button.onclick = () => {
      const id = button.dataset.revealStage;
      individuallyRevealed.add(id);
      renderWalkthrough(game,p);
      el(id).focus();
    };
    return heading;
  }
  function renderArticle(row, p) {
    const article = el('guide-article');
    article.classList.toggle('skill-profile',row?.kind === 'skill');
    if (row?.kind === 'skill') {
      article.innerHTML=skillProfile(row,p);
      return row.title;
    }
    const backKind = p.get('kind') || (!p.has('q') && row?.kind) || '';
    const backLabel = p.has('q') ? 'Search results' : categories[backKind] || 'Guide home';
    const back = '<a class="guide-back" href="' + linked(p, {entry:'',kind:backKind}) + '">← ' + safe(backLabel) + '</a>';
    if (!row) {
      article.innerHTML = back + '<h2 tabindex="-1" id="article-title">Entry unavailable</h2><p>This link does not identify an entry in this edition.</p>';
      return 'Entry unavailable';
    }
    const title = safeTitle(row);
    let body = '';
    if (guarded(row)) {
      body = '<p>This entry includes ' + (row.spoiler === 'ending' ? 'ending' : 'story') + ' spoilers.</p><button class="guide-action" type="button" id="guide-reveal">Reveal this entry</button>';
    } else {
      const routeData=FIELD_ROUTES.routes[row.id];
      const direct=new Set([routeData?.boss,routeData?.arena,routeData?.gate,...(routeData?.gates || []),...(routeData?.chapters || []),
        ...(routeData?.stages || []).flatMap(stage=>[stage.arena,...stage.gates,...stage.gates.map(id=>FIELD_ROUTES.routes[id].boss)])]);
      const characterQuests = row.kind === 'npc' ? world.filter(quest => quest.kind === 'quest' &&
        (quest.related?.includes(row.id) || row.related?.includes(quest.id))) : [];
      for (const quest of characterQuests) direct.add(quest.id);
      const questLinks = characterQuests.map(quest =>
        '<a href="' + linked(p,{kind:'quest',entry:quest.id}) + '">' + safe(safeTitle(quest)) + '</a>');
      const related = (row.related || []).filter(id=>!direct.has(id)).map(id => byId.get(id)).filter(Boolean);
      const profileLinks = (row.species_ids || []).map(id => GUIDE_REFERENCE.species[id]).filter(Boolean);
      const mapLinks = window.DQMAtlas.placesForMaps([...(row.map_ids || []),...(routeData?.maps || [])]);
      const linkedNames = new Set(mapLinks.map(m => normalized(m.title)));
      const otherPlaces = (row.places || []).filter(name => !linkedNames.has(normalized(name)));
      const prices = (row.prices || []).map(price=>'<tr><th scope="row">'+safe(games[price.game])+'</th><td>'+safe(price.locations.join(' · '))+
        '</td><td>'+safe(price.buy)+' G</td><td>'+safe(price.gold_pass)+' G</td></tr>').join('');
      const details=(row.details || []).filter(line=>!(prices && /shops sell it for \d+ G/i.test(line)) && !(routeData?.gate && /^Encounter: /u.test(line)));
      const stepsTag = row.kind === 'quest' ? 'ol' : 'ul';
      body = artwork(row, false) +
        '<p class="article-lead">' + linkedProse(row.summary,row,routeData,p) + '</p>' +
        DQMArticleSections(row,safe,line=>linkedProse(line,row,routeData,p),3,p.get('game')) +
        DQMNicknameMarkup(row,safe,id => '<a href="'+linked(p,{entry:id})+'">'+safe(safeTitle(byId.get(id)))+'</a>') +
        (details.length ? '<'+stepsTag+' class="article-steps">' + details.map(line => '<li>' + linkedProse(line,row,routeData,p) + '</li>').join('') + '</'+stepsTag+'>' : '') +
        (row.arena_classes ? '<section class="route-section"><h3>Arena classes</h3><ul class="quest-ranks">' + row.arena_classes.map(id =>
          '<li><a href="'+linked(p,{entry:id})+'">'+safe(safeTitle(byId.get(id)))+'</a></li>').join('') + '</ul></section>' : '') +
        (row.requested_species ? '<section class="route-section"><h3>Monsters in request order</h3><ol class="quest-species">' + row.requested_species.map(id =>
          '<li><a href="#monster?id='+id+'">'+safe(GUIDE_REFERENCE.species[id].display_name)+'</a></li>').join('') + '</ol></section>' : '') +
        routeMarkup(row,routeData,p) +
        (row.kind === 'npc' ? DQMCharacterDialogue.markup(row,safe,questLinks,!reveal) : '') +
        (prices ? '<div class="guide-stock"><table><caption>Recorded shop prices</caption><thead><tr><th>Adventure</th><th>Merchant location</th><th>Buy</th><th>Gold Pass</th></tr></thead><tbody>'+prices+'</tbody></table></div>' : '') + otherNames(row) +
        (otherPlaces.length ? '<p><strong>Places</strong> · ' + otherPlaces.map(safe).join(' · ') + '</p>' : '') +
        (mapLinks.length ? '<div class="article-related"><h3>On the map</h3>'+mapLinks.map(m=>'<a href="#atlas?map='+safe(m.id)+'">'+safe(m.title)+'</a>').join('')+'</div>' : '') +
        (profileLinks.length || related.length ? '<div class="article-related"><h3>Related entries</h3>' +
          related.map(r => '<a href="' + linked(p, {entry:r.id}) + '">' + safe(safeTitle(r)) + '</a>').join('') +
          profileLinks.map(m => '<a href="#monster?id=' + m.index + '">' + safe(m.display_name) + '</a>').join('') + '</div>' : '');
    }
    const context = [games[row.game] && !['both','system'].includes(row.game) ? games[row.game] : '',
      row.kind === 'story' && !guarded(row) ? 'Chapter ' + row.order : ''].filter(Boolean).join(' · ');
    article.innerHTML = back + (context ? '<div class="guide-context">' + safe(context) + '</div>' : '') +
      '<h2 id="article-title" tabindex="-1">' + safe(title) + '</h2>' + body;
    el('guide-reveal')?.addEventListener('click', () => { individuallyRevealed.add(row.id); renderArticle(row,p); el('article-title').focus(); });
    return title;
  }
  const actions = [
    {id:'action-pair',kind:'tool',game:'both',title:'Find a pairing',href:'#pair-finder',
      summary:'Choose two parents to see their offspring.', aliases:['how to breed','breed monsters','pair monsters','breeding calculator']},
    {id:'action-parents',kind:'tool',game:'both',title:'Find parents',href:'#offspring-finder',
      summary:'Choose an offspring to find its parent combinations.', aliases:['how to make a monster','parents for','offspring']},
    {id:'action-tree',kind:'tool',game:'both',title:'Breeding tree',href:'#breeding-tree',
      summary:'Plan the parents and grandparents of a target monster.', aliases:['breeding plan','breeding tree','plan a team']},
  ];
  const searchNames = new Map([...rows,...monsters,...actions].map(row => {
    const labels=(row.sections || []).flatMap(section=>(section.rows || []).map(([label])=>label));
    return [row.id,Array.from(new Set([row.title,...(row.aliases || []),...labels].filter(Boolean).map(normalized)))];
  }));

  // A one-letter difference in a short name can change the subject (bard/bird).
  function closeWord(a,b) {
    if (a===b) return true;
    if (a.length<5 || Math.abs(a.length-b.length)>1) return false;
    let i=0;
    while (i<a.length && a[i]===b[i]) i++;
    if (a.length<b.length) return a.slice(i)===b.slice(i+1);
    if (a.length>b.length) return a.slice(i+1)===b.slice(i);
    return a.slice(i+1)===b.slice(i+1) ||
      (a[i]===b[i+1] && a[i+1]===b[i] && a.slice(i+2)===b.slice(i+2));
  }
  function searchMatches(pool, query, buying) {
    const words=query.split(/\s+/).filter(Boolean);
    const candidates=buying ? pool.filter(r=>r.prices?.length) : pool;
    const scored=[];
    for (const r of candidates) {
      const forms=searchNames.get(r.id) || [];
      const text=r.text || searchIndex.get(r.id) || normalized([r.title,r.summary,...forms].join(' '));
      let score;
      if (!words.length || forms.includes(query)) score=0;
      else if (forms.some(name=>name.startsWith(query))) score=1;
      else if (forms.some(name=>name.includes(query))) score=2;
      else if (words.every(w=>text.includes(w))) score=4;
      else continue;
      scored.push({r,score});
    }
    if (scored.length) return scored.sort((a,b)=>a.score-b.score).map(item=>item.r);
    if (!words.some(word=>word.length>=5)) return [];
    const corrections=[], related=[];
    for (const row of candidates) {
      const forms=searchNames.get(row.id);
      if (forms.some(name=>closeWord(query,name))) corrections.push(row);
      else if (forms.some(name=>{
        const tokens=name.split(/[^\p{L}\p{N}]+/u);
        return words.every(w=>tokens.some(t=>t.startsWith(w) || closeWord(w,t)));
      })) related.push(row);
    }
    return corrections.concat(related);
  }
  function matchingSectionRow(row,query,game) {
    if (!query || !row.sections) return;
    const sections=row.sections.filter(section=>!game || !section.game || section.game===game);
    const entries=sections.flatMap(section=>(section.rows || []).map(([label,detail])=>({section:section.title,label,detail})));
    const byLabel=entries.find(entry=>normalized(entry.label)===query);
    if (byLabel) return byLabel;
    if (normalized([row.title,row.summary].join(' ')).includes(query)) return;
    const words=query.split(/\s+/);
    return entries.find(({section,label,detail})=>{
      const text=normalized([section,label,detail].join(' '));
      return words.every(word=>text.includes(word));
    });
  }
  function questDirectory(p, quests) {
    const sections = [];
    for (const game of ['dqm1','dqm2']) {
      const campaign = quests.filter(row => row.game === game && row.quest_group);
      if (!campaign.length) continue;
      const groups = [];
      for (const group of ['Story quests','Hidden gates and favors','Optional quests','Postgame']) {
        const members = campaign.filter(row => row.quest_group === group).sort((a,b) => a.quest_order-b.quest_order);
        if (!members.length) continue;
        const items = members.map(row => {
          const place = game === 'dqm2' && !guarded(row) ? '<small>'+safe(row.region)+'</small>' : '';
          return '<li><a href="'+linked(p,{entry:row.id,page:''})+'">'+safe(safeTitle(row))+place+'</a></li>';
        });
        groups.push('<h4>'+safe(group)+'</h4><ul>'+items.join('')+'</ul>');
      }
      sections.push('<section><h3>'+safe(games[game])+'</h3>'+groups.join('')+'</section>');
    }
    el('guide-directory').innerHTML = '<div class="directory-head"><div><a href="#guide">Guide home</a>' +
      '<h2 id="directory-title" tabindex="-1">Quests</h2></div></div><div class="quest-directory">' +
      (sections.join('') || '<p>No matching quests</p>') + '</div>';
    return 'Quests';
  }
  function characterDirectory(p, characters) {
    const regions = new Map();
    for (const row of characters) {
      const region = row.game === 'both' ? 'Both adventures' : row.region || games[row.game];
      if (!regions.has(region)) regions.set(region, []);
      regions.get(region).push(row);
    }
    const sections = Array.from(regions, ([region, members]) => {
      members.sort((a,b) => safeTitle(a).localeCompare(safeTitle(b)));
      const items = members.map(row => '<li><a href="'+linked(p,{entry:row.id,page:''})+'">'+
        (guarded(row) ? '' : artwork(row,true))+safe(safeTitle(row))+'</a></li>');
      return '<section><h3>'+safe(region)+'</h3><ul>'+items.join('')+'</ul></section>';
    });
    el('guide-directory').innerHTML = '<div class="directory-head"><div><a href="#guide">Guide home</a>'+
      '<h2 id="directory-title" tabindex="-1">Characters</h2></div></div><div class="character-directory">'+sections.join('')+'</div>';
    return 'Characters';
  }
  function gameplayDirectory(p, articles) {
    const title = categories.article;
    const container = el('guide-directory');
    const query = p.get('q');
    const matches = query?.trim() ? searchMatches(articles,normalized(query).trim(),false) : articles;
    const table = matches.length ? DQMArticleIndex.render(matches, {
      games, titleFor:safeTitle, escape:safe,
      linkTo:(id,label) => '<a href="'+linked(p,{entry:id,page:''})+'">'+safe(label)+'</a>'
    }) : '<p role="status">No matching articles</p>';
    const retry = !matches.length && query ? '<a href="'+linked(p,{kind:'',game:'',sort:'',page:''})+'">Search all topics for “'+safe(query)+'”</a>' : '';
    container.innerHTML = '<div class="directory-head"><div><a href="#guide">Guide home</a>'+
      '<h2 id="directory-title" tabindex="-1">'+safe(title)+'</h2></div></div>'+table+retry;
    if (matches.length) {
      const index = container.querySelector('.article-index');
      DQMArticleIndex.enableSorting(index, p.get('sort'), order => {
        change(p,'sort',order === 'title' ? '' : order);
        history.replaceState(null,'',route(p));
        const destination = new URLSearchParams(p);
        for (const row of index.tBodies[0].rows) {
          destination.set('entry',row.dataset.entry);
          row.querySelector('a').setAttribute('href',route(destination));
        }
      });
    }
    return title;
  }
  function directory(p) {
    const kind = p.get('kind'), game = p.get('game'), q = normalized(p.get('q')).trim();
    const pool = q && !kind ? rows.concat(monsters,actions) : rows;
    const filtered = pool.filter(r => (!kind || kind === r.kind) && (!game || r.game === 'both' || r.game === game));
    if (kind === 'article') return gameplayDirectory(p,filtered);
    if (kind === 'location' && !q) {
      const places = DQMLocations.render(game,{byId,routes:FIELD_ROUTES.routes,escape:safe,hidden:guarded,adventures:games,
        entryLink:(id,label)=>'<a href="'+linked(p,{entry:id,page:''})+'">'+safe(label || safeTitle(byId.get(id)))+'</a>',
        mapLink:id=>{
          const [map]=window.DQMAtlas.placesForMaps([id]);
          return '<a href="#atlas?map='+safe(id)+'">'+safe(map.title)+'</a>';
        }
      });
      const title=game==='dqm1' ? games.dqm1+'’s gates' : game==='dqm2' ? games.dqm2+'’s worlds' : 'Gates and worlds';
      el('guide-directory').innerHTML='<div class="directory-head"><div><a href="#guide">Guide home</a>'+
        '<h2 id="directory-title" tabindex="-1">'+safe(title)+'</h2></div></div><div class="place-directory">'+(places || '<p>No matching locations</p>')+'</div>';
      return title;
    }
    if (kind === 'quest' && !q) return questDirectory(p,filtered);
    if (kind === 'npc' && !q) return characterDirectory(p,filtered);
    const buying = /^(?:(?:where|how) (?:can i |to )?)?(buy|purchase|shop for)\b\s*/u;
    const shopQuery = buying.test(q);
    const hunt = !kind && q.match(/^(?:where (?:can i |do i |to ))?(?:catch|recruit|find) (?:an? |the )?(.+?)(?: (?:as|for|in) (terry|cobi|tara)(?:s adventure)?)?\??$/u);
    const speciesMatches = hunt ? searchMatches(monsters,hunt[1],false) : [];
    const matches = speciesMatches.length ? speciesMatches : q ? searchMatches(filtered,q.replace(buying,'').replace(/^(an?|the)\s+/u,''),shopQuery) : filtered;
    const pages = Math.max(1, Math.ceil(matches.length / pageSize));
    const page = Math.min(pages, Math.max(1, parseInt(p.get('page'),10) || 1));
    const heading = [game && games[game], categories[kind] || (q ? 'Search results' : 'Reference')].filter(Boolean).join(' · ');
    const body = matches.slice((page-1)*pageSize,page*pageSize).map(r => {
      const hidden = guarded(r);
      let href = r.href || (r.kind === 'monster' ? '#monster?id=' + r.index : linked(p, {entry:r.id}));
      const thumb = hidden ? '' : artwork(r, true);
      const match = hidden ? null : matchingSectionRow(r,q,game);
      const context = [!game && ['dqm1','dqm2'].includes(r.game) ? games[r.game] : '',
        !kind ? categories[r.kind] : '', match?.section, r.kind === 'story' && !hidden ? 'Chapter ' + r.order : ''].filter(Boolean).join(' · ');
      let summary=shopQuery && r.prices?.length ? r.prices[0].locations[0]+' · '+r.prices[0].buy+' G' : r.summary;
      if (match) summary=match.label+' · '+match.detail;
      if (speciesMatches.length) {
        const locations = GUIDE_REFERENCE.species[r.index].locations.filter(loc=>loc.kind==='wild' &&
          (!hunt[2] || loc.game===hunt[2]) && (!game || (loc.game==='terry' ? 'dqm1' : 'dqm2')===game));
        if (locations.length) {
          const first = locations[0];
          const params = new URLSearchParams({tab:'encounters',q:r.title,game:first.game,area:first.game+'-'+first.context_id});
          href = safe('#atlas?'+params);
          summary = [campaigns[first.game],first.name,first.floors,'Lv. '+first.levels.join(', ')].filter(Boolean).join(' · ');
        } else summary = 'No wild location recorded for this search. See breeding and other encounters.';
      }
      return '<a class="guide-row" href="' + href + '">' + thumb + '<span>' + (context ? '<small>' + safe(context) + '</small>' : '') +
        '<strong>' + safe(safeTitle(r)) + '</strong>' + (!hidden && summary ? '<span'+(match ? ' class="guide-search-excerpt"' : '')+'>' + safe(summary) + '</span>' : '') + '</span></a>';
    }).join('');
    el('guide-directory').innerHTML = '<div class="directory-head"><div><a href="#guide">Guide home</a><h2 id="directory-title" tabindex="-1">' + safe(heading) +
      '</h2></div></div>' +
      '<p class="guide-count" role="status">' + (matches.length ? matches.length + (matches.length === 1 ? ' entry' : ' entries') : 'No matching entries') + (pages > 1 ? ' · Page ' + page + ' of ' + pages : '') +
      '</p><div class="directory-grid">' + (body || (q && (kind || game)
        ? '<a href="'+linked(p,{kind:'',game:'',page:''})+'">Search all topics for “'+safe(p.get('q'))+'”</a>'
        : '<a href="#guide">Reset filters</a>')) + '</div>' +
      (pages > 1 ? '<nav class="guide-pager" aria-label="Result pages">' +
        (page>1 ? '<a href="' + linked(p,{page:String(page-1)}) + '">Previous</a>' : '') +
        (page<pages ? '<a href="' + linked(p,{page:String(page+1)}) + '">Next</a>' : '') + '</nav>' : '');
    return heading;
  }
  function show() {
    const p=params(), entry=p.get('entry'), browsing=Boolean(p.get('game') || p.get('kind') || p.get('q'));
    if (!entry && p.get('kind')==='monster') {
      location.replace('#species-index'+(p.get('q') ? '?q='+encodeURIComponent(p.get('q')) : ''));
      return 'Monster library';
    }
    const walkGame = DQMWalkthrough.gameFor(p,byId);
    if (walkGame) {
      el('guide-filters').hidden=true;
      el('guide-browser').hidden=true;
      el('guide-article').hidden=false;
      return renderWalkthrough(walkGame,p);
    }
    el('guide-filters').hidden=Boolean(entry);
    el('guide-browser').hidden=Boolean(entry);
    el('guide-article').hidden=!entry;
    if (entry) return renderArticle(byId.get(entry),p);
    el('guide-article').replaceChildren();
    el('guide-search').value=p.get('q') || '';
    el('guide-kind').value=p.get('kind') || '';
    el('guide-game').value=p.get('game') || '';
    el('guide-home').hidden=browsing;
    el('guide-directory').hidden=!browsing;
    if (browsing) return directory(p);
    el('guide-directory').replaceChildren();
    return 'Guide home';
  }
  function filter(push) {
    const p = new URLSearchParams();
    change(p,'q',el('guide-search').value.trim()); change(p,'game',el('guide-game').value); change(p,'kind',el('guide-kind').value);
    if (p.get('kind') === 'article') change(p,'sort',params().get('sort'));
    if (push && location.hash !== route(p)) { location.hash = route(p); return; }
    if (p.size && (location.hash === '#guide' || !location.hash)) history.pushState(null,'',route(p));
    else history.replaceState(null,'',route(p));
    const value = el('guide-search').value; // Preserve spaces, caret and live typing.
    const pos = el('guide-search').selectionStart;
    document.title = show() + ' · DQM1&2 PSX Player Guide';
    el('guide-search').value = value;
    if (document.activeElement === el('guide-search')) el('guide-search').setSelectionRange(pos,pos);
  }
  el('guide-filters').onsubmit = e => { e.preventDefault(); filter(true); el('directory-title')?.focus(); };
  el('guide-search').oninput = () => filter(false);
  el('guide-kind').onchange = () => filter(true);
  el('guide-game').onchange = () => filter(true);
  function setSpoilers(checked) {
    reveal = checked;
    individuallyRevealed.clear();
    if (!el('guide').hidden) document.title = show() + ' · DQM1&2 PSX Player Guide';
    if (!el('atlas').hidden) window.DQMAtlas?.show();
  }
  window.DQMField = {show, filter, guarded, campaigns, setSpoilers, walkthroughPath, entryForNav: id => byId.get(id)};
})();
