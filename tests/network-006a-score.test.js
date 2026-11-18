"use strict";
/* NET-006A: approved S1 principles, no live rewards, no state migration. */
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const Score=require("../network-score-core.js");
const Core=require("../network-core.js"),Data=require("../network-data.js");
const Adapter=require("../network-encounter-adapter.js");
const Reward=require("../network-reward-core.js");
const Combat=vm.runInNewContext([
 "initiative-model.js","battle-rng.js","combat-status-core.js",
 "ability-data.js","network-score-core.js","combat-core.js"
].map(read).join("\n")+"\nCombatCore");
const clone=x=>JSON.parse(JSON.stringify(x));
const cat=Data.PROPOSAL_CATALOG,unlocked=["gardens-over-abyss"];
const config={id:"net006a-test",capacity:4,intervalMs:1000,
 guaranteeAfter:3,focusWeight:1,masteryScore:3};
const hero=(id="test-hero")=>({id,name:id,side:"ally",hp:5000,atk:999,
 physicalAttack:999,physicalDefense:30,magicDefense:30,speed:950});
function state(approach="quiet"){
 const selected={...cat.templates[0],levels:[1],modifierIds:[]};
 const single=Data.buildCatalog({version:1,regions:cat.regions,templates:[selected]});
 let s=Core.fresh(3456,0,config,single);
 s=Core.accrue(s,4000,single,unlocked);
 const target=s.board[0];
 s=Core.start(s,target.id);
 s=Core.prepare(s,"survey");
 s=Core.approach(s,approach);
 return {s,single,target};
}
function win(b){
 Combat.advanceToPlayerTurn(b);
 for(let i=0;i<60&&b.active;i++){
  if(b.currentActor<0)Combat.advanceToPlayerTurn(b);
  if(!b.active)break;
  const enemy=b.fighters.findIndex(f=>f.side==="enemy"&&f.hp>0);
  assert.ok(enemy>=0);
  assert.ok(Combat.chooseEnemy(b,enemy));
  assert.ok(Combat.performPlayerAbility(b,"basic"));
 }
 assert.equal(b.winner,"ally");
 return b;
}
function memory(){
 const map=new Map();
 return {map,storage:()=>({
  getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,v)
 })};
}
test("S1 score: zero knockouts, unique deaths, tempo by actions and only true victory",()=>{
 assert.equal(Score.stars(59),0);
 assert.equal(Score.stars(60),1);assert.equal(Score.stars(74),1);
 assert.equal(Score.stars(75),2);assert.equal(Score.stars(89),2);
 assert.equal(Score.stars(90),3);assert.equal(Score.stars(100),3);
 const b={active:true,winner:null,allyActions:5,fighters:[
  {id:"a",side:"ally",hp:10},{id:"b",side:"ally",hp:10},
  {id:"e",side:"enemy",hp:10}
 ]};
 assert.equal(Score.attach(b,{first:[{id:"e"}],binding:{wave:0}}),true);
 Score.observe(b,"death","a");Score.observe(b,"death","a");
 Score.observe(b,"death","e");
 b.fighters[2].hp=0;b.active=false;b.winner="ally";
 const s=Score.summarize(b,0);
 assert.ok(s&&Score.validSummary(s));
 assert.equal(s.knockedOut,1,"resurrection cannot erase prior knockout");
 assert.equal(s.deployed,2);assert.equal(s.objectiveDone,true);
 assert.equal(s.score,88,"60+12.5+10+5 rounded");
 assert.equal(Score.stars(s.score),2);
 assert.equal(Score.finalScore([s]),88);
 const slower=clone(s);slower.allyActions=20;slower.score=83;
 assert.ok(Score.validSummary(slower),"no seconds/animation-dependent timing");
 const lost=clone(b);lost.winner="enemy";
 assert.equal(Score.summarize(lost,0),null);
 const forged=clone(b);forged.networkScoreMetrics.enemyDeaths=[];
 assert.equal(Score.summarize(forged,0),null,"missing death evidence");
 const bad=clone(s);bad.score=100;assert.equal(Score.validSummary(bad),false);
});
test("real one-wave combat computes S1 in adapter; legacy scores cannot master S1",()=>{
 const {s,target,single}=state();
 const run=Adapter.startBattle(s,[hero()],{combat:Combat});
 assert.ok(run&&run.battle.networkScoreMetrics);
 assert.equal(Adapter.complete(s,run.battle),null,"unfinished battle rejected");
 win(run.battle);
 let result=Adapter.complete(s,run.battle);
 assert.ok(result);assert.equal(result.active.phase,"result");
 assert.equal(result.active.waveSummaries.length,1);
 assert.equal(result.active.score,result.active.waveSummaries[0].score);
 assert.ok(result.active.score>=90);
 const done=Core.finish(result);
 assert.equal(done.completed.length,1);assert.equal(done.completed[0].kind,"manual");
 assert.ok(done.completed[0].masteryKey?.endsWith("|s1"));
 assert.ok(Core.isMastered(done,target,"quiet"));
 assert.equal(Core.isMastered(done,target,"cordon"),false,
  "different one- and two-wave approaches have separate difficulty");
 assert.equal(Core.isMastered(done,target.templateId,target.level),false,
  "old key cannot accidentally stand in for versioned S1");
 assert.equal(Core.finish(done),null,"no duplicate serials");
 const second=done.board.find(c=>c.templateId===target.templateId);
 const sim=Core.simulate(done,second.id,single,unlocked);
 assert.ok(sim);assert.equal(sim.completed.at(-1).kind,"simulated");
 assert.equal(sim.completed.at(-1).score,0);
 assert.equal(sim.completed.at(-1).masteryKey,done.completed[0].masteryKey);
 assert.deepEqual(sim.mastery,done.mastery,"simulation does not improve mastery");
 assert.equal(Core.simulate(sim,second.id,single,unlocked),null);
 const old=clone(done);old.mastery={[target.templateId+"|"+target.level]:100};
 assert.equal(Core.simulate(old,second.id,single,unlocked),null,
  "legacy mastery cannot unlock simulation");
});
test("two separate fights persist exact S1 checkpoints across reload with no early serial",()=>{
 const {s,single,target}=state("cordon");
 const first=Adapter.startBattle(s,[hero()],{combat:Combat});
 assert.equal(first.battle.totalWaves,1);
 win(first.battle);
 const a=Adapter.complete(s,first.battle);
 assert.ok(a&&a.active.wave===1&&a.active.phase==="battle");
 assert.equal(a.active.waveSummaries.length,1);
 assert.equal(a.completed.length,0,"wave one has no completion");
 const memoryStore=memory();
 let saved=Core.save(a,memoryStore.storage,()=>true);
 assert.equal(saved.ok,true);
 const loaded=Core.load(memoryStore.storage,{config,seed:3456,now:5000,catalog:single});
 assert.equal(loaded.blocked,false);
 assert.deepEqual(loaded.state,saved.state);
 assert.equal(Adapter.complete(loaded.state,first.battle),null,"stale wave binding");
 const second=Adapter.startBattle(loaded.state,[hero()],{combat:Combat});
 assert.ok(second);
 assert.equal(second.plan.binding.wave,1);
 assert.notEqual(first.plan.binding.seed,second.plan.binding.seed);
 const ally=second.battle.fighters.find(f=>f.side==="ally");
 assert.equal(ally.hp,ally.maxHp,"fresh HP for new encounter");
 assert.equal(ally.specialCooldown,0);
 win(second.battle);
 const final=Adapter.complete(loaded.state,second.battle);
 assert.ok(final&&final.active.phase==="result");
 assert.equal(final.active.waveSummaries.length,2);
 assert.equal(final.active.score,Math.round(final.active.waveSummaries.reduce(
  (n,x)=>n+x.score,0)/2));
 assert.equal(Core.validState(final),true);
 saved=Core.save(final,memoryStore.storage,()=>true);
 assert.equal(saved.ok,true);
 const reload=Core.load(memoryStore.storage,{config,seed:3456,now:5000,catalog:single});
 assert.equal(reload.state.active.score,final.active.score);
 assert.equal(reload.state.active.waveSummaries.length,2);
 const complete=Core.finish(reload.state);
 assert.equal(complete.completed.length,1);
 assert.equal(complete.completed[0].clueId,target.id);
 const damaged=clone(final);damaged.active.waveSummaries[0].score=0;
 assert.equal(Core.validState(damaged),false,"checkpoint is internally verified");
});
test("revision, modifier, level, reward variant and corruption invalidate mastery",()=>{
 const {s,target,single}=state();
 const first=Adapter.startBattle(s,[hero()],{combat:Combat});
 win(first.battle);
 const done=Core.finish(Adapter.complete(s,first.battle));
 const clue=done.board[0];
 assert.ok(Core.isMastered(done,clue,"quiet"));
 assert.notEqual(Core.masteryKey(clue,"quiet"),
  Core.masteryKey({...clue,modifierId:"none"},"quiet"),
  "literal modifier 'none' must not alias a missing modifier");
 for(const alteration of [
  {templateRevision:clue.templateRevision+1},{level:clue.level+1},
  {modifierId:clue.modifierId==="rushed"?"reinforced":"rushed"},
  {rewardRef:"other-reward"},{encounterRef:"other-encounter"}
 ]){
  const changed={...clue,...alteration};
  assert.equal(Core.isMastered(done,changed,"quiet"),false,JSON.stringify(alteration));
 }
 const changedCat=clone(single);changedCat.templates[0].revision++;
 assert.equal(Core.simulate(done,clue.id,Data.buildCatalog(changedCat),unlocked),null);
 const stale=clone(done);
 stale.completed[0].masteryKey="bad";
 assert.equal(Core.validState(stale),false);
 assert.equal(Reward.prove({storage:{getItem:()=>JSON.stringify(done)},
  sourceId:done.completed[0].rewardRef,kind:"serial",occurrenceId:"1",count:1}),true);
 const simulated=Core.simulate(done,clue.id,single,unlocked);
 const mem={getItem:()=>JSON.stringify(simulated)};
 assert.equal(Reward.prove({storage:mem,sourceId:clue.rewardRef,
  kind:"serial",occurrenceId:"2",count:1}),true);
 const invalid=clone(simulated);invalid.mastery={};
 assert.equal(Reward.prove({storage:{getItem:()=>JSON.stringify(invalid)},
  sourceId:clue.rewardRef,kind:"serial",occurrenceId:"2",count:1}),false);
});
test("an old one-wave checkpoint can be abandoned without losing its clue",()=>{
 const {s}=state("cordon");
 const c=s.active.clue;
 const old=Core.battleOutcome(s,c.id,0,true);
 assert.ok(old&&Core.validState(old)&&old.active.wave===1);
 assert.equal(old.active.waveSummaries,undefined,
  "NET-005 pilot data did not contain verifiable S1 metrics");
 const restored=Core.abandon(old);
 assert.ok(restored&&restored.board.some(x=>x.id===c.id));
 assert.equal(restored.completed.length,0);
});
test("no network scoring or combat rules change for ordinary battles",()=>{
 const b=Combat.createBattle([hero(),{id:"enemy",side:"enemy",name:"enemy",
  hp:100,atk:1,speed:50}],[]);
 assert.equal(b.networkScoreMetrics,undefined);
 assert.equal(Score.summarize(b,0),null);
 assert.equal(Data.CATALOG.templates.length,0);
 assert.ok(read("network-pilot-session.js").includes("if(!live)return fail"));
 assert.ok(read("network-pilot-session.js").includes("NetworkRewardCore.claim"));
});
