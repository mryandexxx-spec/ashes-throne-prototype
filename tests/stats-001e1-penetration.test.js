"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const source=["initiative-model.js","ability-data.js","battle-rng.js",
 "combat-core.js","combat-log.js"].map(read).join("\n");
const {CombatCore:core}=vm.runInNewContext(source+"\n({CombatCore})");
const hero=(id="test-physical-strike",stats={})=>({
 id,name:id,side:"ally",hp:150,atk:40,physicalAttack:40,
 magicAttack:40,speed:400,defensePenetration:20,...stats});
const foe=(id="enemy",stats={})=>({
 id,name:id,side:"enemy",hp:180,atk:1,speed:1,...stats});
const own=x=>JSON.parse(JSON.stringify(x));
function ready(h,foes,options={}){
 const b=core.createBattle([h,...foes],[],options);
 core.advanceToPlayerTurn(b);
 assert.equal(b.fighters[b.currentActor]?.side,"ally");
 return b;
}
const cast=b=>core.performPlayerAbility(b,"special");
const damage=b=>b.events.find(e=>e.type==="damage");
// Default typed damage path and any legacy path remain untouched.
let b=ready(hero(),[foe("e",{physicalDefense:50})]);
assert.equal(cast(b),true);
assert.equal(damage(b).hpDamage,27,"unchanged DEF formula when opt-in is off");
assert.equal(Object.hasOwn(b,"penetrationChecks"),false);
// Test P-percent: effective DEF = DEF * (1 - penetration/100).
for(const [penetration,expected] of [
 [0,27],[20,29],[50,32],[100,40]
]){
 b=ready(hero("test-physical-strike",{defensePenetration:penetration}),
  [foe("e",{physicalDefense:50})],{penetrationChecks:true});
 assert.equal(cast(b),true);
 assert.equal(damage(b).hpDamage,expected,"penetration "+penetration);
 assert.equal(b.fighters[1].hp,180-expected);
}
// Penetration 20% vs DEF 100: effective DEF 80, D=40 yields 22.
b=ready(hero(),[foe("e",{physicalDefense:100})],{penetrationChecks:true});
assert.equal(cast(b),true);
assert.equal(damage(b).hpDamage,22);
// Untyped defense is not invented: missing matching DEF stays missing.
b=ready(hero(),[foe()],{penetrationChecks:true});
assert.equal(cast(b),true);
assert.equal(damage(b).hpDamage,40);
assert.equal(Object.hasOwn(b.fighters[1],"physicalDefense"),false);
// Matching damage school only: physical damage ignores magicDefense.
b=ready(hero(),[foe("e",{physicalDefense:0,magicDefense:1000})],{penetrationChecks:true});
assert.equal(cast(b),true);
assert.equal(damage(b).hpDamage,40);
// Magical strike ignores physicalDefense but reduces magicDefense.
b=ready(hero("test-magical-strike"),[
 foe("e",{physicalDefense:1000,magicDefense:50})
],{penetrationChecks:true});
assert.equal(cast(b),true);
assert.equal(damage(b).damageType,"magical");
assert.equal(damage(b).hpDamage,29);
b=ready(hero("test-magical-strike"),[
 foe("e",{physicalDefense:50,magicDefense:0})
],{penetrationChecks:true});
assert.equal(cast(b),true);
assert.equal(damage(b).hpDamage,40);
// Penetration cannot bypass guard, Protection, or HP.
b=ready(hero(),[foe("guard",{physicalDefense:50,
 protection:20,maxProtection:20})],{penetrationChecks:true});
b.fighters[1].guardHits=2;
assert.equal(cast(b),true);
assert.equal(damage(b).amount,15,"round(40*100/140)=29; guard makes 15");
assert.equal(damage(b).protectionDamage,15);
assert.equal(damage(b).hpDamage,0);
assert.equal(b.fighters[1].protection,5);
assert.equal(b.fighters[1].guardHits,1);
// Composite chain: crit -> weakening -> reduced DEF -> guard -> Protection -> HP.
b=ready(hero("test-physical-strike",{critChance:100,critDamage:150}),[
 foe("shield",{physicalDefense:50,protection:10,maxProtection:10})
],{penetrationChecks:true,critChecks:true,rngSeed:0});
b.fighters[0].weakenAttacks=1;
b.fighters[1].guardHits=2;
assert.equal(cast(b),true);
assert.equal(b.rng.draws,1);
assert.equal(damage(b).amount,15,"60 crit -> 42 weakened -> DEF 40 gives 30 -> guard 15");
assert.equal(damage(b).protectionDamage,10);
assert.equal(damage(b).hpDamage,5);
assert.equal(b.fighters[1].hp,175);
assert.equal(b.fighters[1].guardHits,1);
// With a miss, there is no defense or shield handling, nor critical roll.
b=ready(hero("test-physical-strike",{critChance:100,critDamage:150}),[
 foe("dodger",{evasion:100,physicalDefense:50,protection:10,maxProtection:10})
],{penetrationChecks:true,hitChecks:true,critChecks:true,rngSeed:0});
b.fighters[1].guardHits=2;
assert.equal(cast(b),true);
assert.equal(b.rng.draws,1);
assert.equal(b.fighters[1].hp,180);
assert.equal(b.fighters[1].protection,10);
assert.equal(b.fighters[1].guardHits,2);
assert.equal(b.events.some(e=>e.type==="critical"),false);
// A target with no physicalDefense but with Protection still absorbs the hit.
b=ready(hero(),[foe("shield",{protection:50,maxProtection:50})],
 {penetrationChecks:true});
