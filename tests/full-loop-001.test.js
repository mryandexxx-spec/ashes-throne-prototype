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
 hidden:false,
 querySelector(q){return elements[q.slice(1)]},
 querySelectorAll(q){
  if(q===".screen")return allScreens;
  if(q==="[data-screen]")return [arenaNav,collectionNav];
  if(q==="[data-hero-id]")return chooseNodes;
  if(q==="[data-open-hero]")return heroNodes;
  return [];
 },
 addEventListener(){}
};
let meshCreates=0,engineCreates=0,rendersStarted=0;
class Mesh {
 constructor(){this.position={};this.visible=true;}
 setEnabled(v){this.visible=v;}
}
class Engine {
 constructor(){engineCreates++;}
 resize(){}
 runRenderLoop(){rendersStarted++;}
 stopRenderLoop(){}
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
 "\n({getBattle:()=>state,getCurrency:()=>progress.currency,getProgress:()=>progress,getLevel:id=>ProgressCore.levelOf(progress,id),selectedParty:()=>selectedPartyIds.slice(),showScreen,openSquad,openCampaignMission,openHeroDetail,renderSquad,syncBattleUI,getCampaignProgress:()=>campaignProgress})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
function click(el){const h=el.handlers.click;assert.ok(h?.length,"missing click handler");h[0]();}
function toggle(id){click(chooseNodes.find(el=>el.dataset.heroId===id));}
const allyIds=()=>api.getBattle().fighters.filter(h=>h.side==="ally").map(h=>h.id).join(",");
const count=()=>elements.squadCount.textContent;



const p=api.getProgress(),campaign=api.getCampaignProgress();
assert.equal(p.saveVersion,3);
assert.equal(p.currency,0);
assert.equal(campaign.completed["black-pass-ambush"],false);
assert.equal(CampaignData.available(CampaignData.getMission("demo-mission-2"),campaign),false);
function win(id,actions=6){
 assert.equal(api.openCampaignMission(id),true,"mission "+id+" must be available");
 api.showScreen("battle");
 const state=api.getBattle();
 assert.equal(state.active,true);
 for(const fighter of state.fighters)if(fighter.side==="enemy")fighter.hp=0;
 state.active=false;state.winner="ally";state.allyActions=actions;
 api.syncBattleUI();
 assert.equal(campaign.completed[id],true);
}
win("black-pass-ambush");
assert.equal(p.currency,1350);
assert.equal(p.accountXp,85);
assert.deepEqual(JSON.parse(JSON.stringify(p.materials)),{Fe:2,Le:3,Cl:4,Wo:1,Fa:2,Th:2,Gl:0});
assert.equal(CampaignData.available(CampaignData.getMission("demo-mission-2"),campaign),true,
 "first win unlocks next mission");
assert.equal(api.openHeroDetail("kael"),true);
const beforeLevel=p.currency;
click(elements.detailUpgrade);
assert.equal(p.levels.kael,2,"hero level can be upgraded from mission currency");
assert.equal(p.currency,beforeLevel-39);
const beforeEquip=p.currency;
assert.equal(elements.gearEquipNext.disabled,false,"first mission materials suffice to craft weapon");
click(elements.gearEquipNext);
assert.equal(p.gear.kael.slots[0],"g1-blade");
assert.equal(p.currency,beforeEquip-167);
assert.equal(p.materials.Fe,0);
assert.equal(p.materials.Wo,0);
assert.equal(p.materials.Fa,1);
// A fresh mission never consumes energy until first win.
p.energy.value=0;p.energy.updatedAt=Date.now();
win("demo-mission-2");
assert.equal(p.currency,1350-39-167+1020+700);
assert.equal(p.materials.Gl,1,"second mission introduces glass");
assert.equal(CampaignData.available(CampaignData.getMission("demo-mission-3"),campaign),true);
assert.equal(p.energy.value,0);
const saved=JSON.parse(savedData.get("ashes-throne.progress.v3"));
assert.equal(saved.heroes.kael.level,2);
assert.equal(saved.heroes.kael.gear.installedByTier["1"][0].itemId,"g1-blade");
assert.equal(saved.materials.Gl,1);
assert.equal(saved.currency,p.currency);
const reloaded=vm.runInNewContext(src+
 "\n({progress,campaignProgress})",{document,window:{addEventListener(){},localStorage},BABYLON});
assert.equal(reloaded.progress.levels.kael,2);
assert.equal(reloaded.progress.gear.kael.slots[0],"g1-blade");
assert.equal(reloaded.progress.materials.Gl,1);
assert.equal(reloaded.progress.currency,p.currency);
assert.equal(reloaded.campaignProgress.completed["black-pass-ambush"],true);
assert.equal(reloaded.campaignProgress.completed["demo-mission-2"],true);
assert.equal(CampaignData.available(CampaignData.getMission("demo-mission-3"),reloaded.campaignProgress),true);
console.log("FullLoop-001: first mission -> payout -> level up -> craft G1 -> second mission -> glass -> next unlock -> Safari-style reload passed");
