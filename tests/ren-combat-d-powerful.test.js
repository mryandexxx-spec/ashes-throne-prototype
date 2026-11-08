"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const sources=["initiative-model.js","combat-status-core.js","ability-data.js","battle-rng.js","combat-core.js","story-trial-data.js","ability-info.js","combat-log.js"];
const source=sources.map(read).join("\n");
const api=vm.runInNewContext(source+"\n({CombatCore,CombatStatusCore,StoryTrialData,AbilityData,AbilityInfo,CombatLog})");
const {CombatCore:core,CombatStatusCore:status,AbilityData:ability,StoryTrialData:story,AbilityInfo:info,CombatLog:log}=api;
const ren=(props={})=>({...story.heroes()[0],...props});
const foe=(id,hp=400,props={})=>({id,name:id,role:"Учебный противник",hp,atk:0,speed:1,side:"enemy",...props});
const setup=(enemies,opts={},r=ren())=>{
 const b=core.createBattle([r,...enemies],[],opts);core.advanceToPlayerTurn(b);
 assert.equal(b.fighters[b.currentActor].id,"trial-ren");return b;
};
const fire=b=>core.performPlayerAbility(b,"powerful");
const effect=(b,i)=>status.read(b.fighters[i],"debuff-resistance-down");
const powerful=ability.get(ren(),"powerful");
assert.equal(powerful.name,"Сорвать построение · проба");
assert.equal(powerful.multiplier,1.6);
assert.equal(powerful.cooldown,2);
assert.equal(powerful.target,"enemy");
assert.equal(powerful.followUpStatusAll.type,"debuff-resistance-down");
assert.match(info.format(ren(),"powerful").description,/сопротивление всех/);
assert.match(info.format(ren(),"powerful").description,/Тестовый баланс/);
assert.equal(ability.get(story.heroes()[1],"powerful").followUpStatusAll,undefined);

let b=setup([foe("a"),foe("b"),foe("c")]);
const baseHP=b.fighters.slice(1).map(x=>x.hp);
assert.equal(fire(b),true);
assert.equal(b.allyActions,1,"one command, not one command per affected enemy");
assert.equal(b.fighters[0].powerfulCooldown,2);
assert.ok(b.fighters[1].hp<baseHP[0],"only selected target damaged");
assert.equal(b.fighters[2].hp,baseHP[1],"others receive no damage");
assert.equal(b.fighters[3].hp,baseHP[2],"others receive no damage");
for(let i=1;i<=3;i++){
 assert.equal(effect(b,i)?.remaining,2);
 assert.equal(effect(b,i)?.amount,15);
}
assert.equal(b.events.filter(x=>x.type==="effect"&&x.effect==="debuff-resistance-down").length,3);
assert.match(log.lines(b.events,b.fighters).join("\n"),/Пониженное сопротивление/);

// Fatal primary still triggers other living opponents, but not a dead target.
b=setup([foe("fragile",10),foe("survivor",500)]);
assert.equal(fire(b),true);
assert.equal(b.fighters[1].hp,0);
assert.equal(effect(b,1),null);
assert.equal(effect(b,2)?.remaining,2);
assert.equal(b.winner,null,"battle continues for surviving enemy");

// Recast refreshes rather than stacks. A weakened primary boosts Ren's
// direct damage before the new status applies to any enemy.
b=setup([foe("renew",900),foe("renew2",900)]);
status.apply(b.fighters[1],"debuff-resistance-down",10,1);
b.fighters[1].weakenAttacks=2;
assert.equal(fire(b),true);
assert.equal(effect(b,1)?.amount,15);
assert.equal(effect(b,1)?.remaining,2);
assert.equal(effect(b,2)?.remaining,2);
assert.equal(b.fighters[1].hp,900-52,"1.6×27, +20% additive passive, rounded once");
assert.equal(core.activeEffects(b.fighters[2]).some(e=>e.type==="debuff-resistance-down"),true);

// Deterministic independent rolls: one per living opponent in roster order.
// RNG is only active if the caller explicitly enables status checks.
b=setup([foe("a",400,{debuffResistance:100}),foe("b",400,{debuffResistance:0})],
 {rngSeed:0,statusChecks:true},ren({debuffPotency:0}));
