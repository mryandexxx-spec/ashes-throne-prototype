"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const src=["initiative-model.js","ability-data.js","combat-core.js","progress-core.js","mission-data.js","campaign-core.js","campaign-data.js","battle-speed.js","animation-profiles.js","battle-animation.js","game.js"].map(n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8")).join("\n");
const ids=["home","collection","campaign","squad","battle","heroList","combatants","battleStatus","turnChip","actionTitle","actionHint","battleRetryBtn","basicAbilityBtn","specialAbilityBtn","battleMessage","renderCanvas","startBattle","campaignBattle","campaignMissions","missionResultBack","missionResultRetry","missionResultHome","missionResult","missionResultTitle","missionResultText","campaignMissionStatus","campaignSaveStatus","squadBack","squadStart","squadRoster","squadSlots","squadHint","squadWarning","squadDisband","detailBack","detailHome","detailUpgrade","squadCount","squadPower","squadLeaderBar","squadLeaderText"];
function element(id=""){return{id,dataset:{},innerHTML:"",textContent:"",disabled:false,hidden:false,handlers:{},classList:{active:id==="home",contains(x){return !!this[x]},add(x){this[x]=true},remove(x){this[x]=false},toggle(x,v){this[x]=!!v}},addEventListener(type,fn){(this.handlers[type]??=[]).push(fn)}};}
const elements=Object.fromEntries(ids.map(id=>[id,element(id)]));
const chooseNodes=["kael","lyra","darin"].map(id=>{const e=element();e.dataset.heroId=id;return e;});
const arenaNav=element();arenaNav.dataset.screen="battle";
const collectionNav=element();collectionNav.dataset.screen="collection";
const allScreens=["home","collection","campaign","squad","battle"].map(id=>elements[id]);
const document={hidden:false,querySelector(q){return elements[q.slice(1)]},querySelectorAll(q){if(q===".screen")return allScreens;if(q==="[data-screen]")return [arenaNav,collectionNav];if(q==="[data-hero-id]")return chooseNodes;if(q===".squad-slot-card[data-slot-index]")return [];return []},addEventListener(){}};
const BABYLON={Engine:class{constructor(){}resize(){}runRenderLoop(){}stopRenderLoop(){}},Scene:class{render(){}},ArcRotateCamera:class{constructor(){}attachControl(){}setTarget(){}},HemisphericLight:class{},DirectionalLight:class{},StandardMaterial:class{constructor(){this.diffuseColor=null;this.specularColor=null;this.emissiveColor=null;}},Vector3:class{constructor(x,y,z){this.x=x;this.y=y;this.z=z;}},Color3:class{constructor(x,y,z){this.x=x;this.y=y;this.z=z;}},Color4:class{constructor(x,y,z){this.x=x;this.y=y;this.z=z;}},MeshBuilder:{CreateGround(){return {position:{},visible:true,setEnabled(){}};},CreateCapsule(){return {position:{},visible:true,setEnabled(){}};},CreateSphere(){return {position:{},visible:true,setEnabled(){}};},CreateCylinder(){return {position:{},visible:true,setEnabled(){}};}}};
const api=vm.runInNewContext(src+"\n({getBattle:()=>state,selectedParty:()=>selectedParty().map(h=>h.id),showScreen,openSquad,renderSquad,toggleSquadHero,disbandSquad,heroPortraitUrl,squadPower})",{document,window:{addEventListener(){}},BABYLON});

test("heroPortraitUrl maps known heroes",()=>{
 assert.ok(api.heroPortraitUrl("ren").includes("ren-portrait"));
 assert.ok(api.heroPortraitUrl("nada").includes("nada-portrait"));
 assert.ok(api.heroPortraitUrl("liora").includes("liora-portrait"));
 assert.ok(api.heroPortraitUrl("art").includes("art-portrait"));
 assert.ok(api.heroPortraitUrl("sava").includes("sava-portrait"));
 assert.strictEqual(api.heroPortraitUrl("unknown"),null);
});

test("squadPower sums hp+atk*5",()=>{
 assert.strictEqual(api.squadPower([]),0);
 assert.strictEqual(api.squadPower([{hp:100,atk:10}]),150);
 assert.strictEqual(api.squadPower([{hp:50,atk:5},{hp:80,atk:12}]),215);
});

test("renderSquad generates SWGOH-style roster cards",()=>{
 api.openSquad();
 const html=elements.squadRoster.innerHTML;
 assert.ok(html.includes('squad-card'),"roster has squad-card class");
 assert.ok(html.includes('squad-card-portrait'),"roster cards have portrait wrapper");
 assert.ok(html.includes('squad-card-power'),"roster cards show power");
 assert.ok(html.includes('squad-card-stars'),"roster cards show stars");
 assert.ok(html.includes('squad-card-body'),"roster cards have body");
});

test("renderSquad generates horizontal squad slots",()=>{
 api.openSquad();
 const html=elements.squadSlots.innerHTML;
 assert.ok(html.includes('squad-slot-card'),"slots use squad-slot-card class");
 assert.ok(html.includes('data-slot-index="0"'),"slot 0 has data attribute");
 assert.ok(html.includes('data-slot-index="4"'),"slot 4 has data attribute");
 assert.ok(html.includes('squad-slot-portrait'),"slots have portrait wrapper");
});

test("leader bar and squad power elements exist in DOM",()=>{
 api.openSquad();
 assert.ok(elements.squadPower,"squadPower element exists");
 assert.ok(elements.squadLeaderBar,"squadLeaderBar element exists");
 assert.ok(elements.squadLeaderText,"squadLeaderText element exists");
});

test("slot cards have click handler markup for filled slots",()=>{
 api.openSquad();
 api.toggleSquadHero("kael");
 const html=elements.squadSlots.innerHTML;
 assert.ok(html.includes('role="button"'),"filled slot has button role");
 assert.ok(html.includes('tabindex="0"'),"filled slot is keyboard focusable");
 api.disbandSquad();
});
