const HEROES = [
  {id:"kael",name:"Каэль Ворон",role:"Страж",hp:120,atk:24,speed:110,side:"ally",glyph:"♜"},
  {id:"lyra",name:"Лира Соль",role:"Следопыт",hp:88,atk:31,speed:155,side:"ally",glyph:"♧"},
  {id:"darin",name:"Дарин Пепельный",role:"Мечник",hp:105,atk:27,speed:125,side:"ally",glyph:"⚔"},
  // Combat-007 test-only healer, not canonical or final balance.
  {id:"medic-demo",name:"Учебный лекарь",role:"Учебная поддержка",hp:90,atk:14,speed:115,side:"ally",glyph:"✚"},
  // Combat-011C: optional training-only group attacker, not canonical lore or final balance.
  {id:"test-area-damage",name:"Учебный боец группы",role:"Тренировка массовых атак",hp:90,atk:20,speed:120,side:"ally",glyph:"✧"},
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
let inspectionId=null,inspectionGesture=null,suppressInspectionPick=false;
const INSPECT_HOLD_MS=400,INSPECT_MOVE_PX=12;
let selectedAbility="basic"; // "special" is only armed while choosing an ally.
let abilityHintGesture=null,abilityHintSuppressClick=null;
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
  // Combat-015B: plan only when the scheduled auto step actually executes.
  const plan=AutoDecision.chooseAction(state);
  if(!CombatCore.performAutoAction(state,plan)){setAutoBattle(false);return;}
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
// Formation persists independently of hero levels/campaign saves. On the first
// visit (or invalid/unavailable storage), use the first five roster heroes.
const SQUAD_SAVE_KEY="ashes-throne.squad.v1";
function defaultSquad(){
 const ids=ALLIES.slice(0,MAX_SQUAD).map(h=>h.id);
 return {leaderId:ids[0]??null,regularIds:ids.slice(1)};
}
function loadSquad(){
 const fallback=defaultSquad();
 try{
  const raw=window.localStorage.getItem(SQUAD_SAVE_KEY);
  if(raw===null)return fallback;
  const parsed=JSON.parse(raw);
  if(!parsed||parsed.version!==1||
     !Array.isArray(parsed.regularIds)||parsed.regularIds.length>MAX_SQUAD-1||
     !(parsed.leaderId===null||typeof parsed.leaderId==="string"))return fallback;
  const ids=[parsed.leaderId,...parsed.regularIds].filter(id=>id!==null);
  const roster=new Set(ALLIES.map(h=>h.id));
  if(ids.some(id=>typeof id!=="string"||!roster.has(id))||
     new Set(ids).size!==ids.length||
     parsed.regularIds.some(id=>id!==null&&typeof id!=="string"))return fallback;
  // Preserve every slot, including empty gaps. Previous saves with shorter
  // regular arrays retain positions 2..n; only trailing empties are added.
  return {leaderId:parsed.leaderId,
   regularIds:Array.from({length:MAX_SQUAD-1},(_,i)=>parsed.regularIds[i]??null)};
 }catch(error){return fallback;}
}
function saveSquad(){
 try{
  window.localStorage.setItem(SQUAD_SAVE_KEY,JSON.stringify({
   version:1,leaderId:selectedLeaderId,regularIds:selectedPartyIds
  }));
  return true;
 }catch(error){return false;}
}
const loadedSquad=loadSquad();
let selectedPartyIds=Array.from({length:MAX_SQUAD-1},(_,i)=>loadedSquad.regularIds[i]??null);
let selectedLeaderId=loadedSquad.leaderId;
let squadReturnScreen="home";
let undersizedSquadConfirmed=false;
function resetSquadWarning(){
 undersizedSquadConfirmed=false;
 const warning=$("#squadWarning");
 if(warning){warning.hidden=true;warning.textContent="";}
}
function eligibleSquadCount(){
 // ALLIES is the available/selectable roster, capped to five battle slots.
 return Math.min(MAX_SQUAD,ALLIES.length);
}
let state=CombatCore.createBattle([...ALLIES,...ENEMIES.slice(0,2)]);
function progressedHero(hero){return ProgressCore.heroStats(progress,hero);}
function hasLeaderSkill(id){
 const hero=ALLIES.find(h=>h.id===id);
 return !!hero&&!!AbilityData.get(hero,"leader");
}
function squadSlots(){
 return [selectedLeaderId,...selectedPartyIds];
}
function selectedParty(){
 // Only occupied positions enter battle, ordered by their actual slot.
 // An empty leader position does NOT transfer leadership to slot 2.
 return squadSlots().filter(Boolean)
  .map(id=>ALLIES.find(h=>h.id===id)).filter(Boolean).map(progressedHero);
}
// Combat-015D-A: mission-specific AI belongs to each battle instance, never
// to shared HEROES/ENEMIES templates or saved squad composition.
function enemyForMission(enemy,mission){
 const profile=mission?.enemyAiProfiles?.[enemy.id];
 return profile?{...enemy,aiProfile:profile}:{...enemy};
}
function battleLineup(){
 // The original encounter is unchanged; mission #2 tests five enemies at once.
 const enemies=battleIsCampaign&&activeMissionId==="demo-mission-2"?ENEMIES:ENEMIES.slice(0,2);
 const mission=battleIsCampaign?MissionData.get(activeMissionId):null;
 return [...selectedParty(),...enemies.map(enemy=>enemyForMission(enemy,mission))];
}
// Optional future wave rosters live in mission data. Existing missions have no
// future waves, so their accepted encounters and balance remain unchanged.
function battleFutureWaves(){
 const mission=battleIsCampaign&&MissionData.get(activeMissionId);
 return (mission&&mission.futureEnemyWaves||[]).map(ids=>ids.map(id=>{
  const enemy=ENEMIES.find(h=>h.id===id);
  if(!enemy)throw Error("Unknown wave enemy template: "+id);
  return enemyForMission(enemy,mission);
 }));
}
function renderSquad(){
 const chosen=selectedParty();
 const slots=squadSlots().map(id=>ALLIES.find(h=>h.id===id)||null);
 $("#squadCount").textContent=chosen.length+"/"+MAX_SQUAD;
 $("#squadRoster").innerHTML=ALLIES.map(progressedHero).map(h=>{
  const isLeader=selectedLeaderId===h.id;
  const active=selectedPartyIds.includes(h.id)||isLeader;
  const skill=hasLeaderSkill(h.id);
  return `<button type="button" class="squad-choice ${active?"chosen":""}" data-hero-id="${h.id}" aria-pressed="${active}"><span class="squad-glyph">${h.glyph}</span><span><b>${h.name}</b><small>${h.role} · HP ${h.hp} · ATK ${h.atk}${skill?" · Лидерская способность":""}</small></span><strong>${active?"✓":"+"}</strong></button>`;
 }).join("");
 $("#squadSlots").innerHTML=Array.from({length:MAX_SQUAD},(_,i)=>{
  const h=slots[i];
  if(i===0)return `<div class="squad-slot squad-slot-leader ${h?"filled":""}" aria-label="Лидер отряда"><span class="squad-slot-number">★ ЛИДЕР</span><span class="squad-slot-content">${h?h.name:"Свободно"}</span></div>`;
  return `<div class="squad-slot ${h?"filled":""}"><span class="squad-slot-number">${i+1}</span><span class="squad-slot-content">${h?h.name:"Свободно"}</span></div>`;
 }).join("");
 $("#squadHint").textContent=selectedLeaderId
  ?(hasLeaderSkill(selectedLeaderId)
     ?"Первый персонаж — лидер; его лидерская способность действует автоматически."
     :"Первый персонаж — лидер. У него пока нет лидерской способности.")
  :"Выбери героя слева: он займёт первую свободную ячейку. Пока лидерская ячейка пуста, лидерского бонуса нет.";
 $("#squadStart").disabled=chosen.length===0;
 document.querySelectorAll("[data-hero-id]").forEach(btn=>btn.addEventListener("click",()=>{
  toggleSquadHero(btn.dataset.heroId);
 }));
}
function toggleSquadHero(id){
 if(!ALLIES.some(h=>h.id===id))return false;
 const slots=squadSlots();
 const occupied=slots.indexOf(id);
 if(occupied!==-1){
  // Removing a hero empties *only* their cell. No automatic shifts.
  slots[occupied]=null;
 }else{
  const firstEmpty=slots.indexOf(null);
  if(firstEmpty===-1)return false;
  slots[firstEmpty]=id;
 }
 selectedLeaderId=slots[0];
 selectedPartyIds=slots.slice(1);
 resetSquadWarning();
 saveSquad();
 renderSquad();
 return true;
}
function disbandSquad(){
 if(selectedLeaderId===null&&selectedPartyIds.every(id=>id===null))return false;
 selectedLeaderId=null;
 selectedPartyIds=Array(MAX_SQUAD-1).fill(null);
 resetSquadWarning();
 saveSquad();
 renderSquad();
 return true;
}
function openSquad(returnTo="home"){
 squadReturnScreen=returnTo;
 resetSquadWarning();
 renderSquad();
 showScreen("squad");
}
function showScreen(id){
 if(id!=="battle"){closeFighterInspection();hideAbilityTooltip();}
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
$("#squadDisband")?.addEventListener("click",disbandSquad);
// If Babylon.js cannot load, show a recoverable message instead of an uncaught crash.
const retryLoad=$("#retryBattleLoad");
if(retryLoad)retryLoad.addEventListener("click",()=>window.location.reload());
$("#squadStart").addEventListener("click",()=>{
 const count=selectedParty().length;
 if(count===0)return;
 if(count<eligibleSquadCount()&&!undersizedSquadConfirmed){
  undersizedSquadConfirmed=true;
  const warning=$("#squadWarning");
  if(warning){
   warning.textContent=`В отряде ${count} из ${eligibleSquadCount()} доступных героев. Можно добавить бойцов. Нажми «Начать бой» ещё раз, чтобы вступить в сражение этим составом.`;
   warning.hidden=false;
  }
  return;
 }
 resetSquadWarning();
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
// Combat-008D: the top-right card follows the valid selected target,
// including allied support targets. It never shows the current turn owner.
function renderTargetFighterHud(){
 const panel=$("#targetFighterHud");
 if(!panel)return;
 const actor=state.active&&!isVisualTransition()?state.fighters[state.currentActor]:null;
 const sideToPick=actor?CombatCore.abilityTargetSide(state,selectedAbility):null;
 const targetIndex=sideToPick==="ally"?state.selectedAlly:state.selectedEnemy;
 const target=actor?state.fighters[targetIndex]:null;
 const valid=!!target&&target.hp>0&&target.side===sideToPick;
 const side=$("#targetFighterSide"),level=$("#targetFighterLevel");
 const name=$("#targetFighterName"),hp=$("#targetFighterHp");
 const stats=$("#targetFighterStats"),fill=$("#targetFighterHealthFill");
 panel.classList.toggle("enemy",valid&&target.side==="enemy");
 if(!valid){
  side.textContent=isVisualTransition()?"ПЕРЕХОД":"ВЫБРАННАЯ ЦЕЛЬ";
  level.textContent="";
  name.textContent=isVisualTransition()?"Завершение действий":state.active?"Выбери цель":"Бой завершён";
  hp.textContent="";stats.textContent="";fill.style.width="0%";
  return;
 }
 side.textContent=target.side==="ally"?"ЦЕЛЬ: СОЮЗНИК":"ЦЕЛЬ: ПРОТИВНИК";
 level.textContent=Number.isInteger(target.level)&&target.level>0?"Ур. "+target.level:"";
 name.textContent=target.name;
 hp.textContent="HP "+Math.max(0,target.hp)+"/"+target.maxHp;
 stats.textContent="АТК "+target.atk+" · СКР "+target.speed;
 fill.style.width=Math.max(0,Math.min(100,target.hp/Math.max(1,target.maxHp)*100))+"%";
}
function syncBattleUI(){
 if(inspectionId)renderFighterInspection();
 if(!state.active||isVisualTransition())hideAbilityTooltip();
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
  $("#battleRetryBtn").hidden=true;
  $("#abilityControls")?.classList.remove("battle-finished");
  $("#basicAbilityBtn").disabled=true;
  $("#specialAbilityBtn").disabled=true;
  const powerfulTransitionBtn=$("#powerfulAbilityBtn");
  if(powerfulTransitionBtn)powerfulTransitionBtn.disabled=true;
  const autoControl=$("#autoBattleBtn");
  if(autoControl)autoControl.disabled=!state.active;
  const speedControl=$("#autoSpeedBtn");
  if(speedControl)speedControl.disabled=!state.active;
  $("#battleMessage").textContent=state.message;
  renderBattleLog();
  renderTargetFighterHud();
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
 const specialReady=CombatCore.abilityReady(state,"special");
 const powerful=actor?AbilityData.get(actor,"powerful"):null;
 const powerfulReady=!!powerful&&CombatCore.abilityReady(state,"powerful");
 if(!specialReady)selectedAbility="basic";
 const supportTarget=!!actor&&selectedAbility==="special"&&CombatCore.abilityTargetSide(state,"special")==="ally";
 const targetIndex=supportTarget?state.selectedAlly:state.selectedEnemy;
 const target=state.active?fighters[targetIndex]:null;
 const validTarget=!!target&&target.hp>0&&target.side===(supportTarget?"ally":"enemy");
 $("#battleStatus").textContent=actor?"Ход: "+actor.name:"Бой завершён";
 $("#turnChip").textContent=(state.totalWaves>1?"Волна "+state.wave+"/"+state.totalWaves+" · ":"")+"Ход "+state.turn;
 $("#actionTitle").textContent=actor?(supportTarget?"Выбери союзника":"Способности: "+actor.name):"Бой завершён";
 $("#basicAbilityBtn").disabled=!actor||autoBattle;
 $("#specialAbilityBtn").disabled=!specialReady||autoBattle;
 const powerfulSlot=$("#powerfulAbilitySlot");
 if(powerfulSlot)powerfulSlot.hidden=!powerful;
 $("#abilityOptions")?.classList.toggle("has-powerful",!!powerful);
 const powerfulButton=$("#powerfulAbilityBtn");
 if(powerfulButton)powerfulButton.disabled=!powerfulReady||autoBattle;
 const autoButton=$("#autoBattleBtn");
 if(autoButton){autoButton.disabled=!state.active;autoButton.textContent=autoBattle?"Ручной бой":"Автобой";autoButton.setAttribute("aria-pressed",String(autoBattle));}
 const speedButton=$("#autoSpeedBtn");
 if(speedButton){speedButton.disabled=!state.active;speedButton.textContent=BattleSpeed.get()+"×";speedButton.setAttribute("aria-label","Скорость боя "+BattleSpeed.get()+"×. Нажми, чтобы изменить");}
 $("#basicAbilityBtn").textContent="Базовая атака";
 $("#specialAbilityBtn").textContent=actor?CombatCore.specialName(actor)+(actor.specialCooldown>0?" · "+actor.specialCooldown:""):"Особая способность";
 if(powerfulButton)powerfulButton.textContent=powerful?powerful.name+(actor.powerfulCooldown>0?" · "+actor.powerfulCooldown:""):"Мощная способность";
 $("#basicAbilityBtn").classList.toggle("selected",false);
 $("#specialAbilityBtn").classList.toggle("selected",supportTarget);
 $("#actionHint").textContent=autoBattle?"Автобой активен. Нажми «Ручной бой», чтобы управлять.":
  supportTarget?"Коснись союзника с курсором, чтобы применить способность.":
  actor&&CombatCore.abilityTargetSide(state,"special")==="all-enemies"?"Курсор отмечает основную цель. Учебный широкий удар поражает всех живых врагов.":
  validTarget?"В фокусе: "+target.name+". Нажми на нужную способность.":"Коснись противника, чтобы выбрать цель.";
 const retry=$("#battleRetryBtn");if(retry)retry.hidden=!!state.active;
 $("#abilityControls")?.classList.toggle("battle-finished",!state.active);
 $("#battleMessage").textContent=state.message;
 renderBattleLog();
 renderTargetFighterHud();
 renderArenaIndicators();
 updateMeshes();
 queueAutoAction();
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
  const support=!!actor&&!autoBattle&&selectedAbility==="special"&&CombatCore.abilityTargetSide(state,"special")==="ally";
  // A group ability does not change focus on turn start: exactly one
  // primary enemy remains selected until the player taps a different one.
  const focused=!!actor&&!autoBattle&&h.hp>0&&(support?h.side==="ally":h.side==="enemy"&&state.fighters[state.selectedEnemy]?.id===h.id);
  return `<div class="arena-indicator ${h.side} ${active?"acting":""}" data-fighter-id="${h.id}" aria-label="${h.name}: здоровье ${Math.max(0,h.hp)} из ${h.maxHp}, инициатива ${Math.round(h.meter||0)} из 1000">
   ${focused?`<div class="arena-focus-cursor ${support?"available":"locked"}" aria-hidden="true">▼</div>`:""}
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
 const transform=scene.getTransformMatrix();
 const identity=BABYLON.Matrix?.Identity?.();
 if(!identity)return;
 for(const [id,node] of Object.entries(indicatorNodes)){
  const mesh=meshes[id];
  if(!mesh||!node?.style)continue;
  const p=mesh.head.position;
  const world=new BABYLON.Vector3(p.x,p.y+0.72,p.z);
  const screen=BABYLON.Vector3.Project(world,identity,transform,viewport);
  const visible=screen.z>=0&&screen.z<=1&&screen.x>=0&&screen.x<=width&&screen.y>=0&&screen.y<=height;
  node.style.display=visible?"":"none";
  if(visible){node.style.left=screen.x*cssWidth/width+"px";node.style.top=screen.y*cssHeight/height+"px";}
 }
}
function resetBattle(){
 closeFighterInspection();hideAbilityTooltip();
 cancelAutoTimer();
 cancelVisualTransition();
 BattleAnimation.clear();
 autoBattle=false;
 BattleSpeed.reset();
 missionResultShown=false;
 missionResultRecorded=false;
 lastMissionStars=0;
 selectedAbility="basic";
 state=CombatCore.createBattle(battleLineup(),battleFutureWaves(),{leaderId:selectedLeaderId});
 CombatCore.advanceToPlayerTurn(state);
 syncBattleUI();
}
// Combat-009: instant offensive abilities; allied skills wait for an ally tap.
function applyManualAbility(abilityId){
 if(autoBattle||isVisualTransition()||!CombatCore.abilityReady(state,abilityId))return false;
 const side=CombatCore.abilityTargetSide(state,abilityId);
 const targets=CombatCore.abilityTargetIndices(state,side);
 if(!targets.length)return false;
 // Group/self actions need no manual target tap; CombatCore resolves all
 // recipients atomically. Single-target behavior stays unchanged.
 if(side!=="enemy"&&side!=="ally"&&side!=="self"&&side!=="all-enemies"&&side!=="all-allies")return false;
 const before=state.fighters.map(f=>({...f}));
 if(!CombatCore.performPlayerAbility(state,abilityId))return false;
 captureResolvedVisuals(before);
 selectedAbility="basic";
 hideAbilityTooltip();
 syncBattleUI();
 return true;
}
function pressAbility(abilityId){
 if(abilityHintSuppressClick===abilityId){abilityHintSuppressClick=null;return;}
 hideAbilityTooltip();
 if(!state.active||autoBattle||isVisualTransition()||!CombatCore.abilityReady(state,abilityId))return;
 if(CombatCore.abilityTargetSide(state,abilityId)==="ally"){
  selectedAbility="special";
  syncBattleUI();
 }else{
  selectedAbility="basic";
  applyManualAbility(abilityId);
 }
}
$("#basicAbilityBtn").addEventListener("click",()=>pressAbility("basic"));
$("#specialAbilityBtn").addEventListener("click",()=>pressAbility("special"));
$("#powerfulAbilityBtn")?.addEventListener("click",()=>pressAbility("powerful"));
$("#battleRetryBtn").addEventListener("click",()=>{if(!state.active&&!isVisualTransition())openSquad("home");});
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

// Combat-009: an ability hold explains the current demo definition without casting.
function cancelAbilityHintGesture(){
 if(abilityHintGesture?.timer!=null)clearTimeout(abilityHintGesture.timer);
 abilityHintGesture=null;
}
function hideAbilityTooltip(){
 cancelAbilityHintGesture();
 const tooltip=$("#abilityTooltip");
 if(tooltip)tooltip.hidden=true;
}
function showAbilityTooltip(abilityId){
 const actor=state.fighters[state.currentActor];
 const definition=AbilityData.get(actor,abilityId);
 const tooltip=$("#abilityTooltip");
 if(!definition||!tooltip)return;
 const effects=[];
 if(definition.kind==="damage"){
  effects.push("Урон: "+(definition.multiplier===1?"100%":Math.round(definition.multiplier*100)+"%")+" атаки.");
  if(definition.weakening)effects.push("Ослабление на "+definition.weakening+" атаки.");
 }else if(definition.kind==="guard")
  effects.push("Защита от "+definition.guardHits+" ударов.");
 else if(definition.kind==="heal")
  effects.push("Восстанавливает до "+definition.healAmount+" HP.");
 effects.push("Цель: "+({ally:"союзник",enemy:"противник",self:"сам герой","all-allies":"все живые союзники","all-enemies":"все живые противники"}[definition.target]||"неизвестная")+".");
 if(definition.cooldown)effects.push("Перезарядка: "+definition.cooldown+" хода.");
 $("#abilityTooltipTitle").textContent=definition.name;
 $("#abilityTooltipText").textContent=effects.join(" ");
 tooltip.classList.toggle("on-special",abilityId!=="basic");
 tooltip.hidden=false;
}
function wireAbilityHint(slotId,abilityId){
 const slot=$("#"+slotId);
 if(!slot)return;
 slot.addEventListener("pointerdown",event=>{
  hideAbilityTooltip();
  abilityHintSuppressClick=null;
  if(event.pointerType==="mouse"&&event.button!==0)return;
  const gesture={id:abilityId,pointerId:event.pointerId??null,x:event.clientX??0,y:event.clientY??0,timer:null};
  abilityHintGesture=gesture;
  gesture.timer=setTimeout(()=>{
   if(abilityHintGesture!==gesture)return;
   abilityHintGesture=null;
   abilityHintSuppressClick=abilityId;
   showAbilityTooltip(abilityId);
  },400);
 });
 slot.addEventListener("pointermove",event=>{
  if(!abilityHintGesture||abilityHintGesture.id!==abilityId)return;
  if(abilityHintGesture.pointerId!==null&&event.pointerId!==abilityHintGesture.pointerId||
   Math.hypot((event.clientX??0)-abilityHintGesture.x,(event.clientY??0)-abilityHintGesture.y)>12)
   cancelAbilityHintGesture();
 });
 slot.addEventListener("contextmenu",event=>event.preventDefault());
 for(const eventName of ["pointerup","pointercancel","lostpointercapture","pointerleave"])
  slot.addEventListener(eventName,cancelAbilityHintGesture);
}
wireAbilityHint("basicAbilitySlot","basic");
wireAbilityHint("specialAbilitySlot","special");
wireAbilityHint("powerfulAbilitySlot","powerful");
window.addEventListener("pointerup",cancelAbilityHintGesture);
window.addEventListener("pointercancel",cancelAbilityHintGesture);
// Dismiss on all external taps, including an empty part of the arena.
document.addEventListener("pointerdown",event=>{
 if(!event.target?.closest?.(".ability-slot"))hideAbilityTooltip();
},true);
document.addEventListener("click",event=>{
 if(!event.target?.closest?.(".ability-slot"))hideAbilityTooltip();
},true);
// Combat-008E: long press inspects any living ally or enemy; never changes targets.
function inspectedFighterId(mesh){
 while(mesh&&!mesh.metadata?.fighterId)mesh=mesh.parent;
 const id=mesh?.metadata?.fighterId;
 return state.fighters.some(f=>f.id===id&&f.hp>0)?id:null;
}
function cancelInspectionGesture(){
 if(inspectionGesture?.timer!=null)clearTimeout(inspectionGesture.timer);
 inspectionGesture=null;
}
function closeFighterInspection(){
 cancelInspectionGesture();
 inspectionId=null;
 const dialog=$("#fighterInspect");
 if(dialog)dialog.hidden=true;
}
function renderFighterInspection(){
 const dialog=$("#fighterInspect");
 if(!dialog||!inspectionId)return;
 const fighter=state.fighters.find(f=>f.id===inspectionId&&f.hp>0);
 if(!fighter||isVisualTransition()||!$("#battle").classList.contains("active")){
  closeFighterInspection();return;
 }
 $("#inspectSide").textContent=fighter.side==="ally"?"СОЮЗНИК":"ПРОТИВНИК";
 $("#inspectName").textContent=fighter.name;
 $("#inspectRole").textContent=fighter.role+(Number.isInteger(fighter.level)?" · Уровень "+fighter.level:"");
 $("#inspectStats").textContent="Здоровье: "+fighter.hp+" / "+fighter.maxHp+
  " · Атака: "+fighter.atk+" · Скорость: "+fighter.speed+
  " · Инициатива: "+Math.round(fighter.meter)+" / 1000"+
  (fighter.side==="ally"?" · Перезарядка: "+fighter.specialCooldown:"");
 const effects=[];
 if(fighter.guardHits>0)effects.push("Защита: "+fighter.guardHits+" удар.");
 if(fighter.weakenAttacks>0)effects.push("Ослабление: "+fighter.weakenAttacks+" атак.");
 $("#inspectEffects").textContent=effects.length?effects.join(" · "):"Активных эффектов нет";
 dialog.hidden=false;
}
function startInspectionGesture(info){
 cancelInspectionGesture();
 suppressInspectionPick=false;
 if(!state.active||isVisualTransition()||inspectionId)return;
 const event=info.event||{};
 if((event.pointerType==="mouse"&&event.button!==0)||event.isPrimary===false)return;
 const fighterId=inspectedFighterId(info.pickInfo?.pickedMesh);
 if(!fighterId)return;
 const gesture={pointerId:event.pointerId??null,x:event.clientX??0,y:event.clientY??0,timer:null};
 inspectionGesture=gesture;
 gesture.timer=setTimeout(()=>{
  if(inspectionGesture!==gesture)return;
  inspectionGesture=null;
  inspectionId=fighterId;
  suppressInspectionPick=true;
  renderFighterInspection();
 },INSPECT_HOLD_MS);
}
function handleInspectionPointer(info){
 if(!BABYLON.PointerEventTypes)return;
 const type=info.type,event=info.event||{};
 if(type===BABYLON.PointerEventTypes.POINTERDOWN){
  hideAbilityTooltip();
  startInspectionGesture(info);return;
 }
 if(type===BABYLON.PointerEventTypes.POINTERMOVE&&inspectionGesture){
  if(inspectionGesture.pointerId!==null&&event.pointerId!==inspectionGesture.pointerId){
   cancelInspectionGesture();return;
  }
  if(Math.hypot((event.clientX??0)-inspectionGesture.x,(event.clientY??0)-inspectionGesture.y)>INSPECT_MOVE_PX)
   cancelInspectionGesture();
 }
 if(type===BABYLON.PointerEventTypes.POINTERUP)cancelInspectionGesture();
 if(type===BABYLON.PointerEventTypes.POINTERPICK){
  if(suppressInspectionPick){suppressInspectionPick=false;return;}
  if(!inspectionId)selectArenaTarget(info.pickInfo?.pickedMesh);
 }
}
const inspectClose=$("#inspectClose");
if(inspectClose)inspectClose.addEventListener("click",closeFighterInspection);
const inspectOverlay=$("#fighterInspect");
if(inspectOverlay)inspectOverlay.addEventListener("click",event=>{
 if(event.target===inspectOverlay)closeFighterInspection();
});
document.addEventListener("keydown",event=>{
 if(event.key==="Escape"&&inspectionId)closeFighterInspection();
});
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
 if(picked){
  if(side==="ally"&&selectedAbility==="special")applyManualAbility("special");
  else syncBattleUI();
 }
 return picked;
}
// A single render callback and a single Engine/Scene for the lifetime of this prototype.
function renderBattleFrame(){
 if(!scene)return;
 // Animation speed is shared with the auto scheduler, never alters combat state.
 const dt=engine&&typeof engine.getDeltaTime==="function"?engine.getDeltaTime():16;
 BattleAnimation.tick(dt,BattleSpeed.multiplier());
 // Death animation may end without a new combat action. Retire stale
 // indicators immediately instead of waiting for the following turn.
 if(Object.keys(indicatorNodes).some(id=>{
  const fighter=presentationFighters().find(f=>f.id===id);
  return !fighter||fighter.hp<=0&&!BattleAnimation.isDying(id);
 }))renderArenaIndicators();
 const roster=presentationFighters();
 const sides={ally:roster.filter(f=>f.side==="ally"),enemy:roster.filter(f=>f.side==="enemy")};
 for(const h of roster){
  const visual=meshes[h.id];
  if(!visual)continue;
  const visible=h.hp>0||BattleAnimation.isDying(h.id);
  visual.body.setEnabled(visible);
  visual.head.setEnabled(visible);
  visual.base.setEnabled(visible);
  if(!visible)continue;
  const pose=BattleAnimation.pose(h.id);
  const team=sides[h.side];
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
// Combat-008F-CAMERA: explicit orbit/pinch pointer controls.
// Avoid competing Babylon pointer drags; retain the ArcRotateCamera and wheel zoom.
function installArenaPointerCamera(canvas,camera){
 const pointers=new Map();
 let pinchDistance=0;
 const bounds=(value,min,max)=>Math.max(min,Math.min(max,value));
 const distance=()=>{
  const values=[...pointers.values()];
  return values.length===2?Math.hypot(values[1].x-values[0].x,values[1].y-values[0].y):0;
 };
 const down=event=>{
  if(event.pointerType==="mouse"&&event.button!==0)return;
  pointers.set(event.pointerId??1,{x:event.clientX,y:event.clientY});
  pinchDistance=distance();
 };
 const move=event=>{
  const id=event.pointerId??1,previous=pointers.get(id);
  if(!previous)return;
  const x=event.clientX,y=event.clientY;
  if(pointers.size===1){
   const dx=x-previous.x,dy=y-previous.y;
   camera.alpha-=dx/350;
   camera.beta=bounds(camera.beta-dy/350,camera.lowerBetaLimit,camera.upperBetaLimit);
  }else if(pointers.size===2){
   const oldDistance=pinchDistance;
   previous.x=x;previous.y=y;
   const current=distance();
   if(oldDistance>0&&current>0)
    camera.radius=bounds(camera.radius*oldDistance/current,camera.lowerRadiusLimit,camera.upperRadiusLimit);
   pinchDistance=current;
   return;
  }
  previous.x=x;previous.y=y;
 };
 const up=event=>{
  pointers.delete(event.pointerId??1);
  pinchDistance=distance();
 };
 canvas.addEventListener("pointerdown",down);
 canvas.addEventListener("pointermove",move);
 canvas.addEventListener("pointerup",up);
 canvas.addEventListener("pointercancel",up);
 canvas.addEventListener("lostpointercapture",up);
 window.addEventListener("pointerup",up);
 window.addEventListener("orientationchange",()=>{pointers.clear();pinchDistance=0;});
}
// Reuse the scene rather than re-creating meshes on every battle entry.
function initBabylon(){
 const canvas=$("#renderCanvas");engine=new BABYLON.Engine(canvas,true,{stencil:true});
 scene=new BABYLON.Scene(engine);scene.clearColor=new BABYLON.Color4(.035,.045,.065,1);
 arenaCamera=new BABYLON.ArcRotateCamera("camera",ARENA_VIEW.alpha,ARENA_VIEW.beta,ARENA_VIEW.radius,new BABYLON.Vector3(0,ARENA_VIEW.targetY,0),scene);
 arenaCamera.lowerRadiusLimit=12;arenaCamera.upperRadiusLimit=21;
 arenaCamera.lowerBetaLimit=.55;arenaCamera.upperBetaLimit=1.30;
 arenaCamera.attachControl(canvas,true);
 // Disable duplicate Babylon pointer drags, retain wheel zoom.
 if(arenaCamera.inputs?.removeByType)
  arenaCamera.inputs.removeByType("ArcRotateCameraPointersInput");
 installArenaPointerCamera(canvas,arenaCamera);
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
  if(scene.onPointerObservable&&BABYLON.PointerEventTypes)
   scene.onPointerObservable.add(handleInspectionPointer);
  canvas.addEventListener("contextmenu",event=>event.preventDefault());
  // Native pointercancel / lost capture are not guaranteed to reach Babylon POINTERUP.
  canvas.addEventListener("pointercancel",cancelInspectionGesture);
  canvas.addEventListener("lostpointercapture",cancelInspectionGesture);
  window.addEventListener("pointerup",cancelInspectionGesture);
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
 window.addEventListener("orientationchange",()=>{
  closeFighterInspection(); // Old touch coordinates/modal must not survive rotation.
  synchronizeArenaSize();
 });
 if(window.visualViewport?.addEventListener)
  window.visualViewport.addEventListener("resize",synchronizeArenaSize);
 if(typeof window.ResizeObserver==="function"){
  const observer=new window.ResizeObserver(synchronizeArenaSize);
  observer.observe(canvas.parentElement||canvas);
 }
}
function updateMeshes(){
 if(!scene)return;
 const roster=presentationFighters();
 const sideMembersBySide={ally:roster.filter(f=>f.side==="ally"),enemy:roster.filter(f=>f.side==="enemy")};
 for(const h of HEROES){
  const mesh=meshes[h.id];
  if(!mesh)continue;
  const member=roster.find(f=>f.id===h.id);
  const visible=!!member&&(member.hp>0||BattleAnimation.isDying(h.id));
  mesh.body.setEnabled(visible);
  mesh.head.setEnabled(visible);
  mesh.base.setEnabled(visible);
  if(visible){
   const sideMembers=sideMembersBySide[member.side];
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
 if(document.hidden){closeFighterInspection();hideAbilityTooltip();cancelAutoTimer();stopBattleRendering();}
 else if(shouldRenderBattle()){engine.resize();startBattleRendering();queueAutoAction();}
});
renderHeroes();CombatCore.advanceToPlayerTurn(state);
