/* The campaign pages and their no-JavaScript editions use the same sections.
   Chapter IDs double as anchors for bookmarks from earlier guide versions. */
(() => {
  'use strict';
  const paths = {dqm1:'walkthroughs/terry/', dqm2:'walkthroughs/cobi-tara/'};
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

  function render(game, {byId, routes, escape, campaignLink, sectionLink, entryLink, prose, title, hidden, places}) {
    const groups = chapters[game].map(([label, ids]) => {
      const rows = ids.map(id => byId.get('story-'+id));
      return {label:label || rows[0].region, rows};
    });
    const nav = '<nav class="walk-campaigns" aria-label="Walkthrough campaign">' +
      Object.keys(paths).map(key => campaignLink(key, key===game)).join('')+'</nav>' +
      '<nav class="walk-contents" aria-label="Jump to a stage">'+groups.map(({label,rows}) =>
        sectionLink(rows[0],label)).join('')+'</nav>';

    function stageTable(stages) {
      if (!stages?.length) return '';
      return '<table class="walk-gates"><caption>Gates opened by each arena class</caption><thead><tr><th scope="col">Win</th><th scope="col">Gate and boss</th></tr></thead><tbody>' +
        stages.map(stage => '<tr><th scope="row">'+entryLink(stage.arena)+'</th><td>'+
          stage.gates.map(id => entryLink(id)+(routes[id]?.boss ? ' · '+entryLink(routes[id].boss) : '')).join('<br>')+
          '</td></tr>').join('')+'</tbody></table>';
    }

    function part(row) {
      const route = routes[row.id] || {};
      const label = '<h4 id="'+escape(row.id)+'" tabindex="-1">'+escape(title(row))+'</h4>';
      if (hidden(row)) return label+'<button type="button" class="guide-action" data-reveal-stage="'+escape(row.id)+'">Reveal this stage</button>';
      const used = new Set();
      const lines = [row.summary,...row.details].filter(Boolean).map(line=>'<li>'+prose(line,row,route,used)+'</li>');
      const referenceIds = (row.related || []).filter(id=>!used.has(id) &&
        (id.startsWith('quest-') || (!route.stages && id.startsWith('boss-'))));
      const stageIds = new Set((route.stages || []).map(stage=>stage.arena));
      const links = referenceIds.filter(id=>!stageIds.has(id)).map(id=>entryLink(id)).filter(Boolean);
      return label+'<ol class="article-steps">'+lines.join('')+'</ol>'+stageTable(route.stages)+
        (links.length ? '<p class="walk-references">'+links.join(' · ')+'</p>' : '');
    }

    return nav+groups.map(({label,rows})=>{
      const area = rows.find(row=>!hidden(row))?.related?.find(id=>id.startsWith('location-') && id.endsWith('-world'));
      return '<section class="walk-stage route-section"><h3>'+escape(label)+'</h3>'+
        rows.map(part).join('')+(area ? '<p class="walk-region">'+places(area)+'</p>' : '')+'</section>';
    }).join('');
  }
  globalThis.DQMWalkthrough = {gameFor, paths, render};
})();
