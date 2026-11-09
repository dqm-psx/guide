/* Player-facing articles and local search. URL parameters preserve a directory
   when opening an article, including after reloading or sharing its link. */
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const categories = {
    story: 'Walkthroughs', quest: 'Quests', npc: 'Characters', boss: 'Bosses',
    location: 'Locations', item: 'Items', tool: 'Tools', mechanic: 'Mechanics', skill: 'Skills', monster: 'Monsters'
  };
  const world = WORLD_GUIDE.entries, field = FIELD_GUIDE.entries;
  const campaigns = Object.fromEntries(['terry','cobi','tara'].map(key=>[key,world.find(r=>r.id==='npc-'+key).title]));
  const games = {dqm1:campaigns.terry, dqm2:campaigns.cobi+' & '+campaigns.tara, both:'Both games', system:'PSX skill'};
  for (const node of document.querySelectorAll('[data-character]')) node.textContent = campaigns[node.dataset.character];
  for (const node of document.querySelectorAll('[data-place]')) node.textContent = PLAYER_ATLAS.maps.find(m=>m.id===node.dataset.place).title;
  for (const option of el('guide-game').options) {
    if (games[option.value]) option.textContent=games[option.value]+' · '+option.value.toUpperCase();
  }
  const skills = new Map();
  for (const [nativeId, name] of Object.entries(FIELD_GUIDE.skill_names)) {
    const effect = SKILL_DESCRIPTIONS[nativeId];
    const id = 'skill-' + name.id;
    skills.set(id, {id, kind:'skill', title:name.title, nativeId:Number(nativeId), game:'system',
      summary:name.description || effect.description, effect, aliases:name.aliases, source_ids:[name.id,effect.description_source_id].filter(Boolean), learners:{terry:[],cobi:[],tara:[]}});
  }
  for (const monster of MONSTER_REFERENCE.species) {
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
  function params() { return new URLSearchParams(location.hash.split('?')[1] || ''); }
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
  const monsters = MONSTER_REFERENCE.species.filter(row => row.current_name && (row.system_entry_id || DATA.species[row.index]?.playable)).map(row => ({
    id: 'monster-' + row.index, index: row.index, kind: 'monster', game: 'both', title: row.display_name,
    summary: row.family_display || DATA.species[row.index]?.family_display || 'Monster profile',
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
  function provenance(row) {
    const source = row.kind === 'skill' ? {scope:'Skill effects, MP costs and learning requirements come from the English v1.0.73 PlayStation data. Species lists use the native campaign records.', source_url:MONSTER_REFERENCE.metadata.source_url} :
      (field.includes(row) ? FIELD_GUIDE : WORLD_GUIDE).provenance || {};
    const ids = (row.source_ids || []).map(safe).join(', ');
    const url = String(source.source_url || '');
    const external = /^https:\/\/github\.com\/dqm-psx\//.test(url) ? ' <a href="' + safe(url) + '">Translation source ↗</a>' : '';
    const nameUrl = source.name_source_url;
    const wording = nameUrl && nameUrl !== url && /^https:\/\/github\.com\/dqm-psx\//.test(nameUrl)
      ? ' <a href="' + safe(nameUrl) + '">Current names ↗</a>' : '';
    const artNote = row.kind === 'npc' && !NPC_SPRITES[row.id] ? '<p>The available actor records have no confirmed sprite match for this character.</p>' : '';
    return '<details class="guide-source"><summary>Sources &amp; coverage</summary><p>' +
      safe(source.scope || 'English PlayStation player reference.') + external + wording + '</p>' + artNote + (ids ? '<p class="source-ids">' + ids + '</p>' : '') + '</details>';
  }
  function itemNames(row) {
    if (!row.names || (row.kind !== 'item' && row.kind !== 'tool')) return '';
    const {japanese, current, short, editions} = row.names;
    const labels = {gameboy:'Game Boy-style patch', delocalized:'Delocalized patch', vibecoded:'Vibecoded patch'};
    const forms = (full, menu) => [full, menu && menu !== full ? menu + ' (menu)' : ''].filter(Boolean).join(' · ');
    const lines = [['Current patch', forms(current,short)], ['Japanese', japanese],
      ...Object.entries(editions || {}).map(([key, value]) => [labels[key] || key, forms(value.full,value.short)])];
    return '<section class="item-names"><h3>Other names</h3><dl>' + lines.filter(([,v])=>v).map(([k,v]) =>
      '<div><dt>' + safe(k) + '</dt><dd>' + safe(v) + '</dd></div>').join('') + '</dl></section>';
  }
  function artwork(row, thumbnail) {
    const npc = NPC_SPRITES[row.id];
    const image = npc?.image || (npc?.species != null && OVERWORLD_SPRITES[npc.species]) || row.image;
    if (!image || !/^data:image\/png;base64,/.test(image)) return '';
    const role = npc?.role === 'hero' ? 'Playable hero sprite' : npc?.species != null ? 'Monster species sprite' : 'Character sprite';
    return '<img class="' + (npc ? 'npc-art' : 'item-art') + '" alt="' +
      (!thumbnail && npc ? safe(role+' · '+row.title) : '') + '" src="' + safe(image) + '">';
  }
  function renderArticle(row, p) {
    const article = el('guide-article');
    const back = '<a class="guide-back" href="' + linked(p, {entry:''}) + '">← Back to guide</a>';
    if (!row) {
      article.innerHTML = back + '<h2 tabindex="-1" id="article-title">Entry unavailable</h2><p>This link does not identify an entry in this edition.</p>';
      return 'Entry unavailable';
    }
    const title = safeTitle(row);
    let body = '';
    if (guarded(row)) {
      body = '<p>This entry includes ' + (row.spoiler === 'ending' ? 'ending' : 'story') + ' spoilers.</p><button class="guide-action" type="button" id="guide-reveal">Reveal this entry</button>';
    } else {
      const related = (row.related || []).map(id => byId.get(id)).filter(Boolean);
      const profileLinks = (row.species_ids || []).map(id => DATA.species[id]).filter(Boolean);
      const mapLinks = window.DQMAtlas.placesForMaps(row.map_ids || []);
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
      const skillLists = row.game === 'system' ? '<p class="hint">No species lists this as a natural skill in the recorded campaigns.</p>' : row.learners ? Object.entries(row.learners).map(([key,ids])=>'<details class="skill-campaign"'+
        (key==='terry' && ids.length || !row.learners.terry.length && key==='cobi' ? ' open' : '')+'><summary>'+safe(campaigns[key])+' · '+ids.length+' species</summary><div>'+
        ids.map(id=>'<a href="#monster?id='+id+'">'+safe(DATA.species[id].display_name)+'</a>').join('')+(ids.length ? '' : 'No native listings for this campaign.')+'</div></details>').join('') : '';
      const stats = row.learners && FIELD_GUIDE.skill_requirements?.[row.nativeId];
      const statLabels = {level:'Level', hp:'HP', mp:'MP', attack:'Attack', defense:'Defense', agility:'Agility', intelligence:'Intelligence'};
      const requirements = stats ? '<div class="learning"><h3>Minimum learning stats</h3><dl>' + Object.entries(stats).map(([key,value])=>
        '<div><dt>'+safe(statLabels[key] || key)+'</dt><dd>'+safe(value)+'</dd></div>').join('')+'</dl></div>' : '';
      const nextChapter = row.kind === 'story' && world.find(other=>other.kind==='story' && other.game===row.game && other.order===row.order+1);
      body = artwork(row, false) +
        '<p class="article-lead">' + safe(row.summary) + '</p>' + facts +
        ((row.details || []).length ? '<ul class="article-steps">' + row.details.map(line => '<li>' + safe(line) + '</li>').join('') + '</ul>' : '') +
        (prices ? '<div class="guide-stock"><table><caption>Recorded shop prices</caption><thead><tr><th>Adventure</th><th>Merchant location</th><th>Buy</th><th>Gold Pass</th></tr></thead><tbody>'+prices+'</tbody></table></div>' : '') + itemNames(row) + requirements + skillLists +
        (row.places?.length ? '<p><strong>Places</strong> · ' + row.places.map(safe).join(' · ') + '</p>' : '') +
        (mapLinks.length ? '<div class="article-related"><h3>On the map</h3>'+mapLinks.map(m=>'<a href="#atlas?map='+safe(m.id)+'">'+safe(m.title)+' →</a>').join('')+'</div>' : '') +
        (profileLinks.length || related.length ? '<div class="article-related"><h3>Related entries</h3>' +
          related.map(r => '<a href="' + linked(p, {entry:r.id}) + '">' + safe(safeTitle(r)) + ' →</a>').join('') +
          profileLinks.map(m => '<a href="#monster?id=' + m.index + '">' + safe(m.display_name) + ' →</a>').join('') + '</div>' : '') +
      (nextChapter ? '<p class="next-chapter"><a href="'+linked(p,{entry:nextChapter.id})+'">Next chapter · '+safe(safeTitle(nextChapter))+' →</a></p>' : '') + provenance(row);
    }
    article.innerHTML = back + '<div class="guide-overline">' + safe(games[row.game] || row.game) + ' / ' + safe(categories[row.kind]) +
      '</div><h2 id="article-title" tabindex="-1">' + safe(title) + '</h2>' + body;
    el('guide-reveal')?.addEventListener('click', () => { individuallyRevealed.add(row.id); renderArticle(row,p); el('article-title').focus(); });
    return title;
  }
  function directory(p) {
    const kind = p.get('kind'), game = p.get('game'), q = normalized(p.get('q')).trim();
    const words = q.split(/\s+/).filter(Boolean);
    const pool = kind === 'monster' ? monsters : q && !kind ? rows.concat(monsters) : rows;
    const matches = pool.filter(r => (!kind || kind === r.kind) && (!game || r.game === 'both' || r.game === game) &&
      words.every(word => (r.text || searchIndex.get(r.id) || '').includes(word)));
    if (q) {
      const rank = r => normalized(r.title) === q ? 0 : (r.aliases || []).some(alias => normalized(alias) === q) ? 1 : normalized(r.title).startsWith(q) ? 2 : normalized(r.title).includes(q) ? 3 : 4;
      matches.sort((a,b) => rank(a) - rank(b));
    }
    const pages = Math.max(1, Math.ceil(matches.length / pageSize));
    const page = Math.min(pages, Math.max(1, parseInt(p.get('page'),10) || 1));
    const heading = categories[kind] || (q ? 'Search results' : 'Player reference');
    const body = matches.slice((page-1)*pageSize,page*pageSize).map(r => {
      const hidden = guarded(r);
      const href = r.kind === 'monster' ? '#monster?id=' + r.index : linked(p, {entry:r.id});
      const thumb = hidden ? '' : artwork(r, true);
      return '<a class="guide-row" href="' + href + '">' + thumb + '<span><small>' + safe(games[r.game]) + ' · ' + safe(categories[r.kind]) +
        '</small><strong>' + safe(safeTitle(r)) + '</strong><span>' + safe(hidden ? 'Open to reveal the story details.' : r.summary) + '</span></span><b aria-hidden="true">→</b></a>';
    }).join('');
    el('guide-directory').innerHTML = '<div class="directory-head"><div><a href="#field-guide">← Field guide</a><h2 id="directory-title" tabindex="-1">' + safe(heading) +
      '</h2></div></div>' +
      '<p class="guide-count" role="status">' + matches.length + ' matching entries' + (matches.length ? ' · Page ' + page + ' of ' + pages : '') +
      '</p><div class="directory-grid">' + (body || '<p>No entries match. <a href="#field-guide">Reset filters</a></p>') + '</div>' +
      (pages > 1 ? '<nav class="guide-pager" aria-label="Result pages">' +
        (page>1 ? '<a href="' + linked(p,{page:String(page-1)}) + '">← Previous</a>' : '') +
        (page<pages ? '<a href="' + linked(p,{page:String(page+1)}) + '">Next →</a>' : '') + '</nav>' : '');
    return heading;
  }
  function show() {
    el('guide-spoilers').checked = reveal;
    el('spoiler-state').textContent = reveal ? 'Chapter names, bosses and endings are visible.' : 'Story details are hidden until you reveal them.';
    const p=params(), entry=p.get('entry'), browsing=Boolean(p.get('game') || p.get('kind') || p.get('q'));
    el('guide-hero').hidden=Boolean(entry || browsing);
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
  for (const [id,title] of Object.entries(categories)) el('guide-kind').add(new Option(title,id));
  const shortcuts = [['story','Campaign walkthroughs'],['quest','Quests'],['npc','Characters'],['boss','Boss encounters'],['item','Item directory'],['tool','Tools'],['skill','Skills'],['mechanic','Game mechanics'],['location','Places'],['monster','Monster profiles']];
  el('topic-links').innerHTML = shortcuts.map(([kind,name]) => '<a href="#field-guide?kind=' + kind + '">' + name + '<span aria-hidden="true">↗</span></a>').join('');
  el('guide-filters').onsubmit = e => { e.preventDefault(); filter(true); el('directory-title')?.focus(); };
  el('guide-search').oninput = () => filter(false);
  el('guide-kind').onchange = () => filter(true);
  el('guide-game').onchange = () => filter(true);
  el('guide-spoilers').onchange = event => {
    reveal = event.target.checked;
    individuallyRevealed.clear();
    try { localStorage.setItem(spoilerKey, reveal ? 'show' : 'hide'); } catch {}
    document.title = show() + ' · DQM1&2 PSX Player Guide';
  };
  window.DQMField = {show, guarded, campaigns};
})();
