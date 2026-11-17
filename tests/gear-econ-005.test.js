"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const M=require("../scripts/gear-econ-005.cjs");
const GearData=require("../gear-data.js");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const ProgressCore=vm.runInNewContext(
 fs.readFileSync(path.join(__dirname,"../progress-core.js"),"utf8")+"\nProgressCore",
 {GearData});
test("GEAR-ECON-005 reads current source data without mutation",()=>{
 const before=JSON.stringify(ProgressCore.MISSION_GEAR_FARM);
 const src=M.sources("current"),a=M.firstClear(src);
 assert.deepEqual(a,{Fe:9,Le:8,Cl:15,Wo:1,Fa:6,Th:4,Gl:1,currency:5330,xp:315});
 assert.equal(a.currency,ProgressCore.FIRST_CLEAR_REWARDS["black-pass-ambush"].currency+
  ProgressCore.FIRST_CLEAR_REWARDS["demo-mission-2"].currency+
  ProgressCore.FIRST_CLEAR_REWARDS["demo-mission-3"].currency+
  Object.values(ProgressCore.MISSION_GEAR_FARM).reduce((n,x)=>n+x.currency,0));
 assert.equal(M.gearCost(3),6750);
 assert.equal(M.gearCost(8),43000);
 assert.equal(M.gearCost(13),110500);
 assert.equal(M.gearCost(13,5),552500);
 assert.equal(JSON.stringify(ProgressCore.MISSION_GEAR_FARM),before);
 assert.equal(GearData.MAX_TIER,13);
});
test("GEAR-ECON-005 includes all six real items at every tier",()=>{
 assert.deepEqual(M.requirements(["melee"],3),{
  Fe:31,Le:18,Cl:22,Wo:2,Fa:18,Th:6,Gl:0,currency:6750
 });
 assert.deepEqual(M.requirements(["ranged"],13),{
  Fe:8,Le:283,Cl:38,Wo:475,Fa:11,Th:425,Gl:50,currency:110500
 });
 assert.deepEqual(M.requirements(["mage"],13),{
  Fe:4,Le:66,Cl:489,Wo:28,Fa:8,Th:253,Gl:437,currency:110500
 });
});
test("GEAR-ECON-005 exact current optimum exposes wood and glass bottlenecks",()=>{
 const bank=M.firstClear(M.sources());
 const goals={
  melee:[1826,170],ranged:[5328,523],mage:[5502,463],
  support:[1764,166],tank:[1840,171]
 };
 for(const [cls,[energy,runs]] of Object.entries(goals)){
  const s=M.optimize(M.requirements([cls],13),M.sources(),bank);
  assert.equal(s.energy,energy,cls);
  assert.equal(s.runs,runs,cls);
  assert.equal(s.perMission["demo-mission-3"],0,cls);
  assert.ok(Object.values(s.remainder).every(x=>x>=0));
 }
});
test("GEAR-ECON-005 five-hero and scenario comparisons stay reproducible",()=>{
 const current=M.sources();
 const five=M.optimize(M.requirements(M.ACTIVE_FIVE,13),current,M.firstClear(current));
 assert.equal(five.energy,8900);
 assert.equal(five.runs,839);
 const diverse=M.optimize(M.requirements(M.DIVERSE_FIVE,13),current,M.firstClear(current));
 assert.equal(diverse.energy,13508);
 const targeted=M.sources("targeted"),td=M.optimize(M.requirements(M.DIVERSE_FIVE,13),
  targeted,M.firstClear(targeted));
 assert.equal(td.energy,6806);
 const diversified=M.sources("diversified"),dd=M.optimize(M.requirements(M.DIVERSE_FIVE,13),
  diversified,M.firstClear(diversified));
 assert.equal(dd.energy,6622);
 assert.ok(dd.perMission["demo-mission-3"]>0);
 assert.equal(ProgressCore.MISSION_GEAR_FARM["black-pass-ambush"].materials.Wo,1,
  "optimizer scenarios must never change game drops");
});
