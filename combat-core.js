/* Combat-002: speed-based manual basic attacks. No DOM or Babylon.js dependencies.
   Test speeds/attack numbers belong to the demo, not the final game balance. */
const CombatCore = (() => {
  "use strict";

  // Combat-010: canonical effect counters. Legacy fighter fields remain
  // writable aliases because existing battle UI and tests use them.
  const EFFECT_FIELDS = Object.freeze({guardHits:"guard",weakenAttacks:"weaken"});
  function setEffect(fighter, type, remaining) {
    if (!Object.values(EFFECT_FIELDS).includes(type)) throw Error("unknown combat effect");
    if (!Number.isInteger(remaining) || remaining < 0) throw Error("invalid effect duration");
    if (remaining === 0) delete fighter.effects[type];
    else fighter.effects[type] = {remaining};
  }
  function effectCount(fighter, type) {
    return fighter.effects[type]?.remaining ?? 0;
  }
  function activeEffects(fighter) {
    return Object.keys(fighter.effects).map(type => ({type,remaining:effectCount(fighter,type)}));
  }
  function makeFighter(hero,index,meter) {
    const fighter = {...hero,maxHp:hero.hp,specialCooldown:0,
      meter,index,effects:Object.create(null)};
    for (const [field,type] of Object.entries(EFFECT_FIELDS)) {
      Object.defineProperty(fighter,field,{
        enumerable:true,configurable:false,
        get(){return effectCount(this,type);},
        set(value){setEffect(this,type,value);}
      });
    }
    return fighter;
  }

  // Optional future waves are separate encounters inside the same battle.
  // Existing single-wave calls keep their original behavior.
  function createBattle(heroes, futureWaves = []) {
    if (!Array.isArray(futureWaves)) throw Error("futureWaves must be an array");
    if (futureWaves.some(wave => !Array.isArray(wave) || wave.length === 0 ||
        wave.some(enemy => !enemy || enemy.side !== "enemy")))
      throw Error("each future wave requires at least one enemy");
    const allyIds = new Set(heroes.filter(f => f.side === "ally").map(f => f.id));
    for (const wave of futureWaves) {
      InitiativeModel.createInitiative(wave);
      if (wave.some(enemy => allyIds.has(enemy.id)))
        throw Error("wave enemy id collides with ally id");
    }
    const initiative = InitiativeModel.createInitiative(heroes);
    const fighters = heroes.map((hero,index) =>
      makeFighter(hero,index,initiative[index].meter));
    return {
      fighters,
      wave: 1,
      totalWaves: 1 + futureWaves.length,
      // Copy the roster references so callers cannot alter the wave queue.
      pendingWaves: futureWaves.map(wave => wave.map(enemy => ({...enemy}))),
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
      // A wave is not a mission victory. Keep surviving allies (HP, initiative,
      // cooldowns and effects) and replace defeated enemies with the next wave.
      if (battle.pendingWaves && battle.pendingWaves.length &&
          firstLivingAlly(battle.fighters) >= 0) {
        const next = battle.pendingWaves.shift();
        const allies = battle.fighters.filter(f => f.side === "ally");
        const initiative = InitiativeModel.createInitiative(next);
        const enemies = next.map((enemy,i) =>
          makeFighter(enemy,allies.length+i,initiative[i].meter));
        battle.fighters = [...allies,...enemies];
        battle.fighters.forEach((f,i) => { f.index = i; });
        battle.wave++;
        battle.currentActor = -1;
        battle.selectedEnemy = firstLivingEnemy(battle.fighters);
        battle.selectedAlly = firstLivingAlly(battle.fighters);
        battle.message = "Волна " + battle.wave + " из " + battle.totalWaves + ". Противники вступают в бой.";
        emit(battle,"wave-start",{wave:battle.wave,total:battle.totalWaves});
        return false;
      }
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
  function dealDamage(attacker, target, rawDamage, consumeWeakening = true) {
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
    if (consumeWeakening && attacker.weakenAttacks > 0) attacker.weakenAttacks--;
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

  // Combat-011A: read-only target selection for ability planning. Group and
  // self modes are NOT castable until multi-target resolution is implemented.
  function abilityTargetIndices(battle, mode) {
    if (!battle || !battle.active || !Array.isArray(battle.fighters)) return [];
    const actor=battle.fighters[battle.currentActor];
    if (!actor || actor.side!=="ally" || actor.hp<=0) return [];
    if (mode==="self") return [battle.currentActor];
    if (mode==="enemy") {
      const i=selectEnemy(battle.fighters,battle.selectedEnemy);
      return i<0?[]:[i];
    }
    if (mode==="ally") {
      const i=selectAlly(battle.fighters,battle.selectedAlly);
      return i<0?[]:[i];
    }
    if (mode==="all-enemies" || mode==="all-allies") {
      const side=mode==="all-enemies"?"enemy":"ally";
      return battle.fighters.flatMap((fighter,i)=>
        fighter.side===side && fighter.hp>0?[i]:[]);
    }
    return [];
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

  // Combat-011B: atomic resolution of one self/group command. The acting
  // unit spends exactly one turn and one cooldown. Dead targets are filtered
  // before the command; wave/victory transitions happen after all targets.
  function performMultiTargetAbility(battle, actor, ability, targets) {
    if(!["self","all-enemies","all-allies"].includes(ability.target))return false;
    if(!["damage","heal","guard"].includes(ability.kind))return false;
    if(ability.target==="all-enemies"&&ability.kind!=="damage")return false;
    if((ability.target==="all-allies"||ability.target==="self")&&ability.kind==="damage")return false;
    if(ability.kind==="damage"&&(!Number.isFinite(ability.multiplier)||ability.multiplier<0))return false;
    if(ability.kind==="heal"&&(!Number.isFinite(ability.healAmount)||ability.healAmount<0))return false;
    if(ability.kind==="guard"&&(!Number.isInteger(ability.guardHits)||ability.guardHits<0))return false;
    if(!targets.length)return false;
    const recipients=targets.map(i=>battle.fighters[i]);
    battle.allyActions++;
    battle.events=[];
    emit(battle,"ability",{
      actorId:actor.id,targetId:recipients[0].id,
      targetIds:recipients.map(f=>f.id),abilityId:ability.id
    });
    const weakened=actor.weakenAttacks>0;
    for(const target of recipients){
      if(ability.kind==="damage"){
        const damage=dealDamage(actor,target,Math.round(actor.atk*ability.multiplier),false);
        emit(battle,"damage",{actorId:actor.id,targetId:target.id,amount:damage,remainingHp:target.hp});
        if(target.hp===0)emit(battle,"death",{targetId:target.id});
        if(ability.weakening>0&&target.hp>0){
          target.weakenAttacks=ability.weakening;
          emit(battle,"effect",{actorId:actor.id,targetId:target.id,effect:"weaken",stacks:ability.weakening});
        }
      }else if(ability.kind==="heal"){
        const restored=Math.min(ability.healAmount,Math.max(0,target.maxHp-target.hp));
        target.hp+=restored;
        emit(battle,"heal",{actorId:actor.id,targetId:target.id,amount:restored,remainingHp:target.hp});
      }else{
        target.guardHits=ability.guardHits;
        emit(battle,"effect",{actorId:actor.id,targetId:target.id,effect:"guard",stacks:ability.guardHits});
      }
    }
    // Weakening counts attacks (commands), not recipients. All group targets
    // get the same weakened damage; one use is consumed at the end.
    if(ability.kind==="damage"&&weakened)actor.weakenAttacks--;
    battle.message=actor.name+" применяет "+ability.name+
      ": целей "+recipients.length+".";
    if(ability.id==="special")actor.specialCooldown=ability.cooldown;
    else actor.specialCooldown=Math.max(0,actor.specialCooldown-1);
    InitiativeModel.finishTurn(battle.fighters,actor.id);
    battle.turn++;
    battle.currentActor=-1;
    if(finishIfOver(battle))return true;
    if(ability.target==="all-enemies"&&
       selectEnemy(battle.fighters,battle.selectedEnemy)<0)
      battle.selectedEnemy=firstLivingEnemy(battle.fighters);
    advanceToPlayerTurn(battle);
    return true;
  }

  function performPlayerAbility(battle,abilityId) {
    if(!abilityReady(battle,abilityId))return false;
    const actor=battle.fighters[battle.currentActor];
    const ability=AbilityData.get(actor,abilityId);
    const targets=abilityTargetIndices(battle,ability.target);
    if(["self","all-enemies","all-allies"].includes(ability.target))
      return performMultiTargetAbility(battle,actor,ability,targets);
    if(ability.target!=="ally" && ability.target!=="enemy")return false;
    if(targets.length!==1)return false;
    const targetIndex=targets[0];
    const target=battle.fighters[targetIndex];
    // Invalid commands leave the previous event batch untouched.
    battle.allyActions++;
    battle.events=[];
    emit(battle,"ability",{actorId:actor.id,targetId:target.id,abilityId:ability.id});
    if(ability.kind==="guard"){
      target.guardHits=ability.guardHits;
      emit(battle,"effect",{actorId:actor.id,targetId:target.id,effect:"guard",stacks:ability.guardHits});
      battle.message=actor.name+" защищает "+target.name+": защита ×"+ability.guardHits+".";
    }else if(ability.kind==="heal"){
      const restored=Math.min(ability.healAmount,Math.max(0,target.maxHp-target.hp));
      target.hp+=restored;
      emit(battle,"heal",{actorId:actor.id,targetId:target.id,amount:restored,remainingHp:target.hp});
      battle.message=actor.name+" лечит "+target.name+": +"+restored+" HP.";
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

  // Combat-004: first-stage auto strategy uses an ordinary basic attack against
  // the first living enemy. No alternate damage/initiative/reward code path.
  function performAutoAction(battle) {
    if (!battle || !battle.active || !abilityReady(battle, "basic")) return false;
    const target = firstLivingEnemy(battle.fighters);
    if (target < 0 || !chooseEnemy(battle, target)) return false;
    return performPlayerAbility(battle, "basic");
  }

  // Backward-compatible basic attack API, including Combat-002 regression tests.
  function performPlayerAttack(battle) {
    return performPlayerAbility(battle, "basic");
  }


  return Object.freeze({
    createBattle, livingEnemies, selectEnemy, firstLivingEnemy,
    chooseEnemy, chooseAlly, specialName, abilityTargetSide, advanceToPlayerTurn, performPlayerAttack, performPlayerAbility, abilityReady, performAutoAction, activeEffects, abilityTargetIndices
  });
})();