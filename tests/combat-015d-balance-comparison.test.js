"use strict";
// Combat-015D balance audit: deterministic paired runs against live combat rules.
// No balance targets, tuning or production behavior are changed by this test.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const read=n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8");
const source=["initiative-model.js","ability-data.js","combat-core.js",
  "auto-decision.js","enemy-decision.js","mission-data.js"].map(read).join("\n");
const {CombatCore,AutoDecision,MissionData}=vm.runInNewContext(
  source+"\n({CombatCore,AutoDecision,MissionData})");
const gameSource=read("game.js");
const roster=vm.runInNewContext(gameSource.slice(0,gameSource.indexOf("const $="))+
  "\nHEROES");
const allAllies=roster.filter(f=>f.side==="ally");
const allEnemies=roster.filter(f=>f.side==="enemy");
const mission=MissionData.get("demo-mission-2");
assert.equal(allAllies.length,5);
assert.equal(allEnemies.length,5);
assert.ok(!mission.enemyAiProfiles, "historic pilot has been removed from live mission data");
assert.ok(!MissionData.get("black-pass-ambush").enemyAiProfiles);
assert.ok(!MissionData.get("demo-mission-3").enemyAiProfiles);
const profiles={shade:"aggressive"}; // Historical Combat-015D-A comparison only
const enemyTemplateIds=allEnemies.map(f=>f.id);
assert.equal(enemyTemplateIds.join(","),"ves,shade,ves-2,shade-2,ves-3");
assert.equal(allEnemies.some(f=>f.aiProfile),false,
  "do not mutate global roster in mission pilot");
function run(ids,mode,pilot){
  const party=ids.map(id=>({...allAllies.find(f=>f.id===id)}));
  const enemies=allEnemies.map(f=>({...f,aiProfile:pilot&&profiles[f.id]?"aggressive":"ordinary"}));
  const b=CombatCore.createBattle([...party,...enemies]);
  const startingHp=party.reduce((n,f)=>n+f.hp,0);
  CombatCore.advanceToPlayerTurn(b);
  let steps=0;
  while(b.active&&steps++<500){
    assert.equal(b.fighters[b.currentActor]?.side,"ally",
      "must yield a living ally while battle remains active");
    if(mode==="tactical-auto"){
      const plan=AutoDecision.chooseAction(b);
      assert.ok(plan,"live ally AI must propose an action");
      assert.equal(CombatCore.performAutoAction(b,plan),true);
    }else{
      const targets=b.fighters.map((f,i)=>({f,i}))
        .filter(({f})=>f.side==="enemy"&&f.hp>0)
        .sort((a,b)=>a.f.hp-b.f.hp||a.i-b.i);
      assert.ok(targets.length,"basic policy needs a living opponent");
      assert.equal(CombatCore.chooseEnemy(b,targets[0].i),true);
      assert.equal(CombatCore.performPlayerAbility(b,"basic"),true);
    }
  }
  assert.ok(steps<500,"scenario must terminate, not stall on initiative");
  assert.equal(b.active,false);
  const survivors=b.fighters.filter(f=>f.side==="ally"&&f.hp>0);
  const remainingHp=survivors.reduce((n,f)=>n+f.hp,0);
  return {
    winner:b.winner,
    deaths:party.length-survivors.length,
    survivors:survivors.map(f=>f.id),
    remainingHp,
    hpLost:startingHp-remainingHp,
    allyActions:b.allyActions,
    allTurns:b.turn-1,
    stars:MissionData.score("demo-mission-2",b)
  };
}
const parties=[
  ["kael"],
  ["kael","lyra"],
  ["kael","lyra","darin"],
  ["kael","lyra","darin","medic-demo","test-area-damage"]
];
const reports=[];
for(const ids of parties){
  for(const mode of ["tactical-auto","focused-basic"]){
    const baseline=run(ids,mode,false);
    const pilot=run(ids,mode,true);
    assert.deepEqual(run(ids,mode,false),baseline,"old battle must be repeatable");
    assert.deepEqual(run(ids,mode,true),pilot,"new battle must be repeatable");
    assert.equal(baseline.winner==="ally",baseline.stars>0,
      "only a victory may award any stars");
    assert.equal(pilot.winner==="ally",pilot.stars>0);
    for(const k of ["remainingHp","deaths","allyActions","allTurns","stars"])
      assert.ok(Number.isSafeInteger(baseline[k])&&Number.isSafeInteger(pilot[k]));
    reports.push({
      party:ids.join("+"),count:ids.length,mode,
      baseline,pilot,
      delta:{
        remainingHp:pilot.remainingHp-baseline.remainingHp,
        deaths:pilot.deaths-baseline.deaths,
        allyActions:pilot.allyActions-baseline.allyActions,
        stars:pilot.stars-baseline.stars
      }
    });
  }
}
assert.equal(reports.length,8);
assert.ok(reports.every(x=>x.pilot.allyActions>=0));
console.log("BALANCE_AUDIT_JSON="+JSON.stringify({
  version:JSON.parse(read("package.json")).version,
  missionId:"demo-mission-2",
  policies:["tactical-auto","focused-basic"],
  note:"fixed deterministic snapshots, no probabilities, no final balance thresholds",
  runs:reports
}));
