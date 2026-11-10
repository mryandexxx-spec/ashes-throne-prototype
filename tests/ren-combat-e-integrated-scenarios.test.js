"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const source=["initiative-model.js","combat-status-core.js","ability-data.js","battle-rng.js",
 "combat-core.js","story-trial-data.js","combat-log.js","ability-info.js"].map(read).join("\n");
const {CombatCore:core,CombatStatusCore:status,StoryTrialData:story,
 AbilityData:ability,CombatLog:log}=vm.runInNewContext(source+
 "\n({CombatCore,CombatStatusCore,StoryTrialData,AbilityData,CombatLog})");
const ren=()=>({...story.heroes()[0]});
const enemy=(id,hp=550,speed=1)=>({id,name:id,side:"enemy",hp,atk:0,speed,role:"Учебный враг"});
const start=(enemies,waves=[])=>{
 const battle=core.createBattle([ren(),...enemies],waves);
 core.advanceToPlayerTurn(battle);
 return battle;
};
const find=(b,id)=>b.fighters.find(f=>f.id===id);
const effect=(f,type)=>status.read(f,type);
const assertReadyRen=b=>assert.equal(b.fighters[b.currentActor]?.id,"trial-ren");
const perform=(b,id)=>{
 assertReadyRen(b);
 assert.equal(core.performPlayerAbility(b,id),true,id+" executes");
 return Array.from(b.events);
};

// Scenario 1: full chain in actual shared turn executor.
// Powerful opens resistance debuff; basic adds slow; special adds weaken.
// Original source damage remains unchanged and passive works from previous states.
let b=start([enemy("front"),enemy("rear")]);
const firstFront=find(b,"front"),firstRear=find(b,"rear");
const startHP=firstFront.hp;
let events=perform(b,"powerful");
assert.equal(b.allyActions,1);
assert.equal(b.fighters[0].powerfulCooldown,2);
assert.equal(firstRear.hp,550,"secondary foe is not damaged by powerful");
assert.equal(effect(firstFront,"debuff-resistance-down")?.remaining,2);
assert.equal(effect(firstRear,"debuff-resistance-down")?.remaining,2);
assert.equal(b.fighters[0].atk,27,"base stats unchanged");
assert.equal(startHP-firstFront.hp,45,"first power: 1.6×27 then +5% tag");
assert.equal(events.filter(e=>e.type==="effect"&&e.effect==="debuff-resistance-down").length,2);

events=perform(b,"basic");
assert.equal(b.allyActions,2);
assert.equal(b.fighters[0].powerfulCooldown,1);
assert.equal(effect(firstFront,"slowed")?.remaining,2);
assert.equal(firstFront.hp,startHP-45-32,"basic after resistance debuff gains 15+5%");
assert.equal(events.some(e=>e.type==="effect"&&e.effect==="slowed"),true);

events=perform(b,"special");
assert.equal(b.allyActions,3);
assert.equal(b.fighters[0].powerfulCooldown,0);
assert.equal(b.fighters[0].specialCooldown,2);
assert.equal(firstFront.weakenAttacks,2);
assert.equal(events.some(e=>e.type==="effect"&&e.effect==="weaken"),true);
assert.equal(firstFront.hp,startHP-45-32-32,"special vs already debuffed");
assert.equal(effect(firstRear,"debuff-resistance-down")?.remaining,2,
 "other targets' status durations only count their own turns");
assert.equal(log.lines(events,b.fighters).some(line=>/Найти брешь/.test(line)),true);

// Changing to a new target removes weakness damage bonus until a status
// exists there; it does not inherit a status from some other target.
assert.equal(core.chooseEnemy(b,2),true);
const rearBefore=firstRear.hp;
perform(b,"basic");
assert.equal(rearBefore-firstRear.hp,32,"rear already has group debuff");
assert.equal(effect(firstRear,"slowed")?.remaining,2);

// Scenario 2: status durations expire on the actual affected enemy's turns.
// Own turn completion does not alter another fighter's duration.
b=start([enemy("expiry-a"),enemy("expiry-b")]);
perform(b,"powerful");
const expiryA=find(b,"expiry-a"),expiryB=find(b,"expiry-b");
const expiryAIndex=b.fighters.findIndex(f=>f.id==="expiry-a");
for(let remaining=1;remaining>=0;remaining--){
 b.currentActor=expiryAIndex;expiryA.meter=1000;
 assert.equal(core.performActorAbility(b,"basic",0),true);
 assert.equal(effect(expiryA,"debuff-resistance-down")?.remaining??0,remaining);
 assert.equal(effect(expiryB,"debuff-resistance-down")?.remaining,2);
}
assert.equal(expiryA.debuffResistance,undefined,"source stats remain untouched");

