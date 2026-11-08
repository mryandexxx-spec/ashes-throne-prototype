"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const src=["initiative-model.js","ability-data.js","combat-status-core.js","battle-rng.js","combat-core.js","auto-decision.js","enemy-decision.js","progress-core.js","save-core.js","mission-data.js","campaign-core.js","campaign-data.js","challenge-core.js","battle-speed.js","animation-profiles.js","battle-animation.js","hero-profile-data.js","story-trial-data.js","story-demo-core.js","game.js"].map(n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8")).join("\n");
const ids=["home","collection","campaign","challenges","challengeResult","challengeList","challengeModes","challengeModeBack","challengeModeTitle","challengeSaveStatus","dailyClaimAll","challengeResultName","challengeResultTitle","challengeResultText","challengeResultStars","challengeResultRetry","challengeResultBack","challengeResultHome","battleChallengeGoal","storyDemo","storyDemoOpen","storyDemoBack","storyDemoSpeaker","storyDemoText","storyDemoNext","storyDemoChoices","storyDemoChoiceA","storyDemoChoiceB","storyDemoFight","storyDemoTrialFight","storyDemoNotice","storyDemoAgain","storyRenTags","storyRenBiography","heroBiographyDialog","heroBiographyPortrait","heroBiographyTitle","heroBiographyTags","heroBiographyText","heroBiographyNote","heroBiographyClose","squad","battle","heroList","combatants",
 "battleStatus","turnChip","actionTitle","actionHint","battleRetryBtn","arenaIndicators","orientationPrompt",
 "basicAbilitySlot","specialAbilitySlot","abilityTooltip","abilityTooltipTitle","abilityTooltipText",
 "fighterInspect","inspectClose","inspectSide","inspectName","inspectRole","inspectStats","inspectEffects",
 "targetFighterHud","targetFighterSide","targetFighterLevel","targetFighterName","targetFighterHp","targetFighterStats","targetFighterHealthFill",
 "basicAbilityBtn","specialAbilityBtn","autoBattleBtn","autoSpeedBtn","battleMessage","renderCanvas",
 "startBattle","campaignBattle","campaignMissions","squadBack","squadStart","squadRoster",
 "squadSlots","squadHint","squadWarning","squadDisband","squadCount","heroDetail","detailName","detailRole","detailTags","detailBiography","detailGlyph","detailStats","detailLevel","detailWallet","detailCost","detailPreview","detailUpgrade","detailNotice","detailBack","detailHome","battleReward","campaignMissionStatus","campaignMissionStars","campaignChapterProgress","campaignSaveStatus","energyRefresh","energyRefreshStatus","simulationDialog","simulationTitle","simulationSetup","simulationResults","simulationCount","simulationQuantity","simulationCost","simulationAvailable","simulationConfirm","simulationText","simulationRewards","simulationClose","missionResult","missionResultTitle","missionResultText","missionResultStars","missionResultBack","missionResultRetry","missionResultHome"];
function element(id=""){
 return {id,dataset:{},innerHTML:"",textContent:"",disabled:false,handlers:{},style:{},
  classList:{active:id==="home",contains(x){return !!this[x]},add(x){this[x]=true},
   remove(x){this[x]=false},toggle(x,v){this[x]=!!v}},
  addEventListener(type,fn){(this.handlers[type]??=[]).push(fn)},
  setAttribute(name,value){this[name]=value}
 };
}
const elements=Object.fromEntries(ids.map(id=>[id,element(id)]));
elements.simulationDialog.showModal=function(){this.open=true;};
elements.simulationDialog.close=function(){this.open=false;};
elements.heroBiographyDialog.showModal=function(){this.open=true;};
elements.heroBiographyDialog.close=function(){this.open=false;};
elements.simulationCount.value="1";
const chooseNodes=["kael","lyra","darin"].map(id=>{
 const e=element();e.dataset.heroId=id;return e;
});
const heroNodes=["kael","lyra","darin"].map(id=>{const e=element();e.dataset.openHero=id;return e;});
const arenaNav=element();arenaNav.dataset.screen="battle";
const collectionNav=element();collectionNav.dataset.screen="collection";
const allScreens=["home","collection","campaign","challenges","challengeResult","storyDemo","squad","battle","heroDetail","missionResult"].map(id=>elements[id]);
const visibilityListeners=[];const domEvents={};
const document={
 body:element("body"),
 hidden:false,
 querySelector(q){return elements[q.slice(1)]},
 querySelectorAll(q){
  if(q===".screen")return allScreens;
  if(q==="[data-screen]")return [arenaNav,collectionNav];
  if(q==="[data-hero-id]")return chooseNodes;
  if(q==="[data-open-hero]")return heroNodes;
  return [];
 },
 addEventListener(type,fn){if(type==="visibilitychange")visibilityListeners.push(fn);else (domEvents[type]??=[]).push(fn)}
};
let meshCreates=0,engineCreates=0,rendersStarted=0,resizes=0;
const viewportEvents={};const rafQueue=[];
const liveWindow={localStorage:null,innerWidth:844,innerHeight:390,
 addEventListener(type,fn){viewportEvents[type]=fn},
 requestAnimationFrame(fn){rafQueue.push(fn)},
 visualViewport:{addEventListener(type,fn){viewportEvents["visual-"+type]=fn}},
 ResizeObserver:class{constructor(fn){viewportEvents.observer=fn}observe(){}}
};
function flushRaf(){let count=0;while(rafQueue.length){assert.ok(++count<12,"no endless layout scheduling");rafQueue.shift()();}}
let pointerListener=null;
class Mesh {
 constructor(){this.position={};this.visible=true;}
 setEnabled(v){this.visible=v;}
}
class Engine {
 constructor(){engineCreates++;}
 resize(){resizes++;}
 runRenderLoop(){rendersStarted++;}
 stopRenderLoop(){}
}
class Material {constructor(){this.diffuseColor=null;this.specularColor=null;this.emissiveColor=null;}}
class Camera{
 constructor(_name,alpha,beta,radius){this.alpha=alpha;this.beta=beta;this.radius=radius;
  this.inputs={removed:[],removeByType:(type)=>this.inputs.removed.push(type)};}
 attachControl(){}
}
class Scene{
 constructor(){this.onPointerObservable={add(fn){pointerListener=fn;}};}
 render(){}
}
class Vec{constructor(x,y,z){this.x=x;this.y=y;this.z=z;}}
const BABYLON={Engine,Scene,PointerEventTypes:{POINTERPICK:1,POINTERDOWN:2,POINTERUP:3,POINTERMOVE:4},ArcRotateCamera:Camera,HemisphericLight:class{},DirectionalLight:class{},
 StandardMaterial:Material,Vector3:Vec,Color3:Vec,Color4:Vec,
 MeshBuilder:{CreateGround(){return new Mesh();},
  CreateCapsule(){meshCreates++;return new Mesh();},
  CreateSphere(){meshCreates++;return new Mesh();},
  CreateCylinder(){meshCreates++;return new Mesh();}}
};
const savedData=new Map();
// Older demo mission completion is intentionally reset when no v2 economy exists.
savedData.set("ashes-throne.campaign.v1",JSON.stringify({version:2,
 completed:{"black-pass-ambush":true},bestStars:{"black-pass-ambush":3}}));
