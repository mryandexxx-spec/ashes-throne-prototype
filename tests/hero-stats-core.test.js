const test=require("node:test");
const assert=require("node:assert/strict");
const Core=require("../hero-stats-core.js");
const Profiles=require("../hero-stats-profiles.js");
const clone=x=>JSON.parse(JSON.stringify(x));

test("14 independent stats and proposed control profiles for both heroes",()=>{
 assert.equal(Core.KEYS.length,14);
 for(const id of ["ren","nada"]){
  const original=Profiles[id];
  const result=Core.resolve(original);
  assert.deepEqual(Object.keys(result),Core.KEYS);
  assert.deepEqual(result,original.combatStats);
  assert.ok(Object.isFrozen(result));
 }
 assert.equal(Core.resolve(Profiles.ren).speed,150);
 assert.equal(Core.resolve(Profiles.nada).speed,125);
});

test("level/star/gear increments are explicit; only final integer pools round",()=>{
 const source={...clone(Profiles.ren),growth:{
  level:{hp:1.25,physicalAttack:0.5,critChance:0.2},
  star:{hp:2,protection:1,physicalDefense:0.25}
 }};
 const before=clone(source),gear={hp:3.5,physicalAttack:2,accuracy:1.5};
 const result=Core.resolve(source,{level:20,stars:3,gearBonuses:gear});
 assert.equal(result.hp,Math.round(120+19*1.25+2*2+3.5));
 assert.equal(result.physicalAttack,Math.round(28+19*0.5+2));
 assert.equal(result.critChance,10+19*0.2);
 assert.equal(result.physicalDefense,Math.round(18+2*0.25));
 assert.equal(result.accuracy,6.5);
 assert.equal(result.speed,150);
 assert.deepEqual(source,before);
 assert.deepEqual(gear,{hp:3.5,physicalAttack:2,accuracy:1.5});
});

test("speed never grows from normal level/star/gear, including upper bounds",()=>{
 for(const hero of Object.values(Profiles)){
  for(const level of [1,20,40,60,85]){
   for(const stars of [1,7]){
    assert.equal(Core.resolve(hero,{level,stars,gearBonuses:{hp:5}}).speed,hero.combatStats.speed);
   }
  }
  for(const field of ["level","star"]){
   assert.throws(()=>Core.resolve({...hero,growth:{[field]:{speed:1}}}),/cannot increase speed/);
  }
  assert.throws(()=>Core.resolve(hero,{gearBonuses:{speed:1}}),/cannot increase speed/);
 }
});

test("invalid character profiles reject rather than silently fabricate stats",()=>{
 const base=clone(Profiles.ren);
 for(const key of Core.KEYS){
  const invalid=clone(base);delete invalid.combatStats[key];
  assert.throws(()=>Core.resolve(invalid),/missing a stat/);
 }
 assert.throws(()=>Core.resolve({...base,id:"trial-liora"}),/scoped/);
 assert.throws(()=>Core.resolve({...base,combatStats:{...base.combatStats,atk:20}}),/unknown stat/);
 for(const [key,value] of [["hp",0],["speed",0],["critChance",101],
  ["critDamage",99],["magicAttack",-1],["physicalDefense",NaN],
  ["protection",Infinity]]){
  assert.throws(()=>Core.resolve({...base,combatStats:{...base.combatStats,[key]:value}}));
 }
});

test("invalid progress, growth, and gear inputs reject without mutation",()=>{
 const h=Profiles.nada;
 for(const level of [0,86,2.5,NaN])assert.throws(()=>Core.resolve(h,{level}),/level/);
 for(const stars of [0,8,2.5])assert.throws(()=>Core.resolve(h,{stars}),/stars/);
 assert.throws(()=>Core.resolve({...h,growth:{level:{atk:2}}}),/unknown stat/);
 assert.throws(()=>Core.resolve({...h,growth:{unknown:{hp:1}}}),/growth/);
 assert.throws(()=>Core.resolve(h,{gearBonuses:{unknown:3}}),/unknown stat/);
 assert.throws(()=>Core.resolve(h,{gearBonuses:{hp:-1}}),/nonnegative/);
 assert.throws(()=>Core.resolve(h,{gearBonuses:{hp:Infinity}}),/finite/);
 assert.throws(()=>Core.resolve({...h,growth:{level:{critChance:2}}},{level:85}),/exceeds 100/);
 assert.throws(()=>Core.resolve({},{}),/scoped/);
});
