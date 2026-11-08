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
     const title=e.abilityId==="basic"?"Базовая атака":
      AbilityData.get(actor,e.abilityId)?.name||"Неизвестная способность";
     return name(e.actorId)+": "+title+" → "+(Array.isArray(e.targetIds)&&e.targetIds.length>1?e.targetIds.map(name).join(", "):name(e.targetId));
    }
    // Stats-001D1: miss is an explicit event, never fake zero HP damage.
    case "miss":return name(e.actorId)+": промах по "+name(e.targetId);
    case "critical":return name(e.actorId)+": критический удар по "+name(e.targetId)+" (×"+(e.multiplierPercent/100)+")";
    case "damage":
     if(e.damageType&&Number.isFinite(e.hpDamage)&&Number.isFinite(e.protectionDamage))
      return name(e.targetId)+": −"+e.hpDamage+" HP"+
       (e.protectionDamage>0?", −"+e.protectionDamage+" Protection":"")+
       " (осталось "+e.remainingHp+" HP"+
       (e.remainingProtection!==null?", "+e.remainingProtection+" Protection":"")+")";
     return name(e.targetId)+": −"+e.amount+" HP (осталось "+e.remainingHp+")";
    case "heal":return name(e.targetId)+": +"+e.amount+" HP (теперь "+e.remainingHp+")";
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