const localStorage={getItem:k=>savedData.has(k)?savedData.get(k):null,setItem:(k,v)=>savedData.set(k,v)};
liveWindow.localStorage=localStorage;
const timers=new Map();
const scheduledDelays=new Map();
let nextTimer=0;
function fakeSetTimeout(fn,delay){
 const id=++nextTimer;timers.set(id,fn);scheduledDelays.set(id,delay);return id;
}
function fakeClearTimeout(id){timers.delete(id);scheduledDelays.delete(id);}
function pendingDelay(){return scheduledDelays.values().next().value;}
function flushVisual(){
 let frames=0;
 while(api.isVisualTransition()&&frames++<250)api.renderBattleFrame();
 assert.ok(frames<250,"visual transition should complete");
}
function tick(){
 const first=timers.entries().next().value;
 assert.ok(first,"expected pending autobattle step");
 timers.delete(first[0]);scheduledDelays.delete(first[0]);first[1]();
}
const api=vm.runInNewContext(src+
 "\n({getBattle:()=>state,getCurrency:()=>progress.currency,getEnergy:()=>progress.energy.value,getEnergyState:()=>progress.energy,getGearMaterials:()=>progress.gearMaterials,getAccountXp:()=>progress.accountXp,getCampaignCompleted:()=>campaignProgress.completed[CampaignCore.MISSION_ID],getLevel:id=>ProgressCore.levelOf(progress,id),selectedParty:()=>selectedPartyIds.slice(),resetLegacySquad:()=>{selectedLeaderId=null;selectedPartyIds=['kael','lyra','darin'];},getCampaignProgress:()=>campaignProgress,getChallengeProgress:()=>challengeProgress,getChallengeState:()=>({id:activeChallengeId,tracker:challengeTracker}),openChallenge,renderChallenges,CombatCore,showScreen,openSquad,openHeroDetail,renderSquad,syncBattleUI, isAuto:()=>autoBattle, getSpeed:()=>BattleSpeed.get(), getAnimationSpeed:()=>BattleSpeed.multiplier(), getMotion:()=>BattleAnimation, getMeshes:()=>meshes, getArenaCamera:()=>arenaCamera, formationPosition, renderTargetFighterHud, renderBattleFrame, isVisualTransition, getVisualFighters:()=>presentationFighters(), enemyTemplates:()=>ENEMIES, configuredLineup:()=>battleLineup(), setAutoSpeed})",
 {document,window:liveWindow,BABYLON,setTimeout:fakeSetTimeout,clearTimeout:fakeClearTimeout});
// Campaign regression fixture: preserve historical three-hero combat expectations.
api.resetLegacySquad();
function click(el){const h=el.handlers.click;assert.ok(h?.length,"missing click handler");h[0]();
 // This legacy campaign test accepts the warning to exercise existing combat cases.
 if(el===elements.squadStart&&!elements.squadWarning.hidden)h[0]();
}
elements.campaignMissions.contains=()=>true;
function clickMission(id="black-pass-ambush"){
 const button={dataset:{campaignMission:id}};
 elements.campaignMissions.handlers.click[0]({target:{closest:()=>button}});
}
function toggle(id){click(chooseNodes.find(el=>el.dataset.heroId===id));}
const allyIds=()=>api.getBattle().fighters.filter(h=>h.side==="ally").map(h=>h.id).join(",");
const count=()=>elements.squadCount.textContent;


// REN-001: biography button is reachable for trial-only Ren without
// pretending he has been recruited into the permanent collection.
{
 click(elements.storyDemoOpen);
 assert.match(elements.storyRenTags.textContent,/Сады над пропастью/);
 click(elements.storyRenBiography);
 assert.equal(elements.heroBiographyDialog.open,true);
 assert.equal(elements.heroBiographyPortrait.hidden,false,"Ren draft portrait shown only for Ren");
 assert.equal(elements.heroBiographyTitle.textContent,"Рен Терен");
 assert.match(elements.heroBiographyTags.textContent,/Сады над пропастью/);
 assert.match(elements.heroBiographyText.textContent,/Косой Полке/);
 assert.match(elements.heroBiographyText.textContent,/Эле Терен/);
 assert.doesNotMatch(elements.heroBiographyText.textContent,/магический|военачальник/);
 click(elements.heroBiographyClose);
 assert.equal(elements.heroBiographyDialog.open,false);
 assert.ok(elements.detailBiography.handlers.click?.length>0,"future permanent dossier uses shared biography button");
 api.showScreen("home");
}
// STORY-001: integrated user path through actual buttons, squad, combat and epilogue.
{
 const completedBefore=JSON.stringify(api.getCampaignProgress());
 const currencyBefore=api.getCurrency(),energyBefore=api.getEnergy();
 click(elements.storyDemoOpen);
 assert.equal(elements.storyDemoSpeaker.textContent,"Сады над пропастью");
 assert.match(elements.storyDemoText.textContent,/ущелья/);
 for(let i=0;i<7;i++)click(elements.storyDemoNext);
 assert.equal(elements.storyDemoNext.hidden,true);
 assert.equal(elements.storyDemoChoices.hidden,false);
 click(elements.storyDemoChoiceB);
 assert.equal(elements.storyDemoSpeaker.textContent,"Нада");
 assert.equal(elements.storyDemoFight.hidden,false);
 click(elements.storyDemoFight);
 assert.equal(elements.squad.classList.contains("active"),true);
 click(elements.squadBack);
 assert.equal(elements.storyDemo.classList.contains("active"),true);
 assert.equal(elements.storyDemoFight.hidden,false,"back from squad should allow retry");
 click(elements.storyDemoFight);
 click(elements.squadStart);
 assert.equal(elements.battle.classList.contains("active"),true);
 assert.equal(api.getBattle().fighters.find(f=>f.id==="ves").name,"Старший охраны");
 assert.equal(api.getBattle().fighters.find(f=>f.id==="shade").name,"Наёмный охранник");
 // Headless terminal victory invokes exactly the same story exit as a resolved
 // 3D battle, while leaving campaign stars, currency and energy untouched.
 api.getBattle().active=false;
 api.getBattle().winner="ally";
 api.syncBattleUI();
 assert.equal(elements.storyDemo.classList.contains("active"),true);
 assert.match(elements.storyDemoText.textContent,/Оригиналы записей/);
 click(elements.storyDemoChoiceA);
 assert.match(elements.storyDemoText.textContent,/Нада сверяет/);
 assert.equal(JSON.stringify(api.getCampaignProgress()),completedBefore);
 assert.equal(api.getCurrency(),currencyBefore);
 assert.equal(api.getEnergy(),energyBefore);
 click(elements.storyDemoAgain);
 assert.equal(elements.storyDemoSpeaker.textContent,"Сады над пропастью");
 api.showScreen("home");
}

