"use strict";
// Combat-015D: all permutations of ordinary core heroes at even/mixed levels.
// Training-only fighters are deliberately excluded from every scenario.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const read=n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8");
const source=["initiative-model.js","ability-data.js","combat-core.js",
  "auto-decision.js","enemy-decision.js","mission-data.js","progress-core.js"].map(read).join("\n");
const {CombatCore,AutoDecision,MissionData,ProgressCore}=vm.runInNewContext(
  source+"\n({CombatCore,AutoDecision,MissionData,ProgressCore})");
const game=read("game.js");
const roster=vm.runInNewContext(game.slice(0,game.indexOf("const $="))+"\nHEROES");
const regular=roster.filter(f=>["kael","lyra","darin"].includes(f.id));
const enemies=roster.filter(f=>f.side==="enemy");
const mission=MissionData.get("demo-mission-2");
const orderings=all=>{
  const result=[];
  const extend=(selected,remaining)=>{
    if(selected.length)result.push(selected);
    for(let i=0;i<remaining.length;i++)
      extend([...selected,remaining[i]],remaining.filter((_,j)=>j!==i));
  };
  extend([],all);
  return result;
};
const parties=orderings(["kael","lyra","darin"]);
assert.equal(parties.length,15);
function levelsFor(party){
  const combos=[[1,1,1],[2,2,2],[3,3,3]].map(xs=>xs.slice(0,party.length));
  if(party.length===3)combos.push(...orderings([1,2,3]).filter(xs=>xs.length===3));
  // For two-hero teams compare all heterogeneous level pairs as well.
  if(party.length===2)for(const a of [1,2,3])for(const b of [1,2,3])
    if(a!==b)combos.push([a,b]);
  return combos;
}
function run(party,levels,mode,pilot){
  const upgrades=ProgressCore.createProgress(regular);
  party.forEach((id,i)=>{upgrades.levels[id]=levels[i]});
  const fighters=party.map(id=>ProgressCore.heroStats(upgrades,
    regular.find(f=>f.id===id)));
  const foes=enemies.map(f=>({
    ...f,...pilot&&mission.enemyAiProfiles[f.id]
      ?{aiProfile:mission.enemyAiProfiles[f.id]}:{}
  }));
  const battle=CombatCore.createBattle([...fighters,...foes],[],{leaderId:party[0]});
  const initialHp=fighters.reduce((n,f)=>n+f.hp,0);
  CombatCore.advanceToPlayerTurn(battle);
  let turns=0;
  while(battle.active&&turns++<600){
    assert.equal(battle.fighters[battle.currentActor]?.side,"ally");
    if(mode==="tactical-auto"){
      const plan=AutoDecision.chooseAction(battle);
      assert.ok(plan);
      assert.ok(CombatCore.performAutoAction(battle,plan));
    }else if(mode==="focus-basic"){
      const target=battle.fighters.map((f,i)=>({f,i}))
        .filter(x=>x.f.side==="enemy"&&x.f.hp>0)
        .sort((a,b)=>a.f.hp-b.f.hp||a.i-b.i)[0];
      assert.ok(target);
      assert.ok(CombatCore.chooseEnemy(battle,target.i));
      assert.ok(CombatCore.performPlayerAbility(battle,"basic"));
    }else{
      throw Error("unknown mode");
    }
  }
  assert.ok(turns<600,"all encounters must finish");
  const living=battle.fighters.filter(f=>f.side==="ally"&&f.hp>0);
  return {winner:battle.winner,stars:MissionData.score(mission.id,battle),
    deaths:party.length-living.length,
    remainingHp:living.reduce((n,f)=>n+f.hp,0),
    hpLost:initialHp-living.reduce((n,f)=>n+f.hp,0),
    allyActions:battle.allyActions};
}
const summaries=[];
const interesting=[];
for(const party of parties){
 for(const levels of levelsFor(party)){
  for(const mode of ["tactical-auto","focus-basic"]){
   const before=run(party,levels,mode,false);
   const after=run(party,levels,mode,true);
   const again=run(party,levels,mode,true);
   assert.deepEqual(after,again,"replay must be deterministic");
   assert.equal(before.stars>0,before.winner==="ally");
   assert.equal(after.stars>0,after.winner==="ally");
   const item={party:party.join("+"),levels:levels.join(","),mode,before,after};
   summaries.push(item);
   if(before.winner!==after.winner||before.stars!==after.stars||
      before.deaths!==after.deaths)interesting.push(item);
  }
 }
}
const tally=entries=>({
 cases:entries.length,
 baselineWins:entries.filter(x=>x.before.winner==="ally").length,
 pilotWins:entries.filter(x=>x.after.winner==="ally").length,
 winsImproved:entries.filter(x=>x.before.winner!=="ally"&&x.after.winner==="ally").length,
 winsWorsened:entries.filter(x=>x.before.winner==="ally"&&x.after.winner!=="ally").length,
 starsImproved:entries.filter(x=>x.after.stars>x.before.stars).length,
 starsWorsened:entries.filter(x=>x.after.stars<x.before.stars).length,
 deathsImproved:entries.filter(x=>x.after.deaths<x.before.deaths).length,
 deathsWorsened:entries.filter(x=>x.after.deaths>x.before.deaths).length,
 maxBaselineStars:Math.max(...entries.map(x=>x.before.stars)),
 maxPilotStars:Math.max(...entries.map(x=>x.after.stars))
});
const grouped={overall:tally(summaries)};
for(const size of [1,2,3])grouped["size"+size]=tally(summaries.filter(x=>x.party.split("+").length===size));
for(const mode of ["tactical-auto","focus-basic"])grouped[mode]=tally(summaries.filter(x=>x.mode===mode));
console.log("BALANCE_CORE_HERO_JSON="+JSON.stringify({
  coreHeroes:regular.map(x=>x.id),partyOrders:parties.length,
  scenarioPairs:summaries.length,
  note:"Only real three ordinary heroes; all nonempty permutations, mixed and uniform levels, two scripted strategies",
  grouped,interesting
}));
