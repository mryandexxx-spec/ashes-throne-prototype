"use strict";
/* NPCPVE003: observation harness for REAL playable hero stats and NPC encounter rules.
 * Estimates are proposed balancing evidence only, never canonical combat difficulty.
 */
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const files=["initiative-model.js","battle-rng.js","combat-status-core.js",
 "ability-data.js","skill-core.js","hero-stats-core.js","hero-stats-profiles.js",
 "hero-stats-combat-bridge.js","combat-core.js","enemy-decision.js","auto-decision.js",
 "npc-enemy-data.js","lore-campaign-data.js","lore-campaign-scenes.js",
 "lore-campaign-pilot.js","lore-campaign-act2.js","lore-campaign-trials.js",
 "npc-story-ops-adapter.js","operation-core.js","signal-operation-core.js"];
const {HeroStatsProfiles:Profiles,HeroStatsCore:Stats,HeroStatsCombatBridge:Bridge,
 CombatCore:Combat,AbilityData:Abilities,AutoDecision:Auto,
 LoreCampaignTrials:Trials,NpcStoryOpsAdapter:Adapter,
 OperationCore:Ops,SignalOperationCore:Signal}=vm.runInNewContext(
 files.map(read).join("\n")+"\n({HeroStatsProfiles,HeroStatsCore,HeroStatsCombatBridge,CombatCore,AbilityData,AutoDecision,LoreCampaignTrials,NpcStoryOpsAdapter,OperationCore,SignalOperationCore})");
const heroes=(ids,level)=>ids.map(id=>({...Bridge.apply(
 {id,name:id,side:"ally",role:id,glyph:"☆"},
 {level,stars:1,gearPercent:{hp:0,atk:0},gearStats:{}},Profiles[id],Stats),
 skillLevels:{basic:1,special:1,powerful:1,passive:1,leader:1}}));
