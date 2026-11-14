"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const Data=require("../lore-campaign-data.js");
const Core=require("../lore-campaign-core.js");
const UI=require("../lore-campaign-ui.js");
const file=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
function root(){
 return {
  innerHTML:"",handlers:{},
  addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);},
  removeEventListener(type,fn){this.handlers[type]=(this.handlers[type]||[]).filter(x=>x!==fn);},
  contains(){return true;},
  querySelector(){return {focus(){}}}
 };
}
function emit(r,action,extra={}){
 const button={dataset:{loreAction:action,...extra}};
 for(const listener of r.handlers.click||[])listener({
  target:{closest(){return button;}}
 });
}
test("LC-002: separate lore scripts and responsive CSS are loaded before app runtime",()=>{
 const html=file("index.html"),css=file("lore-campaign.css"),game=file("game.js"),pkg=JSON.parse(file("package.json"));
 for(const name of ["lore-campaign-data.js","lore-campaign-core.js","lore-campaign-ui.js"]){
  assert.match(html,new RegExp('src="'+name.replace(".","\\.")+'\\?v=0\\.3\\.154"'));
  assert.ok(html.indexOf('src="'+name)<html.indexOf('src="game.js'),name+" loads before runtime");
  assert.ok(pkg.scripts.test.includes("node --check "+name),name+" syntax checked");
 }
 assert.match(html,/href="lore-campaign\.css\?v=0\.3\.154"/);
 assert.match(html,/id="loreCampaignRoot"/);
 assert.match(html,/id="campaignLoreContent"/);
 assert.match(html,/Игровые миссии по мотивам историй мира пока не доступны/);
 assert.match(game,/LoreCampaignUI\.mount\(loreRoot,LoreCampaignData,LoreCampaignCore,/);
 assert.match(game,/onStartTraining:openLoreTraining/);
 assert.match(game,/LoreCampaignUI\.back\(\)/);
 assert.match(css,/\.lore-map-layout/);
 assert.match(css,/@media \(orientation:landscape\) and \(max-height:540px\)/);
 assert.match(css,/\.lore-map-marker\{[^}]*width:46px;height:46px/);
 assert.match(css,/@media \(max-width:690px\)/);
 assert.equal(pkg.version,"0.3.154");
 assert.match(html,/id="buildVersion">Прототип · v0\.3\.154 · LORESQUAD001/);
});
test("LC-002: cover, map, node details and accessible list work with one event binding",()=>{
 const r=root();
 assert.equal(UI.mount(r,Data,Core),true);
 assert.equal(UI.mount(r,Data,Core),true);
 assert.equal(r.handlers.click.length,1,"no duplicate click listeners");
 assert.equal(r.handlers.keydown.length,1,"no duplicate keyboard listeners");
 assert.match(r.innerHTML,/Пять теней/);
 assert.match(r.innerHTML,/data-lore-action="open-story"/);
 emit(r,"open-story",{loreStory:"five-shadows"});
 assert.equal(UI.snapshot().view,"map");
 assert.equal(UI.snapshot().nodeId,"five-shadows:fs-01");
 assert.match(r.innerHTML,/aria-label="Список сюжетных узлов"/);
 assert.match(r.innerHTML,/data-lore-action="choose-node"/);
 assert.match(r.innerHTML,/data-lore-action="choose-layer"/);
 assert.match(r.innerHTML,/data-lore-node="five-shadows:fs-02"/);
 assert.match(r.innerHTML,/aria-pressed="true"/);
 assert.match(r.innerHTML,/Сюжетная сцена готовится/);
 assert.match(r.innerHTML,/<button type="button" class="primary" disabled aria-disabled="true">/);
 assert.doesNotMatch(r.innerHTML,/simulateMission|claimReward|startCombat/);
 assert.doesNotMatch(r.innerHTML,/<script/i);
 emit(r,"choose-node",{loreNode:"five-shadows:fs-02"});
 assert.equal(UI.snapshot().nodeId,"five-shadows:fs-02");
 assert.match(r.innerHTML,/Неизвестный узел/);
 assert.match(r.innerHTML,/Для открытия завершите предыдущий сюжетный узел/);
 emit(r,"choose-node",{loreNode:"nonexistent"});
 assert.equal(UI.snapshot().nodeId,"five-shadows:fs-02","unknown marker cannot move selection");
 emit(r,"choose-layer",{loreLayer:"invented"});
 assert.equal(UI.snapshot().layerId,"gardens-route","unknown layer cannot change selection");
 emit(r,"back");
 assert.equal(UI.snapshot().view,"stories");
 assert.equal(UI.back(),false);
});
test("LC-002: locked nodes hide future titles, node states derive from pure core",()=>{
 const catalog=Data.catalog(),progress=Core.fresh(catalog);
 const fs1=Data.getNode("five-shadows:fs-01"),fs2=Data.getNode("five-shadows:fs-02");
 assert.equal(UI.nodeStatus(fs1,catalog,progress,Core).code,"available");
 assert.equal(UI.nodeStatus(fs2,catalog,progress,Core).code,"locked");
 progress.stories["five-shadows"].completedNodeIds.push(fs1.id);
 assert.equal(UI.nodeStatus(fs1,catalog,progress,Core).code,"completed");
 assert.equal(UI.nodeStatus(fs2,catalog,progress,Core).code,"available");
 assert.deepEqual(progress.stories["five-shadows"].completedNodeIds,[fs1.id]);
});
test("LC-002: Escape returns from map to story cover without changing game state",()=>{
 const r=root();
 UI.mount(r,Data,Core);
 UI.open();
 assert.equal(UI.openStory("five-shadows"),true);
 let prevented=false,stopped=false;
 for(const fn of r.handlers.keydown||[])fn({
  key:"Escape",preventDefault(){prevented=true},stopPropagation(){stopped=true}
 });
 assert.equal(prevented,true);
 assert.equal(stopped,true);
 assert.equal(UI.snapshot().view,"stories");
 assert.equal(UI.snapshot().nodeId,null);
 assert.equal(UI.openStory("nonexistent"),false);
 assert.equal(UI.snapshot().view,"stories");
 assert.equal(UI.close(),true);
});
test("LC-002: existing training mission and story sandbox remain separate",()=>{
 const html=file("index.html"),game=file("game.js");
 assert.equal((html.match(/data-campaign-path="lore"/g)||[]).length,1);
 const lore=html.slice(html.indexOf('id="campaignLoreContent"'),html.indexOf('id="campaignTrainingContent"'));
 const training=html.slice(html.indexOf('id="campaignTrainingContent"'),html.indexOf('id="campaignMainContent"'));
 assert.doesNotMatch(lore,/data-campaign-mission|id="storyDemoOpen"|id="campaignMissions"/);
 assert.match(training,/id="campaignMissions"/);
 assert.match(game,/CampaignCore\.recordResult/);
 assert.match(game,/if\(selectedCampaignPath\)showCampaignPath\(null\)/);
 assert.match(html,/src="story-demo-core\.js"/);
 assert.ok(!file("lore-campaign-ui.js").includes("setItem("),"persistence writes stay in separate LC-003 save module");
 assert.ok(!file("lore-campaign-ui.js").includes("BABYLON"),"2D map must not load WebGL");
});
