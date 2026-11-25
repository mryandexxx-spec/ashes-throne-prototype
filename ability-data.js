/* Ability-001: demo definitions only; final ability balance remains TBD in GDD. */
const AbilityData=(()=>{
 "use strict";
 const basic=Object.freeze({id:"basic",name:"Базовая атака",target:"enemy",kind:"damage",multiplier:1,cooldown:0,weakening:0});
 const typedBasic=Object.freeze({...basic,damageType:"physical"});
 const special={
  kael:Object.freeze({id:"special",name:"Прикрытие",target:"ally",kind:"guard",guardHits:2,cooldown:2}),
  lyra:Object.freeze({id:"special",name:"Ослабляющий удар",target:"enemy",kind:"damage",multiplier:1,weakening:2,cooldown:2}),
  darin:Object.freeze({id:"special",name:"Сокрушительный удар",target:"enemy",kind:"damage",multiplier:1.5,weakening:0,cooldown:2}),
  "medic-demo":Object.freeze({id:"special",name:"Перевязка",target:"ally",kind:"heal",healAmount:30,cooldown:2}),
  // STORY-002: noncanonical test skills, NOT a claim of combat competence in stories.
  ren:Object.freeze({id:"special",name:"Найти брешь",target:"enemy",kind:"damage",damageType:"physical",multiplier:1.05,weakening:2,cooldown:2}),
  "trial-ren":Object.freeze({id:"special",name:"Найти брешь · проба",target:"enemy",kind:"damage",multiplier:1,weakening:2,cooldown:2}),
  // NADA-PLAYABLE-001: provisional physical support abilities, not literary canon.
  nada:Object.freeze({id:"special",name:"Найти закономерность",target:"enemy",kind:"damage",damageType:"physical",multiplier:.7,weakening:0,cooldown:2,
   onHitStatus:Object.freeze({type:"read-move",stacks:2,turns:2})}),
  // LIORAPLAY001: unarmed test pilot; not canonical combat techniques.
  liora:Object.freeze({id:"special",name:"Под прикрытием",target:"self",kind:"guard",guardHits:2,tauntTurns:2,cooldown:2}),
  // ARTSAVASKILLS001: ordinary physical fieldwork, no magic or canon weapon.
  art:Object.freeze({id:"special",name:"Страховочный узел",target:"ally",
   kind:"insurance",insurancePercent:40,insuranceTurns:2,cooldown:2}),
  sava:Object.freeze({id:"special",name:"Передать сигнал",target:"ally",
   kind:"signal",signalMeter:200,signalTurns:2,cooldown:2}),
  "trial-nada":Object.freeze({id:"special",name:"Выверенное действие · проба",target:"enemy",kind:"damage",multiplier:.8,weakening:2,cooldown:2}),
  "trial-liora":Object.freeze({id:"special",name:"Прикрыть товарища · проба",target:"ally",kind:"guard",guardHits:2,cooldown:2}),
  // Combat-011B regression fixtures: not in HEROES or campaign content.
  "test-self-guard":Object.freeze({id:"special",name:"Тест защиты себя",target:"self",kind:"guard",guardHits:2,cooldown:2}),
  "test-team-heal":Object.freeze({id:"special",name:"Тест группового лечения",target:"all-allies",kind:"heal",healAmount:30,cooldown:2}),
  "test-area-damage":Object.freeze({id:"special",name:"Учебный широкий удар",target:"all-enemies",kind:"damage",multiplier:1,weakening:0,cooldown:2}),
  "test-area-weaken":Object.freeze({id:"special",name:"Тест группового ослабления",target:"all-enemies",kind:"damage",multiplier:1,weakening:2,cooldown:2}),
  // Combat-012C fixtures: follow-up statuses are described by data, not hero ID.
  "test-primary-bonus":Object.freeze({id:"special",name:"Тест основной цели",target:"all-enemies",
   kind:"damage",multiplier:1,weakening:0,cooldown:2,
   followUpEffects:Object.freeze([Object.freeze({scope:"primary",status:"weaken",stacks:2})])}),
  "test-composed-effects":Object.freeze({id:"special",name:"Тест составных эффектов",target:"all-enemies",
   kind:"damage",multiplier:1,weakening:0,cooldown:2,
   followUpEffects:Object.freeze([
    Object.freeze({scope:"primary",status:"weaken",stacks:2}),
    Object.freeze({scope:"self",status:"guard",stacks:1})
   ])}),
  "test-all-followups":Object.freeze({id:"special",name:"Тест всех получателей",target:"all-enemies",
   kind:"damage",multiplier:1,weakening:0,cooldown:2,
   followUpEffects:Object.freeze([Object.freeze({scope:"all",status:"weaken",stacks:1})])})
 };
 // Stats-001B: typed examples are regression-only; not assigned to campaign heroes.
 special["test-physical-strike"]=Object.freeze({id:"special",name:"Тест физического удара",
  target:"enemy",kind:"damage",damageType:"physical",multiplier:1,weakening:0,cooldown:2});
 special["test-magical-strike"]=Object.freeze({id:"special",name:"Тест магического удара",
  target:"enemy",kind:"damage",damageType:"magical",multiplier:1,weakening:0,cooldown:2});
 special["test-magical-group"]=Object.freeze({id:"special",name:"Тест групповой магии",
  target:"all-enemies",kind:"damage",damageType:"magical",multiplier:1,weakening:0,cooldown:2});
 Object.freeze(special);
 // Combat-012A: engine-only fixture, deliberately absent from the playable HEROES.
 const powerful=Object.freeze({
  // Combat-012B: noncanonical demonstration skills for every playable ally.
  kael:Object.freeze({id:"powerful",name:"Учебный бастион",target:"self",kind:"guard",guardHits:3,cooldown:2}),
  lyra:Object.freeze({id:"powerful",name:"Учебная метка",target:"enemy",kind:"damage",multiplier:1.5,weakening:2,cooldown:2}),
  darin:Object.freeze({id:"powerful",name:"Учебный натиск",target:"enemy",kind:"damage",multiplier:2,weakening:0,cooldown:2}),
  "medic-demo":Object.freeze({id:"powerful",name:"Учебное исцеление отряда",target:"all-allies",kind:"heal",healAmount:25,cooldown:2}),
  "test-powerful-damage":Object.freeze({id:"powerful",name:"Тест мощного удара",target:"enemy",
   kind:"damage",multiplier:1.5,weakening:0,cooldown:2}),
  // STORY-002: experimental powerful actions, not canon.
  ren:Object.freeze({id:"powerful",name:"Сорвать построение",target:"enemy",kind:"damage",damageType:"physical",multiplier:1.6,weakening:0,cooldown:3}),
  "trial-ren":Object.freeze({id:"powerful",name:"Сорвать построение · проба",target:"enemy",kind:"damage",multiplier:1.6,weakening:0,cooldown:2,
   // Temporary REN-COMBAT-D pilot numbers, NOT approved balance or canon.
   followUpStatusAll:Object.freeze({type:"debuff-resistance-down",amount:15,turns:2})}),
  nada:Object.freeze({id:"powerful",name:"Разгадать замысел",target:"all-enemies",kind:"damage",damageType:"physical",multiplier:.6,weakening:0,cooldown:3,
   onHitStatus:Object.freeze({type:"read-move",stacks:2,turns:2})}),
  liora:Object.freeze({id:"powerful",name:"Держать строй",target:"all-allies",kind:"guard",guardHits:2,cooldown:3}),
  // ARTSAVASKILLS001: Art disrupts a follow-up; Sava opens one bounded two-person chain.
  art:Object.freeze({id:"powerful",name:"Снять нагрузку",target:"enemy",
   kind:"damage",damageType:"physical",multiplier:1.05,weakening:0,disruptTurns:2,cooldown:3}),
  sava:Object.freeze({id:"powerful",name:"Согласованный шаг",target:"self",
   kind:"coordinate",windowActions:4,coordinationDamagePercent:12,
   coordinationMeter:100,cooldown:3}),
  "trial-nada":Object.freeze({id:"powerful",name:"Слабое место · проба",target:"enemy",kind:"damage",multiplier:1.25,weakening:2,cooldown:2}),
  "trial-liora":Object.freeze({id:"powerful",name:"Удержать позицию · проба",target:"self",kind:"guard",guardHits:3,cooldown:2}),
  // Combat-012B: same temporary parameters for the existing optional demo fighter.
  "test-area-damage":Object.freeze({id:"powerful",name:"Учебный мощный удар",target:"enemy",
   kind:"damage",multiplier:1.5,weakening:0,cooldown:2})
 });
 // Combat-013A: all playable allies have a passive slot. No effects assigned
 // until individual hero identity and synergy design is approved.
 const passiveEmpty=Object.freeze({id:"passive",name:"Пассивная способность (не определена)",
  triggers:Object.freeze([]),modifiers:Object.freeze([])});
 const passiveByHero=Object.freeze({
  kael:passiveEmpty,lyra:passiveEmpty,darin:passiveEmpty,
  "medic-demo":passiveEmpty,"test-area-damage":passiveEmpty,
  ren:Object.freeze({id:"passive",name:"Чувство тропы",
   triggers:Object.freeze([]),modifiers:Object.freeze([]),
   combatRules:Object.freeze({readMoveBonusPercentPerStack:12,
    gardensTagId:"gardens-over-abyss",gardensEvasionBonus:8})}),
  "trial-ren":Object.freeze({id:"passive",name:"Чувство тропы · проба",
   triggers:Object.freeze([]),modifiers:Object.freeze([]),
   // REN-COMBAT-C: technical percentages from REN-001; NOT approved balance.
   combatRules:Object.freeze({
    bonusVsDebuffedPercent:15,
    tagId:"gardens-over-abyss",tagDamagePercent:5,
    statusPotencyWithoutResistanceDown:10
   })}),
  nada:Object.freeze({id:"passive",name:"Внимание к деталям",triggers:Object.freeze([]),modifiers:Object.freeze([]),
   combatRules:Object.freeze({gardensTagId:"gardens-over-abyss",gardensAccuracyBonus:8})}),
  // LIORA001: [PROPOSAL] reaction guard for a wounded ally (not Liora herself).
  liora:Object.freeze({id:"passive",name:"Ответственность за своих",
   triggers:Object.freeze([]),modifiers:Object.freeze([]),
   combatRules:Object.freeze({protectAllyBelowHpPercent:35,
    protectAllyGuardHits:1,protectAllyCooldownOwnTurns:3})}),
  art:Object.freeze({id:"passive",name:"Знать предел",
   triggers:Object.freeze([]),modifiers:Object.freeze([]),
   combatRules:Object.freeze({insuranceFocusPercent:12,insuranceFocusDelay:0})}),
  sava:Object.freeze({id:"passive",name:"Заметить вовремя",
   triggers:Object.freeze([]),modifiers:Object.freeze([]),
   combatRules:Object.freeze({coordinationCooldownRecovery:1,coordinationTempo:0})}),
  "trial-nada":passiveEmpty,"trial-liora":passiveEmpty,
  // Nonplayable fixtures verify automatic trigger registration and ownership.
  "test-passive-attacker":Object.freeze({id:"passive",name:"Тест реакции атакующего",
   triggers:Object.freeze([Object.freeze({event:"damage",role:"actor"})])}),
  "test-passive-defender":Object.freeze({id:"passive",name:"Тест реакции получателя",
   triggers:Object.freeze([Object.freeze({event:"damage",role:"target"})])}),
  "test-passive-both":Object.freeze({id:"passive",name:"Тест двух реакций",
   triggers:Object.freeze([Object.freeze({event:"damage",role:"actor"}),
    Object.freeze({event:"damage",role:"target"})])}),
  // Read-only modifiers: no combat stat computation changes in Combat-013A.
  "test-passive-always":Object.freeze({id:"passive",name:"Тест постоянного бонуса",
   triggers:Object.freeze([]),modifiers:Object.freeze([
    Object.freeze({stat:"atk",operation:"flat",value:5,when:Object.freeze({kind:"always"})})
   ])}),
  "test-passive-conditional":Object.freeze({id:"passive",name:"Тест условного бонуса",
   triggers:Object.freeze([]),modifiers:Object.freeze([
    Object.freeze({stat:"atk",operation:"flat",value:7,
     when:Object.freeze({kind:"hp-below-percent",percent:50})})
   ])}),
  // Combat-013B: technical effects are never assigned to playable HEROES.
  "test-passive-speed":Object.freeze({id:"passive",name:"Тест скорости",
   triggers:Object.freeze([]),modifiers:Object.freeze([
    Object.freeze({stat:"speed",operation:"flat",value:50,
     when:Object.freeze({kind:"always"})})
   ])}),
  "test-passive-combined":Object.freeze({id:"passive",name:"Тест совместных бонусов",
   triggers:Object.freeze([]),modifiers:Object.freeze([
    Object.freeze({stat:"atk",operation:"flat",value:3,
     when:Object.freeze({kind:"always"})}),
    Object.freeze({stat:"atk",operation:"flat",value:7,
     when:Object.freeze({kind:"hp-below-percent",percent:50})})
   ])}),
  "test-passive-healer":Object.freeze({id:"passive",name:"Тест реакции лечения",
   modifiers:Object.freeze([]),triggers:Object.freeze([
    Object.freeze({event:"damage",role:"target",
     effect:Object.freeze({kind:"heal",target:"self",amount:12})})
   ])})
 });
 // Combat-014A: only nonplayable fixtures can be leaders until the owner
 // approves actual hero eligibility and leader effects.
 const leaderByHero=Object.freeze({
  // ARTSAVASKILLS001: situational regional synergy, no permanent combat-stat aura.
  art:Object.freeze({id:"leader",name:"Работа по риску",
   combatRules:Object.freeze({tagId:"gardens-over-abyss",insuranceAllyMeter:90})}),
  sava:Object.freeze({id:"leader",name:"Полевая координация",
   combatRules:Object.freeze({tagId:"gardens-over-abyss",coordinationAllyMeter:90})}),
  // LIORA001: [PROPOSAL] 10% of each ally's Protection while Liora leads and lives.
  liora:Object.freeze({id:"leader",name:"Опора отряда",
   modifiers:Object.freeze([Object.freeze({stat:"protection",operation:"percent",value:10,
    scope:"all-allies",when:Object.freeze({kind:"always"})})])}),
  "test-leader-aura":Object.freeze({id:"leader",name:"Тест ауры лидера",
   modifiers:Object.freeze([
    Object.freeze({stat:"atk",operation:"flat",value:4,scope:"all-allies",when:Object.freeze({kind:"always"})}),
    Object.freeze({stat:"speed",operation:"flat",value:20,scope:"all-allies",when:Object.freeze({kind:"always"})})
   ])}),
  "test-leader-self":Object.freeze({id:"leader",name:"Тест личного бонуса лидера",
   modifiers:Object.freeze([
    Object.freeze({stat:"atk",operation:"flat",value:9,scope:"self",when:Object.freeze({kind:"always"})})
   ])})
 });
 const fallback=Object.freeze({id:"special",name:"Особый удар",target:"enemy",kind:"damage",multiplier:1,weakening:0,cooldown:2});
 function rawGet(actor,abilityId){
  // NPCDATA001: only explicit non-recruitable enemy instances carry their
  // own abilities. Do not borrow an NPC kit for a player hero or legacy foe.
  if(actor?.side==="enemy"&&typeof actor.archetypeId==="string"&&
     actor.archetypeId.startsWith("npc-")&&actor.npcAbilities&&
     ["basic","special","powerful","passive"].includes(abilityId))
    return actor.npcAbilities[abilityId]??null;
  // Stats-002C pilot: only explicitly outfitted fighters use typed basic attacks.
  if(abilityId==="basic"){
   if(actor?.id==="nada")return Object.freeze({...typedBasic,name:"Прицельное действие",multiplier:.8,
    onHitStatus:Object.freeze({type:"read-move",stacks:1,turns:2})});
   if(actor?.id==="liora")return Object.freeze({...typedBasic,name:"Удар щитом"});
   if(actor?.id==="art")return Object.freeze({...typedBasic,name:"Сбить шаг",multiplier:1,
     fieldNote:"После реальной Страховки следующий удар по нападавшему получает усиление Собранности."});
   if(actor?.id==="sava")return Object.freeze({...typedBasic,name:"Отметить момент",
    multiplier:.65,nextAllyMeter:70,
    fieldNote:"После действия следующий союзник Садов получает ускорение инициативы; бесплатных ходов нет."});
   // REN-COMBAT-B: story-only temporary skill level; no v3 progression.
   if(actor?.id==="trial-ren"||actor?.id==="ren"){
    const level=actor.skillLevels?.basic;
    return Object.freeze({...basic,...(actor.id==="ren"?{damageType:"physical"}:{}),
     name:actor.id==="ren"?"Точный удар":"Точный удар · проба",
     ...(actor.id==="trial-ren"&&Number.isInteger(level)&&level>=4&&level<=6?
      {onHitStatus:Object.freeze({type:"slowed",amount:20,turns:2})}:{})});
   }
   return actor?.combatProfile==="stats002c"?typedBasic:basic;
  }
  if(!actor)return null;
  if(abilityId==="powerful"){
   const ability=powerful[actor.id]||null;
   return ability&&actor.combatProfile==="stats002c"&&
     ["lyra","darin","ren"].includes(actor.id)?{...ability,damageType:"physical"}:ability;
  }
  if(abilityId==="passive")return Object.prototype.hasOwnProperty.call(passiveByHero,actor.id)?passiveByHero[actor.id]:null;
  if(abilityId==="leader")return Object.prototype.hasOwnProperty.call(leaderByHero,actor.id)?leaderByHero[actor.id]:null;
  if(abilityId!=="special")return null;
  const ability=Object.prototype.hasOwnProperty.call(special,actor.id)?special[actor.id]:fallback;
  return actor.combatProfile==="stats002c"&&["lyra","darin","ren"].includes(actor.id)?
    {...ability,damageType:"physical"}:ability;
 }
 // A leveled playable hero carries an immutable battle snapshot of skillLevels.
 // Other fixtures and unupgraded actors continue to use the original data.
 // Experimental rules, selected only on a native CombatCore battle snapshot.
 function combat2Ability(actor,id,base){
  if(!base)return base;
  if(id==="leader"&&["art","sava"].includes(actor.id))return null;
  if(actor.id==="art"){
   if(id==="basic")return {...base,fieldNote:"Одиночная атака."};
   if(id==="special")return {...base,combat2Cover:true,fieldNote:"Даёт заряд защиты и восстанавливает защиту другого союзника."};
   if(id==="passive")return {...base,combatRules:{combat2PreparedGuard:true}};
  }
  if(actor.id!=="sava")return base;
  const level=actor.skillLevels?.[id],i=Number.isInteger(level)&&level>=1&&level<=6?level-1:0;
  const curve=values=>values[i];
  if(id==="basic")return {...base,multiplier:curve([.75,.78,.82,.85,.88,.92]),nextAllyMeter:curve([50,55,60,65,70,75]),fieldNote:"Ускоряет ближайшего другого неготового союзника."};
  if(id==="special")return {...base,signalMeter:curve([250,260,270,280,290,300]),signalTurns:1,cooldown:2,combat2Signal:true};
  if(id==="powerful")return {id,name:base.name,kind:"damage",target:"enemy",damageType:"physical",multiplier:curve([.8,.82,.84,.86,.88,.9]),cooldown:3,weakening:0,combat2Assist:curve([.5,.52,.54,.56,.58,.6])};
  if(id==="passive")return {...base,combatRules:{combat2Boost:curve([50,55,60,65,70,80])}};
  return base;
 }
 function get(actor,abilityId){
  const ability=rawGet(actor,abilityId);
  if(actor?.side==="ally"&&actor.combat2===true){
   const base=typeof SkillCore!=="undefined"?SkillCore.apply(ability,actor,abilityId):ability;
   return combat2Ability(actor,abilityId,base);
  }
  return typeof SkillCore!=="undefined"?SkillCore.apply(ability,actor,abilityId):ability;
 }
 // Missing damageType is explicitly legacy: its historical general atk
 // calculation is preserved, NOT silently labelled as physical or magical.
 function damageStat(ability){
  if(!ability||ability.kind!=="damage")return null;
  if(ability.damageType===undefined)return "atk";
  if(ability.damageType==="physical")return "physicalAttack";
  if(ability.damageType==="magical")return "magicAttack";
  return null; // Explicit but unknown type must not fall back to atk.
 }
 function damageType(ability){
  const stat=damageStat(ability);
  return stat==="atk"?"legacy":stat==="physicalAttack"?"physical":stat==="magicAttack"?"magical":null;
 }
 return Object.freeze({get,damageStat,damageType});
})();
