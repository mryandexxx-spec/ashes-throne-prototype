"use strict";
// Combat-015D extended audit: permutations, lineup sizes and progression levels.
// The simulator reads production gameplay definitions; no gameplay edits.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const read=n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8");
const script=["initiative-model.js","ability-data.js","combat-core.js",
  "auto-decision.js","enemy-decision.js","mission-data.js","progress-core.js"].map(read).join("\n");
const {CombatCore,AutoDecision,MissionData,ProgressCore}=vm.runInNewContext(
  script+"\n({CombatCore,AutoDecision,MissionData,ProgressCore})");
const game=read("game.js");
const roster=vm.runInNewContext(game.slice(0,game.indexOf("const $="))+"\nHEROES");
const allies=roster.filter(h=>h.side==="ally");
const enemies=roster.filter(h=>h.side==="enemy");
const ids=allies.map(h=>h.id);
assert.deepEqual(Array.from(ids),["kael","lyra","darin","medic-demo","test-area-damage"]);
assert.equal(enemies.length,5);
const mission=MissionData.get("demo-mission-2");
assert.equal(mission.enemyAiProfiles.shade,"aggressive");
const orders=[
  ["kael"],
  ["lyra"],
  ["darin"],
  ["kael","lyra"],
  ["lyra","kael"],
  ["darin","kael"],
  ["kael","darin"],
  ["kael","lyra","darin"],
  ["lyra","kael","darin"],
  ["darin","lyra","kael"],
  ["kael","medic-demo","darin"],
  ["medic-demo","kael","darin"],
  ids,
  [...ids].reverse(),
  ["medic-demo","kael","test-area-damage","lyra","darin"],
  ["lyra","darin","kael","test-area-damage","medic-demo"]
];
function simulation(partyIds,level,mode,pilot){
  const progress=ProgressCore.createProgress(allies);
  for(const id of partyIds)progress.levels[id]=level;
  const party=partyIds.map(id=>ProgressCore.heroStats(progress,
    allies.find(f=>f.id===id)));
  const foes=enemies.map(f=>({...f,...(pilot&&mission.enemyAiProfiles[f.id]
    ?{aiProfile:mission.enemyAiProfiles[f.id]}:{})}));
  const b=CombatCore.createBattle([...party,...foes],[],{leaderId:partyIds[0]});
  const initial=party.reduce((sum,x)=>sum+x.hp,0);
  CombatCore.advanceToPlayerTurn(b);
  let iterations=0;
  while(b.active&&iterations++<700){
    assert.equal(b.fighters[b.currentActor].side,"ally");
    if(mode==="tactical-auto"){
      const plan=AutoDecision.chooseAction(b);
      assert.ok(plan);
      assert.ok(CombatCore.performAutoAction(b,plan));
    }else{
      const targets=b.fighters.map((f,i)=>({f,i}))
        .filter(({f})=>f.side==="enemy"&&f.hp>0)
        .sort((x,y)=>x.f.hp-y.f.hp||x.i-y.i);
      assert.ok(targets.length);
      assert.ok(CombatCore.chooseEnemy(b,targets[0].i));
      assert.ok(CombatCore.performPlayerAbility(b,"basic"));
    }
  }
  assert.ok(iterations<700,"must finish");
  const living=b.fighters.filter(f=>f.side==="ally"&&f.hp>0);
  const remainingHp=living.reduce((sum,x)=>sum+x.hp,0);
  return {winner:b.winner,stars:MissionData.score(mission.id,b),
    deaths:party.length-living.length,remainingHp,
    lostHp:initial-remainingHp,allyActions:b.allyActions};
}
const cases=[];
for(const party of orders)for(const level of [1,2,3])
for(const mode of ["tactical-auto","focused-basic"]){
  const baseline=simulation(party,level,mode,false);
  const pilot=simulation(party,level,mode,true);
  const repeated=simulation(party,level,mode,true);
  assert.deepEqual(pilot,repeated,"deterministic repeat");
  assert.equal(baseline.winner==="ally",baseline.stars>0);
  assert.equal(pilot.winner==="ally",pilot.stars>0);
  cases.push({party:party.join("+"),size:party.length,level,mode,baseline,pilot});
}
assert.equal(cases.length,orders.length*3*2);
const tally=scope=>{
  const rows=cases.filter(scope);
  const differences=rows.filter(x=>x.baseline.winner!==x.pilot.winner);
  const summary={pairs:rows.length,
    baselineWins:rows.filter(x=>x.baseline.winner==="ally").length,
    pilotWins:rows.filter(x=>x.pilot.winner==="ally").length,
    winsImproved:differences.filter(x=>x.pilot.winner==="ally").length,
    winsWorsened:differences.filter(x=>x.pilot.winner==="enemy").length,
    deathsImproved:rows.filter(x=>x.pilot.deaths<x.baseline.deaths).length,
    deathsWorsened:rows.filter(x=>x.pilot.deaths>x.baseline.deaths).length,
    starsImproved:rows.filter(x=>x.pilot.stars>x.baseline.stars).length,
    starsWorsened:rows.filter(x=>x.pilot.stars<x.baseline.stars).length,
    hpImproved:rows.filter(x=>x.pilot.remainingHp>x.baseline.remainingHp).length,
    hpWorsened:rows.filter(x=>x.pilot.remainingHp<x.baseline.remainingHp).length};
  return summary;
};
const groups={overall:tally(()=>true)};
for(const level of [1,2,3])groups["level"+level]=tally(x=>x.level===level);
for(const size of [1,2,3,5])groups["size"+size]=tally(x=>x.size===size);
for(const mode of ["tactical-auto","focused-basic"])groups[mode]=tally(x=>x.mode===mode);
const changes=cases.filter(x=>x.baseline.winner!==x.pilot.winner||
 x.baseline.deaths!==x.pilot.deaths||x.baseline.stars!==x.pilot.stars)
 .map(x=>({party:x.party,level:x.level,mode:x.mode,
  baseline:[x.baseline.winner,x.baseline.deaths,x.baseline.stars],
  pilot:[x.pilot.winner,x.pilot.deaths,x.pilot.stars]}));
console.log("BALANCE_EXTENDED_JSON="+JSON.stringify({levels:[1,2,3],
  testedOrders:orders.length,modes:["tactical-auto","focused-basic"],
  groups,majorChanges:changes}));
