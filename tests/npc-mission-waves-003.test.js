"use strict";
/* NPCMISSION003: single opt-in two-wave encounter, no existing campaign mutation. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const context=vm.runInNewContext([
 "initiative-model.js","battle-rng.js","combat-status-core.js",
 "ability-data.js","skill-core.js","hero-stats-core.js","hero-stats-profiles.js",
 "hero-stats-combat-bridge.js","combat-core.js","enemy-decision.js",
 "auto-decision.js","npc-enemy-data.js","npc-mission-pilot.js","mission-data.js",
 "campaign-data.js","campaign-core.js"
].map(read).join("\n")+"\n({NpcMissionPilot,NpcEnemyData,HeroStatsProfiles,HeroStatsCore,HeroStatsCombatBridge,CombatCore,AbilityData,AutoDecision,MissionData,CampaignData,CampaignCore})");
const {NpcMissionPilot:P,NpcEnemyData:N,HeroStatsProfiles:Profiles,HeroStatsCore:Stats,
 HeroStatsCombatBridge:Bridge,CombatCore:C,AbilityData:A,AutoDecision:Auto,
 MissionData:M,CampaignData:Campaign,CampaignCore:Progress}=context;
const SQUAD=["ren","nada","liora","art","sava"];
function hero(id,level){
 const base={id,name:id,side:"ally",role:id};
 return {...Bridge.apply(base,{level,stars:1,gearPercent:{hp:0,atk:0},gearStats:{}},
  Profiles[id],Stats),skillLevels:{basic:1,special:1,powerful:1,passive:1,leader:1}};
}
function run(ids,level,seed,strategy){
 const party=ids.map(id=>hero(id,level));
 const fighters=P.spawn("demo-mission-3"),waves=P.spawnWaves("demo-mission-3");
 const battle=C.createBattle([...party,...fighters],waves,{
  leaderId:party[0].id,rngSeed:seed,hitChecks:true,critChecks:true,
  penetrationChecks:true,statusChecks:true
 });
 C.advanceToPlayerTurn(battle);
 let steps=0,seenSecondWave=battle.wave===2;
 while(battle.active&&steps<150){
  if(battle.currentActor<0)C.advanceToPlayerTurn(battle);
  if(!battle.active)break;
  const actor=battle.fighters[battle.currentActor];
  assert.equal(actor.side,"ally");
  const living=battle.fighters.map((f,i)=>({f,i})).filter(x=>x.f.side==="enemy"&&x.f.hp>0);
  const plan=strategy==="auto"?Auto.chooseAction(battle):(()=>{
   const idsToFocus=strategy==="support-first"?
    ["npc-route-signaller","npc-field-medic","npc-ridge-slinger","npc-pass-guard","npc-trail-interceptor"]:
    ["npc-trail-interceptor","npc-ridge-slinger","npc-pass-guard","npc-route-signaller","npc-field-medic"];
   const target=idsToFocus.map(id=>living.find(x=>x.f.archetypeId===id)).find(Boolean)||living[0];
   const skill=["powerful","special"].find(id=>C.abilityReady(battle,id)&&
    A.get(actor,id)?.kind==="damage"&&
    ["enemy","all-enemies"].includes(A.get(actor,id).target));
   return {abilityId:skill||"basic",targetIndex:target.i};
  })();
  assert.equal(C.performAutoAction(battle,plan),true);
  seenSecondWave||=battle.wave===2;
  steps++;
 }
 assert.ok(steps<150&&!battle.active,"two-wave combat must terminate");
 assert.equal(battle.totalWaves,2);
 assert.equal(seenSecondWave,true,"second wave must enter combat before resolution");
 return {win:battle.winner==="ally",stars:M.score("demo-mission-3",battle),
  actions:battle.allyActions,alive:battle.fighters.filter(f=>f.side==="ally"&&f.hp>0).length,
  wave:battle.wave,strategy};
}
test("NPCMISSION003: two waves, immutable plans, unique IDs, unchanged legacy mission rules",()=>{
 const second=P.get("demo-mission-2"),third=P.get("demo-mission-3");
 assert.equal(second.enemyIds.length,2);
 assert.equal(second.futureWaves.length,0);
 assert.deepEqual(Array.from(P.spawn("demo-mission-2"),x=>x.id),["npc-m2-slinger","npc-m2-medic"]);
 assert.equal(P.spawnWaves("demo-mission-2").length,0);
 assert.equal(third.enemyIds.length,2);
 assert.equal(third.futureWaves.length,1);
 assert.equal(third.futureWaves[0].length,3);
 assert.ok(Object.isFrozen(third)&&Object.isFrozen(third.futureWaves[0]));
 const initial=P.spawn("demo-mission-3"),waves=P.spawnWaves("demo-mission-3");
 const ids=[...initial,...waves.flat()].map(x=>x.id);
 assert.equal(new Set(ids).size,5);
 assert.deepEqual(Array.from(initial,x=>x.archetypeId),
  ["npc-trail-interceptor","npc-route-signaller"]);
 assert.deepEqual(Array.from(waves[0],x=>x.archetypeId),
  ["npc-pass-guard","npc-ridge-slinger","npc-field-medic"]);
 assert.deepEqual(Array.from(initial,x=>[x.hp,x.protection]),[[55,5],[35,4]]);
 assert.deepEqual(Array.from(waves[0],x=>[x.hp,x.protection]),[[55,8],[45,3],[35,3]]);
 assert.equal(N.get("npc-pass-guard").stats.hp,145,"generic NPC HP unchanged");
 assert.equal(N.get("npc-field-medic").stats.hp,103,"generic healer unchanged");
 assert.equal(P.spawn("black-pass-ambush").length,2);
 assert.equal(P.spawnWaves("black-pass-ambush").length,0);
 assert.deepEqual(Array.from(P.visuals(),x=>x.id).sort(),
  ["npc-m1-guard","npc-m1-interceptor","npc-m2-slinger","npc-m2-medic",...ids].sort());
 assert.equal(M.get("demo-mission-3").futureEnemyWaves[0].length,3,
  "the normal campaign mission still has its original wave IDs");
 assert.deepEqual(Array.from(M.get("demo-mission-3").futureEnemyWaves[0]),
  ["ves-2","shade-2","ves-3"]);
 assert.equal(M.get("demo-mission-3").stars[2].conditions.at(-1).limit,18);
 assert.equal(Campaign.getMission("demo-mission-3").requiredMissionIds[0],"demo-mission-2");
 const campaign=Progress.fresh();
 assert.equal(Campaign.available(Campaign.getMission("demo-mission-3"),campaign),false);
});
test("NPCMISSION003: default NPC campaign waves retain costs and progression",()=>{
 const game=read("game.js"),html=read("index.html"),pkg=JSON.parse(read("package.json"));
 assert.match(game,/const NPC_MISSION_PILOT_ENABLED=true;/);
 assert.match(game,/NpcMissionPilot\.visuals\(\)/);
 assert.match(game,/NpcMissionPilot\.spawnWaves\(activeMissionId\)/);
 assert.match(game,/battleIsCampaign&&NPC_MISSION_PILOT_ENABLED/);
 assert.match(game,/!!NpcMissionPilot\.get\(activeMissionId\)/);
 assert.match(game,/if\(battleIsCampaign&&!freeStoryEntry/);
 assert.match(game,/if\(battleIsCampaign&&!state.active&&!missionResultRecorded\)/);
 assert.match(game,/const ENEMIES=HEROES.filter\(h=>h.side==="enemy"\)/);
 assert.match(game,/NPC_MISSION_VISUALS=NPC_MISSION_PILOT_ENABLED/);
 assert.match(html,/v0\.3\.179 · SAVA3D002/);
 assert.match(html,/npc-mission-pilot\.js\?v=0\.3\.179/);
 assert.equal(pkg.version,"0.3.179");
});
test("NPCMISSION003: 45 real two-wave bouts with reachable heroes, 3-star possibility and tactical value",()=>{
 const cases=[
  {ids:SQUAD,level:1},{ids:SQUAD,level:3},
  {ids:["ren","nada","sava"],level:3},
  {ids:["ren","liora","art"],level:3},
  {ids:["ren","nada","liora","art"],level:8}
 ];
 const results=[];
 for(const c of cases)for(const seed of [1,17,71]){
  for(const strategy of ["support-first","damage-first","auto"])
   results.push({...run(c.ids,c.level,seed,strategy),group:c.ids.join(",")+"@L"+c.level});
 }
 assert.equal(results.length,45);
 assert.equal(results.filter(x=>x.win).length,45);
 assert.equal(results.filter(x=>x.stars===3).length>=25,true,
  "three-star rating must not be locked behind unattainable action count");
 const starter=results.filter(x=>x.group===SQUAD.join(",")+"@L1");
 assert.ok(starter.every(x=>x.alive===5),"starter party survives both waves");
 assert.ok(starter.some(x=>x.stars===3),"starter group can earn 3 stars");
 const prudent=starter.filter(x=>x.strategy==="support-first");
 const greedy=starter.filter(x=>x.strategy==="damage-first");
 assert.ok(prudent.reduce((sum,x)=>sum+x.actions,0)<
  greedy.reduce((sum,x)=>sum+x.actions,0),"support-first saves actions");
 const avg=arr=>Number((arr.reduce((s,x)=>s+x.actions,0)/arr.length).toFixed(1));
 console.log("NPCMISSION003_BALANCE="+JSON.stringify({
  scenarios:results.length,wins:results.filter(x=>x.win).length,
  threeStars:results.filter(x=>x.stars===3).length,
  groups:cases.map(c=>{
   const key=c.ids.join(",")+"@L"+c.level,g=results.filter(x=>x.group===key);
   return {id:key,wins:g.filter(x=>x.win).length,
    threeStars:g.filter(x=>x.stars===3).length,avgActions:avg(g)};
  }),
  starter:{
   supportFirst:prudent.map(x=>x.actions),damageFirst:greedy.map(x=>x.actions),
   auto:starter.filter(x=>x.strategy==="auto").map(x=>x.actions)
  }
 }));
});
test("NPCMISSION003: party wipe ends the mission instead of starting an extra wave",()=>{
 const battle=C.createBattle([hero("ren",1),...P.spawn("demo-mission-3")],
  P.spawnWaves("demo-mission-3"));
 battle.fighters.find(f=>f.id==="ren").hp=0;
 C.advanceToPlayerTurn(battle);
 assert.equal(battle.active,false);
 assert.equal(battle.winner,"enemy");
 assert.equal(battle.wave,1);
 assert.equal(battle.pendingWaves.length,1);
});
