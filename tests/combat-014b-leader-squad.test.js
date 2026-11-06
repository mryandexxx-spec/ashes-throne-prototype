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
 "squadSlots","squadHint","detailBack","detailHome","detailUpgrade","squadCount"];
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
const api=vm.runInNewContext(src+
 "\n({getBattle:()=>state,selectedParty:()=>selectedParty().map(h=>h.id),showScreen,openSquad,renderSquad,assignSquadLeader,toggleSquadHero,CombatCore})",
 {document,window:{addEventListener(){}},BABYLON});
function click(el){const h=el.handlers.click;assert.ok(h?.length,"missing click handler");h[0]();}
function toggle(id){click(chooseNodes.find(el=>el.dataset.heroId===id));}
const allyIds=()=>api.getBattle().fighters.filter(h=>h.side==="ally").map(h=>h.id).join(",");
const count=()=>elements.squadCount.textContent;

// An eligible actor gets an explicit selector, while other allies do not.
click(elements.startBattle);
assert.match(elements.squadSlots.innerHTML,/squad-slot-leader/);
assert.match(elements.squadRoster.innerHTML,/data-leader-id="kael"/);
assert.doesNotMatch(elements.squadRoster.innerHTML,/data-leader-id="lyra"/);
assert.equal(api.assignSquadLeader("lyra"),false,"ineligible character cannot lead");
assert.equal(api.assignSquadLeader("missing"),false);
assert.equal(api.assignSquadLeader("kael"),true);
assert.match(elements.squadSlots.innerHTML,/★ ЛИДЕР/);
assert.match(elements.squadSlots.innerHTML,/squad-slot-leader filled/);
assert.match(elements.squadSlots.innerHTML,/Каэль/);
assert.equal(api.selectedParty()[0],"kael","leader occupies first position");
assert.equal(api.selectedParty().filter(id=>id==="kael").length,1,"no duplicate leader");
assert.equal(count(),"3/5","moving a regular hero into leader slot retains party count");

// Four regular allies may join the selected leader; all five fit.
assert.equal(api.toggleSquadHero("medic-demo"),true);
assert.equal(api.toggleSquadHero("test-area-damage"),true);
assert.equal(count(),"5/5");
assert.equal(api.selectedParty()[0],"kael");
assert.equal(api.selectedParty().length,5);
assert.equal(api.assignSquadLeader("lyra"),false);
click(elements.squadStart);
assert.equal(api.getBattle().leaderId,"kael","selected leader is passed to CombatCore.createBattle");
assert.equal(api.getBattle().fighters.filter(h=>h.side==="ally").length,5);
assert.equal(api.getBattle().fighters[0].id,"kael");
assert.equal(api.CombatCore.effectiveStat(api.getBattle(),api.getBattle().fighters[1],"atk"),
 api.getBattle().fighters[1].atk+4,"leader aura applies in actual battle");

// On reopening composition, removing the leader clears the leader slot and
// restores the four regular places without assigning anybody else.
api.openSquad();
assert.equal(api.assignSquadLeader(null),true);
assert.equal(api.getBattle().leaderId,"kael","an already started battle remains immutable");
assert.match(elements.squadSlots.innerHTML,/Не назначен/);
assert.equal(api.selectedParty().length,4);
assert.equal(api.selectedParty().includes("kael"),false);
click(elements.squadStart);
assert.equal(api.getBattle().leaderId,null,"future battle has no leader after clear");

// Repeated opens should never silently reappoint a removed leader.
api.openSquad();
assert.equal(api.selectedParty().length,4);
assert.match(elements.squadSlots.innerHTML,/Не назначен/);
console.log("Combat-014B UI eligibility, leader slot, promotion, cap, battle handoff and removal passed");
