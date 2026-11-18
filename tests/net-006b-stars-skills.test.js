"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const StarCore=require("../star-core.js"),SkillCore=require("../skill-core.js");
const S=require("../scripts/net-006b-stars-skills-sensitivity.cjs");
test("NET-006B shard and skill rates reproduce current rank and ability costs",()=>{
 assert.match(S.selfTest(),/11\/11/);
 assert.equal(S.requirements(5).shardsForOneDirectJoin,320);
 assert.equal(S.requirements(10).shardsForOneClosedHero,StarCore.TOTAL);
 assert.equal(S.ABILITY_COST.currency,SkillCore.STEPS.slice(1).reduce((n,c)=>n+c.currency,0));
 assert.equal(S.requirements(5).manual1,100);
 assert.equal(S.requirements(5).manual2,160);
 assert.equal(S.requirements(10).seal,35);
});
test("NET-006B shard priority has a material-clue opportunity cost",()=>{
 const all=S.shardRun({seed:42,activity:"regular",focusFraction:1,heroes:1});
 const split=S.shardRun({seed:42,activity:"regular",focusFraction:1/3,heroes:1});
 assert.ok(Number.isInteger(all.day)&&all.day>0);
 assert.ok(Number.isInteger(split.day)&&split.day>all.day);
 assert.equal(all.materialClues,0);
 assert.ok(split.materialClues>0);
 assert.ok(split.shardClues<all.shardClues*10);
 const repeat=S.shardRun({seed:42,activity:"regular",focusFraction:1/3,heroes:1});
 assert.deepEqual(split,repeat);
});
test("NET-006B proposed consumable flow slower for roster of ten, not a live reward",()=>{
 for(const activity of ["casual","regular","intensive"]){
  const five=S.calendar({activity,heroes:5});
  const ten=S.calendar({activity,heroes:10});
  assert.ok(ten.bottleneckDays>five.bottleneckDays);
  assert.equal(five.sourceHypothesis.weeklySeals,2);
 }
 assert.throws(()=>S.calendar({activity:"regular",manual2PerLogin:0}));
});
