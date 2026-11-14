"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const Data=require("../lore-campaign-data.js");
const Core=require("../lore-campaign-core.js");
const Scenes=require("../lore-campaign-scenes.js");
const Engine=require("../lore-campaign-scene-core.js");
const Save=require("../lore-campaign-scene-save.js");
const Runtime=require("../lore-campaign-scene-runtime.js");
const UI=require("../lore-campaign-ui.js");
const Fixture=require("./lore-campaign-004-fixture.js");
const clone=x=>JSON.parse(JSON.stringify(x));
const file=x=>fs.readFileSync(path.join(__dirname,"..",x),"utf8");
const memory=()=>{
 const map=new Map();
 return {map,getItem:key=>map.has(key)?map.get(key):null,setItem:(k,v)=>map.set(k,v)};
};
function create(storage=memory(),b=Fixture.create(Data)){
 return {bundle:b,storage,runtime:Runtime.create({
  graph:b.graph,graphCore:Core,pack:b.pack,scriptData:Scenes,
  sceneCore:Engine,saveModule:Save,storage
 })};
}
function enterNotes(r){
 assert.equal(r.start("five-shadows:fs-01").ok,true);
 assert.equal(r.next().ok,true);
 assert.equal(r.current().beatId,"notes");
}
function complete(r){
 enterNotes(r);
 assert.equal(r.inspect("material-a").ok,true);
 assert.equal(r.inspect("material-b").ok,true);
 assert.equal(r.compare("comparison").ok,true);
 assert.equal(r.next().ok,true);
 assert.equal(r.choose("left").ok,true);
 assert.equal(r.next().ok,true);
 assert.equal(r.finish().ok,true);
}
test("LC-004: player must inspect BOTH evidence cards, then explicitly compare before continuing",()=>{
 const p=create(),r=p.runtime;
 assert.equal(Scenes.valid(p.bundle.pack,p.bundle.graph),true);
 enterNotes(r);
 assert.equal(r.current().interactionsReady,false);
 assert.equal(r.next().code,"INSPECTION_REQUIRED");
 assert.equal(r.inspect("material-bad").code,"INSPECTION_NOT_AVAILABLE");
 assert.equal(r.compare("comparison").code,"INSPECTION_REQUIRED");
 assert.equal(r.inspect("material-a").ok,true);
 assert.equal(r.current().inspections[0].done,true);
 assert.match(r.current().inspections[0].text,/onerror/);
 assert.equal(r.current().inspections[1].done,false);
 assert.equal(r.compare("comparison").code,"INSPECTION_REQUIRED");
 assert.equal(r.next().code,"INSPECTION_REQUIRED");
 assert.equal(r.inspect("material-b").ok,true);
 assert.equal(r.current().inspections[1].done,true);
 assert.equal(r.current().comparisons[0].ready,true);
 assert.equal(r.current().comparisons[0].done,false);
 assert.equal(r.next().code,"INSPECTION_REQUIRED","viewing both is not actual comparison");
 assert.equal(r.compare("comparison").ok,true);
 assert.equal(r.current().comparisons[0].done,true);
 assert.equal(r.current().interactionsReady,true);
 const objectives=r.current().objectives.filter(o=>o.id.startsWith("manual"));
 assert.deepEqual(objectives.map(o=>o.done),[true,true,true]);
 assert.equal(r.next().ok,true);
 assert.equal(r.current().beatId,"decision");
 const persisted=JSON.parse(p.storage.getItem(Save.KEY)).stories["five-shadows"];
 assert.ok(persisted.seenEvidenceIds.includes("five-shadows:fs-01/material-a"));
 assert.ok(persisted.seenEvidenceIds.includes("five-shadows:fs-01/material-b"));
 assert.ok(persisted.seenEvidenceIds.includes("five-shadows:fs-01/comparison:comparison"));
 assert.equal(p.storage.map.size,1,"no wallet or mission save writes");
});
test("LC-004: refresh on inspection checkpoint restores evidence and comparison state",()=>{
 const storage=memory(),first=create(storage);
 enterNotes(first.runtime);
 assert.equal(first.runtime.inspect("material-a").ok,true);
 const again=create(storage).runtime;
 assert.equal(again.start("five-shadows:fs-01").ok,true);
 assert.equal(again.current().beatId,"notes");
 assert.equal(again.current().inspections[0].done,true);
 assert.equal(again.current().inspections[1].done,false);
 assert.equal(again.next().code,"INSPECTION_REQUIRED");
 assert.equal(again.inspect("material-b").ok,true);
 assert.equal(again.compare("comparison").ok,true);
 const third=create(storage).runtime;
 assert.equal(third.start("five-shadows:fs-01").ok,true);
 assert.equal(third.current().comparisons[0].done,true);
 assert.equal(third.current().interactionsReady,true);
 assert.equal(third.next().ok,true);
});
test("LC-004: invalid or guessed comparisons cannot manufacture evidence",()=>{
 const b=Fixture.create(Data);
 const invalids=[
  v=>v.pack.scenes[0].beats[1].requiredInspectionIds.push("not-defined"),
  v=>v.pack.scenes[0].beats[1].requiredComparisonIds.push("not-defined"),
  v=>v.pack.scenes[0].beats[1].inspections[1].id="material-a",
  v=>v.pack.scenes[0].beats[1].comparisons[0].evidenceIds=["material-a","fake"],
  v=>v.pack.scenes[0].beats[1].comparisons[0].evidenceIds=["material-a","material-a"],
  v=>v.pack.scenes[0].objectives.at(-1).comparisonId="fake",
  v=>v.pack.scenes[0].beats[1].inspections[0].text="",
  v=>v.pack.scenes[0].beats[1].comparisons[0].label=""
 ];
 for(const mutate of invalids){
  const invalid=Fixture.create(Data);mutate(invalid);
  assert.equal(Scenes.valid(invalid.pack,invalid.graph),false,mutate.toString());
 }
 assert.equal(Scenes.valid(b.pack,b.graph),true);
 const p=create();
 enterNotes(p.runtime);
 assert.equal(p.runtime.compare("material-a").code,"COMPARISON_NOT_AVAILABLE");
 assert.equal(p.runtime.inspect("__proto__").code,"INSPECTION_NOT_AVAILABLE");
 assert.equal(p.runtime.current().comparisons[0].ready,false);
});
test("LC-004: interrupted storage write never advances the action",()=>{
 const store=memory(),real=store.setItem;
 let failNow=false;
 store.setItem=(k,v)=>{if(failNow)throw Error("write rejected");return real(k,v);};
 const p=create(store);
 enterNotes(p.runtime);
 const before=store.getItem(Save.KEY);
 failNow=true;
 assert.equal(p.runtime.inspect("material-a").code,"SAVE_WRITE_FAILED");
 assert.equal(p.runtime.current().inspections[0].done,false);
 assert.equal(store.getItem(Save.KEY),before);
 failNow=false;
 assert.equal(p.runtime.inspect("material-a").ok,true);
});
test("LC-004: replay can show inspections without altering permanent decision or evidence receipts",()=>{
 const p=create();complete(p.runtime);
 const before=p.storage.getItem(Save.KEY);
 assert.equal(p.runtime.start("five-shadows:fs-01").ok,true);
 assert.equal(p.runtime.next().ok,true);
 assert.equal(p.runtime.inspect("material-a").ok,true);
 assert.equal(p.runtime.inspect("material-b").ok,true);
 assert.equal(p.runtime.compare("comparison").ok,true);
 assert.equal(p.runtime.next().ok,true);
 assert.equal(p.runtime.choose("right").ok,true);
 assert.equal(p.runtime.next().ok,true);
 assert.equal(p.runtime.finish().ok,true);
 assert.equal(p.storage.getItem(Save.KEY),before);
 assert.deepEqual(p.runtime.journal("five-shadows"),[
  {nodeId:"five-shadows:fs-01",decisionId:"order",choiceId:"left"}
 ]);
});
test("LC-004: synthetic UI exposes real large inspect/compare actions and escapes text",()=>{
 const b=Fixture.create(Data),storage=memory(),root={
  innerHTML:"",handlers:{},
  addEventListener(type,fn){(this.handlers[type]??=[]).push(fn);},
  removeEventListener(type,fn){this.handlers[type]=(this.handlers[type]||[]).filter(x=>x!==fn);},
  contains(){return true;},querySelector(){return {focus(){}}}
 };
 const emit=(action,dataset={})=>
  (root.handlers.click||[]).forEach(fn=>fn({target:{closest(){return {dataset:{loreAction:action,...dataset}}}}}));
 assert.equal(UI.mount(root,b.data,Core,{storage,pack:b.pack,scripts:Scenes,
  engine:Engine,save:Save,runtime:Runtime}),true);
 emit("open-story",{loreStory:"five-shadows"});
 emit("start-node");
 emit("scene-next");
 assert.match(root.innerHTML,/Исследовать материал A/);
 assert.match(root.innerHTML,/data-lore-action="scene-compare"/);
 assert.match(root.innerHTML,/data-lore-action="scene-next" disabled/);
 emit("scene-inspect",{loreItem:"material-a"});
 assert.match(root.innerHTML,/&lt;img src=x onerror=alert\(1\)&gt;/);
 assert.doesNotMatch(root.innerHTML,/<img src=x onerror/);
 emit("scene-inspect",{loreItem:"material-b"});
 assert.match(root.innerHTML,/data-lore-action="scene-compare"/);
 emit("scene-compare",{loreItem:"comparison"});
 assert.match(root.innerHTML,/расхождение/);
 assert.doesNotMatch(root.innerHTML,/data-lore-action="scene-next" disabled/);
 emit("scene-next");
 assert.match(root.innerHTML,/Сначала журнал/);
 assert.equal(storage.map.size,1);
});
test("LC-004: legacy public story pack stays empty until explicitly approved",()=>{
 assert.deepEqual(Scenes.catalog().scenes,[]);
 assert.equal(Data.catalog().nodes.every(n=>n.contentId===null),true);
 const html=file("index.html");
 assert.doesNotMatch(html,/LC004_FS01_FS03_SCENE_PACK_PROPOSAL/);
 assert.doesNotMatch(html,/tests\/lore-campaign-004-fixture\.js/);
 assert.equal(html.includes("lore-campaign-ui.js"),true);
});
