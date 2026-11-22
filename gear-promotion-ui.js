/* GEARVICTORY001 — visual-only result of an already persisted gear promotion. */
const GearPromotionUI=(()=>{
 "use strict";
 const byId=id=>document.getElementById(id);
 function value(x){const n=Number(x);return Number.isFinite(n)?n:null;}
 function statRow(name,symbol,oldValue,newValue){
  const previous=value(oldValue),next=value(newValue);
  if(previous===null||next===null||previous===next)return null;
  const row=document.createElement("div");
  row.className="gear-victory-stat";
  const icon=document.createElement("span");icon.className="gear-victory-stat-icon";
  icon.textContent=symbol;icon.setAttribute("aria-hidden","true");
  const detail=document.createElement("span");detail.className="gear-victory-stat-detail";
  const label=document.createElement("span");label.className="gear-victory-stat-label";label.textContent=name;
  const numbers=document.createElement("span");numbers.className="gear-victory-stat-values";
  const old=document.createElement("span");old.textContent=String(previous);
  const arrow=document.createElement("span");arrow.className="gear-victory-stat-arrow";arrow.textContent=" → ";
  const current=document.createElement("strong");current.textContent=String(next);
  numbers.append(old,arrow,current);detail.append(label,numbers);
  const difference=document.createElement("strong");
  difference.className="gear-victory-stat-delta"+(next<previous?" is-negative":"");
  difference.textContent=(next>previous?"+":"")+String(next-previous);
  const line=document.createElement("span");line.className="gear-victory-stat-line";
  line.setAttribute("aria-hidden","true");detail.append(line);
  row.append(icon,detail,difference);
  return row;
 }
 function show({heroName,from,to,currency,before,after}){
  const dialog=byId("gearPromotionDialog");if(!dialog)return false;
  byId("gearPromotionTitle").textContent="Ранг экипировки повышен";
  byId("gearPromotionHeroName").textContent=String(heroName||"Герой");
  byId("gearPromotionTier").textContent="G"+String(to);
  byId("gearPromotionLevel").textContent="G"+String(from)+" → G"+String(to);
  byId("gearPromotionHistory").textContent="Предметы G"+String(from)+" сохранены в истории";
  byId("gearPromotionCost").textContent="−"+new Intl.NumberFormat("ru-RU").format(value(currency)??0)+" кромов";
  const portrait=byId("gearPromotionPortrait");
  const source=byId("detailRenPortrait");
  const src=source?.getAttribute("src");
  if(src){portrait.src=src;portrait.alt=source.alt||String(heroName||"Герой");portrait.hidden=false;}
  else{portrait.removeAttribute("src");portrait.hidden=true;}
  const stats=byId("gearPromotionStats");
  const rows=[
   statRow("Здоровье","♥",before?.hp,after?.hp),
   statRow("Атака","⚔",before?.atk,after?.atk),
   statRow("Скорость","➤",before?.speed,after?.speed)
  ].filter(Boolean);
  if(rows.length)stats.replaceChildren(...rows);
  else{
   const empty=document.createElement("p");empty.className="gear-victory-no-change";
   empty.textContent="Характеристики без изменений";
   stats.replaceChildren(empty);
  }
  dialog.classList.remove("gear-victory-enter");
  // Animation is CSS-only; no GPU scene, event listener or timer.
  void dialog.offsetWidth;
  dialog.classList.add("gear-victory-enter");
  dialog.showModal();
  byId("gearPromotionClose")?.focus?.({preventScroll:true});
  return true;
 }
 return Object.freeze({show});
})();