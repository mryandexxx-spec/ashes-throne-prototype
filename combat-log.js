/* Combat-Log-001: presentation-only formatting of the latest combat event batch. */
const CombatLog=(()=>{
 "use strict";
 function lines(events,fighters){
  const byId=new Map(fighters.map(f=>[f.id,f.name]));
  const name=id=>byId.get(id)||id||"Неизвестный боец";
  return events.map(e=>{
   switch(e.type){
    case "ability":{
     const actor=fighters.find(f=>f.id===e.actorId);
     const title=e.abilityId==="special" ? AbilityData.get(actor,"special")?.name||"Особая" : "Базовая атака";
     return name(e.actorId)+": "+title+" → "+name(e.targetId);
    }
    case "damage":return name(e.targetId)+": −"+e.amount+" HP (осталось "+e.remainingHp+")";
    case "effect":return name(e.targetId)+": "+(e.effect==="guard"?"Защита":e.effect==="weaken"?"Ослабление":e.effect)+" ×"+e.stacks;
    case "death":return name(e.targetId)+": повержен";
    case "wave-start":return "Волна " + e.wave + "/" + e.total + ": новые противники";
    case "battle-end":return e.winner==="ally"?"Победа отряда":"Поражение отряда";
    default:return "";
   }
  }).filter(Boolean);
 }
 return Object.freeze({lines});
})();
