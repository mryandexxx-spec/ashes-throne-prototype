const HEROES = [
  {id:"kael",name:"Каэль Ворон",role:"Страж",hp:120,atk:24,speed:110,side:"ally",glyph:"♜"},
  {id:"lyra",name:"Лира Соль",role:"Следопыт",hp:88,atk:31,speed:155,side:"ally",glyph:"♧"},
  {id:"darin",name:"Дарин Пепельный",role:"Мечник",hp:105,atk:27,speed:125,side:"ally",glyph:"⚔"},
  // Combat-007 test-only healer, not canonical or final balance.
  {id:"medic-demo",name:"Учебный лекарь",role:"Учебная поддержка",hp:90,atk:14,speed:115,side:"ally",glyph:"✚"},
  {id:"ves",name:"Вестник Конклава",role:"Противник",hp:90,atk:18,speed:105,side:"enemy",glyph:"☠"},
  {id:"shade",name:"Теневой клинок",role:"Противник",hp:78,atk:22,speed:135,side:"enemy",glyph:"♟"},
  // Demo-only copies: no new combat stats or lore. First mission still uses two enemies.
  {id:"ves-2",name:"Вестник Конклава II",role:"Противник",hp:90,atk:18,speed:105,side:"enemy",glyph:"☠"},
  {id:"shade-2",name:"Теневой клинок II",role:"Противник",hp:78,atk:22,speed:135,side:"enemy",glyph:"♟"},
  {id:"ves-3",name:"Вестник Конклава III",role:"Противник",hp:90,atk:18,speed:105,side:"enemy",glyph:"☠"}
];
const $=s=>document.querySelector(s);
let engine, scene, meshes={};
let arenaCamera=null;
// Combat-008B: allies are near the viewer, enemies farther away.
const ARENA_VIEW=Object.freeze({alpha:-3*Math.PI/4,beta:.96,radius:12,targetY:.9});
// Staggered 3-front / 2-rear formation on each team.
const FORMATION_SPACING=1.9;
function formationPosition(side,slot,count){
 const front=Math.min(3,count);
 const rear=count-front;
 const isRear=slot>=front;
 const rowSize=isRear?rear:front;
 const lane=isRear?slot-front:slot;
 const direction=side==="ally"?-1:1;
 return {x:direction*(isRear?4.05:2.45),z:(lane-(rowSize-1)/2)*FORMATION_SPACING};
}
let renderLoopRunning=false;
let indicatorNodes={}; // Rebuilt on combat HUD changes, not each animation frame.
let selectedAbility="basic";
// Combat-004: manual remains the default. Only one cancellable timer may run.
let autoBattle=false;
let autoTimer=null;
// Combat-006: presentation waits, never a delay inside CombatCore.
let visualTransition=null; // "wave" or "result"
let visualWaveFighters=null;
function presentationFighters(){return visualWaveFighters||state.fighters;}
function isVisualTransition(){return visualTransition!==null;}
function captureResolvedVisuals(beforeFighters){
 // Non-rendering contexts still finish immediately; never let graphics gate rules.
 if(!scene||!engine)return;
 BattleAnimation.enqueue(state.events);
 const events=state.events||[];
 const waveChanged=events.some(event=>event.type==="wave-start");
 const ended=events.some(event=>event.type==="battle-end");
 if(!waveChanged&&!ended)return;
 cancelAutoTimer();
 visualTransition=waveChanged?"wave":"result";
 if(waveChanged){
  // Core advances waves synchronously; retain the old lineup until its
  // attack/death events have been drawn. This does not restore combat HP.
  const dead=new Set(events.filter(e=>e.type==="death").map(e=>e.targetId));
  visualWaveFighters=beforeFighters.map(f=>({...f,hp:dead.has(f.id)?0:f.hp}));
 }
}
function finishVisualTransition(){
 if(!visualTransition||BattleAnimation.pending()!==0)return;
 visualTransition=null;
 visualWaveFighters=null;
 syncBattleUI(); // campaign result, reward UI, or next wave auto-step
}
function cancelVisualTransition(){
 visualTransition=null;visualWaveFighters=null;
}
// All battle presentation timing shares one speed source. Future visual
// effects can call BattleSpeed.multiplier() / BattleSpeed.duration(baseMs).
const AUTO_STEP_MS=350;
function setAutoSpeed(speed){
 if(!BattleSpeed.levels.includes(speed))return false;
 if(!state.active||document.hidden||!$("#battle").classList.contains("active"))return false;
 if(BattleSpeed.get()===speed)return true;
 BattleSpeed.set(speed);
 if(autoBattle)cancelAutoTimer(); // replace an auto timer only if autoplay is running
 syncBattleUI();
 return true;
}
function cancelAutoTimer(){
 if(autoTimer!==null){clearTimeout(autoTimer);autoTimer=null;}
}
function queueAutoAction(){
 if(autoTimer!==null||isVisualTransition()||!autoBattle||!state.active||document.hidden||
    !$("#battle").classList.contains("active"))return;
 autoTimer=setTimeout(()=>{
  autoTimer=null;
  if(isVisualTransition()||!autoBattle||!state.active||document.hidden||
     !$("#battle").classList.contains("active"))return;
  const before=state.fighters.map(f=>({...f}));
  if(!CombatCore.performAutoAction(state)){setAutoBattle(false);return;}
  captureResolvedVisuals(before);
  selectedAbility="basic";
  syncBattleUI();
 },BattleSpeed.duration(AUTO_STEP_MS));
}
function setAutoBattle(enabled){
 cancelAutoTimer();
 autoBattle=!!enabled&&state.active&&$("#battle").classList.contains("active");
 if(autoBattle)selectedAbility="basic";
 const button=$("#autoBattleBtn");
 if(button){
  button.textContent=autoBattle?"Ручной бой":"Автобой";
  button.setAttribute("aria-pressed",String(autoBattle));
 }
 syncBattleUI();
 return autoBattle;
}
// Squad-001: prepare the party immediately before each battle, independently of collection.
const ALLIES=HEROES.filter(h=>h.side==="ally");
const ENEMIES=HEROES.filter(h=>h.side==="enemy");
const MAX_SQUAD=5;
const storageAdapter=typeof SaveCore==="undefined"?null:SaveCore;
const loadedProgress=storageAdapter?storageAdapter.load(ALLIES,()=>window.localStorage):null;
const progress=loadedProgress?loadedProgress.progress:ProgressCore.createProgress(ALLIES);
let saveAvailable=loadedProgress?loadedProgress.available:false;
const campaignLoaded=CampaignCore.load(()=>window.localStorage);
const campaignProgress=campaignLoaded.campaign;
let campaignSaveAvailable=campaignLoaded.available;
let battleIsCampaign=false;
let missionResultShown=false;
let missionResultRecorded=false;
let activeMissionId=null;
let lastMissionStars=0;
function persistProgress(){
 if(storageAdapter)saveAvailable=storageAdapter.save(progress,()=>window.localStorage);
 const notice=$("#progressSaveNote");
 if(notice)notice.textContent=saveAvailable
  ?"Прогресс сохраняется в этом браузере. Очистка данных Safari может его удалить."
  :"Сохранение сейчас недоступно. Прогресс может сброситься после перезагрузки.";
}

