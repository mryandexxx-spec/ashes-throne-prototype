"use strict";
/* NPCCHALLENGE007: two different win/3-star conditions on actual CombatCore. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const src=["initiative-model.js","battle-rng.js","combat-status-core.js",
 "ability-data.js","skill-core.js","hero-stats-core.js","hero-stats-profiles.js",
 "hero-stats-combat-bridge.js","combat-core.js","enemy-decision.js","auto-decision.js",
 "npc-enemy-data.js","challenge-core.js","npc-challenge-pilot.js"].map(read).join("\n");
const {NpcChallengePilot:P,NpcEnemyData:N,ChallengeCore:Q,CombatCore:C,
 HeroStatsProfiles:Profiles,HeroStatsCore:Stats,HeroStatsCombatBridge:Bridge,
 AbilityData:A,AutoDecision:Auto}=vm.runInNewContext(src+
 "\n({NpcChallengePilot,NpcEnemyData,ChallengeCore,CombatCore,HeroStatsProfiles,HeroStatsCore,HeroStatsCombatBridge,AbilityData,AutoDecision})");
const partyIds=["ren","nada","liora","art","sava"];
function hero(id,level=1){
 // Demo-only medic unlocks from the first mission and is not a canonical hero.
 if(id==="medic-demo")return {id,name:"Учебный лекарь",side:"ally",
  role:"Лекарь",hp:90,atk:14,speed:115};
 return {...Bridge.apply({id,name:id,side:"ally",role:id},
  {level,stars:1,gearPercent:{hp:0,atk:0},gearStats:{}},
  Profiles[id],Stats),skillLevels:{basic:1,special:1,powerful:1,passive:1,leader:1}};
}
function makeBattle(id,selected=partyIds,level=1,seed=1,tuning=null){
 const party=selected.map(x=>hero(x,level));
 let initial=P.spawn(id),waves=P.spawnWaves(id);
 assert.ok(initial&&waves);
 if(tuning?.enemyAttack!==undefined||tuning?.finalAttack!==undefined){
  const scale=(f,multiplier)=>({...f,physicalAttack:Math.round(f.physicalAttack*multiplier),
   atk:Math.round(f.atk*multiplier)});
  initial=initial.map(f=>scale(f,tuning.enemyAttack??1));
  waves=waves.map((w,i)=>w.map(f=>scale(f,i===waves.length-1?
   (tuning.finalAttack??tuning.enemyAttack??1):tuning.enemyAttack??1)));
 }
 const options={leaderId:party[0].id,
  ...(selected.includes("medic-demo")?{}:{
   rngSeed:seed,hitChecks:true,critChecks:true,
   penetrationChecks:true,statusChecks:true
  })};
 const objective=P.tacticalObjective(id,party);
 if(objective)options.tacticalObjective=tuning?.holdActions?
  {...objective,allyActionsToHold:tuning.holdActions}:objective;
 const battle=C.createBattle([...party,...initial],waves,options);
 const tracker=Q.start(id,P.trackerTargets(id));
 assert.ok(tracker);
 C.advanceToPlayerTurn(battle);
 return {battle,tracker,party};
}
function run(id,selected,level,seed,strategy,tuning=null){
 const {battle:b,tracker}=makeBattle(id,selected,level,seed,tuning);
 let steps=0;
 while(b.active&&steps<160){
  if(b.currentActor<0)C.advanceToPlayerTurn(b);
  if(!b.active)break;
  const actor=b.fighters[b.currentActor],alive=b.fighters.map((f,i)=>({f,i}))
   .filter(x=>x.f.side==="enemy"&&x.f.hp>0);
  assert.equal(actor.side,"ally");
  const chosen=strategy==="auto"?Auto.chooseAction(b):(()=>{
   if(strategy==="support"&&C.abilityReady(b,"special")){
    const skill=A.get(actor,"special");
    if(skill?.kind==="heal"){
     const allies=b.fighters.map((f,i)=>({f,i}))
      .filter(x=>x.f.side==="ally"&&x.f.hp>0);
     const target=allies.find(x=>x.f.hp<x.f.maxHp)||allies[0];
     return {abilityId:"special",targetIndex:skill.target==="all-allies"?
      b.currentActor:target.i};
    }
    if(skill?.kind==="guard"&&skill.target==="self")
     return {abilityId:"special",targetIndex:b.currentActor};
   }
   // T-04: hold the line instead of clearing everyone quickly.
   const order=id==="T-04"?["npc-t04-guard","npc-t04-slinger","npc-t04-interceptor"]:
    ["npc-n04-interceptor","npc-n04-slinger","npc-n04-medic",
     "npc-n04-signaller","npc-n04-captain"];
   const focus=order.map(target=>alive.find(x=>x.f.id===target)).find(Boolean)||alive[0];
   return {abilityId:"basic",targetIndex:focus.i};
  })();
  assert.equal(C.performAutoAction(b,chosen),true,"one valid ally action");
  assert.equal(P.capture(id,tracker,b.events,b),true,"complete event capture");
  steps++;
 }
 assert.ok(!b.active&&steps<160,"battle completed without hangs");
 return {winner:b.winner,stars:P.score(id,b,tracker),turns:b.allyActions,
  outcome:b.tacticalOutcome,heals:tracker.pilotActiveHealUsed===true,
  captured:tracker.pilotCapturedActions||0,wave:b.wave,
  allAlive:b.fighters.filter(f=>f.side==="ally").every(f=>f.hp>0)};
}
test("007: exact T-04/N-04 rosters and original v1 contracts",()=>{
 const t=P.get("T-04"),n=P.get("N-04");
 assert.equal(P.title("T-04"),"Прикрыть отход");
 assert.equal(P.title("N-04"),"Без передышки");
 assert.equal(t.objective.kind,"protect-hold");
 assert.equal(n.objective.kind,"no-active-heal");
 assert.equal(t.objective.allyActionsToHold,8);
 assert.deepEqual(Array.from(P.spawn("T-04"),x=>[x.id,x.hp,x.protection]),[
  ["npc-t04-interceptor",80,7],["npc-t04-slinger",72,8],["npc-t04-guard",125,25]]);
 assert.deepEqual(Array.from(P.spawnWaves("N-04"),x=>x.length),[1,2]);
 assert.deepEqual(Array.from(P.spawn("N-04"),x=>x.id),[
  "npc-n04-interceptor","npc-n04-slinger"]);
 assert.equal(P.visuals().length,27);
 assert.equal(new Set(P.visuals().map(x=>x.id)).size,27);
 assert.ok(P.visuals().every(x=>x.originRegionId==="gardens-over-abyss"&&
  x.speciesId==="human"&&x.factionId===null));
 assert.equal(Q.KEY,"ashes-throne.challenges.v1");
 assert.equal(Q.VERSION,1);
 assert.equal(Q.get("T-04").priorityId,"shade-2");
 assert.equal(Q.get("N-04").thirdStarActionLimit,null);
 assert.equal(P.get("T-03").priorityId,"npc-t03-medic");
 assert.equal(P.get("N-03").objective.minimumHealthPercent,95);
 assert.ok(Q.start("T-04",P.trackerTargets("T-04")));
 assert.ok(Q.start("N-04",P.trackerTargets("N-04")));
 assert.equal(Q.start("T-04",P.trackerTargets("N-04")),null);
 assert.ok(!P.tacticalObjective("T-04",[]));
 const ordered=[hero("sava"),hero("ren")];
 assert.equal(P.tacticalObjective("T-04",ordered).protectAllyId,"sava",
  "first real selected ally, not a hardcoded leader");
 assert.equal(P.tacticalObjective("T-04",ordered).allyActionsToHold,8);
 assert.equal(P.tacticalObjective("N-04",ordered),null);
 assert.match(P.goal("T-04","Сава"),/Сава/);
 assert.match(P.goal("N-04"),/лечение/i);
});
test("007 T-04: true hold, early victory, loss and 7/8 boundary",()=>{
 const allies=[{side:"ally",id:"sava",name:"Сава",hp:90,maxHp:90},
  {side:"ally",id:"ren",name:"Рен",hp:80,maxHp:80}];
 const objective=P.tacticalObjective("T-04",allies);
 const tracker=Q.start("T-04",P.trackerTargets("T-04"));
 const b=(outcome,actions=8,override=allies)=>({
  active:false,winner:"ally",fighters:override,tacticalObjective:objective,
  tacticalOutcome:outcome,allyActions:actions,wave:1,totalWaves:1
 });
 assert.equal(P.score("T-04",b("held"),tracker),3);
 assert.equal(P.score("T-04",b("held",8,[allies[0],{...allies[1],hp:0}]),tracker),2);
 assert.equal(P.score("T-04",b("defeated-attackers",3),tracker),1);
 assert.equal(P.score("T-04",b("held",7),tracker),0,"not yet eight actions");
 assert.equal(P.score("T-04",{...b("held"),winner:"enemy"},tracker),0);
 assert.equal(P.score("T-04",b("held",8,[{...allies[0],hp:0},allies[1]]),tracker),0);
 assert.equal(P.score("T-04",{...b("held"),tacticalObjective:{...objective,protectAllyId:"missing"}},tracker),0);
 assert.match(P.resultText("T-04",b("held"),tracker),/удержание завершено/i);
 assert.match(P.resultText("T-04",b("defeated-attackers",3),tracker),/досрочно/i);
});
test("007 N-04: active heal, zero heal, passive, enemy heals and missing packets",()=>{
 const allies=[{side:"ally",id:"ren",hp:80,maxHp:90},
  {side:"ally",id:"nada",hp:77,maxHp:90}];
 const enemy={side:"enemy",id:"npc-n04-medic",hp:0,maxHp:60};
 const b=(actions=1)=>({active:false,winner:"ally",fighters:[...allies,enemy],
  wave:3,totalWaves:3,allyActions:actions});
 const fresh=()=>Q.start("N-04",P.trackerTargets("N-04"));
 const cmd=(tracker,events,actions=1)=>P.capture("N-04",tracker,
  [{type:"ability",actorId:"ren",targetId:enemy.id,abilityId:"basic"},...events],b(actions));
 const active=fresh();
 assert.ok(cmd(active,[{type:"heal",actorId:"nada",targetId:"ren",amount:0}]));
 assert.equal(active.pilotActiveHealUsed,true,"zero-amount active cast cannot bypass objective");
 assert.equal(P.score("N-04",b(),active),2);
 const passive=fresh();
 assert.ok(cmd(passive,[{type:"heal",actorId:"nada",targetId:"ren",amount:12,passiveId:"passive"},
  {type:"heal",actorId:enemy.id,targetId:enemy.id,amount:15}]));
 assert.equal(P.score("N-04",b(),passive),3);
 const clean=fresh();
 assert.ok(cmd(clean,[]));
 assert.equal(P.score("N-04",b(),clean),3);
 assert.equal(P.score("N-04",b(2),clean),2,"unseen ally actions cannot earn 3 stars");
 assert.equal(P.capture("N-04",clean,
  [{type:"ability",actorId:"ren",targetId:enemy.id}],b(1)),false,
  "replayed event batch rejected");
 assert.equal(P.score("N-04",b(1),clean),0,"invalid tracking cannot earn stars");
 const empty=fresh();
 assert.equal(P.score("N-04",b(),empty),2,"empty tracker cannot earn 3 stars");
 assert.equal(P.score("N-04",{...b(),fighters:[{...allies[0],hp:0},allies[1],enemy]},clean),0);
});
test("007: two mechanically different objectives run on actual heroes and AI",()=>{
 const teams=[{ids:partyIds,level:1},{ids:partyIds,level:3},
  {ids:["ren","nada","sava"],level:3},{ids:["ren","liora","art"],level:3},
  {ids:["ren","nada","liora","art"],level:8}];
 const rows=[];
 for(const id of ["T-04","N-04"]){
  let wins=0,stars3=0,heals=0;
  for(const team of teams)for(const seed of [1,17,71])
   for(const strategy of ["attack","support","auto"]){
    const result=run(id,team.ids,team.level,seed,strategy);
    rows.push({id,team:team.ids.join(",")+"@"+team.level,seed,strategy,...result});
    wins+=result.winner==="ally"?1:0;
    stars3+=result.stars===3?1:0;
    heals+=result.heals?1:0;
    assert.ok(result.stars>=0&&result.stars<=3);
    if(id==="T-04"&&result.stars>=2)assert.equal(result.outcome,"held");
    if(id==="N-04"&&result.stars===3){
     assert.equal(result.heals,false);
     assert.equal(result.captured,result.turns);
    }
   }
  assert.ok(wins>0,id+" is passable by actual heroes");
  console.log("NPCCHALLENGE007_BALANCE",id,JSON.stringify({wins,stars3,heals,runs:45}));
 }
 console.log("NPCCHALLENGE007_DETAILS="+JSON.stringify(rows));
});
test("007 N-04: unlocked training healer introduces a genuine manual heal tradeoff",()=>{
 const chosen=["ren","nada","liora","art","medic-demo"];
 const rows=[];
 for(const seed of [1,17,71]){
  const rush=run("N-04",chosen,3,seed,"attack");
  const heal=run("N-04",chosen,3,seed,"support");
  rows.push({seed,rush,heal});
  assert.equal(rush.heals,false);
  // Some full auto-turn schedules can defeat the fragile test healer before
  // its first cast. The deterministic real-core heal assertion is below.
  if(heal.winner==="ally"&&heal.heals)assert.ok(heal.stars<=2,
   "a healed victory must not receive 3 stars");
 }
 console.log("NPCCHALLENGE007_HEALER="+JSON.stringify(rows));
 // A real legal manual heal must definitely produce the event used by N-04.
 // A fast isolated fixture guarantees the medic acts before enemy AI pressure.
 const medic={id:"medic-demo",name:"Учебный лекарь",side:"ally",hp:90,atk:14,speed:500};
 const partner={id:"kael",name:"Учебный страж",side:"ally",hp:100,atk:20,speed:100};
 const battle=C.createBattle([medic,partner,...P.spawn("N-04")],
  P.spawnWaves("N-04"),{leaderId:"medic-demo"});
 const tracker=Q.start("N-04",P.trackerTargets("N-04"));
 C.advanceToPlayerTurn(battle);
 assert.equal(battle.fighters[battle.currentActor].id,"medic-demo");
 assert.equal(C.chooseAlly(battle,1),true);
 assert.equal(C.performPlayerAbility(battle,"special"),true);
 assert.ok(battle.events.some(e=>e.type==="heal"&&e.actorId==="medic-demo"),
  "real CombatCore emitted an active healer event");
 assert.equal(P.capture("N-04",tracker,battle.events,battle),true);
 assert.equal(tracker.pilotActiveHealUsed,true,
  "pilot recorded a real active heal, not a synthetic mock event");
});
test("007 exploration: compare hold duration and NPC pressure without changing live objectives",()=>{
 const teams=[
  {ids:partyIds,level:1},
  {ids:partyIds,level:3},
  {ids:["ren","nada","sava"],level:3},
  {ids:["ren","liora","art"],level:3},
  {ids:["ren","nada","liora","art"],level:8}
 ];
 for(const id of ["T-04","N-04"]){
  const durations=id==="T-04"?[8,10,12]:[0];
  const attacks=id==="T-04"?[1,1.1,1.15,1.2]:[1,1.05,1.1,1.15];
  const finalAttacks=id==="T-04"?[undefined]:[undefined,1.15,1.3];
  for(const holdActions of durations)for(const enemyAttack of attacks)
   for(const finalAttack of finalAttacks){
   let total=0,wins=0,held=0,full=0,three=0;
   const byTeam=[];
   for(const team of teams){
    const scores={attack:[],support:[],auto:[]};
    for(const strategy of ["attack","support","auto"])for(const seed of [1,17,71]){
     const result=run(id,team.ids,team.level,seed,strategy,{holdActions,enemyAttack,finalAttack});
     total++;wins+=result.winner==="ally";
     const validHold=id==="T-04"&&result.outcome==="held";
     held+=validHold;
     const star3=id==="T-04"?validHold&&result.allAlive:
       result.stars===3;
     full+=result.allAlive;three+=star3;
     scores[strategy].push(star3?3:result.stars);
    }
    byTeam.push({team:team.ids.join(",")+"@"+team.level,...scores});
   }
   console.log("NPCCHALLENGE007_TUNE "+JSON.stringify({id,holdActions,enemyAttack,finalAttack,
    total,wins,held,allAlive:full,stars3:three,byTeam}));
  }
 }
});
test("007: opt-in only, no new persisted schema, build and UI scripts",()=>{
 const game=read("game.js"),html=read("index.html"),pkg=JSON.parse(read("package.json"));
 assert.equal(pkg.version,"0.3.170");
 assert.match(html,/v0\.3\.170 · NPCCHALLENGE007/);
 assert.match(html,/npc-challenge-pilot\.js\?v=0\.3\.170/);
 assert.match(html,/game\.js\?v=0\.3\.170/);
 assert.match(game,/npcChallengePilot=1/);
 assert.match(game,/NpcChallengePilot\.capture\(activeChallengeId,challengeTracker/);
 assert.match(game,/NpcChallengePilot\.tacticalObjective\(activeChallengeId,allies\)/);
 assert.match(game,/NPC-пробы T-01…T-04 \/ N-01…N-04/);
 assert.match(game,/if\(battleIsNpcChallengePilot&&!state\.active&&!challengeResultRecorded\)/);
 assert.match(game,/if\(battleIsChallenge&&!battleIsNpcChallengePilot&&!state\.active&&!challengeResultRecorded\)/);
 assert.doesNotMatch(game,/NpcChallengePilot\.score\([^)]+\).*ChallengeCore\.save/);
 assert.equal(Q.get("N-04").thirdStarActionLimit,null);
});
