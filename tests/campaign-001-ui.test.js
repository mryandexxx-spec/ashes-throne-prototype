"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const src=["initiative-model.js","ability-data.js","combat-core.js","progress-core.js","save-core.js","mission-data.js","campaign-core.js","campaign-data.js","battle-speed.js","animation-profiles.js","battle-animation.js","game.js"].map(n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8")).join("\n");
const ids=["home","collection","campaign","squad","battle","heroList","combatants",
 "battleStatus","turnChip","actionTitle","actionHint","attackBtn","arenaIndicators","orientationPrompt",
 "fighterInspect","inspectClose","inspectSide","inspectName","inspectRole","inspectStats","inspectEffects",
 "targetFighterHud","targetFighterSide","targetFighterLevel","targetFighterName","targetFighterHp","targetFighterStats","targetFighterHealthFill",
 "basicAbilityBtn","specialAbilityBtn","autoBattleBtn","autoSpeedBtn","battleMessage","renderCanvas",
 "startBattle","campaignBattle","campaignMissions","squadBack","squadStart","squadRoster",
 "squadSlots","squadHint","squadCount","heroDetail","detailName","detailRole","detailGlyph","detailStats","detailLevel","detailWallet","detailCost","detailPreview","detailUpgrade","detailNotice","detailBack","detailHome","battleReward","campaignMissionStatus","campaignMissionStars","campaignChapterProgress","campaignSaveStatus","missionResult","missionResultTitle","missionResultText","missionResultStars","missionResultBack","missionResultRetry","missionResultHome"];
function element(id=""){
 return {id,dataset:{},innerHTML:"",textContent:"",disabled:false,handlers:{},style:{},
  classList:{active:id==="home",contains(x){return !!this[x]},add(x){this[x]=true},
   remove(x){this[x]=false},toggle(x,v){this[x]=!!v}},
  addEventListener(type,fn){(this.handlers[type]??=[]).push(fn)},
  setAttribute(name,value){this[name]=value}
 };
}
const elements=Object.fromEntries(ids.map(id=>[id,element(id)]));
const chooseNodes=["kael","lyra","darin"].map(id=>{
 const e=element();e.dataset.heroId=id;return e;
});
const heroNodes=["kael","lyra","darin"].map(id=>{const e=element();e.dataset.openHero=id;return e;});
const arenaNav=element();arenaNav.dataset.screen="battle";
const collectionNav=element();collectionNav.dataset.screen="collection";
const allScreens=["home","collection","campaign","squad","battle","heroDetail","missionResult"].map(id=>elements[id]);
const visibilityListeners=[];
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
 addEventListener(type,fn){if(type==="visibilitychange")visibilityListeners.push(fn)}
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
class Camera{attachControl(){}}
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
 "\n({getBattle:()=>state,getMaterials:()=>progress.materials,getCampaignCompleted:()=>campaignProgress.completed[CampaignCore.MISSION_ID],getLevel:id=>ProgressCore.levelOf(progress,id),selectedParty:()=>selectedPartyIds.slice(),getCampaignProgress:()=>campaignProgress,CombatCore,showScreen,openSquad,openHeroDetail,renderSquad,syncBattleUI, isAuto:()=>autoBattle, getSpeed:()=>BattleSpeed.get(), getAnimationSpeed:()=>BattleSpeed.multiplier(), getMotion:()=>BattleAnimation, getMeshes:()=>meshes, getArenaCamera:()=>arenaCamera, formationPosition, renderTargetFighterHud, renderBattleFrame, isVisualTransition, getVisualFighters:()=>presentationFighters(), setAutoSpeed})",
 {document,window:liveWindow,BABYLON,setTimeout:fakeSetTimeout,clearTimeout:fakeClearTimeout});
