"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const src=["initiative-model.js","combat-core.js","progress-core.js","save-core.js","game.js"].map(n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8")).join("\n");
const ids=["home","collection","campaign","squad","battle","heroList","combatants",
 "battleStatus","turnChip","actionTitle","actionHint","attackBtn",
 "basicAbilityBtn","specialAbilityBtn","battleMessage","renderCanvas",
 "startBattle","campaignBattle","squadBack","squadStart","squadRoster",
 "squadSlots","squadHint","squadCount","heroDetail","detailName","detailRole","detailGlyph","detailStats","detailLevel","detailWallet","detailCost","detailPreview","detailUpgrade","detailNotice","detailBack","detailHome","battleReward"];
function element(id=""){
 return {id,dataset:{},innerHTML:"",textContent:"",disabled:false,handlers:{},
  classList:{active:id==="home",contains(x){return !!this[x]},add(x){this[x]=true},
   remove(x){this[x]=false},toggle(x,v){this[x]=!!v}},
  addEventListener(type,fn){(this.handlers[type]??=[]).push(fn)}
 };
}
const elements=Object.fromEntries(ids.map(id=>[id,element(id)]));
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
const localStorage={getItem:k=>savedData.has(k)?savedData.get(k):null,setItem:(k,v)=>savedData.set(k,v)};
const api=vm.runInNewContext(src+
 "\n({getBattle:()=>state,getMaterials:()=>progress.materials,getLevel:id=>ProgressCore.levelOf(progress,id),selectedParty:()=>selectedPartyIds.slice(),showScreen,openSquad,openHeroDetail,renderSquad,syncBattleUI})",
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
assert.equal(elements.detailWallet.textContent,"0");
assert.equal(elements.detailCost.textContent,"1 мат.");
assert.equal(elements.detailUpgrade.disabled,true,"cannot buy without reward");
click(elements.detailBack);
assert.equal(elements.collection.classList.active,true);
click(heroNodes[0]);
click(elements.detailHome);
assert.equal(elements.home.classList.active,true,"home bypasses collection");

// One result grants at most one resource, even after repeated rendering.
const battle=api.getBattle();
battle.active=false;
battle.winner="ally";
api.syncBattleUI();
assert.equal(api.getMaterials(),1);
assert.ok(savedData.has("ashes-throne.progress.v1"),"victory immediately writes progress");
assert.match(elements.battleReward.textContent,/\+1 учебный материал/);
api.syncBattleUI();
assert.equal(api.getMaterials(),1,"repeat refresh cannot mint resources");

api.openHeroDetail("kael");
assert.equal(elements.detailUpgrade.disabled,false);
click(elements.detailUpgrade);
assert.equal(api.getLevel("kael"),2);
assert.equal(api.getMaterials(),0);
const persisted=JSON.parse(savedData.get("ashes-throne.progress.v1"));
assert.equal(persisted.levels.kael,2);
assert.equal(persisted.materials,0);
const reloaded=vm.runInNewContext(src+"\n({getMaterials:()=>progress.materials,getLevel:id=>ProgressCore.levelOf(progress,id)})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
assert.equal(reloaded.getLevel("kael"),2,"level survives page reload");
assert.equal(reloaded.getMaterials(),0,"balance survives page reload");
assert.equal(elements.heroDetail.classList.active,true,"remains on hero detail after purchase");
assert.equal(elements.detailWallet.textContent,"0");
assert.match(elements.detailStats.innerHTML,/132 HP/);
assert.match(elements.detailStats.innerHTML,/26 ATK/);
assert.equal(elements.detailCost.textContent,"2 мат.");
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
assert.equal(kael.maxHp,132);
assert.equal(kael.atk,26);
assert.equal(lyra.maxHp,88);
assert.equal(ves.maxHp,90);
assert.equal(api.getMaterials(),0);
assert.equal(elements.battleReward.hidden,true,"new battle hides old result");

// Defeats do not mint progress.
api.getBattle().active=false;
api.getBattle().winner="enemy";
api.syncBattleUI();
assert.equal(api.getMaterials(),0);
assert.match(elements.battleReward.textContent,/Награда: 0/);
console.log("Progress-001 hero detail navigation, reward and battle scaling passed");
