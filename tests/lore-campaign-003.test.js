"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const Data=require("../lore-campaign-data.js");
const Core=require("../lore-campaign-core.js");
const Scripts=require("../lore-campaign-scenes.js");
const Engine=require("../lore-campaign-scene-core.js");
const Save=require("../lore-campaign-scene-save.js");
const Runtime=require("../lore-campaign-scene-runtime.js");
const UI=require("../lore-campaign-ui.js");
const Fixture=require("./lore-campaign-003-fixture.js");
const clone=x=>JSON.parse(JSON.stringify(x));
const file=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
function memory(){
 const map=new Map();
 return {map,getItem(k){return map.has(k)?map.get(k):null;},
  setItem(k,v){map.set(k,v);}};
}
function setup(storage=memory(),bundle=Fixture.create(Data)){
 const runtime=Runtime.create({graph:bundle.graph,graphCore:Core,pack:bundle.pack,
  scriptData:Scripts,sceneCore:Engine,saveModule:Save,storage});
 return {...bundle,storage,runtime};
}
function finishPrimary(r,answer="left"){
 assert.equal(r.start("five-shadows:fs-01").ok,true);
 assert.equal(r.next().ok,true);
 assert.equal(r.next().ok,true);
 assert.equal(r.choose(answer).ok,true);
 assert.equal(r.next().ok,true);
 assert.equal(r.finish().ok,true);
}
test("LC-003: shipped scene pack is empty, valid and has no literary text",()=>{
 const pack=Scripts.catalog();
 assert.deepEqual(pack.scenes,[]);
 assert.equal(Object.isFrozen(pack.scenes),true);
 assert.equal(Scripts.valid(pack,Data.catalog()),true);
 assert.equal(Scripts.sceneFor("five-shadows:fs-01"),null);
 assert.equal(Data.catalog().nodes[0].contentId,null);
 const r=Runtime.create({graph:Data.catalog(),graphCore:Core,pack,scriptData:Scripts,
   sceneCore:Engine,saveModule:Save,storage:memory()});
 assert.equal(r.start("five-shadows:fs-01").code,"CONTENT_NOT_READY");
 assert.equal(r.progress().stories["five-shadows"].completedNodeIds.length,0);
});
test("LC-003: scene graph validation rejects absent content, links, cycles and unsafe effects",()=>{
 const b=Fixture.create(Data);
 assert.equal(Scripts.valid(b.pack,b.graph),true);
 const changes=[
  ({graph})=>{graph.nodes[0].contentId=null;},
  ({pack})=>{pack.scenes[0].entryBeatId="missing";},
  ({pack})=>{pack.scenes[0].beats[0].nextBeatId="absent";},
  ({pack})=>{pack.scenes[0].beats[1].effects=[{type:"grantCurrency",id:"coins"}];},
  ({pack})=>{pack.scenes[0].beats[3].nextBeatId="intro";},
  ({pack})=>{pack.scenes[0].choices[0].nextBeatId="missing";},
  ({pack})=>{pack.scenes[0].choices[0].decisionId="unrelated";},
  ({pack})=>{pack.scenes[0].objectives[0].beatId="nonexistent";},
  ({pack})=>{pack.scenes[0].objectives[2].evidenceIds=["journal","missing"];},
  ({pack})=>{pack.scenes[0].choices.push(clone(pack.scenes[0].choices[0]));},
  ({pack})=>{pack.scenes[0].beats[2].choiceIds=["left","left"];}
 ];
 for(const edit of changes){
  const v=Fixture.create(Data);edit(v);
  assert.equal(Scripts.valid(v.pack,v.graph),false,edit.toString());
 }
});
test("LC-003: primary passage persists each beat and first choice, then unlocks next node",()=>{
 const p=setup();
 assert.equal(p.runtime.storageStatus(),"new");
 const locked=p.runtime.start("five-shadows:fs-02");
 assert.equal(locked.ok,false);
 assert.equal(p.runtime.start("five-shadows:fs-01").ok,true);
 let saved=JSON.parse(p.storage.getItem(Save.KEY));
 assert.equal(saved.stories["five-shadows"].activeNodeId,"five-shadows:fs-01");
 assert.equal(saved.stories["five-shadows"].checkpointBeatId,"intro");
 assert.deepEqual(saved.stories["five-shadows"].seenEvidenceIds,["five-shadows:fs-01/journal"]);
 assert.equal(p.runtime.next().ok,true);
 assert.equal(p.runtime.next().ok,true);
 assert.equal(p.runtime.choose("left").ok,true);
 assert.equal(p.runtime.current().beatId,"leftBeat");
 saved=JSON.parse(p.storage.getItem(Save.KEY));
 assert.equal(saved.stories["five-shadows"].primaryChoicesById["five-shadows:fs-01/order"],"left");
 assert.equal(saved.stories["five-shadows"].keyDecisionLog.length,1);
 assert.equal(p.runtime.next().ok,true);
 assert.equal(p.runtime.finish().ok,true);
 saved=JSON.parse(p.storage.getItem(Save.KEY));
 assert.deepEqual(saved.stories["five-shadows"].completedNodeIds,["five-shadows:fs-01"]);
 assert.equal(saved.stories["five-shadows"].activeNodeId,null);
 assert.equal(saved.stories["five-shadows"].checkpointBeatId,null);
 assert.equal(Core.available(p.graph,saved,"five-shadows:fs-02"),true);
 assert.equal(p.storage.map.size,1,"no writes to any old game or wallet keys");
});
test("LC-003: reloaded checkpoint resumes exact beat and preserves primary decision",()=>{
 const storage=memory();
 const p=setup(storage);
 assert.equal(p.runtime.start("five-shadows:fs-01").ok,true);
 assert.equal(p.runtime.next().ok,true);
 const reloaded=setup(storage);
 assert.equal(reloaded.runtime.storageStatus(),"saved");
 assert.equal(reloaded.runtime.hasCheckpoint("five-shadows:fs-01"),true);
 assert.equal(reloaded.runtime.start("five-shadows:fs-01").ok,true);
 assert.equal(reloaded.runtime.current().beatId,"notes");
 assert.equal(reloaded.runtime.next().ok,true);
 assert.equal(reloaded.runtime.choose("right").ok,true);
 assert.equal(reloaded.runtime.next().ok,true);
 assert.equal(reloaded.runtime.finish().ok,true);
 assert.deepEqual(reloaded.runtime.journal("five-shadows"),
  [{nodeId:"five-shadows:fs-01",decisionId:"order",choiceId:"right"}]);
});
test("LC-003: replay can take another path without changing permanent choices or checkpoint",()=>{
 const p=setup();
 finishPrimary(p.runtime);
 const original=p.storage.getItem(Save.KEY);
 assert.equal(p.runtime.start("five-shadows:fs-01").ok,true);
 assert.equal(p.runtime.current().mode,"replay");
 assert.equal(p.runtime.next().ok,true);
 assert.equal(p.runtime.next().ok,true);
 assert.equal(p.runtime.choose("right").ok,true);
 assert.equal(p.runtime.current().beatId,"rightBeat");
 assert.equal(p.runtime.next().ok,true);
 assert.equal(p.runtime.finish().ok,true);
 assert.equal(p.storage.getItem(Save.KEY),original,"no persistent replay writes");
 assert.deepEqual(p.runtime.journal("five-shadows"),
  [{nodeId:"five-shadows:fs-01",decisionId:"order",choiceId:"left"}]);
 assert.deepEqual(p.runtime.stateFor("five-shadows").completedNodeIds,["five-shadows:fs-01"]);
});
test("LC-003: only previously seen safe beats can be skipped; choices never are",()=>{
 const p=setup();
 finishPrimary(p.runtime);
 assert.equal(p.runtime.start("five-shadows:fs-01").ok,true);
 assert.equal(p.runtime.current().beatId,"intro");
 assert.equal(p.runtime.skipSeen().ok,true);
 assert.equal(p.runtime.current().beatId,"notes");
 assert.equal(p.runtime.skipSeen().code,"SKIP_UNAVAILABLE","cannot skip choice beat");
 assert.equal(p.runtime.next().ok,true);
 assert.equal(p.runtime.current().beatId,"decision");
 assert.equal(p.runtime.skipSeen().code,"SKIP_UNAVAILABLE");
 assert.equal(p.runtime.choose("not-a-choice").code,"INVALID_CHOICE");
 assert.equal(p.runtime.current().beatId,"decision");
});
test("LC-003: objective requirements block finish when evidence is missing",()=>{
 const bundle=Fixture.create(Data);
 bundle.pack.scenes[0].choices[0].effects=[{type:"markEvidenceSeen",id:"extra"}];
 bundle.pack.scenes[0].objectives.push({id:"extra",kind:"inspect",
  hint:"Проверить отдельную запись",required:true,evidenceIds:["extra"]});
 assert.equal(Scripts.valid(bundle.pack,bundle.graph),true);
 const p=setup(memory(),bundle);
 assert.equal(p.runtime.start("five-shadows:fs-01").ok,true);
 assert.equal(p.runtime.next().ok,true);
 assert.equal(p.runtime.next().ok,true);
 assert.equal(p.runtime.choose("right").ok,true);
 assert.equal(p.runtime.next().ok,true);
 assert.equal(p.runtime.finish().code,"OBJECTIVE_INCOMPLETE");
 assert.equal(p.runtime.progress().stories["five-shadows"].completedNodeIds.length,0);
});
test("LC-003: corrupt and future-version saves are protected, with no automatic reset",()=>{
 for(const payload of ["{broken",JSON.stringify({version:2,stories:{}}),
  JSON.stringify({version:1,stories:{"five-shadows":{completedNodeIds:["unknown"]}}})]){
  const storage=memory();storage.setItem(Save.KEY,payload);
  const p=setup(storage);
  assert.equal(p.runtime.storageStatus(),"corrupt");
  assert.equal(p.runtime.start("five-shadows:fs-01").code,"CORRUPT_SAVE_PROTECTED");
  assert.equal(storage.getItem(Save.KEY),payload);
 }
});
test("LC-003: denied storage permits explicitly volatile progress; failed commits do not advance",()=>{
 const denied={getItem(){throw Error("private mode");},setItem(){throw Error("disabled");}};
 const session=setup(denied).runtime;
 assert.equal(session.storageStatus(),"volatile");
 assert.equal(session.start("five-shadows:fs-01").ok,true);
 assert.equal(session.current().beatId,"intro");
 const storage=memory();
 let failWrite=true;
 const wrapped={getItem:k=>storage.getItem(k),setItem(k,v){if(failWrite)throw Error("QuotaExceededError");storage.setItem(k,v);}};
 const p=setup(wrapped);
 assert.equal(p.runtime.start("five-shadows:fs-01").code,"SAVE_WRITE_FAILED");
 assert.equal(p.runtime.current(),null);
 assert.equal(p.runtime.progress().stories["five-shadows"].activeNodeId,null);
 failWrite=false;
 assert.equal(p.runtime.start("five-shadows:fs-01").ok,true);
});
test("LC-003: failure on a later beat leaves previous checkpoint and UI unchanged",()=>{
 const real=memory();let writes=0;
 const storage={
  getItem:k=>real.getItem(k),
  setItem(k,v){if(++writes===2)throw Error("QuotaExceeded");real.setItem(k,v);}
 };
 const p=setup(storage);
 assert.equal(p.runtime.start("five-shadows:fs-01").ok,true);
 const before=real.getItem(Save.KEY);
 assert.equal(p.runtime.current().beatId,"intro");
 assert.equal(p.runtime.next().code,"SAVE_WRITE_FAILED");
 assert.equal(p.runtime.current().beatId,"intro");
 assert.equal(real.getItem(Save.KEY),before);
 assert.equal(p.runtime.next().ok,true,"player can retry after a transient storage error");
 assert.equal(p.runtime.current().beatId,"notes");
});
test("LC-003: concurrent tab changes trigger save conflict, never overwrite another tab",()=>{
 const storage=memory();
 const tabA=setup(storage),tabB=setup(storage);
 assert.equal(tabA.runtime.start("five-shadows:fs-01").ok,true);
 const snapshot=storage.getItem(Save.KEY);
 assert.equal(tabB.runtime.start("five-shadows:fs-01").code,"SAVE_CONFLICT");
 assert.equal(storage.getItem(Save.KEY),snapshot);
});
test("LC-003: independent UI renders safe literal text and scene navigation without duplication",()=>{
 const p=Fixture.create(Data),storage=memory(),r={
  innerHTML:"",handlers:{},addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);},
  removeEventListener(type,fn){this.handlers[type]=(this.handlers[type]||[]).filter(x=>x!==fn);},
  contains(){return true;},querySelector(){return {focus(){}}}
 };
 const emit=(action,dataset={})=>{
  for(const fn of r.handlers.click||[])fn({target:{closest(){return {dataset:{loreAction:action,...dataset}}}}});
 };
 assert.equal(UI.mount(r,p.data,Core,{scripts:Scripts,engine:Engine,save:Save,runtime:Runtime,
  storage,pack:p.pack}),true);
 assert.equal(UI.mount(r,p.data,Core),true);
 assert.equal(r.handlers.click.length,1);
 emit("open-story",{loreStory:"five-shadows"});
 assert.equal(UI.snapshot().view,"map");
 assert.match(r.innerHTML,/data-lore-action="start-node"/);
 emit("start-node");
 assert.equal(UI.snapshot().view,"scene");
 assert.match(r.innerHTML,/&lt;script&gt;alert/);
 assert.doesNotMatch(r.innerHTML,/<script>alert/);
 emit("scene-next");
 emit("scene-next");
 assert.match(r.innerHTML,/Сначала журнал/);
 emit("scene-choose",{loreChoice:"left"});
 emit("scene-next");
 emit("scene-finish");
 assert.equal(UI.snapshot().view,"result");
 emit("leave-result");
 assert.equal(UI.snapshot().view,"map");
 assert.match(r.innerHTML,/Пройдено/);
 assert.match(r.innerHTML,/Журнал первичных решений/);
 assert.match(r.innerHTML,/Сначала журнал/);
 assert.match(r.innerHTML,/data-lore-action="start-node"/);
 assert.equal(storage.map.size,1);
});
test("LC-003: leaving for another screen keeps checkpoint and permits continuing",()=>{
 const p=Fixture.create(Data),storage=memory(),r={
  innerHTML:"",handlers:{},
  addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);},
  removeEventListener(type,fn){this.handlers[type]=(this.handlers[type]||[]).filter(x=>x!==fn);},
  contains(){return true;},querySelector(){return {focus(){}}}
 };
 UI.mount(r,p.data,Core,{scripts:Scripts,engine:Engine,save:Save,runtime:Runtime,
   storage,pack:p.pack});
 assert.equal(UI.openStory("five-shadows"),true);
 assert.equal(UI.startScene(),true);
 assert.equal(UI.actInScene("next"),true);
 assert.equal(UI.snapshot().view,"scene");
 assert.equal(UI.open(),true,"external campaign navigation reopens story covers");
 assert.equal(UI.openStory("five-shadows"),true);
 assert.equal(UI.startScene(),true,"the old session lock is released");
 assert.match(r.innerHTML,/второй источник/);
 UI.close();
 const state=JSON.parse(storage.getItem(Save.KEY)).stories["five-shadows"];
 assert.equal(state.activeNodeId,"five-shadows:fs-01");
 assert.equal(state.checkpointBeatId,"notes");
});
test("LC-003: build, cache and legacy campaign boundaries remain independent",()=>{
 const html=file("index.html"),pkg=JSON.parse(file("package.json"));
 assert.equal(pkg.version,"0.3.150");
 assert.match(html,/id="buildVersion">Прототип · v0\.3\.150 · LORESCENE001/);
 for(const f of ["lore-campaign-scenes.js","lore-campaign-scene-core.js",
  "lore-campaign-scene-save.js","lore-campaign-scene-runtime.js"]){
  assert.match(html,new RegExp('src="'+f.replace(/\./g,"\\.")+'\\?v=0\\.3\\.150"'));
  assert.ok(pkg.scripts.test.includes("node --check "+f));
 }
 assert.ok(html.indexOf("lore-campaign-scene-runtime.js")<html.indexOf("lore-campaign-ui.js"));
 assert.match(file("lore-campaign-ui.js"),/data-lore-action="scene-finish"/);
 assert.ok(!file("lore-campaign-scene-core.js").includes("setItem("));
 assert.ok(!file("lore-campaign-scene-save.js").includes("progress.v3"));
 assert.ok(!file("lore-campaign-scene-core.js").includes("BABYLON"));
 assert.equal((html.match(/id="campaignLoreContent"/g)||[]).length,1);
 assert.match(html,/src="story-demo-core\.js"/);
});
