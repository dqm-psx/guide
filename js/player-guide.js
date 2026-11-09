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
      summary:name.description || effect.description, effect, aliases:name.aliases, source_ids:[name.id,effect.description_source_id].filter(Boolean), learners:{terry:[],cobi:[],tara:[]}});
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
  const rows = [...world, ...field, ...Array.from(skills.values()).sort((a,b)=>a.title.localeCompare(b.title))];
  const byId = new Map(rows.map(row => [row.id, row]));
  const pageSize = 24;
  const spoilerKey = 'dqm-guide-story-spoilers';
  let reveal = true;
  try { reveal = localStorage.getItem(spoilerKey) !== 'hide'; } catch {}
  const individuallyRevealed = new Set();
  function params() { return new URLSearchParams((window.DQMEntryHash?.() || location.hash).split('?')[1] || ''); }
  function route(p) { const query = p.toString(); return '#field-guide' + (query ? '?' + query : ''); }
  function change(p, key, value) { if (value) p.set(key, value); else p.delete(key); }
  function linked(p, changes) {
    const next = new URLSearchParams(p);
    for (const [key, value] of Object.entries(changes)) change(next, key, value);
    return safe(route(next));
  }
  function normalized(value) { return String(value ?? '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[’']/g, ''); }
  const searchIndex = new Map(rows.map(row => [row.id, normalized([row.title, row.region, row.summary, row.category,row.effect?.target,
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
  function itemNames(row) {
    if (!row.names || (row.kind !== 'item' && row.kind !== 'tool')) return '';
    const {japanese, current, short, editions} = row.names;
    const labels = {gameboy:'Game Boy-style patch', delocalized:'Delocalized patch', vibecoded:'Vibecoded patch'};
    const lines = [['Current menu', short !== current ? short : ''], ['Japanese', japanese]].filter(([,v]) => v);
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
    if (!row.learners) return '';
    const groups = new Map();
    for (const [campaign, ids] of Object.entries(row.learners)) {
      if (!ids.length) continue;
      const key = ids.join(',');
      if (!groups.has(key)) groups.set(key, {ids, campaigns:[]});
      groups.get(key).campaigns.push(campaign);
    }
    if (!groups.size) return '<p class="hint">No recorded natural learners.</p>';
    return Array.from(groups.values()).map((group, index) => {
      const label = group.campaigns.length === Object.keys(campaigns).length ? 'Natural learners' :
        'Natural learners · ' + group.campaigns.map(key => campaigns[key]).join(' & ');
      return '<details class="skill-campaign"' + (index === 0 ? ' open' : '') + '><summary>' + safe(label) + ' · ' +
        group.ids.length + ' species</summary><div>' + group.ids.map(id => '<a href="#monster?id=' + id + '">' +
        safe(GUIDE_REFERENCE.species[id].display_name) + '</a>').join('') + '</div></details>';
    }).join('');
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
  function linkedProse(line, row, data, p) {
    const terms=new Map();
    const fold=label=>label.toLowerCase().replace(/[’‘]/g,"'");
    function add(label,href) {
      if (label?.length>=3 && !terms.has(fold(label))) terms.set(fold(label),href);
    }
    const destinations=[...(row.related || []),...(data?.supplies || []),data?.gate,data?.boss,
      ...(data?.skills || []).map(id=>'skill-'+FIELD_GUIDE.skill_names[id].id)];
    for (const id of destinations) {
      const dest=byId.get(id);
      if (!dest || guarded(dest)) continue;
      for (const name of [dest.title,...(dest.aliases || [])]) add(name,linked(p,{entry:dest.id}));
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
      text+=safe(line.slice(start,m.index))+'<a href="'+terms.get(fold(m[0]))+'">'+safe(m[0])+'</a>';
      start=m.index+m[0].length;
    }
    return text+safe(line.slice(start));
  }
  function renderArticle(row, p) {
    const article = el('guide-article');
    const back = '<a class="guide-back" href="' + linked(p, {entry:''}) + '">Back to guide</a>';
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
      const related = (row.related || []).filter(id=>!direct.has(id)).map(id => byId.get(id)).filter(Boolean);
      const profileLinks = (row.species_ids || []).map(id => GUIDE_REFERENCE.species[id]).filter(Boolean);
      const mapLinks = window.DQMAtlas.placesForMaps([...(row.map_ids || []),...(routeData?.maps || [])]);
      const linkedNames = new Set(mapLinks.map(m => normalized(m.title)));
      const otherPlaces = (row.places || []).filter(name => !linkedNames.has(normalized(name)));
      const prices = (row.prices || []).map(price=>'<tr><th scope="row">'+safe(games[price.game])+'</th><td>'+safe(price.locations.join(' · '))+
        '</td><td>'+safe(price.buy)+' G</td><td>'+safe(price.gold_pass)+' G</td></tr>').join('');
      const skillFacts = [];
      if (row.effect) {
        if (row.effect.mpCost != null) skillFacts.push(['MP cost',safe(row.effect.mpCost)]);
        if (row.effect.target) skillFacts.push(['Target',safe(row.effect.target)]);
        const previous = FIELD_GUIDE.skill_names[row.effect.upgradesFrom];
        if (previous) skillFacts.push(['Upgrades from','<a href="'+linked(p,{entry:'skill-'+previous.id})+'">'+safe(previous.title)+'</a>']);
        const combination = (row.effect.combination || []).map(id=>FIELD_GUIDE.skill_names[id]).filter(Boolean);
        if (combination.length) skillFacts.push(['Requires skills',combination.map(s=>'<a href="'+linked(p,{entry:'skill-'+s.id})+'">'+safe(s.title)+'</a>').join(' + ')]);
      }
      const facts = skillFacts.length ? '<dl class="skill-facts">'+skillFacts.map(([label,value])=>
        '<div><dt>'+label+'</dt><dd>'+value+'</dd></div>').join('')+'</dl>' : '';
      const stats = row.learners && FIELD_GUIDE.skill_requirements?.[row.nativeId];
      const minimums = Object.entries(stats || {}).filter(([,value])=>value > 0);
      const statLabels = {level:'Level', hp:'HP', mp:'MP', attack:'Attack', defense:'Defense', agility:'Agility', intelligence:'Intelligence'};
      const requirements = minimums.length ? '<div class="learning"><h3>Minimum learning stats</h3><dl>' + minimums.map(([key,value])=>
        '<div><dt>'+safe(statLabels[key] || key)+'</dt><dd>'+safe(value)+'</dd></div>').join('')+'</dl></div>' : '';
      const nextChapter = row.kind === 'story' && world.find(other=>other.kind==='story' && other.game===row.game && other.order===row.order+1);
      const details=(row.details || []).filter(line=>!(prices && /shops sell it for \d+ G/i.test(line)) && !(routeData?.gate && /^Encounter: /u.test(line)));
      body = artwork(row, false) +
        '<p class="article-lead">' + linkedProse(row.summary,row,routeData,p) + '</p>' + facts +
        (details.length ? (row.kind==='story' ? '<ol class="article-steps">' : '<ul class="article-steps">') + details.map(line => '<li>' + linkedProse(line,row,routeData,p) + '</li>').join('') + (row.kind==='story' ? '</ol>' : '</ul>') : '') +
        routeMarkup(row,routeData,p) +
        (prices ? '<div class="guide-stock"><table><caption>Recorded shop prices</caption><thead><tr><th>Adventure</th><th>Merchant location</th><th>Buy</th><th>Gold Pass</th></tr></thead><tbody>'+prices+'</tbody></table></div>' : '') + itemNames(row) + requirements + learnerLists(row) +
        (otherPlaces.length ? '<p><strong>Places</strong> · ' + otherPlaces.map(safe).join(' · ') + '</p>' : '') +
        (mapLinks.length ? '<div class="article-related"><h3>On the map</h3>'+mapLinks.map(m=>'<a href="#atlas?map='+safe(m.id)+'">'+safe(m.title)+'</a>').join('')+'</div>' : '') +
        (profileLinks.length || related.length ? '<div class="article-related"><h3>Related entries</h3>' +
          related.map(r => '<a href="' + linked(p, {entry:r.id}) + '">' + safe(safeTitle(r)) + '</a>').join('') +
          profileLinks.map(m => '<a href="#monster?id=' + m.index + '">' + safe(m.display_name) + '</a>').join('') + '</div>' : '') +
      (nextChapter ? '<p class="next-chapter"><a href="'+linked(p,{entry:nextChapter.id})+'">Next chapter · '+safe(safeTitle(nextChapter))+'</a></p>' : '');
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
  const searchNames = new Map([...rows,...monsters,...actions].map(row => [row.id,
    Array.from(new Set([row.title,...(row.aliases || [])].filter(Boolean).map(normalized)))]));

  // Accept a single missing, extra, substituted or transposed letter in a name.
  // Short prefixes and snippets of body text require exact characters.
  function closeWord(a,b) {
    if (a===b) return true;
    if (a.length<4 || Math.abs(a.length-b.length)>1) return false;
    let i=0;
    while (i<a.length && a[i]===b[i]) i++;
    if (a.length<b.length) return a.slice(i)===b.slice(i+1);
    if (a.length>b.length) return a.slice(i+1)===b.slice(i);
    return a.slice(i+1)===b.slice(i+1) ||
      (a[i]===b[i+1] && a[i+1]===b[i] && a.slice(i+2)===b.slice(i+2));
  }
  function searchMatches(pool, query, buying) {
    const words=query.split(/\s+/).filter(Boolean);
    const scored=[];
    for (const r of pool) {
      if (buying && !r.prices?.length) continue;
      const forms=searchNames.get(r.id) || [];
      const text=r.text || searchIndex.get(r.id) || normalized([r.title,r.summary,...forms].join(' '));
      let score;
      if (!words.length || forms.includes(query)) score=0;
      else if (forms.some(name=>name.startsWith(query))) score=1;
      else if (forms.some(name=>name.includes(query))) score=2;
      else if (words.every(w=>text.includes(w))) score=4;
      else if (forms.some(name=>{
        const tokens=name.split(/[^\p{L}\p{N}]+/u);
        return words.every(w=>tokens.some(t=>t.startsWith(w) || closeWord(w,t)));
      })) score=6;
      else continue;
      scored.push({r,score});
    }
    return scored.sort((a,b)=>a.score-b.score).map(item=>item.r);
  }
  function directory(p) {
    const kind = p.get('kind'), game = p.get('game'), q = normalized(p.get('q')).trim();
    const pool = q && !kind ? rows.concat(monsters,actions) : rows;
    const filtered = pool.filter(r => (!kind || kind === r.kind) && (!game || r.game === 'both' || r.game === game));
    const buying = /^(?:(?:where|how) (?:can i |to )?)?(buy|purchase|shop for)\b\s*/u;
    const shopQuery = buying.test(q);
    const matches = q ? searchMatches(filtered,q.replace(buying,'').replace(/^(an?|the)\s+/u,''),shopQuery) : filtered;
    const pages = Math.max(1, Math.ceil(matches.length / pageSize));
    const page = Math.min(pages, Math.max(1, parseInt(p.get('page'),10) || 1));
    const heading = [game && games[game], categories[kind] || (q ? 'Search results' : 'Reference')].filter(Boolean).join(' · ');
    const body = matches.slice((page-1)*pageSize,page*pageSize).map(r => {
      const hidden = guarded(r);
      const href = r.href || (r.kind === 'monster' ? '#monster?id=' + r.index : linked(p, {entry:r.id}));
      const thumb = hidden ? '' : artwork(r, true);
      const context = [!game && ['dqm1','dqm2'].includes(r.game) ? games[r.game] : '',
        !kind ? categories[r.kind] : '', r.kind === 'story' && !hidden ? 'Chapter ' + r.order : ''].filter(Boolean).join(' · ');
      const summary=shopQuery && r.prices?.length ? r.prices[0].locations[0]+' · '+r.prices[0].buy+' G' : r.summary;
      return '<a class="guide-row" href="' + href + '">' + thumb + '<span>' + (context ? '<small>' + safe(context) + '</small>' : '') +
        '<strong>' + safe(safeTitle(r)) + '</strong>' + (!hidden && summary ? '<span>' + safe(summary) + '</span>' : '') + '</span></a>';
    }).join('');
    el('guide-directory').innerHTML = '<div class="directory-head"><div><a href="#field-guide">Field guide</a><h2 id="directory-title" tabindex="-1">' + safe(heading) +
      '</h2></div></div>' +
      '<p class="guide-count" role="status">' + (matches.length ? matches.length + (matches.length === 1 ? ' entry' : ' entries') : 'No matching entries') + (pages > 1 ? ' · Page ' + page + ' of ' + pages : '') +
      '</p><div class="directory-grid">' + (body || '<a href="#field-guide">Reset filters</a>') + '</div>' +
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
    return 'Field guide';
  }
  function filter(push) {
    const p = new URLSearchParams();
    change(p,'q',el('guide-search').value.trim()); change(p,'game',el('guide-game').value); change(p,'kind',el('guide-kind').value);
    if (push && location.hash !== route(p)) { location.hash = route(p); return; }
    if (p.size && (location.hash === '#field-guide' || !location.hash)) history.pushState(null,'',route(p));
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
    if (!el('field-guide').hidden) document.title = show() + ' · DQM1&2 PSX Player Guide';
    if (!el('atlas').hidden) window.DQMAtlas?.show();
  }
  window.DQMField = {show, filter, guarded, campaigns, setSpoilers, kindForEntry: id => byId.get(id)?.kind};
})();
