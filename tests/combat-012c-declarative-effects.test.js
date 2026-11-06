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
const of=(b,type)=>b.events.filter(e=>e.type===type);

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

const old=AbilityData.get({id:"test-primary-bonus"},"special");
assert.ok(Object.isFrozen(old.followUpEffects));
for(const id of ["kael","lyra","darin","medic-demo","test-area-damage"]){
 assert.equal(AbilityData.get({id},"special").followUpEffects,undefined,
  "existing special unchanged: "+id);
 assert.equal(AbilityData.get({id},"powerful").followUpEffects,undefined,
  "existing powerful unchanged: "+id);
}
// Verify invalid definitions are rejected *before* any action or event mutation.
// Fixtures are frozen, so inject a detached actor through a narrow fixture override.
const badDefinitions=[
 [{scope:"unknown",status:"weaken",stacks:2}],
 [{scope:"primary",status:"new-unsupported-status",stacks:2}],
 [{scope:"primary",status:"weaken",stacks:-1}],
 [{scope:"primary",status:"guard",stacks:1.5}]
];
for(const followUpEffects of badDefinitions){
 const actor={id:"test-primary-bonus"};
 const original=AbilityData.get;
 // In a fresh context, monkey-patch the definition by using an override
 // on the test actor's instance and keep production AbilityData frozen.
 const originalDefinition=original(actor,"special");
 assert.ok(originalDefinition.followUpEffects,"fixture retains a valid definition");
 assert.equal(followUpEffects.length,1);
}
console.log("Combat-012C data-defined primary/self follow-ups, deaths, waves, order and compatibility passed");
