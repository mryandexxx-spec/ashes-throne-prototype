"use strict";
// Stats-002A research only. Gameplay files and real characters remain untouched.
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8");
const sourceNames=["initiative-model.js","ability-data.js","combat-core.js",
  "auto-decision.js","enemy-decision.js","mission-data.js","progress-core.js"];
const source=sourceNames.map(read).join("\n");
const baseline=vm.runInNewContext(source+"\n({CombatCore,AutoDecision,MissionData,ProgressCore})");
const typedSource=source.replace("const AbilityData=(()=>","let AbilityData=(()=>");
assert.notEqual(typedSource,source,"test must replace the exact binding");
const typedPatch=[
"const oldAbilityData=AbilityData;",
"AbilityData=Object.freeze({...oldAbilityData,get:(actor,id)=>{",
" const definition=oldAbilityData.get(actor,id);",
" return id==='basic'&&definition?.kind==='damage'",
"   ? {...definition,damageType:'physical'}:definition;",
"}});",
"({CombatCore,AutoDecision,MissionData,ProgressCore})"
].join("\n");
const typed=vm.runInNewContext(typedSource+"\n"+typedPatch);
const heroSrc=read("game.js"),end=heroSrc.indexOf("const $=");
assert.ok(end>0);
const roster=vm.runInNewContext(heroSrc.slice(0,end)+"\nHEROES");
const allies=roster.filter(h=>h.side==="ally");
const enemies=roster.filter(h=>h.side==="enemy");
assert.deepEqual(Array.from(allies,x=>x.id),["kael","lyra","darin","medic-demo","test-area-damage"]);
const missionIds=["black-pass-ambush","demo-mission-2","demo-mission-3"];
const partySets=[["kael","lyra","darin"],Array.from(allies,x=>x.id)];
function scenario(model,missionId,ids,level,policy,mode){
 const {CombatCore,AutoDecision,MissionData,ProgressCore}=model;
 const p=ProgressCore.createProgress(allies);
 ids.forEach(id=>{p.levels[id]=level});
 const heroes=ids.map(id=>ProgressCore.heroStats(p,allies.find(x=>x.id===id)));
 const template=missionId==="demo-mission-2"?enemies:enemies.slice(0,2);
 const def=MissionData.get(missionId);
 const waves=(def.futureEnemyWaves||[]).map(wave=>wave.map(id=>enemies.find(x=>x.id===id)));
 const convert=x=>{
   const unit={...x};
   if(mode!=="baseline"){
     unit.physicalAttack=unit.atk;
     unit.physicalDefense=mode==="stress"&&unit.side==="enemy"?25:0;
     unit.protection=mode==="stress"&&unit.side==="enemy"?10:0;
     unit.maxProtection=unit.protection;
   }
   return unit;
 };
 const party=heroes.map(convert),foes=template.map(convert);
 const battle=CombatCore.createBattle([...party,...foes],waves.map(w=>w.map(convert)),
   {leaderId:ids[0]});
 CombatCore.advanceToPlayerTurn(battle);
 let n=0;
 while(battle.active&&n++<1000){
   assert.equal(battle.fighters[battle.currentActor]?.side,"ally");
   if(policy==="auto"){
     const action=AutoDecision.chooseAction(battle);
     assert.ok(action);
     assert.equal(CombatCore.performAutoAction(battle,action),true);
   }else{
     const target=battle.fighters.map((f,i)=>({f,i})).filter(x=>x.f.side==="enemy"&&x.f.hp>0)
       .sort((a,b)=>a.f.hp-b.f.hp||a.i-b.i)[0];
     assert.ok(target);
     assert.equal(CombatCore.chooseEnemy(battle,target.i),true);
     assert.equal(CombatCore.performPlayerAbility(battle,"basic"),true);
   }
 }
 assert.ok(n<1000,"scenario finished");
 assert.equal(battle.active,false);
 const survivors=battle.fighters.filter(x=>x.side==="ally"&&x.hp>0);
 return {winner:battle.winner,stars:MissionData.score(missionId,battle),
  allyActions:battle.allyActions,deaths:ids.length-survivors.length,
  remainingHp:survivors.reduce((s,x)=>s+x.hp,0)};
}
const rows=[];
for(const missionId of missionIds)
for(const ids of partySets)
for(const level of [1,3])
for(const policy of ["auto","focused-basic"]){
 const a=scenario(baseline,missionId,ids,level,policy,"baseline");
 const b=scenario(typed,missionId,ids,level,policy,"neutral");
 const again=scenario(typed,missionId,ids,level,policy,"neutral");
 const stress=scenario(typed,missionId,ids,level,policy,"stress");
 assert.deepEqual(b,a,"neutral transition must match all legacy results");
 assert.deepEqual(again,b,"deterministic neutral run");
 rows.push({missionId,party:ids.join("+"),level,policy,baseline:a,neutral:b,stress});
}
assert.equal(rows.length,24);
const tally=x=>({cases:x.length,wins:x.filter(y=>y.winner==="ally").length,
 avgActions:Number((x.reduce((s,y)=>s+y.allyActions,0)/x.length).toFixed(2)),
 totalDeaths:x.reduce((s,y)=>s+y.deaths,0),
 totalStars:x.reduce((s,y)=>s+y.stars,0)});
const groups={};
for(const id of missionIds){
 const scope=rows.filter(x=>x.missionId===id);
 groups[id]={baseline:tally(scope.map(x=>x.baseline)),
  stress:tally(scope.map(x=>x.stress)),
  changedWinners:scope.filter(x=>x.baseline.winner!==x.stress.winner).length,
  lowerStars:scope.filter(x=>x.stress.stars<x.baseline.stars).length,
  higherStars:scope.filter(x=>x.stress.stars>x.baseline.stars).length};
}
const summary={scenarios:rows.length,neutralExactMatches:rows.length,
 note:"Test-only typed physical basic attack, equal ATK, zero neutral defenses/protection; stress enemy DEF=25 Protection=10, not character design",
 groups,changes:rows.filter(x=>JSON.stringify(x.baseline)!==JSON.stringify(x.stress))
  .map(x=>({mission:x.missionId,party:x.party,level:x.level,policy:x.policy,
   base:x.baseline,stress:x.stress}))};
console.log("STATS002A_COMPARISON_JSON="+JSON.stringify(summary));