let selectedHeroId=ALLIES[0].id;
// Keep accepted demo encounters unchanged by default.
let selectedPartyIds=ALLIES.filter(h=>h.id!=="medic-demo").map(h=>h.id);
let squadReturnScreen="home";
let state=CombatCore.createBattle([...ALLIES,...ENEMIES.slice(0,2)]);
function progressedHero(hero){return ProgressCore.heroStats(progress,hero);}
function selectedParty(){return ALLIES.filter(h=>selectedPartyIds.includes(h.id)).map(progressedHero);}
function battleLineup(){
 // The original encounter is unchanged; mission #2 tests five enemies at once.
 const enemies=battleIsCampaign&&activeMissionId==="demo-mission-2"?ENEMIES:ENEMIES.slice(0,2);
 return [...selectedParty(),...enemies];
}
// Optional future wave rosters live in mission data. Existing missions have no
// future waves, so their accepted encounters and balance remain unchanged.
function battleFutureWaves(){
 const mission=battleIsCampaign&&MissionData.get(activeMissionId);
 return (mission&&mission.futureEnemyWaves||[]).map(ids=>ids.map(id=>{
  const enemy=ENEMIES.find(h=>h.id===id);
  if(!enemy)throw Error("Unknown wave enemy template: "+id);
  return enemy;
 }));
}
function renderSquad(){
 const chosen=selectedParty();
 $("#squadCount").textContent=chosen.length+"/"+MAX_SQUAD;
 $("#squadRoster").innerHTML=ALLIES.map(progressedHero).map(h=>{
  const active=selectedPartyIds.includes(h.id);
  return `<button type="button" class="squad-choice ${active?"chosen":""}" data-hero-id="${h.id}" aria-pressed="${active}"><span class="squad-glyph">${h.glyph}</span><span><b>${h.name}</b><small>${h.role} · HP ${h.hp} · ATK ${h.atk}</small></span><strong>${active?"✓":"+"}</strong></button>`;
 }).join("");
 $("#squadSlots").innerHTML=Array.from({length:MAX_SQUAD},(_,i)=>{
  const h=chosen[i];
  return `<div class="squad-slot ${h?"filled":""}"><span class="squad-slot-number">${i+1}</span><span class="squad-slot-content">${h?h.name:"Свободно"}</span></div>`;
 }).join("");
 $("#squadHint").textContent=chosen.length?"Выбрано героев: "+chosen.length+". Можно взять меньше пяти.":"Выбери хотя бы одного героя.";
 $("#squadStart").disabled=chosen.length===0;
 document.querySelectorAll("[data-hero-id]").forEach(btn=>btn.addEventListener("click",()=>{
  toggleSquadHero(btn.dataset.heroId);
 }));
}
function toggleSquadHero(id){
 if(!ALLIES.some(h=>h.id===id))return false;
 if(selectedPartyIds.includes(id))selectedPartyIds=selectedPartyIds.filter(x=>x!==id);
 else if(selectedPartyIds.length<MAX_SQUAD)selectedPartyIds=[...selectedPartyIds,id];
 else return false;
 renderSquad();
 return true;
}
function openSquad(returnTo="home"){
 squadReturnScreen=returnTo;
 renderSquad();
 showScreen("squad");
}
function showScreen(id){
 if(id!=="battle"){cancelAutoTimer();autoBattle=false;cancelVisualTransition();BattleAnimation.clear();stopBattleRendering();}
 // Combat-008A: release the document scroll while the arena owns the viewport.
 // Guard document.body for headless DOM tests and embedded integrations.
 if(document.body&&document.body.classList)document.body.classList.toggle("battle-mode",id==="battle");
 document.querySelectorAll(".screen").forEach(x=>x.classList.remove("active"));
 $("#"+id).classList.add("active");
 if(id==="collection")renderHeroes();
 if(id==="campaign")renderCampaign();
 if(id==="heroDetail")renderHeroDetail();
 if(id==="battle"){
  battleIsCampaign=squadReturnScreen==="campaign"&&!!activeMissionId;
  const label=$("#battleMissionLabel");
  if(label)label.textContent=battleIsCampaign?MissionData.get(activeMissionId).title:"ТЕСТОВАЯ АРЕНА";
  try {
   if(typeof BABYLON==="undefined" || !BABYLON.Engine || !BABYLON.Scene)
    throw new Error("Babylon.js is unavailable");
   if(!engine)initBabylon();
   resetArenaCamera(); // Start every encounter from the approved perspective.
   engine.resize();
   resetBattle();
   updateMeshes();
   startBattleRendering();
   const notice=$("#battleLoadError");
   if(notice)notice.hidden=true;
  } catch(error) {
   cancelAutoTimer();autoBattle=false;
   console.error("Не удалось запустить 3D-арену:",error);
   stopBattleRendering();
   if(scene){try{scene.dispose();}catch(cleanupError){console.error(cleanupError);}}
   if(engine){try{engine.dispose();}catch(cleanupError){console.error(cleanupError);}}
   scene=undefined;engine=undefined;arenaCamera=null;meshes={};indicatorNodes={};renderLoopRunning=false;
   showScreen("squad");
   const notice=$("#battleLoadError");
   if(notice)notice.hidden=false;
  }
 }
}
document.querySelectorAll("[data-screen]").forEach(b=>b.addEventListener("click",()=>{
 if(b.dataset.screen==="battle")openSquad("home");
 else showScreen(b.dataset.screen);
}));
$("#startBattle").addEventListener("click",()=>openSquad("home"));
function openCampaignMission(id){
 const entry=CampaignData.getMission(id);
 if(!entry||!CampaignData.available(entry,campaignProgress)||!MissionData.get(id))return false;
 activeMissionId=id;
 openSquad("campaign");
 return true;
}
// Delegation allows cards to be rebuilt without installing duplicate handlers.
$("#campaignMissions").addEventListener("click",event=>{
 const simulate=event.target.closest("[data-simulate-mission]");
 if(simulate&&simulate.dataset.simulateMission&&$("#campaignMissions").contains(simulate)){
  simulateMission(simulate.dataset.simulateMission);
  return;
 }
 const button=event.target.closest("[data-campaign-mission]");
 if(button&&$("#campaignMissions").contains(button))openCampaignMission(button.dataset.campaignMission);
});
$("#squadBack").addEventListener("click",()=>showScreen(squadReturnScreen));
// If Babylon.js cannot load, show a recoverable message instead of an uncaught crash.
const retryLoad=$("#retryBattleLoad");
if(retryLoad)retryLoad.addEventListener("click",()=>window.location.reload());
$("#squadStart").addEventListener("click",()=>{
 if(selectedParty().length===0)return;
 showScreen("battle");
});
function renderHeroes(){
 $("#heroList").innerHTML=ALLIES.map(progressedHero).map(h=>`<button type="button" class="hero-card hero-open" data-open-hero="${h.id}"><div class="hero-avatar">${h.glyph}</div><h3>${h.name}</h3><p>${h.role} · Уровень ${h.level}</p><div class="stats"><span>Здоровье ${h.hp}</span><span>Сила ${h.atk}</span></div><span class="hero-open-hint">Открыть карточку →</span></button>`).join("");
 document.querySelectorAll("[data-open-hero]").forEach(node=>node.addEventListener("click",()=>openHeroDetail(node.dataset.openHero)));
}
function openHeroDetail(id){
 if(!ALLIES.some(h=>h.id===id))return false;
 selectedHeroId=id;
 showScreen("heroDetail");
 return true;
}
function renderHeroDetail(){
 const base=ALLIES.find(h=>h.id===selectedHeroId);
 if(!base)return;
 const hero=progressedHero(base);
 const cost=ProgressCore.upgradeCost(progress,base.id);
 const next=cost===null?null:ProgressCore.heroStats(progress,base,hero.level+1);
 $("#detailName").textContent=hero.name;
 $("#detailRole").textContent=hero.role+" · Демонстрационный персонаж";
 $("#detailGlyph").textContent=hero.glyph;
 $("#detailStats").innerHTML=`<div><span>Здоровье</span><strong>${hero.hp} HP</strong></div><div><span>Атака</span><strong>${hero.atk} ATK</strong></div><div><span>Скорость</span><strong>${hero.speed}</strong></div>`;
 $("#detailLevel").textContent="Уровень "+hero.level+" / "+ProgressCore.MAX_LEVEL;
 $("#detailWallet").textContent=String(progress.materials);
 $("#detailCost").textContent=cost===null?"Максимальный уровень":cost+" мат.";
 $("#detailPreview").textContent=next?next.hp+" HP · "+next.atk+" ATK":"Достигнут максимум";
 $("#detailUpgrade").disabled=!ProgressCore.canUpgrade(progress,base.id);
 $("#detailNotice").textContent=cost===null?"Герой достиг тестового максимума.":progress.materials<cost?"Недостаточно материалов.":"Улучшение доступно.";
 const saveNote=$("#progressSaveNote");
 if(saveNote)saveNote.textContent=saveAvailable
  ?"Прогресс сохраняется в этом браузере. Очистка данных Safari может его удалить."
  :"Сохранение сейчас недоступно. Прогресс может сброситься после перезагрузки.";
}
$("#detailBack").addEventListener("click",()=>showScreen("collection"));
$("#detailHome").addEventListener("click",()=>showScreen("home"));
$("#detailUpgrade").addEventListener("click",()=>{
 if(ProgressCore.upgrade(progress,selectedHeroId)){
  persistProgress();
  renderHeroDetail();
  renderHeroes();
 }
});

