"use strict";
/* NPCCHALLENGE005: 90 seeded T-02/N-02 bouts using real hero stats, AI and kill order. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
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
 return {...Bridge.apply({id,name:id,side:"ally",role:id},
  {level,stars:1,gearPercent:{hp:0,atk:0},gearStats:{}},
  Profiles[id],Stats),skillLevels:{basic:1,special:1,powerful:1,passive:1,leader:1}};
}
function run(id,ids,level,seed,strategy){
 const party=ids.map(x=>hero(x,level));
 const initial=P.spawn(id),future=P.spawnWaves(id),tracker=Q.start(id,P.trackerTargets(id));
 assert.ok(initial&&future&&tracker,"valid opt-in plan and precise tracker");
 const battle=C.createBattle([...party,...initial],future,{
  leaderId:party[0].id,rngSeed:seed,hitChecks:true,critChecks:true,
  penetrationChecks:true,statusChecks:true
 });
 C.advanceToPlayerTurn(battle);
 let steps=0,secondSeen=battle.wave===2;
 while(battle.active&&steps<150){
  if(battle.currentActor<0)C.advanceToPlayerTurn(battle);
  if(!battle.active)break;
  const actor=battle.fighters[battle.currentActor];
  assert.equal(actor.side,"ally");
  const alive=battle.fighters.map((f,i)=>({f,i})).filter(x=>x.f.side==="enemy"&&x.f.hp>0);
  const action=strategy==="auto"?Auto.chooseAction(battle):(()=>{
   const order=id==="T-02"?
    (strategy==="correct"?["npc-trail-interceptor","npc-pass-guard"]:
     ["npc-pass-guard","npc-trail-interceptor"]):
    (strategy==="correct"?["npc-route-signaller","npc-ridge-slinger","npc-field-medic","npc-watch-captain"]:
     ["npc-ridge-slinger","npc-route-signaller","npc-watch-captain","npc-field-medic"]);
   const target=order.map(a=>alive.find(x=>x.f.archetypeId===a)).find(Boolean)||alive[0];
   const strongest=["powerful","special"].find(key=>C.abilityReady(battle,key)&&
    A.get(actor,key)?.kind==="damage"&&
    ["enemy","all-enemies"].includes(A.get(actor,key).target));
   return {abilityId:strongest||"basic",targetIndex:target.i};
  })();
  assert.equal(C.performAutoAction(battle,action),true);
  assert.equal(Q.capture(tracker,battle.events),true);
  secondSeen||=battle.wave===2;
  steps++;
 }
 assert.ok(!battle.active&&steps<150,"no infinite fight");
 const first=tracker.killGroups.find(x=>x.length)?.[0]||null;
 return {id,seed,strategy,level,party:ids.join(","),
  won:battle.winner==="ally",stars:Q.score(id,battle,tracker),
  actions:battle.allyActions,first,secondSeen,wave:battle.wave,
  alliesAlive:battle.fighters.filter(f=>f.side==="ally"&&f.hp>0).length,
  totalWaves:battle.totalWaves};
}
test("NPCCHALLENGE005: legacy T-02/N-02 plans remain inside nineteen distinct opt-in mesh IDs",()=>{
 const t=P.get("T-02"),n=P.get("N-02");
 assert.ok(t&&n&&Object.isFrozen(t)&&Object.isFrozen(n));
 assert.ok(P.get("T-03"));assert.ok(P.get("N-03"));
 assert.equal(P.get("T-01").priorityId,"npc-t01-signaller");
 assert.equal(P.get("N-01").futureWaves[0].length,1);
 assert.equal(t.priorityId,"npc-t02-interceptor");
 assert.deepEqual(Array.from(t.enemyIds,x=>x.archetypeId),
  ["npc-trail-interceptor","npc-pass-guard"]);
 assert.deepEqual(Array.from(P.spawn("T-02"),x=>[x.hp,x.protection]),[[70,6],[78,12]]);
 assert.equal(t.futureWaves.length,0);
 assert.deepEqual(Array.from(n.enemyIds,x=>x.archetypeId),
  ["npc-ridge-slinger","npc-route-signaller"]);
 assert.deepEqual(Array.from(n.futureWaves[0],x=>x.archetypeId),
  ["npc-watch-captain","npc-field-medic"]);
 assert.deepEqual(Array.from(P.spawn("N-02"),x=>[x.hp,x.protection]),[[60,5],[52,4]]);
 assert.deepEqual(Array.from(P.spawnWaves("N-02")[0],x=>[x.hp,x.protection]),[[90,12],[45,4]]);
 assert.ok(Object.isFrozen(n.futureWaves[0]));
 const mobs=P.visuals();
 assert.equal(mobs.length,27);
 const ids=mobs.map(x=>x.id);
 assert.equal(new Set(ids).size,ids.length);
 assert.ok(mobs.every(x=>x.side==="enemy"&&x.speciesId==="human"&&
  x.originRegionId==="gardens-over-abyss"&&x.factionId===null));
 assert.notEqual(P.spawn("N-02")[0],P.spawn("N-02")[0]);
 for(const [id,hp] of [["npc-watch-captain",178],["npc-field-medic",103],
  ["npc-route-signaller",105],["npc-trail-interceptor",96]])
  assert.equal(N.get(id).stats.hp,hp,"original archetype preserved: "+id);
 assert.equal(Q.get("T-02").priorityId,"shade");
 assert.equal(Q.get("N-02").thirdStarActionLimit,null);
 assert.equal(Q.KEY,"ashes-throne.challenges.v1");
 assert.equal(Q.VERSION,1);
});
test("NPCCHALLENGE005: both new trial trackers use real per-wave IDs and legacy scoring",()=>{
 const t=Q.start("T-02",P.trackerTargets("T-02"));
 const n=Q.start("N-02",P.trackerTargets("N-02"));
 assert.ok(t&&n);
 assert.deepEqual(Array.from(t.enemyIds),["npc-t02-interceptor","npc-t02-guard"]);
 assert.equal(t.priorityId,"npc-t02-interceptor");
 assert.deepEqual(Array.from(n.enemyIds),
  ["npc-n02-slinger","npc-n02-signaller","npc-n02-captain","npc-n02-medic"]);
 assert.equal(n.priorityId,null);
 assert.equal(Q.start("T-02",P.trackerTargets("T-01")),null);
 assert.equal(Q.start("N-02",P.trackerTargets("N-01")),null);
 const fight={active:false,winner:"ally",fighters:[
  {id:"ren",side:"ally",hp:100},
  {id:"npc-t02-interceptor",side:"enemy",hp:0},
  {id:"npc-t02-guard",side:"enemy",hp:0}
 ],wave:1,totalWaves:1};
 const score=(first,second,same=false)=>{
  const tracker=Q.start("T-02",P.trackerTargets("T-02"));
  Q.capture(tracker,[{type:"ability",actorId:"ren"},
   {type:"death",targetId:first},...(same?[{type:"death",targetId:second}]:[])]);
  if(!same)Q.capture(tracker,[{type:"ability",actorId:"ren"},
   {type:"death",targetId:second}]);
  return Q.score("T-02",fight,tracker);
 };
 assert.equal(score("npc-t02-interceptor","npc-t02-guard"),3);
 assert.equal(score("npc-t02-guard","npc-t02-interceptor"),1);
 assert.equal(score("npc-t02-interceptor","npc-t02-guard",true),1);
 assert.equal(Q.start("T-02").enemyIds,undefined);
 assert.equal(Q.start("N-02").enemyIds,undefined);
 const normal=Q.start("T-02");
 Q.capture(normal,[{type:"ability",actorId:"ren"},{type:"death",targetId:"shade"}]);
 assert.ok(Q.strictFirst(normal,"shade"),"original T-02 priority remains shade");
 const empty=Q.fresh();
 assert.equal(Q.available("T-02",empty),false);
 assert.equal(Q.available("N-02",empty),false);
 empty.bestStars["T-01"]=1;empty.bestStars["N-01"]=1;
 assert.equal(Q.available("T-02",empty),true);
 assert.equal(Q.available("N-02",empty),true);
});
test("NPCCHALLENGE005: 90 seeded real battles, meaningful priority and two-wave outcome",()=>{
 const cases=[
  {ids:FULL,level:1},{ids:FULL,level:3},
  {ids:["ren","nada","sava"],level:3},
  {ids:["ren","liora","art"],level:3},
  {ids:["ren","nada","liora","art"],level:8}
 ];
 const res=[];
 for(const id of ["T-02","N-02"])for(const c of cases)
  for(const seed of [1,17,71])for(const strategy of ["correct","wrong","auto"])
   res.push(run(id,c.ids,c.level,seed,strategy));
 assert.equal(res.length,90);
 const t=res.filter(x=>x.id==="T-02"),n=res.filter(x=>x.id==="N-02");
 assert.equal(t.filter(x=>x.won).length,45);
 assert.equal(t.filter(x=>x.stars===3).length,30);
 assert.ok(t.filter(x=>x.strategy==="correct")
  .every(x=>x.first==="npc-t02-interceptor"&&x.stars===3));
 assert.ok(t.filter(x=>x.strategy==="wrong")
  .every(x=>x.first==="npc-t02-guard"&&x.stars===1));
 assert.equal(n.filter(x=>x.won).length,45);
 assert.ok(n.every(x=>x.secondSeen&&x.wave===2&&x.totalWaves===2));
 assert.equal(n.filter(x=>x.stars===3).length,0);
 assert.ok(n.filter(x=>x.stars===2).length>=40,
  "early squads must commonly preserve all allies, but loss is possible");
 const report=all=>cases.map(c=>{
  const g=all.filter(x=>x.party===c.ids.join(",")&&x.level===c.level);
  return {squad:c.ids.join(",")+"@L"+c.level,won:g.filter(x=>x.won).length,
   threeStars:g.filter(x=>x.stars===3).length,
   twoStars:g.filter(x=>x.stars===2).length,
   meanActions:Number((g.reduce((a,x)=>a+x.actions,0)/g.length).toFixed(1))};
 });
 console.log("NPCCHALLENGE005_BALANCE="+JSON.stringify({
  tests:res.length,t:report(t),n:report(n),n02NoLoss:n.filter(x=>x.stars===2).length,
  starterT02:t.filter(x=>x.party===FULL.join(",")&&x.level===1)
   .map(x=>({strategy:x.strategy,seed:x.seed,stars:x.stars,actions:x.actions})),
  starterN02:n.filter(x=>x.party===FULL.join(",")&&x.level===1)
   .map(x=>({strategy:x.strategy,seed:x.seed,stars:x.stars,actions:x.actions}))
 }));
});
test("NPCCHALLENGE005: defeated early party cannot erroneously unlock next wave",()=>{
 const party=hero("ren",1);
 const b=C.createBattle([party,...P.spawn("N-02")],P.spawnWaves("N-02"));
 b.fighters.find(x=>x.id==="ren").hp=0;
 C.advanceToPlayerTurn(b);
 assert.equal(b.active,false);
 assert.equal(b.winner,"enemy");
 assert.equal(b.wave,1);
 assert.equal(Q.score("N-02",b,Q.start("N-02",P.trackerTargets("N-02"))),0);
});
test("NPCCHALLENGE005: NPC scores follow the regular persistence path",()=>{
 const game=read("game.js"),html=read("index.html");
 const pkg=JSON.parse(read("package.json"));
 assert.equal(pkg.version,"0.3.172");
 assert.match(html,/v0\.3\.171 · NPCPVE002/);
 assert.match(html,/npc-challenge-pilot\.js\?v=0\.3\.171/);
 assert.match(game,/const NPC_CHALLENGE_PILOT_ENABLED=true;/);
 assert.match(game,/NpcChallengePilot\.get\(activeChallengeId\)/);
 assert.match(game,/NpcChallengePilot\.spawnWaves\(activeChallengeId\)/);
 assert.match(game,/NpcChallengePilot\.trackerTargets\(activeChallengeId\)/);
 assert.doesNotMatch(game,/NPC-пробы T-01…T-04/);
 assert.match(game,/ChallengeCore\.resultEarned\(challengeProgress,activeChallengeId/);
 assert.match(game,/if\(battleIsChallenge&&!state.active&&!challengeResultRecorded\)/);
 assert.match(game,/ChallengeCore\.save\(outcome.candidate,\(\)=>window.localStorage,challengeSaveBlocked\)/);
 assert.match(game,/renderChallengeResult\(\)/);
 assert.match(game,/ChallengeCore\.available\(id,challengeProgress\)/);
});
