"use strict";
/* GEAR-SAFE-002: defensive invariants; no new gameplay-level gate or economy. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");

const src=["gear-data.js","progress-core.js","save-core.js","progress-v3-core.js",
 "hero-stats-core.js","hero-stats-profiles.js","hero-stats-combat-bridge.js"]
 .map(file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8")).join("\n");
const {G,P,S,V,Core,Profiles,Bridge}=vm.runInNewContext(src+
 "\n({G:GearData,P:ProgressCore,S:SaveCore,V:ProgressV3Core,Core:HeroStatsCore,Profiles:HeroStatsProfiles,Bridge:HeroStatsCombatBridge})");
const ids=["kael","lyra","darin","medic-demo","test-area-damage","ren","nada","liora"];
const roster=ids.map(id=>({id,side:"ally",hp:130,atk:25,speed:120}));
function rich(){
 const p=V.toRuntime(V.fresh(roster,1000000),roster);
 assert.ok(p);
 p.currency=1_000_000;
 for(const key of G.MATERIALS)p.materials[key]=100_000;
 return p;
}
function store(){
 const map=new Map();
 const storage={
  getItem:key=>map.has(key)?map.get(key):null,
  setItem:(key,value)=>{map.set(key,value);}
 };
 return {map,storage,get:()=>storage};
}
const serial=value=>JSON.parse(JSON.stringify(value));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,a+" vs "+b);
function fill(p,id){
 for(const slot of G.SLOTS){
  const item=P.itemOffer(p,id,slot.id)[0];
  assert.ok(item);
  assert.equal(P.equipItem(p,id,item.id),true);
 }
}
function resolve(p,id){
 const bonus=P.gearBonuses(p,id);
 return Bridge.apply({id,side:"ally"},{
  level:P.levelOf(p,id),stars:1,gearPercent:bonus,gearStats:bonus.stats
 },Profiles[id],Core);
}

test("GEAR-SAFE invalid wallet never buys gear or promotes a tier",()=>{
 const p=rich(),item=P.itemOffer(p,"ren","weapon")[0];
 for(const bad of [NaN,Infinity,-Infinity,1.5,-1]){
  p.currency=bad;
  const materials=serial(p.materials),slot=p.gear.ren.slots[0];
  assert.equal(P.canEquipItem(p,"ren",item.id),false,String(bad));
  assert.equal(P.equipItem(p,"ren",item.id),false,String(bad));
  assert.match(P.itemBlockReason(p,"ren",item.id),/валюты/);
  assert.deepEqual(serial(p.materials),materials);
  assert.equal(p.gear.ren.slots[0],slot);
  assert.ok(Object.is(p.currency,bad));
 }
 p.currency=1_000_000;
 fill(p,"ren");
 for(const bad of [NaN,Infinity,-Infinity,1.5,-1]){
  p.currency=bad;
  assert.equal(P.canPromoteGear(p,"ren"),false,String(bad));
  assert.equal(P.promoteGear(p,"ren"),null);
  assert.equal(p.gear.ren.tier,1);
  assert.ok(Object.is(p.currency,bad));
 }
});

test("GEAR-SAFE missing materials reject malformed counts and report real shortage",()=>{
 const p=rich(),item=P.itemOffer(p,"ren","weapon")[0];
 assert.ok(item.ingredients.Fe>0);
 for(const invalid of [Infinity,NaN,-2,"20"]){
  p.materials.Fe=invalid;
  assert.equal(G.missing(item,p.materials).Fe,item.ingredients.Fe);
  assert.equal(P.equipItem(p,"ren",item.id),false);
  assert.match(P.itemBlockReason(p,"ren",item.id),/Железо/);
  assert.equal(p.gear.ren.slots[0],null);
 }
});

test("GEAR-SAFE G gates: six slots mandatory; hero-level gating is not yet a rule",()=>{
 const p=rich();
 assert.equal(P.promoteGear(p,"ren"),null);
 for(const slot of G.SLOTS){
  const item=P.itemOffer(p,"ren",slot.id)[0];
  assert.equal(P.equipItem(p,"ren",item.id),true);
  assert.equal(P.equipItem(p,"ren",item.id),false);
 }
 assert.equal(P.gearPromotionCost(p,"ren").heroLevel,6);
 assert.equal(P.levelOf(p,"ren"),1);
 // Characterize current behavior without silently introducing an unapproved gate.
 assert.equal(P.promoteGear(p,"ren").to,2);
 assert.equal(P.promoteGear(p,"ren"),null);
 assert.equal(P.gearState(p,"ren").slots.every(x=>x===null),true);
});

test("GEAR-SAFE item stats apply exactly once, including historical tiers and v3 reload",()=>{
 const p=rich();
 const before=resolve(p,"ren");
 fill(p,"ren");
 const full=P.gearBonuses(p,"ren");
 near(full.hp,.06);near(full.atk,.06);
 const g1=resolve(p,"ren");
 assert.ok(g1.hp>before.hp);
 assert.ok(g1.physicalAttack>before.physicalAttack);
 assert.ok(g1.physicalDefense>before.physicalDefense);
 assert.equal(g1.speed,before.speed);
 const g1Gear=serial(p.gear.ren);
 const wallet=p.currency;
 assert.equal(P.promoteGear(p,"ren").to,2);
 assert.equal(p.currency,wallet-250);
 const promotion=P.gearBonuses(p,"ren");
 near(promotion.hp,.09);near(promotion.atk,.09);
 const saved=V.fromRuntime(p);
 assert.ok(saved);
 const restored=V.toRuntime(saved,roster);
 assert.deepEqual(serial(restored.gear.ren.history["1"]),serial(g1Gear.slots));
 assert.deepEqual(serial(P.gearBonuses(restored,"ren")),serial(promotion));
 assert.deepEqual(serial(resolve(restored,"ren")),serial(resolve(p,"ren")));
 assert.equal(restored.gear.ren.tier,2);
 assert.equal(restored.gear.ren.slots.every(x=>x===null),true);
});

test("GEAR-SAFE invalid v3 entries cannot be loaded, overwritten or normalized away",()=>{
 const p=rich();fill(p,"ren");
 assert.equal(P.promoteGear(p,"ren").to,2);
 const valid=V.fromRuntime(p);assert.ok(valid);
 for(const corrupt of [
  data=>{data.heroes.ren.gear.installedByTier["1"][0]=null;},
  data=>{data.heroes.ren.gear.installedByTier["2"][0]={kind:"item",itemId:"g1-blade"};},
  data=>{data.materials.Fe=-1;},
  data=>{data.currency=Infinity;},
  data=>{data.heroes.ren.gear.tier=14;}
 ]){
  const candidate=serial(valid);corrupt(candidate);
  assert.equal(V.validateActive(candidate,roster),null);
 }
 const {map,get}=store();
 map.set(V.KEY,JSON.stringify({...valid,materials:{...valid.materials,Fe:-1}}));
 const old=map.get(V.KEY);
 const loaded=S.load(roster,get);
 assert.equal(loaded.blocked,true);
 assert.equal(S.save(loaded.progress,get),false);
 assert.equal(map.get(V.KEY),old);
});

test("GEAR-SAFE stale save and storage failure cannot overwrite a verified purchase",()=>{
 const {map,storage,get}=store();
 let setup=S.load(roster,get).progress;
 setup.currency=10_000;
 for(const material of G.MATERIALS)setup.materials[material]=10_000;
 assert.equal(S.save(setup,get),true);
 const first=S.load(roster,get).progress,second=S.load(roster,get).progress;
 const item=P.itemOffer(first,"ren","weapon")[0];
 assert.equal(P.equipItem(first,"ren",item.id),true);
 assert.equal(S.save(first,get),true);
 const verified=map.get(V.KEY);
 assert.equal(P.equipItem(second,"nada",P.itemOffer(second,"nada","weapon")[0].id),true);
 assert.equal(S.save(second,get),false,"older browser tab cannot overwrite newer gear");
 assert.equal(map.get(V.KEY),verified);
 assert.equal(S.load(roster,get).progress.gear.ren.slots[0],item.id);
 const newer=S.load(roster,get).progress;
 newer.currency+=100;
 const rejected={getItem:key=>storage.getItem(key),setItem(){throw Error("quota");}};
 assert.equal(S.save(newer,()=>rejected),false);
 assert.equal(map.get(V.KEY),verified);
});