// STORY-002: the literary characters fight only in the ephemeral trial party.
// The real saved roster and energy stay unchanged; repeat after defeat works.
{
 const savedBefore=JSON.stringify(api.getCampaignProgress());
 const walletBefore=api.getCurrency(),energyBefore=api.getEnergy();
 click(elements.storyDemoOpen);
 for(let i=0;i<7;i++)click(elements.storyDemoNext);
 click(elements.storyDemoChoiceA);
 assert.equal(elements.storyDemoTrialFight.hidden,false);
 click(elements.storyDemoTrialFight);
 assert.equal(elements.battle.classList.contains("active"),true);
 assert.equal(api.getBattle().fighters.filter(f=>f.side==="ally").map(f=>f.id).join(","),
  "trial-ren,trial-nada,trial-liora");
 assert.equal(api.getBattle().fighters.find(f=>f.id==="trial-nada").name,"Нада");
 api.getBattle().active=false;
 api.getBattle().winner="enemy";
 api.syncBattleUI();
 assert.equal(elements.storyDemo.classList.contains("active"),true);
 assert.equal(elements.storyDemoSpeaker.textContent,"Попытка не удалась");
 click(elements.storyDemoAgain);
 assert.match(elements.storyDemoText.textContent,/ущелья/);
 assert.equal(JSON.stringify(api.getCampaignProgress()),savedBefore);
 assert.equal(api.getCurrency(),walletBefore);
 assert.equal(api.getEnergy(),energyBefore);
 api.showScreen("home");
}
// Campaign entrance, not generic arena, activates the mission result screen.
api.showScreen("campaign");
assert.match(elements.campaignMissions.innerHTML,/Не пройдено/);
assert.match(elements.campaignMissions.innerHTML,/Основной путь/);
assert.match(elements.campaignMissions.innerHTML,/Засада у Чёрного перевала/);
const cards=elements.campaignMissions.innerHTML.split('<article class="campaign-panel campaign-mission">').slice(1);
assert.equal(cards.length,3,"three mission cards must render");
assert.match(cards[0],/8 действий союзников или меньше/,"first mission must show its own 3-star condition");
assert.doesNotMatch(cards[0],/9 действий союзников или меньше/,"first mission must not show second mission condition");
assert.match(cards[1],/9 действий союзников или меньше/,"second mission must show its own 3-star condition");
assert.match(cards[2],/18 действий союзников или меньше/,"third mission shows the wave-wide 3-star criterion");
for(const card of cards){
 assert.match(card,/Условия получения звёзд/);
 assert.match(card,/1★/);
 assert.match(card,/2★/);
 assert.match(card,/3★/);
}
assert.match(elements.campaignMissions.innerHTML,/Заблокировано/,"second mission stays locked until first victory");
clickMission();
assert.equal(elements.squad.classList.active,true);
click(elements.squadStart);
assert.equal(api.getEnergy(),230,"first manual mission entry spends 10 energy");
assert.equal(elements.battle.classList.active,true);
assert.equal(document.body.classList.contains("battle-mode"),true,"battle hides document scroll behind fullscreen arena");
// iPhone Safari portrait -> landscape: defer resize until CSS layout is committed.
assert.equal(typeof viewportEvents.orientationchange,"function");
assert.equal(typeof viewportEvents["visual-resize"],"function");
assert.equal(typeof viewportEvents.observer,"function","observe the canvas container");
const activeCamera=api.getArenaCamera();
activeCamera.alpha=0; // A user-adjusted view is reset only when returning from portrait.
liveWindow.innerWidth=390;liveWindow.innerHeight=844;
viewportEvents.orientationchange();flushRaf();
assert.equal(activeCamera.alpha,0,"portrait resize does not force camera reset");
assert.equal(elements.orientationPrompt.hidden,false,"portrait hint is visible while phone is upright");
const beforeLandscapeResize=resizes;
liveWindow.innerWidth=844;liveWindow.innerHeight=390;
viewportEvents.orientationchange();
viewportEvents.resize();
viewportEvents["visual-resize"]();
viewportEvents.observer();
assert.equal(resizes,beforeLandscapeResize,"resize is deferred until layout settles");
flushRaf();
assert.equal(resizes,beforeLandscapeResize+1,"all events coalesce to one Babylon resize");
assert.equal(activeCamera.alpha,-3*Math.PI/4,"landscape return restores isometric camera");
assert.equal(activeCamera.radius,12,"landscape return keeps approved max zoom");
assert.equal(elements.orientationPrompt.hidden,true,"landscape removes portrait touch shield");
// Regression: UI callbacks must still respond after portrait -> landscape.
const speedBeforeTap=api.getSpeed();
click(elements.autoSpeedBtn);
assert.equal(api.getSpeed(),speedBeforeTap===1?2:4,"speed button still responds after rotation");
click(elements.autoSpeedBtn);
click(elements.autoSpeedBtn);
assert.equal(api.getSpeed(),speedBeforeTap,"speed restored for subsequent battle regressions");
assert.ok(elements.specialAbilityBtn.handlers.click.length>0,"special ability direct-cast handler survives rotation");
assert.ok(elements.basicAbilityBtn.handlers.click.length>0,"basic ability direct-cast handler survives rotation");
assert.equal(api.getBattle().allyActions,0,"rotation controls do not trigger an attack");
const enemyPickBefore=api.getBattle().selectedEnemy;
pointerListener({type:1,pickInfo:{pickedMesh:api.getMeshes().shade.body}});
assert.equal(api.getBattle().fighters[api.getBattle().selectedEnemy].id,"shade","3D picking still works after rotation");


// Formation contract for teams of 1 to 5 without changing the roster or save schema.
const positions=n=>Array.from({length:n},(_,i)=>api.formationPosition("ally",i,n));
assert.equal(positions(5).map(p=>p.x).join(","),"-2.45,-2.45,-2.45,-4.05,-4.05");
assert.equal(positions(5).map(p=>p.z).join(","),"-1.9,0,1.9,-0.95,0.95");
assert.equal(positions(4).map(p=>p.x).join(","),"-2.45,-2.45,-2.45,-4.05");
assert.equal(positions(2).map(p=>p.x).join(","),"-2.45,-2.45");
assert.equal(positions(1)[0].z,0);
const first=api.getBattle();
assert.ok(first.fighters.filter(h=>h.side==="enemy").every(h=>!h.aiProfile),
 "profiles are not hardcoded into mission templates");
const firstEnemy=first.fighters[first.selectedEnemy];
assert.equal(elements.targetFighterName.textContent,firstEnemy.name,"top-right shows the initially selected target");
assert.equal(elements.targetFighterLevel.textContent,"","enemy level is not invented");
assert.match(elements.targetFighterHp.textContent,/HP [0-9]+\/[0-9]+/);
assert.match(elements.targetFighterStats.textContent,/АТК [0-9]+ · СКР [0-9]+/);
assert.equal(elements.targetFighterHealthFill.style.width,"100%");
assert.equal(elements.targetFighterSide.textContent,"ЦЕЛЬ: ПРОТИВНИК");
assert.equal(typeof pointerListener,"function","arena pointer listener registered");
assert.ok(elements.renderCanvas.handlers.pointerdown?.length,"native orbit pointerdown registered");
assert.ok(elements.renderCanvas.handlers.pointermove?.length,"native orbit pointermove registered");
const drag=(type,pointerId,x,y)=>elements.renderCanvas.handlers[type][0]({pointerId,clientX:x,clientY:y,pointerType:"touch",button:0});
const camera=api.getArenaCamera();
const originalAlpha=camera.alpha,originalBeta=camera.beta,originalRadius=camera.radius;
drag("pointerdown",71,90,90);
drag("pointermove",71,170,120);
assert.notEqual(camera.alpha,originalAlpha,"single-finger drag rotates camera horizontally");
assert.notEqual(camera.beta,originalBeta,"single-finger drag rotates camera vertically");
drag("pointerup",71,170,120);
const orbitAfterUp=camera.alpha;
drag("pointermove",71,220,120);
assert.equal(camera.alpha,orbitAfterUp,"released finger no longer rotates camera");
drag("pointerdown",72,100,100);
drag("pointerdown",73,200,100);
drag("pointermove",73,160,100);
assert.ok(camera.radius>originalRadius,"pinch in zooms out");
const zoomedOutRadius=camera.radius;
drag("pointermove",73,220,100);
assert.ok(camera.radius<zoomedOutRadius,"pinch out zooms back toward the arena");
drag("pointerup",72,100,100);
drag("pointerup",73,220,100);
assert.ok(camera.radius>=camera.lowerRadiusLimit&&camera.radius<=camera.upperRadiusLimit,"pinch respects camera zoom limits");
api.getArenaCamera().alpha=originalAlpha;
api.getArenaCamera().beta=originalBeta;
api.getArenaCamera().radius=originalRadius;

