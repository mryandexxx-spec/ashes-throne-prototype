"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const Model=require("../scripts/network-008a-economy.cjs");
const Gear=require("../gear-data.js"),Weekly=require("../weekly-threat-core.js");
const sum=x=>Object.values(x).reduce((a,b)=>a+b,0);
test("NET-008A actual recipes: the 5+5 G8/G13 budget is reproducible",()=>{
 const mainG8=Model.demand(Model.MAIN,8),
  mainG13=Model.demand(Model.MAIN,13),
  tenG13=Model.demand([...Model.MAIN,...Model.SECOND],13);
 assert.equal(sum(mainG8),2814);
 assert.equal(sum(mainG13),6459);
 assert.equal(sum(tenG13),12909);
 assert.equal(mainG13.Le,2268);
 assert.equal(tenG13.Gl,896);
 for(const target of [mainG8,mainG13,tenG13])
  assert.deepEqual(Object.keys(target).sort(),[...Gear.MATERIALS].sort());
});
test("NET-008A weekly rewards use only the existing 7 materials and no late-rank lock",()=>{
 for(const stage of Weekly.TIERS){
  assert.deepEqual(Object.keys(stage.materials).sort(),[...Gear.MATERIALS].sort());
  assert.ok(stage.score>=60);
 }
 assert.equal(sum(Weekly.TIERS[0].materials),106);
 assert.equal(Weekly.TIERS.reduce((n,t)=>n+sum(t.materials),0),258);
});
test("NET-008A optimistic upper bound exposes premature G13 at perfect attendance",()=>{
 const p=Model.simulate({classes:Model.MAIN,highestTier:13,visits:1,stars:3});
 assert.equal(p.firstDay,76);
 const s=Model.simulate({classes:Model.MAIN,highestTier:13,visits:.5,stars:1,weekFrom:2});
 assert.equal(s.firstDay,156);
 const ten=Model.simulate({classes:[...Model.MAIN,...Model.SECOND],highestTier:13,visits:1,stars:3});
 assert.equal(ten.firstDay,131);
 assert.ok(s.firstDay>p.firstDay);
 assert.ok(ten.firstDay>p.firstDay);
});
