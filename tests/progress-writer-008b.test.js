"use strict";
/* LC-008B: independent simulated tabs + shared Web Lock manager and wallet. */
const test=require("node:test");
const assert=require("node:assert/strict");
const vm=require("node:vm"),fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,"..");
const files=["gear-data.js","progress-core.js","save-core.js","progress-v3-core.js",
 "progress-writer-core.js","reward-policy-core.js"];
const src=files.map(f=>fs.readFileSync(path.join(root,f),"utf8")).join("\n");
const heroes=["kael","lyra","darin","medic-demo","test-area-damage"].map(id=>({id,side:"ally"}));
const copy=x=>JSON.parse(JSON.stringify(x));
function tab(){
 const context={window:{}};
 return vm.runInNewContext(src+"\n({S:SaveCore,V:ProgressV3Core,W:ProgressWriterCore,R:RewardPolicyCore,P:ProgressCore})",context);
}
function fixtures(){
 const map=new Map();let failure=null;
 const storage={
  getItem(k){if(failure==="read")throw Error("read denied");return map.get(k)??null;},
  setItem(k,v){
   if(failure==="write")throw Error("quota");
   map.set(k,v);
   if(failure==="after-write")throw Error("unknown");
  }
 };
 const provider=()=>storage;
 let locked=false;
 const manager={request(name,options,fn){
  assert.equal(name,"ashes-throne.progress.v3.writer");
  assert.equal(options.mode,"exclusive");
  assert.equal(options.ifAvailable,true);
  const lock=locked?null:{name};
  if(lock)locked=true;
  return Promise.resolve().then(()=>fn(lock)).finally(()=>{if(lock)locked=false;});
 }};
 return {map,storage,provider,manager,fail:x=>{failure=x;},isLocked:()=>locked};
}
const reward={sourceId:"five-shadows-act-1",kind:"first-clear",
 reward:{currency:37,accountXp:5,materials:{Fe:2}},energyCost:0};
const claimArgs=(t,f)=>({source:reward,occurrenceId:"once",day:"2026-11-18",
 heroes,storageProvider:f.provider,exclusive:t.W.exclusive,
 authorize:({storage})=>storage.getItem("persisted-proof")==="yes"});

test("two competing tabs: second cannot stage/save, then acquires and reloads fresh state",async()=>{
 const f=fixtures(),a=tab(),b=tab();
 assert.equal((await a.W.acquire(f.manager)).ok,true);
 assert.equal(f.isLocked(),true);
 const initial=a.S.load(heroes,f.provider);assert.equal(initial.blocked,false);
 const p=initial.progress;p.currency+=11;
 assert.equal(a.S.save(p,f.provider),true);
 assert.equal((await b.W.acquire(f.manager)).code,"WALLET_OPEN_IN_ANOTHER_TAB");
 const denied=b.S.load(heroes,f.provider);
 assert.equal(denied.blocked,true);
 assert.equal(denied.reason,"wallet-writer-lock-required");
 assert.equal(b.S.save(copy(p),f.provider),false);
 assert.equal(JSON.parse(f.map.get(a.V.KEY)).currency,11);
 a.W.release();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.isLocked(),false);
 assert.equal((await b.W.acquire(f.manager)).ok,true);
 const latest=b.S.load(heroes,f.provider);
 assert.equal(latest.progress.currency,11);
 latest.progress.currency+=4;
 assert.equal(b.S.save(latest.progress,f.provider),true);
 assert.equal(JSON.parse(f.map.get(b.V.KEY)).currency,15);
 b.W.release();
});

test("energy charges cannot lose the other tab's debit, stale writer cannot save",async()=>{
 const f=fixtures(),a=tab(),b=tab(),mission="black-pass-ambush";
 const cost=a.P.missionEnergyCost(mission);
 assert.ok(cost>0);
 await a.W.acquire(f.manager);
 const pa=a.S.load(heroes,f.provider).progress;
 const stale=b.V.toRuntime(JSON.parse(f.map.get(a.V.KEY)),heroes);
 assert.equal(a.P.spendEnergy(pa,mission,1),true);
 assert.equal(a.S.save(pa,f.provider),true);
 assert.equal(b.S.save(stale,f.provider),false,"non-owner cannot overwrite energy");
 a.W.release();
 await new Promise(resolve=>setImmediate(resolve));
 await b.W.acquire(f.manager);
 const pb=b.S.load(heroes,f.provider).progress;
 assert.equal(pb.energy.value,a.P.ENERGY_MAX-cost);
 assert.equal(b.P.spendEnergy(pb,mission,1),true);
 assert.equal(b.S.save(pb,f.provider),true);
 assert.equal(JSON.parse(f.map.get(b.V.KEY)).energy.value,a.P.ENERGY_MAX-2*cost);
 b.W.release();
});

test("a receipt claimed in one tab cannot be paid again by the next owner",async()=>{
 const f=fixtures(),a=tab(),b=tab();
 f.map.set("persisted-proof","yes");
 await a.W.acquire(f.manager);a.S.load(heroes,f.provider);
 const claimA=await a.R.claim(claimArgs(a,f));
 assert.equal(claimA.ok,true);
 a.W.release();
 await new Promise(resolve=>setImmediate(resolve));
 await b.W.acquire(f.manager);
 const claimB=await b.R.claim(claimArgs(b,f));
 assert.equal(claimB.code,"ALREADY_CLAIMED");
 assert.equal(JSON.parse(f.map.get(b.V.KEY)).rewardReceipts.length,1);
 assert.equal(JSON.parse(f.map.get(b.V.KEY)).currency,37);
 b.W.release();
});

