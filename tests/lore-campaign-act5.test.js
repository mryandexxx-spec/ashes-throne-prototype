"use strict";
/* LOREACT5001: final 15-node narrative graph and save/regression contracts. */
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const Data=require("../lore-campaign-data.js"),Core=require("../lore-campaign-core.js");
const Scripts=require("../lore-campaign-scenes.js"),Engine=require("../lore-campaign-scene-core.js");
const Save=require("../lore-campaign-scene-save.js"),Runtime=require("../lore-campaign-scene-runtime.js");
const Act4=require("../lore-campaign-act4.js"),Act5=require("../lore-campaign-act5.js");
const UI=require("../lore-campaign-ui.js");
const id=n=>"five-shadows:fs-"+String(n).padStart(2,"0");
function memory(){
 const map=new Map();
 return {map,getItem:key=>map.has(key)?map.get(key):null,setItem:(k,v)=>map.set(k,String(v))};
}
function create(bundle,storage){
 return Runtime.create({graph:bundle.data.catalog(),graphCore:Core,pack:bundle.pack,
  scriptData:Scripts,sceneCore:Engine,saveModule:Save,storage});
}
function finish(r,nodeId,branch=0){
 assert.equal(r.start(nodeId).ok,true,"start "+nodeId);
 for(let step=0;step<190;step++){
  let v=r.current();assert.ok(v,"view "+nodeId);
  for(const a of v.inspections)if(!a.done)assert.equal(r.inspect(a.id).ok,true,"inspect "+a.id);
  v=r.current();
  for(const a of v.comparisons)if(a.ready&&!a.done)assert.equal(r.compare(a.id).ok,true,"compare "+a.id);
  v=r.current();
  if(v.choices.length)assert.equal(r.choose(v.choices[branch]?.id||v.choices[0].id).ok,true,"choose "+v.beatId);
  else if(v.canContinue)assert.equal(r.next().ok,true,"next "+v.beatId);
  else if(v.canFinish){assert.equal(r.finish().ok,true,"finish "+nodeId);return;}
  else assert.fail("stuck "+nodeId+" "+v.beatId);
 }
 assert.fail("nonterminating node "+nodeId);
}
function seedTwelve(storage){
 const r=create(Act4,storage);
 for(const n of Act4.data.catalog().nodes){
  finish(r,n.id);
  if(n.requiredBattleId){
   const entry=r.beginRequiredBattle(n.id);
   assert.equal(entry.ok,true,"battle "+n.id);
   assert.equal(r.recordBattleVictory(n.id,entry.battleId).ok,true);
  }
 }
 return r;
}
test("LOREACT5001: immutable 15-node graph, fifth layer and unchanged old fights",()=>{
 const graph=Act5.data.catalog(),old=Act4.data.catalog();
 assert.equal(Data.catalogIsValid(graph),true);
 assert.equal(Scripts.valid(Act5.pack,graph),true);
 assert.equal(graph.nodes.length,15);
 assert.equal(Act5.pack.scenes.length,15);
 assert.equal(graph.stories.find(x=>x.id==="five-shadows").mapLayers.length,5);
 assert.equal(graph.chapters.filter(x=>x.storyId==="five-shadows").length,5);
 assert.deepEqual(graph.nodes.slice(12).map(x=>x.canonicalRef),["part-11","part-12","part-13"]);
 assert.deepEqual(graph.nodes.slice(12).map(x=>x.contentId),
  ["fs13-on-this-bank","fs14-while-heard","fs15-where-to-go"]);
 assert.deepEqual(graph.nodes.slice(12).map(x=>x.mapLayerId),
  ["return-and-records","return-and-records","return-and-records"]);
 assert.deepEqual(graph.nodes[11].nextNodeIds,[id(13)]);
 assert.deepEqual(graph.nodes[14].nextNodeIds,[]);
 assert.deepEqual(old.nodes[11].nextNodeIds,[],"Act IV source graph stays untouched");
 for(let i=0;i<12;i++){
  assert.equal(graph.nodes[i].requiredBattleId,old.nodes[i].requiredBattleId);
  assert.equal(Act5.encounter(graph.nodes[i].id),Act4.encounter(old.nodes[i].id));
 }
 for(let i=12;i<15;i++){
  assert.equal(graph.nodes[i].requiredBattleId,undefined);
  assert.deepEqual(graph.nodes[i].prerequisites,[graph.nodes[i-1].id]);
 }
 assert.ok(graph.nodes.every(n=>n.rewardPoolId===null&&n.energyCostId===null));
 assert.equal(Object.isFrozen(graph),true);
 assert.equal(Object.isFrozen(Act5.pack),true);
});
test("LOREACT5001: completed 12-node save migrates to final three without rewrites",()=>{
 const storage=memory(),old=seedTwelve(storage);
 const saved=storage.map.get(Core.KEY),oldRec=old.stateFor("five-shadows");
 assert.equal(oldRec.completedNodeIds.length,12);
 assert.equal(oldRec.battleClearedNodeIds.length,6);
 const r=create(Act5,storage),g=Act5.data.catalog();
 assert.equal(r.storageStatus(),"saved");
 assert.equal(storage.map.get(Core.KEY),saved);
 assert.equal(Core.available(g,r.progress(),id(13)),true);
 assert.equal(Core.available(g,r.progress(),id(14)),false);
 assert.equal(r.start(id(14)).code,"LOCKED");
 for(let i=13;i<=15;i++)finish(r,id(i));
 const after=r.stateFor("five-shadows");
 assert.deepEqual(after.completedNodeIds,Array.from({length:15},(_,i)=>id(i+1)));
 assert.deepEqual(after.battleClearedNodeIds,Array.from({length:6},(_,i)=>id(i+1)));
 assert.equal(after.keyDecisionLog.length,oldRec.keyDecisionLog.length+3);
 assert.deepEqual([...storage.map.keys()],[Core.KEY],"same save, no reward keys");
 assert.equal(create(Act5,storage).stateFor("five-shadows").completedNodeIds.length,15);
 assert.equal(g.nodes[14].nextNodeIds.length,0);
});
test("LOREACT5001: fresh save full story FS-01…FS-15 and six combat gates",()=>{
 const storage=memory(),r=create(Act5,storage),graph=Act5.data.catalog();
 assert.equal(Core.available(graph,r.progress(),id(2)),false);
 for(let i=1;i<=15;i++){
  assert.equal(Core.available(graph,r.progress(),id(i)),true,"gate "+id(i));
  finish(r,id(i));
  const n=graph.nodes[i-1];
  if(n.requiredBattleId){
   if(i<15)assert.equal(Core.available(graph,r.progress(),id(i+1)),false,"battle cannot be skipped");
   const battle=r.beginRequiredBattle(id(i));
   assert.equal(battle.ok,true);
   assert.equal(r.recordBattleVictory(id(i),battle.battleId).ok,true);
  }
 }
 const record=r.stateFor("five-shadows");
 assert.equal(record.completedNodeIds.length,15);
 assert.equal(record.battleClearedNodeIds.length,6);
 assert.equal(record.keyDecisionLog.length,Act5.pack.scenes.reduce((sum,scene)=>sum+new Set(scene.choices.map(c=>c.decisionId)).size,0));
 assert.equal(record.activeNodeId,null);
 assert.equal(create(Act5,storage).stateFor("five-shadows").completedNodeIds.length,15);
});
test("LOREACT5001: save checkpoint, second branch and replay cannot rewrite primary",()=>{
 const storage=memory();seedTwelve(storage);
 const r=create(Act5,storage);
 assert.equal(r.start(id(13)).ok,true);
 for(const item of r.current().inspections){
  assert.equal(r.inspect(item.id).ok,true,"checkpoint first-beat inspection "+item.id);
 }
 assert.equal(r.next().ok,true);
 assert.equal(r.current().beatId,"fs13-market-evidence");
 r.leave();
 const reloaded=create(Act5,storage);
 assert.equal(reloaded.start(id(13)).ok,true);
 assert.equal(reloaded.current().beatId,"fs13-market-evidence");
 reloaded.leave();
 for(let i=13;i<=15;i++)finish(reloaded,id(i),1);
 const first=reloaded.stateFor("five-shadows");
 const saved=JSON.stringify(first.primaryChoicesById);
 assert.deepEqual(first.keyDecisionLog.filter(x=>[id(13),id(14),id(15)].includes(x.nodeId))
  .map(x=>x.choiceId),["fs13-threshold-first","fs14-safety-first","fs15-witness-first"]);
 for(let i=13;i<=15;i++)finish(reloaded,id(i),0);
 assert.equal(JSON.stringify(reloaded.stateFor("five-shadows").primaryChoicesById),saved);
 assert.deepEqual(reloaded.stateFor("five-shadows").keyDecisionLog,first.keyDecisionLog);
});
test("LOREACT5001: incomplete FS-12 cannot open FS-13, save failure rolls back",()=>{
 const store=memory();seedTwelve(store);
 const old=JSON.parse(store.map.get(Core.KEY));
 const incomplete=JSON.parse(JSON.stringify(old));
 incomplete.stories["five-shadows"].completedNodeIds.pop();
 store.map.set(Core.KEY,JSON.stringify(incomplete));
 const r=create(Act5,store);
 assert.equal(Core.available(Act5.data.catalog(),r.progress(),id(13)),false);
 assert.equal(r.start(id(13)).code,"LOCKED");
 store.map.set(Core.KEY,JSON.stringify(old));
 const previous=store.map.get(Core.KEY);
 const failing={getItem:k=>store.getItem(k),setItem:()=>{throw Error("quota");}};
 const r2=create(Act5,failing);
 assert.equal(r2.start(id(13)).code,"SAVE_WRITE_FAILED");
 assert.equal(r2.current(),null);
 assert.equal(store.map.get(Core.KEY),previous);
});
test("LOREACT5001: finale does not invent Ela death, Tav reunion or false knowledge",()=>{
 const [rescue,contact,finale]=Act5.pack.scenes.slice(12);
 const beat=(scene,name)=>scene.beats.find(x=>x.id===name);
 assert.match(beat(rescue,"fs13-end").text,/не объявлена погибшей/);
 assert.match(beat(contact,"fs14-vanish").text,/никто не видел падения или смерти/);
 assert.match(beat(contact,"fs14-closure").comparisons[0].text,/Нет наблюдаемого доказательства смерти Элы/);
 assert.match(beat(finale,"fs15-docs").text,/шаг он сделал сам/);
 assert.match(beat(finale,"fs15-public-end").text,/Не знаю/);
 assert.match(beat(finale,"fs15-reply").text,/через пять недель/);
 assert.match(beat(finale,"fs15-reply").text,/Мена умерла/);
 assert.match(beat(finale,"fs15-letter").text,/Я иду к тебе/);
 assert.match(beat(finale,"fs15-letter").text,/ещё только собирается/);
 assert.match(beat(finale,"fs15-reader-note").text,/НЕ ЗНАНИЕ ГЕРОЕВ/);
 assert.match(beat(finale,"fs15-reader-note").text,/этого не наблюдали/);
 assert.equal(beat(finale,"fs15-end").nextBeatId,null);
 assert.ok(Act5.data.catalog().nodes.slice(12).every(n=>!n.requiredBattleId));
 assert.ok(Act5.pack.scenes.slice(12).every(sc=>sc.beats.every(x=>x.text.length<=2000)));
});
test("LOREACT5001: fifth map layer automatically opened from 12-node progress",()=>{
 const storage=memory();seedTwelve(storage);
 const root={innerHTML:"",addEventListener(){},removeEventListener(){},
  contains(){return true;},querySelector(){return null;}};
 assert.equal(UI.mount(root,Act5.data,Core,{pack:Act5.pack,storage,
  scripts:Scripts,engine:Engine,save:Save,runtime:Runtime}),true);
 assert.equal(UI.openStory("five-shadows"),true);
 assert.equal(UI.snapshot().layerId,"return-and-records");
 assert.equal(UI.snapshot().nodeId,id(13));
 assert.match(root.innerHTML,/Акт V/);
 assert.equal(UI.changeLayer("two-banks"),true);
 assert.equal(UI.changeLayer("return-and-records"),true);
 const html=read("index.html"),game=read("game.js"),pkg=JSON.parse(read("package.json"));
 assert.equal(pkg.version,"0.3.177");
 assert.match(html,/v0\.3\.177 · LOREACT5001/);
 assert.match(game,/const ActiveLoreCampaign=typeof LoreCampaignAct5/);
 const files=["lore-campaign-pilot.js","lore-campaign-act2.js","lore-campaign-trials.js",
  "lore-campaign-act3.js","lore-campaign-act4.js","lore-campaign-act5.js","game.js"];
 let last=-1;
 for(const name of files){
  const pos=html.indexOf('src="'+name+'?v='+pkg.version+'"');
  assert.ok(pos>last,"script "+name);last=pos;
 }
 assert.equal(html.includes("0.3.176"),false,"no old cache token");
});
test("LOREACT5001: full completion UI stays at FS-15, allows reread not phantom FS-16",()=>{
 const storage=memory();seedTwelve(storage);
 const r=create(Act5,storage);
 for(let i=13;i<=15;i++)finish(r,id(i));
 const root={innerHTML:"",addEventListener(){},removeEventListener(){},
  contains(){return true;},querySelector(){return null;}};
 assert.equal(UI.mount(root,Act5.data,Core,{pack:Act5.pack,storage,
  scripts:Scripts,engine:Engine,save:Save,runtime:Runtime}),true);
 assert.equal(UI.openStory("five-shadows"),true);
 assert.equal(UI.snapshot().layerId,"return-and-records");
 assert.equal(UI.snapshot().nodeId,id(15));
 assert.match(root.innerHTML,/Пройдено/);
 assert.equal(root.innerHTML.includes("fs-16"),false);
});
