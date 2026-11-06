"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const src=["initiative-model.js","ability-data.js","combat-core.js","progress-core.js","mission-data.js","campaign-core.js","campaign-data.js","battle-speed.js","animation-profiles.js","battle-animation.js","game.js"].map(n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8")).join("\n");
const ids=["home","collection","campaign","squad","battle","heroList","combatants",
 "battleStatus","turnChip","actionTitle","actionHint","attackBtn",
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
 "\n({getBattle:()=>state,selectedParty:()=>selectedPartyIds.slice(),showScreen,openSquad,openCampaignMission,renderSquad,syncBattleUI})",
 {document,window:{addEventListener(){}},BABYLON});
function click(el){const h=el.handlers.click;assert.ok(h?.length,"missing click handler");h[0]();}
function toggle(id){click(chooseNodes.find(el=>el.dataset.heroId===id));}
const allyIds=()=>api.getBattle().fighters.filter(h=>h.side==="ally").map(h=>h.id).join(",");
const count=()=>elements.squadCount.textContent;

// All entry points open preparation, never the arena directly.
click(elements.startBattle);
assert.equal(elements.squad.classList.active,true);
assert.equal(elements.battle.classList.active,false);
assert.equal(count(),"3/5");
assert.match(elements.squadSlots.innerHTML,/Свободно/);
toggle("kael");toggle("darin");
assert.equal(count(),"1/5");
click(elements.squadStart);
assert.equal(elements.battle.classList.active,true);
assert.equal(allyIds(),"lyra");
assert.equal(engineCreates,1);
assert.equal(meshCreates,27,"nine demo fighter templates get 3D shapes");
assert.equal(createdCameras.length,1,"one 3D camera allocated");
const camera=createdCameras[0];
assert.ok(Math.abs(camera.alpha+3*Math.PI/4)<1e-9,"front-left isometric camera (allies foreground)");
assert.equal(camera.beta,.96);
assert.equal(camera.radius,17);
assert.equal(camera.target.y,.9);
assert.equal(camera.lowerBetaLimit,.55);
assert.equal(camera.upperBetaLimit,1.30);
const enemyIds=()=>api.getBattle().fighters.filter(h=>h.side==="enemy").map(h=>h.id).join(",");
assert.equal(enemyIds(),"ves,shade");
assert.equal(api.getBattle().fighters[api.getBattle().currentActor].side,"ally");

// Replay must re-open composition; a different lineup must reuse engine and meshes.
api.getBattle().active=false;
api.getBattle().winner="ally";
api.syncBattleUI();
click(elements.attackBtn);
assert.equal(elements.squad.classList.active,true);
toggle("kael");
assert.equal(count(),"2/5");
camera.alpha=0;camera.beta=1.2;camera.radius=12; // Player rotated/zoomed the camera during a previous fight.
click(elements.squadStart);
assert.equal(allyIds(),"kael,lyra");
assert.equal(camera.alpha,-3*Math.PI/4,"restart restores isometric angle");
assert.equal(camera.beta,.96,"restart restores camera elevation");
assert.equal(camera.radius,17,"restart restores complete team framing");
assert.equal(createdCameras.length,1,"camera reused across encounters");
assert.equal(engineCreates,1,"scene and engine are reused");
assert.equal(meshCreates,27,"no 3D allocations on re-entry");

// Empty squads are blocked; restoring a hero re-enables battle.
api.openSquad();
toggle("kael");toggle("lyra");
assert.equal(count(),"0/5");
assert.equal(elements.squadStart.disabled,true);
click(elements.squadStart);
assert.equal(elements.squad.classList.active,true);
toggle("darin");
assert.equal(elements.squadStart.disabled,false);
click(elements.squadBack);
assert.equal(elements.home.classList.active,true);
click(arenaNav);
assert.equal(elements.squad.classList.active,true,"arena entry routes through squad");
click(elements.squadStart);
assert.equal(allyIds(),"darin");
api.openSquad("campaign");
click(elements.squadBack);
assert.equal(elements.campaign.classList.active,true,"back returns to campaign");
assert.equal(api.openCampaignMission("black-pass-ambush"),true);
assert.equal(elements.squad.classList.active,true,"campaign entry routes through squad");
assert.equal(rendersStarted,3,"only actual combat entries start render loop");
assert.equal(api.selectedParty().join(","),"darin");
console.log("Squad-001 prebattle selection, entry points, replay and 3D reuse passed");
