"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const source=["initiative-model.js","combat-status-core.js","ability-data.js",
 "battle-rng.js","combat-core.js","story-trial-data.js","ability-info.js"].map(read).join("\n");
const {CombatCore:core,CombatStatusCore:status,StoryTrialData:trial,AbilityData:abilities,
 AbilityInfo:info}=vm.runInNewContext(source+"\n({CombatCore,CombatStatusCore,StoryTrialData,AbilityData,AbilityInfo})");
const ren=()=>({...trial.heroes()[0]});
const foe=(id,extra={})=>({
 id,name:id,side:"enemy",role:"Учебный противник",hp:1000,atk:0,speed:1,...extra
});
const ally=(id,tags=[],extra={})=>({
 id,name:id,side:"ally",hp:100,atk:20,speed:300,tags,...extra
});
const start=(roster,opts={})=>{
 const b=core.createBattle(roster,[],opts);
 core.advanceToPlayerTurn(b);
 return b;
};
const hit=b=>core.performPlayerAbility(b,"basic");
const damage=(b,targetIndex)=>1000-b.fighters[targetIndex].hp;
const rules=abilities.get(ren(),"passive");
assert.equal(rules.name,"Чувство тропы · проба");
assert.equal(rules.combatRules.bonusVsDebuffedPercent,15);
assert.equal(rules.combatRules.statusPotencyWithoutResistanceDown,10);
assert.equal(rules.combatRules.tagId,"gardens-over-abyss");
assert.equal(rules.combatRules.tagDamagePercent,5);
assert.match(info.format(ren(),"passive").description,/Числа тестовые/);
assert.equal(abilities.get(trial.heroes()[1],"passive").combatRules,undefined);
assert.equal(abilities.get(trial.heroes()[2],"passive").combatRules,undefined);

// The first base hit creates slow AFTER damage; it cannot retroactively
// receive the +15% bonus. Ren always has +5% from his own origin.
let b=start([ren(),foe("foe-a")]);
assert.equal(b.fighters[b.currentActor].id,"trial-ren");
assert.equal(hit(b),true);
assert.equal(damage(b,1),28,"27 attack +5%, no pre-existing debuff");
assert.ok(status.read(b.fighters[1],"slowed"));
assert.equal(hit(b),true);
assert.equal(damage(b,1),28+32,"second hit has additive 15%+5%");
assert.equal(b.fighters[0].atk,27,"passive does not mutate source attack");
// Two debuffs still grant exactly one weakness bonus.
b=start([ren(),foe("foe-b")]);
b.fighters[1].weakenAttacks=2;
status.apply(b.fighters[1],"slowed",20,2);
assert.equal(hit(b),true);
assert.equal(damage(b,1),32,"no per-debuff stacking");

// A different Garden-tagged ally gets +5% without inheriting Ren-only +15%.
b=start([ren(),ally("tagged",["gardens-over-abyss"]),foe("foe-c")]);
assert.equal(b.fighters[b.currentActor].id,"tagged");
b.fighters[2].weakenAttacks=1;
assert.equal(hit(b),true);
assert.equal(damage(b,2),21,"ally tagged damage bonus only");
// Untagged ally has no bonus.
b=start([ren(),ally("untagged"),foe("foe-d")]);
assert.equal(hit(b),true);
assert.equal(damage(b,2),20);
// Once the source is dead, the tagged ally no longer receives the bonus.
b=start([ren(),ally("tagged",["gardens-over-abyss"]),foe("foe-e")]);
b.fighters[0].hp=0;
assert.equal(hit(b),true);
assert.equal(damage(b,2),20,"dead passive owner contributes nothing");
// No implicit garden tag for Nada/Liora.
assert.equal(trial.heroes()[1].tags,undefined);
assert.equal(trial.heroes()[2].tags,undefined);

// Group attacks share the same tag damage rule; no per-target side effects.
b=start([ren(),ally("test-area-damage",["gardens-over-abyss"],
 {speed:400}),foe("group-a"),foe("group-b")]);
assert.equal(b.fighters[b.currentActor].id,"test-area-damage");
b.fighters[2].weakenAttacks=1;
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(damage(b,2),21);
assert.equal(damage(b,3),21,"second target receives same tag bonus");
// Being the leader is NOT required for a passive.
b=core.createBattle([ren(),ally("tagged",["gardens-over-abyss"]),foe("leader-foe")],
 [],{leaderId:"trial-ren"});
core.advanceToPlayerTurn(b);
assert.equal(b.fighters[b.currentActor].id,"tagged");
assert.equal(hit(b),true);
assert.equal(damage(b,2),21);
assert.equal(abilities.get(ren(),"leader"),null);
// No Ren in the roster means no Garden synergy.
b=start([ally("solo",["gardens-over-abyss"]),foe("solo-foe")]);
assert.equal(hit(b),true);
assert.equal(damage(b,1),20);
// Guard is a positive effect and is not counted as debuff.
b=start([ren(),foe("guarded")]);
b.fighters[1].guardHits=1;
assert.equal(hit(b),true);
assert.equal(damage(b,1),14,"only the 5% tag bonus before guard halving");
// Automated basic attack goes through the same passive calculation.
b=start([ren(),foe("auto-foe")]);
assert.equal(core.performAutoAction(b,{abilityId:"basic",targetIndex:1}),true);
assert.equal(damage(b,1),28);
// Duplicate active owners cannot form a second source by repeating actor IDs.
assert.throws(()=>core.createBattle([ren(),ren(),foe("duplicate")]),/unique id/);

