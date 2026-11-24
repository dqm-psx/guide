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
    // Each successful enemy feeding also reaches ConsumeItem's +5 bonus.
    Object.freeze({itemId: 25, appeal: 15}),
    Object.freeze({itemId: 26, appeal: 35}),
    Object.freeze({itemId: 27, appeal: 105}),
    Object.freeze({itemId: 28, appeal: 405}),
  ]);
  const healingItems = Object.freeze([
    Object.freeze({itemId: 1, resource: 'hp', variable: false,
      recoveryRange: Object.freeze([30, 40]), appealRange: Object.freeze([20, 25])}),
    Object.freeze({itemId: 2, resource: 'hp', variable: false,
      recoveryRange: Object.freeze([60, 70]), appealRange: Object.freeze([35, 40])}),
    // Dew heals a whole side. Each restored target contributes half its own
    // missing HP, rounded down; the consumed item contributes five points once.
    Object.freeze({itemId: 3, resource: 'hp', variable: true, group: true}),
    Object.freeze({itemId: 4, resource: 'mp', variable: false,
      recoveryRange: Object.freeze([20, 30]), appealRange: Object.freeze([15, 20])}),
    Object.freeze({itemId: 5, resource: 'mp', variable: true}),
    // Sage's Stone can break after use. Its half-heal bonus applies to each
    // successfully healed target; a break adds five points once, not per target.
    Object.freeze({itemId: 11, resource: 'hp', variable: false, group: true,
      recoveryRange: Object.freeze([60, 70]), appealRange: Object.freeze([30, 40]),
      effectRange: Object.freeze([30, 35]), consumedBonusRange: Object.freeze([0, 5])}),
  ]);
  const newFactors = [null, [5, 1], [2, 1], [1, 1], [1, 2], [1, 8], [1, 16]];
  const collectedFactors = [null, [1, 1], [1, 4], [1, 8], [1, 8], [1, 8], [1, 20]];

  function integer(value, minimum, maximum, name) {
    if (!Number.isInteger(value) || value < minimum || value > maximum) {
      throw new RangeError(name + ' must be a whole number from ' + minimum + ' to ' + maximum + '.');
    }
    return value;
  }

  function countsFor(value, definitions, name) {
    const counts = value ?? {};
    if (!counts || typeof counts !== 'object' || Array.isArray(counts)) {
      throw new TypeError(name + ' quantities must be an object keyed by item ID.');
    }
    if (Object.keys(counts).some(key => !definitions.some(item => String(item.itemId) === key))) {
      throw new RangeError('Only verified ' + name.toLowerCase() + ' items are supported.');
    }
    return Object.fromEntries(definitions.map(item => [item.itemId,
      integer(counts[item.itemId] ?? 0, 0, Number.MAX_SAFE_INTEGER, name + ' quantity')]));
  }

  function restoredAmounts(values, item, count) {
    const supplied = values[item.itemId] ?? 0;
    const amounts = item.group && Array.isArray(supplied) ? supplied : [supplied];
    if (!amounts.length || amounts.length > (item.group ? 3 : 1)) {
      throw new RangeError('Enter restored HP for one to three enemies per Yggdrasil Dew use.');
    }
    for (const amount of amounts) integer(amount, 0, 65535, 'Restored ' + item.resource.toUpperCase() + ' per use');
    if (count > 0 && !amounts.some(amount => amount > 0)) {
      throw new RangeError('Enter the ' + item.resource.toUpperCase() + ' restored per successful ' +
        (item.itemId === 3 ? 'Yggdrasil Dew' : 'Elfin Elixir') + ' use.');
    }
    return amounts;
  }

  function atAppeal(appeal, {recruitmentClass, speciesRank, collected, orb, battleMode}) {
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

  function calculate(options = {}) {
    const {recruitmentClass, speciesRank, collected = false, orb = false,
      battleMode = 0, meatAllowed = true} = options;
    integer(recruitmentClass, 0, 7, 'Recruitment class');
    integer(speciesRank, 0, 7, 'Species rank');
    integer(battleMode, 0, 255, 'Battle mode');
    if (typeof collected !== 'boolean' || typeof orb !== 'boolean' || typeof meatAllowed !== 'boolean') {
      throw new TypeError('Collection, Starry Orb and meat eligibility settings must be true or false.');
    }
    const meatsUsed = countsFor(options.meats, meats, 'Meat');
    const healsUsed = countsFor(options.healing, healingItems, 'Healing');
    const recovery = options.recoveryPerUse ?? {};
    if (!recovery || typeof recovery !== 'object' || Array.isArray(recovery)) {
      throw new TypeError('Restored amounts must be an object keyed by item ID.');
    }
    if (Object.keys(recovery).some(key => !['3', '5'].includes(key))) {
      throw new RangeError('Restored amounts are only needed for Yggdrasil Dew and Elfin Elixir.');
    }
    const healedTargets = options.healedTargets ?? {};
    if (!healedTargets || typeof healedTargets !== 'object' || Array.isArray(healedTargets)) {
      throw new TypeError('Healed target counts must be an object keyed by item ID.');
    }
    if (Object.keys(healedTargets).some(key => key !== '11')) {
      throw new RangeError('A healed target count is only needed for Sage’s Stone.');
    }
    const stoneTargets = integer(healedTargets[11] ?? 1, 1, 3, 'Enemies healed per Sage’s Stone use');
    // This guard also protects old shared links whose meat counts remain set
    // after switching to a boss. Refused meat is not successfully consumed.
    const acceptsMeat = meatAllowed && battleMode !== 1;
    let minimum = rules.initialAppeal, maximum = minimum;
    const add = (count, low, high = low) => {
      const boundedCount = Math.min(count, rules.maximumAppeal);
      minimum = Math.min(rules.maximumAppeal, minimum + boundedCount * low);
      maximum = Math.min(rules.maximumAppeal, maximum + boundedCount * high);
    };
    for (const meat of meats) if (acceptsMeat) add(meatsUsed[meat.itemId], meat.appeal);
    for (const item of healingItems) {
      const count = healsUsed[item.itemId];
      if (item.variable) {
        const amounts = restoredAmounts(recovery, item, count);
        add(count, amounts.reduce((sum, amount) => sum + Math.floor(amount / 2), 5));
      } else if (item.consumedBonusRange) {
        add(count, item.effectRange[0] * stoneTargets + item.consumedBonusRange[0],
          item.effectRange[1] * stoneTargets + item.consumedBonusRange[1]);
      } else add(count, ...item.appealRange);
    }
    if (orb) add(1, 4100);
    const settings = {recruitmentClass, speciesRank, collected, orb, battleMode};
    const low = atAppeal(minimum, settings), high = atAppeal(maximum, settings);
    // The legacy scalar fields remain the lower endpoint. Without uncertain
    // healing rolls, both endpoints exactly equal the previous scalar result.
    return {...low, meatAllowed: acceptsMeat,
      appealRange: [minimum, maximum],
      adjustedAppealRange: [low.adjustedAppeal, high.adjustedAppeal],
      feedingChanceRange: [low.feedingChance, high.feedingChance],
      probabilityRange: [low.probability, high.probability],
      percentRange: [low.percent, high.percent]};
  }

  return Object.freeze({calculate, rules, meats, healingItems});
});
