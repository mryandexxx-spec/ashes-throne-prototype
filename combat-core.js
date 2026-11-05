/* Combat-002: speed-based manual basic attacks. No DOM or Babylon.js dependencies.
   Test speeds/attack numbers belong to the demo, not the final game balance. */
const CombatCore = (() => {
  "use strict";

  function createBattle(heroes) {
    const initiative = InitiativeModel.createInitiative(heroes);
    const fighters = heroes.map((hero, index) => ({
      ...hero,
      maxHp: hero.hp,
      specialCooldown: 0,
      guardHits: 0,
      weakenAttacks: 0,
      meter: initiative[index].meter,
      index
    }));
    return {
      fighters,
      turn: 1,
      allyActions: 0, // successfully executed player abilities, including support; enemies excluded
      currentActor: -1,
      selectedEnemy: firstLivingEnemy(fighters),
      selectedAlly: firstLivingAlly(fighters),
      active: true,
      winner: null,
      events: [],
      message: "Отряд готов к бою"
    };
  }

  function livingEnemies(fighters) {
    return fighters.map((h, i) => ({ h, i })).filter(({ h }) => h.side === "enemy" && h.hp > 0);
  }

  function selectEnemy(fighters, index) {
    return Number.isInteger(index) && fighters[index] &&
      fighters[index].side === "enemy" && fighters[index].hp > 0 ? index : -1;
  }

  function firstLivingEnemy(fighters) {
    const enemies = livingEnemies(fighters);
    return enemies.length ? enemies[0].i : -1;
  }

  function selectAlly(fighters, index) {
    return Number.isInteger(index) && fighters[index] &&
      fighters[index].side === "ally" && fighters[index].hp > 0 ? index : -1;
  }

  function firstLivingAlly(fighters) {
    return fighters.findIndex(h => h.side === "ally" && h.hp > 0);
  }

  // Events describe only the latest resolved command, including automatic enemy replies.
  // Keep the existing battle.message as the UI's current short summary.
  function emit(battle, type, properties) {
    battle.events.push({type, ...properties});
  }

  function finishIfOver(battle) {
    if (firstLivingEnemy(battle.fighters) < 0) {
      battle.active = false;
      battle.winner = "ally";
      battle.currentActor = -1;
      battle.selectedEnemy = -1;
      battle.selectedAlly = -1;
      battle.message = "Победа! Отряд одержал верх.";
      emit(battle, "battle-end", {winner: "ally"});
      return true;
    }
    if (firstLivingAlly(battle.fighters) < 0) {
      battle.active = false;
      battle.winner = "enemy";
      battle.currentActor = -1;
      battle.selectedEnemy = -1;
      battle.selectedAlly = -1;
      battle.message = "Поражение. Попробуй ещё раз.";
      emit(battle, "battle-end", {winner: "enemy"});
      return true;
    }
    return false;
  }

  // One deterministic damage path, shared by human and AI attacks.
  // Weakening is applied before guarding; each step rounds once.
  function dealDamage(attacker, target, rawDamage) {
    let damage = Math.max(0, rawDamage);
    if (attacker.weakenAttacks > 0) damage = Math.round(damage * 0.7);
    if (target.guardHits > 0) {
      damage = Math.round(damage * 0.5);
      target.guardHits--;
    }
    target.hp = Math.max(0, target.hp - damage);
    if (target.hp === 0) {
      target.guardHits = 0;
      target.weakenAttacks = 0;
    }
    if (attacker.weakenAttacks > 0) attacker.weakenAttacks--;
    return damage;
  }

  // Advance game time to the next living actor; resolve AI actions until an ally is ready.
  // This is turn-based, not tied to frame rate or animation timing.
  function advanceToPlayerTurn(battle) {
    if (!battle.active || finishIfOver(battle)) return battle;
    for (let steps = 0; steps < 1000; steps++) {
      const ready = InitiativeModel.nextActor(battle.fighters);
      if (!ready) throw Error("No living actor available");
      const actorIndex = battle.fighters.findIndex(h => h.id === ready.id);
      const actor = battle.fighters[actorIndex];
      if (actor.side === "ally") {
        battle.currentActor = actorIndex;
        if (selectEnemy(battle.fighters, battle.selectedEnemy) < 0) {
          battle.selectedEnemy = firstLivingEnemy(battle.fighters);
        }
        return battle;
      }
      // A simple deterministic enemy AI for the first playable battle.
      const targetIndex = firstLivingAlly(battle.fighters);
      if (targetIndex < 0) {
        finishIfOver(battle);
        return battle;
      }
      const target = battle.fighters[targetIndex];
      emit(battle, "ability", {actorId: actor.id, targetId: target.id, abilityId: "basic"});
      const damage = dealDamage(actor, target, actor.atk);
      emit(battle, "damage", {actorId: actor.id, targetId: target.id, amount: damage, remainingHp: target.hp});
      if (target.hp === 0) emit(battle, "death", {targetId: target.id});
      battle.message = actor.name + " атакует " + target.name +
        ": " + damage + " урона.";
      InitiativeModel.finishTurn(battle.fighters, actor.id);
      battle.turn++;
      if (finishIfOver(battle)) return battle;
    }
    throw Error("Turn guard reached: check initiative and actors");
  }

  function chooseEnemy(battle, index) {
    if (!battle.active || selectEnemy(battle.fighters, index) < 0) return false;
    battle.selectedEnemy = index;
    return true;
  }

  function chooseAlly(battle, index) {
    if (!battle.active || selectAlly(battle.fighters, index) < 0) return false;
    battle.selectedAlly = index;
    return true;
  }

  function abilityDefinition(battle, abilityId) {
    const actor=battle&&battle.fighters[battle.currentActor];
    return AbilityData.get(actor,abilityId);
  }

  function abilityTargetSide(battle,abilityId){
    const ability=abilityDefinition(battle,abilityId);
    return ability?ability.target:null;
  }

  function specialName(actor) {
    const ability=AbilityData.get(actor,"special");
    return ability?ability.name:"Особая";
  }

  function abilityReady(battle,abilityId) {
    if(!battle||!battle.active)return false;
    const actor=battle.fighters[battle.currentActor];
    if(!actor||actor.side!=="ally"||actor.hp<=0||actor.meter<1000-1e-8)return false;
    const ability=AbilityData.get(actor,abilityId);
    return !!ability&&(ability.id==="basic"||actor.specialCooldown===0);
  }

  function performPlayerAbility(battle,abilityId) {
    if(!abilityReady(battle,abilityId))return false;
    const actor=battle.fighters[battle.currentActor];
    const ability=AbilityData.get(actor,abilityId);
    const targetIndex=ability.target==="ally"
      ?selectAlly(battle.fighters,battle.selectedAlly)
      :selectEnemy(battle.fighters,battle.selectedEnemy);
    if(targetIndex<0)return false;
    const target=battle.fighters[targetIndex];
    // Invalid commands leave the previous event batch untouched.
    battle.allyActions++;
    battle.events=[];
    emit(battle,"ability",{actorId:actor.id,targetId:target.id,abilityId:ability.id});
    if(ability.kind==="guard"){
      target.guardHits=ability.guardHits;
      emit(battle,"effect",{actorId:actor.id,targetId:target.id,effect:"guard",stacks:ability.guardHits});
      battle.message=actor.name+" защищает "+target.name+": защита ×"+ability.guardHits+".";
    }else{
      const damage=dealDamage(actor,target,Math.round(actor.atk*ability.multiplier));
      emit(battle,"damage",{actorId:actor.id,targetId:target.id,amount:damage,remainingHp:target.hp});
      if(target.hp===0)emit(battle,"death",{targetId:target.id});
      if(ability.weakening>0&&target.hp>0){
        target.weakenAttacks=ability.weakening;
        emit(battle,"effect",{actorId:actor.id,targetId:target.id,effect:"weaken",stacks:ability.weakening});
      }
      battle.message=actor.name+(ability.id==="special"?" применяет "+ability.name+": ":" атакует: ")+
        target.name+" получает "+damage+" урона"+
        (target.hp===0?" — повержен!":ability.weakening>0?", ослабление ×"+ability.weakening+".":".");
    }
    if(ability.id==="special")actor.specialCooldown=ability.cooldown;
    else actor.specialCooldown=Math.max(0,actor.specialCooldown-1);
    InitiativeModel.finishTurn(battle.fighters,actor.id);
    battle.turn++;
    battle.currentActor=-1;
    if(finishIfOver(battle))return true;
    if(ability.target==="enemy"&&target.hp===0)battle.selectedEnemy=firstLivingEnemy(battle.fighters);
    advanceToPlayerTurn(battle);
    return true;
  }

  // Backward-compatible basic attack API, including Combat-002 regression tests.
  function performPlayerAttack(battle) {
    return performPlayerAbility(battle, "basic");
  }


  return Object.freeze({
    createBattle, livingEnemies, selectEnemy, firstLivingEnemy,
    chooseEnemy, chooseAlly, specialName, abilityTargetSide, advanceToPlayerTurn, performPlayerAttack, performPlayerAbility, abilityReady
  });
})();