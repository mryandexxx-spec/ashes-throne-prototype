"use strict";
/* NPCCHALLENGE006: two new pilot-only objectives, no ChallengeCore migration. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const refs=vm.runInNewContext([
 "initiative-model.js","battle-rng.js","combat-status-core.js",
 "ability-data.js","skill-core.js","hero-stats-core.js","hero-stats-profiles.js",
 "hero-stats-combat-bridge.js","combat-core.js","enemy-decision.js","auto-decision.js",
 "npc-enemy-data.js","challenge-core.js","npc-challenge-pilot.js"
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
 const first=P.spawn(id),future=P.spawnWaves(id),tracker=Q.start(id,P.trackerTargets(id));
 assert.ok(first&&future&&tracker,"valid two-pronged opt-in pilot");
 const b=C.createBattle([...party,...first],future,{
  leaderId:party[0].id,rngSeed:seed,hitChecks:true,critChecks:true,
  penetrationChecks:true,statusChecks:true
 });
 C.advanceToPlayerTurn(b);
 let steps=0,thirdSeen=b.wave===3;
 while(b.active&&steps<150){
  if(b.currentActor<0)C.advanceToPlayerTurn(b);
  if(!b.active)break;
  const actor=b.fighters[b.currentActor];
  assert.equal(actor.side,"ally");
  const enemies=b.fighters.map((f,i)=>({f,i}))
   .filter(x=>x.f.side==="enemy"&&x.f.hp>0);
  const choice=strategy==="auto"?Auto.chooseAction(b):(()=>{
   const order=id==="T-03"?
    (strategy==="good"?["npc-ridge-slinger","npc-pass-guard","npc-field-medic"]:
     ["npc-field-medic","npc-ridge-slinger","npc-pass-guard"]):
    (strategy==="good"?["npc-ridge-slinger","npc-pass-guard","npc-field-medic","npc-route-signaller","npc-watch-captain"]:
     ["npc-pass-guard","npc-ridge-slinger","npc-route-signaller","npc-field-medic","npc-watch-captain"]);
   const target=order.map(t=>enemies.find(e=>e.f.archetypeId===t)).find(Boolean)||enemies[0];
   const skill=["powerful","special"].find(key=>C.abilityReady(b,key)&&
    A.get(actor,key)?.kind==="damage"&&
    ["enemy","all-enemies"].includes(A.get(actor,key).target));
   return {abilityId:skill||"basic",targetIndex:target.i};
  })();
  assert.equal(C.performAutoAction(b,choice),true);
  assert.equal(Q.capture(tracker,b.events),true);
  thirdSeen||=b.wave===3;
  steps++;
 }
 assert.ok(!b.active&&steps<150,"combat completes");
 const groups=tracker.killGroups.filter(g=>g.length),hp=P.healthPercent(b);
 return {id,seed,strategy,team:ids.join(",")+"@L"+level,
  win:b.winner==="ally",stars:P.score(id,b,tracker),actions:b.allyActions,
  firstKill:groups[0]?.[0]||null,lastKill:groups.at(-1)?.[0]||null,
  lastGroupSize:groups.at(-1)?.length||0,
  wave:b.wave,total:b.totalWaves,thirdSeen,hp:hp?.percent,
  allAlive:b.fighters.filter(f=>f.side==="ally").every(f=>f.hp>0)};
}
test("NPCCHALLENGE006: opt-in plans add three+five distinct human NPCs, preserve base v1",()=>{
 const t=P.get("T-03"),n=P.get("N-03");
 assert.ok(t&&n&&Object.isFrozen(t)&&Object.isFrozen(n));
 assert.ok(P.get("T-04"));assert.ok(P.get("N-04"));
 assert.equal(t.objective.kind,"priority-last-solo");
 assert.equal(t.priorityId,"npc-t03-medic");
 assert.deepEqual(Array.from(t.enemyIds,x=>x.archetypeId),
  ["npc-ridge-slinger","npc-pass-guard","npc-field-medic"]);
 assert.deepEqual(Array.from(P.spawn("T-03"),x=>[x.hp,x.protection]),
  [[65,6],[85,14],[55,5]]);
 assert.equal(n.objective.kind,"final-team-hp");
 assert.equal(n.objective.minimumHealthPercent,95);
 assert.deepEqual(Array.from(P.spawn("N-03"),x=>[x.hp,x.protection]),[[56,5],[67,9]]);
 assert.deepEqual(Array.from(P.spawnWaves("N-03").flat(),x=>[x.hp,x.protection]),
  [[42,3],[43,4],[92,13]]);
 assert.deepEqual(Array.from(n.futureWaves,x=>x.length),[2,1]);
 assert.ok(Object.isFrozen(n.futureWaves[0])&&Object.isFrozen(n.objective));
 assert.equal(P.spawn("T-03").length,3);
 assert.equal(P.spawnWaves("T-03").length,0);
 const all=P.visuals();
 assert.equal(all.length,27);
 assert.equal(new Set(all.map(x=>x.id)).size,27);
 // ARENA-ART-004G: the only non-human is the N-02 sarkh courier (owner, variant A).
 const sarkh=all.filter(x=>x.speciesId!=="human");
 assert.deepEqual(Array.from(sarkh,x=>[x.id,x.speciesId,x.originRegionId]),[["npc-n02-slinger","sarkh","changing-rivers"]]);
 assert.ok(all.every(x=>x.side==="enemy"&&x.factionId===null&&
  (x.speciesId==="human"&&x.originRegionId==="gardens-over-abyss"||x.id==="npc-n02-slinger")));
 assert.equal(N.get("npc-watch-captain").stats.hp,178);
 assert.equal(N.get("npc-field-medic").stats.hp,103);
 assert.equal(Q.get("T-03").priorityId,"ves-2");
 assert.equal(Q.get("N-03").thirdStarActionLimit,null);
 assert.equal(Q.KEY,"ashes-throne.challenges.v1");
 assert.equal(Q.VERSION,1);
 assert.equal(P.get("T-01").priorityId,"npc-t01-signaller");
 assert.equal(P.get("T-02").priorityId,"npc-t02-interceptor");
 assert.equal(P.get("N-01").futureWaves.length,1);
 assert.equal(P.get("N-02").futureWaves.length,1);
});
test("NPCCHALLENGE006: objective definitions and exact trackers match all real instances",()=>{
 const t=P.trackerTargets("T-03"),n=P.trackerTargets("N-03");
 assert.equal(t.challengeId,"T-03");
 assert.equal(n.challengeId,"N-03");
 assert.deepEqual(Array.from(t.enemyIds),
  ["npc-t03-slinger","npc-t03-guard","npc-t03-medic"]);
 assert.deepEqual(Array.from(n.enemyIds),
  ["npc-n03-slinger","npc-n03-guard","npc-n03-medic","npc-n03-signaller","npc-n03-captain"]);
 assert.ok(Q.start("T-03",t));
 assert.ok(Q.start("N-03",n));
 assert.equal(Q.start("T-03",n),null);
 assert.equal(Q.start("N-03",t),null);
 assert.match(P.goal("T-03"),/последним/);
 assert.match(P.goal("N-03"),/95%/);
 assert.match(P.criteria("T-03")[1],/последним/);
 assert.match(P.criteria("N-03")[2],/95%/);
 assert.equal(P.criteria("T-02"),null);
 assert.equal(P.goal("N-02"),null);
});
test("NPCCHALLENGE006: T-03 last-and-alone logic, simultaneity, defeat and legacy score",()=>{
 const targets=P.trackerTargets("T-03"),base={active:false,winner:"ally",
  fighters:[{id:"ren",side:"ally",hp:80,maxHp:100}],wave:1,totalWaves:1};
 function evaluate(groups,allyHp=80){
  const tracker=Q.start("T-03",targets);
  for(const deaths of groups)Q.capture(tracker,[{type:"ability",actorId:"ren"},
   ...deaths.map(targetId=>({type:"death",targetId}))]);
  return P.score("T-03",{...base,
   fighters:[{id:"ren",side:"ally",hp:allyHp,maxHp:100}]},tracker);
 }
 assert.equal(evaluate([["npc-t03-slinger"],["npc-t03-guard"],["npc-t03-medic"]]),3);
 assert.equal(evaluate([["npc-t03-slinger"],["npc-t03-guard"],["npc-t03-medic"]],0),2);
 assert.equal(evaluate([["npc-t03-medic"],["npc-t03-slinger"],["npc-t03-guard"]]),1);
 assert.equal(evaluate([["npc-t03-slinger"],["npc-t03-guard","npc-t03-medic"]]),1);
 assert.equal(evaluate([["npc-t03-slinger","npc-t03-guard","npc-t03-medic"]]),1);
 assert.equal(evaluate([["npc-t03-slinger"],["npc-t03-medic"]]),0,
  "a missing enemy death is not a completed objective");
 const tracker=Q.start("T-03",targets);
 for(const dead of targets.enemyIds)Q.capture(tracker,[{type:"ability"},{type:"death",targetId:dead}]);
 assert.equal(P.score("T-03",{...base,winner:"enemy"},tracker),0);
 assert.equal(P.score("T-03",{...base,active:true},tracker),0);
 const old=Q.start("T-03");
 Q.capture(old,[{type:"ability"},{type:"death",targetId:"ves-2"}]);
 assert.equal(Q.strictFirst(old,"ves-2"),true,"normal T-03 unchanged");
 assert.equal(Q.score("T-03",base,old),3,"base challenge scorer still uses first-target scoring");
});
test("NPCCHALLENGE006: N-03 final team HP, threshold boundary, no-survivor exploit",()=>{
 const targets=P.trackerTargets("N-03"),tracker=Q.start("N-03",targets);
 const allies=(a,b)=>[
  {id:"ren",side:"ally",hp:a,maxHp:100},
  {id:"sava",side:"ally",hp:b,maxHp:100}
 ];
 const battle=(a,b,wave=3,winner="ally")=>({
  active:false,winner, fighters:allies(a,b),wave,totalWaves:3
 });
 assert.equal(P.score("N-03",battle(95,95),tracker),3,"exactly 95% is success");
 assert.equal(P.score("N-03",battle(94,95),tracker),2,"94.5% is not rounded to 95%");
 assert.equal(P.score("N-03",battle(100,90),tracker),3,"aggregate HP, not each hero 95%");
 assert.equal(P.score("N-03",battle(0,100),tracker),1,"any lost ally blocks 2/3 stars");
 assert.equal(P.score("N-03",battle(100,100,2),tracker),0);
 assert.equal(P.score("N-03",battle(100,100,3,"enemy"),tracker),0);
 assert.equal(P.score("N-03",{...battle(100,100),active:true},tracker),0);
 assert.deepEqual(Object.keys(P.healthPercent(battle(100,80))),
  ["current","maximum","percent"]);
 assert.equal(P.healthPercent(battle(100,80)).percent,90);
 assert.match(P.resultText("N-03",battle(100,80),tracker),/90.0%/);
 assert.equal(P.healthPercent({fighters:[{side:"ally",hp:20,maxHp:0}]}),null);
 assert.equal(P.resultText("T-02",battle(100,80),tracker),null);
});
test("NPCCHALLENGE006: 90 real seeded battles, different tactical success conditions",()=>{
 const squads=[
  {ids:FULL,level:1},{ids:FULL,level:3},
  {ids:["ren","nada","sava"],level:3},
  {ids:["ren","liora","art"],level:3},
  {ids:["ren","nada","liora","art"],level:8}
 ];
 const results=[];
 for(const id of ["T-03","N-03"])
  for(const group of squads)for(const seed of [1,17,71])
   for(const strategy of ["good","bad","auto"])
    results.push(run(id,group.ids,group.level,seed,strategy));
 assert.equal(results.length,90);
 const t=results.filter(x=>x.id==="T-03"),n=results.filter(x=>x.id==="N-03");
 assert.equal(t.filter(x=>x.win).length,45);
 assert.equal(t.filter(x=>x.stars===3).length,15,
  "only manual leave-the-medic-last achieves three stars");
 assert.ok(t.filter(x=>x.strategy==="good").every(x=>x.lastKill==="npc-t03-medic"&&x.stars===3));
 assert.ok(t.filter(x=>x.strategy==="auto").every(x=>x.stars===1),
  "existing auto-targeting does not solve the reversed objective");
 assert.equal(n.filter(x=>x.win).length,45);
 assert.ok(n.every(x=>x.thirdSeen&&x.wave===3&&x.total===3));
 assert.ok(n.some(x=>x.stars===3)&&n.some(x=>x.stars===2),
  "HP-based third star is attainable but not automatic");
 assert.ok(n.every(x=>x.stars===1||x.stars===2||x.stars===3));
 assert.ok(n.filter(x=>x.stars===3).every(x=>x.allAlive&&x.hp>=95));
 const summary=arr=>squads.map(s=>{
  const team=s.ids.join(",")+"@L"+s.level,g=arr.filter(x=>x.team===team);
  return {team,wins:g.filter(x=>x.win).length,
   stars3:g.filter(x=>x.stars===3).length,
   stars2:g.filter(x=>x.stars===2).length,
   meanActions:Number((g.reduce((a,x)=>a+x.actions,0)/g.length).toFixed(1))};
 });
 console.log("NPCCHALLENGE006_BALANCE="+JSON.stringify({
  count:results.length,T03:summary(t),N03:summary(n),
  n03Stars3:n.filter(x=>x.stars===3).length,
  n03Stars2:n.filter(x=>x.stars===2).length,
  n03Stars1:n.filter(x=>x.stars===1).length,
  starterT03:t.filter(x=>x.team===FULL.join(",")+"@L1")
   .map(x=>({seed:x.seed,strategy:x.strategy,stars:x.stars,actions:x.actions})),
  starterN03:n.filter(x=>x.team===FULL.join(",")+"@L1")
   .map(x=>({seed:x.seed,strategy:x.strategy,stars:x.stars,actions:x.actions,hp:x.hp}))
 }));
});
test("NPCCHALLENGE006: objective UI and v1 save work without URL flag",()=>{
 const js=read("game.js"),html=read("index.html"),pkg=JSON.parse(read("package.json"));
 assert.match(pkg.version,/^\d+\.\d+\.\d+$/);
 assert.ok(html.includes("v"+pkg.version+" · "), "footer should match package version");
 assert.ok(html.includes("npc-challenge-pilot.js?v="+pkg.version));
 assert.match(js,/const NPC_CHALLENGE_PILOT_ENABLED=true;/);
 assert.match(js,/NpcChallengePilot\.criteria\(def\.id\)/);
 assert.match(js,/NpcChallengePilot\.goal\(activeChallengeId,/);
 assert.match(js,/NpcChallengePilot\.resultText\(activeChallengeId,state,challengeTracker\)/);
 assert.match(js,/NpcChallengePilot\.score\(activeChallengeId,state,challengeTracker\)/);
 assert.doesNotMatch(js,/NPC-пробы T-01…T-04/);
 assert.match(js,/if\(battleIsChallenge&&!state.active&&!challengeResultRecorded\)/);
 assert.match(js,/ChallengeCore\.save\(outcome.candidate,\(\)=>window.localStorage,challengeSaveBlocked\)/);
 assert.equal(Q.KEY,"ashes-throne.challenges.v1");
 assert.equal(Q.get("N-03").thirdStarActionLimit,null);
});
