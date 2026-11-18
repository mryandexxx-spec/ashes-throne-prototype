"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const Star=require("../star-core.js"),Daily=require("../daily-core.js");
const Login=require("../login-core.js"),Skills=require("../skill-core.js");
const Profiles=require("../hero-stats-profiles.js");
const Core=require("../hero-stats-core.js"),Bridge=require("../hero-stats-combat-bridge.js");
const fresh=()=>({saveVersion:3,currency:0,accountXp:0,
 materials:{Fe:0,Le:0,Cl:0,Wo:0,Fa:0,Th:0,Gl:0},
 skillMaterials:{manual1:0,manual2:0,seal:0},
 heroStars:Star.fromLegacy()});
test("NET-007 combat bonus is capped at 18% and never changes speed",()=>{
 const main=Profiles.ren;
 const base=Bridge.apply({id:"ren"},{level:30,stars:1},main,Core);
 const max=Bridge.apply({id:"ren"},{level:30,stars:7},main,Core);
 assert.ok(max.hp>base.hp&&max.physicalAttack>base.physicalAttack);
 assert.ok(max.physicalDefense>base.physicalDefense);
 assert.equal(max.speed,base.speed);
 assert.equal(max.critChance,base.critChance);
 assert.equal(Star.combatMultiplier(1),1);
 assert.equal(Star.combatMultiplier(7),1.18);
 assert.equal(Star.combatMultiplier(8),1);
});
test("NET-007 extra shards at rank 7 exchange to ordinary currency without inflation on repeat",()=>{
 const p=fresh();
 p.heroStars.ren.rank=7;
 assert.equal(Star.add(p,"ren",6),true);
 assert.equal(p.currency,480);
 assert.equal(p.heroStars.ren.shards,0);
 assert.equal(Star.add(p,"ren",0),false);
 assert.equal(p.currency,480);
});
test("NET-007 excess collected before promotion is exchanged upon reaching rank 7",()=>{
 const p=fresh();
 p.heroStars.nada.rank=6;
 p.heroStars.nada.shards=104;
 const move=Star.promote(p,"nada");
 assert.equal(move.rank,7);
 assert.equal(move.spent,100);
 assert.equal(move.excessCurrency,320);
 assert.equal(p.currency,320);
 assert.equal(p.heroStars.nada.shards,0);
});
test("NET-007 daily campaign and tactical tasks award real upgrade books once",()=>{
 const p=fresh(),day="2026-11-18";
 assert.equal(Daily.record(p,"campaign-battle",day),true);
 assert.equal(Daily.record(p,"tactical-participation",day),true);
 assert.ok(Daily.claim(p,"campaign-battle",day));
 assert.ok(Daily.claim(p,"tactical-participation",day));
 assert.equal(p.skillMaterials.manual1,2);
 assert.equal(p.skillMaterials.manual2,3);
 assert.equal(Daily.claim(p,"campaign-battle",day),null);
 assert.equal(p.skillMaterials.manual1,2);
});
test("NET-007 batch daily claim credits skill materials once",()=>{
 const p=fresh(),day="2026-11-18";
 Daily.record(p,"campaign-battle",day);
 Daily.record(p,"tactical-participation",day);
 const grant=Daily.claimAll(p,day);
 assert.deepEqual(grant.ids,["campaign-battle","tactical-participation"]);
 assert.equal(grant.skillMaterials.manual1,2);
 assert.equal(grant.skillMaterials.manual2,3);
 assert.equal(p.skillMaterials.manual1,2);
 assert.equal(p.skillMaterials.manual2,3);
 assert.equal(Daily.claimAll(p,day),null);
});
test("NET-007 one seal per full seven-claim calendar cycle",()=>{
 const p=fresh();
 for(let n=1;n<=7;n++){
  const day="2026-11-"+String(n).padStart(2,"0");
  assert.equal(Login.claim(p,day).day,n);
 }
 assert.equal(p.skillMaterials.seal,1);
 assert.equal(Login.claim(p,"2026-11-07"),null);
 assert.equal(p.skillMaterials.seal,1);
 assert.equal(Login.claim(p,"2026-11-08").day,8);
 assert.equal(p.skillMaterials.seal,1);
});

test("NET-007 real campaign reward permits a paid skill upgrade without test grants",()=>{
 const p=fresh(),day="2026-11-18";
 p.levels={ren:12};
 Daily.record(p,"campaign-battle",day);
 assert.ok(Daily.claim(p,"campaign-battle",day));
 assert.equal(Login.claim(p,day).day,1);
 assert.equal(p.skillMaterials.manual1,2);
 assert.equal(Skills.upgrade(p,"ren","basic").level,2);
 assert.equal(Skills.upgrade(p,"ren","basic").level,3);
 assert.equal(Skills.level(p,"ren","basic"),3);
 assert.equal(p.skillMaterials.manual1,0);
 assert.equal(p.currency,50);
 assert.equal(Skills.upgrade(p,"ren","basic"),null,"no unlimited manual generation");
});
