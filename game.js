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
const saveBlocked=Boolean(loadedProgress?.blocked);
let saveAvailable=loadedProgress?loadedProgress.available:false;
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
 const heroCap=ProgressCore.heroLevelCap(progress);
 const nextCap=ProgressCore.nextHeroCapUnlock(level);
 const capInfo=$("#playerHeroLevelCap");
 if(capInfo)capInfo.textContent="Сейчас можно повысить героя максимум до уровня "+heroCap+".";
 const capNext=$("#playerHeroCapNext");
 if(capNext)capNext.textContent=heroCap>=ProgressCore.MAX_LEVEL?
  "В текущей версии максимальный уровень героя — "+ProgressCore.MAX_LEVEL+
   ". После расширения игры с аккаунта 16-го уровня действует правило 1:1 (до уровня героя 85).":
  (nextCap?"На уровне аккаунта "+nextCap.accountLevel+
   " откроется максимальный уровень героя "+nextCap.heroCap+". Получай Account XP за миссии.":
   "Для дальнейшего развития нужен новый уровень аккаунта.");
 const track=$("#playerAccountXpTrack"),fill=$("#playerAccountXpFill");
 if(track)track.setAttribute("aria-valuenow",String(Math.round(xp?.percent??0)));
 if(fill)fill.style.width=(xp?.percent??0)+"%";
 $("#playerAccountXpText").textContent=xp?.required===null
  ?"Максимальный тестовый уровень · Всего "+progress.accountXp+" XP"
  :(xp?xp.current+" / "+xp.required+" XP до следующего уровня · Всего "+xp.totalXp+" XP"
     :progress.accountXp+" XP");
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
});
let battleIsCampaign=false;
let missionResultShown=false;
let missionResultRecorded=false;
let activeMissionId=null;
let lastMissionStars=0;
let lastMissionReward=null;
let lastMissionFarmReward=null;
let lastMissionEnergyRefunded=false;
let missionEntryPaid=false;
let missionResultSaveFailed=false;
let simulationMissionId=null;
function renderAccountHeader(){
 renderDailyClaimBadge();
 ProgressCore.refreshEnergy(progress);
 const summary=$("#accountStatus");
 if(summary)summary.textContent="Аккаунт "+ProgressCore.accountLevel(progress)+"/"+ProgressCore.MAX_ACCOUNT_LEVEL+
  " (тест) · XP "+progress.accountXp+" · Валюта "+progress.currency+
  (progress.saveVersion===3?"":" · C "+progress.gearMaterials)+
  " · ⚡ "+progress.energy.value+"/"+ProgressCore.ENERGY_MAX;
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
function renderDailyTasks(){
 const list=$("#dailyTaskList"),notice=$("#dailyTaskNotice");
 if(!list)return;
 const day=dailyDay();
 if(progress.saveVersion!==3||saveBlocked||!day||!DailyCore.today(progress,day)){
  list.textContent="Ежедневные задания недоступны: проверь сохранение или дату на устройстве.";
  if(notice)notice.textContent="Награды не начисляются, пока состояние недоступно.";
  return;
 }
 $("#dailyDay").textContent="День: "+day;
 list.replaceChildren();
 for(const task of DailyCore.TASKS){
  const row=document.createElement("div");row.className="daily-task";
  const label=document.createElement("div");
  const title=document.createElement("strong");title.textContent=task.label;
  const detail=document.createElement("small");
  const done=progress.daily.counts[task.id]===1,claimed=progress.daily.claimed.includes(task.id);
  const materials=Object.entries(task.materials).map(([key,qty])=>
   "+"+qty+" "+(GearData.MATERIAL_LABELS[key]||key)).join(" · ");
  detail.textContent=(done?"Выполнено":"Не выполнено")+" · +"+task.currency+
   " валюты · +"+task.xp+" Account XP · "+materials;
  label.append(title,detail);
  const button=document.createElement("button");button.type="button";
  button.className=claimed?"ghost":"primary";
  button.textContent=claimed?"Получено":done?"Получить":"Выполни задание";
  button.disabled=claimed||!done;button.dataset.dailyClaim=task.id;
  row.append(label,button);list.append(row);
 }
}
$("#dailyTaskList")?.addEventListener("click",event=>{
 const button=event.target.closest?.("[data-daily-claim]");
 if(!button||!$("#dailyTaskList").contains(button)||saveBlocked)return;
 const snapshot=JSON.stringify(progress),day=dailyDay();
 const reward=DailyCore.claim(progress,button.dataset.dailyClaim,day);
 if(!reward)return;
 if(!persistProgress()){
  Object.keys(progress).forEach(key=>delete progress[key]);
  Object.assign(progress,JSON.parse(snapshot));
  $("#dailyTaskNotice").textContent="Не удалось сохранить награду. Валюта и XP не начислены.";
  renderDailyTasks();return;
 }
 $("#dailyTaskNotice").textContent="Награда получена: +"+reward.currency+
  " валюты, +"+reward.xp+" Account XP, "+
  Object.entries(reward.materials).map(([key,qty])=>
   "+"+qty+" "+(GearData.MATERIAL_LABELS[key]||key)).join(", ")+".";
 renderDailyTasks();renderPlayerProfile();renderHeroes();
});
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
function maybeOpenLoginOnEntry(){
 if(document.hidden||saveBlocked||progress.saveVersion!==3||
    !$("#home")?.classList.contains("active"))return false;
 const day=dailyDay();
 if(!day||(loginCalendarSeenDay&&day<=loginCalendarSeenDay)||
    !LoginCore.current(progress,day))return false;
 showScreen("loginCalendar");
 return true;
}
// Login-001: explicit claim, one local calendar day, no missed-day reset.
function renderLoginCalendar(){
 const grid=$("#loginCalendarGrid"),status=$("#loginCalendarStatus"),button=$("#loginClaim");
 if(!grid||!status||!button)return;
 const day=dailyDay();
 const view=LoginCore.current(progress,day);
 if(saveBlocked||!view){
  grid.textContent="Календарь недоступен: проверь дату и сохранение.";
  button.disabled=true;
  status.textContent="Награды не начисляются, пока профиль недоступен.";
  return;
 }
 grid.replaceChildren();
 const monthLabel=$("#loginCalendarMonth");
 if(monthLabel)monthLabel.textContent=new Intl.DateTimeFormat("ru-RU",{month:"long",year:"numeric"})
  .format(new Date(Number(view.month.slice(0,4)),Number(view.month.slice(5,7))-1,1))+
  " · "+view.days+" дней";
 for(let i=0;i<view.days;i++){
  const reward=LoginCore.rewardForDay(i+1);
  const cell=document.createElement("div");
  cell.className="login-day"+(i<view.claimedThisMonth?" claimed":"")+
   (view.available&&i===view.nextDay-1?" active":"");
  const title=document.createElement("strong");title.textContent="День "+(i+1);
  const detail=document.createElement("small");
  detail.textContent="+"+reward.currency+" валюты · +"+reward.xp+" XP · "+
   Object.entries(reward.materials).map(([key,n])=>"+"+n+" "+
    (GearData.MATERIAL_LABELS[key]||key)).join(", ");
  cell.append(title,detail);grid.append(cell);
 }
 button.disabled=!view.available;
 button.textContent=view.available?"Забрать награду дня "+view.nextDay:
  view.alreadyClaimed?"Сегодня получено":"Получение недоступно";
 status.textContent=view.clockBack?"Дата на устройстве раньше последней полученной награды.":
  view.alreadyClaimed?"Награда за сегодня получена. Возвращайся завтра.":
  view.available?"Пропущенные дни не сбрасывают прогресс. Следующая награда — день "+
   view.nextDay+" из "+view.days+". Первого числа календарь обновится.":
   "Все награды этого месяца собраны. Новый календарь появится первого числа.";
}
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
 renderLoginCalendar();renderDailyTasks();renderPlayerProfile();renderHeroes();
 $("#loginCalendarStatus").textContent="Награда дня "+reward.day+" получена: +"+
  reward.currency+" валюты, +"+reward.xp+" XP, "+
  Object.entries(reward.materials).map(([key,n])=>"+"+n+" "+
   (GearData.MATERIAL_LABELS[key]||key)).join(", ")+".";
});
function persistProgress(){
 if(storageAdapter)saveAvailable=storageAdapter.save(progress,()=>window.localStorage);
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
 if(!persistProgress()&&before){
  Object.keys(progress).forEach(k=>delete progress[k]);
  Object.assign(progress,JSON.parse(before));
  renderAccountHeader();
  $("#devResourcesNotice").textContent="Не удалось сохранить выдачу. Запасы не изменены.";
  return;
 }
 const status=$("#devResourcesNotice");
 if(status)status.textContent="Тестовый запас готов: энергия "+progress.energy.value+"/"+ProgressCore.ENERGY_MAX+
  ", игровая валюта "+progress.currency+", материал C "+progress.gearMaterials+
  (progress.saveVersion===3?" · G1: "+GearData.MATERIALS.map(id=>GearData.MATERIAL_LABELS[id]+" "+progress.materials[id]).join(", "):"")+
  (progress.saveVersion===3&&typeof SkillCore!=="undefined"&&progress.skillMaterials?" · Навыки: "+
   SkillCore.RESOURCE_IDS.map(id=>SkillCore.LABELS[id]+" "+
    progress.skillMaterials[id]).join(", "):"")+
  (saveAvailable?". Сохранено в этом браузере.":". Внимание: сохранение недоступно.");
});

