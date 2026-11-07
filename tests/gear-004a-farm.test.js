/* Gear-004A: deterministic repeat drops and legacy compatibility. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const ctx=vm.createContext({Date,Math,Number,Object,Array,Set,JSON});
for(const file of ["gear-data.js","progress-core.js"])
 vm.runInContext(fs.readFileSync(require("node:path").join(__dirname,"..",file),"utf8"),ctx,{filename:file});
const GearData=vm.runInContext("GearData",ctx);
const P=vm.runInContext("ProgressCore",ctx);
const hero={id:"kael",side:"ally"};
const at=1_000_000;
function profile(){
 const p=P.createProgress([hero]);p.saveVersion=3;
 p.materials=Object.fromEntries(GearData.MATERIALS.map(id=>[id,0]));
 p.energy={value:240,updatedAt:at};
 return p;
}
function snapshot(p){return JSON.parse(JSON.stringify(p));}
const manual=profile(),sim=profile();
const manualGain=P.grantRepeatFarm(manual,"black-pass-ambush");
const simulationGain=P.simulate(sim,"black-pass-ambush",3,1,at);
assert.deepEqual(snapshot(manualGain),snapshot(simulationGain),"manual and simulation payouts match");
assert.equal(manual.energy.value,240,"manual battle pays energy at entrance, not at outcome");
assert.equal(sim.energy.value,230,"simulation consumes energy");
assert.deepEqual(snapshot(manual.materials),{Fe:2,Le:3,Cl:4,Wo:1,Fa:2,Th:2,Gl:0});
assert.equal(manual.currency,850);
assert.equal(P.simulate(sim,"demo-mission-2",1,1,at),null,"no simulation without 3 stars");
assert.equal(P.simulate(sim,"demo-mission-2",3,0,at),null,"zero count");
const two=P.simulate(sim,"demo-mission-2",3,2,at);
assert.equal(two.materials.Gl,2,"mission 2 unlocks glass");
assert.equal(two.currency,2040);
assert.equal(sim.energy.value,206);
assert.equal(P.simulate(sim,"demo-mission-3",3,14,at),null,"energy insufficient");
const frozen=snapshot(sim);
sim.currency=Number.MAX_SAFE_INTEGER;
assert.equal(P.simulate(sim,"demo-mission-3",3,1,at),null,"overflow rejected before charge");
assert.equal(sim.energy.value,frozen.energy.value);
const legacy=P.createProgress([hero]);
legacy.energy={value:240,updatedAt:at};
const old=P.simulate(legacy,"black-pass-ambush",3,1,at);
assert.equal(old.material,12,"v2 keeps old C payout");
assert.equal(old.currency,0);
assert.equal(legacy.gearMaterials,12);
assert.equal(P.grantRepeatFarm(legacy,"black-pass-ambush"),null,"v2 cannot receive v3 farm");
assert.equal(P.grantRepeatFarm(profile(),"unknown"),null,"unknown mission cannot mint rewards");
console.log("Gear-004A repeat/simulation 7-material parity, glass, overflow and v2 compatibility passed");
