const HEROES = [
  {id:"kael",name:"Каэль Ворон",role:"Страж",hp:120,atk:24,speed:110,side:"ally",glyph:"♜"},
  {id:"lyra",name:"Лира Соль",role:"Следопыт",hp:88,atk:31,speed:155,side:"ally",glyph:"♧"},
  {id:"darin",name:"Дарин Пепельный",role:"Мечник",hp:105,atk:27,speed:125,side:"ally",glyph:"⚔"},
  {id:"ves",name:"Вестник Конклава",role:"Противник",hp:90,atk:18,speed:105,side:"enemy",glyph:"☠"},
  {id:"shade",name:"Теневой клинок",role:"Противник",hp:78,atk:22,speed:135,side:"enemy",glyph:"♟"},
  // Demo-only copies: no new combat stats or lore. First mission still uses two enemies.
  {id:"ves-2",name:"Вестник Конклава II",role:"Противник",hp:90,atk:18,speed:105,side:"enemy",glyph:"☠"},
  {id:"shade-2",name:"Теневой клинок II",role:"Противник",hp:78,atk:22,speed:135,side:"enemy",glyph:"♟"},
  {id:"ves-3",name:"Вестник Конклава III",role:"Противник",hp:90,atk:18,speed:105,side:"enemy",glyph:"☠"}
];
const $=s=>document.querySelector(s);
let engine, scene, meshes={};
let renderLoopRunning=false;
let selectedAbility="basic";
// Combat-004: manual remains the default. Only one cancellable timer may run.
let autoBattle=false;
let autoTimer=null;
const AUTO_STEP_MS=350;
function cancelAutoTimer(){
 if(autoTimer!==null){clearTimeout(autoTimer);autoTimer=null;}
}
function queueAutoAction(){
 if(autoTimer!==null||!autoBattle||!state.active||document.hidden||
    !$("#battle").classList.contains("active"))return;
 autoTimer=setTimeout(()=>{
  autoTimer=null;
  if(!autoBattle||!state.active||document.hidden||
     !$("#battle").classList.contains("active"))return;
  if(!CombatCore.performAutoAction(state)){setAutoBattle(false);return;}
  selectedAbility="basic";
  syncBattleUI();
 },AUTO_STEP_MS);
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
let selectedPartyIds=ALLIES.map(h=>h.id);
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
 if(id!=="battle"){cancelAutoTimer();autoBattle=false;stopBattleRendering();}
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
   scene=undefined;engine=undefined;meshes={};renderLoopRunning=false;
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
function syncBattleUI(){
 if(!state.active){cancelAutoTimer();autoBattle=false;}
 const awarded=ProgressCore.awardVictory(progress,state);
 if(awarded>0)persistProgress();
 if(battleIsCampaign&&!state.active&&!missionResultShown){
  const result=CampaignCore.recordResult(campaignProgress,activeMissionId,state);
  lastMissionStars=result.earned;
  if(result.improved)
   campaignSaveAvailable=CampaignCore.save(campaignProgress,()=>window.localStorage);
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
 $("#specialAbilityBtn").textContent=actor&&actor.specialCooldown>0?"Особая · "+actor.specialCooldown:"Особая";
 $("#basicAbilityBtn").classList.toggle("selected",selectedAbility==="basic");
 $("#specialAbilityBtn").classList.toggle("selected",selectedAbility==="special");
 $("#actionHint").textContent=autoBattle?"Автобой: базовые атаки по первой живой цели. Нажми «Ручной бой», чтобы управлять.":validTarget?"Цель: "+target.name:(targetIsAlly?"Выбери живого союзника":"Выбери живого противника");
 $("#attackBtn").textContent=state.active?(targetIsAlly?"Применить":"Атаковать"):"Сыграть снова";
 $("#attackBtn").disabled=autoBattle||(state.active&&(!actor||!validTarget));
 $("#battleMessage").textContent=state.message;
 renderBattleLog();
 renderCombatants();
 updateMeshes();
 queueAutoAction();
}
function renderCombatants(){
 const actor=state.active?state.fighters[state.currentActor]:null;
 const choosingAlly=!!actor&&CombatCore.abilityTargetSide(state,selectedAbility)==="ally";
 $("#combatants").innerHTML=state.fighters.map((h,i)=>{
   const chosen=state.active&&i===(choosingAlly?state.selectedAlly:state.selectedEnemy)&&
     h.side===(choosingAlly?"ally":"enemy");
   const status=[h.guardHits>0?"Защита ×"+h.guardHits:"",h.weakenAttacks>0?"Ослабление ×"+h.weakenAttacks:""].filter(Boolean).join(" · ");
   return `<div class="fighter ${h.side==="enemy"?"enemy":"ally"} ${h.hp<=0?"defeated":""} ${chosen?"selected":""} ${state.active&&i===state.currentActor?"acting":""}" data-index="${i}"><b>${h.name}</b><small>${Math.max(0,h.hp)} / ${h.maxHp} HP · СПД ${h.speed}</small>${status?`<span class="fighter-status">${status}</span>`:""}<div class="health"><span style="width:${Math.max(0,h.hp)/h.maxHp*100}%"></span></div></div>`;
 }).join("");
 document.querySelectorAll(".fighter.enemy").forEach(el=>el.addEventListener("click",()=>{
  if(!autoBattle&&CombatCore.chooseEnemy(state,Number(el.dataset.index)))syncBattleUI();
 }));
 if(choosingAlly)document.querySelectorAll(".fighter.ally").forEach(el=>el.addEventListener("click",()=>{
  if(!autoBattle&&CombatCore.chooseAlly(state,Number(el.dataset.index)))syncBattleUI();
 }));
}
function resetBattle(){
 cancelAutoTimer();
 autoBattle=false;
 missionResultShown=false;
 lastMissionStars=0;
 selectedAbility="basic";
 state=CombatCore.createBattle(battleLineup(),battleFutureWaves());
 CombatCore.advanceToPlayerTurn(state);
 syncBattleUI();
}
function attack(){
 if(autoBattle)return;
 if(CombatCore.performPlayerAbility(state,selectedAbility)){
  selectedAbility="basic";
  syncBattleUI();
 }
}
// Exactly one permanent click handler; no onclick replacement on victory.
$("#attackBtn").addEventListener("click",()=>{if(!state.active)openSquad("home");else attack();});
$("#autoBattleBtn").addEventListener("click",()=>{if(state.active)setAutoBattle(!autoBattle);});
$("#basicAbilityBtn").addEventListener("click",()=>{if(state.active&&!autoBattle){selectedAbility="basic";syncBattleUI();}});
$("#specialAbilityBtn").addEventListener("click",()=>{if(!autoBattle&&CombatCore.abilityReady(state,"special")){selectedAbility="special";syncBattleUI();}});
// A single render callback and a single Engine/Scene for the lifetime of this prototype.
function renderBattleFrame(){if(scene)scene.render();}
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
// Reuse the scene rather than re-creating meshes on every battle entry.
function initBabylon(){
 const canvas=$("#renderCanvas");engine=new BABYLON.Engine(canvas,true,{stencil:true});
 scene=new BABYLON.Scene(engine);scene.clearColor=new BABYLON.Color4(.035,.045,.065,1);
 const camera=new BABYLON.ArcRotateCamera("camera",-Math.PI/2,1.05,15,new BABYLON.Vector3(0,1,0),scene);camera.lowerRadiusLimit=11;camera.upperRadiusLimit=18;camera.attachControl(canvas,true);
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
  const x=h.side==="ally"?-3.4:3.4,z=(i%3-1)*1.55;
  const body=BABYLON.MeshBuilder.CreateCapsule("body_"+i,{height:1.5,radius:.42},scene);body.position=new BABYLON.Vector3(x,.8,z);
  const mat=new BABYLON.StandardMaterial("mat_"+i,scene);mat.diffuseColor=h.side==="ally"?new BABYLON.Color3(.28,.55,.76):new BABYLON.Color3(.72,.25,.23);mat.emissiveColor=h.side==="ally"?new BABYLON.Color3(.02,.06,.09):new BABYLON.Color3(.08,.015,.01);body.material=mat;
  const head=BABYLON.MeshBuilder.CreateSphere("head_"+i,{diameter:.62,segments:12},scene);head.position=new BABYLON.Vector3(x,1.8,z);head.material=mat;
  const base=BABYLON.MeshBuilder.CreateCylinder("base_"+i,{diameter:1.15,height:.12,tessellation:24},scene);base.position=new BABYLON.Vector3(x,.08,z);const bm=new BABYLON.StandardMaterial("basemat_"+i,scene);bm.diffuseColor=h.side==="ally"?new BABYLON.Color3(.65,.48,.2):new BABYLON.Color3(.4,.18,.18);base.material=bm;
  meshes[h.id]={body,head,base};
 });
 // Registered only once because initBabylon() runs once.
 window.addEventListener("resize",()=>{if(shouldRenderBattle())engine.resize();});
}
function updateMeshes(){
 if(!scene)return;
 for(const h of HEROES){
  const mesh=meshes[h.id];
  if(!mesh)continue;
  const member=state.fighters.find(f=>f.id===h.id);
  const visible=!!member&&member.hp>0;
  mesh.body.setEnabled(visible);
  mesh.head.setEnabled(visible);
  mesh.base.setEnabled(visible);
  if(visible){
   const sideMembers=state.fighters.filter(f=>f.side===member.side);
   const slot=sideMembers.findIndex(f=>f.id===h.id);
   const x=member.side==="ally"?-3.4:3.4;
   const z=(slot-(sideMembers.length-1)/2)*1.55;
   mesh.body.position.x=mesh.head.position.x=mesh.base.position.x=x;
   mesh.body.position.z=mesh.head.position.z=mesh.base.position.z=z;
  }
 }
}
// Browsers may keep the tab alive when it is hidden; suspend GPU work until visible.
document.addEventListener("visibilitychange",()=>{
 if(document.hidden){cancelAutoTimer();stopBattleRendering();}
 else if(shouldRenderBattle()){engine.resize();startBattleRendering();queueAutoAction();}
});
renderHeroes();CombatCore.advanceToPlayerTurn(state);renderCombatants();
