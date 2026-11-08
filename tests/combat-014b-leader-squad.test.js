"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const src=["initiative-model.js","ability-data.js","combat-core.js","progress-core.js","mission-data.js","campaign-core.js","campaign-data.js","battle-speed.js","animation-profiles.js","battle-animation.js","game.js"].map(n=>{
 let file=fs.readFileSync(path.join(__dirname,"..",n),"utf8");
 // Test-only injectable leader, never part of the shipped HEROES/ability data.
 if(n==="ability-data.js")file=file.replace("const leaderByHero=Object.freeze({",
  'const leaderByHero=Object.freeze({kael:Object.freeze({id:"leader",modifiers:Object.freeze([{stat:"atk",operation:"flat",value:4,scope:"all-allies",when:{kind:"always"}}])}),');
 return file;
}).join("\n");
const ids=["home","collection","campaign","squad","battle","heroList","combatants",
 "battleStatus","turnChip","actionTitle","actionHint","battleRetryBtn",
 "basicAbilityBtn","specialAbilityBtn","battleMessage","renderCanvas",
 "startBattle","campaignBattle","campaignMissions","missionResultBack","missionResultRetry","missionResultHome","missionResult","missionResultTitle","missionResultText","campaignMissionStatus","campaignSaveStatus","squadBack","squadStart","squadRoster",
 "squadSlots","squadHint","squadWarning","squadDisband","detailBack","detailHome","detailUpgrade","squadCount"];
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
const leaderNode=element();leaderNode.dataset.leaderId="kael";
const clearLeaderNode=element();
const arenaNav=element();arenaNav.dataset.screen="battle";
const collectionNav=element();collectionNav.dataset.screen="collection";
const allScreens=["home","collection","campaign","squad","battle"].map(id=>elements[id]);
const document={
 hidden:false,
 querySelector(q){return elements[q.slice(1)]},
 querySelectorAll(q){
  if(q===".screen")return allScreens;
  if(q==="[data-screen]")return [arenaNav,collectionNav];
  if(q==="[data-hero-id]")return chooseNodes;
  if(q==="[data-leader-id]")return [leaderNode];
  if(q==="[data-clear-leader]")return [clearLeaderNode];
  return [];
 },
 addEventListener(){}
};
let meshCreates=0,engineCreates=0,rendersStarted=0;
const createdCameras=[];
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
class Camera{
 constructor(name,alpha,beta,radius,target){this.name=name;this.alpha=alpha;this.beta=beta;this.radius=radius;this.target=target;createdCameras.push(this);}
 attachControl(){}
 setTarget(target){this.target=target;}
}
class Scene{render(){}}
class Vec{constructor(x,y,z){this.x=x;this.y=y;this.z=z;}}
const BABYLON={Engine,Scene,ArcRotateCamera:Camera,HemisphericLight:class{},DirectionalLight:class{},
 StandardMaterial:Material,Vector3:Vec,Color3:Vec,Color4:Vec,
 MeshBuilder:{CreateGround(){return new Mesh();},
  CreateCapsule(){meshCreates++;return new Mesh();},
  CreateSphere(){meshCreates++;return new Mesh();},
  CreateCylinder(){meshCreates++;return new Mesh();}}
};
const storageData=new Map();
const localStorage={
 getItem(key){return storageData.has(key)?storageData.get(key):null},
 setItem(key,value){storageData.set(key,value)}
};
const api=vm.runInNewContext(src+
 "\n({getBattle:()=>state,selectedParty:()=>selectedParty().map(h=>h.id),showScreen,openSquad,renderSquad,toggleSquadHero,CombatCore})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
function click(el){const h=el.handlers.click;assert.ok(h?.length,"missing click handler");h[0]();}
function toggle(id){click(chooseNodes.find(el=>el.dataset.heroId===id));}
const allyIds=()=>api.getBattle().fighters.filter(h=>h.side==="ally").map(h=>h.id).join(",");
const count=()=>elements.squadCount.textContent;

const slots=()=>Array.from(elements.squadSlots.innerHTML.matchAll(/squad-slot-content">([^<]*)/g),m=>m[1]);

// Default formation: all five occupied, Kael first and the test-only aura active.
click(elements.startBattle);
assert.equal(count(),"5/5");
assert.deepEqual(slots(),["Каэль Ворон","Лира Соль","Дарин Пепельный","Учебный лекарь","Учебный боец группы"]);
assert.doesNotMatch(elements.squadRoster.innerHTML,/data-leader-id|В лидеры/);
click(elements.squadStart);
assert.equal(api.getBattle().leaderId,"kael");
assert.equal(api.CombatCore.effectiveStat(api.getBattle(),
 api.getBattle().fighters.find(h=>h.id==="lyra"),"atk"),
 api.getBattle().fighters.find(h=>h.id==="lyra").atk+4);

// Removing slot 1 leaves it empty. It never shifts another fighter.
api.openSquad();
toggle("kael");
assert.equal(count(),"4/5");
assert.deepEqual(slots(),["Свободно","Лира Соль","Дарин Пепельный","Учебный лекарь","Учебный боец группы"]);
assert.equal(api.selectedParty().join(","),"lyra,darin,medic-demo,test-area-damage");
click(elements.squadStart);
assert.equal(elements.squad.classList.active,true,"first tap warns with four of five allies");
assert.match(elements.squadWarning.textContent,/Нажми «Начать бой» ещё раз/);
click(elements.squadStart);
assert.equal(api.getBattle().leaderId,null,"empty first cell has no implicit leader");
assert.equal(api.CombatCore.activeLeaderModifiers(api.getBattle(),"lyra").length,0,
 "Kael's leader skill is inactive when Kael is missing");

// First available vacancy is slot 1, so reselecting Kael fills it immediately.
api.openSquad();
toggle("kael");
assert.deepEqual(slots(),["Каэль Ворон","Лира Соль","Дарин Пепельный","Учебный лекарь","Учебный боец группы"]);
assert.equal(count(),"5/5");
click(elements.squadStart);
assert.equal(api.getBattle().leaderId,"kael");

// Removing a middle hero leaves the exact middle cell empty.
// Re-adding that hero fills the earliest vacancy, not the last cell.
api.openSquad();
toggle("darin");
assert.deepEqual(slots(),["Каэль Ворон","Лира Соль","Свободно","Учебный лекарь","Учебный боец группы"]);
toggle("darin");
assert.deepEqual(slots(),["Каэль Ворон","Лира Соль","Дарин Пепельный","Учебный лекарь","Учебный боец группы"]);
assert.equal(new Set(api.selectedParty()).size,5,"no duplicate fighters");

// Save an intentionally empty leader slot and a middle gap.
toggle("kael");
toggle("darin");
const gaps=["Свободно","Лира Соль","Свободно","Учебный лекарь","Учебный боец группы"];
assert.deepEqual(slots(),gaps);
const stored=JSON.parse(storageData.get("ashes-throne.squad.v1"));
assert.equal(stored.leaderId,null);
assert.deepEqual(stored.regularIds,["lyra",null,"medic-demo","test-area-damage"]);
const restored=vm.runInNewContext(src+
 "\n({leaderId:selectedLeaderId,regularIds:selectedPartyIds.slice(),selectedParty:()=>selectedParty().map(h=>h.id)})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
assert.equal(restored.leaderId,null);
assert.deepEqual(Array.from(restored.regularIds),["lyra",null,"medic-demo","test-area-damage"]);
assert.equal(restored.selectedParty().join(","),"lyra,medic-demo,test-area-damage");

// Selecting Kael fills slot 1 while leaving slot 3 empty; selecting Darin
// then fills slot 3, proving consistent first-free-slot order.
toggle("kael");
assert.deepEqual(slots(),["Каэль Ворон","Лира Соль","Свободно","Учебный лекарь","Учебный боец группы"]);
toggle("darin");
assert.equal(count(),"5/5");
assert.deepEqual(slots(),["Каэль Ворон","Лира Соль","Дарин Пепельный","Учебный лекарь","Учебный боец группы"]);

// Disband persists five vacancies. The next ordinary click fills slot 1.
click(elements.squadDisband);
assert.equal(count(),"0/5");
assert.deepEqual(slots(),["Свободно","Свободно","Свободно","Свободно","Свободно"]);
assert.equal(elements.squadStart.disabled,true);
const empty=vm.runInNewContext(src+
 "\n({leaderId:selectedLeaderId,regularIds:selectedPartyIds.slice(),selectedParty:()=>selectedParty().map(h=>h.id)})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
assert.equal(empty.leaderId,null);
assert.deepEqual(Array.from(empty.regularIds),[null,null,null,null]);
assert.equal(empty.selectedParty().length,0);
toggle("lyra");
assert.deepEqual(slots(),["Лира Соль","Свободно","Свободно","Свободно","Свободно"]);
click(elements.squadStart);
assert.equal(elements.squad.classList.active,true);
toggle("darin");
assert.equal(elements.squadWarning.hidden,true,"changing team resets warning");
click(elements.squadStart);
assert.equal(elements.squad.classList.active,true);
click(elements.squadStart);
assert.equal(api.getBattle().leaderId,"lyra");

// Old Combat-014C save: leader intentionally empty while later slots
// have occupants. Preserve their actual positions; do not promote.
storageData.set("ashes-throne.squad.v1",
 '{"version":1,"leaderId":null,"regularIds":["lyra","kael"]}');
const legacy=vm.runInNewContext(src+
 "\n({leaderId:selectedLeaderId,regularIds:selectedPartyIds.slice()})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
assert.equal(legacy.leaderId,null);
assert.deepEqual(Array.from(legacy.regularIds),["lyra","kael",null,null]);

// A malformed formation still recovers the first five roster fighters.
storageData.set("ashes-throne.squad.v1",
 '{"version":1,"leaderId":"missing","regularIds":["kael"]}');
const recovered=vm.runInNewContext(src+
 "\n({leaderId:selectedLeaderId,selectedParty:()=>selectedParty().map(h=>h.id)})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
assert.equal(recovered.leaderId,"kael");
assert.equal(recovered.selectedParty().length,5);

// A smaller unlocked roster, when fully selected, needs no warning.
storageData.set("ashes-throne.squad.v1",
 '{"version":1,"leaderId":"kael","regularIds":["lyra","darin","medic-demo"]}');
const short=vm.runInNewContext(src+
 "\n({getBattle:()=>state,openSquad,ALLIES,selectedParty:()=>selectedParty().map(h=>h.id)})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
short.ALLIES.splice(4); // Keep original four-hero warning fixture, exclude the two additional entries.
short.openSquad();
assert.equal(short.selectedParty().length,4);
elements.squadStart.handlers.click.at(-1)();
assert.equal(elements.battle.classList.active,true,
 "no warning when all available heroes are selected");
console.log("Combat-014D stable slots, first vacancy, no auto-promotion, aura gating, saved holes and warnings passed");
