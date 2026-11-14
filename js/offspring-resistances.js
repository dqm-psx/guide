/* Saved-parent predictions from the shared PSX offspring constructor.
   Native inputs and channel order: docs/resistance-inheritance-evidence.md. */
(() => {
  "use strict";
  const channels = [
    "Blaze / Big Bang", "Firebal", "Bang", "Wind", "Lightning", "Ice",
    "Blindness", "Sleep", "Instant death", "MP drain", "Spell seal", "Confusion",
    "Defense reduction", "Agility reduction", "Sacrifice / Body Slam", "MegaMagic",
    "Fire breath", "Ice breath", "Poison", "Paralysis", "Curse", "Knockdown",
    "Dance seal", "Breath seal", "Rock Throw / Call Allies", "Gigaslash", "Water"
  ];
  const divisors = [60, 75, 90, 105, 120, 150, 180];
  const statKeys = ["hp", "mp", "attack", "defense", "agility", "intelligence"];
  const validGrades = values => Array.isArray(values) && values.length === channels.length &&
    Array.from(values).every(grade => Number.isInteger(grade) && grade >= 0 && grade <= 7);

  function initialStat(a, b, key) {
    const values = [a.baseStats?.[key], b.baseStats?.[key]];
    return values.every(value => Number.isInteger(value) && value >= 0 && value <= 999)
      ? Math.max(1, Math.floor((values[0] + values[1]) / 4)) : null;
  }

  function skillBonus(a, b, childId, saveReference) {
    const natural = saveReference.naturalSkills?.[a.campaign === "terry" ? "terry" : "dqm2"];
    if (!a.campaign || a.campaign !== b.campaign || !natural) return null;
    const sets = [a.speciesIndex, b.speciesIndex, childId].map(id => natural[id]);
    if (sets.some(row => !row)) return null;
    const skills = new Set(sets.flat());
    for (const parent of [a, b]) {
      for (const id of parent.knownSkills || []) skills.add(saveReference.hatch.baseSkillIds[id]);
    }
    skills.delete(0);
    if (skills.size >= 16) return true;
    const missingSlots = [a, b].filter(parent => !parent.knownSkills).length * 8;
    return skills.size + missingSlots < 16 ? false : null;
  }

  function hatchStats(a, b, childId, saveReference) {
    if (!saveReference?.hatch) return null;
    const {speciesRanks, personalityMatches} = saveReference.hatch;
    const rankA = speciesRanks[a.speciesIndex], rankB = speciesRanks[b.speciesIndex];
    const match = personalityMatches[a.personalityId - 1];
    const bonuses = {
      personality:match && Number.isInteger(b.personalityId) ? match.includes(b.personalityId) : null,
      species:Number.isInteger(rankA) && Number.isInteger(rankB) ? rankA + rankB >= 10 : null,
      wildness:Number.isInteger(a.wildness) && Number.isInteger(b.wildness) ? a.wildness + b.wildness >= 50 : null,
      skills:skillBonus(a, b, childId, saveReference),
    };
    const flags = Object.values(bonuses);
    const minPercent = 100 + flags.filter(value => value === true).length * 5;
    const maxPercent = minPercent + flags.filter(value => value === null).length * 5;
    const values = Object.fromEntries(statKeys.map(key => {
      const value = initialStat(a, b, key);
      return [key, value === null ? null : [minPercent, maxPercent].map(percent => Math.floor((value * percent + 50) / 100))];
    }));
    return {values, bonuses, minPercent, maxPercent};
  }

  function childPlus(a, b, sameFamily) {
    const levelBonus = Math.min(5, Math.floor((a.level + b.level) / 20));
    const flags = Number(a.level % 10 === 0 && b.level % 10 === 0) +
      Number(sameFamily) + Number((a.plus + b.plus) % 2 === 0);
    const withMpFlag = flag => Math.min(99, Math.max(a.plus, b.plus) + levelBonus + Math.floor((flags + flag) / 2));
    // The HP/MP bonus can matter only when it changes the final, capped +.
    if (withMpFlag(0) === withMpFlag(1)) return withMpFlag(0);
    const hp = initialStat(a, b, "hp"), mp = initialStat(a, b, "mp");
    if (hp === null || mp === null) return null;
    return withMpFlag(Number(mp > hp));
  }

  function predict(a, b, childId, reference, saveReference) {
    if ([a,b].some(parent => parent.level !== null && parent.level < 10)) {
      return {reason:"Both parents must reach level 10 before they can breed at the shrine."};
    }
    if ([a,b].some(parent => parent.sourceStatus !== "save" || !Number.isInteger(parent.level) || !Number.isInteger(parent.plus))) {
      return {reason:"Import a current save for both parents to forecast their offspring."};
    }
    const stats = hatchStats(a, b, childId, saveReference);
    const species = id => reference.species.find(row => row.speciesId === id);
    const first = species(a.speciesIndex), second = species(b.speciesIndex), child = species(childId);
    if (!first || !second || !validGrades(child?.savedResistances)) {
      return {stats, reason:"The guide has no complete resistance record for this pairing."};
    }
    const plus = childPlus(a, b, first.familyId === second.familyId);
    if (plus === null) return {stats, reason:"Re-import both parents’ base HP and MP to calculate the offspring’s + value."};
    if (!validGrades(a.resistances) || !validGrades(b.resistances)) {
      return {stats, plus, reason:"Re-import both parents to forecast their offspring’s resistances."};
    }
    const grades = child.savedResistances.map((base, index) => {
      const parentTotal = a.resistances[index] + b.resistances[index];
      const grade = base === 7 ? 7 : Math.min(6, base + Math.floor((10 * parentTotal + 3 * plus) / divisors[base]));
      return {channel:channels[index], base, grade};
    });
    return {plus, stats, grades};
  }

  globalThis.DQMOffspringResistances = Object.freeze({predict,channels:Object.freeze(channels)});
})();
