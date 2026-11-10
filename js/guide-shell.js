/* The homepage can navigate and search before loading the reference indexes. */
(() => {
  'use strict';
  const el = id => document.getElementById(id);
  const categories = {story:'Walkthroughs',quest:'Quests',npc:'Characters',boss:'Bosses',location:'Locations',
    item:'Items',tool:'Travel & exploration items',mechanic:'Mechanics',skill:'Skills',monster:'Monsters'};
  const {campaigns,places} = GUIDE_HOME;
  for (const node of document.querySelectorAll('[data-character]')) node.textContent = campaigns[node.dataset.character];
  for (const node of document.querySelectorAll('[data-place]')) node.textContent = places[node.dataset.place];
  const games = {dqm1:campaigns.terry, dqm2:campaigns.cobi+' & '+campaigns.tara};
  for (const option of el('guide-game').options) if (games[option.value]) option.textContent = games[option.value]+' · '+option.value.toUpperCase();
  for (const [id,title] of Object.entries(categories)) if (id !== 'monster') el('guide-kind').add(new Option(title,id));
  const form = el('guide-filters');
  const search = el('guide-search');
  const kind = el('guide-kind');
  const game = el('guide-game');
  const toggle = el('search-filter-toggle');
  const options = el('guide-filter-options');
  function setFiltersOpen(open) {
    options.hidden = !open;
    toggle.setAttribute('aria-expanded',String(open));
  }
  function syncScope() {
    search.placeholder = kind.value ? 'Search '+categories[kind.value].toLowerCase() : 'Search the guide';
    const scope = [games[game.value],categories[kind.value]].filter(Boolean).join(' · ');
    toggle.title = scope ? 'Search filters: '+scope : 'Search filters';
    toggle.classList.toggle('has-scope',Boolean(scope));
  }
  function syncSearch(params) {
    // A fresh article or walkthrough starts a guide-wide search. If the
    // reader followed a search result, keep that query and its filters.
    if (!params.has('q') && (params.has('entry') || params.get('kind') === 'story')) {
      params = new URLSearchParams();
    }
    search.value = params.get('q') || '';
    kind.value = params.get('kind') || '';
    game.value = params.get('game') || '';
    syncScope();
  }
  toggle.addEventListener('click',() => setFiltersOpen(options.hidden));
  form.addEventListener('keydown',event => {
    if (event.key === 'Escape' && !options.hidden) {
      event.preventDefault();
      setFiltersOpen(false);
      toggle.focus();
    }
  });
  form.addEventListener('focusout',event => {
    if (event.relatedTarget && !form.contains(event.relatedTarget)) setFiltersOpen(false);
  });
  document.addEventListener('pointerdown',event => {
    if (!form.contains(event.target)) setFiltersOpen(false);
  });
  function show() {
    el('guide-browser').hidden = false;
    el('guide-home').hidden = false;
    el('guide-directory').hidden = true;
    el('guide-article').hidden = true;
    return 'Guide home';
  }
  form.addEventListener('submit',event => {
    event.preventDefault();
    setFiltersOpen(false);
    DQMViews.search({submit:true});
  });
  search.addEventListener('input',() => DQMViews.search());
  for (const select of [kind,game]) select.addEventListener('change',() => {
    syncScope();
    DQMViews.search({push:true});
  });
  window.DQMGuideShell = Object.freeze({categories,show,syncSearch});
})();
