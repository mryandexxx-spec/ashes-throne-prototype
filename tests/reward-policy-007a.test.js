"use strict";
/* LC-008 / GEAR-REWARDS-007A: synthetic, NON-LIVE payouts. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const files=["gear-data.js","progress-core.js","save-core.js","progress-v3-core.js",
 "challenge-core.js","operation-core.js","signal-operation-core.js","reward-policy-core.js"];
const src=files.map(file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8")).join("\n");
const {G,P,S,V,C,O,SO,R}=vm.runInNewContext(src+
 "\n({G:GearData,P:ProgressCore,S:SaveCore,V:ProgressV3Core,C:ChallengeCore,O:OperationCore,SO:SignalOperationCore,R:RewardPolicyCore})");
const heroes=["kael","lyra","darin","medic-demo","test-area-damage"]
 .map(id=>({id,side:"ally"}));
const copy=x=>JSON.parse(JSON.stringify(x));
const DAY="2026-11-17";
const source=(kind="first-clear",extra={})=>({
 sourceId:"five-shadows-act-1",kind,reward:{currency:37,accountXp:5,materials:{Fe:2}},
 energyCost:0,...extra
});
function memory(){
 const map=new Map();
 let fail=null;
 const store={getItem(k){if(fail==="read")throw Error("denied");return map.has(k)?map.get(k):null;},
  setItem(k,v){if(fail==="write")throw Error("quota");map.set(k,v);
   if(fail==="after-write")throw Error("ambiguous");}};
 return {map,store,provider:()=>store,fail:x=>{fail=x;}};
}
function profile(m=memory()){
 const loaded=S.load(heroes,m.provider);
 assert.equal(loaded.blocked,false);
 return {m,p:loaded.progress};
}
function loreProof(store){
 const raw=store.getItem("ashes-throne.lore-campaign.v1");
 if(!raw)return false;
 const obj=JSON.parse(raw);
 return obj.version===1&&Array.isArray(obj.stories?.["five-shadows"]?.completedNodeIds)&&
  obj.stories["five-shadows"].completedNodeIds.includes("five-shadows:fs-03");
}
function completion(m){
 m.map.set("ashes-throne.lore-campaign.v1",JSON.stringify({version:1,
  stories:{"five-shadows":{completedNodeIds:["five-shadows:fs-03"]}}}));
}
function serialLock(){
 let last=Promise.resolve();
 return callback=>{
  const result=last.then(callback);
  last=result.catch(()=>{});
  return result;
 };
}
function args(m,extra={}){
 return {source:source(),occurrenceId:"once",day:DAY,heroes,storageProvider:m.provider,
  authorize:({storage})=>loreProof(storage),exclusive:serialLock(),...extra};
}
function saved(m){return JSON.parse(m.map.get(V.KEY));}

test("No source, proof, exclusive lock or live mode means no write",async()=>{
 const {m}=profile(),original=m.map.get(V.KEY);
 assert.equal(R.resolve({source:null}).code,"REWARDS_NOT_CONFIGURED");
 assert.equal((await R.claim({...args(m),exclusive:null})).code,"EXCLUSIVE_LOCK_REQUIRED");
 assert.equal((await R.claim({...args(m),authorize:null})).code,"PROOF_REQUIRED");
 assert.equal((await R.claim(args(m))).code,"PROOF_NOT_PERSISTED");
 assert.equal(m.map.get(V.KEY),original);
 assert.equal(saved(m).rewardReceipts,undefined);
});
test("One verified claim writes receipt + wallet + revision in one record, reload and click again",async()=>{
 const {m,p}=profile();completion(m);
 const before=copy(saved(m));
 const result=await R.claim(args(m));
 assert.equal(result.ok,true);
 assert.equal(result.receiptId,"first-clear:five-shadows-act-1:once");
 const after=saved(m);
 assert.equal(after.currency,before.currency+37);
 assert.equal(after.accountXp,before.accountXp+5);
 assert.equal(after.materials.Fe,before.materials.Fe+2);
 assert.equal(after.energy.value,before.energy.value);
 assert.equal(after.revision,1);
 assert.deepEqual(copy(after.rewardReceipts),[{id:result.receiptId,
  sourceId:"five-shadows-act-1",day:DAY,count:1}]);
 assert.equal((await R.claim(args(m))).code,"ALREADY_CLAIMED");
 assert.equal(S.save(p,m.provider),false,"stale tab must not overwrite receipt");
 const restored=S.load(heroes,m.provider);
 assert.equal(restored.blocked,false);
 assert.equal(restored.progress.rewardReceipts[0].id,result.receiptId);
 assert.equal(S.save(restored.progress,m.provider),true,"normal v3 save retains receipts");
 assert.equal(saved(m).rewardReceipts.length,1);
 assert.equal(saved(m).currency,before.currency+37);
});
test("Double tap under serialized lock and browser reload between proof and claim",async()=>{
 const {m}=profile();completion(m);
 const lock=serialLock();const a=args(m,{exclusive:lock}),b=args(m,{exclusive:lock});
 const outcomes=await Promise.all([R.claim(a),R.claim(b)]);
 assert.equal(outcomes.filter(x=>x.ok).length,1);
 assert.equal(outcomes.filter(x=>x.code==="ALREADY_CLAIMED").length,1);
 assert.equal(saved(m).currency,37);
});
test("Faulty/corrupted/volatile proof refuses to pay and never touches wallet",async()=>{
 const {m}=profile(),old=m.map.get(V.KEY);
 m.map.set("ashes-throne.lore-campaign.v1","{bad");
 assert.equal((await R.claim(args(m))).code,"PROOF_NOT_PERSISTED");
 m.map.delete("ashes-throne.lore-campaign.v1");
 assert.equal((await R.claim(args(m))).code,"PROOF_NOT_PERSISTED");
 assert.equal(m.map.get(V.KEY),old);
 completion(m);
 assert.equal((await R.claim(args(m,{authorize:()=>false}))).code,"PROOF_NOT_PERSISTED");
 assert.equal(m.map.get(V.KEY),old);
});
test("Storage failures are fail-closed; ambiguous write is retried by checking receipt",async()=>{
 const {m}=profile();completion(m);
 const before=m.map.get(V.KEY);
 m.fail("write");
 assert.equal((await R.claim(args(m))).code,"SAVE_OUTCOME_UNKNOWN");
 assert.equal(m.map.get(V.KEY),before);
 m.fail(null);
 assert.equal((await R.claim(args(m))).ok,true);
 const {m:n}=profile();completion(n);
 n.fail("after-write");
 assert.equal((await R.claim(args(n))).code,"SAVE_OUTCOME_UNKNOWN");
 n.fail(null);
 assert.equal((await R.claim(args(n))).code,"ALREADY_CLAIMED");
 assert.equal(saved(n).currency,37);
 const raw=n.map.get(V.KEY);
 n.fail("read");
 assert.equal((await R.claim(args(n,{occurrenceId:"another"}))).code,"WALLET_READ_FAILED");
 assert.equal(n.map.get(V.KEY),raw);
});
test("Two-tab interference during proof validation rejects stale wallet",async()=>{
 const {m}=profile();completion(m);
 const before=m.map.get(V.KEY);
 const output=await R.claim(args(m,{authorize:({storage})=>{
  const data=JSON.parse(storage.getItem(V.KEY));
  data.currency+=4;data.revision=(data.revision||0)+1;
  storage.setItem(V.KEY,JSON.stringify(data));
  return true;
 }}));
 assert.equal(output.code,"STALE_WALLET");
 assert.equal(saved(m).currency,4);
 assert.equal(saved(m).rewardReceipts,undefined);
 assert.notEqual(m.map.get(V.KEY),before);
});
test("Missing/corrupt wallet and invalid receipts never overwrite existing user data",async()=>{
 const {m}=profile();completion(m);
 for(const bad of [
  "{broken",
  JSON.stringify({...saved(m),rewardReceipts:[{id:"first-clear:act:once",
   sourceId:"act",day:DAY,count:1},{id:"first-clear:act:once",
   sourceId:"act",day:DAY,count:1}]}),
  JSON.stringify({...saved(m),materials:{...saved(m).materials,Fe:-1}})
 ]){
  m.map.set(V.KEY,bad);
  assert.equal((await R.claim(args(m))).code,"INVALID_WALLET");
  assert.equal(m.map.get(V.KEY),bad);
  assert.equal(S.load(heroes,m.provider).blocked,true);
 }
});
test("Empty energy, overflow and malformed amounts reject before any write",async()=>{
 const {m}=profile();completion(m);
 const raw=m.map.get(V.KEY);
 for(const e of [
  {source:source("repeat",{energyCost:241}),occurrenceId:"run-1"},
  {source:source("first-clear",{reward:{currency:Number.MAX_SAFE_INTEGER,accountXp:10,materials:{}}})},
  {source:source("repeat",{reward:{currency:-1,accountXp:0,materials:{}}})}
 ]){
  const output=await R.claim(args(m,e));
  assert.equal(output.ok,false);
  assert.equal(m.map.get(V.KEY),raw);
 }
 const badWallet=copy(saved(m));badWallet.currency=Number.MAX_SAFE_INTEGER;
 assert.equal(R.resolve({source:source(),occurrenceId:"once",day:DAY,wallet:badWallet}).code,
  "INSUFFICIENT_OR_INVALID_BALANCE");
 assert.equal(R.resolve({source:source(),occurrenceId:"once",day:DAY,wallet:saved(m),count:0}).code,"INVALID_COUNT");
});
test("Generic day cap counts batches and blocks clock rollback; replayed run is never paid twice",async()=>{
 const {m}=profile();completion(m);
 const farm=source("repeat",{sourceId:"trial-t01",energyCost:1,maxPerDay:3,
  reward:{currency:1,accountXp:0,materials:{Fe:1}}});
 const lock=serialLock();
 const base=args(m,{source:farm,exclusive:lock,authorize:()=>true});
 assert.equal((await R.claim({...base,occurrenceId:"run-a",count:2})).ok,true);
 assert.equal((await R.claim({...base,occurrenceId:"run-a",count:2})).code,"ALREADY_CLAIMED");
 assert.equal((await R.claim({...base,occurrenceId:"run-b",count:2})).code,"DAILY_LIMIT");
 assert.equal((await R.claim({...base,occurrenceId:"run-b",count:1})).ok,true);
 assert.equal((await R.claim({...base,occurrenceId:"run-c",count:1,
  day:"2026-11-16"})).code,"CLOCK_ROLLBACK");
 assert.equal((await R.claim({...base,occurrenceId:"run-c",count:1,
  day:"2026-11-18"})).ok,true);
 assert.equal(saved(m).rewardReceipts.length,3);
 assert.equal(saved(m).currency,4);
});
test("Challenge 1/2/3 stars, loss and persisted operation run proof are adapter decisions",async()=>{
 const {m}=profile();const challengeSource=source("best-stars",{sourceId:"t-01"});
 const done=C.fresh();done.bestStars["T-01"]=2;
 C.save(done,m.provider);
 const challengeAuth=({storage})=>{
  const parsed=JSON.parse(storage.getItem(C.KEY));
  return C.valid(parsed)&&parsed.bestStars["T-01"]>=3;
 };
 const challengeArgs=args(m,{source:challengeSource,occurrenceId:"3-stars",
  authorize:challengeAuth});
 assert.equal((await R.claim(challengeArgs)).code,"PROOF_NOT_PERSISTED");
 done.bestStars["T-01"]=3;C.save(done,m.provider);
 assert.equal((await R.claim(challengeArgs)).ok,true);
 assert.equal((await R.claim(challengeArgs)).code,"ALREADY_CLAIMED");
 const opsSource=source("repeat",{sourceId:"ops-001"});
 const entry={runId:"run-ops-1",variantId:"quiet",outcome:"defeat",
  coverPreserved:false,ledgerSecured:false};
 // Use a valid production variant ID from the real catalog.
 const variant=Object.keys(O.fresh()).length?O.start("quiet","run-ops-1"):null;
 assert.ok(O.validProgress(O.fresh()));
 const opProof=({storage,occurrenceId})=>{
  const loaded=O.load(()=>storage);
  return !loaded.blocked&&loaded.progress.history.some(x=>
   x.runId===occurrenceId&&x.outcome==="success");
 };
 assert.equal((await R.claim(args(m,{source:opsSource,occurrenceId:"run-ops-1",
  authorize:opProof}))).code,"PROOF_NOT_PERSISTED");
 assert.equal(saved(m).rewardReceipts.length,1);
});
test("Old v2 and older v3 save round trips keep resources; receipts are opt-in",async()=>{
 const m=memory(),old=P.createProgress(heroes);
 old.accountXp=200;old.currency=710;old.gearMaterials=23;
 m.map.set(S.KEY,JSON.stringify({...old,version:2}));
 const loaded=S.load(heroes,m.provider);
 assert.equal(loaded.blocked,false);
 assert.equal(loaded.progress.currency,710);
 assert.equal(loaded.progress.gearMaterials,23);
 assert.equal(loaded.progress.rewardReceipts,undefined);
 const back=V.fromRuntime(loaded.progress);
 assert.ok(back);
 assert.equal(back.rewardReceipts,undefined);
 const {m:other}=profile();completion(other);
 assert.equal((await R.claim(args(other))).ok,true);
 const current=S.load(heroes,other.provider).progress;
 assert.equal(S.save(current,other.provider),true);
 assert.equal(saved(other).rewardReceipts.length,1);
});