const groups=[
 {id:"duo-L1",ids:["ren","nada"],level:1},
 {id:"duo-L3",ids:["ren","nada"],level:3},
 {id:"full-L1",ids:["ren","nada","liora","art","sava"],level:1},
 {id:"full-L3",ids:["ren","nada","liora","art","sava"],level:3},
 {id:"full-L8",ids:["ren","nada","liora","art","sava"],level:8},
 {id:"support-L3",ids:["ren","nada","liora","art"],level:3}
];
function trial(id){
 const enc=Trials.encounter(id);
 return {node:id,first:Adapter.story(id,enc).first,
  waves:Adapter.story(id,enc).waves,
  objective:Adapter.storyObjective(id,Trials.data.getNode(id).requiredBattleObjective)};
}
function run(squad,first,waves,{seed,strategy="auto",objective=null,targetId=null,
 operation=null,signalId=null,signalRun=null}={}){
 const players=heroes(squad.ids,squad.level);
 const option={leaderId:players[0].id,rngSeed:seed,hitChecks:true,critChecks:true,
  penetrationChecks:true,statusChecks:true,
  ...(objective?{tacticalObjective:objective}:{})};
 const b=Combat.createBattle([...players,...first],waves,option);
 Combat.advanceToPlayerTurn(b);
 let tracker=signalRun?Signal.startTracker(signalRun):null;
 let steps=0,skills=0,skips=0;
 while(b.active&&steps<160){
  if(b.currentActor<0)Combat.advanceToPlayerTurn(b);
  if(!b.active)break;
  const actor=b.fighters[b.currentActor];
  assert.equal(actor.side,"ally");
  let plan=Auto.chooseAction(b);
  assert.ok(plan,"auto decision must be defined");
  if(strategy==="focus"||strategy==="wrong-first"){
   const id=strategy==="wrong-first"&&objective?.kind==="priority-first"&&!b.priorityCleared?
    first.find(f=>f.id!==objective.priorityEnemyId)?.id:targetId;
   const focus=b.fighters.findIndex(f=>f.side==="enemy"&&f.hp>0&&f.id===id);
   const ability=Abilities.get(actor,plan.abilityId);
   // Until FS-04's marked unit dies, a wide strike can kill two
   // simultaneously and fail the objective. Manual player must avoid it.
   if(objective?.kind==="priority-first"&&!b.priorityCleared&&
      (strategy==="focus"||strategy==="wrong-first")&&ability?.target==="all-enemies"){
    plan={abilityId:"basic",targetIndex:focus};
   }else if(focus>=0&&ability?.target==="enemy"){
    plan={...plan,targetIndex:focus};
   }else if(focus<0&&ability?.target==="enemy"){
    const other=b.fighters.findIndex(f=>f.side==="enemy"&&f.hp>0);
    plan={...plan,targetIndex:other};
   }
  }
  if(plan.abilityId!=="basic")skills++;
  assert.equal(Combat.performAutoAction(b,plan),true,"ability must execute for "+operation);
  if(tracker){
   const next=Signal.capture(tracker,Adapter.signalEvents(b.events),tracker.lastSequence+1);
   assert.ok(next,"signal event packet must not corrupt tracker");
   tracker=next;
  }
  steps++;
 }
 assert.equal(b.active,false,"real combat should finish within 160 player actions");
 const alive=b.fighters.filter(f=>f.side==="ally"&&f.hp>0);
 let signalOutcome=null;
 if(signalRun){
  const result=Signal.battleEnded(signalRun,signalRun.runId,b,tracker);
  assert.ok(result,"signal battle outcome should resolve");
  signalOutcome=result.outcome;
 }
 return {win:b.winner==="ally",outcome:b.tacticalOutcome||null,signalOutcome,
  actions:b.allyActions,wave:b.wave,total:b.totalWaves,skills,
  hp:Math.round(alive.reduce((s,f)=>s+f.hp,0)),lost:players.length-alive.length};
}
function summarize(rows,kind){
 const keys=new Map();
 for(const r of rows){
  const key=[r.scenario,r.squad,r.strategy].join("/");
  if(!keys.has(key))keys.set(key,[]);
  keys.get(key).push(r);
 }
 const out=[...keys.entries()].map(([key,items])=>({
  key,count:items.length,wins:items.filter(x=>x.win).length,
  actions:Number((items.reduce((sum,x)=>sum+x.actions,0)/items.length).toFixed(1)),
  losses:items.filter(x=>x.lost>0).length,
  kinds:[...new Set(items.map(x=>x.outcome||x.signalOutcome||"standard"))].sort()
 }));
 console.log("NPCPVE003_"+kind+"_MATRIX="+JSON.stringify(out));
 return out;
}
test("NPCPVE003: real six-story gate outcome matrix with full, small and mid teams",()=>{
 const results=[],seeds=[1,17,71];
 for(const id of Trials.data.catalog().nodes.map(n=>n.id)){
  const t=trial(id);
  for(const squad of groups){
   const must=Trials.data.getNode(id).requiredBattleObjective;
   const required=["ren","nada",...(t.node.endsWith("fs-04")?["sava"]:[]),
     ...(t.node.endsWith("fs-06")?["art"]:[])];
   if(required.some(x=>!squad.ids.includes(x)))continue;
   const targetId=t.node.endsWith("fs-04")?t.objective.priorityEnemyId:
    Adapter.storyId(t.node,t.node.endsWith("fs-03")?"shade":"shade");
   for(const seed of seeds)
    for(const strategy of ["auto","focus"]){
     const result=run(squad,t.first,t.waves,{seed,strategy,
      objective:t.objective,targetId});
     results.push({...result,scenario:id,squad:squad.id,strategy,seed});
    }
  }
 }
 assert.ok(results.length>=130,"sufficient coverage");
 const stats=summarize(results,"FS");
 assert.ok(stats.every(x=>x.actions<100),"bounded actions for all sample battles");
 assert.ok(results.every(x=>x.wave>=1&&x.wave<=x.total));
});
test("NPCPVE003: real OPS-001 route wave matrix and OPS-002 signal-choice matrix",()=>{
 const rows=[],seeds=[1,17,71];
 for(const squad of groups){
  for(const seed of seeds){
   for(const branch of ["one","two"]){
    let r=Ops.start("A","balance-ops1-"+squad.id+"-"+seed+"-"+branch);
    r=branch==="one"?Ops.intercept(Ops.order(Ops.order(r,"register"),"observe"),"north"):
     Ops.intercept(Ops.order(Ops.order(r,"block"),"extract"),"junction");
    const p=Ops.battlePlan(r),enc=Adapter.operation("OPS-001",p);
    for(const strategy of ["auto","focus"]){
     const b=run(squad,enc.first,enc.waves,{seed,strategy,
      targetId:Adapter.operationId("OPS-001","shade"),operation:"OPS-001"});
     const ended=Ops.battleEnded(r,r.runId,{active:false,winner:b.win?"ally":"enemy",wave:b.wave,totalWaves:b.total});
     assert.ok(ended,"OPS-001 should resolve");
     rows.push({...b,scenario:"OPS-001-"+branch,squad:squad.id,strategy,seed});
    }
   }
   for(const signalId of ["ves","shade"]){
    for(const assault of ["quiet","cordon"]){
     const r=Signal.chooseAssault(Signal.prepare(
      Signal.start(signalId,"balance-ops2-"+squad.id+"-"+seed+"-"+assault+"-"+signalId),
      "survey"),assault);
     const enc=Adapter.operation("OPS-002",Signal.battlePlan(r));
     for(const strategy of ["auto","focus"]){
      const b=run(squad,enc.first,enc.waves,{seed,strategy,
       targetId:Adapter.operationId("OPS-002",signalId),
       operation:"OPS-002",signalRun:r});
      rows.push({...b,scenario:"OPS-002-"+assault+"-"+signalId,
       squad:squad.id,strategy,seed});
     }
    }
   }
  }
 }
 assert.equal(rows.length,6*3*(2+4)*2);
 summarize(rows,"OPS");
 assert.ok(rows.every(x=>x.actions<160));
});



