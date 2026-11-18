"use strict";
/* NET-006B [ПРЕДЛОЖЕНИЕ]: verify offline research against real main contracts.
 * Does not update live game economics or player saves. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const Model=require("../scripts/net-006b-unified-economy.cjs");
const GearData=require("../gear-data.js");
const Econ=require("../scripts/gear-econ-005.cjs");
const ProgressCore=vm.runInNewContext(
 fs.readFileSync(path.join(__dirname,"../progress-core.js"),"utf8")+"\nProgressCore",
 {GearData});
const TEN=["tank","ranged","melee","support","mage","melee","support","tank","tank","support"];
const vec=row=>GearData.MATERIALS.map(id=>row[id]);
test("NET-006B inputs track live M1-M3 rewards and three first clears",()=>{
 const real=Econ.sources("current");
 assert.equal(real.length,3);
 for(let i=0;i<3;i++){
  const f=Model.farms[i],actual=real[i];
  assert.equal(f.id,["M1","M2","M3"][i]);
  assert.equal(f.energy,actual.energy);
  assert.equal(f.currency,actual.currency);
  assert.equal(f.xp,actual.xp);
  assert.deepEqual(f.m,vec(actual.materials));
 }
 const first=Econ.firstClear(real);
 assert.equal(Model.first.currency,first.currency);
 assert.equal(Model.first.xp,first.xp);
 assert.deepEqual(Model.first.m,vec(first));
 assert.equal(ProgressCore.ENERGY_MAX,240);
 assert.equal(ProgressCore.ENERGY_REGEN_MS,360000);
});
test("NET-006B exact starter and expanded test roster material requirements",()=>{
 const five=Econ.ACTIVE_FIVE;
 for(const [tier,stage] of [[3,"G3"],[8,"G8"],[13,"G13"]]){
  const fiveReal=Econ.requirements(five,tier);
  const tenReal=Econ.requirements(TEN,tier);
  assert.deepEqual(Model.costs[stage].m,vec(fiveReal),stage);
  assert.deepEqual(Model.costs[stage].ten,vec(tenReal),stage+" ten");
  assert.equal(Model.costs[stage].gear,fiveReal.currency);
  assert.equal(tenReal.currency,5*2*Econ.gearCost(tier));
 }
 assert.ok(Model.costs.G13.ten[6]>2*Model.costs.G13.m[6]);
});
test("NET-006B validates account thresholds and real L85 upgrade budget",()=>{
 assert.equal(Model.moneyForLevel(85),144378);
 assert.equal(Model.xpForLevel(85),84661);
 assert.equal(Model.xpForLevel(62),37386);
 assert.equal(ProgressCore.xpThresholdForLevel(85),Model.xpForLevel(85));
 const full5=Model.stages(5).find(x=>x.name==="5G13");
 const full10=Model.stages(10).find(x=>x.name==="10G13");
 assert.equal(full5.currency,552500+144378*5+36000);
 assert.equal(full10.currency,1105000+144378*5+Model.moneyForLevel(15)*5+63000);
 assert.equal(ProgressCore.maxLevelOf("kael"),15);
 assert.equal(ProgressCore.maxLevelOf("ren"),85);
});
test("NET-006B checks one-off act totals and temporary daily & calendar maxima",()=>{
 assert.equal(Model.acts.reduce((sum,a)=>sum+a[1],0),15500);
 assert.equal(Model.acts.reduce((sum,a)=>sum+a[2],0),1500);
 assert.deepEqual(Model.acts.reduce((a,row)=>a.map((v,i)=>v+row[3][i]),
  Array(7).fill(0)),[35,36,46,8,24,20,6]);
 assert.equal(Model.daily.reduce((sum,a)=>sum+a[0],0),1050);
 assert.equal(Model.login.reduce((sum,a)=>sum+a[0],0),1950);
});
test("NET-006B scenario order stable and no unapproved source enters production modules",()=>{
 assert.match(Model.selfTest(),/13\/13/);
 const a=Model.simulate({seed:10,economy:"cautious",heroes:10});
 const b=Model.simulate({seed:10,economy:"cautious",heroes:10});
 assert.deepEqual(a,b);
 assert.ok(a.snapshots[90].board<=16);
 assert.ok(a.snapshots[90].clues<=4*90);
 const noNetwork=Model.simulate({seed:10,economy:"off",heroes:5});
 assert.equal(noNetwork.snapshots[90].clues,0);
 assert.deepEqual(Object.keys(Model.net),["off","E1","cautious"]);
});
