"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=x=>fs.readFileSync(path.join(__dirname,"..",x),"utf8");
const src=["initiative-model.js","ability-data.js","battle-rng.js","combat-core.js"]
 .map(read).join("\n").replace("const AbilityData=(()=>","let AbilityData=(()=>");
const suffix=[
 "const original=AbilityData;",
 "AbilityData=Object.freeze({...original,get:(fighter,id)=>{",
 " const a=original.get(fighter,id);",
 " if(['lyra','test-area-weaken','test-all-followups','test-primary-bonus'].includes(fighter?.id)&&id==='special')",
 "   return {...a,damageType:'physical'};",
 " return a;",
 "}});",
 "({CombatCore,BattleRng})"
].join("\n");
const {CombatCore:core}=vm.runInNewContext(src+"\n"+suffix);
const MAX=Number.MAX_SAFE_INTEGER;
const own=x=>JSON.parse(JSON.stringify(x));
const hero=(id="lyra",stats={})=>({
 id,name:id,side:"ally",hp:200,atk:30,physicalAttack:30,speed:400,
 accuracy:0,critChance:100,critDamage:150,defensePenetration:20,
 debuffPotency:0,...stats});
const enemy=(id,stats={})=>({
 id,name:id,side:"enemy",hp:200,atk:1,speed:1,
 physicalDefense:50,magicDefense:30,protection:12,maxProtection:12,
 evasion:0,debuffResistance:0,...stats});
const flags={rngSeed:0,hitChecks:true,critChecks:true,
 penetrationChecks:true,statusChecks:true};
const start=(h,targets,options=flags)=>{
 const b=core.createBattle([h,...targets],[],options);
 core.advanceToPlayerTurn(b);
 assert.equal(b.fighters[b.currentActor].side,"ally");
 return b;
};
const before=b=>own({rng:b.rng,events:b.events,turn:b.turn,
 actions:b.allyActions,actor:b.currentActor,
 cooldowns:b.fighters.map(f=>[f.specialCooldown,f.powerfulCooldown]),
 hp:b.fighters.map(f=>f.hp),protection:b.fighters.map(f=>f.protection),
 guard:b.fighters.map(f=>f.guardHits),weaken:b.fighters.map(f=>f.weakenAttacks)});
function checkNoPartial(b){
 const s=before(b);
 assert.equal(core.performPlayerAbility(b,"special"),false,
  "not enough combined draws must reject action");
 assert.deepEqual(before(b),s,"rejected command must be fully atomic");
}
// One target direct weaken with all three random gates:
// hit 1, critical 1, status 1 = three draws.
let b=start(hero(),[enemy("single")]);
b.rng.draws=MAX-2;
b.fighters[1].guardHits=2;
checkNoPartial(b);
b=start(hero(),[enemy("single")]);
b.rng.draws=MAX-3;
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.rng.draws,MAX);
assert.deepEqual(b.events.filter(e=>["critical","damage","effect"].includes(e.type))
 .map(e=>e.type).join(","),"critical,damage,effect");
assert.equal(b.fighters[1].weakenAttacks,2);
// Protection remains after critical/DEF/guard and is not bypassed.
assert.equal(b.fighters[1].protection,0);
assert.ok(b.fighters[1].hp>0);
// Two live targets with direct weaken: hit 2 + crit 2 + status 2 = six.
b=start(hero("test-area-weaken"),[enemy("a"),enemy("b")]);
b.rng.draws=MAX-5;
checkNoPartial(b);
b=start(hero("test-area-weaken"),[enemy("a"),enemy("b")]);
b.rng.draws=MAX-6;
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.rng.draws,MAX);
assert.equal(b.events.filter(e=>e.type==="damage").length,2);
assert.equal(b.events.filter(e=>e.type==="critical").length,2);
assert.equal(b.fighters[1].weakenAttacks,2);
assert.equal(b.fighters[2].weakenAttacks,2);
// All-recipient follow-up: two hits, two crits, two status rolls.
b=start(hero("test-all-followups"),[enemy("a"),enemy("b")]);
b.rng.draws=MAX-5;checkNoPartial(b);
b=start(hero("test-all-followups"),[enemy("a"),enemy("b")]);
b.rng.draws=MAX-6;
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.rng.draws,MAX);
// Primary-only follow-up: two hits, two crits, ONE status roll.
b=start(hero("test-primary-bonus"),[enemy("a"),enemy("b")]);
b.rng.draws=MAX-4;checkNoPartial(b);
b=start(hero("test-primary-bonus"),[enemy("a"),enemy("b")]);
b.rng.draws=MAX-5;
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.rng.draws,MAX);
assert.equal(b.fighters[1].weakenAttacks,2);
assert.equal(b.fighters[2].weakenAttacks,0);
// No status-bearing ability must not reserve status draw.
b=start(hero("test-physical-strike"),[enemy("a")]);
b.rng.draws=MAX-2;
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.rng.draws,MAX);
assert.equal(b.events.filter(e=>e.type==="damage").length,1);
// With zero effect gates enabled, legacy seeded battle does not reserve RNG.
b=start(hero(),[enemy("a")],{rngSeed:0});
b.rng.draws=MAX;
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.rng.draws,MAX);
// Seeded status-only direct weaken uses exactly one draw at the boundary.
b=start(hero(),[enemy("a")],{rngSeed:0,statusChecks:true});
b.rng.draws=MAX;
checkNoPartial(b);
b=start(hero(),[enemy("a")],{rngSeed:0,statusChecks:true});
b.rng.draws=MAX-1;
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.rng.draws,MAX);
// In ordinary opt-in test, all 14 stats have a coherent event pipeline:
// speed -> hit -> critical -> damage (penetration/DEF, guard, Protection)
// -> debuff resistance -> remaining HP.
function replay(){
 const battle=start(hero(),[enemy("resistant",{debuffResistance:100})]);
 assert.equal(core.performPlayerAbility(battle,"special"),true);
 return own({events:battle.events,rng:battle.rng,
  targets:battle.fighters.map(f=>({
   hp:f.hp,protection:f.protection,weaken:f.weakenAttacks
  }))});
}
assert.deepEqual(replay(),replay());
const pipeline=replay();
assert.equal(pipeline.rng.draws,3);
assert.equal(pipeline.events.some(e=>e.type==="critical"),true);
assert.equal(pipeline.events.some(e=>e.type==="status-resisted"),true);
assert.equal(pipeline.events.some(e=>e.type==="damage"),true);
assert.equal(pipeline.targets[1].weaken,0);
assert.equal(pipeline.targets[1].protection,0);
console.log("Stats-003: combined RNG budget, 14-stat attack pipeline, group followups and legacy isolation passed");
