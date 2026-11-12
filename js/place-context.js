/* Shared location/map relationships for the interactive guide and HTML build.
   Create after the campaign location entries have been added. All joins use
   map IDs, placeId, scene membership or campaign/context IDs, never titles.

   mapsForLocation returns canonical map records: entrances first, then route
   maps and other maps in that world. defaultMapForLocation selects the exact
   entrance floor or world overview. Shared entrances are not map ownership.
   entrancesForMap matches the exact layout image, not other floors in the
   same place. locationForMap returns its specific gate or its
   broader world overview. contextForMap labels that distinction with
   locationScope ("place", "region", or null); its other entry arrays contain
   only explicit associations with the selected place, not the whole region.
   An encounter belongs to a gate/world independently of any fixed map. */
(() => {
  'use strict';
  const regionLocations = {
    'terry-home':'location-terry-home',
    greatlog:'location-greatlog',
    desert:'location-desert-world',
    water:'location-water-world',
    ice:'location-ice-world',
    sky:'location-sky-world',
    between:'location-world-between-worlds'
  };
  const regionalIds = new Set(Object.values(regionLocations));
  const overviewMaps = {
    'location-greatlog':'map-12-0', 'location-desert-world':'map-17-1',
    'location-water-world':'map-18-1', 'location-ice-world':'map-19-1',
    'location-world-between-worlds':'map-51-0'
  };
  const values = rows => Array.from(rows?.values ? rows.values() : rows || []);

  function create({entries = [], routes = {}, scenes = {}, maps = [], entrances = {}, generation = {}} = {}) {
    const byEntry = new Map(values(entries).map(row=>[row.id,row]));
    const byMap = new Map(values(maps).map(map=>[map.id,map]));
    const gateEntrances = new Map();
    for (const [id,records] of Object.entries(entrances.entries || {})) {
      const location=byEntry.get(id);
      if (location?.kind !== 'location') continue;
      gateEntrances.set(id,records.filter(record=>byMap.has(record.map) &&
        Number.isFinite(record.x) && record.x>=0 && record.x<=1 &&
        Number.isFinite(record.y) && record.y>=0 && record.y<=1).map(record=>({...record,location})));
    }
    const mapFor = id => {
      const map=byMap.get(id);
      return map && (byMap.get(map.placeId) || map);
    };
    const mapIdsFor = row => [...(row.map_ids || []),...(routes[row.id]?.maps || []),
      ...(row.kind==='location' ? generation.entries?.[row.id]?.finalMaps || [] : [])];
    const canonicalMaps = ids => [...new Map(ids.map(mapFor).filter(Boolean).map(map=>[map.id,map])).values()];
    const byPlace = new Map();
    const byEncounter = new Map();
    const byScene = new Map();
    const locationMaps = new Map();
    function add(index,key,row) {
      if (!index.has(key)) index.set(key,new Map());
      index.get(key).set(row.id,row);
    }
    for (const [region,id] of Object.entries(regionLocations)) {
      const row=byEntry.get(id);
      if (row?.kind !== 'location') continue;
      for (const scene of scenes[region] || []) add(byScene,scene,row);
    }
    for (const row of byEntry.values()) {
      const direct=canonicalMaps(mapIdsFor(row));
      for (const map of direct) add(byPlace,map.id,row);
      if (row.kind !== 'location') continue;
      const region=Object.keys(regionLocations).find(key=>regionLocations[key]===row.id);
      const regionScenes=new Set(scenes[region] || []);
      locationMaps.set(row.id,canonicalMaps([
        ...(gateEntrances.get(row.id) || []).map(entrance=>entrance.map),
        ...direct.map(map=>map.id),
        ...[...byMap.values()].filter(map=>regionScenes.has(map.scene)).map(map=>map.id)
      ]));
      for (const [campaign,contexts] of Object.entries(routes[row.id]?.encounters || {})) {
        for (const context of contexts) add(byEncounter,campaign+'-'+context,row);
      }
    }
    const only = rows => rows.length === 1 ? rows[0] : null;
    function locationForMap(id) {
      const map=mapFor(id);
      if (!map) return null;
      const direct=values(byPlace.get(map.id)).filter(row=>row.kind==='location');
      const specific=direct.filter(row=>!regionalIds.has(row.id));
      if (specific.length) return only(specific);
      if (direct.length) return only(direct);
      return only(values(byScene.get(map.scene)));
    }
    function contextForMap(id) {
      const map=mapFor(id);
      const rows=map ? values(byPlace.get(map.id)) : [];
      const location=locationForMap(id);
      return {
        location,
        locationScope:location ? regionalIds.has(location.id) ? 'region' : 'place' : null,
        chapters:rows.filter(row=>row.kind==='story'),
        quests:rows.filter(row=>row.kind==='quest'),
        bosses:rows.filter(row=>row.kind==='boss'),
        characters:rows.filter(row=>row.kind==='npc')
      };
    }
    function charactersForLocation(id) {
      const location=byEntry.get(id);
      if (location?.kind!=='location') return {here:[],related:[]};
      // A gate's shared entrance room is not its destination. Use its final
      // area(s), then explicitly linked unlock quests for characters elsewhere.
      const places=location.game==='dqm1' ? canonicalMaps(mapIdsFor(location)) : locationMaps.get(id) || [];
      const here=new Map(places.flatMap(map=>values(byPlace.get(map.id)))
        .filter(row=>row.kind==='npc').map(row=>[row.id,row]));
      const quests=[...byEntry.values()].filter(row=>row.kind==='quest' &&
        (location.related?.includes(row.id) || row.related?.includes(id)));
      const related=[...byEntry.values()].filter(row=>row.kind==='npc' && !here.has(row.id) &&
        (location.related?.includes(row.id) || row.related?.includes(id) ||
          quests.some(quest=>quest.related?.includes(row.id) || row.related?.includes(quest.id))));
      const byName=(a,b)=>a.title.localeCompare(b.title);
      return {here:[...here.values()].sort(byName),related:related.sort(byName)};
    }
    return {
      charactersForLocation,
      locationsForCharacter:id => [...byEntry.values()].filter(row=>row.kind==='location' &&
        Object.values(charactersForLocation(row.id)).some(group=>group.some(character=>character.id===id))),
      mapsForLocation:id => [...(locationMaps.get(id) || [])],
      defaultMapForLocation:id => {
        const entrance=gateEntrances.get(id)?.[0];
        if (entrance) return byMap.get(entrance.map);
        const choices=locationMaps.get(id) || [];
        return choices.find(map=>map.id===overviewMaps[id]) || choices[0] || null;
      },
      entrancesForLocation:id => [...(gateEntrances.get(id) || [])],
      entrancesForMap:id => {
        const map=byMap.get(id);
        if (!map) return [];
        return [...gateEntrances.values()].flat().filter(entrance=>{
          if (entrance.map===id) return true;
          const source=byMap.get(entrance.map);
          return source.image && source.image===map.image && mapFor(source.id).id===mapFor(id).id;
        });
      },
      locationForMap,
      locationForEncounter:(campaign,context) => only(values(byEncounter.get(campaign+'-'+context))),
      contextForMap
    };
  }
  globalThis.DQMPlaceContext = {create};
})();