function renderCampaign(){
 const list=$("#campaignMissions");
 const chapters=CampaignData.allChapters();
 list.innerHTML=chapters.map(chapter=>{
  const stats=CampaignData.chapterProgress(chapter.id,campaignProgress);
  const routes=CampaignData.routes().filter(route=>route.chapterId===chapter.id);
  const cards=routes.map(route=>{
   const missions=CampaignData.missions(chapter.id).filter(entry=>entry.routeId===route.id);
   if(!missions.length)return "";
   const items=missions.map(entry=>{
   const mission=MissionData.get(entry.missionId);
   if(!mission)return "";
   const available=CampaignData.available(entry,campaignProgress);
   const completed=campaignProgress.completed[entry.missionId]===true;
   const best=campaignProgress.bestStars[entry.missionId]||0;
   const status=completed?"Пройдено · Повторное прохождение доступно":available?"Не пройдено":"Заблокировано";
   const criteria=mission.stars.map((star,index)=>
    `<li><span class="mission-criteria-star">${index+1}★</span><span>${star.hint}</span></li>`).join("");
   return `<article class="campaign-panel campaign-mission"><div class="node">I</div><div><h3>${mission.title}</h3><p>${entry.description}</p><p class="campaign-mission-status">${status}</p><p class="mission-stars">Лучшая оценка: ${"★".repeat(best)+"☆".repeat(3-best)} (${best}/3)</p><ul class="mission-criteria" aria-label="Условия получения звёзд">${criteria}</ul><div class="campaign-mission-actions"><button type="button" class="primary" data-campaign-mission="${mission.id}" ${available?"":"disabled"}>${completed?"Пройти ещё раз":available?"Вступить в бой":"Недоступно"}</button>${best===3?`<button type="button" class="ghost" data-simulate-mission="${mission.id}">Симуляция</button>`:""}</div></div></article>`;
   }).join("");
   return `<div class="campaign-route"><h3>${route.title}</h3>${items}</div>`;
  }).join("");
  return `<section class="campaign-chapter"><h2>${chapter.title}</h2><p class="muted">Пройдено миссий: ${stats.completed}/${stats.total} · Звёзд: ${stats.stars}/${stats.maxStars}</p>${cards}</section>`;
 }).join("");
 const note=$("#campaignSaveStatus");
 if(note)note.textContent=campaignSaveAvailable
  ?"Статус прохождения хранится в этом браузере."
  :"Сохранение кампании недоступно. После перезагрузки отметка может исчезнуть.";
}
// Simulation is an independent successful reward claim, not a fabricated combat result.
function simulateMission(id){
 const entry=CampaignData.getMission(id);
 if(!entry||!CampaignData.available(entry,campaignProgress)||campaignProgress.bestStars[id]!==3)return false;
 const reward=ProgressCore.awardVictory(progress,{active:false,winner:"ally",rewardClaimed:false});
 if(reward<=0)return false;
 persistProgress();
 $("#simulationText").textContent="Поздравляем с победой! "+MissionData.get(id).title+
  ". Награда: +"+reward+" учебный материал. Всего: "+progress.materials+".";
 $("#simulationDialog").showModal();
 return true;
}
const simulationClose=$("#simulationClose");
if(simulationClose)simulationClose.addEventListener("click",()=>$("#simulationDialog").close());
function renderMissionResult(){
 const won=state.winner==="ally";
 const entry=CampaignData.getMission(activeMissionId);
 const chapter=entry&&CampaignData.allChapters().find(c=>c.id===entry.chapterId);
 const chapterLabel=$("#missionResultChapter");
 if(chapterLabel)chapterLabel.textContent=chapter?chapter.title:"Кампания";
 $("#missionResultTitle").textContent=won?"Миссия пройдена":"Миссия не пройдена";
 $("#missionResultText").textContent=won
  ?MissionData.get(activeMissionId).title+" завершена. +1 учебный материал. Всего: "+progress.materials
  :"Отряд потерпел поражение. Учебные материалы не начислены.";
 const grade=$("#missionResultStars");
 if(grade){
  const best=campaignProgress.bestStars[activeMissionId]||0;
  grade.textContent=won
   ?"Оценка: "+("★".repeat(lastMissionStars)+"☆".repeat(3-lastMissionStars))+
      " · Лучший результат: "+best+"/3 · Действий союзников: "+state.allyActions
   :"Оценка: ☆☆☆ (0/3)";
 }
 $("#missionResultRetry").textContent=won?"Пройти ещё раз":"Попробовать снова";
}
$("#missionResultBack").addEventListener("click",()=>showScreen("campaign"));
$("#missionResultRetry").addEventListener("click",()=>activeMissionId&&openCampaignMission(activeMissionId));
$("#missionResultHome").addEventListener("click",()=>showScreen("home"));

