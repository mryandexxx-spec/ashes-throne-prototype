// In isolated legacy VM tests the presentation module may be intentionally omitted.
const ResourceArtUI=typeof ResourceIconUI!=="undefined"?ResourceIconUI:Object.freeze({
 append(){},appendCost(){},
 appendCurrency(host,n){if(host&&Number.isSafeInteger(n)&&n>=0)
  host.textContent+=(host.textContent?" · ":"")+n+" кромов";},
 tile(){return "";},currencyTile(n){return Number.isSafeInteger(n)&&n>=0?n+" кромов":"";},mount(){}
});
// LOREACT5001: validated 15-node final arc; keep prior versions for fixtures.
const ActiveLoreCampaign=typeof LoreCampaignAct5!=="undefined"?LoreCampaignAct5:
 typeof LoreCampaignAct4!=="undefined"?LoreCampaignAct4:
 typeof LoreCampaignAct3!=="undefined"?LoreCampaignAct3:
 typeof LoreCampaignTrials!=="undefined"?LoreCampaignTrials:null;
const HEROES = [
  // REN-PLAYABLE: permanent roster entry; combat numbers are still a test pilot.
  {id:"ren",name:"Рен Терен",classId:"melee",tags:["gardens-over-abyss"],role:"Боец ближнего боя",hp:91,atk:27,speed:150,side:"ally",glyph:"⌁"},
 // NADA-PLAYABLE-001: provisional gameplay role and combat numbers only.
 {id:"nada",name:"Нада",classId:"support",tags:["gardens-over-abyss"],role:"Поддержка · игровой пилот",hp:85,atk:18,speed:120,side:"ally",glyph:"✎"},
 // LIORAPLAY001: provisional unarmed pilot, no approved balance or recruitment canon.
 {id:"liora",name:"Лиора Вель",classId:"tank",tags:["gardens-over-abyss"],role:"Защита · тестовый герой со щитом",hp:105,atk:20,speed:115,side:"ally",glyph:"♙"},
 // ARTSAVA001: playable pilot heroes; portraits approved, combat abilities remain templates.
 {id:"art",name:"Арт",classId:"tank",tags:["gardens-over-abyss"],role:"Страховка · учебные навыки",hp:128,atk:22,speed:118,side:"ally",glyph:"⚒"},
 {id:"sava",name:"Сава",classId:"support",tags:["gardens-over-abyss"],role:"Поддержка · учебные навыки",hp:104,atk:17,speed:136,side:"ally",glyph:"✦"},
  {id:"ves",name:"Вестник Конклава",role:"Противник",hp:90,atk:18,speed:105,side:"enemy",glyph:"☠"},
  {id:"shade",name:"Теневой клинок",role:"Противник",hp:78,atk:22,speed:135,side:"enemy",glyph:"♟"},
  // Demo-only copies: no new combat stats or lore. First mission still uses two enemies.
  {id:"ves-2",name:"Вестник Конклава II",role:"Противник",hp:90,atk:18,speed:105,side:"enemy",glyph:"☠"},
  {id:"shade-2",name:"Теневой клинок II",role:"Противник",hp:78,atk:22,speed:135,side:"enemy",glyph:"♟"},
  {id:"ves-3",name:"Вестник Конклава III",role:"Противник",hp:90,atk:18,speed:105,side:"enemy",glyph:"☠"}
];
// NPCDATA001: only an explicit opt-in unlocks provisional mixed-species
// noncanonical PvE in the no-reward lore-training mode. Ordinary battles remain intact.
const NPC_PILOT_ENABLED=typeof location!=="undefined"&&
 /(?:^|[?&])npcPilot=1(?:&|$)/.test(location.search);
// Only the explicit test URL reserves three additional capsule meshes.
// Their IDs must match the combat instances for picking, HUD and animation.
const NPC_PILOT_IDS=Object.freeze(["npc-pass-guard","npc-sarkh-land-courier","npc-laun-physician"]);
const NPC_PILOT_VISUALS=NPC_PILOT_ENABLED&&typeof NpcEnemyData!=="undefined"
 ? NPC_PILOT_IDS.map((id,i)=>NpcEnemyData.spawn(id,{instanceId:id+"-training-"+(i+1)}))
 : [];
// NPCROLLOUT001: use NPC encounter data in ordinary campaign battles.
const NPC_MISSION_PILOT_ENABLED=true;
const NPC_MISSION_VISUALS=NPC_MISSION_PILOT_ENABLED&&typeof NpcMissionPilot!=="undefined"
 ? NpcMissionPilot.visuals():[];
// NPCROLLOUT001: use NPC rosters and objectives in ordinary challenges.
const NPC_CHALLENGE_PILOT_ENABLED=true;
const NPC_CHALLENGE_VISUALS=NPC_CHALLENGE_PILOT_ENABLED&&typeof NpcChallengePilot!=="undefined"
 ? NpcChallengePilot.visuals():[];
// NPC visuals are loaded only for the current battle.
const COMBAT_VISUALS=HEROES.concat(NPC_PILOT_VISUALS.filter(Boolean));
const encounterNpcVisualIds=new Set();
const $=s=>document.querySelector(s);
// ENV022: default temporary concept-art backdrop. Combat visuals stay unchanged.
// Fixed image has no parallax; it is NOT a rendered/reconstructed 3D environment.
const ENV022_CONCEPT_PREVIEW=typeof location!=="undefined" &&
 !/(?:^|[?&])environment=(?:env017|env010)(?:&|$)/.test(location.search);
let engine, scene, meshes={};
// ARENA-ENV-006 (default since ENV-006C; ?environment=env2d opts out): the ENV-005 terrace art
// projected onto a light 3D proxy; built on battle entry, disposed on exit.
// The CSS art stays underneath as the loading/failure fallback.
const ARENA_ENV006_3D=typeof location!=="undefined"&&typeof CombatEnvironment006!=="undefined"&&
 CombatEnvironment006.enabled(location.search);
let arenaEnv006=null;
function ensureArenaEnv006(){
 if(!ARENA_ENV006_3D||arenaEnv006||!scene||!CombatEnvironment006.supported(BABYLON))return;
 // ENV-006B: background animation off under prefers-reduced-motion (static ENV-006 frame).
 try{arenaEnv006=CombatEnvironment006.create(BABYLON,scene,{reducedMotion:typeof window.matchMedia==="function"&&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches});}
 catch(error){console.warn("ENV006 3D arena unavailable, 2D backdrop stays",error);arenaEnv006=null;}
}
function disposeArenaEnv006(){if(arenaEnv006){arenaEnv006.dispose();arenaEnv006=null;}}
// ASSETLOAD001: one gate over the arena until this fight's models and art are downloaded
// (device cache via AssetLoader/model-cache-sw.js) and placed in the scene. Nothing in the
// battle moves before the first player command, so the gate never hides an enemy turn.
// Shown only if loading takes longer than GATE_SHOW_MS (cached repeats open instantly).
const GATE_SHOW_MS=300,GATE_SKIP_MS=8000;
let battleAssetGate=null;
function battleAssetPlan(){
 const plan=new Map(); // assetId -> {ready():true|false|null}
 const add=(assetId,ready)=>{
  if(typeof AssetManifest==="undefined"||!AssetManifest.get(assetId))return;
  const prev=plan.get(assetId);
  // Several fighters may share one file: ready only when every copy has settled.
  plan.set(assetId,{ready:prev?()=>{const a=prev.ready(),b=ready();return a===false||b===false?false:a&&b?true:null;}:ready});
 };
 const fromRuntime=runtime=>{
  let settled=null;
  void runtime.ready?.then(ok=>{settled=!!ok;},()=>{settled=false;});
  return ()=>runtime.isReady?true:settled;
 };
 const heroes={ren:renGlbRuntime,nada:nadaGlbRuntime,liora:lioraGlbRuntime,sava:savaGlbRuntime,art:artGlbRuntime};
 for(const f of presentationFighters())
  if(f.side==="ally"&&heroes[f.id])add("hero:"+f.id,fromRuntime(heroes[f.id]));
 for(const runtime of npcGlbRuntimes.values())add("npc:"+runtime.archetypeId,fromRuntime(runtime));
 if(arenaEnv006){
  add("arena:env006",()=>arenaEnv006?.state?.()==="ready"?true:arenaEnv006?.state?.()==="error"?false:null);
  if(arenaEnv006.animation?.()!=="off")add("arena:env006b",()=>true);
 }else if(ENV022_CONCEPT_PREVIEW)add("arena:env005",()=>true);
 return plan;
}
function closeBattleAssetGate(){
 const gate=battleAssetGate;
 battleAssetGate=null;
 if(!gate)return;
 clearInterval(gate.timer);clearTimeout(gate.showTimer);clearTimeout(gate.skipTimer);gate.unsubscribe?.();
 const el=$("#battleAssetGate");
 if(el){el.hidden=true;el.dataset.closing="";el.setAttribute("aria-busy","false");}
}
function openBattleAssetGate(){
 closeBattleAssetGate();
 const el=$("#battleAssetGate");
 const plan=battleAssetPlan();
 if(!el||!plan.size||typeof AssetLoader==="undefined")return;
 const ids=[...plan.keys()];
 const gate={ids,plan,timer:null,showTimer:null,skipTimer:null,unsubscribe:null,shown:false,finishing:false};
 battleAssetGate=gate;
 // Downloads go through the worker, which shares one transfer with Babylon's own request.
 void AssetLoader.load(ids);
 const describe=(it,ready)=>{
  if(ready===true)return ["готово","ready"];
  if(ready===false||it.status==="error")return ["простая модель","error"];
  if(it.status==="downloading")return [AssetLoader.percent(it.loaded,it.total)+"%","active"];
  if(it.status==="saving")return ["сохраняем…","active"];
  if(AssetLoader.isOk(it.status))return ["размещаем…","active"];
  return ["ожидает","wait"];
 };
 const render=()=>{
  if(battleAssetGate!==gate)return;
  const sum=AssetLoader.summary(ids);
  let settled=0;
  const rows=sum.items.map(it=>{
   const ready=plan.get(it.id).ready();
   if(ready!==null)settled++;
   const [text,stateName]=describe(it,ready);
   return {label:it.label,text,stateName};
  });
  // 85% = bytes really received, 15% = models placed in the scene.
  const fraction=(sum.total>0?.85*sum.loaded/sum.total:.85)+.15*settled/ids.length;
  const pct=Math.min(100,Math.floor(fraction*100));
  const bar=$("#battleAssetGateBar"),percent=$("#battleAssetGatePercent"),caption=$("#battleAssetGateCaption"),list=$("#battleAssetGateList");
  if(bar)bar.style.width=pct+"%";
  if(percent)percent.textContent=pct+"%";
  const left=rows.filter(r=>r.stateName==="wait"||r.stateName==="active").map(r=>r.label);
  if(caption)caption.textContent=sum.complete
   ?(left.length?"Размещаем на арене: "+left.join(", "):"Готово")
   :AssetLoader.formatMB(sum.loaded)+" из "+AssetLoader.formatMB(sum.total)+" МБ · осталось "+left.length+" из "+rows.length;
  if(list){
   list.textContent="";
   for(const r of rows){
    const li=document.createElement("li");li.dataset.state=r.stateName;
    const a=document.createElement("span");a.textContent=r.label;
    const b=document.createElement("span");b.textContent=r.text;
    li.append(a,b);list.append(li);
   }
  }
  if(settled===ids.length&&sum.complete&&!gate.finishing){
   gate.finishing=true;
   if(!gate.shown){closeBattleAssetGate();return;}
   el.dataset.closing="1";
   setTimeout(()=>{if(battleAssetGate===gate)closeBattleAssetGate();},220);
  }
 };
 gate.unsubscribe=AssetLoader.subscribe(render);
 gate.timer=setInterval(render,120);
 gate.showTimer=setTimeout(()=>{
  if(battleAssetGate!==gate||gate.finishing)return;
  gate.shown=true;el.dataset.closing="";el.hidden=false;el.setAttribute("aria-busy","true");render();
 },GATE_SHOW_MS);
 const skip=$("#battleAssetGateSkip");
 if(skip){
  skip.hidden=true;
  skip.onclick=()=>closeBattleAssetGate(); // models keep loading; capsules swap as they arrive
  gate.skipTimer=setTimeout(()=>{if(battleAssetGate===gate)skip.hidden=false;},GATE_SKIP_MS);
 }
 render();
}
let combatVisual007=null; // One optional visual layer per Babylon Scene.
let arenaFeedback=null; // ARENA-VIS-002: numbers, hit-stop, flash, camera beat.
let renGlbRuntime=null; // Default Ren GLB visual, no gameplay ownership.
let nadaGlbRuntime=null; // Optional Nada GLB only when she is in the party.
// ARENA-ART-004C: enemy GLBs by fighter id; only for encountered NPCs with a model.
const npcGlbRuntimes=new Map();
let lioraGlbRuntime=null; // Optional Liora GLB (shield baked into the rig), only in party.
let savaGlbRuntime=null; // SAVA3D001: optional skinned Sava, no gameplay ownership.
let sava3dDisabledScene=null; // SAVA3D002: optional 3D failures must not block battle startup.
let artGlbRuntime=null; // ART3D001: optional skinned Art, no gameplay ownership.
let art3dDisabledScene=null; // ART3D001: do not retry a failed model in the same scene.
let arenaCamera=null;
// Combat-008B: allies are near the viewer, enemies farther away.
const ARENA_VIEW=typeof ArenaStageView!=="undefined"?ArenaStageView.view:Object.freeze({alpha:-3*Math.PI/4,beta:.96,radius:12,targetY:.9});
// Staggered 3-front / 2-rear formation on each team.
const FORMATION_SPACING=1.9;
function formationPosition(side,slot,count){
 if(typeof ArenaStageView!=="undefined")return ArenaStageView.formation(side,slot,count);
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
let arenaHudLayout=null; // Dune-inspired independent 2D packing; no combat ownership.
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
// RENQUEUE019: finish displaying one resolved action before accepting the next.
function visualActionPending(){return !!scene&&BattleAnimation.pending()>0;}
function captureResolvedVisuals(beforeFighters){
 // One resolved action batch, not an arbitrary UI render.
 if(battleIsChallenge&&challengeTracker){
  if(battleIsNpcChallengePilot)
   NpcChallengePilot.capture(activeChallengeId,challengeTracker,state.events||[],state);
  else ChallengeCore.capture(challengeTracker,state.events||[]);
 }
 if(battleIsSignal&&signalBattleTracker&&!signalCaptureFailed){
  const batch=SignalOperationCore.capture(signalBattleTracker,NpcStoryOpsAdapter.signalEvents(state.events||[]),signalBattleTracker.lastSequence+1);
  if(batch)signalBattleTracker=batch;
  else signalCaptureFailed=true; // Refuse to invent a clean result from incomplete events.
 }
 // Non-rendering contexts still finish immediately; never let graphics gate rules.
 if(!scene||!engine)return;
 const positions={};
 const fighters=beforeFighters||presentationFighters();
 for(const side of ["ally","enemy"]){
  const team=fighters.filter(f=>f.side===side);
  team.forEach((f,i)=>{positions[f.id]={...formationPosition(side,i,team.length),choreographyReady:f.id!=="ren"||renGlbRuntime?.isReady===true};});
 }
 // HUDSYNC001: the pre-action snapshot lets the HUD hold HP until each blow is drawn.
 BattleAnimation.enqueue(state.events,positions,beforeFighters||null);
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
// UI preference is independent of campaign/save v3 and survives battle restarts.
const BATTLE_SPEED_SAVE_KEY="ashes-throne.battle-speed.v1";
function restoreBattleSpeed(){
 try{
  const raw=window.localStorage?.getItem(BATTLE_SPEED_SAVE_KEY);
  const stored=raw===null||raw===undefined?null:Number(raw);
  if(BattleSpeed.levels.includes(stored))BattleSpeed.set(stored);
 }catch(error){/* Private browsing or unavailable storage: use in-memory speed. */}
}
restoreBattleSpeed();
function persistBattleSpeed(){
 try{window.localStorage?.setItem(BATTLE_SPEED_SAVE_KEY,String(BattleSpeed.get()));}
 catch(error){/* Speed selection must still work when storage is blocked. */}
}
function setAutoSpeed(speed){
 if(!BattleSpeed.levels.includes(speed))return false;
 if(!state.active||document.hidden||!$("#battle").classList.contains("active"))return false;
 if(BattleSpeed.get()===speed)return true;
 BattleSpeed.set(speed);
 persistBattleSpeed();
 if(autoBattle)cancelAutoTimer(); // replace an auto timer only if autoplay is running
 syncBattleUI();
 return true;
}
function cancelAutoTimer(){
 if(autoTimer!==null){clearTimeout(autoTimer);autoTimer=null;}
}
function queueAutoAction(){
 if(autoTimer!==null||isVisualTransition()||visualActionPending()||!autoBattle||!state.active||document.hidden||
    !$("#battle").classList.contains("active"))return;
 autoTimer=setTimeout(()=>{
  autoTimer=null;
  if(isVisualTransition()||visualActionPending()||!autoBattle||!state.active||document.hidden||
     !$("#battle").classList.contains("active"))return;
  const before=state.fighters.map(f=>({...f}));
  // Combat-015B: plan only when the scheduled auto step actually executes.
  const plan=AutoDecision.chooseAction(state);
  const tutorialActor=state.fighters[state.currentActor]?.id;
  if(!CombatCore.performAutoAction(state,plan)){setAutoBattle(false);return;}
  if(battleIsFirstPlay&&tutorialActor)firstPlayTaughtActors.add(tutorialActor);
  captureResolvedVisuals(before);
  selectedAbility="basic";
  syncBattleUI();
 },BattleSpeed.duration(AUTO_STEP_MS));
}
function setAutoBattle(enabled){
 cancelAutoTimer();
 // Autoplay remains a normal tactical option; the mission must make it meaningful.
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
const saveBlocked=Boolean(loadedProgress?.blocked);
let saveAvailable=loadedProgress?loadedProgress.available:false;
// FIRSTPLAY001: independent intro checkpoint; reward uses the shared wallet policy.
const firstPlayLoaded=typeof FirstPlayCore!=="undefined"?
 FirstPlayCore.load(()=>window.localStorage):null;
let firstPlayState=firstPlayLoaded?.state||null;
// Existing headless/browser regressions can bypass the narrative entry explicitly.
const FIRST_PLAY_TEST_BYPASS=typeof location!=="undefined"&&
 /(?:^|[?&])skipFirstPlay=1(?:&|$)/.test(location.search);
const firstPlayEligible=!FIRST_PLAY_TEST_BYPASS&&!!firstPlayLoaded?.available&&
 !firstPlayLoaded.blocked&&!saveBlocked&&
 (firstPlayLoaded.exists||Boolean(loadedProgress?.fresh));
let firstPlayFailure=false,firstPlaySaveFailed=false;
// FIRSTSESSION P0-A: don't interrupt the just-completed operation with an
// automatic calendar. Manual calendar navigation/claim and next boot still work.
let deferLoginCalendarForFirstSession=false;
let firstPlayBootCheckpointWritten=!!firstPlayLoaded?.exists;
let firstPlayStoryCursor=typeof FirstPlayStoryCore!=="undefined"?
 FirstPlayStoryCore.load(()=>window.localStorage,firstPlayState?.phase):null;
const campaignLoaded=CampaignCore.load(()=>window.localStorage);
const campaignProgress=progress.saveVersion===3?campaignLoaded.campaign:
 (loadedProgress?.fresh?CampaignCore.fresh():campaignLoaded.campaign);
let campaignSaveAvailable=campaignLoaded.available;
// Restore mission unlocks if a crash occurred after persisting first-clear rewards
// but before writing the separate campaign progress key.
if(progress.saveVersion===3&&!saveBlocked){
 let recovered=false;
 for(const id of progress.claimedMissions){
  if(MissionData.get(id)&&!campaignProgress.completed[id]){
   campaignProgress.completed[id]=true;
   campaignProgress.bestStars[id]=Math.max(1,campaignProgress.bestStars[id]||0);
   recovered=true;
  }
 }
 if(recovered)campaignSaveAvailable=CampaignCore.save(campaignProgress,()=>window.localStorage);
}
// PROFILE-001: nickname is independent from immutable-progress v3 save.
const playerProfileLoaded=typeof PlayerProfileCore!=="undefined"
  ?PlayerProfileCore.load(()=>window.localStorage)
  :{profile:{nickname:"Странник"},available:false,blocked:false};
let playerNickname=playerProfileLoaded.profile.nickname;
function renderPlayerProfile(){
 const title=$("#playerNickname");
 if(!title)return;
 title.textContent=playerNickname;
 const input=$("#playerNicknameInput");
 if(input&&document.activeElement!==input)input.value=playerNickname;
 const xp=typeof PlayerProfileCore!=="undefined"
  ?PlayerProfileCore.levelProgress(progress.accountXp,ProgressCore.xpCost,ProgressCore.MAX_ACCOUNT_LEVEL)
  :null;
 const level=xp?.level??ProgressCore.accountLevel(progress);
 $("#playerAccountLevel").textContent="Уровень "+level;
 const heroCap=ProgressCore.heroLevelCap(progress,"ren");
 const nextCap=ProgressCore.nextHeroCapUnlock(level);
 const capInfo=$("#playerHeroLevelCap");
 if(capInfo)capInfo.textContent="Сейчас можно повысить героя максимум до уровня "+heroCap+".";
 const capNext=$("#playerHeroCapNext");
 if(capNext)capNext.textContent=heroCap>=ProgressCore.MAX_LEVEL?
  "Рен и Нада достигли целевого предела: 85. Максимум уровня аккаунта пока технический.":
  (nextCap?"На уровне аккаунта "+nextCap.accountLevel+
   " откроется максимальный уровень героя "+nextCap.heroCap+". Получай Account XP за миссии.":
   "Для дальнейшего развития нужен новый уровень аккаунта.");
 const track=$("#playerAccountXpTrack"),fill=$("#playerAccountXpFill");
 if(track)track.setAttribute("aria-valuenow",String(Math.round(xp?.percent??0)));
 if(fill)fill.style.width=(xp?.percent??0)+"%";
 $("#playerAccountXpText").textContent=xp?.required===null
  ?"Текущий технический предел аккаунта · Всего "+progress.accountXp+" XP"
  :(xp?xp.current+" / "+xp.required+" XP до следующего уровня · Всего "+xp.totalXp+" XP"
     :progress.accountXp+" XP");
 if(typeof ResourceArtUI!=="undefined") $("#playerAccountXpText")?.insertAdjacentHTML?.("beforeend",ResourceArtUI.tile("account-xp",null,{compact:true}));
 const missions=MissionData.all();
 const completed=missions.filter(m=>campaignProgress.completed[m.id]===true).length;
 const stars=missions.reduce((sum,m)=>sum+Math.min(3,Math.max(0,campaignProgress.bestStars[m.id]||0)),0);
 $("#playerCompletedMissions").textContent=completed+" / "+missions.length;
 $("#playerCampaignStars").textContent=stars+" / "+(missions.length*3);
 $("#playerHeroCount").textContent=ALLIES.length;
 const hint=$("#playerNicknameNotice");
 if(hint&&!hint.textContent)hint.textContent=playerProfileLoaded.blocked
  ?"Сохранённый ник повреждён. Изменение заблокировано, чтобы не потерять данные."
  :playerProfileLoaded.available?"":"Сохранение ника недоступно в этом браузере.";
}
$("#playerNicknameForm")?.addEventListener("submit",event=>{
 event.preventDefault();
 const notice=$("#playerNicknameNotice"),input=$("#playerNicknameInput");
 if(!notice||!input||typeof PlayerProfileCore==="undefined")return;
 if(playerProfileLoaded.blocked){
  notice.textContent="Сохранение ника заблокировано: повреждённые данные не перезаписываются.";
  return;
 }
 const nick=PlayerProfileCore.normalizeNick(input.value);
 if(!nick){notice.textContent="Ник должен содержать 2–24 символа без управляющих знаков и скобок < >.";return;}
 if(!PlayerProfileCore.save({nickname:nick},()=>window.localStorage)){
  notice.textContent="Не удалось сохранить ник. Старое имя оставлено без изменений.";return;
 }
 playerNickname=nick;
 notice.textContent="Ник сохранён на этом устройстве.";
 renderPlayerProfile();
 if(typeof renderHeadquarters==="function")renderHeadquarters();
});
// NET-007: network is now playable by default; ?networkPilot=1 keeps sandbox tests.
const NETWORK_PILOT_ENABLED=typeof window!=="undefined"&&
 typeof window.location?.search==="string"&&
 /(?:^|[?&])networkPilot=1(?:&|$)/.test(window.location.search);
let networkPilot=null,battleIsNetwork=false,networkResultRecorded=false,networkResultReady=false;
let weeklySession=null,battleIsWeekly=false,weeklyResultRecorded=false,weeklyResultReady=false;
let battleIsCampaign=false;
let battleIsFirstPlay=false;
// Presentation-only, reset on each real battle attempt; no persisted tutorial state.
let firstPlayTaughtActors=new Set();
let battleIsNpcMissionPilot=false; // NPC roster, normal campaign rewards and saves.
let battleIsLoreTraining=false; // Noncanonical combat, no costs or rewards.
let battleIsLoreRequired=false;
let loreRequiredContext=null,loreRequiredResult=null;
// STORY-001 is an opt-in sandbox, independent of campaign rewards and saves.
let battleIsStoryDemo=false;
let battleIsChallenge=false;
let battleIsNpcChallengePilot=false; // NPC objectives, normal saved challenge scores.
const challengeLoaded=typeof ChallengeCore!=="undefined"?
 ChallengeCore.load(()=>window.localStorage):
 {progress:{bestStars:{"T-01":0,"N-01":0}},available:false,blocked:true};
let challengeProgress=challengeLoaded.progress;
let challengeSaveBlocked=challengeLoaded.blocked;
let challengeSaveAvailable=challengeLoaded.available;
let activeChallengeId=null,challengeTracker=null;
let selectedChallengeKind=null;
let challengeResultRecorded=false,challengeLastStars=0,challengeSaveFailed=false;
// OPS-001B: independent checkpoint; never part of campaign or the player wallet.
const operationLoaded=typeof OperationCore!=="undefined"?OperationCore.load(()=>window.localStorage):
 {progress:{active:null,history:[]},available:false,blocked:true};
let operationProgress=operationLoaded.progress;
let operationSaveBlocked=operationLoaded.blocked;
let operationSaveAvailable=operationLoaded.available;
let operationNotice="",operationRunCounter=0,operationBattleRunId=null;
let battleIsOperation=false,operationResultRecorded=false;
// OPS-002B: isolated signal-post pilot; no use of the OPS-001 record key.
const signalLoaded=typeof SignalOperationCore!=="undefined"?
 SignalOperationCore.load(()=>window.localStorage):
 {progress:{active:null,history:[]},available:false,blocked:true};
let signalProgress=signalLoaded.progress;
let signalSaveBlocked=signalLoaded.blocked,signalSaveAvailable=signalLoaded.available;
let signalNotice="",signalRunCounter=0,signalBattleRunId=null;
let battleIsSignal=false,signalResultRecorded=false,signalBattleTracker=null,signalCaptureFailed=false;
let storyTrialParty=false; // Only for the opt-in story sandbox, never saved.
let storyDemoState=null;
let missionResultShown=false;
let missionResultRecorded=false;
let activeMissionId=null;
// CAM-001B — separate main story mode; existing squad, arena and v3 writer.
let battleIsMainCampaign=false,mainCampaignResult=null,mainCampaignClaiming=false,mainCampaignNotice="";
const mainCampaignStorage=()=>window.localStorage;
function mainCampaignWritable(){
 return typeof MainCampaignCore!=="undefined"&&!saveBlocked&&saveAvailable&&progress.saveVersion===3&&
  typeof ProgressWriterCore!=="undefined"&&ProgressWriterCore.canPersist();
}
function renderMainCampaign(){
 if(typeof MainCampaignCore==="undefined"||!$("#mainCampaignMap"))return;
 const proof=MainCampaignCore.load(mainCampaignStorage);
 const status=MainCampaignCore.status(proof,progress);
 const best=proof?.best||0;
 $("#mainCampaignProgress").textContent="Миссии: "+(best>0?1:0)+"/1 · Звёзды: "+best+"/3";
 $("#mainCampaignStars").textContent="★".repeat(best)+"☆".repeat(3-best);
 $("#mainCampaignNode").textContent=best?"Повторить бой":"Выбрать отряд";
 $("#mainCampaignNode").disabled=!mainCampaignWritable()||status==="blocked"||mainCampaignClaiming;
 $("#mainCampaignClaim").hidden=status!=="claimable";
 $("#mainCampaignClaim").disabled=!mainCampaignWritable()||mainCampaignClaiming;
 $("#mainCampaignNext").dataset.unlocked=String(status==="claimed");
 $("#mainCampaignNextStatus").textContent=status==="claimed"?"Путь открыт · следующий эпизод готовится":"Закрыто до первой победы и награды";
 $("#mainCampaignNotice").textContent=mainCampaignNotice||(status==="blocked"||(!mainCampaignWritable()&&!mainCampaignClaiming)?
  "Сохранение недоступно. Проверьте данные браузера и перезагрузите игру.":status==="claimed"?
  "Награда получена. Повторы бесплатны, только для улучшения звёзд.":status==="claimable"?
  "Победа сохранена. Заберите награду.":"Первый бой бесплатный. Награда за первую победу: "+MainCampaignCore.SOURCE.reward.currency+" кромов.");
}
function openMainCampaignMission(){
 if(!mainCampaignWritable()||mainCampaignClaiming||MainCampaignCore.status(MainCampaignCore.load(mainCampaignStorage),progress)==="blocked")return false;
 mainCampaignNotice="";activeMissionId=null;openSquad("mainCampaign");return true;
}
function renderMainCampaignResult(){
 if(!mainCampaignResult||typeof MainCampaignCore==="undefined")return;
 const result=mainCampaignResult,proof=MainCampaignCore.load(mainCampaignStorage);
 const status=MainCampaignCore.status(proof,progress);
 $("#mainCampaignResultTitle").textContent=result.earned?"Победа":"Поражение";
 $("#mainCampaignResultStars").textContent="★".repeat(result.earned)+"☆".repeat(3-result.earned)+" · Лучший результат: "+(proof?.best||0)+"/3";
 $("#mainCampaignResultText").textContent=mainCampaignNotice||(!result.ok?
  "Не удалось подтвердить сохранение. Перезагрузите игру и проверьте карту.":!result.earned?
  "Отряд потерпел поражение. Награды нет. Можно изменить состав и повторить.":
  status==="claimed"?"Результат сохранён. Разовая награда уже получена.":
  "Результат сохранён. Заберите "+MainCampaignCore.SOURCE.reward.currency+" кромов за первую победу.");
 $("#mainCampaignResultClaim").hidden=status!=="claimable"||!result.earned||!result.ok;
 $("#mainCampaignResultClaim").disabled=!mainCampaignWritable()||mainCampaignClaiming;
 $("#mainCampaignResultRetry").disabled=mainCampaignClaiming||!result.ok||!mainCampaignWritable();
 $("#mainCampaignResultBack").disabled=mainCampaignClaiming;
}
async function claimMainCampaignReward(){
 if(mainCampaignClaiming||!mainCampaignWritable()||MainCampaignCore.status(MainCampaignCore.load(mainCampaignStorage),progress)!=="claimable")return;
 mainCampaignClaiming=true;mainCampaignNotice="";renderMainCampaign();renderMainCampaignResult();
 try{
  const result=await MainCampaignCore.claim({storageProvider:mainCampaignStorage,heroes:ALLIES,
   exclusive:ProgressWriterCore.exclusive,day:dailyDay()});
  if(!result.ok){
   if(["SAVE_OUTCOME_UNKNOWN","REWARD_SYNC_FAILED","EXCLUSIVE_LOCK_FAILED","STALE_WALLET","WALLET_READ_FAILED","INVALID_WALLET","ALREADY_CLAIMED"].includes(result.code))
    window.walletWriterHalt?.();
   mainCampaignNotice="Награда не подтверждена. Проверьте баланс после перезагрузки.";
   return;
  }
  Object.keys(progress).forEach(key=>delete progress[key]);Object.assign(progress,result.runtime);
  saveAvailable=true;mainCampaignNotice="Награда получена. Следующий путь открыт.";
  renderAccountHeader();renderPlayerProfile();renderDailyTasks();renderHeroes();
 }catch(_){window.walletWriterHalt?.();mainCampaignNotice="Проверьте баланс после перезагрузки.";}
 finally{mainCampaignClaiming=false;renderMainCampaign();renderMainCampaignResult();}
}
$("#mainCampaignNode")?.addEventListener("click",()=>{if($("#campaign")?.classList.contains("active")&&selectedCampaignPath==="main")openMainCampaignMission();});
$("#mainCampaignClaim")?.addEventListener("click",()=>void claimMainCampaignReward());
$("#mainCampaignResultClaim")?.addEventListener("click",()=>void claimMainCampaignReward());
$("#mainCampaignResultRetry")?.addEventListener("click",()=>{if($("#mainCampaignResult")?.classList.contains("active"))openMainCampaignMission();});
$("#mainCampaignResultBack")?.addEventListener("click",()=>{if(!mainCampaignClaiming)showScreen("mainCampaign");});

let lastMissionStars=0;
let lastMissionReward=null;
let lastUnlockedHeroId=null;
let lastMissionFarmReward=null;
let lastMissionEnergyRefunded=false;
let missionEntryPaid=false;
let missionResultSaveFailed=false;
let simulationMissionId=null;

// P0-D: a compact, optional next action, driven by actual first-play and OPS checkpoints.
function firstSessionFollowUp(){
 return firstPlayEligible&&typeof FirstPlayCore!=="undefined"&&typeof FirstPlayCore.followUp==="function"?
  FirstPlayCore.followUp(firstPlayState,operationProgress,!operationSaveBlocked&&operationSaveAvailable&&!saveBlocked,OperationCore.STORY_ID):null;
}
// P1-A: reward -> existing hero card -> existing operation, no forced tutorial.
let firstSessionClaiming=false,firstSessionRewardNotice="",firstReportOperationRequested=false;
const storyOperation=run=>!!run&&typeof OperationCore.STORY_ID==="string"&&run.operationId===OperationCore.STORY_ID;
function firstSessionAction(){
 const follow=firstSessionFollowUp();
 if(!firstPlayEligible||!firstPlayState)return null;
 const writable=!saveBlocked&&saveAvailable&&typeof ProgressWriterCore!=="undefined"&&ProgressWriterCore.isOwner();
 const reward=FirstPlayCore.rewardStatus(firstPlayState,progress,writable);
 if(reward==="claimable")return "reward";
 if(reward==="blocked"&&FirstPlayCore.wonProof(firstPlayState)&&!FirstPlayCore.rewardClaimed(progress))
  return ["resume","training-active"].includes(follow)?follow:"reward-blocked";
 if(follow==="available"&&reward==="claimed"&&writable&&heroOwned("ren")&&
    ProgressCore.levelOf(progress,"ren")===1&&ProgressCore.upgradePlan(progress,"ren",1)?.levels===1)
  return "upgrade";
 return follow;
}
function renderFirstSessionFollowUp(){
 const panel=$("#hqFirstSession"),action=$("#hqFirstSessionAction"),detail=$("#hqFirstSessionDetail"),
  title=$("#hqFirstSessionTitle");
 if(!panel||!action||!detail)return;
 const status=firstSessionAction();
 panel.hidden=!status;
 if(!status)return;
 if(title)title.textContent=status==="reward"||status==="reward-blocked"?"Первое донесение":
  status==="upgrade"?"Подготовить Рена":"Установить источник распоряжения";
 detail.textContent=firstSessionRewardNotice||(status==="reward"?
  "Рабочие спасены. Награда за операцию — "+FirstPlayCore.REWARD_SOURCE.reward.currency+" кромов.":
  status==="reward-blocked"?"Награда доступна после восстановления сохранения. Можно подготовить героев.":
  status==="upgrade"?"Увеличьте уровень героя: 1 → 2. Это усилит его в следующих боях.":
  status==="unavailable"?"Реестр пока недоступен. Можно подготовить героев.":
  status==="resume"?"Продолжите перехват копии распоряжения.":
  status==="training-active"?"Сначала завершите или прервите текущую учебную операцию.":
  "Мастер указал реестр, через который прошло распоряжение. Проверьте отправку.");
 action.textContent=firstSessionClaiming?"Сохраняем…":status==="reward"?"Забрать награду":
  status==="upgrade"?"Усилить Рена ›":status==="unavailable"||status==="reward-blocked"?"К героям ›":
  status==="resume"||status==="training-active"?"Продолжить ›":"По следу ›";
 action.disabled=firstSessionClaiming;
}
async function claimFirstSessionReward(){
 if(firstSessionClaiming||firstSessionAction()!=="reward")return;
 firstSessionClaiming=true;firstSessionRewardNotice="";renderFirstSessionFollowUp();
 try{
  const result=await FirstPlayCore.claimReward({
   storageProvider:()=>window.localStorage,heroes:ALLIES,
   exclusive:ProgressWriterCore.exclusive,day:dailyDay()
  });
  if(!result.ok){
   if(["SAVE_OUTCOME_UNKNOWN","REWARD_SYNC_FAILED","EXCLUSIVE_LOCK_FAILED","STALE_WALLET",
       "WALLET_READ_FAILED","INVALID_WALLET","ALREADY_CLAIMED"].includes(result.code)){
    window.walletWriterHalt?.();
    firstSessionRewardNotice="Проверьте баланс после перезагрузки игры.";
   }else firstSessionRewardNotice="Награда пока не сохранена. Можно повторить попытку.";
   return;
  }
  Object.keys(progress).forEach(key=>delete progress[key]);
  Object.assign(progress,result.runtime);saveAvailable=true;
  renderAccountHeader();renderPlayerProfile();renderDailyTasks();renderHeroes();
 }catch(_){
  window.walletWriterHalt?.();
  firstSessionRewardNotice="Проверьте баланс после перезагрузки игры.";
 }finally{
  firstSessionClaiming=false;renderFirstSessionFollowUp();
 }
}
$("#hqFirstSessionAction")?.addEventListener("click",()=>{
 if(!$("#home")?.classList.contains("active")||firstSessionClaiming)return;
 const status=firstSessionAction();
 if(status==="reward"){void claimFirstSessionReward();return;}
 if(status==="upgrade"){openHeroDetail("ren");return;}
 if(status==="available"||status==="resume"){firstReportOperationRequested=true;showScreen("operations");return;}
 if(status)showScreen(status==="unavailable"||status==="reward-blocked"?"collection":"operations");
});
// HQ-UI-001: use existing progress/state; this view does not own game rules.
function renderHeadquarters(){
 const root=$("#home");
 if(!root||typeof root.querySelectorAll!=="function"||typeof PlayerProfileCore==="undefined"||typeof ChallengeCore==="undefined"||typeof CampaignData==="undefined")return;
 const set=(selector,value)=>{const node=$(selector);if(node)node.textContent=String(value);};
 renderFirstSessionFollowUp();
 set("#hqNickname",playerNickname);
 const level=ProgressCore.accountLevel(progress);
 set("#hqLevel","Ур. "+level+" · тест");
 const xp=PlayerProfileCore.levelProgress(progress.accountXp,ProgressCore.xpCost,ProgressCore.MAX_ACCOUNT_LEVEL);
 const xpFill=$("#hqXpFill");if(xpFill)xpFill.style.width=Math.max(0,Math.min(100,xp?.percent||0))+"%";
 set("#hqEnergy",progress.energy.value+"/"+ProgressCore.ENERGY_MAX);
 set("#hqCurrency",progress.currency);
 const chosen=[selectedLeaderId,...selectedPartyIds].filter(Boolean);
 set("#hqSquadStatus","Отряд: "+chosen.length+"/"+MAX_SQUAD);
 root.querySelectorAll(".hq-squad-slot").forEach((node,index)=>{
  const hero=ALLIES.find(h=>h.id===chosen[index]);
  node.classList.toggle("filled",!!hero);
  node.title=hero?.name||"Свободное место";
  node.setAttribute("aria-label",node.title);
 });
 const missions=[...new Set(CampaignData.allChapters().flatMap(ch=>CampaignData.missions(ch.id).map(m=>m.missionId)))];
 const completed=missions.filter(id=>campaignProgress.completed[id]).length;
 const stars=missions.reduce((count,id)=>count+(campaignProgress.bestStars[id]||0),0);
 set("#hqCampaignStatus","Пройдено: "+completed+" / "+missions.length);
 set("#hqCampaignStars","Звёзд: "+stars+" / "+missions.length*3);
 const campBar=$("#hqCampaignFill");if(campBar)campBar.style.width=(missions.length?100*completed/missions.length:0)+"%";
 const networkState=networkPilot?.isReady()?networkPilot.read():null;
 const networkActive=!!networkState?.active;
 set("#hqOperationStatus",networkState?
  "Донесений: "+networkState.board.length+" / "+networkState.config.capacity:
  "Донесения и недельная угроза");
 const opsFlag=$("#hqOperationFlag");if(opsFlag)opsFlag.classList.toggle("is-active",networkActive);
 set("#hqOperationText",networkActive?"Вылазка в работе":networkState?"Открыть донесения":"Открыть сеть");
 const challengeDone=Object.values(challengeProgress.bestStars||{}).filter(n=>n>0).length;
 const challengeTotal=ChallengeCore.all().length;
 set("#hqChallengeStatus","Пройдено: "+challengeDone+" / "+challengeTotal);
 const chalBar=$("#hqChallengeFill");if(chalBar)chalBar.style.width=(challengeTotal?100*challengeDone/challengeTotal:0)+"%";
}

function renderAccountHeader(){
 renderDailyClaimBadge();
 ProgressCore.refreshEnergy(progress);
 const summary=$("#accountStatus");
 if(summary){
  summary.textContent="Аккаунт "+ProgressCore.accountLevel(progress)+"/"+ProgressCore.MAX_ACCOUNT_LEVEL+
   " (тест) · ⚡ "+progress.energy.value+"/"+ProgressCore.ENERGY_MAX+
   (progress.saveVersion===3?"":" · C "+progress.gearMaterials);
  summary.insertAdjacentHTML?.("beforeend",ResourceArtUI.tile("account-xp",progress.accountXp,{compact:true,mode:"balance"})+
   ResourceArtUI.currencyTile(progress.currency,{compact:true,mode:"balance"}));
  if(typeof ResourceIconUI==="undefined")summary.textContent+=" · Кромы "+progress.currency;
 }
 renderHeadquarters();
}
// Daily-001: all daily claims and currency/XP are persisted in the SAME v3 save.
function dailyDay(){return typeof DailyCore!=="undefined"?DailyCore.localDay():null;}
function recordDailyTask(id){
 const day=dailyDay();
 return progress.saveVersion===3&&!saveBlocked&&!!day&&DailyCore.record(progress,id,day);
}
function renderDailyClaimBadge(){
 const badge=$("#dailyClaimBadge"),button=$("#dailyTasksNav");
 if(!badge||!button)return;
 const count=saveBlocked?0:DailyCore.unclaimedCount(progress,dailyDay());
 badge.hidden=count===0;
 badge.textContent=String(count);
 button.setAttribute("aria-label","Задания дня"+
  (count?" · наград к получению: "+count:" · нет незабранных наград"));
}
// NET-UX-003: the network and legacy screen render the SAME DailyCore ledger.
// Navigation never records a task, creates a reward or changes network.v1.
let dailyNavigationOrigin=false;
function dailyNotify(message,materials,xp=0,skillMaterials=null,currency=0){
 for(const id of ["dailyTaskNotice","netuxDailyTaskNotice"]){
  const notice=$("#"+id);if(!notice)continue;
  notice.textContent=message;
  ResourceArtUI.appendCurrency(notice,currency,{compact:true});
  ResourceArtUI.append(notice,xp,skillMaterials,{compact:true});
  if(materials)GearMaterialUI.append(notice,materials);
 }
}
function renderDailyTasks(){
 const lists=["dailyTaskList","netuxDailyTaskList"].map(id=>$("#"+id)).filter(Boolean);
 if(!lists.length)return;
 const day=dailyDay();
 if(progress.saveVersion!==3||saveBlocked||!day||!DailyCore.today(progress,day)){
  for(const list of lists)list.textContent="Ежедневные задания недоступны: проверь сохранение или дату на устройстве.";
  for(const id of ["dailyClaimAll","netuxDailyClaimAll"]){const button=$("#"+id);if(button)button.disabled=true;}
  const summary=$("#netuxDailyProgress");if(summary)summary.textContent="Прогресс временно недоступен";
  const badge=$("#netuxDailyBadge");if(badge)badge.hidden=true;
  dailyNotify("Награды не начисляются, пока состояние недоступно.");
  return;
 }
 const oldDay=$("#dailyDay");if(oldDay)oldDay.textContent="День: "+day;
 const netDay=$("#netuxDailyDay");if(netDay)netDay.textContent="День: "+day;
 const total=DailyCore.TASKS.length;
 const completed=DailyCore.TASKS.filter(t=>progress.daily.counts[t.id]===1).length;
 const pending=DailyCore.unclaimedCount(progress,day);
 const summary=$("#netuxDailyProgress");
 if(summary)summary.textContent="Выполнено "+completed+" из "+total+" · наград к получению: "+pending;
 const badge=$("#netuxDailyBadge");
 if(badge){badge.hidden=pending===0;badge.textContent=String(pending);}
 for(const id of ["dailyClaimAll","netuxDailyClaimAll"]){
  const all=$("#"+id);if(all)all.disabled=DailyCore.unclaimedCount(progress,day)===0;
 }
 for(const list of lists){
  const networkList=list.id==="netuxDailyTaskList";
  list.replaceChildren();
  for(const task of DailyCore.TASKS){
   const row=document.createElement("div");
   row.className=networkList?"netux-daily-task":"daily-task";
   const label=document.createElement("div");
   const title=document.createElement("strong");title.textContent=task.label;
   const detail=document.createElement("small");
   const done=progress.daily.counts[task.id]===1,claimed=progress.daily.claimed.includes(task.id);
   detail.textContent="Прогресс "+(done?"1/1":"0/1")+" · "+
    (claimed?"Награда получена":done?"Готово к получению":"Не выполнено");
   ResourceArtUI.appendCurrency(detail,task.currency,{compact:true});
   ResourceArtUI.append(detail,task.xp,task.skillMaterials,{compact:true});
   GearMaterialUI.append(detail,task.materials);
   label.append(title,detail);
   const claimButton=document.createElement("button");claimButton.type="button";
   claimButton.className=claimed?"ghost":"primary";
   claimButton.textContent=claimed?"Получено":done?"Получить":"Ещё не выполнено";
   claimButton.disabled=claimed||!done;claimButton.dataset.dailyClaim=task.id;
   if(networkList){
    const actions=document.createElement("div");actions.className="netux-daily-actions";
    if(!done){
     const go=document.createElement("button");go.type="button";go.className="ghost";
     go.dataset.dailyGo=task.id;go.textContent="Перейти";
     go.setAttribute("aria-label","Перейти к заданию: "+task.label);
     actions.append(go);
    }
    actions.append(claimButton);row.append(label,actions);
   }else row.append(label,claimButton);
   list.append(row);
  }
 }
}
function openDailyActivity(id){
 const destination={
  "hero-level":"collection","equip-item":"collection","campaign-battle":"campaign",
  "tactical-participation":"challenges","onslaught-participation":"challenges"
 }[id];
 if(!destination||!DailyCore.IDS.includes(id))return false;
 dailyNavigationOrigin=true;
 if(id==="tactical-participation")selectedChallengeKind="tactical";
 if(id==="onslaught-participation")selectedChallengeKind="onslaught";
 showScreen(destination);
 return true;
}
function updateDailyReturn(id){
 const back=$("#netuxDailyReturn");if(!back)return;
 back.hidden=true;
 if(!dailyNavigationOrigin)return;
 if(!["collection","heroDetail","campaign","challenges","challengeResult","campaignResult"].includes(id))return;
 const host=$("#"+id);
 if(!host)return;
 (host.querySelector(".section-heading")||host).append(back);
 back.hidden=false;
}
$("#netuxDailyReturn")?.addEventListener("click",()=>{
 if(dailyNavigationOrigin)showScreen("network");
});
for(const listId of ["dailyTaskList","netuxDailyTaskList"]){
 const list=$("#"+listId);
 list?.addEventListener("click",event=>{
  const go=event.target.closest?.("[data-daily-go]");
  if(go&&list.contains(go)){openDailyActivity(go.dataset.dailyGo);return;}
  const button=event.target.closest?.("[data-daily-claim]");
  if(!button||!list.contains(button)||saveBlocked||button.disabled)return;
  const snapshot=JSON.stringify(progress),day=dailyDay();
  const reward=DailyCore.claim(progress,button.dataset.dailyClaim,day);
  if(!reward)return;
  if(!persistProgress()){
   Object.keys(progress).forEach(key=>delete progress[key]);
   Object.assign(progress,JSON.parse(snapshot));
   dailyNotify("Не удалось сохранить награду. Кромы и XP не начислены.");
   renderDailyTasks();renderDailyClaimBadge();return;
  }
  dailyNotify("Награда получена:",reward.materials,reward.xp,reward.skillMaterials,reward.currency);
  renderDailyTasks();renderDailyClaimBadge();renderAccountHeader();renderPlayerProfile();renderHeroes();
 });
}
for(const buttonId of ["dailyClaimAll","netuxDailyClaimAll"]){
 $("#"+buttonId)?.addEventListener("click",()=>{
  if(saveBlocked||progress.saveVersion!==3)return;
  const snapshot=JSON.stringify(progress),day=dailyDay();
  if(!day)return;
  const batch=DailyCore.claimAll(progress,day);
  if(!batch)return;
  if(!persistProgress()){
   Object.keys(progress).forEach(key=>delete progress[key]);
   Object.assign(progress,JSON.parse(snapshot));
   dailyNotify("Не удалось сохранить все награды. Начисление отменено.");
   renderDailyTasks();renderDailyClaimBadge();return;
  }
  dailyNotify("Получено наград: "+batch.ids.length,batch.materials,batch.xp,batch.skillMaterials,batch.currency);
  renderDailyTasks();renderDailyClaimBadge();renderAccountHeader();renderPlayerProfile();renderHeroes();
 });
}
// UI-only visit marker: never grants rewards and never rewrites progress.v3.
const LOGIN_CALENDAR_SEEN_KEY="ashes-throne.login-calendar-seen.v1";
let loginCalendarSeenDay=null;
try{
 const raw=window.localStorage?.getItem(LOGIN_CALENDAR_SEEN_KEY);
 if(typeof raw==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(raw))loginCalendarSeenDay=raw;
}catch(_){/* Unavailable storage disables only cross-reload prompt suppression. */}
function markLoginCalendarSeen(){
 const day=dailyDay();
 if(!day||(loginCalendarSeenDay&&day<=loginCalendarSeenDay))return;
 loginCalendarSeenDay=day;
 try{window.localStorage?.setItem(LOGIN_CALENDAR_SEEN_KEY,day);}
 catch(_){/* Keep once-per-session guarantee without overwriting game data. */}
}
function firstPlayStore(next){
 if(!next||!FirstPlayCore.save(next,()=>window.localStorage)){
  firstPlaySaveFailed=true;return false;
 }
 firstPlayState=next;firstPlaySaveFailed=false;return true;
}
function firstPlayNotice(message){
 const node=$("#firstPlayNotice");
 if(node){node.textContent=message||"";node.hidden=!message;}
 const story=$("#firstPlayStoryNotice");
 if(story){story.textContent=message||"";story.hidden=!message;}
}
function firstPlayStorySetCursor(next){
 if(!next||typeof FirstPlayStoryCore==="undefined")return false;
 firstPlayStoryCursor=next;
 // Story-page position is convenience state, not a second gameplay save.
 return FirstPlayStoryCore.save(next,()=>window.localStorage);
}
// P1-C: opt-in audio only; no context is constructed until the user taps Sound.
const firstPlaySound=typeof FirstPlaySound!=="undefined"?FirstPlaySound.create(window.AudioContext||window.webkitAudioContext):null;
let firstPlaySoundRequested=false,firstPlaySoundRequest=0;
function firstPlaySoundStop(disable=false){
 if(disable){firstPlaySoundRequested=false;firstPlaySoundRequest++;firstPlaySound?.disable();}
 else firstPlaySound?.stop();
 const button=$("#firstPlayStorySound");
 if(button){button.textContent=firstPlaySoundRequested?"Звук: вкл.":"Звук: выкл.";button.setAttribute("aria-pressed",String(firstPlaySoundRequested));}
}
function syncFirstPlaySound(){
 if(!firstPlaySoundRequested||!firstPlaySound||!$("#firstPlay")?.classList.contains("active")||
  document.visibilityState==="hidden"||window.innerWidth<window.innerHeight||
  (firstPlayState?.phase==="briefing"&&firstPlayStoryPaused)){firstPlaySound?.stop();return;}
 const frame=FirstPlayStoryCore.frame(firstPlayState.phase,firstPlayState.choice,firstPlayStoryCursor);
 const cue=firstPlayState.phase==="won"?(firstPlayStoryCursor.step===0?"rescue":"document"):frame.art;
 firstPlaySound.play(cue,[firstPlayState.phase,firstPlayStoryCursor.step,frame.art].join(":"));
}
$("#firstPlayStorySound")?.addEventListener("click",async()=>{
 if(!firstPlaySound||firstPlaySoundRequested){firstPlaySoundStop(true);return;}
 const ticket=++firstPlaySoundRequest;
 firstPlaySoundRequested=true;
 const enabled=await firstPlaySound.enable();
 if(ticket!==firstPlaySoundRequest)return;
 if(!enabled||!$("#firstPlay")?.classList.contains("active")){firstPlaySoundStop(true);return;}
 const button=$("#firstPlayStorySound");
 if(button){button.textContent="Звук: вкл.";button.setAttribute("aria-pressed","true");}
 syncFirstPlaySound();
});
let firstPlayStoryTimer=null,firstPlayStoryManualAt=-Infinity;
let firstPlayNextImage=null,firstPlayNextURL=null;
function clearFirstPlayNext(){firstPlayNextImage=null;firstPlayNextURL=null;}
function preloadFirstPlayNext(){
 if(!firstPlayState||!$("#firstPlay")?.classList.contains("active")||
  document.visibilityState==="hidden"||window.innerWidth<window.innerHeight||
  typeof window.Image!=="function")return;
 const cursor=FirstPlayStoryCore.advance(firstPlayState.phase,firstPlayStoryCursor);
 if(!cursor){clearFirstPlayNext();return;}
 const next=FirstPlayStoryCore.frame(firstPlayState.phase,firstPlayState.choice,cursor);
 const url=FirstPlayStoryCore.ART[next.art];
 if(!url||url===firstPlayNextURL)return;
 // One adjacent frame, only after the visible frame has loaded. No preload of
 // the entire sequence or of an unearned victory while combat owns the screen.
 firstPlayNextURL=url;
 firstPlayNextImage=new window.Image();
 firstPlayNextImage.decoding="async";
 firstPlayNextImage.fetchPriority="low";
 firstPlayNextImage.src=url;
}
let firstPlayStoryPaused=typeof window.matchMedia==="function"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let firstPlayStoryClock={step:null,remaining:0,started:0};
function stopFirstPlayStoryTimer(){
 if(firstPlayStoryTimer!==null){
  clearTimeout(firstPlayStoryTimer);firstPlayStoryTimer=null;
  firstPlayStoryClock.remaining=Math.max(0,firstPlayStoryClock.remaining-(Date.now()-firstPlayStoryClock.started));
 }
}
function scheduleFirstPlayStory(){
 stopFirstPlayStoryTimer();
 if(firstPlayState?.phase!=="briefing"||!$("#firstPlay")?.classList.contains("active"))return;
 const frame=FirstPlayStoryCore.frame("briefing",null,firstPlayStoryCursor);
 const step=firstPlayStoryCursor.step;
 if(firstPlayStoryClock.step!==step)firstPlayStoryClock={step,remaining:frame.duration||0,started:0};
 // A frame gets its reading time after its image loads (or errors to text fallback).
 // Pause/background/portrait preserve the remaining time rather than skipping ahead.
 if(!frame.duration||firstPlayStoryPaused||document.visibilityState==="hidden"||
  window.innerWidth<window.innerHeight||$("#firstPlayStoryImage")?.complete===false)return;
 firstPlayStoryClock.started=Date.now();
 firstPlayStoryTimer=setTimeout(()=>{
  firstPlayStoryTimer=null;firstPlayStoryClock.remaining=0;
  if(!firstPlayStoryPaused&&document.visibilityState!=="hidden"&&
   !(window.innerWidth<window.innerHeight)&&$("#firstPlay")?.classList.contains("active")&&
   firstPlayState?.phase==="briefing")firstPlayStoryNext();
 },firstPlayStoryClock.remaining);
}
function renderFirstPlay(){
 if(!firstPlayState||typeof FirstPlayStoryCore==="undefined")return;
 firstPlayStoryCursor=FirstPlayStoryCore.normalize(firstPlayStoryCursor,firstPlayState.phase);
 const scene=FirstPlayStoryCore.frame(firstPlayState.phase,firstPlayState.choice,firstPlayStoryCursor);
 const name=$("#firstPlayStorySpeaker"),line=$("#firstPlayStoryLine"),
  cueNode=$("#firstPlayStoryCue"),
  image=$("#firstPlayStoryImage"),art=FirstPlayStoryCore.ART[scene.art],
  source=$("#firstPlayStorySource"),avif=FirstPlayStoryCore.AVIF[scene.art],
  cast=FirstPlayStoryCore.CAST[scene.speakerId],
  character=$("#firstPlayStoryCharacter"),portrait=$("#firstPlayStoryCharacterPortrait"),
  portraitSource=$("#firstPlayStoryPortraitSource"),
  voice=$("#firstPlayStoryVoice"),story=$("#firstPlayStory");
 if(name)name.textContent=cast?.label||scene.speaker;
 if(line)line.textContent=scene.text;
 if(cueNode){cueNode.textContent=scene.cue||"";cueNode.hidden=!scene.cue;}
 const documentProp=$("#firstPlayStoryDocument");
 if(documentProp){documentProp.hidden=!scene.document;
  $("#firstPlayStoryDocumentFirst").textContent=scene.document?.[0]||"";
  $("#firstPlayStoryDocumentSecond").textContent=scene.document?.[1]||"";}
 syncFirstPlaySound();
 if(story){
  story.dataset.speaker=scene.speakerId||"unknown";
  story.dataset.shot=scene.shot||"wide";
  story.dataset.art=scene.art||"unknown";
  story.dataset.phase=firstPlayState.phase;
  story.dataset.order=firstPlayState.choice||"none";
 }
 // A speaker portrait belongs inside dialogue, not pasted over the scene.
 // All named speakers have readable portraits; visual cutouts remain replaceable scene art.
 if(voice){voice.hidden=!cast?.portrait;voice.dataset.npc=cast?.npc?"true":"false";}
 if(portraitSource)portraitSource.setAttribute("srcset",cast?.portraitAvif||"");
 if(character&&portrait){
  character.hidden=!cast?.portrait;
  if(cast?.portrait&&portrait.getAttribute("src")!==cast.portrait){
   // Never display the *previous speaker's* face against a new name while loading.
   portrait.dataset.loading="true";
   portrait.hidden=false;
   portrait.onload=()=>{
    portrait.dataset.loading="false";
    portrait.classList.remove("fp-face-in");
    void portrait.offsetWidth;
    portrait.classList.add("fp-face-in");
   };
   portrait.alt="Портрет персонажа: "+cast.name;
   portrait.src=cast.portrait;
  }
 }
 const artSurface=$("#firstPlayStory .fp-story-art");
 const artChanged=!!(image&&art&&image.getAttribute("src")!==art);
 if(artChanged&&artSurface){
  const previous=image.currentSrc;
  if(previous){
   // Keep the last painted frame visible while the next shot decodes.
   artSurface.style.backgroundImage="url("+JSON.stringify(previous)+")";
   artSurface.style.backgroundSize="cover";
   artSurface.style.backgroundPosition="center 43%";
  }
  image.onload=()=>{artSurface.style.backgroundImage="";};
 }
 // Remove stale AVIF on shots that only have WebP assets.
 if(source&&source.getAttribute("srcset")!==(avif||""))source.setAttribute("srcset",avif||"");
 if(artChanged){
  image.hidden=false;
  image.src=art;
  image.classList.remove("fp-fade");
  void image.offsetWidth;
  image.classList.add("fp-fade");
 }
 const context=$("#firstPlayStoryContext");
 if(context){
  const showNote=firstPlayState.phase==="ready"||
   (firstPlayState.phase==="briefing"&&firstPlayStoryCursor.step===FirstPlayStoryCore.INTRO.length-1)||
   (firstPlayState.phase==="won");
  const label=firstPlayState.phase==="won"&&firstPlayStoryCursor.step===0&&FirstPlayStoryCore.ORDER_LABELS[firstPlayState.choice]?
   "Эффект вашего приказа в бою: "+(FirstPlayStoryCore.ORDER_LABELS[firstPlayState.choice]||"")+". ":"";
  context.textContent=showNote?(firstPlayState.phase==="won"&&firstPlayStoryCursor.step>0?"Следующая цель: установить источник распоряжения.":label+(scene.detail||"")):"";
  context.hidden=!showNote;
 }
 const orderSignal=$("#firstPlayStoryOrderSignal");
 if(orderSignal){
  const chosen=!!FirstPlayStoryCore.ORDER_LABELS[firstPlayState.choice]&&(firstPlayState.phase==="ready"||firstPlayState.phase==="won");
  orderSignal.textContent=chosen?(FirstPlayStoryCore.ORDER_LABELS[firstPlayState.choice]||""):"";
  orderSignal.hidden=!chosen;
 }
 const lastIntro=firstPlayState.phase==="briefing"&&firstPlayStoryCursor.step===FirstPlayStoryCore.INTRO.length-1;
 const won=firstPlayState.phase==="won";
 const lastOutro=won&&firstPlayStoryCursor.step===FirstPlayStoryCore.OUTRO.length-1;
 const next=$("#firstPlayStoryNext"),choices=$("#firstPlayStoryChoices"),
  fight=$("#firstPlayStoryFight"),finish=$("#firstPlayStoryFinish");
 if(next)next.hidden=lastIntro||firstPlayState.phase==="ready"||lastOutro;
 if(choices)choices.hidden=true;
 if(fight){fight.hidden=firstPlayState.phase!=="ready"&&!lastIntro;
  fight.textContent=firstPlayFailure?"Повторить бой":"Прикрыть отход ⚔";}
 const pause=$("#firstPlayStoryPause");
 if(pause){pause.hidden=firstPlayState.phase!=="briefing"||lastIntro;
  pause.textContent=firstPlayStoryPaused?"Продолжить":"Пауза";
  pause.setAttribute("aria-pressed",String(firstPlayStoryPaused));}
 scheduleFirstPlayStory();
 if(image?.complete)preloadFirstPlayNext();
 if(finish)finish.hidden=!lastOutro;
 const notice=$("#firstPlayStoryNotice");
 let warning=firstPlayFailure?"Группе пока не удалось удержать проход. Можно повторить бой.":firstPlaySaveFailed?
 "Сохранение операции не подтверждено; при обновлении страницы бой может потребоваться повторить.":"";
 if(notice){notice.textContent=warning;notice.hidden=!warning;}
 // Preserve original DOM hooks for older tests, but do not display duplicate
 // briefing and outcome panels beneath the actual story presentation.
 const original=$("#firstPlayBriefing"),oldResult=$("#firstPlayOutcome");
 if(original)original.hidden=true;
 if(oldResult)oldResult.hidden=true;
}
$("#firstPlayStoryCharacterPortrait")?.addEventListener("error",()=>{
 // On a failed image request, keep the text and controls readable.
 const character=$("#firstPlayStoryCharacter"),voice=$("#firstPlayStoryVoice");
 if(character)character.hidden=true;
 if(voice)voice.hidden=true;
});
$("#firstPlayStoryImage")?.addEventListener("load",event=>{
 // A deferred error from a previous source must never leave the real art hidden.
 if(event.currentTarget.naturalWidth>0)event.currentTarget.hidden=false;
 scheduleFirstPlayStory();
 preloadFirstPlayNext();
});
$("#firstPlayStoryImage")?.addEventListener("error",event=>{
 // Keep the story readable when no art is available, not after a valid load.
 if(!event.currentTarget.naturalWidth){
  event.currentTarget.hidden=true;
  const surface=$("#firstPlayStory .fp-story-art");
  if(surface?.style)surface.style.backgroundImage="";
 }
 scheduleFirstPlayStory();
 preloadFirstPlayNext();
});
function firstPlayStoryNext(event){
 if(event){const now=Date.now();if(now-firstPlayStoryManualAt<350)return;firstPlayStoryManualAt=now;}
 const next=FirstPlayStoryCore.advance(firstPlayState?.phase,firstPlayStoryCursor);
 if(next){firstPlayStorySetCursor(next);renderFirstPlay();}
}
function firstPlayStorySkip(){
 const result=FirstPlayStoryCore.skipNarration(firstPlayState?.phase,firstPlayState?.choice,firstPlayStoryCursor);
 if(result.action==="battle")firstPlayStartBattle();
 else if(result.action==="finish")$("#firstPlayContinue")?.click();
}
$("#firstPlayStoryNext")?.addEventListener("click",firstPlayStoryNext);
$("#firstPlayStoryPause")?.addEventListener("click",()=>{
 if(firstPlayState?.phase!=="briefing")return;
 firstPlayStoryPaused=!firstPlayStoryPaused;renderFirstPlay();
});
document.addEventListener("visibilitychange",()=>{scheduleFirstPlayStory();syncFirstPlaySound();});
window.addEventListener?.("resize",()=>{scheduleFirstPlayStory();syncFirstPlaySound();});
window.addEventListener?.("pagehide",()=>{stopFirstPlayStoryTimer();firstPlaySoundStop(true);});
window.addEventListener?.("pageshow",scheduleFirstPlayStory);
window.matchMedia?.("(prefers-reduced-motion: reduce)")?.addEventListener?.("change",event=>{
 if(event.matches){firstPlayStoryPaused=true;if($("#firstPlay")?.classList.contains("active"))renderFirstPlay();}
});
$("#firstPlayStorySkip")?.addEventListener("click",firstPlayStorySkip);
$("#firstPlayStorySurvey")?.addEventListener("click",()=>firstPlayChoose("survey"));
$("#firstPlayStoryCover")?.addEventListener("click",()=>firstPlayChoose("cover"));
$("#firstPlayStoryFight")?.addEventListener("click",firstPlayStartBattle);
$("#firstPlayStoryFinish")?.addEventListener("click",()=>$("#firstPlayContinue")?.click());
function openFirstPlayOnEntry(){
 if(!firstPlayEligible||!firstPlayState||firstPlayState.phase==="done")return false;
 // A fresh player's first two story frames happen BEFORE the first order.
 // Persist an explicit briefing checkpoint now, so reload cannot mistake this
 // visitor for a legacy returning player and silently skip the whole narrative.
 if(!firstPlayBootCheckpointWritten){
  if(!firstPlayStore(firstPlayState)){
   firstPlayNotice("Не удалось сохранить начало истории.");
   return false;
  }
  firstPlayBootCheckpointWritten=true;
 }
 showScreen("firstPlay");return true;
}
function firstPlayChoose(choice){
 if(!firstPlayEligible||!firstPlayState)return;
 const next=FirstPlayCore.choose(firstPlayState,choice);
 if(!next||!firstPlayStore(next)){firstPlayNotice("Не удалось сохранить приказ.");return;}
 firstPlayStoryCursor=FirstPlayStoryCore.normalize(null,"ready");
 firstPlayFailure=false;renderFirstPlay();
}
function firstPlayStartBattle(){
 if(!firstPlayEligible||!["briefing","ready"].includes(firstPlayState?.phase))return;
 const prepared=firstPlayState.phase==="briefing"?FirstPlayCore.prepare(firstPlayState):firstPlayState;
 const next=FirstPlayCore.start(prepared);
 if(!firstPlayStore(next)){firstPlayNotice("Не удалось сохранить начало боя.");return;}
 stopFirstPlayStoryTimer();firstPlayFailure=false;squadReturnScreen="firstPlay";showScreen("battle");
}
function firstPlayFinish(won){
 const next=FirstPlayCore.finish(firstPlayState,won);
 if(!next)return;
 if(!firstPlayStore(next)){firstPlayState=next;firstPlaySaveFailed=true;}
 firstPlayFailure=!won;
 firstPlayStoryCursor=FirstPlayStoryCore.normalize(null,won?"won":"ready");
 FirstPlayStoryCore.save(firstPlayStoryCursor,()=>window.localStorage);
}
$("#firstPlaySurvey")?.addEventListener("click",()=>firstPlayChoose("survey"));
$("#firstPlayCover")?.addEventListener("click",()=>firstPlayChoose("cover"));
$("#firstPlayBattle")?.addEventListener("click",firstPlayStartBattle);
$("#firstPlaySkip")?.addEventListener("click",()=>{
 const next=FirstPlayCore.skip(firstPlayState);
 if(!firstPlayStore(next)){firstPlayNotice("Не удалось сохранить пропуск вступления.");return;}
 deferLoginCalendarForFirstSession=true;
 squadReturnScreen="home";showScreen("home");
});
$("#firstPlayContinue")?.addEventListener("click",()=>{
 const next=FirstPlayCore.complete(firstPlayState);
 if(!firstPlayStore(next)){firstPlayNotice("Не удалось сохранить окончание вступления.");return;}
 deferLoginCalendarForFirstSession=true;
 squadReturnScreen="home";showScreen("home");
});
function maybeOpenLoginOnEntry(){
 if(deferLoginCalendarForFirstSession)return false;
 if(firstPlayEligible&&firstPlayState?.phase!=="done")return false;
 if(document.hidden||saveBlocked||progress.saveVersion!==3||
    !$("#home")?.classList.contains("active"))return false;
 const day=dailyDay();
 if(!day||(loginCalendarSeenDay&&day<=loginCalendarSeenDay)||
    !LoginCore.current(progress,day))return false;
 showScreen("loginCalendar");
 return true;
}
// LOGIN-CAL-003: two rows per page; selection and browsing never alter wallet state.
const LOGIN_PAGE_SIZE=14;
let loginCalendarPage=-1,loginCalendarSelectedDay=0,loginCalendarRenderedMonth=null;
function loginPrimaryIcon(host,primary){
 host.replaceChildren();
 if(!primary)return;
 const id=primary.id;
 let icon=null;
 if(primary.art){
  icon=document.createElement("img");
  icon.src=primary.art;icon.alt="";icon.decoding="async";
 }else if(primary.kind==="material"&&typeof GearData!=="undefined"&&
  GearData.MATERIALS.includes(id)){
  icon=document.createElement("img");icon.src="assets/gear-materials/"+id+".webp?v=1";
  icon.alt="";icon.decoding="async";
 }else if((primary.kind==="currency"||primary.kind==="resource")&&
  typeof ResourceIconUI!=="undefined"&&ResourceIconUI.IDS.includes(id)){
  icon=document.createElement("span");icon.className="resource-art resource-art--"+id;
  icon.setAttribute("aria-hidden","true");
 }else{
  icon=document.createElement("span");icon.className="login-reward-fallback";
  icon.textContent=primary.kind==="hero-shard"?"✦":"◆";
 }
 host.append(icon);
}
function renderLoginCalendar(){
 const grid=$("#loginCalendarGrid"),status=$("#loginCalendarStatus"),button=$("#loginClaim");
 const prev=$("#loginPrev"),next=$("#loginNext");
 if(!grid||!status||!button||!prev||!next)return;
 const view=LoginCore.current(progress,dailyDay());
 if(saveBlocked||!view){
  grid.textContent="Календарь недоступен: проверь дату и сохранение.";
  button.disabled=true;prev.disabled=true;next.disabled=true;
  status.textContent="Награды не начисляются, пока профиль недоступен.";
  return;
 }
 if(loginCalendarRenderedMonth!==view.month){
  loginCalendarPage=-1;loginCalendarSelectedDay=0;
  loginCalendarRenderedMonth=view.month;
 }
 const pages=Math.ceil(view.days/LOGIN_PAGE_SIZE);
 const todayDay=view.available?view.nextDay:Math.max(1,view.claimedThisMonth);
 if(loginCalendarSelectedDay<1||loginCalendarSelectedDay>view.days){
  loginCalendarSelectedDay=todayDay;loginCalendarPage=-1;
 }
 if(loginCalendarPage<0||loginCalendarPage>=pages)
  loginCalendarPage=Math.floor((loginCalendarSelectedDay-1)/LOGIN_PAGE_SIZE);
 const start=loginCalendarPage*LOGIN_PAGE_SIZE+1;
 const end=Math.min(start+LOGIN_PAGE_SIZE-1,view.days);
 const monthLabel=$("#loginCalendarMonth");
 if(monthLabel)monthLabel.textContent=new Intl.DateTimeFormat("ru-RU",{month:"long",year:"numeric"})
  .format(new Date(Number(view.month.slice(0,4)),Number(view.month.slice(5,7))-1,1));
 $("#loginMiniProgress").textContent=view.claimedThisMonth+" / "+view.days;
 $("#loginHeaderProgress").textContent=view.claimedThisMonth+" из "+view.days+" получено";
 $("#loginProgressFill").style.width=(100*view.claimedThisMonth/view.days)+"%";
 $("#loginPageInfo").textContent=start+"–"+end+" / "+view.days+" · "+(loginCalendarPage+1)+"/"+pages;
 prev.disabled=loginCalendarPage===0;
 next.disabled=loginCalendarPage===pages-1;
 grid.replaceChildren();
 for(let i=0;i<view.days;i++){
  const reward=LoginCore.rewardForDay(i+1);
  if(i+1<start||i+1>end)continue;
  const primary=ResourceIconUI.calendarPrimary(reward);
  const cell=document.createElement("button");cell.type="button";
  cell.className="login-day"+(i<view.claimedThisMonth?" claimed":"")+
   (view.available&&i===view.nextDay-1?" active":"")+
   (loginCalendarSelectedDay===i+1?" selected":"");
  cell.dataset.loginDay=String(i+1);
  cell.setAttribute("aria-pressed",String(loginCalendarSelectedDay===i+1));
  cell.setAttribute("aria-label","День "+(i+1)+": "+(primary?.label||"Награда")+
   " "+(primary?.amount??"")+(i<view.claimedThisMonth?", получено":""));
  const number=document.createElement("strong");number.textContent=String(i+1);
  const art=document.createElement("span");art.className="login-day-art";
  loginPrimaryIcon(art,primary);
  const amount=document.createElement("small");
  amount.textContent=primary?(primary.kind==="currency"&&primary.id==="krom"?
   String(primary.amount):"×"+primary.amount):"—";
  cell.append(number,art,amount);
  cell.addEventListener("click",()=>{
   loginCalendarSelectedDay=i+1;
   renderLoginCalendar();
   grid.querySelector('[data-login-day="'+(i+1)+'"]')?.focus({preventScroll:true});
  });
  grid.append(cell);
 }
 for(let d=end+1;d<start+LOGIN_PAGE_SIZE;d++){
  const placeholder=document.createElement("span");
  placeholder.className="login-day-placeholder";placeholder.setAttribute("aria-hidden","true");
  grid.append(placeholder);
 }
 const chosen=LoginCore.rewardForDay(loginCalendarSelectedDay);
 const main=ResourceIconUI.calendarPrimary(chosen);
 $("#loginSelectedTitle").textContent="День "+loginCalendarSelectedDay;
 $("#loginSelectedState").textContent=loginCalendarSelectedDay<=view.claimedThisMonth?
  "Награда получена":loginCalendarSelectedDay===view.nextDay&&view.available?
  "Доступно сегодня":"Можно посмотреть заранее";
 loginPrimaryIcon($("#loginPrimaryArt"),main);
 $("#loginPrimaryTitle").textContent=!main?"Награда":
  main.kind==="currency"&&main.id==="krom"?main.amount+" кромов":
  main.kind==="hero-shard"?main.label+" ×"+main.amount:
  main.amount+" · "+main.label;
 $("#loginPrimarySubtitle").textContent=main?.subtitle||"";
 const extras=$("#loginRewardExtras");extras.replaceChildren();
 if(!(main?.kind==="currency"&&main.id==="krom"))
  ResourceArtUI.appendCurrency(extras,chosen.currency,{compact:true});
 ResourceArtUI.append(extras,main?.kind==="resource"&&main.id==="account-xp"?0:chosen.xp,
  main?.kind==="resource"?Object.fromEntries(Object.entries(chosen.skillMaterials||{})
   .filter(([id])=>id!==main.id)):chosen.skillMaterials,{compact:true});
 const gear=main?.kind==="material"?Object.fromEntries(Object.entries(chosen.materials||{})
  .filter(([id])=>id!==main.id)):chosen.materials;
 GearMaterialUI.append(extras,gear);
 if(!extras.childElementCount)extras.textContent="Дополнительных наград нет";
 button.disabled=!view.available;
 button.textContent=view.available?"Забрать награду дня "+view.nextDay:
  view.alreadyClaimed?"Сегодня получено":"Получение недоступно";
 status.textContent=view.clockBack?"Дата на устройстве раньше последней полученной награды.":
  view.alreadyClaimed?"Сегодня награда уже получена.":
  view.available?"Одна награда в день.":"Месяц завершён.";
}
$("#loginPrev")?.addEventListener("click",()=>{
 if(loginCalendarPage<=0)return;
 loginCalendarPage--;loginCalendarSelectedDay=loginCalendarPage*LOGIN_PAGE_SIZE+1;
 renderLoginCalendar();
});
$("#loginNext")?.addEventListener("click",()=>{
 const view=LoginCore.current(progress,dailyDay());
 if(!view||loginCalendarPage>=Math.ceil(view.days/LOGIN_PAGE_SIZE)-1)return;
 loginCalendarPage++;loginCalendarSelectedDay=loginCalendarPage*LOGIN_PAGE_SIZE+1;
 renderLoginCalendar();
});
$("#loginRulesOpen")?.addEventListener("click",()=>$("#loginCalendarRules")?.showModal());
$("#loginRulesClose")?.addEventListener("click",()=>$("#loginCalendarRules")?.close());
$("#loginCalendarRules")?.addEventListener("click",event=>{
 if(event.target===event.currentTarget)event.currentTarget.close();
});
$("#loginClaim")?.addEventListener("click",()=>{
 if(saveBlocked)return;
 const snapshot=JSON.stringify(progress);
 const reward=LoginCore.claim(progress,dailyDay());
 if(!reward){renderLoginCalendar();return;}
 if(!persistProgress()){
  Object.keys(progress).forEach(key=>delete progress[key]);
  Object.assign(progress,JSON.parse(snapshot));
  renderLoginCalendar();
  $("#loginCalendarStatus").textContent="Ошибка сохранения. Награда не выдана.";
  return;
 }
 loginCalendarSelectedDay=reward.day;
 loginCalendarPage=Math.floor((reward.day-1)/LOGIN_PAGE_SIZE);
 renderLoginCalendar();renderDailyTasks();renderPlayerProfile();renderHeroes();
 $("#loginCalendarStatus").textContent="Награда дня "+reward.day+" получена и сохранена.";
});
function persistProgress(){
 if(storageAdapter)saveAvailable=storageAdapter.save(progress,()=>window.localStorage);
 // An unknown write outcome requires a reload: continuing risks a duplicate spend.
 if(!saveAvailable&&progress.saveVersion===3)window.walletWriterHalt?.();
 renderAccountHeader();
 const notice=$("#progressSaveNote");
 if(notice)notice.textContent=saveAvailable
  ?"Прогресс сохраняется в этом браузере. Очистка данных Safari может его удалить."
  :"Сохранение сейчас недоступно. Прогресс может сброситься после перезагрузки.";
 return saveAvailable;
}

// DEV-RES-001: temporary prototype tool, separate from campaign and rewards.
$("#devResourcesGrant")?.addEventListener("click",()=>{
 if(saveBlocked){$("#devResourcesNotice").textContent="Повреждённое сохранение. Выдача ресурсов заблокирована.";return;}
 const before=progress.saveVersion===3?JSON.stringify(progress):null;
 const granted=ProgressCore.grantTestResources(progress);
 if(!granted)return;
 if(progress.saveVersion===3&&typeof SkillCore!=="undefined"&&!SkillCore.grantTest(progress))return;
 if(progress.saveVersion===3&&typeof StarCore!=="undefined"&&!StarCore.refillTest(progress))return;
 if(!persistProgress()&&before){
  Object.keys(progress).forEach(k=>delete progress[k]);
  Object.assign(progress,JSON.parse(before));
  renderAccountHeader();
  $("#devResourcesNotice").textContent="Не удалось сохранить выдачу. Запасы не изменены.";
  return;
 }
 const status=$("#devResourcesNotice");
 if(status)status.textContent="Тестовый запас готов: энергия "+progress.energy.value+"/"+ProgressCore.ENERGY_MAX+
  ", кромы "+progress.currency+", материал C "+progress.gearMaterials+
  (progress.saveVersion===3?" · Компоненты G"+Math.max(1,...Object.values(progress.gear||{}).map(g=>g.tier||1)):"")+
  (progress.saveVersion===3&&typeof SkillCore!=="undefined"&&progress.skillMaterials?" · Навыки: "+
   SkillCore.RESOURCE_IDS.map(id=>SkillCore.LABELS[id]+" "+
    progress.skillMaterials[id]).join(", "):"")+
  (progress.saveVersion===3&&typeof StarCore!=="undefined"?" · Осколки: тестовый запас для достижения 7★.":"")+
  (saveAvailable?". Сохранено в этом браузере.":". Внимание: сохранение недоступно.");
 if(status&&progress.saveVersion===3)GearMaterialUI.append(status,progress.materials,{stock:true});
});

// PROG-085: distinct explicit test aid; never mixed with normal rewards.
$("#devLevel85Grant")?.addEventListener("click",()=>{
 const status=$("#devLevel85Notice");
 if(saveBlocked){if(status)status.textContent="Прогресс недоступен.";return;}
 const before=JSON.stringify(progress);
 if(!ProgressCore.grantLevelTestResources(progress))return;
 if(!persistProgress()&&progress.saveVersion===3){
  Object.keys(progress).forEach(key=>delete progress[key]);
  Object.assign(progress,JSON.parse(before));
  renderAccountHeader();
  if(status)status.textContent="Не удалось сохранить тестовую выдачу.";
  return;
 }
 renderHeroes();renderSquad();
 if($("#heroDetail")?.classList.contains("active"))renderHeroDetail();
 if(status)status.textContent="Тестовый доступ: аккаунт "+ProgressCore.accountLevel(progress)+
  ", кромы "+progress.currency+". Герои остаются на прежних уровнях.";
});
 
let selectedHeroId=ALLIES[0].id;
let selectedGearSlot=0;
let levelSelectionHeroId=null,selectedLevelTarget=null;
// Formation persists independently of hero levels/campaign saves. On the first
// visit (or invalid/unavailable storage), use the first five roster heroes.
const SQUAD_SAVE_KEY="ashes-throne.squad.v1";
function heroOwned(id){
 return typeof HeroCollectionCore==="undefined"||HeroCollectionCore.owned(progress,id);
}
function heroUnlockLabel(id){
 const mission=typeof HeroCollectionCore!=="undefined"?HeroCollectionCore.unlockMission(id):null;
 return ["ren","nada","liora","art","sava"].includes(id)?"Доступен с начала (тест)":mission?(MissionData.get(mission)?.title||"миссия"):"сюжетное прохождение";
}
function defaultSquad(){
 // Prefer the five playable heroes, not demonstration capsules on a new profile.
 const preferred=["ren","nada","liora","sava","art"];
 const ids=preferred.filter(id=>ALLIES.some(h=>h.id===id)&&heroOwned(id));
 if(!ids.length)ids.push(...ALLIES.filter(h=>heroOwned(h.id)).slice(0,MAX_SQUAD).map(h=>h.id));
 return {leaderId:ids[0]??null,regularIds:ids.slice(1,MAX_SQUAD)};
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
  return {leaderId:heroOwned(parsed.leaderId)?parsed.leaderId:null,
   regularIds:Array.from({length:MAX_SQUAD-1},(_,i)=>
    heroOwned(parsed.regularIds[i])?parsed.regularIds[i]??null:null)};
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
// LC-007: temporary selection for the story encounter. Never overwrite the
// player's saved normal battle formation just to include required heroes.
const LORE_REQUIRED_HERO_IDS=Object.freeze(["ren","nada"]);
// Encounter-specific requirements are temporary: the regular saved squad is untouched.
function requiredLoreHeroIds(){
 const extra=LoreCampaignTrials.encounter(loreRequiredContext?.nodeId)?.requiredHeroIds||[];
 return [...new Set([...LORE_REQUIRED_HERO_IDS,...extra])];
}
let loreSquadSlots=null;
// NET-004: pilot formation is session-only; never overwrite the player squad key.
let networkSquadSlots=null;
function isLoreRequiredSquad(){return squadReturnScreen==="loreRequired";}
function prepareLoreRequiredSlots(current){
 const slots=current.slice(0,MAX_SQUAD);
 while(slots.length<MAX_SQUAD)slots.push(null);
 const mandatory=requiredLoreHeroIds();
 for(const heroId of mandatory){
  if(slots.includes(heroId))continue;
  let index=slots.indexOf(null);
  if(index<0){
   // Keep the leader whenever possible. Remove the last optional fighter,
   // never another mandatory fighter, so Ren and Nada are always included.
   for(let i=slots.length-1;i>=0;i--){
    if(!mandatory.includes(slots[i])){index=i;break;}
   }
  }
  if(index<0)throw Error("LORE_REQUIRED_SQUAD_NO_SLOT");
  slots[index]=heroId;
 }
 return slots;
}
function setSquadSlots(slots){
 if(isLoreRequiredSquad()){
  loreSquadSlots=slots.slice(0,MAX_SQUAD);
 }else if(["network","weekly"].includes(squadReturnScreen)&&networkSquadSlots){
  networkSquadSlots=slots.slice(0,MAX_SQUAD);
 }else{
  selectedLeaderId=slots[0];
  selectedPartyIds=slots.slice(1);
  saveSquad();
 }
}
function requiredLoreSquadReady(){
 const ids=squadSlots();
 return requiredLoreHeroIds().every(id=>ids.includes(id)&&heroOwned(id));
}
let undersizedSquadConfirmed=false;
function resetSquadWarning(){
 undersizedSquadConfirmed=false;
 const warning=$("#squadWarning");
 if(warning){warning.hidden=true;warning.textContent="";}
}
function eligibleSquadCount(){
 // ALLIES is the available/selectable roster, capped to five battle slots.
 return Math.min(MAX_SQUAD,ALLIES.filter(h=>heroOwned(h.id)).length);
}
let state=CombatCore.createBattle([...ALLIES,...ENEMIES.slice(0,2)]);
// Stats-002C [TEST PILOT]: provisional combat profiles, not canonical identities.
const PILOT_HERO_STATS=Object.freeze({
 ren:Object.freeze({physicalDefense:14,magicDefense:9,maxProtection:0}),
 nada:Object.freeze({physicalDefense:8,magicDefense:12,maxProtection:0})
});
const PILOT_ENEMY_STATS=Object.freeze({physicalDefense:8,magicDefense:8,maxProtection:0});
function equippedPilotStats(hero,profile){
 if(!hero||!profile)return hero;
 const protection=profile.maxProtection+(hero.protection||0);
 return {...hero,combatProfile:"stats002c",physicalAttack:hero.atk,
  physicalDefense:profile.physicalDefense+(hero.physicalDefense||0),
  magicDefense:profile.magicDefense+(hero.magicDefense||0),
  protection,maxProtection:protection};
}
// STATS-001B: the two production heroes use one stat source, directly.
// Other fighters remain test mannequins under their existing demo rules.
function progressedHero(hero){
 let h;
 if((["ren","nada","liora","art","sava"].includes(hero.id))&&
    typeof HeroStatsCore!=="undefined"&&
    typeof HeroStatsProfiles!=="undefined"&&
    typeof HeroStatsCombatBridge!=="undefined"){
  const level=ProgressCore.levelOf(progress,hero.id);
  const stars=typeof StarCore!=="undefined"?StarCore.rankOf(progress,hero.id):1;
  if(level===null||stars===null||stars<1)return null;
  const gearBonuses=ProgressCore.gearBonuses(progress,hero.id);
  h=HeroStatsCombatBridge.apply(hero,{
   level,stars,gearPercent:gearBonuses,gearStats:gearBonuses.stats
  },HeroStatsProfiles[hero.id],HeroStatsCore);
 }else{
  const calculated=ProgressCore.heroStats(progress,hero);
  if(!calculated)return null;
  h=equippedPilotStats(calculated,PILOT_HERO_STATS[hero.id]);
 }
 return typeof SkillCore==="undefined"?h:
  {...h,skillLevels:Object.fromEntries(SkillCore.UPGRADABLE_IDS.map(id=>[id,SkillCore.level(progress,hero.id,id)]))};
}
function progressedEnemy(enemy){
 const h=equippedPilotStats({...enemy},PILOT_ENEMY_STATS);
 // Training targets get neutral, valid RNG fields. This does not change their
 // legacy skills or stats in battles involving only demo characters.
 return {...h,accuracy:0,evasion:0,critChance:0,critDamage:150,
  defensePenetration:0,debuffPotency:0,debuffResistance:0};
}
function hasLeaderSkill(id){
 const hero=ALLIES.find(h=>h.id===id);
 return !!hero&&!!AbilityData.get(hero,"leader");
}
function squadSlots(){
 if(isLoreRequiredSquad()&&loreSquadSlots)return loreSquadSlots.slice();
 if(["network","weekly"].includes(squadReturnScreen)&&networkSquadSlots)return networkSquadSlots.slice();
 return [selectedLeaderId,...selectedPartyIds];
}
function selectedParty(){
 // Only occupied positions enter battle, ordered by their actual slot.
 // An empty leader position does NOT transfer leadership to slot 2.
 return squadSlots().filter(Boolean)
  .filter(heroOwned)
  .map(id=>ALLIES.find(h=>h.id===id)).filter(Boolean).map(progressedHero);
}
function battleLineup(){
 if(battleIsMainCampaign)return [...selectedParty(),...MainCampaignCore.enemies(NpcEnemyData)];
 if(battleIsFirstPlay){
  const art=progressedHero(ALLIES.find(h=>h.id==="art"));
  const ren=progressedHero(ALLIES.find(h=>h.id==="ren"));
  if(!art||!ren)throw Error("FIRST_PLAY_HERO_MISSING");
  // First order has real combat consequences.
  if(firstPlayState?.choice==="survey")art.speed+=FirstPlayCore.EFFECTS.survey.bonus;
  if(firstPlayState?.choice==="cover"){
   ren.maxProtection=(ren.maxProtection||0)+FirstPlayCore.EFFECTS.cover.bonus;
   ren.protection=(ren.protection||0)+FirstPlayCore.EFFECTS.cover.bonus;
  }
  // Reuse the live human NPC combat/visual system, not Conclave demo mannequins.
  const plan=[
   {archetype:"npc-pass-guard",id:"npc-first-guard",name:"Охранник склада",hp:62,protection:8},
   {archetype:"npc-trail-interceptor",id:"npc-first-interceptor",name:"Вооружённый сборщик",hp:52,protection:6}
  ];
  const enemies=plan.map(spec=>{
   const npc=NpcEnemyData.spawn(spec.archetype,{instanceId:spec.id});
   if(!npc)throw Error("FIRST_PLAY_NPC_MISSING");
   const attack=Math.round(npc.physicalAttack*.7);
   return {...npc,name:spec.name,hp:spec.hp,protection:spec.protection,
    maxProtection:spec.protection,atk:attack,physicalAttack:attack};
  });
  return [art,ren,...enemies];
 }
 if(battleIsSignal){
  const plan=SignalOperationCore.battlePlan(signalProgress.active);
  if(!plan)throw Error("Unknown signal operation plan");
  return [...selectedParty(),...NpcStoryOpsAdapter.operation("OPS-002",plan).first];
 }
 if(battleIsOperation){
  const plan=OperationCore.battlePlan(operationProgress.active);
  if(!plan)throw Error("Unknown operation plan");
  return [...selectedParty(),...NpcStoryOpsAdapter.operation("OPS-001",plan).first];
 }
 if(battleIsNpcChallengePilot){
  const enemies=NpcChallengePilot.spawn(activeChallengeId);
  if(!enemies||enemies.some(e=>!NPC_CHALLENGE_VISUALS.some(v=>v.id===e.id)))
   throw Error("NPC_CHALLENGE_PILOT_TEMPLATE_MISSING");
  return [...selectedParty(),...enemies];
 }
 if(battleIsChallenge){
  const def=ChallengeCore.get(activeChallengeId);
  if(!def)throw Error("Unknown challenge");
  const later=new Set(def.futureWaves.flat());
  const first=def.enemyIds.filter(id=>!later.has(id));
  const enemies=first.map(id=>ENEMIES.find(h=>h.id===id));
  if(enemies.some(x=>!x))throw Error("Unknown challenge enemy");
  return [...selectedParty(),...enemies.map(progressedEnemy)];
 }
 // LC-004: use existing combat with generic noncanonical training enemies.
 if(battleIsLoreTraining&&NPC_PILOT_ENABLED){
  if(NPC_PILOT_VISUALS.length!==NPC_PILOT_IDS.length||
     NPC_PILOT_VISUALS.some(enemy=>!enemy))throw Error("NPC_PILOT_TEMPLATE_MISSING");
  const trainingEnemies=NPC_PILOT_VISUALS.map(enemy=>
   NpcEnemyData.spawn(enemy.archetypeId,{instanceId:enemy.id}));
  if(trainingEnemies.some(enemy=>!enemy))throw Error("NPC_PILOT_TEMPLATE_MISSING");
  return [...selectedParty(),...trainingEnemies];
 }
 if(battleIsLoreTraining)return [...selectedParty(),...ENEMIES.slice(0,2).map((e,i)=>
  progressedEnemy({...e,name:"Учебный противник "+(i+1)}))];
 // NPCPVE002: noncanonical story enemies use NPC abilities and disposable
 // instance visuals. Their scenario identities and tactical gates survive.
 if(battleIsLoreRequired){
  if(!loreRequiredContext?.nodeId)throw Error("MISSING_LORE_BATTLE_CONTEXT");
  if(!requiredLoreSquadReady())throw Error("MISSING_REQUIRED_LORE_HERO");
  const trial=ActiveLoreCampaign.encounter(loreRequiredContext.nodeId);
  if(!trial)throw Error("UNKNOWN_LORE_TRIAL");
  return [...selectedParty(),...NpcStoryOpsAdapter.story(loreRequiredContext.nodeId,trial).first];
 }
 // STORY-002 uses temporary hero IDs outside v3 save validation.
 if(battleIsStoryDemo&&storyTrialParty)
  return [...StoryTrialData.heroes(),...ENEMIES.slice(0,2).map((e,i)=>
   progressedEnemy({...e,name:i===0?"Старший охраны":"Наёмный охранник",
    debuffPotency:0,debuffResistance:StoryTrialData.statusPilot.enemyResistance[i]}))];
 // NPCMISSION002: explicit, noncanonical pilot for the second demo mission.
 // The previous five-enemy roster remains the normal production path.
 if(battleIsCampaign&&NPC_MISSION_PILOT_ENABLED&&
    typeof NpcMissionPilot!=="undefined"&&NpcMissionPilot.get(activeMissionId)){
  const enemies=NpcMissionPilot.spawn(activeMissionId);
  if(!enemies||enemies.some(enemy=>!NPC_MISSION_VISUALS.some(visual=>visual.id===enemy.id)))
   throw Error("NPC_MISSION_PILOT_TEMPLATE_MISSING");
  return [...selectedParty(),...enemies];
 }
 // Mission #2 tests five enemies; the shared enemy AI is mission-independent.
 const enemies=battleIsCampaign&&activeMissionId==="demo-mission-2"?ENEMIES:ENEMIES.slice(0,2);
 // Reuse training templates, not the noncanonical "Conclave" story identities.
 const roster=battleIsStoryDemo?enemies.map((e,i)=>({...e,name:i===0?"Старший охраны":"Наёмный охранник"})):enemies;
 return [...selectedParty(),...roster.map(progressedEnemy)];
}
// Optional future wave rosters live in mission data. Existing missions have no
// future waves, so their accepted encounters and balance remain unchanged.
function battleFutureWaves(){
 if(battleIsLoreRequired){
  const trial=ActiveLoreCampaign.encounter(loreRequiredContext?.nodeId);
  if(!trial)throw Error("UNKNOWN_LORE_TRIAL");
  return NpcStoryOpsAdapter.story(loreRequiredContext.nodeId,trial).waves;
 }
 if(battleIsSignal){
  const plan=SignalOperationCore.battlePlan(signalProgress.active);
  if(!plan)throw Error("Unknown signal battle plan");
  return NpcStoryOpsAdapter.operation("OPS-002",plan).waves;
 }
 if(battleIsOperation){
  const plan=OperationCore.battlePlan(operationProgress.active);
  if(!plan)throw Error("Unknown operation plan");
  return NpcStoryOpsAdapter.operation("OPS-001",plan).waves;
 }
 if(battleIsNpcChallengePilot){
  const waves=NpcChallengePilot.spawnWaves(activeChallengeId);
  if(!waves||waves.some(wave=>wave.some(e=>
      !NPC_CHALLENGE_VISUALS.some(v=>v.id===e.id))))
   throw Error("NPC_CHALLENGE_PILOT_WAVE_MISSING");
  return waves;
 }
 if(battleIsChallenge){
  const def=ChallengeCore.get(activeChallengeId);
  if(!def)throw Error("Unknown challenge");
  return def.futureWaves.map(wave=>wave.map(id=>{
   const enemy=ENEMIES.find(h=>h.id===id);
   if(!enemy)throw Error("Unknown challenge wave enemy");
   return progressedEnemy(enemy);
  }));
 }
 if(battleIsNpcMissionPilot){
  const waves=NpcMissionPilot.spawnWaves(activeMissionId);
  if(!waves||waves.some(wave=>wave.some(enemy=>
     !NPC_MISSION_VISUALS.some(visual=>visual.id===enemy.id))))
   throw Error("NPC_MISSION_PILOT_WAVE_MISSING");
  return waves;
 }
 const mission=battleIsCampaign&&MissionData.get(activeMissionId);
 return (mission&&mission.futureEnemyWaves||[]).map(ids=>ids.map(id=>{
  const enemy=ENEMIES.find(h=>h.id===id);
  if(!enemy)throw Error("Unknown wave enemy template: "+id);
  return progressedEnemy(enemy);
 }));
}
const SQUAD_PORTRAITS=Object.freeze({ren:"assets/ren-portrait-roster.webp",nada:"assets/nada-portrait-roster.webp",liora:"assets/liora-portrait-roster.webp",art:"assets/art-portrait-roster.webp",sava:"assets/sava-portrait-roster.webp"});
const squadPortrait=id=>SQUAD_PORTRAITS[id]||null;
// Only display fields from existing player progress; no assumed hero upgrades.
function squadHeroSummary(hero){
 const level=Number.isFinite(hero?.level)?hero.level:ProgressCore.levelOf(progress,hero.id)??1;
 const rank=typeof StarCore!=="undefined"?StarCore.rankOf(progress,hero.id):hero?.stars;
 const tier=ProgressCore.gearState(progress,hero.id)?.tier;
 return "Ур. "+level+" · ★"+(Number.isFinite(rank)?rank:"—")+
  " · "+(Number.isFinite(tier)?"G"+tier:"G—");
}
function renderSquad(){
 const loreMode=isLoreRequiredSquad();
 const mandatoryIds=loreMode?requiredLoreHeroIds():[];
 const mandatoryNames=mandatoryIds.map(id=>ALLIES.find(h=>h.id===id)?.name||id).join(", ");
 const chosen=selectedParty();
 const ids=squadSlots();
 const slots=ids.map(id=>ALLIES.find(h=>h.id===id)||null);
 $("#squadCount").textContent=chosen.length+"/"+MAX_SQUAD;
 // A selected hero belongs to the formation, not to the available roster.
 $("#squadRoster").innerHTML=ALLIES.map(progressedHero).filter(h=>h&&!ids.includes(h.id)).map(h=>{
  const owned=heroOwned(h.id);
  const required=loreMode&&mandatoryIds.includes(h.id);
  const meta=owned?squadHeroSummary(h):"";
  const portrait=squadPortrait(h.id);
  return '<button type="button" class="squad-choice '+(owned?"":"hero-locked ")+(required?"squad-choice-required":"")+
   '" data-hero-id="'+h.id+'" aria-label="'+(owned?h.name+". "+meta:"Закрытый герой")+
   '" '+(required?'aria-disabled="true" data-squad-required="true" title="Обязательный герой сюжетного боя"':"")+
   (owned?"":" disabled")+'>'+
   '<span class="squad-glyph">'+(portrait?'<img src="'+portrait+'" alt="" loading="lazy">':owned?h.glyph:"♙")+'</span>'+
   '<span class="squad-choice-detail"><b>'+(owned?h.name:"Закрытый герой")+'</b>'+
   '<small>'+(owned?meta:"Открывается: "+heroUnlockLabel(h.id))+'</small></span>'+
   '<strong aria-hidden="true">'+(owned?"+":"🔒")+'</strong></button>';
 }).join("");
 // Preserve the single Babylon canvas across DOM rebuilds; never recreate
 // its WebGL context for an added/removed squad member.
 const slotHost=$("#squadSlots");
 const slotHtml=Array.from({length:MAX_SQUAD},(_,i)=>{
  const h=slots[i];
  const p=h?progressedHero(h):null;
  const locked=loreMode&&h&&mandatoryIds.includes(h.id);
  const label=h?h.name:"Свободно";
  const portrait=h?squadPortrait(h.id):null;
  const avatar=portrait?'<img class="squad-slot-fallback" src="'+portrait+'" alt="" loading="lazy">':(h?'<span class="squad-slot-glyph" aria-hidden="true">'+h.glyph+'</span>':"");
  const meta=p?squadHeroSummary(p):"";
  return '<div class="squad-slot '+(i===0?'squad-slot-leader ':'')+
   (h?'filled ':'')+(locked?'squad-slot-required ':'')+
   '" data-squad-index="'+i+'"'+(locked?' data-squad-required="true"':'')+(h?' data-model-id="'+h.id+'" data-hero-id="'+h.id+'" role="button" tabindex="0"':'')+
   ' aria-label="'+(i===0?'Лидер отряда':'Место '+(i+1))+': '+label+
   (p?". "+meta:"")+(locked?' · обязательный герой':'')+'">'+
   '<span class="squad-slot-number">'+(i===0?'★ ЛИДЕР':i+1)+'</span>'+
   '<div class="squad-slot-fallback-wrap">'+avatar+'</div>'+
   (p?'<span class="squad-slot-progress">'+meta+'</span>':"")+
   '<span class="squad-slot-content">'+label+(locked?' 🔒':'')+'</span>'+
   '</div>';
 }).join("");
 // Remove only slot DOM. Detaching the Babylon canvas on each tap risks
 // a WebGL context loss in Safari even if we insert it back synchronously.
 if(typeof slotHost.querySelectorAll==="function"&&typeof slotHost.insertAdjacentHTML==="function"){
  slotHost.querySelectorAll(".squad-slot").forEach(node=>node.remove());
  slotHost.insertAdjacentHTML("beforeend",slotHtml);
 }else{
  // Headless unit-test DOM fixtures have only innerHTML. In real browsers the
  // branch above keeps the live Babylon canvas mounted throughout updates.
  slotHost.innerHTML=slotHtml;
 }
 const leader=ids[0];
 const leaderHero=ALLIES.find(h=>h.id===leader);
 const leaderArt=$(".squad-leader-skill-icon");
 if(leaderArt&&typeof AbilityIconCore!=="undefined")
  leaderArt.innerHTML=leaderHero?AbilityIconCore.markup(leaderHero,"leader")||"✦":"✦";
 const leaderAbility=leaderHero&&typeof AbilityInfo!=="undefined"?AbilityInfo.format(leaderHero,"leader"):null;
 const hasSkill=leaderAbility?.status==="available";
 const leaderButton=$("#squadLeaderSkillButton");
 const leaderName=$("#squadLeaderSkillName");
 const leaderTip=$("#squadLeaderTooltip");
 if(leaderButton){
  leaderButton.hidden=!hasSkill;
  leaderButton.setAttribute("aria-label",hasSkill?"Лидерская способность: "+leaderAbility.name+". Удерживай для описания":"Нет лидерской способности");
  if(leaderName)leaderName.textContent=hasSkill?leaderAbility.name:"";
 }
 if(leaderTip){
  leaderTip.hidden=true;
  leaderButton?.setAttribute("aria-expanded","false");
  const tipName=$("#squadLeaderTooltipName"),tipDesc=$("#squadLeaderTooltipDescription");
  if(tipName)tipName.textContent=hasSkill?leaderAbility.name:"";
  if(tipDesc)tipDesc.textContent=hasSkill?leaderAbility.description:"";
 }
 const leaderHint=leader
  ?(hasSkill?"★ "+leaderHero.name+" ведёт отряд. Удерживай значок способности для описания.":
    "⚠ "+leaderHero.name+": лидерская способность отсутствует — бонуса лидера нет.")
  :"Выбери героя слева: он займёт первую свободную ячейку. Пока ячейка лидера пуста, лидерского бонуса нет.";
 const hint=$("#squadHint");
 hint.textContent=(loreMode?"Обязательные герои: "+mandatoryNames+". ":"")+leaderHint;
 hint.classList.toggle("squad-hint-warning",Boolean(leader)&&!hasSkill);
 const tacticalBrief=$("#squadTacticalBrief");
 const trial=loreMode?ActiveLoreCampaign.encounter(loreRequiredContext?.nodeId):null;
 const npcBrief=squadReturnScreen==="challenges"&&NPC_CHALLENGE_PILOT_ENABLED&&
  typeof NpcChallengePilot!=="undefined"?NpcChallengePilot.get(activeChallengeId):null;
 if(tacticalBrief){
  tacticalBrief.hidden=!trial&&!npcBrief;
  if(trial){
   tacticalBrief.querySelector("strong").textContent=trial.briefTitle+" · ЗАДАЧА";
   tacticalBrief.querySelector("p").textContent=trial.brief;
  }else if(npcBrief){
   tacticalBrief.querySelector("strong").textContent=NpcChallengePilot.title(activeChallengeId)||
    ChallengeCore.get(activeChallengeId)?.title;
   tacticalBrief.querySelector("p").textContent=NpcChallengePilot.goal(activeChallengeId,
    chosen[0]?.name)||"Выполни условия испытания.";
  }
 }
 $("#squadStart").textContent=loreMode?"Начать испытание":"Начать бой";
 const intro=$("#squadIntro");
 if(intro)intro.textContent=loreMode
  ?(mandatoryIds.length===2?"«Пять теней»: Рен и Нада обязательны. Остальных героев выбираешь ты.":"«Пять теней»: обязательны "+mandatoryNames+". Свободных мест: "+(MAX_SQUAD-mandatoryIds.length)+"."):squadReturnScreen==="mainCampaign"?"Пролёт без отметки · выбери от 1 до 5 доступных героев.":"Выбери от 1 до 5 героев. Это тестовый состав для следующего боя.";
 const disband=$("#squadDisband");
 if(disband)disband.textContent=loreMode?"Убрать остальных":"Распустить";
 $("#squadStart").disabled=chosen.length===0||(loreMode&&!requiredLoreSquadReady());
 document.querySelectorAll("#squadRoster .squad-choice[data-hero-id],#squadSlots .squad-slot[data-hero-id]").forEach(node=>
  node.addEventListener("click",()=>toggleSquadHero(node.dataset.heroId)));
 document.querySelectorAll("#squadSlots .squad-slot[data-hero-id]").forEach(slot=>{
  slot.addEventListener("keydown",event=>{
   if(event.key==="Enter"||event.key===" "){event.preventDefault();toggleSquadHero(slot.dataset.heroId);}
  });
 });
}
function toggleSquadHero(id){
 if(!ALLIES.some(h=>h.id===id)||!heroOwned(id))return false;
 if(isLoreRequiredSquad()&&requiredLoreHeroIds().includes(id))return false;
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
 setSquadSlots(slots);
 resetSquadWarning();
 renderSquad();
 return true;
}
function disbandSquad(){
 const slots=squadSlots();
 const remaining=isLoreRequiredSquad()?
  slots.map(id=>requiredLoreHeroIds().includes(id)?id:null):
  Array(MAX_SQUAD).fill(null);
 if(slots.every((id,i)=>id===remaining[i]))return false;
 setSquadSlots(remaining);
 resetSquadWarning();
 renderSquad();
 return true;
}
function openSquad(returnTo="home"){
 if(["network","weekly"].includes(returnTo)){
  if(!networkSquadSlots)networkSquadSlots=[selectedLeaderId,...selectedPartyIds];
 }else networkSquadSlots=null;
 if(returnTo==="loreRequired"){
  if(!loreSquadSlots)loreSquadSlots=prepareLoreRequiredSlots([selectedLeaderId,...selectedPartyIds]);
 }else loreSquadSlots=null;
 squadReturnScreen=returnTo;
 resetSquadWarning();
 renderSquad();
 showScreen("squad");
}
function beginStoryDemo(){
 if(typeof StoryDemoCore==="undefined")return;
 storyTrialParty=false;
 storyDemoState=StoryDemoCore.fresh();
 showScreen("storyDemo");
}
function heroTagText(hero){
 if(typeof HeroProfileData==="undefined")return "Теги пока не назначены";
 const profile=HeroProfileData.get(hero?.id);
 const tags=HeroProfileData.tagLabels(Array.isArray(hero?.tags)?hero.tags:profile?.tags);
 return tags.length?"Теги: "+tags.join(" · "):"Теги пока не назначены";
}
function showHeroBiography(hero){
 if(!hero)return false;
 const dialog=$("#heroBiographyDialog");
 if(!dialog||typeof HeroProfileData==="undefined")return false;
 const data=HeroProfileData.get(hero.id);
 $("#heroBiographyTitle").textContent=data?.name||hero.name||"Герой";
 $("#heroBiographyTags").textContent=heroTagText(hero);
 $("#heroBiographyText").textContent=data?.biography||
  "Биография персонажа пока не подготовлена. Демонстрационные герои не являются утверждёнными персонажами вселенной.";
 $("#heroBiographyNote").textContent=data?.note||"История персонажа будет добавлена после согласования.";
 const sketch=$("#heroBiographyPortrait");
 if(sketch)sketch.hidden=!["trial-ren","ren","nada","liora","art","sava"].includes(hero.id);
 // Preserve Ren's established biography visibility; Nada is an independent preview.
 if(sketch&&hero.id==="liora"){
  sketch.src="assets/liora-portrait-ui.webp?v=1";
  sketch.alt="Лиора Вель — портрет";
 }else if(sketch&&hero.id==="nada"){
  sketch.src="assets/nada-portrait-ui.webp?v=2";
  sketch.alt="Нада — утверждённый живописный портрет";
  }else if(sketch&&hero.id==="art"){
  sketch.src="assets/art-portrait-ui.webp?v=2";
  sketch.alt="Арт — игровой портрет";
 }else if(sketch&&hero.id==="sava"){
  sketch.src="assets/sava-portrait-ui.webp?v=2";
  sketch.alt="Сава — игровой портрет";
 }else if(sketch&&(hero.id==="ren"||hero.id==="trial-ren")){
  sketch.src="assets/ren-portrait-ui.webp";
  sketch.alt="Рен Терен — портрет проводника Садов над пропастью";
 }
 if(typeof dialog.showModal==="function"&&!dialog.open)dialog.showModal();
 return true;
}
function renderStoryDemo(){
 if(!storyDemoState||typeof StoryDemoCore==="undefined")return;
 const view=StoryDemoCore.view(storyDemoState);
 if(!view)return;
 const renProfile=typeof StoryTrialData!=="undefined"?
  StoryTrialData.profiles.find(hero=>hero.id==="trial-ren"):null;
 if($("#storyRenTags"))$("#storyRenTags").textContent=heroTagText(renProfile);
 $("#storyDemoSpeaker").textContent=view.speaker;
 $("#storyDemoText").textContent=view.text;
 $("#storyDemoNext").hidden=view.kind!=="next";
 const choices=$("#storyDemoChoices");
 choices.hidden=view.kind!=="tone"&&view.kind!=="evidence";
 if(!choices.hidden){
  $("#storyDemoChoiceA").textContent=view.kind==="tone"?"Сначала защитить людей":"Независимая сверка копий";
  $("#storyDemoChoiceB").textContent=view.kind==="tone"?"Потребовать документ":"Срочно предупредить соседние пункты";
 }
 $("#storyDemoFight").hidden=view.kind!=="fight";
 $("#storyDemoTrialFight").hidden=view.kind!=="fight";
 $("#storyDemoAgain").hidden=view.kind!=="defeat"&&view.kind!=="ending";
}
function showScreen(id){
 const mainCampaignReturn=id==="mainCampaign";
 if(mainCampaignReturn)id="campaign";
 if(id!=="operations")firstReportOperationRequested=false;
 // Release the squad WebGL context synchronously BEFORE entering combat.
 // The MutationObserver remains a fallback for external screen changes.
 if(id!=="squad"&&typeof SquadStage3D!=="undefined")SquadStage3D.dispose();
 // A non-lore navigation can occur while the visual-novel overlay owns the
 // viewport. Dispose that transient view before switching screens, so the
 // body scroll lock never leaks into the roster or squad.
 if(id!=="campaign"&&typeof LoreCampaignUI!=="undefined"&&
    document.body?.classList?.contains("lore-scene-open"))LoreCampaignUI.close();
 if(typeof HeroCardUI!=="undefined")HeroCardUI.leave(id);
 if((id==="home"||id==="collection")&&typeof GearUX004!=="undefined")GearUX004.cancelReturn();
 // Re-entering from home opens the two-mode chooser, not a stale mission list.
 if(id==="challenges"&&$("#home")?.classList.contains("active"))selectedChallengeKind=null;
 if(id!=="home"){
  if(typeof closeHQMenu==="function")closeHQMenu();
  if(typeof cancelHQTooltip==="function")cancelHQTooltip();
 }
 if(id!=="battle"){closeFighterInspection();hideAbilityTooltip();closeBattleMenu();}
 if(id!=="battle"){cancelAutoTimer();autoBattle=false;cancelVisualTransition();BattleAnimation.clear();combatVisual007?.clear();arenaFeedback?.clear(arenaCamera);closeBattleAssetGate();stopBattleRendering();disposeArenaEnv006();}
 if(id!=="heroDetail"&&typeof RenCard3D!=="undefined")RenCard3D.dispose();
 // Combat-008A: release the document scroll while the arena owns the viewport.
 // Guard document.body for headless DOM tests and embedded integrations.
 if(document.body&&document.body.classList)document.body.classList.toggle("battle-mode",id==="battle");
 if(id!=="collection")closeRosterSortMenu();
 const rosterWasInDossier=$("#heroDetail")?.classList.contains("active");
 const previousScreenId=document.querySelector(".screen.active")?.id||null;
 document.querySelectorAll(".screen").forEach(x=>x.classList.remove("active"));
 $("#"+id).classList.add("active");
 if(id==="home")dailyNavigationOrigin=false;
 updateDailyReturn(id);
 // MOBILEQA001: a new screen opens at its top, not at the previous screen's
 // scroll offset (e.g. squad header hidden after the long campaign list).
 // The roster keeps its own return-to-position behaviour below.
 const restoresRoster=id==="collection"&&!!(rosterRestoreOnReturn&&rosterWasInDossier);
 if(previousScreenId!==id&&!restoresRoster&&typeof window!=="undefined"&&typeof window.scrollTo==="function")
  window.scrollTo(0,0);
 if(id==="collection"){
  const restore=rosterRestoreOnReturn&&rosterWasInDossier;
  renderHeroes();
  if(restore&&typeof window!=="undefined"&&typeof window.scrollTo==="function"){
   const y=rosterReturnScrollY;
   const scroll=()=>window.scrollTo(0,y);
   if(typeof requestAnimationFrame==="function")requestAnimationFrame(scroll);
   else scroll();
  }
  rosterRestoreOnReturn=false;
 }
 if(id==="playerProfile")renderPlayerProfile();
 if(id==="dailyTasks")renderDailyTasks();
 if(id==="loginCalendar"){
  if(previousScreenId!=="loginCalendar"){
   loginCalendarPage=-1;loginCalendarSelectedDay=0;
  }
  markLoginCalendarSeen();
  renderLoginCalendar();
 }
 if(id==="campaign"){if(previousScreenId!=="campaign")showCampaignPath(null);renderCampaign();if(mainCampaignReturn)showCampaignPath("main");}
 if(id==="mainCampaignResult")renderMainCampaignResult();
 if(id==="challenges")renderChallenges();
 if(id==="operations")renderOperations();
 if(id==="network"&&typeof NetworkNavigation!=="undefined"){
  // Return from a weekly/clue squad or battle to the exact parent view.
  const fromCombat=previousScreenId==="battle"||previousScreenId==="squad";
  NetworkNavigation.select(dailyNavigationOrigin?"daily":
   fromCombat?(squadReturnScreen==="weekly"?"threat":"clues"):"clues");
  dailyNavigationOrigin=false;
 }
 if(id==="network")renderDailyTasks();
 if(id==="network"&&networkPilot)NetworkPilotUI.render();
 if(id==="network"&&weeklySession)WeeklyThreatUI.refresh();
 if(id==="operationResult")renderOperationResult();
 if(id==="signalOperations")renderSignalOperations();
 if(id==="signalOperationResult")renderSignalOperationResult();
 if(id==="storyDemo")renderStoryDemo();
 if(id==="firstPlay")renderFirstPlay();else{stopFirstPlayStoryTimer();firstPlaySoundStop(true);clearFirstPlayNext();}
 if(id==="loreTrainingResult")renderLoreTrainingResult();
 if(id==="loreRequiredBattleResult")renderLoreRequiredBattleResult();
 if(id==="heroDetail")renderHeroDetail();
 if(id==="battle"){
  lastMissionReward=null;
  lastUnlockedHeroId=null;
  lastMissionFarmReward=null;
  lastMissionEnergyRefunded=false;
  missionEntryPaid=false;
  missionResultSaveFailed=false;
  battleIsCampaign=squadReturnScreen==="campaign"&&!!activeMissionId;
   battleIsMainCampaign=squadReturnScreen==="mainCampaign"&&typeof MainCampaignCore!=="undefined";
   if(battleIsMainCampaign){mainCampaignResult=null;mainCampaignNotice="";}
  battleIsFirstPlay=squadReturnScreen==="firstPlay"&&firstPlayState?.phase==="battle";
  battleIsNpcMissionPilot=battleIsCampaign&&NPC_MISSION_PILOT_ENABLED&&
   typeof NpcMissionPilot!=="undefined"&&!!NpcMissionPilot.get(activeMissionId);
  battleIsLoreTraining=squadReturnScreen==="loreTraining";
  battleIsLoreRequired=squadReturnScreen==="loreRequired"&&!!loreRequiredContext;
  battleIsStoryDemo=squadReturnScreen==="storyDemo"&&storyDemoState?.phase==="battle";
  battleIsChallenge=squadReturnScreen==="challenges"&&!!ChallengeCore.get(activeChallengeId);
  battleIsNpcChallengePilot=battleIsChallenge&&NPC_CHALLENGE_PILOT_ENABLED&&
   typeof NpcChallengePilot!=="undefined"&&!!NpcChallengePilot.get(activeChallengeId);
  battleIsOperation=squadReturnScreen==="operations"&&operationProgress.active?.phase==="battle";
  operationBattleRunId=battleIsOperation?operationProgress.active.runId:null;
  battleIsNetwork=squadReturnScreen==="network"&&
   networkPilot?.isReady()&&networkPilot.read()?.active?.phase==="battle";
  battleIsWeekly=squadReturnScreen==="weekly"&&weeklySession?.isReady()&&!!weeklySession.read()?.active;
  battleIsSignal=squadReturnScreen==="signalOperations"&&signalProgress.active?.phase==="battle";
  signalBattleRunId=battleIsSignal?signalProgress.active.runId:null;
  const label=$("#battleMissionLabel");
  if(label)label.textContent=battleIsFirstPlay?"ПЕРВОЕ ДОНЕСЕНИЕ · УДЕРЖАТЬ ПРОХОД":
   battleIsWeekly?"ГЛАВНАЯ УГРОЗА · ИСПЫТАНИЕ НЕДЕЛИ":battleIsNetwork?(NETWORK_PILOT_ENABLED?"РАЗВЕДСЕТЬ · ПРОБНЫЙ БОЙ (ВНЕ КАНОНА)":
   "РАЗВЕДСЕТЬ · ДОБЫЧА РЕСУРСОВ"):
   battleIsSignal?"РАЗВЕДОПЕРАЦИЯ · ТРЕВОЖНЫЙ СИГНАЛ":
   battleIsOperation?(storyOperation(operationProgress.active)?"ПО СЛЕДУ РАСПОРЯЖЕНИЯ":"РАЗВЕДОПЕРАЦИЯ · ДВА КУРЬЕРА"):
   battleIsLoreRequired?"ПЯТЬ ТЕНЕЙ · ОБЯЗАТЕЛЬНЫЙ БОЙ"+
    (loreRequiredContext?.battleNarrative?.title?" · "+loreRequiredContext.battleNarrative.title:"")+
    " (ИГРОВАЯ АДАПТАЦИЯ)":
    battleIsLoreTraining?(NPC_PILOT_ENABLED?"ПРОБА NPC · УЧЕБНЫЙ БОЙ (ВНЕ КАНОНА)":"ПЯТЬ ТЕНЕЙ · ТРЕНИРОВКА (ВНЕ КАНОНА)"):
    battleIsChallenge?"ИСПЫТАНИЕ · "+
     ((battleIsNpcChallengePilot?NpcChallengePilot.title(activeChallengeId):null)||
      ChallengeCore.get(activeChallengeId).title):
   battleIsStoryDemo?(storyTrialParty?"ПРОБА СЮЖЕТА · СОПРОТИВЛЕНИЕ (ТЕСТ)":"ПРОБА СЮЖЕТА · ДОРОГА, КОТОРОЙ НЕТ"):
   battleIsMainCampaign?MainCampaignCore.TITLE:battleIsCampaign?MissionData.get(activeMissionId).title:"ТЕСТОВАЯ АРЕНА";
  const trial=battleIsLoreRequired?ActiveLoreCampaign.encounter(loreRequiredContext?.nodeId):null;
  const objective=$("#battleChallengeGoal");
  if(objective){
   objective.hidden=!!trial||battleIsFirstPlay||
   !battleIsWeekly&&!battleIsNetwork&&!battleIsLoreRequired&&!battleIsLoreTraining&&!battleIsChallenge&&!battleIsOperation&&!battleIsSignal;
   const def=battleIsChallenge?ChallengeCore.get(activeChallengeId):null;
   const priority=def?.kind==="tactical"?(battleIsNpcChallengePilot?
    NpcChallengePilot.spawn(activeChallengeId)?.find(e=>e.id===
      NpcChallengePilot.get(activeChallengeId).priorityId):
    ENEMIES.find(e=>e.id===def.priorityId)):null;
   const npcGoal=battleIsNpcChallengePilot?NpcChallengePilot.goal(activeChallengeId,
    selectedParty()[0]?.name):null;
   const networkPlan=battleIsNetwork?NetworkEncounterAdapter.plan(networkPilot.read()):null;
    objective.textContent=battleIsWeekly?"Первая цель — отмеченный противник. Берегите отряд.":battleIsNetwork?(networkPlan?
     "Первая цель: «"+networkPlan.first[0].name+"». Берегите отряд.":
     "Данные зацепки недоступны — бой нельзя оценить."):
    npcGoal|| (battleIsLoreRequired&&trial?
     trial.goalText:
     battleIsLoreRequired?"Победите, чтобы открыть следующий эпизод. Бой относится к игровой адаптации.":battleIsLoreTraining?(NPC_PILOT_ENABLED?"Пробный состав: человек, сарх и лаун-лекарь. Вне канона, без наград, энергии и влияния на хронику.":"Учебные противники. Без наград, энергии и влияния на хронику."):battleIsSignal?signalProgress.active?.assault==="quiet"?
     "Тихий штурм: первым обезвредь связного. Два стража одним действием — сигнал подавлен.":
     "Окружение: две волны, сигнал подавлен после победы, но скрытность потеряна.":
    battleIsOperation?(storyOperation(operationProgress.active)?"Получить копию распоряжения.":"Перехватить подлинный пакет."):!def?"":def.kind==="tactical"?
    "Цель: "+(priority?.name||"отмеченный враг")+" должен погибнуть первым и отдельно от остальных.":
    "Цель: пройти "+(def.futureWaves.length+1)+" волны, сохранив отряд.");
   // ARENA-ART-004G: a new battle starts with the objective folded in its corner.
   objective.classList?.remove?.("expanded");
   objective.setAttribute?.("aria-expanded","false");
   objective.setAttribute?.("aria-label","Цель боя: "+objective.textContent);
  }
  const tacticalGoalCard=$("#tacticalGoalCard");
  const npcHold=battleIsNpcChallengePilot&&activeChallengeId==="T-04";
  if(tacticalGoalCard){
   tacticalGoalCard.hidden=!trial&&!npcHold&&!battleIsFirstPlay;
   // First-time players must see the objective before choosing an action.
   // Other battles keep their established collapsed default.
   tacticalGoalCard.classList?.toggle("collapsed",!battleIsFirstPlay);
   $("#tacticalGoalToggle")?.setAttribute?.("aria-expanded",String(battleIsFirstPlay));
   if(trial){
    tacticalGoalCard.querySelector("strong").textContent=trial.goalTitle;
    tacticalGoalCard.querySelector("p").textContent=trial.goalText;
   }else if(battleIsFirstPlay){
    tacticalGoalCard.querySelector("strong").textContent="ПРИКРОЙТЕ ОТХОД";
    tacticalGoalCard.querySelector("p").textContent="Сохраните Рена в строю 6 действий союзников или победите противников.";
   }else if(npcHold){
    tacticalGoalCard.querySelector("strong").textContent="ПРИКРЫТЬ ОТХОД";
    tacticalGoalCard.querySelector("p").textContent=NpcChallengePilot.goal(activeChallengeId,
     selectedParty()[0]?.name);
   }
  }
  const freeStoryEntry=battleIsCampaign&&progress.saveVersion===3&&
   !campaignProgress.completed[activeMissionId];
  if(battleIsCampaign&&!freeStoryEntry&&ProgressCore.affordableRuns(progress,activeMissionId)<1){
   showScreen("squad");
   const warning=$("#squadWarning");
   if(warning){warning.textContent="Недостаточно энергии для входа в миссию.";warning.hidden=false;}
   return;
  }
  let entryPaid=false;
  try {
   if(typeof BABYLON==="undefined" || !BABYLON.Engine || !BABYLON.Scene)
    throw new Error("Babylon.js is unavailable");
   if(!engine)initBabylon();
   ensureArenaEnv006();
   resetArenaCamera(); // Start every encounter from the approved perspective.
   engine.resize();
   if(battleIsCampaign&&!battleIsNpcMissionPilot&&!freeStoryEntry){
    if(!ProgressCore.spendEnergy(progress,activeMissionId))throw new Error("Недостаточно энергии");
    entryPaid=true;
    if(!persistProgress())throw new Error("Не удалось сохранить расход энергии");
   }
   missionEntryPaid=entryPaid;
   resetBattle();
   updateMeshes();
   startBattleRendering();
   openBattleAssetGate();
   const notice=$("#battleLoadError");
   if(notice)notice.hidden=true;
  } catch(error) {
   if(battleIsFirstPlay){
    firstPlayFinish(false);
    showScreen("firstPlay");
    firstPlayNotice("Не удалось запустить бой: "+String(error?.message||error).slice(0,120)+".");
    return;
   }
   if(entryPaid){ProgressCore.refundEnergy(progress,activeMissionId);persistProgress();}
   missionEntryPaid=false;
   cancelAutoTimer();autoBattle=false;
   console.error("Не удалось запустить 3D-арену:",error);
   closeBattleAssetGate();
   stopBattleRendering();
   if(renGlbRuntime){renGlbRuntime.dispose();renGlbRuntime=null;}
   if(nadaGlbRuntime){nadaGlbRuntime.dispose();nadaGlbRuntime=null;}
   if(lioraGlbRuntime){lioraGlbRuntime.dispose();lioraGlbRuntime=null;}
   if(savaGlbRuntime){savaGlbRuntime.dispose();savaGlbRuntime=null;}
   if(artGlbRuntime){artGlbRuntime.dispose();artGlbRuntime=null;}
   disposeNpcGlbRuntimes();
   disposeArenaEnv006();
   if(scene){try{scene.dispose();}catch(cleanupError){console.error(cleanupError);}}
   if(engine){try{engine.dispose();}catch(cleanupError){console.error(cleanupError);}}
   scene=undefined;engine=undefined;arenaCamera=null;meshes={};encounterNpcVisualIds.clear();indicatorNodes={};combatVisual007=null;arenaFeedback=null;renderLoopRunning=false;
   if(battleIsStoryDemo&&storyTrialParty){
    StoryDemoCore.cancelBattle(storyDemoState);
    showScreen("storyDemo");
    const storyNotice=$("#storyDemoNotice");
    if(storyNotice)storyNotice.textContent="Не удалось загрузить 3D-арену. Проверь соединение и повтори попытку.";
   }else{
    showScreen("squad");
    const notice=$("#battleLoadError");
    if(notice){
     const raw=typeof error?.message==="string"?error.message:String(error);
     const reason=raw.trim().slice(0,180)||"неизвестная ошибка";
     const detail=notice.querySelector("p");
     if(detail)detail.textContent="Причина: "+reason+". Повторите попытку; если ошибка сохранится, сообщите этот текст.";
     notice.hidden=false;
    }
   }
  }
 }
 if(id==="home"){
  renderDailyClaimBadge();
  maybeOpenLoginOnEntry();
  renderHeadquarters();
 }
}
// HQ-UI-007: activate a short, object-attached lighting cue BEFORE navigation.
// Taps on painted hotspots animate; other navigation stays immediate.
let hqFxTimer=null;
let hqFxTarget=null;
function resetHQSelectionFx(){
 if(hqFxTimer!==null)clearTimeout(hqFxTimer);
 hqFxTimer=null;
 if(hqFxTarget)hqFxTarget.classList.remove("is-activating");
 hqFxTarget=null;
 const scene=document.querySelector?.(".hq-scene");
 if(scene)delete scene.dataset.hqIlluminated;
}
function animateHQSelectionFx(button){
 if(hqFxTimer!==null)return; // ignore double taps during the transition
 const zone=["heroes","campaign","operations","challenges"].find(name=>button.classList.contains("hq-station-"+name));
 const scene=document.querySelector("#home .hq-scene");
 if(!zone||!scene){showScreen(button.dataset.screen);return;}
 const reduced=typeof window.matchMedia==="function"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
 if(reduced){showScreen(button.dataset.screen);return;}
 hqFxTarget=button;
 scene.dataset.hqIlluminated=zone;
 button.classList.add("is-activating");
 hqFxTimer=setTimeout(()=>{
  const target=button.dataset.screen;
  resetHQSelectionFx();
  // Another navigation may have taken place during the animation.
  if(document.querySelector("#home")?.classList.contains("active"))showScreen(target);
 },500);
}
document.querySelectorAll("[data-screen]").forEach(b=>b.addEventListener("click",()=>{
 if(b.matches?.("#home .hq-station")){animateHQSelectionFx(b);return;}
 resetHQSelectionFx();
 if(b.dataset.screen==="home"&&battleIsMainCampaign&&$("#battle")?.classList.contains("active")){showScreen("mainCampaign");return;}
 if(b.dataset.screen==="home"&&battleIsLoreRequired&&$("#battle")?.classList.contains("active")){
  LoreCampaignUI.cancelRequiredBattle();returnToLoreMap();return;
 }
 if(b.dataset.screen==="home"&&battleIsFirstPlay&&$("#battle")?.classList.contains("active")){
  firstPlayFinish(false);showScreen("firstPlay");return;
 }
 if(b.dataset.screen==="home"&&battleIsLoreTraining&&$("#battle")?.classList.contains("active"))returnToLoreMap();
 else if(b.dataset.screen==="battle")openSquad("home");
 else showScreen(b.dataset.screen);
}));
$("#startBattle").addEventListener("click",()=>openSquad("home"));

// FIRSTPLAY001: debug restart in the existing bottom-right More menu.
const devRestartDialog=$("#devRestartDialog");
$("#devStartOver")?.addEventListener("click",()=>{
 closeHQMenu();
 const status=$("#devRestartStatus");if(status){status.hidden=true;status.textContent="";}
 devRestartDialog?.showModal?.();
});
$("#devRestartCancel")?.addEventListener("click",()=>devRestartDialog?.close?.());
$("#devRestartConfirm")?.addEventListener("click",()=>{
 const status=$("#devRestartStatus");
 if(typeof ProgressWriterCore!=="undefined"&&!ProgressWriterCore.canPersist()){
  if(status){status.hidden=false;status.textContent="Сохранение сейчас недоступно или выполняется запись. Закройте другие вкладки и повторите.";}
  return;
 }
 const cleared=FirstPlayCore.resetGameStorage(()=>window.localStorage);
 if(!cleared.ok){
  if(status){status.hidden=false;status.textContent="Не удалось очистить локальные игровые данные. Перезапуск отменён.";}
  return;
 }
 ProgressWriterCore?.release?.();
 window.location.reload();
});
// HQ-UI-001: More menu and cancellable long-press tooltips.
const hqMore=$("#hqMoreMenu"),hqMoreToggle=$("#hqMoreToggle"),hqTooltip=$("#hqTooltip"),hqHome=$("#home");
function closeHQMenu(){if(hqMore)hqMore.hidden=true;if(hqMoreToggle)hqMoreToggle.setAttribute("aria-expanded","false");}
hqMoreToggle?.addEventListener?.("click",()=>{
 if(!hqMore)return;
 hqMore.hidden=!hqMore.hidden;
 hqMoreToggle.setAttribute("aria-expanded",String(!hqMore.hidden));
});
document.addEventListener("click",event=>{
 if(!event.target.closest?.("#hqMoreMenu, #hqMoreToggle"))closeHQMenu();
});
document.addEventListener("keydown",event=>{if(event.key==="Escape")closeHQMenu();});
let hqPress=null,hqPressTimer=null;
function cancelHQTooltip(){
 if(hqPressTimer!==null)clearTimeout(hqPressTimer);
 hqPressTimer=null;hqPress=null;if(hqTooltip)hqTooltip.hidden=true;
}
hqHome?.addEventListener?.("pointerdown",event=>{
 const button=event.target.closest?.("[data-hq-hint]");
 if(!button||event.pointerType==="mouse")return;
 cancelHQTooltip();
 hqPress={id:event.pointerId,x:event.clientX,y:event.clientY};
 hqPressTimer=setTimeout(()=>{
  if(!hqPress||!hqTooltip)return;
  hqTooltip.textContent=button.dataset.hqHint;hqTooltip.hidden=false;hqPressTimer=null;
 },520);
});
hqHome?.addEventListener?.("pointermove",event=>{
 if(hqPress&&hqPress.id===event.pointerId&&Math.hypot(event.clientX-hqPress.x,event.clientY-hqPress.y)>12)cancelHQTooltip();
});
for(const type of ["pointerup","pointercancel","pointerleave"])hqHome?.addEventListener?.(type,cancelHQTooltip);

$("#storyDemoOpen")?.addEventListener("click",beginStoryDemo);
$("#storyDemoBack")?.addEventListener("click",()=>showScreen("campaign"));
$("#storyDemoNext")?.addEventListener("click",()=>{
 if(StoryDemoCore.next(storyDemoState))renderStoryDemo();
});
function storyDemoChoose(option){
 if(!storyDemoState)return;
 const kind=StoryDemoCore.view(storyDemoState)?.kind;
 const changed=kind==="tone"?StoryDemoCore.chooseTone(storyDemoState,option==="a"?"people":"order"):
  kind==="evidence"?StoryDemoCore.chooseEvidence(storyDemoState,option==="a"?"verify":"warn"):false;
 if(changed)renderStoryDemo();
}
$("#storyDemoChoiceA")?.addEventListener("click",()=>storyDemoChoose("a"));
$("#storyDemoChoiceB")?.addEventListener("click",()=>storyDemoChoose("b"));
$("#storyDemoFight")?.addEventListener("click",()=>{
 if(storyDemoState&&StoryDemoCore.startBattle(storyDemoState)){
  storyTrialParty=false;
  openSquad("storyDemo");
 }
});
$("#storyDemoTrialFight")?.addEventListener("click",()=>{
 if(storyDemoState&&typeof StoryTrialData!=="undefined"&&StoryDemoCore.startBattle(storyDemoState)){
  storyTrialParty=true;
  squadReturnScreen="storyDemo";
  showScreen("battle");
 }
});
$("#storyDemoAgain")?.addEventListener("click",beginStoryDemo);
$("#storyRenBiography")?.addEventListener("click",()=>{
 const ren=typeof StoryTrialData!=="undefined"?StoryTrialData.profiles.find(hero=>hero.id==="trial-ren"):null;
 showHeroBiography(ren);
});
$("#detailBiography")?.addEventListener("click",()=>showHeroBiography(ALLIES.find(h=>h.id===selectedHeroId)));
$("#heroBiographyClose")?.addEventListener("click",()=>{
 const dialog=$("#heroBiographyDialog");
 if(dialog&&typeof dialog.close==="function")dialog.close();
});
// OPS-001B: small landscape-first operation screen. All rules are decided by OperationCore.
const OPS_ORDER_LABELS=Object.freeze({
 register:"Сверить реестр",block:"Перекрыть развилку",
 extract:"Подготовить отход",observe:"Проследить курьеров"
});
const OPS_MARK=Object.freeze({diamond:"◈",circle:"○"});
function commitOperation(next){
 const candidate=next&&OperationCore.stage(operationProgress,next);
 if(!candidate){
  operationNotice="Невозможно изменить операцию: этап или идентификатор не совпадает.";
  return false;
 }
 if(operationSaveBlocked||!operationSaveAvailable||
    !OperationCore.save(candidate,()=>window.localStorage,operationSaveBlocked)){
  operationNotice="Не удалось сохранить операцию. Изменение не применено; проверь доступность хранилища Safari.";
  return false;
 }
 operationProgress=candidate;
 operationNotice="";
 return true;
}
function operationResultText(entry){
 if(!entry)return "Пока нет завершённых операций.";
 if(storyOperation(entry)){
  if(entry.outcome==="defeat")return "Отряд отступил. Копия распоряжения не получена. Можно повторить перехват.";
  if(entry.outcome==="wrongTarget")return "В пакете нет нужного распоряжения. Проверьте отметки в реестре и выберите другой маршрут.";
  if(entry.outcome==="abandoned")return "Перехват прерван. Документ не получен.";
  if(entry.outcome==="success")return "Копия распоряжения получена. На ней есть отметка приёма, но нет имени отправителя."+
   (entry.ledgerSecured?" В журнале найден маршрут передачи.":" Маршрут передачи пока неизвестен.")+
   " Источник распоряжения предстоит установить.";
 }
 if(entry.outcome==="defeat")return "Отряд потерпел поражение. Подлинный пакет не захвачен.";
 if(entry.outcome==="wrongTarget")return "Охрана побеждена, но перехвачена пустышка. Главная цель не выполнена.";
 if(entry.outcome==="abandoned")return "Отряд отступил. Операция завершена без выполнения задачи.";
 const achieved=[];
 if(entry.coverPreserved)achieved.push("скрыты следы");
 if(entry.ledgerSecured)achieved.push("получен маршрутный журнал");
 return "Подлинник захвачен. Дополнительные результаты: "+
  (achieved.length?achieved.join(", "):"нет")+".";
}
function renderOperationResult(){
 const history=operationProgress.history;
 const last=history[history.length-1]||null;
 const title=$("#operationResultTitle"),desc=$("#operationResultText"),meta=$("#operationResultStatus");
 if(title)title.textContent=last?.outcome==="success"?"Операция выполнена":
  last?.outcome==="wrongTarget"?"Ошибка перехвата":
  last?.outcome==="defeat"?"Отряд разбит":
  last?.outcome==="abandoned"?"Операция прервана":"Итоги операции";
 if(desc)desc.textContent=operationResultText(last);
 const story=storyOperation(last),success=story&&last.outcome==="success";
 const tag=$("#operationResultTag"),again=$("#operationResultAgain"),back=$("#operationResultBack"),next=$("#operationResultNetwork");
 if(tag)tag.textContent=story?"ПЕРВОЕ ДОНЕСЕНИЕ · ПЕРЕХВАТ":"OPS-001 · УЧЕБНАЯ ОПЕРАЦИЯ";
 if(meta)meta.textContent=(story?(success?"Разведсеть позволяет собирать материалы и осколки для развития героев.":"Проверьте подготовку отряда и сведения о маршрутах."):
  "OPS-001 · Учебный сценарий, без энергии, наград и изменения кампании.")+
  (operationSaveBlocked?" Прогресс недоступен.":"");
 if(again){again.hidden=success;again.textContent=story?"Повторить перехват":"Новая операция";}
 if(back){back.hidden=success;back.textContent=story?"К заданию":"К операциям";}
 if(next)next.hidden=!success;
}
function renderOperations(){
 const back=$("#opsFirstSessionHome");if(back)back.hidden=!firstSessionFollowUp();
 const run=operationProgress.active;
 const story=storyOperation(run)||(!run&&firstReportOperationRequested&&firstSessionFollowUp()==="available");
 const heading=$("#opsHeading"),eyebrow=$("#opsEyebrow"),tag=$("#opsScenarioTag"),guide=$("#opsGuide"),signal=$("#opsSignalEntry"),mapHelp=$("#opsMapHelp");
 if(heading)heading.textContent=story?"По следу распоряжения":"Учебные разведоперации";
 if(eyebrow)eyebrow.textContent=story?"ПЕРВОЕ ДОНЕСЕНИЕ":"УЧЕБНЫЕ ОПЕРАЦИИ";
 if(tag)tag.textContent=story?"ПЕРЕХВАТ КОПИИ":"OPS-001 · ДВА КУРЬЕРА";
 if(guide)guide.hidden=story;
 if(signal)signal.hidden=story;
 if(mapHelp)mapHelp.textContent=story?"Сопоставьте отметку реестра со знаком курьера.":"◈ и ○ — учебные знаки. До разведки знак может быть неизвестен.";
 const status=$("#opsSaveStatus"),phase=$("#opsPhase"),report=$("#opsReport");
 const actions=$("#opsActions"),warning=$("#opsNotice"),history=$("#opsHistory");
 if(!status||!phase||!report||!actions||!warning||!history)return;
 status.textContent=operationSaveBlocked?"Сохранение операций повреждено — начало новой операции заблокировано.":
  !operationSaveAvailable?"Хранилище недоступно — новая операция недоступна.":
  "Контрольные точки операции сохраняются в этом браузере. Если закрыть Safari во время боя, его можно начать заново.";
 warning.textContent=operationNotice;
 const last=operationProgress.history[operationProgress.history.length-1]||null;
 history.textContent=last?"Последняя операция: "+operationResultText(last):"Завершённых операций пока нет.";
 const north=$("#opsNorth"),south=$("#opsSouth"),junction=$("#opsJunction");
 const northMark=$("#opsNorthMark"),southMark=$("#opsSouthMark"),auth=$("#opsAuthentic");
 const intel=run?OperationCore.intel(run):null;
 northMark.textContent=intel?.courierMarks?OPS_MARK[intel.courierMarks.north]:"?";
 southMark.textContent=intel?.courierMarks?OPS_MARK[intel.courierMarks.south]:"?";
 auth.textContent=intel?.authenticMark?OPS_MARK[intel.authenticMark]:"?";
 for(const button of [north,south,junction]){
  if(button)button.disabled=!run||run.phase!=="target"||
   (button===junction?!intel.blocked:intel.blocked);
 }
 north.classList.toggle("confirmed",!!run&&
  OperationCore.targetAssessment(run,"north")==="confirmed");
 south.classList.toggle("confirmed",!!run&&
  OperationCore.targetAssessment(run,"south")==="confirmed");
 const button=(attr,value,label,kind="ghost")=>
  '<button type="button" class="'+kind+'" '+attr+'="'+value+'">'+label+'</button>';
 const quit=button("data-ops-abandon","yes","Прервать операцию");
 if(!run){
  phase.textContent=story?"БРИФИНГ · КОПИЯ РАСПОРЯЖЕНИЯ":"БРИФИНГ · ДВА КУРЬЕРА";
  report.textContent=story?
   "Мастер указал, где сверяют распоряжения. По реестру две посылки уже отправлены, но лишь одна содержит нужную копию. Курьеры отказались вернуть документ. Сопоставьте отметки и перехватите нужного.":
   "Курьеры несут подлинный пакет и пустышку. Отдай два приказа, выбери точку перехвата и выиграй пошаговый бой. Это неканоническая учебная операция.";
  const disabled=operationSaveBlocked||!operationSaveAvailable;
  actions.innerHTML=button("data-ops-new","yes","Начать операцию","primary").replace(
   "<button",'<button'+(disabled?" disabled":""));
  return;
 }
 const orderNames=run.orders.map(x=>OPS_ORDER_LABELS[x]);
 const common="Приказы: "+(orderNames.length?orderNames.join(" → "):"ещё не отданы")+". ";
 if(run.phase==="order1"||run.phase==="order2"){
  const first=run.phase==="order1";
  phase.textContent=first?"ПРИКАЗ 1 ИЗ 2 · КУРЬЕРЫ ВМЕСТЕ":
   intel.blocked?"ПРИКАЗ 2 ИЗ 2 · РАЗВИЛКА ПЕРЕКРЫТА":"ПРИКАЗ 2 ИЗ 2 · КУРЬЕРЫ РАЗДЕЛЯЮТСЯ";
  report.textContent=common+(first?
   "Перекрыть развилку можно только сейчас. Блокада гарантирует обе посылки, но вызовет две волны охраны.":
   "Оставшийся приказ: собери улику или подготовь безопасный отход.");
  actions.innerHTML=OperationCore.availableOrders(run).map(x=>
   button("data-ops-order",x,OPS_ORDER_LABELS[x],x==="block"?"primary":"ghost")).join("")+quit;
 }else if(run.phase==="target"){
  phase.textContent="ПЕРЕХВАТ · ВЫБЕРИ МАРШРУТ НА КАРТЕ";
  report.textContent=common+(intel.blocked?
   "Развилка перекрыта. Нажми на центральную точку: обе посылки будут захвачены при победе. Охрана выйдет в две волны.":
   intel.authenticMark&&intel.courierMarks?
   "Сопоставь знак подлинника со знаком курьера и нажми на нужный маршрут. Обычный бой: одна волна.":
   "Не все сведения получены. Выбор маршрута будет рискованным: победа над охраной может принести пустышку.");
  actions.innerHTML=quit;
 }else if(run.phase==="battle"){
  phase.textContent="БОЕВОЙ ЭТАП · ПОДГОТОВКА ОТРЯДА";
  const plan=OperationCore.battlePlan(run);
  report.textContent=common+"Перехват: "+(run.target==="junction"?"развилка":run.target==="north"?"север":"юг")+
   ". "+(plan.kind==="twoWaves"?"Две последовательные волны.":"Одна волна.")+
   " Выбери героев. После прерывания в Safari бой начнётся с первого хода.";
  actions.innerHTML=button("data-ops-fight","yes","Выбрать отряд и начать бой","primary")+quit;
 }else if(run.phase==="final"){
  phase.textContent="ПОСЛЕ БОЯ · ЗАКЛЮЧИТЕЛЬНОЕ РЕШЕНИЕ";
  report.textContent=common+(story?"Копия распоряжения захвачена. Выберите действие до прибытия подкрепления. ":"Подлинник захвачен. Выбери действия до прибытия подкрепления. ")+
   (intel.extractionPrepared?"Подготовленный отход позволяет выполнить обе дополнительные цели.":
   "Без подготовки отхода можно выполнить только одну дополнительную цель.");
  const labels={cover:"Скрыть следы",ledger:"Забрать маршрутный журнал",
   leave:"Немедленно уйти",both:"Скрыть следы и забрать журнал"};
  actions.innerHTML=OperationCore.finalChoices(run).map(x=>
   button("data-ops-finish",x,labels[x],x==="both"?"primary":"ghost")).join("");
 }
}
function newOperation(){
 if(operationProgress.active||operationSaveBlocked||!operationSaveAvailable)return false;
 const last=operationProgress.history[operationProgress.history.length-1];
 const variant=last?.variantId==="A"?"B":"A";
 const runId="ops-"+Date.now().toString(36)+"-"+(++operationRunCounter);
 if(firstReportOperationRequested&&firstSessionFollowUp()!=="available")return false;
 const scenario=firstReportOperationRequested?OperationCore.STORY_ID:OperationCore.ID;
 const run=OperationCore.start(variant,runId,scenario);
 const saved=commitOperation(run);
 if(saved)renderOperations();
 return saved;
}
function changeOperation(run){
 if(!commitOperation(run)){renderOperations();return false;}
 if(run.phase==="done"){showScreen("operationResult");return true;}
 renderOperations();
 return true;
}
$("#operations")?.addEventListener("click",event=>{
 const node=event.target.closest?.("[data-ops-new],[data-ops-order],[data-ops-target],[data-ops-fight],[data-ops-finish],[data-ops-abandon]");
 if(!node||node.disabled||!$("#operations").contains(node))return;
 const run=operationProgress.active;
 if(node.dataset.opsNew){newOperation();return;}
 if(!run)return;
 if(node.dataset.opsOrder){changeOperation(OperationCore.order(run,node.dataset.opsOrder));return;}
 if(node.dataset.opsTarget){
  const rating=OperationCore.targetAssessment(run,node.dataset.opsTarget);
  if(!rating)return;
  if(changeOperation(OperationCore.intercept(run,node.dataset.opsTarget)))
   openSquad("operations");
  return;
 }
 if(node.dataset.opsFight){
  if(run.phase==="battle")openSquad("operations");
  return;
 }
 if(node.dataset.opsFinish){changeOperation(OperationCore.finish(run,node.dataset.opsFinish));return;}
 if(node.dataset.opsAbandon)changeOperation(OperationCore.abandon(run));
});
$("#operationResultBack")?.addEventListener("click",()=>{
 firstReportOperationRequested=storyOperation(operationProgress.history.at(-1));showScreen("operations");
});
$("#operationResultAgain")?.addEventListener("click",()=>{
 if(operationProgress.active)return showScreen("operations");
 firstReportOperationRequested=storyOperation(operationProgress.history.at(-1));
 if(newOperation())showScreen("operations");
});
$("#operationResultHome")?.addEventListener("click",()=>showScreen("home"));
$("#operationResultNetwork")?.addEventListener("click",()=>showScreen("network"));

// OPS-002B: separate UI and save; the accepted OPS-001 courier flow is untouched.
const SIGNAL_PREPARATION_LABELS=Object.freeze({
 survey:"Проследить караул",extraction:"Подготовить отход с документами"
});
const SIGNAL_ASSAULT_LABELS=Object.freeze({
 quiet:"Тихое проникновение · 1 волна",cordon:"Окружить пост · 2 волны"
});
function commitSignalOperation(next){
 const candidate=next&&SignalOperationCore.stage(signalProgress,next);
 if(!candidate){
  signalNotice="Нельзя изменить операцию: неверный этап или устаревшее действие.";
  return false;
 }
 if(signalSaveBlocked||!signalSaveAvailable||
  !SignalOperationCore.save(candidate,()=>window.localStorage,signalSaveBlocked)){
  signalNotice="Сохранение не удалось. Изменение не применено, проверь данные Safari.";
  return false;
 }
 signalProgress=candidate;
 signalNotice="";
 return true;
}
function signalOutcomeText(entry){
 if(!entry)return "Завершённых операций пока нет.";
 if(entry.outcome==="defeat")return "Отряд потерпел поражение. Пост не взят.";
 if(entry.outcome==="abandoned")return "Операция прервана до окончания боя.";
 const extra=entry.coverPreserved&&entry.ledgerSecured?" Следы скрыты, журнал взят.":
  entry.coverPreserved?" Следы скрыты.":
  entry.ledgerSecured?" Журнал взят.":" Дополнительных целей нет.";
 if(entry.outcome==="clean")return "Пост взят незаметно, тревога не поднята."+extra;
 if(entry.outcome==="alerted")return "Пост взят, но связной успел поднять тревогу."+extra;
 return "Пост взят силой, сигнал подавлен. Присутствие отряда раскрыто."+extra;
}
function renderSignalOperationResult(){
 const entry=signalProgress.history[signalProgress.history.length-1]||null;
 const titles={clean:"Тихая победа",alerted:"Предупреждение отправлено",
  loud:"Открытый штурм",defeat:"Операция провалена",abandoned:"Отступление"};
 const heading=$("#sigResultTitle"),desc=$("#sigResultText"),status=$("#sigResultStatus");
 if(heading)heading.textContent=entry?titles[entry.outcome]:"Итоги сигнального поста";
 if(desc)desc.textContent=signalOutcomeText(entry);
 if(status)status.textContent="OPS-002 · Учебная операция. Награды, энергия и кампания не изменяются. "+
  (signalSaveBlocked?"Сохранение недоступно.":"Итог сохранён в этом браузере.");
}
function renderSignalOperations(){
 const status=$("#sigSaveStatus"),phase=$("#sigPhase"),info=$("#sigReport");
 const actions=$("#sigActions"),notice=$("#sigNotice"),history=$("#sigHistory");
 const post=$("#sigPostStatus"),guardA=$("#sigGuardA"),guardB=$("#sigGuardB");
 if(!status||!phase||!info||!actions||!notice||!history||!post||!guardA||!guardB)return;
 const run=signalProgress.active;
 const intel=run?SignalOperationCore.intel(run):null;
 const last=signalProgress.history[signalProgress.history.length-1]||null;
 status.textContent=signalSaveBlocked?"Запись операции повреждена — запуск блокирован, чтобы не потерять данные.":
  !signalSaveAvailable?"Локальное хранилище недоступно — запуск блокирован.":
  "План хранится отдельно. При закрытии Safari во время боя он начнётся заново, без восстановления ходов и HP.";
 notice.textContent=signalNotice;
 history.textContent=last?"Последний итог: "+signalOutcomeText(last):"Завершённых операций ещё нет.";
 if($("#sigGuardAName"))$("#sigGuardAName").textContent=(typeof NpcStoryOpsAdapter!=="undefined"?NpcStoryOpsAdapter.signalGuardName("ves"):null)||ENEMIES.find(e=>e.id==="ves")?.name||"Страж 1";
 if($("#sigGuardBName"))$("#sigGuardBName").textContent=(typeof NpcStoryOpsAdapter!=="undefined"?NpcStoryOpsAdapter.signalGuardName("shade"):null)||ENEMIES.find(e=>e.id==="shade")?.name||"Страж 2";
 guardA.textContent=intel?.signalId==="ves"?"Связной установлен":
  intel?.signalId==="shade"?"Постовой":"Роль не установлена";
 guardB.textContent=intel?.signalId==="shade"?"Связной установлен":
  intel?.signalId==="ves"?"Постовой":"Роль не установлена";
 const button=(action,value,label,style="ghost")=>'<button type="button" class="'+style+
  '" data-sig-'+action+'="'+value+'">'+label+'</button>';
 const quit=button("quit","yes","Отказаться от операции");
 if(!run){
  phase.textContent="БРИФИНГ · СИГНАЛЬНЫЙ ПОСТ";
  info.textContent="На посту два стража. Только один успеет подать сигнал, если его товарища обезвредят первым. Разведка покажет связного, либо можно подготовить отход. Учебный неканонический сценарий.";
  post.textContent="Тревога не поднята · задача не начата";
  actions.innerHTML=button("new","yes","Начать операцию","primary").replace(
   "<button",'<button'+(signalSaveBlocked||!signalSaveAvailable?" disabled":""));
  return;
 }
 if(run.phase==="prep"){
  phase.textContent="ШАГ 1 ИЗ 2 · ПОДГОТОВКА";
  info.textContent="Проследить караул — узнать имя связного. Подготовить отход — сохранить возможность скрыть следы и взять журнал одновременно после победы, но не узнать связного.";
  post.textContent="Сигнал ещё можно предотвратить";
  actions.innerHTML=button("prep","survey",SIGNAL_PREPARATION_LABELS.survey,"primary")+
   button("prep","extraction",SIGNAL_PREPARATION_LABELS.extraction)+quit;
 }else if(run.phase==="assault"){
  phase.textContent="ШАГ 2 ИЗ 2 · СПОСОБ ШТУРМА";
  info.textContent=(intel.signalId?
   "Разведка: связной — "+(ENEMIES.find(e=>e.id===intel.signalId)?.name||"установленный страж")+". ":
   "Связной неизвестен. ")+
   "При тихом штурме нужно вывести связного из боя в первом действии с потерями врагов. Окружение остановит сигнал при победе, но раскрывает присутствие и требует двух волн.";
  post.textContent="Решение ещё не принято";
  actions.innerHTML=button("assault","quiet",SIGNAL_ASSAULT_LABELS.quiet,"primary")+
   button("assault","cordon",SIGNAL_ASSAULT_LABELS.cordon)+quit;
 }else if(run.phase==="battle"){
  phase.textContent="БОЕВОЙ ЭТАП · ПОДГОТОВКА ОТРЯДА";
  const plan=SignalOperationCore.battlePlan(run);
  info.textContent="Подготовка: "+SIGNAL_PREPARATION_LABELS[run.preparation]+
   ". Штурм: "+SIGNAL_ASSAULT_LABELS[run.assault]+". "+
   (run.assault==="quiet"?
    (intel.signalId?"Связной установлен: "+(ENEMIES.find(e=>e.id===intel.signalId)?.name||intel.signalId)+". ":
     "Связной неизвестен. ")+
    "Он должен погибнуть при первой потере противников. Одновременная гибель двух стражей предотвращает сигнал.":
    "После победы сигнал будет подавлен, но скрытность потеряна.")+
   " После выхода из Safari бой можно повторить с первого хода.";
  post.textContent=plan.kind==="twoWaves"?"План: 2 волны":"План: 1 волна";
  actions.innerHTML=button("fight","yes","Выбрать отряд и начать бой","primary")+quit;
 }else if(run.phase==="final"){
  phase.textContent="ПОСЛЕ БОЯ · ПОСЛЕДНЕЕ РЕШЕНИЕ";
  const labels={cover:"Скрыть следы",ledger:"Забрать журнал",
   leave:"Немедленно уйти",both:"Скрыть следы и забрать журнал"};
  post.textContent=run.outcome==="clean"?"Тревога подавлена · скрытность сохранена":
   run.outcome==="alerted"?"Сигнал отправлен · пост захвачен":
   "Сигнал подавлен · операция раскрыта";
  info.textContent="Столкновение завершено. "+
   (intel.extractionPrepared?"Подготовка отхода позволяет забрать журнал и скрыть следы.":
    "Можно выполнить только одну дополнительную цель.")+
   " Это локальные итоги, не игровые награды.";
  actions.innerHTML=SignalOperationCore.finalChoices(run).map(value=>
   button("finish",value,labels[value],value==="both"?"primary":"ghost")).join("");
 }
}
function createSignalOperation(){
 if(signalProgress.active||signalSaveBlocked||!signalSaveAvailable)return false;
 let random;
 try{
  const words=new Uint32Array(2);
  if(window.crypto?.getRandomValues)window.crypto.getRandomValues(words);
  else{words[0]=Math.floor(Math.random()*4294967296);words[1]=Math.floor(Math.random()*4294967296);}
  random=words;
 }catch(_){random=new Uint32Array([Math.floor(Math.random()*4294967296),Math.floor(Math.random()*4294967296)]);}
 const signalId=random[0]%2===0?"ves":"shade";
 const runId="sig-"+Date.now().toString(36)+"-"+random[1].toString(36)+"-"+(++signalRunCounter);
 const run=SignalOperationCore.start(signalId,runId);
 if(!commitSignalOperation(run)){renderSignalOperations();return false;}
 renderSignalOperations();
 return true;
}
function changeSignalOperation(next){
 if(!commitSignalOperation(next)){renderSignalOperations();return false;}
 if(next.phase==="done")showScreen("signalOperationResult");
 else renderSignalOperations();
 return true;
}
$("#signalOperations")?.addEventListener("click",event=>{
 const node=event.target.closest?.("[data-sig-new],[data-sig-prep],[data-sig-assault],[data-sig-fight],[data-sig-finish],[data-sig-quit]");
 if(!node||node.disabled||!$("#signalOperations").contains(node))return;
 const run=signalProgress.active;
 if(node.dataset.sigNew){createSignalOperation();return;}
 if(!run)return;
 if(node.dataset.sigPrep){changeSignalOperation(SignalOperationCore.prepare(run,node.dataset.sigPrep));return;}
 if(node.dataset.sigAssault){changeSignalOperation(SignalOperationCore.chooseAssault(run,node.dataset.sigAssault));return;}
 if(node.dataset.sigFight){if(run.phase==="battle")openSquad("signalOperations");return;}
 if(node.dataset.sigFinish){changeSignalOperation(SignalOperationCore.finish(run,node.dataset.sigFinish));return;}
 if(node.dataset.sigQuit)changeSignalOperation(SignalOperationCore.abandon(run));
});
$("#sigResultAgain")?.addEventListener("click",()=>{
 if(signalProgress.active){showScreen("signalOperations");return;}
 if(createSignalOperation())showScreen("signalOperations");
});
$("#sigResultBack")?.addEventListener("click",()=>showScreen("signalOperations"));
$("#sigResultHome")?.addEventListener("click",()=>showScreen("home"));

function renderChallenges(){
 const container=$("#challengeList"),modeNav=$("#challengeModes"),modeBack=$("#challengeModeBack");
 if(!container)return;
 const kind=selectedChallengeKind;
 if(modeNav)modeNav.hidden=!!kind;
 if(modeBack)modeBack.hidden=!kind;
 container.hidden=!kind;
 const header=$("#challengeModeTitle");
 if(header)header.textContent=kind==="tactical"?"Тактические задачи":kind==="onslaught"?"Натиск":"Выбери режим";
 if(kind){
  container.innerHTML=ChallengeCore.byKind(kind).map(def=>{
   const stars=challengeProgress.bestStars[def.id]||0;
   const unlocked=ChallengeCore.available(def.id,challengeProgress);
   const pilot=NPC_CHALLENGE_PILOT_ENABLED&&typeof NpcChallengePilot!=="undefined"?
    NpcChallengePilot.get(def.id):null;
   const priority=def.kind==="tactical"?(pilot?
    NpcChallengePilot.spawn(def.id)?.find(e=>e.id===pilot.priorityId):
    ENEMIES.find(e=>e.id===def.priorityId)):null;
   const waves=1+(pilot?pilot.futureWaves.length:def.futureWaves.length);
   const details=(pilot&&NpcChallengePilot.criteria(def.id))||(def.kind==="tactical"?
    ["1★ — победить","2★ — уничтожить "+(priority?.name||"отмеченного врага")+" первым и отдельно от остальных",
     "3★ — дополнительно сохранить всех союзников"]:
    ["1★ — пройти "+waves+" волны","2★ — победить без потерь",
     "3★ — лимит действий пока не установлен"]);
   return '<article class="campaign-panel campaign-mission"><div class="node">✦</div><div>'+
    '<h3>'+def.id+' · '+((pilot?NpcChallengePilot.title(def.id):null)||def.title)+'</h3>'+
    '<p>'+(def.kind==="tactical"?"Тактическая задача · "+def.enemyIds.length+" противника":
     "Натиск · "+waves+" волны")+'</p>'+
    '<p class="mission-stars">'+"Лучшая оценка: "+
     ("★".repeat(stars)+"☆".repeat(3-stars))+'</p>'+
    '<ul class="mission-criteria">'+details.map(x=>'<li>'+x+'</li>').join("")+'</ul>'+
    '<div class="campaign-mission-actions"><button class="primary" type="button" data-start-challenge="'+def.id+
    '" '+(unlocked?"":"disabled")+'> '+(unlocked?"Вступить в бой":"Открой предыдущую миссию на 1★")+'</button></div>'+
    '</div></article>';
  }).join("");
 }else container.innerHTML="";
 $("#challengeSaveStatus").textContent=challengeSaveBlocked?
  "Прогресс испытаний недоступен: бои доступны, сохранение заблокировано.":
  challengeSaveAvailable?"Лучшая оценка сохраняется в этом браузере.":
  "Хранилище браузера недоступно: результаты не сохраняются.";
}
function openChallenge(id){
 const def=ChallengeCore.get(id);
 if(!def||!ChallengeCore.available(id,challengeProgress))return false;
 activeChallengeId=id;
 selectedChallengeKind=def.kind;
 activeMissionId=null;
 openSquad("challenges");
 return true;
}
$("#challengeModes")?.addEventListener("click",event=>{
 const button=event.target.closest?.("[data-challenge-kind]");
 if(!button||!$("#challengeModes").contains(button))return;
 const kind=button.dataset.challengeKind;
 if(!["tactical","onslaught"].includes(kind))return;
 selectedChallengeKind=kind;
 renderChallenges();
});
$("#challengeModeBack")?.addEventListener("click",()=>{
 selectedChallengeKind=null;renderChallenges();
});
$("#challengeList")?.addEventListener("click",event=>{
 const button=event.target.closest?.("[data-start-challenge]");
 if(button&&$("#challengeList").contains(button))openChallenge(button.dataset.startChallenge);
});
function renderChallengeResult(){
 const won=state.winner==="ally";
 $("#challengeResultTitle").textContent=won?"Испытание пройдено":"Испытание не пройдено";
 $("#challengeResultName").textContent=
  (battleIsNpcChallengePilot?NpcChallengePilot.title(activeChallengeId):null)||
  ChallengeCore.get(activeChallengeId)?.title||"Испытание";
 const stars=challengeLastStars;
 $("#challengeResultStars").textContent="Оценка: "+"★".repeat(stars)+"☆".repeat(3-stars)+
  " · Лучший результат: "+(challengeProgress.bestStars[activeChallengeId]||0)+"/3";
 $("#challengeResultText").textContent=challengeSaveFailed?
  "Прогресс не сохранён: хранилище браузера недоступно или повреждено. Старые данные сохранены.":
  won?"Победа. Испытание не расходует энергию и не выдаёт отдельную награду.":
  "Поражение. Можно повторить испытание без ограничений.";
 if(battleIsNpcChallengePilot&&!challengeSaveFailed){
  const explanation=NpcChallengePilot.resultText(activeChallengeId,state,challengeTracker);
  if(explanation)$("#challengeResultText").textContent=explanation;
 }
 $("#challengeResultRetry").textContent=won?"Повторить испытание":"Попробовать снова";
}
$("#challengeResultBack")?.addEventListener("click",()=>showScreen("challenges"));
$("#challengeResultRetry")?.addEventListener("click",()=>openChallenge(activeChallengeId));
$("#challengeResultHome")?.addEventListener("click",()=>showScreen("home"));
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
$("#squadBack").addEventListener("click",()=>{
 if(squadReturnScreen==="loreRequired"){
  LoreCampaignUI.cancelRequiredBattle();returnToLoreMap();return;
 }
 if(squadReturnScreen==="loreTraining"){returnToLoreMap();return;}
 if(squadReturnScreen==="storyDemo"&&storyDemoState&&typeof StoryDemoCore!=="undefined")
  StoryDemoCore.cancelBattle(storyDemoState);
 if(squadReturnScreen==="campaign"&&typeof GearUX004!=="undefined"&&GearUX004.hasReturnContext()){
  GearUX004.returnToHero();return;
 }
 showScreen(squadReturnScreen==="weekly"?"network":squadReturnScreen);
});
$("#squadDisband")?.addEventListener("click",disbandSquad);
// Long-press on touch, click/Enter on keyboard/desktop. No new game state.
const squadLeaderButton=$("#squadLeaderSkillButton"),squadLeaderTooltip=$("#squadLeaderTooltip");
if(squadLeaderButton&&squadLeaderTooltip){
 let holdTimer=null,openedByHold=false;
 const cancelHold=()=>{if(holdTimer!==null){clearTimeout(holdTimer);holdTimer=null;}};
 const hide=()=>{squadLeaderTooltip.hidden=true;squadLeaderButton.setAttribute("aria-expanded","false");};
 const show=()=>{if(squadLeaderButton.hidden)return;squadLeaderTooltip.hidden=false;
  squadLeaderButton.setAttribute("aria-expanded","true");};
 squadLeaderButton.addEventListener("pointerdown",event=>{
  if(event.pointerType!=="touch"&&event.pointerType!=="pen")return;
  openedByHold=false;cancelHold();
  holdTimer=setTimeout(()=>{holdTimer=null;openedByHold=true;show();},500);
 });
 for(const type of ["pointerup","pointercancel","pointerleave"])
  squadLeaderButton.addEventListener(type,cancelHold);
 squadLeaderButton.addEventListener("contextmenu",event=>{
  event.preventDefault();cancelHold();openedByHold=true;show();
 });
 squadLeaderButton.addEventListener("click",event=>{
  event.stopPropagation();cancelHold();
  if(openedByHold){openedByHold=false;return;}
  if(squadLeaderTooltip.hidden)show();else hide();
 });
 document.addEventListener("pointerdown",event=>{
  if(!squadLeaderButton.contains(event.target)&&!squadLeaderTooltip.contains(event.target))hide();
 });
 document.addEventListener("keydown",event=>{if(event.key==="Escape")hide();});
}
// If Babylon.js cannot load, show a recoverable message instead of an uncaught crash.
const retryLoad=$("#retryBattleLoad");
if(retryLoad)retryLoad.addEventListener("click",()=>window.location.reload());
$("#squadStart").addEventListener("click",()=>{
 if(squadReturnScreen==="mainCampaign"&&(!$("#squad")?.classList.contains("active")||!mainCampaignWritable()))return;
 const count=selectedParty().length;
 if(isLoreRequiredSquad()&&!requiredLoreSquadReady()){
  const warning=$("#squadWarning");
  if(warning){
   warning.textContent="Для этого боя «Пяти теней» обязательны: "+requiredLoreHeroIds().map(id=>ALLIES.find(h=>h.id===id)?.name||id).join(", ")+".";
   warning.hidden=false;
  }
  return;
 }
 if(count===0)return;
 if(squadReturnScreen==="weekly"&&(!weeklySession?.isReady()||!weeklySession.read()?.active)){
   const warning=$("#squadWarning");if(warning){warning.textContent="Недельная контрольная точка недоступна.";warning.hidden=false;}return;
  }
  if(squadReturnScreen==="network"&&(!networkPilot?.isReady()||
  networkPilot.read()?.active?.phase!=="battle")){
  const warning=$("#squadWarning");
  if(warning){warning.textContent="Нет подтверждённой контрольной точки разведсети. Вернитесь к донесениям.";
   warning.hidden=false;}
  return;
 }
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
// Stars-001: a locked hero may inspect shards but not combat/gear dossier.
let lockedStarHeroId=null;
function starGlyphs(rank){
 const safe=Number.isInteger(rank)?Math.max(0,Math.min(7,rank)):0;
 return '<span class="star-filled">'+"★".repeat(safe)+'</span>'+
  '<span class="star-empty">'+"☆".repeat(7-safe)+'</span>';
}
function renderStarPanel(id){
 if(typeof StarCore==="undefined"||progress.saveVersion!==3)return;
 const rank=StarCore.rankOf(progress,id),cost=StarCore.costOf(progress,id);
 const amount=StarCore.shardsOf(progress,id);
 if(rank===null)return;
 $("#detailStarStrip").innerHTML=starGlyphs(rank);
 $("#starRankVisual").innerHTML=starGlyphs(rank);
 $("#starRankLabel").textContent=rank+" / 7★";
 $("#starShardCount").textContent=cost===null?"7★ · максимум":amount+" / "+cost;
 $("#starShardProgress").max=cost??1;
 $("#starShardProgress").value=cost===null?1:Math.min(cost,amount);
 $("#starNextLabel").textContent=cost===null?
  "Полный звёздный ранг достигнут.":
  "Следующий ранг: "+(rank+1)+"★ · требуется "+Math.max(0,cost-amount)+" осколков.";
 $("#starPromoteButton").disabled=saveBlocked||cost===null||amount<cost;
 $("#starPromoteButton").textContent=cost===null?"Достигнут максимум 7★":"Повысить до "+(rank+1)+"★";
 $("#starNotice").textContent=saveBlocked?"Сохранение недоступно. Развитие заблокировано.":
  "Каждая звезда после 1★ даёт +3% к базовым HP, атаке и защите (до +18% на 7★); скорость не меняется. "+
  (["ren","nada","liora","art","sava"].includes(id)?
   "Осколки добываются через приказ на героя в разведсети.":
   "Для демонстрационного героя пока нет обычного источника осколков.")+
  (rank===7?" Лишние осколки обмениваются по курсу 80 кромов за штуку.":"");
}
function showLockedHero(id){
 if(typeof StarCore==="undefined"||heroOwned(id)||!ALLIES.some(h=>h.id===id))return false;
 lockedStarHeroId=id;
 const cost=StarCore.costOf(progress,id),amount=StarCore.shardsOf(progress,id);
 if(cost===null||amount===null)return false;
 $("#lockedHeroTitle").textContent="Неизвестный герой";
 $("#lockedHeroSource").textContent="Прямое получение: "+heroUnlockLabel(id)+
  ". Альтернатива — открыть за "+cost+" осколков. Боевые возможности закрыты до получения.";
 $("#lockedHeroStars").innerHTML=starGlyphs(0);
 $("#lockedHeroShards").textContent=amount+" / "+cost;
 $("#lockedHeroProgress").max=cost;
 $("#lockedHeroProgress").value=Math.min(cost,amount);
 $("#lockedHeroUnlock").disabled=saveBlocked||amount<cost;
 $("#lockedHeroUnlock").textContent="Открыть за "+cost+" осколков";
 $("#lockedHeroNotice").textContent=saveBlocked?"Сохранение недоступно.":
  "Тестовые осколки доступны через кнопку ресурсов в меню.";
 const dialog=$("#lockedHeroDialog");
 if(!dialog.open)dialog.showModal();
 return true;
}
function promoteStar(id,locked){
 if(saveBlocked||typeof StarCore==="undefined")return false;
 const base=ALLIES.find(hero=>hero.id===id);
 const oldRank=StarCore.rankOf(progress,id);
 const oldStats=oldRank>=1&&base?progressedHero(base):null;
 const before=JSON.stringify(progress);
 const upgraded=StarCore.promote(progress,id);
 if(!upgraded)return false;
 if(!persistProgress()){
  Object.keys(progress).forEach(key=>delete progress[key]);
  Object.assign(progress,JSON.parse(before));
  renderAccountHeader();renderHeroes();
  if(locked){
   showLockedHero(id);
   $("#lockedHeroNotice").textContent="Не удалось сохранить. Осколки восстановлены.";
  }else{
   renderHeroDetail();
   $("#starNotice").textContent="Не удалось сохранить. Осколки и ранг восстановлены.";
  }
  return false;
 }
 renderHeroes();renderSquad();
 if(locked){
  $("#lockedHeroDialog").close();lockedStarHeroId=null;
  openHeroDetail(id);
 }else{
  renderHeroDetail();
  $("#starNotice").textContent="Герой достиг "+upgraded.rank+"★. Списано "+upgraded.spent+" осколков."+
   (upgraded.excessCurrency?" Компенсация: +"+upgraded.excessCurrency+" кромов.":"")+" Сохранено.";
 }
 // Victory is presentation only: the rank/shard mutation has already been saved.
 if(typeof GearPromotionUI!=="undefined"&&base)
  GearPromotionUI.showStar({heroName:base.name,from:oldRank,to:upgraded.rank,
   spent:upgraded.spent,excessCurrency:upgraded.excessCurrency,
   before:oldStats,after:progressedHero(base)});
 return true;
}
$("#starPromoteButton")?.addEventListener("click",()=>promoteStar(selectedHeroId,false));
$("#lockedHeroUnlock")?.addEventListener("click",()=>{
 if(lockedStarHeroId)promoteStar(lockedStarHeroId,true);
});
$("#lockedHeroClose")?.addEventListener("click",()=>$("#lockedHeroDialog").close());
$("#lockedHeroDialog")?.addEventListener("close",()=>{lockedStarHeroId=null;});
// ROSTER-UI-002: view state only. Squad saves and hero progression are unchanged.
let rosterFilter="all",rosterSort="level",rosterReturnScrollY=0,rosterRestoreOnReturn=false;
function rosterOrder(entries,filter,sort){
 return entries.filter(e=>filter==="owned"?e.owned:filter==="locked"?!e.owned:true).sort((a,b)=>{
  if(a.owned!==b.owned)return a.owned?-1:1;
  if(!a.owned)return a.index-b.index; // Never leak concealed hero identity via ordering.
  if(sort==="name")return a.hero.name.localeCompare(b.hero.name,"ru")||a.index-b.index;
  const score=e=>sort==="stars"?e.rank??0:sort==="gear"?e.tier??0:e.hero.level??0;
  return score(b)-score(a)||a.index-b.index;
 });
}
function renderHeroes(){
 const ownedCount=ALLIES.filter(h=>heroOwned(h.id)).length;
 const count=$("#rosterCount");if(count)count.textContent="Получено "+ownedCount+" из "+ALLIES.length;
 const entries=ALLIES.map(progressedHero).map((h,index)=>{
  const owned=heroOwned(h.id);
  const rank=typeof StarCore!=="undefined"?StarCore.rankOf(progress,h.id):null;
  const gear=owned&&typeof ProgressCore!=="undefined"?ProgressCore.gearState(progress,h.id):null;
  return {hero:h,index,owned,rank,tier:gear?.tier??null};
 });
 const visible=rosterOrder(entries,rosterFilter,rosterSort);
 const shown=$("#rosterShown");if(shown)shown.textContent="Показано: "+visible.length;
 const sortTrigger=$("#rosterSortTrigger");
 if(sortTrigger){
  const names={level:"По уровню",stars:"По звёздам",gear:"По экипировке",name:"По имени"};
  sortTrigger.firstChild.textContent=names[rosterSort]+" ";
 }
 document.querySelectorAll("[data-roster-sort]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.rosterSort===rosterSort)));
 document.querySelectorAll("[data-roster-filter]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.rosterFilter===rosterFilter)));
 $("#heroList").innerHTML=visible.map(({hero:h,owned,rank,tier})=>{
  const cost=typeof StarCore!=="undefined"?StarCore.costOf(progress,h.id):null;
  const amount=typeof StarCore!=="undefined"?StarCore.shardsOf(progress,h.id):null;
  const safeAmount=Math.max(0,Number(amount)||0),safeCost=Math.max(1,Number(cost)||10);
  const progressPercent=Math.min(100,Math.round(safeAmount/safeCost*100));
  const portraitAvatar=owned&&h.id==="ren"?'<img class="ren-collection-portrait" src="assets/ren-portrait-roster.webp?v=1" width="384" height="192" loading="lazy" decoding="async" alt="">':
   owned&&h.id==="nada"?'<img class="nada-collection-portrait" src="assets/nada-portrait-roster.webp?v=1" width="384" height="192" loading="lazy" decoding="async" alt="">':
   owned&&h.id==="liora"?'<img class="liora-collection-portrait" src="assets/liora-portrait-roster.webp?v=1" width="384" height="192" loading="lazy" decoding="async" alt="">':
    owned&&h.id==="art"?'<img class="art-collection-portrait" src="assets/art-portrait-roster.webp?v=2" width="384" height="192" loading="lazy" decoding="async" alt="">':
    owned&&h.id==="sava"?'<img class="sava-collection-portrait" src="assets/sava-portrait-roster.webp?v=2" width="384" height="192" loading="lazy" decoding="async" alt="">':owned?h.glyph:"🔒";
  const starInfo=owned&&rank!==null?'<span class="hero-star-summary" aria-label="Ранг '+rank+' из 7">'+starGlyphs(rank)+'</span>':"";
  const name=owned?h.name:"Неизвестный герой";
  const levelLine=owned?"Ур. "+h.level+" · "+h.role:"Условия получения";
  const progressLine=!owned?'<div class="roster-shard-track" aria-hidden="true"><span style="width:'+progressPercent+'%"></span></div><span class="roster-shard-value">Осколки '+safeAmount+' / '+safeCost+'</span>':"";
  const gearLabel=owned&&Number.isFinite(tier)?"G"+tier:"";
  // Identity tags come from the existing profile registry; no invented factions for demo heroes.
  const profile=owned&&typeof HeroProfileData!=="undefined"?HeroProfileData.get(h.id):null;
  const labels=profile?HeroProfileData.tagLabels(profile.tags):[];
  const safeTag=text=>String(text).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
  const tags=labels.length?'<span class="roster-identity-tags">'+labels.map(label=>'<span class="roster-identity-tag">'+safeTag(label)+'</span>').join("")+'</span>':"";
  const isLeader=owned&&selectedLeaderId===h.id;
  const leaderBadge=isLeader?'<span class="roster-leader-indicator">★ Лидер</span>':"";
  const abilityStrip=owned&&typeof AbilityIconCore!=="undefined"?
   '<span class="roster-ability-icons" aria-hidden="true">'+
   ["basic","special","powerful"].map(slot=>AbilityIconCore.markup(h.id,slot,"roster-ability-icon")).join("")+
   '</span>':"";
  return `<button type="button" class="hero-card hero-open roster-card ${owned?"":"hero-locked"}" data-open-hero="${h.id}" aria-label="${name}${isLeader?". Лидер отряда":""}. ${owned?"Открыть досье":"Условия получения"}${labels.length?". "+labels.join(", "):""}"><span class="roster-card-art hero-avatar ${owned&&h.id==="ren"?"hero-avatar-ren":owned&&h.id==="nada"?"hero-avatar-nada":owned&&h.id==="liora"?"hero-avatar-liora":owned&&h.id==="art"?"hero-avatar-art":owned&&h.id==="sava"?"hero-avatar-sava":""}">${portraitAvatar}${abilityStrip}${leaderBadge}</span><span class="roster-card-name">${name}</span>${tags}${starInfo}<span class="roster-card-subtitle">${levelLine}</span>${owned?'<span class="roster-card-gear">'+gearLabel+'</span>':progressLine}<span class="hero-open-hint">${owned?"Открыть досье ›":"Как получить ›"}</span></button>`;
 }).join("");
 if(!visible.length)$("#heroList").innerHTML='<p class="roster-empty">В этой категории героев пока нет.</p>';
 document.querySelectorAll("[data-open-hero]").forEach(node=>node.addEventListener("click",()=>{
  const id=node.dataset.openHero;if(heroOwned(id))openHeroDetail(id);else showLockedHero(id);
 }));
}
document.querySelectorAll("[data-roster-filter]").forEach(button=>button.addEventListener("click",()=>{
 if(!["all","owned","locked"].includes(button.dataset.rosterFilter))return;
 rosterFilter=button.dataset.rosterFilter;renderHeroes();
}));
function closeRosterSortMenu(){
 const menu=$("#rosterSortMenu"),trigger=$("#rosterSortTrigger");
 if(!menu||!trigger)return;
 menu.hidden=true;trigger.setAttribute("aria-expanded","false");
}
$("#rosterSortTrigger")?.addEventListener("click",()=>{
 const menu=$("#rosterSortMenu"),trigger=$("#rosterSortTrigger");
 if(!menu||!trigger)return;
 const open=menu.hidden;
 menu.hidden=!open;trigger.setAttribute("aria-expanded",String(open));
});
document.querySelectorAll("[data-roster-sort]").forEach(button=>button.addEventListener("click",()=>{
 const next=button.dataset.rosterSort;
 if(!["level","stars","gear","name"].includes(next))return;
 rosterSort=next;closeRosterSortMenu();renderHeroes();
 $("#rosterSortTrigger")?.focus?.();
}));
document.addEventListener("click",event=>{
 const picker=$("#collection")?.querySelector?.(".roster-sort-picker");
 if(picker&&event.target&&!picker.contains(event.target))closeRosterSortMenu();
});
document.addEventListener("keydown",event=>{
 if(event.key==="Escape"&&!$("#rosterSortMenu")?.hidden){
  closeRosterSortMenu();$("#rosterSortTrigger")?.focus?.();
 }
});
function openHeroDetail(id,preferredGearSlot=null){
 if(!ALLIES.some(h=>h.id===id)||!heroOwned(id))return false;
 if($("#collection")?.classList.contains("active")){
  rosterReturnScrollY=window.scrollY||document.documentElement?.scrollTop||0;
  rosterRestoreOnReturn=true;
 }
 selectedHeroId=id;
 const current=ProgressCore.gearState(progress,id);
 selectedGearSlot=current?Math.max(0,current.slots.findIndex(installed=>!installed)):0;
 if(typeof GearUX004!=="undefined"){
  if(Number.isInteger(preferredGearSlot)&&preferredGearSlot>=0&&preferredGearSlot<ProgressCore.SLOT_COUNT){
   selectedGearSlot=preferredGearSlot;GearUX004.restore();
  }else GearUX004.reset();
 }
 showScreen("heroDetail");
 return true;
}
// MOBILEQA001: the 48px card slot cannot fit "Снаряжение" on one 8px line;
// a soft hyphen lets it wrap as "Снаря-/жение" without changing the label data.
function gearSlotCaption(label){return label==="Снаряжение"?"Снаря&shy;жение":label;}
function renderItemizedGear(base,gear){
 const completed=gear.slots.filter(Boolean).length;
 const ready=completed===ProgressCore.SLOT_COUNT;
 const slot=GearData.SLOTS[selectedGearSlot]||GearData.SLOTS[0];
 const offered=ProgressCore.itemOffer(progress,base.id,slot.id),item=offered[0]||null;
 const installed=gear.slots[selectedGearSlot];
 const promotion=ready?ProgressCore.gearPromotionCost(progress,base.id):null;
 $("#gearTier").textContent="G"+gear.tier+" · "+completed+"/6"+
  (ready&&gear.tier===GearData.MAX_TIER?" · максимум":"");
 const batchButton=$("#gearEquipAll"),batchPlan=GearEquipAllCore.preview(progress,base.id);
 if(batchButton){
  // GEARPROMOCTA001: after the sixth item, reuse the primary action space.
  // Promotion stays a separate click and uses the existing save-safe handler.
  batchButton.hidden=false;
  batchButton.classList.toggle("gear-equip-promote",ready&&!!promotion);
  batchButton.classList.toggle("gear-equip-complete",ready&&!promotion);
  if(ready){
   batchButton.disabled=saveBlocked||!promotion||!ProgressCore.canPromoteGear(progress,base.id);
   batchButton.textContent=promotion?"Повысить до G"+promotion.to+" · "+promotion.currency:
    "G"+gear.tier+" · максимум";
   const reason=saveBlocked?"Сохранение недоступно":
    !promotion?"Достигнут максимальный уровень экипировки":
    ProgressCore.gearPromotionBlockReason(progress,base.id);
   const description=promotion?"Повысить экипировку до G"+promotion.to+
    " за "+promotion.currency+" кромов"+(reason?". "+reason:""):
    "Достигнут максимальный уровень экипировки G"+gear.tier;
   batchButton.setAttribute("aria-label",description);
   batchButton.title=description;
  }else{
   batchButton.disabled=saveBlocked||!batchPlan||!batchPlan.count;
   batchButton.textContent=batchPlan?.all?"Надеть всё":
    batchPlan?.count?"Надеть доступное · "+batchPlan.count:"Надеть всё";
   batchButton.setAttribute("aria-label",batchPlan?.count?
    "Изготовить и надеть "+batchPlan.count+" предметов из "+batchPlan.empty+" свободных слотов":
    "Недостаточно ресурсов для изготовления снаряжения");
   batchButton.title=batchButton.getAttribute("aria-label");
  }
 }

 const slotPlans=GearData.SLOTS.map(entry=>
  GearPlanningCore.plan(progress,base.id,entry.id,campaignProgress));
 $("#gearSlots").innerHTML=GearData.SLOTS.map((entry,i)=>{
  const filled=gear.slots[i],selected=i===selectedGearSlot;
  const status=filled?"installed":slotPlans[i]?.status||"unknown";
  const state={ready:"можно изготовить и надеть",missing:"нужны ресурсы, открыть поиск",
   installed:"предмет надет",unknown:"состояние пока неизвестно"}[status];
  return '<button type="button" class="gear-slot gear-slot--'+status+' '+(filled?'filled ':'')+
   (selected?'selected':'')+'" data-gear-slot="'+i+'" data-gear-state="'+status+
   '" aria-pressed="'+selected+'" aria-label="'+entry.label+' · '+state+
   '" title="'+entry.label+' · '+state+'">'+
   '<span aria-hidden="true">'+(filled?'◆':'◇')+'</span><small>'+gearSlotCaption(entry.label)+'</small></button>';
 }).join("");
 const label=$("#gearMaterialLabel");if(label)label.textContent="Компоненты G"+gear.tier;
 $("#gearMaterial").innerHTML=GearMaterialUI.group(progress.materials,{stock:true});
 $("#gearWallet").textContent=String(progress.currency);
 $("#gearPriceLabel").textContent=ready?"Стоимость перехода":"Выбранный предмет";
 $("#gearStatBonusLabel").textContent=ready?"Бонус повышения":"Бонус предмета";
 const chosen=installed?GearData.get(installed):item;
 $("#gearPrice").textContent=ready?(promotion?"G"+promotion.from+" → G"+promotion.to:"G"+GearData.MAX_TIER+" · максимум"):
  chosen?chosen.name:"—";
 if(ready&&promotion)ResourceArtUI.appendCurrency($("#gearPrice"),promotion.currency,{compact:true,mode:"cost",stock:progress.currency,asCost:true});
 if(!ready&&chosen)ResourceArtUI.appendCurrency($("#gearPrice"),chosen.currency,{compact:true,mode:"cost",stock:progress.currency,asCost:true});
 if(!ready&&chosen)GearMaterialUI.append($("#gearPrice"),chosen.ingredients,{inventory:progress.materials});
 $("#gearStatBonus").textContent=ready?(promotion?"HP и ATK +3%":"—"):
  chosen?[
   chosen.bonuses.hp?"HP +"+Math.round(chosen.bonuses.hp*100)+"%":"",
   chosen.bonuses.atk?"ATK +"+Math.round(chosen.bonuses.atk*100)+"%":"",
   ...Object.entries(chosen.statBonuses||{}).map(([id,n])=>
    (GearData.STAT_LABELS[id]||id)+" +"+n)
  ].filter(Boolean).join(" · "):"—";
 const button=$("#gearEquipNext");
 button.disabled=saveBlocked||(ready?!promotion||!ProgressCore.canPromoteGear(progress,base.id):
  !!installed||!item||!ProgressCore.canEquipItem(progress,base.id,item.id));
 button.textContent=ready?(promotion?"Повысить экипировку до G"+promotion.to:"G"+GearData.MAX_TIER+" завершён"):
  installed?"Предмет установлен":"Изготовить и установить";
 $("#gearNotice").textContent=saveBlocked
  ?"Обнаружена проблема сохранения: покупки заблокированы."
  :ready?(promotion?(ProgressCore.gearPromotionBlockReason(progress,base.id)||
   "Все шесть предметов G"+gear.tier+" установлены. Можно повысить до G"+promotion.to+" за "+promotion.currency+" кромов."):
   "G"+GearData.MAX_TIER+" завершён. Максимальная ступень достигнута.")
  :installed?"Установлено: "+chosen.name+"."
  :item?(ProgressCore.itemBlockReason(progress,base.id,item.id)||
   "Предмет доступен для изготовления. Бонусы будут действовать в бою.")
  :"Для класса нет доступного предмета.";
}
function renderHeroAbilities(hero){
 const list=$("#heroAbilityList");
 if(!list||typeof AbilityInfo==="undefined")return;
 list.replaceChildren();
 for(const info of AbilityInfo.forHero(hero)){
  const card=document.createElement("article");
  card.className="hero-ability-card"+(info.status!=="available"?" unavailable":"");
  card.dataset.heroAbility=info.id;card.tabIndex=0;card.setAttribute("role","button");
  card.setAttribute("aria-label",info.name+" · "+info.label+" · Открыть подробности");
  const heading=document.createElement("div");
  heading.className="hero-ability-heading";
  const label=document.createElement("span");label.className="hero-ability-kind";label.textContent=info.label+(typeof SkillCore!=="undefined"&&SkillCore.UPGRADABLE_IDS.includes(info.id)&&SkillCore.level(progress,hero.id,info.id)!==null?" · ур. "+SkillCore.level(progress,hero.id,info.id):"");
  const name=document.createElement("strong");name.textContent=info.name;
  const icon=typeof AbilityIconCore!=="undefined"?AbilityIconCore.element(hero,info.id,"hero-ability-thumb"):null;
  const title=document.createElement("span");title.className="hero-ability-title-text";
  title.append(label,name);
  if(icon)heading.append(icon);
  heading.append(title);
  const details=document.createElement("details");details.className="hero-ability-more";
  const summary=document.createElement("summary");summary.textContent="Описание";
  const description=document.createElement("p");description.textContent=info.description;
  details.append(summary,description);
  if(info.meta.length){
   const meta=document.createElement("small");meta.className="hero-ability-meta";
   meta.textContent=info.meta.join(" · ");details.append(meta);
  }
  card.append(heading,details);
  if(info.status==="available"&&typeof SkillCore!=="undefined"&&
   SkillCore.UPGRADABLE_IDS.includes(info.id)&&SkillCore.level(progress,hero.id,info.id)!==null){
   const button=document.createElement("button");button.type="button";
   button.className="ghost skill-open-button";
   button.dataset.skillOpen=info.id;
   button.textContent="Ур. "+SkillCore.level(progress,hero.id,info.id)+"/6 · Развить";
   card.append(button);
  }
  list.append(card);
 }
}
// Skills-001: skill levels are per-hero, persist with the same v3 wallet.
let openedSkillId=null,skillPreviewLevel=1;
function openSkillUpgrade(id){
 if(!SkillCore.UPGRADABLE_IDS.includes(id)||SkillCore.level(progress,selectedHeroId,id)===null||
   !ALLIES.some(h=>h.id===selectedHeroId))return;
 openedSkillId=id;
 skillPreviewLevel=Math.min(SkillCore.MAX,(SkillCore.level(progress,selectedHeroId,id)||1)+1);
 renderSkillUpgrade();
 const dialog=$("#skillUpgradeDialog");
 if(dialog&&!dialog.open)dialog.showModal();
}
function renderSkillUpgrade(){
 const dialog=$("#skillUpgradeDialog");
 if(!dialog||!openedSkillId)return;
 const hero=progressedHero(ALLIES.find(h=>h.id===selectedHeroId));
 const current=SkillCore.level(progress,selectedHeroId,openedSkillId);
 const ability=AbilityData.get(hero,openedSkillId);
 const formatAt=level=>{
  const actor={...hero,skillLevels:{...hero.skillLevels,[openedSkillId]:level}};
  return AbilityInfo.format(actor,openedSkillId);
 };
 const selected=Math.max(1,Math.min(SkillCore.MAX,skillPreviewLevel));
 const info=formatAt(selected);
 $("#skillUpgradeTitle").textContent=ability?.name||"Умение";
 $("#skillUpgradeSubhead").textContent="Уровень "+current+" / "+SkillCore.MAX+
  " · "+(AbilityInfo.SLOTS.find(s=>s.id===openedSkillId)?.label||"");
 $("#skillPreviewLabel").textContent="ОПИСАНИЕ НА УРОВНЕ "+selected;
 $("#skillPreviewText").textContent=info.description;
 $("#skillPreviewMeta").textContent=info.meta.join(" · ");
 const next=current<SkillCore.MAX?formatAt(current+1):null;
 $("#skillNextEffect").textContent=next?
  "Следующий уровень "+(current+1)+": "+next.description:"Умение изучено полностью.";
 const buttons=$("#skillLevelButtons");buttons.replaceChildren();
 for(let level=1;level<=SkillCore.MAX;level++){
  const b=document.createElement("button");b.type="button";
  b.className="skill-level-choice"+(selected===level?" selected":"")+
   (level<=current?" learned":"");
  b.dataset.skillPreview=String(level);b.textContent=String(level);
  b.setAttribute("aria-pressed",String(selected===level));
  b.setAttribute("aria-label","Уровень "+level+(level<=current?" изучен":" доступен для просмотра"));
  buttons.append(b);
 }
 const list=$("#skillLevelDetails");list.replaceChildren();
 for(let level=1;level<=SkillCore.MAX;level++){
  const row=document.createElement("div");row.className="skill-level-row"+
   (selected===level?" selected":"");
  const number=document.createElement("span");number.textContent=String(level);
  const desc=document.createElement("span");desc.textContent=formatAt(level).description;
  row.append(number,desc);list.append(row);
 }
 const c=SkillCore.cost(progress,selectedHeroId,openedSkillId);
 $("#skillCostLabel").textContent=c?"НУЖНО ДЛЯ УР. "+c.to:"МАКСИМАЛЬНЫЙ УРОВЕНЬ";
 $("#skillCostText").textContent=c?"Герой от ур. "+c.heroLevel:"Все шесть уровней изучены";
 if(c){
  ResourceArtUI.appendCurrency($("#skillCostText"),c.currency,{compact:true,mode:"cost",asCost:true,stock:progress.currency});
  ResourceArtUI.appendCost($("#skillCostText"),c.materials,progress.skillMaterials);
 }
 const reason=saveBlocked?"Сохранение недоступно.":SkillCore.blocked(progress,selectedHeroId,openedSkillId);
 $("#skillUpgradeButton").disabled=!!reason;
 $("#skillUpgradeButton").textContent=c?"Улучшить до "+c.to:"Умение изучено";
 $("#skillUpgradeStatus").textContent=reason||"Ресурсов достаточно для улучшения.";
}
$("#heroAbilityList")?.addEventListener("click",event=>{
 const button=event.target.closest?.("[data-skill-open]");
 if(button&&$("#heroAbilityList").contains(button))openSkillUpgrade(button.dataset.skillOpen);
});
$("#skillLevelButtons")?.addEventListener("click",event=>{
 const b=event.target.closest?.("[data-skill-preview]");
 if(!b)return;
 const number=Number(b.dataset.skillPreview);
 if(!Number.isInteger(number)||number<1||number>SkillCore.MAX)return;
 skillPreviewLevel=number;renderSkillUpgrade();
});
$("#skillUpgradeClose")?.addEventListener("click",()=>$("#skillUpgradeDialog").close());
$("#skillUpgradeDialog")?.addEventListener("close",()=>{openedSkillId=null;});
$("#skillUpgradeButton")?.addEventListener("click",()=>{
 if(!openedSkillId||saveBlocked)return;
 const before=JSON.stringify(progress);
 const upgraded=SkillCore.upgrade(progress,selectedHeroId,openedSkillId);
 if(!upgraded){renderSkillUpgrade();return;}
 if(!persistProgress()){
  Object.keys(progress).forEach(k=>delete progress[k]);
  Object.assign(progress,JSON.parse(before));
  renderAccountHeader();renderHeroDetail();renderSkillUpgrade();
  $("#skillUpgradeStatus").textContent="Сохранение не удалось. Ресурсы не списаны.";
  return;
 }
 skillPreviewLevel=Math.min(SkillCore.MAX,upgraded.level+1);
 renderHeroDetail();renderHeroes();renderSkillUpgrade();
 $("#skillUpgradeStatus").textContent="Навык улучшен до уровня "+upgraded.level+". Сохранено.";
});
// HEROLEVELSLIDER001: preview and purchase use the same account/currency-gated plan.
function levelPreviewHero(base,level){
 const gear=ProgressCore.gearBonuses(progress,base.id);
 return ["ren","nada","liora","art","sava"].includes(base.id)?
  HeroStatsCombatBridge.apply(base,{
   level,stars:StarCore.rankOf(progress,base.id),
   gearPercent:gear,gearStats:gear.stats
  },HeroStatsProfiles[base.id],HeroStatsCore):
  equippedPilotStats(ProgressCore.heroStats(progress,base,level),PILOT_HERO_STATS[base.id]);
}
function syncHeroLevelSelection(base,hero,levelCap){
 const full=ProgressCore.upgradePlan(progress,base.id,ProgressCore.MAX_LEVEL);
 const maxAffordable=full?.to??hero.level;
 const canSelect=!saveBlocked&&maxAffordable>hero.level;
 if(levelSelectionHeroId!==base.id||selectedLevelTarget===null||selectedLevelTarget<=hero.level){
  levelSelectionHeroId=base.id;
  selectedLevelTarget=hero.level+1;
 }
 selectedLevelTarget=canSelect?
  Math.max(hero.level+1,Math.min(maxAffordable,selectedLevelTarget)):hero.level;
 const slider=$("#heroLevelSlider");
 if(slider){
  slider.min=String(canSelect?hero.level+1:hero.level);
  slider.max=String(canSelect?maxAffordable:hero.level);
  slider.value=String(selectedLevelTarget);
  slider.disabled=!canSelect;
  slider.setAttribute("aria-valuetext",canSelect?
   "Целевой уровень "+selectedLevelTarget+" из "+maxAffordable:
   "Повышение недоступно, текущий уровень "+hero.level);
 }
 const plan=canSelect?ProgressCore.upgradePlan(progress,base.id,selectedLevelTarget-hero.level):null;
 const exact=!!plan&&plan.to===selectedLevelTarget&&plan.levels>0;
 const targetLabel=$("#heroLevelTarget"),costLabel=$("#heroLevelCost");
 if(targetLabel)targetLabel.textContent=canSelect?"→ "+selectedLevelTarget:"—";
 if(costLabel)costLabel.textContent=exact?
  "+"+plan.levels+" ур. · "+plan.cost.toLocaleString("ru-RU")+" кромов":
  (saveBlocked?"Сохранение недоступно":ProgressCore.upgradeBlockReason(progress,base.id)||"Повышение недоступно");
 const button=$("#detailUpgrade");
 button.disabled=!exact||saveBlocked;
 button.textContent=exact?"Повысить до "+selectedLevelTarget:
  (hero.level>=levelCap?"Предел уровня":"Недоступно");
 const cost=$("#detailCost");
 cost.textContent=exact?"":"Недоступно";
 if(exact&&typeof ResourceArtUI!=="undefined")
  ResourceArtUI.appendCurrency(cost,plan.cost,{compact:true,mode:"cost",stock:progress.currency,asCost:true});
 else if(exact)cost.textContent=plan.cost+" кромов";
 const preview=exact?levelPreviewHero(base,selectedLevelTarget):null;
 $("#detailPreview").textContent=preview?
  preview.hp+" HP · "+(Number.isFinite(preview.physicalAttack)?preview.physicalAttack:preview.atk)+" ATK":
  (hero.level>=ProgressCore.maxLevelOf(base.id)?"Максимальный уровень достигнут":
   hero.level>=levelCap?"Нужен более высокий уровень аккаунта":"Недоступно");
}
function renderHeroDetail(){
 const base=ALLIES.find(h=>h.id===selectedHeroId);
 if(!base)return;
 const hero=progressedHero(base);
 const cost=ProgressCore.upgradeCost(progress,base.id);
 const levelCap=ProgressCore.heroLevelCap(progress,base.id);
 $("#detailName").textContent=hero.name;
 $("#detailRole").textContent=hero.role+((["ren","nada","liora","art","sava"].includes(hero.id))?" · Играбельный герой (баланс тестовый)":" · Демонстрационный персонаж");
 if($("#detailTags"))$("#detailTags").textContent=heroTagText(hero);
 $("#detailGlyph").textContent=hero.glyph;
 const showRenPortrait=hero.id==="ren";
 const showNadaPortrait=hero.id==="nada";
 const showLioraPortrait=hero.id==="liora";
 const showArtPortrait=hero.id==="art";
 const showSavaPortrait=hero.id==="sava";
 const showLiora3D=showLioraPortrait;
 const renPortrait=$("#detailRenPortrait"),heroStage=$("#detailHeroStage"),artworkLabel=$("#detailArtworkLabel");
 if(renPortrait){
  renPortrait.hidden=!(showRenPortrait||showNadaPortrait||showLioraPortrait||showArtPortrait||showSavaPortrait);
  renPortrait.src=showArtPortrait?"assets/art-portrait-ui.webp?v=2":showSavaPortrait?"assets/sava-portrait-ui.webp?v=2":showLioraPortrait?"assets/liora-portrait-ui.webp?v=1":showNadaPortrait?"assets/nada-portrait-ui.webp?v=2":"assets/ren-portrait-ui.webp";
  renPortrait.alt=showArtPortrait?"Арт — игровой портрет":showSavaPortrait?"Сава — игровой портрет":showLioraPortrait?"Лиора Вель — портрет":showNadaPortrait?"Нада — утверждённый портрет исследовательницы":"Рен Терен — портрет проводника Садов над пропастью";
 }
 if(heroStage){
  heroStage.classList.toggle("has-ren-portrait",showRenPortrait);
  if(showNadaPortrait||showLioraPortrait||showArtPortrait||showSavaPortrait)heroStage.classList.add("has-ren-portrait");
  heroStage.setAttribute("aria-label",showLiora3D?"Лиора Вель — 3D со щитом":showNadaPortrait?"Нада — 3D-модель при загрузке, иначе портрет":
   showRenPortrait?"Рен Терен: 3D-модель и портрет":showArtPortrait?"Арт: портрет, в бою простая 3D-заглушка":showSavaPortrait?"Сава: 3D-модель при загрузке, иначе портрет":"Схематичный силуэт героя, без 3D-модели");
 }
 if(artworkLabel)artworkLabel.textContent=showLiora3D?"ЛИОРА · 3D СО ЩИТОМ (ТЕСТ)":showNadaPortrait?"ГЕРОЙ · 3D-ПРОСМОТР (ПИЛОТ)":
  showRenPortrait||showSavaPortrait?"ГЕРОЙ · 3D-МОДЕЛЬ":showArtPortrait?"ГЕРОЙ · ПОРТРЕТ И 3D-ЗАГЛУШКА":"ГЕРОЙ · СХЕМАТИЧНЫЙ ВИД";
 if(typeof RenCard3D!=="undefined" && $("#heroDetail")?.classList.contains("active"))
  void RenCard3D.activate(hero.id);
 renderStarPanel(base.id);
 renderHeroAbilities(hero);
 // The real heroes display all 14 derived stats. Mannequins retain pilot data.
 const overview=typeof GearData!=="undefined"&&GearData.statOverview?GearData.statOverview(hero):[];
 const statRows=overview.map(stat=>
  '<div class="stat-catalog-row"><span>'+stat.label+'</span><strong>'+
   (stat.active?stat.value:'Не рассчитано')+'</strong></div>').join("");
 const activeStats=overview.filter(stat=>stat.active).length;
 const trueHero=["ren","nada","liora","art","sava"].includes(hero.id);
 $("#detailStats").innerHTML=`<div><span>Здоровье</span><strong>${hero.hp} HP</strong></div><div><span>${trueHero?"Физическая атака":"Атака (общая, тест)"}</span><strong>${trueHero?hero.physicalAttack:hero.atk+" ATK"}</strong></div><div><span>Скорость</span><strong>${hero.speed}</strong></div><details class="stat-catalog-details"><summary>Все 14 характеристик · ${activeStats} рассчитано</summary><p class="muted">${trueHero?"Параметры играбельных героев рассчитываются из уровня, звёзд и снаряжения. Числа и формулы роста — рабочие, баланс ещё не утверждён.":"Учебный персонаж: часть характеристик ещё не рассчитывается."}</p>${statRows}</details>`;
 $("#detailLevel").textContent="Уровень героя "+hero.level;
 if($("#heroCardCap"))$("#heroCardCap").textContent=saveBlocked?"Сохранение недоступно":
  hero.level>=levelCap?"Достигнут предел: "+levelCap:
  cost!==null&&progress.currency<cost?"Не хватает кромов · предел "+levelCap:
  "Предел: "+levelCap;
 if($("#heroCardWallet")){
  $("#heroCardWallet").textContent="Кромы";
  if(typeof ResourceArtUI!=="undefined")ResourceArtUI.appendCurrency($("#heroCardWallet"),progress.currency,{compact:true,mode:"balance"});
 }
 const nextCap=ProgressCore.nextHeroCapUnlock(ProgressCore.accountLevel(progress));
 const limitNote=$("#detailHeroLevelCap");
 if(limitNote)limitNote.textContent="Твой аккаунт: уровень "+ProgressCore.accountLevel(progress)+
  ". Доступный максимум героя сейчас: "+levelCap+". "+
  (levelCap>=ProgressCore.MAX_LEVEL?
   "Достигнут целевой максимальный уровень 85.":
   (nextCap?"Чтобы открыть максимум "+nextCap.heroCap+
    ", получи уровень аккаунта "+nextCap.accountLevel+".":"Нужен новый уровень аккаунта."));
 $("#detailWallet").textContent=String(progress.currency);
 syncHeroLevelSelection(base,hero,levelCap);

 $("#detailNotice").textContent=saveBlocked?"Сохранение недоступно. Повышение заблокировано.":
  (ProgressCore.upgradeBlockReason(progress,base.id)||
   "Улучшение доступно: повышение за кромы.");
 if($("#gearTier")){
 const gear=ProgressCore.gearState(progress,base.id);
 if(gear.mode==="itemized")renderItemizedGear(base,gear);
 else {
 if($("#gearEquipAll"))$("#gearEquipAll").hidden=true;
 const completed=gear.slots.filter(Boolean).length;
 const item=ProgressCore.gearItem(gear.tier,selectedGearSlot);
 const available=ProgressCore.gearCost(progress,base.id,selectedGearSlot);
 $("#gearTier").textContent="G"+gear.tier+" · "+completed+"/6"+
  (gear.tier===3&&completed===6?" (тестовый максимум)":"");
 $("#gearSlots").innerHTML=gear.slots.map((installed,i)=>{
  const label=ProgressCore.SLOT_NAMES[i];
  const selected=i===selectedGearSlot;
  return '<button type="button" class="gear-slot '+(installed?'filled ':'')+
   (selected?'selected':'')+'" data-gear-slot="'+i+'" aria-pressed="'+selected+
   '" aria-label="Слот '+(i+1)+' · '+label+' · '+(installed?'установлен':'пустой')+'">'+
   (installed?'◆':'◇')+'</button>';
 }).join("");
 $("#gearMaterial").textContent=String(progress.gearMaterials);
 $("#gearWallet").textContent=String(progress.currency);
 const ready=completed===ProgressCore.SLOT_COUNT;
 const promotion=ProgressCore.gearPromotionCost(progress,base.id);
 const maxed=ready&&gear.tier===3;
 $("#gearPriceLabel").textContent=ready?"Стоимость перехода":"Выбранный предмет";
 $("#gearStatBonusLabel").textContent=ready?"Бонус повышения":"Бонус предмета";
 $("#gearPrice").textContent=ready
  ?(maxed?"Тестовый максимум":promotion?.currency+" кромов · G"+promotion.from+" → G"+promotion.to)
  :(item?item.name+": "+item.material+" C · "+item.currency+" кромов":"—");
 const preview=$("#gearStatBonus");
 if(preview)preview.textContent=ready
  ?(maxed?"—":"HP и ATK +"+Math.round(ProgressCore.GEAR_PROMOTION_STAT_BONUS*100)+"%")
  :(item?(item.hpBonus?"HP +"+Math.round(item.hpBonus*100)+"%":"ATK +"+Math.round(item.atkBonus*100)+"%"):"—");
 $("#gearEquipNext").disabled=ready?!promotion||!ProgressCore.canPromoteGear(progress,base.id)
  :!available||!ProgressCore.canEquip(progress,base.id,selectedGearSlot);
 $("#gearEquipNext").textContent=ready?(maxed?"Достигнут максимум":"Поднять уровень")
  :(gear.slots[selectedGearSlot]?"Уже установлено":"Установить выбранный предмет");
 const shortage=ready?(promotion?Math.max(0,promotion.currency-progress.currency):0)
  :(item?Math.max(0,item.currency-progress.currency):0);
 const materialShortage=!ready&&item?Math.max(0,item.material-progress.gearMaterials):0;
 $("#gearNotice").textContent=ready
  ?(maxed?"Доступные G1–G3 полностью пройдены.":
    (ProgressCore.gearPromotionBlockReason(progress,base.id)+(shortage?" Не хватает "+shortage+" кромов.":"")||
     "Все шесть слотов заполнены. Можно повысить G-ступень."))
  :(materialShortage?"Недостаточно материала C: есть "+progress.gearMaterials+", нужно "+item.material+".":
   shortage?"Недостаточно кромов: есть "+progress.currency+", нужно "+item.currency+" (не хватает "+shortage+").":
   ProgressCore.gearBlockReason(progress,base.id,selectedGearSlot)||"Предмет доступен. Можно выбирать слоты в любом порядке.");
 }
 }

 const saveNote=$("#progressSaveNote");
 if(saveNote)saveNote.textContent=saveBlocked
  ?"Сохранение повреждено или недоступно. Покупки заблокированы, прежние данные не перезаписаны."
  :saveAvailable?"Прогресс сохраняется в этом браузере. Очистка данных Safari может его удалить."
  :"Сохранение сейчас недоступно. Прогресс может сброситься после перезагрузки.";
 if(typeof HeroCardUI!=="undefined")HeroCardUI.decorate();
 if(typeof GearUX004!=="undefined")GearUX004.render({
  progress,heroId:base.id,slotIndex:selectedGearSlot,campaign:campaignProgress,saveBlocked
 });
}
$("#gearSlots")?.addEventListener("click",event=>{
 const button=event.target.closest?.("[data-gear-slot]");
 if(!button||!$("#gearSlots").contains(button))return;
 const slot=Number(button.dataset.gearSlot);
 if(!Number.isInteger(slot)||slot<0||slot>=ProgressCore.SLOT_COUNT)return;
 selectedGearSlot=slot;
 if(typeof GearUX004!=="undefined"&&ProgressCore.gearState(progress,selectedHeroId)?.mode==="itemized"){
  GearUX004.openSlot();renderHeroDetail();
  $("#gearSlots")?.querySelector?.('[data-gear-slot="'+slot+'"]')?.focus?.();
  return;
 }
 renderHeroDetail();
 if(typeof HeroCardUI!=="undefined"){
  $("#gearSlots")?.querySelector?.('[data-gear-slot="'+slot+'"]')?.focus?.();
  HeroCardUI.open("heroGearDialog");
 }
});
// GEAREQUIPALL001: one player action, one persisted v3 wallet transaction.
$("#gearEquipAll")?.addEventListener("click",()=>{
 const button=$("#gearEquipAll"),base=ALLIES.find(h=>h.id===selectedHeroId);
 if(!base||saveBlocked||button.disabled)return;
 const state=ProgressCore.gearState(progress,base.id);
 if(state?.mode==="itemized"&&state.slots.every(Boolean)){
  // Route through the existing promotion transaction: one save, rollback,
  // rank/history updates and the native promotion-result dialog.
  if(ProgressCore.canPromoteGear(progress,base.id))$("#gearEquipNext")?.click();
  else renderHeroDetail();
  return;
 }
 const plan=GearEquipAllCore.preview(progress,base.id);
 if(!plan?.count){renderHeroDetail();return;}
 const before=JSON.stringify(progress);
 const result=GearEquipAllCore.equip(progress,base.id);
 if(!result){renderHeroDetail();return;}
 recordDailyTask("equip-item");
 let saved=false;
 try{saved=persistProgress();}catch(_){window.walletWriterHalt?.();}
 if(!saved){
  Object.keys(progress).forEach(k=>delete progress[k]);
  Object.assign(progress,JSON.parse(before));
  renderAccountHeader();renderHeroDetail();
  $("#gearEquipAllStatus").textContent="Не удалось сохранить комплект. Кромы и материалы восстановлены.";
  return;
 }
 renderHeroDetail();renderHeroes();
 $("#gearEquipAllStatus").textContent="Изготовлено и надето "+result.count+
  " предметов. Прогресс сохранён.";
});
$("#gearEquipNext")?.addEventListener("click",()=>{
 const base=ALLIES.find(h=>h.id===selectedHeroId);
 if(!base||saveBlocked)return;
 const current=ProgressCore.gearState(progress,selectedHeroId);
 if(current?.mode==="itemized"){
  const ready=current.slots.every(Boolean);
  if(ready){
   const cost=ProgressCore.gearPromotionCost(progress,selectedHeroId);
   if(!cost||!ProgressCore.canPromoteGear(progress,selectedHeroId)){
    renderHeroDetail();return;
   }
   const before=JSON.stringify(progress),oldStats=progressedHero(base);
   const result=ProgressCore.promoteGear(progress,selectedHeroId);
   if(!result)return;
   if(!persistProgress()){
    Object.keys(progress).forEach(k=>delete progress[k]);
    Object.assign(progress,JSON.parse(before));
    renderAccountHeader();renderHeroDetail();
    $("#gearNotice").textContent="Переход не сохранён. Кромы и прежний ранг восстановлены.";
    return;
   }
   const newStats=progressedHero(base);
   selectedGearSlot=0;renderHeroDetail();renderHeroes();
   GearPromotionUI.show({heroName:base.name,from:result.from,to:result.to,
    currency:result.currency,before:oldStats,after:newStats});
   return;
  }
  const slot=GearData.SLOTS[selectedGearSlot];
  const item=slot?ProgressCore.itemOffer(progress,selectedHeroId,slot.id)[0]:null;
  if(!item||!ProgressCore.canEquipItem(progress,selectedHeroId,item.id)){
   renderHeroDetail();return;
  }
  const before=JSON.stringify(progress);
  if(!ProgressCore.equipItem(progress,selectedHeroId,item.id))return;
  recordDailyTask("equip-item");
  if(!persistProgress()){
   Object.keys(progress).forEach(k=>delete progress[k]);
   Object.assign(progress,JSON.parse(before));
   renderAccountHeader();renderHeroDetail();
   $("#gearNotice").textContent="Покупка не сохранена. Материалы и кромы возвращены.";
   return;
  }
  renderHeroDetail();renderHeroes();return;
 }
 const promotion=ProgressCore.gearPromotionCost(progress,selectedHeroId);
 if(promotion){
  const before=ProgressCore.heroStats(progress,base);
  const result=ProgressCore.promoteGear(progress,selectedHeroId);
  if(!result){renderHeroDetail();return;}
  const after=ProgressCore.heroStats(progress,base);
  selectedGearSlot=0;
  persistProgress();
  renderHeroDetail();
  renderHeroes();
  GearPromotionUI.show({heroName:base.name,from:result.from,to:result.to,
   currency:result.currency,before,after});
  return;
 }
 if(ProgressCore.equip(progress,selectedHeroId,selectedGearSlot)){
  persistProgress();
  renderHeroDetail();
  renderHeroes();
 }
});
$("#gearPromotionClose")?.addEventListener("click",()=>$("#gearPromotionDialog").close());
$("#detailBack").addEventListener("click",()=>showScreen("collection"));
$("#detailHome").addEventListener("click",()=>showScreen("home"));
function applyHeroLevels(count){
 if(saveBlocked)return false;
 const base=ALLIES.find(hero=>hero.id===selectedHeroId);
 const oldStats=base?progressedHero(base):null;
 const before=JSON.stringify(progress);
 const purchase=ProgressCore.upgradeMany(progress,selectedHeroId,count);
 if(!purchase)return false;
 recordDailyTask("hero-level");
 if(!persistProgress()&&progress.saveVersion===3){
  Object.keys(progress).forEach(k=>delete progress[k]);
  Object.assign(progress,JSON.parse(before));
  renderAccountHeader();renderHeroDetail();
  $("#detailNotice").textContent="Уровни не сохранены. Кромы возвращены.";
  return false;
 }
 renderHeroDetail();renderHeroes();
 // The hero-stat popup is the bulk-upgrade control; close it before the reward.
 if(typeof GearPromotionUI!=="undefined"&&base){
  if($("#heroStatsDialog")?.open)$("#heroStatsDialog").close();
  GearPromotionUI.showLevel({heroName:base.name,from:purchase.from,to:purchase.to,
   currency:purchase.cost,cap:purchase.cap,before:oldStats,after:progressedHero(base)});
 }
 return true;
}
$("#heroLevelSlider")?.addEventListener("input",event=>{
 const base=ALLIES.find(hero=>hero.id===selectedHeroId);
 if(!base||saveBlocked)return;
 const current=ProgressCore.levelOf(progress,base.id);
 const full=ProgressCore.upgradePlan(progress,base.id,ProgressCore.MAX_LEVEL);
 const requested=Number(event.currentTarget.value);
 if(!Number.isInteger(requested)||!full||full.to<=current)return;
 levelSelectionHeroId=base.id;
 selectedLevelTarget=Math.max(current+1,Math.min(full.to,requested));
 syncHeroLevelSelection(base,progressedHero(base),ProgressCore.heroLevelCap(progress,base.id));
});
$("#detailUpgrade").addEventListener("click",()=>{
 if(saveBlocked)return;
 const current=ProgressCore.levelOf(progress,selectedHeroId);
 const count=selectedLevelTarget-current;
 const plan=ProgressCore.upgradePlan(progress,selectedHeroId,count);
 if(!plan||plan.levels!==count||plan.to!==selectedLevelTarget)return;
 applyHeroLevels(count);
});

function missionRewardLabel(id){
 const reward=ProgressCore.MISSION_GEAR_FARM[id];
 if(progress.saveVersion!==3||!reward)return "";
 const components=GearMaterialUI.group(reward.materials);
 const first=ProgressCore.FIRST_CLEAR_REWARDS[id];
 const bonus=first&&!progress.claimedMissions.includes(id)
  ?"<p class=\"muted\">Первая победа: "+ResourceArtUI.currencyTile(first.currency,{compact:true})+" · "+first.xp+" XP.</p>":"";
 return "<p class=\"muted\"><b>Награды за победу:</b> "+ResourceArtUI.currencyTile(reward.currency,{compact:true})+
  " · "+reward.xp+" XP."+components+
  "Выдаются при первой победе и каждом повторе (от 1★). Симуляция после 3★.</p>"+bonus+
  (typeof HeroCollectionCore!=="undefined"&&HeroCollectionCore.reward(id)&&
   !heroOwned(HeroCollectionCore.reward(id))?
    '<p class="muted">За первую победу: новый тестовый герой — '+
    (ALLIES.find(h=>h.id===HeroCollectionCore.reward(id))?.name||"герой")+".</p>":"");
}
// LC-005: only a verified real combat win can unlock the next episode.
function openLoreRequiredBattle(context){
 if(!context?.nodeId||!context.battleId)return false;
 loreRequiredContext={nodeId:context.nodeId,battleId:context.battleId,
  storyId:context.storyId,battleNarrative:context.battleNarrative||null,
  battleObjective:context.battleObjective||null,replay:context.replay===true};
 loreRequiredResult=null;activeMissionId=null;
 loreSquadSlots=null; // New story encounter: copy global formation, then lock Ren and Nada.
 openSquad("loreRequired");return true;
}
function renderLoreRequiredBattleResult(){
 const won=state?.winner==="ally",saved=!!loreRequiredResult?.ok;
 const title=$("#loreRequiredResultTitle"),body=$("#loreRequiredResultText");
 if(title)title.textContent=won?(saved?"Бой выигран":"Победа не сохранена"):"Бой проигран";
 if(body){
  const summary=won?(saved?
   (loreRequiredResult?.replay?"Повтор пройден. Прежний результат сохранён, новых наград нет.":
    ActiveLoreCampaign.data.getNode(loreRequiredContext?.nodeId)?.nextNodeIds.length?
     "Победа записана в истории. Следующий эпизод открыт.":
     "Победа записана. Финальное испытание завершено."):
   "Победа не сохранилась. Проверьте хранилище и повторите бой."):
   (loreRequiredContext?.replay?
     "Повтор проигран. Прежняя победа и доступ к истории сохранены. Можно попробовать ещё раз.":
     "Поражение: следующий эпизод закрыт. Можно пересобрать отряд.");
  const n=loreRequiredContext?.battleNarrative;
  const consequence=won?(saved?n?.victory:null):n?.defeat;
  // Never turn private authored prose into HTML or a canonical game reward.
   const obj=loreRequiredContext?.battleObjective;
   const protectedName=obj?.protectAllyId==="nada"?"Нада":"Рен";
   const outcome=state?.tacticalOutcome==="held"?
    (obj?.protectAllyId==="nada"?"Сигнал удержан до завершения наблюдения.":
     "Отход прикрыт до завершения эвакуации."):
    state?.tacticalOutcome==="defeated-attackers"?
     (obj?.protectAllyId==="nada"?"Помехи устранены до окончания наблюдения.":
      "Нападавшие оттеснены раньше окончания эвакуации."):
    state?.tacticalOutcome==="protected-fallen"?protectedName+
      (protectedName==="Нада"?" выбыла":" выбыл")+" из боя: задача сорвалась.":
    state?.tacticalOutcome==="wrong-order"?"Зачинщик должен выбыть раньше остальных.":
    state?.tacticalOutcome==="priority-victory"?"Приоритетная цель устранена первой.":
    state?.tacticalOutcome==="protected-victory"?"Защищаемый герой остался в строю.":"";
   body.textContent=summary+(outcome?"\n\n"+outcome:"")+(consequence?"\n\n"+consequence:"");
 }
 const next=$("#loreRequiredResultContinue"),retry=$("#loreRequiredResultRetry");
 if(next)next.hidden=!saved;
 if(retry){retry.hidden=false;retry.textContent=saved?"Сыграть ещё раз":"Повторить бой";}
}
$("#loreRequiredResultContinue")?.addEventListener("click",returnToLoreMap);
$("#loreRequiredResultRetry")?.addEventListener("click",()=>{
 if(!loreRequiredResult?.ok){openSquad("loreRequired");return;}
 const nodeId=loreRequiredContext?.nodeId;
 returnToLoreMap();
 const node=ActiveLoreCampaign.data.getNode(nodeId);
 if(node?.mapLayerId)LoreCampaignUI.changeLayer(node.mapLayerId);
 if(LoreCampaignUI.selectNode(nodeId))LoreCampaignUI.startRequiredBattle();
});
$("#loreRequiredResultBack")?.addEventListener("click",()=>{
 LoreCampaignUI.cancelRequiredBattle();returnToLoreMap();
});
// LC-004: optional 3D tactical exercise with no chapter-one consequences.
function openLoreTraining(){activeMissionId=null;openSquad("loreTraining");}
function returnToLoreMap(){
 if(squadReturnScreen==="loreRequired"){
  loreSquadSlots=null;
  squadReturnScreen="home";
 }
 showScreen("campaign");
 showCampaignPath("lore");
 if(typeof LoreCampaignUI!=="undefined")LoreCampaignUI.openStory("five-shadows");
}
function renderLoreTrainingResult(){
 const won=state?.winner==="ally";
 const title=$("#loreTrainingResultTitle"),body=$("#loreTrainingResultText");
 if(title)title.textContent=won?"Учебная победа":"Учебное поражение";
 if(body)body.textContent=(won?
  "Отряд справился с учебными противниками.":"Отряд не справился; попробуйте другую тактику или состав.")+
  " Это бой вне событий «Пяти теней»: без наград, энергии и изменений сюжета.";
}
$("#loreTrainingResultBack")?.addEventListener("click",returnToLoreMap);
$("#loreTrainingResultRetry")?.addEventListener("click",openLoreTraining);
$("#loreTrainingResultHome")?.addEventListener("click",()=>showScreen("home"));
// LC-008F: five independently receipted lore rewards. The existing v3 wallet
// writer remains the ONLY mutator; source/revision/proof checks are in core.
function loreRewardStatus(act){
 if(saveBlocked||!saveAvailable||progress.saveVersion!==3||
    typeof LoreActOneRewardCore==="undefined"||
    typeof ProgressWriterCore==="undefined"||!ProgressWriterCore.isOwner())return "blocked";
 return LoreActOneRewardCore.statusForAct(act,{
  storageProvider:()=>window.localStorage,heroes:ALLIES
 });
}
const loreRewardSource=act=>typeof LoreActOneRewardCore!=="undefined"?
 LoreActOneRewardCore.sourceForAct(act):null;
let loreRewardClaiming=false;
async function claimLoreReward(act){
 if(loreRewardClaiming)return {message:"Награда уже сохраняется."};
 if(!loreRewardSource(act))return {message:"Неизвестный акт."};
 const status=loreRewardStatus(act);
 if(status!=="claimable")return {message:status==="claimed"?
  "Эта награда уже получена.":"Завершите акт и необходимые бои, чтобы забрать награду."};
 loreRewardClaiming=true;
 try{
  const result=await LoreActOneRewardCore.claimForAct(act,{
   storageProvider:()=>window.localStorage,heroes:ALLIES,
   exclusive:ProgressWriterCore.exclusive,day:DailyCore.localDay()
  });
  if(!result.ok){
   // Never retry an ambiguous wallet write in the same session.
   if(["SAVE_OUTCOME_UNKNOWN","REWARD_SYNC_FAILED","EXCLUSIVE_LOCK_FAILED",
       "STALE_WALLET","WALLET_READ_FAILED","INVALID_WALLET"].includes(result.code)){
    window.walletWriterHalt?.();
    return {message:"Не удалось подтвердить баланс. Перезагрузите игру и проверьте награду."};
   }
   return {message:result.code==="ALREADY_CLAIMED"?"Награда уже получена.":
    result.code==="PROOF_NOT_PERSISTED"?"Завершите акт и выиграйте обязательные бои.":
    "Награда не выдана ("+result.code+"). После восстановления сохранения её можно будет забрать."};
  }
  // Preserve reference identity: every screen/battle handler uses this object.
  Object.keys(progress).forEach(key=>delete progress[key]);
  Object.assign(progress,result.runtime);
  saveAvailable=true;
  renderAccountHeader();renderPlayerProfile();renderDailyTasks();renderHeroes();
  return {message:"Награда за акт "+(["I","II","III","IV","V"][act-1])+
   " получена. Ресурсы зачислены в кошелёк."};
 }catch(_){
  window.walletWriterHalt?.();
  return {message:"Не удалось подтвердить выплату. Перезагрузите игру и проверьте баланс."};
 }finally{loreRewardClaiming=false;}
}
// CAMPAIGN-HUB-001: presentation-only navigation; mission IDs and saves are unchanged.
let selectedCampaignPath=null;
const CAMPAIGN_PATH_TITLES=Object.freeze({training:"Учебная кампания",lore:"Кампании лора",main:"Путь к престолу"});
function showCampaignPath(path){
 selectedCampaignPath=Object.prototype.hasOwnProperty.call(CAMPAIGN_PATH_TITLES,path)?path:null;
 const hub=$("#campaignHub"),title=$("#campaignPageTitle"),back=$("#campaignBackButton");
 if(hub)hub.hidden=selectedCampaignPath!==null;
 for(const key of Object.keys(CAMPAIGN_PATH_TITLES)){
  const section=$("#campaign"+key[0].toUpperCase()+key.slice(1)+"Content");
  if(section)section.hidden=selectedCampaignPath!==key;
 }
 if(title)title.textContent=selectedCampaignPath?CAMPAIGN_PATH_TITLES[selectedCampaignPath]:"Выбор кампании";
 if(back)back.textContent=selectedCampaignPath?"← К выбору":"← В штаб";
 if(selectedCampaignPath==="main")renderMainCampaign();
 // LOREMAP001: open the non-combat lore map through the existing hub.
 if(selectedCampaignPath==="lore"&&typeof LoreCampaignUI!=="undefined"&&
   typeof LoreCampaignAct2!=="undefined"&&typeof LoreCampaignCore!=="undefined"){
  const loreRoot=$("#loreCampaignRoot");
  if(loreRoot&&LoreCampaignUI.mount(loreRoot,ActiveLoreCampaign.data,LoreCampaignCore,{
   pack:ActiveLoreCampaign.pack,
   onStartRequiredBattle:openLoreRequiredBattle,
   onStartTraining:openLoreTraining,
   onClaimActReward:claimLoreReward,
   getActRewardStatus:loreRewardStatus,
   getActRewardSource:loreRewardSource
  }))LoreCampaignUI.open();
 }
}
document.querySelectorAll("[data-campaign-path]").forEach(button=>button.addEventListener("click",()=>{
 showCampaignPath(button.dataset.campaignPath);
 if(button.dataset.campaignPath==="training")renderCampaign();
}));
$("#campaignBackButton")?.addEventListener("click",()=>{
 if(selectedCampaignPath==="lore"&&typeof LoreCampaignUI!=="undefined"&&LoreCampaignUI.back())return;
 if(selectedCampaignPath)showCampaignPath(null);
 else showScreen("home");
});
function renderCampaign(){
 ProgressCore.refreshEnergy(progress);
 renderAccountHeader();
 const resource=$("#energyStatus");
 if(resource)resource.textContent="Энергия: "+progress.energy.value+"/"+ProgressCore.ENERGY_MAX+
  " · 1 за 6 минут · симуляция после 3★.";
 const list=$("#campaignMissions");
 const chapters=CampaignData.allChapters();
 const allTrainingMissions=chapters.flatMap(ch=>CampaignData.missions(ch.id).map(e=>e.missionId));
 const doneTraining=allTrainingMissions.filter(id=>campaignProgress.completed[id]===true).length;
 const trainingCounter=$("#trainingCampaignProgress");
 if(trainingCounter)trainingCounter.textContent="Пройдено "+doneTraining+" из "+allTrainingMissions.length;
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
   const cost=ProgressCore.missionEnergyCost(mission.id);
   const freeEntry=progress.saveVersion===3&&!completed;
   const enough=freeEntry||ProgressCore.affordableRuns(progress,mission.id)>0;
   const status=completed?"Пройдено · Повторное прохождение доступно":available?"Не пройдено":"Заблокировано";
   const criteria=mission.stars.map((star,index)=>
    `<li><span class="mission-criteria-star">${index+1}★</span><span>${star.hint}</span></li>`).join("");
   return `<article class="campaign-panel campaign-mission"><div class="node">I</div><div><h3>${mission.title}</h3><p>${entry.description}</p><p class="muted">${freeEntry?"Сюжетные попытки до первой победы: бесплатно. Повторы и симуляция: "+cost+" ⚡.":progress.saveVersion===3?"Повторный бой или симуляция: "+cost+" ⚡ за попытку.":"Стоимость входа: "+cost+" ⚡ за попытку (бой или симуляция)"}</p>${missionRewardLabel(mission.id)}<p class="campaign-mission-status">${status}</p><p class="mission-stars">Лучшая оценка: ${"★".repeat(best)+"☆".repeat(3-best)} (${best}/3)</p><ul class="mission-criteria" aria-label="Условия получения звёзд">${criteria}</ul><div class="campaign-mission-actions"><button type="button" class="primary" data-campaign-mission="${mission.id}" ${available&&enough?"":"disabled"}>${completed?"Пройти ещё раз":available?"Вступить в бой":"Недоступно"}</button>${best===3?`<button type="button" class="ghost" data-simulate-mission="${mission.id}" ${enough?"":"disabled"}>Симуляция</button>`:""}</div></div></article>`;
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
// A visible campaign can be left open while energy regenerates.
function energyRefreshFeedback(now=Date.now()){
 const snapshot=progress.saveVersion===3?JSON.stringify(progress):null;
 const before=progress.energy.value;
 let restored=ProgressCore.refreshEnergy(progress,now);
 if(restored>0&&!persistProgress()){
  if(snapshot){
   Object.keys(progress).forEach(k=>delete progress[k]);
   Object.assign(progress,JSON.parse(snapshot));
  }
  restored=0; // No optimistic energy on unconfirmed storage.
 }
 renderCampaign();
 const status=$("#energyRefreshStatus");
 if(!status)return restored;
 if(restored>0){
  status.textContent="Восстановлено: +"+restored+" ⚡. Сейчас "+progress.energy.value+"/"+ProgressCore.ENERGY_MAX+".";
 }else if(progress.energy.value>=ProgressCore.ENERGY_MAX){
  status.textContent="Энергия уже полная ("+ProgressCore.ENERGY_MAX+"/"+ProgressCore.ENERGY_MAX+").";
 }else{
  const elapsed=Math.max(0,now-progress.energy.updatedAt);
  const remaining=ProgressCore.ENERGY_REGEN_MS-elapsed%ProgressCore.ENERGY_REGEN_MS;
  const minutes=Math.ceil(remaining/60000);
  status.textContent="Пока без изменений. Следующая +1 ⚡ примерно через "+minutes+" мин.";
 }
 return progress.energy.value-before;
}
$("#energyRefresh")?.addEventListener("click",()=>energyRefreshFeedback());
document.addEventListener("visibilitychange",()=>{
 if(document.hidden)return;
 renderDailyClaimBadge();
 if($("#campaign")?.classList.contains("active"))renderCampaign();
 maybeOpenLoginOnEntry();
});
// One batch-simulation entry point for every 3-starred campaign mission.
function renderSimulationPreview(){
 const mission=simulationMissionId,range=$("#simulationCount");
 if(!mission||!range)return;
 ProgressCore.refreshEnergy(progress);
 const count=Number(range.value),cost=ProgressCore.missionEnergyCost(mission);
 const preview=$("#simulationMaterialPreview");
 if(preview){
  const materials=progress.saveVersion===3&&ProgressCore.MISSION_GEAR_FARM[mission]?.materials;
  preview.innerHTML=materials?GearMaterialUI.group(Object.fromEntries(
   Object.entries(materials).map(([key,n])=>[key,n*count]))):"";
 }
 $("#simulationQuantity").textContent=String(count);
 $("#simulationCost").textContent=String(count*cost)+" ⚡";
 $("#simulationAvailable").textContent=String(progress.energy.value)+" ⚡";
 $("#simulationConfirm").disabled=!Number.isSafeInteger(count)||count<1||
  count>ProgressCore.affordableRuns(progress,mission);
}
function simulateMission(id){
 const entry=CampaignData.getMission(id);
 if(!entry||!CampaignData.available(entry,campaignProgress)||campaignProgress.bestStars[id]!==3)return false;
 const available=ProgressCore.affordableRuns(progress,id);
 if(available<1){renderCampaign();return false;}
 simulationMissionId=id;
 const range=$("#simulationCount");
 if(!range)return false;
 range.min="1";range.max=String(available);range.value="1";
 $("#simulationTitle").textContent="Симуляция · "+MissionData.get(id).title;
 $("#simulationSetup").hidden=false;
 $("#simulationResults").hidden=true;
 $("#simulationClose").textContent="Отмена";
 renderSimulationPreview();
 $("#simulationDialog").showModal();
 return true;
}
$("#simulationCount")?.addEventListener("input",renderSimulationPreview);
$("#simulationCount")?.addEventListener("change",renderSimulationPreview);
$("#simulationConfirm")?.addEventListener("click",()=>{
 if(!simulationMissionId)return;
 const count=Number($("#simulationCount").value);
 // Revalidate immediately before charging: energy may have changed while modal was open.
 const snapshot=progress.saveVersion===3?JSON.stringify(progress):null;
 const gain=ProgressCore.simulate(progress,simulationMissionId,campaignProgress.bestStars[simulationMissionId],count);
 if(!gain){renderSimulationPreview();return;}
 if(!persistProgress()){
  if(snapshot){
   Object.keys(progress).forEach(k=>delete progress[k]);
   Object.assign(progress,JSON.parse(snapshot));
  }
  simulationMissionId=null;
  $("#simulationTitle").textContent="Сохранение не подтверждено";
  $("#simulationText").textContent="Проверьте баланс после перезагрузки, затем повторите действие.";
  $("#simulationRewards").textContent="Награды не подтверждены.";
  $("#simulationSetup").hidden=true;$("#simulationResults").hidden=false;
  return;
 }
 // Prevent a second confirmation from paying the same visible result again.
 simulationMissionId=null;
 $("#simulationSetup").hidden=true;
 $("#simulationResults").hidden=false;
 $("#simulationTitle").textContent="Поздравляем!";
 $("#simulationText").textContent="Выполнено симуляций: "+gain.count+". Потрачено: "+gain.energy+" ⚡.";
 $("#simulationRewards").textContent=[
  gain.material?"+ "+gain.material+" материалов C":null,

 ].filter(Boolean).map(item=>"• "+item).join("\n");
 ResourceArtUI.appendCurrency($("#simulationRewards"),gain.currency,{compact:true});
 ResourceArtUI.append($("#simulationRewards"),gain.xp);
 if(gain.materials)GearMaterialUI.append($("#simulationRewards"),gain.materials);
 $("#simulationClose").textContent="Закрыть";
 renderCampaign();
 if($("#heroDetail")?.classList.contains("active"))renderHeroDetail();
});
const simulationClose=$("#simulationClose");
if(simulationClose)simulationClose.addEventListener("click",()=>{
 $("#simulationDialog").close();simulationMissionId=null;
 if($("#heroDetail")?.classList.contains("active"))renderHeroDetail();
});
function renderMissionResult(){
 const won=state.winner==="ally";
 const entry=CampaignData.getMission(activeMissionId);
 const chapter=entry&&CampaignData.allChapters().find(c=>c.id===entry.chapterId);
 const chapterLabel=$("#missionResultChapter");
 if(chapterLabel)chapterLabel.textContent=chapter?chapter.title:"Кампания";
 $("#missionResultTitle").textContent=won?"Миссия пройдена":"Миссия не пройдена";
 const base=lastMissionFarmReward?"Получена награда за ресурсный бой. ":"";
 const first=lastMissionReward?"Дополнительно за первую победу: "+
    (lastMissionReward.material?"+"+lastMissionReward.material+" C.":"разовый бонус."):"";
 $("#missionResultText").textContent=missionResultSaveFailed
  ?"Ошибка сохранения наград. Прогресс этой победы не записан. Проверь хранилище браузера и повтори миссию."
  :won?MissionData.get(activeMissionId).title+" завершена. "+(base+first||"Повтор без экономических наград.")+
   (lastUnlockedHeroId?" Новый герой получен: "+(ALLIES.find(h=>h.id===lastUnlockedHeroId)?.name||"тестовый персонаж")+".":"")
  :"Отряд потерпел поражение. Наград нет."+(lastMissionEnergyRefunded?" Энергия за ресурсный повтор возвращена.":"");
 if(won&&!missionResultSaveFailed){
  const xp=(lastMissionFarmReward?.xp||0)+(lastMissionReward?.xp||0);
  if(lastMissionFarmReward)ResourceArtUI.appendCurrency($("#missionResultText"),lastMissionFarmReward.currency,{compact:true});
  if(lastMissionReward)ResourceArtUI.appendCurrency($("#missionResultText"),lastMissionReward.currency,{compact:true});
  ResourceArtUI.append($("#missionResultText"),xp);
  if(lastMissionFarmReward)GearMaterialUI.append($("#missionResultText"),lastMissionFarmReward.materials);
 }
 const grade=$("#missionResultStars");
 if(grade){
  const best=campaignProgress.bestStars[activeMissionId]||0;
  grade.textContent=won
   ?"Оценка: "+("★".repeat(lastMissionStars)+"☆".repeat(3-lastMissionStars))+
      " · Лучший результат: "+best+"/3 · Действий союзников: "+state.allyActions
   :"Оценка: ☆☆☆ (0/3)";
 }
 $("#missionResultRetry").textContent=won?"Пройти ещё раз":"Попробовать снова";
 $("#missionResultBack").textContent=typeof GearUX004!=="undefined"&&GearUX004.hasReturnContext()?
  "К предмету":"К кампании";
}
$("#missionResultBack").addEventListener("click",()=>{
 if(typeof GearUX004!=="undefined"&&GearUX004.hasReturnContext()){
  GearUX004.returnToHero();return;
 }
 showScreen("campaign");
});
$("#missionResultRetry").addEventListener("click",()=>activeMissionId&&openCampaignMission(activeMissionId));
$("#missionResultHome").addEventListener("click",()=>{
 if(typeof GearUX004!=="undefined")GearUX004.cancelReturn();
 showScreen("home");
});

function livingEnemies(){return CombatCore.livingEnemies(state.fighters);}
function renderBattleLog(){
 const summary=$("#battleLogSummary");
 const content=$("#battleLogEntries");
 if(!summary||!content)return;
 const lines=CombatLog.lines(state.events||[],state.fighters);
 summary.textContent="Журнал боя · "+lines.length+" событий";
 content.textContent=lines.length?lines.map((line,i)=>(i+1)+". "+line).join("\n"):"Пока нет событий.";
}
// NPCUX004: this marker is based on the battle objective or EARNED
// SignalOperationCore intel only. Never read run.signalId directly.
function npcCombatMarker(fighter){
 if(typeof NpcBattleIntel==="undefined")return null;
 const knownSignal=battleIsSignal&&signalProgress.active?.phase==="battle"&&
  signalProgress.active?.assault==="quiet"?
  SignalOperationCore.intel(signalProgress.active)?.signalId:null;
 return NpcBattleIntel.marker(fighter,state,knownSignal);
}
// ARENA-UI-003: SWGOH-style HUD. The target is shown on the scene (ring and
// cursor), so the old target card is gone. Turn order, the acting hero and
// round ability icons are drawn from CombatCore state; nothing here changes it.
let turnQueueSignature="",turnQueueCollapsed=false;
try{turnQueueCollapsed=window.localStorage?.getItem?.("ashes-throne.arena-queue-collapsed")==="1";}catch(e){}
function renderTurnQueue(){
 const list=$("#turnQueue"),bar=$("#turnQueueBar");
 if(!list||typeof ArenaUI003==="undefined")return;
 const live=!!state.active&&!isVisualTransition();
 const ids=live?ArenaUI003.forecast(state,ArenaUI003.QUEUE_SIZE,{
  speedOf:f=>CombatCore.effectiveStat(state,f,"speed")}):[];
 const signature=ids.join("|");
 if(signature!==turnQueueSignature){
  turnQueueSignature=signature;
  list.innerHTML=ArenaUI003.queueHtml(state,ids);
  list.setAttribute?.("aria-label",ArenaUI003.queueLabel(state,ids));
 }
 if(bar){bar.hidden=!ids.length;bar.classList?.toggle("collapsed",turnQueueCollapsed);}
 const wave=$("#turnQueueWave");
 if(wave){wave.hidden=!(state.totalWaves>1);wave.textContent=state.totalWaves>1?"Волна "+state.wave+"/"+state.totalWaves:"";}
 const toggle=$("#turnQueueToggle");
 if(toggle){
  toggle.setAttribute?.("aria-expanded",String(!turnQueueCollapsed));
  toggle.setAttribute?.("aria-label",turnQueueCollapsed?"Развернуть очередь ходов":"Свернуть очередь ходов");
 }
}
$("#turnQueueToggle")?.addEventListener("click",()=>{
 turnQueueCollapsed=!turnQueueCollapsed;
 try{window.localStorage?.setItem?.("ashes-throne.arena-queue-collapsed",turnQueueCollapsed?"1":"0");}catch(e){}
 renderTurnQueue();
 arenaHudLayout?.avoid?.(arenaHudObstacles());
});
// ARENA-ART-004G: the objective sits folded in the top-right corner and opens on
// tap (or from the battle menu); it never covers the middle of the arena.
function setBattleGoalOpen(open){
 const goal=$("#battleChallengeGoal");
 if(goal){
  goal.setAttribute?.("aria-expanded",String(open));
  goal.classList?.toggle("expanded",open);
 }
 const card=$("#tacticalGoalCard");
 if(card){
  card.classList?.toggle("collapsed",!open);
  $("#tacticalGoalToggle")?.setAttribute?.("aria-expanded",String(open));
 }
 arenaHudLayout?.avoid?.(arenaHudObstacles());
}
function battleGoalOpen(){
 const goal=$("#battleChallengeGoal"),card=$("#tacticalGoalCard");
 return !!(goal&&!goal.hidden&&goal.getAttribute?.("aria-expanded")==="true"||
  card&&!card.hidden&&!card.classList?.contains("collapsed"));
}
function battleHasGoal(){
 return !!($("#battleChallengeGoal")&&!$("#battleChallengeGoal").hidden||
  $("#tacticalGoalCard")&&!$("#tacticalGoalCard").hidden);
}
$("#battleChallengeGoal")?.addEventListener("click",()=>setBattleGoalOpen(!battleGoalOpen()));
$("#tacticalGoalToggle")?.addEventListener("click",()=>setBattleGoalOpen(!battleGoalOpen()));
// ARENA-ART-004G: the top-left ✕ became a menu: goal, replay, retreat.
function closeBattleMenu(){
 const menu=$("#battleMenu");
 if(menu)menu.hidden=true;
 $("#battleMenuBtn")?.setAttribute?.("aria-expanded","false");
}
function openBattleMenu(){
 const menu=$("#battleMenu");
 if(!menu)return;
 const goal=$("#battleMenuGoal"),retry=$("#battleMenuRetry");
 if(goal)goal.disabled=!battleHasGoal();
 if(retry)retry.disabled=!state.active;
 menu.hidden=false;
 $("#battleMenuBtn")?.setAttribute?.("aria-expanded","true");
 (menu.querySelector?.(".battle-menu-item:not(:disabled)"))?.focus?.();
}
$("#battleMenuBtn")?.addEventListener("click",()=>{
 if($("#battleMenu")?.hidden===false)closeBattleMenu();else openBattleMenu();
});
$("#battleMenuGoal")?.addEventListener("click",()=>{closeBattleMenu();setBattleGoalOpen(true);});
// Replay = the same mode and squad from the start, through the normal squad
// start (energy, checkpoints and warnings stay where they are). If a check
// fails, the player stays on the squad screen with its warning.
function replayBattle(){
 closeBattleMenu();
 if(!state.active)return false;
 const mode=squadReturnScreen||"home";
 openSquad(mode);
 undersizedSquadConfirmed=true; // this squad was already confirmed for the fight
 $("#squadStart")?.click?.();
 return true;
}
$("#battleMenuRetry")?.addEventListener("click",replayBattle);
// Retreat keeps the old ✕ behaviour: the shared [data-screen] handler below.
$("#battleMenuRetreat")?.addEventListener("click",closeBattleMenu);
document.addEventListener("pointerdown",event=>{
 const menu=$("#battleMenu");
 if(!menu||menu.hidden)return;
 if(event.target?.closest?.("#battleMenu, #battleMenuBtn"))return;
 closeBattleMenu();
});
document.addEventListener("keydown",event=>{
 if(event.key==="Escape"&&$("#battleMenu")?.hidden===false){closeBattleMenu();$("#battleMenuBtn")?.focus?.();}
});
function renderActiveHero(actor){
 const box=$("#activeHero");
 if(!box)return;
 box.hidden=!actor;
 if(!actor)return;
 const name=$("#activeHeroName");
 if(name)name.textContent=actor.name;
 const pic=$("#activeHeroPortrait");
 if(pic&&pic.dataset?.fighterId!==actor.id){
  pic.dataset.fighterId=actor.id;
  const src=typeof ArenaUI003!=="undefined"?ArenaUI003.portrait(actor):null;
  pic.innerHTML=src?`<img src="${src}" alt="" draggable="false">`:
   `<span>${typeof ArenaUI003!=="undefined"?ArenaUI003.initials(actor.name):""}</span>`;
 }
}
// One round button: icon or temporary pictogram, cooldown on top, name for
// screen readers and long-press help. The DOM is rebuilt only on change.
function renderAbilityButton(button,actor,abilityId,definition,cooldown,stateName){
 if(!button)return;
 const name=definition?.name||{basic:"Базовая атака",special:"Особая способность",powerful:"Мощная способность"}[abilityId];
 const label=name+(cooldown>0?" · перезарядка "+cooldown:"");
 button.setAttribute?.("aria-label",label);
 const data=button.dataset||(button.dataset={});
 data.state=stateName;
 if(typeof ArenaUI003==="undefined"){button.textContent=name+(cooldown>0?" · "+cooldown:"");return;}
 const face=ArenaUI003.abilityFace(actor?.archetypeId||actor?.id,abilityId,definition||{name},cooldown);
 const signature=[actor?.id,abilityId,name,cooldown].join("|");
 if(data.face!==signature){data.face=signature;button.innerHTML=face.html;}
 data.accent=face.accent;
}
function npcBattleMessage(){
 if(battleIsNpcChallengePilot&&activeChallengeId==="T-04"){
  if(state?.tacticalOutcome==="held")return "Удержание завершено. Защищаемый герой в безопасности.";
  if(state?.tacticalOutcome==="protected-fallen")return "Поражение: защищаемый герой выведен из строя.";
 }
 return state.message;
}
function syncBattleUI(){
 if(inspectionId)renderFighterInspection();
 if(battleIsFirstPlay||battleIsLoreRequired||(battleIsNpcChallengePilot&&activeChallengeId==="T-04")){
  const o=state.tacticalObjective;
  const timed=o?.kind==="hold-or-defeat",counter=$("#tacticalGoalCounter");
  const track=$("#tacticalGoalCard .tactical-goal-track"),fill=$("#tacticalGoalFill");
  if(counter){
   counter.hidden=!(timed||state.totalWaves>1||o?.kind==="priority-first");
   if(timed)counter.textContent=Math.min(state.allyActions,o.allyActionsToHold)+
    "/"+o.allyActionsToHold+(battleIsFirstPlay?" · эвакуация":" действий");
   else if(state.totalWaves>1)counter.textContent="Волна "+state.wave+"/"+state.totalWaves;
   else if(o?.kind==="priority-first")counter.textContent=state.priorityCleared?
    "Приоритет выполнен":"Сначала отмеченный";
  }
  if(track)track.hidden=!timed;
  if(fill&&timed)fill.style.width=Math.round(
   Math.min(state.allyActions,o.allyActionsToHold)/o.allyActionsToHold*100)+"%";
 }
 if(!state.active||isVisualTransition())hideAbilityTooltip();
 if(!state.active){cancelAutoTimer();autoBattle=false;}
 // Commit battle outcome immediately as before, even if the player leaves
 // the arena before the final animation ends. Only visual navigation waits.
 if(battleIsMainCampaign&&!state.active&&!missionResultRecorded){
   missionResultRecorded=true;
   mainCampaignResult=MainCampaignCore.record(state,mainCampaignStorage);
   if(!mainCampaignResult.ok)mainCampaignNotice="Сохранение не подтверждено. Вернитесь на карту или перезагрузите игру.";
  }
  if(battleIsCampaign&&!state.active&&!missionResultRecorded){
  const firstClear=state.winner==="ally"&&!campaignProgress.completed[activeMissionId];
  const beforeCampaign=JSON.parse(JSON.stringify(campaignProgress));
  const beforeWallet=progress.saveVersion===3?JSON.parse(JSON.stringify(progress)):null;
  const result=CampaignCore.recordResult(campaignProgress,activeMissionId,state);
  if(state.winner==="ally"){
   if(progress.saveVersion===3)
    lastMissionFarmReward=ProgressCore.grantRepeatFarm(progress,activeMissionId);
   if(firstClear){
    lastMissionReward=ProgressCore.claimFirstClear(progress,activeMissionId,state);
    if(progress.saveVersion===3&&typeof HeroCollectionCore!=="undefined")
     lastUnlockedHeroId=HeroCollectionCore.grant(progress,activeMissionId);
   }
  }else if(state.winner==="enemy"&&progress.saveVersion===3&&
           campaignProgress.completed[activeMissionId]&&missionEntryPaid){
   lastMissionEnergyRefunded=ProgressCore.refundEnergy(progress,activeMissionId);
  }
  // Count a completed manual/auto campaign battle, not a simulation or arena.
  const dailyChanged=recordDailyTask("campaign-battle");
  const walletChanged=!!(lastMissionFarmReward||lastMissionReward||lastMissionEnergyRefunded||dailyChanged);
  const walletSaved=!walletChanged||persistProgress();
  if(!walletSaved&&beforeWallet){
   // Never publish mission completion without a persisted v3 payout.
   Object.keys(progress).forEach(key=>delete progress[key]);
   Object.assign(progress,beforeWallet);
   Object.assign(campaignProgress,beforeCampaign);
   lastMissionFarmReward=null;lastMissionReward=null;lastUnlockedHeroId=null;lastMissionEnergyRefunded=false;
   missionResultSaveFailed=true;
   renderAccountHeader();
  }
  lastMissionStars=result.earned;
  if(walletSaved&&result.improved)
   campaignSaveAvailable=CampaignCore.save(campaignProgress,()=>window.localStorage);
  missionResultRecorded=true;
 }
 if(battleIsWeekly&&!state.active&&!weeklyResultRecorded){
   weeklyResultRecorded=true;const terminalWeekly=state;
   void WeeklyThreatUI.finish(terminalWeekly).then(()=>{
    weeklyResultReady=true;
    if(battleIsWeekly&&state===terminalWeekly&&!isVisualTransition())syncBattleUI();
   }).catch(()=>{
    weeklyResultReady=true;
    if(battleIsWeekly&&state===terminalWeekly&&!isVisualTransition())syncBattleUI();
   });
  }
  if(battleIsNetwork&&!state.active&&!networkResultRecorded){
  networkResultRecorded=true;
  const terminalBattle=state;
  void networkPilot.complete(terminalBattle).then(()=>{
   networkResultReady=true;
   if(battleIsNetwork&&state===terminalBattle&&!isVisualTransition())syncBattleUI();
  }).catch(()=>{
   networkResultReady=true;
   if(battleIsNetwork&&state===terminalBattle&&!isVisualTransition())syncBattleUI();
  });
 }
 if(battleIsSignal&&!state.active&&!signalResultRecorded){
  const pending=signalProgress.active;
  const result=pending&&!signalCaptureFailed&&signalBattleTracker&&
   SignalOperationCore.battleEnded(pending,signalBattleRunId,state,signalBattleTracker);
  if(!result||!commitSignalOperation(result))
   signalNotice="Результат не записан: проверь сохранение и повтори бой с контрольной точки.";
  signalResultRecorded=true;
 }
 if(battleIsOperation&&!state.active&&!operationResultRecorded){
  const pending=operationProgress.active;
  const ended=pending&&OperationCore.battleEnded(pending,operationBattleRunId,state);
  if(!ended||!commitOperation(ended))
   operationNotice="Результат боя не сохранён. План остался на контрольной точке: повтори бой после проверки хранилища.";
  operationResultRecorded=true;
 }
 if(battleIsChallenge&&!state.active&&!challengeResultRecorded){
  // A fully resolved challenge counts as participation even on defeat.
  // Cancel the daily change if its v3 save is rejected.
  const beforeDaily=JSON.stringify(progress);
  const def=ChallengeCore.get(activeChallengeId);
  const task=def?.kind==="tactical"?"tactical-participation":"onslaught-participation";
  if(def&&recordDailyTask(task)&&!persistProgress()){
   Object.keys(progress).forEach(key=>delete progress[key]);
   Object.assign(progress,JSON.parse(beforeDaily));
  }
  const outcome=battleIsNpcChallengePilot?
   ChallengeCore.resultEarned(challengeProgress,activeChallengeId,
    NpcChallengePilot.score(activeChallengeId,state,challengeTracker)):
   ChallengeCore.result(challengeProgress,activeChallengeId,state,challengeTracker);
  challengeLastStars=outcome?.earned||0;
  if(challengeSaveBlocked||!challengeSaveAvailable||!outcome)challengeSaveFailed=true;
  else if(outcome.improved){
   if(ChallengeCore.save(outcome.candidate,()=>window.localStorage,challengeSaveBlocked))
    challengeProgress=outcome.candidate;
   else challengeSaveFailed=true;
  }
  challengeResultRecorded=true;
 }
 if(battleIsStoryDemo&&!state.active&&!missionResultRecorded){
  StoryDemoCore.finishBattle(storyDemoState,state.winner==="ally");
  missionResultRecorded=true;
 }
 if(battleIsFirstPlay&&!state.active&&!missionResultRecorded){
  firstPlayFinish(state.winner==="ally");
  missionResultRecorded=true;
 }
 if(isVisualTransition()){
  const transitionStatus=$("#battleStatus");
  if(transitionStatus)transitionStatus.textContent=visualTransition==="wave"?"Завершение волны":"Завершение боя";
  $("#specialAbilityBtn")?.classList.remove("fp-recommended");
  const transitionHint=$("#actionHint");
  if(transitionHint){transitionHint.hidden=true;transitionHint.textContent="";}
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
  $("#battleMessage").textContent=npcBattleMessage();
  renderBattleLog();
  renderTurnQueue();
  renderActiveHero(null);
  renderArenaIndicators();
  updateMeshes();
  return;
 }
 if(battleIsWeekly&&!state.active&&weeklyResultReady&&!missionResultShown){
   missionResultShown=true;showScreen("network");return;
  }
  if(battleIsNetwork&&!state.active&&networkResultReady&&!missionResultShown){
  missionResultShown=true;
  showScreen("network");
  return;
 }
 if(battleIsSignal&&!state.active&&!missionResultShown){
  missionResultShown=true;
  showScreen(signalProgress.active?.phase==="final"?"signalOperations":
   signalProgress.active?.phase==="battle"?"signalOperations":"signalOperationResult");
  return;
 }
 if(battleIsOperation&&!state.active&&!missionResultShown){
  missionResultShown=true;
  showScreen(operationProgress.active?.phase==="final"?"operations":
   operationProgress.active?.phase==="battle"?"operations":"operationResult");
  return;
 }
 if(battleIsChallenge&&!state.active&&!missionResultShown){
  missionResultShown=true;
  renderChallengeResult();
  showScreen("challengeResult");
  return;
 }
 if(battleIsLoreRequired&&!state.active&&!missionResultShown){
  missionResultShown=true;
  loreRequiredResult=state.winner==="ally"&&loreRequiredContext?
   LoreCampaignUI.recordBattleVictory(loreRequiredContext.nodeId,loreRequiredContext.battleId):
   {ok:false,code:"DEFEAT"};
  showScreen("loreRequiredBattleResult");return;
 }
 if(battleIsLoreTraining&&!state.active&&!missionResultShown){
  missionResultShown=true;showScreen("loreTrainingResult");return;
 }
 if(battleIsStoryDemo&&!state.active&&!missionResultShown){
  missionResultShown=true;
  showScreen("storyDemo");
  return;
 }
 if(battleIsFirstPlay&&!state.active&&!missionResultShown){
  missionResultShown=true;showScreen("firstPlay");return;
 }
 if(battleIsMainCampaign&&!state.active&&!missionResultShown){
   missionResultShown=true;showScreen("mainCampaignResult");return;
  }
  if(battleIsCampaign&&!state.active&&!missionResultShown){
  missionResultShown=true;
  renderMissionResult();
  showScreen("missionResult");
 }
 const reward=$("#battleReward");
 if(reward){
  reward.hidden=state.active;
  if(!state.active)reward.textContent=state.winner==="ally"?
   (lastMissionFarmReward?"Победа: +"+lastMissionFarmReward.currency+" кромов · материалы G начислены"+
      (lastMissionReward?" · бонус первой победы +"+lastMissionReward.currency+" кромов":""):
    battleIsCampaign&&lastMissionReward?"Первая победа: +"+lastMissionReward.xp+" XP · +"+lastMissionReward.currency+" кромов · +"+lastMissionReward.material+" C":"Победа · без экономических наград"):
   "Поражение · без наград"+(lastMissionEnergyRefunded?" · энергия возвращена":"");
 }
 const fighters=state.fighters;
 const actor=state.active?fighters[state.currentActor]:null;
 const visualBusy=visualActionPending();
 const specialReady=CombatCore.abilityReady(state,"special");
 const powerful=actor?AbilityData.get(actor,"powerful"):null;
 const powerfulReady=!!powerful&&CombatCore.abilityReady(state,"powerful");
 if(!specialReady)selectedAbility="basic";
 const supportTarget=!!actor&&selectedAbility==="special"&&CombatCore.abilityTargetSide(state,"special")==="ally";
 const needsOtherAlly=supportTarget&&["insurance","signal"].includes(AbilityData.get(actor,"special")?.kind);
 const targetIndex=supportTarget?state.selectedAlly:state.selectedEnemy;
 const target=state.active?fighters[targetIndex]:null;
 const validTarget=!!target&&target.hp>0&&target.side===(supportTarget?"ally":"enemy")&&
  !(needsOtherAlly&&target.id===actor.id);
 // ARENA-UI-003: no service text on screen. Status stays for screen readers.
 const status=$("#battleStatus");
 if(status)status.textContent=actor?"Ход: "+actor.name:"Бой завершён";
 const basicButton=$("#basicAbilityBtn"),specialButton=$("#specialAbilityBtn");
 basicButton.disabled=!actor||autoBattle||visualBusy;
 specialButton.disabled=!specialReady||autoBattle||visualBusy;
 const powerfulSlot=$("#powerfulAbilitySlot");
 if(powerfulSlot)powerfulSlot.hidden=!powerful;
 $("#abilityOptions")?.classList.toggle("has-powerful",!!powerful);
 const powerfulButton=$("#powerfulAbilityBtn");
 if(powerfulButton)powerfulButton.disabled=!powerfulReady||autoBattle||visualBusy;
 const autoButton=$("#autoBattleBtn");
 if(autoButton){
  autoButton.hidden=false;
  autoButton.disabled=!state.active;
  autoButton.textContent=autoBattle?"Ручной бой":"Автобой";
  autoButton.setAttribute("aria-pressed",String(autoBattle));
 }
 const speedButton=$("#autoSpeedBtn");
 if(speedButton){speedButton.disabled=!state.active;speedButton.textContent=BattleSpeed.get()+"×";speedButton.setAttribute("aria-label","Скорость боя "+BattleSpeed.get()+"×. Нажми, чтобы изменить");}
 // ready: can be pressed; wait: the previous action is still on screen;
 // cooldown / locked: unavailable now (dimmed); auto: autoplay owns the turn.
 const slotState=(ready,cooldown)=>!actor?"locked":autoBattle?"auto":visualBusy&&ready?"wait":
  ready?"ready":cooldown>0?"cooldown":"locked";
 renderAbilityButton(basicButton,actor,"basic",actor?AbilityData.get(actor,"basic"):null,0,slotState(!!actor,0));
 renderAbilityButton(specialButton,actor,"special",actor?AbilityData.get(actor,"special"):null,
  actor?.specialCooldown||0,slotState(specialReady,actor?.specialCooldown||0));
 if(powerfulButton)renderAbilityButton(powerfulButton,actor,"powerful",powerful,
  actor?.powerfulCooldown||0,slotState(powerfulReady,actor?.powerfulCooldown||0));
 basicButton.classList.toggle("selected",false);
 specialButton.classList.toggle("selected",supportTarget);
 // A hint appears only when the next tap is not the obvious "tap an enemy".
 let hintText=autoBattle?"Автобой. Нажми «Ручной бой», чтобы управлять.":
  supportTarget?(needsOtherAlly?"Коснись другого союзника: себя выбрать нельзя.":"Коснись союзника, чтобы применить способность."):
  actor&&!visualBusy&&CombatCore.abilityTargetSide(state,"special")==="all-enemies"?"Курсор отмечает основную цель. Учебный широкий удар поражает всех живых врагов.":
  actor&&!visualBusy&&!validTarget?"Коснись противника, чтобы выбрать цель.":"";
 const teaching=!!(battleIsFirstPlay&&actor&&!autoBattle&&!visualBusy&&!firstPlayTaughtActors.has(actor.id));
 const recommend=teaching&&specialReady&&["art","ren"].includes(actor.id);
 specialButton.classList.toggle("fp-recommended",!!recommend&&!supportTarget);
 if(teaching){
  if(supportTarget)hintText="Коснитесь Рена: Арт примет часть урона за Рена. Повторный тап по способности — отмена.";
  else if(recommend&&actor.id==="art")hintText="Выберите способность. Страховочный узел поможет защитить Рена.";
  else if(recommend&&actor.id==="ren")hintText="Выберите способность. Найти брешь — ослабить атаки врага.";
  else hintText=validTarget?"Выберите способность.":"Коснитесь противника, чтобы выбрать цель.";
 }
 const hint=$("#actionHint");
 if(hint){if(hint.textContent!==hintText)hint.textContent=hintText;hint.hidden=!hintText;}
 renderActiveHero(actor);
 renderTurnQueue();
 const retry=$("#battleRetryBtn");if(retry)retry.hidden=!!state.active;
 $("#abilityControls")?.classList.toggle("battle-finished",!state.active);
 $("#battleMessage").textContent=npcBattleMessage();
 renderBattleLog();
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
  // HUDSYNC001: bars show the value as of the last drawn blow; CombatCore is ahead of them.
  const view=BattleAnimation.displayed(h);
  const health=Math.min(100,Math.max(0,view.hp/Math.max(1,h.maxHp)*100));
  const initiative=Math.min(100,Math.max(0,(h.meter||0)/10));
  const protectionPercent=Math.min(100,Math.max(0,
    (view.protection||0)/Math.max(1,h.maxProtection||0)*100));
  const protectionLine=Number.isFinite(h.maxProtection)&&h.maxProtection>0?
    `<div class="arena-protection" title="Protection ${view.protection} / ${h.maxProtection}"><span style="width:${protectionPercent}%"></span></div>`:"";
  const effects=[h.guardHits>0?`<span class="arena-effect" title="Защита: ${h.guardHits} ударов">◆${h.guardHits}</span>`:"",
   h.weakenAttacks>0?`<span class="arena-effect debuff" title="Ослабление: ${h.weakenAttacks} атак">↓${h.weakenAttacks}</span>`:"",
   typeof CombatStatusCore!=="undefined"&&CombatStatusCore.read(h,"slowed")?
     `<span class="arena-effect debuff" title="Замедление">⇣${CombatStatusCore.read(h,"slowed").remaining}</span>`:"",
   typeof CombatStatusCore!=="undefined"&&CombatStatusCore.read(h,"debuff-resistance-down")?
     `<span class="arena-effect debuff" title="Пониженное сопротивление: −${CombatStatusCore.read(h,"debuff-resistance-down").amount} п.п.">⊖${CombatStatusCore.read(h,"debuff-resistance-down").remaining}</span>`:"",
   typeof CombatStatusCore!=="undefined"&&CombatStatusCore.read(h,"read-move")?
     `<span class="arena-effect debuff" title="Просчитанный ход: ${CombatStatusCore.read(h,"read-move").stacks} из 4 зацепок, ${CombatStatusCore.read(h,"read-move").remaining} ход(а). При 3+ сильная атака теряет 20 п.п. точности, 20 п.п. эффективности наложения эффектов и 30% урона; тратятся 3 зацепки.">◎${CombatStatusCore.read(h,"read-move").stacks}</span>`:"",
   typeof CombatStatusCore!=="undefined"&&CombatStatusCore.read(h,"taunt")?
     `<span class="arena-effect" title="Провокация: одиночные враги атакуют этого героя. Осталось ${CombatStatusCore.read(h,"taunt").remaining} хода(ов).">⚑${CombatStatusCore.read(h,"taunt").remaining}</span>`:"",
   typeof CombatStatusCore!=="undefined"&&CombatStatusCore.read(h,"disrupted-plan")?
     `<span class="arena-effect debuff" title="Срыв ритма: следующая особая/мощная способность потеряет продолжение.">✕${CombatStatusCore.read(h,"disrupted-plan").remaining}</span>`:"",
   h.insurance?`<span class="arena-effect" title="Страховка Арта: часть прямого HP-урона получит Арт.">⛓${h.insurance.remaining}</span>`:"",
   h.fieldSignal?`<span class="arena-effect" title="Сигнал Савы: ускорен ближайший ход.">⚑${h.fieldSignal.remaining}</span>`:"",
   h.tacticalFocus?`<span class="arena-effect" title="Собранность Арта: ответ по нападавшему.">✦</span>`:""].join("");
  const actor=state.active&&!isVisualTransition()?state.fighters[state.currentActor]:null;
  const active=actor?.id===h.id;
  const support=!!actor&&!autoBattle&&selectedAbility==="special"&&CombatCore.abilityTargetSide(state,"special")==="ally";
  // A group ability does not change focus on turn start: exactly one
  // primary enemy remains selected until the player taps a different one.
  const onlyOther=support&&["insurance","signal"].includes(AbilityData.get(actor,"special")?.kind);
  const npcMark=npcCombatMarker(h);
  const focused=!!actor&&!autoBattle&&h.hp>0&&(support?
   h.side==="ally"&&(!onlyOther||h.id!==actor.id):
   h.side==="enemy"&&state.fighters[state.selectedEnemy]?.id===h.id);
  // ARENA-UI-003B: the name only over the acting hero and the selected target;
  // everyone else shows bars and effect icons. A battle-intel mark stays as an icon.
  const targeted=!!actor&&h.hp>0&&!support&&h.side==="enemy"&&state.fighters[state.selectedEnemy]?.id===h.id;
  const named=active||targeted||(battleIsFirstPlay&&support&&focused&&h.id==="ren");
  // The band reserved for an enemy target's hanging name; the name is capped to
  // it (ellipsis), so a wider system font can never spill over a neighbour.
  const nameW=Math.min(150,Math.round(h.name.length*7+10));
  const markClass=npcMark==="first"||npcMark==="signal"?"must-first":npcMark==="hunter"?"assault-hunter":"";
  const markIcon=!named&&markClass?`<span class="arena-effect mark ${markClass}" title="${NpcBattleIntel.markerLabel(npcMark)}">${markClass==="must-first"?"①":"!"}</span>`:"";
  return `<div class="arena-indicator ${h.side} ${active?"acting":""} ${targeted?"targeted":""} ${named?"named":""} ${markClass}" data-fighter-id="${h.id}"${named&&h.side==="enemy"?` data-name-w="${nameW}"`:""} aria-label="${h.name}${npcMark?", "+NpcBattleIntel.markerLabel(npcMark):""}: здоровье ${Math.max(0,view.hp)} из ${h.maxHp}, инициатива ${Math.round(h.meter||0)} из 1000">
   ${focused?`<div class="arena-focus-cursor ${support?"available":"locked"}" aria-hidden="true">▼</div>`:""}
   ${named?`<div class="arena-indicator-name"${h.side==="enemy"?` style="max-width:${nameW}px"`:""}>${h.name}</div>`:""}
   ${protectionLine}
   <div class="arena-health" title="HP ${Math.max(0,view.hp)} / ${h.maxHp}"><span style="width:${health}%"></span></div>
   <div class="arena-initiative" title="Инициатива ${Math.round(h.meter||0)} / 1000"><span style="width:${initiative}%"></span></div>
   ${effects||markIcon?`<div class="arena-effects">${markIcon}${effects}</div>`:""}
  </div>`;
 }).join("");
 indicatorNodes={};
 if(arenaHudLayout)arenaHudLayout.begin();
 if(typeof overlay.querySelectorAll==="function")for(const node of overlay.querySelectorAll(".arena-indicator"))
  indicatorNodes[node.dataset.fighterId]=node;
 positionArenaIndicators();
}
// MOBILEQA001 / ARENA-UI-003: fixed HUD zones the world labels must not hide under.
function arenaHudObstacles(){
 return document.querySelectorAll?.(
  "#battleMenuBtn, #battleMenu, #battle .arena-utility, #renModelBattleStatus, #turnQueueBar, #battleChallengeGoal, #tacticalGoalCard, #activeHero, #autoBattleBtn, #autoSpeedBtn, #actionHint, #battle .ability-options")||[];
}
// Projection is presentation-only. Babylon pointer picking stays on the canvas.
function positionArenaIndicators(){
 if(!scene||!engine||!arenaCamera||!BABYLON.Vector3?.Project||
    typeof scene.getTransformMatrix!=="function"||typeof engine.getRenderWidth!=="function")return;
 const width=engine.getRenderWidth(),height=engine.getRenderHeight();
 const overlay=$("#arenaIndicators");
 if(!width||!height||!overlay||!arenaCamera.viewport?.toGlobal)return;
 // Render pixels can differ from CSS pixels on retina/HiDPI iPhones.
 // Avoid per-frame DOM reads: the ported observer caches overlay CSS dimensions.
 // Legacy measurements remain only as a compatibility fallback for old fixtures.
 if(!arenaHudLayout && typeof ArenaWorldHud!=="undefined"){
  arenaHudLayout=new ArenaWorldHud.Layout(overlay);
  // MOBILEQA001: keep health/initiative indicators clear of fixed HUD controls.
  arenaHudLayout.avoid?.(arenaHudObstacles());
 }
 const cssWidth=arenaHudLayout?arenaHudLayout.width:(overlay.clientWidth||width);
 const cssHeight=arenaHudLayout?arenaHudLayout.height:(overlay.clientHeight||height);
 if(!cssWidth||!cssHeight)return;
 if(arenaHudLayout)arenaHudLayout.begin();
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
  const away=!!mesh.av003Away;
  if(node.dataset&&(node.dataset.away==="1")!==away){node.dataset.away=away?"1":"0";node.classList?.toggle("away",away);}
  if(visible){
   const ax=screen.x*cssWidth/width,ay=screen.y*cssHeight/height;
   node.style.left=ax+"px";node.style.top=ay+"px";
   if(arenaHudLayout)arenaHudLayout.track(id,node,ax,ay,away);
  }
 }
 if(arenaHudLayout)arenaHudLayout.place();
}
function resetBattle(){
 firstPlayTaughtActors.clear();
 // ARENA-UI-003: owner ability art is listed once per session; redraw on arrival.
 if(typeof ArenaUI003!=="undefined"&&typeof fetch==="function")
  void ArenaUI003.loadManifest().then(found=>{
   if(!found)return;
   for(const id of ["basicAbilityBtn","specialAbilityBtn","powerfulAbilityBtn"]){const b=$("#"+id);if(b?.dataset)b.dataset.face="";}
   if(state?.active&&$("#battle")?.classList?.contains("active"))syncBattleUI();
  });
 closeFighterInspection();hideAbilityTooltip();closeBattleMenu();
 cancelAutoTimer();
 cancelVisualTransition();
 BattleAnimation.clear();
 combatVisual007?.clear();
 arenaFeedback?.clear(arenaCamera);
 clearEncounterNpcVisuals();
 autoBattle=false;
 // Keep the chosen speed between battles; only autoplay resets.
 missionResultShown=false;
 missionResultRecorded=false;
 challengeResultRecorded=false;
 operationResultRecorded=false;
 signalResultRecorded=false;
 networkResultRecorded=false;
 networkResultReady=false;
 weeklyResultRecorded=false;weeklyResultReady=false;
 signalCaptureFailed=false;
 signalBattleTracker=battleIsSignal?SignalOperationCore.startTracker(signalProgress.active):null;
 challengeLastStars=0;
 challengeSaveFailed=false;
 challengeTracker=battleIsChallenge?ChallengeCore.start(activeChallengeId,
  battleIsNpcChallengePilot?NpcChallengePilot.trackerTargets(activeChallengeId):null):null;
 lastMissionStars=0;
 selectedAbility="basic";
 if(battleIsWeekly){
   const snap=weeklySession?.read();
   const launched=snap&&WeeklyThreatCore.startBattle(snap,selectedParty(),CombatCore,squadSlots()[0]);
   if(!launched)throw Error("NET008A_WEEKLY_CHECKPOINT_INVALID");
   state=launched.battle;ensureEncounterNpcVisuals(launched.plan.first);
   CombatCore.advanceToPlayerTurn(state);syncBattleUI();return;
  }
  if(battleIsNetwork){
  const active=networkPilot?.read();
  const launched=active&&NetworkEncounterAdapter.startBattle(active,selectedParty(),
   {combat:CombatCore,leaderId:squadSlots()[0]});
  if(!launched)throw Error("NET004_ENCOUNTER_CHECKPOINT_INVALID");
  state=launched.battle;
  ensureEncounterNpcVisuals(launched.plan.first);
  CombatCore.advanceToPlayerTurn(state);
  syncBattleUI();
  return;
 }
 const lineup=battleLineup();
 const waves=battleFutureWaves();
 const allies=lineup.filter(f=>f.side==="ally");
 const realHeroFight=allies.length>0&&
  allies.every(f=>["ren","nada","liora","art","sava"].includes(f.id));
 state=CombatCore.createBattle(lineup,waves,{
  leaderId:storyTrialParty&&battleIsStoryDemo?null:selectedLeaderId,
  ...(battleIsFirstPlay?{leaderId:null,tacticalObjective:{
   kind:"hold-or-defeat",protectAllyId:"ren",allyActionsToHold:6
  }}:{}),
  ...(storyTrialParty&&battleIsStoryDemo?StoryTrialData.statusPilot:{}),
  ...(battleIsLoreRequired&&loreRequiredContext?.battleObjective?
   {tacticalObjective:NpcStoryOpsAdapter.storyObjective(loreRequiredContext.nodeId,loreRequiredContext.battleObjective)}:{}),
  ...(battleIsNpcChallengePilot&&activeChallengeId==="T-04"?
   {tacticalObjective:NpcChallengePilot.tacticalObjective(activeChallengeId,allies)}:{}),
  // RNG combat formulas are active only for parties of the two real heroes.
  // Mannequin-based demos preserve their historical combat behavior.
  ...(realHeroFight?{
   rngSeed:Date.now()>>>0,hitChecks:true,critChecks:true,
   penetrationChecks:true,statusChecks:true
  }:{})
 });
 ensureEncounterNpcVisuals([...lineup,...waves.flat()]);
 CombatCore.advanceToPlayerTurn(state);
 syncBattleUI();
}
// Combat-009: instant offensive abilities; allied skills wait for an ally tap.
function applyManualAbility(abilityId){
 if(autoBattle||isVisualTransition()||visualActionPending()||!CombatCore.abilityReady(state,abilityId))return false;
 const side=CombatCore.abilityTargetSide(state,abilityId);
 const targets=CombatCore.abilityTargetIndices(state,side);
 if(!targets.length)return false;
 // Group/self actions need no manual target tap; CombatCore resolves all
 // recipients atomically. Single-target behavior stays unchanged.
 if(side!=="enemy"&&side!=="ally"&&side!=="self"&&side!=="all-enemies"&&side!=="all-allies")return false;
 const before=state.fighters.map(f=>({...f}));
 const tutorialActor=state.fighters[state.currentActor]?.id;
 if(!CombatCore.performPlayerAbility(state,abilityId))return false;
 if(battleIsFirstPlay&&tutorialActor)firstPlayTaughtActors.add(tutorialActor);
 captureResolvedVisuals(before);
 selectedAbility="basic";
 hideAbilityTooltip();
 syncBattleUI();
 return true;
}
function pressAbility(abilityId){
 if(abilityHintSuppressClick===abilityId){abilityHintSuppressClick=null;return;}
 hideAbilityTooltip();
 if(!state.active||autoBattle||isVisualTransition()||visualActionPending()||!CombatCore.abilityReady(state,abilityId))return;
 if(CombatCore.abilityTargetSide(state,abilityId)==="ally"){
  selectedAbility=battleIsFirstPlay&&selectedAbility==="special"?"basic":"special";
  syncBattleUI();
 }else{
  selectedAbility="basic";
  applyManualAbility(abilityId);
 }
}
$("#basicAbilityBtn").addEventListener("click",()=>pressAbility("basic"));
$("#specialAbilityBtn").addEventListener("click",()=>pressAbility("special"));
$("#powerfulAbilityBtn")?.addEventListener("click",()=>pressAbility("powerful"));
$("#battleRetryBtn").addEventListener("click",()=>{
 if(!state.active&&!isVisualTransition())openSquad(battleIsMainCampaign?"mainCampaign":battleIsLoreRequired?"loreRequired":battleIsLoreTraining?"loreTraining":battleIsSignal?"signalOperations":battleIsOperation?"operations":battleIsChallenge?"challenges":"home");
});
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
  if(definition.fieldNote)effects.push(definition.fieldNote);
  if(definition.onHitStatus?.type==="read-move")
   effects.push("При попадании +"+definition.onHitStatus.stacks+
    " зацепок «Просчитанного хода» (максимум 4, срок 2 собственных хода врага). "+
    "При 3+ зацепках мощная/особая атака сохраняется, но её точность и эффективность наложения эффектов снижаются на 20 п.п., а урон на 30% (−3 зацепки).");
 }else if(definition.kind==="guard")
  effects.push("Защита от "+definition.guardHits+" ударов.");
 if(Number.isSafeInteger(definition.tauntTurns))effects.push("Провокация на "+definition.tauntTurns+" последующих собственных хода: одиночные вражеские атаки направляются только на героя.");
 else if(definition.kind==="heal")
  effects.push("Восстанавливает до "+definition.healAmount+" HP.");
 effects.push("Цель: "+({ally:"союзник",enemy:"противник",self:"сам герой","all-allies":"все живые союзники","all-enemies":"все живые противники"}[definition.target]||"неизвестная")+".");
 if(definition.kind==="insurance")effects.push("Страховка: Арт принимает "+definition.insurancePercent+"% первого реального HP-урона другого союзника после обычной защиты. Не массовый щит.");
 if(definition.kind==="signal")effects.push("Сигнал: выбранный союзник получает +"+definition.signalMeter+" инициативы, без дополнительного хода.");
 if(definition.kind==="coordinate")effects.push("Согласованный шаг: две атаки разных героев по одному врагу; на развитых уровнях также связка защита → действие защищённого.");
 if(definition.disruptTurns)effects.push("Срыв ритма: противник теряет вторичное действие следующей особой/мощной способности. Зацепки Нады остаются.");
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
 // ARENA-ART-004G: the same portrait as the turn queue and the acting-hero card.
 const portrait=$("#inspectPortrait");
 if(portrait&&portrait.dataset?.fighterId!==fighter.id){
  portrait.dataset.fighterId=fighter.id;
  const src=typeof ArenaUI003!=="undefined"?ArenaUI003.portrait(fighter):null;
  portrait.classList?.toggle("enemy",fighter.side!=="ally");
  portrait.innerHTML=src?`<img src="${src}" alt="" draggable="false">`:
   `<span>${typeof ArenaUI003!=="undefined"?ArenaUI003.initials(fighter.name):""}</span>`;
 }
 const npcRole=typeof NpcBattleIntel!=="undefined"?NpcBattleIntel.role(fighter):null;
 const mark=npcCombatMarker(fighter);
 $("#inspectRole").textContent=(npcRole||fighter.role)+
  (Number.isInteger(fighter.level)?" · Уровень "+fighter.level:"")+
  (mark?" · "+NpcBattleIntel.markerLabel(mark):"");
 $("#inspectStats").textContent="Здоровье: "+BattleAnimation.displayed(fighter).hp+" / "+fighter.maxHp+
  " · Атака: "+fighter.atk+
  (Number.isFinite(fighter.physicalAttack)?" · Физ. атака: "+fighter.physicalAttack:"")+
  (Number.isFinite(fighter.physicalDefense)?" · Физ. оборона: "+fighter.physicalDefense:"")+
  (Number.isFinite(fighter.magicDefense)?" · Маг. оборона: "+fighter.magicDefense:"")+
  (Number.isFinite(fighter.maxProtection)?" · Protection: "+fighter.protection+"/"+fighter.maxProtection:"")+
  " · Скорость: "+fighter.speed+
  " · Инициатива: "+Math.round(fighter.meter)+" / 1000"+
  (fighter.side==="ally"?" · Перезарядка: "+fighter.specialCooldown:"");
 const effects=[];
 if(fighter.guardHits>0)effects.push("Защита: "+fighter.guardHits+" удар.");
 if(fighter.weakenAttacks>0)effects.push("Ослабление: "+fighter.weakenAttacks+" атак.");
 if(typeof CombatStatusCore!=="undefined"){
  const slowed=CombatStatusCore.read(fighter,"slowed");
  if(slowed)effects.push("Замедление: -"+slowed.amount+"% скорости, "+slowed.remaining+" ход(а)");
  const resistance=CombatStatusCore.read(fighter,"debuff-resistance-down");
  if(resistance)effects.push("Пониженное сопротивление: -"+resistance.amount+" п.п., "+resistance.remaining+" ход(а)");
  const taunt=CombatStatusCore.read(fighter,"taunt");
  if(taunt)effects.push("Провокация: враги выбирают героя целью одиночной атаки, осталось "+taunt.remaining+" ход(а).");
  const readMove=CombatStatusCore.read(fighter,"read-move");
  if(readMove)effects.push("Просчитанный ход: "+readMove.stacks+"/4 зацепки, "+readMove.remaining+
   " ход(а). При 3+ особая/мощная атака сохраняется, но имеет −20 п.п. точности, −20 п.п. эффективности наложения эффектов и −30% урона (−3 зацепки).");
 }
 $("#inspectEffects").textContent=effects.length?effects.join(" · "):"Активных эффектов нет";
 const npcAbilities=$("#inspectNpcAbilities");
 if(npcAbilities){
  const lines=typeof NpcBattleIntel!=="undefined"?NpcBattleIntel.abilities(fighter):[];
  npcAbilities.hidden=!lines.length;
  if(lines.length&&fighter.archetypeId&&typeof AbilityIconCore!=="undefined"&&
     typeof document.createElement==="function"&&typeof npcAbilities.replaceChildren==="function"){
   npcAbilities.replaceChildren();
   const title=document.createElement("strong");title.textContent="СПОСОБНОСТИ";npcAbilities.append(title);
   for(const [i,line] of lines.entries()){
    const slot=["basic","special","powerful","passive"][i];
    const row=document.createElement("div");row.className="npc-ability-row";
    const icon=AbilityIconCore.element(fighter,slot,"npc-ability-thumb");if(icon)row.append(icon);
    const description=document.createElement("span");description.textContent=line;row.append(description);
    npcAbilities.append(row);
   }
  }else npcAbilities.textContent=lines.length?"СПОСОБНОСТИ\n"+lines.join("\n"):"";
 }
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
 // A first-play target tap must not resolve a support skill on the caster.
 if(battleIsFirstPlay&&side==="ally"&&state.fighters[index].id===state.fighters[state.currentActor]?.id)return false;
 const picked=side==="ally"?CombatCore.chooseAlly(state,index):CombatCore.chooseEnemy(state,index);
 if(picked){
  if(side==="ally"&&selectedAbility==="special")applyManualAbility("special");
  else syncBattleUI();
 }
 return picked;
}
// ARENA-VIS-002: screen point (overlay CSS px) at a fighter's shoulders for floating numbers;
// the spark burst stays visible on the chest below the label.
function arenaFeedbackPoint(id){
 const mesh=meshes[id],overlay=$("#arenaFloaters");
 if(!mesh?.head?.position||!overlay||!scene||!engine||!arenaCamera?.viewport?.toGlobal||
    !BABYLON.Vector3?.Project||!BABYLON.Matrix?.Identity)return null;
 const width=engine.getRenderWidth(),height=engine.getRenderHeight();
 const cssWidth=arenaHudLayout?.width||overlay.clientWidth||width;
 const cssHeight=arenaHudLayout?.height||overlay.clientHeight||height;
 if(!width||!height||!cssWidth||!cssHeight)return null;
 const p=mesh.head.position;
 const screen=BABYLON.Vector3.Project(new BABYLON.Vector3(p.x,p.y-.3,p.z),BABYLON.Matrix.Identity(),
  scene.getTransformMatrix(),arenaCamera.viewport.toGlobal(width,height));
 if(!(screen.z>=0&&screen.z<=1))return null;
 const x=screen.x*cssWidth/width,y=screen.y*cssHeight/height;
 // Keep the label fully on screen (enemy line runs toward the right edge).
 return {x:Math.max(40,Math.min(cssWidth-40,x)),y:Math.max(56,Math.min(cssHeight-30,y))};
}
// Visible geometry of one fighter (GLB or capsule), never its ground shadow/ring.
function arenaFlashMeshes(id){
 const visual=meshes[id];
 if(!visual||!scene?.meshes)return [];
 const skip=new Set([visual.base,visual.base?.av001Ring]);
 return scene.meshes.filter(m=>m.metadata?.fighterId===id&&!skip.has(m)&&m.isVisible!==false&&
  (typeof m.isEnabled!=="function"||m.isEnabled())&&(typeof m.getTotalVertices!=="function"||m.getTotalVertices()>0));
}
// A single render callback and a single Engine/Scene for the lifetime of this prototype.
let hudDisplayRevision=0;
function renderBattleFrame(){
 if(!scene)return;
 // Animation speed is shared with the auto scheduler, never alters combat state.
 const dt=engine&&typeof engine.getDeltaTime==="function"?engine.getDeltaTime():16;
 if(arenaResolution&&ArenaVis001.adapt(engine,arenaResolution,dt))positionArenaIndicators();
 const hadPending=visualActionPending();
 // ARENA-VIS-002: hit-stop pauses the animation clock only; the frame still renders.
 const animationDt=arenaFeedback?arenaFeedback.animationDelta(dt):dt;
 BattleAnimation.tick(animationDt,BattleSpeed.multiplier());
 // ENV-006B background clock: real dt, not hit-stop or battle speed (see ARENA_ENV_006_PLAN).
 arenaEnv006?.tick(dt);
 // Consume hit markers regardless of whether optional visuals are available.
 const visualCues=BattleAnimation.drainStarted();
 const feedbackCues=BattleAnimation.drainFeedback();
 if(combatVisual007){
  combatVisual007.emit(visualCues,meshes);
  combatVisual007.tick(dt,BattleSpeed.multiplier());
 }
 if(arenaFeedback){
  arenaFeedback.handle(feedbackCues,{multiplier:BattleSpeed.multiplier(),
   project:arenaFeedbackPoint,meshesFor:arenaFlashMeshes});
  arenaFeedback.frame(dt,arenaCamera);
 }
 // Death animation may end without a new combat action. Retire stale
 // indicators immediately instead of waiting for the following turn.
 // HUDSYNC001: a blow or heal was just drawn — bars and the target panel may advance now.
 const landed=BattleAnimation.displayRevision()!==hudDisplayRevision;
 hudDisplayRevision=BattleAnimation.displayRevision();
 if(landed||Object.keys(indicatorNodes).some(id=>{
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
  const origin=formationPosition(h.side,slot,team.length);
  const activity=BattleAnimation.activity(h.id);
  const target=roster.find(f=>f.id===activity.targetId&&f.side!==h.side);
  const opponents=target?sides[target.side]:null;
  const targetSlot=target?opponents.findIndex(f=>f.id===target.id):-1;
  const targetPosition=targetSlot>=0?formationPosition(target.side,targetSlot,opponents.length):null;
  // NADAANIM001: Nada is an archer — she shoots from her place, no melee lunge.
  const npcGlb=npcGlbRuntimes.get(h.id)||null;
  // ARENA-ART-004C: throws and casts of enemy models are rooted too.
  const rooted=h.id==="nada"||h.id==="sava"||(npcGlb?.isReady&&AnimationProfiles.resolve(h.id,activity.slot)?.rooted===true);
  const approach=rooted?{x:0,z:0}:BattleAnimation.approach(activity,origin,targetPosition);
  const offset=pose.x*(h.side==="ally"?1:-1);
  // ARENA-UI-003B: a fighter who ran out to strike hides its label until back home.
  visual.av003Away=Math.hypot(approach.x||0,approach.z||0)>.45;
  visual.body.position.x=visual.head.position.x=visual.base.position.x=origin.x+offset+approach.x;
  visual.body.position.z=visual.head.position.z=visual.base.position.z=origin.z+approach.z;
  visual.body.position.y=.8+pose.y;
  visual.head.position.y=1.8+pose.y;
  if(visual.body.rotation)visual.body.rotation.z=pose.tilt;
  if(visual.head.rotation)visual.head.rotation.z=pose.tilt;
  // MOBILEQA001: GLB heroes rest three-quarter to the camera, facing the enemy lane.
  if((h.id==="ren"&&renGlbRuntime)||(h.id==="nada"&&nadaGlbRuntime)||(h.id==="liora"&&lioraGlbRuntime)||(h.id==="sava"&&savaGlbRuntime)||(h.id==="art"&&artGlbRuntime)||npcGlb?.isReady){
   const nadaAim=(h.id==="nada"||h.id==="sava"||!!npcGlb)&&targetPosition&&["basic","special","powerful"].includes(activity.slot);
   if(nadaAim&&visual.body.rotation){
    // NADAANIM001: turn toward the target while shooting, same smoothing as the rest pose.
    const aim=-Math.atan2(targetPosition.z-origin.z,targetPosition.x-origin.x),cur=visual.body.rotation.y||0;
    visual.body.rotation.y=cur+Math.atan2(Math.sin(aim-cur),Math.cos(aim-cur))*.25;
   }else if(visual.body.rotation&&!(h.id==="ren"&&targetPosition&&activity.plan)&&typeof ArenaStageView!=="undefined"&&ArenaStageView.idleYaw){
    // ARENA-ART-004D: enemy-model stance is side-on; turn it toward the camera at rest.
    const rest=ArenaStageView.idleYaw(h.side)+(npcGlb?.isReady?NpcGlbRuntime.STANCE_YAW?.[h.side]||0:0),cur=visual.body.rotation.y||0;
    const diff=Math.atan2(Math.sin(rest-cur),Math.cos(rest-cur));
    visual.body.rotation.y=Math.abs(diff)<.002?rest:cur+diff*.18;
    if(h.id==="ren")visual.renPlan=null;
   }
  }
  if(h.id==="nada"&&nadaGlbRuntime)nadaGlbRuntime.update(activity);
  if(h.id==="liora"&&lioraGlbRuntime)lioraGlbRuntime.update(activity);
  if(h.id==="sava"&&savaGlbRuntime)savaGlbRuntime.update(activity);
  if(h.id==="art"&&artGlbRuntime)artGlbRuntime.update(activity);
  if(npcGlb)npcGlb.update(activity);
  if(h.id==="ren"&&renGlbRuntime){
   if(visual.body.rotation&&targetPosition&&activity.plan){
    const yaw=-Math.atan2(targetPosition.z-origin.z,targetPosition.x-origin.x);
    if(visual.renPlan!==activity.plan){visual.renPlan=activity.plan;visual.renStartYaw=visual.body.rotation.y||0;}
    const turn=Math.atan2(Math.sin(yaw-visual.renStartYaw),Math.cos(yaw-visual.renStartYaw));
    const u=Math.min(1,activity.elapsedMs/120);
    // RENRETREAT001: pivot away to run back, then face the enemy again.
    const heading=typeof RenChoreography!=="undefined"?RenChoreography.sample(activity.plan,activity.elapsedMs).heading||0:0;
    visual.body.rotation.y=visual.renStartYaw+turn*u*u*(3-2*u)+heading;
   }
   renGlbRuntime.update(activity);
  }
 }
 positionArenaIndicators();
 // ARENA-UI-003B: numbers follow the labels placed in this very frame.
 arenaFeedback?.floaters?.relayout?.();
 scene.render();
 // Draw the last animation frame before revealing the next wave/result.
 finishVisualTransition();
 if(hadPending&&!visualActionPending()&&state.active&&!isVisualTransition())syncBattleUI();
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
 const center=new BABYLON.Vector3(0,ARENA_VIEW.targetY,0);
 if(typeof arenaCamera.setTarget==="function")arenaCamera.setTarget(center);
 else arenaCamera.target=center; // Minimal test stub.
 // Babylon setTarget recalculates spherical coordinates; restore approved angle LAST.
 arenaCamera.alpha=ARENA_VIEW.alpha;
 arenaCamera.beta=ARENA_VIEW.beta;
 arenaCamera.radius=ARENA_VIEW.radius;
 if(ARENA_VIEW.fov)arenaCamera.fov=ARENA_VIEW.fov;
}
// ENV010: fixed three-quarter battle view; retain pinch and wheel zoom only.
// One-finger movement remains available to the inspection/target gestures;
// it no longer rotates the scene or fights the curated background composition.
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
  const previous=pointers.get(event.pointerId??1);
  if(!previous)return;
  previous.x=event.clientX;previous.y=event.clientY;
  if(pointers.size!==2)return; // Single finger must not change yaw or tilt.
  const current=distance();
  if(pinchDistance>0&&current>0)
   camera.radius=bounds(camera.radius*pinchDistance/current,camera.lowerRadiusLimit,camera.upperRadiusLimit);
  pinchDistance=current;
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
// Only load the skinned GLB when Nada participates. No additional Engine
// or animation timer; the established arena frame loop drives it.
function ensureLiora3D(){
 if(!scene||!meshes.liora||typeof LioraGlbRuntime==="undefined")return;
 const selected=presentationFighters().some(f=>f.id==="liora"&&f.side==="ally");
 if(!selected){
  if(lioraGlbRuntime){lioraGlbRuntime.dispose();lioraGlbRuntime=null;}
  return;
 }
 if(lioraGlbRuntime)return;
 lioraGlbRuntime=LioraGlbRuntime.create(BABYLON,scene,meshes.liora,(kind,message)=>{
  const info=$("#renModelBattleStatus"),label=$("#renModelBattleStatusText");
  if(label)label.textContent=message;
  if(info){info.dataset.status=kind;info.hidden=false;}
  if(kind==="error")console.warn("LIORAPLAY001: "+message);
 });
}
// SAVA3D001: lazy actor-specific skinned rig, reuse shared Babylon Scene and frame loop.
function ensureSava3D(){
 if(!scene||!meshes.sava||typeof SavaGlbRuntime==="undefined")return;
 const selected=presentationFighters().some(f=>f.id==="sava"&&f.side==="ally");
 if(!selected){
  if(savaGlbRuntime){savaGlbRuntime.dispose();savaGlbRuntime=null;}
  return;
 }
 if(savaGlbRuntime||sava3dDisabledScene===scene)return;
 try{
  savaGlbRuntime=SavaGlbRuntime.create(BABYLON,scene,meshes.sava,(kind,message)=>{
   const info=$("#renModelBattleStatus"),label=$("#renModelBattleStatusText");
   if(label)label.textContent=message;
   if(info){info.dataset.status=kind;info.hidden=false;}
   if(kind==="error")console.warn("SAVA3D001: "+message);
  });
 }catch(error){
  // SAVA3D002: a synchronous error in optional skinned rig creation must
  // never abort the combat simulation or tear down Babylon's arena.
  sava3dDisabledScene=scene;
  savaGlbRuntime=null;
  console.warn("SAVA3D002: optional Sava GLB disabled for this scene",error);
  const info=$("#renModelBattleStatus"),label=$("#renModelBattleStatusText");
  if(label)label.textContent="3D Савы недоступно — бой продолжается с простой моделью.";
  if(info){info.dataset.status="error";info.hidden=false;}
 }
}
// ART3D001: optional lazy Art rig. Never abort battle because of a visual asset.
function ensureArt3D(){
 if(!scene||!meshes.art||typeof ArtGlbRuntime==="undefined")return;
 const selected=presentationFighters().some(f=>f.id==="art"&&f.side==="ally");
 if(!selected){
  if(artGlbRuntime){artGlbRuntime.dispose();artGlbRuntime=null;}
  return;
 }
 if(artGlbRuntime||art3dDisabledScene===scene)return;
 try{
  artGlbRuntime=ArtGlbRuntime.create(BABYLON,scene,meshes.art,(kind,message)=>{
   const info=$("#renModelBattleStatus"),label=$("#renModelBattleStatusText");
   if(label)label.textContent=message;
   if(info){info.dataset.status=kind;info.hidden=false;}
   if(kind==="error")console.warn("ART3D001: "+message);
  });
 }catch(error){
  art3dDisabledScene=scene;artGlbRuntime=null;
  console.warn("ART3D001: optional Art GLB disabled for this scene",error);
  const info=$("#renModelBattleStatus"),label=$("#renModelBattleStatusText");
  if(label)label.textContent="3D Арта недоступно — бой продолжается с простой моделью.";
  if(info){info.dataset.status="error";info.hidden=false;}
 }
}
function ensureNada3D(){
 if(!scene||!meshes.nada||typeof NadaGlbRuntime==="undefined")return;
 const selected=presentationFighters().some(f=>f.id==="nada"&&f.side==="ally");
 if(!selected){
  // Arena persists between encounters: release the old rig for Ren-only squads.
  if(nadaGlbRuntime){nadaGlbRuntime.dispose();nadaGlbRuntime=null;}
  return;
 }
 if(nadaGlbRuntime)return;
 nadaGlbRuntime=NadaGlbRuntime.create(BABYLON,scene,meshes.nada,(kind,message)=>{
  const info=$("#renModelBattleStatus");
  if(info){
   const label=$("#renModelBattleStatusText");
   if(label)label.textContent=message;
   info.dataset.status=kind;
   info.hidden=false;
  }
  if(kind==="error")console.warn("NADA3D001: "+message);
 });
}
// NPCROLLOUT001: create only encountered NPC capsules. A whole eight-stage
// catalog at once would allocate 27*3 meshes plus unused materials on iPhone.
function disposeNpcGlbRuntimes(){
 for(const [id,runtime] of npcGlbRuntimes){
  try{runtime.dispose();}catch(error){console.warn("ARENA-ART-004C: dispose",error);}
  if(typeof AnimationProfiles!=="undefined")AnimationProfiles.unlink?.(id);
 }
 npcGlbRuntimes.clear();
}
function clearEncounterNpcVisuals(){
 // GLB first: disposing the capsule would take the model root but leak its
 // skeleton and animation groups.
 disposeNpcGlbRuntimes();
 for(const id of encounterNpcVisualIds){
  const visual=meshes[id];
  if(!visual)continue;
  const parts=[visual.body,visual.head,visual.base];
  // ARENA-VIS-001 shadow/ring materials are shared by every base in the reused
  // scene; disposing them turned all shadows into squares from the 2nd battle.
  const materials=new Set(parts.map(x=>x.material).filter(m=>m&&!m.av001Shared));
  for(const part of parts)part.dispose();
  for(const mat of materials)mat.dispose();
  delete meshes[id];
 }
 encounterNpcVisualIds.clear();
}
function ensureEncounterNpcVisuals(fighters){
 if(!scene)return;
 for(const f of fighters){
  // ARENA-ART-004D: training enemies and capsule heroes borrow a tinted enemy model on
  // their permanent capsule; disposeNpcGlbRuntimes() hands the capsule back.
  const standIn=typeof NpcGlbRuntime!=="undefined"?NpcGlbRuntime.standIn?.(f?.id):null;
  if(standIn&&meshes[f.id]&&!encounterNpcVisualIds.has(f.id)){
   ensureEncounterNpcModel({id:f.id,archetypeId:standIn.archetypeId},meshes[f.id],standIn.tint);
   continue;
  }
  if(f?.side!=="enemy"||!f.archetypeId?.startsWith("npc-")||meshes[f.id])continue;
  const i=100+encounterNpcVisualIds.size;
  const body=BABYLON.MeshBuilder.CreateCapsule("npc_body_"+i,{height:1.5,radius:.42},scene);
  body.position=new BABYLON.Vector3(0,.8,0);
  const mat=new BABYLON.StandardMaterial("npc_mat_"+i,scene);
  mat.diffuseColor=new BABYLON.Color3(.72,.25,.23);
  mat.emissiveColor=new BABYLON.Color3(.08,.015,.01);
  body.material=mat;
  const head=BABYLON.MeshBuilder.CreateSphere("npc_head_"+i,{diameter:.62,segments:12},scene);
  head.position=new BABYLON.Vector3(0,1.8,0);
  head.material=mat;
  const base=arenaVisReady()?ArenaVis001.createBase(BABYLON,scene,"npc_base_"+i,0,0):legacyBase("npc_base_"+i,0,0,"enemy");
  for(const part of [body,head,base])part.metadata={fighterId:f.id};
  meshes[f.id]={body,head,base};
  encounterNpcVisualIds.add(f.id);
  ensureEncounterNpcModel(f,meshes[f.id]);
 }
}
// ARENA-ART-004C: the capsule above stays as fallback; the GLB hides it once loaded.
// No manifest entry (sarkh) -> create() returns null and the capsule is the visual.
function ensureEncounterNpcModel(f,visual,tint){
 if(typeof NpcGlbRuntime==="undefined"||npcGlbRuntimes.has(f.id))return;
 let runtime=null;
 try{
  runtime=NpcGlbRuntime.create(BABYLON,scene,visual,{archetypeId:f.archetypeId,fighterId:f.id,tint,
   onStatus:(kind,message)=>{if(kind==="error")console.warn("ARENA-ART-004C: "+message,f.archetypeId);}});
 }catch(error){console.warn("ARENA-ART-004C: enemy model disabled",f.archetypeId,error);}
 if(!runtime)return;
 npcGlbRuntimes.set(f.id,runtime);
 runtime.ready.then(ok=>{
  // Profiles (clip-length timing) apply only while the model is shown.
  if(ok&&npcGlbRuntimes.get(f.id)===runtime)AnimationProfiles.link(f.id,f.archetypeId);
 });
}
// ARENA-VIS-001: soft contact shadow + ring; the old disc stays as a fallback.
function arenaVisReady(){return typeof ArenaVis001!=="undefined"&&ArenaVis001.supported(BABYLON);}
function legacyBase(name,x,z,side){
 const base=BABYLON.MeshBuilder.CreateCylinder(name,{diameter:1.15,height:.12,tessellation:24},scene);
 base.position=new BABYLON.Vector3(x,.08,z);
 const bm=new BABYLON.StandardMaterial(name+"_mat",scene);
 bm.diffuseColor=side==="ally"?new BABYLON.Color3(.65,.48,.2):new BABYLON.Color3(.4,.18,.18);
 base.material=bm;return base;
}
let arenaResolution=null; // ARENA-VIS-001 adaptive render scale state.
// Reuse the scene rather than re-creating permanent hero meshes on each battle.
function initBabylon(){
 const canvas=$("#renderCanvas");
 // Transparent WebGL is required for a real CSS image to show BEHIND 3D actors.
 engine=new BABYLON.Engine(canvas,true,{stencil:true,alpha:ENV022_CONCEPT_PREVIEW});
 if(typeof ArenaVis001!=="undefined")arenaResolution=ArenaVis001.configureEngine(engine,window);
 if(typeof ArenaVis001!=="undefined"&&$("#battle")?.classList?.add)$("#battle").classList.add("arena-vis-001");
 scene=new BABYLON.Scene(engine);
 scene.clearColor=new BABYLON.Color4(.035,.045,.065,ENV022_CONCEPT_PREVIEW?0:1);
 if(ENV022_CONCEPT_PREVIEW && $("#battle")?.classList?.add)
  $("#battle").classList.add("env022-concept-preview");
 arenaCamera=new BABYLON.ArcRotateCamera("camera",ARENA_VIEW.alpha,ARENA_VIEW.beta,ARENA_VIEW.radius,new BABYLON.Vector3(0,ARENA_VIEW.targetY,0),scene);
 arenaCamera.lowerRadiusLimit=ARENA_VIEW.minRadius??12;arenaCamera.upperRadiusLimit=ARENA_VIEW.maxRadius??21;
 if(ARENA_VIEW.fov)arenaCamera.fov=ARENA_VIEW.fov;
 // Lock orientation to the established three-quarter view; preserve radius zoom 12–21.
 arenaCamera.lowerAlphaLimit=ARENA_VIEW.alpha;arenaCamera.upperAlphaLimit=ARENA_VIEW.alpha;
 arenaCamera.lowerBetaLimit=ARENA_VIEW.beta;arenaCamera.upperBetaLimit=ARENA_VIEW.beta;
 arenaCamera.panningSensibility=0;
 arenaCamera.attachControl(canvas,true);
 // Disable duplicate Babylon pointer drags, retain wheel zoom.
 if(arenaCamera.inputs?.removeByType)
  arenaCamera.inputs.removeByType("ArcRotateCameraPointersInput");
 installArenaPointerCamera(canvas,arenaCamera);
 const hemi=new BABYLON.HemisphericLight("hemi",new BABYLON.Vector3(0,1,0),scene);hemi.intensity=.8;
 const key=new BABYLON.DirectionalLight("key",new BABYLON.Vector3(-.5,-1,.5),scene);key.intensity=1.1;
 if(typeof ArenaVis001!=="undefined")ArenaVis001.configureLighting(BABYLON,scene,hemi,key);
 // CV007 creates a passive, non-pickable test arena and a small hit-FX pool.
 // Legacy geometry remains a safe fallback for headless fixtures or GPU issues.
 combatVisual007=null;
 if(typeof CombatVisual007!=="undefined"&&CombatVisual007.supported(BABYLON)){
  try{combatVisual007=CombatVisual007.create(BABYLON,scene,{conceptBackdrop:ENV022_CONCEPT_PREVIEW});}
  catch(visualError){console.warn("CV007 arena unavailable, using legacy ground",visualError);}
 }
 arenaFeedback=null;
 if(typeof ArenaVis002!=="undefined"){
  try{
   const reducedMotion=typeof window.matchMedia==="function"&&window.matchMedia("(prefers-reduced-motion: reduce)").matches;
   arenaFeedback=ArenaVis002.create(BABYLON,{container:$("#arenaFloaters"),document,reducedMotion,
    // ARENA-UI-003B: numbers never rise into the target's own label.
    floor:id=>arenaHudLayout?.bottomOf?.(id)??null});
  }catch(feedbackError){console.warn("ARENA-VIS-002 feedback unavailable",feedbackError);arenaFeedback=null;}
 }
 if(!combatVisual007 && !ENV022_CONCEPT_PREVIEW){
  const ground=BABYLON.MeshBuilder.CreateGround("ground",{width:16,height:9},scene);const gm=new BABYLON.StandardMaterial("groundMat",scene);gm.diffuseColor=new BABYLON.Color3(.12,.15,.19);gm.specularColor=new BABYLON.Color3(.1,.1,.1);ground.material=gm;
  // Built-in material avoids relying on a separately loaded Babylon Materials Library.
  const grid=BABYLON.MeshBuilder.CreateGround("grid",{width:16,height:9,subdivisions:12},scene);grid.position.y=.012;
  const gridmat=new BABYLON.StandardMaterial("gridmat",scene);
  gridmat.diffuseColor=new BABYLON.Color3(.14,.17,.21);gridmat.emissiveColor=new BABYLON.Color3(.035,.045,.06);
  gridmat.alpha=.28;gridmat.wireframe=true;gridmat.backFaceCulling=false;grid.material=gridmat;
 }
 // Low-poly stylized fighters: capsule body, sphere head, colored shield.
 COMBAT_VISUALS.forEach((h,i)=>{
  const start=formationPosition(h.side,i%3,3);
  const x=start.x,z=start.z;
  let body,head;
  if(h.id==="ren"&&typeof RenVisualModel!=="undefined"){
   // A progressive visual enhancement: keep the old capsule as fallback if
   // the optional local model script is absent (e.g. headless test fixtures).
   // Preserve body/head anchors so targeting, overlays and animations still work.
   ({body,head}=RenVisualModel.create(BABYLON,scene,x,z,i));
  }else{
   body=BABYLON.MeshBuilder.CreateCapsule("body_"+i,{height:1.5,radius:.42},scene);body.position=new BABYLON.Vector3(x,.8,z);
   const mat=new BABYLON.StandardMaterial("mat_"+i,scene);// No GLB for Art and Sava: distinguish the same existing capsule meshes by material only.
   mat.diffuseColor=h.id==="art"?new BABYLON.Color3(.40,.31,.22):
    h.id==="sava"?new BABYLON.Color3(.22,.43,.51):
    h.side==="ally"?new BABYLON.Color3(.28,.55,.76):new BABYLON.Color3(.72,.25,.23);mat.emissiveColor=h.side==="ally"?new BABYLON.Color3(.02,.06,.09):new BABYLON.Color3(.08,.015,.01);body.material=mat;
   head=BABYLON.MeshBuilder.CreateSphere("head_"+i,{diameter:.62,segments:12},scene);head.position=new BABYLON.Vector3(x,1.8,z);head.material=mat;
  }
  const base=arenaVisReady()?ArenaVis001.createBase(BABYLON,scene,"base_"+i,x,z):legacyBase("base_"+i,x,z,h.side);
  for(const part of [body,head,base])part.metadata={fighterId:h.id};
   meshes[h.id]={body,head,base};
 });
 // Default GLB Ren replaces the procedural visual when its verified asset loads.
 // Loading is asynchronous and never blocks combat; fallback stays intact.
 if(typeof RenGlbRuntime!=="undefined"&&meshes.ren){
  renGlbRuntime=RenGlbRuntime.create(BABYLON,scene,meshes.ren,(kind,message)=>{
   const info=$("#renModelBattleStatus");
   if(info){
    const label=$("#renModelBattleStatusText");
    if(label)label.textContent=message;
    info.dataset.status=kind;
    info.hidden=false;
   }
  });
 }
 // Loading a participant GLB must happen in updateMeshes(), AFTER resetBattle() confirms the party.
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
 ensureNada3D();
 ensureLiora3D();
 ensureSava3D();
 ensureArt3D();
 const roster=presentationFighters();
 const sideMembersBySide={ally:roster.filter(f=>f.side==="ally"),enemy:roster.filter(f=>f.side==="enemy")};
 for(const h of [...COMBAT_VISUALS,...Array.from(encounterNpcVisualIds,id=>({id}))]){
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
    if(mesh.base.av001Ring&&typeof ArenaVis001!=="undefined")
     ArenaVis001.setMark(mesh.base,selected?(targetSide==="ally"?"ally":"enemy"):actor?.id===h.id?"active":null,BABYLON,scene);
    else if(mesh.base.material&&BABYLON.Color3)mesh.base.material.emissiveColor=selected
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
// One established battle UI supports both the live economy and isolated
// ?networkPilot=1 fixtures. Real rewards use network.v1 + progress.v3.
if(typeof NetworkPilotSession!=="undefined"&&
 typeof NetworkPilotUI!=="undefined"&&typeof ProgressWriterCore!=="undefined"){
 networkPilot=NetworkPilotSession.create({
  live:!NETWORK_PILOT_ENABLED,
  heroes:ALLIES,day:dailyDay,
  onCredit:runtime=>{
   if(!runtime||runtime.saveVersion!==3)return;
   Object.keys(progress).forEach(key=>delete progress[key]);
   Object.assign(progress,runtime);
   renderAccountHeader();renderHeroes();renderPlayerProfile();
  },
  storageProvider:()=>window.localStorage,
  exclusive:ProgressWriterCore.exclusive,
  ownsLock:ProgressWriterCore.isOwner,
  now:()=>Date.now(),
  seed:()=>{
   const bytes=new Uint32Array(1);
   if(!window.crypto?.getRandomValues)throw Error("NO_CRYPTOGRAPHIC_SEED");
   window.crypto.getRandomValues(bytes);return bytes[0];
  }
 });
 if(networkPilot&&NetworkPilotUI.mount({pilot:networkPilot,
   onOpenSquad:()=>openSquad("network"),
   onBackToFinder:()=>showScreen("heroDetail")})){
  if(!NETWORK_PILOT_ENABLED&&typeof WeeklyThreatCore!=="undefined"&&typeof WeeklyThreatUI!=="undefined"){
     weeklySession=WeeklyThreatCore.create({
      storageProvider:()=>window.localStorage,
      exclusive:ProgressWriterCore.exclusive,ownsLock:ProgressWriterCore.isOwner,
      now:()=>Date.now(),day:dailyDay,heroes:ALLIES,
      onCredit:runtime=>{
       if(!runtime||runtime.saveVersion!==3)return;
       Object.keys(progress).forEach(key=>delete progress[key]);
       Object.assign(progress,runtime);renderAccountHeader();renderHeroes();renderPlayerProfile();
      }
     });
     if(weeklySession)WeeklyThreatUI.mount({weekly:weeklySession,
      networkSession:networkPilot,onOpenSquad:()=>openSquad("weekly"),
      onOpenHeroes:()=>showScreen("collection")});
    }else if($("#net008aThreat"))$("#net008aThreat").hidden=true;
    if(typeof GearUX004!=="undefined"&&typeof GearUX004.setNetworkPreview==="function")
   GearUX004.setNetworkPreview(materialId=>{
    if(NetworkPilotUI.openFromFinder(materialId))showScreen("network");
   });
 }
}
if(typeof GearMaterialUI!=="undefined"&&document.getElementById)GearMaterialUI.mount(()=>({
 profile:progress,campaign:campaignProgress,day:dailyDay(),
 liveNetwork:!!networkPilot?.isLive(),weekly:!!weeklySession
}));
// Fresh display when returning to this view without a full screen transition.
$("#network")?.addEventListener("click",event=>{
 const tab=event.target.closest?.('button[data-net-view="daily"]');
 if(tab&&$("#network").contains(tab)&&!tab.hidden)renderDailyTasks();
});
// One navigation controller for the daily network and weekly challenge.
if(typeof NetworkNavigation!=="undefined")NetworkNavigation.mount({
 threatAvailable:!NETWORK_PILOT_ENABLED&&!!weeklySession
});

renderAccountHeader();renderHeroes();CombatCore.advanceToPlayerTurn(state);
// RESICON001: source cards register before the startup entry prompt.
if(typeof ResourceIconUI!=="undefined")
 ResourceArtUI.mount(()=>({progress,day:dailyDay()}),screen=>showScreen(screen));
if(!openFirstPlayOnEntry())maybeOpenLoginOnEntry();
