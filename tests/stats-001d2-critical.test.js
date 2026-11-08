"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const src=["initiative-model.js","ability-data.js","battle-rng.js",
 "combat-core.js","combat-log.js"].map(read).join("\n")
 .replace("const AbilityData=(()=>","let AbilityData=(()=>");
const patch=[
 "const original=AbilityData;",
 "AbilityData=Object.freeze({...original,get:(fighter,id)=>{",
 " const a=original.get(fighter,id);",
 " if(fighter?.id==='test-area-weaken'&&id==='special')return {...a,damageType:'physical'};",
 " return a;",
 "}});",
 "({CombatCore,BattleRng,CombatLog})"
].join("\n");
const {CombatCore:core,BattleRng:rng,CombatLog:log}=vm.runInNewContext(src+"\n"+patch);
const hero=(id="test-physical-strike",stats={})=>({
 id,name:id,side:"ally",hp:150,atk:40,physicalAttack:40,
 speed:400,critChance:100,critDamage:150,...stats});
const foe=(id="foe",stats={})=>({id,name:id,side:"enemy",hp:150,atk:1,
 speed:1,...stats});
const setup=(h,targets,options={rngSeed:0,critChecks:true})=>{
 const b=core.createBattle([h,...targets],[],options);
 core.advanceToPlayerTurn(b);
 assert.equal(b.fighters[b.currentActor].side,"ally");
 return b;
};
const own=x=>JSON.parse(JSON.stringify(x));
const cast=b=>core.performPlayerAbility(b,"special");
let b=setup(hero(),[foe()]);
assert.equal(cast(b),true);
assert.equal(b.fighters[1].hp,90,"40 physical with crit 150% = 60 damage");
assert.equal(b.rng.draws,1,"crit-only battle uses one draw");
assert.equal(b.events.filter(e=>e.type==="critical").length,1);
assert.equal(b.events.find(e=>e.type==="critical").multiplierPercent,150);
assert.equal(b.events.find(e=>e.type==="damage").hpDamage,60);
assert.match(log.lines(b.events,b.fighters).join("\n"),/критический удар по foe/);
// Crit precedes weakening, matching defense, guard and Protection.
b=setup(hero(),[foe("shield",{physicalDefense:50,protection:10,maxProtection:10})]);
b.fighters[0].weakenAttacks=1;
b.fighters[1].guardHits=2;
assert.equal(cast(b),true);
assert.equal(b.events.find(e=>e.type==="damage").amount,14,
 "40×1.5=60, weakened to 42, DEF50 to 28, guard to 14");
assert.equal(b.fighters[1].protection,0);
assert.equal(b.fighters[1].hp,146);
assert.equal(b.fighters[1].guardHits,1);
assert.equal(b.fighters[0].weakenAttacks,0);
assert.equal(b.rng.draws,1);
// Chance zero never crits but consumes a draw, and stays distinct from a miss.
b=setup(hero("test-physical-strike",{critChance:0,critDamage:150}),[foe()]);
assert.equal(cast(b),true);
assert.equal(b.fighters[1].hp,110);
assert.equal(b.events.filter(e=>e.type==="critical").length,0);
assert.equal(b.rng.draws,1);
// Critical damage of 100% has no amplification, despite a guaranteed crit.
b=setup(hero("test-physical-strike",{critChance:100,critDamage:100}),[foe()]);
assert.equal(cast(b),true);
assert.equal(b.fighters[1].hp,110);
assert.equal(b.events.filter(e=>e.type==="critical").length,1);
// Hit checks and crit checks use independent draws: miss never rolls crit.
b=setup(hero(),[foe("dodger",{evasion:100,physicalDefense:0,
 protection:20,maxProtection:20})],{rngSeed:0,hitChecks:true,critChecks:true});
b.fighters[1].guardHits=2;
assert.equal(cast(b),true);
assert.equal(b.rng.draws,1,"one failed hit roll, no crit roll");
assert.equal(b.fighters[1].hp,150);
assert.equal(b.fighters[1].protection,20);
assert.equal(b.fighters[1].guardHits,2);
assert.equal(b.events.filter(e=>e.type==="miss").length,1);
assert.equal(b.events.filter(e=>e.type==="critical").length,0);
// Same path with guaranteed hit: one hit + one crit draw.
b=setup(hero(),[foe("sure",{evasion:0})],{rngSeed:0,hitChecks:true,critChecks:true});
assert.equal(cast(b),true);
assert.equal(b.rng.draws,2);
assert.equal(b.fighters[1].hp,90);
assert.deepEqual(Array.from(b.events,x=>x.type).filter(x=>["miss","critical","damage"].includes(x)),
 ["critical","damage"]);