const secondEnemy=first.fighters.filter(f=>f.side==="enemy")[1];
pointerListener({type:1,pickInfo:{pickedMesh:api.getMeshes()[secondEnemy.id].body}});
assert.equal(first.fighters[first.selectedEnemy].id,secondEnemy.id,"arena tap selects enemy");
assert.equal(elements.targetFighterName.textContent,secondEnemy.name,"target card follows arena selection");
assert.equal(elements.targetFighterHud.classList.enemy,true);
assert.equal((elements.arenaIndicators.innerHTML.match(/arena-focus-cursor/g)||[]).length,1,"one attack focus cursor");
assert.match(elements.arenaIndicators.innerHTML,/arena-focus-cursor locked/);
// Holding an ability previews the actual effect without applying it.
const hintDown={pointerId:21,pointerType:"touch",clientX:40,clientY:25};
const actionsBeforeHint=first.allyActions;
elements.basicAbilitySlot.handlers.pointerdown[0](hintDown);
assert.equal(pendingDelay(),400,"ability hint shares 400ms hold");
elements.basicAbilitySlot.handlers.pointerleave[0]();
assert.equal(timers.size,0,"moving off ability cancels pending tooltip");
elements.basicAbilitySlot.handlers.pointerdown[0](hintDown);
tick();
assert.equal(elements.abilityTooltip.hidden,false);
assert.match(elements.abilityTooltipTitle.textContent,/Базовая атака/);
assert.match(elements.abilityTooltipText.textContent,/Урон: 100%/);
click(elements.basicAbilityBtn);
assert.equal(first.allyActions,actionsBeforeHint,"hold must never cast even if click follows");
elements.specialAbilitySlot.handlers.pointerdown[0]({pointerId:23,pointerType:"touch",clientX:90,clientY:25});
tick();
assert.equal(elements.abilityTooltip.hidden,false,"special skill also has long-press hint");
assert.equal(elements.abilityTooltipTitle.textContent,"Ослабляющий удар");
assert.match(elements.abilityTooltipText.textContent,/Ослабление на 2 атаки/);
click(elements.specialAbilityBtn);
assert.equal(first.allyActions,actionsBeforeHint,"holding special cannot cast it");
domEvents.pointerdown.forEach(fn=>fn({target:{closest(){return null}}}));
assert.equal(elements.abilityTooltip.hidden,true,"tap on any other UI area closes hint");

pointerListener({type:2,event:{pointerId:22,pointerType:"touch",clientX:0,clientY:0},pickInfo:null});
assert.equal(elements.abilityTooltip.hidden,true,"tapping empty arena closes ability tooltip");
// A long press reveals combat stats of any fighter without selecting them.
const selectedBeforeInspect=first.selectedEnemy;
const holdEvent=(pointerId=11,x=40,y=40)=>({pointerId,clientX:x,clientY:y,pointerType:"touch"});
pointerListener({type:2,event:holdEvent(),pickInfo:{pickedMesh:api.getMeshes().kael.head}});
assert.equal(timers.size,1,"one pending long-press timer");
assert.equal(pendingDelay(),400,"inspector opens after reduced 400ms hold");
pointerListener({type:4,event:holdEvent(11,65,40)});
assert.equal(timers.size,0,"moving finger cancels long press");
pointerListener({type:2,event:holdEvent(14),pickInfo:{pickedMesh:api.getMeshes().kael.head}});
assert.equal(timers.size,1,"long press can be started again");
elements.renderCanvas.handlers.pointercancel.forEach(fn=>fn({pointerId:14}));
assert.equal(timers.size,0,"Safari native pointercancel clears pending inspection");
pointerListener({type:2,event:holdEvent(15),pickInfo:{pickedMesh:api.getMeshes().kael.head}});
elements.renderCanvas.handlers.lostpointercapture.forEach(fn=>fn({pointerId:15}));
assert.equal(timers.size,0,"lost pointer capture clears pending inspection");
assert.equal(elements.fighterInspect.hidden!==false,true);
pointerListener({type:2,event:holdEvent(),pickInfo:{pickedMesh:api.getMeshes().kael.head}});
tick();
assert.equal(elements.fighterInspect.hidden,false,"long press opens inspection");
assert.equal(elements.inspectName.textContent,"Каэль Ворон");
assert.match(elements.inspectRole.textContent,/Уровень [0-9]+/);
assert.match(elements.inspectStats.textContent,/Инициатива:/);
assert.equal(first.selectedEnemy,selectedBeforeInspect,"long press never selects ally for attack");
pointerListener({type:3,event:holdEvent()});
pointerListener({type:1,pickInfo:{pickedMesh:api.getMeshes().kael.head}});
assert.equal(first.selectedEnemy,selectedBeforeInspect,"release after hold cannot select fighter");
click(elements.inspectClose);
assert.equal(elements.fighterInspect.hidden,true,"close button hides inspection");
pointerListener({type:2,event:holdEvent(12),pickInfo:{pickedMesh:api.getMeshes()[secondEnemy.id].body}});
tick();
assert.equal(elements.inspectName.textContent,secondEnemy.name,"enemy can also be inspected");
assert.doesNotMatch(elements.inspectRole.textContent,/Уровень/,"enemy has no invented level");
viewportEvents.orientationchange();flushRaf();
assert.equal(elements.fighterInspect.hidden,true,"rotation closes inspection and frees touch targets");
pointerListener({type:2,event:holdEvent(16),pickInfo:{pickedMesh:api.getMeshes()[secondEnemy.id].body}});
tick();
assert.equal(elements.fighterInspect.hidden,false,"inspection still works after rotation");
click(elements.inspectClose);
pointerListener({type:2,event:holdEvent(13),pickInfo:{pickedMesh:api.getMeshes()[firstEnemy.id].body}});
pointerListener({type:3,event:holdEvent(13)});
assert.equal(timers.size,0,"short press clears timer without opening dialog");
pointerListener({type:1,pickInfo:{pickedMesh:api.getMeshes()[firstEnemy.id].body}});
assert.equal(first.fighters[first.selectedEnemy].id,firstEnemy.id,"short tap still selects enemy");
pointerListener({type:1,pickInfo:{pickedMesh:api.getMeshes()[secondEnemy.id].body}});
assert.equal(first.fighters[first.selectedEnemy].id,secondEnemy.id,"ordinary targeting remains intact");

