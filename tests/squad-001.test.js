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
assert.match(elements.squadSlots.innerHTML,/Каэль/);
assert.equal(api.getBattle().leaderId,null,"initial sandbox battle is still legacy");
assert.match(elements.squadHint.textContent,/нет лидерской способности/);
assert.equal(api.toggleSquadHero("kael"),true,"regular click removes first-slot leader");
assert.equal(count(),"4/5");
assert.match(elements.squadSlots.innerHTML,/★ ЛИДЕР/);
assert.match(elements.squadSlots.innerHTML,/squad-slot-leader[^]*?Свободно/,"leader slot remains empty");
assert.match(elements.squadSlots.innerHTML,/squad-slot filled[^]*?Лира/,"second hero remains in position 2");
assert.equal(api.toggleSquadHero("darin"),true);
assert.equal(count(),"3/5");
assert.equal(api.toggleSquadHero("lyra"),true);
assert.equal(count(),"2/5");
assert.equal(api.toggleSquadHero("medic-demo"),true);
assert.equal(count(),"1/5");
assert.equal(api.toggleSquadHero("test-area-damage"),true);
assert.equal(count(),"0/5");
assert.equal(elements.squadStart.disabled,true,"empty party cannot start");
assert.equal(api.toggleSquadHero("lyra"),true);
assert.equal(count(),"1/5");
click(elements.squadStart);
assert.equal(elements.squad.classList.active,true,"first click warns before a short-handed battle");
assert.match(elements.squadWarning.textContent,/Нажми «Начать бой» ещё раз/);
assert.equal(elements.squadWarning.hidden,false);
click(elements.squadStart);
assert.equal(elements.squadWarning.hidden,true);
assert.equal(elements.battle.classList.active,true);
assert.equal(allyIds(),"lyra");
assert.equal(api.getBattle().leaderId,"lyra","first selected hero after an empty squad occupies slot 1");
assert.equal(engineCreates,1);
assert.equal(meshCreates,33,"eleven fighter templates including Ren get 3D shapes");
assert.equal(createdCameras.length,1,"one 3D camera allocated");
const camera=createdCameras[0];
assert.ok(Math.abs(camera.alpha+3*Math.PI/4)<1e-9);
assert.equal(camera.beta,.96);
assert.equal(camera.radius,12);
assert.equal(camera.target.y,.9);
assert.equal(camera.lowerBetaLimit,.55);
assert.equal(camera.lowerRadiusLimit,12);
assert.equal(camera.upperRadiusLimit,21);
assert.equal(camera.upperBetaLimit,1.30);
assert.equal(api.getBattle().fighters[api.getBattle().currentActor].side,"ally");

// Replay returns to the same saved composition, without 3D reallocation.
api.getBattle().active=false;
api.getBattle().winner="ally";
api.syncBattleUI();
assert.equal(elements.battleRetryBtn.hidden,false);
click(elements.battleRetryBtn);
assert.equal(elements.squad.classList.active,true);
assert.equal(count(),"1/5");
assert.equal(api.toggleSquadHero("kael"),true);
assert.equal(count(),"2/5");
camera.alpha=0;camera.beta=1.2;camera.radius=12;
click(elements.squadStart);
assert.equal(elements.squad.classList.active,true,"retry confirmation resets on squad change");
click(elements.squadStart);
assert.equal(allyIds(),"lyra,kael","first selected hero remains leader; tap order sets formation");
assert.equal(camera.alpha,-3*Math.PI/4);
assert.equal(camera.beta,.96);
assert.equal(camera.radius,12);
assert.equal(createdCameras.length,1);
assert.equal(engineCreates,1);
assert.equal(meshCreates,33,"replay reuses 3D meshes for expanded roster");

// All entry points still route through the composition screen.
api.openSquad();
click(elements.squadBack);
assert.equal(elements.home.classList.active,true);
click(arenaNav);
assert.equal(elements.squad.classList.active,true);
api.openSquad("campaign");
click(elements.squadBack);
assert.equal(elements.campaign.classList.active,true);
assert.equal(api.openCampaignMission("black-pass-ambush"),true);
assert.equal(elements.squad.classList.active,true);
assert.equal(api.selectedParty().join(","),"lyra,kael");
assert.doesNotMatch(elements.squadRoster.innerHTML,/data-leader-id|В лидеры/,"ordinary selection is the only way to fill leader slot");
// Disband is explicit, clears all five displayed positions and prevents
// entry until at least one hero is selected again.
click(elements.squadDisband);
assert.equal(count(),"0/5");
assert.equal(elements.squadStart.disabled,true);
assert.equal((elements.squadSlots.innerHTML.match(/Свободно/g)||[]).length,5,"disband clears every slot");
assert.equal(elements.squadWarning.hidden,true);
click(elements.squadStart);
assert.equal(elements.squad.classList.active,true);
assert.equal(api.selectedParty().length,0);
console.log("Squad-001 first-five, undersized warning and second tap, disband, replay and 3D reuse passed");
