"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const src=["initiative-model.js","ability-data.js","combat-core.js","progress-core.js","mission-data.js","campaign-core.js","campaign-data.js","battle-speed.js","animation-profiles.js","battle-animation.js","game.js"].map(n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8")).join("\n");
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
const chooseNodes=["ren","nada","liora"].map(id=>{
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
  if(q==="[data-hero-id]"||q==="#squadRoster .squad-choice[data-hero-id],#squadSlots .squad-slot[data-hero-id]")return chooseNodes;
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
 "\n({getBattle:()=>state,selectedParty:()=>selectedParty().map(h=>h.id),showScreen,openSquad,openCampaignMission,renderSquad,syncBattleUI,toggleSquadHero})",
 {document,window:{addEventListener(){}},BABYLON});
function click(el){const h=el.handlers.click;assert.ok(h?.length,"missing click handler");h[0]();}
function toggle(id){click(chooseNodes.find(el=>el.dataset.heroId===id));}
const allyIds=()=>api.getBattle().fighters.filter(h=>h.side==="ally").map(h=>h.id).join(",");
const count=()=>elements.squadCount.textContent;

// On first start the first five roster heroes fill all positions.
click(elements.startBattle);
assert.equal(elements.squad.classList.active,true);
assert.equal(elements.battle.classList.active,false);
assert.equal(count(),"5/5");
assert.match(elements.squadSlots.innerHTML,/squad-slot-leader filled/);
assert.match(elements.squadSlots.innerHTML,/Рен Терен/);
for(const name of ["Нада","Лиора Вель","Сава","Арт"])
 assert.ok(elements.squadSlots.innerHTML.includes(name),"default formation includes "+name);
// The rest of this legacy test verifies the original sandbox fighters' slot
// and camera contracts. Select them explicitly rather than assuming defaults.
click(elements.squadDisband);
for(const id of ["ren","nada","liora","art","sava"])
 assert.equal(api.toggleSquadHero(id),true);
assert.equal(count(),"5/5");
assert.equal(api.getBattle().leaderId,null,"first selected real hero leads");
assert.match(elements.squadHint.textContent,/лидерская способность отсутствует/);
assert.equal(api.toggleSquadHero("ren"),true,"regular click removes first-slot leader");
assert.equal(count(),"4/5");
assert.match(elements.squadSlots.innerHTML,/★ ЛИДЕР/);
assert.match(elements.squadSlots.innerHTML,/squad-slot-leader[^]*?Свободно/,"leader slot remains empty");
assert.match(elements.squadSlots.innerHTML,/squad-slot filled[^]*?Нада/,"second hero remains in position 2");
assert.equal(api.toggleSquadHero("liora"),true);
assert.equal(count(),"3/5");
assert.equal(api.toggleSquadHero("nada"),true);
assert.equal(count(),"2/5");
assert.equal(api.toggleSquadHero("art"),true);
assert.equal(count(),"1/5");
assert.equal(api.toggleSquadHero("sava"),true);
assert.equal(count(),"0/5");
assert.equal(elements.squadStart.disabled,true,"empty party cannot start");
assert.equal(api.toggleSquadHero("nada"),true);
assert.equal(count(),"1/5");
click(elements.squadStart);
assert.equal(elements.squad.classList.active,true,"first click warns before a short-handed battle");
assert.match(elements.squadWarning.textContent,/Нажми «Начать бой» ещё раз/);
assert.equal(elements.squadWarning.hidden,false);
click(elements.squadStart);
assert.equal(elements.squadWarning.hidden,true);
// The permanent heroes use asynchronous GLB preload before the battle appears.
// This unit fixture has no asset loader; loading is not a failed battle.
assert.equal(elements.squad.classList.active,true,"real-hero 3D loading is asynchronous");
assert.equal(api.selectedParty().join(","),"nada");
assert.equal(elements.squadWarning.hidden,true);
assert.equal(api.getBattle().leaderId,null,"no implicit leader aura for Nada");
assert.equal(engineCreates,1,"entry creates one scene without duplicating the renderer");
// Existing DOM controls remain usable while the 3D loading gate is unresolved.
api.openSquad();
assert.equal(elements.squad.classList.active,true);
assert.equal(api.toggleSquadHero("ren"),true);
assert.equal(count(),"2/5");
assert.equal(new Set(api.selectedParty()).size,2);
click(elements.squadDisband);
assert.equal(count(),"0/5");
assert.equal(elements.squadStart.disabled,true);
console.log("Squad-001 five-story-hero selection, warning, empty slot and loading-gate contracts passed");
