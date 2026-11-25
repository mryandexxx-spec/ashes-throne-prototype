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
      priority: isArea && enemies.length >= 2 ? 70 : stronger ?
        60 + Math.min(9, Math.round((ability.multiplier - 1) * 10)) : 50};
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
    // Combat 2.0 uses the same tactical choices as the pinned accepted lab candidate.
    // This branch is read-only; legacy auto remains unchanged.
    const focus=battle.combat2?enemies.find(x=>!battle.priorityCleared&&x.fighter.id===battle.tacticalObjective?.priorityEnemyId):null;
    if(battle.combat2){
      const pool=x=>x.fighter.hp+(x.fighter.protection??0);
      const ratio=x=>pool(x)/(x.fighter.maxHp+(x.fighter.maxProtection??0));
      const enemy=enemies.slice().sort((a,z)=>pool(a)-pool(z)||a.index-z.index)[0];
      const target=focus??enemy;
      const others=allies.filter(x=>x.index!==battle.currentActor);
      const threats=enemies.filter(x=>x.fighter.combat2Prepared);
      const taunter=allies.find(x=>CombatStatusCore.read(x.fighter,"taunt"));
      const warned=threats.map(x=>taunter??allies.find(a=>a.fighter.id===x.fighter.combat2Prepared)).filter(Boolean);
      const ready=id=>CombatCore.abilityReady(battle,id);
      const pick=(abilityId,targetIndex)=>({abilityId,targetIndex});
      if(actor.id==="art"){
        const threat=threats.find(x=>!focus||x.index===focus.index);
        if(threat&&ready("powerful"))return pick("powerful",threat.index);
        const recipient=others.slice().sort((a,z)=>Number(warned.includes(z))-Number(warned.includes(a))||ratio(a)-ratio(z))[0];
        if(recipient&&ready("special")&&!recipient.fighter.guardHits&&(warned.includes(recipient)||ratio(recipient)<.6))return pick("special",recipient.index);
        return pick(ready("powerful")?"powerful":"basic",target.index);
      }
      if(actor.id==="liora"){
        const area=enemies.some(x=>AbilityData.get(x.fighter,"powerful")?.target==="all-enemies"&&x.fighter.powerfulCooldown===0);
        const endangered=allies.filter(x=>!x.fighter.guardHits&&(ratio(x)<.7||warned.includes(x)||area));
        if(ready("powerful")&&endangered.length>=2&&(area||warned.length>=2||endangered.length>=3))return pick("powerful",battle.currentActor);
        if(ready("special")&&!CombatStatusCore.read(actor,"taunt")&&ratio(allies.find(x=>x.index===battle.currentActor))>.45&&others.some(x=>warned.includes(x)||ratio(x)<.65))return pick("special",battle.currentActor);
        if(ready("powerful")&&endangered.length>=2)return pick("powerful",battle.currentActor);
        return pick("basic",target.index);
      }
      if(actor.id==="nada"&&ready("special")&&(CombatStatusCore.read((focus??threats[0]??enemy).fighter,"read-move")?.stacks??0)<2)
        return pick("special",(focus??threats[0]??enemy).index);
      if(actor.id==="sava"){
        const helper=others.slice().sort((a,z)=>z.fighter.physicalAttack-a.fighter.physicalAttack||a.index-z.index)[0];
        const signal=AbilityData.get(actor,"special"),power=AbilityData.get(actor,"powerful"),basic=AbilityData.get(actor,"basic");
        const estimate=actor.physicalAttack*power.multiplier+(helper?Math.min(helper.fighter.physicalAttack*power.combat2Assist,actor.physicalAttack):0);
        const powerful=helper&&ready("powerful");
        const joint={abilityId:"powerful",targetIndex:target.index,helperIndex:helper?.index};
        if(powerful&&pool(enemy)>actor.physicalAttack*basic.multiplier&&pool(enemy)<=estimate*.85)return joint;
        const options=others.map(x=>({index:x.index,...CombatCore.previewSignal(battle,actor,signal.signalMeter+(actor.combat2Boost??0),x.fighter)})).filter(x=>x.gain>0).sort((a,z)=>Number(z.cross)-Number(a.cross)||Number(z.changed)-Number(a.changed)||z.gain-a.gain||a.index-z.index);
        if(ready("special")&&options[0]?.cross)return pick("special",options[0].index);
        if(powerful&&pool(enemy)>actor.physicalAttack*basic.multiplier*.8)return joint;
        return pick("basic",target.index);
      }
    }
    // The planner never mutates selection or spends cooldowns. Combat-015B
    // must apply chooseEnemy/chooseAlly, then performPlayerAbility.
    const candidates = ["special", "powerful"]
      .map(id => propose(battle, id, actor, allies, enemies))
      .filter(Boolean);
    // Equal priorities prefer special to powerful (stable candidate order).
    const best = candidates.reduce((winner, candidate) =>
      !winner || candidate.priority > winner.priority ? candidate : winner, null);
    if (best) {
      const mode=AbilityData.get(actor,best.abilityId).target;
      if(focus&&mode==="all-enemies")return {abilityId:"basic",targetIndex:focus.index};
      return {abilityId:best.abilityId,targetIndex:focus&&mode==="enemy"?focus.index:best.targetIndex};
    }
    return {abilityId: "basic", targetIndex: (focus??lowestHp(enemies)).index};
  }
  return Object.freeze({chooseAction});
})();
if (typeof module !== "undefined" && module.exports) module.exports = AutoDecision;
