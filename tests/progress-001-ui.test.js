"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const src=["initiative-model.js","ability-data.js","combat-core.js","progress-core.js","save-core.js","mission-data.js","campaign-core.js","campaign-data.js","battle-speed.js","animation-profiles.js","battle-animation.js","game.js"].map(n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8")).join("\n");
const ids=["home","collection","campaign","squad","battle","heroList","combatants",
 "battleStatus","turnChip","actionTitle","actionHint","battleRetryBtn",
 "basicAbilityBtn","specialAbilityBtn","battleMessage","renderCanvas",
 "startBattle","campaignBattle","campaignMissions","missionResultBack","missionResultRetry","missionResultHome","missionResult","missionResultTitle","missionResultText","campaignMissionStatus","campaignSaveStatus","squadBack","squadStart","squadRoster",
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

// Collection is a navigation surface, not an upgrade UI.
api.showScreen("collection");
assert.equal(elements.collection.classList.active,true);
assert.match(elements.heroList.innerHTML,/data-open-hero="kael"/);
assert.doesNotMatch(elements.heroList.innerHTML,/Повысить уровень/);
click(heroNodes[0]);
assert.equal(elements.heroDetail.classList.active,true);
assert.equal(elements.detailName.textContent,"Каэль Ворон");
assert.equal(elements.detailWallet.textContent,"500");
assert.equal(elements.detailCost.textContent,"39 валюты");
assert.equal(elements.detailUpgrade.disabled,false,"currency from saved test account");
click(elements.detailBack);
assert.equal(elements.collection.classList.active,true);
click(heroNodes[0]);
click(elements.detailHome);
assert.equal(elements.home.classList.active,true,"home bypasses collection");

// Arena wins do not mint campaign first-clear currency.
const battle=api.getBattle();
battle.active=false;
battle.winner="ally";
api.syncBattleUI();
assert.equal(api.getCurrency(),500);
assert.match(elements.battleReward.textContent,/без экономических наград/);
api.syncBattleUI();
assert.equal(api.getCurrency(),500,"repeat refresh cannot mint resources");

api.openHeroDetail("kael");
assert.equal(elements.detailUpgrade.disabled,false);
click(elements.detailUpgrade);
assert.equal(api.getLevel("kael"),2);
assert.equal(api.getCurrency(),461);
const persisted=JSON.parse(savedData.get("ashes-throne.progress.v2"));
assert.equal(persisted.levels.kael,2);
assert.equal(persisted.currency,461);
const reloaded=vm.runInNewContext(src+"\n({getCurrency:()=>progress.currency,getLevel:id=>ProgressCore.levelOf(progress,id)})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
assert.equal(reloaded.getLevel("kael"),2,"level survives page reload");
assert.equal(reloaded.getCurrency(),461,"balance survives page reload");
assert.equal(elements.heroDetail.classList.active,true,"remains on hero detail after purchase");
assert.equal(elements.detailWallet.textContent,"461");
assert.match(elements.detailStats.innerHTML,/125 HP/);
assert.match(elements.detailStats.innerHTML,/25 ATK/);
assert.equal(elements.detailCost.textContent,"Недоступно");
assert.equal(elements.detailUpgrade.disabled,true);
click(elements.detailUpgrade);
assert.equal(api.getLevel("kael"),2,"no double spend");

// Prepared team inherits upgraded stats; enemies and other heroes do not.
api.openSquad("home");
click(elements.squadStart);
const fighters=api.getBattle().fighters;
const kael=fighters.find(x=>x.id==="kael");
const lyra=fighters.find(x=>x.id==="lyra");
const ves=fighters.find(x=>x.id==="ves");
assert.equal(kael.maxHp,125);
assert.equal(kael.atk,25);
assert.equal(lyra.maxHp,88);
assert.equal(ves.maxHp,90);
assert.equal(api.getCurrency(),461);
assert.equal(elements.battleReward.hidden,true,"new battle hides old result");

// Defeats do not mint progress.
api.getBattle().active=false;
api.getBattle().winner="enemy";
api.syncBattleUI();
assert.equal(api.getCurrency(),461);
assert.match(elements.battleReward.textContent,/без наград/);
// Gear-002: select slot six before slot one through the REAL UI handler.
api.getProgress().gearMaterials=12;
api.getProgress().currency+=1000;
api.openHeroDetail("kael");
assert.equal(elements.gearTier.textContent,"G1 · 0/6");
assert.equal(elements.gearMaterial.textContent,"12");
assert.equal(elements.gearWallet.textContent,"1461");
assert.equal(elements.gearEquipNext.disabled,false);
assert.match(elements.gearSlots.innerHTML,/data-gear-slot="5"/);
function selectGear(slot){
 elements.gearSlots.handlers.click[0]({target:{closest:selector=>
  selector==="[data-gear-slot]"?{dataset:{gearSlot:String(slot)}}:null}});
}
selectGear(5);
assert.match(elements.gearPrice.textContent,/Амулет/);
assert.equal(elements.gearStatBonus.textContent,"ATK +2%");
click(elements.gearEquipNext);
assert.equal(api.getProgress().gear.kael.slots[5],true);
assert.equal(api.getProgress().gear.kael.slots[0],false);
assert.equal(api.getProgress().gearMaterials,10);
assert.equal(api.getCurrency(),1295);
assert.equal(elements.gearTier.textContent,"G1 · 1/6");
assert.equal(elements.gearWallet.textContent,"1295","gear balance refreshes after spending");
assert.equal(elements.gearEquipNext.disabled,true,"cannot install filled slot twice");
click(elements.gearEquipNext);
assert.equal(api.getProgress().gearMaterials,10,"no duplicate purchase");
selectGear(0);
assert.match(elements.gearPrice.textContent,/Щиток/);
assert.equal(elements.gearStatBonus.textContent,"HP +2%");
click(elements.gearEquipNext);
assert.equal(api.getProgress().gear.kael.slots[0],true);
assert.equal(api.getProgress().gear.kael.slots[5],true);
assert.equal(api.getCurrency(),1128);
assert.equal(elements.gearTier.textContent,"G1 · 2/6");
assert.match(elements.detailStats.innerHTML,/127 HP/);
assert.deepEqual(Array.from(JSON.parse(savedData.get("ashes-throne.progress.v2")).gear.kael.slots),
 [true,false,false,false,false,true]);
// Finishing the set must show a manual paid gear-tier action, not auto-advance.
for(const i of [1,2,3,4]){selectGear(i);click(elements.gearEquipNext);}
assert.equal(api.getProgress().gear.kael.tier,1,"full six do not auto-promote");
assert.equal(api.getProgress().gear.kael.slots.filter(Boolean).length,6);
assert.equal(elements.gearEquipNext.textContent,"Поднять уровень");
assert.equal(elements.gearPriceLabel.textContent,"Стоимость перехода");
assert.match(elements.gearPrice.textContent,/250 игровой валюты/);
assert.equal(elements.gearEquipNext.disabled,true,"G2 promotion requires hero level 6");
const beforeBlocked=api.getCurrency();
click(elements.gearEquipNext);
assert.equal(api.getCurrency(),beforeBlocked,"blocked promotion costs nothing");
// Give the hero its prerequisite level without changing the tier.
api.getProgress().levels.kael=6;
api.getProgress().accountXp=100000;
api.openHeroDetail("kael");
const fromHp=Number(elements.detailStats.innerHTML.match(/(\d+) HP/)[1]);
const fromAtk=Number(elements.detailStats.innerHTML.match(/(\d+) ATK/)[1]);
const beforePromotion=api.getCurrency();
assert.equal(elements.gearEquipNext.disabled,false);
click(elements.gearEquipNext);
assert.equal(api.getCurrency(),beforePromotion-250);
assert.equal(api.getProgress().gear.kael.tier,2);
assert.equal(elements.gearTier.textContent,"G2 · 0/6");
assert.equal(elements.gearPromotionDialog.open,true);
assert.match(elements.gearPromotionLevel.textContent,/G1 → G2/);
assert.match(elements.gearPromotionCost.textContent,/250/);
assert.match(elements.gearPromotionStats.textContent,new RegExp("Здоровье: "+fromHp+" → "));
assert.match(elements.gearPromotionStats.textContent,new RegExp("Атака: "+fromAtk+" → "));
assert.match(elements.gearPromotionStats.textContent,/Скорость: 110 → 110/);
assert.equal(JSON.parse(savedData.get("ashes-throne.progress.v2")).gear.kael.tier,2,"promotion is persisted");
click(elements.gearEquipNext);
assert.equal(api.getCurrency(),beforePromotion-250,"cannot pay twice through second press");
click(elements.gearPromotionClose);
assert.equal(elements.gearPromotionDialog.open,false);
// Unaffordable equipment must explain WHICH resource is missing and by how much.
api.getProgress().currency=100;
api.getProgress().gearMaterials=3;
api.openHeroDetail("kael");
assert.equal(elements.gearWallet.textContent,"100");
assert.equal(elements.gearEquipNext.disabled,true);
assert.match(elements.gearNotice.textContent,/есть 100, нужно 334 \(не хватает 234\)/);
api.getProgress().currency=1000;
api.getProgress().gearMaterials=0;
api.openHeroDetail("kael");
assert.match(elements.gearNotice.textContent,/материала C: есть 0, нужно 3/);
console.log("Gear-002C UI: balances, exact shortages, button state and G promotion passed");
