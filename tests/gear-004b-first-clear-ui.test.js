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
 "\n({getBattle:()=>state,getCurrency:()=>progress.currency,getProgress:()=>progress,getLevel:id=>ProgressCore.levelOf(progress,id),selectedParty:()=>selectedPartyIds.slice(),showScreen,openSquad,openCampaignMission,openHeroDetail,renderSquad,syncBattleUI})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
function click(el){const h=el.handlers.click;assert.ok(h?.length,"missing click handler");h[0]();}
function toggle(id){click(chooseNodes.find(el=>el.dataset.heroId===id));}
const allyIds=()=>api.getBattle().fighters.filter(h=>h.side==="ally").map(h=>h.id).join(",");
const count=()=>elements.squadCount.textContent;


const p=api.getProgress();
assert.equal(p.saveVersion,3);
assert.equal(p.currency,0);
assert.equal(api.openHeroDetail("kael"),true);
assert.match(elements.detailStats.innerHTML,/Все 14 характеристик/);
assert.ok(elements.detailStats.innerHTML.includes("Защита (Protection)"));
assert.match(elements.detailStats.innerHTML,/Физическая атака/);
assert.match(elements.detailStats.innerHTML,/Магическая атака/);
assert.match(elements.detailStats.innerHTML,/Сопротивление ослаблениям/);
assert.match(elements.detailStats.innerHTML,/Не рассчитано/);
assert.ok(elements.detailStats.innerHTML.includes("Атака (общая, тест)"));
api.showScreen("campaign");
assert.match(elements.campaignMissions.innerHTML,/Награды за победу:/);
assert.match(elements.campaignMissions.innerHTML,/Железо ×2/);
assert.match(elements.campaignMissions.innerHTML,/Ткань ×4/);
assert.match(elements.campaignMissions.innerHTML,/Дополнительно за первую победу: 500 валюты/);
assert.doesNotMatch(elements.campaignMissions.innerHTML,/материалов C/);
p.energy.value=0;p.energy.updatedAt=Date.now();
assert.equal(api.openCampaignMission("black-pass-ambush"),true);
api.showScreen("battle");
const battle=api.getBattle();
assert.equal(battle.active,true);
assert.equal(p.energy.value,0,"first story attempt must be free even with zero energy");
for(const f of battle.fighters)if(f.side==="enemy")f.hp=0;
battle.active=false;
battle.winner="ally";
battle.allyActions=6;
api.syncBattleUI();
assert.equal(p.currency,1350,"first victory gets baseline 850 + one-time 500");
assert.equal(p.energy.value,0,"first story win must not charge energy");
assert.equal(p.accountXp,85,"first victory gets 5+80 XP");
assert.equal(p.materials.Fe,2);
assert.equal(p.materials.Cl,4);
assert.equal(p.materials.Gl,0);
assert.equal(p.gearMaterials,0,"no obsolete C in active v3");
assert.doesNotMatch(elements.accountStatus.textContent,/ · C /,"v3 wallet must hide obsolete C");
assert.match(elements.missionResultText.textContent,/Железо ×2/);
assert.match(elements.missionResultText.textContent,/Дополнительно за первую победу: \+500/);
api.syncBattleUI();
assert.equal(p.currency,1350,"repeated render cannot mint rewards");
const persisted=JSON.parse(savedData.get("ashes-throne.progress.v3"));
assert.equal(persisted.currency,1350);
assert.equal(persisted.energy.value,0);
assert.equal(persisted.materials.Fe,2);
assert.equal(persisted.legacyC,0);
api.showScreen("campaign");
assert.doesNotMatch(elements.campaignMissions.innerHTML,/Дополнительно за первую победу: 500 валюты/);
assert.match(elements.campaignMissions.innerHTML,/Повторный бой или симуляция: 10/);
assert.equal(api.openCampaignMission("black-pass-ambush"),true);
api.showScreen("battle");
assert.equal(elements.squad.classList.active,true,"replay at zero energy must remain blocked");
// A crash between wallet and campaign saves must not erase a claimed mission.
savedData.set("ashes-throne.campaign.v1",JSON.stringify({version:2,completed:{"black-pass-ambush":false,"demo-mission-2":false,"demo-mission-3":false},bestStars:{"black-pass-ambush":0,"demo-mission-2":0,"demo-mission-3":0}}));
const again=vm.runInNewContext(src+
 "\n({getProgress:()=>progress,getCampaignProgress:()=>campaignProgress})",{document,window:{addEventListener(){},localStorage},BABYLON});
assert.equal(again.getProgress().currency,1350,"v3 save survives game reload");
assert.equal(again.getProgress().materials.Fe,2);
assert.equal(again.getProgress().energy.value,0);
assert.equal(again.getCampaignProgress().completed["black-pass-ambush"],true,"restores missing campaign marker");
assert.equal(JSON.parse(savedData.get("ashes-throne.campaign.v1")).completed["black-pass-ambush"],true,"repaired campaign key persisted");
// Regression: storage quota failure must not grant a first-clear reward only in RAM.
savedData.delete("ashes-throne.progress.v3");
savedData.delete("ashes-throne.campaign.v1");
const failed=vm.runInNewContext(src+
 "\n({getProgress:()=>progress,getCampaignProgress:()=>campaignProgress,getBattle:()=>state,openCampaignMission,showScreen,syncBattleUI})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
const pf=failed.getProgress();
pf.energy.value=0;pf.energy.updatedAt=Date.now();
assert.equal(failed.openCampaignMission("black-pass-ambush"),true);
failed.showScreen("battle");
const fb=failed.getBattle();
for(const fighter of fb.fighters)if(fighter.side==="enemy")fighter.hp=0;
fb.active=false;fb.winner="ally";fb.allyActions=6;
const realWrite=localStorage.setItem;
localStorage.setItem=(key,value)=>{
 if(key==="ashes-throne.progress.v3")throw Error("quota exceeded");
 return realWrite(key,value);
};
failed.syncBattleUI();
localStorage.setItem=realWrite;
assert.equal(pf.currency,0,"failed first-clear write cannot keep unpersisted currency");
assert.equal(pf.materials.Fe,0,"failed first-clear write cannot keep unpersisted raw materials");
assert.equal(pf.claimedMissions.length,0,"failed first-clear write cannot consume unique bonus");
assert.equal(failed.getCampaignProgress().completed["black-pass-ambush"],false,"mission must remain locked on payout failure");
assert.match(elements.missionResultText.textContent,/Ошибка сохранения наград/);
assert.equal(JSON.parse(savedData.get("ashes-throne.progress.v3")).currency,0,"stored wallet remains intact");
console.log("Energy/Save-001 first-clear zero energy, campaign recovery, failed-write rollback passed");
console.log("Gear-004B first-clear actual campaign UI: baseline+bonus, seven materials, no C, preview, save and reload passed");
