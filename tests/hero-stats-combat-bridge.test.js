const test=require("node:test");
const assert=require("node:assert/strict");
const Core=require("../hero-stats-core.js");
const Profiles=require("../hero-stats-profiles.js");
const Bridge=require("../hero-stats-combat-bridge.js");

test("Ren is derived from a real 14-stat profile, not HEROES legacy values",()=>{
 const hero=Object.freeze({id:"ren",side:"ally",hp:91,atk:27,speed:150});
 const inputs=Object.freeze({level:1,stars:1,gearPercent:Object.freeze({hp:0,atk:0})});
 const result=Bridge.apply(hero,inputs,Profiles.ren,Core);
 assert.equal(result.hp,120);
 assert.equal(result.atk,28);
 assert.equal(result.physicalAttack,28);
 assert.equal(result.speed,150);
 assert.equal(result.protection,35);
 assert.equal(result.maxProtection,35);
 assert.equal(result.magicAttack,0);
 assert.equal(result.combatProfile,"stats002c");
 assert.equal(result.stats001bPilot,undefined);
 assert.ok(Object.isFrozen(result));
 assert.equal(hero.hp,91);
});

test("Nada uses 125 speed from profile, ignoring previous 120-speed pilot",()=>{
 const result=Bridge.apply({id:"nada",speed:120,hp:85,atk:18},
  {level:1,stars:1},Profiles.nada,Core);
 assert.equal(result.speed,125);
 assert.equal(result.hp,110);
 assert.equal(result.physicalAttack,19);
 assert.equal(result.physicalDefense,15);
 assert.equal(result.magicDefense,18);
 assert.equal(result.debuffPotency,25);
 assert.equal(result.debuffResistance,20);
});

test("level and stars now change actual hero stats; speed stays constant",()=>{
 const a=Bridge.apply({id:"ren"}, {level:1,stars:1},Profiles.ren,Core);
 const b=Bridge.apply({id:"ren"}, {level:15,stars:5},Profiles.ren,Core);
 assert.ok(b.hp>a.hp);
 assert.ok(b.physicalAttack>a.physicalAttack);
 assert.ok(b.physicalDefense>a.physicalDefense);
 assert.ok(b.protection>a.protection);
 assert.equal(b.speed,a.speed);
 assert.equal(b.critChance,a.critChance);
});

test("equipped legacy G bonuses now scale the new profile, not demo atk",()=>{
 const without=Bridge.apply({id:"nada"},{level:6,stars:2},Profiles.nada,Core);
 const withGear=Bridge.apply({id:"nada"},{level:6,stars:2,gearPercent:{hp:.06,atk:.06}},Profiles.nada,Core);
 assert.equal(withGear.hp,Math.round(without.hp*1.06));
 assert.equal(withGear.physicalAttack,Math.round(without.physicalAttack*1.06));
 assert.equal(withGear.atk,withGear.physicalAttack);
 assert.equal(withGear.speed,without.speed);
 assert.equal(withGear.protection,without.protection);
});

test("no support for Liora or mismatched heroes, and no hidden legacy progression",()=>{
 assert.throws(()=>Bridge.apply({id:"trial-liora"},
  {level:1,stars:1},Profiles.ren,Core),/matching/);
 assert.throws(()=>Bridge.apply({id:"ren"},
  {level:1,stars:1},Profiles.nada,Core),/matching/);
 assert.throws(()=>Bridge.apply({id:"ren"},
  {level:0,stars:1},Profiles.ren,Core),/level/);
 assert.throws(()=>Bridge.apply({id:"ren"},
  {level:1,stars:8},Profiles.ren,Core),/stars/);
 assert.throws(()=>Bridge.apply({id:"ren"},
  {level:1,stars:1,gearPercent:{hp:-1}},Profiles.ren,Core),/equipment/);
 assert.throws(()=>Bridge.apply({id:"ren"},
  {level:1,stars:1,gearPercent:{speed:5}},Profiles.ren,Core),/equipment/);
});

test("stat resolution is deterministic and does not mutate hero or progress",()=>{
 const hero=Object.freeze({id:"ren",side:"ally",hp:91,atk:27,skillLevels:{basic:3}});
 const progress={level:10,stars:2,gearPercent:{hp:.05,atk:.04}};
 const before=JSON.stringify(progress);
 const first=Bridge.apply(hero,progress,Profiles.ren,Core);
 const second=Bridge.apply(hero,progress,Profiles.ren,Core);
 assert.deepEqual(first,second);
 assert.deepEqual(first.skillLevels,{basic:3});
 assert.equal(JSON.stringify(progress),before);
});