function click(el){const h=el.handlers.click;assert.ok(h?.length,"missing click handler");h[0]();}
elements.campaignMissions.contains=()=>true;
function clickMission(id="black-pass-ambush"){
 const button={dataset:{campaignMission:id}};
 elements.campaignMissions.handlers.click[0]({target:{closest:()=>button}});
}
function toggle(id){click(chooseNodes.find(el=>el.dataset.heroId===id));}
const allyIds=()=>api.getBattle().fighters.filter(h=>h.side==="ally").map(h=>h.id).join(",");
const count=()=>elements.squadCount.textContent;


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
click(elements.specialAbilityBtn);
assert.ok(elements.specialAbilityBtn.handlers.click.length>0,"special ability button still has its handler");
click(elements.basicAbilityBtn);
assert.equal(elements.basicAbilityBtn.classList.contains("selected"),true,"ability controls remain responsive");
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
const firstEnemy=first.fighters[first.selectedEnemy];
assert.equal(elements.targetFighterName.textContent,firstEnemy.name,"top-right shows the initially selected target");
assert.equal(elements.targetFighterLevel.textContent,"","enemy level is not invented");
assert.match(elements.targetFighterHp.textContent,/HP [0-9]+\/[0-9]+/);
assert.match(elements.targetFighterStats.textContent,/АТК [0-9]+ · СКР [0-9]+/);
assert.equal(elements.targetFighterHealthFill.style.width,"100%");
assert.equal(elements.targetFighterSide.textContent,"ЦЕЛЬ: ПРОТИВНИК");
assert.equal(typeof pointerListener,"function","arena pointer listener registered");
const secondEnemy=first.fighters.filter(f=>f.side==="enemy")[1];
pointerListener({type:1,pickInfo:{pickedMesh:api.getMeshes()[secondEnemy.id].body}});
assert.equal(first.fighters[first.selectedEnemy].id,secondEnemy.id,"arena tap selects enemy");
assert.equal(elements.targetFighterName.textContent,secondEnemy.name,"target card follows arena selection");
assert.equal(elements.targetFighterHud.classList.enemy,true);
// A long press reveals combat stats of any fighter without selecting them.
const selectedBeforeInspect=first.selectedEnemy;
const holdEvent=(pointerId=11,x=40,y=40)=>({pointerId,clientX:x,clientY:y,pointerType:"touch"});
pointerListener({type:2,event:holdEvent(),pickInfo:{pickedMesh:api.getMeshes().kael.head}});
assert.equal(timers.size,1,"one pending long-press timer");
pointerListener({type:4,event:holdEvent(11,65,40)});
assert.equal(timers.size,0,"moving finger cancels long press");
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
click(elements.inspectClose);
pointerListener({type:2,event:holdEvent(13),pickInfo:{pickedMesh:api.getMeshes()[firstEnemy.id].body}});
pointerListener({type:3,event:holdEvent(13)});
assert.equal(timers.size,0,"short press clears timer without opening dialog");
pointerListener({type:1,pickInfo:{pickedMesh:api.getMeshes()[firstEnemy.id].body}});
assert.equal(first.fighters[first.selectedEnemy].id,firstEnemy.id,"short tap still selects enemy");
pointerListener({type:1,pickInfo:{pickedMesh:api.getMeshes()[secondEnemy.id].body}});
assert.equal(first.fighters[first.selectedEnemy].id,secondEnemy.id,"ordinary targeting remains intact");

