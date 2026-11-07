"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const src=["gear-data.js","progress-core.js","save-core.js","progress-v3-core.js"]
 .map(n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8")).join("\n");
const {G,P,S,V}=vm.runInNewContext(src+"\n({G:GearData,P:ProgressCore,S:SaveCore,V:ProgressV3Core})");
const heroes=[
 {id:"kael",side:"ally",hp:160,atk:25,speed:110},
 {id:"lyra",side:"ally",hp:90,atk:35,speed:150},
 {id:"darin",side:"ally",hp:130,atk:28,speed:125},
 {id:"medic-demo",side:"ally",hp:110,atk:18,speed:115},
 {id:"test-area-damage",side:"ally",hp:100,atk:23,speed:120}
];
function store(){const m=new Map();return {m,s:{getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)}}}
function fill(p,id,tier){
 for(const slot of G.SLOTS){
  const candidates=P.itemOffer(p,id,slot.id);
  assert.equal(candidates.length,1,id+" tier "+tier+" slot "+slot.id);
  const item=candidates[0];assert.equal(item.tier,tier);
  assert.equal(P.equipItem(p,id,item.id),true);
  assert.equal(P.equipItem(p,id,item.id),false,"double tap must not purchase");
 }
}
function approx(a,b){assert.ok(Math.abs(a-b)<1e-10,a+" differs from "+b);}
assert.equal(G.ITEMS.length,36);
for(const tier of [1,2,3])assert.equal(G.ITEMS.filter(item=>item.tier===tier).length,12);
assert.equal(G.offered("tank","head",4).length,0);
assert.equal(G.get("g4-blade"),null);
// Explicit v0.5 optimized recipes; no unwanted legacy v0.4 G3 substitutions.
const recipes={
 "g3-blade":{U:2,Fe:1},
 "g3-bow":{P:1,Wo:2,Th:2,Fa:1},
 "g3-wand":{P:1,Gl:2,Wo:1},
 "g3-vest":{U:1,P:1,Fe:1,Le:1},
 "g3-jacket":{U:1,P:1,Cl:1,Fa:1},
 "g3-helm":{U:2,Le:1},
 "g3-hood":{P:1,Cl:2,Th:2},
 "g3-gaunt":{U:1,P:1,Th:1},
 "g3-workglove":{P:1,Cl:2,Th:2},
 "g3-bootheavy":{U:1,P:1,Le:2},
 "g3-bootlight":{P:1,Cl:2,Le:1,Th:1},
 "g3-belt":{U:1,Cl:1,Fa:1}
};
for(const [id,recipe] of Object.entries(recipes)){
 assert.equal(JSON.stringify(G.get(id).recipe),JSON.stringify(recipe),id);
 assert.equal(G.get(id).tier,3);
 assert.equal(G.get(id).bonuses.speed,0);
}
// Five six-slot G3 sets: independent arithmetic including U/P flattening.
const total=Object.fromEntries(G.MATERIALS.map(k=>[k,0]));
for(const classId of G.CLASS_IDS)for(const slot of G.SLOTS){
 const item=G.offered(classId,slot.id,3)[0];
 assert.ok(item,"missing G3 option "+classId+" "+slot.id);
 for(const [id,n] of Object.entries(item.ingredients))total[id]+=n;
}
assert.equal(JSON.stringify(total),JSON.stringify({Fe:50,Le:32,Cl:66,Wo:4,Fa:32,Th:18,Gl:4}));
assert.equal(Object.values(total).reduce((a,b)=>a+b,0),206);
for(const hero of heroes){
 const {m,s}=store(),p=S.load(heroes,()=>s).progress;
 p.currency=12000;
 P.grantTestResources(p);
 fill(p,hero.id,1);
 assert.equal(P.gearPromotionCost(p,hero.id).currency,250);
 assert.equal(P.promoteGear(p,hero.id).to,2);
 assert.equal(P.gearInstalled(p,hero.id),6);
 P.grantTestResources(p);
 fill(p,hero.id,2);
 assert.equal(P.gearPromotionCost(p,hero.id).currency,500);
 const before=P.gearBonuses(p,hero.id);
 approx(before.hp,.15);approx(before.atk,.15);
 assert.equal(P.promoteGear(p,hero.id).to,3);
 assert.equal(P.gearPromotionCost(p,hero.id),null,"cannot promote G3 to G4");
 assert.equal(P.promoteGear(p,hero.id),null,"cannot double charge 500");
 assert.equal(p.currency,8250,"G1 1000 + 250 + G2 2000 + 500");
 assert.equal(P.gearInstalled(p,hero.id),12);
 assert.equal(p.gear[hero.id].history["1"].filter(Boolean).length,6);
 assert.equal(p.gear[hero.id].history["2"].filter(Boolean).length,6);
 approx(P.gearBonuses(p,hero.id).hp,.18);
 approx(P.gearBonuses(p,hero.id).atk,.18);
 assert.equal(S.save(p,()=>s),true);
 const restored=S.load(heroes,()=>s).progress;
 assert.equal(restored.gear[hero.id].tier,3);
 assert.equal(restored.gear[hero.id].history["1"].length,6);
 assert.equal(restored.gear[hero.id].history["2"].length,6);
 assert.equal(restored.gear[hero.id].slots.filter(Boolean).length,0);
 const granted=P.grantTestResources(restored);
 assert.ok(granted);
 for(const [id,n] of Object.entries(G.G3_FLOOR))assert.ok(restored.materials[id]>=n,id+" floor");
 fill(restored,hero.id,3);
 approx(P.gearBonuses(restored,hero.id).hp,.24);
 approx(P.gearBonuses(restored,hero.id).atk,.24);
 assert.equal(P.gearInstalled(restored,hero.id),18);
 assert.equal(P.gearPromotionCost(restored,hero.id),null);
 assert.equal(P.heroStats(restored,hero).speed,hero.speed);
 assert.equal(restored.currency,5250,"three full sets 1000+2000+3000, two transitions 750");
 assert.equal(S.save(restored,()=>s),true);
 const saved=JSON.parse(m.get(V.KEY));
 assert.deepEqual(Object.keys(saved.heroes[hero.id].gear.installedByTier).sort(),["1","2","3"]);
 const again=S.load(heroes,()=>s).progress;
 assert.equal(again.gear[hero.id].tier,3);
 assert.equal(again.gear[hero.id].slots.filter(Boolean).length,6);
 approx(P.gearBonuses(again,hero.id).hp,.24);
 approx(P.gearBonuses(again,hero.id).atk,.24);
 assert.equal(again.currency,5250);
 // Existing v3 remains the same key; v2 is not overwritten.
 assert.equal(m.has(V.SOURCE_KEY),false);
 // Falsification: corrupt historical paid G2 entry; loader must block without reset.
 const raw=m.get(V.KEY),corrupt=JSON.parse(raw);
 corrupt.heroes[hero.id].gear.installedByTier["2"][0]=null;
 m.set(V.KEY,JSON.stringify(corrupt));
 assert.equal(S.load(heroes,()=>s).blocked,true);
 m.set(V.KEY,raw);
 assert.equal(S.load(heroes,()=>s).progress.gear[hero.id].tier,3);
}
// Glass shortage blocks a G3 mage wand and does not deduct a currency unit.
{
 const {s}=store(),p=S.load(heroes,()=>s).progress,hero=heroes[4];p.currency=12000;
 P.grantTestResources(p);fill(p,hero.id,1);P.promoteGear(p,hero.id);
 P.grantTestResources(p);fill(p,hero.id,2);P.promoteGear(p,hero.id);
 P.grantTestResources(p);p.materials.Gl=0;
 const before=p.currency;
 assert.equal(P.canEquipItem(p,hero.id,"g3-wand"),false);
 assert.match(P.itemBlockReason(p,hero.id,"g3-wand"),/Стекло/);
 assert.equal(P.equipItem(p,hero.id,"g3-wand"),false);
 assert.equal(p.currency,before);
}
console.log("Gear-003B2 G3 206 materials, all classes, G1/G2 history, saves and budget passed");
