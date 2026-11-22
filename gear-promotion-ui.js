/* VICTORYSTATS003 — source-derived stat deltas for all three persisted rewards. */
const GearPromotionUI=(()=>{
 "use strict";
 const byId=id=>document.getElementById(id);
 const number=x=>typeof x==="number"&&Number.isFinite(x)?x:null;
 const format=x=>new Intl.NumberFormat("ru-RU").format(x);
 // Display metadata only. The list of actual stats comes from HeroStatsCore.KEYS,
 // not from the view: future numeric changes cannot silently be left out.
 const META=Object.freeze({
  hp:["Здоровье","♥"],protection:["Защита","⬡"],
  physicalAttack:["Физ. атака","⚔"],magicAttack:["Маг. атака","✧"],
  physicalDefense:["Физ. оборона","◆"],magicDefense:["Маг. оборона","◇"],
  speed:["Скорость","➤"],critChance:["Шанс крита","✦"],
  critDamage:["Крит. урон","✹"],accuracy:["Точность","◎"],
  evasion:["Уклонение","↝"],defensePenetration:["Пробивание","➶"],
  debuffPotency:["Эффект ослаблений","⌁"],
  debuffResistance:["Сопр. ослаблениям","◈"],
  atk:["Атака","⚔"] // legacy pilot only; playable heroes expose physicalAttack
 });
 const PERCENT=new Set(["critChance","critDamage","accuracy","evasion",
  "defensePenetration","debuffPotency","debuffResistance"]);
 const displayNumber=x=>new Intl.NumberFormat("ru-RU",{maximumFractionDigits:8}).format(x);
 function changedStats(before,after){
  if(!before||!after)return [];
  const keys=typeof HeroStatsCore!=="undefined"&&Array.isArray(HeroStatsCore.KEYS)
   ?HeroStatsCore.KEYS
   :typeof GearData!=="undefined"&&Array.isArray(GearData.FUTURE_STAT_KEYS)
    ?GearData.FUTURE_STAT_KEYS:Object.keys(META).filter(k=>k!=="atk");
  const havePhysical=number(before.physicalAttack)!==null&&
   number(after.physicalAttack)!==null;
  // Do not double-count the physicalAttack/atk compatibility alias.
  const ordered=keys.slice();
  if(!havePhysical)ordered.splice(Math.max(0,ordered.indexOf("physicalAttack")+1),0,"atk");
  return [...new Set(ordered)].flatMap(key=>{
   const prev=number(before[key]),next=number(after[key]);
   return prev===null||next===null||prev===next?[]:
    [{key,name:META[key]?.[0]||
      (typeof GearData!=="undefined"?GearData.STAT_LABELS?.[key]:null)||key,
      icon:META[key]?.[1]||"◆",previous:prev,next,percent:PERCENT.has(key)}];
  });
 }
 function statRow(change){
  const {key,name,icon:sign,previous,next,percent}=change;
  const delta=next-previous;
  const unit=percent?"%":"";
  const row=document.createElement("div");
  row.className="gear-victory-stat";
  row.dataset.statKey=key;
  const icon=document.createElement("span");icon.className="gear-victory-stat-icon";
  icon.textContent=sign;icon.setAttribute("aria-hidden","true");
  const detail=document.createElement("span");detail.className="gear-victory-stat-detail";
  const label=document.createElement("span");label.className="gear-victory-stat-label";label.textContent=name;
  const values=document.createElement("span");values.className="gear-victory-stat-values";
  const old=document.createElement("span");old.textContent=displayNumber(previous)+unit;
  const arrow=document.createElement("span");arrow.className="gear-victory-stat-arrow";arrow.textContent=" → ";
  const current=document.createElement("strong");current.textContent=displayNumber(next)+unit;
  values.append(old,arrow,current);detail.append(label,values);
  const difference=document.createElement("strong");
  difference.className="gear-victory-stat-delta"+(delta<0?" is-negative":"");
  difference.textContent=(delta>0?"+":"")+displayNumber(delta)+(percent?" п.п.":"");
  const line=document.createElement("span");line.className="gear-victory-stat-line";
  line.setAttribute("aria-hidden","true");detail.append(line);
  row.append(icon,detail,difference);
  return row;
 }
 function effects(before,after){
  return changedStats(before,after).map(statRow);
 }
 function present({kind,heroName,headline,badge,transition,expense,history,
                   before,after,section="Усиление",emptyMessage="Характеристики без изменений"}){
  const dialog=byId("gearPromotionDialog");if(!dialog)return false;
  dialog.setAttribute("data-victory-kind",kind);
  byId("gearPromotionTitle").textContent=headline;
  byId("gearPromotionHeroName").textContent=String(heroName||"Герой");
  const medal=byId("gearPromotionMedal");
  if(medal)medal.setAttribute("aria-label",kind==="star"?"Новый звёздный ранг":
   kind==="level"?"Новый уровень героя":"Новый ранг экипировки");
  byId("gearPromotionTier").textContent=badge;
  byId("gearPromotionLevel").textContent=transition;
  byId("gearPromotionHistory").textContent=history;
  byId("gearPromotionCost").textContent=expense;
  byId("gearPromotionBonusesTitle").textContent=section;
  const currencyIcon=byId("gearPromotionResourceIcon");
  currencyIcon.className=kind==="star"?"gear-victory-shard-art":"resource-art resource-art--krom";
  currencyIcon.textContent=kind==="star"?"✦":"";
  const portrait=byId("gearPromotionPortrait"),source=byId("detailRenPortrait");
  const src=source?.getAttribute("src");
  if(src){
   portrait.src=src;portrait.alt=source.alt||String(heroName||"Герой");portrait.hidden=false;
  }else{portrait.removeAttribute("src");portrait.hidden=true;}
  const stats=byId("gearPromotionStats"),rows=effects(before,after);
  stats.scrollTop=0;
  stats.setAttribute("aria-label","Изменения характеристик: "+rows.length);
  stats.setAttribute("tabindex","0");
  if(rows.length)stats.replaceChildren(...rows);
  else{
   const empty=document.createElement("p");empty.className="gear-victory-no-change";
   empty.textContent=emptyMessage;
   stats.replaceChildren(empty);
  }
  dialog.classList.remove("gear-victory-enter");
  void dialog.offsetWidth; // restart CSS-only animation; never create a 3D scene
  dialog.classList.add("gear-victory-enter");
  dialog.showModal();
  const hint=byId("gearPromotionScrollHint");
  if(hint){
   hint.textContent="↕ Всего изменений: "+rows.length+" · листайте список";
   hint.hidden=rows.length<2||stats.scrollHeight<=stats.clientHeight+1;
  }
  byId("gearPromotionClose")?.focus?.({preventScroll:true});
  return true;
 }
 function show({heroName,from,to,currency,before,after}){
  return present({kind:"gear",heroName,headline:"Ранг экипировки повышен",badge:"G"+to,
   transition:"G"+from+" → G"+to,expense:"−"+format(currency)+" кромов",
   history:"Предметы G"+from+" сохранены в истории",before,after});
 }
 function showStar({heroName,from,to,spent,excessCurrency=0,before,after}){
  const unlocked=from===0;
  const percent=Math.max(0,(to-1)*3);
  const history=(unlocked?"Герой добавлен в коллекцию":
   "Бонус звёзд: +"+percent+"% к базовым HP, атакам и защитам")+
   (excessCurrency>0?" · Возвращено "+format(excessCurrency)+" кромов":"");
  return present({kind:"star",heroName,headline:unlocked?"Новый герой открыт":"Звёздный ранг повышен",
   badge:to+"★",transition:from+"★ → "+to+"★",
   expense:"−"+format(spent)+" осколков героя",history,before,after,
   section:unlocked?"Новый союзник":"Усиление",emptyMessage:unlocked?
    "Герой доступен в коллекции и отряде":"Фактические показатели без изменений"});
 }
 function showLevel({heroName,from,to,currency,cap,before,after}){
  const count=to-from;
  return present({kind:"level",heroName,headline:count>1?"Уровни героя повышены":"Уровень героя повышен",
   badge:String(to),transition:"Ур. "+from+" → "+to,
   expense:"−"+format(currency)+" кромов",
   history:"Повышено на "+count+" ур."+(Number.isInteger(cap)?" · доступный предел "+cap:""),
   before,after,section:"Рост характеристик"});
 }
 return Object.freeze({show,showStar,showLevel});
})();