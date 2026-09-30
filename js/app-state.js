/* DQM-guide saved application state: schema validation, legacy migration, and pure
   state updates. No DOM, no localStorage, no timers, no network. Load after
   data/breeding-data.js and js/planner-core.js; use DQMAppState.create(DATA, DQMPlannerCore). */
(function (root) {
  'use strict';

  const APP_VERSION = 2;
  const GAME_ID = 'dqm1-2-ps1-v61';
  const STORAGE_KEY = 'dqm-guide-state-v61-v1';
  const LEGACY_TEAM_KEY = 'dqm-guide-team-v61-v1';
  const LEGACY_SPRITE_KEY = 'dqm-guide-sprite-style-v1';
  const MAX_TEAMS = 20;
  const MAX_ENTRIES = 100;
  const MAX_TARGETS = 50;
  const MAX_NAME_LENGTH = 40;
  const MAX_IMPORT_LENGTH = 2000000;
  const SPRITE_STYLES = Object.freeze(['portrait', 'overworld']);
  const TEAM_GAMES = Object.freeze(['dqm1', 'dqm2']);
  const ENTRY_LOCATIONS = Object.freeze(['party', 'farm']);
  const DEFAULT_GAME = 'dqm1';
  const TARGET_STATUSES = Object.freeze(['needed', 'ready', 'completed']);
  const MAX_PLAN_DEPTH = 12;
  const MAX_PLAN_NODES = 100;
  const DEFAULT_TEAM_NAME = 'My team';
  const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
  const FORBIDDEN_IDS = ['constructor', 'prototype'];
  const DOCUMENT_KEYS = ['version', 'game', 'activeGame', 'spriteStyle', 'favoriteSpeciesIndices', 'activeTeamId', 'teams'];
  const TEAM_KEYS = ['id', 'name', 'game', 'entries', 'activeTargetId', 'targets'];
  const ENTRY_KEYS = ['id', 'speciesIndex', 'sex', 'plus', 'nickname', 'location'];
  const TARGET_KEYS = ['id', 'speciesIndex', 'plan'];

  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const ownKeys = value => Object.keys(value);

  function fail(code, message) {
    const error = new Error(message);
    error.code = code;
    throw error;
  }

  function isNewerError(error) {
    return Boolean(error) && error.code === 'newer';
  }

  function errorCode(error) {
    return error && error.code ? error.code : undefined;
  }

  function create(data, core) {
    if (!data || !core) {
      throw new Error('The species data and DQMPlannerCore are required.');
    }
    if (typeof core.normalizeState !== 'function' && typeof core.create === 'function') {
      core = core.create(data);
    }
    if (typeof core.normalizeState !== 'function') {
      throw new Error('The DQMPlannerCore module or instance is required.');
    }
    const playable = new Set();
    for (const species of data.species) {
      if (record(species) && species.playable === true && Number.isInteger(species.index)) {
        playable.add(species.index);
      }
    }

    function playableIndex(value, label) {
      if (!Number.isInteger(value) || !playable.has(value)) {
        fail('invalid', label + ' must identify a playable species.');
      }
      return value;
    }

    function validateId(id, label) {
      if (typeof id !== 'string' || !ID_PATTERN.test(id) || FORBIDDEN_IDS.includes(id)) {
        fail('invalid', label + ' has an invalid ID. Use 1-64 letters, numbers, underscores, or hyphens, starting with a letter or number.');
      }
      return id;
    }

    function deepClone(value, seen) {
      if (value === null || typeof value !== 'object') return value;
      const copies = seen || new Map();
      if (copies.has(value)) fail('invalid', 'The document contains a circular reference.');
      if (Array.isArray(value)) {
        const copy = [];
        copies.set(value, copy);
        for (const item of value) copy.push(deepClone(item, copies));
        copies.delete(value);
        return copy;
      }
      const copy = {};
      copies.set(value, copy);
      for (const key of ownKeys(value)) copy[key] = deepClone(value[key], copies);
      copies.delete(value);
      return copy;
    }

    function extraKeys(value, known) {
      const extra = {};
      for (const key of ownKeys(value)) {
        if (!known.includes(key)) extra[key] = deepClone(value[key]);
      }
      return extra;
    }

    function teamName(name, label) {
      const trimmed = typeof name === 'string' ? name.trim().slice(0, MAX_NAME_LENGTH) : '';
      if (!trimmed) fail('invalid', label + ' name must include at least one character after trimming.');
      return trimmed;
    }

    /** A team's game: 'dqm1' | 'dqm2', or null while it stays unassigned. */
    function teamGameOrNull(value, label) {
      if (value === undefined || value === null) return null;
      if (!TEAM_GAMES.includes(value)) {
        fail('invalid', label + ' game must be dqm1, dqm2, or null for an unassigned team.');
      }
      return value;
    }

    /** Where a saved monster lives. Every version-1 monster is a party monster. */
    function entryLocation(value, label) {
      if (value === undefined) return 'party';
      if (!ENTRY_LOCATIONS.includes(value)) {
        fail('invalid', label + ' location must be party or farm.');
      }
      return value;
    }

    function documentGame(value) {
      if (value === undefined) return DEFAULT_GAME;
      if (!TEAM_GAMES.includes(value)) fail('invalid', 'The active game must be dqm1 or dqm2.');
      return value;
    }

    function validateEntries(entries, defaultFavorite) {
      if (!Array.isArray(entries)) fail('invalid', 'Entries must be a list.');
      if (entries.length > MAX_ENTRIES) fail('limit', 'A team can hold at most ' + MAX_ENTRIES + ' monsters.');
      let normalized;
      try {
        normalized = core.normalizeState({ version: APP_VERSION, game: GAME_ID, entries });
      } catch (error) {
        fail('invalid', error && error.message ? error.message : 'The team entries are invalid.');
      }
      return normalized.entries.map((entry, index) => {
        const raw = entries[index];
        const label = 'Monster ' + (index + 1);
        const favorite = raw.favorite === undefined ? defaultFavorite : raw.favorite;
        if (typeof favorite !== 'boolean') fail('invalid', label + ' favorite must be true or false.');
        const location = entryLocation(raw.location, label);
        return { ...extraKeys(raw, ENTRY_KEYS), ...entry, favorite, location };
      });
    }

    function normalizeTeam(team, position, teamIds) {
      const label = 'Team ' + (position + 1);
      if (!record(team)) fail('invalid', label + ' must be an object.');
      validateId(team.id, label);
      if (teamIds.has(team.id)) fail('invalid', label + ' has a duplicate ID. Each team needs its own ID.');
      teamIds.add(team.id);
      const name = teamName(team.name, label);
      const game = teamGameOrNull(team.game, label);
      const entries = validateEntries(team.entries);
      if (!Array.isArray(team.targets)) fail('invalid', label + ' must include a targets list.');
      if (team.targets.length > MAX_TARGETS) fail('limit', label + ' can hold at most ' + MAX_TARGETS + ' targets.');
      const targetIds = new Set();
      const targets = team.targets.map((target, index) => {
        const targetLabel = label + ' target ' + (index + 1);
        if (!record(target)) fail('invalid', targetLabel + ' must be an object.');
        validateId(target.id, targetLabel);
        if (targetIds.has(target.id)) fail('invalid', targetLabel + ' has a duplicate ID. Each target needs its own ID.');
        targetIds.add(target.id);
        playableIndex(target.speciesIndex, targetLabel + ' species');
        if (target.plan !== null && !record(target.plan)) fail('invalid', targetLabel + ' plan must be an object or null.');
        return {
          ...extraKeys(target, TARGET_KEYS),
          id: target.id,
          speciesIndex: target.speciesIndex,
          plan: target.plan === null ? null : deepClone(target.plan),
        };
      });
      if (team.activeTargetId !== null &&
          (typeof team.activeTargetId !== 'string' || !targetIds.has(team.activeTargetId))) {
        fail('invalid', label + ' active target must be null or identify one of its targets.');
      }
      return {
        ...extraKeys(team, TEAM_KEYS),
        id: team.id,
        name,
        game,
        entries,
        activeTargetId: team.activeTargetId,
        targets,
      };
    }

    function normalizeDocument(input) {
      if (!record(input)) fail('invalid', 'The saved document must be an object.');
      if (typeof input.version === 'number' && input.version > APP_VERSION) {
        fail('newer', 'This document was saved by a newer version of the guide. Expected version ' + APP_VERSION + '.');
      }
      if (input.version !== 1 && input.version !== APP_VERSION) {
        fail('invalid', 'Unsupported document version. Expected 1 or ' + APP_VERSION + '.');
      }
      if (input.game !== GAME_ID) fail('game', 'This document belongs to a different game or patch. Expected ' + GAME_ID + '.');
      const activeGame = documentGame(input.activeGame);
      if (!SPRITE_STYLES.includes(input.spriteStyle)) {
        fail('invalid', 'Sprite style must be ' + SPRITE_STYLES.join(' or ') + '.');
      }
      if (!Array.isArray(input.favoriteSpeciesIndices)) fail('invalid', 'Favorite species must be a list.');
      const favorites = [];
      for (const index of input.favoriteSpeciesIndices) {
        playableIndex(index, 'Favorite species');
        if (favorites.includes(index)) fail('invalid', 'Favorite species must be unique.');
        favorites.push(index);
      }
      favorites.sort((a, b) => a - b);
      if (!Array.isArray(input.teams)) fail('invalid', 'The document must include a teams list.');
      if (input.teams.length === 0) fail('invalid', 'The document must include at least one team.');
      if (input.teams.length > MAX_TEAMS) fail('limit', 'A document can hold at most ' + MAX_TEAMS + ' teams.');
      const teamIds = new Set();
      const teams = input.teams.map((team, index) => normalizeTeam(team, index, teamIds));
      if (typeof input.activeTeamId !== 'string' || !teamIds.has(input.activeTeamId)) {
        fail('invalid', 'The active team must identify a team in the document.');
      }
      return {
        ...extraKeys(input, DOCUMENT_KEYS),
        version: APP_VERSION,
        game: GAME_ID,
        activeGame,
        spriteStyle: input.spriteStyle,
        favoriteSpeciesIndices: favorites,
        activeTeamId: input.activeTeamId,
        teams,
      };
    }

    function parseDocument(text) {
      if (typeof text !== 'string' || text.length > MAX_IMPORT_LENGTH) {
        fail('invalid', 'Choose a backup JSON file smaller than ' + MAX_IMPORT_LENGTH + ' characters.');
      }
      let parsed;
      try { parsed = JSON.parse(text); } catch { fail('invalid', 'This file is not valid JSON. Choose a guide backup export.'); }
      return normalizeDocument(parsed);
    }

    let idCounter = 0;
    function makeId(prefix) {
      let random;
      if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        random = crypto.randomUUID();
      } else {
        idCounter += 1;
        random = Date.now().toString(36) + idCounter.toString(36) + Math.random().toString(36).slice(2, 12);
      }
      return (prefix + random.replace(/-/g, '')).slice(0, 64);
    }

    function defaultState() {
      const team = { id: makeId('t-'), name: DEFAULT_TEAM_NAME, game: null, entries: [], activeTargetId: null, targets: [] };
      return {
        version: APP_VERSION,
        game: GAME_ID,
        activeGame: DEFAULT_GAME,
        spriteStyle: 'portrait',
        favoriteSpeciesIndices: [],
        activeTeamId: team.id,
        teams: [team],
      };
    }

    function summarize(state) {
      let entries = 0;
      let targets = 0;
      for (const team of state.teams) {
        entries += team.entries.length;
        targets += team.targets.length;
      }
      return { teams: state.teams.length, entries, targets, favorites: state.favoriteSpeciesIndices.length };
    }

    function toJSON(state) {
      return JSON.stringify(normalizeDocument(state), null, 2) + '\n';
    }

    function findTeam(state, teamId) {
      return state.teams.find(team => team.id === teamId) || null;
    }

    function findTarget(state, teamId, targetId) {
      const team = findTeam(state, teamId);
      if (!team) return null;
      return team.targets.find(target => target.id === targetId) || null;
    }

    function teamFromLegacy(input, name) {
      let entries;
      if (record(input) && Array.isArray(input.teams)) {
        if (input.teams.length === 0) fail('invalid', 'The document has no teams to import.');
        const first = input.teams[0];
        if (!record(first) || !Array.isArray(first.entries)) fail('invalid', 'The first team has no entries list.');
        entries = first.entries;
      } else if (record(input) && Array.isArray(input.entries)) {
        entries = input.entries;
      } else {
        fail('invalid', 'A legacy team must be a team or document with an entries list.');
      }
      if (typeof input.version === 'number' && input.version > APP_VERSION) {
        fail('newer', 'This team file was saved by a newer version of the guide. Expected version ' + APP_VERSION + '.');
      }
      if (input.version !== 1 && input.version !== APP_VERSION) {
        fail('invalid', 'Unsupported team file. Expected version 1 or ' + APP_VERSION + '.');
      }
      if (input.game !== GAME_ID) fail('game', 'This team file belongs to a different game or patch. Expected ' + GAME_ID + '.');
      const validated = validateEntries(entries, false);
      if (validated.length === 0) fail('invalid', 'The legacy team has no usable entries.');
      const teamName = typeof name === 'string' && name.trim()
        ? name.trim().slice(0, MAX_NAME_LENGTH)
        : DEFAULT_TEAM_NAME;
      // Imported teams start unassigned; the player files them under a game.
      return { id: makeId('t-'), name: teamName, game: null, entries: validated, activeTargetId: null, targets: [] };
    }

    function parseLegacyTeam(text, name) {
      if (typeof text !== 'string' || text.length > MAX_IMPORT_LENGTH) {
        fail('invalid', 'Choose a team JSON file smaller than ' + MAX_IMPORT_LENGTH + ' characters.');
      }
      let parsed;
      try { parsed = JSON.parse(text); } catch { fail('invalid', 'This file is not valid JSON. Choose a team JSON export.'); }
      return teamFromLegacy(parsed, name);
    }

    function migrateFromLegacy(legacy) {
      const options = record(legacy) ? legacy : {};
      let state = defaultState();
      if (options.spriteText === 'overworld') {
        state = { ...state, spriteStyle: 'overworld' };
      }
      if (typeof options.teamText === 'string' && options.teamText.trim() !== '') {
        try {
          const team = parseLegacyTeam(options.teamText, DEFAULT_TEAM_NAME);
          state = { ...state, teams: [team], activeTeamId: team.id };
        } catch {
          // Ignore malformed legacy input and keep the default team.
        }
      }
      return state;
    }

    function importAny(text) {
      if (typeof text !== 'string' || text.length > MAX_IMPORT_LENGTH) {
        fail('invalid', 'Choose a backup JSON file smaller than ' + MAX_IMPORT_LENGTH + ' characters.');
      }
      let parsed;
      try { parsed = JSON.parse(text); } catch { fail('invalid', 'This file is not valid JSON. Choose a guide backup export.'); }
      if (record(parsed) && typeof parsed.version === 'number' && parsed.version > APP_VERSION) {
        fail('newer', 'This backup was saved by a newer version of the guide. Expected version ' + APP_VERSION + '.');
      }
      if (record(parsed) && Array.isArray(parsed.teams)) {
        const state = normalizeDocument(parsed);
        return { kind: 'full', state, summary: summarize(state) };
      }
      if (record(parsed) && Array.isArray(parsed.entries)) {
        const team = teamFromLegacy(parsed, DEFAULT_TEAM_NAME);
        const state = { ...defaultState(), teams: [team], activeTeamId: team.id };
        return { kind: 'legacy', state, summary: summarize(state) };
      }
      fail('invalid', 'The file is neither a full backup nor a legacy team export.');
    }

    function setSpriteStyle(state, style) {
      if (!SPRITE_STYLES.includes(style)) fail('invalid', 'Sprite style must be ' + SPRITE_STYLES.join(' or ') + '.');
      return { ...state, spriteStyle: style };
    }

    function teamIndex(state, teamId) {
      return state.teams.findIndex(team => team.id === teamId);
    }

    function withTeam(state, teamId, changes) {
      const index = teamIndex(state, teamId);
      if (index === -1) fail('invalid', 'The team was not found.');
      const teams = state.teams.slice();
      teams[index] = { ...teams[index], ...changes };
      return { ...state, teams };
    }

    function addTeam(state, name) {
      const trimmed = teamName(name, 'Team');
      if (state.teams.length >= MAX_TEAMS) fail('limit', 'A document can hold at most ' + MAX_TEAMS + ' teams.');
      // A team created while viewing a game belongs to that game.
      const team = { id: makeId('t-'), name: trimmed, game: state.activeGame, entries: [], activeTargetId: null, targets: [] };
      return { ...state, teams: [...state.teams, team] };
    }

    function insertTeam(state, team) {
      if (state.teams.length >= MAX_TEAMS) fail('limit', 'A document can hold at most ' + MAX_TEAMS + ' teams.');
      const teamIds = new Set(state.teams.map(existing => existing.id));
      const normalized = normalizeTeam(team, state.teams.length, teamIds);
      return { ...state, teams: [...state.teams, normalized] };
    }

    function renameTeam(state, teamId, name) {
      const index = teamIndex(state, teamId);
      if (index === -1) fail('invalid', 'The team was not found.');
      return withTeam(state, teamId, { name: teamName(name, 'Team') });
    }

    function deleteTeam(state, teamId) {
      const index = teamIndex(state, teamId);
      if (index === -1) fail('invalid', 'The team was not found.');
      const teams = state.teams.filter(team => team.id !== teamId);
      let activeTeamId = state.activeTeamId;
      if (activeTeamId === teamId) {
        // Prefer a team the player can still see under the game they are viewing.
        const fallback = teams.find(team => team.game === state.activeGame || team.game === null) || teams[0];
        activeTeamId = fallback ? fallback.id : null;
      }
      if (!teams.length) {
        const fresh = { id: makeId('t-'), name: DEFAULT_TEAM_NAME, game: state.activeGame, entries: [], activeTargetId: null, targets: [] };
        return { ...state, teams: [fresh], activeTeamId: fresh.id };
      }
      return { ...state, teams, activeTeamId };
    }

    function setActiveTeam(state, teamId) {
      if (teamIndex(state, teamId) === -1) fail('invalid', 'The team was not found.');
      return { ...state, activeTeamId: teamId };
    }

    // Unassigned teams stay visible under both games so migration never hides data.
    const visibleIn = game => team => team.game === game || team.game === null;

    /** Switch the active game, always leaving the document with a visible active team. */
    function setActiveGame(state, game) {
      if (!TEAM_GAMES.includes(game)) fail('invalid', 'The active game must be dqm1 or dqm2.');
      if (game === state.activeGame) return { ...state };
      const visible = visibleIn(game);
      const next = { ...state, activeGame: game };
      const active = findTeam(next, next.activeTeamId);
      if (active && visible(active)) return next;
      const candidate = next.teams.find(visible);
      if (candidate) return { ...next, activeTeamId: candidate.id };
      if (next.teams.length >= MAX_TEAMS) fail('limit', 'A document can hold at most ' + MAX_TEAMS + ' teams.');
      const team = { id: makeId('t-'), name: DEFAULT_TEAM_NAME, game, entries: [], activeTargetId: null, targets: [] };
      return { ...next, teams: [...next.teams, team], activeTeamId: team.id };
    }

    /** File one team under a game, or unassign it with null. */
    function setTeamGame(state, teamId, game) {
      if (teamIndex(state, teamId) === -1) fail('invalid', 'The team was not found.');
      if (game !== null && !TEAM_GAMES.includes(game)) fail('invalid', 'Team game must be dqm1, dqm2, or null.');
      let next = withTeam(state, teamId, { game });
      // The switch follows the active team so it never leaves the filtered dropdown.
      if (state.activeTeamId === teamId && game !== null && game !== next.activeGame) {
        next = { ...next, activeGame: game };
      }
      return next;
    }

    function addEntry(state, teamId, entryWithoutId) {
      const index = teamIndex(state, teamId);
      if (index === -1) fail('invalid', 'The team was not found.');
      const team = state.teams[index];
      if (team.entries.length >= MAX_ENTRIES) fail('limit', 'A team can hold at most ' + MAX_ENTRIES + ' monsters.');
      if (!record(entryWithoutId)) fail('invalid', 'The monster must be an object.');
      const withId = { favorite: false, ...entryWithoutId, id: makeId('m-') };
      return withTeam(state, teamId, { entries: validateEntries([...team.entries, withId]) });
    }

    function updateEntry(state, teamId, entryId, patch) {
      const index = teamIndex(state, teamId);
      if (index === -1) fail('invalid', 'The team was not found.');
      const team = state.teams[index];
      const entryIndex = team.entries.findIndex(entry => entry.id === entryId);
      if (entryIndex === -1) fail('invalid', 'The monster was not found.');
      if (!record(patch)) fail('invalid', 'The update must be an object.');
      const { id, ...fields } = patch;
      const entries = team.entries.slice();
      entries[entryIndex] = { ...entries[entryIndex], ...fields };
      return withTeam(state, teamId, { entries: validateEntries(entries) });
    }

    function removeEntry(state, teamId, entryId) {
      const index = teamIndex(state, teamId);
      if (index === -1) fail('invalid', 'The team was not found.');
      const team = state.teams[index];
      if (!team.entries.some(entry => entry.id === entryId)) fail('invalid', 'The monster was not found.');
      return withTeam(state, teamId, { entries: team.entries.filter(entry => entry.id !== entryId) });
    }

    function setEntryFavorite(state, teamId, entryId, favorite) {
      const index = teamIndex(state, teamId);
      if (index === -1) fail('invalid', 'The team was not found.');
      const team = state.teams[index];
      if (!team.entries.some(entry => entry.id === entryId)) fail('invalid', 'The monster was not found.');
      if (typeof favorite !== 'boolean') fail('invalid', 'Favorite must be true or false.');
      return withTeam(state, teamId, {
        entries: team.entries.map(entry => entry.id === entryId ? { ...entry, favorite } : entry),
      });
    }

    function setSpeciesFavorite(state, index, favorite) {
      playableIndex(index, 'Favorite species');
      if (typeof favorite !== 'boolean') fail('invalid', 'Favorite must be true or false.');
      const current = state.favoriteSpeciesIndices;
      if (favorite) {
        if (current.includes(index)) return { ...state };
        return { ...state, favoriteSpeciesIndices: [...current, index].sort((a, b) => a - b) };
      }
      return { ...state, favoriteSpeciesIndices: current.filter(value => value !== index) };
    }

    function toggleSpeciesFavorite(state, index) {
      playableIndex(index, 'Favorite species');
      return setSpeciesFavorite(state, index, !state.favoriteSpeciesIndices.includes(index));
    }

    function addTarget(state, teamId, speciesIndex) {
      const index = teamIndex(state, teamId);
      if (index === -1) fail('invalid', 'The team was not found.');
      playableIndex(speciesIndex, 'Target species');
      const team = state.teams[index];
      const existing = team.targets.find(target => target.speciesIndex === speciesIndex);
      if (existing) {
        if (team.activeTargetId === existing.id) return { ...state };
        return withTeam(state, teamId, { activeTargetId: existing.id });
      }
      if (team.targets.length >= MAX_TARGETS) fail('limit', 'A team can hold at most ' + MAX_TARGETS + ' targets.');
      const target = { id: makeId('t-'), speciesIndex, plan: null };
      return withTeam(state, teamId, { targets: [...team.targets, target], activeTargetId: target.id });
    }

    function removeTarget(state, teamId, targetId) {
      const index = teamIndex(state, teamId);
      if (index === -1) fail('invalid', 'The team was not found.');
      const team = state.teams[index];
      if (!team.targets.some(target => target.id === targetId)) fail('invalid', 'The target was not found.');
      const targets = team.targets.filter(target => target.id !== targetId);
      const activeTargetId = team.activeTargetId === targetId
        ? (targets.length ? targets[0].id : null)
        : team.activeTargetId;
      return withTeam(state, teamId, { targets, activeTargetId });
    }

    function setActiveTarget(state, teamId, targetId) {
      const index = teamIndex(state, teamId);
      if (index === -1) fail('invalid', 'The team was not found.');
      const team = state.teams[index];
      if (!team.targets.some(target => target.id === targetId)) fail('invalid', 'The target was not found.');
      return withTeam(state, teamId, { activeTargetId: targetId });
    }

    function checkPlanBounds(plan) {
      if (plan === null) return;
      let serialized;
      try {
        serialized = JSON.stringify(plan);
      } catch {
        fail('invalid', 'The plan must be JSON-serializable.');
      }
      if (serialized.length > MAX_IMPORT_LENGTH) fail('limit', 'The plan is too large to save.');
      if (Array.isArray(plan.nodes)) {
        if (plan.nodes.length > MAX_PLAN_NODES) fail('limit', 'A plan can hold at most ' + MAX_PLAN_NODES + ' nodes.');
        const byId = new Map();
        for (const node of plan.nodes) {
          if (node && typeof node === 'object' && typeof node.id === 'string') {
            if (byId.has(node.id)) fail('invalid', 'The plan has duplicate node IDs.');
            byId.set(node.id, node);
          }
        }
        for (const id of byId.keys()) {
          let cursor = id;
          let depth = 0;
          const chain = new Set();
          while (cursor !== null && cursor !== undefined) {
            if (chain.has(cursor)) fail('invalid', 'The plan contains a cycle.');
            chain.add(cursor);
            depth += 1;
            if (depth > MAX_PLAN_DEPTH) fail('limit', 'A plan can be at most ' + MAX_PLAN_DEPTH + ' levels deep.');
            const node = byId.get(cursor);
            if (!node) break;
            cursor = node.parent === undefined ? null : node.parent;
          }
        }
        return;
      }
      let nodes = 0;
      let maxDepth = 0;
      const visit = (value, depth, seen) => {
        if (Array.isArray(value)) {
          for (const item of value) visit(item, depth, seen);
          return;
        }
        if (value === null || typeof value !== 'object') return;
        if (seen.has(value)) fail('invalid', 'The plan contains a circular reference.');
        seen.add(value);
        if (typeof value.id === 'string') {
          nodes += 1;
          if (nodes > MAX_PLAN_NODES) fail('limit', 'A plan can hold at most ' + MAX_PLAN_NODES + ' nodes.');
          maxDepth = Math.max(maxDepth, depth + 1);
          if (maxDepth > MAX_PLAN_DEPTH) fail('limit', 'A plan can be at most ' + MAX_PLAN_DEPTH + ' levels deep.');
        }
        for (const key of ownKeys(value)) visit(value[key], depth + 1, seen);
        seen.delete(value);
      };
      visit(plan, 0, new Set());
    }

    function setTargetPlan(state, teamId, targetId, plan) {
      const index = teamIndex(state, teamId);
      if (index === -1) fail('invalid', 'The team was not found.');
      const team = state.teams[index];
      const targetIndex = team.targets.findIndex(target => target.id === targetId);
      if (targetIndex === -1) fail('invalid', 'The target was not found.');
      if (plan !== null && !record(plan)) fail('invalid', 'The plan must be an object or null.');
      checkPlanBounds(plan);
      const targets = team.targets.slice();
      targets[targetIndex] = {
        ...targets[targetIndex],
        plan: plan === null ? null : deepClone(plan),
      };
      return withTeam(state, teamId, { targets });
    }

    return Object.freeze({
      APP_VERSION,
      GAME_ID,
      STORAGE_KEY,
      LEGACY_TEAM_KEY,
      LEGACY_SPRITE_KEY,
      MAX_TEAMS,
      MAX_ENTRIES,
      MAX_TARGETS,
      MAX_NAME_LENGTH,
      MAX_IMPORT_LENGTH,
      SPRITE_STYLES,
      TEAM_GAMES,
      ENTRY_LOCATIONS,
      DEFAULT_GAME,
      TARGET_STATUSES,
      MAX_PLAN_DEPTH,
      MAX_PLAN_NODES,
      isNewerError,
      errorCode,
      defaultState,
      normalizeDocument,
      parseDocument,
      summarize,
      toJSON,
      findTeam,
      findTarget,
      migrateFromLegacy,
      teamFromLegacy,
      parseLegacyTeam,
      importAny,
      setSpriteStyle,
      addTeam,
      insertTeam,
      renameTeam,
      deleteTeam,
      setActiveTeam,
      setActiveGame,
      setTeamGame,
      addEntry,
      updateEntry,
      removeEntry,
      setEntryFavorite,
      setSpeciesFavorite,
      toggleSpeciesFavorite,
      addTarget,
      removeTarget,
      setActiveTarget,
      setTargetPlan,
      makeId,
    });
  }

  root.DQMAppState = Object.freeze({
    create,
    APP_VERSION,
    GAME_ID,
    STORAGE_KEY,
    LEGACY_TEAM_KEY,
    LEGACY_SPRITE_KEY,
    MAX_TEAMS,
    MAX_ENTRIES,
    MAX_TARGETS,
    MAX_NAME_LENGTH,
    MAX_IMPORT_LENGTH,
    SPRITE_STYLES,
    TEAM_GAMES,
    ENTRY_LOCATIONS,
    DEFAULT_GAME,
    TARGET_STATUSES,
    MAX_PLAN_DEPTH,
    MAX_PLAN_NODES,
    isNewerError,
    errorCode,
  });
})(globalThis);
