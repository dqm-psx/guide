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
  const validGrades = values => Array.isArray(values) && values.length === channels.length &&
    Array.from(values).every(grade => Number.isInteger(grade) && grade >= 0 && grade <= 7);

  function childPlus(a, b, sameFamily) {
    const levelBonus = Math.min(5, Math.floor((a.level + b.level) / 20));
    const flags = Number(a.level % 10 === 0 && b.level % 10 === 0) +
      Number(sameFamily) + Number((a.plus + b.plus) % 2 === 0);
    const withMpFlag = flag => Math.min(99, Math.max(a.plus, b.plus) + levelBonus + Math.floor((flags + flag) / 2));
    // The HP/MP bonus can matter only when it changes the final, capped +.
    if (withMpFlag(0) === withMpFlag(1)) return withMpFlag(0);
    const initialStat = key => {
      const first = a.baseStats[key], second = b.baseStats[key];
      if (!Number.isInteger(first) || !Number.isInteger(second)) return null;
      return Math.max(1, Math.floor((first + second) / 4));
    };
    const hp = initialStat("hp"), mp = initialStat("mp");
    if (hp === null || mp === null) return null;
    return withMpFlag(Number(mp > hp));
  }

  function predict(a, b, childId, reference) {
    if ([a,b].some(parent => parent.level !== null && parent.level < 10)) {
      return {reason:"Both parents must reach level 10 before they can breed at the shrine."};
    }
    if ([a,b].some(parent => parent.sourceStatus !== "save" || !validGrades(parent.resistances) ||
        !Number.isInteger(parent.level) || !Number.isInteger(parent.plus))) {
      return {reason:"Import a current save for both parents to see their offspring’s resistances."};
    }
    const species = id => reference.species.find(row => row.speciesId === id);
    const first = species(a.speciesIndex), second = species(b.speciesIndex), child = species(childId);
    if (!first || !second || !validGrades(child?.savedResistances)) {
      return {reason:"The guide has no complete resistance record for this pairing."};
    }
    const plus = childPlus(a, b, first.familyId === second.familyId);
    if (plus === null) return {reason:"Re-import both parents’ base HP and MP to calculate the offspring’s + value."};
    const grades = child.savedResistances.map((base, index) => {
      const parentTotal = a.resistances[index] + b.resistances[index];
      const grade = base === 7 ? 7 : Math.min(6, base + Math.floor((10 * parentTotal + 3 * plus) / divisors[base]));
      return {channel:channels[index], base, grade};
    });
    return {plus, grades};
  }

  globalThis.DQMOffspringResistances = Object.freeze({predict});
})();
