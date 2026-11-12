/* Progressive enhancement for species selects. The native value is the committed species ID. */
(function (root) {
  'use strict';
  const mounted = new WeakMap();
  const normalize = text => String(text || '').normalize('NFKC').toLocaleLowerCase().replace(/[\s’'·-]+/g, '');
  const nameOf = s => s.display_name || s.current_name || s.name;

  function rank(species, query, includeFamily, family) {
    const q = normalize(query);
    if (!q) return 0;
    const names = [nameOf(species), species.name, species.current_name, species.short_name, species.japanese, ...(species.aliases || [])].filter(Boolean).map(normalize);
    if (names[0] === q) return 0;
    if (names.includes(q)) return 1;
    if (names.some(name => name.startsWith(q))) return 2;
    if (names.some(name => name.includes(q))) return 3;
    const familyNames = [species.family_display, species.family, family?.japanese];
    return includeFamily && familyNames.some(value => normalize(value).includes(q)) ? 4 : -1;
  }

  function attach(select, {label, includeFamily = true, species = root.DATA?.species, families: familyRows = root.DATA?.families || []} = {}) {
    if (mounted.has(select)) return mounted.get(select);
    const rows = new Map(species.map(s => [String(s.index), s]));
    const families = new Map(familyRows.map(family => [family.id, family]));
    const wrap = document.createElement('div');
    wrap.className = 'monster-combo';
    const input = document.createElement('input');
    input.id = select.id + '-combobox';
    input.type = 'text';
    input.autocomplete = 'off';
    input.spellcheck = false;
    input.placeholder = 'Name, family or Japanese';
    input.setAttribute('role', 'combobox');
    input.setAttribute('aria-autocomplete', 'list');
    input.setAttribute('aria-expanded', 'false');
    const labels = [...select.labels];
    for (const item of labels) item.htmlFor = input.id;
    if (label || !labels.length) input.setAttribute('aria-label', label || 'Monster');
    const list = document.createElement('div');
    list.id = select.id + '-choices';
    list.className = 'monster-choices';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', label || 'Matching monsters');
    input.setAttribute('aria-controls', list.id);
    select.before(wrap);
    wrap.append(input, list);
    select.classList.add('monster-combo-native');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');
    let items = [];
    let active = -1;

    function refresh() {
      const species = rows.get(select.value);
      input.value = species ? nameOf(species) : '';
      input.disabled = select.disabled;
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      list.hidden = true;
      list.replaceChildren();
      active = -1;
    }
    function highlight(index, scroll) {
      const old = list.children[active];
      if (old) old.setAttribute('aria-selected', 'false');
      active = index;
      const option = list.children[index];
      if (!option || !items.length) { input.removeAttribute('aria-activedescendant'); return; }
      option.setAttribute('aria-selected', 'true');
      input.setAttribute('aria-activedescendant', option.id);
      if (scroll) {
        if (option.offsetTop < list.scrollTop) list.scrollTop = option.offsetTop;
        else if (option.offsetTop + option.offsetHeight > list.scrollTop + list.clientHeight) {
          list.scrollTop = option.offsetTop + option.offsetHeight - list.clientHeight;
        }
      }
    }
    function show(query) {
      const options = Array.from(select.options, option => rows.get(option.value)).filter(Boolean);
      items = options.map(species => ({species, rank: rank(species, query, includeFamily, families.get(species.family_id))}))
        .filter(match => match.rank >= 0).sort((a,b) => a.rank - b.rank).map(match => match.species);
      const fragment = document.createDocumentFragment();
      for (const [i, species] of items.entries()) {
        const option = document.createElement('div');
        option.id = list.id + '-' + species.index;
        option.setAttribute('role', 'option');
        option.setAttribute('aria-selected', 'false');
        option.dataset.choice = String(i);
        const name = document.createElement('strong');
        name.textContent = nameOf(species);
        const detail = document.createElement('small');
        detail.textContent = [species.family_display || species.family, species.japanese].filter(Boolean).join(' · ');
        option.append(name, detail);
        fragment.append(option);
      }
      if (!items.length) {
        const empty = document.createElement('p');
        empty.setAttribute('role','status');
        empty.textContent = 'No matching monsters';
        fragment.append(empty);
      }
      list.replaceChildren(fragment);
      const bounds = wrap.getBoundingClientRect();
      const below = document.documentElement.clientHeight - bounds.bottom;
      wrap.classList.toggle('monster-combo-above', below < 240 && bounds.top > below);
      list.hidden = false;
      input.setAttribute('aria-expanded','true');
      active = -1;
      highlight(query && items.length ? 0 : items.findIndex(s => String(s.index) === select.value), true);
    }
    function commit(index) {
      const species = items[index];
      if (!species) return;
      select.value = String(species.index);
      refresh();
      select.dispatchEvent(new Event('change', {bubbles:true}));
    }
    input.addEventListener('focus', () => { input.select(); });
    input.addEventListener('click', () => { if (list.hidden) { input.select(); show(''); } });
    input.addEventListener('input', () => show(input.value));
    input.addEventListener('keydown', event => {
      if (event.isComposing) return;
      if (event.key === 'Escape' && !list.hidden) { event.preventDefault(); event.stopPropagation(); refresh(); input.select(); }
      if (event.key === 'Enter' && !list.hidden) { event.preventDefault(); commit(active); }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (list.hidden) { show(''); return; }
        highlight(Math.max(0, Math.min(items.length - 1, active + (event.key === 'ArrowDown' ? 1 : -1))), true);
      }
    });
    list.addEventListener('mousedown', event => event.preventDefault());
    list.addEventListener('click', event => {
      const item = event.target.closest('[data-choice]');
      if (item) commit(Number(item.dataset.choice));
    });
    input.addEventListener('blur', refresh);
    select.addEventListener('change', refresh);
    const api = {refresh, focus(options) {input.focus(options);}, input};
    mounted.set(select, api);
    refresh();
    return api;
  }
  root.DQMMonsterPicker = {attach, get: select => mounted.get(select), rank};
  if (typeof module !== 'undefined' && module.exports) module.exports = root.DQMMonsterPicker;
})(globalThis);
