/* Ability-001: demo definitions only; final ability balance remains TBD in GDD. */
const AbilityData=(()=>{
 "use strict";
 const basic=Object.freeze({id:"basic",name:"Базовая атака",target:"enemy",kind:"damage",multiplier:1,cooldown:0,weakening:0});
 const special={
  kael:Object.freeze({id:"special",name:"Прикрытие",target:"ally",kind:"guard",guardHits:2,cooldown:2}),
  lyra:Object.freeze({id:"special",name:"Ослабляющий удар",target:"enemy",kind:"damage",multiplier:1,weakening:2,cooldown:2}),
  darin:Object.freeze({id:"special",name:"Сокрушительный удар",target:"enemy",kind:"damage",multiplier:1.5,weakening:0,cooldown:2})
 };
 Object.freeze(special);
 const fallback=Object.freeze({id:"special",name:"Особый удар",target:"enemy",kind:"damage",multiplier:1,weakening:0,cooldown:2});
 function get(actor,abilityId){
  if(abilityId==="basic")return basic;
  if(abilityId!=="special"||!actor)return null;
  return Object.prototype.hasOwnProperty.call(special,actor.id)?special[actor.id]:fallback;
 }
 return Object.freeze({get});
})();
