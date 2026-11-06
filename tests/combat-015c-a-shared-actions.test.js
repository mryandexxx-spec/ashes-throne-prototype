"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const {CombatCore}=vm.runInNewContext(
  ["initiative-model.js","ability-data.js","combat-core.js"].map(read).join("\n")+
  "\n({CombatCore})");
const ally=(id,hp=200,atk=20,speed=100)=>
  ({id,name:id,side:"ally",hp,atk,speed});
const enemy=(id,hp=200,atk=20,speed=100)=>
  ({id,name:id,side:"enemy",hp,atk,speed});
function readyEnemy(b,index) {
  b.currentActor=index;
  b.fighters[index].meter=1000;
}
const view=x=>JSON.parse(JSON.stringify(x));
let b=CombatCore.createBattle([
  ally("hero"),ally("hero-2"),enemy("test-team-heal")]);
readyEnemy(b,2);
b.fighters[2].hp=90;
assert.equal(CombatCore.actorAbilityReady(b,2,"special"),true);
assert.deepEqual(view(CombatCore.actorTargetIndices(b,2,"all-allies",2)),[2]);
assert.deepEqual(view(CombatCore.actorTargetIndices(b,2,"all-enemies",0)),[0,1]);
assert.deepEqual(view(CombatCore.actorTargetIndices(b,2,"enemy",0)),[0]);
assert.deepEqual(view(CombatCore.actorTargetIndices(b,2,"ally",0)),[]);
assert.deepEqual(view(CombatCore.actorTargetIndices(b,2,"enemy",2)),[],"enemy cannot attack own side");
assert.deepEqual(view(CombatCore.actorTargetIndices(b,2,"enemy",99)),[]);
assert.deepEqual(view(CombatCore.actorTargetIndices(b,2,"invalid",0)),[]);
assert.equal(CombatCore.abilityReady(b,"special"),false,"manual UI remains ally-only");
assert.equal(CombatCore.performPlayerAbility(b,"special"),false,"manual API must not allow enemy");
assert.equal(CombatCore.performActorAbility(b,"special",2),true);
assert.equal(b.fighters[2].hp,120,"enemy support heals its own side");
assert.equal(b.fighters[0].hp,200,"enemy healing does not heal player");
assert.equal(b.fighters[2].specialCooldown,2);
assert.equal(b.allyActions,0,"enemy actions never count as ally actions");
assert.equal(b.currentActor,-1,"enemy execution does not advance to another enemy turn");
assert.equal(b.events.at(-1).type,"heal");

b=CombatCore.createBattle([ally("one"),ally("two"),enemy("test-area-damage")]);
readyEnemy(b,2);
const health=b.fighters.slice(0,2).map(f=>f.hp);
assert.equal(CombatCore.performActorAbility(b,"special",0),true);
assert.ok(b.fighters[0].hp<health[0]&&b.fighters[1].hp<health[1],
  "enemy group attack must hit player allies only");
assert.equal(b.events.find(e=>e.type==="ability").primaryTargetId,"one");
assert.deepEqual(view(b.events.find(e=>e.type==="ability").targetIds),["one","two"]);
assert.equal(b.allyActions,0);
assert.equal(b.fighters[2].specialCooldown,2);

b=CombatCore.createBattle([ally("one"),enemy("test-self-guard")]);
readyEnemy(b,1);
assert.equal(CombatCore.performActorAbility(b,"special",1),true);
assert.equal(b.fighters[1].guardHits,2);
assert.equal(b.fighters[0].guardHits,0);

b=CombatCore.createBattle([ally("one"),ally("two"),enemy("test-composed-effects")]);
readyEnemy(b,2);
assert.equal(CombatCore.performActorAbility(b,"special",1),true);
assert.equal(b.fighters[1].weakenAttacks,2,"primary-only followup resolves on enemy-relative target");
assert.equal(b.fighters[0].weakenAttacks,0);
assert.equal(b.fighters[2].guardHits,1,"self followup remains on enemy caster");
assert.equal(b.allyActions,0);

b=CombatCore.createBattle([ally("one"),ally("two"),enemy("test-powerful-damage")]);
readyEnemy(b,2);
const before=b.fighters.map(f=>f.hp);
const snapshot=JSON.stringify(b);
assert.equal(CombatCore.performActorAbility(b,"powerful",2),false,"cannot attack teammate");
assert.equal(JSON.stringify(b),snapshot,"invalid action must leave all state untouched");
assert.equal(CombatCore.performActorAbility(b,"powerful",1),true);
assert.ok(b.fighters[1].hp<before[1]);
assert.equal(b.fighters[0].hp,before[0]);
assert.equal(b.fighters[2].powerfulCooldown,2);
readyEnemy(b,2);
assert.equal(CombatCore.actorAbilityReady(b,2,"powerful"),false,"cooldown enforced on enemy");
assert.equal(CombatCore.performActorAbility(b,"powerful",0),false);
assert.equal(CombatCore.performActorAbility(b,"basic",0),true);
assert.equal(b.fighters[2].powerfulCooldown,1,"another enemy action reduces cooldown");
readyEnemy(b,2);
assert.equal(CombatCore.performActorAbility(b,"basic",0),true);
assert.equal(b.fighters[2].powerfulCooldown,0);

b=CombatCore.createBattle([ally("hero",200,10,100),enemy("foe",200,30,200)]);
CombatCore.advanceToPlayerTurn(b);
assert.ok(b.fighters[0].hp<200,"existing enemy AI still attacks first living ally");
assert.equal(b.events[0].abilityId,"basic");
assert.equal(b.events[0].actorId,"foe");
assert.equal(b.events[0].targetId,"hero");
assert.equal(b.allyActions,0);
assert.equal(b.currentActor,0,"enemy loop yields to player");
assert.match(b.message,/атакует hero: 30 урона/);
assert.equal(b.fighters[1].specialCooldown,0);

b=CombatCore.createBattle([ally("one",12,10,100),enemy("foe",200,40,200)]);
CombatCore.advanceToPlayerTurn(b);
assert.equal(b.active,false);
assert.equal(b.winner,"enemy");
assert.equal(b.allyActions,0);
assert.equal(b.events.at(-1).type,"battle-end");
assert.equal(CombatCore.performActorAbility(b,"basic",0),false);

b=CombatCore.createBattle([ally("hero",200,70,200),enemy("foe",25,10,100)],
 [[enemy("wave-2",20,3,100)]]);
CombatCore.advanceToPlayerTurn(b);
assert.equal(CombatCore.performPlayerAbility(b,"basic"),true);
assert.equal(b.wave,2);
assert.equal(b.active,true);
assert.equal(b.allyActions,1);
assert.equal(CombatCore.performPlayerAbility(b,"basic"),true);
assert.equal(b.winner,"ally");
assert.equal(b.active,false);

console.log("Combat-015C-A shared actor contract: both sides, target semantics, cooldowns, events, legacy enemy AI, wave and win/lose passed");
