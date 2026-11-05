/* Progress-001: temporary session-only demo resources and hero level upgrades. */
const ProgressCore = (() => {
  "use strict";
  const MAX_LEVEL = 3;
  const VICTORY_MATERIALS = 1;
  const COST_BY_LEVEL = Object.freeze({1: 1, 2: 2});

  function createProgress(heroes) {
    return {
      materials: 0,
      levels: Object.fromEntries(heroes.filter(h => h.side === "ally").map(h => [h.id, 1]))
    };
  }

  function levelOf(progress, id) {
    return Object.prototype.hasOwnProperty.call(progress.levels, id) ? progress.levels[id] : null;
  }

  function upgradeCost(progress, id) {
    const level = levelOf(progress, id);
    return level === null || level >= MAX_LEVEL ? null : COST_BY_LEVEL[level];
  }

  function heroStats(progress, hero, levelOverride) {
    const level = levelOverride ?? levelOf(progress, hero.id);
    if (level === null || level < 1 || level > MAX_LEVEL) return null;
    const factor = 1 + (level - 1) * 0.1;
    return {...hero, level, hp: Math.round(hero.hp * factor), atk: Math.round(hero.atk * factor)};
  }

  function canUpgrade(progress, id) {
    const cost = upgradeCost(progress, id);
    return cost !== null && progress.materials >= cost;
  }

  function upgrade(progress, id) {
    if (!canUpgrade(progress, id)) return false;
    const cost = upgradeCost(progress, id);
    progress.materials -= cost;
    progress.levels[id]++;
    return true;
  }

  function awardVictory(progress, battle) {
    if (!battle || battle.active || battle.winner !== "ally" || battle.rewardClaimed) return 0;
    battle.rewardClaimed = true;
    progress.materials += VICTORY_MATERIALS;
    return VICTORY_MATERIALS;
  }

  return Object.freeze({
    MAX_LEVEL, VICTORY_MATERIALS, createProgress, levelOf,
    heroStats, upgradeCost, canUpgrade, upgrade, awardVictory
  });
})();
