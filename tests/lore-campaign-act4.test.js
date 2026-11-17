"use strict";
/* LOREACT4001: FS-10…12 are playable canon-limited scenes on unchanged lore save. */
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const Data=require("../lore-campaign-data.js"),Core=require("../lore-campaign-core.js");
const Scripts=require("../lore-campaign-scenes.js"),Engine=require("../lore-campaign-scene-core.js");
const Save=require("../lore-campaign-scene-save.js"),Runtime=require("../lore-campaign-scene-runtime.js");
const Act3=require("../lore-campaign-act3.js"),Act4=require("../lore-campaign-act4.js");
const UI=require("../lore-campaign-ui.js");
function memory(){
 const map=new Map();
 return {map,getItem:key=>map.has(key)?map.get(key):null,setItem:(k,v)=>map.set(k,String(v))};
}
function create(bundle,storage){
 return Runtime.create({graph:bundle.data.catalog(),graphCore:Core,pack:bundle.pack,
  scriptData:Scripts,sceneCore:Engine,saveModule:Save,storage});
}
function finish(r,id,branch=0){
 assert.equal(r.start(id).ok,true,"start "+id);
 for(let step=0;step<145;step++){
  let view=r.current();assert.ok(view,"live "+id);
  for(const a of view.inspections)if(!a.done)assert.equal(r.inspect(a.id).ok,true);
  view=r.current();
  for(const a of view.comparisons)if(a.ready&&!a.done)assert.equal(r.compare(a.id).ok,true);
  view=r.current();
  if(view.choices.length)assert.equal(r.choose(view.choices[branch]?.id||view.choices[0].id).ok,true);
  else if(view.canContinue)assert.equal(r.next().ok,true);
  else if(view.canFinish){assert.equal(r.finish().ok,true);return;}
  else assert.fail("stuck "+id+" "+view.beatId);
 }
 assert.fail("loop "+id);
}
function seedNine(storage){
 const r=create(Act3,storage),graph=Act3.data.catalog();
 for(const n of graph.nodes){
  finish(r,n.id);
  if(n.requiredBattleId){
   const battle=r.beginRequiredBattle(n.id);
   assert.equal(battle.ok,true);
   assert.equal(r.recordBattleVictory(n.id,battle.battleId).ok,true);
  }
 }
 return r;
}
test("LOREACT4001: 12 validated nodes, 4 layers, six old battle receipts unchanged",()=>{
 const g=Act4.data.catalog(),old=Act3.data.catalog();
 assert.equal(Data.catalogIsValid(g),true);
 assert.equal(Scripts.valid(Act4.pack,g),true);
 assert.equal(g.nodes.length,12);assert.equal(Act4.pack.scenes.length,12);
 assert.equal(g.stories[0].mapLayers.length,4);
 assert.deepEqual(g.nodes.slice(9).map(n=>n.canonicalRef),["part-8","part-9","part-10"]);
 assert.deepEqual(g.nodes.slice(9).map(n=>n.requiredBattleId||null),[null,null,null]);
 assert.deepEqual(g.nodes.slice(9).map(n=>n.contentId),
  ["fs10-blind-spot","fs11-shift-shadow","fs12-beyond-the-mark"]);
 assert.deepEqual(g.nodes[8].nextNodeIds,["five-shadows:fs-10"]);
 assert.deepEqual(old.nodes[8].nextNodeIds,[],"Act III graph never mutated");
 assert.deepEqual(g.nodes.slice(9).map(n=>n.mapLayerId),["two-banks","two-banks","two-banks"]);
 for(let i=0;i<9;i++){
  assert.equal(g.nodes[i].requiredBattleId,old.nodes[i].requiredBattleId);
  assert.equal(Act4.encounter(g.nodes[i].id),Act3.encounter(old.nodes[i].id));
 }
 for(let i=9;i<12;i++)
  assert.deepEqual(g.nodes[i].prerequisites,[g.nodes[i-1].id]);
 assert.ok(g.nodes.every(n=>n.rewardPoolId===null&&n.energyCostId===null));
 assert.equal(Object.isFrozen(g),true);
 assert.equal(Object.isFrozen(Act4.pack),true);
});
test("LOREACT4001: existing nine-node save unlocks Act IV but no earlier locked gates bypassed",()=>{
 const storage=memory(),old=seedNine(storage);
 const before=storage.map.get(Core.KEY),oldRecord=old.stateFor("five-shadows");
 assert.equal(oldRecord.completedNodeIds.length,9);
 assert.equal(oldRecord.battleClearedNodeIds.length,6);
 const r=create(Act4,storage),g=Act4.data.catalog();
 assert.equal(r.storageStatus(),"saved");
 assert.equal(Core.available(g,r.progress(),"five-shadows:fs-10"),true);
 assert.equal(Core.available(g,r.progress(),"five-shadows:fs-11"),false);
 assert.equal(r.start("five-shadows:fs-11").code,"LOCKED");
 assert.equal(storage.map.get(Core.KEY),before,"load does not rewrite valid save");
 for(const n of g.nodes.slice(9))finish(r,n.id);
 const record=r.stateFor("five-shadows");
 assert.equal(record.completedNodeIds.length,12);
 assert.equal(record.battleClearedNodeIds.length,6);
 assert.equal(record.keyDecisionLog.length,oldRecord.keyDecisionLog.length+3);
 assert.deepEqual([...storage.map.keys()],[Core.KEY],"no secondary wallet key");
 assert.equal(create(Act4,storage).stateFor("five-shadows").completedNodeIds.length,12);
});
test("LOREACT4001: FS-10 cannot bypass uncleared FS-06 or uncompleted FS-09",()=>{
 const storage=memory();seedNine(storage);
 const old=JSON.parse(storage.map.get(Core.KEY));
 const removedNinth=JSON.parse(JSON.stringify(old));
 removedNinth.stories["five-shadows"].completedNodeIds.pop();
 storage.map.set(Core.KEY,JSON.stringify(removedNinth));
 const g=Act4.data.catalog(),r1=create(Act4,storage);
 assert.equal(Core.available(g,r1.progress(),"five-shadows:fs-10"),false);
 assert.equal(r1.start("five-shadows:fs-10").code,"LOCKED");
 const uncleared=JSON.parse(JSON.stringify(old));
 uncleared.stories["five-shadows"].battleClearedNodeIds.pop();
 storage.map.set(Core.KEY,JSON.stringify(uncleared));
 const r2=create(Act4,storage);
 assert.equal(Core.available(g,r2.progress(),"five-shadows:fs-10"),true,
  "already completed Act III remains available despite missed old receipt");
 assert.equal(Core.available(g,r2.progress(),"five-shadows:fs-07"),true,
  "completed scenes remain replayable despite old missing battle receipt");
 // Fresh progress with only FS-01…05 cleared must not allow FS-07.
 const incomplete=JSON.parse(JSON.stringify(old));
 incomplete.stories["five-shadows"].completedNodeIds=
  incomplete.stories["five-shadows"].completedNodeIds.filter(x=>!/^five-shadows:fs-0[789]$/.test(x));
 incomplete.stories["five-shadows"].battleClearedNodeIds.pop();
 storage.map.set(Core.KEY,JSON.stringify(incomplete));
 const r3=create(Act4,storage);
 assert.equal(Core.available(g,r3.progress(),"five-shadows:fs-07"),false);
 assert.equal(r3.start("five-shadows:fs-10").code,"LOCKED");
});
test("LOREACT4001: checkpoint, two branches, replay does not overwrite original decisions",()=>{
 const storage=memory();seedNine(storage);
 const r=create(Act4,storage),ids=["five-shadows:fs-10","five-shadows:fs-11","five-shadows:fs-12"];
 assert.equal(r.start(ids[0]).ok,true);
 assert.equal(r.next().ok,true);
 assert.equal(r.current().beatId,"fs10-work");
 r.leave();
 const reloaded=create(Act4,storage);
 assert.equal(reloaded.start(ids[0]).ok,true);
 assert.equal(reloaded.current().beatId,"fs10-work");
 reloaded.leave();
 for(const id of ids)finish(reloaded,id,1);
 const first=reloaded.stateFor("five-shadows");
 const before=JSON.stringify(first.primaryChoicesById);
 assert.deepEqual(first.keyDecisionLog.filter(x=>ids.includes(x.nodeId)).map(x=>x.choiceId),
  ["fs10-witness-first","fs11-support-first","fs12-roa-first"]);
 for(const id of ids)finish(reloaded,id,0);
 const after=reloaded.stateFor("five-shadows");
 assert.equal(JSON.stringify(after.primaryChoicesById),before);
 assert.deepEqual(after.keyDecisionLog,first.keyDecisionLog);
});
test("LOREACT4001: unrecoverable write failure cannot fabricate new progress",()=>{
 const store=memory();seedNine(store);
 const raw=store.map.get(Core.KEY);
 const fails={getItem:k=>store.getItem(k),setItem:()=>{throw Error("quota");}};
 const r=create(Act4,fails);
 assert.equal(r.start("five-shadows:fs-10").code,"SAVE_WRITE_FAILED");
 assert.equal(r.current(),null);assert.equal(store.map.get(Core.KEY),raw);
});
test("LOREACT4001: no invented monster combat or explanation of unusual event",()=>{
 const scenes=Act4.pack.scenes.slice(9);
 const beat=(i,id)=>scenes[i].beats.find(b=>b.id===id);
 assert.match(beat(0,"fs10-cord").text,/не нашёл отверстия|не нашёл/);
 assert.match(beat(0,"fs10-test").text,/шнур просто лёг на песок/);
 assert.match(beat(1,"fs11-measure").comparisons[0].text,/Причина ещё не установлена/);
 assert.match(beat(2,"fs12-ledge").text,/несходящиеся времена/);
 assert.match(beat(2,"fs12-hold").text,/оторвала её руки от камня/);
 assert.ok(scenes.every(x=>x.beats.every(b=>b.text.length<=2000)));
 assert.ok(Act4.data.catalog().nodes.slice(9).every(n=>!n.requiredBattleId));
});
test("LOREACT4001: map selects Act IV and locked labels report reality",()=>{
 const store=memory();seedNine(store);
 const root={innerHTML:"",addEventListener(){},removeEventListener(){},
  contains(){return true;},querySelector(){return null;}};
 assert.equal(UI.mount(root,Act4.data,Core,{pack:Act4.pack,storage:store,
  scripts:Scripts,engine:Engine,save:Save,runtime:Runtime}),true);
 assert.equal(UI.openStory("five-shadows"),true);
 assert.equal(UI.snapshot().layerId,"two-banks");
 assert.equal(UI.snapshot().nodeId,"five-shadows:fs-10");
 assert.match(root.innerHTML,/Акт IV/);
 assert.equal(UI.changeLayer("city-route"),true);
 assert.equal(UI.changeLayer("two-banks"),true);
 const html=read("index.html"),game=read("game.js"),pkg=JSON.parse(read("package.json"));
 assert.equal(pkg.version,"0.3.176");
 assert.match(html,/v0\.3\.176 · LOREACT4001/);
 assert.match(game,/const ActiveLoreCampaign=typeof LoreCampaignAct4/);
 const files=["lore-campaign-pilot.js","lore-campaign-act2.js",
  "lore-campaign-trials.js","lore-campaign-act3.js","lore-campaign-act4.js","game.js"];
 let last=-1;
 for(const name of files){
  const pos=html.indexOf('src="'+name+'?v='+pkg.version+'"');
  assert.ok(pos>last,"script "+name);
  last=pos;
 }
 assert.ok(!html.includes("0.3.175"));
});
