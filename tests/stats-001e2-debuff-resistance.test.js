"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=x=>fs.readFileSync(path.join(__dirname,"..",x),"utf8");
const source=["initiative-model.js","ability-data.js","battle-rng.js",
 "combat-core.js","combat-log.js"].map(read).join("\n")
 .replace("const AbilityData=(()=>","let AbilityData=(()=>");
const patch=[
 "const original=AbilityData;",
 "AbilityData=Object.freeze({...original,get:(fighter,id)=>{",
 " const a=original.get(fighter,id);",
 " if(fighter?.id?.startsWith('test-') && ",
 "  ['test-area-weaken','test-all-followups','test-primary-bonus','test-composed-effects'].includes(fighter.id)",
 "  &&id==='special')return {...a,damageType:'physical'};",
 " return a;",
 "}});",
 "({CombatCore,BattleRng,CombatLog})"
].join("\n");
const {CombatCore:core,BattleRng:rng,CombatLog:log}=vm.runInNewContext(source+"\n"+patch);
const hero=(id="lyra",s={})=>({
 id,name:id,side:"ally",hp:150,atk:40,physicalAttack:40,speed:400,
 combatProfile:"stats002c",debuffPotency:0,...s});
const foe=(id="foe",s={})=>({
 id,name:id,side:"enemy",hp:180,atk:0,speed:1,
 debuffResistance:0,...s});
const own=x=>JSON.parse(JSON.stringify(x));
const setup=(h,targets,opts={rngSeed:0,statusChecks:true})=>{
 const b=core.createBattle([h,...targets],[],opts);
 core.advanceToPlayerTurn(b);
 assert.equal(b.fighters[b.currentActor].side,"ally");
 return b;
};
const cast=b=>core.performPlayerAbility(b,"special");
// Typed Lyra's direct weaken: resistance does not undo damage or spent cooldown.
let b=setup(hero(),[foe("resists",{debuffResistance:100})]);
assert.equal(cast(b),true);
assert.equal(b.fighters[1].hp,140,"damage is independent of resist");
assert.equal(b.fighters[1].weakenAttacks,0);
assert.equal(b.fighters[0].specialCooldown,2);
assert.equal(b.rng.draws,1,"one status roll for a surviving target");
assert.equal(b.events.filter(x=>x.type==="status-resisted").length,1);
assert.equal(b.events.filter(x=>x.type==="effect"&&x.effect==="weaken").length,0);
assert.deepEqual(Array.from(b.events.filter(x=>["damage","status-resisted"].includes(x.type)),
 x=>x.type),["damage","status-resisted"]);
assert.match(log.lines(b.events,b.fighters).join("\n"),/сопротивление эффекту/);
// Zero resistance is guaranteed status, but still consumes one draw.
b=setup(hero(),[foe()]);
assert.equal(cast(b),true);
assert.equal(b.fighters[1].weakenAttacks,2);
assert.equal(b.rng.draws,1);
assert.equal(b.events.filter(x=>x.type==="effect"&&x.effect==="weaken").length,1);
// Existing stronger status not removed or reduced by a resisted attempt.
b=setup(hero(),[foe("resists",{debuffResistance:100})]);
b.fighters[1].weakenAttacks=4;
assert.equal(cast(b),true);
assert.equal(b.fighters[1].weakenAttacks,4);
// An accepted follow-up retains max(existing, incoming) behavior.
b=setup(hero("test-all-followups"),[foe("target")]);
b.fighters[1].weakenAttacks=3;
assert.equal(cast(b),true);
assert.equal(b.fighters[1].weakenAttacks,3);
assert.equal(b.rng.draws,1);
// Follow-up all: independent target resistance and fixed order.
b=setup(hero("test-all-followups"),[
 foe("resists",{debuffResistance:100}),foe("accepts",{debuffResistance:0})]);
assert.equal(cast(b),true);
assert.equal(b.rng.draws,2);
assert.equal(b.fighters[1].weakenAttacks,0);
assert.equal(b.fighters[2].weakenAttacks,1);
assert.equal(b.events.filter(x=>x.type==="status-resisted").length,1);
assert.equal(b.events.filter(x=>x.type==="damage").length,2);
// Direct group negative status: independent rolls, no change to group hit rules.
b=setup(hero("test-area-weaken"),[
 foe("resists",{debuffResistance:100}),foe("accepts",{debuffResistance:0})]);
assert.equal(cast(b),true);
assert.equal(b.rng.draws,2);
assert.equal(b.fighters[1].weakenAttacks,0);
assert.equal(b.fighters[2].weakenAttacks,2);
// Primary follow-up status should affect only selected primary, not next target.
b=setup(hero("test-primary-bonus"),[
 foe("resists",{debuffResistance:100}),foe("accepts",{debuffResistance:0})]);
