/* Fixed field maps and wild encounter contexts have different native IDs.
   Keep the two indexes separate: a matching name does not place a monster on a tile. */
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const safe = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
  const names = window.DQMField.campaigns;
  for (const option of el('atlas-game').options) if (names[option.value]) option.textContent=names[option.value];
  const maps = new Map(PLAYER_ATLAS.maps.map(m => [m.id,m]));
  const context = DQMPlaceContext.create({entries:[...WORLD_GUIDE.entries,...FIELD_GUIDE.entries],
    routes:FIELD_ROUTES.routes,scenes:FIELD_ROUTES.scenes,maps:PLAYER_ATLAS.maps,entrances:globalThis.GATE_ENTRANCES,generation:globalThis.GATE_GENERATION});
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
  let directoryKey;
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
    const markup = '<p class="guide-count" role="status">'+count+(max>1 ? ' · Page '+page+' of '+max : '')+'</p>'+
      (links.length ? '<div class="atlas-scroll">'+Array.from(groupsOnPage,([id,items])=>'<h4>'+safe(regions[id])+'</h4>'+items.join('')).join('')+'</div>' : '')+
      (max>1 ? '<nav class="guide-pager" aria-label="Location pages">'+
        (page>1 ? '<a href="'+safe(href({page:String(page-1),[key]:'',variant:''}))+'">Previous</a>' : '')+
        (page<max ? '<a href="'+safe(href({page:String(page+1),[key]:'',variant:''}))+'">Next</a>' : '')+'</nav>' : '');
    const nextKey=JSON.stringify([tab(),inputGame,inputRegion,q,page]);
    const index=el('atlas-index');
    if (directoryKey===nextKey) {
      // A selection changes link destinations and the current marker, not the
      // list itself. Keep its DOM so scrolling and keyboard focus survive.
      const next=document.createElement('template');
      next.innerHTML=markup;
      const current=index.querySelectorAll('a');
      next.content.querySelectorAll('a').forEach((link,i)=>{
        current[i].setAttribute('href',link.getAttribute('href'));
        if (link.hasAttribute('aria-current')) current[i].setAttribute('aria-current','true');
        else current[i].removeAttribute('aria-current');
      });
    } else index.innerHTML=markup;
    directoryKey=nextKey;
    if (!selected) return null;
    if (requested && !previous && !q && !inputGame && !inputRegion) return null;
    return isMap ? (previous===selected ? requestedMap : maps.get(selected.id)) : choice(selected,q);
  }
  function articleHref(row, section) {
    const query=new URLSearchParams({kind:row.kind,game:row.game,entry:row.id});
    if (section) query.set('section',section);
    return '#field-guide?'+query;
  }
  function contextMarkup(row) {
    const info=context.contextForMap(row.id);
    const visible=entry=>entry && !window.DQMField.guarded(entry);
    const location=visible(info.location) ? info.location : null;
    const articleLink=entry=>'<a href="'+safe(articleHref(entry))+'">'+safe(entry.title)+'</a>';
    const groups=[['Walkthrough',info.chapters],['Quests',info.quests],['Bosses',info.bosses]]
      .map(([label,entries])=>[label,entries.filter(visible)]).filter(([,entries])=>entries.length);
    const encounterGroups=location && FIELD_ROUTES.routes[location.id]?.encounters;
    const hasEncounters=encounterGroups && Object.values(encounterGroups).some(ids=>ids.length);
    const owner=location ? '<p class="map-location-guide">'+articleLink(location)+
      (hasEncounters ? ' · <a href="'+safe(articleHref(location,'encounters'))+'">'+safe(location.title)+' encounters</a>' : '')+'</p>' : '';
    const summary=location?.summary ? '<p>'+safe(location.summary)+'</p>' : '';
    const links=groups.length ? '<dl class="map-guide-links">'+groups.map(([label,entries])=>
      '<div><dt>'+label+'</dt><dd>'+entries.map(articleLink).join(' · ')+'</dd></div>').join('')+'</dl>' : '';
    return owner || links ? '<section class="map-guide-context" aria-label="Location guide">'+owner+summary+links+'</section>' : '';
  }
  function renderMap(detail,row,options={}) {
    const place = places.get(placeId(row));
    const layout = layoutFor.get(row.id);
    const arrival = row.arrivalVariants?.find(v=>v.id===options.variant);
    const imageFile = arrival?.image || row.image;
    const prefix=options.prefix || 'atlas';
    const level=options.inline ? 4 : 3;
    const valid=Array.from(new Map(row.exits.filter(exit=>maps.has(exit.to)).map(exit=>[exitKey(exit),exit])).values());
    const doorHref = exit => safe(options.href(exit.to,exit.variant || ''));
    const doorData = exit => ' data-map-id="'+safe(exit.to)+'" data-map-variant="'+safe(exit.variant || '')+'"';
    const pins=valid.map((exit,i)=>Number.isFinite(exit.x) && Number.isFinite(exit.y) ?
      '<a class="map-pin" style="left:'+exit.x*100+'%;top:'+exit.y*100+'%" href="'+doorHref(exit)+'"'+doorData(exit)+' aria-label="Exit '+(i+1)+' to '+safe(maps.get(exit.to).title)+'">'+(i+1)+'</a>' : '').join('');
    const doors=valid.map(exit=>'<li><a href="'+doorHref(exit)+'"'+doorData(exit)+'>'+safe(maps.get(exit.to).title)+'</a>'+
      (places.get(placeId(maps.get(exit.to))).layouts.length>1 ? ' <small>Layout '+layoutFor.get(exit.to).number+'</small>' : '')+'</li>').join('');
    const portals=(context.entrancesForMap?.(row.id) || []).filter(entrance=>entrance.location &&
      Number.isFinite(entrance.x) && Number.isFinite(entrance.y) &&
      entrance.x>=0 && entrance.x<=1 && entrance.y>=0 && entrance.y<=1 &&
      (!options.gateId || entrance.location.id===options.gateId));
    const portalName=entrance=>window.DQMField.guarded(entrance.location) ? 'Gate · spoiler hidden' : entrance.location.title;
    const portalPins=portals.map((entrance,i)=>{
      const title=portalName(entrance);
      const position=' style="left:'+entrance.x*100+'%;top:'+entrance.y*100+'%"';
      if (options.gateId) {
        const edge=entrance.x<.25 ? ' gate-label-right' : entrance.x>.75 ? ' gate-label-left' : '';
        return '<span class="map-pin map-gate-pin map-gate-selected'+edge+(entrance.y<.15?' gate-label-below':'')+'"'+position+
          ' data-gate-id="'+safe(entrance.location.id)+'" role="img" aria-label="Entrance to '+safe(title)+'"><span class="gate-pin-label" aria-hidden="true">'+safe(title)+'</span></span>';
      }
      return '<a class="map-pin map-gate-pin"'+position+' data-gate-id="'+safe(entrance.location.id)+'" href="'+safe(articleHref(entrance.location))+
        '" aria-label="Gate portal G'+(i+1)+': '+safe(title)+'" title="'+safe(title)+'">G'+(i+1)+'</a>';
    }).join('');
    const portalLegend=!options.gateId && portals.length ? '<section class="map-gate-legend" aria-label="Gate portals"><h4>Gate portals</h4><ul class="gate-portal-links">'+
      portals.map((entrance,i)=>'<li><a href="'+safe(articleHref(entrance.location))+'"><span class="gate-marker-key">G'+(i+1)+'</span> '+safe(portalName(entrance))+'</a>'+
        (entrance.note && !window.DQMField.guarded(entrance.location) ? '<small>'+safe(entrance.note)+'</small>' : '')+'</li>').join('')+'</ul></section>' : '';
    const npcs=context.contextForMap(row.id).characters.filter(r=>!window.DQMField.guarded(r));
    const floorLabel=map=>{
      const floors=[...new Set((context.entrancesForMap?.(map.id) || []).map(entrance=>entrance.floor).filter(Boolean))];
      return floors.length===1 ? floors[0] : '';
    };
    const layouts = place.layouts.map(l=>({id:l.map.id, label:floorLabel(l.map) || String(l.number), selected:l===layout&&!arrival}));
    for (const map of place.records) {
      for (const variant of map.arrivalVariants || []) {
        const from=variant.from.map(id=>layoutFor.get(id)).filter(Boolean);
        const label=layoutFor.get(map.id).number+' · from '+from.map(l=>l.map.title+' (layout '+l.number+')').join(', ');
        layouts.push({id:map.id+':'+variant.id, label, selected:arrival===variant});
      }
    }
    const picker = layouts.length > 1 ? '<label class="atlas-layout-picker">'+(floorLabel(row)?'Floor':'Layout')+' <select id="'+prefix+'-layout-select" data-map-control="layout">'+
      layouts.map(l=>'<option value="'+safe(l.id)+'"'+(l.selected?' selected':'')+'>'+safe(l.label)+'</option>').join('')+'</select></label>' : '';
    const region=options.caption || subtitle(row, false);
    detail.innerHTML='<div class="atlas-caption"><div>'+(region ? '<small>'+safe(region)+'</small>' : '')+'<h'+level+' id="'+prefix+'-location" data-map-control="title" tabindex="-1">'+safe(row.title)+'</h'+level+'></div><div class="map-controls">'+
      picker+(pins ? '<label><input type="checkbox" id="'+prefix+'-pins" data-map-control="pins" checked> Exit pins</label>' : '')+
      (portalPins ? '<label><input type="checkbox" id="'+prefix+'-gates" data-map-control="gates" checked> Gate portals</label>' : '')+
      '<button type="button" id="'+prefix+'-zoom" data-map-control="zoom" aria-pressed="false">Zoom in</button></div></div>'+
      '<div class="map-scroll" tabindex="0" aria-label="Scrollable field map"><div class="map-image"><img src="maps/'+safe(imageFile)+'" alt="Static field layout of '+safe(row.title)+'"><div class="map-pins">'+pins+'</div><div class="map-gate-pins">'+portalPins+'</div></div></div>'+
      '<div class="map-notes">'+portalLegend+(doors ? '<h4>Connected maps</h4><ol class="map-doors">'+doors+'</ol>' : '')+
      (npcs.length ? '<p><strong>Characters</strong> · '+npcs.map(n=>'<a href="#field-guide?entry='+safe(n.id)+'">'+safe(n.title)+'</a>').join(' · ')+'</p>' : '')+
      (options.inline ? '' : contextMarkup(row))+'</div>';
    const control=name=>detail.querySelector('[data-map-control="'+name+'"]');
    control('layout')?.addEventListener('change',e=>{
      const [map,variant] = e.target.value.split(':');
      options.select(map,variant || '');
    });
    const image=detail.querySelector('.map-image img');
    image.onerror=()=>{ if (!image.isConnected) return; const message=document.createElement('p'); message.className='map-unavailable';
      message.textContent='Map image unavailable. Open this location online once to cache its image.'; image.closest('.map-scroll').replaceChildren(message); control('zoom').disabled=true;
      if (control('pins')) control('pins').disabled=true; if (control('gates')) control('gates').disabled=true; };
    control('pins')?.addEventListener('change', e=>{ detail.querySelector('.map-pins').hidden=!e.target.checked; });
    control('gates')?.addEventListener('change', e=>{ detail.querySelector('.map-gate-pins').hidden=!e.target.checked; });
    control('zoom').onclick=e=>{
      const on=detail.querySelector('.map-scroll').classList.toggle('zoomed');
      e.currentTarget.setAttribute('aria-pressed',String(on)); e.currentTarget.textContent=on ? 'Fit map' : 'Zoom in';
    };
    if (options.intercept) for (const link of detail.querySelectorAll('a[data-map-id]')) link.onclick=e=>{
      if (e.button || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      if (options.intercept(link.dataset.mapId,link.dataset.mapVariant)) e.preventDefault();
    };
  }
  function mapView(row) {
    renderMap(el('atlas-detail'),row,{
      variant:params().get('variant'),
      href:(map,variant)=>href({map,variant,q:'',page:'',region:'',game:''}),
      select:(map,variant)=>{ location.hash=href({map,variant}); }
    });
  }
  let viewerNumber=0;
  function mountLocationMaps(root,locationId,options={}) {
    const choices=context.mapsForLocation(locationId);
    if (!root || !choices.length) return false;
    const entrances=context.entrancesForLocation?.(locationId) || [];
    const gate=[...WORLD_GUIDE.entries,...FIELD_GUIDE.entries].some(row=>row.id===locationId && row.game==='dqm1');
    const entranceFor=map=>entrances.find(entrance=>maps.has(entrance.map) && placeId(maps.get(entrance.map))===placeId(map));
    const choiceTarget=map=>entranceFor(map)?.map || map.id;
    const choiceLabel=map=>{
      const entrance=entranceFor(map);
      const role=entrances.length ? entrance ? 'Entrance · ' : 'Final area · ' : '';
      return role+map.title+
        (places.get(placeId(map)).locationNumber ? ' · Location '+places.get(placeId(map)).locationNumber : '');
    };
    const available=new Set(choices.map(placeId));
    const belongs=id=>maps.has(id) && available.has(placeId(maps.get(id)));
    let selected=belongs(options.mapId) ? maps.get(options.mapId) : context.defaultMapForLocation(locationId);
    let variant=options.variant || '';
    const prefix='location-map-'+(++viewerNumber);
    const inlineHref=options.href || ((map,variant)=>{
      const query=params();
      query.set('entry',locationId);
      query.set('map',map);
      if (variant) query.set('variant',variant); else query.delete('variant');
      return '#field-guide?'+query;
    });
    const mapHref=(map,variant)=>belongs(map) ? inlineHref(map,variant) :
      '#atlas?'+new URLSearchParams({map,...(variant ? {variant} : {})});
    if (gate) {
      // Entrances and final areas are separate destinations, not alternative
      // views of one map. Keep both on the page and redraw only the place
      // whose floor changed, leaving the other map and its controls intact.
      root.classList.add('gate-map-grid');
      const panels=new Map(choices.map((map,i)=>{
        const entrance=entranceFor(map);
        const requested=placeId(map)===placeId(selected);
        return [placeId(map),{map:requested ? selected : maps.get(choiceTarget(map)),
          variant:requested ? variant : '',prefix:prefix+'-'+i,
          caption:entrance ? 'Entrance' : 'Final area',role:entrance ? 'entrance' : 'final'}];
      }));
      root.innerHTML=Array.from(panels,([id,panel])=>'<section class="location-map-section" data-map-place="'+safe(id)+
        '" data-map-role="'+panel.role+'" aria-label="'+panel.caption+' · '+safe(panel.map.title)+'" tabindex="-1"'+
        (id===placeId(selected) ? ' id="gate-map-selected"' : '')+'><div class="location-map-view"></div></section>').join('');
      for (const [id,panel] of panels) panel.element=root.querySelector('[data-map-place="'+id+'"] .location-map-view');
      function selectPanel(map,nextVariant='') {
        if (!belongs(map)) return false;
        const panel=panels.get(placeId(maps.get(map)));
        const focused=panel.element.contains(document.activeElement) ? document.activeElement.dataset.mapControl || 'title' : null;
        const scroll={left:window.scrollX,top:window.scrollY,behavior:'instant'};
        panel.map=maps.get(map); panel.variant=nextVariant;
        root.querySelector('#gate-map-selected')?.removeAttribute('id');
        panel.element.parentElement.id='gate-map-selected';
        history.replaceState(history.state,'',new URL(inlineHref(map,nextVariant),location.href));
        drawPanel(panel);
        if (focused) panel.element.querySelector('[data-map-control="'+focused+'"]')?.focus({preventScroll:true});
        window.scrollTo(scroll);
        window.dispatchEvent(new Event('guide-view-rendered'));
        return true;
      }
      function drawPanel(panel) {
        renderMap(panel.element,panel.map,{inline:true,prefix:panel.prefix,variant:panel.variant,caption:panel.caption,
          href:mapHref,select:selectPanel,intercept:selectPanel,gateId:locationId});
      }
      for (const panel of panels.values()) drawPanel(panel);
      return true;
    }
    root.classList.remove('gate-map-grid');
    function select(map,nextVariant='') {
      if (!belongs(map)) return false;
      const focused=root.contains(document.activeElement) ? document.activeElement.dataset.mapControl || 'title' : null;
      const scroll={left:window.scrollX,top:window.scrollY,behavior:'instant'};
      selected=maps.get(map); variant=nextVariant;
      history.replaceState(history.state,'',new URL(inlineHref(map,variant),location.href));
      draw();
      if (focused) root.querySelector('[data-map-control="'+focused+'"]')?.focus({preventScroll:true});
      window.scrollTo(scroll);
      window.dispatchEvent(new Event('guide-view-rendered'));
      return true;
    }
    function draw() {
      root.innerHTML='<div class="location-map-view"></div>';
      renderMap(root.querySelector('.location-map-view'),selected,{inline:true,prefix,variant,href:mapHref,select,intercept:select,
        gateId:entrances.length ? locationId : null});
      if (choices.length>1) {
        const title=root.querySelector('[data-map-control="title"]');
        title.classList.add('sr-only');
        title.parentElement.querySelector('small')?.remove();
        title.insertAdjacentHTML('afterend','<label class="location-map-picker"><span class="sr-only">Map</span><select data-map-control="place">'+choices.map(map=>
          '<option value="'+safe(choiceTarget(map))+'"'+(placeId(map)===placeId(selected) ? ' selected' : '')+'>'+safe(choiceLabel(map))+'</option>').join('')+'</select></label>');
      }
      root.querySelector('[data-map-control="place"]')?.addEventListener('change',e=>select(e.target.value));
    }
    draw();
    return true;
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
    const owner=context.locationForEncounter(row.game,row.context);
    const ownerLink=owner && !window.DQMField.guarded(owner) ? '<div class="map-notes"><p><a href="'+safe(articleHref(owner))+'">'+safe(owner.title)+' guide and maps</a></p></div>' : '';
    el('atlas-detail').innerHTML='<div class="atlas-caption"><div><small>'+safe(subtitle(row))+'</small><h3 id="atlas-location" tabindex="-1">'+safe(row.title)+'</h3></div>'+selector+'</div>'+
      '<div class="encounters"><ul aria-label="Wild monsters">'+entries.map(([id,levels])=>
        '<li>'+spriteLabel(id,GUIDE_REFERENCE.species[id].display_name)+(levels.size ? '<small>Lv. '+[...levels].sort((a,b)=>a-b).join(', ')+'</small>' : '')+'</li>').join('')+'</ul></div>'+ownerLink;
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
  window.DQMAtlas = {show, placesForMaps, routeAreas, mountLocationMaps, context, get directoryKey() { return directoryKey; }};
})();