test("Web Locks absent or rejected: no initialization, no destructive migration",async()=>{
 const f=fixtures(),t=tab();
 assert.equal((await t.W.acquire(null)).code,"WEB_LOCKS_UNAVAILABLE");
 assert.equal(t.S.load(heroes,f.provider).blocked,true);
 assert.equal(f.map.size,0);
 const bad={request(){throw Error("unavailable");}};
 assert.equal((await t.W.acquire(bad)).code,"WEB_LOCKS_FAILED");
 assert.equal(f.map.size,0);
});

test("async exclusive claim serializes double-click, blocks sync wallet writes during proof",async()=>{
 const f=fixtures(),t=tab();
 await t.W.acquire(f.manager);
 const p=t.S.load(heroes,f.provider).progress;
 f.map.set("persisted-proof","yes");
 let unblock;
 const barrier=new Promise(resolve=>{unblock=resolve;});
 const one=t.R.claim({...claimArgs(t,f),authorize:async args=>{
  assert.equal(args.storage.getItem("persisted-proof"),"yes");
  await barrier;return true;
 }});
 // Let the first callback reach the awaited durable proof.
 await new Promise(resolve=>setImmediate(resolve));
 p.currency=99;
 assert.equal(t.S.save(p,f.provider),false,"no synchronous save in mid-claim");
 unblock();
 const two=t.R.claim(claimArgs(t,f));
 const results=await Promise.all([one,two]);
 assert.equal(results.filter(r=>r.ok).length,1);
 assert.equal(results.filter(r=>r.code==="ALREADY_CLAIMED").length,1);
 const saved=JSON.parse(f.map.get(t.V.KEY));
 assert.equal(saved.currency,37);
 assert.equal(saved.rewardReceipts.length,1);
 const latest=t.S.load(heroes,f.provider);
 assert.equal(latest.progress.currency,37);
 t.W.release();
});

test("failed setItem keeps old wallet; retry works; ambiguous commit requires reload",async()=>{
 const f=fixtures(),t=tab();await t.W.acquire(f.manager);
 const p=t.S.load(heroes,f.provider).progress;
 const before=f.map.get(t.V.KEY);
 p.currency+=6;f.fail("write");
 assert.equal(t.S.save(p,f.provider),false);
 assert.equal(f.map.get(t.V.KEY),before);
 f.fail(null);assert.equal(t.S.save(p,f.provider),true);
 assert.equal(JSON.parse(f.map.get(t.V.KEY)).currency,6);
 p.currency+=3;f.fail("after-write");
 assert.equal(t.S.save(p,f.provider),false);
 f.fail(null);
 assert.equal(t.S.save(p,f.provider),false,"stale revision cannot replay unknown write");
 const restored=t.S.load(heroes,f.provider);
 assert.equal(restored.progress.currency,9);
 assert.equal(t.S.save(restored.progress,f.provider),true);
 t.W.release();
});

test("legacy v2, older v3 without receipts, corrupt storage and same-tab lock release",async()=>{
 const f=fixtures(),t=tab();
 f.map.set("ashes-throne.progress.v2",JSON.stringify({version:2,
  currency:17,accountXp:5,levels:Object.fromEntries(heroes.map(h=>[h.id,1])),
  claimedMissions:[]}));
 await t.W.acquire(f.manager);
 const migrated=t.S.load(heroes,f.provider);
 assert.equal(migrated.blocked,false);
 assert.equal(migrated.progress.currency,17);
 assert.equal(migrated.progress.rewardReceipts,undefined);
 assert.equal(t.S.save(migrated.progress,f.provider),true);
 const latest=JSON.parse(f.map.get(t.V.KEY));
 assert.equal(latest.currency,17);
 assert.equal(latest.rewardReceipts,undefined);
 f.map.set(t.V.KEY,"{broken");
 assert.equal(t.S.load(heroes,f.provider).blocked,true);
 assert.equal(f.map.get(t.V.KEY),"{broken","bad wallet never overwritten");
 t.W.release();
 assert.equal(t.W.canPersist(),false);
 assert.equal(t.S.save(migrated.progress,f.provider),false);
});

test("only one direct v3 writer is present in live game; gating precedes game init",()=>{
 const game=fs.readFileSync(path.join(root,"game.js"),"utf8");
 const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
 const persist=fs.readFileSync(path.join(root,"progress-v3-core.js"),"utf8");
 assert.match(game,/storageAdapter\.save\(progress/);
 assert.doesNotMatch(game,/setItem\(\s*["']ashes-throne\.progress\.v3/);
 assert.match(persist,/ProgressWriterCore\.canPersist\(\)/);
 assert.ok(html.indexOf('src="progress-writer-core.js')<html.indexOf('src="game.js'));
 for(const name of ["game.js","hero-card-ui.js","gear-ux-004.js"])
  assert.match(html,new RegExp(name.replace(/\./g,"\\.")+'\\?v=[0-9.]+" type="text/progress-gated"'));
});
