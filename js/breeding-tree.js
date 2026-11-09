/* Branching recipe explorer. Reuses the verified PSX planner and keeps its
   compact, species-ID-based state separate from teams and personal rosters. */
(function (root) {
  'use strict';
  const MAX_SHARED_LENGTH = 12000;
  const MAX_DEPTH = 8;
  const MAX_NODES = 63;
  const CONTEXTS = ['shrine', 'room', 'base'];

  function create(data, plannerModule, coreModule) {
    const planner = plannerModule.create(data, coreModule);
    const cache = new Map();
    function recipes(index, context) {
      const key = index + ':' + context;
      if (!cache.has(key)) cache.set(key, planner.suggestions(index, { context, pageSize: 100000 }).items);
      return cache.get(key);
    }
    function at(plan, path) {
      if (typeof path !== 'string' || !/^[01]{0,8}$/.test(path)) return null;
      let node = planner.nodeById(plan, plan.rootId);
      for (const slot of path) {
        if (!node || !node.children) return null;
        node = planner.nodeById(plan, node.children[Number(slot)]);
      }
      return node;
    }
    function candidates(plan, path) {
      const node = at(plan, path);
      if (!node || node.speciesIndex === null) return { items: [], excluded: 0 };
      const ancestors = planner.ancestorSpecies(plan, node.id);
      const all = recipes(node.speciesIndex, plan.context);
      const items = all.filter(recipe => recipe.parents.every(index => index === null || !ancestors.includes(index)));
      return { items, excluded: all.length - items.length };
    }
    function choose(plan, path, recipeId) {
      const node = at(plan, path);
      if (!node || node.speciesIndex === null) throw new Error('Choose a monster branch first.');
      if (path.length >= MAX_DEPTH) throw new Error('This tree has reached its eight-generation display limit.');
      const recipe = candidates(plan, path).items.find(item => item.id === recipeId);
      if (!recipe) throw new Error('This recipe is unavailable here or would loop back to an ancestor.');
      const next = node.children ? planner.replaceRecipe(plan, node.id, recipe).plan : planner.expand(plan, node.id, recipe);
      if (next.nodes.length > MAX_NODES) throw new Error('This tree has reached its 63-monster limit. Clear a branch to explore another route.');
      return next;
    }
    function clear(plan, path) {
      const node = at(plan, path);
      if (!node) throw new Error('This branch no longer exists.');
      return planner.collapse(plan, node.id);
    }
    function conditions(recipe) {
      if (recipe.kind === 'plus_threshold') return 'Either parent must be +' + recipe.minPlus + ' or higher; do not add the parents’ + values together.';
      if (recipe.kind === 'flag_gated') return 'Two-save Breeding room only. This recipe overrides ordinary shrine results.';
      if (recipe.context === 'base') return 'Base table only. Parent + values and Breeding room overrides are not applied.';
      const rule = data.runtime_rules.rules.find(item => item.kind === 'plus_threshold' && item.pedigree_index === recipe.parents[0] && item.mate_index === recipe.parents[1]);
      return rule ? 'Both parents must be below +' + rule.minimum_parent_plus + '; a higher + value changes the offspring.' : '';
    }
    function snapshot(plan, collapsed) {
      const branches = [];
      function visit(path) {
        const node = at(plan, path);
        if (!node || !node.recipe) return;
        const recipe = recipes(node.speciesIndex, plan.context).find(item => item.parents[0] === node.recipe.parents[0] && item.parents[1] === node.recipe.parents[1] && item.kind === node.recipe.kind);
        if (recipe) branches.push([path, recipe.id, collapsed && collapsed.has(path) ? 1 : 0]);
        if (node.children) { visit(path + '0'); visit(path + '1'); }
      }
      visit('');
      return { version: 1, target: plan.speciesIndex, context: plan.context, branches };
    }
    function restore(value) {
      if (!value || value.version !== 1 || !Number.isInteger(value.target) || !CONTEXTS.includes(value.context) || !Array.isArray(value.branches) || value.branches.length > 31) throw new Error('This breeding tree link is invalid.');
      let plan = planner.createPlan(value.target, value.context);
      const collapsed = new Set();
      const paths = new Set();
      for (const entry of value.branches) {
        if (!Array.isArray(entry) || entry.length !== 3 || typeof entry[0] !== 'string' || !/^[01]{0,7}$/.test(entry[0]) || typeof entry[1] !== 'string' || entry[1].length > 80 || ![0, 1].includes(entry[2]) || paths.has(entry[0])) throw new Error('This breeding tree contains an invalid branch.');
        paths.add(entry[0]);
        plan = choose(plan, entry[0], entry[1]);
        if (entry[2]) collapsed.add(entry[0]);
      }
      return { plan, collapsed };
    }
    return Object.freeze({ createPlan: planner.createPlan, at, candidates, choose, clear, conditions, snapshot, restore, MAX_DEPTH, MAX_NODES });
  }

  root.DQMBreedingTreeCore = Object.freeze({ create, MAX_SHARED_LENGTH, MAX_DEPTH, MAX_NODES });
  if (!root.document || !root.DATA || !root.DQMRecipePlanner || !root.DQMPlannerCore) return;
  const host = document.getElementById('breeding-tree');
  if (!host) return;
  const engine = create(root.DATA, root.DQMRecipePlanner, root.DQMPlannerCore);
  const species = new Map(root.DATA.species.filter(item => item.playable).map(item => [item.index, item]));
  const esc = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const name = index => { const item = species.get(index); return item ? item.display_name || item.name : 'Any matching family monster'; };
  const norm = value => String(value).toLocaleLowerCase().normalize('NFKC').replace(/[\s’'·-]+/g, '');
  const matches = (index, text) => { const item = species.get(index); return item && norm([item.name, item.display_name, item.short_name, item.japanese, ...(item.aliases || [])].join(' ')).includes(norm(text)); };
  const storageKey = 'dqm-guide-breeding-tree-v1';
  let plan = engine.createPlan(290, 'shrine');
  let collapsed = new Set();
  let selected = '';
  let page = 0;
  let undo = [];
  let lastRoute = null;
  let message = '';
  const P = id => document.getElementById(id);

  host.innerHTML = '<div class="section-head tree-heading-row"><div><h2 id="tree-heading" tabindex="-1">Breeding tree</h2></div><div class="tree-top-actions"><button type="button" id="tree-undo" disabled>Undo</button><button type="button" id="tree-share">Copy tree link</button></div></div>' +
    '<div class="tree-controls"><div class="field"><label for="tree-search">Find a target</label><input id="tree-search" type="search" placeholder="Current, old, or Japanese name" autocomplete="off"></div><div class="field"><label for="tree-target">Target monster</label><select id="tree-target"></select></div><div class="field"><label for="tree-context">Breeding location</label><select id="tree-context"><option value="shrine">Ordinary shrine</option><option value="room">Two-save Breeding room</option><option value="base">Base table only</option></select></div></div>' +
    '<p id="tree-message" class="tree-message" role="status" aria-live="polite"></p>' +
    '<div class="tree-workspace"><div class="tree-map-panel"><div class="tree-map-bar"><span id="tree-summary"></span><button type="button" id="tree-center">Center target</button></div><div id="tree-canvas" class="tree-canvas" tabindex="0" role="region" aria-label="Breeding tree, scroll to explore branches"><div id="tree-diagram" class="tree-diagram"></div></div></div>' +
    '<aside class="tree-recipes" aria-labelledby="tree-recipes-heading"><div class="tree-recipe-header"><h3 id="tree-recipes-heading" tabindex="-1"></h3><label class="sr-only" for="tree-recipe-search">Filter recipes by parent name</label><input id="tree-recipe-search" type="search" placeholder="Filter by either parent…" autocomplete="off"><div class="tree-recipe-summary"><p id="tree-recipe-count" class="hint"></p><button type="button" id="tree-clear">Clear this branch</button></div></div><div id="tree-recipe-list"></div><div class="tree-recipe-pages"><button id="tree-prev" type="button">Previous</button><span id="tree-page"></span><button id="tree-next" type="button">Next</button></div></aside></div>' +
    '<details class="tree-help"><summary>How to read this tree</summary><p>Each branch has its own recipe. The pedigree is on the left and the mate is on the right.</p><p>Special recipes show the required + value or two-save rule. Recipes that would repeat an ancestor are omitted.</p><p>Check parent sex, level and availability in your game. Your tree is saved in this browser.</p></details>';

  function targetOptions() {
    const query = P('tree-search').value;
    const items = Array.from(species.values()).filter(item => !query || matches(item.index, query));
    P('tree-target').innerHTML = items.map(item => '<option value="' + item.index + '">' + esc(name(item.index)) + '</option>').join('');
    if (items.some(item => item.index === plan.speciesIndex)) P('tree-target').value = String(plan.speciesIndex);
    else if (items.length) P('tree-target').selectedIndex = -1;
    else P('tree-target').innerHTML = '<option value="">No matching monsters</option>';
  }
  function link(index) { return '<a href="#monster?id=' + index + '" class="tree-monster-link">' + (typeof spriteMarkup === 'function' ? spriteMarkup(index) : '') + '<span>' + esc(name(index)) + '</span></a>'; }
  function family(node) {
    const parent = plan.nodes.find(item => item.id === node.parent);
    const recipe = parent && engine.candidates(plan, pathFor(parent.id)).items.find(item => item.parents[0] === parent.recipe.parents[0] && item.parents[1] === null);
    const item = recipe && root.DATA.families.find(entry => entry.id === recipe.mateFamilyIndex);
    return item ? 'Any ' + (item.display_name || item.name) + ' monster' : 'Any matching family monster';
  }
  function pathFor(id) {
    function visit(path) { const node = engine.at(plan, path); if (!node) return null; if (node.id === id) return path; if (!node.children) return null; const left = visit(path + '0'); return left === null ? visit(path + '1') : left; }
    return visit('');
  }
  function drawNode(path, role) {
    const node = engine.at(plan, path);
    const chosen = node.recipe && engine.candidates(plan, path).items.find(item => item.kind === node.recipe.kind && item.parents[0] === node.recipe.parents[0] && item.parents[1] === node.recipe.parents[1]);
    const condition = chosen ? engine.conditions(chosen) : '';
    const hidden = collapsed.has(path);
    const title = node.speciesIndex === null ? '<span class="tree-family">' + esc(family(node)) + '</span>' : link(node.speciesIndex);
    const leaf = node.speciesIndex === null;
    const atLimit = path.length >= MAX_DEPTH;
    return '<div class="tree-branch"><article class="tree-node' + (selected === path ? ' tree-node-selected' : '') + (leaf ? ' tree-node-family' : '') + '" data-tree-path="' + path + '"><div class="tree-node-role">' + role + (path ? ' · Generation ' + path.length : '') + '</div>' + title +
      (leaf ? '' : '<span class="tree-node-family-name">' + esc(species.get(node.speciesIndex).family_display || species.get(node.speciesIndex).family) + '</span>') +
      (condition ? '<p class="tree-condition">' + esc(condition) + '</p>' : '') +
      (!leaf ? '<div class="tree-node-actions"><button type="button" data-tree-select="' + path + '" aria-label="' + (node.children ? 'Change recipe for ' : 'Choose parents for ') + esc(name(node.speciesIndex)) + '"' + (atLimit ? ' disabled' : '') + '>' + (node.children ? 'Change recipe' : 'Choose parents') + '</button>' + (node.children ? '<button type="button" data-tree-collapse="' + path + '" aria-expanded="' + !hidden + '" aria-label="' + (hidden ? 'Show' : 'Hide') + ' parents of ' + esc(name(node.speciesIndex)) + '">' + (hidden ? 'Show' : 'Hide') + '</button>' : '') + '</div>' : '') +
      (atLimit ? '<p class="tree-node-note">Generation limit reached</p>' : '') + '</article>' +
      (node.children && !hidden ? '<div class="tree-parents">' + drawNode(path + '0', 'Pedigree') + drawNode(path + '1', 'Mate') + '</div>' : '') + '</div>';
  }
  function drawRecipes() {
    let node = engine.at(plan, selected);
    if (!node || node.speciesIndex === null) { selected = ''; node = engine.at(plan, ''); }
    P('tree-recipes-heading').innerHTML = 'Parents for ' + link(node.speciesIndex);
    P('tree-clear').hidden = !node.children;
    const found = engine.candidates(plan, selected);
    const filter = P('tree-recipe-search').value;
    const items = found.items.filter(recipe => !filter || recipe.parents.some(index => index !== null && matches(index, filter)) || (recipe.familyWildcard && norm(recipe.parentNames[1]).includes(norm(filter))));
    const pages = Math.ceil(items.length / 6);
    page = Math.max(0, Math.min(page, pages - 1));
    P('tree-recipe-count').textContent = items.length.toLocaleString() + ' recipes' + (found.excluded ? ' · ' + found.excluded.toLocaleString() + ' circular routes omitted' : '');
    P('tree-recipe-list').innerHTML = items.slice(page * 6, page * 6 + 6).map(recipe => {
      const active = node.recipe && node.recipe.kind === recipe.kind && node.recipe.parents[0] === recipe.parents[0] && node.recipe.parents[1] === recipe.parents[1];
      const condition = engine.conditions(recipe);
      return '<article class="tree-recipe' + (active ? ' tree-recipe-active' : '') + '"><div class="tree-recipe-pair"><div><small>Pedigree</small>' + link(recipe.parents[0]) + '</div><span class="tree-plus" aria-hidden="true">+</span><div><small>Mate</small>' + (recipe.familyWildcard ? '<span class="tree-family">' + esc(recipe.parentNames[1]) + '</span>' : link(recipe.parents[1])) + '</div></div>' +
        (condition ? '<p class="tree-condition">' + esc(condition) + '</p>' : '') + '<button type="button" data-tree-recipe="' + esc(recipe.id) + '"' + (active || selected.length >= MAX_DEPTH ? ' disabled' : '') + '>' + (active ? 'Selected recipe' : 'Use this recipe') + '</button></article>';
    }).join('') || '<p class="tree-empty">' + (filter ? 'No parent names match. Clear the filter to see all recipes.' : 'No non-circular recipe is available here. Obtain this monster separately or choose another earlier recipe.') + '</p>';
    P('tree-prev').disabled = page === 0;
    P('tree-next').disabled = page + 1 >= pages;
    P('tree-page').parentElement.hidden = pages <= 1;
    P('tree-page').textContent = (page + 1) + ' / ' + pages;
  }
  function draw() {
    P('tree-context').value = plan.context;
    targetOptions();
    P('tree-diagram').innerHTML = drawNode('', 'Your goal');
    const steps = plan.nodes.filter(node => node.children).length;
    const parents = plan.nodes.length - steps;
    P('tree-summary').textContent = steps + (steps === 1 ? ' breeding step' : ' breeding steps') + ' · ' + parents + (parents === 1 ? ' monster needed' : ' monsters needed');
    P('tree-message').textContent = message;
    P('tree-undo').disabled = undo.length === 0;
    drawRecipes();
  }
  function currentState() { return engine.snapshot(plan, collapsed); }
  function route(state) {
    const params = new URLSearchParams({ target: String(state.target), context: state.context });
    if (state.branches.length) params.set('branches', JSON.stringify(state.branches));
    return '#breeding-tree?' + params.toString();
  }
  function persist() {
    const state = currentState();
    try { localStorage.setItem(storageKey, JSON.stringify(state)); } catch (error) { message = 'Browser storage is unavailable. Copy the tree link to keep it.'; P('tree-message').textContent = message; }
    if (location.hash.startsWith('#breeding-tree')) {
      const hash = route(state);
      try { history.replaceState(null, '', hash); lastRoute = hash; } catch (error) { /* file URLs can still use Copy tree link. */ }
    }
  }
  function remember() { undo.push(currentState()); if (undo.length > 15) undo.shift(); }
  function applyState(state) { const restored = engine.restore(state); plan = restored.plan; collapsed = restored.collapsed; selected = ''; page = 0; }
  function center() { const canvas = P('tree-canvas'); canvas.scrollLeft = (canvas.scrollWidth - canvas.clientWidth) / 2; canvas.scrollTop = 0; }
  function setTarget(index, context, initial) {
    if (!species.has(index)) return;
    if (!initial) remember();
    plan = engine.createPlan(index, context);
    collapsed = new Set(); selected = ''; page = 0;
    const first = engine.candidates(plan, '').items[0];
    if (first) plan = engine.choose(plan, '', first.id);
    P('tree-search').value = ''; P('tree-recipe-search').value = '';
    message = ''; draw(); persist(); center();
  }
  function readRoute() {
    if (!location.hash.startsWith('#breeding-tree') || location.hash === lastRoute) return;
    lastRoute = location.hash;
    const query = location.hash.split('?')[1];
    if (!query) { draw(); return; }
    try {
      if (query.length > MAX_SHARED_LENGTH) throw new Error('This tree link is too large.');
      const params = new URLSearchParams(query);
      const raw = params.get('target');
      if (!raw || !/^\d{1,3}$/.test(raw) || !species.has(Number(raw))) throw new Error('This tree link has an unknown target.');
      const context = params.get('context') || 'shrine';
      if (!CONTEXTS.includes(context)) throw new Error('This tree link has an unknown breeding location.');
      if (params.has('branches')) {
        applyState({ version: 1, target: Number(raw), context, branches: JSON.parse(params.get('branches')) });
        message = ''; draw(); persist(); center();
      } else setTarget(Number(raw), context, true);
    } catch (error) { message = error.message + ' Your previous tree has been kept.'; draw(); }
  }
  P('tree-search').addEventListener('input', targetOptions);
  P('tree-target').addEventListener('change', event => { if (event.target.value !== '') setTarget(Number(event.target.value), plan.context); });
  P('tree-context').addEventListener('change', event => { setTarget(plan.speciesIndex, event.target.value); message = 'The tree was restarted for this breeding location. Undo restores the previous branches.'; P('tree-message').textContent = message; });
  P('tree-recipe-search').addEventListener('input', () => { page = 0; drawRecipes(); });
  P('tree-prev').addEventListener('click', () => { page--; drawRecipes(); });
  P('tree-next').addEventListener('click', () => { page++; drawRecipes(); });
  P('tree-center').addEventListener('click', center);
  P('tree-clear').addEventListener('click', () => {
    const next = engine.clear(plan, selected);
    remember(); plan = next;
    collapsed = new Set(Array.from(collapsed).filter(path => !path.startsWith(selected)));
    message = 'This branch was cleared. Undo restores its recipes.';
    draw(); persist();
    P('tree-recipes-heading').focus({ preventScroll: true });
  });
  P('tree-undo').addEventListener('click', () => {
    if (!undo.length) return;
    applyState(undo.pop()); message = 'Previous tree restored.'; draw(); persist();
    // A disabled last-Undo button must not strand keyboard focus on the body.
    if (P('tree-undo').disabled) P('tree-target').focus({ preventScroll: true });
  });
  host.addEventListener('click', event => {
    const select = event.target.closest('[data-tree-select]');
    const toggle = event.target.closest('[data-tree-collapse]');
    const choose = event.target.closest('[data-tree-recipe]');
    if (select) {
      selected = select.dataset.treeSelect; page = 0; P('tree-recipe-search').value = ''; draw();
      P('tree-recipes-heading').focus({ preventScroll: true });
      if (matchMedia('(max-width: 900px)').matches) P('tree-recipes-heading').scrollIntoView({ block: 'center', behavior: 'smooth' });
      else P('tree-recipes-heading').scrollIntoView({ block: 'nearest' });
    } else if (toggle) {
      remember(); const path = toggle.dataset.treeCollapse;
      if (collapsed.has(path)) collapsed.delete(path); else collapsed.add(path);
      if (selected.startsWith(path) && selected !== path) selected = path;
      draw(); persist();
      const replacement = host.querySelector('[data-tree-collapse="' + path + '"]'); if (replacement) replacement.focus({ preventScroll: true });
    } else if (choose) {
      try {
        const next = engine.choose(plan, selected, choose.dataset.treeRecipe);
        remember(); plan = next;
        collapsed = new Set(Array.from(collapsed).filter(path => !path.startsWith(selected)));
        message = 'Recipe updated. Choose either parent to continue the branch.';
        draw(); persist();
        const card = host.querySelector('[data-tree-path="' + selected + '"]');
        if (card) { card.scrollIntoView({ block: 'nearest', inline: 'center' }); card.querySelector('[data-tree-select]').focus({ preventScroll: true }); }
      } catch (error) { message = error.message; P('tree-message').textContent = message; }
    }
  });
  P('tree-share').addEventListener('click', async () => {
    const url = location.href.split('#')[0] + route(currentState());
    const button = P('tree-share'); button.dataset.copyText = url;
    try {
      if (!navigator.clipboard || !navigator.clipboard.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(url); message = 'Tree link copied, including your selected recipes.';
    } catch (error) {
      const input = document.createElement('input'); input.value = url; input.setAttribute('aria-label', 'Tree link to copy'); input.className = 'tree-share-fallback';
      const previous = host.querySelector('.tree-share-fallback'); if (previous) previous.remove();
      P('tree-message').after(input); input.focus(); input.select();
      message = 'Select and copy the tree link below.';
    }
    P('tree-message').textContent = message;
  });
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved && saved.length <= MAX_SHARED_LENGTH) applyState(JSON.parse(saved));
    else {
      const first = engine.candidates(plan, '').items[0];
      if (first) plan = engine.choose(plan, '', first.id);
    }
  } catch (error) { message = 'The saved tree could not be loaded. Choose a target to start a new one.'; }
  draw();
  root.addEventListener('hashchange', readRoute);
  root.DQMBreedingTree = Object.freeze({
    open(index) { if (species.has(index)) { location.hash = 'breeding-tree?target=' + index + '&context=shrine'; readRoute(); } },
    viewShown() { readRoute(); center(); },
  });
  readRoute();
})(globalThis);