test("NPCPVE003: operation-only balance numbers and FS-05 tactical rule unchanged",()=>{
 for(const operation of ["OPS-001","OPS-002"]){
  const one=Adapter.operation(operation,{kind:"singleWave"});
  const two=Adapter.operation(operation,{kind:"twoWaves"});
  assert.deepEqual(Array.from(one.first,x=>[x.hp,x.physicalAttack]),
   [[144,29],[125,35]]);
  assert.deepEqual(Array.from(two.waves[0],x=>[x.hp,x.physicalAttack]),
   [[144,29]]);
  assert.equal(one.waves.length,0);
  assert.equal(two.waves.length,1);
 }
 const brief=Trials.encounter("five-shadows:fs-05").brief;
 assert.match(brief,/4–5 бойцов/);
 assert.equal(Trials.data.getNode("five-shadows:fs-05").requiredBattleObjective.allyActionsToHold,12);
 assert.equal(Adapter.story("five-shadows:fs-05",Trials.encounter("five-shadows:fs-05")).first
  .find(x=>x.id==="npc-fs05-shade").physicalAttack,60);
});
test("NPCPVE003: starter full squad survives harder operations; duo cordon carries risk",()=>{
 const seeds=[1,17,71,103,211],full=groups.find(x=>x.id==="full-L1");
 const duo=groups.find(x=>x.id==="duo-L1");
 for(const op of ["OPS-001","OPS-002"]){
  const scores={full:[],duo:[]};
  for(const team of [full,duo]){
   for(const seed of seeds){
    const plan={kind:"twoWaves"},e=Adapter.operation(op,plan);
    const runId="npcpve003-"+op+"-"+team.id+"-"+seed;
    const context=op==="OPS-002"?{
     signalRun:Signal.chooseAssault(Signal.prepare(
      Signal.start("ves",runId),"survey"),"cordon")}: {};
    const b=run(team,e.first,e.waves,{seed,strategy:"auto",operation:op,...context});
    scores[team===full?"full":"duo"].push(b.win);
   }
  }
  assert.equal(scores.full.filter(Boolean).length,5,"complete squad can finish "+op);
  assert.ok(scores.duo.some(Boolean),"duo has a viable route in "+op);
  assert.ok(scores.duo.some(x=>!x),"duo assault should carry a real risk in "+op);
 }
});
test("NPCPVE003: OPS-002 signal objective still rewards intentional target choice",()=>{
 const full=groups.find(x=>x.id==="full-L1");
 for(const seed of [1,17,71]){
  const runId="npcpve003-signal-"+seed;
  const op=Signal.chooseAssault(Signal.prepare(Signal.start("ves",runId),"survey"),"quiet");
  const enc=Adapter.operation("OPS-002",Signal.battlePlan(op));
  const focus=run(full,enc.first,enc.waves,{seed,strategy:"focus",
   operation:"OPS-002",signalRun:op,targetId:Adapter.operationId("OPS-002","ves")});
  const auto=run(full,enc.first,enc.waves,{seed,strategy:"auto",
   operation:"OPS-002",signalRun:op});
  assert.equal(focus.win,true);
  assert.equal(focus.signalOutcome,"clean");
  assert.equal(auto.win,true);
  assert.equal(auto.signalOutcome,"alerted");
 }
});
