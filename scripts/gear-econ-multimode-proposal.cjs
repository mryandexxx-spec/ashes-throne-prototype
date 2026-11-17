"use strict";
/* GEAR-ECON-005B: hypothetical, ONE-TIME reward scenario; not game balance.
 * Actual materials, tiers and mission farm remain loaded from production modules.
 * No part of this model grants rewards, saves progress or changes the game. */
const Economy=require("./gear-econ-005.cjs");
const MATERIALS=Economy.MATERIALS;
const fixed=(id,trigger,currency,xp,mats)=>Object.freeze({
 id,trigger,currency,xp,materials:Object.freeze({...mats})
});
// Suggested act milestones; the story itself never yields replay rewards.
const LORE=Object.freeze([
 fixed("lore:five-shadows:act-1","five-shadows:fs-03",1500,250,{Fe:4,Le:6,Cl:6,Fa:2,Th:2}),
 fixed("lore:five-shadows:act-2","five-shadows:fs-06",2000,300,{Fe:5,Le:5,Cl:10,Fa:4,Th:3,Wo:1,Gl:1}),
 fixed("lore:five-shadows:act-3","five-shadows:fs-09",3000,400,{Fe:8,Le:7,Cl:8,Fa:5,Th:4,Wo:2,Gl:1}),
 fixed("lore:five-shadows:act-4","five-shadows:fs-12",4000,550,{Fe:8,Le:8,Cl:10,Fa:6,Th:5,Wo:2,Gl:2}),
 fixed("lore:five-shadows:act-5","five-shadows:fs-15",5000,700,{Fe:10,Le:10,Cl:12,Fa:7,Th:6,Wo:3,Gl:2})
]);
const TACTICAL=Object.freeze([
 fixed("challenge:T-01:first","T-01",700,70,{Fa:2,Th:2}),
 fixed("challenge:T-02:first","T-02",750,75,{Fa:3,Th:2}),
 fixed("challenge:T-03:first","T-03",800,80,{Fa:3,Th:3}),
 fixed("challenge:T-04:first","T-04",850,85,{Fa:4,Th:3,Gl:1})
]);
const ONSLAUGHT=Object.freeze([
 fixed("challenge:N-01:first","N-01",900,90,{Fe:4,Le:4,Cl:4}),
 fixed("challenge:N-02:first","N-02",1000,100,{Fe:5,Le:5,Cl:5}),
 fixed("challenge:N-03:first","N-03",1100,110,{Fe:6,Le:6,Cl:6}),
 fixed("challenge:N-04:first","N-04",1200,120,{Fe:7,Le:7,Cl:7})
]);
const OPERATIONS=Object.freeze([
 fixed("operation:OPS-001:first","OPS-001",1200,150,{Wo:4,Th:4}),
 fixed("operation:OPS-002:first","OPS-002",1200,150,{Gl:4,Th:4})
]);
const ALL=Object.freeze([...LORE,...TACTICAL,...ONSLAUGHT,...OPERATIONS]);
function pool(packs){
 const totals=Object.fromEntries([...MATERIALS,"currency","xp"].map(id=>[id,0]));
 for(const pack of packs){
  if(!Number.isSafeInteger(pack.currency)||!Number.isSafeInteger(pack.xp)||
     pack.currency<0||pack.xp<0)throw Error("Invalid proposed payout");
  totals.currency+=pack.currency;totals.xp+=pack.xp;
  for(const [id,n] of Object.entries(pack.materials)){
   if(!MATERIALS.includes(id)||!Number.isSafeInteger(n)||n<0)throw Error("Invalid material");
   totals[id]+=n;
  }
 }
 return totals;
}
function bank(packs){
 const current=Economy.firstClear(Economy.sources("current"));
 const added=pool(packs);
 for(const [id,n] of Object.entries(added))current[id]+=n;
 return current;
}
const EARLY=Object.freeze([...LORE.slice(0,2),...TACTICAL.slice(0,2),ONSLAUGHT[0],OPERATIONS[0]]);
const checkpoint={baseline:Object.freeze([]),early:EARLY,optimisticAll:ALL};
function report(){
 const rows=Economy.sources("current"),output={
  status:"PROPOSAL ONLY — not deployed",
  proposedSourceTotals:{
   lore:pool(LORE),tactical:pool(TACTICAL),onslaught:pool(ONSLAUGHT),operations:pool(OPERATIONS)
  },scenarios:{}
 };
 for(const [name,entries] of Object.entries(checkpoint)){
  const startingBank=bank(entries);
  output.scenarios[name]={claimedOneTimePacks:entries.length,bank:startingBank};
  for(const [party,classes] of Object.entries({
   activeFive:Economy.ACTIVE_FIVE,diverseFive:Economy.DIVERSE_FIVE
  })){
   output.scenarios[name][party]={};
   for(const tier of [3,8,13]){
    const goal=Economy.requirements(classes,tier);
    const found=Economy.optimize(goal,rows,startingBank);
    output.scenarios[name][party]["G"+tier]={
     energy:found.energy,repeats:found.runs,
     missions:found.perMission,currencyNeed:goal.currency
    };
   }
  }
 }
 return output;
}
module.exports=Object.freeze({LORE,TACTICAL,ONSLAUGHT,OPERATIONS,ALL,EARLY,pool,bank,report});
if(require.main===module)console.log(JSON.stringify(report(),null,2));
