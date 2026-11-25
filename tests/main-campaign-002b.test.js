"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const files=["gear-data.js","progress-core.js","star-core.js","skill-core.js","hero-collection-core.js","daily-core.js","login-core.js","progress-v3-core.js","save-core.js","reward-policy-core.js","main-campaign-core.js"];
const {S,V,C,Star}=vm.runInNewContext(files.map(f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8")).join("\n")+"\n({S:SaveCore,V:ProgressV3Core,C:MainCampaignCore,Star:StarCore})");
const heroes=["ren","nada","liora","art","sava"].map(id=>({id,side:"ally"}));
const win={active:false,winner:"ally",allyActions:8,fighters:[{side:"ally",hp:8},{side:"ally",hp:0},{side:"enemy",hp:0}]};
function setup(){
 const rows=new Map();const storage={getItem:k=>rows.get(k)??null,setItem:(k,v)=>rows.set(k,v)};
 const provider=()=>storage;let pending=Promise.resolve();
 const exclusive=fn=>{const next=pending.then(fn);pending=next.catch(()=>{});return next};
 const loaded=S.load(heroes,provider);assert.equal(loaded.blocked,false);
 const args={heroes,storageProvider:provider,exclusive,day:"2026-11-25"};
 const read=()=>S.load(heroes,provider).progress;
 const status=()=>C.statusFor(C.II_ID,provider,read());
 const record=b=>C.recordFor(C.II_ID,{...b,mainCampaignMissionId:C.II_ID},provider,heroes);
 const claim=()=>C.claimFor(C.II_ID,args);
 const open=async()=>{assert.equal(C.record(win,provider).ok,true);assert.equal((await C.claim(args)).ok,true);};
 return {rows,storage,provider,args,read,status,record,claim,open};
}
test("chapter II gated on independent M1 proof and wallet receipt; no early grant",async()=>{
 const x=setup();assert.equal(x.status(),"locked");
 assert.equal(x.record(win).ok,false);assert.equal((await x.claim()).code,"PROOF_NOT_PERSISTED");
 C.record(win,x.provider);assert.equal(x.status(),"locked");
 assert.equal(x.record(win).ok,false);
 assert.equal((await C.claim(x.args)).ok,true);
 assert.equal(x.status(),"ready");assert.equal(Star.rankOf(x.read(),"nada"),0);
 assert.equal(x.record({...win,winner:"enemy"}).earned,0);
 assert.equal(x.record({...win,active:true}).earned,0);
 assert.equal((await x.claim()).code,"PROOF_NOT_PERSISTED");
 assert.equal(C.load(x.provider).best,1);assert.equal(C.proofFor(C.II_ID,x.provider).best,0);
});
test("chapter II one-star win, reload, atomic one-time grant, replay",async()=>{
 const x=setup();await x.open();
 const p=x.read();assert.equal(Star.add(p,"nada",20),true);assert.equal(S.save(p,x.provider),true);
 const before=x.read().currency;
 assert.equal(x.record(win).best,1);assert.equal(x.status(),"claimable");
 const results=await Promise.all([x.claim(),x.claim()]);
 assert.equal(results.filter(z=>z.ok).length,1);
 assert.equal(results.find(z=>!z.ok).code,"ALREADY_CLAIMED");
 const restored=x.read();assert.equal(Star.rankOf(restored,"nada"),1);
 assert.equal(Star.shardsOf(restored,"nada"),20);assert.equal(Star.rankOf(restored,"liora"),0);
 assert.equal(restored.currency,before);
 assert.equal(restored.rewardReceipts.filter(z=>z.id===C.mission(C.II_ID).receipt).length,1);
 assert.equal(x.status(),"claimed");
 assert.equal(x.record({...win,fighters:[{side:"ally",hp:8},{side:"enemy",hp:0}]}).best,3);
 assert.equal((await x.claim()).code,"ALREADY_CLAIMED");assert.equal(C.load(x.provider).best,1);
});
test("chapter II corrupt proof or mismatched mission identity cannot recruit",async()=>{
 const x=setup();await x.open();const key=C.mission(C.II_ID).key;
 x.rows.set(key,JSON.stringify({version:1,missionId:C.ID,best:3}));
 assert.equal(x.status(),"blocked");assert.equal(x.record(win).ok,false);
 assert.equal((await x.claim()).code,"PROOF_NOT_PERSISTED");assert.equal(Star.rankOf(x.read(),"nada"),0);
});
test("chapter II failed proof write and failed wallet write are recoverable",async()=>{
 const x=setup();await x.open();const original=x.storage.setItem;
 x.storage.setItem=()=>{throw Error("quota")};
 assert.equal(x.record(win).ok,false);assert.equal(x.status(),"ready");
 x.storage.setItem=original;assert.equal(x.record(win).ok,true);
 const before=x.rows.get(V.KEY);
 x.storage.setItem=()=>{throw Error("quota")};
 assert.equal((await x.claim()).code,"SAVE_OUTCOME_UNKNOWN");assert.equal(x.rows.get(V.KEY),before);
 x.storage.setItem=original;assert.equal(x.status(),"claimable");assert.equal((await x.claim()).ok,true);
});
test("chapter II already-owned hero retains rank and shards",async()=>{
 const x=setup();await x.open();const p=x.read();
 assert.equal(Star.directGrant(p,"nada"),true);assert.equal(Star.add(p,"nada",40),true);
 assert.ok(Star.promote(p,"nada"));assert.equal(S.save(p,x.provider),true);
 const before=x.read();x.record(win);assert.equal((await x.claim()).ok,true);
 const after=x.read();assert.equal(Star.rankOf(after,"nada"),Star.rankOf(before,"nada"));
 assert.equal(Star.shardsOf(after,"nada"),Star.shardsOf(before,"nada"));
});
test("chapter II ambiguous wallet write recovers exactly once",async()=>{
 const x=setup();await x.open();x.record(win);const real=x.storage.setItem;
 x.storage.setItem=(k,v)=>{real(k,v);if(k===V.KEY)throw Error("committed then threw")};
 assert.equal((await x.claim()).code,"SAVE_OUTCOME_UNKNOWN");
 x.storage.setItem=real;assert.equal(x.status(),"claimed");assert.equal(Star.rankOf(x.read(),"nada"),1);
 assert.equal((await x.claim()).code,"ALREADY_CLAIMED");
});

test("chapter II rejects unbound, foreign, and inconsistent terminal battle states",async()=>{
 const x=setup();await x.open();
 for(const battle of [win,{...win,mainCampaignMissionId:C.ID},{...win,mainCampaignMissionId:"operation-001"},
  {...win,mainCampaignMissionId:C.II_ID,fighters:[{side:"ally",hp:8},{side:"enemy",hp:1}]},
  {...win,mainCampaignMissionId:C.II_ID,fighters:[{side:"ally",hp:8}]}]){
  assert.equal(C.recordFor(C.II_ID,battle,x.provider,x.args.heroes).ok,false);
  assert.equal(x.status(),"ready");
 }
 assert.equal((await x.claim()).code,"PROOF_NOT_PERSISTED");assert.equal(Star.rankOf(x.read(),"nada"),0);
 assert.equal(x.record(win).ok,true);assert.equal((await x.claim()).ok,true);
});
