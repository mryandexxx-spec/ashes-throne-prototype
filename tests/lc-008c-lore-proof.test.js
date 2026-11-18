"use strict";
/* LC-008C: persisted proof for five acts; synthetic values below are test-only.
 * LC-008D wires only Act I separately; this proof remains read-only. */
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const Core=require("../lore-campaign-core.js");
const Scenes=require("../lore-campaign-scenes.js");
const Engine=require("../lore-campaign-scene-core.js");
const Save=require("../lore-campaign-scene-save.js");
const Runtime=require("../lore-campaign-scene-runtime.js");
const Act=require("../lore-campaign-act5.js");
const Proof=require("../lore-reward-proof-core.js");
const graph=Act.data.catalog();
const clone=value=>JSON.parse(JSON.stringify(value));
const id=n=>"five-shadows:fs-"+String(n).padStart(2,"0");
function memory(){
 const map=new Map();
 let writeFail=false;
 const storage={
  getItem(key){return map.has(key)?map.get(key):null;},
  setItem(key,value){
   if(writeFail&&key==="ashes-throne.progress.v3")throw Error("quota");
   map.set(key,String(value));
  }
 };
 return {map,storage,provider:()=>storage,failWallet:value=>{writeFail=value;}};
}
function create(storage){
 return Runtime.create({graph,graphCore:Core,pack:Act.pack,
  scriptData:Scenes,sceneCore:Engine,saveModule:Save,storage});
}
function complete(runtime,nodeId){
 assert.equal(runtime.start(nodeId).ok,true,"start "+nodeId);
 for(let step=0;step<200;step++){
  let view=runtime.current();assert.ok(view,"view "+nodeId);
  for(const item of view.inspections)
   if(!item.done)assert.equal(runtime.inspect(item.id).ok,true,"inspect "+item.id);
  view=runtime.current();
  for(const item of view.comparisons)
   if(item.ready&&!item.done)
    assert.equal(runtime.compare(item.id).ok,true,"compare "+item.id);
  view=runtime.current();
  if(view.choices.length)
   assert.equal(runtime.choose(view.choices[0].id).ok,true,"choose "+view.beatId);
  else if(view.canContinue)assert.equal(runtime.next().ok,true,"next "+view.beatId);
  else if(view.canFinish){assert.equal(runtime.finish().ok,true);return;}
  else assert.fail("stuck at "+nodeId+" / "+view.beatId);
 }
 assert.fail("nonterminating "+nodeId);
}
function finishThrough(storage,limit,{skipBattle=null}={}){
 const runtime=create(storage);
 for(let i=1;i<=limit;i++){
  const node=graph.nodes[i-1];
  complete(runtime,node.id);
  if(node.requiredBattleId&&node.id!==skipBattle){
   const battle=runtime.beginRequiredBattle(node.id);
   assert.equal(battle.ok,true,"start battle "+node.id);
   assert.equal(runtime.recordBattleVictory(node.id,battle.battleId).ok,true);
  }
 }
 return runtime;
}
const proofArgs=(storage,act=1,overrides={})=>({
 storage,kind:"first-clear",sourceId:Proof.SOURCE_IDS[act-1],
 occurrenceId:"once",count:1,...overrides
});
test("LC-008C: proof keeps five IDs; LC-008D wires only first live source",()=>{
 assert.deepEqual([...Proof.SOURCE_IDS],Array.from({length:5},(_,i)=>"five-shadows-act-"+(i+1)));
 const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
 assert.equal(html.includes('src="lore-reward-proof-core.js'),true);
 assert.equal(html.includes('src="reward-policy-core.js'),true);
 assert.equal(html.includes('src="lore-act1-reward-core.js'),true);
 const src=fs.readFileSync(path.join(__dirname,"..","lore-reward-proof-core.js"),"utf8");
 assert.equal(src.includes(".setItem("),false,"proof must not write domain or wallet");
 assert.equal(src.includes("RewardPolicyCore.claim("),false,"no live claim");
});
test("LC-008C: proof is read from saved lore, not in-memory scene or fake UI",()=>{
 const m=memory();
 assert.equal(Proof.authorize(proofArgs(m.storage)),false);
 const runtime=create(m.storage);
 complete(runtime,id(1));
 assert.equal(Proof.authorize(proofArgs(m.storage)),false);
 const n=graph.nodes[0],battle=runtime.beginRequiredBattle(n.id);
 assert.equal(battle.ok,true);
 assert.equal(runtime.recordBattleVictory(n.id,battle.battleId).ok,true);
 assert.equal(Proof.authorize(proofArgs(m.storage)),false,"one battle/scene is not whole act");
 const old=m.map.get(Save.KEY);
 m.map.set(Save.KEY,"{invalid");
 assert.equal(Proof.authorize(proofArgs(m.storage)),false);
 m.map.set(Save.KEY,old);
 assert.equal(Proof.authorize(proofArgs(m.storage)),false);
});
test("LC-008C: all five real act completions become eligible only at boundary",()=>{
 const m=memory(),runtime=create(m.storage);
 const boundaries=[3,6,9,12,15];
 for(let i=1;i<=15;i++){
  const node=graph.nodes[i-1];
  complete(runtime,node.id);
  if(node.requiredBattleId){
   const started=runtime.beginRequiredBattle(node.id);
   assert.equal(started.ok,true);
   assert.equal(runtime.recordBattleVictory(node.id,started.battleId).ok,true);
  }
  for(let act=1;act<=5;act++)
   assert.equal(Proof.authorize(proofArgs(m.storage,act)),i>=boundaries[act-1],
    "act "+act+" at node "+i);
 }
 assert.equal(create(m.storage).stateFor("five-shadows").completedNodeIds.length,15);
 assert.equal([...m.map.keys()].length,1,"no wallet/reward keys created by proof");
});
test("LC-008C: missing mandatory victory in prior act blocks later reward proof",()=>{
 const m=memory();
 const runtime=finishThrough(m.storage,3);
 assert.equal(Proof.authorize(proofArgs(m.storage,1)),true);
 const state=JSON.parse(m.map.get(Save.KEY));
 const required=graph.nodes.slice(0,3).find(x=>x.requiredBattleId);
 assert.ok(required,"act I must contain mandatory battle");
 state.stories["five-shadows"].battleClearedNodeIds=
  state.stories["five-shadows"].battleClearedNodeIds.filter(x=>x!==required.id);
 assert.equal(Save.validate(state,graph,Act.pack,Core,Scenes),true,
  "historical saves may omit battle receipts yet validate structurally");
 m.map.set(Save.KEY,JSON.stringify(state));
 assert.equal(Proof.authorize(proofArgs(m.storage,1)),false);
 assert.equal(Proof.authorize(proofArgs(m.storage,2)),false);
 assert.equal(runtime.stateFor("five-shadows").completedNodeIds.length,3);
});
test("LC-008C: bad source, occurrence, count, kind, corruption and storage errors fail closed",()=>{
 const m=memory();finishThrough(m.storage,3);
 const before=m.map.get(Save.KEY);
 const invalid=[
  {kind:"best-stars"},{kind:"repeat"},{occurrenceId:"replay"},
  {occurrenceId:"new-choice"},{count:0},{count:2},
  {sourceId:"five-shadows:fs-03"},{sourceId:"five-shadows-act-6"},
  {sourceId:"five-shadows-act-01"}
 ];
 for(const fields of invalid)
  assert.equal(Proof.authorize(proofArgs(m.storage,1,fields)),false,JSON.stringify(fields));
 assert.equal(Proof.authorize(proofArgs({getItem(){throw Error("denied");}})),false);
 assert.equal(Proof.authorize(proofArgs(null)),false);
 const broken=JSON.parse(before);
 broken.stories["five-shadows"].completedNodeIds.push("five-shadows:fs-99");
 m.map.set(Save.KEY,JSON.stringify(broken));
 assert.equal(Proof.authorize(proofArgs(m.storage)),false);
 m.map.set(Save.KEY,before);
 assert.equal(Proof.authorize(proofArgs(m.storage)),true);
 assert.equal(m.map.get(Save.KEY),before,"read-only proof cannot modify domain save");
});
test("LC-008C: synthetic RewardPolicy claim uses validated persisted proof once",async()=>{
 const files=["gear-data.js","progress-core.js","save-core.js",
  "progress-v3-core.js","reward-policy-core.js"];
 const text=files.map(name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8")).join("\n");
 const {SaveCore,RewardPolicyCore,ProgressV3Core}=vm.runInNewContext(text+
  "\n({SaveCore,RewardPolicyCore,ProgressV3Core})");
 const heroes=["kael","lyra","darin","medic-demo","test-area-damage"].map(id=>({id,side:"ally"}));
 const m=memory();
 assert.equal(SaveCore.load(heroes,m.provider).blocked,false);
 const before=m.map.get(ProgressV3Core.KEY);
 const reward={sourceId:Proof.SOURCE_IDS[0],kind:"first-clear",
  reward:{currency:13,accountXp:1,materials:{Fe:1}},energyCost:0};
 const lock=fn=>fn();
 const claim=()=>RewardPolicyCore.claim({
  source:reward,occurrenceId:"once",count:1,day:"2026-11-18",
  heroes,storageProvider:m.provider,authorize:Proof.authorize,exclusive:lock
 });
 assert.equal((await claim()).code,"PROOF_NOT_PERSISTED");
 assert.equal(m.map.get(ProgressV3Core.KEY),before);
 finishThrough(m.storage,3);
 const result=await claim();
 assert.equal(result.ok,true);
 assert.equal(result.receiptId,"first-clear:five-shadows-act-1:once");
 assert.equal((await claim()).code,"ALREADY_CLAIMED");
 const after=JSON.parse(m.map.get(ProgressV3Core.KEY));
 assert.equal(after.currency,13);
 assert.equal(after.accountXp,1);
 assert.equal(after.materials.Fe,1);
 assert.equal(after.rewardReceipts.length,1);
 assert.equal(SaveCore.load(heroes,m.provider).progress.rewardReceipts.length,1);
});
test("LC-008C: failed synthetic write keeps claim eligible for a verified retry",async()=>{
 const files=["gear-data.js","progress-core.js","save-core.js",
  "progress-v3-core.js","reward-policy-core.js"];
 const s=files.map(name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8")).join("\n");
 const {SaveCore,RewardPolicyCore,ProgressV3Core}=vm.runInNewContext(s+
  "\n({SaveCore,RewardPolicyCore,ProgressV3Core})");
 const heroes=["kael","lyra","darin","medic-demo","test-area-damage"].map(id=>({id,side:"ally"}));
 const m=memory();SaveCore.load(heroes,m.provider);finishThrough(m.storage,3);
 const raw=m.map.get(ProgressV3Core.KEY),lore=m.map.get(Save.KEY);
 const options={source:{sourceId:"five-shadows-act-1",kind:"first-clear",
  reward:{currency:2,accountXp:0,materials:{}},energyCost:0},
  occurrenceId:"once",day:"2026-11-18",heroes,storageProvider:m.provider,
  authorize:Proof.authorize,exclusive:fn=>fn()};
 m.failWallet(true);
 assert.equal((await RewardPolicyCore.claim(options)).code,"SAVE_OUTCOME_UNKNOWN");
 assert.equal(m.map.get(ProgressV3Core.KEY),raw);
 assert.equal(m.map.get(Save.KEY),lore);
 m.failWallet(false);
 assert.equal((await RewardPolicyCore.claim(options)).ok,true);
 assert.equal((await RewardPolicyCore.claim(options)).code,"ALREADY_CLAIMED");
});
