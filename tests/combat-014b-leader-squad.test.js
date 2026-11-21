"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const src=["initiative-model.js","ability-data.js","combat-core.js","progress-core.js","mission-data.js","campaign-core.js","campaign-data.js","battle-speed.js","animation-profiles.js","battle-animation.js","game.js"].map(n=>{
 let file=fs.readFileSync(path.join(__dirname,"..",n),"utf8");
 // Test-only injectable leader, never part of the shipped HEROES/ability data.
 if(n==="ability-data.js")file=file.replace("const leaderByHero=Object.freeze({",
  'const leaderByHero=Object.freeze({ren:Object.freeze({id:"leader",modifiers:Object.freeze([{stat:"atk",operation:"flat",value:4,scope:"all-allies",when:{kind:"always"}}])}),');
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
const chooseNodes=["ren","nada","liora","art","sava"].map(id=>{
 const e=element();e.dataset.heroId=id;return e;
});
const leaderNode=element();leaderNode.dataset.leaderId="ren";
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
  if(q==="[data-hero-id]"||q==="#squadRoster .squad-choice[data-hero-id],#squadSlots .squad-slot[data-hero-id]")return chooseNodes;
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
// Exercise leader aura and stable slots with an explicit legacy formation.
storageData.set("ashes-throne.squad.v1",JSON.stringify({version:1,leaderId:"ren",
 regularIds:["nada","liora","art","sava"]}));
const api=vm.runInNewContext(src+
 "\n({getBattle:()=>state,selectedParty:()=>selectedParty().map(h=>h.id),showScreen,openSquad,renderSquad,toggleSquadHero,CombatCore})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
function click(el){const h=el.handlers.click;assert.ok(h?.length,"missing click handler");h[0]();}
function toggle(id){click(chooseNodes.find(el=>el.dataset.heroId===id));}
const allyIds=()=>api.getBattle().fighters.filter(h=>h.side==="ally").map(h=>h.id).join(",");
const count=()=>elements.squadCount.textContent;

const slots=()=>Array.from(elements.squadSlots.innerHTML.matchAll(/squad-slot-content">([^<]*)/g),m=>m[1]);

// Default formation: all five permanent heroes selected; Ren has no leader aura.
click(elements.startBattle);
assert.equal(count(),"5/5");
assert.deepEqual(slots(),["Рен Терен","Нада","Лиора Вель","Арт","Сава"]);
assert.doesNotMatch(elements.squadRoster.innerHTML,/data-leader-id|В лидеры/);
click(elements.squadStart);
assert.equal(api.getBattle().leaderId,null);
assert.equal(api.CombatCore.activeLeaderModifiers(api.getBattle(),"nada").length,0);

// Removing slot 1 leaves it empty. It never shifts another fighter.
api.openSquad();
toggle("ren");
assert.equal(count(),"4/5");
assert.deepEqual(slots(),["Свободно","Нада","Лиора Вель","Арт","Сава"]);
assert.equal(api.selectedParty().join(","),"nada,liora,art,sava");
click(elements.squadStart);
assert.equal(elements.squad.classList.active,true,"first tap warns with four of five allies");
assert.match(elements.squadWarning.textContent,/Нажми «Начать бой» ещё раз/);
click(elements.squadStart);
assert.equal(api.getBattle().leaderId,null,"empty first cell has no implicit leader");
assert.equal(api.CombatCore.activeLeaderModifiers(api.getBattle(),"nada").length,0,
 "Kael's leader skill is inactive when Kael is missing");

// First available vacancy is slot 1, so reselecting Kael fills it immediately.
api.openSquad();
toggle("ren");
assert.deepEqual(slots(),["Рен Терен","Нада","Лиора Вель","Арт","Сава"]);
assert.equal(count(),"5/5");
click(elements.squadStart);
assert.equal(api.getBattle().leaderId,null);

// Removing a middle hero leaves the exact middle cell empty.
// Re-adding that hero fills the earliest vacancy, not the last cell.
api.openSquad();
toggle("liora");
assert.deepEqual(slots(),["Рен Терен","Нада","Свободно","Арт","Сава"]);
toggle("liora");
assert.deepEqual(slots(),["Рен Терен","Нада","Лиора Вель","Арт","Сава"]);
assert.equal(new Set(api.selectedParty()).size,5,"no duplicate fighters");

// Save an intentionally empty leader slot and a middle gap.
toggle("ren");
toggle("liora");
const gaps=["Свободно","Нада","Свободно","Арт","Сава"];
assert.deepEqual(slots(),gaps);
const stored=JSON.parse(storageData.get("ashes-throne.squad.v1"));
assert.equal(stored.leaderId,null);
assert.deepEqual(stored.regularIds,["nada",null,"art","sava"]);
const restored=vm.runInNewContext(src+
 "\n({leaderId:selectedLeaderId,regularIds:selectedPartyIds.slice(),selectedParty:()=>selectedParty().map(h=>h.id)})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
assert.equal(restored.leaderId,null);
assert.deepEqual(Array.from(restored.regularIds),["nada",null,"art","sava"]);
assert.equal(restored.selectedParty().join(","),"nada,art,sava");

// Selecting Kael fills slot 1 while leaving slot 3 empty; selecting Darin
// then fills slot 3, proving consistent first-free-slot order.
toggle("ren");
assert.deepEqual(slots(),["Рен Терен","Нада","Свободно","Арт","Сава"]);
toggle("liora");
assert.equal(count(),"5/5");
assert.deepEqual(slots(),["Рен Терен","Нада","Лиора Вель","Арт","Сава"]);

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
toggle("nada");
assert.deepEqual(slots(),["Нада","Свободно","Свободно","Свободно","Свободно"]);
click(elements.squadStart);
assert.equal(elements.squad.classList.active,true);
toggle("liora");
assert.equal(elements.squadWarning.hidden,true,"changing team resets warning");
click(elements.squadStart);
assert.equal(elements.squad.classList.active,true);
click(elements.squadStart);
assert.equal(api.getBattle().leaderId,null);

// Old Combat-014C save: leader intentionally empty while later slots
// have occupants. Preserve their actual positions; do not promote.
storageData.set("ashes-throne.squad.v1",
 '{"version":1,"leaderId":null,"regularIds":["nada","ren"]}');
const legacy=vm.runInNewContext(src+
 "\n({leaderId:selectedLeaderId,regularIds:selectedPartyIds.slice()})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
assert.equal(legacy.leaderId,null);
assert.deepEqual(Array.from(legacy.regularIds),["nada","ren",null,null]);

// A malformed formation recovers the current default five playable heroes.
storageData.set("ashes-throne.squad.v1",
 '{"version":1,"leaderId":"missing","regularIds":["ren"]}');
const recovered=vm.runInNewContext(src+
 "\n({leaderId:selectedLeaderId,selectedParty:()=>selectedParty().map(h=>h.id)})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
assert.equal(recovered.leaderId,"ren");
assert.equal(recovered.selectedParty().length,5);

// A smaller unlocked roster, when fully selected, needs no warning.
storageData.set("ashes-throne.squad.v1",
 '{"version":1,"leaderId":"ren","regularIds":["nada","liora","art"]}');
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
