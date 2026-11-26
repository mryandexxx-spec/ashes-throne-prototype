"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const src=["initiative-model.js","ability-data.js","combat-status-core.js","combat-core.js","lab-command-loop/command-loop.js"].map(f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8")).join("\n");
const api=vm.runInNewContext(src+"\nCommandLoopLab.create(CombatCore,AbilityData)");
const make=()=>vm.runInNewContext(src+"\nCommandLoopLab.create(CombatCore,AbilityData)");
function play(lab,id,{cover=true,priority="shade"}={}){
 assert.equal(lab.start(id),true);
 for(let n=0;n<60&&lab.view().active;n++){
  const v=lab.view(),actor=v.actor,enemy=v.fighters.find(f=>f.id===priority&&f.hp>0)||v.fighters.find(f=>f.side==="enemy"&&f.hp>0);
  const special=v.actions.find(a=>a.id==="special");
  const skill=actor==="art"&&cover&&special?.targets.includes("ren")?"special":actor==="ren"&&special?.targets.includes(enemy.id)?"special":"basic";
  assert.equal(lab.action(skill,actor==="art"&&skill==="special"?"ren":enemy.id),true);
 }
 assert.equal(lab.view().active,null);return lab.view().last;
}
test("native objectives, real proof, and permanent alternate approach",()=>{
 const l=api;
 assert.equal(l.view().rank,1);assert.equal(l.start("delegated"),false);
 assert.equal(play(l,"agreement",{cover:false}).gained,false);assert.equal(l.view().rank,1);
 assert.equal(play(l,"agreement").gained,true);assert.equal(l.view().rank,2);
 assert.equal(play(l,"agreement").gained,false);
 assert.equal(play(l,"joint",{priority:"ves"}).winner,"enemy");
 assert.equal(l.view().rank,2);assert.equal(play(l,"joint").gained,true);
 assert.equal(l.view().rank,2);assert.equal(play(l,"field").gained,true);
 assert.equal(l.view().rank,3);
 const direct=play(l,"standard"),alt=play(l,"delegated");
 assert.equal(direct.winner,"ally");assert.equal(direct.remainingEnemies,0);
 assert.equal(alt.winner,"ally");assert.equal(alt.outcome,"held");assert.ok(alt.remainingEnemies>0);
 assert.ok(alt.actions<direct.actions);
});
test("abandon, invalid action, inaccessible route and independent session",()=>{
 const l=make();assert.equal(l.start("joint"),false);assert.equal(l.start("agreement"),true);
 assert.equal(l.start("standard"),false);assert.equal(l.action("fake","ren"),false);
 assert.equal(l.action("basic","ren"),false);assert.equal(l.view().turns,0);
 assert.equal(l.abandon(),true);assert.equal(l.abandon(),false);assert.equal(l.view().rank,1);
 assert.equal(l.view().earned.length,0);assert.equal(make().view().rank,1);
});