// Opt-in seeded legacy on-hit slow now uses the same numeric status channel.
// This is technical pilot formula, not approved balance.
const seeded=down=>{
 const actor={...ren(),debuffPotency:0};
 const trialEnemy=foe("seeded-target",{debuffResistance:90});
 const x=start([actor,trialEnemy],{rngSeed:0,statusChecks:true});
 if(down)status.apply(x.fighters[1],"debuff-resistance-down",15,2);
 return x;
};
b=seeded(false);
assert.equal(hit(b),true);
assert.equal(b.rng.draws,1,"one draw for one on-hit status");
assert.equal(status.read(b.fighters[1],"slowed"),null,"seed=0 loses at 20%");
assert.equal(b.events.find(e=>e.type==="status-resisted")?.chance,20,
 "100 base +10 potency -90 resistance");
const noDownSnapshot={draws:b.rng.draws,hp:b.fighters[1].hp};
assert.equal(noDownSnapshot.hp,972,"damage unaffected by resisted status");
b=seeded(true);
assert.equal(hit(b),true);
assert.equal(b.rng.draws,1,"resistance-down does not add an RNG draw");
assert.equal(status.read(b.fighters[1],"slowed")?.remaining,2,
 "seed=0 succeeds at 25%");
assert.equal(b.fighters[1].debuffResistance,90,
 "resistance-down never mutates base resistance");
assert.equal(status.effectiveDebuffResistance(b.fighters[1],90),75);
assert.equal(b.events.filter(e=>e.type==="effect"&&e.effect==="slowed").length,1);
assert.equal(b.events.filter(e=>e.type==="status-resisted").length,0);

// Invalid RNG profiles must reject atomically, with no action / damage / meter.
b=start([ren(),foe("bad-profile")],{rngSeed:0,statusChecks:true});
const before=JSON.stringify({rng:b.rng,events:b.events,turn:b.turn,
 actions:b.allyActions,hp:b.fighters.map(x=>x.hp),meter:b.fighters[0].meter});
assert.equal(hit(b),false);
assert.equal(JSON.stringify({rng:b.rng,events:b.events,turn:b.turn,
 actions:b.allyActions,hp:b.fighters.map(x=>x.hp),meter:b.fighters[0].meter}),before);

// RNG budget overflow also rejects without changes.
b=seeded(false);
b.rng.draws=Number.MAX_SAFE_INTEGER;
const maxBefore=JSON.stringify({rng:b.rng,events:b.events,turn:b.turn,actions:b.allyActions});
assert.equal(hit(b),false);
assert.equal(JSON.stringify({rng:b.rng,events:b.events,turn:b.turn,actions:b.allyActions}),maxBefore);

// Repeated seeded simulations are deterministic and do not leak combat status.
function replay(){
 const s=seeded(true);hit(s);
 return JSON.stringify({rng:s.rng,events:s.events,hp:s.fighters.map(h=>h.hp),
 effects:core.activeEffects(s.fighters[1])});
}
assert.equal(replay(),replay());

// Explicitly typed weaken must also use the generic passive potency path.
// The source is temporarily adapted IN THIS TEST; no production type changes.
const typedSrc=source.replace("const AbilityData=(()=>","let AbilityData=(()=>");
const typedPatch=[
 "const original=AbilityData;",
 "AbilityData={...original,get:(actor,abilityId)=>{",
 "const a=original.get(actor,abilityId);",
 "return actor?.id==='trial-ren'&&abilityId==='special'?{...a,damageType:'physical'}:a;",
 "}};",
 "({CombatCore,CombatStatusCore,StoryTrialData})"
].join("\n");
const typed=vm.runInNewContext(typedSrc+"\n"+typedPatch);
function typedRun(down){
 const h={...typed.StoryTrialData.heroes()[0],physicalAttack:27,debuffPotency:0};
 const e=foe("typed-foe",{debuffResistance:90,physicalDefense:0});
 const x=typed.CombatCore.createBattle([h,e],[],{rngSeed:0,statusChecks:true});
 typed.CombatCore.advanceToPlayerTurn(x);
 if(down)typed.CombatStatusCore.apply(x.fighters[1],"debuff-resistance-down",15,2);
 assert.equal(typed.CombatCore.performPlayerAbility(x,"special"),true);
 return x;
}
let typedFight=typedRun(false);
assert.equal(typedFight.events.find(e=>e.type==="status-resisted")?.chance,20);
typedFight=typedRun(true);
assert.equal(typedFight.events.find(e=>e.type==="status-resisted"),undefined);
assert.equal(typedFight.fighters[1].weakenAttacks,2);

// Untouched v3 saves and permanent collection.
assert.ok(!read("progress-v3-core.js").includes("trial-ren"));
assert.ok(!read("hero-collection-core.js").includes("trial-ren"));
assert.ok(!read("index.html").includes('src="design/ren-gear-plan.js"'));
console.log("REN-COMBAT-C: passive additive damage, tag/life gate, seeded resistance, typed status, RNG atomicity and save isolation");
