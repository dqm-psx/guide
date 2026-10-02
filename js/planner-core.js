/* DQM-guide team planner. Pure computations; no DOM, storage, or network access. */
(function (root) {
  'use strict';

  const GAME_ID = 'dqm1-2-ps1-v61';
  const STATE_VERSION = 2;
  const MAX_ENTRIES = 100;
  const MAX_NICKNAME_LENGTH = 40;
  const MAX_IMPORT_LENGTH = 100000;
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);

  function integer(value, min, max, label) {
    if (!Number.isInteger(value) || value < min || value > max) {
      throw new Error(label + ' must be a whole number from ' + min + ' to ' + max + '.');
    }
    return value;
  }

  function create(data) {
    if (!record(data) || !Array.isArray(data.species) || !Array.isArray(data.matrix) ||
        !record(data.runtime_rules) || !Array.isArray(data.runtime_rules.rules)) {
      throw new Error('The verified species, breeding matrix, and runtime rules are required.');
    }
    const species = new Map(data.species.map(entry => [entry.index, entry]));
    const plusRules = data.runtime_rules.rules.filter(rule => rule.kind === 'plus_threshold');
    const roomRules = data.runtime_rules.rules.filter(rule => rule.kind === 'flag_gated');

    function speciesIndex(value, label) {
      integer(value, 0, 314, label);
      if (!species.has(value) || species.get(value).playable !== true) {
        throw new Error(label + ' must identify a species in the standard roster.');
      }
      return value;
    }

    /** Ordered parents: pedigree first, mate second. Plus is an integer from 0 to 255. */
    function result(aIndex, bIndex, aPlus = 0, bPlus = 0, context = 'shrine') {
      speciesIndex(aIndex, 'Pedigree species');
      speciesIndex(bIndex, 'Mate species');
      integer(aPlus, 0, 255, 'Pedigree + value');
      integer(bPlus, 0, 255, 'Mate + value');
      if (!['base', 'shrine', 'room'].includes(context)) {
        throw new Error('Breeding context must be base, shrine, or room.');
      }

      const baseIndex = data.matrix[aIndex] && data.matrix[aIndex][bIndex];
      if (!Number.isInteger(baseIndex) || !species.has(baseIndex)) {
        throw new Error('This pairing has no verified base-table result.');
      }
      let matchedRule = null;
      if (context !== 'base') {
        matchedRule = plusRules.find(rule => rule.pedigree_index === aIndex &&
          rule.mate_index === bIndex &&
          Math.max(aPlus, bPlus) >= rule.minimum_parent_plus) || null;
      }
      if (context === 'room') {
        const roomRule = roomRules.find(rule => rule.pedigree_index === aIndex &&
          (rule.mate_index != null ? rule.mate_index === bIndex :
            rule.mate_family_index === species.get(bIndex).family_id));
        if (roomRule) matchedRule = roomRule;
      }

      const condition = matchedRule ? matchedRule.condition : '';
      return {
        baseIndex,
        resultIndex: matchedRule ? matchedRule.offspring_index : baseIndex,
        ruleKind: matchedRule ? matchedRule.kind : 'base',
        condition,
        detail: matchedRule ? condition : (context === 'base' ?
          'Base species table only; + values and Breeding room overrides are not applied.' :
          'Base species table; no override applies to these parents and + values.')
      };
    }

    /** Validate the complete persistence envelope. Never coerce species IDs or numeric values. */
    function normalizeState(input) {
      if (!record(input) || !own(input, 'version') ||
          (input.version !== 1 && input.version !== STATE_VERSION)) {
        throw new Error('Unsupported team file. Expected version 1 or ' + STATE_VERSION + '.');
      }
      if (!own(input, 'game') || input.game !== GAME_ID) {
        throw new Error('This team file belongs to a different game or patch. Expected ' + GAME_ID + '.');
      }
      if (!own(input, 'entries') || !Array.isArray(input.entries) || input.entries.length > MAX_ENTRIES) {
        throw new Error('A team file must contain an entries list with no more than ' + MAX_ENTRIES + ' monsters.');
      }

      const ids = new Set();
      const entries = Array.from(input.entries, (entry, index) => {
        const label = 'Monster ' + (index + 1);
        if (!record(entry) || !['id', 'speciesIndex', 'sex', 'plus', 'nickname'].every(key => own(entry, key))) {
          throw new Error(label + ' must include id, speciesIndex, sex, plus, and nickname.');
        }
        if (typeof entry.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(entry.id) ||
            ['constructor', 'prototype'].includes(entry.id)) {
          throw new Error(label + ' has an invalid ID. Use 1–64 letters, numbers, underscores, or hyphens, starting with a letter or number.');
        }
        if (ids.has(entry.id)) throw new Error(label + ' has a duplicate ID. Each monster needs its own ID.');
        ids.add(entry.id);
        speciesIndex(entry.speciesIndex, label + ' species');
        if (entry.sex !== 'male' && entry.sex !== 'female') {
          throw new Error(label + ' sex must be male or female.');
        }
        integer(entry.plus, 0, 255, label + ' + value');
        if (typeof entry.nickname !== 'string') throw new Error(label + ' nickname must be text.');
        const nickname = Array.from(entry.nickname.trim()).slice(0, MAX_NICKNAME_LENGTH).join('');
        return { id: entry.id, speciesIndex: entry.speciesIndex, sex: entry.sex, plus: entry.plus, nickname };
      });
      return { version: STATE_VERSION, game: GAME_ID, entries };
    }

    function parseState(text) {
      if (typeof text !== 'string' || text.length > MAX_IMPORT_LENGTH) {
        throw new Error('Choose a team JSON file smaller than 100,000 characters.');
      }
      let parsed;
      try { parsed = JSON.parse(text); }
      catch (error) { throw new Error('This file is not valid JSON. Choose a team JSON export.'); }
      return normalizeState(parsed);
    }

    return Object.freeze({ result, normalizeState, parseState });
  }

  root.DQMPlannerCore = Object.freeze({
    create, GAME_ID, STATE_VERSION, MAX_ENTRIES, MAX_NICKNAME_LENGTH, MAX_IMPORT_LENGTH
  });
})(globalThis);
