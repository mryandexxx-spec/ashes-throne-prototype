/* Ability-001: demo definitions only; final ability balance remains TBD in GDD. */
const AbilityData=(()=>{
 "use strict";
 const basic=Object.freeze({id:"basic",name:"Базовая атака",target:"enemy",kind:"damage",multiplier:1,cooldown:0,weakening:0});
 const special={
  kael:Object.freeze({id:"special",name:"Прикрытие",target:"ally",kind:"guard",guardHits:2,cooldown:2}),
  lyra:Object.freeze({id:"special",name:"Ослабляющий удар",target:"enemy",kind:"damage",multiplier:1,weakening:2,cooldown:2}),
  darin:Object.freeze({id:"special",name:"Сокрушительный удар",target:"enemy",kind:"damage",multiplier:1.5,weakening:0,cooldown:2}),
  "medic-demo":Object.freeze({id:"special",name:"Перевязка",target:"ally",kind:"heal",healAmount:30,cooldown:2}),
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
 function get(actor,abilityId){
  if(abilityId==="basic")return basic;
  if(!actor)return null;
  if(abilityId==="powerful")return powerful[actor.id]||null;
  if(abilityId==="passive")return Object.prototype.hasOwnProperty.call(passiveByHero,actor.id)?passiveByHero[actor.id]:null;
  if(abilityId==="leader")return Object.prototype.hasOwnProperty.call(leaderByHero,actor.id)?leaderByHero[actor.id]:null;
  if(abilityId!=="special")return null;
  return Object.prototype.hasOwnProperty.call(special,actor.id)?special[actor.id]:fallback;
 }
 return Object.freeze({get});
})();
