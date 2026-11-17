"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const path=require("node:path"),fs=require("node:fs"),vm=require("node:vm");
const model=require("../scripts/gear-econ-multimode-proposal.cjs");
const GearData=require("../gear-data.js");
const ProgressCore=vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../progress-core.js"),"utf8")+
 "\nProgressCore",{GearData});
test("GEAR-ECON-005B prospective rewards are one-time-only, never modifying live loot",()=>{
 const before=JSON.stringify(ProgressCore.MISSION_GEAR_FARM);
 const report=model.report();
 assert.match(report.status,/PROPOSAL ONLY/);
 assert.equal(model.ALL.length,15);
 assert.equal(new Set(model.ALL.map(p=>p.id)).size,15);
 assert.equal(model.LORE.length,5);
 assert.deepEqual(model.LORE.map(p=>p.trigger),[
  "five-shadows:fs-03","five-shadows:fs-06","five-shadows:fs-09",
  "five-shadows:fs-12","five-shadows:fs-15"
 ]);
 assert.ok(model.ALL.every(p=>p.id.endsWith(":first")||p.id.startsWith("lore:")),
  "all proposal receipts are first-clear or act-completion only");
 assert.deepEqual(report.proposedSourceTotals.lore,{
  Fe:35,Le:36,Cl:46,Wo:8,Fa:24,Th:20,Gl:6,currency:15500,xp:2200
 });
 assert.equal(JSON.stringify(ProgressCore.MISSION_GEAR_FARM),before);
});
test("GEAR-ECON-005B optimistic one-time total is bounded and insufficient for G13",()=>{
 const x=model.report().scenarios;
 assert.deepEqual(x.optimisticAll.bank,{
  Fe:66,Le:66,Cl:83,Wo:13,Fa:42,Th:42,Gl:12,currency:30530,xp:3545
 });
 assert.equal(x.early.claimedOneTimePacks,6);
 assert.equal(x.optimisticAll.claimedOneTimePacks,15);
 assert.equal(x.baseline.activeFive.G3.energy,420);
 assert.equal(x.early.activeFive.G3.energy,368);
 assert.equal(x.optimisticAll.activeFive.G3.energy,220);
 assert.equal(x.baseline.activeFive.G13.energy,8900);
 assert.equal(x.optimisticAll.activeFive.G13.energy,8648);
 assert.equal(x.baseline.activeFive.G13.repeats,839);
 assert.equal(x.optimisticAll.activeFive.G13.repeats,816);
 assert.equal(x.optimisticAll.activeFive.G13.missions["demo-mission-3"],0);
 assert.equal(x.optimisticAll.activeFive.G13.currencyNeed,552500);
});
