/* PSX joining check for an already eligible, selected defeated enemy.
 * Native evidence and reproduction: docs/recruitment-evidence.md.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.DQMRecruitment = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const rules = Object.freeze({
    initialAppeal: 10,
    maximumAppeal: 32767,
    rankDenominators: Object.freeze([2, 4, 9, 20, 33, 100, 200]),
    finalGate: Object.freeze([2870, 4096]),
  });
  const meats = Object.freeze([
    Object.freeze({itemId: 25, appeal: 10}),
    Object.freeze({itemId: 26, appeal: 30}),
    Object.freeze({itemId: 27, appeal: 100}),
    Object.freeze({itemId: 28, appeal: 400}),
  ]);
  const newFactors = [null, [5, 1], [2, 1], [1, 1], [1, 2], [1, 8], [1, 16]];
  const collectedFactors = [null, [1, 1], [1, 4], [1, 8], [1, 8], [1, 8], [1, 20]];

  function integer(value, minimum, maximum, name) {
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      throw new RangeError(name + ' must be a whole number from ' + minimum + ' to ' + maximum + '.');
    }
    return value;
  }

  function calculate(options = {}) {
    const {recruitmentClass, speciesRank, collected = false, orb = false, battleMode = 0} = options;
    integer(recruitmentClass, 0, 7, 'Recruitment class');
    integer(speciesRank, 0, 7, 'Species rank');
    integer(battleMode, 0, 255, 'Battle mode');
    if (typeof collected !== 'boolean' || typeof orb !== 'boolean') {
      throw new TypeError('Collection and Starry Orb settings must be true or false.');
    }
    const counts = options.meats ?? {};
    if (!counts || typeof counts !== 'object' || Array.isArray(counts)) {
      throw new TypeError('Meat quantities must be an object keyed by item ID.');
    }
    if (Object.keys(counts).some(key => !meats.some(meat => String(meat.itemId) === key))) {
      throw new RangeError('Only the four verified recruitment meats are supported.');
    }
    let appeal = rules.initialAppeal;
    for (const meat of meats) {
      const count = integer(counts[meat.itemId] ?? 0, 0, Number.MAX_SAFE_INTEGER, 'Meat quantity');
      appeal = Math.min(rules.maximumAppeal, appeal + Math.min(count, rules.maximumAppeal) * meat.appeal);
    }
    if (orb) appeal += 4095;
    appeal = Math.min(rules.maximumAppeal, appeal);

    const result = {probability: 0, percent: 0, reason: 'normal', appeal,
      adjustedAppeal: 0, firstCollectionChance: 0, feedingChance: 0};
    // The battle-mode guard overrides class-0 and Orb successes.
    if (battleMode === 2 || battleMode >= 4) result.reason = 'blocked-battle';
    else if (recruitmentClass === 0) {
      result.reason = 'automatic';
      result.probability = 1;
    } else if (recruitmentClass === 7) result.reason = 'blocked-class';
    else if (speciesRank === 7) result.reason = 'blocked-rank';
    else if (orb) {
      result.reason = 'orb';
      result.probability = 1;
    } else {
      const [numerator, denominator] = (collected ? collectedFactors : newFactors)[recruitmentClass];
      result.adjustedAppeal = Math.floor(appeal * numerator / denominator);
      result.firstCollectionChance = collected ? 0 : 1 / rules.rankDenominators[speciesRank];
      const successfulThresholds = Math.min(91, Math.max(0, result.adjustedAppeal - 9));
      result.feedingChance = successfulThresholds / 91 * rules.finalGate[0] / rules.finalGate[1];
      result.probability = result.firstCollectionChance + (1 - result.firstCollectionChance) * result.feedingChance;
    }
    result.percent = result.probability * 100;
    return result;
  }

  return Object.freeze({calculate, rules, meats});
});
