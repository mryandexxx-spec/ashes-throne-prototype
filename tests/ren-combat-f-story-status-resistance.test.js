"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const src=["initiative-model.js","combat-status-core.js","ability-data.js",
 "battle-rng.js","combat-core.js","story-trial-data.js","combat-log.js"].map(read).join("\n");
const {CombatCore:core,CombatStatusCore:status,StoryTrialData:trial,CombatLog:log}=vm.runInNewContext(src+"\n({CombatCore,CombatStatusCore,StoryTrialData,CombatLog})");
const foe=(id,resistance,props={})=>({id,name:id,side:"enemy",role:"Учебный враг",hp:800,atk:0,speed:1,
 debuffPotency:0,debuffResistance:resistance,...props});
const baseRen=()=>({...trial.heroes()[0]});
const options=()=>({...trial.statusPilot});
const setup=(r=baseRen(),resistance=90,opts=options())=>{
 const b=core.createBattle([r,foe("foe",resistance)],[],opts);
 core.advanceToPlayerTurn(b);
 assert.equal(b.fighters[b.currentActor].id,"trial-ren");
 return b;
};
const act=(b,id)=>core.performPlayerAbility(b,id);
const statusEvents=b=>b.events.filter(e=>e.type==="status-resisted");
assert.equal(trial.statusPilot.rngSeed,0);
assert.equal(trial.statusPilot.legacyStatusChecks,true);
assert.equal(trial.statusPilot.statusChecks,true);
assert.deepEqual(Array.from(trial.statusPilot.enemyResistance),[90,50]);
assert.ok(trial.heroes().every(hero=>hero.debuffPotency===0&&hero.debuffResistance===0));
const game=read("game.js");
assert.match(game,/storyTrialParty&&battleIsStoryDemo\?StoryTrialData\.statusPilot/);
assert.match(game,/StoryTrialData\.statusPilot\.enemyResistance\[i\]/);
assert.match(game,/СОПРОТИВЛЕНИЕ \(ТЕСТ\)/);
assert.equal(core.createBattle([baseRen(),foe("def",90)]).legacyStatusChecks,undefined);
assert.throws(()=>core.createBattle([baseRen(),foe("x",90)],[],{legacyStatusChecks:true}),/requires statusChecks/);
assert.throws(()=>core.createBattle([baseRen(),foe("x",90)],[],{legacyStatusChecks:1}),/boolean/);

// First seeded roll at seed=0 is ~23.6%. Ren gets +10 p.p. with no
// resistance-down -> chance 20% against resistance 90; slow is resisted.
let b=setup();
assert.equal(act(b,"basic"),true);
assert.equal(b.rng.draws,1);
assert.equal(b.fighters[1].hp,800-28);
assert.equal(status.read(b.fighters[1],"slowed"),null);
assert.equal(statusEvents(b)[0].effect,"slowed");
assert.equal(statusEvents(b)[0].chance,20);
assert.match(log.lines(b.events,b.fighters).join("\n"),/Замедление/);

// Same draw, with −15 p.p. resistance-down: chance 25%, thus slow succeeds;
// +10 bonus is absent when target is already under resistance-down.
b=setup();
status.apply(b.fighters[1],"debuff-resistance-down",15,2);
assert.equal(act(b,"basic"),true);
assert.equal(b.rng.draws,1);
assert.equal(status.read(b.fighters[1],"slowed")?.remaining,2);
assert.equal(statusEvents(b).length,0);
assert.equal(b.fighters[1].debuffResistance,90);

// Legacy weakening NOW checks resistance only in this explicit pilot.
// 23.6% roll vs 20% chance => resisted; damage and cooldown persist.
b=setup();
assert.equal(act(b,"special"),true);
assert.equal(b.rng.draws,1);
assert.equal(b.fighters[1].weakenAttacks,0);
assert.equal(statusEvents(b)[0].effect,"weaken");
assert.equal(statusEvents(b)[0].chance,20);
assert.equal(b.fighters[0].specialCooldown,2);
assert.ok(b.fighters[1].hp<800);
// Resistance-down in same pilot changes outcome of legacy weaken.
b=setup();
status.apply(b.fighters[1],"debuff-resistance-down",15,2);
assert.equal(act(b,"special"),true);
assert.equal(b.fighters[1].weakenAttacks,2);
assert.equal(b.rng.draws,1);

// Powerful attack rolls independently per surviving target (both in real
// story profile), and does not affect existing legacy campaign opt-out.
b=core.createBattle([baseRen(),foe("stubborn",90),foe("receptive",50)],[],options());
core.advanceToPlayerTurn(b);
assert.equal(act(b,"powerful"),true);
assert.equal(b.rng.draws,2);
assert.equal(status.read(b.fighters[1],"debuff-resistance-down"),null);
assert.equal(status.read(b.fighters[2],"debuff-resistance-down")?.remaining,2);

// Old legacy attacks remain guaranteed even when statusChecks:true but
// legacyStatusChecks was NOT explicitly enabled.
b=setup(baseRen(),90,{rngSeed:0,statusChecks:true});
assert.equal(act(b,"special"),true);
assert.equal(b.rng.draws,0);
assert.equal(b.fighters[1].weakenAttacks,2);
// No flags: stable original combat semantics, no RNG.
b=setup(baseRen(),90,{});
assert.equal(act(b,"special"),true);
assert.equal(b.rng,undefined);
assert.equal(b.fighters[1].weakenAttacks,2);

// Invalid status profile rejects the command BEFORE damage/cooldown/roll.
for(const resistance of [undefined,null,-1,101,NaN,Infinity,"80"]){
 b=setup(baseRen(),90,options());
 // Assign after setup: passing undefined as an optional argument would
 // incorrectly activate the default valid resistance of 90.
 b.fighters[1].debuffResistance=resistance;
 const snap=JSON.stringify({rng:b.rng,events:b.events,turn:b.turn,hp:b.fighters.map(f=>f.hp),
  cooldown:b.fighters[0].specialCooldown,actions:b.allyActions});
 assert.equal(act(b,"special"),false);
 assert.equal(JSON.stringify({rng:b.rng,events:b.events,turn:b.turn,hp:b.fighters.map(f=>f.hp),
  cooldown:b.fighters[0].specialCooldown,actions:b.allyActions}),snap);
}
b=setup(baseRen(),90,options());
b.rng.draws=Number.MAX_SAFE_INTEGER;
assert.equal(act(b,"special"),false);
assert.equal(b.allyActions,0);

// A replayed story trial starts a NEW reproducible seed and clean statuses.
function replay(){
 const fight=setup();
 act(fight,"special");
 return JSON.stringify({rng:fight.rng,events:fight.events,hp:fight.fighters.map(f=>f.hp)});
}
assert.equal(replay(),replay());
assert.ok(!read("hero-collection-core.js").includes("trial-ren"));
assert.ok(!read("progress-v3-core.js").includes("trial-ren"));
assert.equal(JSON.parse(read("package.json")).version,"0.3.76");
console.log("REN-COMBAT-F: opt-in legacy weaken, story status rolls, determinism, backwards compatibility, atomicity");
