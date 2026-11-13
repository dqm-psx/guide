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
      for (const key of ['title','summary','region','key','places','details','sections']) {
        if (patch[key] !== undefined) row[key] = patch[key];
      }
      if (patch.aliases) row.aliases = [...new Set([...(row.aliases || []), ...patch.aliases])];
      if (patch.priceLocations) row.prices.forEach((price,i) => { price.locations = patch.priceLocations[i]; });
    }
    for (const [id, item] of Object.entries(update.items)) {
      const row = rows.get(id);
      if (!row || row.source_ids[0] !== item.id) throw new Error('Item name identity differs for ' + id);
      row.title = item.title;
      if (item.description) row.menuDescription = item.description;
      if (item.descriptions) row.menuDescriptions = item.descriptions;
      row.names = item.names;
      row.aliases = [...new Set([...(row.aliases || []), ...item.aliases])];
      // Enhanced Arena rewards also make these formerly GreatLog-only items
      // obtainable by Terry. Native prices and descriptions stay unchanged.
      if (row.game === 'dqm2' && globalThis.DQM_PATCH_REWARDS?.items?.[id]?.some(source => source.game === 'dqm1')) row.game = 'both';
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
  function sectionText(section) {
    return [section.title,section.intro,...(section.paragraphs || []),...(section.bullets || []),
      ...(section.rows || []).flat(),section.table?.caption,...(section.table?.columns || []),...(section.table?.rows || []).flat()].filter(Boolean);
  }
  function articleSections(row, escape, prose, level, campaign, options = {}) {
    const heading = 'h' + level;
    const sections = row.sections || [];
    const ordered = campaign ? sections.filter(s => s.game === campaign).concat(sections.filter(s => s.game !== campaign)) : sections;
    const sectionId = section => section.id || String(sections.indexOf(section)+1);
    const toc = ordered.length > 2 && options.sectionHref ? '<nav class="article-contents" aria-label="In this article"><details'+(options.compactContents?'':' open')+'><summary>In this article</summary><ol>'+ordered.map(section=>
      '<li><a href="'+escape(options.sectionHref(sectionId(section)))+'">'+escape(section.title)+'</a></li>').join('')+'</ol></details></nav>' : '';
    return toc+ordered.map(section => {
      const id=sectionId(section);
      const headingMarkup='<'+heading+' id="article-section-'+escape(id)+'" tabindex="-1">'+escape(section.title)+'</'+heading+'>';
      const opening='<section class="route-section article-topic" aria-labelledby="article-section-'+escape(id)+'">'+headingMarkup;
      if(options.hiddenSection?.(section)) return opening+'<p>This section includes '+(section.spoiler==='ending'?'ending':'story')+
        ' spoilers.</p><button class="guide-action" type="button" data-reveal-section="'+escape(id)+'">Reveal this section</button></section>';
      const table=section.table;
      const numeric=table?.rows?.length && table.rows.every(cells=>cells.slice(1).every(cell=>/^\d+$/.test(String(cell))));
      const comparison=table && !numeric && row.id==='field-restored-content' && table.columns.length>2;
      const sources=(section.sources || []).filter(source=>/^https?:\/\//.test(source.url)).map(source=>
        '<a href="'+escape(source.url)+'" rel="noopener noreferrer">'+escape(source.label)+'</a>');
      const content=
        (section.intro ? '<p>'+prose(section.intro)+'</p>' : '')+
        (section.paragraphs || []).map(text=>'<p>'+prose(text)+'</p>').join('')+
        (section.rows?.length ? '<dl>'+section.rows.map(([label,text])=>'<dt>'+escape(label)+'</dt><dd>'+prose(text)+'</dd>').join('')+'</dl>' : '')+
        (table ? '<div class="article-table'+(comparison?' article-comparison':numeric?' article-numeric':'')+'" role="region" tabindex="0" aria-label="'+escape(table.caption || section.title)+'"><table role="table">'+
          (table.caption ? '<caption>'+escape(table.caption)+'</caption>' : '')+'<thead role="rowgroup"><tr role="row">'+table.columns.map(title=>'<th scope="col" role="columnheader">'+escape(title)+'</th>').join('')+'</tr></thead><tbody role="rowgroup">'+
          table.rows.map(cells=>'<tr role="row">'+cells.map((cell,i)=>i ? '<td role="cell" data-label="'+escape(table.columns[i])+'">'+prose(cell)+'</td>' : '<th scope="row" role="rowheader">'+prose(cell)+'</th>').join('')+'</tr>').join('')+'</tbody></table></div>' : '')+
        (section.bullets?.length ? '<ul>'+section.bullets.map(text=>'<li>'+prose(text)+'</li>').join('')+'</ul>' : '')+
        (section.links?.length && options.articleLink ? '<p class="article-topic-links">'+section.links.map(options.articleLink).filter(Boolean).join(' · ')+'</p>' : '')+
        (sources.length ? '<p class="article-sources"><span>Sources</span> · '+sources.join(' · ')+'</p>' : '');
      // Static pages remain useful without JavaScript, including spoiler controls.
      const guarded=options.collapseSpoilers && ['story','ending'].includes(section.spoiler);
      return opening+(guarded ? '<details class="article-spoilers"><summary>Reveal this section · '+
        (section.spoiler==='ending'?'ending':'story')+' spoilers</summary>'+content+'</details>' : content)+'</section>';
    }).join('');
  }
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
  if (typeof module !== 'undefined' && module.exports) module.exports = {apply,articleSections,sectionText};
  else {
    root.DQMArticleSections = articleSections;
    root.DQMSectionText = sectionText;
    root.DQMNicknameMarkup = nicknameMarkup;
    apply(root.GUIDE_REFERENCE, root.FIELD_GUIDE, root.WORLD_GUIDE, root.PLAYER_ATLAS);
  }
})(globalThis);
