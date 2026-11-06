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
 "\n({getBattle:()=>state,selectedParty:()=>selectedParty().map(h=>h.id),showScreen,openSquad,renderSquad,assignSquadLeader,toggleSquadHero,CombatCore})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
function click(el){const h=el.handlers.click;assert.ok(h?.length,"missing click handler");h[0]();}
function toggle(id){click(chooseNodes.find(el=>el.dataset.heroId===id));}
const allyIds=()=>api.getBattle().fighters.filter(h=>h.side==="ally").map(h=>h.id).join(",");
const count=()=>elements.squadCount.textContent;

// Initial composition contains the first five roster heroes with slot 1
// occupied by Kael; the test-only definition grants him an aura.
click(elements.startBattle);
assert.match(elements.squadSlots.innerHTML,/squad-slot-leader filled/);
assert.match(elements.squadSlots.innerHTML,/Каэль/);
assert.equal(api.selectedParty().join(","),"kael,lyra,darin,medic-demo,test-area-damage");
assert.equal(count(),"5/5");
assert.match(elements.squadRoster.innerHTML,/data-leader-id="kael"/);
assert.match(elements.squadRoster.innerHTML,/data-leader-id="lyra"/);
assert.equal(api.assignSquadLeader("missing"),false);

// Move Lyra to leader via actual roster control. No leader ability:
// appointment is allowed, but no one gets Kael's ability in battle.
leaderNode.dataset.leaderId="lyra";
click(leaderNode);
assert.equal(api.selectedParty()[0],"lyra");
assert.equal(api.selectedParty().length,5);
assert.equal(new Set(api.selectedParty()).size,5,"no duplicates");
assert.match(elements.squadHint.textContent,/нет лидерской способности/);
click(elements.squadStart);
assert.equal(api.getBattle().leaderId,"lyra");
assert.equal(api.getBattle().fighters[0].id,"lyra");
assert.equal(api.CombatCore.activeLeaderModifiers(api.getBattle(),"kael").length,0);
assert.equal(api.CombatCore.effectiveStat(api.getBattle(),
 api.getBattle().fighters.find(x=>x.id==="kael"),"atk"),
 api.getBattle().fighters.find(x=>x.id==="kael").atk);

// Promote Kael: leader skill activates only while in slot 1.
api.openSquad();
assert.equal(api.assignSquadLeader("kael"),true);
assert.equal(api.selectedParty()[0],"kael");
click(elements.squadStart);
assert.equal(api.getBattle().leaderId,"kael");
assert.equal(api.CombatCore.effectiveStat(api.getBattle(),
 api.getBattle().fighters.find(x=>x.id==="lyra"),"atk"),
 api.getBattle().fighters.find(x=>x.id==="lyra").atk+4);

// Removing leader changes the saved formation for the next battle but
// cannot mutate an already running/finished battle.
api.openSquad();
click(clearLeaderNode);
assert.match(elements.squadSlots.innerHTML,/Не назначен/);
assert.equal(api.selectedParty().length,4);
assert.equal(api.getBattle().leaderId,"kael");
click(elements.squadStart);
assert.equal(api.getBattle().leaderId,null);
assert.equal(api.getBattle().fighters.filter(x=>x.side==="ally").length,4);
assert.ok(storageData.has("ashes-throne.squad.v1"));

// A page reload reconstructs the last formation from localStorage.
const reload=vm.runInNewContext(src+
 "\n({leaderId:selectedLeaderId,regularIds:selectedPartyIds.slice(),selectedParty:()=>selectedParty().map(h=>h.id)})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
assert.equal(reload.leaderId,null);
assert.equal(reload.selectedParty().join(","),api.selectedParty().join(","));

// A broken save safely falls back to the first five, with the first leading.
storageData.set("ashes-throne.squad.v1",'{"version":1,"leaderId":"missing","regularIds":["kael"]}');
const recovered=vm.runInNewContext(src+
 "\n({leaderId:selectedLeaderId,selectedParty:()=>selectedParty().map(h=>h.id)})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
assert.equal(recovered.leaderId,"kael");
assert.equal(recovered.selectedParty().length,5);
console.log("Combat-014C any-hero slot, skill gating, default five, storage reload and corrupt-save fallback passed");
