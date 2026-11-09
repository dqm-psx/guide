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
    field.default_nicknames = update.default_nicknames || [];
    if (field.default_nicknames.length) {
      const id = 'field-default-nicknames';
      const directory = rows.get(id) || {id, kind:'mechanic', game:'both', title:'Default monster nicknames',
        summary:'Names given to starters, gifts and bosses when they join your party.', details:[], spoiler:'story'};
      const order = {starter:0, boss:1, gift:2};
      directory.nickname_rows = [...field.default_nicknames].sort((a,b) =>
        order[a.kind]-order[b.kind] || a.title.localeCompare(b.title,'en'));
      if (!rows.has(id)) field.entries.push(directory);
    }
    for (const id of new Set(field.default_nicknames.map(name => name.article_id).filter(Boolean))) {
      const article = rows.get(id);
      if (!article) throw new Error('Missing nickname target ' + id);
      article.default_nicknames = field.default_nicknames.filter(name => name.article_id === id);
    }
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
  // Both the interactive guide and its standalone HTML use these same rows.
  function nicknameMarkup(row, escape, articleLink) {
    if (row.nickname_rows) {
      const kinds = {starter:'Starter', boss:'Boss', gift:'Gift'};
      const body = row.nickname_rows.map(name => '<tr><th scope="row">'+escape(name.title)+'</th><td lang="ja">'+
        escape(name.japanese)+'</td><td>'+kinds[name.kind]+(name.article_id ? ' · '+articleLink(name.article_id) : '')+'</td></tr>').join('');
      return '<div class="guide-stock"><table class="nickname-table" aria-label="Default monster nicknames"><thead><tr><th>Nickname</th><th>Japanese</th><th>Source</th></tr></thead><tbody>'+body+'</tbody></table></div>';
    }
    const nicknames = (row.default_nicknames || []).filter(name => name.title !== row.title);
    if (!nicknames.length) return '';
    const label = row.id === 'npc-machiko' ? 'Gift nickname' : 'Default nickname';
    return '<p><strong>'+label+'</strong> · '+nicknames.map(name => escape(name.title)).join(', ')+'</p>';
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = {apply};
  else {
    root.DQMNicknameMarkup = nicknameMarkup;
    apply(root.GUIDE_REFERENCE, root.FIELD_GUIDE, root.WORLD_GUIDE, root.PLAYER_ATLAS);
  }
})(globalThis);
