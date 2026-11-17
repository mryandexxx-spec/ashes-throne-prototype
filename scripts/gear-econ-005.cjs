"use strict";
/* GEAR-ECON-005: offline, read-only exact integer optimizer. No game mutations. */
const GearData=require("../gear-data.js");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
// ProgressCore is a browser-global IIFE, not CommonJS; read its real source
// in a sandbox as the project's existing Node tests do.
const ProgressCore=vm.runInNewContext(
 fs.readFileSync(path.join(__dirname,"../progress-core.js"),"utf8")+"\nProgressCore",
 {GearData});
const MATERIALS=GearData.MATERIALS;
const KEYS=[...MATERIALS,"currency"];
const MISSIONS=Object.keys(ProgressCore.MISSION_GEAR_FARM);
const ACTIVE_FIVE=["melee","support","tank","tank","support"];
const DIVERSE_FIVE=GearData.CLASS_IDS;
const ceil=(a,b)=>a<=0?0:Math.ceil(a/b);
function sources(variant="current"){
 if(!["current","targeted","diversified"].includes(variant))throw Error("Unknown variant");
 return MISSIONS.map((id,i)=>{
  const base=ProgressCore.MISSION_GEAR_FARM[id],materials={...base.materials};
  if(variant!=="current"){
   if(i===0)materials.Wo=3;
   if(i===1)materials.Gl=3;
   if(variant==="diversified"&&i===2){materials.Wo=4;materials.Gl=4;}
  }
  return {id,energy:base.cost,xp:base.xp,currency:base.currency,materials};
 });
}
function firstClear(rows){
 const bank=Object.fromEntries(MATERIALS.map(id=>[id,0]));
 bank.currency=0;bank.xp=0;
 for(const row of rows){
  const first=ProgressCore.FIRST_CLEAR_REWARDS[row.id];
  if(!first)throw Error("Not a first-clear farm source: "+row.id);
  for(const id of MATERIALS)bank[id]+=row.materials[id];
  bank.currency+=first.currency+row.currency;
  bank.xp+=first.xp+row.xp;
 }
 return bank;
}
function gearCost(tier,heroes=1){
 if(!Number.isInteger(tier)||tier<1||tier>GearData.MAX_TIER||heroes<1)throw Error("Invalid tier");
 let coins=0;
 for(let t=1;t<=tier;t++){coins+=1000*t;if(t<tier)coins+=ProgressCore.GEAR_PROMOTION_CURRENCY[t];}
 return coins*heroes;
}
function requirements(classes,tier){
 if(!Array.isArray(classes)||!classes.length||classes.some(id=>!GearData.CLASS_IDS.includes(id)))
  throw Error("Invalid hero classes");
 const needs=Object.fromEntries(MATERIALS.map(id=>[id,0]));
 for(const cls of classes)for(let t=1;t<=tier;t++)for(const slot of GearData.SLOTS){
  const offers=GearData.offered(cls,slot.id,t);
  if(offers.length!==1)throw Error("Ambiguous item: "+cls+" "+slot.id+" "+t);
  for(const [id,n] of Object.entries(offers[0].ingredients))needs[id]+=n;
 }
 needs.currency=gearCost(tier,classes.length);
 return needs;
}
function optimize(goal,rows=sources(),bank=firstClear(rows)){
 if(rows.length!==3||KEYS.some(k=>!Number.isSafeInteger(goal[k])||goal[k]<0))throw Error("Invalid objective");
 const gains=rows.map(row=>KEYS.map(k=>k==="currency"?row.currency:row.materials[k]));
 const needed=KEYS.map(k=>goal[k]),have=KEYS.map(k=>bank[k]);
 // Valid initial upper bound from missions #1 and #2 (only #2 has glass).
 let b=ceil(needed[6]-have[6],gains[1][6]),a=0;
 for(let k=0;k<KEYS.length;k++){
  const deficit=needed[k]-have[k]-b*gains[1][k];
  if(deficit>0){
   if(gains[0][k]===0)throw Error("No initial covering source: "+KEYS[k]);
   a=Math.max(a,ceil(deficit,gains[0][k]));
  }
 }
 let counts=[a,b,0],best=a*rows[0].energy+b*rows[1].energy;
 const maxA=Math.floor(best/rows[0].energy);
 // Exhaustive exact search: with fixed first two counts, the minimal third
 // count is the largest outstanding per-material / per-currency constraint.
 for(let x=0;x<=maxA;x++){
  const aEnergy=x*rows[0].energy,maxB=Math.floor((best-aEnergy)/rows[1].energy);
  for(let y=0;y<=maxB;y++){
   const e=aEnergy+y*rows[1].energy;
   let z=0,valid=true;
   for(let k=0;k<KEYS.length;k++){
    const diff=needed[k]-have[k]-x*gains[0][k]-y*gains[1][k];
    if(diff<=0)continue;
    if(gains[2][k]===0){valid=false;break;}
    z=Math.max(z,ceil(diff,gains[2][k]));
    if(e+z*rows[2].energy>best){valid=false;break;}
   }
   if(!valid)continue;
   const energy=e+z*rows[2].energy;
   if(energy<best||(energy===best&&x+y+z<counts.reduce((p,q)=>p+q,0))){
    best=energy;counts=[x,y,z];
   }
  }
 }
 const remainder={};
 KEYS.forEach((key,k)=>{
  remainder[key]=have[k]+counts.reduce((s,n,i)=>s+n*gains[i][k],0)-needed[k];
  if(remainder[key]<0)throw Error("Negative result: "+key);
 });
 return {energy:best,runs:counts.reduce((s,n)=>s+n,0),
  perMission:Object.fromEntries(MISSIONS.map((id,i)=>[id,counts[i]])),
  daysAtPerfectRegen:Math.max(0,(best-ProgressCore.ENERGY_MAX)*
   ProgressCore.ENERGY_REGEN_MS/(24*60*60*1000)),
  accountXp:bank.xp+counts.reduce((s,n,i)=>s+n*rows[i].xp,0),
  remainder};
}
function model(variant="current"){
 const rows=sources(variant),bank=firstClear(rows),groups={};
 for(const c of GearData.CLASS_IDS)groups[c]=[c];
 groups.activeFive=ACTIVE_FIVE;groups.diverseFive=DIVERSE_FIVE;
 return {variant,firstClear:bank,
  results:Object.fromEntries(Object.entries(groups).map(([name,classes])=>[
   name,Object.fromEntries([3,8,13].map(t=>["G"+t,optimize(requirements(classes,t),rows,bank)]))
  ]))};
}
module.exports={MATERIALS,KEYS,MISSIONS,ACTIVE_FIVE,DIVERSE_FIVE,sources,firstClear,gearCost,requirements,optimize,model};
if(require.main===module)console.log(JSON.stringify(model(process.argv[2]||"current"),null,2));
