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
    const regular=Object.keys(fighter.effects).map(type=>({type,remaining:effectCount(fighter,type)}));
    if(fighter.insurance&&fighter.hp>0)regular.push({type:"insurance",remaining:fighter.insurance.remaining});
    if(fighter.fieldSignal&&fighter.hp>0)regular.push({type:"field-signal",remaining:fighter.fieldSignal.remaining});
    if(fighter.tacticalFocus&&fighter.hp>0)regular.push({type:"tactical-focus",remaining:1});
    if(typeof CombatStatusCore==="undefined")return regular;
    return regular.concat(CombatStatusCore.KINDS.flatMap(type=>{
      const status=CombatStatusCore.read(fighter,type);
      return status?[{type,...status}]:[];
    }));
  }
  // Combat-013A: read-only passive modifier selection; applying stat changes
  // belongs to Combat-013B after the stacking and rounding rules are agreed.
  // Conditions are evaluated against current state, not cached at battle start.
  // REN-COMBAT-C: all synergy rules come from passive definitions, not IDs.
  function passiveCombatRules(owner){
    if(!owner||owner.side!=="ally"||owner.hp<=0)return null;
    const rules=AbilityData.get(owner,"passive")?.combatRules;
    return rules&&typeof rules==="object"?rules:null;
  }
  function validPercent(n){return Number.isFinite(n)&&n>=0&&n<=100;}
  function hasNegativeStatus(target){
    return activeEffects(target).some(effect=>effect.type!=="guard"&&effect.remaining>0);
  }
  function passiveDamageBonusPercent(battle,actor,target){
    if(!battle||!battle.active||!actor||!target)return 0;
    let bonus=0;
    const seen=new Set();
    for(const owner of battle.fighters){
      if(seen.has(owner.id))continue;
      seen.add(owner.id);
      const rules=passiveCombatRules(owner);
      if(!rules)continue;
      const marks=typeof CombatStatusCore!=="undefined"?
       CombatStatusCore.read(target,"read-move")?.stacks??0:0;
      // Exclusive Ren synergy: generic debuffs never grant this bonus.
      if(owner.id===actor.id&&validPercent(rules.readMoveBonusPercentPerStack))
       bonus+=marks*rules.readMoveBonusPercentPerStack;
      // Preserve legacy trial-only combat rules, but not for production Ren/Nada.
      if(owner.id===actor.id&&validPercent(rules.bonusVsDebuffedPercent)&&
         hasNegativeStatus(target))bonus+=rules.bonusVsDebuffedPercent;
      if(owner.side===actor.side&&
         validPercent(rules.allyBonusVsDebuffedPercent)&&
         hasNegativeStatus(target))bonus+=rules.allyBonusVsDebuffedPercent;
      if(owner.side===actor.side&&
         typeof rules.tagId==="string"&&rules.tagId.length>0&&
         Array.isArray(actor.tags)&&actor.tags.includes(rules.tagId)&&
         validPercent(rules.tagDamagePercent))bonus+=rules.tagDamagePercent;
    }
    return bonus;
  }
  function gardensCombatBonus(battle,fighter,key){
    if(!battle?.active||!fighter||!Array.isArray(fighter.tags))return 0;
    const seen=new Set();let bonus=0;
    for(const owner of battle.fighters){
      if(seen.has(owner.id))continue;
      seen.add(owner.id);
      const rules=passiveCombatRules(owner);
      if(!rules||owner.side!==fighter.side||!rules.gardensTagId||
         !fighter.tags.includes(rules.gardensTagId))continue;
      if(validPercent(rules[key]))bonus+=rules[key];
    }
    return bonus;
  }
  function passiveStatusPotencyBonus(actor,target){
    const rules=passiveCombatRules(actor);
    if(!rules||!validPercent(rules.statusPotencyWithoutResistanceDown))return 0;
    if(typeof CombatStatusCore!=="undefined"&&
       CombatStatusCore.read(target,"debuff-resistance-down"))return 0;
    return rules.statusPotencyWithoutResistanceDown;
  }
  function statusChance(actor,target,readMovePenalty=false){
    const effectiveResistance=typeof CombatStatusCore!=="undefined"
      ?CombatStatusCore.effectiveDebuffResistance(target,target.debuffResistance)
      :target.debuffResistance;
    return Math.max(5,Math.min(100,
      100+actor.debuffPotency+passiveStatusPotencyBonus(actor,target)-
      effectiveResistance-(readMovePenalty?20:0)));
  }
  function bonusDamage(battle,actor,target,raw){
    const percent=passiveDamageBonusPercent(battle,actor,target);
    const shared=battle?.combat2&&actor.side==="ally"&&!["ren","nada"].includes(actor.id)&&CombatStatusCore.read(target,"read-move")?.stacks>0?12:0;
    const total=percent+shared;
    return total?Math.round(raw*(1+total/100)):raw;
  }
  function activePassiveModifiers(battle,ownerId) {
    if(!battle||!Array.isArray(battle.fighters))return [];
    const owner=battle.fighters.find(f=>f.id===ownerId);
    if(!owner||owner.side!=="ally"||owner.hp<=0)return [];
    const passive=AbilityData.get(owner,"passive");
    if(!passive||!Array.isArray(passive.modifiers))return [];
    return passive.modifiers.filter(mod=>{
      if(!mod||!["atk","speed"].includes(mod.stat)||
         mod.operation!=="flat"||!Number.isFinite(mod.value)||
         !mod.when)return false;
      if(mod.when.kind==="always")return true;
      if(mod.when.kind==="hp-below-percent"&&
         Number.isFinite(mod.when.percent)&&mod.when.percent>0&&
         mod.when.percent<=100&&owner.maxHp>0)
        return owner.hp*100<owner.maxHp*mod.when.percent;
      return false; // unsupported conditions never activate by accident
    }).map(mod=>({stat:mod.stat,operation:mod.operation,value:mod.value}));
  }

  // Combat-014C: any living ally may occupy the leader slot; the aura is
  // automatic only if the hero in that slot has a leader ability. No skill
  // definition means no leader bonus.
  function activeLeaderModifiers(battle,recipientId){
    if(!battle||!battle.active||!battle.leaderId||!Array.isArray(battle.fighters))return [];
    const leader=battle.fighters.find(f=>f.id===battle.leaderId);
    const recipient=battle.fighters.find(f=>f.id===recipientId);
    if(!leader||leader.side!=="ally"||leader.hp<=0||
       !recipient||recipient.side!=="ally"||recipient.hp<=0)return [];
    const definition=AbilityData.get(leader,"leader");
    if(!definition||!Array.isArray(definition.modifiers))return [];
    return definition.modifiers.filter(mod=>
      mod&&["atk","speed"].includes(mod.stat)&&mod.operation==="flat"&&
      Number.isFinite(mod.value)&&
      (mod.scope==="all-allies"||(mod.scope==="self"&&recipient.id===leader.id))&&
      mod.when&&mod.when.kind==="always")
      .map(mod=>({stat:mod.stat,operation:mod.operation,value:mod.value}));
  }

  // Combat-013B: flat modifiers are summed only for the owner while alive.
  // A fresh derived value is used for every action / initiative advance.
  // Never mutate the fighter's base atk/speed fields (Save/UI compatibility).
  function effectiveStat(battle,fighter,stat){
    const base=fighter[stat];
    if(!Number.isFinite(base))return base;
    const addition=[...activePassiveModifiers(battle,fighter.id),
      ...activeLeaderModifiers(battle,fighter.id)]
      .filter(mod=>mod.stat===stat&&mod.operation==="flat")
      .reduce((total,mod)=>total+mod.value,0);
    const effective=Math.max(stat==="speed"?1:0,base+addition);
    return stat==="speed"&&typeof CombatStatusCore!=="undefined"
      ?CombatStatusCore.effectiveSpeed(fighter,effective):effective;
  }

  // LIORA001: leader Protection is a temporary pool, not a permanent edit
  // to the roster or a multiplier applied repeatedly each turn. Removal on
  // leader death clamps the remaining pool without retroactive HP damage.
  function syncLeaderProtection(battle){
    const leader=battle.leaderId&&battle.fighters.find(f=>f.id===battle.leaderId);
    const mods=leader&&leader.side==="ally"&&leader.hp>0?
      AbilityData.get(leader,"leader")?.modifiers||[]:[];
    const percent=mods.filter(m=>m&&m.stat==="protection"&&
      m.operation==="percent"&&m.scope==="all-allies"&&
      m.when?.kind==="always"&&Number.isFinite(m.value)&&m.value>=0&&m.value<=100)
      .reduce((total,m)=>total+m.value,0);
    for(const recipient of battle.fighters){
      if(recipient.side!=="ally"||!Number.isSafeInteger(recipient.maxProtection)||
        !Number.isSafeInteger(recipient.protection))continue;
      const old=recipient.leaderProtectionBonus??0;
      const base=Math.max(0,recipient.maxProtection-old);
      const next=Math.round(base*percent/100);
      const diff=next-old;
      if(diff){
        recipient.maxProtection+=diff;
        recipient.protection=Math.max(0,Math.min(recipient.maxProtection,recipient.protection+diff));
      }
      recipient.leaderProtectionBonus=next;
    }
  }


  // ARTSAVASKILLS001 — tiny battle-local, nonmagical tactical states.
  // No global timers, recursive actions or extra WebGL resources.
  function livingTacticalLeader(battle,abilityKey){
    const leader=battle.leaderId&&battle.fighters.find(f=>f.id===battle.leaderId);
    if(!leader||leader.hp<=0||leader.side!=="ally")return null;
    const rules=AbilityData.get(leader,"leader")?.combatRules;
    return Number.isFinite(rules?.[abilityKey])&&rules[abilityKey]>0?{leader,rules}:null;
  }
  // Native Combat 2.0 primitives. No additional engine or runtime source patch.
  function combat2Cap(old,amount){return Math.max(old,Math.min(950,old+amount));}
  function combat2Time(b,f){return Math.max(0,(1000-f.meter)/effectiveStat(b,f,"speed"));}
  function previewSignal(b,actor,amount,target,spent=false){
    if(!b?.combat2||!actor||!target||target.hp<=0||actor.hp<=0||target.side!=="ally"||target.id===actor.id||!Number.isFinite(amount)||amount<=0)return null;
    const before=b.fighters.filter(f=>f.hp>0).map(f=>({...f,meter:!spent&&f.id===actor.id&&b.currentActor===f.index&&f.meter>=1000-1e-8?Math.max(0,f.meter-1000):f.meter}));
    const after=before.map(f=>({...f,meter:f.id===target.id?combat2Cap(f.meter,amount):f.meter}));
    const speed=f=>effectiveStat(b,f,"speed");
    const nextBefore=InitiativeModel.nextActor(before.map(f=>({...f})),speed)?.id;
    const nextAfter=InitiativeModel.nextActor(after.map(f=>({...f})),speed)?.id;
    const foe=before.filter(f=>f.side==="enemy").sort((a,z)=>combat2Time(b,a)-combat2Time(b,z)||a.index-z.index)[0];
    const t0=before.find(f=>f.id===target.id),t1=after.find(f=>f.id===target.id);
    if(!t0||!t1)return null;
    const precedes=(a,z)=>combat2Time(b,a)<combat2Time(b,z)-1e-8||(Math.abs(combat2Time(b,a)-combat2Time(b,z))<=1e-8&&a.index<z.index);
    return {gain:t1.meter-t0.meter,changed:nextBefore!==nextAfter,cross:!!foe&&!precedes(t0,foe)&&precedes(t1,foe),nextBefore,nextAfter};
  }
  function combat2Grant(b,actor,target,amount,kind){
    const forecast=previewSignal(b,actor,amount,target,kind==="basic");
    if(!forecast||forecast.gain<=0)return false;
    target.meter=combat2Cap(target.meter,amount);
    emit(b,"combat2-meter",{actorId:actor.id,targetId:target.id,amount:forecast.gain,kind,...forecast});
    return true;
  }
  function combat2Helper(b,actor,index){
    const f=Number.isInteger(index)?b.fighters[index]:null;
    return f&&f.side==="ally"&&f.hp>0&&f.id!==actor.id?f:null;
  }
  function combat2ValidAssist(b,actor,target,helper){
    if(!helper||!Number.isFinite(helper.physicalAttack)||helper.physicalAttack<0||!validHitProfile(b,helper,[target],"physical")||!validCriticalProfile(b,helper,[target],"physical")||!validPenetrationProfile(b,helper,"physical"))return false;
    if(b.hitChecks||b.critChecks){
      let rng;try{rng=BattleRng.snapshot(b)}catch{return false;}
      const draws=2*((hitCheckEnabled(b,"physical")?1:0)+(critCheckEnabled(b,"physical")?1:0));
      if(rng.draws>Number.MAX_SAFE_INTEGER-draws)return false;
    }
    return true;
  }
  function combat2Assist(b,actor,target,helper,ability){
    const rootId="w"+b.wave+"-t"+b.turn+"-"+actor.id;
    const props={rootId,parentId:rootId,sourceId:actor.id,actorId:helper.id,targetId:target.id,depth:1,assist:true};
    const root=b.events.find(e=>e.type==="ability"&&e.actorId===actor.id);if(root)root.rootId=rootId;
    if(helper.hp<=0||actor.hp<=0||target.hp<=0)return;
    const start=b.events.length;
    if(!rollToHit(b,helper,target,"physical")){for(const e of b.events.slice(start))Object.assign(e,props);return;}
    const raw=Math.round(Math.min(effectiveStat(b,helper,"physicalAttack")*ability.combat2Assist,actor.physicalAttack));
    const oldHp=target.hp,oldProt=target.protection??null;
    const rolled=rollCriticalDamage(b,helper,target,raw,"physical");
    for(const e of b.events.slice(start))Object.assign(e,props);
    const damage=dealDamage(helper,target,rolled,false,"physical",penetrationEnabled(b,"physical")?helper.defensePenetration:0,b,false);
    const fields=typedDamageFields(target,"physical",oldHp,oldProt);
    // No re-dispatch of passive damage triggers for secondary hits.
    b.events.push({type:"damage",...props,raw,amount:damage,remainingHp:target.hp,...fields});
    if(target.hp===0){
      delete target.combat2Prepared;
      b.events.push({type:"death",...props,targetId:target.id});
      // Durable KO observation is not a passive trigger. Preserve depth-1 assist.
      if(typeof NetworkScoreCore!=="undefined")NetworkScoreCore.observe(b,"death",target.id);
    }
    if(fields.hpDamage+fields.protectionDamage>0){
      const boost=passiveCombatRules(actor)?.combat2Boost??0;if(boost)actor.combat2Boost=boost;
    }
  }
  function combat2EnemyPlan(b,actor,actorIndex,plan,targetIndex){
    if(actor.combat2Prepared){
      const targetId=actor.combat2Prepared;delete actor.combat2Prepared;
      const target=b.fighters.findIndex(f=>f.id===targetId&&f.side==="ally"&&f.hp>0);
      if(CombatStatusCore.read(actor,"disrupted-plan")||target<0||!actorAbilityReady(b,actorIndex,"powerful")){
        if(CombatStatusCore.read(actor,"disrupted-plan")){CombatStatusCore.remove(actor,"disrupted-plan");delete actor.tacticalDisruptDelay;}
        actor.powerfulCooldown=AbilityData.get(actor,"powerful").cooldown;
        emit(b,"combat2-threat-cancelled",{actorId:actor.id,targetId});
        return {abilityId:"basic",targetIndex:target>=0?target:targetIndex};
      }
      const actual=actorTargetIndices(b,actorIndex,"enemy",target)[0];
      emit(b,"combat2-threat-resolved",{actorId:actor.id,targetId,actualTargetId:b.fighters[actual]?.id});
      b.combat2Resolving=actor.id;
      return {abilityId:"powerful",targetIndex:target};
    }
    if(["npc-ridge-slinger","npc-trail-interceptor"].includes(actor.archetypeId)&&plan?.abilityId==="powerful"&&AbilityData.get(actor,"powerful")?.kind==="damage"&&AbilityData.get(actor,"powerful")?.target==="enemy"){
      const target=actorTargetIndices(b,actorIndex,"enemy",plan.targetIndex)[0];
      if(target!==undefined){
        actor.combat2Prepared=b.fighters[target].id;
        emit(b,"combat2-threat-prepared",{actorId:actor.id,targetId:actor.combat2Prepared});
        actor.specialCooldown=Math.max(0,actor.specialCooldown-1);
        InitiativeModel.finishTurn(b.fighters,actor.id);tickActorStatuses(actor);b.turn++;b.currentActor=-1;
        return {prepared:true};
      }
    }
    return plan;
  }
  function grantTacticalMeter(battle,owner,amount,excludedIds=[]){
    if(!Number.isFinite(amount)||amount<=0)return null;
    const options=battle.fighters.filter(f=>f.side==="ally"&&f.hp>0&&
      f.id!==owner.id&&!excludedIds.includes(f.id)&&
      Array.isArray(f.tags)&&f.tags.includes("gardens-over-abyss"));
    options.sort((a,b)=>b.meter-a.meter||a.index-b.index);
    if(!options.length)return null;
    const recipient=options[0];
    recipient.meter=Math.min(1000,recipient.meter+amount);
    battle.events.push({type:"field-tempo",actorId:owner.id,targetId:recipient.id,amount});
    return recipient;
  }
  function insuranceRedirect(battle,attacker,target,hpLoss){
    const insurance=target.insurance;
    if(!insurance||target.side!=="ally"||attacker.side!=="enemy"||hpLoss<=0)return hpLoss;
    const protector=battle.fighters.find(f=>f.id===insurance.ownerId&&f.side==="ally"&&f.hp>0);
    if(!protector||protector.id===target.id){delete target.insurance;return hpLoss;}
    const redirected=Math.min(hpLoss,protector.hp,Math.max(1,Math.round(hpLoss*insurance.percent/100)));
    if(redirected<=0)return hpLoss;
    protector.hp=Math.max(0,protector.hp-redirected);
    delete target.insurance; // exactly one intervention for a real HP hit
    const rules=passiveCombatRules(protector);
    if(protector.hp>0&&rules?.insuranceFocusPercent>0){
      protector.tacticalFocus={enemyId:attacker.id,
       bonus:rules.insuranceFocusPercent,delay:rules.insuranceFocusDelay??0};
    }
    battle.events.push({type:"insurance-triggered",actorId:protector.id,
     targetId:target.id,sourceId:attacker.id,amount:redirected});
    battle.events.push({type:"damage",actorId:attacker.id,targetId:protector.id,
     amount:redirected,remainingHp:protector.hp,hpDamage:redirected});
    if(protector.hp===0){
      protector.guardHits=0;protector.weakenAttacks=0;
      battle.events.push({type:"death",targetId:protector.id});
      if(typeof NetworkScoreCore!=="undefined")
       NetworkScoreCore.observe(battle,"death",protector.id);
    }else if(Number.isFinite(insurance.afterMeter)&&insurance.afterMeter>0){
      protector.meter=Math.min(1000,protector.meter+insurance.afterMeter);
    }
    const leadership=livingTacticalLeader(battle,"insuranceAllyMeter");
    if(leadership&&leadership.leader.id===protector.id)
      grantTacticalMeter(battle,protector,leadership.rules.insuranceAllyMeter,[target.id]);
    return hpLoss-redirected;
  }
  function tacticalDamageBonus(battle,actor,target,raw){
    let percent=0;
    if(actor.tacticalFocus?.enemyId===target.id)
      percent+=actor.tacticalFocus.bonus;
    const w=battle.coordinatedWindow;
    if(w?.first?.kind==="attack"&&w.ownerId!==actor.id&&actor.side==="ally"&&
       w.first.actorId!==actor.id&&w.first.targetId===target.id)
      percent+=w.damagePercent;
    return percent?Math.round(raw*(1+percent/100)):raw;
  }
  function coordinateCompletion(battle,owner){
    const rules=passiveCombatRules(owner);
    if(owner.hp>0&&rules){
      const recovery=rules.coordinationCooldownRecovery??0;
      owner.specialCooldown=Math.max(0,owner.specialCooldown-recovery);
      if(rules.coordinationTempo>0)
        grantTacticalMeter(battle,owner,rules.coordinationTempo);
    }
    const leader=livingTacticalLeader(battle,"coordinationAllyMeter");
    if(leader&&leader.leader.id===owner.id)
      grantTacticalMeter(battle,owner,leader.rules.coordinationAllyMeter);
  }
  function finishTacticalAction(battle,actor,ability,primaryTarget){
    // Called AFTER the normal finishTurn: any meter gained here moves a *future*
    // turn, never generates an immediate free action.
    if(actor.side!=="ally")return;
    if(actor.id==="sava"&&ability.id==="basic"&&ability.nextAllyMeter>0){
      if(battle.combat2){
        const other=battle.fighters.filter(f=>f.side==="ally"&&f.hp>0&&f.id!==actor.id&&f.meter<950).sort((a,z)=>combat2Time(battle,a)-combat2Time(battle,z)||a.index-z.index)[0];
        if(other)combat2Grant(battle,actor,other,ability.nextAllyMeter,"basic");
      }else
      grantTacticalMeter(battle,actor,ability.nextAllyMeter);
    }
    if(battle.combat2&&actor.id==="art")delete actor.combat2ReactUsed;
    if(actor.fieldSignal){
      battle.events.push({type:"field-signal-used",actorId:actor.id,
        sourceId:actor.fieldSignal.ownerId});
      delete actor.fieldSignal;
    }
    if(actor.tacticalFocus)delete actor.tacticalFocus;
    if(actor.insurance){
      actor.insurance.remaining--;
      if(actor.insurance.remaining<=0)delete actor.insurance;
    }
    const w=battle.coordinatedWindow;
    if(!w||w.ownerId===actor.id)return; // Sava's casting turn is not a chain link.
    const owner=battle.fighters.find(f=>f.id===w.ownerId);
    if(!owner||owner.hp<=0){battle.coordinatedWindow=null;return;}
    const hit=battle.events.find(e=>e.type==="damage"&&e.actorId===actor.id&&
       (e.targetId===primaryTarget?.id));
    let step=null;
    if(ability.kind==="damage"&&hit)step={kind:"attack",actorId:actor.id,targetId:primaryTarget.id};
    else if(w.defenseEnabled&&(ability.kind==="guard"||ability.kind==="insurance")){
      const protectedIds=ability.target==="all-allies"?
        battle.fighters.filter(f=>f.side==="ally"&&f.hp>0).map(f=>f.id):
        [primaryTarget?.id].filter(Boolean);
      step={kind:"defense",actorId:actor.id,protectedIds};
    }
    const first=w.first;
    let success=null;
    if(first&&actor.id!==first.actorId){
      if(first.kind==="attack"&&step?.kind==="attack"&&
         first.targetId===step.targetId)success="attack";
      if(first.kind==="defense"&&first.protectedIds.includes(actor.id))
        success="defense";
    }
    if(success){
      if(success==="defense")actor.meter=Math.min(1000,actor.meter+w.defenseMeter);
      battle.events.push({type:"coordinated-completion",kind:success,
       actorId:actor.id,sourceId:w.first.actorId,ownerId:w.ownerId});
      battle.coordinatedWindow=null;
      coordinateCompletion(battle,owner);
      return;
    }
    if(!first&&step)w.first=step;
    w.remainingActions--;
    if(w.remainingActions<=0){
      battle.events.push({type:"coordinated-expired",ownerId:w.ownerId});
      battle.coordinatedWindow=null;
    }
  }
  function disruptDefinition(battle,actor,original){
    if(actor.side!=="enemy"||!["special","powerful"].includes(original.id)||
       typeof CombatStatusCore==="undefined"||
       !CombatStatusCore.read(actor,"disrupted-plan"))return {ability:original,disrupted:false};
    const secondary=!!(original.onHitStatus||original.followUpStatusAll||
      original.followUpEffects?.length||original.weakening>0||original.tauntTurns);
    return {ability:{...original,onHitStatus:undefined,followUpStatusAll:undefined,
       followUpEffects:[],weakening:0,tauntTurns:undefined},
       disrupted:true,secondary};
  }
  function finishDisruption(battle,actor,ability,info){
    if(!info?.disrupted)return;
    CombatStatusCore.remove(actor,"disrupted-plan");
    const delayed=(info.secondary?0:1)+(actor.tacticalDisruptDelay??0);
    if(delayed>0){
      const key=ability.id==="special"?"specialCooldown":"powerfulCooldown";
      actor[key]=Math.max(0,actor[key]+delayed);
    }
    delete actor.tacticalDisruptDelay;
    battle.events.push({type:"disrupted-plan",actorId:actor.id,
      fallback:!info.secondary});
  }

  function makeFighter(hero,index,meter) {
    const fighter = {...hero,maxHp:hero.hp,specialCooldown:0,powerfulCooldown:0,
      meter,index,effects:Object.create(null)};
    delete fighter.combat2; // The mode is set by createBattle, never roster input.
    for (const [field,type] of Object.entries(EFFECT_FIELDS)) {
      Object.defineProperty(fighter,field,{
        enumerable:true,configurable:false,
        get(){return effectCount(this,type);},
        set(value){setEffect(this,type,value);}
      });
    }
    return fighter;
  }

  // C4: opt-in immutable tactical choices. Caller authorizes unlocks; the
  // executor only accepts this narrow config and never reads profile/storage.
  function trustSnapshot(heroes,options){
    const cfg=options.tacticalTrust;if(cfg===undefined)return null;
    if(options.combat2!==true||!cfg||typeof cfg!=="object"||Array.isArray(cfg)||
      !Object.keys(cfg).every(k=>["artTechnique","planPartnerId"].includes(k)))throw Error("invalid tactical trust");
    const living=id=>heroes.some(f=>f.id===id&&f.side==="ally"&&f.hp>0);
    const technique=cfg.artTechnique??"standard",partner=cfg.planPartnerId??null;
    if(!["standard","focused","shared"].includes(technique)||!living("art")||
      (partner!==null&&(!["ren","nada"].includes(partner)||!living(partner))))throw Error("invalid tactical trust composition");
    return Object.freeze({artTechnique:technique,planPartnerId:partner});
  }
  function trustCoverPreview(battle,actor,target){
    if(!battle?.active||actor?.id!=="art"||actor.side!=="ally"||actor.hp<=0||
      !target||target.side!=="ally"||target.hp<=0||target.id===actor.id||
      !Number.isFinite(actor.physicalAttack)||actor.physicalAttack<0||
      !Number.isSafeInteger(target.protection)||!Number.isSafeInteger(target.maxProtection)||
      target.protection<0||target.protection>target.maxProtection)return null;
    const mode=battle.tacticalTrust?.artTechnique??"standard";
    const row=(f,hits,restore)=>({id:f.id,guardHits:Math.max(f.guardHits,hits),restored:restore});
    if(mode==="focused")return {mode,rows:[row(target,2,0)]};
    if(mode==="shared")return {mode,rows:[row(target,1,0),row(actor,1,0)]};
    return {mode,rows:[row(target,1,Math.min(target.maxProtection-target.protection,Math.round(actor.physicalAttack*.65)))]};
  }
  function trustPlanPreview(battle,targetIndex){
    const actor=battle?.fighters?.[battle.currentActor],target=battle?.fighters?.[targetIndex];
    const partnerId=battle?.tacticalTrust?.planPartnerId;
    if(!partnerId||battle.trustPlanUsed||actor?.id!=="art"||actor.side!=="ally"||
      !actorAbilityReady(battle,battle.currentActor,"basic")||target?.side!=="enemy"||target.hp<=0)return null;
    const helper=battle.fighters.find(f=>f.id===partnerId&&f.side==="ally"&&f.hp>0);
    const base=AbilityData.get(actor,"basic");
    if(!helper||base?.kind!=="damage"||base.target!=="enemy"||AbilityData.damageType(base)!=="physical"||
      !validTypedTarget(target,"physical")||!combat2ValidAssist(battle,actor,target,helper))return null;
    // Substitute the usual hit. Helper gets no turn, meter or passive redispatch.
    return {partnerId,helperIndex:battle.fighters.indexOf(helper),ability:{id:"basic",name:"Совместный выпад",kind:"damage",target:"enemy",damageType:"physical",multiplier:base.multiplier*.55,cooldown:0,combat2Assist:.65}};
  }

  // Optional future waves are separate encounters inside the same battle.
  // Existing single-wave calls keep their original behavior.
  function createBattle(heroes, futureWaves = [], options = {}) {
    if(!options||typeof options!=="object"||Array.isArray(options))throw Error("invalid battle options");
    if(options.combat2!==undefined&&typeof options.combat2!=="boolean")throw Error("combat2 must be a boolean");
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
    // Stats-001D0: no seed = no RNG, preserving every existing battle.
    // Seeded battles may draw later, but current abilities never draw.
    // Stats-001D1: accuracy/evasion is opt-in on deliberately seeded test battles.
    if(options.hitChecks!==undefined&&typeof options.hitChecks!=="boolean")
      throw Error("hitChecks must be a boolean");
    if(options.hitChecks===true&&options.rngSeed===undefined)
      throw Error("hitChecks requires rngSeed");
    // Stats-001D2: crits are another explicit test-only feature gate.
    if(options.critChecks!==undefined&&typeof options.critChecks!=="boolean")
      throw Error("critChecks must be a boolean");
    if(options.critChecks===true&&options.rngSeed===undefined)
      throw Error("critChecks requires rngSeed");
    // Stats-001E1: penetration is deterministic, but test-only and opt-in.
    if(options.penetrationChecks!==undefined&&typeof options.penetrationChecks!=="boolean")
      throw Error("penetrationChecks must be a boolean");
    // Stats-001E2: only explicitly seeded experimental battles check debuff resistance.
    if(options.statusChecks!==undefined&&typeof options.statusChecks!=="boolean")
      throw Error("statusChecks must be a boolean");
    if(options.statusChecks===true&&options.rngSeed===undefined)
      throw Error("statusChecks requires rngSeed");
    // Opt-in compatibility: legacy weakening is still guaranteed elsewhere.
    if(options.legacyStatusChecks!==undefined&&typeof options.legacyStatusChecks!=="boolean")
      throw Error("legacyStatusChecks must be a boolean");
    if(options.legacyStatusChecks===true&&options.statusChecks!==true)
      throw Error("legacyStatusChecks requires statusChecks");
    // Opt-in, mission-only tactical objectives. Legacy encounters are untouched.
    const tactic=options.tacticalObjective;
    if(tactic!==undefined){
      const plain=tactic&&typeof tactic==="object"&&!Array.isArray(tactic);
      const keys=plain?Object.keys(tactic):[];
      const protectedAlly=plain&&typeof tactic.protectAllyId==="string"&&
        heroes.some(hero=>hero.side==="ally"&&hero.id===tactic.protectAllyId);
      const noWaves=futureWaves.length===0;
      const valid=plain&&noWaves&&(
        tactic.kind==="hold-or-defeat"&&protectedAlly&&
        Number.isSafeInteger(tactic.allyActionsToHold)&&
        tactic.allyActionsToHold>=2&&tactic.allyActionsToHold<=40&&
        keys.every(k=>["kind","protectAllyId","allyActionsToHold"].includes(k))||
        tactic.kind==="protect-and-defeat"&&protectedAlly&&
        keys.every(k=>["kind","protectAllyId"].includes(k))||
        tactic.kind==="priority-first"&&
        typeof tactic.priorityEnemyId==="string"&&
        heroes.some(hero=>hero.side==="enemy"&&hero.id===tactic.priorityEnemyId)&&
        keys.every(k=>["kind","priorityEnemyId"].includes(k))
      );
      if(!valid)throw Error("invalid tactical objective");
    }
    const seededRng=options.rngSeed===undefined?null:
      (typeof BattleRng!=="undefined"?BattleRng.create(options.rngSeed):
       (()=>{throw Error("BattleRng script is required for seeded battles");})());
    const initiative = InitiativeModel.createInitiative(heroes);
    const fighters = heroes.map((hero,index) =>
      makeFighter(hero,index,initiative[index].meter));
    if(options.combat2===true)for(const f of fighters)if(f.side==="ally")f.combat2=true;
    // Leadership is a formation slot, not an ability entitlement. Any living
    // ally can occupy the first position; only heroes with a leader skill grant
    // its effects (activeLeaderModifiers already checks for that definition).
    const leaderId=options.leaderId??null;
    if(leaderId!==null){
      const leader=fighters.find(f=>f.id===leaderId);
      if(typeof leaderId!=="string"||!leader||leader.side!=="ally"||
         leader.hp<=0||fighters.findIndex(f=>f.id===leaderId)!==0)
        throw Error("leader must be the first living ally in the roster");
    }
    const trust=trustSnapshot(heroes,options);
    const battle = {
      fighters,
      ...(trust?{tacticalTrust:trust,trustPlanUsed:false}:{}),
      ...(options.combat2===true?{combat2:true}:{}),
      ...(seededRng===null?{}:{rng:seededRng}),
      ...(options.hitChecks===true?{hitChecks:true}:{}),
      ...(options.critChecks===true?{critChecks:true}:{}),
      ...(options.penetrationChecks===true?{penetrationChecks:true}:{}),
      ...(options.statusChecks===true?{statusChecks:true}:{}),
      ...(options.legacyStatusChecks===true?{legacyStatusChecks:true}:{}),
      leaderId,
      ...(tactic===undefined?{}:{tacticalObjective:Object.freeze({...tactic})}),
      ...(tactic?.kind==="priority-first"?{priorityCleared:false}:{}),
      tacticalOutcome:null,
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
    syncLeaderProtection(battle);
    return battle;
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
  // Combat-013A: passive registration is event-driven and read-only.
  // It records which passive would fire; applying effects comes in 013B.
  // The derived event never dispatches another trigger, preventing loops.
  const PASSIVE_EVENTS=Object.freeze(["ability","damage","heal","effect","death",
    "wave-start","battle-end"]);
  function emit(battle, type, properties) {
    battle.events.push({type, ...properties});
    if(battle.combat2){
      if(type==="wave-start")for(const f of battle.fighters){delete f.combat2Boost;delete f.combat2Prepared;}
      if(type==="death"){
        const dead=battle.fighters.find(f=>f.id===properties.targetId);
        if(dead){delete dead.combat2Boost;delete dead.combat2Prepared;}
      }
    }
    // NET-006A: network-only compact KO/death history. No normal combat change.
    if(type==="death"&&typeof NetworkScoreCore!=="undefined")
     NetworkScoreCore.observe(battle,type,properties.targetId);
    // LIORA001: an emergency guard is a bounded reaction to damage,
    // not a new recursive action. Derived effects never emit again.
    if(type==="damage"){
      const wounded=battle.fighters.find(f=>f.id===properties.targetId);
      if(wounded&&wounded.side==="ally"&&wounded.hp>0&&wounded.maxHp>0&&
        wounded.guardHits===0){
        for(const owner of battle.fighters){
          if(owner.id===wounded.id||owner.side!=="ally"||owner.hp<=0||
            (owner.emergencyGuardCooldown??0)>0)continue;
          const rules=passiveCombatRules(owner);
          if(!rules||!Number.isFinite(rules.protectAllyBelowHpPercent)||
            !Number.isSafeInteger(rules.protectAllyGuardHits)||
            !Number.isSafeInteger(rules.protectAllyCooldownOwnTurns)||
            rules.protectAllyBelowHpPercent<=0||rules.protectAllyBelowHpPercent>100||
            rules.protectAllyGuardHits<1||rules.protectAllyCooldownOwnTurns<1||
            wounded.hp*100>wounded.maxHp*rules.protectAllyBelowHpPercent)continue;
          wounded.guardHits=rules.protectAllyGuardHits;
          owner.emergencyGuardCooldown=rules.protectAllyCooldownOwnTurns;
          battle.events.push({type:"passive-trigger",ownerId:owner.id,
            passiveId:"passive",sourceEventType:"damage",
            sourceActorId:properties.actorId,sourceTargetId:wounded.id});
          battle.events.push({type:"effect",actorId:owner.id,targetId:wounded.id,
            effect:"guard",stacks:wounded.guardHits,passiveId:"passive"});
          break; // one emergency defender per hit
        }
      }
    }
    if(!PASSIVE_EVENTS.includes(type))return;
    for(const owner of battle.fighters){
      if(owner.side!=="ally"||owner.hp<=0)continue;
      const passive=AbilityData.get(owner,"passive");
      if(!passive||!Array.isArray(passive.triggers))continue;
      passive.triggers.forEach((trigger,index)=>{
        if(!trigger||trigger.event!==type||!["actor","target"].includes(trigger.role))
          return;
        const matchedId=trigger.role==="actor"?properties.actorId:properties.targetId;
        if(matchedId!==owner.id)return;
        battle.events.push({type:"passive-trigger",ownerId:owner.id,passiveId:passive.id,
          triggerIndex:index,sourceEventType:type,sourceActorId:properties.actorId||null,
          sourceTargetId:properties.targetId||null});
        // Only a documented, safe self-heal is executable in the technical
        // fixture. Do not re-dispatch generated events: no reaction chains.
        const effect=trigger.effect;
        if(!effect||effect.kind!=="heal"||effect.target!=="self"||
           !Number.isSafeInteger(effect.amount)||effect.amount<=0) return;
        const restored=Math.min(effect.amount,Math.max(0,owner.maxHp-owner.hp));
        owner.hp+=restored;
        battle.events.push({type:"heal",actorId:owner.id,targetId:owner.id,
          amount:restored,remainingHp:owner.hp,passiveId:passive.id});

      });
    }
  }

  function finishIfOver(battle) {
    syncLeaderProtection(battle);
    // Wrong first kill is an immediate failure, not a victory at 0 enemy HP.
    const tactic=battle.tacticalObjective;
    if(tactic?.kind==="priority-first"&&!battle.priorityCleared){
      const priority=battle.fighters.find(f=>f.id===tactic.priorityEnemyId&&f.side==="enemy");
      const otherFallen=battle.fighters.some(f=>f.side==="enemy"&&
        f.id!==tactic.priorityEnemyId&&f.hp<=0);
      if(!priority||otherFallen){
        battle.active=false;battle.winner="enemy";
        battle.currentActor=-1;battle.selectedEnemy=-1;battle.selectedAlly=-1;
        battle.tacticalOutcome="wrong-order";
        battle.message="Поражение: отмеченного противника нужно победить первым.";
        emit(battle,"battle-end",{winner:"enemy",reason:"wrong-order"});
        return true;
      }
      if(priority.hp<=0){
        battle.priorityCleared=true;
        emit(battle,"priority-cleared",{enemyId:tactic.priorityEnemyId});
      }
    }
    // A protected ally's defeat overrides either route to victory.
    if(tactic?.protectAllyId){
      const protectedHero=battle.fighters.find(h=>h.id===tactic.protectAllyId&&h.side==="ally");
      if(!protectedHero||protectedHero.hp<=0){
        battle.active=false;battle.winner="enemy";
        battle.currentActor=-1;battle.selectedEnemy=-1;battle.selectedAlly=-1;
        battle.tacticalOutcome="protected-fallen";
        battle.message=tactic.kind==="hold-or-defeat"?
          "Поражение: проводник выведен из строя. Эвакуация прервана.":
          "Поражение: защищаемый союзник выведен из строя.";
        emit(battle,"battle-end",{winner:"enemy",reason:"protected-fallen"});
        return true;
      }
    }
    if(tactic?.kind==="hold-or-defeat"&&
       battle.allyActions>=tactic.allyActionsToHold&&firstLivingAlly(battle.fighters)>=0){
      battle.active=false;battle.winner="ally";
      battle.currentActor=-1;battle.selectedEnemy=-1;battle.selectedAlly=-1;
      battle.tacticalOutcome="held";
      battle.message="Эвакуация завершена. Проход удержан.";
      emit(battle,"battle-end",{winner:"ally",reason:"held"});
      return true;
    }
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
      battle.tacticalOutcome=tactic?.kind==="hold-or-defeat"?"defeated-attackers":
        tactic?.kind==="priority-first"?"priority-victory":
        tactic?.kind==="protect-and-defeat"?"protected-victory":null;
      battle.message = tactic?.kind==="hold-or-defeat"?"Нападавшие оттеснены. Путь свободен.":
        tactic?"Задача выполнена. Все противники побеждены.":"Победа! Отряд одержал верх.";
      emit(battle, "battle-end", {winner: "ally",
       ...(battle.tacticalOutcome?{reason:battle.tacticalOutcome}:{})});
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

  // Stats-001C: the typed path is opt-in. Absent defenses mean that this
  // target has not activated the new defense model; no attributes are created.
  // Explicit invalid defense/Protection values reject a command before a turn.
  const DEFENSE_SCALE = 100; // prototype-only approved coefficient
  function validTypedTarget(target,type){
    const defense=type==="physical"?"physicalDefense":"magicDefense";
    const value=target[defense];
    if(value!==undefined&&(!Number.isFinite(value)||value<0))return false;
    const hasPool=target.protection!==undefined||target.maxProtection!==undefined;
    return !hasPool||(Number.isSafeInteger(target.protection)&&
      Number.isSafeInteger(target.maxProtection)&&target.maxProtection>=0&&
      target.protection>=0&&target.protection<=target.maxProtection);
  }
  function typedDamageFields(target,type,oldHp,oldProtection){
    if(type==="legacy")return {};
    return {damageType:type,
      protectionDamage:oldProtection===null?0:oldProtection-target.protection,
      hpDamage:oldHp-target.hp,
      remainingProtection:oldProtection===null?null:target.protection};
  }
  // Stats-001D1 [TEST ONLY]: percentage-point accuracy bonus vs evasion.
  // These values are NOT assigned to real characters.
  function hitCheckEnabled(battle,type){
    return type!=="legacy"&&battle.hitChecks===true;
  }
  function validHitProfile(battle,actor,recipients,type){
    if(!hitCheckEnabled(battle,type))return true;
    if(typeof BattleRng==="undefined")return false;
    let snapshot;
    try{snapshot=BattleRng.snapshot(battle);}catch(error){return false;}
    if(snapshot.draws>Number.MAX_SAFE_INTEGER-recipients.length)return false;
    const valid=value=>value===undefined||
      (Number.isFinite(value)&&value>=0&&value<=100);
    return valid(actor.accuracy)&&recipients.every(target=>valid(target.evasion));
  }
  function rollToHit(battle,actor,target,type,readMovePenalty=false){
    if(!hitCheckEnabled(battle,type))return true;
    const accuracy=(actor.accuracy??0)+gardensCombatBonus(battle,actor,"gardensAccuracyBonus")-
      (readMovePenalty?20:0);
    const evasion=(target.evasion??0)+gardensCombatBonus(battle,target,"gardensEvasionBonus");
    const chance=Math.max(5,Math.min(100,100+accuracy-evasion));
    const roll=BattleRng.roll(battle,chance);
    if(roll.hit)return true;
    emit(battle,"miss",{actorId:actor.id,targetId:target.id,
      hitChance:chance,draw:roll.draw});
    return false;
  }
  // Stats-001D2 [TEST ONLY]: a crit uses a separate RNG draw AFTER a hit.
  // If hitChecks is disabled, an attack is a guaranteed hit and may crit.
  function critCheckEnabled(battle,type){
    return type!=="legacy"&&battle.critChecks===true;
  }
  function validCriticalProfile(battle,actor,recipients,type){
    if(!critCheckEnabled(battle,type))return true;
    if(typeof BattleRng==="undefined")return false;
    let snapshot;
    try{snapshot=BattleRng.snapshot(battle);}catch(error){return false;}
    const maxDraws=recipients.length*(hitCheckEnabled(battle,type)?2:1);
    if(snapshot.draws>Number.MAX_SAFE_INTEGER-maxDraws)return false;
    // Both values are mandatory for an explicitly crit-enabled actor.
    // The 100–1000% multiplier cap is a temporary technical safety bound.
    return Number.isFinite(actor.critChance)&&actor.critChance>=0&&actor.critChance<=100&&
      Number.isFinite(actor.critDamage)&&actor.critDamage>=100&&actor.critDamage<=1000;
  }
  function rollCriticalDamage(battle,actor,target,base,type){
    if(!critCheckEnabled(battle,type))return base;
    const roll=BattleRng.roll(battle,actor.critChance);
    if(!roll.hit)return base;
    const adjusted=Math.round(base*actor.critDamage/100);
    emit(battle,"critical",{actorId:actor.id,targetId:target.id,
      multiplierPercent:actor.critDamage,draw:roll.draw});
    return adjusted;
  }
  // Stats-001E1 [TEST ONLY]: temporary percent-based defense penetration.
  // Missing attributes do not automatically become final character defaults.
  function penetrationEnabled(battle,type){
    return type!=="legacy"&&battle.penetrationChecks===true;
  }
  function validPenetrationProfile(battle,actor,type){
    if(!penetrationEnabled(battle,type))return true;
    return Number.isFinite(actor.defensePenetration)&&
      actor.defensePenetration>=0&&actor.defensePenetration<=100;
  }
  // Legacy: weakening -> guard -> HP (unchanged).
  // Typed: weakening -> matching defense -> guard -> Protection -> HP.
  function dealDamage(attacker,target,rawDamage,consumeWeakening=true,type="legacy",penetration=0,battle=null,canInsurance=false){
    let damage=Math.max(0,rawDamage);
    if(attacker.weakenAttacks>0)damage=Math.round(damage*0.7);
    if(type!=="legacy"){
      const defense=target[type==="physical"?"physicalDefense":"magicDefense"];
      // Penetration reduces matching DEF, never guard or Protection.
      // Do not round effective DEF before the damage formula.
      if(defense!==undefined){
        const effectiveDefense=defense*(1-penetration/100);
        damage=Math.round(damage*DEFENSE_SCALE/(DEFENSE_SCALE+effectiveDefense));
      }
    }
    if(battle?.combat2&&battle.combat2Resolving===attacker.id&&attacker.side==="enemy"&&target.side==="ally"&&damage>0){
      const art=battle.fighters.find(f=>f.id==="art"&&f.side==="ally"&&f.hp>0&&f.id!==target.id&&!f.combat2ReactUsed&&f.protection>0&&Number.isFinite(f.physicalAttack));
      if(art){
        const blocked=Math.min(Math.round(damage*.40),Math.round(art.physicalAttack*.85),art.protection*2);
        if(blocked>0){const spent=Math.ceil(blocked/2);art.protection-=spent;damage-=blocked;art.combat2ReactUsed=true;emit(battle,"combat2-cover",{actorId:art.id,targetId:target.id,amount:blocked,protectionSpent:spent});}
      }
    }
    if(target.guardHits>0){
      damage=Math.round(damage*0.5);
      target.guardHits--;
    }
    if(type!=="legacy"&&target.protection!==undefined){
      const absorbed=Math.min(damage,target.protection);
      target.protection-=absorbed;
      const hpLoss=damage-absorbed;
      target.hp=Math.max(0,target.hp-(battle&&canInsurance?
        insuranceRedirect(battle,attacker,target,hpLoss):hpLoss));
    }else{
      target.hp=Math.max(0,target.hp-(battle&&canInsurance?
        insuranceRedirect(battle,attacker,target,damage):damage));
    }
    if(target.hp===0){
      target.guardHits=0;
      target.weakenAttacks=0;
    }
    if(consumeWeakening&&attacker.weakenAttacks>0)attacker.weakenAttacks--;
    return damage;
  }

  // Advance game time to the next living actor; resolve AI actions until an ally is ready.
  // This is turn-based, not tied to frame rate or animation timing.
  function advanceToPlayerTurn(battle) {
    if (!battle.active || finishIfOver(battle)) return battle;
    for (let steps = 0; steps < 1000; steps++) {
      const ready = InitiativeModel.nextActor(battle.fighters,
        fighter=>effectiveStat(battle,fighter,"speed"));
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
      // Combat-015E: every enemy uses the shared tactical planner.
      // The default is aggressive, independent of mission and enemy ID.
      // Fallback is a guaranteed basic hit when a proposal is invalid.
      const targetIndex=firstLivingAlly(battle.fighters);
      if(targetIndex<0){
        finishIfOver(battle);
        return battle;
      }
      battle.currentActor=actorIndex;
      const plan=typeof EnemyDecision!=="undefined"
        ?EnemyDecision.chooseAction(battle,actorIndex):null;
      const resolved=battle.combat2?combat2EnemyPlan(battle,actor,actorIndex,plan,targetIndex):plan;
      if(resolved?.prepared)continue;
      let executed;
      try{executed=resolved&&["basic","special","powerful"].includes(resolved.abilityId)
        ?performActorAbility(battle,resolved.abilityId,resolved.targetIndex):false;}
      finally{if(battle.combat2)delete battle.combat2Resolving;}
      if(!executed){
        const opponents=actorTargetIndices(battle,actorIndex,"all-enemies",targetIndex);
        const fallback=opponents.reduce((best,i)=>best===null||
            battle.fighters[i].hp<battle.fighters[best].hp?i:best,null);
        if(fallback===null||!performActorAbility(battle,"basic",fallback))
          throw Error("Ready enemy basic attack rejected");
      }
      if(!battle.active)return battle;
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

  // Modes are relative to the acting fighter, not to the human player.
  function actorTargetIndices(battle,actorIndex,mode,primaryIndex){
    if(!battle||!battle.active||!Array.isArray(battle.fighters)||
       !Number.isInteger(actorIndex))return [];
    const actor=battle.fighters[actorIndex];
    if(!actor||!["ally","enemy"].includes(actor.side)||actor.hp<=0)return [];
    if(mode==="self")return [actorIndex];
    const targetSide=mode==="enemy"||mode==="all-enemies"
      ? actor.side==="ally"?"enemy":"ally"
      : mode==="ally"||mode==="all-allies"?actor.side:null;
    if(!targetSide)return [];
    // LIORA001: single-target enemy actions cannot bypass a living taunter.
    if(mode==="enemy"&&actor.side==="enemy"&&typeof CombatStatusCore!=="undefined"){
      const taunter=battle.fighters.findIndex(f=>f.side===targetSide&&f.hp>0&&
        CombatStatusCore.read(f,"taunt")!==null);
      if(taunter>=0)return [taunter];
    }
    if(mode==="enemy"||mode==="ally")
      return Number.isInteger(primaryIndex)&&battle.fighters[primaryIndex]&&
        battle.fighters[primaryIndex].side===targetSide&&
        battle.fighters[primaryIndex].hp>0?[primaryIndex]:[];
    return battle.fighters.flatMap((fighter,i)=>
      fighter.side===targetSide&&fighter.hp>0?[i]:[]);
  }
  // Preserve the existing player-facing selection API.
  function abilityTargetIndices(battle,mode){
    const actor=battle?.fighters?.[battle.currentActor];
    if(!actor||actor.side!=="ally")return [];
    const primary=mode==="ally"||mode==="all-allies"?
      battle.selectedAlly:battle.selectedEnemy;
    return actorTargetIndices(battle,battle.currentActor,mode,primary);
  }

  function specialName(actor) {
    const ability=AbilityData.get(actor,"special");
    return ability?ability.name:"Особая";
  }

  function actorAbilityReady(battle,actorIndex,abilityId){
    if(!battle||!battle.active||!Array.isArray(battle.fighters)||
       !Number.isInteger(actorIndex))return false;
    const actor=battle.fighters[actorIndex];
    if(!actor||!["ally","enemy"].includes(actor.side)||actor.hp<=0||
       actor.meter<1000-1e-8)return false;
    const ability=AbilityData.get(actor,abilityId);
    if(!ability)return false;
    if(ability.combat2Signal&&!battle.fighters.some(f=>f.side==="ally"&&f.hp>0&&f.id!==actor.id&&f.meter<950))return false;
    if(ability.combat2Assist&&!battle.fighters.some(f=>f.side==="ally"&&f.hp>0&&f.id!==actor.id))return false;
    if(["insurance","signal"].includes(ability.kind)&&
       !battle.fighters.some(f=>f.side===actor.side&&f.hp>0&&f.id!==actor.id))
      return false;
    if(abilityId==="basic")return ability.id==="basic";
    if(abilityId==="special")return ability.id==="special"&&actor.specialCooldown===0;
    if(abilityId==="powerful")return ability.id==="powerful"&&actor.powerfulCooldown===0;
    return false;
  }
  function abilityReady(battle,abilityId){
    const actor=battle?.fighters?.[battle.currentActor];
    return !!actor&&actor.side==="ally"&&
      actorAbilityReady(battle,battle.currentActor,abilityId);
  }

  // Combat-012A: independent cooldowns progress after a successful own action.
  // The executed ability starts its cooldown; the other counter decreases once.
  function finishAbilityCooldowns(actor,ability){
    if(ability.id==="special")actor.specialCooldown=ability.cooldown;
    else actor.specialCooldown=Math.max(0,actor.specialCooldown-1);
    if(ability.id==="powerful")actor.powerfulCooldown=ability.cooldown;
    else actor.powerfulCooldown=Math.max(0,actor.powerfulCooldown-1);
  }

  // Stats-001E2 [TEST ONLY]: negative weaken is resisted independently of damage.
  // No status roll is performed for legacy damage, heal or friendly guard.
  function statusCheckEnabled(battle,type){
    return battle.statusChecks===true&&
      (type!=="legacy"||battle.legacyStatusChecks===true);
  }
  function abilityHasNegativeStatus(ability){
    return ability.kind==="damage"&&
      (ability.weakening>0||(ability.followUpEffects||[]).some(e=>e.status==="weaken"));
  }
  // Stats-003: reserve the TOTAL RNG budget for a command before any damage,
  // effect, event, action counter or cooldown can be changed. Individually
  // checking hit/crit/status budgets misses cumulative counter exhaustion.
  function validCombinedRngBudget(battle,ability,recipients,type){
    const hit=hitCheckEnabled(battle,type);
    const crit=critCheckEnabled(battle,type);
    const status=statusCheckEnabled(battle,type)&&abilityHasNegativeStatus(ability);
    const onHitStatus=battle.statusChecks===true&&ability.onHitStatus!==undefined;
    const areaStatus=battle.statusChecks===true&&ability.followUpStatusAll!==undefined;
    if(!hit&&!crit&&!status&&!onHitStatus&&!areaStatus)return true;
    if(typeof BattleRng==="undefined")return false;
    let snapshot;
    try{snapshot=BattleRng.snapshot(battle);}catch(error){return false;}
    let draws=(hit?recipients.length:0)+(crit?recipients.length:0);
    if(onHitStatus)draws+=recipients.length;
    // Reserve for all living enemies even when the primary dies on impact.
    if(areaStatus)draws+=battle.fighters.filter(f=>f.side!==battle.fighters[battle.currentActor].side&&f.hp>0).length;
    if(status){
      if(ability.weakening>0)draws+=recipients.length;
      for(const e of ability.followUpEffects||[]){
        if(e.status!=="weaken")continue;
        // Self-targeted weaken is rejected by validStatusProfile.
        draws+=e.scope==="all"?recipients.length:e.scope==="primary"?1:0;
      }
    }
    return Number.isSafeInteger(draws)&&
      snapshot.draws<=Number.MAX_SAFE_INTEGER-draws;
  }
  function validStatusProfile(battle,actor,recipients,ability,type){
    // Even legacy Ren attacks need valid stats for opt-in on-hit status rolls.
    // Reject before action/RNG/event mutation, including multi-target commands.
    if((ability.onHitStatus!==undefined||ability.followUpStatusAll!==undefined)&&battle.statusChecks===true){
      if(typeof BattleRng==="undefined")return false;
      const valid=value=>Number.isFinite(value)&&value>=0&&value<=100;
      if(!valid(actor.debuffPotency)||
         !recipients.every(t=>valid(t.debuffResistance)))return false;
    }
    if(!statusCheckEnabled(battle,type)||!abilityHasNegativeStatus(ability))return true;
    // Test-only scope self weakening is not supported yet: do not partially
    // resolve a damaging command before discovering its missing recipient data.
    if((ability.followUpEffects||[]).some(e=>
      e.status==="weaken"&&e.scope==="self"))return false;
    if(typeof BattleRng==="undefined")return false;
    let snapshot;
    try{snapshot=BattleRng.snapshot(battle);}catch(error){return false;}
    const valid=value=>Number.isFinite(value)&&value>=0&&value<=100;
    if(!valid(actor.debuffPotency)||!recipients.every(t=>valid(t.debuffResistance)))return false;
    const direct=ability.weakening>0?recipients.length:0;
    const followUps=(ability.followUpEffects||[]).reduce((sum,e)=>{
      if(e.status!=="weaken")return sum;
      return sum+(e.scope==="all"?recipients.length:e.scope==="primary"?1:0);
    },0);
    const reserve=direct+followUps;
    return snapshot.draws<=Number.MAX_SAFE_INTEGER-reserve;
  }
  function applyNegativeStatus(battle,actor,target,stacks,type,readMovePenalty=false){
    if(!statusCheckEnabled(battle,type)){
      target.weakenAttacks=stacks;
      emit(battle,"effect",{actorId:actor.id,targetId:target.id,
        effect:"weaken",stacks});
      return;
    }
    const chance=statusChance(actor,target,readMovePenalty);
    const roll=BattleRng.roll(battle,chance);
    if(!roll.hit){
      emit(battle,"status-resisted",{actorId:actor.id,targetId:target.id,
        effect:"weaken",chance,draw:roll.draw});
      return;
    }
    target.weakenAttacks=stacks;
    emit(battle,"effect",{actorId:actor.id,targetId:target.id,
      effect:"weaken",stacks});
  }
  // REN-COMBAT-B: a single data-defined on-hit status, independent of hero ID.
  // Temporary story pilot: no status RNG on legacy paths. Seeded status-check
  // mode remains unsupported until a separate approved resist/RNG contract.
  function validOnHitStatus(battle,ability){
    if(ability.onHitStatus===undefined)return true;
    const x=ability.onHitStatus;
    return ability.kind==="damage"&&
      ["enemy","all-enemies"].includes(ability.target)&&
      typeof CombatStatusCore!=="undefined"&&
      CombatStatusCore.KINDS.includes(x?.type)&&
      (x.type==="read-move"?
       Number.isSafeInteger(x.stacks)&&x.stacks>=1&&x.stacks<=4:
       Number.isFinite(x.amount)&&x.amount>=0&&x.amount<=100)&&
      Number.isSafeInteger(x.turns)&&x.turns>0;
  }
  function applyOnHitStatus(battle,actor,target,ability,readMovePenalty=false){
    const x=ability.onHitStatus;
    if(!x||target.hp<=0)return;
    if(battle.statusChecks===true){
      const chance=statusChance(actor,target,readMovePenalty);
      const roll=BattleRng.roll(battle,chance);
      if(!roll.hit){
        emit(battle,"status-resisted",{actorId:actor.id,targetId:target.id,
          effect:x.type,chance,draw:roll.draw});
        return;
      }
    }
    const applied=x.type==="read-move"?
      CombatStatusCore.applyReadMove(target,x.stacks,x.turns):
      CombatStatusCore.apply(target,x.type,x.amount,x.turns);
    if(applied){
      const result=CombatStatusCore.read(target,x.type);
      emit(battle,"effect",{actorId:actor.id,targetId:target.id,
        effect:x.type,
        ...(x.type==="read-move"?{stacks:result.stacks}:{amount:x.amount}),
        remaining:result.remaining});
    }
  }
  // REN-COMBAT-D: powerful strike targets one foe, then independently tries
  // a non-damaging status on all living opposing fighters. An actual hit
  // triggers the group stage even when the struck primary dies. A miss does not.
  function validAreaStatus(ability){
    if(ability.followUpStatusAll===undefined)return true;
    const x=ability.followUpStatusAll;
    return ability.kind==="damage"&&ability.target==="enemy"&&
      typeof CombatStatusCore!=="undefined"&&
      CombatStatusCore.KINDS.includes(x?.type)&&
      Number.isFinite(x.amount)&&x.amount>=0&&x.amount<=100&&
      Number.isSafeInteger(x.turns)&&x.turns>0;
  }
  function areaStatusTargets(battle,actor){
    return battle.fighters.filter(target=>target.side!==actor.side&&target.hp>0);
  }
  function validAreaStatusProfile(battle,actor,ability){
    if(ability.followUpStatusAll===undefined||battle.statusChecks!==true)return true;
    const valid=n=>Number.isFinite(n)&&n>=0&&n<=100;
    return valid(actor.debuffPotency)&&
      areaStatusTargets(battle,actor).every(t=>valid(t.debuffResistance));
  }
  function applyAreaStatusAfterHit(battle,actor,ability,readMovePenalty=false){
    const x=ability.followUpStatusAll;
    if(!x)return;
    // Each surviving opponent gets its own optional RNG check.
    for(const target of areaStatusTargets(battle,actor)){
      if(battle.statusChecks===true){
        const chance=statusChance(actor,target,readMovePenalty);
        const roll=BattleRng.roll(battle,chance);
        if(!roll.hit){
          emit(battle,"status-resisted",{actorId:actor.id,targetId:target.id,
            effect:x.type,chance,draw:roll.draw});
          continue;
        }
      }
      if(CombatStatusCore.apply(target,x.type,x.amount,x.turns))
        emit(battle,"effect",{actorId:actor.id,targetId:target.id,
          effect:x.type,amount:x.amount,remaining:x.turns});
    }
  }
  function tickActorStatuses(actor){
    if(typeof CombatStatusCore!=="undefined"){
      CombatStatusCore.tickOwnTurn(actor);
      if(!CombatStatusCore.read(actor,"disrupted-plan"))
        delete actor.tacticalDisruptDelay;
    }
    if(Number.isSafeInteger(actor.emergencyGuardCooldown)&&actor.emergencyGuardCooldown>0)
      actor.emergencyGuardCooldown--;
  }

  // Combat-012C: optional data-defined follow-up statuses, not hero-specific
  // branching. Existing statuses are intentionally reused; new status types
  // require separate rules and tests rather than implicit interpretation.
  const FOLLOW_UP_SCOPES=Object.freeze(["primary","all","self"]);
  function validFollowUpEffects(ability) {
    if(ability.followUpEffects===undefined)return true;
    return Array.isArray(ability.followUpEffects)&&
      ability.followUpEffects.every(effect=>effect&&
        FOLLOW_UP_SCOPES.includes(effect.scope)&&
        ["guard","weaken"].includes(effect.status)&&
        Number.isSafeInteger(effect.stacks)&&effect.stacks>0);
  }
  // Recipients were selected before the primary action. Bonus effects resolve
  // afterwards, but only on survivors; a fallen primary is never replaced.
  function applyFollowUpEffects(battle,actor,ability,recipients,primary,type="legacy",readMovePenalty=false){
    for(const effect of ability.followUpEffects||[]){
      const affected=effect.scope==="self"?[actor]:
        effect.scope==="primary"?[primary]:recipients;
      for(const target of affected){
        if(!target||target.hp<=0)continue;
        const remaining=Math.max(effectCount(target,effect.status),effect.stacks);
        if(effect.status==="weaken"&&statusCheckEnabled(battle,type)){
          applyNegativeStatus(battle,actor,target,remaining,type,readMovePenalty);
        }else{
          setEffect(target,effect.status,remaining);
          emit(battle,"effect",{actorId:actor.id,targetId:target.id,
            effect:effect.status,stacks:remaining});
        }
      }
    }
  }

  // Combat-011B: atomic resolution of one self/group command. The acting
  // unit spends exactly one turn and one cooldown. Dead targets are filtered
  // before the command; wave/victory transitions happen after all targets.
  function readMoveMitigation(actor,ability){
    return actor.side==="enemy"&&ability.kind==="damage"&&
      (ability.id==="special"||ability.id==="powerful")&&
      typeof CombatStatusCore!=="undefined"&&
      (CombatStatusCore.read(actor,"read-move")?.stacks??0)>=3;
  }
  const READ_MOVE_DAMAGE_REDUCTION_PERCENT=30;
  const reducedReadMoveDamage=(raw,mitigated)=>mitigated?
    Math.round(raw*(100-READ_MOVE_DAMAGE_REDUCTION_PERCENT)/100):raw;
  function consumeReadMoveMitigation(battle,actor,mitigated){
    if(!mitigated)return true;
    if(!CombatStatusCore.spendReadMove(actor,3))return false;
    emit(battle,"read-move-predicted",{actorId:actor.id,remainingStacks:
      CombatStatusCore.read(actor,"read-move")?.stacks??0,
      accuracyPenalty:20,statusPotencyPenalty:20,
      damageReduction:READ_MOVE_DAMAGE_REDUCTION_PERCENT});
    return true;
  }
  function performMultiTargetAbility(battle, actor, ability, targets, chosenPrimaryIndex,readMovePenalty=false,disruption=null) {
    if(!["self","all-enemies","all-allies"].includes(ability.target))return false;
    if(!["damage","heal","guard","coordinate"].includes(ability.kind))return false;
    if(ability.kind==="coordinate"&&ability.target!=="self")return false;
    if(ability.target==="all-enemies"&&ability.kind!=="damage")return false;
    if((ability.target==="all-allies"||ability.target==="self")&&ability.kind==="damage")return false;
    if(ability.kind==="damage"&&(!Number.isFinite(ability.multiplier)||ability.multiplier<0))return false;
    if(ability.kind==="heal"&&(!Number.isFinite(ability.healAmount)||ability.healAmount<0))return false;
    if(ability.kind==="guard"&&(!Number.isInteger(ability.guardHits)||ability.guardHits<0))return false;
    if(!targets.length||!validOnHitStatus(battle,ability))return false;
    const recipients=targets.map(i=>battle.fighters[i]);
    const type=ability.kind==="damage"?AbilityData.damageType(ability):null;
    if(type&&type!=="legacy"&&recipients.some(target=>!validTypedTarget(target,type)))return false;
    if(ability.kind==="damage"&&!validHitProfile(battle,actor,recipients,type))return false;
    if(ability.kind==="damage"&&!validCriticalProfile(battle,actor,recipients,type))return false;
    if(ability.kind==="damage"&&!validPenetrationProfile(battle,actor,type))return false;
    if(!validStatusProfile(battle,actor,recipients,ability,type))return false;
    if(!validCombinedRngBudget(battle,ability,recipients,type))return false;
    // A group attack has one player-selected primary target, even though
    // every living enemy receives the base effect. Future bonus effects can
    // refer to primaryTargetId without changing recipient selection.
    const primaryIndex=ability.target==="all-enemies"&&
      targets.includes(chosenPrimaryIndex)?chosenPrimaryIndex:targets[0];
    const primaryTargetId=battle.fighters[primaryIndex].id;
    if(actor.side==="ally"){battle.allyActions++;battle.events=[];}
    if(!consumeReadMoveMitigation(battle,actor,readMovePenalty))return false;
    emit(battle,"ability",{
      actorId:actor.id,targetId:primaryTargetId,primaryTargetId,
      targetIds:recipients.map(f=>f.id),abilityId:ability.id
    });
    const weakened=actor.weakenAttacks>0;
    if(ability.kind==="coordinate"){
      battle.coordinatedWindow={ownerId:actor.id,first:null,
       remainingActions:ability.windowActions,
       damagePercent:ability.coordinationDamagePercent,
       defenseMeter:ability.coordinationMeter,
       defenseEnabled:!!ability.defenseComboEnabled};
      emit(battle,"coordinated-open",{actorId:actor.id,remaining:ability.windowActions});
    }
    for(const target of ability.kind==="coordinate"?[]:recipients){
      if(ability.kind==="damage"){
        if(!rollToHit(battle,actor,target,type,readMovePenalty))continue;
        const oldHp=target.hp,oldProtection=target.protection??null;
        const baseDamage=tacticalDamageBonus(battle,actor,target,
         bonusDamage(battle,actor,target,Math.round(effectiveStat(battle,actor,
           AbilityData.damageStat(ability))*ability.multiplier)));
        const damage=dealDamage(actor,target,
          reducedReadMoveDamage(rollCriticalDamage(battle,actor,target,baseDamage,type),readMovePenalty),false,type,
          penetrationEnabled(battle,type)?actor.defensePenetration:0,battle,false);
        emit(battle,"damage",{actorId:actor.id,targetId:target.id,amount:damage,remainingHp:target.hp,
          ...typedDamageFields(target,type,oldHp,oldProtection)});
        if(target.hp===0)emit(battle,"death",{targetId:target.id});
        if(ability.weakening>0&&target.hp>0)
          applyNegativeStatus(battle,actor,target,ability.weakening,type,readMovePenalty);
        applyOnHitStatus(battle,actor,target,ability,readMovePenalty);
      }else if(ability.kind==="heal"){
        const restored=Math.min(ability.healAmount,Math.max(0,target.maxHp-target.hp));
        target.hp+=restored;
        emit(battle,"heal",{actorId:actor.id,targetId:target.id,amount:restored,remainingHp:target.hp});
      }else{
        target.guardHits=ability.guardHits;
        emit(battle,"effect",{actorId:actor.id,targetId:target.id,effect:"guard",stacks:ability.guardHits});
      }
    }
    // A primary-target follow-up cannot apply if that target was missed.
    const hitRecipients=ability.kind==="damage"&&hitCheckEnabled(battle,type)?
      recipients.filter(target=>!battle.events.some(event=>
        event.type==="miss"&&event.actorId===actor.id&&event.targetId===target.id)):
      recipients;
    const primary=battle.fighters[primaryIndex];
    applyFollowUpEffects(battle,actor,ability,hitRecipients,
      hitRecipients.includes(primary)?primary:null,type,readMovePenalty);
    // Weakening counts attacks (commands), not recipients. All group targets
    // get the same weakened damage; one use is consumed at the end.
    if(ability.kind==="damage"&&weakened)actor.weakenAttacks--;
    battle.message=ability.kind==="coordinate"?
      actor.name+" открывает согласованное окно для двух разных союзников.":
      actor.name+" применяет "+ability.name+": целей "+recipients.length+".";
    // Apply before the ordinary end-of-action tick; +1 keeps two subsequent
    // own turns of provocation after the casting turn.
    if(ability.tauntTurns!==undefined&&typeof CombatStatusCore!=="undefined"){
      CombatStatusCore.apply(actor,"taunt",0,ability.tauntTurns+1);
      emit(battle,"effect",{actorId:actor.id,targetId:actor.id,
        effect:"taunt",remaining:ability.tauntTurns});
    }
    finishAbilityCooldowns(actor,ability);
    finishDisruption(battle,actor,ability,disruption);
    InitiativeModel.finishTurn(battle.fighters,actor.id);
    finishTacticalAction(battle,actor,ability,battle.fighters[primaryIndex]);
    tickActorStatuses(actor);
    battle.turn++;
    battle.currentActor=-1;
    if(finishIfOver(battle))return true;
    if(ability.target==="all-enemies"&&
       selectEnemy(battle.fighters,battle.selectedEnemy)<0)
      battle.selectedEnemy=firstLivingEnemy(battle.fighters);
    if(actor.side==="ally")advanceToPlayerTurn(battle);
    return true;
  }

  // Shared action executor. Current actor must be ready and have a legal target.
  function performActorAbility(battle,abilityId,primaryIndex) {
    const trustRequested=abilityId==="trust-plan";
    const plan=trustRequested?trustPlanPreview(battle,primaryIndex):null;
    if(trustRequested&&!plan)return false;
    if(trustRequested)abilityId="basic";
    const combat2HelperIndex=plan?plan.helperIndex:arguments[3];
    const actorIndex=battle?.currentActor;
    if(!actorAbilityReady(battle,actorIndex,abilityId))return false;
    const actor=battle.fighters[actorIndex];
    const planned=plan?plan.ability:AbilityData.get(actor,abilityId);
    const disruption=disruptDefinition(battle,actor,planned);
    const ability=disruption.ability;
    const readMovePenalty=readMoveMitigation(actor,ability);
    // Invalid definitions must not consume an action or overwrite events.
    // Stats-001B: explicit typed attacks require a valid matching attack value.
    // Legacy abilities keep using the historical general atk without reclassification.
    const damageStat=ability.kind==="damage"?AbilityData.damageStat(ability):null;
    if(ability.kind==="damage"&&(!damageStat||!Number.isFinite(actor[damageStat])||actor[damageStat]<0))return false;
    if(!Number.isSafeInteger(ability.cooldown)||ability.cooldown<0||
       !validFollowUpEffects(ability)||!validOnHitStatus(battle,ability)||
       !validAreaStatus(ability)||!validAreaStatusProfile(battle,actor,ability))return false;
    if(!["damage","heal","guard","insurance","signal","coordinate"].includes(ability.kind))return false;
    if(ability.tauntTurns!==undefined&&
      (ability.kind!=="guard"||ability.target!=="self"||
       !Number.isSafeInteger(ability.tauntTurns)||ability.tauntTurns<1))return false;
    if(ability.kind==="damage"&&(!Number.isFinite(ability.multiplier)||ability.multiplier<0))return false;
    if(ability.kind==="heal"&&(!Number.isFinite(ability.healAmount)||ability.healAmount<0))return false;
    if(ability.kind==="guard"&&(!Number.isInteger(ability.guardHits)||ability.guardHits<0))return false;
    if(ability.kind==="insurance"&&(!Number.isFinite(ability.insurancePercent)||
       ability.insurancePercent<=0||ability.insurancePercent>100||
       !Number.isSafeInteger(ability.insuranceTurns)||ability.insuranceTurns<1))return false;
    if(ability.kind==="signal"&&(!Number.isFinite(ability.signalMeter)||
       ability.signalMeter<0||ability.signalMeter>1000||
       !Number.isSafeInteger(ability.signalTurns)||ability.signalTurns<1))return false;
    if(ability.kind==="coordinate"&&(!Number.isSafeInteger(ability.windowActions)||
       ability.windowActions<2||ability.windowActions>12||
       !Number.isFinite(ability.coordinationDamagePercent)||
       !Number.isFinite(ability.coordinationMeter)))return false;
    const targets=actorTargetIndices(battle,actorIndex,ability.target,primaryIndex);
    if(["self","all-enemies","all-allies"].includes(ability.target))
      return performMultiTargetAbility(battle,actor,ability,targets,primaryIndex,readMovePenalty,disruption);
    if(ability.target!=="ally" && ability.target!=="enemy")return false;
    if(targets.length!==1)return false;
    const targetIndex=targets[0];
    const target=battle.fighters[targetIndex];
    if(["insurance","signal"].includes(ability.kind)&&
       (actor.side!=="ally"||target.side!=="ally"||actor.id===target.id))
      return false;
    const combat2SelectedHelper=ability.combat2Assist?combat2Helper(battle,actor,combat2HelperIndex):null;
    if(ability.combat2Assist&&!combat2ValidAssist(battle,actor,target,combat2SelectedHelper))return false;
    if(ability.combat2Signal&&combat2Cap(target.meter,ability.signalMeter+(actor.combat2Boost??0))<=target.meter)return false;
    const trustCover=ability.combat2Cover?trustCoverPreview(battle,actor,target):null;
    if(ability.combat2Cover&&!trustCover)return false;
    const type=ability.kind==="damage"?AbilityData.damageType(ability):null;
    if(type&&type!=="legacy"&&!validTypedTarget(target,type))return false;
    if(ability.kind==="damage"&&!validHitProfile(battle,actor,[target],type))return false;
    if(ability.kind==="damage"&&!validCriticalProfile(battle,actor,[target],type))return false;
    if(ability.kind==="damage"&&!validPenetrationProfile(battle,actor,type))return false;
    if(!validStatusProfile(battle,actor,[target],ability,type))return false;
    if(!validCombinedRngBudget(battle,ability,[target],type))return false;
    // Invalid commands leave the previous event batch untouched.
    if(actor.side==="ally"){battle.allyActions++;battle.events=[];}
    if(!consumeReadMoveMitigation(battle,actor,readMovePenalty))return false;
    emit(battle,"ability",{actorId:actor.id,targetId:target.id,abilityId:ability.id});
    if(plan){
      battle.trustPlanUsed=true;
      emit(battle,"trust-plan",{actorId:actor.id,partnerId:plan.partnerId,targetId:target.id});
    }
    if(ability.combat2Cover){
      for(const row of trustCover.rows){
        const recipient=battle.fighters.find(f=>f.id===row.id);
        recipient.guardHits=row.guardHits;recipient.protection+=row.restored;delete recipient.insurance;
        emit(battle,"effect",{actorId:actor.id,targetId:recipient.id,effect:"guard",stacks:recipient.guardHits});
        if(trustCover.mode==="standard")emit(battle,"combat2-protection",{actorId:actor.id,targetId:recipient.id,amount:row.restored});
      }
      if(trustCover.mode!=="standard")emit(battle,"trust-technique",{actorId:actor.id,targetId:target.id,mode:trustCover.mode,recipients:trustCover.rows.map(row=>row.id)});
      battle.message=actor.name+" прикрывает "+target.name+".";
    }else if(ability.combat2Signal){
      combat2Grant(battle,actor,target,ability.signalMeter+(actor.combat2Boost??0),"signal");
      delete actor.combat2Boost;
      battle.message=actor.name+" передаёт сигнал "+target.name+".";
    }else if(ability.kind==="insurance"){
      target.insurance={ownerId:actor.id,percent:ability.insurancePercent,
       remaining:ability.insuranceTurns,afterMeter:ability.afterInterceptMeter??0};
      emit(battle,"effect",{actorId:actor.id,targetId:target.id,
       effect:"insurance",remaining:ability.insuranceTurns});
      battle.message=actor.name+" страхует "+target.name+".";
    }else if(ability.kind==="signal"){
      target.fieldSignal={ownerId:actor.id,remaining:ability.signalTurns};
      target.meter=Math.min(1000,target.meter+ability.signalMeter);
      emit(battle,"effect",{actorId:actor.id,targetId:target.id,
       effect:"field-signal",remaining:ability.signalTurns});
      battle.message=actor.name+" передаёт сигнал "+target.name+".";
    }else if(ability.kind==="guard"){
      target.guardHits=ability.guardHits;
      emit(battle,"effect",{actorId:actor.id,targetId:target.id,effect:"guard",stacks:ability.guardHits});
      battle.message=actor.name+" защищает "+target.name+": защита ×"+ability.guardHits+".";
    }else if(ability.kind==="heal"){
      const restored=Math.min(ability.healAmount,Math.max(0,target.maxHp-target.hp));
      target.hp+=restored;
      emit(battle,"heal",{actorId:actor.id,targetId:target.id,amount:restored,remainingHp:target.hp});
      battle.message=actor.name+" лечит "+target.name+": +"+restored+" HP.";
    }else if(!rollToHit(battle,actor,target,type,readMovePenalty)){
      if(actor.weakenAttacks>0)actor.weakenAttacks--;
      battle.message=actor.name+" промахивается по "+target.name+".";
    }else{
      const oldHp=target.hp,oldProtection=target.protection??null;
      const baseDamage=tacticalDamageBonus(battle,actor,target,
       bonusDamage(battle,actor,target,
        Math.round(effectiveStat(battle,actor,damageStat)*ability.multiplier)));
      const damage=dealDamage(actor,target,
        reducedReadMoveDamage(rollCriticalDamage(battle,actor,target,baseDamage,type),readMovePenalty),true,type,
        penetrationEnabled(battle,type)?actor.defensePenetration:0,battle,
        ability.target==="enemy");
      emit(battle,"damage",{actorId:actor.id,targetId:target.id,amount:damage,remainingHp:target.hp,
        ...typedDamageFields(target,type,oldHp,oldProtection)});
      if(target.hp===0)emit(battle,"death",{targetId:target.id});
      if(ability.weakening>0&&target.hp>0)
        applyNegativeStatus(battle,actor,target,ability.weakening,type,readMovePenalty);
      applyOnHitStatus(battle,actor,target,ability,readMovePenalty);
      applyAreaStatusAfterHit(battle,actor,ability,readMovePenalty);
      if(ability.disruptTurns&&target.hp>0&&typeof CombatStatusCore!=="undefined"&&
         CombatStatusCore.apply(target,"disrupted-plan",0,ability.disruptTurns)){
        target.tacticalDisruptDelay=ability.disruptDelay??0;
        emit(battle,"effect",{actorId:actor.id,targetId:target.id,
         effect:"disrupted-plan",remaining:ability.disruptTurns});
      }
      if(actor.tacticalFocus?.enemyId===target.id&&actor.tacticalFocus.delay>0){
        target.meter=Math.max(0,target.meter-actor.tacticalFocus.delay);
        emit(battle,"tactical-delay",{actorId:actor.id,targetId:target.id,
         amount:actor.tacticalFocus.delay});
      }
      battle.message=actor.side==="enemy"&&ability.id==="basic"
        ? actor.name+" атакует "+target.name+": "+damage+" урона."
        : actor.name+(ability.id!=="basic"?" применяет "+ability.name+": ":" атакует: ")+
          target.name+" получает "+damage+" урона"+
          (target.hp===0?" — повержен!":
            ability.weakening>0&&(!statusCheckEnabled(battle,type)||battle.events.some(event=>
              event.type==="effect"&&event.effect==="weaken"&&
              event.actorId===actor.id&&event.targetId===target.id))?
              ", ослабление ×"+ability.weakening+".":".");
    }
    if(ability.combat2Assist)combat2Assist(battle,actor,target,combat2SelectedHelper,ability);
    if(ability.kind!=="damage"||!hitCheckEnabled(battle,type)||
      !battle.events.some(event=>event.type==="miss"&&event.actorId===actor.id&&event.targetId===target.id))
      applyFollowUpEffects(battle,actor,ability,[target],target,type,readMovePenalty);
    // Apply before the ordinary end-of-action tick; +1 keeps two subsequent
    // own turns of provocation after the casting turn.
    if(ability.tauntTurns!==undefined&&typeof CombatStatusCore!=="undefined"){
      CombatStatusCore.apply(actor,"taunt",0,ability.tauntTurns+1);
      emit(battle,"effect",{actorId:actor.id,targetId:actor.id,
        effect:"taunt",remaining:ability.tauntTurns});
    }
    finishAbilityCooldowns(actor,ability);
    finishDisruption(battle,actor,ability,disruption);
    InitiativeModel.finishTurn(battle.fighters,actor.id);
    finishTacticalAction(battle,actor,ability,battle.fighters[primaryIndex]);
    tickActorStatuses(actor);
    battle.turn++;
    battle.currentActor=-1;
    if(finishIfOver(battle))return true;
    if(actor.side==="ally"){
      if(ability.target==="enemy"&&target.hp===0)
        battle.selectedEnemy=firstLivingEnemy(battle.fighters);
      advanceToPlayerTurn(battle);
    }
    return true;
  }

  // Legacy manual and auto APIs use the same core executor.
  function performPlayerAbility(battle,abilityId){
    const combat2HelperIndex=arguments[2];
    if(!abilityReady(battle,abilityId))return false;
    const mode=abilityTargetSide(battle,abilityId);
    const primary=mode==="self"?battle.currentActor:
      mode==="ally"||mode==="all-allies"?battle.selectedAlly:battle.selectedEnemy;
    return performActorAbility(battle,abilityId,primary,combat2HelperIndex);
  }

  // Combat-015B: apply a read-only tactical proposal using the same command
  // path as manual abilities. The optional argument keeps Combat-004 callers
  // compatible (basic attack against the first living enemy).
  function performAutoAction(battle, plan) {
    if (!battle || !battle.active || !abilityReady(battle, "basic")) return false;
    if (plan && ["basic", "special", "powerful"].includes(plan.abilityId) &&
        abilityReady(battle, plan.abilityId)) {
      const mode = abilityTargetSide(battle, plan.abilityId);
      const target = plan.targetIndex;
      const actor = battle.currentActor;
      const legal = Number.isInteger(target) &&
        (mode === "enemy" || mode === "all-enemies" ?
          selectEnemy(battle.fighters, target) >= 0 :
         mode === "ally" ? selectAlly(battle.fighters, target) >= 0 :
         mode === "self" || mode === "all-allies" ? target === actor : false);
      if (legal) {
        if (mode === "enemy" || mode === "all-enemies") chooseEnemy(battle, target);
        else if (mode === "ally") chooseAlly(battle, target);
        if (performPlayerAbility(battle, plan.abilityId,plan.helperIndex)) return true;
      }
    }
    // A stale/unsupported decision must never leave autoplay stuck. This also
    // preserves the original no-plan Combat-004 behavior for legacy callers.
    const first = firstLivingEnemy(battle.fighters);
    return first >= 0 && chooseEnemy(battle, first) &&
      performPlayerAbility(battle, "basic");
  }

  // Backward-compatible basic attack API, including Combat-002 regression tests.
  function performPlayerAttack(battle) {
    return performPlayerAbility(battle, "basic");
  }


  return Object.freeze({
    createBattle, livingEnemies, selectEnemy, firstLivingEnemy,
    chooseEnemy, chooseAlly, specialName, abilityTargetSide, advanceToPlayerTurn, performPlayerAttack, performPlayerAbility, abilityReady, performAutoAction, activeEffects, abilityTargetIndices, actorTargetIndices, actorAbilityReady, performActorAbility,
    activePassiveModifiers, activeLeaderModifiers, effectiveStat, previewSignal, trustCoverPreview, trustPlanPreview
  });
})();