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
  const games = {dqm1: 'Terry', dqm2: 'Cobi & Tara', both: 'Both games'};
  const world = WORLD_GUIDE.entries, field = FIELD_GUIDE.entries;
  const campaigns = {terry:'Terry', cobi:'Cobi', tara:'Tara'};
  const skills = new Map();
  for (const monster of MONSTER_REFERENCE.species) {
    for (const [campaign,list] of Object.entries(monster.skills)) {
      for (const skill of list) {
        const id = 'skill-' + skill.system_entry_id;
        if (!skills.has(id)) skills.set(id, {id, kind:'skill', title:skill.name, nativeId:skill.id, game:'both',
          summary:'Monsters with this natural skill in the PlayStation adventures.', details:[], source_ids:[skill.system_entry_id],
          learners:{terry:[], cobi:[], tara:[]}});
        const row=skills.get(id);
        if (row.learners[campaign] && !row.learners[campaign].includes(monster.index)) row.learners[campaign].push(monster.index);
      }
    }
  }
  for (const row of skills.values()) row.game = row.learners.terry.length ? (row.learners.cobi.length || row.learners.tara.length ? 'both' : 'dqm1') : 'dqm2';
  const rows = [...world, ...field, ...Array.from(skills.values()).sort((a,b)=>a.title.localeCompare(b.title))];
  const byId = new Map(rows.map(row => [row.id, row]));
  const pageSize = 24;
  let reveal = false;
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
  const searchIndex = new Map(rows.map(row => [row.id, normalized([row.title, row.region, row.summary, row.category,
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
    const source = row.kind === 'skill' ? {scope:'Natural skill lists come from the PSX species records. Display names follow the synchronized English translation.', source_url:MONSTER_REFERENCE.metadata.source_url} :
      (field.includes(row) ? FIELD_GUIDE : WORLD_GUIDE).provenance || {};
    const ids = (row.source_ids || []).map(safe).join(', ');
    const url = String(source.source_url || '');
    const external = /^https:\/\/github\.com\/dqm-psx\//.test(url) ? ' <a href="' + safe(url) + '">Translation source ↗</a>' : '';
    return '<details class="guide-source"><summary>Sources &amp; coverage</summary><p>' +
      safe(source.scope || 'English PlayStation player reference.') + external + '</p>' + (ids ? '<p class="source-ids">' + ids + '</p>' : '') + '</details>';
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
      const mapLinks = (row.map_ids || []).map(id=>PLAYER_ATLAS.maps.find(m=>m.id===id)).filter(Boolean);
      const prices = (row.prices || []).map(price=>'<tr><th scope="row">'+safe(games[price.game])+'</th><td>'+safe(price.locations.join(' · '))+
        '</td><td>'+safe(price.buy)+' G</td><td>'+safe(price.gold_pass)+' G</td></tr>').join('');
      const skillLists = row.learners ? Object.entries(row.learners).map(([key,ids])=>'<details class="skill-campaign"'+
        (key==='terry' && ids.length || !row.learners.terry.length && key==='cobi' ? ' open' : '')+'><summary>'+campaigns[key]+' · '+ids.length+' species</summary><div>'+
        ids.map(id=>'<a href="#monster?id='+id+'">'+safe(DATA.species[id].display_name)+'</a>').join('')+(ids.length ? '' : 'No native listings for this campaign.')+'</div></details>').join('') : '';
      const stats = row.learners && FIELD_GUIDE.skill_requirements?.[row.nativeId];
      const statLabels = {level:'Level', hp:'HP', mp:'MP', attack:'Attack', defense:'Defense', agility:'Agility', intelligence:'Intelligence'};
      const requirements = stats ? '<div class="learning"><h3>Minimum learning stats</h3><dl>' + Object.entries(stats).map(([key,value])=>
        '<div><dt>'+safe(statLabels[key] || key)+'</dt><dd>'+safe(value)+'</dd></div>').join('')+'</dl><small>PSX v1.0.73 · A compatible natural skill also requires the listed stats.</small></div>' : '';
      const nextChapter = row.kind === 'story' && world.find(other=>other.kind==='story' && other.game===row.game && other.order===row.order+1);
      body = (row.image && /^data:image\/png;base64,/.test(row.image) ? '<img class="item-art" src="' + safe(row.image) + '" alt="">' : '') +
        '<p class="article-lead">' + safe(row.summary) + '</p>' +
        ((row.details || []).length ? '<ul class="article-steps">' + row.details.map(line => '<li>' + safe(line) + '</li>').join('') + '</ul>' : '') +
        (prices ? '<div class="guide-stock"><table><caption>Recorded shop prices</caption><thead><tr><th>Adventure</th><th>Merchant location</th><th>Buy</th><th>Gold Pass</th></tr></thead><tbody>'+prices+'</tbody></table></div>' : '') + requirements + skillLists +
        (row.places?.length ? '<p><strong>Places</strong> · ' + row.places.map(safe).join(' · ') + '</p>' : '') +
        (mapLinks.length ? '<div class="article-related"><h3>On the map</h3>'+mapLinks.map(m=>'<a href="#atlas?map='+safe(m.id)+'">'+safe(m.title)+' · Map '+m.area+' →</a>').join('')+'</div>' : '') +
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
      const rank = r => normalized(r.title) === q ? 0 : normalized(r.title).startsWith(q) ? 1 : normalized(r.title).includes(q) ? 2 : 3;
      matches.sort((a,b) => rank(a) - rank(b));
    }
    const pages = Math.max(1, Math.ceil(matches.length / pageSize));
    const page = Math.min(pages, Math.max(1, parseInt(p.get('page'),10) || 1));
    const heading = categories[kind] || (q ? 'Search results' : 'Player reference');
    const body = matches.slice((page-1)*pageSize,page*pageSize).map(r => {
      const hidden = guarded(r);
      const href = r.kind === 'monster' ? '#monster?id=' + r.index : linked(p, {entry:r.id});
      const thumb = r.image && /^data:image\/png;base64,/.test(r.image) ? '<img alt="" src="' + safe(r.image) + '">' : '';
      return '<a class="guide-row" href="' + href + '">' + thumb + '<span><small>' + safe(games[r.game]) + ' · ' + safe(categories[r.kind]) +
        '</small><strong>' + safe(safeTitle(r)) + '</strong><span>' + safe(hidden ? 'Open to reveal the story details.' : r.summary) + '</span></span><b aria-hidden="true">→</b></a>';
    }).join('');
    el('guide-directory').innerHTML = '<div class="directory-head"><div><a href="#field-guide">← Field guide</a><h2 id="directory-title" tabindex="-1">' + safe(heading) +
      '</h2></div><label class="spoiler-control"><input id="guide-spoilers" type="checkbox"' + (reveal ? ' checked' : '') + '> Show story spoilers</label></div>' +
      '<p class="guide-count" role="status">' + matches.length + ' matching entries' + (matches.length ? ' · Page ' + page + ' of ' + pages : '') +
      '</p><div class="directory-grid">' + (body || '<p>No entries match. <a href="#field-guide">Reset filters</a></p>') + '</div>' +
      (pages > 1 ? '<nav class="guide-pager" aria-label="Result pages">' +
        (page>1 ? '<a href="' + linked(p,{page:String(page-1)}) + '">← Previous</a>' : '') +
        (page<pages ? '<a href="' + linked(p,{page:String(page+1)}) + '">Next →</a>' : '') + '</nav>' : '');
    el('guide-spoilers').onchange = e => { reveal = e.target.checked; directory(p); el('guide-spoilers').focus(); };
    return heading;
  }
  function show() {
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
  const shortcuts = [['story','Campaign walkthroughs'],['quest','Quests'],['npc','Characters'],['boss','Boss encounters'],['item','Item directory'],['tool','Tools'],['skill','Natural skills'],['mechanic','Game mechanics'],['location','Places'],['monster','Monster profiles']];
  el('topic-links').innerHTML = shortcuts.map(([kind,name]) => '<a href="#field-guide?kind=' + kind + '">' + name + '<span aria-hidden="true">↗</span></a>').join('');
  el('guide-filters').onsubmit = e => { e.preventDefault(); filter(true); el('directory-title')?.focus(); };
  el('guide-search').oninput = () => filter(false);
  el('guide-kind').onchange = () => filter(true);
  el('guide-game').onchange = () => filter(true);
  window.DQMField = {show};
})();
