"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const code=["initiative-model.js","ability-data.js","combat-core.js"].map(p=>
 fs.readFileSync(path.join(__dirname,"..",p),"utf8")).join("\n");
const {CombatCore:core,AbilityData:abilities}=vm.runInNewContext(code+"\n({CombatCore,AbilityData})");
const ally=(id,extra={})=>({id,name:id,side:"ally",hp:150,atk:18,speed:250,...extra});
const enemy=(id)=>({id,name:id,side:"enemy",hp:200,atk:1,speed:1});
function battle(hero,enemies=[enemy("foe")]){
 const b=core.createBattle([hero,...enemies]);
 core.advanceToPlayerTurn(b);
 assert.equal(b.fighters[b.currentActor].id,hero.id);
 return b;
}
const damages=b=>b.events.filter(e=>e.type==="damage");
assert.equal(abilities.damageStat(abilities.get({id:"lyra"},"basic")),"atk");
assert.equal(abilities.damageType(abilities.get({id:"lyra"},"basic")),"legacy");
assert.equal(abilities.damageStat(abilities.get({id:"test-physical-strike"},"special")),"physicalAttack");
assert.equal(abilities.damageStat(abilities.get({id:"test-magical-strike"},"special")),"magicAttack");
assert.equal(abilities.damageType({kind:"damage",damageType:"unknown"}),null,
 "unknown explicitly typed abilities must not become legacy");
assert.equal(abilities.damageStat({kind:"heal",damageType:"physical"}),null);
let b=battle(ally("test-physical-strike",{physicalAttack:34,magicAttack:90}));
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.fighters[1].hp,166,"physical ability uses physicalAttack not atk or magicAttack");
assert.equal(damages(b)[0].damageType,"physical");
b=battle(ally("test-magical-strike",{physicalAttack:90,magicAttack:41}));
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.fighters[1].hp,159,"magical ability uses magicAttack");
assert.equal(damages(b)[0].damageType,"magical");
b=battle(ally("test-magical-group",{physicalAttack:90,magicAttack:31}),
 [enemy("foe"),enemy("foe2")]);
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.deepEqual(b.fighters.slice(1).map(x=>x.hp),[169,169]);
assert.deepEqual(damages(b).map(x=>x.damageType),["magical","magical"]);
b=battle(ally("test-magical-strike"));
const pre=JSON.stringify(b),events=b.events;
assert.equal(core.performPlayerAbility(b,"special"),false,"no magicAttack is not zero and never atk fallback");
assert.equal(JSON.stringify(b),pre,"rejected typed action must be atomic");
assert.equal(b.events,events);
b=battle(ally("test-physical-strike",{physicalAttack:Infinity}));
assert.equal(core.performPlayerAbility(b,"special"),false);
b=battle(ally("lyra",{atk:35,physicalAttack:900,magicAttack:900}));
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.fighters[1].hp,165,"legacy damage retains general atk");
assert.equal(damages(b)[0].damageType,undefined,"legacy combat log remains unchanged");
b=battle(ally("test-area-damage",{atk:21,physicalAttack:900,magicAttack:900}),
 [enemy("foe"),enemy("foe2")]);
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.deepEqual(b.fighters.slice(1).map(x=>x.hp),[179,179],
 "legacy multi-target damage must retain original general atk");
assert.ok(damages(b).every(x=>!Object.hasOwn(x,"damageType")));
console.log("Stats-001B: explicit physical/magical single/group damage, validation and legacy compatibility passed");
