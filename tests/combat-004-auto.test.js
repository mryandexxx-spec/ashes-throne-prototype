"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"..");
const read=n=>fs.readFileSync(path.join(root,n),"utf8");
const {CombatCore,ProgressCore}=vm.runInNewContext(
 ["initiative-model.js","ability-data.js","combat-core.js","progress-core.js"].map(read).join("\n")+
 "\n({CombatCore,ProgressCore})");
const ally={id:"hero",name:"Hero",side:"ally",hp:300,atk:31,speed:200};
const enemy=(id,hp=40)=>({id,name:id,side:"enemy",hp,atk:1,speed:100});
// Auto and manual attack paths must yield identical deterministic state.
const first=CombatCore.createBattle([ally,enemy("a"),enemy("b")]);
const manual=CombatCore.createBattle([ally,enemy("a"),enemy("b")]);
CombatCore.advanceToPlayerTurn(first);
CombatCore.advanceToPlayerTurn(manual);
CombatCore.chooseEnemy(manual,1);
assert.equal(CombatCore.performAutoAction(first),true);
assert.equal(CombatCore.performPlayerAbility(manual,"basic"),true);
const snapshot=b=>b.fighters.map(f=>[f.id,f.hp,f.meter,f.specialCooldown]);
assert.deepEqual(JSON.stringify(snapshot(first)),JSON.stringify(snapshot(manual)));
assert.equal(first.allyActions,1);
assert.equal(first.selectedEnemy,1);
assert.equal(first.events[0].type,"ability");
assert.equal(first.events[0].abilityId,"basic");
// AI re-targets to a living opponent even after a player selected another one.
first.selectedEnemy=2;
assert.equal(CombatCore.performAutoAction(first),true);
assert.equal(first.allyActions,2);
assert.equal(first.fighters[1].hp,0,"first enemy was finished");
assert.equal(first.selectedEnemy,2);
assert.equal(CombatCore.performAutoAction(first),true);
assert.equal(first.allyActions,3);
assert.ok(first.fighters[2].hp<40);
// Auto works through multiple waves with no intermediate victory or reward.
const waves=CombatCore.createBattle([ally,enemy("a",15)],[[enemy("b",15),enemy("c",15)]]);
const reward=ProgressCore.createProgress([ally]);
CombatCore.advanceToPlayerTurn(waves);
assert.equal(CombatCore.performAutoAction(waves),true);
assert.equal(waves.wave,2);
assert.equal(waves.active,true);
assert.equal(waves.winner,null);
assert.equal(waves.allyActions,1);
assert.equal(ProgressCore.claimFirstClear(reward,"black-pass-ambush",waves),null);
let steps=0;
while(waves.active&&steps++<30)assert.equal(CombatCore.performAutoAction(waves),true);
assert.ok(steps<30);
assert.equal(waves.winner,"ally");
assert.equal(waves.allyActions,3);
assert.equal(ProgressCore.claimFirstClear(reward,"black-pass-ambush",waves).currency,500);
assert.equal(ProgressCore.claimFirstClear(reward,"black-pass-ambush",waves),null);
assert.equal(CombatCore.performAutoAction(waves),false,"finished battle rejects AI turns");
// Losing path remains standard; no hidden enemy behavior changes.
const defeat=CombatCore.createBattle([
 {id:"weak",name:"Weak",side:"ally",hp:1,atk:1,speed:200},
 {id:"strong",name:"Strong",side:"enemy",hp:90,atk:99,speed:100}
]);
CombatCore.advanceToPlayerTurn(defeat);
let defeatSteps=0;
while(defeat.active&&defeatSteps++<12)
 assert.equal(CombatCore.performAutoAction(defeat),true);
assert.ok(defeatSteps<12);
assert.equal(defeat.active,false);
assert.equal(defeat.winner,"enemy");
assert.equal(CombatCore.performAutoAction(defeat),false);
assert.equal(ProgressCore.claimFirstClear(reward,"black-pass-ambush",defeat),null);
// No accidental action before any living actor is ready.
const unstarted=CombatCore.createBattle([ally,enemy("a")]);
assert.equal(CombatCore.performAutoAction(unstarted),false);
assert.equal(unstarted.allyActions,0);
console.log("Combat-004 core auto: manual equivalence, targets, waves, victory/defeat and reward passed");
