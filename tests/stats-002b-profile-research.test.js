"use strict";
// Stats-002B research only. Production hero/ability data are untouched.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8");
const source=["initiative-model.js","ability-data.js","combat-core.js","auto-decision.js","enemy-decision.js","mission-data.js","progress-core.js"].map(read).join("\n");
const legacy=vm.runInNewContext(source+"\n({CombatCore,AutoDecision,MissionData,ProgressCore})");
const mutable=source.replace("const AbilityData=(()=>","let AbilityData=(()=>");
assert.notEqual(source,mutable);
const patch=[
 "const original=AbilityData;",
 "AbilityData=Object.freeze({...original,get:(actor,id)=>{",
 " const ability=original.get(actor,id);",
 " if(ability?.kind==='damage'&&(id==='basic'||",
 " (['lyra','darin'].includes(actor?.id)&&['special','powerful'].includes(id))))",
 " return {...ability,damageType:'physical'};",
 " return ability;",
 "}});",
 "({CombatCore,AutoDecision,MissionData,ProgressCore})"
].join("\n");
const candidate=vm.runInNewContext(mutable+"\n"+patch);
const game=read("game.js"),roster=vm.runInNewContext(game.slice(0,game.indexOf("const $="))+"\nHEROES");
const templates=Array.from(roster,x=>({...x}));
const mainIds=["kael","lyra","darin"];
const ally=id=>templates.find(x=>x.id===id);
const enemies=templates.filter(x=>x.side==="enemy");
const profiles={kael:[24,12,20],lyra:[6,15,0],darin:[14,9,0]};
function simulate(api,missionId,partyIds,level,policy,useProfile){
 const {CombatCore,AutoDecision,MissionData,ProgressCore}=api;
 const progress=ProgressCore.createProgress(mainIds.map(ally));
 for(const id of partyIds)progress.levels[id]=level;
 const decorate=x=>{
   const f={...x};
   if(useProfile){
    const [pd,md,pro]=f.side==="ally"?profiles[f.id]:[8,8,0];
    assert.ok(Number.isFinite(pd));
    f.physicalAttack=f.atk; // progressed ATK, including paid level/gear upgrades
    f.physicalDefense=pd;f.magicDefense=md;f.protection=pro;f.maxProtection=pro;
   }
   return f;
 };
 const active=partyIds.map(id=>decorate(ProgressCore.heroStats(progress,ally(id))));
 const foes=(missionId==="demo-mission-2"?enemies:enemies.slice(0,2)).map(decorate);
 const waves=(MissionData.get(missionId).futureEnemyWaves||[]).map(ids=>ids.map(id=>{
   const x=enemies.find(e=>e.id===id);assert.ok(x);return decorate(x);
 }));
 const battle=CombatCore.createBattle([...active,...foes],waves,{leaderId:partyIds[0]});
 CombatCore.advanceToPlayerTurn(battle);
 let iterations=0;
 while(battle.active&&iterations++<1000){
  assert.equal(battle.fighters[battle.currentActor]?.side,"ally");
  if(policy==="auto"){
    const plan=AutoDecision.chooseAction(battle);assert.ok(plan);
    assert.equal(CombatCore.performAutoAction(battle,plan),true);
  }else{
    const next=battle.fighters.map((f,i)=>({f,i})).filter(x=>x.f.side==="enemy"&&x.f.hp>0)
      .sort((a,b)=>a.f.hp-b.f.hp||a.i-b.i)[0];
    assert.ok(next);assert.equal(CombatCore.chooseEnemy(battle,next.i),true);
    assert.equal(CombatCore.performPlayerAbility(battle,"basic"),true);
  }
 }
 assert.ok(iterations<1000,"battle should terminate");
 const living=battle.fighters.filter(f=>f.side==="ally"&&f.hp>0);
 return {winner:battle.winner,stars:MissionData.score(missionId,battle),
  deaths:partyIds.length-living.length,allyActions:battle.allyActions,
  remainingHp:living.reduce((s,f)=>s+f.hp,0)};
}
const cases=[],missions=["black-pass-ambush","demo-mission-2","demo-mission-3"];
const parties=[["kael"],mainIds,[...mainIds].reverse()];
for(const mission of missions)for(const ids of parties)for(const level of [1,3])
for(const policy of ["auto","focused-basic"]){
 const before=simulate(legacy,mission,ids,level,policy,false);
 const after=simulate(candidate,mission,ids,level,policy,true);
 assert.deepEqual(after,simulate(candidate,mission,ids,level,policy,true));
 cases.push({mission,party:ids.join("+"),level,policy,before,after});
}
assert.equal(cases.length,36);
const tally=arr=>({wins:arr.filter(x=>x.winner==="ally").length,
 totalStars:arr.reduce((n,x)=>n+x.stars,0),
 totalDeaths:arr.reduce((n,x)=>n+x.deaths,0),
 meanActions:Number((arr.reduce((n,x)=>n+x.allyActions,0)/arr.length).toFixed(2))});
const groups=Object.fromEntries(missions.map(m=>{
 const subset=cases.filter(x=>x.mission===m);
 return [m,{cases:subset.length,baseline:tally(subset.map(x=>x.before)),
   proposal:tally(subset.map(x=>x.after)),
   winsLost:subset.filter(x=>x.before.winner==="ally"&&x.after.winner!=="ally").length,
   winsGained:subset.filter(x=>x.before.winner!=="ally"&&x.after.winner==="ally").length,
   lowerStars:subset.filter(x=>x.after.stars<x.before.stars).length,
   higherStars:subset.filter(x=>x.after.stars>x.before.stars).length}];
}));
const diffs=cases.filter(x=>JSON.stringify(x.before)!==JSON.stringify(x.after));
console.log("STATS002B_PROFILE_JSON="+JSON.stringify({cases:cases.length,changed:diffs.length,groups,
 note:"Research only: Kael physical/magical defense 24/12 Protection 20; Lyra 6/15 Protection 0; Darin 14/9 Protection 0; enemies defense 8/8 Protection 0. All basics and Lyra/Darin damage skills tentatively physical in VM only.",
 examples:diffs.slice(0,10)}));
