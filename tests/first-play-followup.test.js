const test=require("node:test");
const assert=require("node:assert/strict");
const Core=require("../first-play-core.js");
const won=Core.finish(Core.start(Core.prepare(Core.fresh())),true);
const done=Core.complete(won);
const empty={active:null,history:[]};
test("P0-D: only a completed victory reveals the next task",()=>{
 for(const phase of [Core.fresh(),Core.prepare(Core.fresh()),Core.start(Core.prepare(Core.fresh())),won,Core.skip(Core.fresh()),Core.finish(Core.start(Core.prepare(Core.fresh())),false)])
  assert.equal(Core.followUp(phase,empty,true),null);
 assert.equal(Core.followUp(done,empty,true),"available");
 assert.equal(Core.followUp(Core.complete(Core.finish(Core.start(Core.choose(Core.fresh(),"cover")),true)),empty,true),"available");
});
test("P0-D: real OPS checkpoint resumes, ledger success removes suggestion; failure cannot",()=>{
 assert.equal(Core.followUp(done,{active:{phase:"order2"},history:[]},true),"resume");
 assert.equal(Core.followUp(done,{active:null,history:[{outcome:"defeat",ledgerSecured:false}]},true),"available");
 assert.equal(Core.followUp(done,{active:null,history:[{outcome:"success",ledgerSecured:false}]},true),"available");
 assert.equal(Core.followUp(done,{active:null,history:[{outcome:"success",ledgerSecured:true}]},true),null);
 assert.equal(Core.followUp(done,empty,false),"unavailable");
 assert.equal(Core.followUp(done,null,true),"unavailable");
});

const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
function rewardFixture(){
 const ctx=vm.createContext({});
 for(const file of ["progress-core.js","progress-v3-core.js","reward-policy-core.js","first-play-core.js"])
  vm.runInContext(fs.readFileSync(path.join(__dirname,"..",file),"utf8"),ctx,{filename:file});
 const {first,wallet,policy,rules}=vm.runInContext("({first:FirstPlayCore,wallet:ProgressV3Core,policy:RewardPolicyCore,rules:ProgressCore})",ctx);
 const heroes=["ren","nada","liora","art","sava"].map(id=>({id,side:"ally"}));
 const data=new Map([[wallet.KEY,JSON.stringify(wallet.fresh(heroes,0))]]);
 let rejectWrite=false;
 const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>{
  if(rejectWrite&&key===wallet.KEY)throw Error("quota");
  data.set(key,value);
 }};
 let queue=Promise.resolve();
 const exclusive=fn=>{const next=queue.then(fn);queue=next.catch(()=>{});return next;};
 const claim=()=>first.claimReward({storageProvider:()=>storage,heroes,exclusive,day:"2026-11-24"});
 const setCheckpoint=state=>first.save(state,()=>storage);
 const read=()=>JSON.parse(storage.getItem(wallet.KEY));
 return {first,wallet,rules,heroes,claim,setCheckpoint,read,storage,reject:()=>rejectWrite=true};
}
test("P1-A: real reward policy verifies completed victory, no reward for skip or defeat",async()=>{
 const f=rewardFixture(),first=f.first;
 const battle=first.start(first.prepare(first.fresh()));
 for(const checkpoint of [first.fresh(),battle,first.finish(battle,false),first.finish(battle,true),first.skip(first.fresh())]){
  f.setCheckpoint(checkpoint);
  assert.equal((await f.claim()).code,"PROOF_NOT_PERSISTED");
  assert.equal(f.read().currency,0);
 }
 f.storage.setItem(first.KEY,"invalid json");
 assert.equal((await f.claim()).code,"PROOF_NOT_PERSISTED");
});
test("P1-A: one atomic receipt, simultaneous claims, reload and real level affordability",async()=>{
 const f=rewardFixture(),first=f.first;
 const victory=first.complete(first.finish(first.start(first.prepare(first.fresh())),true));
 f.setCheckpoint(victory);
 const results=await Promise.all([f.claim(),f.claim()]);
 assert.equal(results.filter(x=>x.ok).length,1);
 assert.equal(results.filter(x=>x.code==="ALREADY_CLAIMED").length,1);
 const p=f.read(),runtime=f.wallet.toRuntime(p,f.heroes);
 assert.equal(p.currency,40);assert.equal(p.accountXp,0);
 assert.equal(p.rewardReceipts.length,1);assert.equal(p.rewardReceipts[0].id,first.REWARD_RECEIPT);
 assert.equal(first.rewardStatus(victory,runtime,true),"claimed");
 assert.equal(f.rules.upgradePlan(runtime,"ren",1).levels,1);
 const purchase=f.rules.upgradeMany(runtime,"ren",1);
 assert.equal(purchase.to,2);assert.equal(purchase.cost,39);
 assert.equal(f.wallet.persist(runtime,()=>f.storage),true);
 assert.equal(f.read().heroes.ren.level,2);assert.equal(f.read().currency,1);
 assert.equal((await f.claim()).code,"ALREADY_CLAIMED");assert.equal(f.read().currency,1);
});
test("P1-A: failure to write wallet cannot create receipt or credit",async()=>{
 const f=rewardFixture(),first=f.first;
 const victory=first.complete(first.finish(first.start(first.prepare(first.fresh())),true));
 f.setCheckpoint(victory);f.reject();
 assert.equal((await f.claim()).code,"SAVE_OUTCOME_UNKNOWN");
 assert.equal(f.read().currency,0);assert.equal(f.read().rewardReceipts,undefined);
});
