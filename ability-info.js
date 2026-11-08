/* Abilities-UI-001: read-only summaries of real AbilityData definitions.
   No gameplay math, no skill-level system, no inferred hero identities. */
const AbilityInfo=(()=>{
 "use strict";
 const SLOTS=Object.freeze([
  Object.freeze({id:"basic",label:"Базовая"}),
  Object.freeze({id:"special",label:"Особая"}),
  Object.freeze({id:"powerful",label:"Мощная"}),
  Object.freeze({id:"passive",label:"Пассивная"}),
  Object.freeze({id:"leader",label:"Лидерская"})
 ]);
 const TARGET=Object.freeze({
  ally:"один союзник",enemy:"один противник",self:"сам герой",
  "all-allies":"все живые союзники","all-enemies":"все живые противники"
 });
 function format(actor,slotId){
  const slot=SLOTS.find(x=>x.id===slotId);
  if(!slot||typeof AbilityData==="undefined")return null;
  const a=AbilityData.get(actor,slotId);
  if(!a)return {id:slot.id,label:slot.label,name:"Не назначена",
   status:"not-assigned",description:slotId==="leader"?
    "Лидерская способность этому демонстрационному герою не назначена.":
    "Способность пока не определена.",meta:[]};
  if(slotId==="passive"){
   const hasCombatRules=!!a.combatRules;
   const hasEffects=!!(a.triggers?.length||a.modifiers?.length||hasCombatRules);
   const rules=a.combatRules;
   const detail=hasCombatRules?
    "Проба: +"+rules.bonusVsDebuffedPercent+"% урона по цели с ослаблением, "+
    "+"+rules.statusPotencyWithoutResistanceDown+" п.п. эффективности наложения "+
    "без пониженного сопротивления у цели и +"+rules.tagDamagePercent+
    "% урона союзникам с подходящим тегом. Числа тестовые.":
    "Автоматическая способность. Подробное действие уточняется.";
   return {id:slot.id,label:slot.label,name:hasEffects?a.name:"Не определена",
    status:hasEffects?"available":"not-defined",
    description:hasEffects?detail:
     "Пассивная способность предусмотрена, но эффект этому герою пока не назначен.",
    meta:[]};
  }
  if(slotId==="leader"){
   return {id:slot.id,label:slot.label,name:a.name,status:"available",
    description:"Автоматический лидерский эффект. Подробное действие уточняется.",meta:[]};
  }
  const effects=[];
  if(a.kind==="damage"){
   const percent=Number.isFinite(a.multiplier)?Math.round(a.multiplier*100):null;
   if(percent!==null)effects.push("Наносит "+percent+"% от действующей атаки.");
   else effects.push("Наносит урон.");
   if(a.weakening>0)effects.push("Ослабляет противника на "+a.weakening+" атаки.");
    if(a.onHitStatus?.type==="slowed")effects.push("Замедление: -"+a.onHitStatus.amount+"% скорости на "+a.onHitStatus.turns+" собственных хода цели (тестовый баланс).");
  }else if(a.kind==="guard"){
   if(Number.isFinite(a.guardHits))effects.push("Даёт защиту от "+a.guardHits+" ударов.");
   else effects.push("Даёт защиту.");
  }else if(a.kind==="heal"){
   if(Number.isFinite(a.healAmount))effects.push("Восстанавливает до "+a.healAmount+" HP.");
   else effects.push("Восстанавливает здоровье.");
  }else effects.push("Действие способности пока не описано.");
  const meta=["Цель: "+(TARGET[a.target]||"не указана")];
  if(Number.isInteger(a.cooldown)&&a.cooldown>0)meta.push("Перезарядка: "+a.cooldown+" собственных действия героя");
  if(a.damageType==="physical")meta.push("Физический урон");
  if(a.damageType==="magical")meta.push("Магический урон");
  return {id:slot.id,label:slot.label,name:a.name,status:"available",
   description:effects.join(" "),meta};
 }
 const forHero=hero=>SLOTS.map(slot=>format(hero,slot.id));
 return Object.freeze({SLOTS,format,forHero});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=AbilityInfo;