assert.equal(fire(b),true);
assert.equal(b.rng.draws,2);
assert.equal(effect(b,1),null);
assert.equal(effect(b,2)?.remaining,2);
assert.equal(b.events.filter(e=>e.type==="status-resisted").length,1);
assert.match(log.lines(b.events,b.fighters).join("\n"),/сопротивление эффекту «Пониженное сопротивление»/);

// A dead primary does not consume its status roll.
b=setup([foe("fragile",1,{debuffResistance:90}),
 foe("other",400,{debuffResistance:0})],{rngSeed:0,statusChecks:true},
 ren({debuffPotency:0}));
assert.equal(fire(b),true);
assert.equal(b.rng.draws,1);
assert.equal(effect(b,1),null);
assert.equal(effect(b,2)?.remaining,2);

// Missing/inadmissible enemy resistance rejects before command/RNG/cooldown.
for(const invalid of [undefined,null,-2,101,NaN,Infinity,"20"]){
 b=setup([foe("good",400,{debuffResistance:0}),
  foe("bad",400,{debuffResistance:invalid})],
  {rngSeed:0,statusChecks:true},ren({debuffPotency:0}));
 const snap=JSON.stringify({events:b.events,rng:b.rng,turn:b.turn,actions:b.allyActions,
  hp:b.fighters.map(f=>f.hp),cooldown:b.fighters[0].powerfulCooldown,
  meter:b.fighters.map(f=>f.meter)});
 assert.equal(fire(b),false,"invalid recipient must reject");
 assert.equal(JSON.stringify({events:b.events,rng:b.rng,turn:b.turn,actions:b.allyActions,
  hp:b.fighters.map(f=>f.hp),cooldown:b.fighters[0].powerfulCooldown,
  meter:b.fighters.map(f=>f.meter)}),snap);
}
b=setup([foe("rng",400,{debuffResistance:0})],{rngSeed:0,statusChecks:true},ren({debuffPotency:0}));
b.rng.draws=Number.MAX_SAFE_INTEGER;
assert.equal(fire(b),false,"RNG exhaustion rejects before damage");
assert.equal(b.allyActions,0);
assert.equal(b.fighters[1].hp,400);

// Hit-check miss path can be exercised with explicit typed technical adapter.
// Production trial uses legacy attacks and never pretends physicalAttack exists.
const typedSource=source.replace("const AbilityData=(()=>","let AbilityData=(()=>");
const typedPatch='const base=AbilityData;AbilityData={...base,get:(actor,id)=>{const a=base.get(actor,id);return actor?.id==="trial-ren"&&id==="powerful"?{...a,damageType:"physical"}:a;}};({CombatCore,CombatStatusCore})';
const typed=vm.runInNewContext(typedSource+"\n"+typedPatch);
b=typed.CombatCore.createBattle([ren({physicalAttack:27,accuracy:0,debuffPotency:0}),
 foe("dodges",400,{physicalDefense:0,evasion:100,debuffResistance:0}),
 foe("other",400,{physicalDefense:0,evasion:0,debuffResistance:0})],[],
 {rngSeed:0,hitChecks:true,statusChecks:true});
typed.CombatCore.advanceToPlayerTurn(b);
assert.equal(typed.CombatCore.performPlayerAbility(b,"powerful"),true);
assert.equal(b.rng.draws,1,"miss uses hit draw only, no mass status rolls");
assert.equal(b.fighters[1].hp,400);
assert.equal(typed.CombatStatusCore.read(b.fighters[2],"debuff-resistance-down"),null);
assert.ok(b.events.some(e=>e.type==="miss"));

// No persistent recruitment/save schema.
assert.ok(!read("progress-v3-core.js").includes("trial-ren"));
assert.ok(!read("hero-collection-core.js").includes("trial-ren"));
assert.ok(!read("index.html").includes('src="design/ren-gear-plan.js"'));
console.log("REN-COMBAT-D: single-primary damage, surviving enemies status, seeded checks, miss/fatal, RNG budget and saves");
