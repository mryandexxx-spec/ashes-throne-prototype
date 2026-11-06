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

// On first visit the first five roster heroes are selected automatically.
click(elements.startBattle);
assert.equal(count(),"5/5");
assert.equal(api.selectedParty().join(","),"kael,lyra,darin,medic-demo,test-area-damage");
assert.match(elements.squadSlots.innerHTML,/squad-slot-leader filled/);
assert.match(elements.squadSlots.innerHTML,/Каэль/);
assert.doesNotMatch(elements.squadRoster.innerHTML,/data-leader-id|В лидеры|Назначить лидером/,
 "there is no special leader appointment action");
assert.equal(api.CombatCore.effectiveStat(
 api.getBattle(),api.getBattle().fighters[0],"atk"),api.getBattle().fighters[0].atk,
 "the initial sandbox battle has no selected leader");
click(elements.squadStart);
assert.equal(api.getBattle().leaderId,"kael");
assert.equal(api.CombatCore.effectiveStat(api.getBattle(),
 api.getBattle().fighters.find(h=>h.id==="lyra"),"atk"),
 api.getBattle().fighters.find(h=>h.id==="lyra").atk+4,
 "a leading hero with a leader skill activates it automatically");

// Removing first hero shifts the next into the first position and disables
// the previous leader's skill without extra selection controls.
api.openSquad();
toggle("kael");
assert.equal(count(),"4/5");
assert.equal(api.selectedParty()[0],"lyra");
assert.match(elements.squadSlots.innerHTML,/Лира/);
assert.equal(api.selectedParty().includes("kael"),false);
assert.equal(api.toggleSquadHero("kael"),true);
assert.equal(api.selectedParty().join(","),"lyra,darin,medic-demo,test-area-damage,kael",
 "re-added hero fills last free slot without jumping to leader");
click(elements.squadStart);
assert.equal(api.getBattle().leaderId,"lyra");
assert.equal(api.CombatCore.activeLeaderModifiers(api.getBattle(),"kael").length,0,
 "an ability holder in a non-leading slot has no aura");

// Disband clears all positions and its empty state survives a page reload.
api.openSquad();
click(elements.squadDisband);
assert.equal(count(),"0/5");
assert.equal((elements.squadSlots.innerHTML.match(/Свободно/g)||[]).length,5);
assert.equal(elements.squadStart.disabled,true);
assert.equal(api.selectedParty().length,0);
assert.ok(storageData.has("ashes-throne.squad.v1"));
let reload=vm.runInNewContext(src+
 "\n({leaderId:selectedLeaderId,selectedParty:()=>selectedParty().map(h=>h.id)})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
assert.equal(reload.leaderId,null);
assert.equal(reload.selectedParty().length,0);

// The first ordinary tap now fills the highlighted leader slot, even when
// selecting a hero without a leader skill.
toggle("lyra");
assert.equal(count(),"1/5");
assert.match(elements.squadSlots.innerHTML,/squad-slot-leader filled/);
assert.match(elements.squadSlots.innerHTML,/Лира/);
assert.doesNotMatch(elements.squadRoster.innerHTML,/data-leader-id|В лидеры/);
click(elements.squadStart);
assert.equal(elements.squad.classList.active,true,
 "first attempt warns when other combat heroes are available");
assert.match(elements.squadWarning.textContent,/Нажми «Начать бой» ещё раз/);
assert.equal(api.toggleSquadHero("darin"),true);
assert.equal(elements.squadWarning.hidden,true,"changing composition resets consent");
click(elements.squadStart);
assert.equal(elements.squad.classList.active,true,"first tap after change warns again");
click(elements.squadStart);
assert.equal(api.getBattle().leaderId,"lyra");
assert.equal(api.getBattle().fighters[0].id,"lyra");
assert.equal(api.CombatCore.activeLeaderModifiers(api.getBattle(),"darin").length,0);

// Choose Kael first after clearing, to verify the ability activates only
// according to the new first-position contract.
api.openSquad();
click(elements.squadDisband);
toggle("kael");
toggle("lyra");
assert.equal(api.selectedParty().join(","),"kael,lyra");
click(elements.squadStart);
click(elements.squadStart);
assert.equal(api.getBattle().leaderId,"kael");
assert.equal(api.CombatCore.effectiveStat(api.getBattle(),
 api.getBattle().fighters[1],"atk"),api.getBattle().fighters[1].atk+4);
reload=vm.runInNewContext(src+
 "\n({leaderId:selectedLeaderId,selectedParty:()=>selectedParty().map(h=>h.id)})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
assert.equal(reload.leaderId,"kael");
assert.equal(reload.selectedParty().join(","),"kael,lyra");

// Old saves with an empty first slot are compacted on restore.
storageData.set("ashes-throne.squad.v1",
 '{"version":1,"leaderId":null,"regularIds":["lyra","kael"]}');
const migrated=vm.runInNewContext(src+
 "\n({leaderId:selectedLeaderId,selectedParty:()=>selectedParty().map(h=>h.id)})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
assert.equal(migrated.leaderId,"lyra");
assert.equal(migrated.selectedParty().join(","),"lyra,kael");

// A corrupted saved roster falls back safely to the first five.
storageData.set("ashes-throne.squad.v1",
 '{"version":1,"leaderId":"missing","regularIds":["kael"]}');
const recovered=vm.runInNewContext(src+
 "\n({leaderId:selectedLeaderId,selectedParty:()=>selectedParty().map(h=>h.id)})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
assert.equal(recovered.leaderId,"kael");
assert.equal(recovered.selectedParty().length,5);

// If fewer than five allies are available, a complete smaller roster has
// no warning, even though it occupies fewer than five slots.
storageData.set("ashes-throne.squad.v1",
 '{"version":1,"leaderId":"kael","regularIds":["lyra","darin","medic-demo"]}');
const short=vm.runInNewContext(src+
 "\n({getBattle:()=>state,openSquad,ALLIES,selectedParty:()=>selectedParty().map(h=>h.id)})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
short.ALLIES.pop();
short.openSquad();
assert.equal(short.selectedParty().length,4);
elements.squadStart.handlers.click.at(-1)();
assert.equal(elements.battle.classList.active,true,
 "all available heroes selected: battle starts immediately");
console.log("Combat-014D ordinary first slot, promotion, ability gating, disband, migration and warning passed");
