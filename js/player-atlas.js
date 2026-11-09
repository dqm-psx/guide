/* Fixed field maps and wild encounter contexts have different native IDs.
   Keep the two indexes separate: a matching name does not place a monster on a tile. */
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const names = {terry:'Terry', cobi:'Cobi', tara:'Tara'};
  const maps = new Map(PLAYER_ATLAS.maps.map(m => [m.id,m]));
  const areas = new Map();
  for (const species of MONSTER_REFERENCE.species) {
    for (const loc of species.locations || []) {
      if (loc.kind !== 'wild' || !names[loc.game] || !Number.isInteger(loc.context_id)) continue;
      const id = loc.game + '-' + loc.context_id;
      if (!areas.has(id)) areas.set(id, {id, title:loc.name, floors:loc.floors, game:loc.game, roster:new Map()});
      const area = areas.get(id);
      const levels = area.roster.get(species.index) || new Set();
      loc.levels.forEach(l => levels.add(l));
      area.roster.set(species.index,levels);
    }
  }
  const tab = () => params().get('tab') === 'encounters' ? 'encounters' : 'maps';
  const params = () => new URLSearchParams(location.hash.split('?')[1] || '');
  function href(changes) {
    const p=params();
    for (const [k,v] of Object.entries(changes)) { if (v) p.set(k,v); else p.delete(k); }
    return '#atlas' + (p.size ? '?' + p.toString() : '');
  }
  const searchText = s => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
  for (const area of areas.values()) area.search = searchText([...area.roster.keys()].map(i=>{
    const m=DATA.species[i]; return [m.display_name, m.short_name, ...(m.aliases || [])].join(' ');
  }).join(' '));
  function subtitle(row) {
    return row.roster ? names[row.game] + (row.floors ? ' · '+ row.floors : '') : 'Scene ' + row.scene + ' · Map ' + row.area;
  }
  function catalog() { return tab()==='maps' ? maps : areas; }
  function current() { return params().get(tab()==='maps' ? 'map' : 'area') || catalog().keys().next().value; }
  function directory() {
    const q=searchText(el('atlas-search').value);
    const inputGame=params().get('game') || '';
    const rows = Array.from(catalog().values()).filter(r =>
      (!inputGame || !r.game || r.game===inputGame) && (searchText(r.title+' '+subtitle(r)+' '+r.id).includes(q) || r.search?.includes(q)));
    const pageSize=16;
    const max=Math.max(1,Math.ceil(rows.length/pageSize));
    const page=Math.min(max,Math.max(1,Number.parseInt(params().get('page'),10) || 1));
    const key=tab()==='maps' ? 'map' : 'area';
    const links=rows.slice((page-1)*pageSize,page*pageSize).map(r=>'<a href="' + safe(href({[key]:r.id})) + '"' +
      (r.id===current() ? ' aria-current="true"' : '') + '><span>'+safe(r.title)+'</span><small>'+safe(subtitle(r))+'</small></a>').join('');
    el('atlas-index').innerHTML = '<p class="guide-count" role="status">'+rows.length+' matches · Page '+page+' of '+max+'</p><div class="atlas-scroll">'+
      (links || '<p>No matching locations.</p>')+'</div><nav class="guide-pager" aria-label="Location pages">'+
      (page>1 ? '<a href="'+safe(href({page:String(page-1)}))+'">← Previous</a>' : '')+
      (page<max ? '<a href="'+safe(href({page:String(page+1)}))+'">Next →</a>' : '')+'</nav>';
  }
  function mapView(row) {
    const valid=row.exits.filter(exit => maps.has(exit.to));
    const pins=valid.map((exit,i)=>Number.isFinite(exit.x) && Number.isFinite(exit.y) ?
      '<a class="map-pin" style="left:'+exit.x*100+'%;top:'+exit.y*100+'%" href="'+safe(href({map:exit.to,q:'',page:''}))+'" aria-label="Exit '+(i+1)+' to '+safe(maps.get(exit.to).title)+'">'+(i+1)+'</a>' : '').join('');
    const doors=valid.map((exit,i)=>'<li><a href="'+safe(href({map:exit.to,q:'',page:''}))+'">'+safe(maps.get(exit.to).title)+'</a> <small>'+safe(subtitle(maps.get(exit.to)))+'</small></li>').join('');
    const npcs=WORLD_GUIDE.entries.filter(r=>r.kind==='npc' && r.map_ids?.includes(row.id) && r.spoiler==='none');
    const detail=el('atlas-detail');
    detail.innerHTML='<div class="atlas-caption"><div><small>'+safe(subtitle(row))+'</small><h3 id="atlas-location" tabindex="-1">'+safe(row.title)+'</h3></div><div class="map-controls">'+
      (pins ? '<label><input type="checkbox" id="atlas-pins" checked> Exit pins</label>' : '')+'<button type="button" id="atlas-zoom" aria-pressed="false">Zoom in</button></div></div>'+
      '<div class="map-scroll" tabindex="0" aria-label="Scrollable field map"><div class="map-image"><img src="maps/'+safe(row.image)+'" alt="Static field layout of '+safe(row.title)+'"><div class="map-pins">'+pins+'</div></div></div>'+
      '<div class="map-notes"><h4>Connected maps</h4>'+(doors ? '<ol class="map-doors">'+doors+'</ol>' : '<p>No named destinations are verified here.</p>')+
      (npcs.length ? '<p><strong>Characters</strong> · '+npcs.map(n=>'<a href="#field-guide?entry='+safe(n.id)+'">'+safe(n.title)+'</a>').join(' · ')+'</p>' : '')+
      '<details><summary>Map coverage</summary><p>Named static backgrounds and recorded exits from the English PSX v1.0.66 extraction. Some scenes share a title. Actors, story-dependent tiles and randomly generated floors vary in play. Opened map images are available offline after caching.</p></details></div>';
    const image=detail.querySelector('.map-image img');
    image.onerror=()=>{ if (!image.isConnected) return; const message=document.createElement('p'); message.className='map-unavailable';
      message.textContent='Map image unavailable. Open this location online once to cache its image.'; image.closest('.map-scroll').replaceChildren(message); el('atlas-zoom').disabled=true; if (el('atlas-pins')) el('atlas-pins').disabled=true; };
    el('atlas-pins')?.addEventListener('change', e=>{ detail.querySelector('.map-pins').hidden=!e.target.checked; });
    el('atlas-zoom').onclick=e=>{
      const on=detail.querySelector('.map-scroll').classList.toggle('zoomed');
      e.currentTarget.setAttribute('aria-pressed',String(on)); e.currentTarget.textContent=on ? 'Fit map' : 'Zoom in';
    };
  }
  function encounters(row) {
    const entries = [...row.roster].sort((a,b) => DATA.species[a[0]].display_name.localeCompare(DATA.species[b[0]].display_name));
    el('atlas-detail').innerHTML='<div class="atlas-caption"><div><small>'+safe(subtitle(row))+'</small><h3 id="atlas-location" tabindex="-1">'+safe(row.title)+'</h3></div></div>'+
      '<div class="encounters"><p>Wild monsters recorded for this area and floor range.</p><ul>'+entries.map(([id,levels])=>
        '<li>'+spriteLabel(id,DATA.species[id].display_name)+'<small>Lv. '+[...levels].sort((a,b)=>a-b).join(', ')+'</small></li>').join('')+'</ul></div>';
  }
  function show() {
    const t=tab(), row=catalog().get(current());
    const label=t==='maps' ? 'Find a map' : 'Find an area or monster';
    el('atlas-search-label').textContent=label;
    el('atlas-search').placeholder=t==='maps' ? 'e.g. GreatTree or Bazaar' : 'e.g. Strength Gate or Dracky';
    el('atlas-search').value=params().get('q') || '';
    el('atlas-game-label').hidden=t==='maps';
    el('atlas-game').value=params().get('game') || '';
    for (const link of document.querySelectorAll('[data-atlas-tab]')) {
      if (link.dataset.atlasTab===t) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
    }
    directory();
    if (!row) { el('atlas-detail').innerHTML='<h3>Location unavailable</h3><p>Choose a location from the index.</p>'; return 'Map atlas'; }
    if (t==='maps') mapView(row); else encounters(row);
    return (params().has('map') || params().has('area')) ? row.title : 'Map atlas';
  }
  el('atlas-search').oninput=e=>{ history.replaceState(null,'',href({q:e.target.value,page:''})); directory(); };
  el('atlas-game').onchange=e=>{
    const game=e.target.value;
    const first=Array.from(areas.values()).find(r=>!game || r.game===game);
    location.hash=href({game,area:first?.id,page:''});
  };
  window.DQMAtlas = {show};
})();
