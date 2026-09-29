/* DQM-guide recipe planner. Pure computations; no DOM, storage, timers, or network.
   Depends on the globals DATA and DQMPlannerCore being loaded before this file. */
(function (root) {
  'use strict';

  const MAX_PLAN_DEPTH = 12;
  const MAX_PLAN_NODES = 100;
  const TARGET_STATUSES = ['needed', 'ready', 'completed'];
  const CONTEXTS = ['base', 'shrine', 'room'];
  const FULFILLMENT_CHOICES = ['recipe', 'roster', 'available'];
  const KIND_ORDER = ['base', 'plus_threshold', 'flag_gated'];
  const MAX_NOTE_LENGTH = 500;
  const NODE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
  const SPECIES_MIN = 0;
  const SPECIES_MAX = 314;

  // The dataset cannot decide acquisition, offspring sex, inherited + value, or
  // breeding eligibility, so every suggestion carries these caveats.
  const BASE_UNKNOWNS = [
    'Acquisition: the dataset does not decide how to obtain the parents.',
    'Sex: the dataset does not determine the sex of the offspring.',
    'Inheritance: the dataset does not decide inherited + values or other stats.',
    'Eligibility: the dataset does not verify breeding eligibility.'
  ];

  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

  function fail(code, message) {
    const error = new Error(message);
    error.code = code;
    return error;
  }

  function isPlayableIndex(value) {
    return Number.isInteger(value) && value >= SPECIES_MIN && value <= SPECIES_MAX;
  }

  function create(data, core, options) {
    if (!record(data) || !Array.isArray(data.species) || !Array.isArray(data.matrix) ||
        !record(data.runtime_rules) || !Array.isArray(data.runtime_rules.rules)) {
      throw fail('invalid', 'The verified species, breeding matrix, and runtime rules are required.');
    }
    // Accept either a core instance or the DQMPlannerCore module (which builds one).
    let coreInstance = core;
    if (record(core) && typeof core.result !== 'function' && typeof core.create === 'function') {
      coreInstance = core.create(data);
    }
    if (!record(coreInstance) || typeof coreInstance.result !== 'function') {
      throw fail('invalid', 'The verified planner core is required.');
    }
    const settings = options == null ? {} : options;
    if (!record(settings)) throw fail('invalid', 'Planner options must be an object.');

    const species = data.species;
    const matrix = data.matrix;
    const rules = data.runtime_rules.rules;
    const plusRules = rules.filter(rule => rule.kind === 'plus_threshold');
    const roomRules = rules.filter(rule => rule.kind === 'flag_gated');
    const playableSpecies = species.map(entry => !!entry && entry.playable === true);
    const familyById = new Map();
    if (Array.isArray(data.families)) {
      for (const family of data.families) {
        if (family && Number.isInteger(family.id)) familyById.set(family.id, family);
      }
    }

    const speciesName = index => (species[index] && species[index].name) || '';
    const speciesFamily = index => (species[index] && species[index].family_id);
    const familyName = id => {
      const family = familyById.get(id);
      return family ? family.display_name : '';
    };

    let idCounter = 0;
    const makeNodeId = typeof settings.makeNodeId === 'function'
      ? settings.makeNodeId
      : () => 'n' + (idCounter++);

    let indexCache = null;

    // The reverse index: target species -> ordered base pairs that produce it.
    // Built lazily once, then cached.
    function buildIndex() {
      const basePairs = new Map();
      for (let a = 0; a < species.length; a++) {
        if (!playableSpecies[a]) continue;
        const row = matrix[a];
        if (!Array.isArray(row)) continue;
        for (let b = 0; b < row.length; b++) {
          if (!playableSpecies[b]) continue;
          const target = row[b];
          if (!isPlayableIndex(target) || !playableSpecies[target]) continue;
          if (!basePairs.has(target)) basePairs.set(target, []);
          basePairs.get(target).push([a, b]);
        }
      }
      return { basePairs };
    }

    function getIndex() {
      if (!indexCache) indexCache = buildIndex();
      return indexCache;
    }

    // First room rule matching the concrete pair (a, b), mirroring the core's
    // precedence: a concrete mate_index match, else a family wildcard whose
    // mate_family_index equals the mate's family.
    function roomOverride(a, b) {
      for (const rule of roomRules) {
        if (rule.pedigree_index !== a) continue;
        if (rule.mate_index != null) {
          if (rule.mate_index === b) return rule;
        } else if (speciesFamily(b) === rule.mate_family_index) {
          return rule;
        }
      }
      return null;
    }

    function flagGatedSeed(rule, context) {
      const wildcard = rule.mate_index == null;
      return {
        kind: 'flag_gated',
        context,
        parents: wildcard ? [rule.pedigree_index, null] : [rule.pedigree_index, rule.mate_index],
        minPlus: null,
        condition: rule.condition,
        mateFamilyIndex: rule.mate_family_index,
        familyWildcard: wildcard,
        mateName: wildcard ? rule.mate_name : null
      };
    }

    // Candidate recipe seeds for a target in a context, with room-override
    // precedence applied: in the room context a pair matched by a room rule is
    // represented by that rule's flag_gated recipe only (the override wins).
    function candidateSeeds(speciesIndex, context) {
      const { basePairs } = getIndex();
      const found = new Map();
      const add = seed => {
        const key = seed.kind + ':' + seed.context + ':' + seed.parents[0] + ':' +
          (seed.parents[1] === null ? 'null' : seed.parents[1]);
        if (!found.has(key)) found.set(key, seed);
      };

      for (const pair of (basePairs.get(speciesIndex) || [])) {
        const a = pair[0];
        const b = pair[1];
        if (context === 'room') {
          const override = roomOverride(a, b);
          if (override) {
            if (override.offspring_index === speciesIndex) add(flagGatedSeed(override, context));
            continue;
          }
        }
        add({
          kind: 'base', context, parents: [a, b], minPlus: null, condition: '',
          mateFamilyIndex: null, familyWildcard: false, mateName: null
        });
      }

      if (context !== 'base') {
        for (const rule of plusRules) {
          if (rule.offspring_index !== speciesIndex) continue;
          if (context === 'room' && roomOverride(rule.pedigree_index, rule.mate_index)) continue;
          add({
            kind: 'plus_threshold', context, parents: [rule.pedigree_index, rule.mate_index],
            minPlus: rule.minimum_parent_plus, condition: rule.condition,
            mateFamilyIndex: null, familyWildcard: false, mateName: null
          });
        }
      }

      if (context === 'room') {
        for (const rule of roomRules) {
          if (rule.offspring_index !== speciesIndex) continue;
          add(flagGatedSeed(rule, context));
        }
      }

      return Array.from(found.values());
    }

    function buildRecipe(seed, speciesIndex, rosterSet, availableSet) {
      const a = seed.parents[0];
      const b = seed.parents[1];
      const rosterParents = [];
      const missingParents = [];
      if (rosterSet.has(a)) rosterParents.push(0);
      if (!rosterSet.has(a) && !availableSet.has(a)) missingParents.push(0);
      if (b !== null) {
        if (rosterSet.has(b)) rosterParents.push(1);
        if (!rosterSet.has(b) && !availableSet.has(b)) missingParents.push(1);
      }
      const parentNames = [
        speciesName(a),
        seed.familyWildcard
          ? (seed.mateName || ('Any ' + familyName(seed.mateFamilyIndex) + '-family monster'))
          : speciesName(b)
      ];
      const unknowns = BASE_UNKNOWNS.slice();
      if (seed.condition) unknowns.push(seed.condition);
      if (seed.kind === 'plus_threshold') {
        unknowns.push('The required + value is a minimum; the dataset cannot verify actual + values, and an unknown + is not zero.');
      }
      return {
        id: seed.kind + ':' + seed.context + ':' + a + ':' + (b === null ? 'family' + seed.mateFamilyIndex : b),
        kind: seed.kind,
        context: seed.context,
        parents: [a, b],
        parentNames,
        speciesIndex,
        minPlus: seed.minPlus,
        condition: seed.condition,
        mateFamilyIndex: seed.mateFamilyIndex,
        familyWildcard: seed.familyWildcard,
        missingParents,
        rosterParents,
        unknowns
      };
    }

    // Documented, stable ranking (a suggestion, not a guarantee): more roster
    // parents first, then fewer missing parents, then kind order, then
    // ascending parents. A family-wildcard mate is a family-level requirement,
    // not a specific missing species, so it is not counted as missing.
    const KIND_RANK = { base: 0, plus_threshold: 1, flag_gated: 2 };
    function rankRecipes(x, y) {
      const rosterDiff = y.rosterParents.length - x.rosterParents.length;
      if (rosterDiff !== 0) return rosterDiff;
      const missingDiff = x.missingParents.length - y.missingParents.length;
      if (missingDiff !== 0) return missingDiff;
      const kindDiff = KIND_RANK[x.kind] - KIND_RANK[y.kind];
      if (kindDiff !== 0) return kindDiff;
      const aDiff = x.parents[0] - y.parents[0];
      if (aDiff !== 0) return aDiff;
      const bx = x.parents[1] === null ? -1 : x.parents[1];
      const by = y.parents[1] === null ? -1 : y.parents[1];
      return bx - by;
    }

    function assertContext(context) {
      if (!CONTEXTS.includes(context)) throw fail('invalid', 'Breeding context must be base, shrine, or room.');
    }

    function assertPlayable(speciesIndex, label) {
      if (!isPlayableIndex(speciesIndex) || !playableSpecies[speciesIndex]) {
        throw fail('invalid', label + ' must be a playable species from 0 to 314.');
      }
    }

    function assertSpeciesList(list, label) {
      if (!Array.isArray(list)) throw fail('invalid', label + ' must be a list of species indices.');
      for (const value of list) assertPlayable(value, label + ' entry');
    }

    function suggestions(speciesIndex, options) {
      const settings = options == null ? {} : options;
      if (!record(settings)) throw fail('invalid', 'Suggestion options must be an object.');
      const context = settings.context === undefined ? 'shrine' : settings.context;
      assertContext(context);
      assertPlayable(speciesIndex, 'Target species');
      const roster = settings.rosterSpecies === undefined ? [] : settings.rosterSpecies;
      const available = settings.availableSpecies === undefined ? [] : settings.availableSpecies;
      assertSpeciesList(roster, 'Roster species');
      assertSpeciesList(available, 'Available species');
      const page = settings.page === undefined ? 0 : settings.page;
      const pageSize = settings.pageSize === undefined ? 12 : settings.pageSize;
      if (!Number.isInteger(page) || page < 0) throw fail('invalid', 'Page must be a whole number of 0 or more.');
      if (!Number.isInteger(pageSize) || pageSize < 1) throw fail('invalid', 'Page size must be a whole number of 1 or more.');

      const rosterSet = new Set(roster);
      const availableSet = new Set(available);
      const recipes = candidateSeeds(speciesIndex, context)
        .map(seed => buildRecipe(seed, speciesIndex, rosterSet, availableSet));
      recipes.sort(rankRecipes);
      const total = recipes.length;
      const pages = Math.ceil(total / pageSize);
      const start = page * pageSize;
      return { items: recipes.slice(start, start + pageSize), total, page, pageSize, pages, context };
    }

    function suggestionCount(speciesIndex, context) {
      const ctx = context === undefined ? 'shrine' : context;
      assertContext(ctx);
      assertPlayable(speciesIndex, 'Target species');
      return candidateSeeds(speciesIndex, ctx).length;
    }

    function findRecipe(speciesIndex, context, parents) {
      assertContext(context);
      assertPlayable(speciesIndex, 'Target species');
      if (!Array.isArray(parents) || parents.length !== 2) {
        throw fail('invalid', 'Parents must be an ordered pair.');
      }
      const a = parents[0];
      const b = parents[1];
      assertPlayable(a, 'Pedigree species');
      if (b !== null) assertPlayable(b, 'Mate species');
      const seed = candidateSeeds(speciesIndex, context)
        .find(s => s.parents[0] === a && s.parents[1] === b);
      if (!seed) return null;
      return buildRecipe(seed, speciesIndex, new Set(), new Set());
    }

    function clonePlan(plan) {
      return {
        speciesIndex: plan.speciesIndex,
        context: plan.context,
        rootId: plan.rootId,
        nodes: plan.nodes.map(node => ({
          id: node.id,
          speciesIndex: node.speciesIndex,
          recipe: node.recipe === null ? null : {
            parents: [node.recipe.parents[0], node.recipe.parents[1]],
            kind: node.recipe.kind,
            context: node.recipe.context,
            condition: node.recipe.condition,
            minPlus: node.recipe.minPlus
          },
          fulfillment: { choice: node.fulfillment.choice, rosterEntryId: node.fulfillment.rosterEntryId },
          status: node.status,
          note: node.note,
          children: node.children === null ? null : [node.children[0], node.children[1]],
          parent: node.parent
        }))
      };
    }

    function nodeById(plan, nodeId) {
      if (!record(plan) || !Array.isArray(plan.nodes)) return null;
      for (const node of plan.nodes) {
        if (node.id === nodeId) return node;
      }
      return null;
    }

    function nodeDepth(plan, nodeId) {
      let depth = 0;
      let current = nodeById(plan, nodeId);
      const seen = new Set();
      while (current && current.parent !== null) {
        if (seen.has(current.id)) return depth;
        seen.add(current.id);
        depth++;
        current = nodeById(plan, current.parent);
      }
      return depth;
    }

    // The node's own species followed by each ancestor's species up to the root.
    function ancestorSpecies(plan, nodeId) {
      const start = nodeById(plan, nodeId);
      if (!start) throw fail('invalid', 'Plan node ' + nodeId + ' does not exist.');
      const species = [];
      let current = start;
      const seen = new Set();
      while (current) {
        if (seen.has(current.id)) break;
        seen.add(current.id);
        species.push(current.speciesIndex);
        current = current.parent === null ? null : nodeById(plan, current.parent);
      }
      return species;
    }

    function collectDescendants(plan, nodeId, into) {
      const node = nodeById(plan, nodeId);
      if (!node || node.children === null) return;
      for (const childId of node.children) {
        if (into.has(childId)) continue;
        into.add(childId);
        collectDescendants(plan, childId, into);
      }
    }

    function createPlan(speciesIndex, context) {
      const ctx = context === undefined ? 'shrine' : context;
      assertContext(ctx);
      assertPlayable(speciesIndex, 'Target species');
      const id = makeNodeId();
      return {
        speciesIndex,
        context: ctx,
        rootId: id,
        nodes: [{
          id,
          speciesIndex,
          recipe: null,
          fulfillment: { choice: 'recipe', rosterEntryId: null },
          status: 'needed',
          note: '',
          children: null,
          parent: null
        }]
      };
    }

    function normalizeStoredRecipe(recipe) {
      if (!record(recipe)) throw fail('invalid', 'A recipe choice must be an object.');
      if (!Array.isArray(recipe.parents) || recipe.parents.length !== 2) {
        throw fail('invalid', 'A recipe choice needs ordered parents.');
      }
      const a = recipe.parents[0];
      const b = recipe.parents[1];
      assertPlayable(a, 'Pedigree species');
      if (b !== null) assertPlayable(b, 'Mate species');
      if (!KIND_ORDER.includes(recipe.kind)) {
        throw fail('invalid', 'Recipe kind must be base, plus_threshold, or flag_gated.');
      }
      assertContext(recipe.context);
      if (typeof recipe.condition !== 'string') throw fail('invalid', 'Recipe condition must be text.');
      if (recipe.minPlus !== null && !Number.isInteger(recipe.minPlus)) {
        throw fail('invalid', 'Recipe minPlus must be a whole number or null.');
      }
      if (recipe.kind === 'flag_gated' && recipe.context !== 'room') {
        throw fail('invalid', 'A flag_gated recipe belongs to the room context.');
      }
      if (recipe.kind === 'plus_threshold' && recipe.context === 'base') {
        throw fail('invalid', 'A plus_threshold recipe does not belong to the base context.');
      }
      return {
        parents: [a, b],
        kind: recipe.kind,
        context: recipe.context,
        condition: recipe.condition,
        minPlus: recipe.minPlus
      };
    }

    // Cross-check a concrete-parent recipe against the verified core. Wildcard
    // recipes are verified through the room rules instead (the core needs a
    // concrete mate index).
    function verifyWithCore(speciesIndex, stored) {
      if (stored.parents[1] === null) return;
      const plus = stored.kind === 'plus_threshold' ? stored.minPlus : 0;
      const result = coreInstance.result(stored.parents[0], stored.parents[1], plus, plus, stored.context);
      if (result.resultIndex !== speciesIndex) {
        throw fail('invalid', 'This recipe does not produce species ' + speciesIndex + ' in the ' + stored.context + ' context.');
      }
    }

    function canonicalStoredRecipe(speciesIndex, context, stored) {
      const found = findRecipe(speciesIndex, context, stored.parents);
      if (!found || found.kind !== stored.kind || found.context !== stored.context) {
        throw fail('invalid', 'This recipe does not produce species ' + speciesIndex + ' in the ' + context + ' context.');
      }
      return {
        parents: [found.parents[0], found.parents[1]],
        kind: found.kind,
        context: found.context,
        condition: found.condition === undefined ? '' : found.condition,
        minPlus: found.minPlus === undefined ? null : found.minPlus
      };
    }

    function applyRecipe(node, nodeId, stored) {
      const pedigreeId = makeNodeId();
      const mateId = makeNodeId();
      node.recipe = {
        parents: [stored.parents[0], stored.parents[1]],
        kind: stored.kind,
        context: stored.context,
        condition: stored.condition,
        minPlus: stored.minPlus
      };
      node.children = [pedigreeId, mateId];
      return [
        {
          id: pedigreeId,
          speciesIndex: stored.parents[0],
          recipe: null,
          fulfillment: { choice: 'recipe', rosterEntryId: null },
          status: 'needed',
          note: '',
          children: null,
          parent: nodeId
        },
        {
          id: mateId,
          speciesIndex: stored.parents[1],
          recipe: null,
          fulfillment: { choice: 'recipe', rosterEntryId: null },
          status: 'needed',
          note: '',
          children: null,
          parent: nodeId
        }
      ];
    }

    function expand(plan, nodeId, recipe) {
      if (!record(plan)) throw fail('invalid', 'The plan must be an object.');
      const next = clonePlan(plan);
      const node = nodeById(next, nodeId);
      if (!node) throw fail('invalid', 'Plan node ' + nodeId + ' does not exist.');
      if (node.children !== null) throw fail('invalid', 'Plan node ' + nodeId + ' is already expanded.');
      const stored = normalizeStoredRecipe(recipe);
      const canonical = canonicalStoredRecipe(node.speciesIndex, next.context, stored);
      verifyWithCore(node.speciesIndex, canonical);
      const ancestors = ancestorSpecies(next, nodeId);
      for (const childSpecies of canonical.parents) {
        if (childSpecies !== null && ancestors.indexOf(childSpecies) !== -1) {
          throw fail('invalid', 'Expanding species ' + node.speciesIndex + ' with these parents would create a cycle: species ' + childSpecies + ' is already an ancestor.');
        }
      }
      const depth = nodeDepth(next, nodeId);
      if (depth + 1 > MAX_PLAN_DEPTH) {
        throw fail('limit', 'The plan exceeds the maximum depth of ' + MAX_PLAN_DEPTH + '.');
      }
      if (next.nodes.length + 2 > MAX_PLAN_NODES) {
        throw fail('limit', 'The plan exceeds the maximum of ' + MAX_PLAN_NODES + ' nodes.');
      }
      node.fulfillment = { choice: 'recipe', rosterEntryId: node.fulfillment.rosterEntryId };
      const children = applyRecipe(node, nodeId, canonical);
      next.nodes.push(children[0], children[1]);
      return next;
    }

    function collapse(plan, nodeId) {
      if (!record(plan)) throw fail('invalid', 'The plan must be an object.');
      const next = clonePlan(plan);
      const node = nodeById(next, nodeId);
      if (!node) throw fail('invalid', 'Plan node ' + nodeId + ' does not exist.');
      if (node.children !== null) {
        const toRemove = new Set();
        collectDescendants(next, nodeId, toRemove);
        next.nodes = next.nodes.filter(n => !toRemove.has(n.id));
      }
      node.children = null;
      node.recipe = null;
      return next;
    }

    function replaceRecipe(plan, nodeId, recipe) {
      if (!record(plan)) throw fail('invalid', 'The plan must be an object.');
      const next = clonePlan(plan);
      const node = nodeById(next, nodeId);
      if (!node) throw fail('invalid', 'Plan node ' + nodeId + ' does not exist.');
      if (node.children === null) throw fail('invalid', 'Plan node ' + nodeId + ' is not expanded.');
      const stored = normalizeStoredRecipe(recipe);
      const canonical = canonicalStoredRecipe(node.speciesIndex, next.context, stored);
      verifyWithCore(node.speciesIndex, canonical);
      const ancestors = ancestorSpecies(next, nodeId);
      for (const childSpecies of canonical.parents) {
        if (childSpecies !== null && ancestors.indexOf(childSpecies) !== -1) {
          throw fail('invalid', 'Replacing the recipe on species ' + node.speciesIndex + ' would create a cycle: species ' + childSpecies + ' is already an ancestor.');
        }
      }
      const toRemove = new Set();
      collectDescendants(next, nodeId, toRemove);
      const newTotal = next.nodes.length - toRemove.size + 2;
      if (newTotal > MAX_PLAN_NODES) {
        throw fail('limit', 'The plan exceeds the maximum of ' + MAX_PLAN_NODES + ' nodes.');
      }
      const depth = nodeDepth(next, nodeId);
      if (depth + 1 > MAX_PLAN_DEPTH) {
        throw fail('limit', 'The plan exceeds the maximum depth of ' + MAX_PLAN_DEPTH + '.');
      }
      next.nodes = next.nodes.filter(n => !toRemove.has(n.id));
      const children = applyRecipe(node, nodeId, canonical);
      next.nodes.push(children[0], children[1]);
      return { plan: next, undo: () => plan };
    }

    function setFulfillment(plan, nodeId, fulfillment) {
      if (!record(plan)) throw fail('invalid', 'The plan must be an object.');
      const next = clonePlan(plan);
      const node = nodeById(next, nodeId);
      if (!node) throw fail('invalid', 'Plan node ' + nodeId + ' does not exist.');
      if (!record(fulfillment) || !FULFILLMENT_CHOICES.includes(fulfillment.choice)) {
        throw fail('invalid', 'Fulfillment choice must be recipe, roster, or available.');
      }
      let rosterEntryId = null;
      if (fulfillment.choice === 'roster') {
        if (typeof fulfillment.rosterEntryId !== 'string' || fulfillment.rosterEntryId.trim() === '') {
          throw fail('invalid', 'A roster fulfillment requires a roster entry id.');
        }
        rosterEntryId = fulfillment.rosterEntryId;
      } else if (fulfillment.rosterEntryId !== undefined && fulfillment.rosterEntryId !== null) {
        if (typeof fulfillment.rosterEntryId !== 'string') throw fail('invalid', 'Roster entry id must be text.');
        rosterEntryId = fulfillment.rosterEntryId;
      }
      node.fulfillment = { choice: fulfillment.choice, rosterEntryId };
      return next;
    }

    function setStatus(plan, nodeId, status) {
      if (!record(plan)) throw fail('invalid', 'The plan must be an object.');
      if (!TARGET_STATUSES.includes(status)) {
        throw fail('invalid', 'Status must be needed, ready, or completed.');
      }
      const next = clonePlan(plan);
      const node = nodeById(next, nodeId);
      if (!node) throw fail('invalid', 'Plan node ' + nodeId + ' does not exist.');
      node.status = status;
      return next;
    }

    function setNote(plan, nodeId, note) {
      if (!record(plan)) throw fail('invalid', 'The plan must be an object.');
      if (typeof note !== 'string') throw fail('invalid', 'Note must be text.');
      const next = clonePlan(plan);
      const node = nodeById(next, nodeId);
      if (!node) throw fail('invalid', 'Plan node ' + nodeId + ' does not exist.');
      node.note = note.trim().slice(0, MAX_NOTE_LENGTH);
      return next;
    }

    // A roster entry linked by more than one unfinished node (breeding consumes
    // parents). Purely a warning; completing a node clears its usage.
    function duplicateRosterWarnings(plan) {
      if (!record(plan) || !Array.isArray(plan.nodes)) throw fail('invalid', 'The plan must be an object with nodes.');
      const byEntry = new Map();
      for (const node of plan.nodes) {
        const entryId = node.fulfillment.rosterEntryId;
        if (entryId === null || node.status === 'completed') continue;
        if (!byEntry.has(entryId)) byEntry.set(entryId, []);
        byEntry.get(entryId).push(node.id);
      }
      const warnings = [];
      for (const entry of byEntry) {
        if (entry[1].length > 1) warnings.push({ entryId: entry[0], nodeIds: entry[1] });
      }
      return warnings;
    }

    function validateStoredRecipe(recipe, label) {
      if (!record(recipe)) throw fail('invalid', label + ' recipe must be an object.');
      if (!Array.isArray(recipe.parents) || recipe.parents.length !== 2) {
        throw fail('invalid', label + ' recipe needs ordered parents.');
      }
      if (!isPlayableIndex(recipe.parents[0]) || !playableSpecies[recipe.parents[0]]) {
        throw fail('invalid', label + ' recipe pedigree must be a playable species.');
      }
      if (recipe.parents[1] !== null && (!isPlayableIndex(recipe.parents[1]) || !playableSpecies[recipe.parents[1]])) {
        throw fail('invalid', label + ' recipe mate must be a playable species or null.');
      }
      if (!KIND_ORDER.includes(recipe.kind)) throw fail('invalid', label + ' recipe has an invalid kind.');
      if (!CONTEXTS.includes(recipe.context)) throw fail('invalid', label + ' recipe has an invalid context.');
      if (typeof recipe.condition !== 'string') throw fail('invalid', label + ' recipe condition must be text.');
      if (recipe.minPlus !== null && !Number.isInteger(recipe.minPlus)) {
        throw fail('invalid', label + ' recipe minPlus must be a whole number or null.');
      }
    }

    function validate(plan) {
      if (!record(plan)) throw fail('invalid', 'The plan must be an object.');
      if (!isPlayableIndex(plan.speciesIndex) || !playableSpecies[plan.speciesIndex]) {
        throw fail('invalid', 'Plan target species must be a playable species.');
      }
      if (!CONTEXTS.includes(plan.context)) throw fail('invalid', 'Plan context must be base, shrine, or room.');
      if (typeof plan.rootId !== 'string') throw fail('invalid', 'Plan root id must be text.');
      if (!Array.isArray(plan.nodes) || plan.nodes.length === 0) {
        throw fail('invalid', 'Plan nodes must be a non-empty list.');
      }
      const ids = new Set();
      let rootCount = 0;
      for (const node of plan.nodes) {
        if (!record(node)) throw fail('invalid', 'Each plan node must be an object.');
        if (typeof node.id !== 'string' || !NODE_ID_PATTERN.test(node.id)) {
          throw fail('invalid', 'Plan node ids must be 1-64 letters, numbers, underscores, or hyphens, starting with a letter or number.');
        }
        if (ids.has(node.id)) throw fail('invalid', 'Plan node id ' + node.id + ' is duplicated.');
        ids.add(node.id);
        if (node.speciesIndex !== null && (!isPlayableIndex(node.speciesIndex) || !playableSpecies[node.speciesIndex])) {
          throw fail('invalid', 'Plan node ' + node.id + ' has an invalid species index.');
        }
        if (node.recipe !== null) validateStoredRecipe(node.recipe, 'Plan node ' + node.id);
        if (node.recipe !== null && node.recipe.context !== plan.context) {
          throw fail('invalid', 'Plan node ' + node.id + ' stores a recipe for a different breeding context.');
        }
        if (!record(node.fulfillment) || !FULFILLMENT_CHOICES.includes(node.fulfillment.choice)) {
          throw fail('invalid', 'Plan node ' + node.id + ' has an invalid fulfillment choice.');
        }
        if (node.fulfillment.choice === 'roster' &&
            (typeof node.fulfillment.rosterEntryId !== 'string' || node.fulfillment.rosterEntryId.trim() === '')) {
          throw fail('invalid', 'Plan node ' + node.id + ' needs a roster entry id for a roster fulfillment.');
        }
        if (node.fulfillment.rosterEntryId !== null && typeof node.fulfillment.rosterEntryId !== 'string') {
          throw fail('invalid', 'Plan node ' + node.id + ' has an invalid roster entry id.');
        }
        if (!TARGET_STATUSES.includes(node.status)) {
          throw fail('invalid', 'Plan node ' + node.id + ' has an invalid status.');
        }
        if (typeof node.note !== 'string' || node.note.length > MAX_NOTE_LENGTH) {
          throw fail('invalid', 'Plan node ' + node.id + ' has an invalid note.');
        }
        if (node.children !== null && (!Array.isArray(node.children) || node.children.length !== 2)) {
          throw fail('invalid', 'Plan node ' + node.id + ' children must be a pedigree and mate pair.');
        }
        if (node.parent !== null && typeof node.parent !== 'string') {
          throw fail('invalid', 'Plan node ' + node.id + ' has an invalid parent.');
        }
        if (node.parent === null) rootCount++;
      }
      if (rootCount !== 1) throw fail('invalid', 'The plan must have exactly one root node.');
      if (!ids.has(plan.rootId)) throw fail('invalid', 'Plan root id does not reference a node.');
      const root = nodeById(plan, plan.rootId);
      if (root.parent !== null) throw fail('invalid', 'The root node must not have a parent.');

      for (const node of plan.nodes) {
        if (node.parent !== null && !ids.has(node.parent)) {
          throw fail('invalid', 'Plan node ' + node.id + ' references a missing parent ' + node.parent + '.');
        }
        if (node.children !== null) {
          const pedigree = nodeById(plan, node.children[0]);
          const mate = nodeById(plan, node.children[1]);
          if (!pedigree) throw fail('invalid', 'Plan node ' + node.id + ' references a missing pedigree child.');
          if (!mate) throw fail('invalid', 'Plan node ' + node.id + ' references a missing mate child.');
          if (pedigree.parent !== node.id) throw fail('invalid', 'Plan node ' + node.id + ' pedigree child does not link back.');
          if (mate.parent !== node.id) throw fail('invalid', 'Plan node ' + node.id + ' mate child does not link back.');
          if (node.recipe === null) throw fail('invalid', 'Plan node ' + node.id + ' has children but no recipe.');
          if (pedigree.speciesIndex !== node.recipe.parents[0]) {
            throw fail('invalid', 'Plan node ' + node.id + ' pedigree child species does not match the recipe.');
          }
          if (mate.speciesIndex !== node.recipe.parents[1]) {
            throw fail('invalid', 'Plan node ' + node.id + ' mate child species does not match the recipe.');
          }
        } else if (node.recipe !== null) {
          throw fail('invalid', 'Plan node ' + node.id + ' has a recipe but no children.');
        }
        if (node.speciesIndex === null) {
          const parent = node.parent === null ? null : nodeById(plan, node.parent);
          if (!parent || parent.recipe === null || parent.recipe.kind !== 'flag_gated' ||
              parent.recipe.parents[1] !== null || parent.children === null || parent.children[1] !== node.id) {
            throw fail('invalid', 'Plan node ' + node.id + ' has no species; only a family-wildcard mate child may.');
          }
        }
      }

      for (const node of plan.nodes) {
        const seen = new Set();
        let current = node;
        while (current) {
          if (seen.has(current.id)) throw fail('invalid', 'Plan node ' + node.id + ' is part of a cycle.');
          seen.add(current.id);
          current = current.parent === null ? null : nodeById(plan, current.parent);
        }
      }

      if (plan.nodes.length > MAX_PLAN_NODES) {
        throw fail('limit', 'The plan exceeds the maximum of ' + MAX_PLAN_NODES + ' nodes.');
      }
      let maxDepth = 0;
      for (const node of plan.nodes) {
        const depth = nodeDepth(plan, node.id);
        if (depth > maxDepth) maxDepth = depth;
      }
      if (maxDepth > MAX_PLAN_DEPTH) {
        throw fail('limit', 'The plan exceeds the maximum depth of ' + MAX_PLAN_DEPTH + '.');
      }
      return true;
    }

    function buildRulesView(data) {
      if (!record(data) || !Array.isArray(data.species) || !Array.isArray(data.matrix) ||
          !record(data.runtime_rules) || !Array.isArray(data.runtime_rules.rules)) {
        throw fail('invalid', 'The verified species, breeding matrix, and runtime rules are required.');
      }
      return {
        matrix: data.matrix,
        plusRules: data.runtime_rules.rules.filter(rule => rule.kind === 'plus_threshold'),
        roomRules: data.runtime_rules.rules.filter(rule => rule.kind === 'flag_gated')
      };
    }

    function contextCompatible(kind, planContext) {
      if (kind === 'flag_gated') return planContext === 'room';
      if (kind === 'plus_threshold') return planContext === 'shrine' || planContext === 'room';
      return true;
    }

    // Recompute what a stored recipe produces under the given data, mirroring
    // the core's per-kind precedence. Returns the result species index, or null
    // when the recipe no longer produces a result.
    function recomputeResult(view, recipe) {
      const a = recipe.parents[0];
      const b = recipe.parents[1];
      const row = view.matrix[a];
      const base = row && row[b];
      if (recipe.kind === 'base') {
        return Number.isInteger(base) ? base : null;
      }
      if (recipe.kind === 'plus_threshold') {
        for (const rule of view.plusRules) {
          if (rule.pedigree_index === a && rule.mate_index === b &&
              Number.isInteger(recipe.minPlus) && recipe.minPlus >= rule.minimum_parent_plus) {
            return rule.offspring_index;
          }
        }
        return Number.isInteger(base) ? base : null;
      }
      if (b === null) {
        const matches = view.roomRules.filter(rule => rule.pedigree_index === a && rule.mate_index == null);
        if (matches.length === 0) return null;
        if (matches.length > 1 && recipe.condition) {
          const byCondition = matches.filter(rule => rule.condition === recipe.condition);
          if (byCondition.length === 1) return byCondition[0].offspring_index;
        }
        return matches[0].offspring_index;
      }
      for (const rule of view.roomRules) {
        if (rule.pedigree_index === a && rule.mate_index === b) return rule.offspring_index;
      }
      return null;
    }

    // Flags stored recipes whose recomputed result no longer matches the node's
    // species or the plan context. Read-only: it never drops notes or status.
    function validateContext(plan, options) {
      if (!record(plan) || !Array.isArray(plan.nodes)) throw fail('invalid', 'The plan must be an object with nodes.');
      const settings = options == null ? {} : options;
      if (!record(settings)) throw fail('invalid', 'Validation options must be an object.');
      const view = buildRulesView(settings.data || data);
      const flags = [];
      for (const node of plan.nodes) {
        if (node.recipe === null) continue;
        if (!contextCompatible(node.recipe.kind, plan.context)) {
          flags.push({
            nodeId: node.id,
            reason: 'The stored ' + node.recipe.kind + ' recipe does not match the ' + plan.context + ' plan context.'
          });
          continue;
        }
        if (node.recipe.kind === 'plus_threshold') {
          const rule = view.plusRules.find(candidate => candidate.pedigree_index === node.recipe.parents[0] &&
            candidate.mate_index === node.recipe.parents[1]);
          if (!rule || node.recipe.minPlus !== rule.minimum_parent_plus) {
            flags.push({
              nodeId: node.id,
              reason: 'The stored + threshold does not match the verified rule.'
            });
            continue;
          }
        }
        const result = recomputeResult(view, node.recipe);
        if (result !== node.speciesIndex) {
          flags.push({
            nodeId: node.id,
            reason: 'The stored recipe no longer produces species ' + node.speciesIndex + ' in the ' + node.recipe.context + ' context.'
          });
        }
      }
      return flags;
    }

    function planSummary(plan) {
      if (!record(plan) || !Array.isArray(plan.nodes)) throw fail('invalid', 'The plan must be an object with nodes.');
      const summary = { total: plan.nodes.length, completed: 0, ready: 0, needed: 0, depth: 0 };
      for (const node of plan.nodes) {
        if (node.status === 'completed') summary.completed++;
        else if (node.status === 'ready') summary.ready++;
        else summary.needed++;
        const depth = nodeDepth(plan, node.id);
        if (depth > summary.depth) summary.depth = depth;
      }
      return summary;
    }

    return Object.freeze({
      suggestions,
      suggestionCount,
      findRecipe,
      createPlan,
      expand,
      collapse,
      replaceRecipe,
      setFulfillment,
      setStatus,
      setNote,
      ancestorSpecies,
      nodeById,
      duplicateRosterWarnings,
      validate,
      validateContext,
      planSummary,
      MAX_PLAN_DEPTH,
      MAX_PLAN_NODES,
      TARGET_STATUSES
    });
  }

  root.DQMRecipePlanner = Object.freeze({
    create, MAX_PLAN_DEPTH, MAX_PLAN_NODES, TARGET_STATUSES
  });
})(globalThis);
