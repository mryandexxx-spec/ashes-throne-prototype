"use strict";
/* LOREPLAY001: integrated progression uses the same private pilot reviewed in QA. */
const test=require("node:test"),assert=require("node:assert/strict");
const Base=require("../lore-campaign-data.js"),Core=require("../lore-campaign-core.js");
const Scripts=require("../lore-campaign-scenes.js"),Engine=require("../lore-campaign-scene-core.js");
const Runtime=require("../lore-campaign-scene-runtime.js"),Save=require("../lore-campaign-scene-save.js");
const Pilot=require("../lore-campaign-pilot.js");
const storage=()=>{const map=new Map();return {map,getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,v)};};
const make=s=>Runtime.create({graph:Pilot.data.catalog(),graphCore:Core,
 pack:Pilot.pack,scriptData:Scripts,sceneCore:Engine,saveModule:Save,storage:s});
function play(r,id){
 assert.equal(r.start(id).ok,true,id+" should start");
 for(let step=0;step<100;step++){
  let v=r.current();assert.ok(v,id+" active");
  for(const item of v.inspections)if(!item.done)
   assert.equal(r.inspect(item.id).ok,true,"inspect "+item.id);
  v=r.current();
  for(const item of v.comparisons)if(item.ready&&!item.done)
   assert.equal(r.compare(item.id).ok,true,"compare "+item.id);
  v=r.current();
  if(v.choices.length)assert.equal(r.choose(v.choices[0].id).ok,true,"choice");
  else if(v.canContinue)assert.equal(r.next().ok,true,"next "+v.beatId);
  else if(v.canFinish){assert.equal(r.finish().ok,true,"finish "+id);return;}
  else assert.fail("stuck "+v.beatId);
 }
 assert.fail("loop "+id);
}
test("LOREPLAY001: complete graph and 3 scenes, 2 gates, no rewards",()=>{
 const graph=Pilot.data.catalog(),pack=Pilot.pack;
 assert.equal(Base.catalogIsValid(graph),true);
 assert.equal(Scripts.valid(pack,graph),true);
 assert.deepEqual(graph.nodes.map(n=>n.contentId),["fs01-other-side","fs02-under-stone","fs03-ela-name"]);
 assert.deepEqual(graph.nodes.map(n=>n.requiredBattleId||null),["fs01-approach-combat","fs02-evidence-combat",null]);
 assert.equal(pack.scenes.length,3);
 assert.equal(Object.isFrozen(pack.scenes),true);
 assert.ok(graph.nodes.every(n=>n.energyCostId===null&&n.rewardPoolId===null));
 assert.equal(Base.catalog().nodes[0].contentId,null,"neutral engine graph unchanged");
 assert.deepEqual(Scripts.catalog().scenes,[],"neutral engine pack unchanged");
});
test("LOREPLAY001: scenes require genuine gate victories; progress survives reload",()=>{
 const s=storage(),r=make(s),graph=Pilot.data.catalog(),[a,b,c]=graph.nodes.map(n=>n.id);
 assert.equal(Core.available(graph,r.progress(),a),true);
 assert.equal(Core.available(graph,r.progress(),b),false);
 play(r,a);
 assert.equal(Core.available(graph,r.progress(),b),false,"victory 1 required");
 assert.equal(r.beginRequiredBattle(a).ok,true);
 assert.equal(r.recordBattleVictory(a,"fs01-approach-combat").ok,true);
 assert.equal(Core.available(graph,r.progress(),b),true);
 play(r,b);
 assert.equal(Core.available(graph,r.progress(),c),false,"victory 2 required");
 assert.equal(r.beginRequiredBattle(b).ok,true);
 assert.equal(r.recordBattleVictory(b,"fs02-evidence-combat").ok,true);
 assert.equal(Core.available(graph,r.progress(),c),true);
 play(r,c);
 assert.deepEqual(r.stateFor("five-shadows").completedNodeIds,[a,b,c]);
 assert.deepEqual(r.stateFor("five-shadows").battleClearedNodeIds,[a,b]);
 assert.deepEqual([...s.map.keys()],[Core.KEY],"only lore save written");
 const loaded=make(s);
 assert.deepEqual(loaded.stateFor("five-shadows").completedNodeIds,[a,b,c]);
 assert.equal(loaded.start(a).ok,true,"replay allowed");
 assert.equal(loaded.current().mode,"replay");
});
