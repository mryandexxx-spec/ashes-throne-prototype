"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const src=["initiative-model.js","ability-data.js","combat-core.js","combat-log.js","gear-data.js","progress-core.js","save-core.js","progress-v3-core.js","mission-data.js","campaign-core.js","campaign-data.js","battle-speed.js","animation-profiles.js","battle-animation.js","game.js"].map(n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8")).join("\n");
const ids=["energyStatus","missionResultChapter","missionResultStars","missionResultText","battleLogSummary","battleLogEntries","targetFighterHud","targetFighterSide","targetFighterLevel","targetFighterName","targetFighterHp","targetFighterStats","targetFighterHealthFill","arenaIndicators","autoBattleBtn","autoSpeedBtn","powerfulAbilityBtn","powerfulAbilitySlot","abilityOptions","abilityControls","battleLoadError","campaignMissions","campaign","missionResult","missionResultTitle","missionResultBack","missionResultRetry","missionResultHome","squad","squadStart","home","collection","campaign","squad","battle","heroList","combatants",
 "battleStatus","turnChip","actionTitle","actionHint","battleRetryBtn",
 "basicAbilityBtn","specialAbilityBtn","battleMessage","renderCanvas",
 "startBattle","devResourcesGrant","devResourcesNotice","accountStatus","campaignBattle","campaignMissions","missionResultBack","missionResultRetry","missionResultHome","missionResult","missionResultTitle","missionResultText","campaignMissionStatus","campaignSaveStatus","squadBack","squadStart","squadRoster",
 "squadSlots","squadHint","squadCount","heroDetail","detailName","detailRole","detailGlyph","detailStats","detailLevel","detailWallet","detailCost","detailPreview","detailUpgrade","detailNotice","detailBack","detailHome","battleReward","gearTier","gearSlots","gearMaterial","gearWallet","gearPrice","gearPriceLabel","gearStatBonus","gearStatBonusLabel","gearEquipNext","gearNotice","gearPromotionDialog","gearPromotionTitle","gearPromotionLevel","gearPromotionCost","gearPromotionStats","gearPromotionClose"];
function element(id=""){
 return {id,dataset:{},innerHTML:"",textContent:"",disabled:false,handlers:{},style:{},
  classList:{active:id==="home",contains(x){return !!this[x]},add(x){this[x]=true},
   remove(x){this[x]=false},toggle(x,v){this[x]=!!v}},
  setAttribute(name,value){this[name]=value},
  addEventListener(type,fn){(this.handlers[type]??=[]).push(fn)}
 };
}
const elements=Object.fromEntries(ids.map(id=>[id,element(id)]));
elements.gearSlots.contains=()=>true;
elements.gearPromotionDialog.showModal=function(){this.open=true;};
elements.gearPromotionDialog.close=function(){this.open=false;};
const chooseNodes=["kael","lyra","darin"].map(id=>{
 const e=element();e.dataset.heroId=id;return e;
});
const heroNodes=["kael","lyra","darin"].map(id=>{const e=element();e.dataset.openHero=id;return e;});
const arenaNav=element();arenaNav.dataset.screen="battle";
const collectionNav=element();collectionNav.dataset.screen="collection";
const allScreens=["home","collection","campaign","squad","battle","missionResult","heroDetail"].map(id=>elements[id]);
const document={
 handlers:{},
 hidden:false,
 querySelector(q){return elements[q.slice(1)]},
 querySelectorAll(q){
  if(q===".screen")return allScreens;
  if(q==="[data-screen]")return [arenaNav,collectionNav];
  if(q==="[data-hero-id]")return chooseNodes;
  if(q==="[data-open-hero]")return heroNodes;
  return [];
 },
 addEventListener(type,fn){(this.handlers[type]??=[]).push(fn)}
};
let meshCreates=0,engineCreates=0,rendersStarted=0,rendersStopped=0;
class Mesh {
 constructor(){this.position={};this.visible=true;}
 setEnabled(v){this.visible=v;}
}
class Engine {
 constructor(){engineCreates++;}
 resize(){}
 runRenderLoop(){rendersStarted++;}
 stopRenderLoop(){rendersStopped++;}
}
class Material {constructor(){this.diffuseColor=null;this.specularColor=null;this.emissiveColor=null;}}
class Camera{attachControl(){}}
class Scene{render(){}}
class Vec{constructor(x,y,z){this.x=x;this.y=y;this.z=z;}}
const BABYLON={Engine,Scene,ArcRotateCamera:Camera,HemisphericLight:class{},DirectionalLight:class{},
 StandardMaterial:Material,Vector3:Vec,Color3:Vec,Color4:Vec,
 MeshBuilder:{CreateGround(){return new Mesh();},
  CreateCapsule(){meshCreates++;return new Mesh();},
  CreateSphere(){meshCreates++;return new Mesh();},
  CreateCylinder(){meshCreates++;return new Mesh();}}
};
const savedData=new Map();
savedData.set("ashes-throne.progress.v2",JSON.stringify({version:2,accountXp:0,currency:0,
 levels:{kael:1,lyra:1,darin:1,"medic-demo":1,"test-area-damage":1},claimedMissions:[]}));
