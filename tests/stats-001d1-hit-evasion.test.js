"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=x=>fs.readFileSync(path.join(__dirname,"..",x),"utf8");
// Test-only typed variants of existing multi-target fixtures; production data
// and all actual campaign heroes are deliberately unchanged.
const source=["initiative-model.js","ability-data.js","battle-rng.js",
 "combat-core.js","combat-log.js"].map(read).join("\n")
 .replace("const AbilityData=(()=>","let AbilityData=(()=>");
const patch=[
 "const original=AbilityData;",
 "AbilityData=Object.freeze({...original,get:(fighter,id)=>{",
 " const a=original.get(fighter,id);",
 " if(fighter?.id?.startsWith('test-') && ['test-area-weaken','test-all-followups','test-primary-bonus'].includes(fighter.id) && id==='special')",
 "   return {...a,damageType:'physical'};",
 " return a;",
 "}});",
 "({CombatCore,BattleRng,CombatLog})"
].join("\n");
const {CombatCore:core,BattleRng:rng,CombatLog:log}=vm.runInNewContext(source+"\n"+patch);
const hero=(id="test-physical-strike",props={})=>({
 id,name:id,side:"ally",hp:150,atk:30,physicalAttack:30,speed:400,...props});
const foe=(id,props={})=>({
 id,name:id,side:"enemy",hp:120,atk:0,speed:1,...props});
const setup=(actor,targets,options={rngSeed:0,hitChecks:true})=>{
 const battle=core.createBattle([actor,...targets],[],options);
 core.advanceToPlayerTurn(battle);
 assert.equal(battle.fighters[battle.currentActor]?.side,"ally");
 return battle;
};
const own=x=>JSON.parse(JSON.stringify(x));
let battle=setup(hero(),[foe("high-evasion",{
 evasion:100,physicalDefense:0,protection:30,maxProtection:30})]);
battle.fighters[0].weakenAttacks=1;
battle.fighters[1].guardHits=2;
assert.equal(core.performPlayerAbility(battle,"special"),true);
assert.equal(battle.rng.draws,1,"exactly one hit roll");
assert.equal(battle.fighters[1].hp,120);
assert.equal(battle.fighters[1].protection,30);
assert.equal(battle.fighters[1].guardHits,2);
assert.equal(battle.fighters[1].weakenAttacks,0,"missed debuff must not land");
assert.equal(battle.fighters[0].weakenAttacks,0,"attack command still consumes one weakening");
assert.equal(battle.fighters[0].specialCooldown,2,"miss still spends cooldown");
assert.equal(battle.allyActions,1);
assert.equal(battle.events.filter(e=>e.type==="miss"&&e.targetId==="high-evasion").length,1);
assert.equal(battle.events.filter(e=>e.type==="damage"&&e.actorId==="test-physical-strike").length,0);
assert.match(log.lines(battle.events,battle.fighters).join("\n"),/промах по high-evasion/);
// Guaranteed hit in the same explicitly opted-in test model still draws once.
battle=setup(hero(),[foe("normal",{evasion:0,physicalDefense:0,
 protection:40,maxProtection:40})],{rngSeed:0,hitChecks:true});
assert.equal(core.performPlayerAbility(battle,"special"),true);
assert.equal(battle.rng.draws,1);
assert.equal(battle.fighters[1].hp,120);
assert.equal(battle.fighters[1].protection,10,"Protection absorbs hit");
assert.equal(battle.fighters[1].weakenAttacks,0);
// The existing ability is a typed damage strike and does not debuff.
assert.equal(battle.events.filter(e=>e.type==="damage").length,1);

// Multi-target partial hit: original recipient order, no damage/guard loss on
// missed enemy, one weakening use per attack command and one roll per target.
battle=setup(hero("test-area-weaken"),[
 foe("first",{evasion:100,protection:20,maxProtection:20}),
 foe("second",{evasion:0,protection:20,maxProtection:20})]);
