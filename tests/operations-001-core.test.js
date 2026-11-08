"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const core=vm.runInNewContext(fs.readFileSync(path.join(__dirname,"..","operation-core.js"),"utf8")+"\nOperationCore");
const json=x=>JSON.parse(JSON.stringify(x));
const fresh=(v="A",id="ops-run-1")=>core.start(v,id);
const order=(r,a)=>{const next=core.order(r,a);assert.ok(next,"Order should be legal: "+a);return next;};
const win=(r)=>core.battleEnded(r,r.runId,{active:false,winner:"ally"});
const lose=(r)=>core.battleEnded(r,r.runId,{active:false,winner:"enemy"});
const choose=(r,target)=>{const next=core.intercept(r,target);assert.ok(next);return next;};
const memory=()=>{
 const map=new Map(),store={getItem:k=>map.has(k)?map.get(k):null,
  setItem:(k,v)=>map.set(k,v)};
 return {map,store};
};
test("OPS-001 starts without rewards or changes to existing modes",()=>{
 const r=fresh();
 assert.equal(r.phase,"order1");
 assert.equal(core.KEY,"ashes-throne.operations.v1");
 assert.deepEqual(Array.from(core.availableOrders(r)),["register","block","extract"]);
 assert.equal(core.intel(r).authenticMark,null);
 assert.equal(core.intel(r).courierMarks,null);
 assert.equal(core.start("unknown","x"),null);
 assert.equal(core.start("A",""),null);
 assert.equal(core.validRun({...r,unknown:true}),false);
});
test("orders are immutable, restricted to their phase, and expose only earned intelligence",()=>{
 const r=fresh(),a=order(r,"register");
 assert.equal(r.phase,"order1");
 assert.deepEqual(Array.from(r.orders),[]);
 assert.equal(a.phase,"order2");
 assert.equal(core.intel(a).authenticMark,"diamond");
 assert.equal(core.intel(a).courierMarks,null);
 assert.equal(core.order(a,"block"),null);
 assert.equal(core.order(a,"register"),null);
 const b=order(a,"observe");
 assert.equal(b.phase,"target");
 assert.deepEqual(json(core.intel(b).courierMarks),{north:"diamond",south:"circle"});
 assert.equal(core.order(b,"extract"),null);
 assert.equal(core.targetAssessment(b,"north"),"confirmed");
 assert.equal(core.targetAssessment(b,"south"),"disproved");
});
test("the blockade catches both couriers but requires two waves",()=>{
 let r=order(fresh(),"block");
 assert.deepEqual(Array.from(core.availableOrders(r)),["register","extract"]);
 assert.equal(core.order(r,"observe"),null);
 r=order(r,"extract");
 assert.equal(core.targetAssessment(r,"north"),null);
 assert.equal(core.targetAssessment(r,"junction"),"guaranteed");
 r=choose(r,"junction");
 assert.equal(core.battlePlan(r).kind,"twoWaves");
 assert.equal(core.battlePlan(r).checkpoint,"restart-battle-before-first-turn");
 r=win(r);
 assert.equal(r.phase,"final");
 assert.deepEqual(Array.from(core.finalChoices(r)),["cover","ledger","leave","both"]);
 const done=core.finish(r,"both");
 assert.equal(done.outcome,"success");
 assert.deepEqual(json(core.summary(done)),{runId:"ops-run-1",variantId:"A",
  outcome:"success",coverPreserved:true,ledgerSecured:true});
 assert.equal(core.finish(done,"both"),null);
});
test("precise intercept succeeds in both variants and no double objective without extraction",()=>{
 for(const v of ["A","B"]){
  let r=order(order(fresh(v,"precise-"+v),"register"),"observe");
  const target=v==="A"?"north":"south";
  assert.equal(core.targetAssessment(r,target),"confirmed");
  assert.equal(core.targetAssessment(r,target==="north"?"south":"north"),"disproved");
  r=choose(r,target);
  assert.equal(core.battlePlan(r).kind,"singleWave");
  r=win(r);
  assert.equal(r.phase,"final");
  assert.equal(core.finish(r,"both"),null);
  r=core.finish(r,"cover");
  assert.equal(r.outcome,"success");
  assert.equal(core.summary(r).coverPreserved,true);
  assert.equal(core.summary(r).ledgerSecured,false);
 }
});
test("winning a wrong fight is an operational failure, not a success",()=>{
 let r=order(order(fresh("B"),"register"),"observe");
 r=choose(r,"north");  // variant B's authentic packet is south
 r=win(r);
 assert.equal(r.phase,"done");
 assert.equal(r.outcome,"wrongTarget");
 assert.equal(core.finalChoices(r).length,0);
 assert.equal(core.summary(r).coverPreserved,false);
 assert.equal(core.finish(r,"cover"),null);
});
test("unconfirmed guesses are permitted but explicitly recognizable before battle",()=>{
 const prep=[
  ["register","extract"],["extract","observe"],["extract","register"]
 ];
 for(const [a,b] of prep){
  let r=order(order(fresh("B",a+"-"+b),a),b);
  assert.equal(core.targetAssessment(r,"south"),"unconfirmed");
  r=choose(r,"south");
  r=win(r);
  assert.equal(r.phase,"final");
  assert.equal(core.finish(r,"both").outcome,"success");
 }
});
test("defeat, incomplete battles, wrong token, abandon and duplicate callbacks",()=>{
 let r=choose(order(order(fresh(),"register"),"observe"),"north");
 assert.equal(core.battleEnded(r,"stale",{active:false,winner:"ally"}),null);
 assert.equal(core.battleEnded(r,r.runId,{active:true,winner:"ally"}),null);
 assert.equal(core.battleEnded(r,r.runId,{active:false,winner:"neutral"}),null);
 const lost=lose(r);
 assert.equal(lost.outcome,"defeat");
 assert.equal(core.battleEnded(lost,lost.runId,{active:false,winner:"ally"}),null);
 assert.equal(core.abandon(r),null); // battle is already committed to the checkpoint
 const waiting=order(fresh(),"register");
 const abandoned=core.abandon(waiting);
 assert.equal(abandoned.outcome,"abandoned");
 assert.equal(core.order(abandoned,"extract"),null);
 assert.equal(core.abandon(abandoned),null);
});
test("each of the six legal preparation paths completes in both configurations",()=>{
 const first=["register","block","extract"];
 for(const variant of ["A","B"]){
  let preparations=0;
  for(const a of first)for(const b of core.availableOrders(order(fresh(variant,"probe"),a))){
   let r=order(order(fresh(variant,"probe-"+a+"-"+b),a),b);
   const target=a==="block"?"junction":(variant==="A"?"north":"south");
   r=choose(r,target);
   r=win(r);
   assert.equal(r.phase,"final");
   const done=core.finish(r,"leave");
   assert.equal(done.outcome,"success");
   preparations++;
  }
  assert.equal(preparations,6);
 }
});
test("persistence stages changes without mutating old state and archives outcome once",()=>{
 let p=core.fresh();
 let r=fresh();
 let next=core.stage(p,r);
 assert.equal(p.active,null);
 assert.equal(next.active.phase,"order1");
 p=next;
 for(const action of ["register","observe"]){
  r=order(r,action);
  p=core.stage(p,r);
  assert.equal(p.active.phase,r.phase);
 }
 r=choose(r,"north");
 p=core.stage(p,r);
 assert.equal(p.active.phase,"battle");
 r=win(r);
 p=core.stage(p,r);
 assert.equal(p.active.phase,"final");
 r=core.finish(r,"ledger");
 p=core.stage(p,r);
 assert.equal(p.active,null);
 assert.equal(p.history.length,1);
 assert.equal(p.history[0].ledgerSecured,true);
 assert.equal(core.stage(p,r),null);
 assert.equal(core.stage(p,fresh("A","ops-run-1")),null);
 assert.ok(core.stage(p,fresh("B","new-run")));
});
test("restart checkpoint and stale finish cannot corrupt another active run",()=>{
 let p=core.fresh(),r=fresh("A","first");
 p=core.stage(p,r);
 r=order(r,"block");p=core.stage(p,r);
 r=order(r,"extract");p=core.stage(p,r);
 r=choose(r,"junction");p=core.stage(p,r);
 const {map,store}=memory();
 assert.equal(core.save(p,()=>store),true);
 const restored=core.load(()=>store);
 assert.equal(restored.blocked,false);
 assert.equal(restored.progress.active.phase,"battle");
 assert.equal(core.battlePlan(restored.progress.active).kind,"twoWaves");
 assert.equal(core.battleEnded(restored.progress.active,"other",{active:false,winner:"ally"}),null);
 assert.equal(core.stage(p,fresh("B","second")),null);
 assert.equal(map.size,1);
});
test("save protects corrupt records and does not modify campaign, challenges or profile",()=>{
 const {map,store}=memory();
 map.set("ashes-throne.progress.v3","old profile");
 map.set("ashes-throne.campaign.v1","old campaign");
 map.set("ashes-throne.challenges.v1","old challenge");
 assert.equal(core.save(core.fresh(),()=>store),true);
 assert.equal(map.size,4);
 assert.equal(map.get("ashes-throne.progress.v3"),"old profile");
 assert.equal(map.get("ashes-throne.campaign.v1"),"old campaign");
 assert.equal(map.get("ashes-throne.challenges.v1"),"old challenge");
 map.set(core.KEY,'{"version":1,"active":{"untrusted":true},"history":[]}');
 assert.equal(core.load(()=>store).blocked,true);
 assert.equal(core.save(core.fresh(),()=>store),false);
 assert.equal(core.save(core.fresh(),()=>store,true),false);
 assert.equal(map.get(core.KEY),'{"version":1,"active":{"untrusted":true},"history":[]}');
 assert.equal(core.load(()=>{throw Error("storage denied");}).blocked,true);
 assert.equal(core.save(core.fresh(),()=>{throw Error("storage denied");}),false);
});
test("unknown IDs, forged progress and invalid summaries never enter storage",()=>{
 let r=fresh();
 assert.equal(core.validRun({...r,phase:"final"}),false);
 assert.equal(core.validRun({...r,orders:["block","observe"],phase:"target"}),false);
 assert.equal(core.validRun({...r,target:"junction"}),false);
 assert.equal(core.stage(core.fresh(),{...r,phase:"battle"}),null);
 const {map,store}=memory();
 assert.equal(core.save({active:null,history:[{bad:true}]},()=>store),false);
 assert.equal(map.size,0);
 const spoiled=core.fresh();spoiled.history.push({runId:"a",variantId:"A",
  outcome:"defeat",coverPreserved:true,ledgerSecured:false});
 assert.equal(core.validProgress(spoiled),false);
});
