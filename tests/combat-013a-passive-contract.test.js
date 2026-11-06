"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const src=["initiative-model.js","ability-data.js","combat-core.js","combat-log.js"]
 .map(p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8")).join("\n");
const {CombatCore:core,AbilityData,CombatLog}=vm.runInNewContext(src+
 "\n({CombatCore,AbilityData,CombatLog})");
const actor=(id,side="ally",speed=300,hp=100,atk=20)=>
 ({id,name:id,side,speed,hp,atk});
const make=(id,enemies=[actor("foe","enemy",1,1000,1)])=>{
 const b=core.createBattle([actor(id),...enemies]);
 core.advanceToPlayerTurn(b);
 return b;
};
const triggers=b=>Array.from(b.events).filter(e=>e.type==="passive-trigger");
for(const id of ["kael","lyra","darin","medic-demo","test-area-damage"]){
 const definition=AbilityData.get({id},"passive");
 assert.equal(definition.id,"passive","passive slot exists for "+id);
 assert.equal(definition.triggers.length,0,"no unapproved passives fire for "+id);
 assert.equal(AbilityData.get({id},"leader"),null,"leader mechanics remain unassigned");
}
assert.equal(AbilityData.get({id:"unknown"},"passive"),null);
let b=make("test-passive-attacker");
assert.equal(core.abilityReady(b,"passive"),false,"passive cannot be clicked as an action");
assert.equal(core.performPlayerAbility(b,"passive"),false);
assert.equal(b.allyActions,0);
assert.equal(core.performPlayerAbility(b,"basic"),true);
assert.equal(b.allyActions,1);
assert.equal(triggers(b).length,1,"damage from passive owner produces one matching trigger");
assert.equal(triggers(b)[0].ownerId,"test-passive-attacker");
assert.equal(triggers(b)[0].sourceEventType,"damage");
assert.equal(triggers(b)[0].sourceActorId,"test-passive-attacker");
assert.equal(triggers(b)[0].triggerIndex,0);
assert.equal(b.fighters[0].guardHits,0,"passive trigger has no gameplay effect yet");
assert.ok(b.events.findIndex(e=>e.type==="passive-trigger")>
 b.events.findIndex(e=>e.type==="damage"),"trigger follows the source event");
assert.equal(triggers(b).filter(e=>e.sourceEventType==="passive-trigger").length,0,
 "no recursive trigger emission");
const old=triggers(b).length;
core.performPlayerAbility(b,"basic");
assert.ok(triggers(b).length>=old,"future actions remain safe");

b=core.createBattle([actor("test-passive-defender","ally",50,200,20),
 actor("foe","enemy",250,200,1)]);
core.advanceToPlayerTurn(b);
assert.ok(triggers(b).length>=1,"an enemy hit fires a passive on its allied recipient");
assert.ok(triggers(b).every(e=>e.ownerId==="test-passive-defender"));
assert.ok(triggers(b).every(e=>e.sourceTargetId==="test-passive-defender"));
assert.ok(triggers(b).every(e=>e.sourceActorId==="foe"));

b=make("test-passive-both");
core.performPlayerAbility(b,"basic");
assert.equal(triggers(b).length,1,"actor-role and target-role do not double-fire");
assert.equal(triggers(b)[0].triggerIndex,0);

b=make("kael");
core.performPlayerAbility(b,"special");
assert.equal(triggers(b).length,0,"existing hero's special doesn't acquire a passive");
assert.equal(core.abilityReady(b,"leader"),false);
assert.equal(core.performPlayerAbility(b,"leader"),false);
assert.ok(CombatLog.lines(b.events,b.fighters).every(Boolean),
 "new internal trigger events do not insert empty journal rows");

b=make("test-passive-attacker",[actor("weak","enemy",1,10,1)]);
core.performPlayerAbility(b,"basic");
assert.equal(b.winner,"ally");
assert.equal(triggers(b).length,1);
assert.equal(b.events.filter(e=>e.type==="battle-end").length,1);
const fresh=make("test-passive-attacker");
assert.equal(triggers(fresh).length,0,"no passive triggers leak across battles");
console.log("Combat-013A passive slots, deterministic triggers, enemy hits, no recursion and reset passed");
