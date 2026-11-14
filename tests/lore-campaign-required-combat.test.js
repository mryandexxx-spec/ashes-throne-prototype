"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Data=require("../lore-campaign-data.js");
const Core=require("../lore-campaign-core.js");
const Scenes=require("../lore-campaign-scenes.js");
const Engine=require("../lore-campaign-scene-core.js");
const Runtime=require("../lore-campaign-scene-runtime.js");
const Save=require("../lore-campaign-scene-save.js");
const Fixture=require("./lore-campaign-003-fixture.js");
function newGraph(){
 const f=Fixture.create(Data);
 f.graph.nodes[0].requiredBattleId="fs01-approach-combat";
 f.graph.nodes[1].requiredBattleId="fs02-evidence-combat";
 return f;
}
function memory(){
 const db=new Map();
 return {db,getItem:k=>db.has(k)?db.get(k):null,setItem:(k,v)=>db.set(k,String(v))};
}
function create(f,storage){
 return Runtime.create({graph:f.graph,graphCore:Core,pack:f.pack,
  scriptData:Scenes,sceneCore:Engine,saveModule:Save,storage});
}
function firstScene(runtime){
 assert.equal(runtime.start("five-shadows:fs-01").ok,true);
 assert.equal(runtime.next().ok,true);
 assert.equal(runtime.next().ok,true);
 assert.equal(runtime.choose("left").ok,true);
 assert.equal(runtime.next().ok,true);
 assert.equal(runtime.finish().ok,true);
}
test("LC-005: battle gate is a valid optional node field; public catalog unchanged",()=>{
 const f=newGraph();
 assert.equal(Data.catalogIsValid(f.graph),true);
 assert.equal(Data.catalog().nodes.every(n=>n.requiredBattleId===undefined),true);
 const invalid=JSON.parse(JSON.stringify(f.graph));
 invalid.nodes[1].requiredBattleId=invalid.nodes[0].requiredBattleId;
 assert.equal(Data.catalogIsValid(invalid),false,"same combat ID cannot gate two nodes");
});
test("LC-005: first battle blocks next node even when story objectives are complete",()=>{
 const f=newGraph(),storage=memory(),r=create(f,storage);
 firstScene(r);
 assert.equal(Core.available(f.graph,r.progress(),"five-shadows:fs-02"),false);
 assert.equal(Core.begin(f.graph,r.progress(),"five-shadows:fs-02").code,"LOCKED");
 assert.deepEqual(r.stateFor("five-shadows").completedNodeIds,["five-shadows:fs-01"]);
 assert.equal(r.stateFor("five-shadows").battleClearedNodeIds.length,0);
 assert.equal(r.recordBattleVictory("five-shadows:fs-01","fs01-approach-combat").code,"BATTLE_NOT_ACTIVE",
  "Cannot unlock by arbitrary completion without requesting encounter");
 assert.equal(r.beginRequiredBattle("five-shadows:fs-02").code,"BATTLE_NOT_AVAILABLE");
 assert.equal(r.beginRequiredBattle("five-shadows:fs-01").ok,true);
 assert.equal(r.beginRequiredBattle("five-shadows:fs-01").code,"BATTLE_OR_SCENE_ACTIVE");
 assert.equal(r.recordBattleVictory("five-shadows:fs-01","wrong").code,"INVALID_BATTLE");
 assert.equal(Core.available(f.graph,r.progress(),"five-shadows:fs-02"),false);
 r.cancelRequiredBattle();
 assert.equal(r.recordBattleVictory("five-shadows:fs-01","fs01-approach-combat").code,"BATTLE_NOT_ACTIVE");
 assert.equal(r.beginRequiredBattle("five-shadows:fs-01").ok,true);
 assert.equal(r.recordBattleVictory("five-shadows:fs-01","fs01-approach-combat").ok,true);
 assert.equal(Core.available(f.graph,r.progress(),"five-shadows:fs-02"),true);
 assert.deepEqual(r.stateFor("five-shadows").battleClearedNodeIds,["five-shadows:fs-01"]);
 assert.equal(r.beginRequiredBattle("five-shadows:fs-01").code,"BATTLE_NOT_AVAILABLE");
 assert.equal(create(f,storage).stateFor("five-shadows").battleClearedNodeIds.length,1,
  "Battle receipt is durable across reloads");
});
test("LC-005: wallet-independent battle receipt is fail-closed on storage failure",()=>{
 const f=newGraph(),storage=memory(),r=create(f,storage);
 firstScene(r);
 const before=JSON.stringify(r.progress());
 const previous=storage.setItem;
 let failure=false;
 storage.setItem=()=>{failure=true;throw new Error("quota exceeded");};
 assert.equal(r.beginRequiredBattle("five-shadows:fs-01").ok,true);
 assert.equal(r.recordBattleVictory("five-shadows:fs-01","fs01-approach-combat").code,"SAVE_WRITE_FAILED");
 assert.equal(failure,true);
 assert.equal(JSON.stringify(r.progress()),before);
 assert.equal(Core.available(f.graph,r.progress(),"five-shadows:fs-02"),false);
 storage.setItem=previous;
 assert.equal(r.recordBattleVictory("five-shadows:fs-01","fs01-approach-combat").ok,true);
});
test("LC-005: unknown or future battle receipts cannot be loaded or forged",()=>{
 const f=newGraph(),storage=memory(),r=create(f,storage);
 firstScene(r);
 const saved=JSON.parse(storage.getItem(Save.KEY));
 saved.stories["five-shadows"].battleClearedNodeIds=["five-shadows:fs-02"];
 assert.equal(Save.validate(saved,f.graph,f.pack,Core,Scenes),false,"future scene not yet completed");
 saved.stories["five-shadows"].battleClearedNodeIds=["hacker"];
 assert.equal(Save.validate(saved,f.graph,f.pack,Core,Scenes),false);
 saved.stories["five-shadows"].battleClearedNodeIds=["five-shadows:fs-01","five-shadows:fs-01"];
 assert.equal(Save.validate(saved,f.graph,f.pack,Core,Scenes),false);
});
test("LC-005: legacy v1 story saves without battle receipts remain readable",()=>{
 const f=newGraph(),storage=memory(),r=create(f,storage);
 firstScene(r);
 const old=JSON.parse(storage.getItem(Save.KEY));
 delete old.stories["five-shadows"].battleClearedNodeIds;
 assert.equal(Save.validate(old,f.graph,f.pack,Core,Scenes),true);
 storage.setItem(Save.KEY,JSON.stringify(old));
 const resumed=create(f,storage);
 assert.deepEqual(resumed.stateFor("five-shadows").battleClearedNodeIds,[]);
 assert.equal(Core.available(f.graph,resumed.progress(),"five-shadows:fs-02"),false);
});
