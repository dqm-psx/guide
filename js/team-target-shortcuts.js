/* Breeding targets suggested by the current team's ordinary shrine pairings. */
(() => {
  'use strict';

  function forTeam(team, core) {
    const parents = team.entries.filter(entry => Number.isInteger(entry.level) && entry.level >= 10 && entry.level <= 99);
    const males = parents.filter(entry => entry.sex === 'male');
    const females = parents.filter(entry => entry.sex === 'female');
    const offspring = new Set();
    function addPair(pedigree, mate) {
      const result = core.result(pedigree.speciesIndex, mate.speciesIndex, pedigree.plus, mate.plus, 'shrine');
      offspring.add(result.resultIndex);
    }
    for (const male of males) {
      for (const female of females) {
        addPair(male, female);
        addPair(female, male);
      }
    }

    const owned = new Set(team.entries.map(entry => entry.speciesIndex));
    const saved = new Set(team.targets.map(target => target.speciesIndex));
    return [...offspring]
      .filter(index => !saved.has(index))
      .sort((a, b) => Number(owned.has(a)) - Number(owned.has(b)) || a - b)
      .slice(0, 4);
  }

  globalThis.DQMTeamTargetShortcuts = Object.freeze({forTeam});
})();
