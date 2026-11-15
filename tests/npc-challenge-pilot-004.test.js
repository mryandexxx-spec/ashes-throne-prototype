"use strict";
/* NPCCHALLENGE004 — real T-01/N-01 event scoring with NPC IDs and two waves. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const refs=vm.runInNewContext([
 "initiative-model.js","battle-rng.js","combat-status-core.js",
 "ability-data.js","skill-core.js","hero-stats-core.js","hero-stats-profiles.js",
 "hero-stats-combat-bridge.js","combat-core.js","enemy-decision.js","auto-decision.js",
 "npc-enemy-data.js","npc-challenge-pilot.js","challenge-core.js"
].map(read).join("\n")+"\n({NpcChallengePilot,NpcEnemyData,ChallengeCore,HeroStatsProfiles,HeroStatsCore,HeroStatsCombatBridge,CombatCore,AbilityData,AutoDecision})");
const {NpcChallengePilot:P,NpcEnemyData:N,ChallengeCore:Q,
 HeroStatsProfiles:Profiles,HeroStatsCore:Stats,HeroStatsCombatBridge:Bridge,
 CombatCore:C,AbilityData:A,AutoDecision:Auto}=refs;
const FULL=["ren","nada","liora","art","sava"];
function hero(id,level=1){
 return {...Bridge.apply({id,name:id,side:"ally",role:id},{
  level,stars:1,gearPercent:{hp:0,atk:0},gearStats:{}
 },Profiles[id],Stats),skillLevels:{basic:1,special:1,powerful:1,passive:1,leader:1}};
}
function simulate(id,ids,level,seed,strategy){
 const party=ids.map(x=>hero(x,level));
 const first=P.spawn(id),future=P.spawnWaves(id),tracker=Q.start(id,P.trackerTargets(id));
 assert.ok(first&&future&&tracker);
 const b=C.createBattle([...party,...first],future,{
  leaderId:party[0].id,rngSeed:seed,hitChecks:true,critChecks:true,
  penetrationChecks:true,statusChecks:true
 });
 C.advanceToPlayerTurn(b);
 let steps=0,visitedSecond=b.wave===2;
 while(b.active&&steps<150){
  if(b.currentActor<0)C.advanceToPlayerTurn(b);
  if(!b.active)break;
  const actor=b.fighters[b.currentActor];
  assert.equal(actor.side,"ally");
  const foes=b.fighters.map((f,i)=>({f,i})).filter(x=>x.f.side==="enemy"&&x.f.hp>0);
  const action=strategy==="auto"?Auto.chooseAction(b):(()=>{
   const priority=id==="T-01"?
    (strategy==="correct"?["npc-route-signaller","npc-trail-interceptor"]:
     ["npc-trail-interceptor","npc-route-signaller"]):
    (strategy==="correct"?["npc-field-medic","npc-pass-guard","npc-ridge-slinger"]:
     ["npc-pass-guard","npc-ridge-slinger","npc-field-medic"]);
   const target=priority.map(a=>foes.find(x=>x.f.archetypeId===a)).find(Boolean)||foes[0];
   const strongest=["powerful","special"].find(key=>C.abilityReady(b,key)&&
    A.get(actor,key)?.kind==="damage"&&
    ["enemy","all-enemies"].includes(A.get(actor,key).target));
   return {abilityId:strongest||"basic",targetIndex:target.i};
  })();
  assert.equal(C.performAutoAction(b,action),true,"combat must accept real ability");
  assert.equal(Q.capture(tracker,b.events),true,"death grouping must accept NPC instance IDs");
  visitedSecond||=b.wave===2;
  steps++;
 }
 assert.ok(!b.active&&steps<150,"combat finishes without an infinite loop");
 const enemies=tracker.killGroups.flat().filter(Boolean);
 return {id,level,seed,strategy,winner:b.winner,
  stars:Q.score(id,b,tracker),actions:b.allyActions,
  alliesAlive:b.fighters.filter(f=>f.side==="ally"&&f.hp>0).length,
  totalWaves:b.totalWaves,wave:b.wave,visitedSecond,
  firstKill:enemies[0]||null,killGroups:tracker.killGroups.filter(g=>g.length)};
}
test("NPCCHALLENGE004: original T-01/N-01 retain five isolated human NPC instances",()=>{
 const t=P.get("T-01"),n=P.get("N-01");
 assert.ok(Object.isFrozen(t)&&Object.isFrozen(n));
 assert.ok(P.get("T-02"),"successor tactical preview exists in separate mode");
 assert.ok(P.get("N-02"),"successor onslaught preview exists in separate mode");
 assert.equal(P.get("invalid"),null);
 assert.equal(t.priorityId,"npc-t01-signaller");
 assert.equal(t.enemyIds.length,2);
 assert.equal(t.futureWaves.length,0);
 assert.equal(n.priorityId,null);
 assert.equal(n.enemyIds.length,2);
 assert.equal(n.futureWaves.length,1);
 assert.equal(n.futureWaves[0].length,1);
 const all=[...P.spawn("T-01"),...P.spawn("N-01"),...P.spawnWaves("N-01").flat()];
 assert.equal(all.length,5);
 assert.equal(new Set(all.map(x=>x.id)).size,5);
 assert.ok(all.every(x=>x.side==="enemy"&&x.speciesId==="human"&&
  x.originRegionId==="gardens-over-abyss"&&x.factionId===null));
 assert.notEqual(P.spawn("T-01")[0],P.spawn("T-01")[0]);
 const visuals=Array.from(P.visuals(),x=>x.id);
 assert.equal(visuals.length,19);
 assert.equal(new Set(visuals).size,11);
 assert.ok(all.every(x=>visuals.includes(x.id)),"original five capsule IDs still reserved");
 assert.equal(N.get("npc-field-medic").stats.hp,103);
 assert.equal(N.get("npc-pass-guard").stats.hp,145);
 assert.equal(Q.get("T-01").priorityId,"ves");
 assert.equal(Q.get("N-01").thirdStarActionLimit,null);
 assert.equal(Q.get("T-02").enemyIds[0],"ves");
 assert.deepEqual(Array.from(Q.all(),x=>x.id),["T-01","T-02","T-03","T-04",
  "N-01","N-02","N-03","N-04"]);
});
test("NPCCHALLENGE004: precise optional tracker validates original mode and concrete enemy IDs",()=>{
 const targets=P.trackerTargets("T-01"),ordinary=Q.start("T-01");
 assert.equal(ordinary.enemyIds,undefined);
 assert.equal(ordinary.priorityId,undefined);
 const good=Q.start("T-01",targets);
 assert.deepEqual(Array.from(good.enemyIds),["npc-t01-signaller","npc-t01-interceptor"]);
 assert.ok(Object.isFrozen(good.enemyIds));
 assert.equal(good.priorityId,"npc-t01-signaller");
 assert.equal(Q.start("T-01",{challengeId:"T-01",enemyIds:["duplicate","duplicate"],priorityId:"duplicate"}),null);
 assert.equal(Q.start("T-01",{challengeId:"T-01",enemyIds:["a","b"],priorityId:"missing"}),null);
 assert.equal(Q.start("T-01",{challengeId:"T-01",enemyIds:["a"],priorityId:"a"}),null);
 assert.equal(Q.start("T-01",{challengeId:"T-01",enemyIds:["a","b"],priorityId:"a",saveVersion:2}),null);
 assert.equal(Q.start("N-01",{challengeId:"N-01",enemyIds:["a","b","c"],priorityId:"a"}),null);
 assert.equal(Q.start("N-01",{challengeId:"N-01",enemyIds:["a","b","c"],priorityId:null})?.id,"N-01");
 assert.equal(Q.start("T-02",P.trackerTargets("T-01")),null,
  "only known scenario targets must be passed for their own challenge ID");
});
test("NPCCHALLENGE004: same kill-order rule, wrong first and simultaneous kill are not 3 stars",()=>{
 const fakeBattle={active:false,winner:"ally",fighters:[
  {id:"ren",side:"ally",hp:120},
  {id:"npc-t01-signaller",side:"enemy",hp:0},
  {id:"npc-t01-interceptor",side:"enemy",hp:0}
 ],wave:1,totalWaves:1,allyActions:8};
 const groups=(first,second,same=false)=>{
  const t=Q.start("T-01",P.trackerTargets("T-01"));
  const events=[{type:"ability",actorId:"ren"},
   {type:"death",targetId:first}];
  if(same)events.push({type:"death",targetId:second});
  Q.capture(t,events);
  if(!same)Q.capture(t,[{type:"ability",actorId:"ren"},{type:"death",targetId:second}]);
  return t;
 };
 assert.equal(Q.score("T-01",fakeBattle,groups("npc-t01-signaller","npc-t01-interceptor")),3);
 assert.equal(Q.score("T-01",fakeBattle,groups("npc-t01-interceptor","npc-t01-signaller")),1);
 assert.equal(Q.score("T-01",fakeBattle,groups("npc-t01-signaller","npc-t01-interceptor",true)),1);
 const legacy=Q.start("T-01");
 Q.capture(legacy,[{type:"ability"},{type:"death",targetId:"ves"}]);
 Q.capture(legacy,[{type:"ability"},{type:"death",targetId:"shade"}]);
 assert.equal(Q.score("T-01",fakeBattle,legacy),3,
  "normal T-01 legacy kill-order rule stays valid");
});
test("NPCCHALLENGE004: 90 real seeded battles preserve tactics, two-wave transitions, no 3 stars for N-01",()=>{
 const groups=[
  {ids:FULL,level:1},{ids:FULL,level:3},
  {ids:["ren","nada","sava"],level:3},
  {ids:["ren","liora","art"],level:3},
  {ids:["ren","nada","liora","art"],level:8}
 ];
 const results=[];
 for(const id of ["T-01","N-01"])for(const group of groups)
  for(const seed of [1,17,71])for(const strategy of ["correct","wrong","auto"])
   results.push({...simulate(id,group.ids,group.level,seed,strategy),
    group:group.ids.join(",")+"@L"+group.level});
 assert.equal(results.length,90);
 const t=results.filter(x=>x.id==="T-01"),n=results.filter(x=>x.id==="N-01");
 assert.equal(t.filter(x=>x.winner==="ally").length,45);
 assert.equal(t.filter(x=>x.stars===3).length,30);
 assert.ok(t.filter(x=>x.strategy==="correct").every(x=>x.firstKill==="npc-t01-signaller"&&x.stars===3));
 assert.ok(t.filter(x=>x.strategy==="wrong").every(x=>x.firstKill==="npc-t01-interceptor"&&x.stars===1));
 assert.equal(n.filter(x=>x.winner==="ally").length,45);
 assert.ok(n.every(x=>x.visitedSecond&&x.wave===2&&x.totalWaves===2));
 assert.ok(n.every(x=>x.stars===2),"N-01 third star is intentionally not configured");
 const groupSum=all=>groups.map(g=>{
  const name=g.ids.join(",")+"@L"+g.level;
  const data=all.filter(x=>x.group===name);
  return {group:name,wins:data.filter(x=>x.winner==="ally").length,
   threeStars:data.filter(x=>x.stars===3).length,
   averageActions:Math.round(data.reduce((n,x)=>n+x.actions,0)/data.length*10)/10};
 });
 console.log("NPCCHALLENGE004_BALANCE="+JSON.stringify({
  cases:results.length,tactical:groupSum(t),onslaught:groupSum(n),
  tacticalStarter:t.filter(x=>x.group===FULL.join(",")+"@L1").map(x=>({
   strategy:x.strategy,seed:x.seed,score:x.stars,actions:x.actions
  }))
 }));
});
test("NPCCHALLENGE004: source isolates opt-in challenge previews and preserves save paths",()=>{
 const js=read("game.js"),html=read("index.html"),pkg=JSON.parse(read("package.json"));
 assert.match(js,/npcChallengePilot=1/);
 assert.match(js,/NPC_CHALLENGE_PILOT_ENABLED&&typeof NpcChallengePilot/);
 assert.match(js,/const COMBAT_VISUALS=HEROES.concat\(NPC_PILOT_VISUALS.filter\(Boolean\),NPC_MISSION_VISUALS,NPC_CHALLENGE_VISUALS\)/);
 assert.match(js,/battleIsNpcChallengePilot=battleIsChallenge&&NPC_CHALLENGE_PILOT_ENABLED/);
 assert.match(js,/NpcChallengePilot\.spawnWaves\(activeChallengeId\)/);
 assert.match(js,/NpcChallengePilot\.trackerTargets\(activeChallengeId\)/);
 assert.match(js,/if\(battleIsChallenge&&!battleIsNpcChallengePilot&&!state.active&&!challengeResultRecorded\)/);
 assert.match(js,/if\(battleIsNpcChallengePilot&&!state.active&&!challengeResultRecorded\)/);
 assert.match(js,/ChallengeCore\.save\(outcome.candidate,\(\)=>window.localStorage,challengeSaveBlocked\)/);
 assert.match(js,/NPC-пробы T-01…T-03 \/ N-01…N-03/);
 assert.match(html,/npc-challenge-pilot\.js\?v=0\.3\.168/);
 assert.match(html,/v0\.3\.169 · NPCCHALLENGE006/);
 assert.equal(pkg.version,"0.3.169");
});
