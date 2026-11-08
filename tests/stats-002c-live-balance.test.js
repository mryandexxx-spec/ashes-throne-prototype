"use strict";
// Stats-002C: simulation of the ACTUAL pilot profile builder from game.js.
// No simulated PR #113 monkeypatch or mission balance adjustment.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8");
const game=read("game.js"),begin=game.indexOf("const PILOT_HERO_STATS="),end=game.indexOf("function hasLeaderSkill",begin);
assert.ok(begin>0&&end>begin);
const scripts=["initiative-model.js","ability-data.js","combat-core.js",
 "auto-decision.js","enemy-decision.js","mission-data.js","gear-data.js","progress-core.js"].map(read).join("\n")+
 "\n"+game.slice(0,game.indexOf("const $="))+
 "\nconst progress=ProgressCore.createProgress(HEROES.filter(h=>h.side==='ally'));\n"+
 game.slice(begin,end)+
 "\n({HEROES,progress,CombatCore,AutoDecision,MissionData,ProgressCore,progressedHero,progressedEnemy})";
const api=vm.runInNewContext(scripts);
const {HEROES,progress,CombatCore,AutoDecision,MissionData,ProgressCore,progressedHero,progressedEnemy}=api;
const allies=HEROES.filter(h=>h.side==="ally"),enemies=HEROES.filter(h=>h.side==="enemy");
const primary=["kael","lyra","darin"];
const missions=["black-pass-ambush","demo-mission-2","demo-mission-3"];
const groups=[["kael"],primary,[...primary].reverse()];
function run(missionId,partyIds,level,policy,pilot){
 for(const id of primary)progress.levels[id]=level;
 const p=partyIds.map(id=>{
  const h=allies.find(x=>x.id===id);
  return pilot?progressedHero(h):ProgressCore.heroStats(progress,h);
 });
 const enemiesFor=missionId==="demo-mission-2"?enemies:enemies.slice(0,2);
 const foe=enemy=>pilot?progressedEnemy(enemy):{...enemy};
 const next=(MissionData.get(missionId).futureEnemyWaves||[]).map(ids=>ids.map(id=>{
  const template=enemies.find(x=>x.id===id);
  assert.ok(template);
  return foe(template);
 }));
 const battle=CombatCore.createBattle([...p,...enemiesFor.map(foe)],next,{leaderId:partyIds[0]});
 CombatCore.advanceToPlayerTurn(battle);
 let n=0;
 while(battle.active&&n++<900){
  assert.equal(battle.fighters[battle.currentActor]?.side,"ally");
  if(policy==="auto"){
   const plan=AutoDecision.chooseAction(battle);
   assert.ok(plan);
   assert.equal(CombatCore.performAutoAction(battle,plan),true);
  }else{
   const enemiesLeft=battle.fighters.map((f,i)=>({f,i})).filter(x=>x.f.side==="enemy"&&x.f.hp>0)
     .sort((a,b)=>a.f.hp-b.f.hp||a.i-b.i);
   assert.ok(enemiesLeft.length);
   assert.equal(CombatCore.chooseEnemy(battle,enemiesLeft[0].i),true);
   assert.equal(CombatCore.performPlayerAbility(battle,"basic"),true);
  }
 }
 assert.ok(n<900,"battle must terminate");
 const living=battle.fighters.filter(f=>f.side==="ally"&&f.hp>0);
 return {winner:battle.winner,stars:MissionData.score(missionId,battle),
  deaths:partyIds.length-living.length,
  allyActions:battle.allyActions,
  remainingHp:living.reduce((s,f)=>s+f.hp,0)};
}
const cases=[];
for(const missionId of missions)for(const ids of groups)
for(const level of [1,3])for(const policy of ["auto","focused-basic"]){
 const before=run(missionId,ids,level,policy,false);
 const after=run(missionId,ids,level,policy,true);
 assert.deepEqual(run(missionId,ids,level,policy,true),after);
 cases.push({missionId,party:ids.join("+"),level,policy,before,after});
}
assert.equal(cases.length,36);
const sum=values=>({wins:values.filter(x=>x.winner==="ally").length,
 deaths:values.reduce((n,x)=>n+x.deaths,0),
 stars:values.reduce((n,x)=>n+x.stars,0),
 avgActions:Number((values.reduce((n,x)=>n+x.allyActions,0)/values.length).toFixed(2))});
const report=Object.fromEntries(missions.map(m=>{
 const rows=cases.filter(x=>x.missionId===m);
 return [m,{baseline:sum(rows.map(x=>x.before)),
  pilot:sum(rows.map(x=>x.after)),
  winnersChanged:rows.filter(x=>x.before.winner!==x.after.winner).length,
  starsLower:rows.filter(x=>x.after.stars<x.before.stars).length,
  starsHigher:rows.filter(x=>x.after.stars>x.before.stars).length}];
}));
console.log("STATS002C_LIVE_BALANCE_JSON="+JSON.stringify({cases:cases.length,report,
 note:"Actual game.js pilot functions and production combat, 3 missions, Kael/three main/reversed, level 1 or 3, auto and scripted basic focus. This is not a player win-rate survey."}));
