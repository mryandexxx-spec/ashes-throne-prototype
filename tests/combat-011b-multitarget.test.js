"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const src=["initiative-model.js","ability-data.js","combat-core.js","combat-log.js"]
  .map(name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8")).join("\n");
const {CombatCore:core,CombatLog:log}=vm.runInNewContext(src+"\n({CombatCore,CombatLog})");
const h=(id,side="ally",hp=100,atk=20,speed=300)=>({id,name:id,side,hp,atk,speed});
const enemy=(id,hp=100,atk=1)=>h(id,"enemy",hp,atk,10);
const make=(allies,enemies,waves=[])=>{
 const b=core.createBattle([...allies,...enemies],waves);
 core.advanceToPlayerTurn(b);
 return b;
};
const events=b=>Array.from(b.events);
const subset=(b,type)=>events(b).filter(e=>e.type===type);
let b=make([h("test-self-guard"),h("kael")],[enemy("first")]);
assert.equal(core.abilityTargetSide(b,"special"),"self");
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.fighters[0].guardHits,2);
assert.equal(b.fighters[1].guardHits,0);
assert.equal(b.fighters[0].specialCooldown,2);
assert.equal(b.allyActions,1);
assert.equal(subset(b,"ability")[0].targetId,"test-self-guard");
assert.equal(subset(b,"effect")[0].targetId,"test-self-guard");

b=make([h("test-team-heal"),h("kael"),h("lyra")],[enemy("first")]);
b.fighters[0].hp=80;
b.fighters[1].hp=50;
b.fighters[2].hp=0;
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.fighters[0].hp,100);
assert.equal(b.fighters[1].hp,80);
assert.equal(b.fighters[2].hp,0,"dead ally is not healed or revived");
assert.equal(subset(b,"heal").length,2);
assert.deepEqual(subset(b,"heal").map(e=>e.amount),[20,30]);
assert.equal(b.allyActions,1);
assert.equal(b.fighters[0].specialCooldown,2);

b=make([h("test-area-damage")],[enemy("e1",35),enemy("e2",50)]);
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.fighters[1].hp,15);
assert.equal(b.fighters[2].hp,30);
assert.equal(subset(b,"damage").length,2);
assert.equal(subset(b,"ability").length,1);
assert.deepEqual(Array.from(subset(b,"ability")[0].targetIds),["e1","e2"]);
assert.match(log.lines(b.events,b.fighters).join(" / "),/e2.*20 HP/);
assert.equal(b.allyActions,1);
assert.equal(b.fighters[0].specialCooldown,2);

b=make([h("test-area-weaken")],[enemy("guarded",100),enemy("other",100)]);
b.fighters[0].weakenAttacks=2;
b.fighters[1].guardHits=2;
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.fighters[1].hp,93,"20 -> weakened 14 -> guarded 7");
assert.equal(b.fighters[2].hp,86,"all recipients receive the same weakened 14");
assert.equal(b.fighters[1].guardHits,1,"each recipient spends its own protection");
assert.equal(b.fighters[0].weakenAttacks,1,"one group command consumes one weakened attack");
assert.equal(b.fighters[1].weakenAttacks,2);
assert.equal(b.fighters[2].weakenAttacks,2);
assert.equal(subset(b,"effect").length,2);

b=make([h("test-area-damage")],[enemy("one",10),enemy("two",10)],[[enemy("next",100)]]);
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.wave,2,"wave changes only after every target was hit");
assert.equal(b.winner,null);
assert.equal(subset(b,"damage").length,2);
assert.equal(subset(b,"death").length,2);
assert.equal(subset(b,"wave-start").length,1);
assert.equal(b.fighters[1].id,"next");
assert.equal(b.fighters[0].specialCooldown,2,"cooldown survives wave transition");

b=make([h("test-area-damage")],[enemy("one",10),enemy("two",10)]);
assert.equal(core.performPlayerAbility(b,"special"),true);
assert.equal(b.winner,"ally");
assert.equal(b.active,false);
assert.equal(subset(b,"death").length,2);
assert.equal(subset(b,"battle-end").length,1);
assert.equal(b.allyActions,1);
assert.equal(core.performPlayerAbility(b,"special"),false,"finished battle cannot be cast again");

b=make([h("test-area-damage")],[enemy("one",100)]);
b.fighters[1].hp=0;
const before=b.allyActions, oldEvents=b.events;
assert.equal(core.performPlayerAbility(b,"special"),false,"no living recipients means no action");
assert.equal(b.allyActions,before);
assert.equal(b.events,oldEvents,"invalid command does not reset event log");
assert.equal(b.fighters[0].specialCooldown,0);
assert.equal(core.performPlayerAbility(b,"powerful"),false);
const fresh=make([h("test-area-damage")],[enemy("one",100)]);
assert.equal(fresh.allyActions,0);
assert.equal(fresh.fighters[0].specialCooldown,0);

console.log("Combat-011B self/group casts, protection, weakening, cooldowns, events, death and waves passed");