assert.equal(cast(b),true);
assert.equal(b.fighters[1].protection,10);
assert.equal(b.fighters[1].hp,180);
// Group magical attacks: independent per-target matching DEF and protection.
b=ready(hero("test-magical-group"),[
 foe("unarmored",{magicDefense:0}),
 foe("armored",{magicDefense:100,protection:10,maxProtection:10}),
 foe("physical-only",{physicalDefense:500,magicDefense:0})
],{penetrationChecks:true});
assert.equal(cast(b),true);
assert.equal(b.events.filter(e=>e.type==="damage").length,3);
assert.equal(b.fighters[1].hp,140);
assert.equal(b.fighters[2].protection,0);
assert.equal(b.fighters[2].hp,168,"40 against effective DEF 80 = 22; 10 absorbed");
assert.equal(b.fighters[3].hp,140);
// Missing, invalid chance or incorrect type must reject before any action
// or RNG draw; even if the last enemy has invalid defense.
const bad=[undefined,null,-1,101,NaN,Infinity,"20"];
for(const value of bad){
 b=ready(hero("test-magical-group",{defensePenetration:value}),[
  foe("good",{magicDefense:0}),foe("last",{magicDefense:100})
 ],{penetrationChecks:true,hitChecks:true,rngSeed:0});
 const prev=own({rng:b.rng,events:b.events,turn:b.turn,allyActions:b.allyActions,
  cooldown:b.fighters[0].specialCooldown,hp:b.fighters.map(x=>x.hp)});
 assert.equal(cast(b),false);
 assert.deepEqual(own({rng:b.rng,events:b.events,turn:b.turn,allyActions:b.allyActions,
  cooldown:b.fighters[0].specialCooldown,hp:b.fighters.map(x=>x.hp)}),prev);
}
// Typed target's invalid matching defense gets checked before a group action.
b=ready(hero("test-magical-group"),[
 foe("good",{magicDefense:0}),foe("bad",{magicDefense:-2})
],{penetrationChecks:true});
const before=own({events:b.events,turn:b.turn,hp:b.fighters.map(x=>x.hp)});
assert.equal(cast(b),false);
assert.deepEqual(own({events:b.events,turn:b.turn,hp:b.fighters.map(x=>x.hp)}),before);
// Disabled opt-in ignores fields entirely, including malformed bonus.
b=ready(hero("test-physical-strike",{defensePenetration:Infinity}),[
 foe("e",{physicalDefense:50})]);
assert.equal(cast(b),true);
assert.equal(damage(b).hpDamage,27);
// Legacy basic attack is not affected, even if opt-in is true and
// its attacker has wildly invalid defensePenetration.
b=ready(hero("legacy",{defensePenetration:Infinity}),[
 foe("e",{physicalDefense:1000})],{penetrationChecks:true});
assert.equal(core.performPlayerAbility(b,"basic"),true);
assert.equal(damage(b).amount,40);
assert.equal(b.fighters[1].hp,140);
// Invalid gate fails early.
assert.throws(()=>core.createBattle([hero(),foe()],[],{penetrationChecks:"yes"}),/boolean/);
// Auto-actions use the same shared path and do not require RNG for deterministic penetration.
function auto(){
 const b=ready(hero("test-physical-strike",{combatProfile:"stats002c"}),[
  foe("e",{physicalDefense:50})],{penetrationChecks:true});
 assert.equal(core.performAutoAction(b,{abilityId:"basic",targetIndex:1}),true);
 return own({events:b.events,hp:b.fighters.map(x=>x.hp)});
}
assert.deepEqual(auto(),auto());
assert.equal(auto().hp[1],151);
// Unrelated RNG remains untouched: penetration has no random roll.
b=ready(hero(),[foe("e",{physicalDefense:50})],{penetrationChecks:true,rngSeed:42});
assert.equal(cast(b),true);
assert.equal(b.rng.draws,0);
console.log("Stats-001E1: physical/magical percent penetration, guard/shield, crit/hit, multi-target, invalid atomicity and legacy passed");
