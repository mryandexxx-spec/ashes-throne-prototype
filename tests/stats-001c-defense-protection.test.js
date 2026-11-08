"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const src=["initiative-model.js","ability-data.js","combat-core.js"]
 .map(n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8")).join("\n");
const {CombatCore:core}=vm.runInNewContext(src+"\n({CombatCore})");
const hero=(id,stats={})=>({id,name:id,side:"ally",hp:150,atk:20,
 physicalAttack:40,magicAttack:40,speed:300,...stats});
const foe=(id,stats={})=>({id,name:id,side:"enemy",hp:100,atk:1,speed:1,...stats});
function ready(h,e){const b=core.createBattle([h,...e]);core.advanceToPlayerTurn(b);return b;}
const lastDamage=b=>b.events.find(e=>e.type==="damage");
// Weakening => 28; DEF 50 => 19; guard => 10; Protection 6 => HP takes 4.
let b=ready(hero("test-physical-strike"),[foe("target",{
 physicalDefense:50,magicDefense:999,protection:6,maxProtection:10})]);
b.fighters[0].weakenAttacks=1;b.fighters[1].guardHits=2;
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.fighters[1].hp,96);
assert.equal(b.fighters[1].protection,0);
assert.equal(b.fighters[1].guardHits,1);
assert.equal(b.fighters[0].weakenAttacks,0);
assert.equal(lastDamage(b).amount,10,"amount is incoming after mitigation before absorption");
assert.equal(lastDamage(b).damageType,"physical");
assert.equal(lastDamage(b).protectionDamage,6);
assert.equal(lastDamage(b).hpDamage,4);
assert.equal(lastDamage(b).remainingProtection,0);
// Defense table using D=40: 0,25,50,100,200,400.
for(const [def,expected] of [[0,40],[25,32],[50,27],[100,20],[200,13],[400,8]]){
 b=ready(hero("test-physical-strike"),[foe("target",{physicalDefense:def})]);
 assert.equal(core.performPlayerAbility(b,"special"),true);
 assert.equal(b.fighters[1].hp,100-expected,"physical defense "+def);
 assert.equal(lastDamage(b).hpDamage,expected);
 assert.equal(lastDamage(b).remainingProtection,null);
}
// Cross-school defense does not reduce magic damage.
b=ready(hero("test-magical-strike"),[foe("target",{physicalDefense:1000,magicDefense:0})]);
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.fighters[1].hp,60);
b=ready(hero("test-magical-strike"),[foe("target",{physicalDefense:0,magicDefense:100})]);
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.fighters[1].hp,80);
// Full absorption does not kill or change HP, pool is never refilled by turns.
b=ready(hero("test-physical-strike"),[foe("target",{
 physicalDefense:0,protection:50,maxProtection:50})]);
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.fighters[1].protection,10);
assert.equal(b.fighters[1].hp,100);
assert.equal(b.fighters[1].maxProtection,50);
assert.equal(lastDamage(b).protectionDamage,40);
assert.equal(lastDamage(b).hpDamage,0);
// Protection does not create a healing target: medic heals HP only.
b=ready(hero("medic-demo",{hp:60}),[foe("target")]);
b.fighters[0].maxHp=100;b.fighters[0].hp=30;
b.fighters[0].protection=5;b.fighters[0].maxProtection=12;
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.fighters[0].hp,60);
assert.equal(b.fighters[0].protection,5);
// Group hits each recipient with independent school DEF and Protection.
b=ready(hero("test-magical-group"),[
 foe("one",{magicDefense:100,protection:15,maxProtection:20}),
 foe("two",{magicDefense:0,protection:10,maxProtection:20})]);
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.fighters[1].hp,95); // 20 incoming, 15 absorbed
assert.equal(b.fighters[1].protection,0);
assert.equal(b.fighters[2].hp,70); // 40 incoming, 10 absorbed
assert.equal(b.fighters[2].protection,0);
const hits=b.events.filter(e=>e.type==="damage");
assert.deepEqual(Array.from(hits,e=>e.protectionDamage),[15,10]);
assert.deepEqual(Array.from(hits,e=>e.hpDamage),[5,30]);
// Malformed target defense/pool is rejected atomically, including group target #2.
for(const bad of [
 {physicalDefense:-1},
 {physicalDefense:Infinity},
 {protection:5,maxProtection:4},
 {protection:NaN,maxProtection:10},
 {protection:1},
 {maxProtection:9}
]){
 b=ready(hero("test-physical-strike"),[foe("target",bad)]);
 const before=JSON.stringify(b),events=b.events;
 assert.equal(core.performPlayerAbility(b,"special"),false);
 assert.equal(JSON.stringify(b),before);
 assert.equal(b.events,events);
}
b=ready(hero("test-magical-group"),[
 foe("one",{magicDefense:0,protection:5,maxProtection:10}),
 foe("two",{magicDefense:-2})]);
const prev=JSON.stringify(b);
assert.equal(core.performPlayerAbility(b,"special"),false);
assert.equal(JSON.stringify(b),prev,"a bad group target must not partially lose Protection");
// Legacy attacks ignore NEW defense and Protection, preserving old exact event schema.
b=ready(hero("lyra",{atk:35}),[foe("target",{
 physicalDefense:1000,magicDefense:1000,protection:90,maxProtection:90})]);
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.fighters[1].hp,65);
assert.equal(b.fighters[1].protection,90);
assert.equal(lastDamage(b).amount,35);
assert.equal(lastDamage(b).protectionDamage,undefined);
assert.equal(lastDamage(b).damageType,undefined);
// Lethal typed hit only after Protection exhaustion, ends the battle normally.
b=ready(hero("test-magical-strike",{magicAttack:100}),[foe("target",{
 hp:10,magicDefense:0,protection:5,maxProtection:5})]);
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.fighters[1].hp,0);
assert.equal(b.fighters[1].protection,0);
assert.equal(b.winner,"ally");
assert.equal(b.events.some(e=>e.type==="battle-end"),true);
console.log("Stats-001C: defense table, Protection, legacy isolation, group atomicity and healing passed");