// Kael's support skill first highlights every ally, then a 3D ally tap casts.
const originalIndex=first.currentActor;
first.currentActor=first.fighters.findIndex(f=>f.id==="kael");
const previousKaelMeter=first.fighters[first.currentActor].meter;
first.fighters[first.currentActor].meter=1000;
const allyActionsBefore=first.allyActions;
click(elements.specialAbilityBtn);
assert.equal(first.allyActions,allyActionsBefore,"arming support has no effect");
assert.equal((elements.arenaIndicators.innerHTML.match(/arena-focus-cursor available/g)||[]).length,3,"all living allies show cursor");
assert.equal(elements.arenaIndicators.innerHTML.includes("arena-focus-cursor locked"),false,"enemy cursor hides during support");
const allyTarget=first.fighters.find(f=>f.id==="lyra");
assert.equal(elements.targetFighterSide.textContent,"ЦЕЛЬ: СОЮЗНИК");
pointerListener({type:1,pickInfo:{pickedMesh:api.getMeshes()[allyTarget.id].head}});
assert.equal(first.fighters[first.selectedAlly].id,allyTarget.id);
assert.equal(first.allyActions,allyActionsBefore+1,"tapping ally casts support immediately");
assert.equal(allyTarget.guardHits,2);
assert.equal(elements.targetFighterName.textContent,secondEnemy.name,"after casting, focus returns to enemy");
assert.equal(elements.targetFighterHud.classList.enemy,true);
first.fighters[first.currentActor].meter=previousKaelMeter;
first.currentActor=originalIndex;
api.syncBattleUI();
pointerListener({type:1,pickInfo:{pickedMesh:api.getMeshes().kael.head}});
assert.equal(first.fighters[first.selectedEnemy].id,secondEnemy.id,"ally tap cannot switch an enemy attack target");
assert.equal(api.getMeshes()[secondEnemy.id].base.material.emissiveColor.x,.48,"target stays highlighted");
const indicatorMarkup=elements.arenaIndicators.innerHTML;
assert.match(indicatorMarkup,/class="arena-indicator ally/,"allied 3D labels are rendered");
assert.match(indicatorMarkup,/class="arena-indicator enemy/,"enemy 3D labels are rendered");
assert.match(indicatorMarkup,/class="arena-health"/,"HP bar is present");
assert.match(indicatorMarkup,/class="arena-initiative"/,"real initiative bar is present");
assert.match(indicatorMarkup,/инициатива [0-9]+ из 1000/,"initiative comes from state");
first.fighters[0].hp=Math.max(1,first.fighters[0].maxHp-12);
first.fighters[0].guardHits=2;
first.fighters[0].weakenAttacks=3;
api.syncBattleUI();
assert.match(elements.arenaIndicators.innerHTML,/◆2/,"guard stacks appear above fighter");
assert.match(elements.arenaIndicators.innerHTML,/↓3/,"weakening stacks appear above fighter");
assert.match(elements.arenaIndicators.innerHTML,/width:90%/,"HP percent reflects damage");

first.active=false;first.winner="enemy";
api.syncBattleUI();
assert.equal(elements.missionResult.classList.active,true,"defeat must show result screen");
assert.equal(elements.targetFighterName.textContent,"Бой завершён","finished battle clears stale actor");
assert.equal(elements.targetFighterLevel.textContent,"","finished battle clears level");
assert.equal(document.body.classList.contains("battle-mode"),false,"leaving battle restores document scroll");
assert.match(elements.missionResultTitle.textContent,/не пройдена/);
assert.equal(api.getCurrency(),0);
assert.equal(api.getCampaignCompleted(),false);
click(elements.missionResultRetry);
assert.equal(api.getEnergy(),230,"defeat retains entry cost");
assert.equal(elements.squad.classList.active,true,"retry returns to squad preparation");
click(elements.squadStart);
assert.equal(api.getEnergy(),220,"retry charges energy again");
assert.equal(elements.battle.classList.active,true);
const win=api.getBattle();
win.active=false;win.winner="ally";
api.syncBattleUI();
assert.equal(elements.missionResult.classList.active,true);
assert.equal(api.getCurrency(),500);
assert.equal(api.getCampaignCompleted(),true);
assert.match(elements.missionResultText.textContent,/\+500 валюты/);
assert.ok(savedData.has("ashes-throne.campaign.v1"));
assert.ok(savedData.has("ashes-throne.progress.v2"));
api.syncBattleUI();
assert.equal(api.getCurrency(),500,"re-render must not grant a second reward");
click(elements.missionResultBack);
assert.equal(elements.campaign.classList.active,true);
assert.match(elements.campaignMissions.innerHTML,/Пройдено/);
// Completed mission replays remain available but cannot repeat first-clear rewards.
clickMission();
click(elements.squadStart);
const replay=api.getBattle();
replay.active=false;replay.winner="ally";
api.syncBattleUI();
assert.equal(api.getCurrency(),500);
assert.match(elements.missionResultText.textContent,/Повтор без экономических наград/);
assert.equal(api.getCampaignCompleted(),true);
// New JS instance restores campaign flag, levels and materials.
const reloaded=vm.runInNewContext(src+"\n({campaign:campaignProgress,currency:progress.currency})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
assert.equal(reloaded.campaign.completed["black-pass-ambush"],true);
assert.equal(reloaded.currency,500);
// Combat-008C hotfix: each side uses up to three front / two rear positions.
api.showScreen("campaign");
clickMission("demo-mission-2");
click(elements.squadStart);
const largeRoster=api.getBattle().fighters.filter(f=>f.side==="enemy");
assert.equal(largeRoster.length,5);
assert.ok(largeRoster.every(f=>!f.aiProfile),
 "all mission enemies inherit the shared aggressive behavior without profile wiring");
assert.equal(largeRoster.find(f=>f.id==="shade").hp,78);
assert.equal(largeRoster.find(f=>f.id==="shade").atk,22);
assert.equal(largeRoster.find(f=>f.id==="shade").speed,135);
assert.ok(api.enemyTemplates().every(f=>!f.aiProfile),
 "universal policy must not modify shared ENEMIES/HEROES");
const nextLineup=api.configuredLineup().filter(f=>f.side==="enemy");
assert.ok(nextLineup.every(f=>!f.aiProfile),
 "new battle/retry uses the global enemy policy with no special flags");
assert.ok(nextLineup.every(f=>f!==api.enemyTemplates().find(e=>e.id===f.id)),
 "each encounter enemy must be a clone of its template");
const renderedZ=largeRoster.map(f=>api.getMeshes()[f.id].body.position.z);
assert.equal(renderedZ.join(","),"-1.9,0,1.9,-0.95,0.95","five enemies are arranged three forward and two behind");
assert.equal(largeRoster.map(f=>api.getMeshes()[f.id].body.position.x).join(","),"2.45,2.45,2.45,4.05,4.05","enemy rows face the allied side");
const alliesInBattle=api.getBattle().fighters.filter(f=>f.side==="ally");
// Actual initiative cycle: all enemy templates target the weakest living hero.
// Test-only speeds isolate one turn to check both a real and copied enemy.
const isolatedAllies=alliesInBattle.map((f,i)=>({...f,hp:i===1?50:100,speed:110}));
const isolatedEnemies=largeRoster.map(f=>({...f,speed:f.id==="shade"?135:1}));
const pilot=api.CombatCore.createBattle([...isolatedAllies,...isolatedEnemies]);
api.CombatCore.advanceToPlayerTurn(pilot);
assert.equal(pilot.events[0].actorId,"shade");
assert.equal(pilot.events[0].targetId,isolatedAllies[1].id,
 "shade attacks the lowest-current-HP hero through shared AI");
const anotherEnemy=api.CombatCore.createBattle([...isolatedAllies,
 ...isolatedEnemies.map(f=>({...f,speed:f.id==="ves-3"?150:1}))]);
api.CombatCore.advanceToPlayerTurn(anotherEnemy);
assert.equal(anotherEnemy.events[0].actorId,"ves-3");
assert.equal(anotherEnemy.events[0].targetId,isolatedAllies[1].id,
 "unconfigured enemy copies also focus the weakest living hero");
assert.equal(pilot.allyActions,0);
assert.equal(anotherEnemy.allyActions,0);
assert.equal(alliesInBattle.map(f=>api.getMeshes()[f.id].body.position.x).join(","),"-2.45,-2.45,-2.45","three chosen allies take front row");
api.showScreen("campaign");
// Integration: third mission starts with two enemies and advances to three
// without showing a result, granting an intermediate reward or restarting allies.
api.getCampaignProgress().completed["demo-mission-2"]=true;
api.getCampaignProgress().bestStars["demo-mission-2"]=1;
api.showScreen("campaign");
clickMission("demo-mission-3");
assert.equal(elements.squad.classList.active,true,"third mission opens after second");
click(elements.squadStart);
const waveBattle=api.getBattle();
assert.equal(waveBattle.wave,1);
assert.equal(waveBattle.totalWaves,2);
assert.equal(waveBattle.fighters.filter(h=>h.side==="enemy").length,2);
assert.ok(waveBattle.fighters.filter(h=>h.side==="enemy").every(h=>!h.aiProfile),
 "third mission uses no per-mission AI profiles");
assert.match(elements.turnChip.textContent,/Волна 1\/2/);
const currencyBeforeWaves=api.getCurrency();
const heroBeforeWave=waveBattle.fighters.find(f=>f.side==="ally");
heroBeforeWave.hp-=3;
const health=heroBeforeWave.hp;
waveBattle.fighters.filter(f=>f.side==="enemy").forEach(f=>{f.hp=0;});
api.CombatCore.advanceToPlayerTurn(waveBattle);
api.syncBattleUI();
assert.equal(waveBattle.wave,2);
assert.equal(waveBattle.active,true);
assert.equal(waveBattle.winner,null);
assert.equal(waveBattle.fighters.filter(f=>f.side==="enemy").length,3);
assert.ok(waveBattle.fighters.filter(h=>h.side==="enemy").every(h=>!h.aiProfile),
 "future waves use no per-mission AI profiles");
assert.match(elements.turnChip.textContent,/Волна 2\/2/);
assert.equal(waveBattle.fighters.find(f=>f.id===heroBeforeWave.id).hp,health);
assert.equal(api.getCurrency(),currencyBeforeWaves,"first wave cannot grant reward");
assert.equal(elements.battle.classList.active,true,"do not show mission result between waves");
waveBattle.fighters.filter(f=>f.side==="enemy").forEach(f=>{f.hp=0;});
api.CombatCore.advanceToPlayerTurn(waveBattle);
api.syncBattleUI();
assert.equal(waveBattle.winner,"ally");
assert.equal(elements.missionResult.classList.active,true);
assert.equal(api.getCurrency(),currencyBeforeWaves+900,"third mission first clear gives 900 currency");
api.syncBattleUI();
assert.equal(api.getCurrency(),currencyBeforeWaves+900,"repeated UI sync cannot duplicate final wave reward");
// Return home from mission result does not affect persistent status.
click(elements.missionResultHome);
assert.equal(elements.home.classList.active,true);
// Combat-004 integration: player may interrupt autoplay before a scheduled action.
api.showScreen("campaign");
clickMission("black-pass-ambush");
click(elements.squadStart);
assert.equal(api.isAuto(),false,"manual by default on every new battle");
assert.equal(timers.size,0);
assert.equal(elements.autoSpeedBtn.disabled,false,"speed is available before enabling autobattle");
click(elements.autoSpeedBtn);
assert.equal(api.getSpeed(),2,"manual mode sets playback speed");
assert.equal(api.getAnimationSpeed(),2,"future animations share the selected speed");
assert.equal(timers.size,0,"manual speed changes cannot schedule autoplay");
click(elements.autoBattleBtn);
assert.equal(api.isAuto(),true);
assert.equal(elements.autoBattleBtn["aria-pressed"],"true");
assert.equal(timers.size,1,"one action scheduled");
assert.equal(pendingDelay(),175,"autobattle starts at the speed selected manually");
assert.equal(elements.autoSpeedBtn.disabled,false);
assert.equal(elements.autoSpeedBtn.textContent,"2×");
click(elements.autoSpeedBtn);
assert.equal(api.getSpeed(),4);
assert.equal(elements.autoSpeedBtn.textContent,"4×");
assert.equal(pendingDelay(),88,"4x changes auto delay");
assert.equal(timers.size,1,"speed change replaces, not duplicates, a pending action");
click(elements.autoSpeedBtn);
assert.equal(api.getSpeed(),1);
assert.equal(api.getAnimationSpeed(),1,"the same speed is exposed to future animation drivers");
assert.equal(pendingDelay(),350,"1x resets the delay");
assert.equal(timers.size,1);
click(elements.autoSpeedBtn);
assert.equal(api.getSpeed(),2,"speed cycles back to 2x");
assert.equal(pendingDelay(),175);
const before=api.getBattle().allyActions;
click(elements.basicAbilityBtn);
assert.equal(api.getBattle().allyActions,before,"manual attack ignored during autobattle");
click(elements.autoBattleBtn);
assert.equal(api.isAuto(),false);
assert.equal(timers.size,0,"manual takeover cancels queued action");
assert.equal(elements.autoSpeedBtn.disabled,false,"speed is available after manual takeover");
assert.equal(api.setAutoSpeed(4),true,"speed may change during manual combat");
assert.equal(api.getSpeed(),4);
assert.equal(timers.size,0,"manual speed changes must not queue an attack");
assert.equal(api.getBattle().allyActions,before);
click(elements.autoBattleBtn);
assert.equal(timers.size,1);
assert.equal(pendingDelay(),88,"autobattle resumes at manually selected 4x");
tick();
assert.equal(api.getBattle().allyActions,before+1,"automatic action uses normal combat state");
assert.equal(timers.size,1,"exactly one next action scheduled");
assert.ok(api.getMotion().pending()>0,"resolved hits queue visible animations");
api.renderBattleFrame();
assert.ok(api.getMeshes().lyra.body.position.x>-2.45,"speed-scaled 3D lunge moves attacker from the new frontline");
api.showScreen("home");
assert.equal(api.getMotion().pending(),0,"exiting battle clears animation queue");
assert.equal(api.isAuto(),false);
assert.equal(timers.size,0,"leaving battle cancels pending automatic action");
assert.equal(api.getSpeed(),4,"leaving an encounter does not reset the shared speed until a new battle starts");
// Hidden tab pauses and visible tab resumes a single timer.
api.showScreen("campaign");
clickMission("black-pass-ambush");
click(elements.squadStart);
assert.equal(api.getSpeed(),4,"new battle retains the previously selected speed");
click(elements.autoBattleBtn);
click(elements.autoSpeedBtn);
assert.equal(api.getSpeed(),1,"speed cycles from persisted 4x to 1x");
assert.equal(pendingDelay(),350);
assert.equal(timers.size,1);
document.hidden=true;
visibilityListeners.forEach(fn=>fn());
assert.equal(timers.size,0,"switching to hidden tab cancels the timer");
assert.equal(elements.fighterInspect.hidden,true,"background hides any inspection overlay");
assert.equal(api.isAuto(),true,"auto preference remains on while hidden");
document.hidden=false;
visibilityListeners.forEach(fn=>fn());
assert.equal(timers.size,1,"visible tab resumes exactly one action");
assert.equal(pendingDelay(),350,"speed survives Safari visibility pause");
tick();
assert.ok(api.getBattle().allyActions>0);
api.showScreen("home");
assert.equal(api.isAuto(),false);
assert.equal(timers.size,0);
// Mission #3: autobattle crosses the wave boundary and rewards only once.
api.showScreen("campaign");
clickMission("demo-mission-3");
click(elements.squadStart);
const autoWaves=api.getBattle();
assert.equal(autoWaves.totalWaves,2);
assert.equal(api.getSpeed(),1,"new mission resets speed");
assert.equal(elements.autoSpeedBtn.disabled,false);
autoWaves.fighters.filter(f=>f.side==="enemy").forEach(f=>{f.hp=1;});
click(elements.autoBattleBtn);
click(elements.autoSpeedBtn);
click(elements.autoSpeedBtn);
assert.equal(api.getSpeed(),4);
assert.equal(pendingDelay(),88);
let actions=0;
while(autoWaves.wave===1&&autoWaves.active&&actions++<10)tick();
assert.equal(autoWaves.wave,2);
assert.equal(elements.battle.classList.active,true);
const rewardBeforeFinal=api.getCurrency();
assert.equal(api.isVisualTransition(),true,"wave switches core state before its visual transition");
assert.equal(api.getVisualFighters().filter(f=>f.side==="enemy").length,2,
 "old wave roster remains visible through queued hit/death animations");
assert.equal(timers.size,0,"next wave must not start while previous wave animations run");
flushVisual();
assert.equal(timers.size,1,"autobattle resumes after wave animations");
autoWaves.fighters.filter(f=>f.side==="enemy").forEach(f=>{f.hp=1;});
while(autoWaves.active&&actions++<25)tick();
assert.ok(actions<25,"auto must finish multi-wave mission");
assert.equal(autoWaves.winner,"ally");
assert.equal(api.isVisualTransition(),true,"battle result waits for final animation");
assert.equal(elements.missionResult.classList.active,false,"final screen must not interrupt death sequence");
assert.equal(api.getCurrency(),rewardBeforeFinal,"repeat victory gives no new currency while result animation runs");
assert.equal(timers.size,0,"last automatic action cancels further scheduling");
flushVisual();
assert.equal(api.getCurrency(),rewardBeforeFinal);
assert.equal(elements.missionResult.classList.active,true,"battle result opens after animation");
assert.equal(elements.autoSpeedBtn.disabled,true,"finished battle disables speed");
assert.equal(api.isAuto(),false,"auto mode clears on victory");
assert.equal(elements.missionResult.classList.active,true);
api.syncBattleUI();
assert.equal(api.getCurrency(),rewardBeforeFinal,"no duplicated reward after finished auto battle");
// Combat-006 manual victory: damage/reward computed by core immediately,
// but campaign navigation waits until the visual queue is exhausted.
api.showScreen("campaign");
clickMission("black-pass-ambush");
click(elements.squadStart);
const manualFinish=api.getBattle();
const rewardBeforeManual=api.getCurrency();
manualFinish.fighters.filter(f=>f.side==="enemy").forEach(f=>{f.hp=1;});
let manualActions=0;
while(manualFinish.active&&manualActions++<20)click(elements.basicAbilityBtn);
assert.ok(manualActions<20,"manual encounter completes");
assert.equal(manualFinish.winner,"ally");
assert.equal(api.isVisualTransition(),true);
assert.equal(elements.battle.classList.active,true,"manual final hit remains on arena");
assert.equal(elements.basicAbilityBtn.disabled,true,"abilities locked during final animation");
assert.equal(api.getCurrency(),rewardBeforeManual,"repeat manual victory must not grant currency");
api.syncBattleUI();
assert.equal(api.getCurrency(),rewardBeforeManual,"UI re-sync cannot duplicate reward during animation");
flushVisual();
assert.equal(elements.missionResult.classList.active,true);
assert.equal(api.getCurrency(),rewardBeforeManual,"visual handoff never awards twice");
api.syncBattleUI();
assert.equal(api.getCurrency(),rewardBeforeManual,"no duplicate manual victory reward");
// Exit during a pending result animation must cancel it, never show a stale result.
api.showScreen("campaign");
clickMission("black-pass-ambush");
click(elements.squadStart);
const interrupted=api.getBattle();
const rewardBeforeInterrupt=api.getCurrency();
interrupted.fighters.filter(f=>f.side==="enemy").forEach(f=>{f.hp=1;});
let interruptActions=0;
while(interrupted.active&&interruptActions++<20)click(elements.basicAbilityBtn);
assert.equal(api.isVisualTransition(),true);
assert.equal(api.getCurrency(),rewardBeforeInterrupt,"repeat combat does not mint currency before exit");
api.showScreen("home");
assert.equal(api.isVisualTransition(),false,"exit cancels pending visual handoff");
assert.equal(api.getMotion().pending(),0);
api.renderBattleFrame();
assert.equal(elements.home.classList.active,true,"no stale result on home screen");
// Combat-006 defeat: death animation holds the arena but cannot grant reward.
api.showScreen("campaign");
clickMission("black-pass-ambush");
click(elements.squadStart);
const losing=api.getBattle();
losing.fighters.filter(f=>f.side==="ally").forEach(f=>{f.hp=1;if(Number.isFinite(f.protection))f.protection=0;});
losing.fighters.filter(f=>f.side==="enemy").forEach(f=>{f.hp=10000;f.maxHp=10000;});
const beforeDefeatReward=api.getCurrency();
let defeatActions=0;
while(losing.active&&defeatActions++<35)click(elements.basicAbilityBtn);
assert.ok(defeatActions<35,"controlled losing battle should finish");
assert.equal(losing.winner,"enemy");
assert.equal(api.isVisualTransition(),true,"defeat waits for the last death animations");
assert.equal(elements.battle.classList.active,true,"arena stays visible until defeat animations finish");
assert.equal(api.getCurrency(),beforeDefeatReward,"defeat never grants a reward");
flushVisual();
assert.equal(elements.missionResult.classList.active,true);
assert.match(elements.missionResultTitle.textContent,/не пройдена/);
assert.equal(api.getCurrency(),beforeDefeatReward);
// Single simulation opens a batch slider only after 3★.
api.getCampaignProgress().bestStars["black-pass-ambush"]=3;
api.showScreen("campaign");
assert.match(elements.campaignMissions.innerHTML,/Стоимость входа: 10/);
assert.match(elements.campaignMissions.innerHTML,/data-simulate-mission="black-pass-ambush"/);
assert.doesNotMatch(elements.campaignMissions.innerHTML,/data-resource-farm/);
const energyBeforeFarm=api.getEnergy(),materialsBeforeFarm=api.getGearMaterials(),xpBeforeFarm=api.getAccountXp();
const simulateButton={dataset:{simulateMission:"black-pass-ambush"}};
elements.campaignMissions.handlers.click[0]({target:{closest:selector=>selector==="[data-simulate-mission]"?simulateButton:null}});
assert.equal(elements.simulationDialog.open,true);
assert.equal(elements.simulationSetup.hidden,false);
assert.equal(elements.simulationResults.hidden,true);
assert.equal(Number(elements.simulationCount.max),Math.floor(energyBeforeFarm/10));
elements.simulationCount.value="3";
elements.simulationCount.handlers.input[0]();
assert.equal(elements.simulationCost.textContent,"30 ⚡");
assert.equal(api.getEnergy(),energyBeforeFarm,"preview does not spend");
click(elements.simulationClose);
assert.equal(elements.simulationDialog.open,false,"cancel closes without a charge");
assert.equal(api.getEnergy(),energyBeforeFarm,"cancel must not charge energy");
elements.campaignMissions.handlers.click[0]({target:{closest:selector=>selector==="[data-simulate-mission]"?simulateButton:null}});
elements.simulationCount.value="3";elements.simulationCount.handlers.input[0]();
click(elements.simulationConfirm);
assert.equal(api.getEnergy(),energyBeforeFarm-30);
assert.equal(api.getGearMaterials(),materialsBeforeFarm+36);
assert.equal(api.getAccountXp(),xpBeforeFarm+15);
click(elements.simulationConfirm);
assert.equal(api.getEnergy(),energyBeforeFarm-30,"repeat confirm cannot duplicate charge");
assert.equal(api.getAccountXp(),xpBeforeFarm+15,"repeat confirm cannot duplicate reward");
assert.equal(elements.simulationResults.hidden,false);
assert.match(elements.simulationRewards.textContent,/36 материалов C/);
assert.equal(JSON.parse(savedData.get("ashes-throne.progress.v2")).energy.value,api.getEnergy());
click(elements.simulationClose);
assert.equal(elements.simulationDialog.open,false);
// The refresh control must visibly respond even when no six-minute tick elapsed.
api.showScreen("campaign");
click(elements.energyRefresh);
assert.match(elements.energyRefreshStatus.textContent,/полная|Следующая|Восстановлено/);
const energy=api.getEnergyState();
energy.value=100;
energy.updatedAt=Date.now()-2*360000-10000;
click(elements.energyRefresh);
assert.equal(api.getEnergy(),102,"refresh credits elapsed recovery ticks");
assert.match(elements.energyRefreshStatus.textContent,/Восстановлено: \+2/);
assert.equal(JSON.parse(savedData.get("ashes-throne.progress.v2")).energy.value,102,"refresh persists credited energy");
click(elements.energyRefresh);
assert.match(elements.energyRefreshStatus.textContent,/Пока без изменений/);
// CHAL002: real UI click path reuses this existing, battle-capable DOM harness.
elements.challengeList.contains=()=>true;
const beforeChallengeCampaign=JSON.stringify(api.getCampaignProgress());
const beforeChallengeCurrency=api.getCurrency(),beforeChallengeEnergy=api.getEnergy();
api.resetLegacySquad();
api.showScreen("challenges");
assert.equal(elements.challengeList.hidden,true);
function openKind(kind){
 const button={dataset:{challengeKind:kind}};
 elements.challengeModes.contains=()=>true;
 elements.challengeModes.handlers.click[0]({target:{closest:()=>button}});
}
openKind("tactical");
assert.match(elements.challengeList.innerHTML,/T-01/);
assert.match(elements.challengeList.innerHTML,/T-04/);
assert.doesNotMatch(elements.challengeList.innerHTML,/N-01/);
function selectChallenge(id){
 const button={dataset:{startChallenge:id}};
 elements.challengeList.handlers.click[0]({target:{closest:()=>button}});
 assert.equal(elements.squad.classList.active,true);
 click(elements.squadStart);
 assert.equal(elements.battle.classList.active,true);
 assert.equal(api.getChallengeState().id,id);
}
selectChallenge("T-01");
let challengeBattle=api.getBattle();
assert.equal(challengeBattle.totalWaves,1);
challengeBattle.fighters.filter(f=>f.side==="enemy").forEach(f=>{f.hp=1;});
let turns=0;
while(challengeBattle.active&&turns++<25)click(elements.basicAbilityBtn);
assert.ok(turns<25);
assert.equal(challengeBattle.winner,"ally");
flushVisual();
assert.equal(elements.challengeResult.classList.active,true);
assert.equal(api.getChallengeProgress().bestStars["T-01"],3);
assert.equal(JSON.parse(savedData.get("ashes-throne.challenges.v1")).bestStars["T-01"],3);
assert.equal(api.getCurrency(),beforeChallengeCurrency);
assert.equal(api.getEnergy(),beforeChallengeEnergy);
assert.equal(JSON.stringify(api.getCampaignProgress()),beforeChallengeCampaign);
click(elements.challengeResultBack);
assert.equal(elements.challenges.classList.active,true);
openKind("onslaught");
assert.match(elements.challengeList.innerHTML,/N-01/);
assert.match(elements.challengeList.innerHTML,/N-04/);
selectChallenge("N-01");
challengeBattle=api.getBattle();
assert.equal(challengeBattle.totalWaves,2);
challengeBattle.fighters.filter(f=>f.side==="enemy").forEach(f=>{f.hp=1;});
turns=0;
while(challengeBattle.active&&challengeBattle.wave===1&&turns++<25)click(elements.basicAbilityBtn);
assert.equal(challengeBattle.wave,2);
flushVisual();
challengeBattle.fighters.filter(f=>f.side==="enemy").forEach(f=>{f.hp=1;});
while(challengeBattle.active&&turns++<40)click(elements.basicAbilityBtn);
assert.ok(turns<40);
assert.equal(challengeBattle.winner,"ally");
flushVisual();
assert.equal(elements.challengeResult.classList.active,true);
assert.equal(api.getChallengeProgress().bestStars["N-01"],2);
assert.equal(JSON.parse(savedData.get("ashes-throne.challenges.v1")).bestStars["N-01"],2);
assert.equal(api.getCurrency(),beforeChallengeCurrency);
assert.equal(api.getEnergy(),beforeChallengeEnergy);
assert.equal(JSON.stringify(api.getCampaignProgress()),beforeChallengeCampaign);
click(elements.challengeResultRetry);
assert.equal(elements.squad.classList.active,true,"retry must reopen squad, not campaign or arena");
click(elements.squadBack);
assert.equal(elements.challenges.classList.active,true);
console.log("Challenges-001B UI: actual entry, squad, T-01, N-01 waves, scores, retry and economy isolation passed");
console.log("Campaign-001 UI: battle, wave, repeat, batch simulation and energy feedback passed");
