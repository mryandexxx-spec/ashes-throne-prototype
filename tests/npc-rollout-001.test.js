"use strict";
/* NPCROLLOUT001: real NPC encounters own normal campaign and challenge progress. */
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const source=["initiative-model.js","ability-data.js","combat-core.js","npc-enemy-data.js",
 "npc-mission-pilot.js","challenge-core.js","npc-challenge-pilot.js","mission-data.js",
 "campaign-core.js"].map(read).join("\n");
const {NpcMissionPilot:M,NpcEnemyData:N,ChallengeCore:Q,NpcChallengePilot:P,
 CombatCore:C,MissionData:Mission,CampaignCore:Campaign}=vm.runInNewContext(
 source+"\n({NpcMissionPilot,NpcEnemyData,ChallengeCore,NpcChallengePilot,CombatCore,MissionData,CampaignCore})");

test("001 NPCs are normal challenge and campaign encounters, not opt-in previews",()=>{
 const g=read("game.js"),html=read("index.html"),pkg=JSON.parse(read("package.json"));
 assert.match(g,/const NPC_CHALLENGE_PILOT_ENABLED=true;/);
 assert.match(g,/const NPC_MISSION_PILOT_ENABLED=true;/);
 assert.doesNotMatch(g,/npcChallengePilot=1|npcMissionPilot=1/);
 assert.match(g,/NpcChallengePilot\.spawn\(activeChallengeId\)/);
 assert.match(g,/NpcMissionPilot\.spawn\(activeMissionId\)/);
 assert.match(g,/ChallengeCore\.resultEarned\(challengeProgress,activeChallengeId,/);
 assert.match(g,/ChallengeCore\.save\(outcome\.candidate,\(\)=>window\.localStorage,challengeSaveBlocked\)/);
 assert.match(g,/if\(battleIsCampaign&&!state\.active&&!missionResultRecorded\)/);
 assert.match(g,/ProgressCore\.spendEnergy\(progress,activeMissionId\)/);
 assert.match(g,/ProgressCore\.claimFirstClear\(progress,activeMissionId,state\)/);
 assert.match(g,/ProgressCore\.grantRepeatFarm\(progress,activeMissionId\)/);
 assert.doesNotMatch(g,/if\(battleIsNpcMissionPilot&&!state\.active&&!missionResultRecorded\)/);
 assert.match(g,/ensureEncounterNpcVisuals\(\[\.\.\.lineup,\.\.\.waves\.flat\(\)\]\)/);
 assert.match(g,/clearEncounterNpcVisuals\(\)/);
 assert.ok(!g.includes("HEROES.concat(NPC_PILOT_VISUALS.filter(Boolean),NPC_MISSION_VISUALS,NPC_CHALLENGE_VISUALS)"));
 assert.ok(html.includes("v"+pkg.version+" · ART3D001"));
 assert.ok(html.includes("npc-challenge-pilot.js?v="+pkg.version));
 assert.equal(pkg.version,"0.3.180");
});

test("001 all eight challenges have NPC rosters, distinct goals and matching waves",()=>{
 const ids=Q.all().map(x=>x.id);
 assert.equal(ids.length,8);
 assert.deepEqual(Array.from(ids),["T-01","T-02","T-03","T-04","N-01","N-02","N-03","N-04"]);
 for(const id of ids){
  const plan=P.get(id),first=P.spawn(id),waves=P.spawnWaves(id);
  assert.ok(plan&&first&&waves,id);
  const all=[...first,...waves.flat()];
  assert.equal(all.length,plan.enemyIds.length+plan.futureWaves.flat().length);
  assert.equal(new Set(all.map(x=>x.id)).size,all.length,id+" IDs");
  assert.ok(all.every(x=>x.archetypeId.startsWith("npc-")&&x.side==="enemy"&&
   x.speciesId==="human"&&x.factionId===null));
  assert.ok(P.title(id));
  assert.equal(waves.length,Q.get(id).futureWaves.length);
 }
 assert.equal(P.get("T-04").objective.allyActionsToHold,8);
 assert.equal(P.get("N-03").objective.minimumHealthPercent,95);
 assert.equal(P.get("N-04").objective.kind,"no-active-heal");
});

test("001 campaign NPC rosters keep first/second/third mission, two wave order, save and reward contracts",()=>{
 for(const id of ["black-pass-ambush","demo-mission-2","demo-mission-3"]){
  const first=M.spawn(id),waves=M.spawnWaves(id);
  assert.ok(first&&first.length>0&&waves);
  assert.ok([...first,...waves.flat()].every(f=>
   f.side==="enemy"&&f.archetypeId.startsWith("npc-")&&f.factionId===null));
  assert.equal(waves.length,(Mission.get(id).futureEnemyWaves||[]).length);
 }
 assert.equal(M.spawnWaves("demo-mission-3")[0].length,3);
 const p=Campaign.fresh();
 assert.equal(typeof Campaign.recordResult,"function");
 assert.equal(Q.KEY,"ashes-throne.challenges.v1");
});

test("001 legacy challenge stars remain accessible and new NPC earned score uses v1 atomic save",()=>{
 const store=new Map();
 const provider=()=>({getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>store.set(k,v)});
 const initial=Q.fresh();initial.bestStars["T-01"]=3;initial.bestStars["N-01"]=2;
 assert.equal(Q.save(initial,provider),true);
 const loaded=Q.load(provider);
 assert.equal(loaded.progress.bestStars["T-01"],3);
 assert.equal(loaded.progress.bestStars["N-01"],2);
 assert.equal(loaded.progress.bestStars["T-04"],0);
 assert.equal(Q.available("T-02",loaded.progress),true);
 assert.equal(Q.resultEarned(loaded.progress,"T-03",4),null);
 assert.equal(Q.resultEarned(loaded.progress,"N-04",-1),null);
 const outcome=Q.resultEarned(loaded.progress,"T-04",2);
 assert.ok(outcome&&outcome.improved);
 assert.equal(loaded.progress.bestStars["T-04"],0,"pure transition does not mutate");
 assert.equal(Q.save(outcome.candidate,provider),true);
 assert.equal(Q.load(provider).progress.bestStars["T-04"],2);
 assert.equal(Q.load(provider).progress.bestStars["T-01"],3);
 assert.equal(Q.KEY,"ashes-throne.challenges.v1");
 assert.equal(Q.VERSION,1);
});

test("001 battle results with real NPC and event log can be persisted",()=>{
 const first=P.spawn("T-01");
 const actor={id:"demo",name:"Demo",side:"ally",hp:300,atk:55,speed:350};
 const b=C.createBattle([actor,...first]);
 const track=Q.start("T-01",P.trackerTargets("T-01"));
 C.advanceToPlayerTurn(b);
 for(let n=0;b.active&&n<50;n++){
  const target=b.fighters.findIndex(x=>x.side==="enemy"&&x.hp>0&&
   x.id===P.get("T-01").priorityId);
  const other=b.fighters.findIndex(x=>x.side==="enemy"&&x.hp>0);
  assert.equal(C.chooseEnemy(b,target>=0?target:other),true);
  assert.equal(C.performPlayerAbility(b,"basic"),true);
  assert.equal(P.capture("T-01",track,b.events,b),true);
 }
 assert.equal(b.winner,"ally");
 assert.equal(P.score("T-01",b,track),3);
 const result=Q.resultEarned(Q.fresh(),"T-01",P.score("T-01",b,track));
 assert.equal(result.candidate.bestStars["T-01"],3);
});
