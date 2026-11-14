"use strict";
/* LOREACT2001: preserve old saves and replay decisions while adding 3 scenes. */
const test=require("node:test"),assert=require("node:assert/strict");
const Base=require("../lore-campaign-data.js"),Core=require("../lore-campaign-core.js");
const Scripts=require("../lore-campaign-scenes.js"),Engine=require("../lore-campaign-scene-core.js");
const Runtime=require("../lore-campaign-scene-runtime.js"),Save=require("../lore-campaign-scene-save.js");
const Pilot=require("../lore-campaign-pilot.js"),Act2=require("../lore-campaign-act2.js");
function memory(){const map=new Map();return {map,getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,v)};}
const create=(bundle,storage)=>Runtime.create({graph:bundle.data.catalog(),graphCore:Core,
 pack:bundle.pack,scriptData:Scripts,sceneCore:Engine,saveModule:Save,storage});
function play(r,id){
 assert.equal(r.start(id).ok,true,"start "+id);
 for(let i=0;i<125;i++){
  let v=r.current();assert.ok(v,"scene present "+id);
  for(const x of v.inspections)if(!x.done)assert.equal(r.inspect(x.id).ok,true,"inspect "+x.id);
  v=r.current();
  for(const x of v.comparisons)if(x.ready&&!x.done)assert.equal(r.compare(x.id).ok,true,"compare "+x.id);
  v=r.current();
  if(v.choices.length)assert.equal(r.choose(v.choices[0].id).ok,true,"choice "+v.beatId);
  else if(v.canContinue)assert.equal(r.next().ok,true,"next "+v.beatId);
  else if(v.canFinish){assert.equal(r.finish().ok,true,"finish "+id);return;}
  else assert.fail("stuck at "+v.beatId);
 }
 assert.fail("too many beats "+id);
}
function oldProgress(storage){
 const r=create(Pilot,storage);
 const [a,b,c]=Pilot.data.catalog().nodes.map(n=>n.id);
 play(r,a);
 assert.equal(r.beginRequiredBattle(a).ok,true);
 assert.equal(r.recordBattleVictory(a,"fs01-approach-combat").ok,true);
 play(r,b);
 assert.equal(r.beginRequiredBattle(b).ok,true);
 assert.equal(r.recordBattleVictory(b,"fs02-evidence-combat").ok,true);
 play(r,c);
 return r.progress();
}
test("LOREACT2001: six chapters' nodes in two map layers with valid content and no new battles",()=>{
 const g=Act2.data.catalog();
 assert.equal(Base.catalogIsValid(g),true);
 assert.equal(Scripts.valid(Act2.pack,g),true);
 assert.equal(g.nodes.length,6);
 assert.equal(Act2.pack.scenes.length,6);
 assert.deepEqual(g.stories[0].mapLayers.map(x=>x.id),["gardens-route","city-response"]);
 assert.deepEqual(g.nodes.slice(3).map(n=>n.contentId),[
  "fs04-the-returned","fs05-upper-door","fs06-fire-in-fifth-shadow"]);
 assert.deepEqual(g.nodes.slice(3).map(n=>n.requiredBattleId||null),[null,null,null]);
 assert.deepEqual(g.nodes[2].nextNodeIds,["five-shadows:fs-04"]);
 assert.equal(g.nodes[5].nextNodeIds.length,0);
 assert.ok(g.nodes.every(n=>n.rewardPoolId===null&&n.energyCostId===null));
 assert.equal(Object.isFrozen(g),true);
 assert.equal(Pilot.data.catalog().nodes.length,3,"first act left intact");
});
test("LOREACT2001: old three-scene save loads and new act completes without losing receipts",()=>{
 const store=memory(),before=oldProgress(store),g=Act2.data.catalog();
 const r=create(Act2,store),id=g.nodes.map(n=>n.id);
 assert.equal(r.storageStatus(),"saved");
 assert.equal(Core.available(g,r.progress(),id[3]),true);
 assert.equal(Core.available(g,r.progress(),id[4]),false);
 assert.deepEqual(r.stateFor("five-shadows").completedNodeIds,id.slice(0,3));
 assert.deepEqual(r.stateFor("five-shadows").battleClearedNodeIds,id.slice(0,2));
 for(const node of g.nodes.slice(3))play(r,node.id);
 assert.deepEqual(r.stateFor("five-shadows").completedNodeIds,id);
 assert.deepEqual(r.stateFor("five-shadows").battleClearedNodeIds,id.slice(0,2));
 assert.deepEqual([...store.map.keys()],[Core.KEY]);
 assert.deepEqual(
  Object.entries(before.stories["five-shadows"].primaryChoicesById).sort(),
  Object.entries(r.stateFor("five-shadows").primaryChoicesById).filter(([k])=>k.includes("fs-01")||k.includes("fs-02")||k.includes("fs-03")).sort());
 assert.deepEqual(create(Act2,store).stateFor("five-shadows").completedNodeIds,id);
});
test("LOREACT2001: checkpoint reload and replay of first act survive upgrade",()=>{
 const store=memory();oldProgress(store);
 const r=create(Act2,store),fs04=Act2.data.catalog().nodes[3].id;
 assert.equal(r.start(fs04).ok,true);assert.equal(r.next().ok,true);
 const reload=create(Act2,store);
 assert.equal(reload.start(fs04).ok,true);
 assert.equal(reload.current().beatId,"fs04-liora");
 reload.leave();
 const old=Act2.data.catalog().nodes[0].id;
 assert.equal(reload.start(old).ok,true);
 assert.equal(reload.current().mode,"replay");
 assert.deepEqual(reload.stateFor("five-shadows").completedNodeIds,
  Act2.data.catalog().nodes.slice(0,3).map(n=>n.id));
});
test("LOREACT2001: map chooses city layer after FS-03 and can return to first act",()=>{
 const UI=require("../lore-campaign-ui.js"),storage=memory();oldProgress(storage);
 const root={innerHTML:"",addEventListener(){},removeEventListener(){},contains(){return true;},querySelector(){return null;}};
 assert.equal(UI.mount(root,Act2.data,Core,{pack:Act2.pack,storage,
  scripts:Scripts,engine:Engine,save:Save,runtime:Runtime}),true);
 assert.equal(UI.openStory("five-shadows"),true);
 assert.equal(UI.snapshot().layerId,"city-response");
 assert.equal(UI.snapshot().nodeId,"five-shadows:fs-04");
 assert.match(root.innerHTML,/Акт II · Город и ответ/);
 assert.match(root.innerHTML,/data-lore-action="start-node"/);
 assert.equal(UI.changeLayer("gardens-route"),true);
 assert.equal(UI.snapshot().layerId,"gardens-route");
 assert.equal(UI.changeLayer("city-response"),true);
 assert.equal(UI.startScene(),true);
 assert.equal(UI.snapshot().view,"scene");
 assert.match(root.innerHTML,/Спустя три дня Рен/);
});

test("LOREACT2001: fresh play cannot jump into new act and UI scripts load in safe order",()=>{
 const fs=require("node:fs"),path=require("node:path");
 const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
 const graph=Act2.data.catalog(),progress=Core.fresh(graph);
 for(const node of graph.nodes.slice(1))
  assert.equal(Core.available(graph,progress,node.id),false,"fresh save cannot skip "+node.id);
 assert.equal(Core.available(graph,progress,graph.nodes[0].id),true);
 const pilotScript='src="lore-campaign-pilot.js?v=0.3.156"';
 const actScript='src="lore-campaign-act2.js?v=0.3.156"';
 const gameScript='src="game.js?v=0.3.156"';
 assert.ok(html.includes(pilotScript)&&html.includes(actScript)&&html.includes(gameScript));
 assert.ok(html.indexOf(pilotScript)<html.indexOf(actScript));
 assert.ok(html.indexOf(actScript)<html.indexOf(gameScript));
});
