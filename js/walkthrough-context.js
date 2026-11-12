/* Join existing route, article and acquisition records for both guide editions. */
(() => {
  'use strict';

  function create({byId, routes, maps = [], itemReferences = {}, hidden = () => false}) {
    const mapById = new Map(maps.map(map => [map.id, map]));
    const visible = id => {
      const row = byId.get(id);
      return row && !hidden(row) ? row : null;
    };
    const unique = values => [...new Set(values)];
    const placeKey = id => mapById.get(id)?.placeId || id;

    function forStage(row) {
      if (hidden(row)) return {maps:[], people:[], bosses:[], places:[], items:[], finds:[]};
      const route = routes[row.id] || {};
      const related = unique(row.related || []).map(visible).filter(Boolean);
      const stageMaps = unique([...(row.map_ids || []), ...(route.maps || [])])
        .map(id => mapById.get(id)).filter(Boolean);
      const placeKeys = new Set(stageMaps.map(map => placeKey(map.id)));
      const quests = new Set(related.filter(ref => ref.kind === 'quest').map(ref => ref.id));
      const finds = [];
      for (const [id, reference] of Object.entries(itemReferences)) {
        const item = visible(id);
        if (!item) continue;
        const sources = (reference.sources || []).filter(source =>
          (!source.game || source.game === 'both' || source.game === row.game) &&
          ((source.map && placeKeys.has(placeKey(source.map))) || quests.has(source.entry)));
        if (sources.length) finds.push({item, sources});
      }
      const foundIds = new Set(finds.map(find => find.item.id));
      // These links are intentionally neutral: the historical `supplies` field
      // also contains keys and items obtained during the route, not just gear
      // that the player must bring.
      const items = unique([...(route.supplies || []), ...related.filter(ref => ref.kind === 'item' || ref.kind === 'tool').map(ref => ref.id)])
        .filter(id => !foundIds.has(id)).map(visible).filter(Boolean);
      const people = related.filter(ref => ref.kind === 'npc');
      for (const ref of byId.values()) {
        if (ref.kind === 'npc' && ref.related?.includes(row.id) && !hidden(ref) && !people.some(person => person.id === ref.id)) people.push(ref);
      }
      return {
        maps:stageMaps,
        people,
        bosses:related.filter(ref => ref.kind === 'boss'),
        places:related.filter(ref => ref.kind === 'location'),
        items,
        finds
      };
    }

    return {forStage, placeKey};
  }

  globalThis.DQMWalkthroughContext = {create};
})();
