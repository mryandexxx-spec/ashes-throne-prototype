"use strict";
/* LC-008D: live Act I payout tested against saved story and wallet, not UI fixtures. */
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const Core=require("../lore-campaign-core.js"),Scenes=require("../lore-campaign-scenes.js");
const Engine=require("../lore-campaign-scene-core.js"),Save=require("../lore-campaign-scene-save.js");
const Runtime=require("../lore-campaign-scene-runtime.js"),Act=require("../lore-campaign-act5.js");
const graph=Act.data.catalog(),nodeId=n=>"five-shadows:fs-"+String(n).padStart(2,"0");
const heroes=["kael","lyra","darin","medic-demo","test-area-damage"].map(id=>({id,side:"ally"}));
function modules(){
 const names=["gear-data.js","progress-core.js","save-core.js","progress-v3-core.js",
  "lore-reward-proof-core.js","reward-policy-core.js","lore-act1-reward-core.js"];
 const code=names.map(p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8")).join("\n");
 return vm.runInNewContext(code+"\n({SaveCore,ProgressV3Core,LoreActOneRewardCore})",{
  LoreCampaignAct5:Act,LoreCampaignCore:Core,LoreCampaignSceneSave:Save,LoreCampaignScenes:Scenes
 });
}
function fixture(){
 const map=new Map();let failWrite=false,failRead=false;
 const storage={
  getItem:k=>{if(failRead&&k==="ashes-throne.progress.v3")throw Error("read blocked");return map.get(k)??null;},
  setItem:(k,v)=>{if(failWrite&&k==="ashes-throne.progress.v3")throw Error("quota");map.set(k,String(v));}
 };
 const x=modules(),provider=()=>storage;
 assert.equal(x.SaveCore.load(heroes,provider).blocked,false);
 const wallet=JSON.parse(map.get(x.ProgressV3Core.KEY));
 return {x,storage,map,provider,wallet,failWrite:v=>{failWrite=v;},failRead:v=>{failRead=v;}};
}
function finishScene(rt,id){
 assert.equal(rt.start(id).ok,true);
 for(let step=0;step<200;step++){
  let v=rt.current();
  for(const q of v.inspections)if(!q.done)assert.equal(rt.inspect(q.id).ok,true);
  v=rt.current();
  for(const q of v.comparisons)if(q.ready&&!q.done)assert.equal(rt.compare(q.id).ok,true);
  v=rt.current();
  if(v.choices.length)assert.equal(rt.choose(v.choices[0].id).ok,true);
  else if(v.canContinue)assert.equal(rt.next().ok,true);
  else if(v.canFinish){assert.equal(rt.finish().ok,true);return;}
  else assert.fail("Scene stalled "+id);
 }
 assert.fail("Scene did not end "+id);
}
function firstAct(storage,{skipBattle=null}={}){
 const rt=Runtime.create({graph,graphCore:Core,pack:Act.pack,
  scriptData:Scenes,sceneCore:Engine,saveModule:Save,storage});
 for(let n=1;n<=3;n++){
  const node=graph.nodes[n-1];finishScene(rt,node.id);
  if(node.requiredBattleId&&node.id!==skipBattle){
   const b=rt.beginRequiredBattle(node.id);
   assert.equal(b.ok,true);
   assert.equal(rt.recordBattleVictory(node.id,b.battleId).ok,true);
  }
 }
 return rt;
}
const args=(f,exclusive=fn=>fn())=>({storageProvider:f.provider,heroes,exclusive,day:"2026-11-18"});
test("LC-008D: only first act is enabled with the approved package",()=>{
 const {x}=fixture(),c=x.LoreActOneRewardCore;
 assert.equal(c.SOURCE.sourceId,"five-shadows-act-1");
 assert.equal(c.RECEIPT_ID,"first-clear:five-shadows-act-1:once");
 assert.equal(c.SOURCE.energyCost,0);
 assert.equal(c.SOURCE.reward.currency,1500);
 assert.equal(c.SOURCE.reward.accountXp,180);
 for(const [id,n] of Object.entries({Fe:5,Le:6,Cl:8,Wo:1,Fa:3,Th:3,Gl:0}))
  assert.equal(c.SOURCE.reward.materials[id],n);
 const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
 assert.ok(html.includes('lore-act1-reward-core.js?v='+require("../package.json").version+'" type="text/progress-gated"'));
 assert.equal(html.includes("lore-act2-reward-core.js"),false);
});
test("LC-008D: incomplete act or missing required battle cannot earn a receipt",async()=>{
 const f=fixture(),c=f.x.LoreActOneRewardCore;
 const before=f.map.get(f.x.ProgressV3Core.KEY);
 assert.equal(c.status(args(f)),"locked");
 assert.equal((await c.claim(args(f))).code,"PROOF_NOT_PERSISTED");
 firstAct(f.storage,{skipBattle:nodeId(3)});
 assert.equal(c.status(args(f)),"locked");
 assert.equal((await c.claim(args(f))).code,"PROOF_NOT_PERSISTED");
 assert.equal(f.map.get(f.x.ProgressV3Core.KEY),before);
});
test("LC-008D: persisted first clear pays once; subsequent normal save keeps receipt",async()=>{
 const f=fixture(),c=f.x.LoreActOneRewardCore;firstAct(f.storage);
 assert.equal(c.status(args(f)),"claimable");
 const result=await c.claim(args(f));
 assert.equal(result.ok,true);assert.equal(result.receiptId,c.RECEIPT_ID);
 assert.equal(result.runtime.saveRevision,(f.wallet.revision??0)+1);
 assert.equal(result.runtime.currency,f.wallet.currency+1500);
 assert.equal(result.runtime.accountXp,f.wallet.accountXp+180);
 const saved=JSON.parse(f.map.get(f.x.ProgressV3Core.KEY));
 assert.equal(saved.energy.value,f.wallet.energy.value);
 assert.equal(saved.rewardReceipts.length,1);
 for(const [id,n] of Object.entries(c.SOURCE.reward.materials))
  assert.equal(saved.materials[id],f.wallet.materials[id]+n);
 assert.equal((await c.claim(args(f))).code,"ALREADY_CLAIMED");
 assert.equal(f.x.SaveCore.save(result.runtime,f.provider),true,"ordinary save must use new revision");
 assert.equal(JSON.parse(f.map.get(f.x.ProgressV3Core.KEY)).rewardReceipts.length,1);
 assert.equal(c.status(args(f)),"claimed");
 f.map.delete(Save.KEY);assert.equal(c.status(args(f)),"claimed","receipt remains durable");
});
test("LC-008D: concurrent taps plus reload grant only once",async()=>{
 const f=fixture(),c=f.x.LoreActOneRewardCore;firstAct(f.storage);
 let tail=Promise.resolve();const exclusive=fn=>{const next=tail.then(fn);tail=next.catch(()=>{});return next;};
 const both=await Promise.all([c.claim(args(f,exclusive)),c.claim(args(f,exclusive))]);
 assert.equal(both.filter(x=>x.ok).length,1);
 assert.equal(both.filter(x=>x.code==="ALREADY_CLAIMED").length,1);
 assert.equal(modules().LoreActOneRewardCore.status(args(f)),"claimed");
 assert.equal(JSON.parse(f.map.get(f.x.ProgressV3Core.KEY)).rewardReceipts.length,1);
});
test("LC-008D: failed v3 write can retry after reload, same stable receipt",async()=>{
 const f=fixture(),c=f.x.LoreActOneRewardCore;firstAct(f.storage);
 const old=f.map.get(f.x.ProgressV3Core.KEY),story=f.map.get(Save.KEY);
 f.failWrite(true);
 assert.equal((await c.claim(args(f))).code,"SAVE_OUTCOME_UNKNOWN");
 assert.equal(f.map.get(f.x.ProgressV3Core.KEY),old);
 assert.equal(f.map.get(Save.KEY),story);
 f.failWrite(false);
 const next=await modules().LoreActOneRewardCore.claim(args(f));
 assert.equal(next.ok,true);assert.equal(next.receiptId,c.RECEIPT_ID);
 assert.equal(JSON.parse(f.map.get(f.x.ProgressV3Core.KEY)).currency,f.wallet.currency+1500);
});
test("LC-008D: corrupted lore/wallet and denied reads fail closed",async()=>{
 const f=fixture(),c=f.x.LoreActOneRewardCore;firstAct(f.storage);
 const original=f.map.get(Save.KEY),wallet=f.map.get(f.x.ProgressV3Core.KEY);
 f.map.set(Save.KEY,"{bad");
 assert.equal(c.status(args(f)),"locked");
 assert.equal((await c.claim(args(f))).code,"PROOF_NOT_PERSISTED");
 assert.equal(f.map.get(f.x.ProgressV3Core.KEY),wallet);
 f.map.set(Save.KEY,original);f.failRead(true);
 assert.equal(c.status(args(f)),"blocked");
 assert.equal((await c.claim(args(f))).code,"WALLET_READ_FAILED");
 f.failRead(false);f.map.set(f.x.ProgressV3Core.KEY,"{bad");
 assert.equal(c.status(args(f)),"blocked");
 assert.equal((await c.claim(args(f))).code,"INVALID_WALLET");
 assert.equal(f.map.get(Save.KEY),original);
});
