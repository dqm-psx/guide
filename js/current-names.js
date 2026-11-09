/* Apply the checked public names before the atlas and field-guide directories
   build their indexes. Route IDs, map exits, prices and skill thresholds stay native. */
(function (root) {
  'use strict';
  function apply(reference, field, world, atlas) {
    const update = reference.guide_names;
    if (!update) return; // A previously checked-in snapshot may predate this feature.
    const rows = new Map([...field.entries, ...world.entries].map(row => [row.id,row]));
    for (const [id, patch] of Object.entries(update.entries)) {
      const row = rows.get(id);
      if (!row) throw new Error('Missing guide name target ' + id);
      for (const key of ['title','summary','region','key','places','details']) {
        if (patch[key] !== undefined) row[key] = patch[key];
      }
      if (patch.aliases) row.aliases = [...new Set([...(row.aliases || []), ...patch.aliases])];
      if (patch.priceLocations) row.prices.forEach((price,i) => { price.locations = patch.priceLocations[i]; });
    }
    for (const [id, item] of Object.entries(update.items)) {
      const row = rows.get(id);
      if (!row || row.source_ids[0] !== item.id) throw new Error('Item name identity differs for ' + id);
      row.title = item.title;
      row.names = item.names;
      row.aliases = [...new Set([...(row.aliases || []), ...item.aliases])];
    }
    field.skill_names = update.skills;
    for (const monster of reference.species) {
      for (const campaign of Object.values(monster.skills)) {
        for (const skill of campaign) {
          const name = update.skills[skill.id];
          if (!name || name.id !== skill.system_entry_id) throw new Error('Skill name identity differs for ' + skill.id);
          skill.aliases = name.aliases;
        }
      }
    }
    for (const map of atlas.maps) {
      const translated = update.maps[map.id];
      if (!translated) throw new Error('Missing map name ' + map.id);
      map.title = translated.title;
      map.aliases = translated.aliases;
    }
    for (const guide of [field, world]) {
      guide.provenance.name_source_url = reference.metadata?.source_url;
      guide.provenance.name_public_revision = reference.metadata?.public_revision;
    }
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = {apply};
  else apply(root.GUIDE_REFERENCE, root.FIELD_GUIDE, root.WORLD_GUIDE, root.PLAYER_ATLAS);
})(globalThis);
