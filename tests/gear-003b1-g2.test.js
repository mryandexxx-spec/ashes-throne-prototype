"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const source=["gear-data.js","progress-core.js","save-core.js","progress-v3-core.js"]
 .map(name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8")).join("\n");
const {G,P,S,V}=vm.runInNewContext(source+"\n({G:GearData,P:ProgressCore,S:SaveCore,V:ProgressV3Core})");
const heroes=[
 {id:"kael",side:"ally",hp:150,atk:25,speed:110},
 {id:"lyra",side:"ally",hp:90,atk:32,speed:155},
 {id:"darin",side:"ally",hp:130,atk:29,speed:125},
 {id:"medic-demo",side:"ally",hp:110,atk:18,speed:115},
 {id:"test-area-damage",side:"ally",hp:95,atk:26,speed:120}
];
const store=()=>{const data=new Map();return {data,api:{getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}};};
const make=()=>{const {data,api}=store();return {data,api,p:S.load(heroes,()=>api).progress};};
function buyTier(p,hero,tier){
 for(const slot of G.SLOTS){
  const offered=P.itemOffer(p,hero.id,slot.id);
  assert.equal(offered.length,1,hero.id+" G"+tier+" "+slot.id);
  const item=offered[0];
  assert.equal(item.tier,tier);
  assert.equal(item.bonuses.speed,0);
  assert.ok(item.allowedClasses.includes(p.classes[hero.id]));
  assert.equal(P.canEquipItem(p,hero.id,item.id),true);
  assert.equal(P.equipItem(p,hero.id,item.id),true);
  assert.equal(P.equipItem(p,hero.id,item.id),false);
 }
}
const sums=items=>items.reduce((total,itemId)=>{
 const i=G.get(itemId);total.hp+=i.bonuses.hp;total.atk+=i.bonuses.atk;return total;
},{hp:0,atk:0});
assert.equal(G.ITEMS.length,24);
assert.equal(G.ITEMS.filter(i=>i.tier===2).length,12);
assert.deepEqual(Array.from(G.offered("tank","head",3)),[],"G3 not implemented");
assert.equal(G.offered("support","feet",2)[0].id,"g2-bootheavy");
assert.equal(G.offered("melee","feet",2)[0].id,"g2-bootlight");
// Check all proposed G2 ingredients directly against the published 0.4 recipes.
const recipes={
 "g2-blade":{Fe:3,Fa:1,Wo:1},
 "g2-bow":{Wo:2,Th:2,Cl:2,Le:1},
 "g2-wand":{Wo:1,Gl:1,Cl:2,Le:1},
 "g2-vest":{Fe:2,Fa:1,Cl:2,Le:2},
 "g2-jacket":{Cl:4,Le:1,Fa:1},
 "g2-helm":{Fe:2,Fa:1,Cl:2,Le:1},
 "g2-hood":{Cl:3,Le:1,Th:1},
 "g2-gaunt":{Fe:2,Fa:1,Le:1,Th:1},
 "g2-workglove":{Cl:3,Le:1,Th:1},
 "g2-bootheavy":{Fe:2,Fa:1,Cl:2,Le:2},
 "g2-bootlight":{Cl:4,Le:1,Th:1},
 "g2-belt":{Cl:2,Le:1,Fa:2}
};
for(const [id,recipe] of Object.entries(recipes))
 assert.equal(JSON.stringify(G.get(id).ingredients),JSON.stringify(recipe),id+" recipe");
const total=Object.fromEntries(G.MATERIALS.map(id=>[id,0]));
for(const cls of G.CLASS_IDS)for(const slot of G.SLOTS){
 const item=G.offered(cls,slot.id,2)[0];
 for(const [id,n] of Object.entries(item.ingredients))total[id]+=n;
}
assert.equal(JSON.stringify(total),JSON.stringify({Fe:24,Le:32,Cl:67,Wo:6,Fa:24,Th:13,Gl:2}));
assert.equal(Object.values(total).reduce((a,b)=>a+b,0),168);
// Full G1 -> G2 (paid) -> full G2 -> reload. Previous gear stays; G3 stays blocked.
{
 const {p,api,data}=make(),hero=heroes[0];
 p.currency=10000;
 P.grantTestResources(p);
 buyTier(p,hero,1);
 assert.equal(P.gearInstalled(p,hero.id),6);
 assert.equal(P.gearPromotionCost(p,hero.id).currency,250);
 const hpBefore=P.gearBonuses(p,hero.id);
 assert.equal(hpBefore.hp.toFixed(2),"0.06");
 assert.equal(hpBefore.atk.toFixed(2),"0.06");
 assert.equal(P.promoteGear(p,hero.id).to,2);
 assert.equal(p.currency,8750,"G1 1000 and promotion 250 only");
 assert.equal(p.gear[hero.id].tier,2);
 assert.equal(P.gearInstalled(p,hero.id),6);
 assert.equal(p.gear[hero.id].history["1"].filter(Boolean).length,6);
 assert.equal(p.gear[hero.id].slots.every(x=>x===null),true);
 assert.equal(P.promoteGear(p,hero.id),null,"cannot promote twice");
 const statAfter=P.gearBonuses(p,hero.id);
 assert.equal(statAfter.hp.toFixed(2),"0.09");
 assert.equal(statAfter.atk.toFixed(2),"0.09");
 assert.equal(P.heroStats(p,hero).speed,hero.speed);
 assert.equal(P.grantTestResources(p).materials.Gl,2);
 assert.equal(p.materials.Cl,67,"G2 grant raises to tier-specific floor");
 assert.equal(S.save(p,()=>api),true);
 const restored=S.load(heroes,()=>api).progress;
 assert.equal(restored.gear.kael.tier,2);
 assert.equal(restored.gear.kael.history["1"][0],"g1-blade");
 assert.equal(P.gearBonuses(restored,hero.id).hp.toFixed(2),"0.09");
 assert.equal(P.gearPromotionCost(restored,hero.id),null);
 // G2 requires glass for selected wand; tank kit does not, so test independently.
 buyTier(restored,hero,2);
 const bonuses=P.gearBonuses(restored,hero.id);
 assert.equal(bonuses.hp.toFixed(2),"0.15");
 assert.equal(bonuses.atk.toFixed(2),"0.15");
 assert.equal(P.gearInstalled(restored,hero.id),12);
 assert.equal(P.gearPromotionCost(restored,hero.id),null,"G3 is out of scope");
 assert.equal(P.promoteGear(restored,hero.id),null);
 assert.equal(S.save(restored,()=>api),true);
 const replay=S.load(heroes,()=>api).progress;
 assert.equal(replay.gear.kael.tier,2);
 assert.equal(replay.gear.kael.slots.filter(Boolean).length,6);
 assert.equal(replay.gear.kael.history["1"].filter(Boolean).length,6);
 assert.equal(P.gearBonuses(replay,hero.id).atk.toFixed(2),"0.15");
 assert.equal(replay.currency,6750,"1000+250+2000 spent");
 assert.equal(P.heroStats(replay,hero).speed,hero.speed);
 assert.equal(data.get(V.SOURCE_KEY),undefined,"fresh test has no v2");
}
// Every class can complete G2 without duplicates or illegal choices.
for(const hero of heroes){
 const {p,api}=make();p.currency=15000;
 P.grantTestResources(p);buyTier(p,hero,1);P.promoteGear(p,hero.id);
 P.grantTestResources(p);buyTier(p,hero,2);
 assert.equal(sums(p.gear[hero.id].slots).hp.toFixed(2),"0.06");
 assert.equal(sums(p.gear[hero.id].slots).atk.toFixed(2),"0.06");
 assert.equal(S.save(p,()=>api),true);
 const r=S.load(heroes,()=>api).progress;
 assert.equal(r.gear[hero.id].tier,2);
 assert.equal(r.gear[hero.id].history["1"].filter(Boolean).length,6);
}
// Glass shortage and invalid G2 history cannot be recorded.
{
 const {p,api,data}=make(),hero=heroes[4];p.currency=10000;
 P.grantTestResources(p);buyTier(p,hero,1);P.promoteGear(p,hero.id);
 P.grantTestResources(p);p.materials.Gl=0;
 assert.equal(P.canEquipItem(p,hero.id,"g2-wand"),false);
 assert.match(P.itemBlockReason(p,hero.id,"g2-wand"),/Стекло/);
 assert.equal(S.save(p,()=>api),true);
 const original=data.get(V.KEY),invalid=JSON.parse(original);
 invalid.heroes[hero.id].gear.installedByTier["1"][0]=null;
 data.set(V.KEY,JSON.stringify(invalid));
 assert.equal(S.load(heroes,()=>api).blocked,true);
 assert.equal(S.save(S.load(heroes,()=>api).progress,()=>api),false);
 data.set(V.KEY,original);
 assert.equal(S.load(heroes,()=>api).progress.gear[hero.id].tier,2);
}
// A stale tab cannot overwrite the G1->G2 transition.
{
 const {p,api}=make();const second=S.load(heroes,()=>api).progress;
 p.currency=10000;P.grantTestResources(p);buyTier(p,heroes[0],1);
 assert.equal(S.save(p,()=>api),true);
 assert.equal(S.save(second,()=>api),false);
}
console.log("Gear-003B1 G2 catalog, 5 kits, history, transition, Gl shortage and reload passed");
