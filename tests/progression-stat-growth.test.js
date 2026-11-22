"use strict";
/* PROGRESSIONSTATS004 [PROPOSAL] — numerical proposals isolated from economy and save. */
const test=require("node:test");
const assert=require("node:assert/strict");
const vm=require("node:vm");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..");
const Core=require("../hero-stats-core.js");
const Profiles=require("../hero-stats-profiles.js");
const Bridge=require("../hero-stats-combat-bridge.js");
const StarCore=require("../star-core.js");
const GearData=require("../gear-data.js");
const load=name=>fs.readFileSync(path.join(root,name),"utf8");
const context=vm.createContext({Math,Object,Number,Array,Date,Set,console});
vm.runInContext(load("gear-data.js")+"\n"+load("progress-core.js")+
 "\n;globalThis._core=ProgressCore;globalThis._gear=GearData;",context);
const ProgressCore=context._core;
const statKeys=Core.KEYS;
const hero=(id,level=1,stars=1,gear={hp:0,atk:0,stats:{}})=>Bridge.apply(
 {id,side:"ally",hp:1,atk:1},{level,stars,gearPercent:gear,gearStats:gear.stats},
 Profiles[id],Core);
const diff=(a,b)=>statKeys.filter(key=>a[key]!==b[key]);

test("level upgrades diversify real combat stats for all five heroes",()=>{
 for(const id of Object.keys(Profiles)){
  for(const from of [1,20,40,84]){
   const a=hero(id,from),b=hero(id,from+1);
   const changed=diff(a,b);
   assert.ok(changed.length>=5,id+" L"+from+": "+changed.join(","));
   assert.ok(changed.some(key=>["accuracy","evasion","critChance","defensePenetration",
    "debuffPotency","debuffResistance"].includes(key)),id+" secondary specialization");
   assert.equal(a.speed,b.speed,"Ordinary levels never increase speed");
   assert.equal(a.magicAttack,b.magicAttack,"Do not invent magic attacks for physical fighters");
  }
 }
});

test("stars retain NET-007 +3% for only five primary stats, extend secondary + protection",()=>{
 assert.deepEqual(StarCore.COMBAT_BONUS_STATS,
  ["hp","physicalAttack","magicAttack","physicalDefense","magicDefense"]);
 assert.equal(StarCore.STAR_BONUS_PER_RANK,.03);
 for(const id of Object.keys(Profiles)){
  const a=hero(id,25,1),b=hero(id,25,2);
  const profile=Profiles[id];
  const base=profile.combatStats,level=profile.growth.level;
  for(const key of StarCore.COMBAT_BONUS_STATS){
   const raw=base[key]+24*(level[key]??0);
   assert.equal(b[key],Math.round(raw+base[key]*.03),
    id+" canonical star multiplier "+key);
  }
  assert.ok(b.protection>a.protection,id+" earned protective star growth");
  assert.ok(diff(a,b).some(key=>!StarCore.COMBAT_BONUS_STATS.includes(key)&&
   key!=="protection"),id+" secondaries");
  assert.equal(a.speed,b.speed);
  for(const key of ["hp","physicalAttack","physicalDefense","magicDefense"])
   assert.ok(b[key]>=a[key],"No debuffs from a star");
 }
});

