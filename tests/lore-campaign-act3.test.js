"use strict";
/* LOREACT3001: FS-07..09 add a third act without changing the six battle receipts. */
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const Data=require("../lore-campaign-data.js"),Core=require("../lore-campaign-core.js");
const Scripts=require("../lore-campaign-scenes.js"),Engine=require("../lore-campaign-scene-core.js");
const Save=require("../lore-campaign-scene-save.js"),Runtime=require("../lore-campaign-scene-runtime.js");
const Trial=require("../lore-campaign-trials.js"),Act3=require("../lore-campaign-act3.js");
const UI=require("../lore-campaign-ui.js");
function memory(){
 const map=new Map();
 return {map,getItem:key=>map.has(key)?map.get(key):null,setItem:(key,value)=>map.set(key,String(value))};
}
function create(bundle,storage){
 return Runtime.create({graph:bundle.data.catalog(),graphCore:Core,pack:bundle.pack,
  scriptData:Scripts,sceneCore:Engine,saveModule:Save,storage});
}
function finish(r,id,choiceIndex=0){
 assert.equal(r.start(id).ok,true,"begin "+id);
 for(let i=0;i<125;i++){
  let view=r.current();assert.ok(view,"scene "+id);
  for(const q of view.inspections)if(!q.done)
   assert.equal(r.inspect(q.id).ok,true,id+" inspect "+q.id);
  view=r.current();
  for(const q of view.comparisons)if(q.ready&&!q.done)
   assert.equal(r.compare(q.id).ok,true,id+" compare "+q.id);
  view=r.current();
  if(view.choices.length)assert.equal(r.choose(view.choices[choiceIndex]?.id||view.choices[0].id).ok,true,id+" choice");
  else if(view.canContinue)assert.equal(r.next().ok,true,id+" next");
  else if(view.canFinish){assert.equal(r.finish().ok,true,id+" finish");return;}
  else assert.fail("stuck: "+id+" "+view.beatId);
 }
 assert.fail("infinite story loop "+id);
}
function seedSix(storage){
 const r=create(Trial,storage),ids=Trial.data.catalog().nodes.map(n=>n.id);
 for(const id of ids){
  finish(r,id);
  const battle=r.beginRequiredBattle(id);
  assert.equal(battle.ok,true,"before receipt "+id);
  assert.equal(r.recordBattleVictory(id,battle.battleId).ok,true,"win "+id);
 }
 return {old:r,ids};
}
test("LOREACT3001: nine linked nodes and scenes, third layer, original combat unchanged",()=>{
 const g=Act3.data.catalog(),prior=Trial.data.catalog();
 assert.equal(Data.catalogIsValid(g),true);
 assert.equal(Scripts.valid(Act3.pack,g),true);
 assert.equal(g.nodes.length,9);
 assert.equal(Act3.pack.scenes.length,9);
 assert.deepEqual(Array.from(g.stories[0].mapLayers,x=>x.id),
  ["gardens-route","city-response","city-route"]);
 assert.deepEqual(Array.from(g.nodes.slice(6),n=>n.canonicalRef),["part-5","part-6","part-7"]);
 assert.deepEqual(Array.from(g.nodes.slice(6),n=>n.requiredBattleId||null),[null,null,null]);
 assert.deepEqual(Array.from(g.nodes.slice(6),n=>n.contentId),[
  "fs07-strangers-marks","fs08-right-to-light","fs09-reverse-order"]);
 assert.equal(g.nodes[5].nextNodeIds[0],g.nodes[6].id);
 for(let i=6;i<9;i++)assert.deepEqual(g.nodes[i].prerequisites,[g.nodes[i-1].id]);
 assert.equal(prior.nodes[5].nextNodeIds.length,0,"previous snapshot never mutated");
 assert.equal(Trial.pack.scenes.length,6,"old scenes preserved");
 for(let i=0;i<6;i++){
  assert.equal(g.nodes[i].requiredBattleId,prior.nodes[i].requiredBattleId);
  assert.equal(Act3.encounter(g.nodes[i].id),Trial.encounter(g.nodes[i].id));
 }
 assert.ok(g.nodes.every(n=>n.rewardPoolId===null&&n.energyCostId===null));
 assert.equal(Object.isFrozen(g),true);
 assert.equal(Object.isFrozen(Act3.pack),true);
});
test("LOREACT3001: no bypass of FS-06 battle; six-receipt old save migrates safely",()=>{
 const storage=memory(),{ids}=seedSix(storage);
 const raw=storage.map.get(Core.KEY),r=create(Act3,storage),g=Act3.data.catalog();
 assert.equal(r.storageStatus(),"saved");
 assert.deepEqual(r.stateFor("five-shadows").completedNodeIds,ids);
 assert.deepEqual(r.stateFor("five-shadows").battleClearedNodeIds,ids);
 assert.equal(Core.available(g,r.progress(),g.nodes[6].id),true);
 assert.equal(Core.available(g,r.progress(),g.nodes[7].id),false);
 // The same old save with the terminal FS-06 win omitted cannot enter Act III.
 const old=JSON.parse(raw);
 old.stories["five-shadows"].battleClearedNodeIds.pop();
 storage.map.set(Core.KEY,JSON.stringify(old));
 const blocked=create(Act3,storage);
 assert.equal(Core.available(g,blocked.progress(),g.nodes[6].id),false);
 assert.equal(blocked.start(g.nodes[6].id).code,"LOCKED");
 storage.map.set(Core.KEY,raw);
 const resumed=create(Act3,storage);
 for(let i=6;i<9;i++){
  assert.equal(Core.available(g,resumed.progress(),g.nodes[i].id),true);
  if(i<8)assert.equal(Core.available(g,resumed.progress(),g.nodes[i+1].id),false);
  finish(resumed,g.nodes[i].id);
 }
 const record=resumed.stateFor("five-shadows");
 assert.deepEqual(record.completedNodeIds,Array.from(g.nodes,n=>n.id));
 assert.deepEqual(record.battleClearedNodeIds,ids);
 assert.equal(record.keyDecisionLog.filter(x=>/^five-shadows:fs-0[789]$/.test(x.nodeId)).length,3);
 assert.deepEqual([...storage.map.keys()],[Core.KEY],"no wallet or new key written");
 assert.deepEqual(create(Act3,storage).stateFor("five-shadows").completedNodeIds,record.completedNodeIds);
});
test("LOREACT3001: checkpoint, write-once choice and replay cannot rewrite outcomes",()=>{
 const storage=memory();seedSix(storage);
 const g=Act3.data.catalog(),id=g.nodes[6].id;
 const first=create(Act3,storage);
 assert.equal(first.start(id).ok,true);
 assert.equal(first.next().ok,true);
 assert.equal(first.current().beatId,"fs07-map");
 first.leave();
 const reload=create(Act3,storage);
 assert.equal(reload.start(id).ok,true);
 assert.equal(reload.current().beatId,"fs07-map");
 reload.leave();
 finish(reload,id,0);
 const before=reload.stateFor("five-shadows");
 assert.equal(before.keyDecisionLog.find(x=>x.nodeId===id).choiceId,"fs07-people-first");
 const oldIds=before.completedNodeIds.slice();
 finish(reload,id,1);
 const after=reload.stateFor("five-shadows");
 assert.deepEqual(after.completedNodeIds,oldIds);
 assert.deepEqual(after.primaryChoicesById,before.primaryChoicesById);
 assert.deepEqual(after.keyDecisionLog,before.keyDecisionLog);
});
test("LOREACT3001: failed writes do not advance the story or damage previous progress",()=>{
 const store=memory();seedSix(store);const raw=store.map.get(Core.KEY);
 const failStore={getItem:k=>store.getItem(k),setItem:()=>{throw Error("quota");}};
 const r=create(Act3,failStore);
 const node=Act3.data.catalog().nodes[6].id;
 const result=r.start(node);
 assert.equal(result.ok,false);
 assert.equal(result.code,"SAVE_WRITE_FAILED");
 assert.equal(r.current(),null);
 assert.equal(store.map.get(Core.KEY),raw);
});
test("LOREACT3001: UI selects the third act and build has stable script ordering",()=>{
 const store=memory();seedSix(store);
 const root={innerHTML:"",addEventListener(){},removeEventListener(){},
  contains(){return true;},querySelector(){return null;}};
 assert.equal(UI.mount(root,Act3.data,Core,{pack:Act3.pack,storage:store,
  scripts:Scripts,engine:Engine,save:Save,runtime:Runtime}),true);
 assert.equal(UI.openStory("five-shadows"),true);
 assert.equal(UI.snapshot().layerId,"city-route");
 assert.equal(UI.snapshot().nodeId,"five-shadows:fs-07");
 assert.match(root.innerHTML,/Акт III · Цена пути/);
 assert.equal(UI.changeLayer("city-response"),true);
 assert.equal(UI.changeLayer("city-route"),true);
 const html=read("index.html"),game=read("game.js"),pkg=JSON.parse(read("package.json"));
 assert.equal(pkg.version,"0.3.175");
 assert.match(html,/v0\.3\.175 · LOREACT3001/);
 const files=["lore-campaign-pilot.js","lore-campaign-act2.js",
  "lore-campaign-trials.js","lore-campaign-act3.js","game.js"];
 let last=-1;
 for(const name of files){
  const at=html.indexOf('src="'+name+'?v='+pkg.version+'"');
  assert.ok(at>last,name+" script order");
  last=at;
 }
 assert.match(game,/const ActiveLoreCampaign=/);
 assert.match(game,/ActiveLoreCampaign\.data\.getNode/);
 assert.match(game,/ActiveLoreCampaign\.encounter/);
 assert.equal(html.includes("0.3.174"),false);
});
