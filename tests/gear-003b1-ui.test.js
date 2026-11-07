"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const src=["initiative-model.js","ability-data.js","combat-core.js","gear-data.js","progress-core.js","save-core.js","progress-v3-core.js","mission-data.js","campaign-core.js","campaign-data.js","battle-speed.js","animation-profiles.js","battle-animation.js","game.js"].map(n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8")).join("\n");
const ids=["home","collection","campaign","squad","battle","heroList","combatants",
 "battleStatus","turnChip","actionTitle","actionHint","battleRetryBtn",
 "basicAbilityBtn","specialAbilityBtn","battleMessage","renderCanvas",
 "startBattle","devResourcesGrant","devResourcesNotice","accountStatus","campaignBattle","campaignMissions","missionResultBack","missionResultRetry","missionResultHome","missionResult","missionResultTitle","missionResultText","campaignMissionStatus","campaignSaveStatus","squadBack","squadStart","squadRoster",
 "squadSlots","squadHint","squadCount","heroDetail","detailName","detailRole","detailGlyph","detailStats","detailLevel","detailWallet","detailCost","detailPreview","detailUpgrade","detailNotice","detailBack","detailHome","battleReward","gearTier","gearSlots","gearMaterial","gearWallet","gearPrice","gearPriceLabel","gearStatBonus","gearStatBonusLabel","gearEquipNext","gearNotice","gearPromotionDialog","gearPromotionTitle","gearPromotionLevel","gearPromotionCost","gearPromotionStats","gearPromotionClose"];
function element(id=""){
 return {id,dataset:{},innerHTML:"",textContent:"",disabled:false,handlers:{},
  classList:{active:id==="home",contains(x){return !!this[x]},add(x){this[x]=true},
   remove(x){this[x]=false},toggle(x,v){this[x]=!!v}},
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
const allScreens=["home","collection","campaign","squad","battle","heroDetail"].map(id=>elements[id]);
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
savedData.set("ashes-throne.progress.v2",JSON.stringify({version:2,accountXp:80,currency:500,
 levels:{kael:1,lyra:1,darin:1,"medic-demo":1,"test-area-damage":1},claimedMissions:["black-pass-ambush"]}));
const localStorage={getItem:k=>savedData.has(k)?savedData.get(k):null,setItem:(k,v)=>savedData.set(k,v)};
const api=vm.runInNewContext(src+
 "\n({getBattle:()=>state,getCurrency:()=>progress.currency,getProgress:()=>progress,getLevel:id=>ProgressCore.levelOf(progress,id),selectedParty:()=>selectedPartyIds.slice(),showScreen,openSquad,openHeroDetail,renderSquad,syncBattleUI})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
function click(el){const h=el.handlers.click;assert.ok(h?.length,"missing click handler");h[0]();}
function toggle(id){click(chooseNodes.find(el=>el.dataset.heroId===id));}
const allyIds=()=>api.getBattle().fighters.filter(h=>h.side==="ally").map(h=>h.id).join(",");
const count=()=>elements.squadCount.textContent;

// Gear-003B1: exercise G1→G2 in actual hero-screen event handlers.
const p=api.getProgress();
assert.equal(p.saveVersion,3);
click(elements.devResourcesGrant);
assert.equal(p.currency,5000);
for(let i=0;i<6;i++){
 assert.equal(api.openHeroDetail("kael"),true);
 assert.equal(p.gear.kael.tier,1);
 assert.equal(elements.gearEquipNext.disabled,false);
 click(elements.gearEquipNext);
 assert.equal(p.gear.kael.slots.filter(Boolean).length,i+1);
}
assert.match(elements.gearTier.textContent,/G1 · 6\/6/);
assert.equal(elements.gearEquipNext.textContent,"Повысить экипировку до G2");
assert.equal(elements.gearEquipNext.disabled,false);
assert.match(elements.gearPrice.textContent,/250 валюты/);
assert.equal(elements.gearStatBonus.textContent,"HP и ATK +3%");
const beforePromo=p.currency,resourcesBefore=JSON.stringify(p.materials);
click(elements.gearEquipNext);
assert.equal(p.gear.kael.tier,2);
assert.equal(p.gear.kael.history["1"].filter(Boolean).length,6);
assert.equal(p.gear.kael.slots.filter(Boolean).length,0);
assert.equal(p.currency,beforePromo-250);
assert.equal(JSON.stringify(p.materials),resourcesBefore,"promotion does not spend materials");
assert.equal(elements.gearTier.textContent,"G2 · 0/6");
assert.equal(elements.gearPromotionDialog.open,true);
assert.match(elements.gearPromotionLevel.textContent,/G1 → G2/);
assert.equal(p.gear.kael.history["1"][0],"g1-blade");
assert.match(elements.gearPrice.textContent,/Закалённый клинок/);
assert.equal(elements.gearStatBonus.textContent,"ATK +3%");
const saved=JSON.parse(savedData.get("ashes-throne.progress.v3"));
assert.equal(saved.heroes.kael.gear.tier,2);
assert.equal(saved.heroes.kael.gear.installedByTier["1"][0].itemId,"g1-blade");
assert.equal(saved.heroes.kael.gear.installedByTier["2"][0],null);
// Repeated button uses G2 recipe; never charges second G1→G2 promotion.
click(elements.gearEquipNext);
assert.equal(p.gear.kael.tier,2);
assert.equal(p.gear.kael.slots[0],"g2-blade");
assert.equal(p.currency,beforePromo-250-334);
assert.equal(p.gear.kael.history["1"][0],"g1-blade");
assert.equal(elements.gearPromotionDialog.open,true,"G2 craft cannot retrigger promotion");
// Failure while buying another G2 piece rolls back wallet, slot and ingredients.
api.openHeroDetail("kael");
assert.match(elements.gearPrice.textContent,/Бронированный жилет/);
const oldWallet=p.currency,oldMaterials=JSON.stringify(p.materials);
const originalSet=localStorage.setItem;
localStorage.setItem=(k,v)=>{if(k==="ashes-throne.progress.v3")throw Error("quota");return originalSet(k,v)};
click(elements.gearEquipNext);
assert.equal(p.currency,oldWallet);
assert.equal(JSON.stringify(p.materials),oldMaterials);
assert.equal(p.gear.kael.slots[1],null);
assert.match(elements.gearNotice.textContent,/Покупка не сохранена/);
localStorage.setItem=originalSet;
click(elements.gearEquipNext);
assert.equal(p.gear.kael.slots[1],"g2-vest");
// After reload, tier 2/6 history is intact; account/campaign claims do not reset.
const reloaded=vm.runInNewContext(src+
 "\n({getProgress:()=>progress,getStats:id=>ProgressCore.heroStats(progress,ALLIES.find(h=>h.id===id))})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
assert.equal(reloaded.getProgress().gear.kael.tier,2);
assert.equal(reloaded.getProgress().gear.kael.history["1"].filter(Boolean).length,6);
assert.equal(reloaded.getProgress().gear.kael.slots[0],"g2-blade");
assert.equal(reloaded.getProgress().gear.kael.slots[1],"g2-vest");
assert.equal(reloaded.getStats("kael").speed,110);
assert.equal(reloaded.getProgress().accountXp,80);
assert.deepEqual(Array.from(reloaded.getProgress().claimedMissions),["black-pass-ambush"]);
console.log("Gear-003B1 browser handlers: G1 6/6, paid promotion, G2 craft, rollback and reload passed");
