/* NET-004: test-only HTML controller, opt-in through ?networkPilot=1.
 * Uses the approved graphite/bronze visual language. No production rewards.
 */
const NetworkPilotUI=(()=>{
 "use strict";
 let session=null,onSquad=null,onReturnToFinder=null,mounted=false,notice="",fromFinder=false,selectedClueId=null;
 const $=id=>document.getElementById(id);
 const isLive=()=>session?.isLive?.()===true;
 const heroLabels=Object.freeze({ren:"Рен",nada:"Нада",liora:"Лиора",art:"Арт",sava:"Сава"});
 function clueTitle(clue){
  if(!isLive())return names[clue.templateId]||"Неизвестная зацепка";
  return clue.materialId?"Материалы: "+(typeof GearData!=="undefined"?
   GearData.MATERIAL_LABELS[clue.materialId]||clue.materialId:clue.materialId):
   clue.heroId?"Сведения: "+(heroLabels[clue.heroId]||clue.heroId):
   "Разведывательная зацепка";
 }
 function rewardText(ref){
  if(!isLive()||typeof NetworkLiveEconomy==="undefined")return "";
  const reward=NetworkLiveEconomy.preview(ref);
  if(!reward)return "Награда не настроена";
  const mats=Object.entries(reward.materials).map(([k,v])=>"+"+v+" "+(
   typeof GearData!=="undefined"?GearData.MATERIAL_LABELS[k]||k:k));
  const shards=Object.entries(reward.heroShards||{}).map(([k,v])=>
   "+"+v+" осколков: "+(heroLabels[k]||k));
  return ["+"+reward.currency+" валюты","+"+reward.accountXp+" XP",...mats,...shards].join(" · ");
 }
 async function collectRewards(){
  if(!isLive()||!session?.isReady())return;
  let result;
  try{result=await session.collect();}catch(_){result={ok:false,code:"REWARD_SYNC_FAILED"};}
  if(result.ok&&result.paid>0){
   const n=result.paid,part=n%10===1&&n%100!==11?"зацепку":
    n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?"зацепки":"зацепок";
   const materials=Object.entries(result.materialBreakdown||{}).map(([id,count])=>
    "+"+count+" "+(typeof GearData!=="undefined"?GearData.MATERIAL_LABELS[id]||id:id));
   const shards=Object.entries(result.shardBreakdown||{}).map(([id,count])=>
    "+"+count+" осколков ("+(heroLabels[id]||id)+")");
   notice="Получено за "+n+" "+part+": +"+result.currency+
    " валюты · +"+result.xp+" XP"+
    (materials.length?" · "+materials.join(", "):"")+
    (shards.length?" · "+shards.join(", "):"")+".";
  }else if(!result.ok){
   notice=errorText[result.code]||"Не удалось выдать награду: "+result.code+
    ". Выплата сохранена в очереди; попробуйте снова.";
  }
  render();
 }
 const names=Object.freeze({
  "net-route-watch":"Дозор на маршруте",
  "net-lost-cargo":"След пропавшей поклажи",
  "net-watch-trace":"Сведения о дозоре"
 });
 function completedTitle(templateId){
  if(!isLive())return names[templateId]||"Пробная операция";
  const t=typeof NetworkData!=="undefined"?
   NetworkData.LIVE_CATALOG.templates.find(entry=>entry.id===templateId):null;
  if(!t)return "Завершённая операция";
  if(t.materialId)return "Материалы: "+(typeof GearData!=="undefined"?
   GearData.MATERIAL_LABELS[t.materialId]||t.materialId:t.materialId);
  return t.heroId?"Сведения: "+(heroLabels[t.heroId]||t.heroId):"Операция";
 }
 const types=Object.freeze({supply:"Снабжение",trophies:"Трофеи",
  "threat-trace":"След угрозы","recruit-intel":"Сведения о человеке"});
 const prep=Object.freeze({survey:"Разведать",cover:"Подготовить прикрытие"});
 const approach=Object.freeze({quiet:"Тихий подход",cordon:"Окружение"});
 const errorText=Object.freeze({
  SESSION_BLOCKED_RELOAD_REQUIRED:"Сохранение заблокировано. Перезагрузите страницу.",
  OPERATION_IN_PROGRESS:"Сначала дождитесь завершения записи.",
  WALLET_WRITER_NOT_OWNED:"Нет права записи: активна другая вкладка.",
  SAVE_FAILED:"Не удалось подтвердить запись. Перезагрузите страницу, не повторяйте действие.",
  LOAD_FAILED:"Пробное сохранение повреждено или недоступно. Оно не перезаписано.",
  INVALID_TRANSITION:"Действие недоступно в текущей фазе.",
  EXCLUSIVE_LOCK_FAILED:"Ошибка эксклюзивной записи. Перезагрузите страницу.",
  SESSION_HALTED_RELOAD_REQUIRED:"Начисление приостановлено. Перезагрузите страницу.",
  REWARD_SYNC_FAILED:"Платёж не подтверждён. Перезагрузите страницу.",
  SAVE_OUTCOME_UNKNOWN:"Результат сохранения неизвестен. Перезагрузите страницу."
 });
 function line(text,tag="p"){const el=document.createElement(tag);el.textContent=text;return el;}
 function button(text,action,value){
  const el=document.createElement("button");
  el.type="button";el.textContent=text;el.className="net004-choice";
  el.dataset.netAction=action;if(value!==undefined)el.dataset.netValue=String(value);
  return el;
 }
 function updateSelection(s,blocked,busy){
  const selected=s?.board?.find(c=>c.id===selectedClueId);
  const title=$("netuxSelectedTitle"),start=$("netuxStartSelected"),sim=$("netuxSimulateSelected");
  if(title)title.textContent=selected?clueTitle(selected)+" · ур. "+selected.level:
   "Нет доступных донесений";
  if(start)start.disabled=!selected||blocked||busy;
  if(sim){
   const mastered=selected&&!blocked&&session.canSimulate(selected.id);
   sim.disabled=!mastered||busy;
   sim.textContent=mastered?"Симулировать":"Не освоено";
   sim.title=mastered?"Симулировать выбранную освоенную зацепку":
    "Симуляция откроется после освоения в ручном бою";
  }
  $("net004Clues")?.querySelectorAll(".net004-clue").forEach(item=>{
   const pressed=Number(item.querySelector("[data-net-value]")?.dataset.netValue)===selectedClueId;
   item.dataset.selected=String(pressed);
   item.querySelector("button")?.setAttribute("aria-pressed",String(pressed));
  });
 }
 function render(){
  if(!mounted)return;
  const s=session.read(),blocked=session.isBlocked(),busy=session.isBusy();
  $("net004Notice").textContent=blocked?
   "Режим заблокирован: нет безопасной записи. Перезагрузите страницу.":
   notice||(isLive()?"Разведсеть: выполняйте зацепки, направляйте поиск материалов и осколков.":
    "Пробный режим без наград и расхода энергии. Данные хранятся отдельно.");
  const board=$("net004Board"),active=$("net004Active"),result=$("net004Result");
  board.hidden=!!s?.active||!s;
  active.hidden=!s?.active||s.active.phase==="result";
  result.hidden=s?.active?.phase!=="result";
  $("net005FinderBack").hidden=!fromFinder;
  if(!s){$("net004Meta").textContent="Ожидание сохранения…";return;}
  $("net004Meta").textContent="Донесения "+s.board.length+"/"+s.config.capacity+
   (isLive()?" · каждые "+Math.round(s.config.intervalMs/3600000)+" ч":" · проба");
  $("netuxInfluence").textContent="Влияние: "+(s.influence["gardens-over-abyss"]??0);
  const collect=$("net007Collect");
  if(collect){const pending=session.pendingCount?.()??0;
   collect.hidden=!isLive()||pending===0;
   collect.disabled=blocked||busy;
   collect.textContent="Забрать награды: "+pending;
  }
  $("net004Refresh").disabled=busy||blocked;
  const orderLabel=s.order?
   (s.order.kind==="type"?(types[s.order.targetId]||s.order.targetId):
    s.order.kind==="region"?"Сады над пропастью":s.order.targetId):
    "Без приоритета";
  $("net005OrderStatus").textContent="Приказ: "+orderLabel+
   (s.order?" · без нужной зацепки: "+s.order.misses+
    " (гарантия после "+s.config.guaranteeAfter+" поступлений)":"")+
   ". Влияет только на новые донесения; заполненная доска не меняется.";
  const orders=$("net005OrderChoices");orders.replaceChildren();
  const unset=button("Снять приказ","clear-order");
  unset.disabled=blocked||busy||!s.order;orders.append(unset);
  for(const o of session.availableOrders()){
   const name=o.kind==="type"?(types[o.targetId]||o.targetId):
    o.kind==="region"?"Сады над пропастью":o.kind==="hero"?
    heroLabels[o.targetId]||o.targetId:o.kind==="material"&&
    typeof GearData!=="undefined"?GearData.MATERIAL_LABELS[o.targetId]||o.targetId:
    o.targetId;
   const control=button(name,"order",o.kind+":"+o.targetId);
   control.disabled=blocked||busy||
    (s.order?.kind===o.kind&&s.order?.targetId===o.targetId);
   control.setAttribute("aria-pressed",String(s.order?.kind===o.kind&&s.order?.targetId===o.targetId));
   orders.append(control);
  }
  const cluesEl=$("net004Clues");cluesEl.replaceChildren();
  if(!s.board.length)cluesEl.append(line("Новых донесений пока нет."));
  if(!s.board.some(c=>c.id===selectedClueId))selectedClueId=s.board[0]?.id??null;
  for(const clue of s.board){
   const el=document.createElement("article");el.className="net004-clue";
   el.dataset.selected=String(clue.id===selectedClueId);
   const choice=button("","pick",clue.id);choice.className="netux-clue-pick";
   choice.setAttribute("aria-pressed",String(clue.id===selectedClueId));
   choice.disabled=busy||blocked;
   const top=document.createElement("div");top.className="netux-clue-top";
   const kind=line(types[clue.type]||clue.type,"span");kind.className="netux-clue-kind";
   const lvl=line("Ур. "+clue.level,"span");lvl.className="netux-clue-level";
   top.append(kind,lvl);
   const title=line(clueTitle(clue),"strong");
   const fullReward=isLive()?rewardText(clue.rewardRef):
    "Пробный бой. Реальные награды не назначены.";
   const reward=line(fullReward,"span");reward.className="netux-clue-reward";
   const tags=document.createElement("div");tags.className="netux-clue-tags";
   if(session.canSimulate(clue.id))tags.append(line("Освоено","span"));
   if(clue.threatTag){
    const threat=line("След угрозы","span");threat.className="netux-threat-tag";
    tags.append(threat);
   }
   choice.title=clueTitle(clue)+" · "+fullReward;
   choice.setAttribute("aria-label",clueTitle(clue)+", уровень "+clue.level+
    ". "+fullReward+(session.canSimulate(clue.id)?". Освоено":"")+
    (clue.threatTag?". След угрозы":""));
   choice.append(top,title,reward,tags);el.append(choice);cluesEl.append(el);
  }
  updateSelection(s,blocked,busy);
  if(s.active&&s.active.phase!=="result"){
   const a=s.active;
   $("net004ActiveTitle").textContent=clueTitle(a.clue);
   $("net004ActiveDetail").textContent=
    a.phase==="brief"?"Выберите подготовку. Разведка раскрывает рекомендуемую цель; прикрытие снижает атаку противника только в пробе.":
    a.phase==="approach"?"Выберите подход. Тихий — одна волна, окружение — две отдельные волны.":
    "Контрольная точка: волна "+(a.wave+1)+"/"+
      a.clue.approaches.find(x=>x.id===a.approach).waves+
      ". Состав героев и бой будут начаты заново при перезагрузке."+
      (a.wave>0&&!Array.isArray(a.waveSummaries)?
       " Старый контрольный пункт без отчёта S1: отмените вылазку и начните заново. Исходная зацепка сохранится.":
       a.waveSummaries?.length?" Предыдущая волна: "+
        a.waveSummaries.at(-1).score+" баллов (S1).":"");
   const slot=$("net004Choices");slot.replaceChildren();
   if(a.phase==="brief")for(const id of a.clue.preparationIds)
    slot.append(button(prep[id]||id,"prepare",id));
   if(a.phase==="approach")for(const choice of a.clue.approaches)
    slot.append(button((approach[choice.id]||choice.id)+" · "+choice.waves+
     (choice.waves===1?" волна":" волны"),"approach",choice.id));
   $("net004Fight").hidden=a.phase!=="battle";
   $("net004Fight").disabled=busy||blocked||(a.wave>0&&!Array.isArray(a.waveSummaries));
   $("net004Cancel").disabled=busy||blocked;
  }
  if(s.active?.phase==="result"){
   $("net004ResultTitle").textContent="Зацепка пройдена";
   if(!Array.isArray(s.active.waveSummaries)){
    $("net004ResultDetail").textContent="Результат старого пилота: "+s.active.score+
     ". Оценка S1 не вычислялась; освоение не перенесено. Наград нет.";
   }else{
    const stars=s.active.score>=90?3:s.active.score>=75?2:1;
    $("net004ResultDetail").textContent=(isLive()?"Результат: ":"Оценка S1: ")+s.active.score+
     "/100 · "+stars+"★. Волны: "+s.active.waveSummaries.map(x=>
      x.score+" ("+x.knockedOut+"/"+x.deployed+" нокаутов; "+
       x.allyActions+" действий)").join(" → ")+
     ". "+(isLive()?rewardText(s.active.clue.rewardRef):
      "Тестовые цели и норматив действий временные. Награды не начисляются.");
   }
   $("net004Finish").textContent=isLive()?"Забрать":"Завершить испытание";
   $("net004Finish").disabled=blocked||busy;
  }
  $("net004History").replaceChildren();
  const recent=s.completed.slice(-3).reverse();
  if(recent.length)$("net004History").append(line((isLive()?"Завершённые зацепки: ":"Тестовые завершения: ")+
   recent.map(e=>"№"+e.serial+" ("+completedTitle(e.templateId)+
    (e.kind==="simulated"?" · симуляция":" · бой")+")").join(" · ")));
  $("net004Claim").disabled=true;
  // Do not overwrite mastery/order-specific disabled states set above.
  document.querySelectorAll("#network [data-net-action]").forEach(el=>{
   const action=el.dataset.netAction;
   if(["start","simulate","order","clear-order","start-selected","simulate-selected","pick"].includes(action))return;
   if(action!=="fight"&&action!=="finder-back")el.disabled=blocked||busy||
    (action==="finish"&&s.active?.phase!=="result");
  });
  if(typeof WeeklyThreatUI!=="undefined")WeeklyThreatUI.render();
 }
 async function change(action,value){
  if(!session||session.isBlocked())return;
  notice="";
  let result;
  try{result=await session.change(action,value);}catch(_){result={ok:false,code:"SAVE_FAILED"};}
  if(!result.ok)notice=errorText[result.code]||"Действие отклонено: "+result.code;
  if(result.ok&&isLive()&&(action==="finish"||action==="simulate")){
   await collectRewards();return;
  }
  render();
  if(result.ok&&action==="approach"&&session.read()?.active?.phase==="battle")
   onSquad();
 }
 function mount({pilot,onOpenSquad,onBackToFinder}={}){
  if(mounted||!pilot||typeof onOpenSquad!=="function"||!$("network"))return false;
  session=pilot;onSquad=onOpenSquad;
  onReturnToFinder=onBackToFinder;mounted=true;
  $("network").addEventListener("click",event=>{
   const b=event.target.closest?.("[data-net-action]");
   if(!b||!$("network").contains(b))return;
   const action=b.dataset.netAction;
   if(b.disabled)return;
   if(action==="pick"){
    const id=Number(b.dataset.netValue),state=session.read();
    if(state?.board.some(c=>c.id===id)){
     selectedClueId=id;updateSelection(state,session.isBlocked(),session.isBusy());
    }
    return;
   }
   if(action==="start-selected"||action==="simulate-selected"){
    const state=session.read();
    if(!state?.board.some(c=>c.id===selectedClueId))return;
    void change(action==="start-selected"?"start":"simulate",selectedClueId);
    return;
   }
   if(action==="fight"){if(session.isReady()&&session.read()?.active?.phase==="battle")onSquad();return;}
   if(action==="collect"){void collectRewards();return;}
   if(action==="finder-back"){
    if(fromFinder&&typeof onReturnToFinder==="function"){fromFinder=false;onReturnToFinder();}
    return;
   }
   if(!["refresh","start","prepare","approach","abandon","finish",
    "order","clear-order","simulate"].includes(action))return;
   let arg=b.dataset.netValue;
   if(action==="start"||action==="simulate")arg=Number(arg);
   if(action==="order"){
    const choices=session.availableOrders();
    const selected=choices.find(o=>o.kind+":"+o.targetId===arg);
    if(!selected)return;
    arg=selected;
   }
   if(action==="clear-order")arg=null;
   void change(action==="clear-order"?"order":action,arg);
  });
  render();
  pilot.open().then(result=>{
   if(!result.ok)notice=errorText[result.code]||result.code;
   render();
   if(result.ok&&isLive())void collectRewards();
  }).catch(()=>{notice="Не удалось загрузить разведсеть.";render();});
  return true;
 }
 function openFromFinder(materialId){
  if(!mounted||typeof onReturnToFinder!=="function")return false;
  fromFinder=true;
  if(isLive()&&session.isReady())
   void change("order",{kind:"material",targetId:materialId});
  notice=isLive()?"Приказ на материал "+materialId+
   " выбран, новые зацепки будут появляться с этим приоритетом.":
   "Пробная разведсеть: для материала "+materialId+
   " нет подтверждённого источника. Здесь не выдаются предметы и награды.";
  render();
  return true;
 }
 return Object.freeze({mount,render,openFromFinder});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=NetworkPilotUI;