const localStorage={getItem:k=>savedData.has(k)?savedData.get(k):null,setItem:(k,v)=>savedData.set(k,v)};
const api=vm.runInNewContext(src+
 "\n({getBattle:()=>state,getCurrency:()=>progress.currency,getProgress:()=>progress,getLevel:id=>ProgressCore.levelOf(progress,id),selectedParty:()=>selectedPartyIds.slice(),showScreen,openSquad,openCampaignMission,openHeroDetail,renderSquad,syncBattleUI,getCampaignProgress:()=>campaignProgress,CampaignData,BattleSpeed,setAutoSpeed})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
function click(el){const h=el.handlers.click;assert.ok(h?.length,"missing click handler");h[0]();}
function toggle(id){click(chooseNodes.find(el=>el.dataset.heroId===id));}
const allyIds=()=>api.getBattle().fighters.filter(h=>h.side==="ally").map(h=>h.id).join(",");
const count=()=>elements.squadCount.textContent;




const p=api.getProgress(),campaign=api.getCampaignProgress();
const visibility=()=>{for(const cb of document.handlers.visibilitychange||[])cb()};
assert.equal(api.openCampaignMission("black-pass-ambush"),true);
api.showScreen("battle");
assert.equal(elements.battle.classList.active,true);
assert.equal(api.BattleSpeed.get(),1,"initial speed");
assert.equal(api.setAutoSpeed(4),true,"active battle changes speed");
assert.equal(savedData.get("ashes-throne.battle-speed.v1"),"4","speed saved independently");
assert.equal(elements.autoSpeedBtn.textContent,"4×");
assert.equal(rendersStarted,1,"first entry starts a single render loop");
document.hidden=true;visibility();
assert.equal(rendersStopped,1,"background stops GPU rendering");
document.hidden=false;visibility();
assert.equal(rendersStarted,2,"foreground resumes the render loop");
visibility();
assert.equal(rendersStarted,2,"repeated foreground event does not create duplicate loops");
document.hidden=true;visibility();
assert.equal(rendersStopped,2);
api.showScreen("home");
assert.equal(elements.home.classList.active,true);
document.hidden=false;visibility();
assert.equal(rendersStarted,2,"return to home must not resume offscreen 3D rendering");
assert.equal(p.energy.value,240,"unfinished free story battle should not spend energy");
// Restarting the campaign battle must not reuse a stale result or duplicate the render loop.
assert.equal(api.openCampaignMission("black-pass-ambush"),true);
api.showScreen("battle");
assert.equal(rendersStarted,3);
assert.equal(api.BattleSpeed.get(),4,"restarted battle keeps speed");
assert.equal(elements.autoSpeedBtn.textContent,"4×");
const fight=api.getBattle();
for(const f of fight.fighters)if(f.side==="enemy")f.hp=0;
fight.active=false;fight.winner="ally";fight.allyActions=6;
api.syncBattleUI();
assert.equal(campaign.completed["black-pass-ambush"],true);
assert.equal(p.currency,1350);
assert.equal(rendersStopped,3,"completed combat releases GPU rendering");
assert.equal(elements.missionResult.classList.active,true);
visibility();
assert.equal(rendersStarted,3,"result screen never restarts battle render loop");
const save=JSON.parse(savedData.get("ashes-throne.progress.v3"));
assert.equal(save.currency,1350);
const again=vm.runInNewContext(src+
 "\n({getProgress:()=>progress,getCampaignProgress:()=>campaignProgress,BattleSpeed})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
assert.equal(again.getProgress().currency,1350);
assert.equal(again.getCampaignProgress().completed["black-pass-ambush"],true);
assert.equal(again.BattleSpeed.get(),4,"reload restores chosen speed");
console.log("MobileLifecycle-001: background/foreground/duplicate event, screen exit, battle restart, result and reload passed");
