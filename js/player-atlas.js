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
  for (const species of GUIDE_REFERENCE.species) {
    for (const loc of species.locations || []) {
      if (loc.kind !== 'wild' || !names[loc.game] || !Number.isInteger(loc.context_id)) continue;
      const id = loc.game + '-' + loc.context_id;
      if (!areas.has(id)) areas.set(id, {id, context:loc.context_id, title:loc.name, floors:loc.floors, game:loc.game, roster:new Map()});
      const area = areas.get(id);
      const levels = area.roster.get(species.index) || new Set();
      loc.levels.forEach(l => levels.add(l));
      area.roster.set(species.index,levels);
    }
  }
  const tab = () => params().get('tab') === 'encounters' ? 'encounters' : 'maps';
  const params = () => new URLSearchParams((window.DQMEntryHash?.() || location.hash).split('?')[1] || '');
  function href(changes) {
    const p=params();
    for (const [k,v] of Object.entries(changes)) { if (v) p.set(k,v); else p.delete(k); }
    return '#atlas' + (p.size ? '?' + p.toString() : '');
  }
  const searchText = s => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
  for (const area of areas.values()) area.search = searchText([...area.roster.keys()].map(i=>{
    const m=GUIDE_REFERENCE.species[i]; return [m.display_name, m.short_name, ...(m.aliases || [])].join(' ');
  }).join(' '));
  const regions = {greattree:maps.get('map-6-0').title, greatlog:maps.get('map-12-0').title, 'gate-ends':'Travelers’ Gates',
    otherworld:'Otherworlds', other:'Other locations', side:'Side adventures'};
  for (const [id, article] of Object.entries({desert:'desert-world',water:'water-world',ice:'ice-world',sky:'sky-world',between:'world-between-worlds'})) {
    regions[id]=WORLD_GUIDE.entries.find(row=>row.id==='location-'+article).title;
  }
  const mapRegions = new Map(Object.entries(FIELD_ROUTES.scenes).flatMap(([region, scenes])=>scenes.map(scene=>[scene,region])));
  for (const place of places.values()) {
    place.region=mapRegions.get(place.scene) || (place.scene>=184 ? 'otherworld' : 'other');
    place.games=['greattree','gate-ends'].includes(place.region) ? ['terry'] :
      place.region==='other' ? [] : ['cobi','tara'];
  }
  const sameName=new Map();
  for (const place of places.values()) {
    const key=JSON.stringify([place.region,place.title]);
    if (!sameName.has(key)) sameName.set(key,[]);
    sameName.get(key).push(place);
  }
  for (const group of sameName.values()) {
    if (group.length>1) group.forEach((place,i)=>{ place.locationNumber=i+1; });
  }
  const areaGroups = new Map();
  for (const area of [...areas.values()].sort((a,b)=>a.context-b.context)) {
    const key=JSON.stringify([area.game,area.title]);
    const region=area.game==='terry' ? 'gate-ends' : area.context<=9 ? 'desert' : area.context<=28 ? 'water' :
      area.context<=46 ? 'ice' : area.context<=68 ? 'sky' : area.context<=70 ? 'between' : 'side';
    if (!areaGroups.has(key)) areaGroups.set(key,{id:area.id, title:area.title, region, games:[area.game], pools:[]});
    const group=areaGroups.get(key);
    const signature=JSON.stringify([area.floors,[...area.roster].map(([id,lv])=>[id,[...lv].sort((a,b)=>a-b)])]);
    let pool=group.pools.find(p=>p.signature===signature);
    if (!pool) {pool={signature,area};group.pools.push(pool);}
    area.group=group;
    area.pool=pool;
  }
  function subtitle(row, list = true) {
    if (row.roster) return names[row.game] + (row.floors ? ' · '+ row.floors : '');
    const place = places.get(row.placeId || row.id);
    const region = row.scene >= 6 && row.scene <= 11 ? maps.get('map-6-0').title :
      [12,13,14,15,16,21].includes(row.scene) ? maps.get('map-12-0').title :
      regions[place.region] || '';
    return [region && region !== row.title && !row.title.startsWith(region + ' ') ? region : '',
      place.locationNumber ? 'Location '+place.locationNumber : '',
      list && place.layouts.length > 1 ? place.layouts.length+' layouts' : ''].filter(Boolean).join(' · ');
  }
  const poolTerms = area => searchText([area.title,area.floors || '',names[area.game]].join(' '));
  const poolMatches = (area,q) => !q || poolTerms(area).includes(q) || area.search.includes(q);
  function choice(group,q) {
    const prior=areas.get(params().get('area'));
    if (prior?.group===group && poolMatches(prior,q)) return prior;
    return group.pools.find(p=>poolMatches(p.area,q))?.area || group.pools[0].area;
  }
  function directory() {
    const q=searchText(el('atlas-search').value);
    const state=params(), inputGame=state.get('game') || '', inputRegion=state.get('region') || '';
    const isMap=tab()==='maps';
    const candidates = [...(isMap ? places : areaGroups).values()].filter(r=>!inputGame || r.games.includes(inputGame));
    const available=new Set(candidates.map(r=>r.region));
    el('atlas-region').replaceChildren(new Option('All',''), ...Object.entries(regions).filter(([id])=>available.has(id)).map(([id,title])=>new Option(title,id)));
    el('atlas-region').value=inputRegion;
    const rows = candidates.filter(r => (!inputRegion || r.region===inputRegion) && (!q || searchText(regions[r.region]).includes(q) ||
      (isMap ? searchText(r.title+' '+subtitle(r)+' '+r.id).includes(q) || r.records.some(m=>[m.id,...(m.aliases || [])].some(name=>searchText(name).includes(q))) :
        r.pools.some(p=>poolMatches(p.area,q)))));
    const pageSize=16;
    const max=Math.max(1,Math.ceil(rows.length/pageSize));
    const page=Math.min(max,Math.max(1,Number.parseInt(params().get('page'),10) || 1));
    const key=isMap ? 'map' : 'area';
    const requested=state.get(key), requestedMap=maps.get(requested), previous=isMap ? requestedMap && places.get(placeId(requestedMap)) : areas.get(requested)?.group;
    const visible=rows.slice((page-1)*pageSize,page*pageSize);
    const selected=rows.includes(previous) ? previous : visible[0];
    const groupsOnPage=new Map();
    const links=visible.map(r=>{
      const dest = isMap ? r : choice(r,q);
      const note=isMap ? subtitle(r) : names[dest.game]+(r.pools.length>1 ? ' · '+r.pools.length+' pools' : dest.floors ? ' · '+dest.floors : '');
      const link='<a href="' + safe(href({[key]:dest.id,variant:''})) + '"' +
        (selected===r ? ' aria-current="true"' : '') + '><span>'+safe(r.title)+'</span>'+
        (note ? '<small>'+safe(note)+'</small>' : '')+'</a>';
      if (!groupsOnPage.has(r.region)) groupsOnPage.set(r.region,[]);
      groupsOnPage.get(r.region).push(link);
      return link;
    });
    const count=rows.length ? rows.length+(rows.length===1?' location':' locations') : 'No matching locations';
    el('atlas-index').innerHTML = '<p class="guide-count" role="status">'+count+(max>1 ? ' · Page '+page+' of '+max : '')+'</p>'+
      (links.length ? '<div class="atlas-scroll">'+Array.from(groupsOnPage,([id,items])=>'<h4>'+safe(regions[id])+'</h4>'+items.join('')).join('')+'</div>' : '')+
      (max>1 ? '<nav class="guide-pager" aria-label="Location pages">'+
        (page>1 ? '<a href="'+safe(href({page:String(page-1),[key]:'',variant:''}))+'">Previous</a>' : '')+
        (page<max ? '<a href="'+safe(href({page:String(page+1),[key]:'',variant:''}))+'">Next</a>' : '')+'</nav>' : '');
    if (!selected) return null;
    if (requested && !previous && !q && !inputGame && !inputRegion) return null;
    return isMap ? (previous===selected ? requestedMap : maps.get(selected.id)) : choice(selected,q);
  }
  function mapView(row) {
    const place = places.get(placeId(row));
    const layout = layoutFor.get(row.id);
    const arrival = row.arrivalVariants?.find(v=>v.id===params().get('variant'));
    const imageFile = arrival?.image || row.image;
    const valid=Array.from(new Map(row.exits.filter(exit=>maps.has(exit.to)).map(exit=>[exitKey(exit),exit])).values());
    const doorHref = exit => safe(href({map:exit.to,variant:exit.variant || '',q:'',page:'',region:'',game:''}));
    const pins=valid.map((exit,i)=>Number.isFinite(exit.x) && Number.isFinite(exit.y) ?
      '<a class="map-pin" style="left:'+exit.x*100+'%;top:'+exit.y*100+'%" href="'+doorHref(exit)+'" aria-label="Exit '+(i+1)+' to '+safe(maps.get(exit.to).title)+'">'+(i+1)+'</a>' : '').join('');
    const doors=valid.map(exit=>'<li><a href="'+doorHref(exit)+'">'+safe(maps.get(exit.to).title)+'</a>'+
      (places.get(placeId(maps.get(exit.to))).layouts.length>1 ? ' <small>Layout '+layoutFor.get(exit.to).number+'</small>' : '')+'</li>').join('');
    const npcs=WORLD_GUIDE.entries.filter(r=>r.kind==='npc' && r.map_ids?.some(id=>maps.has(id) && placeId(maps.get(id))===place.id) && !window.DQMField.guarded(r));
    const layouts = place.layouts.map(l=>({id:l.map.id, label:String(l.number), selected:l===layout&&!arrival}));
    for (const map of place.records) {
      for (const variant of map.arrivalVariants || []) {
        const from=variant.from.map(id=>layoutFor.get(id)).filter(Boolean);
        const label=layoutFor.get(map.id).number+' · from '+from.map(l=>l.map.title+' (layout '+l.number+')').join(', ');
        layouts.push({id:map.id+':'+variant.id, label, selected:arrival===variant});
      }
    }
    const picker = layouts.length > 1 ? '<label class="atlas-layout-picker">Layout <select id="atlas-layout-select">'+
      layouts.map(l=>'<option value="'+safe(l.id)+'"'+(l.selected?' selected':'')+'>'+safe(l.label)+'</option>').join('')+'</select></label>' : '';
    const detail=el('atlas-detail');
    const region=subtitle(row, false);
    detail.innerHTML='<div class="atlas-caption"><div>'+(region ? '<small>'+safe(region)+'</small>' : '')+'<h3 id="atlas-location" tabindex="-1">'+safe(row.title)+'</h3></div><div class="map-controls">'+
      picker+(pins ? '<label><input type="checkbox" id="atlas-pins" checked> Exit pins</label>' : '')+'<button type="button" id="atlas-zoom" aria-pressed="false">Zoom in</button></div></div>'+
      '<div class="map-scroll" tabindex="0" aria-label="Scrollable field map"><div class="map-image"><img src="maps/'+safe(imageFile)+'" alt="Static field layout of '+safe(row.title)+'"><div class="map-pins">'+pins+'</div></div></div>'+
      '<div class="map-notes">'+(doors ? '<h4>Connected maps</h4><ol class="map-doors">'+doors+'</ol>' : '')+
      (npcs.length ? '<p><strong>Characters</strong> · '+npcs.map(n=>'<a href="#field-guide?entry='+safe(n.id)+'">'+safe(n.title)+'</a>').join(' · ')+'</p>' : '')+'</div>';
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
    const entries = [...row.roster].sort((a,b) => GUIDE_REFERENCE.species[a[0]].display_name.localeCompare(GUIDE_REFERENCE.species[b[0]].display_name));
    const pools=row.group.pools;
    const selector=pools.length>1 ? '<label class="atlas-layout-picker">Encounter pool <select id="atlas-pool">'+pools.map(({area},i)=>{
      const levels=[...area.roster.values()].flatMap(set=>[...set]);
      const low=Math.min(...levels), high=Math.max(...levels);
      const label=(area.floors || 'Pool '+(i+1))+' · Lv. '+low+(high!==low?'–'+high:'')+' · '+
        [...area.roster.keys()].slice(0,2).map(id=>GUIDE_REFERENCE.species[id].display_name).join(', ');
      return '<option value="'+safe(area.id)+'"'+(area===row.pool.area?' selected':'')+'>'+safe(label)+'</option>';
    }).join('')+'</select></label>' : '';
    el('atlas-detail').innerHTML='<div class="atlas-caption"><div><small>'+safe(subtitle(row))+'</small><h3 id="atlas-location" tabindex="-1">'+safe(row.title)+'</h3></div>'+selector+'</div>'+
      '<div class="encounters"><ul aria-label="Wild monsters">'+entries.map(([id,levels])=>
        '<li>'+spriteLabel(id,GUIDE_REFERENCE.species[id].display_name)+(levels.size ? '<small>Lv. '+[...levels].sort((a,b)=>a-b).join(', ')+'</small>' : '')+'</li>').join('')+'</ul></div>';
    el('atlas-pool')?.addEventListener('change', e=>{
      const area=areas.get(e.target.value);
      location.hash=href({area:area.id,q:poolMatches(area,searchText(el('atlas-search').value)) ? el('atlas-search').value : ''});
    });
  }
  function show(reconcile=false) {
    const t=tab();
    const label=t==='maps' ? 'Find a map' : 'Find an area or monster';
    el('atlas-search-label').textContent=label;
    const query=params().get('q') || '';
    if (el('atlas-search').value!==query) el('atlas-search').value=query;
    el('atlas-game').value=params().get('game') || '';
    for (const link of document.querySelectorAll('[data-atlas-tab]')) {
      if (link.dataset.atlasTab===t) link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current');
    }
    const row=directory();
    if (!row) { el('atlas-detail').innerHTML='<p class="atlas-empty">No location selected. <a href="'+(t==='maps' ? '#atlas' : '#atlas?tab=encounters')+'">Clear filters</a></p>'; return 'Map atlas'; }
    const key=t==='maps' ? 'map' : 'area';
    if (reconcile===true && params().has(key) && params().get(key)!==row.id) {
      history.replaceState(null,'',href({[key]:row.id,variant:''}));
    }
    if (t==='maps') mapView(row); else encounters(row);
    return (params().has('map') || params().has('area')) ? row.title : 'Map atlas';
  }
  el('atlas-search').oninput=e=>{
    // Keep the shared URL on the same pool that the filtered directory displays.
    history.replaceState(null,'',href({q:e.target.value,page:''}));
    show(true);
  };
  el('atlas-game').onchange=e=>{
    location.hash=href({game:e.target.value,region:'',map:'',area:'',page:''});
  };
  el('atlas-region').onchange=e=>{ location.hash=href({region:e.target.value,map:'',area:'',page:''}); };
  function routeAreas(contexts) {
    return Object.entries(contexts || {}).map(([campaign,ids])=>({campaign,
      areas:ids.map(id=>areas.get(campaign+'-'+id)).filter(Boolean)}));
  }
  window.DQMAtlas = {show, placesForMaps, routeAreas};
})();
