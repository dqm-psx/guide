/* The campaign pages and their no-JavaScript editions use the same sections.
   Chapter IDs double as anchors for bookmarks from earlier guide versions. */
(() => {
  'use strict';
  const paths = {dqm1:'walkthroughs/terry/', dqm2:'walkthroughs/cobi-tara/'};
  const questPurposes = [
    {key:'story', label:'Main story', groups:['Story quests']},
    {key:'optional', label:'Optional quests', groups:['Hidden gates and favors','Optional quests']},
    {key:'postgame', label:'Postgame', groups:['Postgame']}
  ];
  const chapters = {
    dqm1: [
      [null, ['terry-opening']],
      ['Arena classes', ['terry-early-arena','terry-anger','terry-upper-arena']],
      ['Starry Night', ['terry-mirror']],
      ['Optional gates and gifts', ['terry-optional-gates','terry-collection']],
      ['Postgame', ['terry-postgame']]
    ],
    dqm2: [
      [null, ['cobi-tara-opening']],
      [null, ['desert-assia','desert-mirage']],
      [null, ['pirate-mermaids','pirate-mirror']],
      [null, ['ice-northden','ice-westernia','ice-shield','ice-eastoria']],
      [null, ['sky-ugor','sky-treasures','sky-demon-lord']],
      ['Final world', ['between-worlds']],
      ['Postgame', ['greatlog-postgame','greatlog-spirit-rewards']]
    ]
  };

  function gameFor(params, byId) {
    const id = params.get('entry');
    if (id) {
      const row = byId.get(id);
      return row?.kind === 'story' ? row.game : '';
    }
    if (params.get('kind') !== 'story' || params.get('q')?.trim()) return '';
    const game = params.get('game') || 'dqm1';
    return Object.hasOwn(paths,game) ? game : '';
  }

  // Some stage references point from the walkthrough to the quest, others
  // from the quest back to the stage. Keep the links in walkthrough order.
  function chaptersForQuest(row, byId) {
    if (row?.kind !== 'quest') return [];
    return chapters[row.game].flatMap(([, ids]) => ids.map(id => byId.get('story-'+id)))
      .filter(stage => row.related?.includes(stage.id) || stage.related?.includes(row.id));
  }

  function render(game, {byId, routes, escape, campaignLink, sectionLink, entryLink, questIndexLink, prose, title, hidden, places,
    maps = [], itemReferences = {}, mapHref, mapImage, entryArt}) {
    const groups = chapters[game].map(([label, ids]) => {
      const rows = ids.map(id => byId.get('story-'+id));
      return {label:label || rows[0].region, rows};
    });
    const nav = '<nav class="walk-campaigns" aria-label="Walkthrough campaign">' +
      Object.keys(paths).map(key => campaignLink(key, key===game)).join('')+questIndexLink+'</nav>' +
      '<nav class="walk-contents" aria-label="Jump to a stage">'+groups.map(({label,rows}) =>
        sectionLink(rows[0],label)).join('')+'</nav>';
    const context = globalThis.DQMWalkthroughContext?.create({byId,routes,maps,itemReferences,hidden});
    const illustratedPlaces = new Set();

    function contextMarkup(row) {
      if (!context) return {aside:'',resources:''};
      const data = context.forStage(row);
      const blocks = [];
      const resources = [];
      const section = (label,content,css='') => content ? '<section'+(css ? ' class="'+css+'"' : '')+'><h5>'+escape(label)+'</h5>'+content+'</section>' : '';
      const mapLink = map => '<a href="'+escape(mapHref(map,row))+'">'+escape(map.title)+'</a>';
      if (data.maps.length && mapHref) {
        // Show at most one new place per stage. Revisited maps remain linked,
        // without repeating large thumbnails in neighboring route sections.
        const preview = mapImage && data.maps.find(map => !illustratedPlaces.has(context.placeKey(map.id)));
        let image = '';
        if (preview) {
          illustratedPlaces.add(context.placeKey(preview.id));
          image = '<figure class="walk-map-preview" data-map="'+escape(preview.id)+'"><a href="'+escape(mapHref(preview,row))+'">'+
            '<img src="'+escape(mapImage(preview))+'" alt="" loading="lazy" decoding="async">'+
            '<span class="walk-map-caption">'+escape(preview.title)+'</span></a></figure>';
        }
        const links = data.maps.filter(map => map !== preview);
        blocks.push(section('Maps on this route',image+(links.length ? '<ul class="walk-map-list">'+
          links.map(map=>'<li>'+mapLink(map)+'</li>').join('')+'</ul>' : '')));
      }
      const identities = rows => '<ul class="walk-people">'+rows.map(ref => {
        const art = entryArt?.(ref,data.maps.map(map=>map.id)) || '';
        return '<li>'+(art ? '<span class="walk-person-art" aria-hidden="true">'+art+'</span>' : '')+
          entryLink(ref.id,null,row)+'</li>';
      }).join('')+'</ul>';
      if (data.people.length) resources.push(section('People and dialogue',identities(data.people),'walk-contacts'));
      if (data.bosses.length && !routes[row.id]?.stages) resources.push(section('Bosses',identities(data.bosses)));
      if (data.places.length) resources.push(section('Locations and encounters','<ul>'+data.places.map(ref=>
        '<li>'+entryLink(ref.id,null,row)+'</li>').join('')+'</ul>'));
      if (data.items.length) resources.push(section('Items in this chapter','<p>'+data.items.map(item=>entryLink(item.id,null,row)).join(' · ')+'</p>'));
      if (data.finds.length) {
        const findList = finds => '<ul class="walk-finds">'+finds.map(({item,sources})=>'<li>'+entryLink(item.id,null,row)+
          sources.map(source=>'<small>'+(source.shop ? 'Shop · ' : '')+escape(source.text)+'</small>').join('')+'</li>').join('')+'</ul>';
        const rest = data.finds.slice(3);
        resources.push(section('Where to get items',findList(data.finds.slice(0,3))+(rest.length ?
          '<details><summary>'+rest.length+' more items</summary>'+findList(rest)+'</details>' : ''),'walk-acquisitions'));
      }
      return {
        aside:blocks.length ? '<aside class="walk-context" aria-label="'+escape(title(row))+' reference">'+blocks.join('')+'</aside>' : '',
        resources:resources.length ? '<div class="walk-resources">'+resources.join('')+'</div>' : ''
      };
    }

    function stageTable(stages, row) {
      if (!stages?.length) return '';
      return '<table class="walk-gates"><caption>Gates opened by each arena class</caption><thead><tr><th scope="col">Win</th><th scope="col">Gate and boss</th></tr></thead><tbody>' +
        stages.map(stage => '<tr><th scope="row">'+entryLink(stage.arena, null, row)+'</th><td>'+
          stage.gates.map(id => entryLink(id,null,row)+(routes[id]?.boss ? ' · '+entryLink(routes[id].boss,null,row) : '')).join('<br>')+
          '</td></tr>').join('')+'</tbody></table>';
    }

    function part(row) {
      const route = routes[row.id] || {};
      const label = '<h4 id="'+escape(row.id)+'" tabindex="-1">'+escape(title(row))+'</h4>';
      if (hidden(row)) return '<div class="walk-part">'+label+'<button type="button" class="guide-action" data-reveal-stage="'+escape(row.id)+'">Reveal this stage</button></div>';
      const used = new Set();
      const objective = row.summary ? '<p class="walk-objective">'+prose(row.summary,row,route,used)+'</p>' : '';
      const lines = (row.details || []).filter(Boolean).map(line=>'<li>'+prose(line,row,route,used)+'</li>');
      for (const stage of route.stages || []) used.add(stage.arena);
      const references = (row.related || []).filter(id => !used.has(id)).map(id => byId.get(id)).filter(Boolean);
      const referenceLine = (label, rows) => rows.length ? '<p class="walk-references"><strong>'+escape(label)+'</strong> · '+
        rows.map(ref => entryLink(ref.id, null, row)).join(' · ')+'</p>' : '';
      const quests = references.filter(ref => ref.kind === 'quest');
      const links = questPurposes.map(purpose => referenceLine(purpose.label,quests.filter(ref => purpose.groups.includes(ref.quest_group)))).join('') +
        referenceLine('Arena classes',quests.filter(ref => !ref.quest_group)) +
        (context || route.stages ? '' : referenceLine('Bosses',references.filter(ref => ref.kind === 'boss')));
      const reference = contextMarkup(row);
      return '<div class="walk-part">'+label+'<div class="walk-part-layout"><div class="walk-route">'+objective+
        (lines.length ? '<ol class="article-steps">'+lines.join('')+'</ol>' : '')+stageTable(route.stages,row)+links+
        '</div>'+reference.aside+'</div>'+reference.resources+'</div>';
    }

    return nav+groups.map(({label,rows},index)=>{
      const area = rows.find(row=>!hidden(row))?.related?.find(id=>id.startsWith('location-') && id.endsWith('-world'));
      const next = groups[index+1]?.rows[0];
      return '<section class="walk-stage route-section"><h3 class="walk-stage-heading"><span class="walk-stage-number" aria-hidden="true">'+
        String(index+1).padStart(2,'0')+'</span>'+escape(label)+'</h3>'+
        rows.map(part).join('')+(!context && area ? '<p class="walk-region">'+places(area)+'</p>' : '')+
        (next ? '<nav class="walk-next" aria-label="Next walkthrough chapter"><span>Next chapter</span>'+sectionLink(next,title(next))+'</nav>' : '')+'</section>';
    }).join('');
  }
  globalThis.DQMWalkthrough = {gameFor, paths, render, questPurposes, chaptersForQuest};
})();