test("G promotion saves six equipped items once, adds class-based defense and secondary",()=>{
 for(const [id,classId] of [["ren","melee"],["nada","support"],["liora","tank"]]){
  const equipped=GearData.SLOTS.map(slot=>GearData.offered(classId,slot.id,1)[0]?.id);
  assert.equal(equipped.filter(Boolean).length,6);
  const progress={saveVersion:3,currency:100000,classes:{[id]:classId},
   gear:{[id]:{mode:"itemized",tier:1,slots:equipped.slice(),history:{}}}};
  const before=ProgressCore.gearBonuses(progress,id);
  const oldHero=hero(id,25,2,before);
  const purchase=ProgressCore.promoteGear(progress,id);
  assert.equal(purchase.from,1);assert.equal(purchase.to,2);
  assert.equal(progress.currency,100000-purchase.currency);
  assert.equal(progress.gear[id].tier,2);
  assert.equal(progress.gear[id].slots.every(slot=>slot===null),true);
  assert.deepEqual(Array.from(progress.gear[id].history["1"]),equipped);
  const after=ProgressCore.gearBonuses(progress,id);
  const newHero=hero(id,25,2,after);
  assert.ok(newHero.hp>oldHero.hp,id+" rank HP");
  assert.ok(newHero.physicalAttack>oldHero.physicalAttack,id+" rank physical attack");
  assert.equal(newHero.protection-oldHero.protection,
   2+(classId==="tank"?1:0),id+" Protection by rank");
  assert.equal(newHero.physicalDefense-oldHero.physicalDefense,1);
  assert.equal(newHero.magicDefense-oldHero.magicDefense,1);
  const classSpecific=Object.keys(ProgressCore.GEAR_PROMOTION_CLASS_BONUS[classId]);
  assert.ok(classSpecific.every(key=>newHero[key]>oldHero[key]));
  assert.equal(newHero.speed,oldHero.speed);
  assert.ok(diff(oldHero,newHero).length>=5,id+" diverse rank upgrade");
  // The previous items still contribute exactly the same flat stats after G.
  for(const [key,bonus] of Object.entries(before.stats)){
   const rankDelta=(ProgressCore.GEAR_PROMOTION_FLAT_BONUS[key]||0)+
    (ProgressCore.GEAR_PROMOTION_CLASS_BONUS[classId][key]||0);
   assert.ok(Math.abs((after.stats[key]||0)-bonus-rankDelta)<1e-8);
  }
 }
});

test("G13 7-star L85 stats stay bounded and have no speed increase",()=>{
 for(const [id,classId] of Object.entries({ren:"melee",nada:"support",
  liora:"tank",art:"tank",sava:"support"})){
  const progress={saveVersion:3,classes:{[id]:classId},
   gear:{[id]:{mode:"itemized",tier:13,slots:Array(6).fill(null),history:{}}}};
  const bonuses=ProgressCore.gearBonuses(progress,id);
  assert.equal(bonuses.hp,12*.03);
  assert.equal(bonuses.atk,12*.03);
  const result=hero(id,85,7,bonuses);
  for(const key of statKeys){
   assert.equal(Number.isFinite(result[key]),true,id+" "+key);
   if(["critChance","accuracy","evasion","defensePenetration",
        "debuffPotency","debuffResistance"].includes(key))
    assert.ok(result[key]<=100,id+" "+key+" not over 100%");
  }
  assert.equal(result.speed,Profiles[id].combatStats.speed);
  assert.equal(result.maxProtection,result.protection);
 }
});

test("progression computation never mutates base profile or saved gear",()=>{
 const p={saveVersion:3,classes:{ren:"melee"},
  gear:{ren:{mode:"itemized",tier:7,slots:[null,null,null,null,null,null],history:{}}}};
 const before=JSON.stringify(p),base=JSON.stringify(Profiles.ren);
 const one=hero("ren",55,6,ProgressCore.gearBonuses(p,"ren"));
 const two=hero("ren",55,6,ProgressCore.gearBonuses(p,"ren"));
 assert.deepEqual(one,two);
 assert.equal(JSON.stringify(p),before);
 assert.equal(JSON.stringify(Profiles.ren),base);
});


test("full G1–G13 78-item sets do not overflow any real hero combat percentage",()=>{
 for(const [id,classId] of Object.entries({ren:"melee",nada:"support",
  liora:"tank",art:"tank",sava:"support"})){
  const tierItems=tier=>GearData.SLOTS.map(slot=>{
   const item=GearData.offered(classId,slot.id,tier)[0];
   assert.ok(item,id+" missing "+slot.id+" G"+tier);
   return item.id;
  });
  const history=Object.fromEntries(Array.from({length:12},(_,i)=>
   [String(i+1),tierItems(i+1)]));
  const progress={saveVersion:3,classes:{[id]:classId},
   gear:{[id]:{mode:"itemized",tier:13,slots:tierItems(13),history}}};
  const full=hero(id,85,7,ProgressCore.gearBonuses(progress,id));
  for(const key of statKeys){
   assert.ok(Number.isFinite(full[key])&&full[key]>=0,id+" "+key);
   if(["critChance","accuracy","evasion","defensePenetration",
       "debuffPotency","debuffResistance"].includes(key))
    assert.ok(full[key]<=100,id+" "+key+"="+full[key]);
  }
  assert.equal(full.speed,Profiles[id].combatStats.speed);
 }
});
