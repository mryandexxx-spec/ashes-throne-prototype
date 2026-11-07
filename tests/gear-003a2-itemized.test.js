"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const scripts=["gear-data.js","progress-core.js","save-core.js","progress-v3-core.js"];
const code=scripts.map(name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8")).join("\n");
const {GearData:G,ProgressCore:P,SaveCore:S,ProgressV3Core:V}=
 vm.runInNewContext(code+"\n({GearData,ProgressCore,SaveCore,ProgressV3Core})");
const roster=[
 {id:"kael",side:"ally",hp:120,atk:24,speed:110},
 {id:"lyra",side:"ally",hp:88,atk:31,speed:155},
 {id:"darin",side:"ally",hp:105,atk:27,speed:125},
 {id:"medic-demo",side:"ally",hp:90,atk:14,speed:115},
 {id:"test-area-damage",side:"ally",hp:90,atk:20,speed:120},
 {id:"ves",side:"enemy",hp:90,atk:18,speed:105}
];
const allies=roster.filter(h=>h.side==="ally");
const getStorage=()=>{
 const map=new Map();
 const storage={getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};
 return {map,storage,get:()=>storage};
};
const oldFixture=()=>{
 const data=P.createProgress(roster);
 data.currency=4400;
 data.gearMaterials=61;
 data.accountXp=620;
 data.energy={value:41,updatedAt:1000};
 data.levels.kael=15;data.levels.lyra=10;
 data.gear.kael={tier:3,slots:[true,true,true,true,true,true]};
 data.gear.lyra={tier:2,slots:[false,true,false,false,false,false]};
 data.claimedMissions=["black-pass-ambush"];
 return {version:2,...data};
};
function checkFullKit(p,hero){
 const initialHp=P.heroStats({...p,gear:{...p.gear,[hero.id]:{tier:1,mode:"itemized",slots:[null,null,null,null,null,null]}}},hero);
 let sumHp=0,sumAtk=0;
 for(const slot of G.SLOTS){
  const offered=P.itemOffer(p,hero.id,slot.id);
  assert.equal(offered.length,1,hero.id+" should have exactly one current G1 option for "+slot.id);
  const item=offered[0];
  assert.equal(item.tier,1);
  assert.equal(item.slotId,slot.id);
  assert.ok(item.allowedClasses.includes(p.classes[hero.id]));
  assert.equal(G.get(item.id),item);
  sumHp+=item.bonuses.hp;sumAtk+=item.bonuses.atk;
  assert.equal(item.bonuses.speed,0);
  assert.equal(P.canEquipItem(p,hero.id,item.id),true);
  assert.equal(P.equipItem(p,hero.id,item.id),true);
  assert.equal(P.equipItem(p,hero.id,item.id),false,"cannot buy occupied slot twice");
 }
 assert.ok(Math.abs(sumHp-.06)<1e-10,hero.id+" must receive +6% HP");
 assert.ok(Math.abs(sumAtk-.06)<1e-10,hero.id+" must receive +6% ATK");
 assert.equal(P.gearInstalled(p,hero.id),6);
 assert.equal(P.gearPromotionCost(p,hero.id)?.currency,250,"completed G1 permits a paid G2 transition");
 assert.equal(P.gearState(p,hero.id).tier,1,"G1 must not auto-promote");
 const after=P.heroStats(p,hero);
 assert.equal(after.speed,hero.speed,"speed must not increase");
 assert.ok(after.hp>=initialHp.hp);
 assert.ok(after.atk>=initialHp.atk);
}
// Catalog contract: no arbitrary extra choices, complete coverage and floors.
assert.equal(G.SLOTS.length,6);
assert.equal(G.FUTURE_STAT_KEYS.length,14,"14-stat schema is reserved but inert");
assert.equal(G.ITEMS.filter(item=>item.tier===1).length,12);
assert.equal(G.ITEMS.filter(item=>item.tier===2).length,12);
assert.equal(new Set(G.ITEMS.map(x=>x.id)).size,12);
for(const item of G.ITEMS){
 assert.ok(G.SLOTS.some(slot=>slot.id===item.slotId));
 assert.ok(Object.keys(item.ingredients).length);
 assert.ok(item.allowedClasses.every(id=>G.CLASS_IDS.includes(id)));
 assert.ok(Object.values(item.ingredients).every(Number.isSafeInteger));
 assert.equal(item.bonuses.speed,0);
}
assert.equal(G.offered("melee","feet")[0].id,"g1-bootlight");
assert.equal(G.offered("support","feet")[0].id,"g1-bootheavy");
assert.deepEqual(Array.from(G.offered("unknown","weapon")),[]);
assert.equal(G.get("__proto__"),null);
assert.equal(G.get("g2-bow"),null);
// Existing v2 with G3 is reset only in v3. Account resources and campaign claims survive.
{
 const {map,get}=getStorage(),old=oldFixture(),raw=JSON.stringify(old);
 map.set(S.KEY,raw);
 const loaded=S.load(roster,get);
 assert.equal(loaded.available,true);
 assert.equal(loaded.fresh,false,"migration of existing account must NOT reset campaign");
 assert.equal(loaded.blocked,false);
 const p=loaded.progress;
 assert.equal(p.saveVersion,3);
 assert.equal(p.accountXp,620);
 assert.equal(p.currency,4400);
 assert.equal(p.gearMaterials,61);
 assert.equal(p.energy.value,41);
 assert.deepEqual(Array.from(p.claimedMissions),["black-pass-ambush"]);
 for(const hero of allies){
  assert.equal(p.levels[hero.id],1,hero.id+" level reset");
  assert.equal(p.gear[hero.id].tier,1);
  assert.equal(p.gear[hero.id].mode,"itemized");
  assert.equal(p.gear[hero.id].slots.filter(Boolean).length,0);
 }
 assert.equal(map.get(S.KEY),raw,"old v2 is an untouched backup");
 assert.ok(map.has(V.KEY));
 assert.equal(S.load(roster,get).progress.currency,4400,"reload does not reset again");
 assert.equal(map.get(S.KEY),raw);
 const granted=P.grantTestResources(p,2000);
 assert.ok(granted);
 for(const id of G.MATERIALS)assert.equal(p.materials[id],G.FLOOR[id]);
 assert.equal(P.grantTestResources(p,2000).materials.Fe,0,"repeated grant only refills to floor");
 assert.equal(p.currency,5000);
 assert.equal(p.gearMaterials,100,"old C is preserved and test-refilled separately");
 assert.equal(p.energy.value,240);
 for(const hero of allies)checkFullKit(p,hero);
 assert.equal(p.currency,0,"five G1 full sets use 5×1000 provisional currency");
 assert.equal(P.canEquipItem(p,"kael","g1-bow"),false,"wrong class cannot equip");
 assert.equal(P.itemOffer(p,"kael","weapon")[0].id,"g1-blade");
 assert.equal(S.save(p,get),true);
 const loaded2=S.load(roster,get);
 assert.equal(loaded2.fresh,false);
 for(const hero of allies){
  assert.equal(P.gearInstalled(loaded2.progress,hero.id),6);
  assert.equal(P.heroStats(loaded2.progress,hero).speed,hero.speed);
 }
 assert.equal(loaded2.progress.currency,0);
 assert.equal(loaded2.progress.gearMaterials,100);
 assert.equal(map.get(S.KEY),raw);
 const rev=loaded2.progress.saveRevision;
 assert.equal(S.save(loaded2.progress,get),true);
 assert.equal(loaded2.progress.saveRevision,rev+1);
}
// Insufficient ingredients, wrong item, and currency do not mutate player profile.
{
 const {get}=getStorage(),loaded=S.load(roster,get);
 const p=loaded.progress;
 p.currency=9999;
 const candidate=P.itemOffer(p,"kael","weapon")[0];
 const before=JSON.stringify(p);
 assert.equal(P.equipItem(p,"kael",candidate.id),false);
 assert.equal(JSON.stringify(p),before);
 p.materials={...Object.fromEntries(G.MATERIALS.map(id=>[id,100]))};
 p.currency=0;
 assert.equal(P.equipItem(p,"kael",candidate.id),false);
 p.currency=9999;
 assert.equal(P.canEquipItem(p,"kael","g1-bow"),false);
 assert.equal(P.canEquipItem(p,"kael","g1-nonexistent"),false);
 assert.equal(P.equipItem(p,"ves",candidate.id),false);
 assert.equal(P.equipItem(p,"kael",candidate.id),true);
 assert.equal(P.equipItem(p,"kael",candidate.id),false);
}
// Multiple tabs: stale revision fails, newer purchase is not overwritten.
{
 const {get}=getStorage();
 const first=S.load(roster,get).progress;
 const second=S.load(roster,get).progress;
 P.grantTestResources(first);
 P.grantTestResources(second);
 assert.equal(P.equipItem(first,"kael","g1-blade"),true);
 assert.equal(S.save(first,get),true);
 assert.equal(P.equipItem(second,"lyra","g1-bow"),true);
 assert.equal(S.save(second,get),false);
 assert.equal(S.load(roster,get).progress.gear.lyra.slots[0],null);
 assert.equal(S.load(roster,get).progress.gear.kael.slots[0],"g1-blade");
}
// Corrupt v3 must not silently restore old backup or permit write to v2.
{
 const {map,get}=getStorage();
 const raw=JSON.stringify(oldFixture());
 map.set(S.KEY,raw);
 map.set(V.KEY,"{broken");
 const loaded=S.load(roster,get);
 assert.equal(loaded.blocked,true);
 assert.equal(loaded.available,false);
 assert.equal(S.save(loaded.progress,get),false);
 assert.equal(map.get(V.KEY),"{broken");
 assert.equal(map.get(S.KEY),raw);
}
// Storage write failure never counts as confirmed progress.
{
 const {map,get}=getStorage(),p=S.load(roster,get).progress;
 P.grantTestResources(p);
 const before=map.get(V.KEY);
 const reject=()=>({getItem:key=>map.get(key)??null,setItem(){throw Error("quota");}});
 assert.equal(S.save(p,reject),false);
 assert.equal(map.get(V.KEY),before);
}
// New account (no v2) is fresh and starts with 5 empty classed heroes.
{
 const {get}=getStorage(),loaded=S.load(roster,get);
 assert.equal(loaded.fresh,true);
 assert.equal(loaded.progress.currency,0);
 assert.equal(loaded.progress.levels.kael,1);
}
console.log("Gear-003A2 itemized G1, class coverage, clean reset, 5 kits and save compatibility passed");
