/* HEROVICTORY002 — one presentation for persisted gear, star and level upgrades. */
const GearPromotionUI=(()=>{
 "use strict";
 const byId=id=>document.getElementById(id);
 const number=x=>typeof x==="number"&&Number.isFinite(x)?x:null;
 const format=x=>new Intl.NumberFormat("ru-RU").format(x);
 function statRow(name,symbol,oldValue,newValue){
  const previous=number(oldValue),next=number(newValue);
  if(previous===null||next===null||previous===next)return null;
  const row=document.createElement("div");
  row.className="gear-victory-stat";
  const icon=document.createElement("span");icon.className="gear-victory-stat-icon";
  icon.textContent=symbol;icon.setAttribute("aria-hidden","true");
  const detail=document.createElement("span");detail.className="gear-victory-stat-detail";
  const label=document.createElement("span");label.className="gear-victory-stat-label";label.textContent=name;
  const values=document.createElement("span");values.className="gear-victory-stat-values";
  const old=document.createElement("span");old.textContent=format(previous);
  const arrow=document.createElement("span");arrow.className="gear-victory-stat-arrow";arrow.textContent=" → ";
  const current=document.createElement("strong");current.textContent=format(next);
  values.append(old,arrow,current);detail.append(label,values);
  const difference=document.createElement("strong");
  difference.className="gear-victory-stat-delta"+(next<previous?" is-negative":"");
  difference.textContent=(next>previous?"+":"")+format(next-previous);
  const line=document.createElement("span");line.className="gear-victory-stat-line";
  line.setAttribute("aria-hidden","true");detail.append(line);
  row.append(icon,detail,difference);
  return row;
 }
 const fields=[
  ["hp","Здоровье","♥"],["physicalAttack","Физ. атака","⚔"],
  ["magicAttack","Маг. атака","✧"],["physicalDefense","Физ. защита","◆"],
  ["magicDefense","Маг. защита","◇"]
 ];
 function effects(before,after,kind){
  if(kind==="gear")return [
   statRow("Здоровье","♥",before?.hp,after?.hp),
   statRow("Атака","⚔",before?.atk,after?.atk),
   statRow("Скорость","➤",before?.speed,after?.speed)
  ].filter(Boolean);
  const rows=fields.map(([id,label,glyph])=>
   statRow(label,glyph,before?.[id],after?.[id])).filter(Boolean);
  // Legacy demonstration fighters have only an atk stat, not the combat profile.
  if(!rows.some(row=>row.children[1]?.children[0]?.textContent==="Физ. атака")){
   const attack=statRow("Атака","⚔",before?.atk,after?.atk);
   if(attack)rows.splice(Math.min(1,rows.length),0,attack);
  }
  return rows;
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
  const stats=byId("gearPromotionStats"),rows=effects(before,after,kind);
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