// Guard is targeted at an ally; the same card must now follow the allied target.
const originalIndex=first.currentActor;
first.currentActor=first.fighters.findIndex(f=>f.id==="kael");
const previousKaelMeter=first.fighters[first.currentActor].meter;
first.fighters[first.currentActor].meter=1000; // Simulate Kael actually reaching his turn.
click(elements.specialAbilityBtn);
const allyTarget=first.fighters.find(f=>f.id==="lyra");
pointerListener({type:1,pickInfo:{pickedMesh:api.getMeshes()[allyTarget.id].head}});
assert.equal(first.fighters[first.selectedAlly].id,allyTarget.id);
assert.equal(elements.targetFighterName.textContent,allyTarget.name,"support target card shows selected ally");
assert.equal(elements.targetFighterSide.textContent,"ЦЕЛЬ: СОЮЗНИК");
assert.equal(elements.targetFighterLevel.textContent,"Ур. "+allyTarget.level,"ally uses actual progression level");
assert.equal(elements.targetFighterHud.classList.enemy,false);
click(elements.basicAbilityBtn);
assert.equal(elements.targetFighterName.textContent,secondEnemy.name,"switch back to attack restores enemy target");
first.fighters[first.currentActor].meter=previousKaelMeter;
first.currentActor=originalIndex;
api.syncBattleUI();
pointerListener({type:1,pickInfo:{pickedMesh:api.getMeshes().kael.head}});
assert.equal(first.fighters[first.selectedEnemy].id,secondEnemy.id,"ally tap cannot switch an enemy attack target");
assert.equal(api.getMeshes()[secondEnemy.id].base.material.emissiveColor.x,.48,"target is highlighted on arena");
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
assert.equal(api.getMaterials(),0);
assert.equal(api.getCampaignCompleted(),false);
click(elements.missionResultRetry);
assert.equal(elements.squad.classList.active,true,"retry returns to squad preparation");
click(elements.squadStart);
assert.equal(elements.battle.classList.active,true);
const win=api.getBattle();
win.active=false;win.winner="ally";
api.syncBattleUI();
assert.equal(elements.missionResult.classList.active,true);
assert.equal(api.getMaterials(),1);
assert.equal(api.getCampaignCompleted(),true);
assert.match(elements.missionResultText.textContent,/\+1 учебный материал/);
assert.ok(savedData.has("ashes-throne.campaign.v1"));
assert.ok(savedData.has("ashes-throne.progress.v1"));
api.syncBattleUI();
assert.equal(api.getMaterials(),1,"re-render must not grant a second reward");
click(elements.missionResultBack);
assert.equal(elements.campaign.classList.active,true);
assert.match(elements.campaignMissions.innerHTML,/Пройдено/);
// Completed missions are replayable and still earn the explicitly approved test material.
clickMission();
click(elements.squadStart);
const replay=api.getBattle();
replay.active=false;replay.winner="ally";
api.syncBattleUI();
assert.equal(api.getMaterials(),2);
assert.match(elements.missionResultText.textContent,/Всего: 2/);
assert.equal(api.getCampaignCompleted(),true);
// New JS instance restores campaign flag, levels and materials.
const reloaded=vm.runInNewContext(src+"\n({campaign:campaignProgress,materials:progress.materials})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
assert.equal(reloaded.campaign.completed["black-pass-ambush"],true);
assert.equal(reloaded.materials,2);
// Combat-008C hotfix: each side uses up to three front / two rear positions.
api.showScreen("campaign");
clickMission("demo-mission-2");
click(elements.squadStart);
const largeRoster=api.getBattle().fighters.filter(f=>f.side==="enemy");
assert.equal(largeRoster.length,5);
const renderedZ=largeRoster.map(f=>api.getMeshes()[f.id].body.position.z);
assert.equal(renderedZ.join(","),"-1.9,0,1.9,-0.95,0.95","five enemies are arranged three forward and two behind");
assert.equal(largeRoster.map(f=>api.getMeshes()[f.id].body.position.x).join(","),"2.45,2.45,2.45,4.05,4.05","enemy rows face the allied side");
const alliesInBattle=api.getBattle().fighters.filter(f=>f.side==="ally");
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
assert.match(elements.turnChip.textContent,/Волна 1\/2/);
const materialsBeforeWaves=api.getMaterials();
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
assert.match(elements.turnChip.textContent,/Волна 2\/2/);
assert.equal(waveBattle.fighters.find(f=>f.id===heroBeforeWave.id).hp,health);
assert.equal(api.getMaterials(),materialsBeforeWaves,"first wave cannot grant reward");
assert.equal(elements.battle.classList.active,true,"do not show mission result between waves");
waveBattle.fighters.filter(f=>f.side==="enemy").forEach(f=>{f.hp=0;});
api.CombatCore.advanceToPlayerTurn(waveBattle);
api.syncBattleUI();
assert.equal(waveBattle.winner,"ally");
assert.equal(elements.missionResult.classList.active,true);
assert.equal(api.getMaterials(),materialsBeforeWaves+1,"final wave grants exactly one reward");
api.syncBattleUI();
assert.equal(api.getMaterials(),materialsBeforeWaves+1,"repeated UI sync cannot duplicate final wave reward");
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
click(elements.attackBtn);
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
click(elements.autoBattleBtn);
click(elements.autoSpeedBtn);
assert.equal(pendingDelay(),175);
assert.equal(timers.size,1);
document.hidden=true;
visibilityListeners.forEach(fn=>fn());
assert.equal(timers.size,0,"switching to hidden tab cancels the timer");
assert.equal(api.isAuto(),true,"auto preference remains on while hidden");
document.hidden=false;
visibilityListeners.forEach(fn=>fn());
assert.equal(timers.size,1,"visible tab resumes exactly one action");
assert.equal(pendingDelay(),175,"speed survives Safari visibility pause");
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
const rewardBeforeFinal=api.getMaterials();
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
assert.equal(api.getMaterials(),rewardBeforeFinal+1,"reward persists immediately even while result animation runs");
assert.equal(timers.size,0,"last automatic action cancels further scheduling");
flushVisual();
assert.equal(api.getMaterials(),rewardBeforeFinal+1);
assert.equal(elements.missionResult.classList.active,true,"battle result opens after animation");
assert.equal(elements.autoSpeedBtn.disabled,true,"finished battle disables speed");
assert.equal(api.isAuto(),false,"auto mode clears on victory");
assert.equal(elements.missionResult.classList.active,true);
api.syncBattleUI();
assert.equal(api.getMaterials(),rewardBeforeFinal+1,"no duplicated reward after finished auto battle");
// Combat-006 manual victory: damage/reward computed by core immediately,
// but campaign navigation waits until the visual queue is exhausted.
api.showScreen("campaign");
clickMission("black-pass-ambush");
click(elements.squadStart);
const manualFinish=api.getBattle();
const rewardBeforeManual=api.getMaterials();
manualFinish.fighters.filter(f=>f.side==="enemy").forEach(f=>{f.hp=1;});
let manualActions=0;
while(manualFinish.active&&manualActions++<20)click(elements.attackBtn);
assert.ok(manualActions<20,"manual encounter completes");
assert.equal(manualFinish.winner,"ally");
assert.equal(api.isVisualTransition(),true);
assert.equal(elements.battle.classList.active,true,"manual final hit remains on arena");
assert.equal(elements.attackBtn.disabled,true,"buttons locked during final animation");
assert.equal(api.getMaterials(),rewardBeforeManual+1,"manual victory is committed immediately");
api.syncBattleUI();
assert.equal(api.getMaterials(),rewardBeforeManual+1,"UI re-sync cannot duplicate reward during animation");
flushVisual();
assert.equal(elements.missionResult.classList.active,true);
assert.equal(api.getMaterials(),rewardBeforeManual+1,"visual handoff never awards twice");
api.syncBattleUI();
assert.equal(api.getMaterials(),rewardBeforeManual+1,"no duplicate manual victory reward");
// Exit during a pending result animation must cancel it, never show a stale result.
api.showScreen("campaign");
clickMission("black-pass-ambush");
click(elements.squadStart);
const interrupted=api.getBattle();
const rewardBeforeInterrupt=api.getMaterials();
interrupted.fighters.filter(f=>f.side==="enemy").forEach(f=>{f.hp=1;});
let interruptActions=0;
while(interrupted.active&&interruptActions++<20)click(elements.attackBtn);
assert.equal(api.isVisualTransition(),true);
assert.equal(api.getMaterials(),rewardBeforeInterrupt+1,"completed combat reward persists before exit");
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
losing.fighters.filter(f=>f.side==="ally").forEach(f=>{f.hp=1;});
losing.fighters.filter(f=>f.side==="enemy").forEach(f=>{f.hp=10000;f.maxHp=10000;});
const beforeDefeatReward=api.getMaterials();
let defeatActions=0;
while(losing.active&&defeatActions++<35)click(elements.attackBtn);
assert.ok(defeatActions<35,"controlled losing battle should finish");
assert.equal(losing.winner,"enemy");
assert.equal(api.isVisualTransition(),true,"defeat waits for the last death animations");
assert.equal(elements.battle.classList.active,true,"arena stays visible until defeat animations finish");
assert.equal(api.getMaterials(),beforeDefeatReward,"defeat never grants a reward");
flushVisual();
assert.equal(elements.missionResult.classList.active,true);
assert.match(elements.missionResultTitle.textContent,/не пройдена/);
assert.equal(api.getMaterials(),beforeDefeatReward);
console.log("Campaign-001, Combat-006 UI: manual and auto victory, defeat, wave handoff and reward passed");