// Group attack: hit/miss per target and crit per successfully hit target.
b=setup(hero("test-area-weaken",{physicalAttack:20,atk:20,critChance:100,critDamage:200}),[
 foe("dodger",{evasion:100}),foe("receiver",{evasion:0})
],{rngSeed:0,hitChecks:true,critChecks:true});
assert.equal(cast(b),true);
assert.equal(b.rng.draws,3,"miss consumes one draw, hit+crit consume two");
assert.equal(b.fighters[1].hp,150);
assert.equal(b.fighters[1].weakenAttacks,0);
assert.equal(b.fighters[2].hp,110);
assert.equal(b.fighters[2].weakenAttacks,2);
assert.equal(b.events.filter(e=>e.type==="miss").length,1);
assert.equal(b.events.filter(e=>e.type==="critical").length,1);
assert.equal(b.events.filter(e=>e.type==="damage").length,1);
assert.equal(b.events.find(e=>e.type==="critical").targetId,"receiver");
// Invalid crit fields must atomically reject without changing action/events/RNG.
for(const bad of [NaN,Infinity,-1,101,"30",null]){
 b=setup(hero("test-physical-strike",{critChance:bad}),[foe()]);
 const before=own({rng:b.rng,events:b.events,hp:b.fighters.map(x=>x.hp),
  turn:b.turn,actions:b.allyActions,actorCooldown:b.fighters[0].specialCooldown});
 assert.equal(cast(b),false);
 assert.deepEqual(own({rng:b.rng,events:b.events,hp:b.fighters.map(x=>x.hp),
  turn:b.turn,actions:b.allyActions,actorCooldown:b.fighters[0].specialCooldown}),before);
}
for(const bad of [NaN,Infinity,99,1001,"150",null]){
 b=setup(hero("test-physical-strike",{critDamage:bad}),[foe()]);
 assert.equal(cast(b),false);
 assert.equal(b.rng.draws,0);
 assert.equal(b.allyActions,0);
}
b=setup(hero("test-physical-strike",{critChance:undefined}),[foe()]);
assert.equal(cast(b),false,"missing crit fields do not silently count as zero");
assert.equal(b.rng.draws,0);
// Seed only: no crits, even if actor has non-zero crit stats.
b=setup(hero(),[foe()],{rngSeed:0});
assert.equal(cast(b),true);
assert.equal(b.rng.draws,0);
assert.equal(b.fighters[1].hp,110);
assert.equal(b.events.filter(e=>e.type==="critical").length,0);
// Legacy damage is never critical, even with both flags set.
b=setup(hero("legacy"),[foe()],{rngSeed:0,hitChecks:true,critChecks:true});
assert.equal(core.performPlayerAbility(b,"basic"),true);
assert.equal(b.rng.draws,0);
assert.equal(b.fighters[1].hp,110);
// Invalid options are rejected before battle is created.
assert.throws(()=>core.createBattle([hero(),foe()],[],{critChecks:true}),/requires rngSeed/);
assert.throws(()=>core.createBattle([hero(),foe()],[],{rngSeed:1,critChecks:1}),/boolean/);
// Autobattle basic uses typed only for explicitly marked test actor.
function auto(seed){
 const b=setup(hero("kael",{combatProfile:"stats002c",critChance:55,critDamage:150}),
  [foe("target")],{rngSeed:seed,hitChecks:true,critChecks:true});
 assert.equal(core.performAutoAction(b,{abilityId:"basic",targetIndex:1}),true);
 return own({events:b.events,rng:b.rng,hp:b.fighters.map(x=>x.hp)});
}
assert.deepEqual(auto(42),auto(42));
assert.equal(auto(42).rng.draws,2);
console.log("Stats-001D2: isolated crit ordering, seeded hit/crit, shields, group targets, legacy and auto regression passed");
