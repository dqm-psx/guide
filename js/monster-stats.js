/* Species profile facts from the existing native combat and growth references.
   Resistance grades are not status success rates; damage scales apply only to
   the verified actions which use them. See docs/combat-evidence.md. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DQMMonsterStats = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const validInteger = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
  const validGrades = (values, maximum) => Array.isArray(values) && values.length === 27 &&
    Array.from(values).every(value => validInteger(value, 0, maximum));

  function create(combat, learning, channelNames) {
    if (combat?.schemaVersion !== 1 || learning?.schemaVersion !== 1) {
      throw new TypeError('Unsupported monster statistics reference.');
    }
    if (!Array.isArray(channelNames) || channelNames.length !== 27 ||
        !Array.from(channelNames).every(name => typeof name === 'string' && name.trim())) {
      throw new TypeError('Monster statistics require all 27 resistance channel names.');
    }
    const names = [...channelNames];
    const species = new Map(combat.species.map(row => [row.speciesId, row]));
    const growth = new Map(learning.species.map(row => [row.speciesIndex, row]));
    const channelScales = Array.from({length: 27}, () => new Set());
    for (const action of combat.skills) {
      if (validInteger(action.resistanceChannelId, 1, 27) && ['spell', 'breath'].includes(action.scale)) {
        channelScales[action.resistanceChannelId - 1].add(action.scale);
      }
    }

    function resistances(speciesIndex, mode = 'saved', individualGrades = null) {
      if (!['saved', 'wild'].includes(mode)) throw new RangeError('Resistance mode must be saved or wild.');
      if (mode === 'wild' && individualGrades !== null) {
        throw new TypeError('Individual companion grades cannot be used as wild resistance tiers.');
      }
      const entry = species.get(speciesIndex);
      const maximumGrade = mode === 'saved' ? 7 : 3;
      const values = individualGrades === null ? entry?.[mode + 'Resistances'] : individualGrades;
      if (!entry || !validGrades(values, maximumGrade)) return null;
      return {
        mode, maximumGrade, individual: individualGrades !== null,
        rows: names.map((label, index) => ({
          id: index + 1, label, grade: values[index],
          damage: ['spell', 'breath'].filter(scale => channelScales[index].has(scale)).flatMap(scale => {
            const percentages = combat.scales?.[scale]?.[mode];
            if (!Array.isArray(percentages) || percentages.length !== maximumGrade + 1 ||
                !Array.from(percentages).every(percent => validInteger(percent, 0, 100))) return [];
            return [{scale, percent: percentages[values[index]]}];
          }),
        })),
      };
    }

    function growthInfo(stats, speciesIndex) {
      if (stats?.status !== 'verified' || !validInteger(stats.base_level_limit, 1, 99)) return null;
      const native = growth.get(speciesIndex);
      const center = native?.recruitLevelCapCenter;
      return {
        // The older library table can describe recruitment rather than bred
        // caps (species 235 is 50 versus 45). Use the separate native fields.
        baseLevelCap: validInteger(native?.baseLevelCap, 1, 99) ? native.baseLevelCap : null,
        recruitmentCap: validInteger(center, 1, 99) ? {min: Math.max(1, center - 2), max: Math.min(99, center + 2)} : null,
        experienceCurve: validInteger(stats.experience_curve, 0, 31) ? stats.experience_curve : null,
      };
    }

    function experience(stats, level) {
      if (!validInteger(level, 1, 99)) throw new RangeError('Level must be a whole number from 1 to 99.');
      if (stats?.status !== 'verified' || !validInteger(stats.experience_curve, 0, 31)) return null;
      const curve = stats.experience_curve;
      const totals = learning.experienceByLevel;
      const total = totals?.[level]?.[curve];
      const next = level < 99 ? totals?.[level + 1]?.[curve] : null;
      if (totals?.[1]?.[curve] !== 0 || !validInteger(total, 0, 0xffffff) ||
          (level < 99 && !validInteger(next, total, 0xffffff))) return null;
      return {level, total, toNext: level === 99 ? null : next - total};
    }

    return Object.freeze({resistances, growthInfo, experience});
  }

  return Object.freeze({create});
});
