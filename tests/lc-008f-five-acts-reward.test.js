"use strict";
/* LC-008F: five real Five Shadows payouts, persisted proof + one receipt per act. */
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const Core=require("../lore-campaign-core.js"),Scenes=require("../lore-campaign-scenes.js");
const Engine=require("../lore-campaign-scene-core.js"),Save=require("../lore-campaign-scene-save.js");
const Runtime=require("../lore-campaign-scene-runtime.js"),Act=require("../lore-campaign-act5.js");
const graph=Act.data.catalog(),id=n=>"five-shadows:fs-"+String(n).padStart(2,"0");
const heroes=["kael","lyra","darin","medic-demo","test-area-damage"].map(id=>({id,side:"ally"}));
const clone=x=>JSON.parse(JSON.stringify(x));
function modules(){
 const names=["gear-data.js","progress-core.js","save-core.js","progress-v3-core.js",
  "lore-reward-proof-core.js","reward-policy-core.js","lore-act1-reward-core.js"];
 const source=names.map(n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8")).join("\n");
 return vm.runInNewContext(source+"\n({SaveCore,ProgressV3Core,LoreRewardProofCore,LoreActOneRewardCore})",{
  LoreCampaignAct5:Act,LoreCampaignCore:Core,LoreCampaignSceneSave:Save,LoreCampaignScenes:Scenes
 });
}
function setup(){
 const map=new Map();let writeFails=false,readFails=false;
 const storage={
  getItem:key=>{if(readFails&&key==="ashes-throne.progress.v3")throw Error("read denied");
   return map.get(key)??null;},
  setItem:(key,value)=>{if(writeFails&&key==="ashes-throne.progress.v3")throw Error("quota");
   map.set(key,String(value));}
 };
 const provider=()=>storage,x=modules();
 assert.equal(x.SaveCore.load(heroes,provider).blocked,false);
 const initial=clone(JSON.parse(map.get(x.ProgressV3Core.KEY)));
 const args={storageProvider:provider,heroes,exclusive:fn=>fn(),day:"2026-11-18"};
 const rt=Runtime.create({graph,graphCore:Core,pack:Act.pack,scriptData:Scenes,
  sceneCore:Engine,saveModule:Save,storage});
 return {x,map,storage,provider,args,initial,rt,
  failWrite:v=>{writeFails=v;},failRead:v=>{readFails=v;}};
}
function complete(rt,id){
 assert.equal(rt.start(id).ok,true,"start "+id);
 for(let step=0;step<230;step++){
  let v=rt.current();assert.ok(v,"view "+id);
  for(const q of v.inspections)if(!q.done)assert.equal(rt.inspect(q.id).ok,true);
  v=rt.current();
  for(const q of v.comparisons)if(q.ready&&!q.done)assert.equal(rt.compare(q.id).ok,true);
  v=rt.current();
  if(v.choices.length)assert.equal(rt.choose(v.choices[0].id).ok,true);
  else if(v.canContinue)assert.equal(rt.next().ok,true);
  else if(v.canFinish){assert.equal(rt.finish().ok,true);return;}
  else assert.fail("Scene stuck: "+id);
 }
 assert.fail("Nonterminating: "+id);
}
function finishRange(f,start,end){
 for(let n=start;n<=end;n++){
  const node=graph.nodes[n-1];
  complete(f.rt,node.id);
  if(node.requiredBattleId){
   const battle=f.rt.beginRequiredBattle(node.id);
   assert.equal(battle.ok,true,"start battle "+node.id);
   assert.equal(f.rt.recordBattleVictory(node.id,battle.battleId).ok,true);
  }
 }
}
const status=(f,n)=>f.x.LoreActOneRewardCore.statusForAct(n,f.args);
const claim=(f,n)=>f.x.LoreActOneRewardCore.claimForAct(n,f.args);
const wallet=f=>JSON.parse(f.map.get(f.x.ProgressV3Core.KEY));
test("LC-008F: exactly five approved packages and five stable receipts, Act I unchanged",()=>{
 const f=setup(),core=f.x.LoreActOneRewardCore;
 const rows=[
  [1500,180,[5,6,8,1,3,3,0]],
  [2000,230,[5,5,10,1,4,3,1]],
  [3000,280,[8,7,8,2,5,4,1]],
  [4000,350,[8,8,10,2,6,5,2]],
  [5000,460,[9,10,10,2,6,5,2]]
 ];
 const totals={currency:0,xp:0,materials:[0,0,0,0,0,0,0]};
 assert.equal(core.ACTS.length,5);
 for(let n=1;n<=5;n++){
  const src=core.sourceForAct(n),[money,xp,expected]=rows[n-1];
  assert.equal(src.sourceId,"five-shadows-act-"+n);
  assert.equal(src.kind,"first-clear");
  assert.equal(src.energyCost,0);
  assert.equal(src.reward.currency,money);
  assert.equal(src.reward.accountXp,xp);
  assert.deepEqual(["Fe","Le","Cl","Wo","Fa","Th","Gl"].map(key=>src.reward.materials[key]),expected);
  assert.equal(core.ACTS[n-1].receiptId,"first-clear:five-shadows-act-"+n+":once");
  totals.currency+=money;totals.xp+=xp;
  expected.forEach((value,i)=>totals.materials[i]+=value);
 }
 assert.deepEqual(totals,{currency:15500,xp:1500,materials:[35,36,46,8,24,20,6]});
 assert.equal(core.RECEIPT_ID,"first-clear:five-shadows-act-1:once");
 assert.equal(core.SOURCE,core.sourceForAct(1));
 assert.equal(core.sourceForAct(0),null);
 assert.equal(core.sourceForAct(6),null);
 assert.equal(core.sourceForAct("2"),null);
 assert.equal(core.statusForAct(9,f.args),"blocked");
});
test("LC-008F: every chapter unlocks on its own saved finale, claimed receipt survives normal v3 persist",async()=>{
 const f=setup(),c=f.x.LoreActOneRewardCore;
 for(let act=1;act<=5;act++){
  assert.equal(status(f,act),"locked");
  finishRange(f,(act-1)*3+1,act*3);
  assert.equal(status(f,act),"claimable");
  for(let later=act+1;later<=5;later++)assert.equal(status(f,later),"locked");
  const before=wallet(f),result=await claim(f,act);
  assert.equal(result.ok,true,"Act "+act);
  assert.equal(result.receiptId,c.ACTS[act-1].receiptId);
  assert.equal(result.runtime.saveRevision,(before.revision??0)+1);
  assert.equal(result.runtime.currency,before.currency+c.sourceForAct(act).reward.currency);
  assert.equal(result.runtime.accountXp,before.accountXp+c.sourceForAct(act).reward.accountXp);
  assert.equal(wallet(f).energy.value,before.energy.value);
  assert.equal(wallet(f).rewardReceipts.length,act);
  assert.equal(status(f,act),"claimed");
  assert.equal((await claim(f,act)).code,"ALREADY_CLAIMED");
  assert.equal(f.x.SaveCore.save(result.runtime,f.provider),true,"ordinary next wallet save");
  assert.equal(wallet(f).rewardReceipts.length,act,"next write must preserve all receipts");
 }
 assert.equal(wallet(f).currency,f.initial.currency+15500);
 assert.equal(wallet(f).accountXp,f.initial.accountXp+1500);
 for(const [key,n] of Object.entries({Fe:35,Le:36,Cl:46,Wo:8,Fa:24,Th:20,Gl:6}))
  assert.equal(wallet(f).materials[key],f.initial.materials[key]+n);
 assert.equal(status(f,1),"claimed");
});
test("LC-008F: existing 15-node saves can collect five missed rewards in ANY order",async()=>{
 const f=setup();finishRange(f,1,15);
 for(let n=1;n<=5;n++)assert.equal(status(f,n),"claimable");
 const order=[5,3,1,4,2],receipts=new Set();
 for(const n of order){
  const result=await claim(f,n);
  assert.equal(result.ok,true);
  receipts.add(result.receiptId);
  assert.equal(f.x.SaveCore.save(result.runtime,f.provider),true);
 }
 assert.equal(receipts.size,5);
 assert.equal(wallet(f).rewardReceipts.length,5);
 assert.equal(wallet(f).currency,f.initial.currency+15500);
 assert.equal(wallet(f).accountXp,f.initial.accountXp+1500);
 assert.deepEqual(order.map(n=>status(f,n)),["claimed","claimed","claimed","claimed","claimed"]);
 const afterReload=modules().LoreActOneRewardCore;
 for(let n=1;n<=5;n++){
  assert.equal(afterReload.statusForAct(n,f.args),"claimed");
  assert.equal((await afterReload.claimForAct(n,f.args)).code,"ALREADY_CLAIMED");
 }
});
test("LC-008F: missing prior combat proof blocks later acts even if scenes are finished",async()=>{
 const f=setup();finishRange(f,1,15);
 const original=f.map.get(Save.KEY),tampered=clone(JSON.parse(original));
 tampered.stories["five-shadows"].battleClearedNodeIds=
  tampered.stories["five-shadows"].battleClearedNodeIds.filter(n=>n!==id(5));
 assert.equal(Save.validate(tampered,graph,Act.pack,Core,Scenes),true);
 f.map.set(Save.KEY,JSON.stringify(tampered));
 assert.equal(status(f,1),"claimable");
 for(let act=2;act<=5;act++){
  assert.equal(status(f,act),"locked");
  assert.equal((await claim(f,act)).code,"PROOF_NOT_PERSISTED");
 }
 assert.equal(wallet(f).rewardReceipts,undefined);
 f.map.set(Save.KEY,original);
 for(let act=1;act<=5;act++)assert.equal(status(f,act),"claimable");
});
test("LC-008F: corrupt lore/wallet, read denial and invalid act fail closed",async()=>{
 const f=setup();finishRange(f,1,15);
 const lore=f.map.get(Save.KEY),before=f.map.get(f.x.ProgressV3Core.KEY);
 for(const bad of [0,6,-1,"2",NaN]){
  assert.equal((await f.x.LoreActOneRewardCore.claimForAct(bad,f.args)).code,"INVALID_ACT");
 }
 assert.equal(f.map.get(f.x.ProgressV3Core.KEY),before);
 f.map.set(Save.KEY,"{broken");
 for(let n=1;n<=5;n++){
  assert.equal(status(f,n),"locked");
  assert.equal((await claim(f,n)).code,"PROOF_NOT_PERSISTED");
 }
 f.map.set(Save.KEY,lore);
 f.failRead(true);
 assert.equal(status(f,4),"blocked");
 assert.equal((await claim(f,4)).code,"WALLET_READ_FAILED");
 f.failRead(false);
 f.map.set(f.x.ProgressV3Core.KEY,"{broken");
 assert.equal(status(f,4),"blocked");
 assert.equal((await claim(f,4)).code,"INVALID_WALLET");
 assert.equal(f.map.get(Save.KEY),lore);
});
test("LC-008F: failed write never duplicates a payout after fresh reload/retry",async()=>{
 const f=setup();finishRange(f,1,15);
 const before=f.map.get(f.x.ProgressV3Core.KEY),lore=f.map.get(Save.KEY);
 f.failWrite(true);
 assert.equal((await claim(f,5)).code,"SAVE_OUTCOME_UNKNOWN");
 assert.equal(f.map.get(f.x.ProgressV3Core.KEY),before);
 assert.equal(f.map.get(Save.KEY),lore);
 f.failWrite(false);
 const reloaded=modules().LoreActOneRewardCore;
 const result=await reloaded.claimForAct(5,f.args);
 assert.equal(result.ok,true);
 assert.equal(result.receiptId,"first-clear:five-shadows-act-5:once");
 assert.equal((await reloaded.claimForAct(5,f.args)).code,"ALREADY_CLAIMED");
 assert.equal(wallet(f).rewardReceipts.length,1);
 assert.equal(status(f,1),"claimable","failure of one act must not erase other entitlements");
});
test("LC-008F: concurrent claims for SAME act serialize under one exclusive writer",async()=>{
 const f=setup();finishRange(f,1,9);
 let tail=Promise.resolve();
 const serialized={...f.args,exclusive:callback=>{
  const next=tail.then(callback);tail=next.catch(()=>{});return next;
 }};
 const core=f.x.LoreActOneRewardCore;
 const both=await Promise.all([core.claimForAct(3,serialized),core.claimForAct(3,serialized)]);
 assert.equal(both.filter(x=>x.ok).length,1);
 assert.equal(both.filter(x=>x.code==="ALREADY_CLAIMED").length,1);
 assert.equal(wallet(f).rewardReceipts.length,1);
});
