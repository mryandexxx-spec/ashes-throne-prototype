"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const code=["gear-data.js","progress-core.js","progress-v3-core.js",
 "hero-stats-core.js","hero-stats-profiles.js","hero-stats-combat-bridge.js"]
 .map(name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8")).join("\n");
const {G,P,V,C,Profiles,Bridge}=vm.runInNewContext(code+"\n({G:GearData,P:ProgressCore,V:ProgressV3Core,C:HeroStatsCore,Profiles:HeroStatsProfiles,Bridge:HeroStatsCombatBridge})");
const ids=["kael","lyra","darin","medic-demo","test-area-damage","ren","nada","liora"];
const heroes=ids.map(id=>({id,side:"ally",hp:130,atk:25,speed:120}));
const fresh=()=>V.toRuntime(V.fresh(heroes,100),heroes);
const rich=p=>{p.currency=1000000;for(const key of G.MATERIALS)p.materials[key]=100000;return p;};
test("GEAR013 catalog: 13 tiers, six slots, class-specific offers and stat effects",()=>{
 assert.equal(G.MAX_TIER,13);
 assert.equal(G.ITEMS.length,336);
 for(let tier=1;tier<=13;tier++){
  for(const cls of G.CLASS_IDS)for(const slot of G.SLOTS){
   const offers=G.offered(cls,slot.id,tier);
   assert.equal(offers.length,1,"G"+tier+" "+cls+" "+slot.id);
   const item=offers[0];
   assert.equal(item.tier,tier);
   assert.equal(item.slotId,slot.id);
   assert.equal(item.bonuses.speed,0);
   assert.equal(Object.keys(item.statBonuses).length>0,true);
   assert.equal(Object.keys(item.statBonuses).includes("speed"),false);
  }
 }
});
test("GEAR013 all five classes complete G1-G13 without duplicate items or skipping",()=>{
 for(const hero of heroes.slice(0,5)){
  const p=rich(fresh());
  for(let tier=1;tier<=13;tier++){
   assert.equal(p.gear[hero.id].tier,tier);
   assert.equal(P.promoteGear(p,hero.id),null,"cannot promote before filling");
   for(const slot of G.SLOTS){
    const item=P.itemOffer(p,hero.id,slot.id)[0];
    assert.ok(item,"missing G"+tier+" "+slot.id);
    assert.equal(P.equipItem(p,hero.id,item.id),true);
    assert.equal(P.equipItem(p,hero.id,item.id),false,"must not double-buy");
   }
   assert.equal(P.gearInstalled(p,hero.id),tier*6);
   assert.equal(P.gearPromotionCost(p,hero.id)?.to??null,tier<13?tier+1:null);
   if(tier<13)assert.equal(P.promoteGear(p,hero.id).to,tier+1);
  }
  assert.equal(p.gear[hero.id].tier,13);
  assert.equal(P.promoteGear(p,hero.id),null);
  assert.equal(Object.keys(p.gear[hero.id].history).length,12);
  const saved=V.fromRuntime(p);
  assert.ok(saved,"G13 profile rejected: "+hero.id);
  assert.equal(saved.heroes[hero.id].gear.tier,13);
  assert.equal(V.toRuntime(saved,heroes).gear[hero.id].slots.filter(Boolean).length,6);
 }
});
test("GEAR013 individual stat bonuses affect Ren, Nada, Liora and survive v3 roundtrip",()=>{
 const p=rich(fresh());
 const baseline={};
 for(const id of ["ren","nada","liora"]){
  const hero=heroes.find(x=>x.id===id);
  baseline[id]=Bridge.apply(hero,{level:1,stars:1,gearPercent:P.gearBonuses(p,id),
   gearStats:P.gearBonuses(p,id).stats},Profiles[id],C);
  for(const slot of G.SLOTS){
   const item=P.itemOffer(p,id,slot.id)[0];
   assert.ok(item);
   assert.equal(P.equipItem(p,id,item.id),true);
  }
 }
 const serialized=V.fromRuntime(p);
 assert.ok(serialized);
 const loaded=V.toRuntime(serialized,heroes);
 for(const id of ["ren","nada","liora"]){
  const hero=heroes.find(x=>x.id===id);
  const bonus=P.gearBonuses(loaded,id);
  const after=Bridge.apply(hero,{level:1,stars:1,gearPercent:bonus,gearStats:bonus.stats},Profiles[id],C);
  assert.equal(after.speed,baseline[id].speed);
  assert.ok(after.hp>baseline[id].hp);
  assert.ok(after.protection>baseline[id].protection);
  assert.ok(after.physicalDefense>baseline[id].physicalDefense);
  assert.ok(after.accuracy>baseline[id].accuracy);
 }
 const damaged=JSON.parse(JSON.stringify(serialized));
 damaged.heroes.ren.gear.installedByTier["1"][0].itemId="g13-mage-weapon";
 assert.equal(V.validateActive(damaged,heroes),null,"invalid cross-tier item must be rejected");
});
test("GEAR013 G10+ history validates numerically and incomplete earlier ranks are rejected",()=>{
 const p=rich(fresh());
 for(let tier=1;tier<=13;tier++){
  for(const slot of G.SLOTS)assert.equal(P.equipItem(p,"ren",P.itemOffer(p,"ren",slot.id)[0].id),true);
  if(tier<13)assert.ok(P.promoteGear(p,"ren"));
 }
 const data=V.fromRuntime(p);assert.ok(data);
 assert.equal(Object.keys(data.heroes.ren.gear.installedByTier).length,13);
 assert.ok(V.toRuntime(data,heroes));
 const bad=JSON.parse(JSON.stringify(data));
 bad.heroes.ren.gear.installedByTier["10"][0]=null;
 assert.equal(V.validateActive(bad,heroes),null);
});

test("GEAR013 development resources refill a complete G10 tier without free purchases",()=>{
 const p=rich(fresh());
 for(let tier=1;tier<=9;tier++){
  for(const slot of G.SLOTS)assert.equal(P.equipItem(p,"ren",P.itemOffer(p,"ren",slot.id)[0].id),true);
  assert.ok(P.promoteGear(p,"ren"));
 }
 p.currency=0;for(const id of G.MATERIALS)p.materials[id]=0;
 const grant=P.grantTestResources(p);
 assert.ok(grant&&grant.currency>0);
 assert.equal(p.gear.ren.tier,10);
 for(const slot of G.SLOTS)assert.equal(P.equipItem(p,"ren",P.itemOffer(p,"ren",slot.id)[0].id),true);
 assert.equal(P.gearPromotionCost(p,"ren").to,11);
 assert.ok(P.canPromoteGear(p,"ren"));
});
test("GEAR013 demo hero stats receive real item defense and critical bonuses",()=>{
 const p=rich(fresh()),base=heroes[0];
 const original=P.heroStats(p,base);
 for(const slot of G.SLOTS)assert.equal(P.equipItem(p,"kael",P.itemOffer(p,"kael",slot.id)[0].id),true);
 const after=P.heroStats(p,base);
 assert.ok(after.hp>original.hp);
 assert.ok(after.physicalDefense>original.physicalDefense);
 // An unequipped demo hero has no Protection pool (undefined), not zero.
 assert.ok(after.protection>(original.protection??0));
 assert.equal(after.maxProtection,after.protection,"valid typed combat pool");
 assert.ok(after.accuracy>0);
 assert.equal(after.speed,original.speed);
});
