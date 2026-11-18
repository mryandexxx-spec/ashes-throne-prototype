"use strict";
/* NET-002: synthetic rewards only. No economy numbers are approved here. */
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const names=["gear-data.js","progress-core.js","save-core.js",
 "hero-collection-core.js","star-core.js","progress-v3-core.js",
 "reward-policy-core.js","battle-rng.js","network-data.js","network-core.js",
 "network-reward-core.js"];
const src=names.map(n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8")).join("\n");
const MODULES="\n({SaveCore,StarCore,NetworkCore,NetworkData,RewardPolicyCore,ProgressV3Core,NetworkRewardCore})";
const createModules=()=>vm.runInNewContext(src+MODULES);
const clone=x=>JSON.parse(JSON.stringify(x));
const heroes=["kael","lyra","darin","medic-demo","test-area-damage","ren",
 "nada","liora","art","sava"].map(id=>({id,side:"ally"}));
const DAY="2026-11-18";
const config={id:"net002-test-config",capacity:3,intervalMs:1000,
 guaranteeAfter:3,focusWeight:2,masteryScore:3};
const reward=(extra={})=>({
 sourceId:"synthetic-test-ref",kind:"serial",energyCost:0,
 reward:{currency:7,accountXp:2,materials:{Fe:1},heroShards:{lyra:2}},...extra
});
const makeCatalog=Data=>Data.buildCatalog({
 version:1,regions:[{id:"synthetic-region",name:"Тестовый",unlockRef:null}],
 templates:[{id:"synthetic-template",revision:1,regionId:"synthetic-region",
  type:"supply",weight:1,minInfluence:0,levels:[1],
  preparationIds:["survey"],approaches:[{id:"quiet",waves:1}],
  modifierIds:[],materialId:"Fe",heroId:null,threatTag:null,
  rewardRef:"synthetic-test-ref",encounterRef:"synthetic-encounter"}]
});
function memory(){
 const data=new Map(),calls=[];
 let failure=null,writeAfterFailure=0;
 const store={
  getItem(k){
   calls.push(["get",k]);
   if(failure==="read-wallet"&&k==="ashes-throne.progress.v3")throw Error("read-wallet");
   if(failure==="read-network"&&k==="ashes-throne.network.v1")throw Error("read-network");
   if(failure==="readback-wallet"&&k==="ashes-throne.progress.v3"&&
    writeAfterFailure>0)return "wrong bytes";
   if(failure==="readback-network"&&k==="ashes-throne.network.v1"&&
    writeAfterFailure>0)return "wrong bytes";
   return data.has(k)?data.get(k):null;
  },
  setItem(k,v){
   calls.push(["set",k]);
   if(failure==="readback-wallet"&&k==="ashes-throne.progress.v3"||
      failure==="readback-network"&&k==="ashes-throne.network.v1")
    writeAfterFailure++;
   if(failure==="write-wallet"&&k==="ashes-throne.progress.v3")throw Error("quota");
   if(failure==="write-network"&&k==="ashes-throne.network.v1")throw Error("quota");
   data.set(k,v);
   if(failure==="after-write-wallet"&&k==="ashes-throne.progress.v3")throw Error("uncertain");
   if(failure==="after-write-network"&&k==="ashes-throne.network.v1")throw Error("uncertain");
  }
 };
 return {data,calls,store,provider:()=>store,fail:v=>{failure=v;writeAfterFailure=0;}};
}
function lock(){
 let queue=Promise.resolve();
 return fn=>{const p=queue.then(fn);queue=p.catch(()=>{});return p;};
}
function setup(){
 const m=createModules(),storage=memory(),cat=makeCatalog(m.NetworkData);
 const staged=m.ProgressV3Core.stage(heroes,storage.provider,0);
 assert.ok(["staged","existing"].includes(staged.status));
 let n=m.NetworkCore.fresh(42,0,config,cat);
 n=m.NetworkCore.accrue(n,3000,cat,["synthetic-region"]);
 assert.ok(n&&n.board.length===3);
 return {m,storage,cat,n,exclusive:lock()};
}
function complete(s,howMany=1){
 let n=s.n;
 for(let i=0;i<howMany;i++){
  const clue=n.board[0];
  assert.ok(clue);
  n=s.m.NetworkCore.start(n,clue.id);
  n=s.m.NetworkCore.prepare(n,"survey");
  n=s.m.NetworkCore.approach(n,"quiet");
  n=s.m.NetworkCore.battleOutcome(n,clue.id,0,true,3);
  n=s.m.NetworkCore.finish(n);
  assert.ok(n);
 }
 s.n=n;
 return n;
}
function saveNetwork(s){
 const p=s.m.NetworkCore.save(s.n,s.storage.provider,()=>true);
 assert.equal(p.ok,true);
 s.n=p.state;
 return p.state;
}
const wallet=s=>JSON.parse(s.storage.data.get(s.m.ProgressV3Core.KEY));
const persistedNetwork=s=>JSON.parse(s.storage.data.get(s.m.NetworkCore.KEY));
const claim=(s,serial,source=reward())=>s.m.NetworkRewardCore.claim({
 serial,source,day:DAY,heroes,storageProvider:s.storage.provider,exclusive:s.exclusive
});
const compact=s=>s.m.NetworkRewardCore.compact({
 heroes,storageProvider:s.storage.provider,exclusive:s.exclusive,ownsLock:()=>true
});
test("legacy v3 profile and v1 network remain readable without any ledger fields",()=>{
 const s=setup(),v3=wallet(s);
 assert.equal(v3.networkLedger,undefined);
 assert.ok(s.m.ProgressV3Core.validateActive(v3,heroes));
 assert.ok(s.m.NetworkCore.validState(s.n));
 const legacy=clone(s.n);delete legacy.completedThrough;
 assert.ok(s.m.NetworkCore.validState(legacy));
 assert.equal(s.m.NetworkCore.compactCompleted(legacy,0).completedThrough,0);
 const good=s.m.ProgressV3Core.toRuntime(v3,heroes);
 assert.equal(s.m.ProgressV3Core.fromRuntime(good).networkLedger,undefined);
 const malformed=clone(v3);malformed.networkLedger={claimedThrough:-1};
 assert.equal(s.m.ProgressV3Core.validateActive(malformed,heroes),null);
 malformed.networkLedger={claimedThrough:0,extra:true};
 assert.equal(s.m.ProgressV3Core.validateActive(malformed,heroes),null);
});
test("serial payout is atomic with v3 and does NOT create reward receipts or spend energy",async()=>{
 const s=setup();complete(s);saveNetwork(s);
 const before=wallet(s),netBefore=s.storage.data.get(s.m.NetworkCore.KEY);
 const result=await claim(s,1);
 assert.equal(result.ok,true,JSON.stringify(result));
 assert.equal(result.serial,1);
 assert.ok(result.runtime&&result.runtime.networkLedger.claimedThrough===1);
 const after=wallet(s);
 assert.equal(after.currency,before.currency+7);
 assert.equal(after.accountXp,before.accountXp+2);
 assert.equal(after.materials.Fe,before.materials.Fe+1);
 assert.equal(after.energy.value,before.energy.value);
 assert.equal(after.heroStars.lyra.shards,before.heroStars.lyra.shards+2);
 assert.equal(after.networkLedger.claimedThrough,1);
 assert.equal(after.rewardReceipts,undefined);
 assert.equal(s.storage.data.get(s.m.NetworkCore.KEY),netBefore);
 assert.equal(await claim(s,1).then(x=>x.code),"ALREADY_CLAIMED");
 assert.equal(wallet(s).currency,after.currency);
 const restored=s.m.ProgressV3Core.toRuntime(after,heroes);
 assert.ok(s.m.ProgressV3Core.persist(restored,s.storage.provider));
 assert.equal(wallet(s).networkLedger.claimedThrough,1,"ordinary save cannot erase ledger");
});
test("serials are strictly ordered, idempotent across reload and compact safely",async()=>{
 const s=setup();complete(s,2);saveNetwork(s);
 assert.equal((await claim(s,2)).code,"SERIAL_OUT_OF_ORDER");
 assert.equal((await claim(s,1)).ok,true);
 const again=await claim(s,1);assert.equal(again.code,"ALREADY_CLAIMED");
 assert.equal((await claim(s,2)).ok,true);
 const after=wallet(s);assert.equal(after.networkLedger.claimedThrough,2);
 assert.equal(after.currency,14);
 const compacted=await compact(s);
 assert.equal(compacted.ok,true,JSON.stringify(compacted));
 assert.equal(compacted.pruned,2);
 const net=persistedNetwork(s);
 assert.equal(net.completed.length,0);
 assert.equal(net.completedThrough,2);
 assert.equal(net.nextCompletionId,3);
 assert.equal((await claim(s,1)).code,"ALREADY_CLAIMED");
 assert.equal((await claim(s,2)).code,"ALREADY_CLAIMED");
 assert.equal((await compact(s)).pruned,0,"idempotent compaction");
});
test("compaction preserves unclaimed entries and new serials continue from offset",async()=>{
 const s=setup();complete(s,2);saveNetwork(s);
 await claim(s,1);
 const result=await compact(s);
 assert.equal(result.pruned,1);
 const net=persistedNetwork(s);
 assert.equal(net.completedThrough,1);
 assert.deepEqual(net.completed.map(x=>x.serial),[2]);
 assert.equal((await claim(s,2)).ok,true);
 const more=await compact(s);assert.equal(more.pruned,1);
 const upgraded=persistedNetwork(s);
 assert.equal(s.m.NetworkCore.validState(upgraded),true);
 assert.equal(upgraded.nextCompletionId,3);
});
test("serial proof refuses unpersisted win, wrong reward source, damaged or foreign data",async()=>{
 const s=setup();
 complete(s);
 assert.equal((await claim(s,1)).code,"PROOF_NOT_PERSISTED");
 saveNetwork(s);
 const wrong=reward({sourceId:"another-source"});
 assert.equal((await claim(s,1,wrong)).code,"PROOF_NOT_PERSISTED");
 const pristine=s.storage.data.get(s.m.NetworkCore.KEY);
 s.storage.data.set(s.m.NetworkCore.KEY,"{bad");
 assert.equal((await claim(s,1)).code,"PROOF_NOT_PERSISTED");
 s.storage.data.set(s.m.NetworkCore.KEY,JSON.stringify({...clone(s.n),version:10}));
 assert.equal((await claim(s,1)).code,"PROOF_NOT_PERSISTED");
 s.storage.data.set(s.m.NetworkCore.KEY,pristine);
 assert.equal((await claim(s,1)).ok,true);
 assert.equal(s.m.NetworkRewardCore.prove({
  storage:s.storage.store,sourceId:"synthetic-test-ref",kind:"repeat",
  occurrenceId:"1",count:1}),false);
});
test("defeat, abandon and active battle cannot authorize reward",async()=>{
 for(const mode of ["defeat","abandon","in-battle"]){
  const s=setup();
  let n=s.m.NetworkCore.start(s.n,s.n.board[0].id);
  if(mode==="abandon")n=s.m.NetworkCore.abandon(n);
  else{
   n=s.m.NetworkCore.approach(s.m.NetworkCore.prepare(n,"survey"),"quiet");
   if(mode==="defeat")n=s.m.NetworkCore.battleOutcome(n,n.active.clue.id,0,false);
  }
  s.n=n;saveNetwork(s);
  assert.equal((await claim(s,1)).code,"PROOF_NOT_PERSISTED",mode);
  assert.equal(wallet(s).networkLedger,undefined);
 }
});
test("two concurrent taps serialize and only one claim is paid",async()=>{
 const s=setup();complete(s);saveNetwork(s);
 const [a,b]=await Promise.all([claim(s,1),claim(s,1)]);
 assert.equal([a,b].filter(x=>x.ok).length,1);
 assert.equal([a,b].filter(x=>x.code==="ALREADY_CLAIMED").length,1);
 assert.equal(wallet(s).currency,7);
});
test("shards are constrained by known roster, overflow and unresolved rank 7",async()=>{
 const s=setup();complete(s);saveNetwork(s);
 assert.equal((await claim(s,1,reward({reward:{currency:0,accountXp:0,
  materials:{},heroShards:{"unknown":1}}}))).code,"REWARDS_NOT_CONFIGURED");
 const max=wallet(s);max.heroStars.lyra.rank=7;max.heroStars.lyra.shards=0;
 s.storage.data.set(s.m.ProgressV3Core.KEY,JSON.stringify(max));
 assert.equal((await claim(s,1)).code,"SHARDS_AT_MAX_RANK_UNRESOLVED");
 assert.equal(wallet(s).networkLedger,undefined);
 const atLimit=wallet(s);atLimit.heroStars.lyra.rank=1;
 atLimit.heroStars.lyra.shards=Number.MAX_SAFE_INTEGER;
 s.storage.data.set(s.m.ProgressV3Core.KEY,JSON.stringify(atLimit));
 assert.equal((await claim(s,1)).code,"SHARD_BALANCE_OVERFLOW");
 assert.equal(wallet(s).networkLedger,undefined);
});
test("legacy v3 without heroStars safely acquires stars on shard payout",async()=>{
 const s=setup();complete(s);saveNetwork(s);
 const v3=wallet(s);delete v3.heroStars;delete v3.unlockedHeroes;
 s.storage.data.set(s.m.ProgressV3Core.KEY,JSON.stringify(v3));
 assert.ok(s.m.ProgressV3Core.validateActive(v3,heroes));
 assert.equal((await claim(s,1)).ok,true);
 const after=wallet(s);
 assert.equal(after.heroStars.lyra.rank,1);
 assert.equal(after.heroStars.lyra.shards,2);
 assert.equal(after.networkLedger.claimedThrough,1);
});
test("first-clear receipts stay separate; regular payouts still work after serial",async()=>{
 const s=setup();complete(s);saveNetwork(s);
 assert.equal((await claim(s,1)).ok,true);
 const source={sourceId:"synthetic-first-clear",kind:"first-clear",
  energyCost:0,reward:{currency:10,accountXp:0,materials:{}}};
 const result=await s.m.RewardPolicyCore.claim({
  source,occurrenceId:"once",count:1,day:DAY,heroes,
  storageProvider:s.storage.provider,exclusive:s.exclusive,authorize:()=>true
 });
 assert.equal(result.ok,true);
 assert.equal(wallet(s).networkLedger.claimedThrough,1);
 assert.equal(wallet(s).rewardReceipts.length,1);
 assert.equal(wallet(s).rewardReceipts[0].id,"first-clear:synthetic-first-clear:once");
 assert.equal((await claim(s,1)).code,"ALREADY_CLAIMED");
 assert.equal((await s.m.RewardPolicyCore.claim({
  source,occurrenceId:"once",day:DAY,heroes,
  storageProvider:s.storage.provider,exclusive:s.exclusive,authorize:()=>true
 })).code,"ALREADY_CLAIMED");
});
test("write-denied, ambiguous result, stale wallet and missing lock block safely",async()=>{
 for(const mode of ["write-wallet","after-write-wallet","readback-wallet"]){
  const s=setup();complete(s);saveNetwork(s);
  s.storage.fail(mode);
  const first=await claim(s,1);
  assert.equal(first.code,"SAVE_OUTCOME_UNKNOWN",mode);
  assert.equal(s.m.NetworkRewardCore.isHalted(),true);
  assert.equal((await claim(s,1)).code,"SESSION_HALTED_RELOAD_REQUIRED");
 }
 const s=setup();complete(s);saveNetwork(s);
 assert.equal((await s.m.NetworkRewardCore.claim({
  serial:1,source:reward(),day:DAY,heroes,storageProvider:s.storage.provider,
  exclusive:null})).code,"EXCLUSIVE_LOCK_REQUIRED");
 assert.equal(wallet(s).networkLedger,undefined);
});
test("unknown-result crash recovery uses wallet ledger instead of double-paying",async()=>{
 const s=setup();complete(s);saveNetwork(s);
 s.storage.fail("after-write-wallet");
 assert.equal((await claim(s,1)).code,"SAVE_OUTCOME_UNKNOWN");
 s.storage.fail(null);
 const restart=s.m.NetworkRewardCore; // module remains halted until a reload
 assert.equal(restart.isHalted(),true);
 const other=createModules(); // fresh VM == browser reload
 const result=await other.NetworkRewardCore.claim({
  serial:1,source:reward(),day:DAY,heroes,storageProvider:s.storage.provider,
  exclusive:s.exclusive
 });
 assert.equal(result.code,"ALREADY_CLAIMED");
 assert.equal(wallet(s).currency,7);
});
test("failed compaction never reverses a credited wallet or loses unpaid work",async()=>{
 const s=setup();complete(s,2);saveNetwork(s);
 assert.equal((await claim(s,1)).ok,true);
 const before=wallet(s);
 s.storage.fail("write-network");
 const failed=await compact(s);
 assert.equal(failed.code,"NETWORK_COMPACTION_FAILED");
 assert.equal(wallet(s).networkLedger.claimedThrough,1);
 assert.equal(wallet(s).currency,before.currency);
 assert.equal(persistedNetwork(s).completed.length,2);
 s.storage.fail(null);
 assert.equal(s.m.NetworkRewardCore.isHalted(),true,
  "ambiguous compaction failure must halt until reload");
 const recovered=createModules();
 const recovery=await recovered.NetworkRewardCore.compact({
  heroes,storageProvider:s.storage.provider,exclusive:s.exclusive,ownsLock:()=>true
 });
 assert.equal(recovery.ok,true);
 assert.equal(recovery.pruned,1);
 assert.equal(persistedNetwork(s).completed[0].serial,2);
 assert.equal((await claim(s,2)).ok,true);
});
test("strict legacy and new saves reject forged counters, negative ledger and unknown metadata",()=>{
 const s=setup();complete(s);saveNetwork(s);
 const v3=wallet(s);
 for(const ledger of [{claimedThrough:-1},{claimedThrough:1.5},{claimedThrough:1,evil:1},"1"]){
  assert.equal(s.m.ProgressV3Core.validateActive({...clone(v3),networkLedger:ledger},heroes),null);
 }
 const original=clone(s.n);delete original.completedThrough;
 assert.equal(s.m.NetworkCore.validState(original),true);
 assert.equal(s.m.NetworkCore.compactCompleted(original,1).completedThrough,1);
 assert.equal(s.m.NetworkCore.compactCompleted(original,2),null);
 const broken=clone(s.n);broken.completedThrough=1;
 assert.equal(s.m.NetworkCore.validState(broken),false);
});

test("two tabs with actual ProgressWriterCore Web Lock cannot both pay serial",async()=>{
 const s=setup();complete(s);saveNetwork(s);
 const writer=fs.readFileSync(path.join(__dirname,"..","progress-writer-core.js"),"utf8");
 const browserTab=()=>vm.runInNewContext(src+"\\n"+writer+
  "\\n({NetworkRewardCore,ProgressWriterCore})",{window:{}});
 let owner=false;
 const manager={
  request(name,options,fn){
   if(owner)return Promise.resolve(fn(null));
   owner=true;
   return Promise.resolve(fn({name})).finally(()=>{owner=false;});
  }
 };
 const one=browserTab(),two=browserTab();
 assert.equal((await one.ProgressWriterCore.acquire(manager)).ok,true);
 const blocked=await two.ProgressWriterCore.acquire(manager);
 assert.equal(blocked.ok,false);
 assert.equal(blocked.code,"WALLET_OPEN_IN_ANOTHER_TAB");
 const rejected=await two.NetworkRewardCore.claim({
  serial:1,source:reward(),day:DAY,heroes,storageProvider:s.storage.provider,
  exclusive:two.ProgressWriterCore.exclusive
 });
 assert.equal(rejected.code,"EXCLUSIVE_LOCK_REQUIRED");
 const credited=await one.NetworkRewardCore.claim({
  serial:1,source:reward(),day:DAY,heroes,storageProvider:s.storage.provider,
  exclusive:one.ProgressWriterCore.exclusive
 });
 assert.equal(credited.ok,true);
 one.ProgressWriterCore.release();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal((await two.ProgressWriterCore.acquire(manager)).ok,true);
 const repeat=await two.NetworkRewardCore.claim({
  serial:1,source:reward(),day:DAY,heroes,storageProvider:s.storage.provider,
  exclusive:two.ProgressWriterCore.exclusive
 });
 assert.equal(repeat.code,"ALREADY_CLAIMED");
 two.ProgressWriterCore.release();
 assert.equal(wallet(s).currency,7);
});
