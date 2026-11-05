"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const source=["initiative-model.js","ability-data.js","combat-core.js"]
 .map(file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8")).join("\n");
const core=vm.runInNewContext(source+"\nCombatCore");
const unit=(id,side,hp,atk,speed)=>({id,name:id,side,hp,atk,speed});
const types=b=>b.events.map(event=>event.type);
const eventsOf=(b,type)=>b.events.filter(event=>event.type===type);

// Successful actions emit an ordered batch. Existing message and exact values stay the same.
let b=core.createBattle([unit("lyra","ally",200,20,200),unit("enemy","enemy",500,5,1)]);
assert.equal(b.events.length,0);
core.advanceToPlayerTurn(b);
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.deepEqual(types(b),["ability","damage","effect"]);
assert.equal(b.events[0].actorId,"lyra");
assert.equal(b.events[0].targetId,"enemy");
assert.equal(b.events[0].abilityId,"special");
assert.equal(b.events[1].amount,20);
assert.equal(b.events[1].remainingHp,480);
assert.equal(b.events[2].effect,"weaken");
assert.equal(b.events[2].stacks,2);
assert.equal(b.message,"lyra применяет Ослабляющий удар: enemy получает 20 урона, ослабление ×2.");
const oldBatch=b.events;
assert.equal(core.performPlayerAbility(b,"special"),false,"unavailable ability rejected");
assert.equal(b.events,oldBatch,"rejected action does not destroy previous result");
assert.equal(b.fighters[0].specialCooldown,2);

// Ally-targeted guard has no damage event.
b=core.createBattle([unit("kael","ally",200,20,200),unit("enemy","enemy",500,5,1)]);
core.advanceToPlayerTurn(b);
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.deepEqual(types(b),["ability","effect"]);
assert.equal(b.events[0].targetId,"kael");
assert.equal(b.events[1].effect,"guard");
assert.equal(b.events[1].stacks,2);
assert.equal(b.message,"kael защищает kael: защита ×2.");

// Lethal hit announces actual damage, death and winner once, in that order.
b=core.createBattle([unit("darin","ally",100,27,200),unit("enemy","enemy",35,1,1)]);
core.advanceToPlayerTurn(b);
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.deepEqual(types(b),["ability","damage","death","battle-end"]);
assert.equal(b.events[1].amount,41);
assert.equal(b.events[1].remainingHp,0);
assert.equal(b.events[2].targetId,"enemy");
assert.equal(b.events[3].winner,"ally");
assert.equal(b.message,"Победа! Отряд одержал верх.");
core.advanceToPlayerTurn(b);
assert.equal(b.events.length,4,"completed battle must not repeat victory");

// A single enemy lethal attack during initial initiative also has a complete outcome.
b=core.createBattle([unit("kael","ally",1,1,100),unit("enemy","enemy",100,20,200)]);
core.advanceToPlayerTurn(b);
assert.deepEqual(types(b),["ability","damage","death","battle-end"]);
assert.equal(b.events[0].actorId,"enemy");
assert.equal(b.events[1].amount,20);
assert.equal(b.events[1].remainingHp,0);
assert.equal(b.events[3].winner,"enemy");
assert.equal(b.message,"Поражение. Попробуй ещё раз.");

// Multiple automatic responses are retained separately in order, not collapsed into message.
b=core.createBattle([unit("kael","ally",500,1,100),unit("enemy","enemy",500,5,300)]);
core.advanceToPlayerTurn(b);
assert.equal(b.active,true);
assert.ok(eventsOf(b,"ability").length>=2,"enemy acts several times before first player turn");
assert.ok(b.events.every(e=>e.type==="ability"||e.type==="damage"));
assert.equal(core.performPlayerAbility(b,"basic"),true);
assert.equal(b.events[0].type,"ability");
assert.equal(b.events[0].actorId,"kael","player command begins a new batch");
const enemyAbilities=eventsOf(b,"ability").filter(x=>x.actorId==="enemy");
assert.ok(enemyAbilities.length>=2,"enemy responses are not lost");
for(const event of b.events)assert.equal(typeof event.type,"string");
const fresh=core.createBattle([unit("kael","ally",100,1,100),unit("enemy","enemy",100,1,100)]);
assert.equal(fresh.events.length,0,"restart clears events");

// Actual damage emitted after rounding through both weakening and guarding.
b=core.createBattle([unit("kael","ally",100,1,100),unit("enemy","enemy",100,21,200)]);
b.fighters[0].guardHits=2;
b.fighters[1].weakenAttacks=2;
core.advanceToPlayerTurn(b);
assert.equal(eventsOf(b,"damage")[0].amount,8);
assert.equal(eventsOf(b,"damage")[0].remainingHp,92);
assert.equal(b.fighters[0].guardHits,1);
assert.equal(b.fighters[1].weakenAttacks,1);
console.log("Combat-Events-001 ordered actions, effects, multiple AI turns, death and outcomes passed");
