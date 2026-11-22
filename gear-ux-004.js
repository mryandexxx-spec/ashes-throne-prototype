/* GEAR-UX-004: contextual equipment dossier. UI only; no gameplay mutations.
 * Recipes, availability and deficits come from existing GEAR-FINDER-003 APIs.
 * Farming is performed exclusively by existing campaign/simulation handlers. */
const GearUX004=(()=>{
 "use strict";
 let active=false,mode="item",materialId=null,returnContext=null,last=null;
 let onNetworkPreview=null; // Set only by opt-in NET-005 test mode.
 const get=id=>typeof document==="undefined"?null:document.getElementById(id);
 const node=(tag,cls,content)=>{
  const e=document.createElement(tag);
  if(cls)e.className=cls;
  if(content!==undefined)e.textContent=String(content);
  return e;
 };
 const btn=(text,callback,cls="ghost",disabled=false)=>{
  const e=node("button",cls,text);e.type="button";e.disabled=disabled;
  e.addEventListener("click",callback);return e;
 };
 const row=(label,value,cls="")=>{
  const e=node("div","gear-ux-pair "+cls);
  e.append(node("span","",label),node("strong","",value));return e;
 };
 function reset(){
  active=false;mode="item";materialId=null;returnContext=null;
  get("heroDetail")?.classList.remove("gear-ux-active");
 }
 function cancelReturn(){returnContext=null;}
 function openSlot(){active=true;mode="item";materialId=null;}
 function restore(){active=true;mode="item";materialId=null;}
 function focusPanelHeading(){
  const heading=get("gearUxLeft")?.querySelector("h3");
  if(heading){heading.tabIndex=-1;heading.focus();}
 }
 function showItem(){mode="item";materialId=null;refresh();focusPanelHeading();}
 function showSources(id){materialId=id;mode="sources";refresh();focusPanelHeading();}
 function hasReturnContext(){return !!returnContext;}
 function rememberMission(missionId){
  if(!last||!active)return false;
  returnContext={heroId:last.heroId,slotIndex:last.slotIndex,missionId};
  return true;
 }
 function returnToHero(){
  if(!returnContext)return false;
  const c=returnContext;
  returnContext=null;
  restore();
  const opened=openHeroDetail(c.heroId,c.slotIndex);
  if(opened)get("gearSlots")?.querySelector('[data-gear-slot="'+c.slotIndex+'"]')?.focus();
  return opened;
 }
 function sourceStatus(source){
  if(source.access==="unknown")return "Доступность не определена";
  if(source.access==="locked")return "Закрыта · сначала: "+source.missingPrerequisites.map(id=>MissionData.get(id)?.title||id).join(", ");
  if(source.access==="first-clear")return "Первый вход бесплатно · награда после победы";
  return "Повтор · "+source.bestStars+"★ · "+source.energyCost+" ⚡";
 }
 function showBonus(left,plan,progress){
  const item=GearData.get(plan.itemId);
  left.append(node("div","gear-ux-eyebrow","БОНУС ПРЕДМЕТА"));
  if(!item){left.append(node("p","gear-ux-note","Нет данных предмета"));return;}
  const statEntries=Object.entries(item.statBonuses||{});
  if(item.bonuses.hp)left.append(row("Здоровье", "+"+Math.round(item.bonuses.hp*100)+"%"));
  if(item.bonuses.atk)left.append(row("Атака", "+"+Math.round(item.bonuses.atk*100)+"%"));
  for(const [key,value] of statEntries)left.append(row(GearData.STAT_LABELS[key]||key,"+"+value));
  if(!item.bonuses.hp&&!item.bonuses.atk&&!statEntries.length)
   left.append(node("p","gear-ux-note","Бонусы пока не определены"));
  const existing=ProgressCore.gearBonuses(progress,plan.heroId);
  const hpAfter=existing.hp+item.bonuses.hp,atkAfter=existing.atk+item.bonuses.atk;
  if(plan.status!=="installed")left.append(node("p","gear-ux-note",
   "Итог экипировки до → после: HP "+Math.round(existing.hp*100)+"% → "+
   Math.round(hpAfter*100)+"%, ATK "+Math.round(existing.atk*100)+"% → "+Math.round(atkAfter*100)+"%."));
  else left.append(node("p","gear-ux-note","Предмет установлен. Бонус включён в характеристики."));
  left.append(node("p","gear-ux-note","Часть дополнительных характеристик пока экспериментальная."));
 }
 function showMaterials(right,plan,full,saveBlocked){
  right.append(node("h3","","Материалы для изготовления"));
  if(full?.complete){
   right.append(node("p","gear-ux-note","Все шесть предметов G"+full.tier+" установлены."));
   if(full.promotion){
    right.append(row("Переход G"+full.tier+" → G"+full.promotion.to,
     full.promotion.currency+" валюты"));
    const canPromote=!saveBlocked&&ProgressCore.canPromoteGear(last.progress,last.heroId);
    right.append(btn("Повысить экипировку",()=>get("gearEquipNext")?.click(),"primary gear-ux-craft",!canPromote));
   }else right.append(node("p","gear-ux-note","Достигнут G"+GearData.MAX_TIER+"."));
   return;
  }
  if(plan.status==="installed"){
   right.append(node("p","gear-ux-note","Предмет уже установлен. Выберите другой слот."));
   return;
  }
  const list=node("div","gear-ux-materials material-group");
  list.innerHTML=plan.materials.map(m=>GearMaterialUI.tile(m.id,m.have,m.need)).join("");
  right.append(list,row("Стоимость",plan.currency.need+" валюты"),row("Баланс",plan.currency.have+" валюты"));
  if(plan.currency.missing)
   right.append(node("p","gear-ux-warning","Не хватает "+plan.currency.missing+" валюты."));
  const missing=plan.materials.find(m=>m.missing>0);
  if(missing)right.append(btn("Где добыть",()=>showSources(missing.id),"ghost gear-ux-find gear-ux-find-all"));
  right.append(btn("Изготовить и установить",()=>get("gearEquipNext")?.click(),
   "primary gear-ux-craft",saveBlocked||!plan.canCraft));
  if(saveBlocked)right.append(node("p","gear-ux-warning","Сохранение недоступно. Покупки заблокированы."));
 }
 function showSourceList(left,right,plan){
  const m=plan.materials.find(x=>x.id===materialId);
  if(!m){showItem();return;}
  left.append(node("h3","","Где добыть: "+m.label));
  left.append(node("p","gear-ux-note","Есть "+m.have+" / нужно "+m.need+" · недостаёт "+m.missing));
  const list=node("div","gear-ux-sources");
  const sources=GearPlanningCore.findSources(m.id,last.progress,last.campaign);
  if(!sources.length)list.append(node("p","gear-ux-warning","Для материала пока нет источников в доступном каталоге."));
  for(const source of sources){
   const card=node("div","gear-ux-source");
   const lacksEnergy=(source.access==="repeat"||source.access==="first-clear")&&!source.canStartManual;
   const energyKnown=Number.isSafeInteger(last.progress.energy?.value);
   const warning=lacksEnergy?(energyKnown?" · не хватает энергии":" · запас энергии не определён"):"";
   card.append(node("strong","",source.title),
    node("small","", "За победу · "+source.currencyPerVictory+" валюты"),
    node("small","",sourceStatus(source)+warning));
   GearMaterialUI.append(card,{[m.id]:source.quantity});
   const actions=node("div","gear-ux-source-actions");
   if(source.access==="first-clear"||source.access==="repeat"){
    actions.append(btn(source.access==="first-clear"?"В бой · бесплатно":"В бой · "+source.energyCost+" ⚡",
     ()=>{if(rememberMission(source.missionId)&&!openCampaignMission(source.missionId))cancelReturn();},
     "primary",!source.canStartManual));
    if(source.simulationUnlocked)actions.append(btn("Симуляция · "+source.nominalEnergyCost+" ⚡",
     ()=>{if(simulateMission(source.missionId))refresh();},
     "ghost",!source.canSimulate));
   }
   if(actions.children.length)card.append(actions);
   list.append(card);
  }
  left.append(list);
  const live=typeof networkPilot!=="undefined"&&networkPilot?.isLive();
  right.append(node("h3","","Источник материала"));
  if(live){
   const templates=NetworkData.LIVE_CATALOG.templates.filter(t=>t.materialId===m.id);
   if(templates.length)right.append(node("p","gear-ux-note","Материал дают зацепки снабжения. Приказ повышает приоритет будущих донесений."));
  }else right.append(node("p","gear-ux-note","Разведсеть пока не подтверждена как источник этого материала в пробном режиме."));
  // The pilot link must survive a race where game.js mounts the optional
  // network screen before the GearUX004 callback becomes available. It is
  // never exposed without the explicit pilot URL flag and mounted pilot.
  const pilotReady=typeof window!=="undefined"&&
   /(?:^|[?&])networkPilot=1(?:&|$)/.test(window.location.search)&&
   typeof NetworkPilotUI!=="undefined"&&
   typeof NetworkPilotUI.openFromFinder==="function";
  if(typeof onNetworkPreview==="function"||pilotReady)right.append(
   btn(live?"Отдать приказ на материал":"Посмотреть пробную разведсеть",()=>{
    if(typeof onNetworkPreview==="function")onNetworkPreview(m.id);
    else if(NetworkPilotUI.openFromFinder(m.id))showScreen("network");
   },"ghost gear-ux-find"));
  right.append(row("Материал",m.label),row("Дефицит","×"+m.missing));
  right.append(node("p","gear-ux-note",
   "Миссии и награды взяты из существующей кампании. Первый вход бесплатен, повтор требует энергии, симуляция — 3★."));
  right.append(btn("← К рецепту",showItem,"primary gear-ux-craft"));
 }
 function render(data){
  last=data;
  const root=get("heroDetail"),left=get("gearUxLeft"),right=get("gearUxRight");
  if(!root||!left||!right)return;
  const toggle=get("gearFocusToggle");
  const state=ProgressCore.gearState(data.progress,data.heroId);
  if(!active||state?.mode!=="itemized"){
   root.classList.remove("gear-ux-active");left.hidden=true;right.hidden=true;
   if(toggle)toggle.textContent="Развитие экипировки";
   return;
  }
  const slot=GearData.SLOTS[data.slotIndex],plan=slot&&GearPlanningCore.plan(data.progress,data.heroId,slot.id,data.campaign);
  const full=GearPlanningCore.planTier(data.progress,data.heroId,data.campaign);
  if(!plan||!full){
   root.classList.remove("gear-ux-active");left.hidden=true;right.hidden=true;
   return;
  }
  root.classList.add("gear-ux-active");left.hidden=false;right.hidden=false;
  if(toggle)toggle.textContent="← К умениям";
  left.replaceChildren();right.replaceChildren();
  const header=node("div","gear-ux-header");
  header.append(node("span","gear-ux-eyebrow","ЭКИПИРОВКА · G"+plan.tier),
   btn("×",()=>{reset();refresh();},"ghost gear-ux-close"));
  left.append(header);
  if(mode==="sources"){
   showSourceList(left,right,plan);return;
  }
  const stateLabel=plan.status==="installed"?"✓ Надето":
   plan.status==="ready"?"＋ Можно изготовить и надеть":"⌕ Не хватает ресурсов";
  left.append(node("h3","",plan.itemName),
   node("p","gear-ux-state gear-ux-state--"+plan.status,stateLabel),
   node("p","gear-ux-note",slot.label+" · G"+plan.tier));
  showBonus(left,plan,data.progress);
  showMaterials(right,plan,full,data.saveBlocked);
 }
 function refresh(){if(last)render(last);}
 if(typeof document!=="undefined"){
  get("gearFocusToggle")?.addEventListener("click",()=>{
   const state=ProgressCore.gearState(progress,selectedHeroId);
   if(state?.mode!=="itemized"){HeroCardUI.open("heroGearDialog");return;}
   if(active)reset();else openSlot();
   renderHeroDetail();
   if(!active)get("gearFocusToggle")?.focus();
  });
  document.addEventListener("keydown",event=>{
   if(event.key!=="Escape"||!active||!get("heroDetail")?.classList.contains("active")||
      document.querySelector("dialog[open]"))return;
   event.preventDefault();
   if(mode==="sources")showItem();else{reset();renderHeroDetail();get("gearFocusToggle")?.focus();}
  });
 }
 function setNetworkPreview(callback){
  onNetworkPreview=typeof callback==="function"?callback:null;
 }
 return Object.freeze({showSources,reset,cancelReturn,openSlot,restore,render,refresh,hasReturnContext,
  rememberMission,returnToHero,sourceStatus,setNetworkPreview});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=GearUX004;
