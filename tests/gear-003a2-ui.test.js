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

// Real view handlers loaded from game.js with the A2 browser module order.
const p=api.getProgress();
assert.equal(p.saveVersion,3,"browser must load the new v3 profile");
assert.equal(p.levels.kael,1);
assert.equal(p.currency,500);
assert.ok(savedData.has("ashes-throne.progress.v2"),"v2 remains a backup");
assert.ok(savedData.has("ashes-throne.progress.v3"));
const rawOld=savedData.get("ashes-throne.progress.v2");
assert.equal(api.openHeroDetail("kael"),true);
assert.equal(elements.gearTier.textContent,"G1 · 0/6");
assert.match(elements.gearSlots.innerHTML,/data-gear-slot="0"/);
assert.match(elements.gearSlots.innerHTML,/Оружие/);
assert.match(elements.gearSlots.innerHTML,/Снаряжение/);
assert.match(elements.gearMaterial.textContent,/Fe 0/);
assert.equal(elements.gearEquipNext.disabled,true,"not enough raw components");
assert.match(elements.gearNotice.textContent,/Недостаточно компонентов/);
// Existing resource button refills both the old test economy and the new G1 parts.
click(elements.devResourcesGrant);
assert.equal(p.materials.Fe,20);
assert.equal(p.materials.Le,30);
assert.equal(p.materials.Cl,30);
assert.equal(p.materials.Wo,10);
assert.equal(p.materials.Fa,15);
assert.equal(p.materials.Th,20);
assert.equal(p.materials.Gl,0);
assert.equal(p.currency,5000);
assert.match(elements.devResourcesNotice.textContent,/G1: Fe 20/);
api.openHeroDetail("kael");
assert.equal(elements.gearEquipNext.disabled,false);
assert.match(elements.gearPrice.textContent,/Короткий клинок/);
assert.match(elements.gearPrice.textContent,/Fe ×2/);
assert.equal(elements.gearStatBonus.textContent,"ATK +3%");
const balanceBefore=p.currency,ironBefore=p.materials.Fe,woodBefore=p.materials.Wo;
click(elements.gearEquipNext);
assert.equal(p.gear.kael.slots[0],"g1-blade");
assert.equal(p.currency,balanceBefore-167);
assert.equal(p.materials.Fe,ironBefore-2);
assert.equal(p.materials.Wo,woodBefore-1);
assert.equal(elements.gearEquipNext.disabled,true);
assert.match(elements.gearNotice.textContent,/Установлено/);
const saved=JSON.parse(savedData.get("ashes-throne.progress.v3"));
assert.equal(saved.heroes.kael.gear.installedByTier["1"][0].itemId,"g1-blade");
click(elements.gearEquipNext);
assert.equal(p.currency,balanceBefore-167,"double-tap does not double-charge");
assert.equal(p.materials.Fe,ironBefore-2);
// Switch hero, ensure the correct class-restricted item is offered.
api.openHeroDetail("lyra");
assert.match(elements.gearPrice.textContent,/Лёгкий лук/);
assert.equal(elements.gearStatBonus.textContent,"ATK +3%");
assert.equal(elements.gearEquipNext.disabled,false);
api.openHeroDetail("kael");
assert.equal(elements.gearEquipNext.disabled,false,"first unfilled slot is selected");
assert.match(elements.gearPrice.textContent,/Усиленный жилет/);
const balanceFail=p.currency,leatherFail=p.materials.Le;
const realSet=localStorage.setItem;
localStorage.setItem=(key,value)=>{
 if(key==="ashes-throne.progress.v3")throw Error("storage quota");
 return realSet(key,value);
};
click(elements.gearEquipNext);
assert.equal(p.currency,balanceFail,"failed save does not spend wallet");
assert.equal(p.materials.Le,leatherFail,"failed save does not consume ingredients");
assert.equal(p.gear.kael.slots[1],null,"failed save does not install item");
assert.match(elements.gearNotice.textContent,/Покупка не сохранена/);
assert.match(elements.accountStatus.textContent,new RegExp("Валюта "+balanceFail));
localStorage.setItem=realSet;
click(elements.gearEquipNext);
assert.equal(p.gear.kael.slots[1],"g1-vest");
assert.equal(p.currency,balanceFail-167);
assert.equal(savedData.get("ashes-throne.progress.v2"),rawOld);
// Fresh game context / reload: installed IDs and main wallet survive.
const again=vm.runInNewContext(src+
 "\n({getProgress:()=>progress,getSavedGear:id=>ProgressCore.gearState(progress,id),getHeroStats:id=>ProgressCore.heroStats(progress,ALLIES.find(h=>h.id===id))})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
assert.equal(again.getSavedGear("kael").slots[0],"g1-blade");
assert.equal(again.getSavedGear("kael").slots[1],"g1-vest");
assert.equal(again.getProgress().currency,balanceFail-167);
assert.equal(again.getHeroStats("kael").speed,110);
// The first launch migrated heroes, but did not erase account XP or claims.
assert.equal(again.getProgress().accountXp,80);
assert.deepEqual(Array.from(again.getProgress().claimedMissions),["black-pass-ambush"]);
console.log("Gear-003A2 hero UI: class-specific G1, materials, install, double tap, rollback, reload passed");