function livingEnemies(){return CombatCore.livingEnemies(state.fighters);}
function renderBattleLog(){
 const summary=$("#battleLogSummary");
 const content=$("#battleLogEntries");
 if(!summary||!content)return;
 const lines=CombatLog.lines(state.events||[],state.fighters);
 summary.textContent="Журнал боя · "+lines.length+" событий";
 content.textContent=lines.length?lines.map((line,i)=>(i+1)+". "+line).join("\n"):"Пока нет событий.";
}
// Combat-008D: show the actor whose turn is active, not the selected target.
// Levels exist only when provided by current fighter data.
function renderCurrentFighterHud(){
 const panel=$("#currentFighterHud");
 if(!panel)return;
 const actor=state.active&&!isVisualTransition()?state.fighters[state.currentActor]:null;
 const side=$("#currentFighterSide"),level=$("#currentFighterLevel");
 const name=$("#currentFighterName"),hp=$("#currentFighterHp");
 const stats=$("#currentFighterStats"),fill=$("#currentFighterHealthFill");
 panel.classList.toggle("enemy",!!actor&&actor.side==="enemy");
 if(!actor){
  side.textContent=isVisualTransition()?"ПЕРЕХОД":"ОЧЕРЕДЬ ХОДОВ";
  level.textContent="";
  name.textContent=isVisualTransition()?"Завершение действий":state.active?"Ожидание бойца":"Бой завершён";
  hp.textContent="";stats.textContent="";fill.style.width="0%";
  return;
 }
 side.textContent=actor.side==="ally"?"СОЮЗНИК":"ПРОТИВНИК";
 level.textContent=Number.isInteger(actor.level)&&actor.level>0?"Ур. "+actor.level:"";
 name.textContent=actor.name;
 hp.textContent="HP "+Math.max(0,actor.hp)+"/"+actor.maxHp;
 stats.textContent="АТК "+actor.atk+" · СКР "+actor.speed;
 fill.style.width=Math.max(0,Math.min(100,actor.hp/Math.max(1,actor.maxHp)*100))+"%";
}
function syncBattleUI(){
 if(!state.active){cancelAutoTimer();autoBattle=false;}
 // Commit battle outcome immediately as before, even if the player leaves
 // the arena before the final animation ends. Only visual navigation waits.
 const awarded=ProgressCore.awardVictory(progress,state);
 if(awarded>0)persistProgress();
 if(battleIsCampaign&&!state.active&&!missionResultRecorded){
  const result=CampaignCore.recordResult(campaignProgress,activeMissionId,state);
  lastMissionStars=result.earned;
  if(result.improved)
   campaignSaveAvailable=CampaignCore.save(campaignProgress,()=>window.localStorage);
  missionResultRecorded=true;
 }
 if(isVisualTransition()){
  $("#battleStatus").textContent=visualTransition==="wave"?"Завершение волны…":"Завершение боя…";
  $("#actionTitle").textContent="Анимация завершается";
  $("#actionHint").textContent="Следующий этап появится после завершения действий.";
  $("#attackBtn").disabled=true;
  $("#basicAbilityBtn").disabled=true;
  $("#specialAbilityBtn").disabled=true;
  const autoControl=$("#autoBattleBtn");
  if(autoControl)autoControl.disabled=!state.active;
  const speedControl=$("#autoSpeedBtn");
  if(speedControl)speedControl.disabled=!state.active;
  $("#battleMessage").textContent=state.message;
  renderBattleLog();
  renderCombatants();
  renderCurrentFighterHud();
  renderArenaIndicators();
  updateMeshes();
  return;
 }
 if(battleIsCampaign&&!state.active&&!missionResultShown){
  missionResultShown=true;
  renderMissionResult();
  showScreen("missionResult");
 }
 const reward=$("#battleReward");
 if(reward){
  reward.hidden=state.active;
  if(!state.active)reward.textContent=state.winner==="ally"?"Победа! +1 учебный материал · Всего: "+progress.materials:"Поражение. Награда: 0 материалов";
 }
 const fighters=state.fighters;
 const actor=state.active?fighters[state.currentActor]:null;
 const targetIsAlly=!!actor&&CombatCore.abilityTargetSide(state,selectedAbility)==="ally";
 const targetIndex=targetIsAlly?state.selectedAlly:state.selectedEnemy;
 const target=state.active?fighters[targetIndex]:null;
 const validTarget=!!target&&target.hp>0&&target.side===(targetIsAlly?"ally":"enemy");
 const specialReady=CombatCore.abilityReady(state,"special");
 if(!specialReady)selectedAbility="basic";
 const name=actor&&selectedAbility==="special"?CombatCore.specialName(actor):"Базовая атака";
 $("#battleStatus").textContent=actor?"Ход: "+actor.name:"Бой завершён";
 $("#turnChip").textContent=(state.totalWaves>1?"Волна "+state.wave+"/"+state.totalWaves+" · ":"")+"Ход "+state.turn;
 $("#actionTitle").textContent=actor?name+": "+actor.name:"Бой завершён";
 $("#basicAbilityBtn").disabled=!actor||autoBattle;
 $("#specialAbilityBtn").disabled=!specialReady||autoBattle;
 const autoButton=$("#autoBattleBtn");
 if(autoButton){
  autoButton.disabled=!state.active;
  autoButton.textContent=autoBattle?"Ручной бой":"Автобой";
  autoButton.setAttribute("aria-pressed",String(autoBattle));
 }
 const speedButton=$("#autoSpeedBtn");
 if(speedButton){
  speedButton.disabled=!state.active;
  speedButton.textContent=BattleSpeed.get()+"×";
  speedButton.setAttribute("aria-label","Скорость боя "+BattleSpeed.get()+"×. Нажми, чтобы изменить");
 }
 $("#specialAbilityBtn").textContent=actor&&actor.specialCooldown>0?"Особая · "+actor.specialCooldown:"Особая";
 $("#basicAbilityBtn").classList.toggle("selected",selectedAbility==="basic");
 $("#specialAbilityBtn").classList.toggle("selected",selectedAbility==="special");
 $("#actionHint").textContent=autoBattle?"Автобой: базовые атаки по первой живой цели. Нажми «Ручной бой», чтобы управлять.":validTarget?"Цель на арене: "+target.name:(targetIsAlly?"Коснись живого союзника на арене":"Коснись живого противника на арене");
 $("#attackBtn").textContent=state.active?(targetIsAlly?"Применить":"Атаковать"):"Сыграть снова";
 $("#attackBtn").disabled=autoBattle||(state.active&&(!actor||!validTarget));
 $("#battleMessage").textContent=state.message;
 renderBattleLog();
 renderCombatants();
 renderCurrentFighterHud();
 renderArenaIndicators();
 updateMeshes();
 queueAutoAction();
}
function renderCombatants(){
 const actor=state.active&&!isVisualTransition()?state.fighters[state.currentActor]:null;
 const choosingAlly=!!actor&&CombatCore.abilityTargetSide(state,selectedAbility)==="ally";
 $("#combatants").innerHTML=presentationFighters().map((h,i)=>{
   const chosen=state.active&&i===(choosingAlly?state.selectedAlly:state.selectedEnemy)&&
     h.side===(choosingAlly?"ally":"enemy");
   const status=[h.guardHits>0?"Защита ×"+h.guardHits:"",h.weakenAttacks>0?"Ослабление ×"+h.weakenAttacks:""].filter(Boolean).join(" · ");
   return `<div class="fighter ${h.side==="enemy"?"enemy":"ally"} ${h.hp<=0?"defeated":""} ${chosen?"selected":""} ${state.active&&i===state.currentActor?"acting":""}" data-index="${i}"><b>${h.name}</b><small>${Math.max(0,h.hp)} / ${h.maxHp} HP · СПД ${h.speed}</small>${status?`<span class="fighter-status">${status}</span>`:""}<div class="health"><span style="width:${Math.max(0,h.hp)/h.maxHp*100}%"></span></div></div>`;
 }).join("");
 // Status cards are read-only; all manual targets are picked in 3D.
}
// Combat-008C: HTML indicators track the mesh positions without intercepting taps.
// Both fills are derived from CombatCore, not from a decorative animation.
function renderArenaIndicators(){
 const overlay=$("#arenaIndicators");
 if(!overlay)return;
 const roster=presentationFighters();
 overlay.innerHTML=roster.filter(h=>h.hp>0||BattleAnimation.isDying(h.id)).map(h=>{
  const health=Math.min(100,Math.max(0,h.hp/Math.max(1,h.maxHp)*100));
  const initiative=Math.min(100,Math.max(0,(h.meter||0)/10));
  const effects=[h.guardHits>0?`<span class="arena-effect" title="Защита: ${h.guardHits} ударов">◆${h.guardHits}</span>`:"",
   h.weakenAttacks>0?`<span class="arena-effect debuff" title="Ослабление: ${h.weakenAttacks} атак">↓${h.weakenAttacks}</span>`:""].join("");
  const actor=state.active&&!isVisualTransition()?state.fighters[state.currentActor]:null;
  const active=actor?.id===h.id;
  return `<div class="arena-indicator ${h.side} ${active?"acting":""}" data-fighter-id="${h.id}" aria-label="${h.name}: здоровье ${Math.max(0,h.hp)} из ${h.maxHp}, инициатива ${Math.round(h.meter||0)} из 1000">
   <div class="arena-indicator-name">${h.name}</div>
   <div class="arena-health" title="HP ${Math.max(0,h.hp)} / ${h.maxHp}"><span style="width:${health}%"></span></div>
   <div class="arena-initiative" title="Инициатива ${Math.round(h.meter||0)} / 1000"><span style="width:${initiative}%"></span></div>
   ${effects?`<div class="arena-effects">${effects}</div>`:""}
  </div>`;
 }).join("");
 indicatorNodes={};
 if(typeof overlay.querySelectorAll==="function")for(const node of overlay.querySelectorAll(".arena-indicator"))
  indicatorNodes[node.dataset.fighterId]=node;
 positionArenaIndicators();
}
// Projection is presentation-only. Babylon pointer picking stays on the canvas.
function positionArenaIndicators(){
 if(!scene||!engine||!arenaCamera||!BABYLON.Vector3?.Project||
    typeof scene.getTransformMatrix!=="function"||typeof engine.getRenderWidth!=="function")return;
 const width=engine.getRenderWidth(),height=engine.getRenderHeight();
 const overlay=$("#arenaIndicators");
 if(!width||!height||!overlay||!arenaCamera.viewport?.toGlobal)return;
 // Render pixels can differ from CSS pixels on retina/HiDPI iPhones.
 const cssWidth=overlay.clientWidth||width,cssHeight=overlay.clientHeight||height;
 const viewport=arenaCamera.viewport.toGlobal(width,height);
 const identity=BABYLON.Matrix?.Identity?.();
 if(!identity)return;
 for(const [id,node] of Object.entries(indicatorNodes)){
  const mesh=meshes[id];
  if(!mesh||!node?.style)continue;
  const p=mesh.head.position;
  const world=new BABYLON.Vector3(p.x,p.y+0.72,p.z);
  const screen=BABYLON.Vector3.Project(world,identity,scene.getTransformMatrix(),viewport);
  const visible=screen.z>=0&&screen.z<=1&&screen.x>=0&&screen.x<=width&&screen.y>=0&&screen.y<=height;
  node.style.display=visible?"":"none";
  if(visible){node.style.left=screen.x*cssWidth/width+"px";node.style.top=screen.y*cssHeight/height+"px";}
 }
}
function resetBattle(){
 cancelAutoTimer();
 cancelVisualTransition();
 BattleAnimation.clear();
 autoBattle=false;
 BattleSpeed.reset();
 missionResultShown=false;
 missionResultRecorded=false;
 lastMissionStars=0;
 selectedAbility="basic";
 state=CombatCore.createBattle(battleLineup(),battleFutureWaves());
 CombatCore.advanceToPlayerTurn(state);
 syncBattleUI();
}
function attack(){
 if(autoBattle||isVisualTransition())return;
 const before=state.fighters.map(f=>({...f}));
 if(CombatCore.performPlayerAbility(state,selectedAbility)){
  captureResolvedVisuals(before);
  selectedAbility="basic";
  syncBattleUI();
 }
}
// Exactly one permanent click handler; no onclick replacement on victory.
$("#attackBtn").addEventListener("click",()=>{if(isVisualTransition())return;if(!state.active)openSquad("home");else attack();});
const autoBattleControl=$("#autoBattleBtn");
if(autoBattleControl)autoBattleControl.addEventListener("click",()=>{if(state.active)setAutoBattle(!autoBattle);});
const autoSpeedControl=$("#autoSpeedBtn");
if(autoSpeedControl)autoSpeedControl.addEventListener("click",()=>{
 if(state.active){
  const levels=BattleSpeed.levels;
  const next=levels[(levels.indexOf(BattleSpeed.get())+1)%levels.length];
  setAutoSpeed(next);
 }
});
$("#basicAbilityBtn").addEventListener("click",()=>{if(state.active&&!autoBattle&&!isVisualTransition()){selectedAbility="basic";syncBattleUI();}});
$("#specialAbilityBtn").addEventListener("click",()=>{if(!autoBattle&&!isVisualTransition()&&CombatCore.abilityReady(state,"special")){selectedAbility="special";syncBattleUI();}});
// Manual target picking is independent of which 3D mesh part was touched.
function selectArenaTarget(pickedMesh){
 if(!state.active||autoBattle||isVisualTransition()||!pickedMesh)return false;
 let mesh=pickedMesh;
 while(mesh&&!mesh.metadata?.fighterId)mesh=mesh.parent;
 const id=mesh?.metadata?.fighterId;
 const index=state.fighters.findIndex(f=>f.id===id&&f.hp>0);
 if(index<0)return false;
 const side=CombatCore.abilityTargetSide(state,selectedAbility);
 if(state.fighters[index].side!==side)return false;
 const picked=side==="ally"?CombatCore.chooseAlly(state,index):CombatCore.chooseEnemy(state,index);
 if(picked)syncBattleUI();
 return picked;
}
// A single render callback and a single Engine/Scene for the lifetime of this prototype.
function renderBattleFrame(){
 if(!scene)return;
 // Animation speed is shared with the auto scheduler, never alters combat state.
 const dt=engine&&typeof engine.getDeltaTime==="function"?engine.getDeltaTime():16;
 BattleAnimation.tick(dt,BattleSpeed.multiplier());
 for(const h of presentationFighters()){
  const visual=meshes[h.id];
  if(!visual)continue;
  const visible=h.hp>0||BattleAnimation.isDying(h.id);
  visual.body.setEnabled(visible);
  visual.head.setEnabled(visible);
  visual.base.setEnabled(visible);
  if(!visible)continue;
  const pose=BattleAnimation.pose(h.id);
  const team=presentationFighters().filter(f=>f.side===h.side);
  const slot=team.findIndex(f=>f.id===h.id);
  const x=formationPosition(h.side,slot,team.length).x;
  const offset=pose.x*(h.side==="ally"?1:-1);
  visual.body.position.x=visual.head.position.x=visual.base.position.x=x+offset;
  visual.body.position.y=.8+pose.y;
  visual.head.position.y=1.8+pose.y;
  if(visual.body.rotation)visual.body.rotation.z=pose.tilt;
  if(visual.head.rotation)visual.head.rotation.z=pose.tilt;
 }
 positionArenaIndicators();
 scene.render();
 // Draw the last animation frame before revealing the next wave/result.
 finishVisualTransition();
}
function shouldRenderBattle(){return !!engine && !document.hidden && $("#battle").classList.contains("active");}
function startBattleRendering(){
 if(!shouldRenderBattle()||renderLoopRunning)return;
 engine.runRenderLoop(renderBattleFrame);
 renderLoopRunning=true;
}
function stopBattleRendering(){
 if(!engine||!renderLoopRunning)return;
 engine.stopRenderLoop(renderBattleFrame);
 renderLoopRunning=false;
}
// Reuse the camera and GPU resources on every battle entry.
function resetArenaCamera(){
 if(!arenaCamera)return;
 arenaCamera.alpha=ARENA_VIEW.alpha;
 arenaCamera.beta=ARENA_VIEW.beta;
 arenaCamera.radius=ARENA_VIEW.radius;
 const center=new BABYLON.Vector3(0,ARENA_VIEW.targetY,0);
 if(typeof arenaCamera.setTarget==="function")arenaCamera.setTarget(center);
 else arenaCamera.target=center; // Minimal test stub.
}
// Reuse the scene rather than re-creating meshes on every battle entry.
function initBabylon(){
 const canvas=$("#renderCanvas");engine=new BABYLON.Engine(canvas,true,{stencil:true});
 scene=new BABYLON.Scene(engine);scene.clearColor=new BABYLON.Color4(.035,.045,.065,1);
 arenaCamera=new BABYLON.ArcRotateCamera("camera",ARENA_VIEW.alpha,ARENA_VIEW.beta,ARENA_VIEW.radius,new BABYLON.Vector3(0,ARENA_VIEW.targetY,0),scene);
 arenaCamera.lowerRadiusLimit=12;arenaCamera.upperRadiusLimit=21;
 arenaCamera.lowerBetaLimit=.55;arenaCamera.upperBetaLimit=1.30;
 arenaCamera.attachControl(canvas,true);
 const hemi=new BABYLON.HemisphericLight("hemi",new BABYLON.Vector3(0,1,0),scene);hemi.intensity=.8;
 const key=new BABYLON.DirectionalLight("key",new BABYLON.Vector3(-.5,-1,.5),scene);key.intensity=1.1;
 const ground=BABYLON.MeshBuilder.CreateGround("ground",{width:16,height:9},scene);const gm=new BABYLON.StandardMaterial("groundMat",scene);gm.diffuseColor=new BABYLON.Color3(.12,.15,.19);gm.specularColor=new BABYLON.Color3(.1,.1,.1);ground.material=gm;
 // Built-in material avoids relying on a separately loaded Babylon Materials Library.
 const grid=BABYLON.MeshBuilder.CreateGround("grid",{width:16,height:9,subdivisions:12},scene);grid.position.y=.012;
 const gridmat=new BABYLON.StandardMaterial("gridmat",scene);
 gridmat.diffuseColor=new BABYLON.Color3(.14,.17,.21);gridmat.emissiveColor=new BABYLON.Color3(.035,.045,.06);
 gridmat.alpha=.28;gridmat.wireframe=true;gridmat.backFaceCulling=false;grid.material=gridmat;
 // Low-poly stylized fighters: capsule body, sphere head, colored shield.
 HEROES.forEach((h,i)=>{
  const start=formationPosition(h.side,i%3,3);
  const x=start.x,z=start.z;
  const body=BABYLON.MeshBuilder.CreateCapsule("body_"+i,{height:1.5,radius:.42},scene);body.position=new BABYLON.Vector3(x,.8,z);
  const mat=new BABYLON.StandardMaterial("mat_"+i,scene);mat.diffuseColor=h.side==="ally"?new BABYLON.Color3(.28,.55,.76):new BABYLON.Color3(.72,.25,.23);mat.emissiveColor=h.side==="ally"?new BABYLON.Color3(.02,.06,.09):new BABYLON.Color3(.08,.015,.01);body.material=mat;
  const head=BABYLON.MeshBuilder.CreateSphere("head_"+i,{diameter:.62,segments:12},scene);head.position=new BABYLON.Vector3(x,1.8,z);head.material=mat;
  const base=BABYLON.MeshBuilder.CreateCylinder("base_"+i,{diameter:1.15,height:.12,tessellation:24},scene);base.position=new BABYLON.Vector3(x,.08,z);const bm=new BABYLON.StandardMaterial("basemat_"+i,scene);bm.diffuseColor=h.side==="ally"?new BABYLON.Color3(.65,.48,.2):new BABYLON.Color3(.4,.18,.18);base.material=bm;
  for(const part of [body,head,base])part.metadata={fighterId:h.id};
   meshes[h.id]={body,head,base};
 });
 // Babylon pointer picking supports mouse and touch, registered once with the scene.
  if(scene.onPointerObservable&&BABYLON.PointerEventTypes){
   scene.onPointerObservable.add(info=>{
    if(info.type===BABYLON.PointerEventTypes.POINTERPICK)
     selectArenaTarget(info.pickInfo?.pickedMesh);
   });
  }
  // Registered only once because initBabylon() runs once.
 // Safari resize may fire before the landscape layout has settled.
 // Observe actual arena dimensions and synchronize render buffer after layout.
 let resizeQueued=false,previousLandscape=null;
 function synchronizeArenaSize(){
  if(!shouldRenderBattle()||resizeQueued)return;
  resizeQueued=true;
  const update=()=>{
   resizeQueued=false;
   const landscape=typeof window.innerWidth==="number"&&typeof window.innerHeight==="number"
    ?window.innerWidth>window.innerHeight:null;
   // Explicitly remove the portrait hint from the hit-test/paint tree.
   // Safari may retain the previous orientation media-query style briefly.
   const prompt=$("#orientationPrompt");
   if(prompt&&landscape!==null)prompt.hidden=landscape;
   if(!shouldRenderBattle())return;
   if(landscape===true&&previousLandscape===false)resetArenaCamera();
   if(landscape!==null)previousLandscape=landscape;
   engine.resize();
   positionArenaIndicators();
  };
  if(typeof window.requestAnimationFrame==="function")
   window.requestAnimationFrame(()=>window.requestAnimationFrame(update));
  else update();
 }
 window.addEventListener("resize",synchronizeArenaSize);
 window.addEventListener("orientationchange",synchronizeArenaSize);
 if(window.visualViewport?.addEventListener)
  window.visualViewport.addEventListener("resize",synchronizeArenaSize);
 if(typeof window.ResizeObserver==="function"){
  const observer=new window.ResizeObserver(synchronizeArenaSize);
  observer.observe(canvas.parentElement||canvas);
 }
}
function updateMeshes(){
 if(!scene)return;
 for(const h of HEROES){
  const mesh=meshes[h.id];
  if(!mesh)continue;
  const roster=presentationFighters();
  const member=roster.find(f=>f.id===h.id);
  const visible=!!member&&(member.hp>0||BattleAnimation.isDying(h.id));
  mesh.body.setEnabled(visible);
  mesh.head.setEnabled(visible);
  mesh.base.setEnabled(visible);
  if(visible){
   const sideMembers=roster.filter(f=>f.side===member.side);
   const slot=sideMembers.findIndex(f=>f.id===h.id);
   const {x,z}=formationPosition(member.side,slot,sideMembers.length);
   mesh.body.position.x=mesh.head.position.x=mesh.base.position.x=x;
   mesh.body.position.z=mesh.head.position.z=mesh.base.position.z=z;
   const actor=state.active&&!isVisualTransition()?state.fighters[state.currentActor]:null;
    const targetSide=actor?CombatCore.abilityTargetSide(state,selectedAbility):null;
    const selected=member.side===targetSide&&h.id===state.fighters[targetSide==="ally"?state.selectedAlly:state.selectedEnemy]?.id;
    if(mesh.base.material&&BABYLON.Color3)mesh.base.material.emissiveColor=selected
     ?new BABYLON.Color3(.48,.37,.12):new BABYLON.Color3(0,0,0);
    mesh.body.position.y=.8;
   mesh.head.position.y=1.8;
   if(mesh.body.rotation)mesh.body.rotation.z=0;
   if(mesh.head.rotation)mesh.head.rotation.z=0;
  }
 }
}
// Browsers may keep the tab alive when it is hidden; suspend GPU work until visible.
document.addEventListener("visibilitychange",()=>{
 if(document.hidden){cancelAutoTimer();stopBattleRendering();}
 else if(shouldRenderBattle()){engine.resize();startBattleRendering();queueAutoAction();}
});
renderHeroes();CombatCore.advanceToPlayerTurn(state);renderCombatants();
