/* The homepage can navigate and search before loading the reference indexes. */
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const categories = {story:'Walkthroughs',quest:'Quests',npc:'Characters',boss:'Bosses',location:'Locations',
    item:'Items',tool:'Tools',article:'Gameplay articles',skill:'Skills',monster:'Monsters'};
  const {campaigns,places} = GUIDE_HOME;
  for (const node of document.querySelectorAll('[data-character]')) node.textContent = campaigns[node.dataset.character];
  for (const node of document.querySelectorAll('[data-place]')) node.textContent = places[node.dataset.place];
  const games = {dqm1:campaigns.terry, dqm2:campaigns.cobi+' & '+campaigns.tara};
  for (const option of el('guide-game').options) if (games[option.value]) option.textContent = games[option.value]+' · '+option.value.toUpperCase();
  for (const [id,title] of Object.entries(categories)) if (id !== 'monster') el('guide-kind').add(new Option(title,id));
  function show() {
    el('guide-filters').hidden = false;
    el('guide-browser').hidden = false;
    el('guide-home').hidden = false;
    el('guide-directory').hidden = true;
    el('guide-article').hidden = true;
    return 'Guide home';
  }
  // Keep keyboard focus and any further typing while the first query loads.
  let action = 0;
  async function input(submit) {
    const token = ++action, origin = location.href;
    try {
      await DQMAssets.ready('guide','#guide?q=search');
      if (token === action && location.href === origin) window.DQMField.filter(submit);
    } catch {
      if (location.href === origin) {
        const params = new URLSearchParams();
        for (const [key,id] of [['q','guide-search'],['kind','guide-kind'],['game','guide-game']]) {
          if (el(id).value) params.set(key,el(id).value);
        }
        if (params.size) location.hash = 'guide?'+params;
      }
    }
  }
  el('guide-filters').onsubmit = event => { event.preventDefault(); input(true); };
  el('guide-search').oninput = () => input(false);
  el('guide-kind').onchange = el('guide-game').onchange = () => input(true);
  window.DQMGuideShell = Object.freeze({categories,show});
})();
