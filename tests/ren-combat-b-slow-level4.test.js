"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const modules=["initiative-model.js","combat-status-core.js","ability-data.js","battle-rng.js",
 "combat-core.js","story-trial-data.js","ability-info.js"];
const {CombatCore,AbilityData,CombatStatusCore,StoryTrialData,AbilityInfo}=
 vm.runInNewContext(modules.map(read).join("\n")+"\n({CombatCore,AbilityData,CombatStatusCore,StoryTrialData,AbilityInfo})");
const template=StoryTrialData.heroes()[0];
assert.equal(template.skillLevels.basic,4,"story-only test level exposes approved threshold");
for(let level=1;level<=6;level++){
 const actor={...template,skillLevels:{basic:level}};
 const a=AbilityData.get(actor,"basic");
 assert.equal(a.name,"Точный удар · проба");
 assert.equal(a.kind,"damage");
 assert.equal(a.multiplier,1,"unapproved damage scaling must not be introduced");
 assert.equal(!!a.onHitStatus,level>=4,"slow unlock at level four and never earlier");
 if(level>=4){
  assert.equal(a.onHitStatus.type,"slowed");
  assert.equal(a.onHitStatus.amount,20,"only noncanonical pilot strength");
  assert.equal(a.onHitStatus.turns,2,"only noncanonical pilot duration");
 }
}
assert.equal(AbilityData.get({...template,skillLevels:{basic:7}},"basic").onHitStatus,undefined);
assert.equal(AbilityData.get({...template,skillLevels:{basic:3}},"basic").onHitStatus,undefined);
assert.equal(AbilityData.get({...template,skillLevels:{basic:4}},"special").onHitStatus,undefined);
assert.equal(AbilityData.get({id:"kael"},"basic").onHitStatus,undefined);
const description=AbilityInfo.format(template,"basic");
assert.match(description.description,/Замедление/);
assert.match(description.description,/тестовый баланс/);
const enemy=(id,hp=200)=>({id,name:"Тренировочная цель",role:"Цель",side:"enemy",hp,atk:0,speed:1});
const battle=CombatCore.createBattle([template,enemy("slow-foe")]);
CombatCore.advanceToPlayerTurn(battle);
assert.equal(battle.fighters[battle.currentActor].id,"trial-ren");
const beforeTurn=battle.turn;
assert.equal(CombatCore.performPlayerAbility(battle,"basic"),true);
assert.ok(battle.turn>beforeTurn);
const target=battle.fighters.find(f=>f.id==="slow-foe");
assert.ok(target.hp>0);
assert.equal(target.speed,1,"slow never mutates underlying speed");
assert.equal(CombatStatusCore.read(target,"slowed").remaining,2);
assert.equal(CombatStatusCore.effectiveSpeed(target,100),80);
assert.equal(CombatCore.effectiveStat(battle,target,"speed"),1,"minimum effective speed is one");
assert.ok(CombatCore.activeEffects(target).some(e=>e.type==="slowed"&&e.remaining===2));
assert.ok(battle.events.some(e=>e.type==="effect"&&e.effect==="slowed"));
assert.equal(CombatCore.performPlayerAbility(battle,"basic"),true,"next player action can refresh");
assert.equal(CombatStatusCore.read(target,"slowed").remaining,2,"slow never stacks on refresh");
// Execute actual ENEMY commands (not fake tick calls): expires only on its turns.
const foeIndex=battle.fighters.findIndex(f=>f.id==="slow-foe");
for(let remaining=1;remaining>=0;remaining--){
 battle.currentActor=foeIndex;
 target.meter=1000;
 assert.equal(CombatCore.performActorAbility(battle,"basic",0),true);
 const status=CombatStatusCore.read(target,"slowed");
 assert.equal(status?.remaining??0,remaining,"duration ticks on target own completed action");
}
assert.equal(CombatCore.effectiveStat(battle,target,"speed"),1);
// Same story fighter at levels 1–3 should have NO slow effect in real combat.
for(let level=1;level<=3;level++){
 const b=CombatCore.createBattle([{...template,skillLevels:{basic:level}},enemy("low-level-"+level)]);
 CombatCore.advanceToPlayerTurn(b);
 assert.equal(CombatCore.performPlayerAbility(b,"basic"),true);
 assert.equal(CombatStatusCore.read(b.fighters[1],"slowed"),null);
}
const fatal=CombatCore.createBattle([template,enemy("fragile",1)]);
CombatCore.advanceToPlayerTurn(fatal);
assert.equal(CombatCore.performPlayerAbility(fatal,"basic"),true);
assert.equal(fatal.winner,"ally");
assert.equal(CombatStatusCore.read(fatal.fighters[1],"slowed"),null,"no status on dead target");
const seeded=CombatCore.createBattle([template,enemy("seeded")],[],{rngSeed:42,statusChecks:true});
CombatCore.advanceToPlayerTurn(seeded);
const saved=JSON.stringify({turn:seeded.turn,events:seeded.events,hp:seeded.fighters[1].hp,actions:seeded.allyActions});
assert.equal(CombatCore.performPlayerAbility(seeded,"basic"),false,"unapproved resistance/RNG logic rejected");
assert.equal(JSON.stringify({turn:seeded.turn,events:seeded.events,hp:seeded.fighters[1].hp,actions:seeded.allyActions}),saved);
assert.ok(!read("progress-v3-core.js").includes("trial-ren"),"story level cannot leak to save-v3");
assert.ok(!read("hero-collection-core.js").includes("trial-ren"),"trial Ren not recruited");
const html=read("index.html");
assert.ok(html.indexOf('src="combat-status-core.js"')<html.indexOf('src="combat-core.js"'));
assert.match(read("game.js"),/Замедление/);
console.log("REN-COMBAT-B: trial level 4 slow, lower-level exclusion, own-turn expiry, seeded rejection, death and save isolation");
