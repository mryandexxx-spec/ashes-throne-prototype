"use strict";
const assert=require("assert"),fs=require("fs"),path=require("path"),vm=require("vm");
function load(srcs,extra=""){
 const src=srcs.map(n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8")).join("\n");
 const ids=["home","collection","campaign","squad","battle","heroList","combatants","battleStatus","turnChip","actionTitle","actionHint","battleRetryBtn","basicAbilityBtn","specialAbilityBtn","battleMessage","renderCanvas","startBattle","campaignBattle","campaignMissions","missionResultBack","missionResultRetry","missionResultHome","missionResult","missionResultTitle","missionResultText","campaignMissionStatus","campaignSaveStatus","squadBack","squadStart","squadRoster","squadSlots","squadHint","squadWarning","squadDisband","detailBack","detailHome","detailUpgrade","squadCount"];
 function element(id=""){return{id,dataset:{},innerHTML:"",textContent:"",disabled:false,handlers:{},classList:{active:id==="home",contains(x){return !!this[x]},add(x){this[x]=true},remove(x){this[x]=false},toggle(x,v){this[x]=!!v}},addEventListener(type,fn){(this.handlers[type]??=[]).push(fn)}};}
 const elements=Object.fromEntries(ids.map(id=>[id,element(id)]));
 const chooseNodes=["kael","lyra","darin"].map(id=>{const e=element();e.dataset.heroId=id;return e;});
 const arenaNav=element();arenaNav.dataset.screen="battle";
 const collectionNav=element();collectionNav.dataset.screen="collection";
 const allScreens=["home","collection","campaign","squad","battle"].map(id=>elements[id]);
 const document={hidden:false,querySelector(q){return elements[q.slice(1)]},querySelectorAll(q){if(q===".screen")return allScreens;if(q==="[data-screen]")return [arenaNav,collectionNav];if(q==="[data-hero-id]")return chooseNodes;return []},addEventListener(){}};
 const BABYLON={Engine:class{constructor(){}resize(){}runRenderLoop(){}stopRenderLoop(){}},Scene:class{render(){}},ArcRotateCamera:class{constructor(){}attachControl(){}setTarget(){}},HemisphericLight:class{},DirectionalLight:class{},StandardMaterial:class{constructor(){this.diffuseColor=null;this.specularColor=null;this.emissiveColor=null;}},Vector3:class{constructor(x,y,z){this.x=x;this.y=y;this.z=z;}},Color3:class{constructor(x,y,z){this.x=x;this.y=y;this.z=z;}},Color4:class{constructor(x,y,z){this.x=x;this.y=y;this.z=z;}},MeshBuilder:{CreateGround(){return {position:{},visible:true,setEnabled(){}};},CreateCapsule(){return {position:{},visible:true,setEnabled(){}};},CreateSphere(){return {position:{},visible:true,setEnabled(){}};},CreateCylinder(){return {position:{},visible:true,setEnabled(){}};}}};
 return vm.runInNewContext(src+extra+"\n({getBattle:()=>state,selectedParty:()=>selectedParty().map(h=>h.id),showScreen,openSquad,renderSquad,toggleSquadHero,disbandSquad})",{document,window:{addEventListener(){}},BABYLON});
}
const api=load(["initiative-model.js","ability-data.js","combat-core.js","progress-core.js","mission-data.js","campaign-core.js","campaign-data.js","battle-speed.js","animation-profiles.js","battle-animation.js","game.js"]);
function click(el){const h=el.handlers.click; if(!h?.length){console.log("no handler for",el.id);return;} h[0]();}

click(api.getBattle().document.startBattle);

// ===== SQUAD SELECTION UI =====
const elements=api.getBattle().document;

// 1. squad screen is visible
assert.ok(!elements.squad.classList.contains("active"),"squad screen starts hidden");
click(elements.startBattle);
assert.ok(elements.squad.classList.contains("active"),"squad screen shown after startBattle");

// 2. roster has hero buttons with data-hero-id
const roster=elements.squadRoster;
assert.ok(roster.innerHTML.includes('data-hero-id'),"roster has hero buttons");

// 3. choosing a hero adds them to slots
const firstBtn=roster.querySelector('[data-hero-id]');
assert.ok(firstBtn,"first hero button exists");
click(firstBtn);
assert.ok(elements.squadSlots.innerHTML.includes('squad-slot-card'),"slots have squad-slot-card class");

// 4. leader slot has leader class when filled
assert.ok(elements.squadSlots.innerHTML.includes('squad-slot-card')&&elements.squadSlots.innerHTML.includes('Лидер'),"leader slot remains empty");

// 5. second hero fills next slot
const secondBtn=roster.querySelectorAll('[data-hero-id]')[1];
click(secondBtn);
assert.ok(elements.squadSlots.innerHTML.includes('Лира Соль'),"second hero remains in position 2");

// 6. clicking chosen hero removes them
click(firstBtn);
assert.ok(!elements.squadSlots.innerHTML.includes('Каэль Ворон'),"first hero removed after second click");

// 7. disband clears every slot
click(elements.squadDisband);
assert.equal((elements.squadSlots.innerHTML.match(/squad-slot-empty\">Свободно/g)||[]).length,4,"disband clears every slot (leader slot shows Лидер)");

// 8. squad count updates
assert.equal(elements.squadCount.textContent,"0/5","count resets after disband");

// 9. selecting heroes updates count
click(firstBtn);
assert.equal(elements.squadCount.textContent,"1/5","count 1 after first selection");
click(secondBtn);
assert.equal(elements.squadCount.textContent,"2/5","count 2 after second selection");

// 10. back button returns to home
click(elements.squadBack);
assert.ok(!elements.squad.classList.contains("active"),"squad hidden after back");
assert.ok(elements.home.classList.contains("active"),"home shown after back");

console.log("squad-001: all assertions passed");
