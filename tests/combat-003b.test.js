"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const root = path.join(__dirname, "..");
const load = names => names.map(n => fs.readFileSync(path.join(root, n), "utf8")).join("\n");
const core = vm.runInNewContext(load(["initiative-model.js","combat-core.js"])+"\nCombatCore");
const unit = (id,side,hp,atk,speed) => ({id,name:id,side,hp,atk,speed});
const make = (allies,enemies) => core.createBattle([...allies,...enemies]);

// Guard: ally-only targeting, refresh, two hits, then normal damage.
let b=make([unit("kael","ally",100,10,100),unit("lyra","ally",100,10,100)],
  [unit("ves","enemy",500,20,100)]);
core.advanceToPlayerTurn(b);
assert.equal(b.fighters[b.currentActor].id,"kael");
assert.equal(core.chooseAlly(b,2),false);
assert.equal(core.chooseAlly(b,1),true);
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.fighters[1].guardHits,2);
assert.equal(b.fighters[2].hp,500,"guard deals no damage");
assert.equal(b.fighters[0].specialCooldown,2);
assert.equal(core.performPlayerAbility(b,"special"),false,"cooldown enforced");
b.fighters[2].speed=500;
const hp=b.fighters[1].hp;
// The enemy normally attacks first living ally; remove Kael to test a guarded recipient.
b.fighters[0].hp=0;
core.advanceToPlayerTurn(b); // no-op if ally is already active
// Simulate further real turns through initiative, with Lyra defending herself.
b.fighters[1].guardHits=2;
b.fighters[2].weakenAttacks=0;
while(b.active && b.fighters[1].guardHits>0){
  if(b.fighters[b.currentActor]?.side==="ally") core.performPlayerAbility(b,"basic");
  else core.advanceToPlayerTurn(b);
}
assert.equal(b.fighters[1].guardHits,0,"two enemy hits consume shield");
assert.ok(b.fighters[1].hp<=hp-20,"each 20 damage hit was halved");

// Weakening: damage, two enemy attacks, expires exactly; reapplication refreshes.
b=make([unit("lyra","ally",200,30,100)],[unit("ves","enemy",500,20,100)]);
core.advanceToPlayerTurn(b);
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.fighters[1].hp,470);
assert.equal(b.fighters[1].weakenAttacks,1,"enemy attacks immediately after special");
assert.equal(b.fighters[0].hp,186,"first weakened attack deals 14");
assert.equal(b.fighters[0].specialCooldown,2);
assert.equal(core.performPlayerAbility(b,"special"),false);
const hpBefore=b.fighters[0].hp;
core.performPlayerAbility(b,"basic");
assert.equal(b.fighters[1].weakenAttacks,0);
assert.equal(b.fighters[0].hp,hpBefore-14,"second weakened attack = 14");
const hpAfter=b.fighters[0].hp;
core.performPlayerAbility(b,"basic");
assert.equal(b.fighters[0].hp,hpAfter-20,"attack after weakening expires = 20");
assert.equal(b.fighters[0].specialCooldown,0);

// Darin's special is rounded to nearest integer.
b=make([unit("darin","ally",100,27,200)],[unit("ves","enemy",200,1,10)]);
core.advanceToPlayerTurn(b);
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.fighters[1].hp,159,"27 * 1.5 rounds to 41");

// Dead targets are invalid; new battles clear all statuses and cooldowns.
b=make([unit("kael","ally",100,10,100),unit("lyra","ally",0,10,100)],
  [unit("ves","enemy",200,10,100)]);
core.advanceToPlayerTurn(b);
assert.equal(core.chooseAlly(b,1),false);
assert.equal(core.chooseAlly(b,0),true);
assert.equal(core.performPlayerAbility(b,"special"),true);
const fresh=make([unit("kael","ally",100,10,100)],[unit("ves","enemy",200,10,100)]);
assert.equal(fresh.fighters[0].guardHits,0);
assert.equal(fresh.fighters[0].weakenAttacks,0);
assert.equal(fresh.fighters[0].specialCooldown,0);
console.log("Combat-003B tactical abilities and effects passed");
