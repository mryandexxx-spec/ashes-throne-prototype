"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const src=["progress-core.js","save-core.js","progress-v3-core.js"].map(f=>
 fs.readFileSync(path.join(__dirname,"..",f),"utf8")).join("\n");
const {P,S,V}=vm.runInNewContext(src+"\n({P:ProgressCore,S:SaveCore,V:ProgressV3Core})");
const roster=[
 {id:"kael",side:"ally"},{id:"lyra",side:"ally"},{id:"darin",side:"ally"},
 {id:"medic-demo",side:"ally"},{id:"test-area-damage",side:"ally"},
 {id:"ves",side:"enemy"}
];
const ids=roster.filter(h=>h.side==="ally").map(h=>h.id);
const materialKeys=["Fe","Le","Cl","Wo","Fa","Th","Gl"];
const base=()=>{
 const data=P.createProgress(roster);
 data.currency=3245;
 data.gearMaterials=49;
 data.accountXp=388;
 data.energy={value:73,updatedAt:999};
 data.claimedMissions=["black-pass-ambush","demo-mission-2"];
 data.levels.kael=15;
 data.levels.lyra=6;
 data.levels.darin=11;
 data.gear.kael={tier:3,slots:[true,true,true,true,true,true]};
 data.gear.lyra={tier:2,slots:[true,false,true,false,false,false]};
 data.gear.darin={tier:1,slots:[false,true,false,true,false,false]};
 return {version:2,...data};
};
function local(){
 const values=new Map();
 return {values,storage:{getItem:k=>values.has(k)?values.get(k):null,
  setItem:(k,v)=>values.set(k,v)}};
}
function assertClean(result){
 assert.equal(result.version,3);
 for(const id of ids){
  const h=result.heroes[id];
  assert.equal(h.level,1);
  assert.equal(h.gear.tier,1);
  assert.deepEqual(Array.from(h.gear.installedByTier["1"]),[null,null,null,null,null,null]);
 }
 assert.equal(result.heroes.kael.classId,"tank");
 assert.equal(result.heroes.lyra.classId,"ranged");
 assert.equal(result.heroes.darin.classId,"melee");
 assert.equal(result.heroes["medic-demo"].classId,"support");
 assert.equal(result.heroes["test-area-damage"].classId,"mage");
 assert.deepEqual(Object.keys(result.materials).sort(),materialKeys.slice().sort());
 assert.ok(materialKeys.every(k=>result.materials[k]===0));
 assert.equal(result.currency,3245);
 assert.equal(result.legacyC,49);
 assert.equal(result.accountXp,388);
 assert.equal(result.energy.value,73);
 assert.equal(result.energy.updatedAt,999);
 assert.deepEqual(Array.from(result.claimedMissions),["black-pass-ambush","demo-mission-2"]);
}
// High-tier and partial old gear are discarded ONLY in the new candidate.
{
 const old=base(),snapshot=JSON.stringify(old);
 const result=V.fromV2(old,roster);
 assert.ok(result);
 assertClean(result);
 assert.equal(JSON.stringify(old),snapshot,"conversion must not mutate old save");
 assert.equal(V.validate(result,roster).version,3);
 result.heroes.kael.level=9;
 assert.equal(V.fromV2(old,roster).heroes.kael.level,1,"fresh independent candidate");
}
// Compatibility with older numeric slots, no gear, no C, and missing energy.
{
 const old=base();
 old.gear.kael.slots=5;
 assertClean(V.fromV2(old,roster));
 delete old.gear;
 delete old.gearMaterials;
 delete old.energy;
 const x=V.fromV2(old,roster);
 assert.ok(x);
 assert.equal(x.legacyC,30,"retroactive reward C is preserved exactly as v2 validator intended");
 assertClean({...x,legacyC:49,energy:{value:73,updatedAt:999}});
}
// Actual v2 input stays byte-for-byte untouched during staging and on re-entry.
{
 const {values,storage}=local(),raw=JSON.stringify(base());
 values.set(S.KEY,raw);
 const res=V.stage(roster,()=>storage);
 assert.equal(res.status,"staged");
 assertClean(res.profile);
 assert.equal(values.get(S.KEY),raw);
 const same=values.get(V.KEY);
 assert.equal(V.stage(roster,()=>storage).status,"existing");
 assert.equal(values.get(V.KEY),same,"second invocation cannot reset a newer v3");
 assert.equal(values.get(S.KEY),raw);
}
// Brand-new accounts get a clean v3 without inventing progress.
{
 const {storage}=local(),res=V.stage(roster,()=>storage,123456);
 assert.equal(res.status,"staged");
 assert.equal(res.profile.accountXp,0);
 assert.equal(res.profile.currency,0);
 assert.equal(res.profile.energy.updatedAt,123456);
 assert.equal(res.profile.heroes.kael.level,1);
}
// Corruption must never replace a v2 profile or newer v3 save.
{
 const {values,storage}=local();
 values.set(S.KEY,"{bad");
 assert.equal(V.stage(roster,()=>storage).reason,"invalid-v2");
 assert.equal(values.has(V.KEY),false);
 values.set(S.KEY,JSON.stringify(base()));
 values.set(V.KEY,"{bad");
 assert.equal(V.stage(roster,()=>storage).reason,"invalid-v3");
 assert.equal(values.get(V.KEY),"{bad");
 assert.equal(values.get(S.KEY),JSON.stringify(base()));
 values.set(V.KEY,JSON.stringify({version:3}));
 assert.equal(V.stage(roster,()=>storage).reason,"invalid-v3");
}
// Invalid v2 content, unknown heroes, and invalid user data.
{
 const {values,storage}=local();
 values.set(S.KEY,JSON.stringify({...base(),currency:-1}));
 assert.equal(V.stage(roster,()=>storage).reason,"invalid-v2");
 assert.equal(V.fromV2(base(),[...roster,{id:"new-hero",side:"ally"}]),null);
 const x=V.fromV2(base(),roster);
 x.heroes.kael.gear.installedByTier["1"][0]={itemId:"g1-blade"};
 assert.equal(V.validate(x,roster),null,"reset contract forbids paid items in new profile");
}
// Storage failure and failed readback do not touch the source.
{
 const {values,storage}=local(),raw=JSON.stringify(base());
 values.set(S.KEY,raw);
 const denied={getItem:storage.getItem,setItem(){throw Error("blocked");}};
 assert.equal(V.stage(roster,()=>denied).reason,"v3-write-failed");
 assert.equal(values.has(V.KEY),false);
 assert.equal(values.get(S.KEY),raw);
 const noRead={getItem(){throw Error("read blocked");}};
 assert.equal(V.stage(roster,()=>noRead).reason,"read-v3-failed");
 const lostReadback={getItem:k=>k===V.KEY?null:values.get(k),setItem(){}};
 assert.equal(V.stage(roster,()=>lostReadback).reason,"v3-write-verification-failed");
 assert.equal(V.stage(roster,()=>null).reason,"storage-unavailable");
}
// Account progress has NOT been zeroed by the user-approved hero-only reset.
{
 const old=base(),next=V.fromV2(old,roster);
 assert.equal(next.accountXp,old.accountXp);
 assert.equal(next.currency,old.currency);
 assert.equal(next.legacyC,old.gearMaterials);
 assert.deepEqual(JSON.stringify(next.energy),JSON.stringify(old.energy));
 assert.deepEqual(JSON.stringify(next.claimedMissions),JSON.stringify(old.claimedMissions));
}
// A1 is intentionally inert: neither index.html nor game.js imports the module.
{
 const html=fs.readFileSync(path.join(__dirname,"..","index.html"),"utf8");
 const game=fs.readFileSync(path.join(__dirname,"..","game.js"),"utf8");
 assert.ok(!html.includes("progress-v3-core.js"));
 assert.ok(!game.includes("ProgressV3Core"));
}
console.log("Gear-003A1 inert clean-hero v3 staging and rollback contracts passed");
