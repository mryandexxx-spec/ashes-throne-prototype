"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const src=["initiative-model.js","ability-data.js","combat-core.js","progress-core.js","save-core.js","mission-data.js","campaign-core.js","campaign-data.js","game.js"].map(n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8")).join("\n");
const ids=["home","collection","campaign","squad","battle","heroList","combatants",
 "battleStatus","turnChip","actionTitle","actionHint","attackBtn",
 "basicAbilityBtn","specialAbilityBtn","battleMessage","renderCanvas",
 "startBattle","campaignBattle","campaignMissions","squadBack","squadStart","squadRoster",
 "squadSlots","squadHint","squadCount","heroDetail","detailName","detailRole","detailGlyph","detailStats","detailLevel","detailWallet","detailCost","detailPreview","detailUpgrade","detailNotice","detailBack","detailHome","battleReward","campaignMissionStatus","campaignMissionStars","campaignChapterProgress","campaignSaveStatus","missionResult","missionResultTitle","missionResultText","missionResultStars","missionResultBack","missionResultRetry","missionResultHome"];
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
const allScreens=["home","collection","campaign","squad","battle","heroDetail","missionResult"].map(id=>elements[id]);
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
 "\n({getBattle:()=>state,getMaterials:()=>progress.materials,getCampaignCompleted:()=>campaignProgress.completed[CampaignCore.MISSION_ID],getLevel:id=>ProgressCore.levelOf(progress,id),selectedParty:()=>selectedPartyIds.slice(),showScreen,openSquad,openHeroDetail,renderSquad,syncBattleUI})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
function click(el){const h=el.handlers.click;assert.ok(h?.length,"missing click handler");h[0]();}
elements.campaignMissions.contains=()=>true;
function clickMission(id="black-pass-ambush"){
 const button={dataset:{campaignMission:id}};
 elements.campaignMissions.handlers.click[0]({target:{closest:()=>button}});
}
function toggle(id){click(chooseNodes.find(el=>el.dataset.heroId===id));}
const allyIds=()=>api.getBattle().fighters.filter(h=>h.side==="ally").map(h=>h.id).join(",");
const count=()=>elements.squadCount.textContent;


// Campaign entrance, not generic arena, activates the mission result screen.
api.showScreen("campaign");
assert.match(elements.campaignMissions.innerHTML,/Не пройдено/);
assert.match(elements.campaignMissions.innerHTML,/Основной путь/);
assert.match(elements.campaignMissions.innerHTML,/Засада у Чёрного перевала/);
assert.match(elements.campaignMissions.innerHTML,/Заблокировано/,"second mission stays locked until first victory");
clickMission();
assert.equal(elements.squad.classList.active,true);
click(elements.squadStart);
assert.equal(elements.battle.classList.active,true);
const first=api.getBattle();
first.active=false;first.winner="enemy";
api.syncBattleUI();
assert.equal(elements.missionResult.classList.active,true,"defeat must show result screen");
assert.match(elements.missionResultTitle.textContent,/не пройдена/);
assert.equal(api.getMaterials(),0);
assert.equal(api.getCampaignCompleted(),false);
click(elements.missionResultRetry);
assert.equal(elements.squad.classList.active,true,"retry returns to squad preparation");
click(elements.squadStart);
assert.equal(elements.battle.classList.active,true);
const win=api.getBattle();
win.active=false;win.winner="ally";
api.syncBattleUI();
assert.equal(elements.missionResult.classList.active,true);
assert.equal(api.getMaterials(),1);
assert.equal(api.getCampaignCompleted(),true);
assert.match(elements.missionResultText.textContent,/\+1 учебный материал/);
assert.ok(savedData.has("ashes-throne.campaign.v1"));
assert.ok(savedData.has("ashes-throne.progress.v1"));
api.syncBattleUI();
assert.equal(api.getMaterials(),1,"re-render must not grant a second reward");
click(elements.missionResultBack);
assert.equal(elements.campaign.classList.active,true);
assert.match(elements.campaignMissions.innerHTML,/Пройдено/);
// Completed missions are replayable and still earn the explicitly approved test material.
clickMission();
click(elements.squadStart);
const replay=api.getBattle();
replay.active=false;replay.winner="ally";
api.syncBattleUI();
assert.equal(api.getMaterials(),2);
assert.match(elements.missionResultText.textContent,/Всего: 2/);
assert.equal(api.getCampaignCompleted(),true);
// New JS instance restores campaign flag, levels and materials.
const reloaded=vm.runInNewContext(src+"\n({campaign:campaignProgress,materials:progress.materials})",
 {document,window:{addEventListener(){},localStorage},BABYLON});
assert.equal(reloaded.campaign.completed["black-pass-ambush"],true);
assert.equal(reloaded.materials,2);
// Return home from mission result does not affect persistent status.
click(elements.missionResultHome);
assert.equal(elements.home.classList.active,true);
console.log("Campaign-001 mission entrance, victory/defeat, reward repeat, persistence and navigation passed");
