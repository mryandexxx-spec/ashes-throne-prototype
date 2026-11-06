"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const read=n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8");
const {CombatCore:core,AbilityData}=vm.runInNewContext(
 ["initiative-model.js","ability-data.js","combat-core.js"].map(read).join("\n")+
 "\n({CombatCore,AbilityData})");
const hero=(id,hp=100,atk=20,speed=300)=>({id,name:id,side:"ally",hp,atk,speed});
const enemy=(id,hp=100)=>({id,name:id,side:"enemy",hp,atk:1,speed:10});
function battle(id,enemies=[enemy("first"),enemy("second")],waves=[]){
 const b=core.createBattle([hero(id),...enemies],waves);
 core.advanceToPlayerTurn(b);
 return b;
}
const of=(b,type)=>Array.from(b.events).filter(e=>e.type===type);

let b=battle("test-primary-bonus");
assert.equal(core.chooseEnemy(b,2),true,"select the second enemy manually");
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.fighters[1].hp,80);
assert.equal(b.fighters[2].hp,80);
assert.equal(b.fighters[1].weakenAttacks,0,"unselected enemy is not weakened");
assert.equal(b.fighters[2].weakenAttacks,2,"only primary receives bonus");
assert.equal(of(b,"ability")[0].primaryTargetId,"second");
assert.equal(of(b,"ability")[0].targetId,"second");
assert.deepEqual(Array.from(of(b,"ability")[0].targetIds),["first","second"]);
assert.deepEqual(of(b,"effect").map(e=>e.targetId),["second"]);
assert.equal(b.allyActions,1);
assert.equal(b.fighters[0].specialCooldown,2);
assert.ok(b.events.findIndex(e=>e.type==="effect")>b.events.findLastIndex(e=>e.type==="damage"),
 "follow-ups happen after baseline damage resolution");

b=battle("test-primary-bonus",[enemy("first",60),enemy("doomed",15)]);
core.chooseEnemy(b,2);
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.fighters[2].hp,0);
assert.equal(b.fighters[1].weakenAttacks,0,"no primary retarget after its death");
assert.equal(of(b,"effect").length,0,"no effect event on a dead primary");
assert.equal(of(b,"death").filter(e=>e.targetId==="doomed").length,1);

b=battle("test-primary-bonus",[enemy("doomed",10),enemy("second",10)],[[enemy("next",100)]]);
core.chooseEnemy(b,2);
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.wave,2);
assert.equal(of(b,"effect").length,0);
assert.equal(b.fighters[1].id,"next");
assert.equal(b.fighters[1].weakenAttacks,0,"a new wave never inherits old bonuses");
assert.equal(of(b,"wave-start").length,1);
assert.equal(b.fighters[0].specialCooldown,2);

b=battle("test-primary-bonus",[enemy("one",10),enemy("two",10)]);
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.winner,"ally");
assert.equal(of(b,"battle-end").length,1);
assert.equal(of(b,"effect").length,0);

b=battle("test-composed-effects");
b.fighters[2].weakenAttacks=4;
b.fighters[0].guardHits=3;
core.chooseEnemy(b,2);
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.fighters[2].weakenAttacks,4,"preexisting stronger debuff is not weakened");
assert.equal(b.fighters[1].weakenAttacks,0);
assert.equal(b.fighters[0].guardHits,3,"preexisting stronger guard is not overwritten");
assert.deepEqual(of(b,"effect").map(e=>[e.targetId,e.effect,e.stacks]),
 [["second","weaken",4],["test-composed-effects","guard",3]],
 "multiple data-defined effects resolve in listed order");

b=battle("test-composed-effects",[enemy("one",60),enemy("two",60)]);
b.fighters[0].weakenAttacks=2;
b.fighters[2].guardHits=2;
core.chooseEnemy(b,2);
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.fighters[1].hp,46,"weak attacker affects each group recipient");
assert.equal(b.fighters[2].hp,53,"guarded primary takes halved weakened damage");
assert.equal(b.fighters[2].guardHits,1);
assert.equal(b.fighters[0].weakenAttacks,1,"one weakening stack spent per command");
assert.equal(of(b,"effect").filter(e=>e.effect==="weaken").length,1);

b=battle("test-all-followups");
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.deepEqual(of(b,"effect").map(e=>e.targetId),["first","second"],
 "all-recipient scope is interpreted from data, not special-cased to primary");
assert.equal(b.fighters[1].weakenAttacks,1);
assert.equal(b.fighters[2].weakenAttacks,1);

const original=AbilityData.get({id:"test-primary-bonus"},"special");
assert.ok(Object.isFrozen(original.followUpEffects));
for(const id of ["kael","lyra","darin","medic-demo","test-area-damage"]){
 assert.equal(AbilityData.get({id},"special").followUpEffects,undefined,
  "existing special unchanged: "+id);
 assert.equal(AbilityData.get({id},"powerful").followUpEffects,undefined,
  "existing powerful unchanged: "+id);
}
const badDefinitions=[
 [{scope:"unknown",status:"weaken",stacks:2}],
 [{scope:"primary",status:"new-unsupported-status",stacks:2}],
 [{scope:"primary",status:"weaken",stacks:-1}],
 [{scope:"primary",status:"guard",stacks:1.5}],
 "not-an-array"
];
// Dedicated deterministic stub: production definitions stay frozen.
for(const followUpEffects of badDefinitions){
 const stub=`const AbilityData={get:(fighter,id)=> id==="basic"?
  ({id:"basic",name:"Basic",target:"enemy",kind:"damage",multiplier:1,cooldown:0}):
  id==="special"?({id:"special",name:"Invalid test",target:"all-enemies",
   kind:"damage",multiplier:1,cooldown:2,followUpEffects:${JSON.stringify(followUpEffects)}}):null};`;
 const coreBad=vm.runInNewContext(read("initiative-model.js")+"\n"+stub+"\n"+
   read("combat-core.js")+"\nCombatCore");
 const bad=coreBad.createBattle([hero("fixture"),enemy("victim")]);
 coreBad.advanceToPlayerTurn(bad);
 const eventRef=bad.events,turn=bad.turn,hp=bad.fighters[1].hp;
 assert.equal(coreBad.performPlayerAbility(bad,"special"),false);
 assert.equal(bad.events,eventRef,"invalid bonus cannot clear events");
 assert.equal(bad.turn,turn);
 assert.equal(bad.fighters[1].hp,hp);
 assert.equal(bad.allyActions,0);
 assert.equal(bad.fighters[0].specialCooldown,0);
}
console.log("Combat-012C declarative primary/self follow-ups, validation, deaths, waves and compatibility passed");
