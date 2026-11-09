/* Fixed field maps and wild encounter contexts have different native IDs.
   Keep the two indexes separate: a matching name does not place a monster on a tile. */
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const names = window.DQMField.campaigns;
  for (const option of el('atlas-game').options) if (names[option.value]) option.textContent=names[option.value];
  const maps = new Map(PLAYER_ATLAS.maps.map(m => [m.id,m]));
  const places = new Map();
  const placeId = map => map.placeId || map.id;
  function exitKey(exit) {
    const dest = maps.get(exit.to);
    return JSON.stringify([placeId(dest), dest.image, exit.variant || '', exit.x, exit.y]);
  }
  // Several events can reuse a room verbatim. Only a different picture or
  // a different set of usable exits needs a second choice in the atlas.
  const layoutFor = new Map();
  for (const map of maps.values()) {
    const key = placeId(map);
    if (!places.has(key)) places.set(key, {id:key, title:map.title, scene:map.scene, layouts:[], records:[]});
    const place = places.get(key);
    const exits = new Set(map.exits.filter(e=>maps.has(e.to)).map(exitKey));
    const signature = JSON.stringify([map.image, [...exits].sort()]);
    let layout = place.layouts.find(layout => layout.signature === signature);
    if (!layout) {
      layout = {map, signature, number:place.layouts.length+1};
      place.layouts.push(layout);
    }
    layoutFor.set(map.id,layout);
    place.records.push(map);
  }
  function placesForMaps(ids) {
    const seen = new Set();
    return ids.map(id=>maps.get(id)).filter(map => {
      if (!map || seen.has(placeId(map))) return false;
      seen.add(placeId(map));
      return true;
    });
  }
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
    if (row.roster) return names[row.game] + (row.floors ? ' · '+ row.floors : '');
    const place = places.get(row.placeId || row.id);
    const region = row.scene >= 6 && row.scene <= 11 ? maps.get('map-6-0').title :
      [12,13,14,15,16,21].includes(row.scene) ? maps.get('map-12-0').title :
      row.scene >= 184 ? 'Area '+row.scene : '';
    return [region !== row.title ? region : '', place.layouts.length > 1 ? place.layouts.length+' layouts' : ''].filter(Boolean).join(' · ');
  }
  function catalog() { return tab()==='maps' ? places : areas; }
  function current() { return params().get(tab()==='maps' ? 'map' : 'area') || catalog().keys().next().value; }
  function directory() {
    const q=searchText(el('atlas-search').value);
    const inputGame=params().get('game') || '';
    const rows = Array.from(catalog().values()).filter(r =>
      (!inputGame || !r.game || r.game===inputGame) && (searchText(r.title+' '+subtitle(r)+' '+r.id).includes(q) || r.search?.includes(q) ||
        r.records?.some(m=>[m.id, ...(m.aliases || [])].some(name=>searchText(name).includes(q)))));
    const pageSize=16;
    const max=Math.max(1,Math.ceil(rows.length/pageSize));
    const page=Math.min(max,Math.max(1,Number.parseInt(params().get('page'),10) || 1));
    const key=tab()==='maps' ? 'map' : 'area';
    const links=rows.slice((page-1)*pageSize,page*pageSize).map(r=>'<a href="' + safe(href({[key]:r.id,variant:''})) + '"' +
      (r.id===(maps.get(current())?.placeId || current()) ? ' aria-current="true"' : '') + '><span>'+safe(r.title)+'</span><small>'+safe(subtitle(r))+'</small></a>').join('');
    el('atlas-index').innerHTML = '<p class="guide-count" role="status">'+rows.length+' matches · Page '+page+' of '+max+'</p><div class="atlas-scroll">'+
      (links || '<p>No matching locations.</p>')+'</div><nav class="guide-pager" aria-label="Location pages">'+
      (page>1 ? '<a href="'+safe(href({page:String(page-1)}))+'">← Previous</a>' : '')+
      (page<max ? '<a href="'+safe(href({page:String(page+1)}))+'">Next →</a>' : '')+'</nav>';
  }
  function mapView(row) {
    const place = places.get(placeId(row));
    const layout = layoutFor.get(row.id);
    const arrival = row.arrivalVariants?.find(v=>v.id===params().get('variant'));
    const imageFile = arrival?.image || row.image;
    const valid=Array.from(new Map(row.exits.filter(exit=>maps.has(exit.to)).map(exit=>[exitKey(exit),exit])).values());
    const doorHref = exit => safe(href({map:exit.to,variant:exit.variant || '',q:'',page:''}));
    const pins=valid.map((exit,i)=>Number.isFinite(exit.x) && Number.isFinite(exit.y) ?
      '<a class="map-pin" style="left:'+exit.x*100+'%;top:'+exit.y*100+'%" href="'+doorHref(exit)+'" aria-label="Exit '+(i+1)+' to '+safe(maps.get(exit.to).title)+'">'+(i+1)+'</a>' : '').join('');
    const doors=valid.map(exit=>'<li><a href="'+doorHref(exit)+'">'+safe(maps.get(exit.to).title)+'</a>'+
      (places.get(placeId(maps.get(exit.to))).layouts.length>1 ? ' <small>Layout '+layoutFor.get(exit.to).number+'</small>' : '')+'</li>').join('');
    const npcs=WORLD_GUIDE.entries.filter(r=>r.kind==='npc' && r.map_ids?.some(id=>maps.has(id) && placeId(maps.get(id))===place.id) && !window.DQMField.guarded(r));
    const layouts = place.layouts.map(l=>({id:l.map.id, label:'Layout '+l.number, selected:l===layout&&!arrival}));
    for (const map of place.records) {
      for (const variant of map.arrivalVariants || []) {
        const from=variant.from.map(id=>layoutFor.get(id)).filter(Boolean);
        const label='Layout '+layoutFor.get(map.id).number+' · from '+from.map(l=>l.map.title+' (layout '+l.number+')').join(', ');
        layouts.push({id:map.id+':'+variant.id, label, selected:arrival===variant});
      }
    }
    const picker = layouts.length > 1 ? '<label class="atlas-layout-picker">Layout <select id="atlas-layout-select">'+
      layouts.map(l=>'<option value="'+safe(l.id)+'"'+(l.selected?' selected':'')+'>'+safe(l.label)+'</option>').join('')+'</select></label>' : '';
    const detail=el('atlas-detail');
    detail.innerHTML='<div class="atlas-caption"><div><small>'+safe(subtitle(row))+'</small><h3 id="atlas-location" tabindex="-1">'+safe(row.title)+'</h3></div><div class="map-controls">'+
      picker+(pins ? '<label><input type="checkbox" id="atlas-pins" checked> Exit pins</label>' : '')+'<button type="button" id="atlas-zoom" aria-pressed="false">Zoom in</button></div></div>'+
      '<div class="map-scroll" tabindex="0" aria-label="Scrollable field map"><div class="map-image"><img src="maps/'+safe(imageFile)+'" alt="Static field layout of '+safe(row.title)+'"><div class="map-pins">'+pins+'</div></div></div>'+
      '<div class="map-notes"><h4>Connected maps</h4>'+(doors ? '<ol class="map-doors">'+doors+'</ol>' : '<p>No named destinations are verified here.</p>')+
      (npcs.length ? '<p><strong>Characters</strong> · '+npcs.map(n=>'<a href="#field-guide?entry='+safe(n.id)+'">'+safe(n.title)+'</a>').join(' · ')+'</p>' : '')+
      '<details><summary>Map coverage</summary><p>Verified against the English PSX '+safe(PLAYER_ATLAS.verification.version)+'. This location includes '+place.records.length+' native map record'+(place.records.length===1?'':'s')+
      '. Layouts group matching backgrounds and exits. Actors, story-dependent tiles and randomly generated floors vary in play. Open a map online once to cache its artwork.</p></details></div>';
    el('atlas-layout-select')?.addEventListener('change',e=>{
      const [map,variant] = e.target.value.split(':');
      location.hash=href({map,variant});
    });
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
    const t=tab(), row=(t==='maps' ? maps : areas).get(current());
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
  window.DQMAtlas = {show, placesForMaps};
})();
