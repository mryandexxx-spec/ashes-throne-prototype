const test=require("node:test");
const assert=require("node:assert/strict");
const Core=require("../hero-stats-core.js");
const Profiles=require("../hero-stats-profiles.js");
const Bridge=require("../hero-stats-combat-bridge.js");

test("opt-in Ren keeps legacy HP/ATK/initiative while exposing 14 validated stats",()=>{
 const old=Object.freeze({id:"ren",side:"ally",hp:91,atk:27,speed:150});
 const progressed=Object.freeze({...old,level:20,hp:166,atk:45});
 const result=Bridge.apply(old,progressed,Profiles.ren,Core);
 assert.equal(result.hp,166);
 assert.equal(result.atk,45);
 assert.equal(result.physicalAttack,45);
 assert.equal(result.speed,150);
 assert.equal(result.protection,35);
 assert.equal(result.maxProtection,35);
 assert.equal(result.magicAttack,0);
 assert.equal(result.combatProfile,"stats002c");
 assert.equal(result.stats001bPilot,true);
 assert.ok(Object.isFrozen(result));
 assert.deepEqual(old,{id:"ren",side:"ally",hp:91,atk:27,speed:150});
 assert.equal(progressed.physicalDefense,undefined);
});

test("Nada preserves current 120 initiative despite 125 proposal control speed",()=>{
 const hero={id:"nada",speed:120};
 const progressed={id:"nada",level:85,hp:140,atk:25,speed:120};
 const result=Bridge.apply(hero,progressed,Profiles.nada,Core);
 assert.equal(result.speed,120);
 assert.equal(result.physicalDefense,15);
 assert.equal(result.magicDefense,18);
 assert.equal(result.debuffPotency,25);
 assert.equal(result.debuffResistance,20);
 assert.equal(result.protection,45);
 assert.equal(result.physicalAttack,25);
});

test("pilot rejects mismatched hero IDs and unsupported characters",()=>{
 assert.throws(()=>Bridge.apply({id:"trial-liora",speed:100},
  {level:1,hp:100,atk:20},Profiles.ren,Core),/matching/);
 assert.throws(()=>Bridge.apply({id:"ren",speed:150},
  {level:1,hp:100,atk:20},Profiles.nada,Core),/matching/);
 assert.throws(()=>Bridge.apply({id:"ren",speed:150},
  {level:1,hp:0,atk:20},Profiles.ren,Core),/Invalid legacy/);
 assert.throws(()=>Bridge.apply({id:"ren",speed:0},
  {level:1,hp:100,atk:20},Profiles.ren,Core),/initiative/);
});

test("bridge is deterministic over repeated calls and does not touch saves",()=>{
 const hero={id:"ren",speed:150};
 const progressed={id:"ren",hp:120,atk:31,level:1,skillLevels:{basic:3}};
 const saved=JSON.stringify(progressed);
 const first=Bridge.apply(hero,progressed,Profiles.ren,Core);
 const second=Bridge.apply(hero,progressed,Profiles.ren,Core);
 assert.deepEqual(first,second);
 assert.deepEqual(first.skillLevels,{basic:3});
 assert.equal(JSON.stringify(progressed),saved);
});
