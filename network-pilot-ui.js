/* NET-004: test-only HTML controller, opt-in through ?networkPilot=1.
 * Uses the approved graphite/bronze visual language. No production rewards.
 */
const NetworkPilotUI=(()=>{
 "use strict";
 let session=null,onSquad=null,onReturnToFinder=null,mounted=false,notice="",fromFinder=false,selectedClueId=null;
 let orderDraftKey=null,orderTab="material",orderSubmitting=false,orderFeedback="";
 const $=id=>document.getElementById(id);
 const isLive=()=>session?.isLive?.()===true;
 const heroLabels=Object.freeze({ren:"Рен",nada:"Нада",liora:"Лиора",art:"Арт",sava:"Сава"});
 const operationStory=clue=>isLive()&&typeof NetworkEncounterData!=="undefined"?
  NetworkEncounterData.brief(clue.encounterRef):null;
 function formations(clue,approachId){
  if(!clue||typeof NetworkEncounterData==="undefined")return null;
  return NetworkEncounterData.REGISTRY[clue.encounterRef]?.formations?.[approachId]||null;
 }
 function enemyName(id){
  return typeof NpcEnemyData!=="undefined"?NpcEnemyData.get(id)?.name||id:id;
 }
 function enemyIds(clue,approachId=null){
  if(typeof NetworkEncounterData==="undefined")return [];
  const registry=NetworkEncounterData.REGISTRY[clue.encounterRef]?.formations;
  const groups=approachId?[formations(clue,approachId)]:Object.values(registry||{});
  return [...new Set(groups.filter(Array.isArray).flat(2))];
 }
 function enemySummary(clue,approachId=null){
  const ids=enemyIds(clue,approachId);
  return ids.length?ids.map(enemyName).join(" · "):"Состав будет показан перед боем.";
 }
 function renderEnemySummary(host,clue,approachId,target=null){
  const ids=enemyIds(clue,approachId),full=line(enemySummary(clue,approachId)+
   (target?". Первая цель: "+target+".":""),"span");
  full.className="netux-enemy-full";
  const compact=line(ids.length?"Противников: "+ids.length+" · состав в донесении":
   "Состав будет показан перед боем","span");
  compact.className="netux-enemy-compact";host.replaceChildren(full,compact);
 }
 function routeFacts(clue,route){
  const waves=formations(clue,route.id);
  return {counts:waves?waves.map(w=>w.length):Array.from({length:route.waves},()=>0),
   target:waves?.[0]?.[0]?enemyName(waves[0][0]):null};
 }
 function preparationEffect(id){
  if(id==="survey")return "Отмечает главную цель. Отдельного бонуса к награде нет.";
  if(id==="cover")return "Физическая атака всех врагов −10%. Награда не меняется.";
  return "Наблюдение отмечает главную цель; прикрытие снижает физическую атаку врагов на 10%.";
 }
 function clueTitle(clue){
  if(!isLive())return names[clue.templateId]||"Неизвестная зацепка";
  const subject=clue.materialId?"Материалы: "+(typeof GearData!=="undefined"?
   GearData.MATERIAL_LABELS[clue.materialId]||clue.materialId:clue.materialId):
   clue.heroId?"Сведения: "+(heroLabels[clue.heroId]||clue.heroId):
   "Разведывательная зацепка";
  const story=operationStory(clue);
  return story?story.title+" · "+subject:subject;
 }
 function rewardText(ref,includeMaterials=true){
  if(!isLive()||typeof NetworkLiveEconomy==="undefined")return "";
  const reward=NetworkLiveEconomy.preview(ref);
  if(!reward)return "Награда не настроена";
  const mats=Object.entries(reward.materials).map(([k,v])=>"+"+v+" "+(
   typeof GearData!=="undefined"?GearData.MATERIAL_LABELS[k]||k:k));
  const shards=Object.entries(reward.heroShards||{}).map(([k,v])=>
   "+"+v+" осколков: "+(heroLabels[k]||k));
  return ["+"+reward.currency+" валюты","+"+reward.accountXp+" XP",...(includeMaterials?mats:[]),...shards].join(" · ");
 }
 function renderReward(host,ref,pilotText){
  host.textContent=isLive()?rewardText(ref,false):pilotText;
  if(isLive())GearMaterialUI.append(host,NetworkLiveEconomy.preview(ref)?.materials);
 }
 let materialReceipt=null;
 async function collectRewards(){
  if(!isLive()||!session?.isReady())return;
  let result;
  try{result=await session.collect();}catch(_){result={ok:false,code:"REWARD_SYNC_FAILED"};}
  if(result.ok&&result.paid>0){
   const n=result.paid,part=n%10===1&&n%100!==11?"зацепку":
    n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?"зацепки":"зацепок";
   const shards=Object.entries(result.shardBreakdown||{}).map(([id,count])=>
    "+"+count+" осколков ("+(heroLabels[id]||id)+")");
   notice="Получено за "+n+" "+part+": +"+result.currency+
    " валюты · +"+result.xp+" XP"+
    (shards.length?" · "+shards.join(", "):"")+".";
   materialReceipt={text:notice,materials:result.materialBreakdown};
  }else if(!result.ok){
   materialReceipt=null;
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
 function orderLabel(o){
  if(!o)return "Без приказа";
  const target=o.kind==="type"?(types[o.targetId]||o.targetId):
   o.kind==="region"?"Сады над пропастью":
   o.kind==="hero"?(heroLabels[o.targetId]||o.targetId):
   (typeof GearData!=="undefined"?GearData.MATERIAL_LABELS[o.targetId]||o.targetId:o.targetId);
  return (o.kind==="type"?"Вид · ":o.kind==="material"?"Материал · ":
   o.kind==="hero"?"Осколки · ":"Регион · ")+target;
 }
 const orderKey=o=>o?o.kind+":"+o.targetId:null;
 function renderOrder(s,blocked,busy){
  const active=s.order,limit=s.config.guaranteeAfter,remaining=active?limit-active.misses:null;
  const progress=active?"Без совпадения: "+active.misses+"/"+limit+
   " · не позже "+remaining+" нов. донесени"+(remaining===1?"я":"й"):
   "Приоритет не выбран";
  $("net005OrderStatus").textContent=orderLabel(active);
  $("netuxOrderProgress").textContent=active?progress:"";
  $("netuxOrderOpen").disabled=blocked||busy||orderSubmitting;
  $("netuxOrderCurrent").textContent=orderLabel(active);
  $("netuxOrderCurrentProgress").textContent=active?progress+" · совпадение сбрасывает счётчик":
   "Гарантия работает только с действующим приказом.";
  const all=session.availableOrders(),tabs=$("netuxOrderTabs"),choices=$("net005OrderChoices");
  const tabNames={material:"Материал",hero:"Человек (осколки)",region:"Регион",type:"Вид зацепки"};
  const kinds=["material","hero","region","type"].filter(k=>all.some(o=>o.kind===k));
  if(!kinds.includes(orderTab))orderTab=kinds[0]||"type";
  tabs.replaceChildren();
  for(const kind of kinds){
   const b=button(tabNames[kind],"order-tab",kind);
   b.setAttribute("role","tab");b.setAttribute("aria-selected",String(kind===orderTab));
   b.disabled=orderSubmitting;
   tabs.append(b);
  }
  choices.replaceChildren();
  for(const o of all.filter(o=>o.kind===orderTab)){
   const key=orderKey(o),b=button(orderLabel(o).split(" · ").slice(1).join(" · "),"select-order",key);
   b.setAttribute("aria-pressed",String(key===orderDraftKey));
   b.disabled=blocked||busy||orderSubmitting;
   const hint=line(o.kind==="region"?"Все зацепки региона":
    o.kind==="hero"?"Осколки персонажа":
    o.kind==="material"?"Материалы":"Тип донесения","small");
   b.append(hint);
   if(o.kind==="material"){
    const wrap=document.createElement("div");wrap.className="material-order-option";
    wrap.append(b);wrap.insertAdjacentHTML("beforeend",GearMaterialUI.tile(o.targetId,null));choices.append(wrap);
   }else choices.append(b);
  }
  if(!all.length)choices.append(line("Сейчас нет доступных направлений поиска."));
  const draft=all.find(o=>orderKey(o)===orderDraftKey)||null;
  const actual=orderKey(active),changed=orderKey(draft)!==actual;
  const preview=draft?"После подтверждения: "+orderLabel(draft)+
   ". Вес подходящих шаблонов ×"+s.config.focusWeight+
   ". Гарантия: не позже "+limit+" новых донесений (счётчик начнётся заново при смене).":
   "Без приказа новые зацепки поступают без направленного приоритета.";
  $("netuxOrderPreview").textContent=preview+" Уже лежащие на доске донесения не изменятся.";
  $("netuxOrderApply").disabled=blocked||busy||orderSubmitting||!changed||!draft;
  $("netuxOrderClear").disabled=blocked||busy||orderSubmitting||!active;
  $("netuxOrderMessage").textContent=orderFeedback;
  $("netuxOrderDialog").setAttribute("aria-busy",String(orderSubmitting));
 }
 function openOrder(){
  if(!session?.isReady()||orderSubmitting)return;
  const s=session.read(),all=session.availableOrders();
  orderDraftKey=orderKey(s.order);orderTab=s.order?.kind||
   (all.some(o=>o.kind==="material")?"material":all[0]?.kind||"type");
  orderFeedback="";renderOrder(s,session.isBlocked(),session.isBusy());
  const dialog=$("netuxOrderDialog");
  if(!dialog.open)dialog.showModal();
  const active=dialog.querySelector('#net005OrderChoices [aria-pressed="true"]');
  (active||dialog.querySelector('#netuxOrderTabs [aria-selected="true"]'))?.focus();
 }
 async function submitOrder(next){
  if(orderSubmitting||!session?.isReady()||session.isBusy())return;
  const before=session.read()?.order;
  if(orderKey(before)===orderKey(next))return;
  orderSubmitting=true;orderFeedback="";
  renderOrder(session.read(),session.isBlocked(),session.isBusy());
  const result=await change("order",next);
  orderSubmitting=false;
  if(result?.ok){
   $("netuxOrderDialog").close();
   orderFeedback="";
   notice=next?"Приказ отдан: "+orderLabel(next)+". Новые поступления будут учитывать приоритет.":
    "Приказ отменён. Будущие зацепки поступают без приоритета.";
  }else{
   orderFeedback=errorText[result?.code]||"Приказ не подтверждён. Проверьте сохранение.";
  }
  render();
 }
 function updateSelection(s,blocked,busy){
  const selected=s?.board?.find(c=>c.id===selectedClueId);
  const title=$("netuxSelectedTitle"),start=$("netuxStartSelected"),sim=$("netuxSimulateSelected");
  if(title)title.textContent=selected?clueTitle(selected)+" · ур. "+selected.level:
   "Нет доступных донесений";
  const mastered=selected&&!blocked&&session.canSimulate(selected.id);
  const cause=$("netuxSelectedCause");
  if(cause)cause.textContent=!selected?"Нет доступных донесений":
   (selected.threatTag?"Вручную: базовая награда +1 сведение об угрозе. ":
    "Вручную: базовая награда без сведений об угрозе. ")+
   (mastered?"Симуляция: та же базовая награда, но без сведений.":
    "Симуляция после освоения: та же базовая награда, но без сведений.");
  if(start)start.disabled=!selected||blocked||busy;
  if(sim){
   sim.disabled=!mastered||busy;
   sim.textContent=mastered?"Симулировать":"Не освоено";
   sim.title=mastered?"Та же базовая награда, но без сведений об угрозе":
    "Симуляция закрыта · требуется освоение";
  }
  $("net004Clues")?.querySelectorAll(".net004-clue").forEach(item=>{
   const pressed=Number(item.querySelector("[data-net-value]")?.dataset.netValue)===selectedClueId;
   item.dataset.selected=String(pressed);
   item.querySelector("button")?.setAttribute("aria-pressed",String(pressed));
  });
 }
 function renderResultCauses(a){
  const host=$("netuxResultCauses");host.replaceChildren();
  if(!Array.isArray(a.waveSummaries))return;
  host.append(line("Подготовка · "+(prep[a.preparation]||a.preparation)+": "+
   preparationEffect(a.preparation)));
  host.append(line("Подход · "+(approach[a.approach]||a.approach)+": "+
   a.waveSummaries.length+(a.waveSummaries.length===1?" бой":" боя")+
   ". Базовая награда не зависит от подхода."));
  a.waveSummaries.forEach((wave,i)=>{
   const survivors=Math.round(25*(1-wave.knockedOut/wave.deployed));
   const pace=Math.max(0,5-Math.max(0,wave.allyActions-wave.paceBudget));
   const row=document.createElement("div");row.className="netux-score-cause";
   row.append(line("Бой "+(i+1)+" · "+wave.score+"/100","strong"),
    line("База 60 · первая цель: +"+(wave.objectiveDone?10:0)+
     " · выжившие "+(wave.deployed-wave.knockedOut)+"/"+wave.deployed+": +"+survivors+
     " · темп: +"+pace+" ("+wave.allyActions+" действий при ориентире "+wave.paceBudget+")","small"));
   host.append(row);
  });
 }
 function resultIntel(s,clue,tracked){
  if(clue.threatTag!=="weekly-gardens"||!tracked)
   return "Дополнительных сведений об угрозе эта операция не добавит.";
  if(typeof WeeklyThreatCore==="undefined")
   return "После завершения: +1 сведение для текущей UTC-недели.";
  const start=WeeklyThreatCore.weekStart(Date.now()),week=WeeklyThreatCore.weekId(start);
  const current=Math.min(3,s.threatIntel[week]??0);
  if(current===0)return "Сведения: 0 → 1 после завершения. До усиленной подготовки угрозы ещё 1.";
  if(current===1)return "Сведения: 1 → 2 после завершения. Откроется усиленная подготовка угрозы.";
  return "Усиленная подготовка уже доступна. После завершения ещё +1 в запас; дополнительного усиления нет.";
 }
 function render(){
  if(!mounted)return;
  const s=session.read(),blocked=session.isBlocked(),busy=session.isBusy();
  $("net004Notice").textContent=blocked?
   "Режим заблокирован: нет безопасной записи. Перезагрузите страницу.":
   notice||(isLive()?"":
    "Пробный режим без наград и расхода энергии. Данные хранятся отдельно.");
  if(!blocked&&materialReceipt?.text===notice)GearMaterialUI.append($("net004Notice"),materialReceipt.materials);
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
  renderOrder(s,blocked,busy);
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
   const reward=line(isLive()?rewardText(clue.rewardRef,false):fullReward,"span");reward.className="netux-clue-reward";
   const tags=document.createElement("div");tags.className="netux-clue-tags";
   if(session.canSimulate(clue.id))tags.append(line("Освоено","span"));
   if(clue.threatTag){
    const threat=line("След угрозы","span");threat.className="netux-threat-tag";
    tags.append(threat);
   }
   const story=operationStory(clue);
   choice.title=clueTitle(clue)+" · "+(story?story.context+" · ":"")+fullReward;
   choice.setAttribute("aria-label",clueTitle(clue)+", уровень "+clue.level+
    ". "+fullReward+(session.canSimulate(clue.id)?". Освоено":"")+
    (clue.threatTag?". След угрозы":""));
   choice.append(top,title,reward,tags);el.append(choice);
   if(isLive())GearMaterialUI.append(el,NetworkLiveEconomy.preview(clue.rewardRef)?.materials);
   cluesEl.append(el);
  }
  updateSelection(s,blocked,busy);
  if(s.active&&s.active.phase!=="result"){
   const a=s.active,c=a.clue,story=operationStory(c);
   active.dataset.phase=a.phase;
   const chosen=a.approach&&c.approaches.find(x=>x.id===a.approach);
   $("net004ActiveTitle").textContent=clueTitle(c);
   $("netuxBriefMeta").textContent=(types[c.type]||c.type)+" · ур. "+c.level;
   $("netuxBriefStage").textContent=a.phase==="brief"?"1 · ПОДГОТОВКА":
    a.phase==="approach"?"2 · ВЫБОР ПОДХОДА":"3 · ВЫЛАЗКА";
   $("net004ActiveDetail").textContent=a.phase==="brief"?
    "Выберите один эффект подготовки. Для 3★ нужно 90/100: первая гибель главной цели, выжившие и темп.":
    a.phase==="approach"?"Теперь выберите: один плотный бой или два отдельных боя с восстановлением.":
    "Контрольная точка · бой "+(a.wave+1)+"/"+chosen.waves+
     ". Каждый бой начинается с полным восстановлением отряда."+
     (a.wave>0&&!Array.isArray(a.waveSummaries)?
      " Старое сохранение без отчёта S1: отмените вылазку, чтобы вернуть зацепку.":
      a.waveSummaries?.length?" Предыдущий бой: "+a.waveSummaries.at(-1).score+"/100 S1.":"");
   const selectedRoute=chosen?routeFacts(c,chosen):null;
   $("netuxDecisionPreview").textContent=a.phase==="brief"?
    "Симуляция после освоения даст ту же базовую награду, но не добавит сведений об угрозе.":
    (prep[a.preparation]||a.preparation)+": "+preparationEffect(a.preparation)+
    (chosen?" Подход: "+(approach[chosen.id]||chosen.id)+". Первым уничтожьте: "+
     (selectedRoute?.target||"отмеченную цель")+".":"");
   const routes=c.approaches.map(x=>(approach[x.id]||x.id)+
    " — "+x.waves+(x.waves===1?" бой":" боя")).join(" · ");
   $("netuxBriefIntel").textContent=(story?story.context+" "+story.tactic+" ":"")+(chosen?
    (approach[chosen.id]||chosen.id)+" · "+chosen.waves+
    (chosen.waves===1?" отдельный бой":" отдельных боя"):
    "Доступные пути: "+routes)+". Противники: "+enemySummary(c,a.approach)+". "+
    preparationEffect(a.preparation);
   $("netuxBriefReward").textContent=isLive()?rewardText(c.rewardRef):
    "Пробный режим · реальных наград нет.";
   $("netuxBriefThreat").textContent=c.threatTag?
    "Награда +1 сведение после завершения.":"Награда без сведений об угрозе.";
   renderEnemySummary($("netuxBriefEnemies"),c,a.approach,selectedRoute?.target||null);
   const slot=$("net004Choices");slot.replaceChildren();
   if(a.phase==="brief")for(const id of c.preparationIds){
    const choice=button(prep[id]||id,"prepare",id);
    choice.append(line(preparationEffect(id),"small"));
    slot.append(choice);
   }
   if(a.phase==="approach")for(const route of c.approaches){
    const facts=routeFacts(c,route),counts=facts.counts.filter(Boolean).join(" + ");
    const choice=button((approach[route.id]||route.id)+" · "+route.waves+
     (route.waves===1?" бой":" боя"),"approach",route.id);
    choice.append(line((counts?"Противники по боям: "+counts+". ":"")+
     (route.waves===1?"Все противники сразу; без промежуточного восстановления.":
      "Полное восстановление между боями.")+" Награда та же.","small"));
    slot.append(choice);
   }
   $("net004Fight").textContent=a.wave>0?"Продолжить вылазку":"Выбрать отряд";
   $("net004Fight").hidden=a.phase!=="battle";
   $("net004Fight").disabled=busy||blocked||(a.wave>0&&!Array.isArray(a.waveSummaries));
   $("net004Cancel").disabled=busy||blocked;
  }
  if(s.active?.phase==="result"){
   const a=s.active,c=a.clue,tracked=Array.isArray(a.waveSummaries);
   const score=a.score,stars=score>=90?3:score>=75?2:1;
   $("net004ResultTitle").textContent=clueTitle(c);
   $("netuxResultRating").textContent=tracked?stars+"★ · "+score+"/100":"Оценка не подтверждена";
   $("net004ResultDetail").textContent=tracked?
    "Итог S1: "+score+"/100 — средний результат отдельных боёв ("+
    a.waveSummaries.map(x=>x.score+"/100").join(" → ")+")."+
    (operationStory(c)?" "+operationStory(c).success:""):
    "Старое пробное завершение: оценка S1 недоступна. Не считать освоением.";
   renderResultCauses(a);
   $("netuxResultMastery").textContent=!tracked?
    "Нет подтверждённого ручного освоения.":
    score>=Math.max(90,s.config.masteryScore)?
     "Освоение: после завершения станет доступна симуляция этого шаблона на этом уровне. Она даст ту же базовую награду без сведений.":
     "Освоение пока закрыто: требуется "+Math.max(90,s.config.masteryScore)+"/100 за ручную операцию.";
   $("netuxResultIntel").textContent=resultIntel(s,c,tracked);
   renderReward($("netuxResultReward"),c.rewardRef,"Пробный режим · награды не начисляются.");
   $("net004Finish").textContent=isLive()?"Завершить и получить":"Завершить испытание";
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
   if(["start","simulate","order","clear-order","open-order","close-order",
    "order-tab","select-order","apply-order","start-selected","simulate-selected","pick"].includes(action))return;
   if(action!=="fight"&&action!=="finder-back")el.disabled=blocked||busy||
    (action==="finish"&&s.active?.phase!=="result");
  });
  if(typeof WeeklyThreatUI!=="undefined")WeeklyThreatUI.render();
 }
 async function change(action,value){
  if(!session||session.isBlocked())return {ok:false,code:"SESSION_BLOCKED_RELOAD_REQUIRED"};
  notice="";materialReceipt=null;
  let result;
  try{result=await session.change(action,value);}catch(_){result={ok:false,code:"SAVE_FAILED"};}
  if(!result.ok)notice=errorText[result.code]||"Действие отклонено: "+result.code;
  if(result.ok&&isLive()&&(action==="finish"||action==="simulate")){
   await collectRewards();return result;
  }
  render();
  if(result.ok&&action==="approach"&&session.read()?.active?.phase==="battle")
   onSquad();
  return result;
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
   if(action==="open-report"){$("netuxReportDialog").showModal();return;}
   if(action==="open-order"){openOrder();return;}
   if(action==="close-order"){$("netuxOrderDialog").close();return;}
   if(action==="order-tab"){
    orderTab=b.dataset.netValue;orderFeedback="";
    renderOrder(session.read(),session.isBlocked(),session.isBusy());
    $("netuxOrderTabs").querySelector('[aria-selected="true"]')?.focus();return;
   }
   if(action==="select-order"){
    orderDraftKey=b.dataset.netValue;orderFeedback="";
    renderOrder(session.read(),session.isBlocked(),session.isBusy());
    [...$("net005OrderChoices").querySelectorAll("button")].find(x=>
     x.dataset.netValue===orderDraftKey)?.focus();return;
   }
   if(action==="apply-order"){
    const target=session.availableOrders().find(o=>orderKey(o)===orderDraftKey);
    if(target)void submitOrder(target);return;
   }
   if(action==="clear-order"){void submitOrder(null);return;}
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
    "simulate"].includes(action))return;
   let arg=b.dataset.netValue;
   if(action==="start"||action==="simulate")arg=Number(arg);
   void change(action,arg);
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
  if(isLive()&&session.isReady()){
   void change("order",{kind:"material",targetId:materialId}).then(result=>{
    if(result?.ok)notice="Приказ на материал "+
     (typeof GearData!=="undefined"?GearData.MATERIAL_LABELS[materialId]||materialId:materialId)+
     " подтверждён. Он влияет на будущие зацепки.";
    render();
   }); 
  }else{
   notice="Пробная разведсеть: для материала "+materialId+
    " нет подтверждённого источника. Здесь не выдаются предметы и награды.";
  }
  render();
  return true;
 }
 return Object.freeze({mount,render,openFromFinder});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=NetworkPilotUI;
