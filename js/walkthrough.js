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

  function render(game, {byId, routes, escape, campaignLink, sectionLink, entryLink, questIndexLink, prose, title, hidden, places}) {
    const groups = chapters[game].map(([label, ids]) => {
      const rows = ids.map(id => byId.get('story-'+id));
      return {label:label || rows[0].region, rows};
    });
    const nav = '<nav class="walk-campaigns" aria-label="Walkthrough campaign">' +
      Object.keys(paths).map(key => campaignLink(key, key===game)).join('')+questIndexLink+'</nav>' +
      '<nav class="walk-contents" aria-label="Jump to a stage">'+groups.map(({label,rows}) =>
        sectionLink(rows[0],label)).join('')+'</nav>';

    function stageTable(stages, row) {
      if (!stages?.length) return '';
      return '<table class="walk-gates"><caption>Gates opened by each arena class</caption><thead><tr><th scope="col">Win</th><th scope="col">Gate and boss</th></tr></thead><tbody>' +
        stages.map(stage => '<tr><th scope="row">'+entryLink(stage.arena, null, row)+'</th><td>'+
          stage.gates.map(id => entryLink(id)+(routes[id]?.boss ? ' · '+entryLink(routes[id].boss) : '')).join('<br>')+
          '</td></tr>').join('')+'</tbody></table>';
    }

    function part(row) {
      const route = routes[row.id] || {};
      const label = '<h4 id="'+escape(row.id)+'" tabindex="-1">'+escape(title(row))+'</h4>';
      if (hidden(row)) return label+'<button type="button" class="guide-action" data-reveal-stage="'+escape(row.id)+'">Reveal this stage</button>';
      const used = new Set();
      const lines = [row.summary,...row.details].filter(Boolean).map(line=>'<li>'+prose(line,row,route,used)+'</li>');
      for (const stage of route.stages || []) used.add(stage.arena);
      const references = (row.related || []).filter(id => !used.has(id)).map(id => byId.get(id)).filter(Boolean);
      const referenceLine = (label, rows) => rows.length ? '<p class="walk-references"><strong>'+escape(label)+'</strong> · '+
        rows.map(ref => entryLink(ref.id, null, row)).join(' · ')+'</p>' : '';
      const quests = references.filter(ref => ref.kind === 'quest');
      const links = questPurposes.map(purpose => referenceLine(purpose.label,quests.filter(ref => purpose.groups.includes(ref.quest_group)))).join('') +
        referenceLine('Arena classes',quests.filter(ref => !ref.quest_group)) +
        (route.stages ? '' : referenceLine('Bosses',references.filter(ref => ref.kind === 'boss')));
      return label+'<ol class="article-steps">'+lines.join('')+'</ol>'+stageTable(route.stages,row)+
        links;
    }

    return nav+groups.map(({label,rows})=>{
      const area = rows.find(row=>!hidden(row))?.related?.find(id=>id.startsWith('location-') && id.endsWith('-world'));
      return '<section class="walk-stage route-section"><h3>'+escape(label)+'</h3>'+
        rows.map(part).join('')+(area ? '<p class="walk-region">'+places(area)+'</p>' : '')+'</section>';
    }).join('');
  }
  globalThis.DQMWalkthrough = {gameFor, paths, render, questPurposes, chaptersForQuest};
})();
