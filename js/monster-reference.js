/* Monster library and species reference. The computations also run in Node.
   Naming and native data are supplied by the generated MONSTER_REFERENCE file. */
(function (root) {
  'use strict';

  const STATS = [['hp', 'HP'], ['mp', 'MP'], ['attack', 'Attack'], ['defense', 'Defense'], ['agility', 'Agility'], ['intelligence', 'Intelligence']];
  const campaignNames = root.GUIDE_HOME?.campaigns || {terry: 'Terry', cobi: 'Cobi', tara: 'Tara'};
  const CAMPAIGNS = { terry: 'DQM1 · ' + campaignNames.terry, cobi: 'DQM2 · ' + campaignNames.cobi, tara: 'DQM2 · ' + campaignNames.tara };
  const safe = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const named = species => species ? (species.display_name || species.current_name || species.name || '') : 'Unknown monster';

  function routeIndex(hash) {
    const raw = String(hash || '');
    const legacy = /^#?monster\/([^/?&#]+)$/i.exec(raw);
    const match = /^#?monster\?(.+)$/i.exec(raw);
    if (!match && !legacy) return null;
    const value = legacy ? legacy[1] : new URLSearchParams(match[1]).get('id');
    return value !== null && /^(0|[1-9]\d*)$/.test(value) && Number.isSafeInteger(Number(value)) ? Number(value) : null;
  }

  function growthAt(stats, level) {
    if (!Number.isInteger(level) || level < 1 || level > 99) throw new RangeError('Level must be a whole number from 1 to 99.');
    return STATS.map(([key, label]) => {
      const values = stats && stats.status === 'verified' && stats.growth && stats.growth[key];
      const available = Array.isArray(values) && values.length >= level && values.slice(0, level).every(Number.isFinite);
      // Entry zero is the level-one gain, not a starting stat. A level-one
      // monster has gained nothing yet; reaching N adds entries 1 through N-1.
      return { key, label, total: available ? values.slice(1, level).reduce((a, b) => a + b, 0) : null, gain: available ? values[level - 1] : null };
    });
  }

  function groupedLocations(locations, campaign) {
    const groups = new Map();
    for (const entry of locations || []) {
      if (entry.availability === 'unused') continue;
      if (campaign && entry.game !== campaign) continue;
      const key = JSON.stringify([entry.game, entry.name, entry.floors, entry.kind]);
      if (!groups.has(key)) groups.set(key, { ...entry, levels: [] });
      const group = groups.get(key);
      group.levels = [...new Set([...group.levels, ...(entry.levels || [])])].sort((a, b) => a - b);
      if (entry.strength_ranks) {
        group.strength_ranks = [...new Set([...(group.strength_ranks || []), ...entry.strength_ranks])].sort((a,b) => a-b);
      }
    }
    return [...groups.values()];
  }

  function create(data, reference) {
    const species = new Map(data.species.map(entry => [entry.index, entry]));
    const records = new Map(((reference && reference.species) || []).map(entry => [entry.index, entry]));
    const playable = data.species.filter(entry => entry.playable !== false);
    let parents;
    const firstCopies = new Map();

    function get(index) {
      const entry = species.get(index);
      return entry ? { ...entry, ...(records.get(index) || {}) } : null;
    }

    function parentCount(index) {
      if (!parents) {
        parents = new Map();
        for (const a of playable) for (const b of playable) {
          const target = data.matrix[a.index] && data.matrix[a.index][b.index];
          if (!species.has(target)) continue;
          parents.set(target, (parents.get(target) || 0) + 1);
          if (a.index === target || b.index === target) continue;
          if (!firstCopies.has(target)) firstCopies.set(target, []);
          const examples = firstCopies.get(target);
          if (examples.length < 3) examples.push([a.index, b.index]);
        }
      }
      return parents.get(index) || 0;
    }

    function firstRecipes(index) {
      parentCount(index);
      const rules = data.runtime_rules?.rules || [];
      const special = rules.filter(rule => rule.offspring_index === index && rule.pedigree_index !== index &&
        rule.mate_index !== index).map(rule => ({a:rule.pedigree_index, b:rule.mate_index,
        family:rule.mate_family_index, condition:rule.kind === 'plus_threshold' ? 'Either parent +' + rule.minimum_parent_plus + ' or higher' : 'Two-save Breeding room'}));
      const base = (firstCopies.get(index) || []).map(([a,b]) => {
        const plus = rules.find(rule => rule.kind === 'plus_threshold' && rule.pedigree_index === a && rule.mate_index === b);
        return {a, b, condition:plus ? 'Both parents below +' + plus.minimum_parent_plus : ''};
      });
      return [...special, ...base].slice(0, 3);
    }

    function offspringGroups(index, role) {
      if (!species.has(index)) return [];
      const groups = new Map();
      for (const partner of playable) {
        const a = role === 'mate' ? partner.index : index;
        const b = role === 'mate' ? index : partner.index;
        const result = data.matrix[a] && data.matrix[a][b];
        if (!species.has(result)) continue;
        if (!groups.has(result)) groups.set(result, { index: result, name: named(get(result)), count: 0, a, b });
        groups.get(result).count++;
      }
      return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
    }

    function conditions(index) {
      const entry = species.get(index);
      return (data.runtime_rules && data.runtime_rules.rules || []).filter(rule =>
        rule.offspring_index === index || rule.pedigree_index === index || rule.mate_index === index ||
        (rule.mate_index == null && entry && rule.mate_family_index === entry.family_id));
    }

    return Object.freeze({ get, parentCount, firstRecipes, offspringGroups, conditions, species: data.species, playable });
  }

  const api = { create, routeIndex, growthAt, groupedLocations, safe };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.DQMMonsterCore = Object.freeze(api);
  if (!root.document || !root.DATA) return;

  const model = create(root.DATA, root.MONSTER_REFERENCE);
  const P = id => document.getElementById(id);
  let activeIndex = null;
  let campaign = 'terry';
  let level = 40;
  let role = 'pedigree';
  const sprite = index => typeof spriteMarkup === 'function' ? spriteMarkup(index) : '';

  function link(index, text, options) {
    const species = model.get(index);
    if (!species) return safe(text || 'Unknown monster');
    return '<a class="monster-link' + (options && options.sprite ? ' monster-label' : '') + '" href="#monster?id=' + index + '">' +
      (options && options.sprite ? sprite(index) : '') + '<span>' + safe(text || named(species)) + '</span></a>';
  }

  function aliasesMarkup(species) {
    const values = [...new Set([species.short_name, ...(species.aliases || [])].filter(value => value && value !== named(species)))];
    return values.length ? '<div class="monster-aliases"><span>Also known as</span> ' + values.map(value => '<span class="monster-alias">' + safe(value) + '</span>').join(' ') + '</div>' : '';
  }

  function growthMarkup(species) {
    const stats = species.stats;
    if (!stats || stats.status !== 'verified' || !stats.growth) return '<p class="monster-empty">Verified PSX stats are not available for this table slot.</p>';
    const values = growthAt(stats, level);
    const max = Math.max(1, ...values.map(value => value.total || 0));
    return '<div class="monster-level-controls"><label for="monster-growth-level">Gains from level 1 to</label><input id="monster-growth-level" type="range" min="1" max="99" value="' + level + '"><output for="monster-growth-level">' + level + '</output></div>' +
      '<div class="monster-growth-bars">' + values.map(value => '<div class="monster-growth-row"><span>' + value.label + '</span><div class="monster-growth-track" aria-hidden="true"><i style="width:' + ((value.total || 0) / max * 100).toFixed(2) + '%"></i></div><strong>' + (value.total === null ? '—' : '+' + value.total) + '</strong></div>').join('') + '</div>' +
      '<p class="hint">'+(level>Math.min(99,stats.base_level_limit+2)?'This level exceeds the usual recruitment cap; a bred monster or a special individual cap may be needed. ':'')+'Gains exclude starting stats, inheritance and accessories. <a href="#skill-planner?species='+species.index+'">Check this monster’s level cap and growth →</a></p>' +
      '<details class="monster-growth-table"><summary>Exact growth by level</summary><div class="table-scroll"><table><caption class="sr-only">Base stat gains on reaching each level, excluding inherited or starting stats</caption><thead><tr><th scope="col">Level</th>' + STATS.map(([, label]) => '<th scope="col">' + label + '</th>').join('') + '</tr></thead><tbody>' +
      Array.from({ length: level - 1 }, (_, i) => i + 2).map(n => '<tr><th scope="row">' + n + '</th>' + growthAt(stats, n).map(value => '<td>' + (value.gain === null ? '—' : '+' + value.gain) + '</td>').join('') + '</tr>').join('') +
      (level === 1 ? '<tr><td colspan="7">No level-up gains at level 1.</td></tr>' : '') + '</tbody></table></div></details>';
  }

  function skillsMarkup(species) {
    const skills = species.skills?.[campaign];
    if (!skills?.length) return '<p class="monster-empty">Skills unverified for this entry.</p>';
    const names = root.MONSTER_REFERENCE?.guide_names?.skills || {};
    return '<ul class="monster-skill-list">' + skills.map(skill => {
      const minimum = names[skill.id]?.minimum_level;
      const entry = skill.system_entry_id || names[skill.id]?.id;
      const title = entry ? '<a href="#field-guide?kind=skill&amp;entry=skill-' + safe(entry) + '">' + safe(skill.name) + '</a>' : safe(skill.name);
      return '<li>' + title + (Number.isInteger(minimum) && minimum > 0 ? '<span class="skill-minimum">Min. level ' + minimum + '</span>' : '') + '</li>';
    }).join('') + '</ul>';
  }

  function naturalSkillsCard(species) {
    const campaigns = Object.entries(CAMPAIGNS).map(([key,label]) => {
      const count = groupedLocations(species.locations, key).length;
      const coverage = count === 1 ? '1 encounter' : count + ' encounters';
      return '<option value="' + key + '"' + (key === campaign ? ' selected' : '') + '>' + safe(label) + ' · ' + coverage + '</option>';
    }).join('');
    return '<section class="monster-card monster-natural-skills"><div class="monster-card-heading"><h3>Natural skills</h3>' +
      '<label class="sr-only" for="monster-campaign">Adventure for skills and encounters</label><select id="monster-campaign">' + campaigns +
      '</select></div><div id="monster-skills">' + skillsMarkup(species) + '</div><p class="hint">Level and stats both matter. <a id="monster-skill-planner" href="#skill-planner?species='+species.index+'&amp;campaign='+campaign+'">Plan growth &amp; skill learning →</a> · <a href="#field-guide?entry=field-skill-inheritance">Learning rules</a></p></section>';
  }

  function locationsMarkup(species) {
    const locations = groupedLocations(species.locations, campaign);
    const recruitment = locations.some(entry=>entry.kind==='wild') ? '<a class="monster-recruit-link" href="#field-guide?entry=field-recruitment&amp;rc_species='+species.index+'&amp;rc_game='+campaign+'">Check wild recruitment chances →</a>' : '';
    return locations.length ? recruitment+'<div class="table-scroll"><table class="monster-locations"><caption class="sr-only">Recorded encounters for ' + safe(CAMPAIGNS[campaign]) + '</caption><thead><tr><th scope="col">Encounter</th><th scope="col">Floors or rank</th><th scope="col">Level</th></tr></thead><tbody>' + locations.map(entry => {
      const master = entry.kind === 'other' && entry.source?.native_selection;
      const location = master ? '<a href="#field-guide?entry=field-wandering-masters">Wandering master’s team</a>' : safe(entry.name);
      const ranks = entry.strength_ranks || [];
      const condition = master && ranks.length ? 'Rank' + (ranks.length > 1 ? 's ' : ' ') + ranks.join(', ') : entry.floors;
      return '<tr><th scope="row">' + location + '</th><td>' + safe(condition || '—') + '</td><td>' + safe(entry.levels.join(', ') || '—') + '</td></tr>';
    }).join('') + '</tbody></table></div>' : '<p class="monster-empty">No encounters recorded for ' + safe(CAMPAIGNS[campaign]) + '.</p>';
  }

  function acquisitionMarkup(species) {
    const recipes = model.firstRecipes(species.index);
    const examples = recipes.map(recipe => {
      const family = DATA.families.find(item => item.id === recipe.family);
      const mate = recipe.b == null ? 'Any ' + safe(family?.display_name || family?.name || 'matching') + ' monster' : link(recipe.b, null, {sprite:true});
      return '<li><div class="first-copy-parents">' + link(recipe.a, null, {sprite:true}) + '<span>+</span>' + mate + '</div>' +
        (recipe.condition ? '<small>' + safe(recipe.condition) + '</small>' : '') + '</li>';
    }).join('');
    return '<section class="monster-card monster-acquire"><div class="monster-card-heading"><h3>How to get ' + safe(named(species)) + '</h3></div>' +
      '<div class="acquire-columns"><div><h4>First-copy breeding</h4>' + (examples ? '<p class="hint">Pedigree + mate</p><ul class="first-copy-list">' + examples + '</ul>' : '<p>No recorded pairing produces a first copy.</p>') +
      '<a href="#offspring-finder?target=' + species.index + '">All parent recipes ↗</a></div><div><h4>Recorded encounters</h4><div id="monster-locations">' + locationsMarkup(species) + '</div></div></div></section>';
  }

  function conditionsMarkup(species) {
    const rules = model.conditions(species.index);
    if (!rules.length) return '';
    return '<details class="monster-conditions"><summary>Special breeding conditions (' + rules.length + ')</summary><ul>' + rules.map(rule => {
      const family = DATA.families.find(value => value.id === rule.mate_family_index);
      const mate = rule.mate_index == null ? 'Any ' + safe(family && (family.display_name || family.name) || 'matching family') : link(rule.mate_index);
      return '<li>' + link(rule.pedigree_index) + ' + ' + mate + ' → ' + link(rule.offspring_index) + '<small>' + (rule.kind === 'plus_threshold' ? 'Ordinary shrine · either parent +' + safe(rule.minimum_parent_plus) + ' or higher' : 'Title-screen Breeding room · between two saves') + '</small></li>';
    }).join('') + '</ul></details>';
  }

  function offspringMarkup(species) {
    const groups = model.offspringGroups(species.index, role);
    return '<p class="hint">' + groups.length + ' base-table offspring with standard partners.</p>' +
      '<div class="monster-offspring-list">' + groups.map(group => '<div class="monster-offspring-row">' + link(group.index, group.name, { sprite: true }) +
      '<span>' + group.count + ' partner' + (group.count === 1 ? '' : 's') + '</span><a href="#pair-finder?a=' + group.a + '&b=' + group.b + '" class="monster-example" aria-label="Try an example pairing for ' + safe(group.name) + '">Try pair ↗</a></div>').join('') + '</div>';
  }

  function render() {
    const host = P('monster-detail');
    const hash = root.DQMEntryHash?.() || location.hash;
    if (!host || !/^#monster(?:[?&/]|$)/i.test(hash)) return;
    const index = routeIndex(hash);
    const species = model.get(index);
    if (!species) {
      activeIndex = null;
      host.innerHTML = '<a class="monster-back" href="#species-index">← Monster library</a><h2 id="monster-heading" tabindex="-1">Monster not found</h2><p>Choose a monster from the library.</p>';
      return;
    }
    if (activeIndex !== index) {
      level = Math.min(99, Math.max(1, species.stats && species.stats.base_level_limit || 40));
      role = 'pedigree';
    }
    activeIndex = index;
    const list = species.playable !== false ? model.playable : model.species;
    const position = list.findIndex(entry => entry.index === index);
    const previous = list[position - 1];
    const next = list[position + 1];
    const library = species.library || {};
    const parents = model.parentCount(index);
    host.innerHTML = '<div class="monster-breadcrumb"><a class="monster-back" href="#species-index">← Monster library</a><nav aria-label="Adjacent monsters">' +
      (previous ? '<a href="#monster?id=' + previous.index + '" aria-label="Previous monster: ' + safe(named(previous)) + '">← ' + safe(named(previous)) + '</a>' : '') +
      (next ? '<a href="#monster?id=' + next.index + '" aria-label="Next monster: ' + safe(named(next)) + '">' + safe(named(next)) + ' →</a>' : '') + '</nav></div>' +
      '<header class="monster-profile-header"><div class="monster-profile-art">' + sprite(index) + '</div><div class="monster-profile-identity"><p class="monster-eyebrow">' + safe(species.family_display || species.family) + ' family <span>· #' + String(index).padStart(3, '0') + '</span></p><h2 id="monster-heading" tabindex="-1">' + safe(named(species)) + '</h2><p class="monster-japanese" lang="ja">' + safe(species.japanese) + '</p>' + aliasesMarkup(species) + '</div>' +
      '<div class="monster-profile-actions">' + (species.playable === false ? '' : '<a class="monster-primary" href="#breeding-tree?target=' + index + '&context=shrine">Build breeding tree</a><button type="button" data-species-parents="' + index + '">Find all parents</button>') + '<div><button type="button" data-species-pedigree="' + index + '">Use as pedigree</button><button type="button" data-species-mate="' + index + '">Use as mate</button></div></div></header>' +
      '<div class="monster-library-quote"><span class="monster-eyebrow">In-game library</span><p>' + safe(library.text || 'No in-game library entry.') + '</p></div>' +
      naturalSkillsCard(species) +
      (species.playable === false ? '<p class="monster-internal">Extra table slot. Availability in normal play is unconfirmed.</p>' : '') +
      acquisitionMarkup(species) +
      '<div class="monster-profile-grid monster-lower-grid"><section class="monster-card"><div class="monster-card-heading"><h3>Stats & growth</h3>' + (species.stats?.status === 'verified' ? '<span class="hint">Usual recruitment cap '+Math.max(1,species.stats.base_level_limit-2)+'–'+Math.min(99,species.stats.base_level_limit+2)+'</span>' : '') + '</div><div id="monster-growth">' + growthMarkup(species) + '</div></section>' +
      '<section class="monster-card monster-breeding"><div class="monster-card-heading"><div><h3>Breeding with ' + safe(named(species)) + '</h3><p class="hint"><a href="#offspring-finder?target=' + index + '">' + parents.toLocaleString() + ' base-table parent pairings</a></p></div><div class="monster-role-tabs" role="group" aria-label="Parent role"><button type="button" data-monster-role="pedigree" aria-pressed="' + (role === 'pedigree') + '">As pedigree</button><button type="button" data-monster-role="mate" aria-pressed="' + (role === 'mate') + '">As mate</button></div></div><div id="monster-offspring">' + offspringMarkup(species) + '</div>' + conditionsMarkup(species) + '</section></div>' +
      '<p class="hint"><a href="#combat-planner?species='+species.index+'">Compare damage against a wild encounter →</a></p>' +
      '<details class="monster-source"><summary>Data notes & coverage</summary><p>' + safe(species.stats && species.stats.note || 'No verified native stat record is available for this table slot.') + '</p><p>' + safe(species.resistances && species.resistances.text || 'PSX resistance values have not yet been verified for this reference.') + '</p>' +
      '<p>' + safe(species.location_coverage || 'Encounter coverage is incomplete.') + '</p>' +
      (root.DQMReference?.sourceSummaryMarkup ? root.DQMReference.sourceSummaryMarkup() : '') +
      '<p>Breeding tables describe ordered species results. Parent eligibility, inheritance, and acquisition must be checked separately.</p></details>';
  }

  document.addEventListener('input', event => {
    if (event.target.id !== 'monster-growth-level' || activeIndex === null) return;
    level = Number(event.target.value);
    const host = P('monster-growth');
    // Keep the active slider node in place so pointer dragging and keyboard
    // repeats continue smoothly while its adjacent presentation updates.
    const temp = document.createElement('div');
    temp.innerHTML = growthMarkup(model.get(activeIndex));
    for (const selector of ['.monster-growth-bars', '.hint', '.monster-growth-table']) {
      host.querySelector(selector).replaceWith(temp.querySelector(selector));
    }
    host.querySelector('output').textContent = String(level);
  });

  document.addEventListener('change', event => {
    if (event.target.id !== 'monster-campaign' || activeIndex === null || !CAMPAIGNS[event.target.value]) return;
    campaign = event.target.value;
    P('monster-skills').innerHTML = skillsMarkup(model.get(activeIndex));
    P('monster-locations').innerHTML = locationsMarkup(model.get(activeIndex));
    P('monster-skill-planner').href='#skill-planner?species='+activeIndex+'&campaign='+campaign;
  });

  document.addEventListener('click', event => {
    const button = event.target.closest('[data-monster-role]');
    if (!button || activeIndex === null) return;
    role = button.dataset.monsterRole;
    document.querySelectorAll('[data-monster-role]').forEach(entry => entry.setAttribute('aria-pressed', String(entry.dataset.monsterRole === role)));
    P('monster-offspring').innerHTML = offspringMarkup(model.get(activeIndex));
  });

  root.DQMMonsters = Object.freeze({ link, renderRoute: render, current: () => activeIndex, title: () => activeIndex !== null ? named(model.get(activeIndex)) : 'Monster not found' });
  root.addEventListener('hashchange', render);
  render();
})(typeof globalThis !== 'undefined' ? globalThis : this);