// Scenario 3: follow-up is isolated across waves, no dead/enemy status leaks.
// Surviving Ren retains cooldown and HP; newly spawned enemies have no statuses.
b=start([enemy("wave-one",40)],[ [enemy("wave-two",500)] ]);
events=perform(b,"powerful");
assert.equal(b.wave,2);
assert.equal(b.active,true);
assert.equal(b.winner,null);
assert.equal(b.fighters.length,2);
assert.equal(find(b,"wave-one"),undefined);
assert.equal(find(b,"wave-two").hp,500);
assert.equal(effect(find(b,"wave-two"),"debuff-resistance-down"),null);
assert.equal(b.fighters[0].powerfulCooldown,2);
assert.equal(b.events.some(e=>e.type==="wave-start"),true);
assert.equal(core.abilityReady(b,"powerful"),false);

// Scenario 4: autoplay and manual pathways share rules; no repeated cooldown.
b=start([enemy("auto-a",200),enemy("auto-b",200)]);
assertReadyRen(b);
assert.equal(core.performAutoAction(b,{abilityId:"powerful",targetIndex:1}),true);
assert.equal(b.fighters[0].powerfulCooldown,2);
assert.equal(effect(find(b,"auto-b"),"debuff-resistance-down")?.remaining,2);
assert.equal(b.allyActions,1);
assertReadyRen(b);
assert.equal(core.performAutoAction(b,{abilityId:"basic",targetIndex:2}),true);
assert.equal(effect(find(b,"auto-b"),"slowed")?.remaining,2);
assert.equal(b.fighters[0].powerfulCooldown,1);

// Scenario 5: victory and replay start from clean state, without stale statuses.
b=start([enemy("victory",1)]);
perform(b,"basic");
assert.equal(b.active,false);
assert.equal(b.winner,"ally");
assert.equal(core.performPlayerAbility(b,"powerful"),false);
assert.equal(b.fighters[0].specialCooldown,0);
const replay=start([enemy("victory",1)]);
assert.equal(replay.active,true);
assert.equal(replay.wave,1);
assert.equal(replay.allyActions,0);
assert.equal(replay.fighters[0].specialCooldown,0);
assert.equal(replay.fighters[0].powerfulCooldown,0);
assert.equal(core.activeEffects(replay.fighters[1]).length,0);

// Scenario 6: defeat must stop actions, and a fresh battle must not inherit
// statuses, cooldowns, meters or the previous winner.
const doomed=core.createBattle([
 {...ren(),hp:1,speed:1},
 {...enemy("killer",300,400),atk:30}
]);
core.advanceToPlayerTurn(doomed);
assert.equal(doomed.active,false);
assert.equal(doomed.winner,"enemy");
assert.equal(doomed.currentActor,-1);
assert.equal(core.performPlayerAbility(doomed,"basic"),false);
assert.equal(core.performAutoAction(doomed,{abilityId:"powerful",targetIndex:1}),false);
const afterDefeat=start([enemy("fresh",300)]);
assert.equal(afterDefeat.active,true);
assert.equal(afterDefeat.winner,null);
assert.equal(afterDefeat.allyActions,0);
assert.equal(afterDefeat.fighters[0].hp,91);
assert.equal(afterDefeat.fighters[0].powerfulCooldown,0);
assert.equal(afterDefeat.fighters[1].hp,300);
assert.equal(core.activeEffects(afterDefeat.fighters[1]).length,0);

// Scenario 7: no persistent Ren, trial numbers and origin do not leak.
assert.deepEqual(Array.from(story.heroes()[0].tags),["gardens-over-abyss"]);
assert.equal(ability.get(story.heroes()[0],"powerful").name,"Сорвать построение · проба");
assert.equal(ability.get(story.heroes()[0],"basic").name,"Точный удар · проба");
for(const p of ["progress-v3-core.js","hero-collection-core.js","campaign-data.js"])
 assert.ok(!read(p).includes("trial-ren"),"trial hero excluded from "+p);
assert.equal(JSON.parse(read("package.json")).version,"0.3.104");
console.log("REN-COMBAT-E: integrated Ren kit, cooldowns, expiry, waves, autoplay, victory/replay and no save leak");