let selectedHeroId=ALLIES[0].id;
let selectedGearSlot=0;
// Formation persists independently of hero levels/campaign saves. On the first
// visit (or invalid/unavailable storage), use the first five roster heroes.
const SQUAD_SAVE_KEY="ashes-throne.squad.v1";
function heroOwned(id){
 return typeof HeroCollectionCore==="undefined"||HeroCollectionCore.owned(progress,id);
}
function heroUnlockLabel(id){
 const mission=typeof HeroCollectionCore!=="undefined"?HeroCollectionCore.unlockMission(id):null;
 return mission?(MissionData.get(mission)?.title||"миссия"):"сюжетное прохождение";
}
function defaultSquad(){
 const ids=ALLIES.filter(h=>heroOwned(h.id)).slice(0,MAX_SQUAD).map(h=>h.id);
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
 kael:Object.freeze({physicalDefense:24,magicDefense:12,maxProtection:20}),
 lyra:Object.freeze({physicalDefense:6,magicDefense:15,maxProtection:0}),
 darin:Object.freeze({physicalDefense:14,magicDefense:9,maxProtection:0})
});
const PILOT_ENEMY_STATS=Object.freeze({physicalDefense:8,magicDefense:8,maxProtection:0});
function equippedPilotStats(hero,profile){
 if(!hero||!profile)return hero;
 return {...hero,combatProfile:"stats002c",physicalAttack:hero.atk,physicalDefense:profile.physicalDefense,
  magicDefense:profile.magicDefense,protection:profile.maxProtection,
  maxProtection:profile.maxProtection};
}
function progressedHero(hero){
 const calculated=ProgressCore.heroStats(progress,hero);
 if(!calculated)return null;
 const h=equippedPilotStats(calculated,PILOT_HERO_STATS[hero.id]);
 return typeof SkillCore==="undefined"?h:
  {...h,skillLevels:Object.fromEntries(SkillCore.IDS.map(id=>[id,SkillCore.level(progress,hero.id,id)]))};
}
function progressedEnemy(enemy){
 return equippedPilotStats({...enemy},PILOT_ENEMY_STATS);
}
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
  .filter(heroOwned)
  .map(id=>ALLIES.find(h=>h.id===id)).filter(Boolean).map(progressedHero);
}
function battleLineup(){
 // Mission #2 tests five enemies; the shared enemy AI is mission-independent.
 const enemies=battleIsCampaign&&activeMissionId==="demo-mission-2"?ENEMIES:ENEMIES.slice(0,2);
 return [...selectedParty(),...enemies.map(progressedEnemy)];
}
// Optional future wave rosters live in mission data. Existing missions have no
// future waves, so their accepted encounters and balance remain unchanged.
function battleFutureWaves(){
 const mission=battleIsCampaign&&MissionData.get(activeMissionId);
 return (mission&&mission.futureEnemyWaves||[]).map(ids=>ids.map(id=>{
  const enemy=ENEMIES.find(h=>h.id===id);
  if(!enemy)throw Error("Unknown wave enemy template: "+id);
  return progressedEnemy(enemy);
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
  const owned=heroOwned(h.id);
  return `<button type="button" class="squad-choice ${active?"chosen":""} ${owned?"":"hero-locked"}" data-hero-id="${h.id}" aria-pressed="${active}" ${owned?"":"disabled"}><span class="squad-glyph">${owned?h.glyph:"♙"}</span><span><b>${owned?h.name:"Закрытый герой"}</b><small>${owned?h.role+" · HP "+h.hp+" · ATK "+h.atk+(skill?" · Лидерская способность":""):"Открывается: "+heroUnlockLabel(h.id)}</small></span><strong>${owned?(active?"✓":"+"):"🔒"}</strong></button>`;
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
 if(!ALLIES.some(h=>h.id===id)||!heroOwned(id))return false;
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
 if(id==="playerProfile")renderPlayerProfile();
 if(id==="dailyTasks")renderDailyTasks();
 if(id==="loginCalendar"){
  markLoginCalendarSeen();
  renderLoginCalendar();
 }
 if(id==="campaign")renderCampaign();
 if(id==="heroDetail")renderHeroDetail();
 if(id==="battle"){
  lastMissionReward=null;
  lastMissionFarmReward=null;
  lastMissionEnergyRefunded=false;
  missionEntryPaid=false;
  missionResultSaveFailed=false;
  battleIsCampaign=squadReturnScreen==="campaign"&&!!activeMissionId;
  const label=$("#battleMissionLabel");
  if(label)label.textContent=battleIsCampaign?MissionData.get(activeMissionId).title:"ТЕСТОВАЯ АРЕНА";
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
   resetArenaCamera(); // Start every encounter from the approved perspective.
   engine.resize();
   if(battleIsCampaign&&!freeStoryEntry){
    if(!ProgressCore.spendEnergy(progress,activeMissionId))throw new Error("Недостаточно энергии");
    entryPaid=true;
    if(!persistProgress())throw new Error("Не удалось сохранить расход энергии");
   }
   missionEntryPaid=entryPaid;
   resetBattle();
   updateMeshes();
   startBattleRendering();
   const notice=$("#battleLoadError");
   if(notice)notice.hidden=true;
  } catch(error) {
   if(entryPaid){ProgressCore.refundEnergy(progress,activeMissionId);persistProgress();}
   missionEntryPaid=false;
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
 if(id==="home"){
  renderDailyClaimBadge();
  maybeOpenLoginOnEntry();
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
 $("#heroList").innerHTML=ALLIES.map(progressedHero).map(h=>{
  const owned=heroOwned(h.id);
  return `<button type="button" class="hero-card hero-open ${owned?"":"hero-locked"}" data-open-hero="${h.id}" ${owned?"":"disabled"}><div class="hero-avatar">${owned?h.glyph:"🔒"}</div><h3>${owned?h.name:"Неизвестный герой"}</h3><p>${owned?h.role+" · Уровень "+h.level:"Получение: "+heroUnlockLabel(h.id)}</p>${owned?`<div class="stats"><span>Здоровье ${h.hp}</span><span>Сила ${h.atk}</span></div>`:""}<span class="hero-open-hint">${owned?"Открыть карточку →":"Пока недоступен"}</span></button>`;
 }).join("");
 document.querySelectorAll("[data-open-hero]").forEach(node=>node.addEventListener("click",()=>openHeroDetail(node.dataset.openHero)));
}
function openHeroDetail(id){
 if(!ALLIES.some(h=>h.id===id)||!heroOwned(id))return false;
 selectedHeroId=id;
 const current=ProgressCore.gearState(progress,id);
 selectedGearSlot=current?Math.max(0,current.slots.findIndex(installed=>!installed)):0;
 showScreen("heroDetail");
 return true;
}
function renderItemizedGear(base,gear){
 const completed=gear.slots.filter(Boolean).length;
 const ready=completed===ProgressCore.SLOT_COUNT;
 const slot=GearData.SLOTS[selectedGearSlot]||GearData.SLOTS[0];
 const offered=ProgressCore.itemOffer(progress,base.id,slot.id),item=offered[0]||null;
 const installed=gear.slots[selectedGearSlot];
 const promotion=ready?ProgressCore.gearPromotionCost(progress,base.id):null;
 $("#gearTier").textContent="G"+gear.tier+" · "+completed+"/6"+
  (ready&&gear.tier===3?" · тестовый максимум":"");
 $("#gearSlots").innerHTML=GearData.SLOTS.map((entry,i)=>{
  const filled=gear.slots[i],selected=i===selectedGearSlot;
  return '<button type="button" class="gear-slot '+(filled?'filled ':'')+
   (selected?'selected':'')+'" data-gear-slot="'+i+'" aria-pressed="'+selected+
   '" aria-label="'+entry.label+' · '+(filled?'установлен':'пустой')+'">'+
   '<span aria-hidden="true">'+(filled?'◆':'◇')+'</span><small>'+entry.label+'</small></button>';
 }).join("");
 const label=$("#gearMaterialLabel");if(label)label.textContent="Компоненты G"+gear.tier;
 $("#gearMaterial").textContent=GearData.MATERIALS.map(id=>GearData.MATERIAL_LABELS[id]+" "+progress.materials[id]).join(" · ");
 $("#gearWallet").textContent=String(progress.currency);
 $("#gearPriceLabel").textContent=ready?"Стоимость перехода":"Выбранный предмет";
 $("#gearStatBonusLabel").textContent=ready?"Бонус повышения":"Фиксированный бонус";
 const chosen=installed?GearData.get(installed):item;
 $("#gearPrice").textContent=ready?(promotion?promotion.currency+" валюты · G"+promotion.from+" → G"+promotion.to:"G3 · тестовый максимум"):
  chosen?chosen.name+" · "+Object.entries(chosen.ingredients).map(([id,n])=>
   GearData.MATERIAL_LABELS[id]+" ×"+n).join(", ")+" · "+chosen.currency+" валюты":"—";
 $("#gearStatBonus").textContent=ready?(promotion?"HP и ATK +3%":"—"):
  chosen?[chosen.bonuses.hp?"HP +"+Math.round(chosen.bonuses.hp*100)+"%":"",
   chosen.bonuses.atk?"ATK +"+Math.round(chosen.bonuses.atk*100)+"%":""].filter(Boolean).join(" · "):"—";
 const button=$("#gearEquipNext");
 button.disabled=saveBlocked||(ready?!promotion||!ProgressCore.canPromoteGear(progress,base.id):
  !!installed||!item||!ProgressCore.canEquipItem(progress,base.id,item.id));
 button.textContent=ready?(promotion?"Повысить экипировку до G"+promotion.to:"G3 завершён"):
  installed?"Предмет установлен":"Изготовить и установить";
 $("#gearNotice").textContent=saveBlocked
  ?"Обнаружена проблема сохранения: покупки заблокированы."
  :ready?(promotion?(ProgressCore.gearPromotionBlockReason(progress,base.id)||
   "Все шесть предметов G"+gear.tier+" установлены. Можно повысить до G"+promotion.to+" за "+promotion.currency+" валюты."):
   "G3 завершён. Следующие ступени появятся отдельным этапом.")
  :installed?"Установлено: "+chosen.name+"."
  :item?(ProgressCore.itemBlockReason(progress,base.id,item.id)||
   "Тестовый предмет доступен. Материалы — в кнопке «Тестовые ресурсы».")
  :"Для класса нет доступного предмета.";
}
function renderHeroAbilities(hero){
 const list=$("#heroAbilityList");
 if(!list||typeof AbilityInfo==="undefined")return;
 list.replaceChildren();
 for(const info of AbilityInfo.forHero(hero)){
  const card=document.createElement("article");
  card.className="hero-ability-card"+(info.status!=="available"?" unavailable":"");
  const heading=document.createElement("div");
  heading.className="hero-ability-heading";
  const label=document.createElement("span");label.className="hero-ability-kind";label.textContent=info.label;
  const name=document.createElement("strong");name.textContent=info.name;
  heading.append(label,name);
  const details=document.createElement("details");details.className="hero-ability-more";
  const summary=document.createElement("summary");summary.textContent="Описание";
  const description=document.createElement("p");description.textContent=info.description;
  details.append(summary,description);
  if(info.meta.length){
   const meta=document.createElement("small");meta.className="hero-ability-meta";
   meta.textContent=info.meta.join(" · ");details.append(meta);
  }
  card.append(heading,details);
  if(info.status==="available"&&typeof SkillCore!=="undefined"&&SkillCore.IDS.includes(info.id)){
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
 if(!SkillCore.IDS.includes(id)||!ALLIES.some(h=>h.id===selectedHeroId))return;
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
 const materials=c?Object.entries(c.materials).map(([id,amount])=>
  SkillCore.LABELS[id]+" ×"+amount+
  " (есть "+(progress.skillMaterials?.[id]??0)+")").join(" · "):"";
 $("#skillCostLabel").textContent=c?"НУЖНО ДЛЯ УР. "+c.to:"МАКСИМАЛЬНЫЙ УРОВЕНЬ";
 $("#skillCostText").textContent=c?
  c.currency+" валюты"+(materials?" · "+materials:"")+" · герой от ур. "+c.heroLevel:
  "Все шесть уровней изучены";
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
function renderHeroDetail(){
 const base=ALLIES.find(h=>h.id===selectedHeroId);
 if(!base)return;
 const hero=progressedHero(base);
 const cost=ProgressCore.upgradeCost(progress,base.id);
 const levelCap=ProgressCore.heroLevelCap(progress);
 const next=cost===null?null:equippedPilotStats(ProgressCore.heroStats(progress,base,hero.level+1),PILOT_HERO_STATS[base.id]);
 $("#detailName").textContent=hero.name;
 $("#detailRole").textContent=hero.role+" · Демонстрационный персонаж";
 $("#detailGlyph").textContent=hero.glyph;
 renderHeroAbilities(hero);
 // Keep the existing battle-tested HP/ATK/speed display unchanged.
 // Other approved stats are shown as TBD, never as misleading zero bonuses.
 const overview=typeof GearData!=="undefined"&&GearData.statOverview?GearData.statOverview(hero):[];
 const statRows=overview.map(stat=>
  '<div class="stat-catalog-row"><span>'+stat.label+'</span><strong>'+
   (stat.active?stat.value:'Не рассчитано')+'</strong></div>').join("");
 const activeStats=overview.filter(stat=>stat.active).length;
 $("#detailStats").innerHTML=`<div><span>Здоровье</span><strong>${hero.hp} HP</strong></div><div><span>Атака (общая, тест)</span><strong>${hero.atk} ATK</strong></div><div><span>Скорость</span><strong>${hero.speed}</strong></div><details class="stat-catalog-details"><summary>Все 14 характеристик · ${14-activeStats} ожидают формулы</summary><p class="muted">Тестовый пилот: физическая атака наследует текущую общую ATK с бонусами уровня и G; оборона и Protection работают против типизированных ударов. Магическая атака и прочие параметры пока не назначены.</p>${statRows}</details>`;
 $("#detailLevel").textContent="Уровень героя "+hero.level+" / "+ProgressCore.MAX_LEVEL;
 const nextCap=ProgressCore.nextHeroCapUnlock(ProgressCore.accountLevel(progress));
 const limitNote=$("#detailHeroLevelCap");
 if(limitNote)limitNote.textContent="Твой аккаунт: уровень "+ProgressCore.accountLevel(progress)+
  ". Доступный максимум героя сейчас: "+levelCap+". "+
  (levelCap>=ProgressCore.MAX_LEVEL?
   "Дальнейшие уровни пока не доступны в тестовой версии.":
   (nextCap?"Чтобы открыть максимум "+nextCap.heroCap+
    ", получи уровень аккаунта "+nextCap.accountLevel+".":"Нужен новый уровень аккаунта."));
 $("#detailWallet").textContent=String(progress.currency);
 $("#detailCost").textContent=cost===null?"Недоступно":cost+" валюты";
 $("#detailPreview").textContent=next?next.hp+" HP · "+next.atk+" ATK":
  hero.level>=ProgressCore.MAX_LEVEL?"Тестовый максимум достигнут":
  hero.level>=levelCap?"Нужен более высокий уровень аккаунта":"Недоступно";
 $("#detailUpgrade").disabled=saveBlocked||!ProgressCore.canUpgrade(progress,base.id);
 $("#detailNotice").textContent=saveBlocked?"Сохранение недоступно. Повышение заблокировано.":
  (ProgressCore.upgradeBlockReason(progress,base.id)||
   "Улучшение доступно (тестовая прогрессия аккаунта).");
 if($("#gearTier")){
 const gear=ProgressCore.gearState(progress,base.id);
 if(gear.mode==="itemized")renderItemizedGear(base,gear);
 else {
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
  ?(maxed?"Тестовый максимум":promotion?.currency+" игровой валюты · G"+promotion.from+" → G"+promotion.to)
  :(item?item.name+": "+item.material+" C · "+item.currency+" валюты":"—");
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
    (ProgressCore.gearPromotionBlockReason(progress,base.id)+(shortage?" Не хватает "+shortage+" валюты.":"")||
     "Все шесть слотов заполнены. Можно повысить G-ступень."))
  :(materialShortage?"Недостаточно материала C: есть "+progress.gearMaterials+", нужно "+item.material+".":
   shortage?"Недостаточно игровой валюты: есть "+progress.currency+", нужно "+item.currency+" (не хватает "+shortage+").":
   ProgressCore.gearBlockReason(progress,base.id,selectedGearSlot)||"Предмет доступен. Можно выбирать слоты в любом порядке.");
 }
 }

 const saveNote=$("#progressSaveNote");
 if(saveNote)saveNote.textContent=saveBlocked
  ?"Сохранение повреждено или недоступно. Покупки заблокированы, прежние данные не перезаписаны."
  :saveAvailable?"Прогресс сохраняется в этом браузере. Очистка данных Safari может его удалить."
  :"Сохранение сейчас недоступно. Прогресс может сброситься после перезагрузки.";
}
$("#gearSlots")?.addEventListener("click",event=>{
 const button=event.target.closest?.("[data-gear-slot]");
 if(!button||!$("#gearSlots").contains(button))return;
 const slot=Number(button.dataset.gearSlot);
 if(!Number.isInteger(slot)||slot<0||slot>=ProgressCore.SLOT_COUNT)return;
 selectedGearSlot=slot;
 renderHeroDetail();
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
   const before=JSON.stringify(progress),oldStats=ProgressCore.heroStats(progress,base);
   const result=ProgressCore.promoteGear(progress,selectedHeroId);
   if(!result)return;
   if(!persistProgress()){
    Object.keys(progress).forEach(k=>delete progress[k]);
    Object.assign(progress,JSON.parse(before));
    renderAccountHeader();renderHeroDetail();
    $("#gearNotice").textContent="Переход не сохранён. Валюта и G1 восстановлены.";
    return;
   }
   const newStats=ProgressCore.heroStats(progress,base);
   selectedGearSlot=0;renderHeroDetail();renderHeroes();
   $("#gearPromotionTitle").textContent="Поздравляем!";
   $("#gearPromotionLevel").textContent="G"+result.from+" → G"+result.to+". Предметы прошлых G сохранены в истории.";
   $("#gearPromotionCost").textContent="Потрачено "+result.currency+" валюты.";
   $("#gearPromotionStats").textContent="Здоровье: "+oldStats.hp+" → "+newStats.hp+" HP\n"+
    "Атака: "+oldStats.atk+" → "+newStats.atk+" ATK\n"+
    "Скорость: "+oldStats.speed+" → "+newStats.speed+" (без изменений)";
   $("#gearPromotionDialog").showModal();
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
   $("#gearNotice").textContent="Покупка не сохранена. Материалы и валюта возвращены.";
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
  $("#gearPromotionTitle").textContent="Поздравляем!";
  $("#gearPromotionLevel").textContent="Уровень экипировки: G"+result.from+" → G"+result.to+
   ". Герой остался на уровне "+before.level+".";
  $("#gearPromotionCost").textContent="Потрачено "+result.currency+" игровой валюты.";
  $("#gearPromotionStats").textContent="Здоровье: "+before.hp+" → "+after.hp+" HP\n"+
   "Атака: "+before.atk+" → "+after.atk+" ATK\n"+
   "Скорость: "+before.speed+" → "+after.speed+" (без изменений)";
  $("#gearPromotionDialog").showModal();
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
$("#detailUpgrade").addEventListener("click",()=>{
 if(saveBlocked)return;
 const before=progress.saveVersion===3?JSON.stringify(progress):null;
 if(ProgressCore.upgrade(progress,selectedHeroId)){
  recordDailyTask("hero-level");
  if(!persistProgress()&&before){
   Object.keys(progress).forEach(k=>delete progress[k]);
   Object.assign(progress,JSON.parse(before));
   renderAccountHeader();
   renderHeroDetail();
   $("#detailNotice").textContent="Уровень не сохранён. Валюта возвращена.";
   return;
  }
  renderHeroDetail();renderHeroes();
 }
});

function missionRewardLabel(id){
 const reward=ProgressCore.MISSION_GEAR_FARM[id];
 if(progress.saveVersion!==3||!reward)return "";
 const components=GearData.MATERIALS.filter(key=>reward.materials[key]>0)
  .map(key=>GearData.MATERIAL_LABELS[key]+" ×"+reward.materials[key]).join(" · ");
 const first=ProgressCore.FIRST_CLEAR_REWARDS[id];
 const bonus=first&&!progress.claimedMissions.includes(id)
  ?"<p class=\"muted\">Дополнительно за первую победу: "+first.currency+" валюты · "+first.xp+" XP.</p>":"";
 return "<p class=\"muted\"><b>Награды за победу:</b> "+reward.currency+
  " валюты · "+reward.xp+" XP · "+components+
  ". Выдаются при первой победе и каждом повторе (от 1★). Симуляция после 3★.</p>"+bonus;
}
function renderCampaign(){
 ProgressCore.refreshEnergy(progress);
 renderAccountHeader();
 const resource=$("#energyStatus");
 if(resource)resource.textContent="Энергия: "+progress.energy.value+"/"+ProgressCore.ENERGY_MAX+
  " · 1 за 6 минут · симуляция после 3★.";
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
 const before=progress.energy.value;
 const restored=ProgressCore.refreshEnergy(progress,now);
 if(restored>0)persistProgress();
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
 const gain=ProgressCore.simulate(progress,simulationMissionId,campaignProgress.bestStars[simulationMissionId],count);
 if(!gain){renderSimulationPreview();return;}
 // Prevent a second confirmation from paying the same visible result again.
 simulationMissionId=null;
 persistProgress();
 $("#simulationSetup").hidden=true;
 $("#simulationResults").hidden=false;
 $("#simulationTitle").textContent="Поздравляем!";
 $("#simulationText").textContent="Выполнено симуляций: "+gain.count+". Потрачено: "+gain.energy+" ⚡.";
 $("#simulationRewards").textContent=[
  gain.material?"+ "+gain.material+" материалов C":null,
  gain.materials?GearData.MATERIALS.filter(key=>gain.materials[key]>0).map(key=>"+ "+gain.materials[key]+" "+GearData.MATERIAL_LABELS[key]).join(" · "):null,
  gain.currency?"+ "+gain.currency+" валюты":null,
  gain.xp?"+ "+gain.xp+" Account XP":null
 ].filter(Boolean).map(item=>"• "+item).join("\n");
 $("#simulationClose").textContent="Закрыть";
 renderCampaign();
});
const simulationClose=$("#simulationClose");
if(simulationClose)simulationClose.addEventListener("click",()=>{
 $("#simulationDialog").close();simulationMissionId=null;
});
function renderMissionResult(){
 const won=state.winner==="ally";
 const entry=CampaignData.getMission(activeMissionId);
 const chapter=entry&&CampaignData.allChapters().find(c=>c.id===entry.chapterId);
 const chapterLabel=$("#missionResultChapter");
 if(chapterLabel)chapterLabel.textContent=chapter?chapter.title:"Кампания";
 $("#missionResultTitle").textContent=won?"Миссия пройдена":"Миссия не пройдена";
 const components=lastMissionFarmReward?.materials
  ?GearData.MATERIALS.filter(key=>lastMissionFarmReward.materials[key]>0)
    .map(key=>GearData.MATERIAL_LABELS[key]+" ×"+lastMissionFarmReward.materials[key]).join(", "):"";
 const base=lastMissionFarmReward
  ?"Получено: +"+lastMissionFarmReward.currency+" валюты, +"+lastMissionFarmReward.xp+" XP, "+components+". ":"";
 const first=lastMissionReward
  ?"Дополнительно за первую победу: +"+lastMissionReward.currency+" валюты, +"+lastMissionReward.xp+" XP"+
    (lastMissionReward.material?", +"+lastMissionReward.material+" C":"")+".":"";
 $("#missionResultText").textContent=missionResultSaveFailed
  ?"Ошибка сохранения наград. Прогресс этой победы не записан. Проверь хранилище браузера и повтори миссию."
  :won?MissionData.get(activeMissionId).title+" завершена. "+(base+first||"Повтор без экономических наград.")
  :"Отряд потерпел поражение. Наград нет."+(lastMissionEnergyRefunded?" Энергия за ресурсный повтор возвращена.":"");
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
 stats.textContent="АТК "+target.atk+" · СКР "+target.speed+
  (Number.isFinite(target.maxProtection)&&target.maxProtection>0?
    " · PR "+target.protection+"/"+target.maxProtection:"");
 fill.style.width=Math.max(0,Math.min(100,target.hp/Math.max(1,target.maxHp)*100))+"%";
}
function syncBattleUI(){
 if(inspectionId)renderFighterInspection();
 if(!state.active||isVisualTransition())hideAbilityTooltip();
 if(!state.active){cancelAutoTimer();autoBattle=false;}
 // Commit battle outcome immediately as before, even if the player leaves
 // the arena before the final animation ends. Only visual navigation waits.
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
     HeroCollectionCore.grant(progress,activeMissionId);
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
   lastMissionFarmReward=null;lastMissionReward=null;lastMissionEnergyRefunded=false;
   missionResultSaveFailed=true;
   renderAccountHeader();
  }
  lastMissionStars=result.earned;
  if(walletSaved&&result.improved)
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
  if(!state.active)reward.textContent=state.winner==="ally"?
   (lastMissionFarmReward?"Победа: +"+lastMissionFarmReward.currency+" валюты · материалы G начислены"+
      (lastMissionReward?" · бонус первой победы +"+lastMissionReward.currency+" валюты":""):
    battleIsCampaign&&lastMissionReward?"Первая победа: +"+lastMissionReward.xp+" XP · +"+lastMissionReward.currency+" валюты · +"+lastMissionReward.material+" C":"Победа · без экономических наград"):
   "Поражение · без наград"+(lastMissionEnergyRefunded?" · энергия возвращена":"");
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
  const protectionPercent=Math.min(100,Math.max(0,
    (h.protection||0)/Math.max(1,h.maxProtection||0)*100));
  const protectionLine=Number.isFinite(h.maxProtection)&&h.maxProtection>0?
    `<div class="arena-protection" title="Protection ${h.protection} / ${h.maxProtection}"><span style="width:${protectionPercent}%"></span></div>`:"";
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
   ${protectionLine}
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
 // Keep the chosen speed between battles; only autoplay resets.
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
renderAccountHeader();renderHeroes();CombatCore.advanceToPlayerTurn(state);
maybeOpenLoginOnEntry();