assert.equal(cast(b),true);
assert.equal(b.rng.draws,1);
assert.equal(b.fighters[1].weakenAttacks,0);
assert.equal(b.fighters[2].weakenAttacks,0);
// Mixed self guard + resisted primary negative: self guard must still apply.
b=setup(hero("test-composed-effects"),[foe("resists",{debuffResistance:100})]);
assert.equal(cast(b),true);
assert.equal(b.fighters[0].guardHits,1);
assert.equal(b.fighters[1].weakenAttacks,0);
assert.equal(b.rng.draws,1);
// Miss -> no status roll, no negative effect and no status-resisted event.
b=setup(hero(),[foe("dodger",{evasion:100,debuffResistance:100})],
 {rngSeed:0,statusChecks:true,hitChecks:true});
assert.equal(cast(b),true);
assert.equal(b.rng.draws,1);
assert.equal(b.fighters[1].hp,180);
assert.equal(b.fighters[1].weakenAttacks,0);
assert.equal(b.events.some(x=>x.type==="status-resisted"),false);
// Hit -> resisted: one hit and one status roll, no critical roll when disabled.
b=setup(hero(),[foe("resists",{evasion:0,debuffResistance:100})],
 {rngSeed:0,statusChecks:true,hitChecks:true});
assert.equal(cast(b),true);
assert.equal(b.rng.draws,2);
assert.equal(b.events.some(x=>x.type==="status-resisted"),true);
// Dead targets skip status rolls.
b=setup(hero(),[foe("dead",{hp:10,debuffResistance:100})]);
assert.equal(cast(b),true);
assert.equal(b.rng.draws,0);
assert.equal(b.events.some(x=>x.type==="death"),true);
// Opt-in disabled: no status rolls even for explicitly provided stats.
b=setup(hero(),[foe("resists",{debuffResistance:100})],{rngSeed:0});
assert.equal(cast(b),true);
assert.equal(b.rng.draws,0);
assert.equal(b.fighters[1].weakenAttacks,2);
// Legacy weaken remains guaranteed even when statusChecks is true.
b=setup(hero("lyra",{combatProfile:undefined,debuffPotency:undefined}),
 [foe("resists",{debuffResistance:100})],{rngSeed:0,statusChecks:true});
assert.equal(cast(b),true);
assert.equal(b.rng.draws,0);
assert.equal(b.fighters[1].weakenAttacks,2,"legacy damaging weaken is unchanged");
// Positive guard/heal unaffected: no roll and no potency required.
b=setup(hero("kael",{debuffPotency:undefined}),[
 foe("foe",{debuffResistance:undefined})],{rngSeed:0,statusChecks:true});
core.chooseAlly(b,0);
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.rng.draws,0);
// Invalid numeric fields must reject before RNG, event log, turn and cooldown.
// Use second target invalid to verify group atomicity.
for(const bad of [undefined,null,-1,101,NaN,Infinity,"50"]){
 b=setup(hero("test-area-weaken"),[
  foe("good"),foe("invalid",{debuffResistance:bad})]);
 const before=own({rng:b.rng,events:b.events,turn:b.turn,
  actions:b.allyActions,hp:b.fighters.map(x=>x.hp),cooldown:b.fighters[0].specialCooldown});
 assert.equal(cast(b),false);
 assert.deepEqual(own({rng:b.rng,events:b.events,turn:b.turn,
  actions:b.allyActions,hp:b.fighters.map(x=>x.hp),cooldown:b.fighters[0].specialCooldown}),before);
}
for(const bad of [undefined,null,-1,101,NaN,Infinity,"50"]){
 b=setup(hero("lyra",{debuffPotency:bad}),[foe()]);
 assert.equal(cast(b),false);
 assert.equal(b.rng.draws,0);
 assert.equal(b.allyActions,0);
}
assert.throws(()=>core.createBattle([hero(),foe()],[],{statusChecks:true}),/requires rngSeed/);
assert.throws(()=>core.createBattle([hero(),foe()],[],{rngSeed:0,statusChecks:"yes"}),/boolean/);
// Determinism across independent initialized battles.
function replay(){
 const s=setup(hero("test-area-weaken"),[
  foe("a",{debuffResistance:45}),foe("b",{debuffResistance:60})
 ],{rngSeed:200,statusChecks:true,hitChecks:true,critChecks:true});
 // Crit tests require explicit attacker crit fields.
 s.fighters[0].critChance=20;s.fighters[0].critDamage=150;
 assert.equal(cast(s),true);
 return own({events:s.events,rng:s.rng,hp:s.fighters.map(x=>x.hp),
  status:s.fighters.map(x=>x.weakenAttacks)});
}
assert.deepEqual(replay(),replay());
console.log("Stats-001E2: typed negative status resistance, group followups, misses, invalid atomicity and legacy isolation passed");
