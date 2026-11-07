"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const source=["initiative-model.js","ability-data.js","combat-core.js","auto-decision.js"]
  .map(read).join("\n")+"\n({CombatCore,AutoDecision})";
const {CombatCore,AutoDecision}=vm.runInNewContext(source);
const ally=(id,hp=100,speed=250,atk=30)=>({id,name:id,side:"ally",hp,speed,atk});
const enemy=(id,hp=150,speed=100)=>({id,name:id,side:"enemy",hp,speed,atk:1});
function start(heroes,foes,waves=[]){
 const b=CombatCore.createBattle([...heroes,...foes],waves);
 CombatCore.advanceToPlayerTurn(b);
 return b;
}
function step(b){
 const plan=AutoDecision.chooseAction(b);
 assert.ok(plan,"ready ally must have an action");
 const before=b.allyActions;
 assert.equal(CombatCore.performAutoAction(b,plan),true);
 assert.equal(b.allyActions,before+1,"exactly one ally action");
 return {plan,event:b.events.find(e=>e.type==="ability")};
}
let b=start([ally("medic-demo"),ally("lyra")],[enemy("target")]);
b.fighters[1].hp=20;
let s=step(b);
assert.equal(s.plan.abilityId,"special","heal is chosen");
assert.equal(s.plan.targetIndex,1);
assert.equal(s.event.targetId,"lyra","selectedAlly is applied before execution");
assert.ok(b.fighters[1].hp>20,"ally heals");
assert.equal(b.fighters[0].specialCooldown,2);
assert.equal(b.allyActions,1);

b=start([ally("medic-demo"),ally("lyra")],[enemy("target")]);
b.fighters[0].hp=40;
b.fighters[1].hp=20;
s=step(b);
assert.equal(s.plan.abilityId,"powerful","group healing is preferred for two wounds");
assert.ok(b.fighters[0].hp>40&&b.fighters[1].hp>20,"group healing applies to both");
assert.equal(b.fighters[0].powerfulCooldown,2);
assert.equal(b.allyActions,1);

b=start([ally("kael",120)],[enemy("target")]);
b.fighters[0].hp=50;
s=step(b);
assert.equal(s.plan.abilityId,"special","protect endangered ally");
assert.equal(b.fighters[0].guardHits,2,"guard is applied");
assert.equal(s.event.abilityId,"special");
const remaining=b.fighters[0].guardHits;
if(b.active&&b.fighters[b.currentActor]?.id==="kael"){
 const next=AutoDecision.chooseAction(b);
 assert.notEqual(next?.abilityId,"special","existing guard should not be reapplied");
}
assert.ok(remaining>0);

b=start([ally("test-area-damage")],[enemy("a",150),enemy("b",100)]);
s=step(b);
assert.equal(s.plan.abilityId,"special");
assert.equal(s.event.abilityId,"special");
assert.ok(b.fighters[1].hp<150&&b.fighters[2].hp<100,"group hit damages both");
assert.equal(b.allyActions,1);

b=start([ally("darin")],[enemy("a",100),enemy("b",60)]);
b.selectedEnemy=1;
s=step(b);
assert.equal(s.plan.abilityId,"powerful");
assert.equal(s.plan.targetIndex,2,"AI must replace previous target with weakest");
assert.equal(s.event.targetId,"b");
assert.equal(b.fighters[1].hp,100,"unselected enemy untouched");

b=start([ally("lyra")],[enemy("a",200),enemy("b",140)]);
b.fighters[0].powerfulCooldown=2;
s=step(b);
assert.equal(s.plan.abilityId,"special");
assert.equal(s.event.targetId,"b");
assert.ok(b.fighters[2].weakenAttacks>0,"weakening resolves through the normal core");

b=start([ally("unknown")],[enemy("a",100),enemy("b",80)]);
assert.equal(CombatCore.performAutoAction(b,{abilityId:"powerful",targetIndex:999}),true,
 "invalid plan falls back to basic");
assert.equal(b.events.find(e=>e.type==="ability").abilityId,"basic");

b=start([ally("unknown")],[enemy("a")]);
assert.equal(CombatCore.performAutoAction(b),true,"Combat-004 API remains compatible");
assert.equal(b.events.find(e=>e.type==="ability").abilityId,"basic");

b=start([ally("darin",100,300,35)],[enemy("first",15)],[[enemy("second",15),enemy("third",15)]]);
const firstWave=step(b);
assert.equal(b.wave,2,"wave advances after combat resolution");
assert.equal(b.active,true);
assert.ok(b.events.some(e=>e.type==="wave-start"));
let turns=0;
while(b.active&&turns++<40)step(b);
assert.ok(turns<40,"autoplay terminates through multiple waves");
assert.equal(b.winner,"ally");
assert.equal(CombatCore.performAutoAction(b,AutoDecision.chooseAction(b)),false);

const index=read("index.html");
const scripts=[...index.matchAll(/<script src="([^"]+)"/g)].map(match=>match[1]);
assert.ok(scripts.indexOf("combat-core.js")<scripts.indexOf("auto-decision.js"));
assert.ok(scripts.indexOf("auto-decision.js")<scripts.indexOf("game.js"));
assert.match(index,/id="buildVersion"[^>]*>[^<]*v0\.3\.32 · CBA015E/);
assert.equal(JSON.parse(read("package.json")).version,"0.3.32");
const game=read("game.js");
assert.match(game,/const plan=AutoDecision\.chooseAction\(state\)/);
assert.match(game,/CombatCore\.performAutoAction\(state,plan\)/);
assert.match(game,/if\(isVisualTransition\(\)\|\|!autoBattle\|\|!state\.active\|\|document\.hidden/);
console.log("Combat-015B tactical execution, cooldowns, targets, AOE, waves, legacy auto and version passed");
