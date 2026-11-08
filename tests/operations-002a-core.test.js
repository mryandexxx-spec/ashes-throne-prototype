"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.join(__dirname,"..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");
const core=require("../signal-operation-core.js");
const other=core.GUARDS;
const spell=ids=>[{type:"ability",actorId:"test-hero",abilityId:"special"},
 ...ids.map(id=>({type:"death",targetId:id}))];
const pick=(run,preparation,assault)=>{
 run=core.prepare(run,preparation);
 assert.equal(run.phase,"assault");
 run=core.chooseAssault(run,assault);
 assert.equal(run.phase,"battle");
 return run;
};
const store=()=>{
 const items=new Map();
 return {items,getItem:key=>items.get(key)??null,
  setItem:(key,value)=>items.set(key,value)};
};
test("OPS-002A only exposes a new isolated contract and no global game entry",()=>{
 assert.equal(core.ID,"OPS-002");
 assert.equal(core.KEY,"ashes-throne.signal-operation.v1");
 assert.equal(core.VERSION,1);
 assert.equal(read("index.html").includes('src="signal-operation-core.js"'),false);
 assert.equal(read("game.js").includes("SignalOperationCore"),false);
 assert.equal(read("operation-core.js").includes("SignalOperationCore"),false);
 assert.equal(read("package.json").includes("node --check signal-operation-core.js"),true);
 for(const id of ["ves","shade"])assert.ok(core.GUARDS.includes(id));
});
test("recon discloses only the earned signal-bearer and never reassigns it",()=>{
 for(const signalId of other){
  let p=core.start(signalId,"recon-"+signalId);
  assert.equal(p.signalId,signalId);
  assert.deepEqual(core.intel(p),{signalId:null,extractionPrepared:false});
  const s=core.prepare(p,"survey");
  assert.deepEqual(core.intel(s),{signalId,extractionPrepared:false});
  const x=core.prepare(p,"extraction");
  assert.deepEqual(core.intel(x),{signalId:null,extractionPrepared:true});
  assert.equal(core.prepare(s,"survey"),null);
  assert.equal(core.chooseAssault(p,"quiet"),null);
  assert.equal(core.prepare(p,"unknown"),null);
  assert.equal(core.chooseAssault(s,"wrong"),null);
  assert.equal(core.chooseAssault(s,"cordon").signalId,signalId);
  assert.equal(p.phase,"prep","earlier state is unchanged");
 }
 assert.equal(core.start("not-an-enemy","wrong"),null);
 assert.equal(core.start("ves",""),null);
 assert.equal(core.start("ves"," ".repeat(6)),null);
});
test("all 48 preparation × assault × bearer × first loss × winner paths",()=>{
 let paths=0;
 for(const preparation of core.PREPARATIONS)
 for(const assault of core.ASSAULTS)
 for(const signalId of other)
 for(const first of ["ves","shade","both"])
 for(const winner of ["ally","enemy"]){
  const id="matrix-"+(++paths);
  let run=pick(core.start(signalId,id),preparation,assault);
  const plan=core.battlePlan(run);
  assert.equal(plan.kind,assault==="quiet"?"singleWave":"twoWaves");
  assert.deepEqual(Array.from(plan.guardIds),["ves","shade"]);
  let tracker=core.startTracker(run);
  const firstDeaths=first==="both"?["ves","shade"]:[first];
  const rest=first==="both"?[]:other.filter(id=>id!==first);
  tracker=core.capture(tracker,spell(firstDeaths),1);
  assert.ok(tracker,id+" accepted first action");
  if(rest.length)tracker=core.capture(tracker,spell(rest),2);
  assert.equal(tracker.firstLoss,first);
  const waves=assault==="quiet"?1:2;
  const finished=core.battleEnded(run,id,{
   active:false,winner,totalWaves:waves,wave:winner==="ally"?waves:1},tracker);
  assert.ok(finished,id+" finished");
  assert.equal(core.validRun(finished),true);
  if(winner==="enemy"){
   assert.equal(finished.phase,"done");
   assert.equal(finished.outcome,"defeat");
   assert.equal(core.summary(finished).signalStopped,false);
   assert.equal(core.finalChoices(finished).length,0);
  }else{
   const expected=assault==="cordon"?"loud":
    first==="both"||first===signalId?"clean":"alerted";
   assert.equal(finished.phase,"final");
   assert.equal(finished.outcome,expected,id+" outcome");
   assert.equal(core.summary(finished),null,"not archived until final decision");
   assert.equal(core.finalChoices(finished).includes("both"),preparation==="extraction");
   const done=core.finish(finished,preparation==="extraction"?"both":"cover");
   assert.equal(core.validRun(done),true);
   assert.equal(done.outcome,expected);
   const summary=core.summary(done);
   assert.equal(summary.signalStopped,expected!=="alerted");
   assert.equal(summary.concealed,expected==="clean");
   assert.equal(summary.coverPreserved,true);
   assert.equal(summary.ledgerSecured,preparation==="extraction");
  }
 }
 assert.equal(paths,48);
});
test("one atomic wide strike suppresses the signal in either event order",()=>{
 for(const signalId of other)
 for(const order of [["ves","shade"],["shade","ves"]]){
  const run=pick(core.start(signalId,"wide-"+signalId+order[0]),"survey","quiet");
  const tracker=core.capture(core.startTracker(run),spell(order),1);
  assert.equal(tracker.firstLoss,"both");
  const done=core.battleEnded(run,run.runId,{
   active:false,winner:"ally",totalWaves:1,wave:1},tracker);
  assert.equal(done.outcome,"clean");
 }
});
test("death batches are atomic, ordered, unique and fail closed",()=>{
 const run=pick(core.start("shade","strict"),"survey","quiet");
 const init=core.startTracker(run);
 const empty=core.capture(init,[{type:"ability",actorId:"x"},
  {type:"heal",targetId:"kael"}],1);
 assert.equal(empty.firstLoss,null);
 assert.equal(empty.lastSequence,1);
 assert.equal(core.capture(empty,spell(["ves"]),1),null,"duplicate sequence");
 assert.equal(core.capture(empty,spell(["ves"]),3),null,"skipped sequence");
 assert.equal(core.capture(empty,[{type:"death",targetId:"ves"}],2),null,"death without ability");
 assert.equal(core.capture(empty,[{type:"ability"},{type:"death",targetId:"ves"},
  {type:"death",targetId:"ves"}],2),null,"duplicate death in action");
 const first=core.capture(empty,[
  {type:"ability"},{type:"death",targetId:"ves"},{type:"ability"},
  {type:"death",targetId:"shade"}],2);
 assert.equal(first.firstLoss,"ves");
 assert.equal(core.capture(first,spell(["shade"]),3),null,"replayed death");
 assert.equal(core.capture(empty,[null],2),null);
 assert.equal(core.capture(empty,[{type:8}],2),null);
 assert.equal(core.capture(empty,"bad",2),null);
 assert.equal(core.capture(empty,spell(["ves"]),1.1),null);
 assert.equal(core.capture({runId:"strict",lastSequence:0,firstLoss:"both",seenDeaths:[]},[],1),null);
 assert.equal(core.battleEnded(run,"wrong",{
  active:false,winner:"ally",totalWaves:1,wave:1},first),null);
 assert.equal(core.battleEnded(run,run.runId,{
  active:true,winner:null,totalWaves:1,wave:1},first),null);
 assert.equal(core.battleEnded(run,run.runId,{
  active:false,winner:"ally",totalWaves:1,wave:1},first).outcome,"alerted");
});
test("real CombatCore single strike and area strike produce compatible ability/death batches",()=>{
 const src=["initiative-model.js","ability-data.js","combat-core.js"].map(read).join("\n");
 const combat=vm.runInNewContext(src+"\nCombatCore");
 const enemy=id=>({id,side:"enemy",name:id,hp:12,atk:1,speed:75});
 const actor=id=>({id,name:"Demo",side:"ally",hp:800,atk:70,speed:270});
 for(const [heroId,attack,firstLoss] of [
  ["test-area-damage","special","both"],
  ["test-standard","basic","ves"]]){
  const run=pick(core.start("shade","real-"+heroId),"survey","quiet");
  let tracker=core.startTracker(run);
  const battle=combat.createBattle([actor(heroId),enemy("ves"),enemy("shade")]);
  combat.advanceToPlayerTurn(battle);
  assert.equal(combat.performPlayerAbility(battle,attack),true);
  tracker=core.capture(tracker,battle.events,1);
  assert.ok(tracker);
  assert.equal(tracker.firstLoss,firstLoss);
  if(battle.active){
   assert.equal(combat.performPlayerAbility(battle,"basic"),true);
   tracker=core.capture(tracker,battle.events,2);
   assert.ok(tracker);
  }
  assert.equal(battle.active,false);
  assert.equal(battle.winner,"ally");
  const finished=core.battleEnded(run,run.runId,battle,tracker);
  assert.ok(finished);
  assert.equal(finished.outcome,attack==="special"?"clean":"alerted");
 }
});
test("defeat and abandonment do not invent rewards, and incomplete wins are rejected",()=>{
 const r=pick(core.start("ves","loss"),"extraction","quiet");
 let t=core.startTracker(r);
 t=core.capture(t,[{type:"ability",actorId:"kael"}],1);
 assert.equal(core.battleEnded(r,r.runId,{
  active:false,winner:"ally",totalWaves:1,wave:1},t),null,
 "victory is impossible if both guards never died");
 assert.equal(core.battleEnded(r,r.runId,{
  active:false,winner:"ally",totalWaves:2,wave:2},t),null,"wrong wave profile");
 const lost=core.battleEnded(r,r.runId,{
  active:false,winner:"enemy",totalWaves:1,wave:1},t);
 assert.equal(lost.outcome,"defeat");
 assert.equal(core.summary(lost).ledgerSecured,false);
 assert.equal(core.finish(lost,"both"),null);
 for(const stage of ["prep","assault","battle"]){
  const fresh=core.start("ves","quit-"+stage);
  const a=stage==="prep"?fresh:core.prepare(fresh,"survey");
  const current=stage==="battle"?core.chooseAssault(a,"cordon"):a;
  const quit=core.abandon(current);
  assert.equal(quit.outcome,"abandoned");
  assert.equal(core.validRun(quit),true);
  assert.equal(core.summary(quit).signalStopped,false);
 }
});
test("state transitions reject stale runs, forged results and cross-run callbacks",()=>{
 let p=core.fresh();
 let r=core.start("ves","one");
 p=core.stage(p,r);assert.equal(p.active.phase,"prep");
 assert.equal(core.stage(p,core.start("shade","other")),null);
 assert.equal(core.stage(p,{...r,phase:"done",preparation:"survey",
  assault:"quiet",battleResult:"enemy",outcome:"defeat"}),null);
 r=core.prepare(r,"survey");p=core.stage(p,r);
 assert.equal(core.stage(p,core.start("ves","one")),null);
 assert.equal(core.stage(p,{...r,phase:"done",assault:"quiet",
  battleResult:"enemy",outcome:"defeat"}),null);
 const preBattle=p;
 r=core.chooseAssault(r,"quiet");p=core.stage(p,r);
 assert.equal(preBattle.active.phase,"assault");
 assert.equal(core.stage(p,{...r,signalId:"shade"}),null);
 assert.equal(core.stage(p,{...r,phase:"final",battleResult:"ally",
  outcome:"clean",firstLoss:"shade"}),null,"incorrect firstLoss/outcome");
 const tracker=core.capture(core.startTracker(r),spell(["ves","shade"]),1);
 const ended=core.battleEnded(r,r.runId,{active:false,winner:"ally",
  totalWaves:1,wave:1},tracker);
 p=core.stage(p,ended);
 assert.equal(p.active.phase,"final");
 assert.equal(core.stage(p,core.abandon(r)),null);
 assert.equal(core.finish(ended,"both"),null);
 const finished=core.finish(ended,"ledger");
 const archived=core.stage(p,finished);
 assert.equal(archived.active,null);
 assert.equal(archived.history.length,1);
 assert.equal(archived.history[0].ledgerSecured,true);
 assert.equal(core.stage(archived,finished),null);
 assert.equal(core.stage(archived,core.start("ves","one")),null);
});
test("independent checkpoint reload, corruption defense and other saves untouched",()=>{
 const db=store(),foreign=["ashes-throne.operations.v1",
  "ashes-throne.progress.v3","ashes-throne.challenges.v1","ashes-throne.campaign.v1"];
 for(const key of foreign)db.setItem(key,"DO NOT MODIFY");
 let p=core.fresh();
 const run=core.start("shade","persistent");
 p=core.stage(p,run);
 const planned=core.prepare(run,"survey");
 p=core.stage(p,planned);
 const fight=core.chooseAssault(planned,"cordon");
 p=core.stage(p,fight);
 assert.equal(core.save(p,()=>db),true);
 assert.equal(db.items.size,foreign.length+1);
 const restored=core.load(()=>db);
 assert.equal(restored.available,true);
 assert.equal(restored.blocked,false);
 assert.deepEqual(restored.progress,p);
 assert.equal(core.battlePlan(restored.progress.active).kind,"twoWaves");
 assert.equal(core.startTracker(restored.progress.active).lastSequence,0,
  "midfight HP/turn is not persisted");
 for(const key of foreign)assert.equal(db.getItem(key),"DO NOT MODIFY");
 const corrupted=db.getItem(core.KEY);
 db.setItem(core.KEY,"{broken json");
 const invalid=core.load(()=>db);
 assert.equal(invalid.blocked,true);
 assert.equal(core.save(core.fresh(),()=>db),false);
 assert.equal(core.save(core.fresh(),()=>db,true),false);
 assert.equal(db.getItem(core.KEY),"{broken json");
 db.setItem(core.KEY,corrupted);
 assert.equal(core.load(()=>db).blocked,false);
 db.setItem(core.KEY,JSON.stringify({version:2,active:null,history:[]}));
 assert.equal(core.load(()=>db).blocked,true);
 assert.equal(core.save(core.fresh(),()=>db),false,"unknown version is preserved");
 assert.equal(core.load(()=>({getItem(){throw Error("denied")}})).blocked,true);
 assert.equal(core.save(p,()=>({getItem(){return null},setItem(){throw Error("full")}})),false);
});
test("history keeps 20 entries and rejects duplicate IDs and forged summaries",()=>{
 let p=core.fresh();
 for(let i=0;i<23;i++){
  const run=core.start(i%2?"ves":"shade","history-"+i);
  p=core.stage(p,run);
  p=core.stage(p,core.abandon(run));
  assert.equal(p.active,null);
 }
 assert.equal(p.history.length,20);
 assert.equal(p.history[0].runId,"history-3");
 assert.equal(core.validProgress({...p,history:[p.history[0],p.history[0]]}),false);
 assert.equal(core.validProgress({...p,history:[{...p.history[0],signalStopped:true},...p.history.slice(1)]}),false);
 assert.equal(core.validProgress({...p,history:[{...p.history[0],unknown:true},...p.history.slice(1)]}),false);
 assert.equal(core.validProgress({...p,history:[{...p.history[0],coverPreserved:true},...p.history.slice(1)]}),false);
 assert.equal(core.validRun({...core.start("ves","test"),invented:"yes"}),false);
 assert.equal(core.validRun({...core.start("ves","test"),phase:"final"}),false);
});
