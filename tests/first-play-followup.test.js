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