battle.fighters[1].guardHits=2;
battle.fighters[0].weakenAttacks=1;
assert.equal(core.performPlayerAbility(battle,"special"),true);
assert.equal(battle.rng.draws,2);
assert.equal(battle.fighters[1].guardHits,2);
assert.equal(battle.fighters[1].protection,20);
assert.equal(battle.fighters[1].weakenAttacks,0);
assert.equal(battle.fighters[2].protection,0);
assert.equal(battle.fighters[2].hp,119,"weakened damage 21 absorbs 20 and deals 1 HP");
assert.equal(battle.fighters[2].weakenAttacks,2);
assert.equal(battle.fighters[0].weakenAttacks,0);
assert.equal(battle.events.filter(e=>e.type==="miss").length,1);
assert.equal(battle.events.filter(e=>e.type==="damage"&&e.actorId==="test-area-weaken").length,1);
assert.equal(battle.events.find(e=>e.type==="miss").targetId,"first");

// Follow-up scope all applies to hit recipients only.
battle=setup(hero("test-all-followups"),[
 foe("first",{evasion:100}),foe("second",{evasion:0})]);
assert.equal(core.performPlayerAbility(battle,"special"),true);
assert.equal(battle.fighters[1].weakenAttacks,0);
assert.equal(battle.fighters[2].weakenAttacks,1);
// Primary follow-up must NOT land if the selected primary was missed.
battle=setup(hero("test-primary-bonus"),[
 foe("first",{evasion:100}),foe("second",{evasion:0})]);
assert.equal(core.performPlayerAbility(battle,"special"),true);
assert.equal(battle.fighters[1].weakenAttacks,0);
assert.equal(battle.fighters[2].weakenAttacks,0);

// All values on all targets validated atomically before action & RNG draw.
for(const invalid of [NaN,Infinity,-1,101,"30",null]){
 battle=setup(hero("test-area-weaken"),[
  foe("first",{evasion:0}),foe("second",{evasion:invalid})]);
 const before=own({rng:battle.rng,turn:battle.turn,
  hp:battle.fighters.map(f=>f.hp),events:battle.events,actions:battle.allyActions});
 assert.equal(core.performPlayerAbility(battle,"special"),false);
 assert.deepEqual(own({rng:battle.rng,turn:battle.turn,
  hp:battle.fighters.map(f=>f.hp),events:battle.events,actions:battle.allyActions}),before);
}
battle=setup(hero("test-physical-strike",{accuracy:101}),[foe("a")]);
assert.equal(core.performPlayerAbility(battle,"special"),false);
assert.equal(battle.rng.draws,0);
assert.equal(battle.allyActions,0);
assert.throws(()=>core.createBattle([hero(),foe("a")],[],{hitChecks:true}),/requires rngSeed/);
assert.throws(()=>core.createBattle([hero(),foe("a")],[],{rngSeed:1,hitChecks:"yes"}),/boolean/);

// Seed only: rolls never occur without explicit hitChecks.
battle=setup(hero(),[foe("a",{evasion:100})],{rngSeed:0});
assert.equal(core.performPlayerAbility(battle,"special"),true);
assert.equal(battle.rng.draws,0);
assert.equal(battle.fighters[1].hp,90,"typed damage still guaranteed without hitChecks");
// Legacy attack is never checked, even when hitChecks=true.
battle=setup(hero("generic-legacy"),[foe("a",{evasion:100})]);
assert.equal(core.performPlayerAbility(battle,"basic"),true);
assert.equal(battle.rng.draws,0);
assert.equal(battle.fighters[1].hp,90);

// Fixed seed, action plan and target order are repeatable; autoplay uses
// the same shared combat executor and consumes one roll for a legal basic.
function autoCase(seed){
 const b=setup(hero("test-physical-strike",{combatProfile:"stats002c"}),[foe("a",{evasion:60})],{rngSeed:seed,hitChecks:true});
 assert.equal(core.performAutoAction(b,{abilityId:"basic",targetIndex:1}),true);
 return own({events:b.events,rng:b.rng,hp:b.fighters.map(x=>x.hp)});
}
assert.deepEqual(autoCase(345),autoCase(345));
assert.equal(autoCase(345).rng.draws,1);
console.log("Stats-001D1: isolated hit checks, miss/guard/shield/debuff, group per-target rolls, validation and deterministic auto passed");
