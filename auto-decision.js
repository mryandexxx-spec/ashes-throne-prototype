/* Combat-015A: deterministic, read-only tactical auto-action planner.
 * Deliberately not connected to CombatCore.performAutoAction until Combat-015B.
 * Thresholds are technical test parameters, NOT approved final balance.
 * No DOM, Babylon.js, timers, randomness, or battle mutation.
 */
const AutoDecision = (() => {
  "use strict";
  const HEAL_HP_RATIO = 0.70;
  const GUARD_HP_RATIO = 0.60;

  function living(battle, side) {
    return battle.fighters.flatMap((fighter, index) =>
      fighter.side === side && fighter.hp > 0 ? [{fighter, index}] : []);
  }
  function hpRatio(fighter) {
    return fighter.maxHp > 0 ? fighter.hp / fighter.maxHp : 1;
  }
  // Stable tie-break: original combat index. Never reorder the source array.
  function lowestHpRatio(entries) {
    return entries.reduce((best, entry) =>
      !best || hpRatio(entry.fighter) < hpRatio(best.fighter) ? entry : best, null);
  }
  function lowestHp(entries) {
    return entries.reduce((best, entry) =>
      !best || entry.fighter.hp < best.fighter.hp ? entry : best, null);
  }
  function propose(battle, abilityId, actor, allies, enemies) {
    if (!CombatCore.abilityReady(battle, abilityId)) return null;
    const ability = AbilityData.get(actor, abilityId);
    if (!ability || !["damage", "heal", "guard"].includes(ability.kind)) return null;
    const targetMode = ability.target;
    const allied = targetMode === "self" ? [{fighter: actor,index: battle.currentActor}] : allies;
    const enemiesPresent = enemies.length > 0;
    if (ability.kind === "heal" && Number.isFinite(ability.healAmount) && ability.healAmount > 0) {
      const wounded = allied.filter(({fighter}) =>
        fighter.maxHp > fighter.hp && hpRatio(fighter) <= HEAL_HP_RATIO);
      if (!wounded.length || !["self","ally","all-allies"].includes(targetMode)) return null;
      const best = lowestHpRatio(wounded);
      // A group heal is preferred only if two or more allies actually need it.
      if (targetMode === "all-allies" && wounded.length < 2) return null;
      return {abilityId, targetIndex: targetMode === "ally" ? best.index : battle.currentActor,
        priority: targetMode === "all-allies" ? 105 : 100};
    }
    if (ability.kind === "guard" && Number.isInteger(ability.guardHits) && ability.guardHits > 0) {
      if (!["self","ally","all-allies"].includes(targetMode)) return null;
      const endangered = allied.filter(({fighter}) =>
        hpRatio(fighter) <= GUARD_HP_RATIO && (fighter.guardHits || 0) === 0);
      if (!endangered.length) return null;
      if (targetMode === "all-allies" && endangered.length < 2) return null;
      const best = lowestHpRatio(endangered);
      return {abilityId, targetIndex: targetMode === "ally" ? best.index : battle.currentActor,
        priority: 80};
    }
    if (ability.kind !== "damage" || !enemiesPresent ||
        !Number.isFinite(ability.multiplier) || ability.multiplier <= 0 ||
        !["enemy","all-enemies"].includes(targetMode)) return null;
    const isArea = targetMode === "all-enemies";
    const weakenedCandidates = enemies.filter(({fighter}) =>
      (fighter.weakenAttacks || 0) === 0);
    const effectUseful = Number.isInteger(ability.weakening) && ability.weakening > 0 &&
      weakenedCandidates.length > 0;
    const stronger = ability.multiplier > 1;
    // Group attacks at one target are not preferable to a basic hit without
    // a damage advantage or a new status.
    if ((!isArea || enemies.length === 1) && !stronger && !effectUseful) return null;
    if (isArea && enemies.length === 1 && !stronger && !effectUseful) return null;
    const selected = effectUseful && !stronger ? lowestHp(weakenedCandidates) : lowestHp(enemies);
    return {abilityId, targetIndex: selected.index,
      priority: isArea && enemies.length >= 2 ? 70 : stronger ? 60 : 50};
  }
  function chooseAction(battle) {
    if (!battle || !battle.active || !Array.isArray(battle.fighters) ||
        !Number.isInteger(battle.currentActor)) return null;
    const actor = battle.fighters[battle.currentActor];
    if (!actor || actor.side !== "ally" || actor.hp <= 0 ||
        !CombatCore.abilityReady(battle, "basic")) return null;
    const enemies = living(battle, "enemy");
    if (!enemies.length) return null;
    const allies = living(battle, "ally");
    // The planner never mutates selection or spends cooldowns. Combat-015B
    // must apply chooseEnemy/chooseAlly, then performPlayerAbility.
    const candidates = ["special", "powerful"]
      .map(id => propose(battle, id, actor, allies, enemies))
      .filter(Boolean);
    // Equal priorities prefer special to powerful (stable candidate order).
    const best = candidates.reduce((winner, candidate) =>
      !winner || candidate.priority > winner.priority ? candidate : winner, null);
    if (best) return {abilityId: best.abilityId, targetIndex: best.targetIndex};
    return {abilityId: "basic", targetIndex: lowestHp(enemies).index};
  }
  return Object.freeze({chooseAction});
})();
if (typeof module !== "undefined" && module.exports) module.exports = AutoDecision;
