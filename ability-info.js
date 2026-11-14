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
   const detail=!hasCombatRules?
    "Автоматическая способность. Подробное действие уточняется.":
    Number.isFinite(rules.readMoveBonusPercentPerStack)?
     "Рен наносит +"+rules.readMoveBonusPercentPerStack+
      "% урона за каждую зацепку «Просчитанного хода» на цели (до 4). "+
      "Пока Рен жив, союзники с тегом Садов получают +"+rules.gardensEvasionBonus+
      " п.п. уклонения. Прочие дебаффы не дают Рену бонусного урона.":
    Number.isFinite(rules.gardensAccuracyBonus)?
     "Пока Нада жива, союзники с тегом Садов получают +"+
      rules.gardensAccuracyBonus+" п.п. точности. "+
      "«Просчитанный ход» накапливается до 4 зацепок; от 3 зацепок "+
      "особая или мощная атака врага сохраняется, но получает −20 п.п. точности, −20 п.п. эффективности наложения эффектов и −30% урона; расходует 3 зацепки.":
    Number.isFinite(rules.protectAllyBelowHpPercent)?
     "Когда здоровье другого союзника после получения урона падает до "+
      rules.protectAllyBelowHpPercent+"% или ниже, Лиора даёт защиту от "+
      rules.protectAllyGuardHits+" следующего удара (или ударов). Перезарядка: "+
      rules.protectAllyCooldownOwnTurns+" собственных хода Лиоры. Тестовые значения.":
    Number.isFinite(rules.allyBonusVsDebuffedPercent)?
     "Пока герой жив, союзники наносят +"+rules.allyBonusVsDebuffedPercent+
      "% урона врагам с действующими негативными эффектами. Числа тестовые.":
     "Проба: +"+rules.bonusVsDebuffedPercent+"% урона по цели с ослаблением, "+
      "+"+rules.statusPotencyWithoutResistanceDown+" п.п. эффективности наложения "+
      "без пониженного сопротивления у цели и +"+rules.tagDamagePercent+
      "% урона союзникам с подходящим тегом. Числа тестовые.";
   return {id:slot.id,label:slot.label,name:hasEffects?a.name:"Не определена",
    status:hasEffects?"available":"not-defined",
    description:hasEffects?detail:
     "Пассивная способность предусмотрена, но эффект этому герою пока не назначен.",
    meta:[]};
  }
  if(slotId==="leader"){
   const protection=a.modifiers?.find(x=>x.stat==="protection"&&x.operation==="percent");
   return {id:slot.id,label:slot.label,name:a.name,status:"available",
    description:protection?"Пока герой жив и назначен лидером, каждый союзник получает +"+
     protection.value+"% к запасу Protection. Значение тестовое.":
     "Автоматический лидерский эффект. Подробное действие уточняется.",meta:[]};
  }
  const effects=[];
  if(a.kind==="damage"){
   const percent=Number.isFinite(a.multiplier)?Math.round(a.multiplier*100):null;
   if(percent!==null)effects.push("Наносит "+percent+"% от действующей атаки.");
   else effects.push("Наносит урон.");
   if(a.weakening>0)effects.push("Ослабляет противника на "+a.weakening+" атаки.");
    if(a.onHitStatus?.type==="slowed")effects.push("Замедление: -"+a.onHitStatus.amount+"% скорости на "+a.onHitStatus.turns+" собственных хода цели (тестовый баланс).");
    if(a.followUpStatusAll?.type==="debuff-resistance-down")effects.push("После попадания по основной цели снижает сопротивление всех оставшихся противников на "+a.followUpStatusAll.amount+" п.п. на "+a.followUpStatusAll.turns+" их собственных хода. Тестовый баланс.");
    if(a.onHitStatus?.type==="debuff-resistance-down")effects.push("При попадании снижает сопротивление основной цели негативным эффектам на "+a.onHitStatus.amount+" п.п. на "+a.onHitStatus.turns+" её собственных хода. Тестовый баланс.");
    if(a.onHitStatus?.type==="read-move")effects.push(
      "При попадании добавляет "+a.onHitStatus.stacks+
      " зацепок «Просчитанного хода» (всего до 4; "+a.onHitStatus.turns+
      " собственных хода цели). При 3+ зацепках вражеская особая/мощная атака сохраняется, но получает −20 п.п. точности, −20 п.п. эффективности наложения эффектов и −30% урона; расходует 3 зацепки.");

  }else if(a.kind==="guard"){
   if(Number.isFinite(a.guardHits))effects.push("Даёт защиту от "+a.guardHits+" ударов.");
   if(Number.isSafeInteger(a.tauntTurns))effects.push("Провокация на "+a.tauntTurns+" последующих собственных хода: одиночные атаки врагов направляются только на героя. Массовые атаки не перенаправляются.");
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
