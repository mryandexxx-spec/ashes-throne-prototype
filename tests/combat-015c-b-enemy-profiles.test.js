"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const read=n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8");
const {CombatCore,EnemyDecision}=vm.runInNewContext(
 ["initiative-model.js","ability-data.js","combat-core.js","enemy-decision.js"].map(read).join("\n")+
 "\n({CombatCore,EnemyDecision})");
const hero=(id,hp=120,speed=100,atk=20)=>({id,name:id,side:"ally",hp,speed,atk});
const foe=(id,profile,hp=120,speed=200,atk=12)=>({
 id,name:id,side:"enemy",hp,speed,atk,...(profile?{aiProfile:profile}:{})
});
function battle(heroes,enemies){
 const b=CombatCore.createBattle([...heroes,...enemies]);
 return b;
}
function ready(b,index){
 b.currentActor=index;
 b.fighters[index].meter=1000;
}
function choose(b,index){
 const before=JSON.stringify(b);
 const result=EnemyDecision.chooseAction(b,index);
 assert.equal(JSON.stringify(b),before,"planner must be read-only");
 return result&&JSON.parse(JSON.stringify(result));
}
function action(b,index){
 const plan=choose(b,index);
 assert.ok(plan);
 assert.equal(CombatCore.performActorAbility(b,plan.abilityId,plan.targetIndex),true);
 return plan;
}
assert.deepEqual(Array.from(EnemyDecision.profiles),
 ["ordinary","aggressive","guardian","support","tactical"]);

let b=battle([hero("front",100),hero("weak",60)],[foe("ves","ordinary")]);
ready(b,2);
assert.deepEqual(choose(b,2),{abilityId:"basic",targetIndex:0});
b.fighters[0].hp=0;
assert.deepEqual(choose(b,2),{abilityId:"basic",targetIndex:1});
b.fighters[1].hp=0;
assert.equal(choose(b,2),null);

b=battle([hero("front",100),hero("weak",60)],[foe("ves","aggressive")]);
ready(b,2);
assert.deepEqual(choose(b,2),{abilityId:"basic",targetIndex:1},
 "aggressive selects lowest-current-HP target");
assert.equal(action(b,2).targetIndex,1);
assert.equal(b.fighters[1].hp,48);
assert.equal(b.fighters[0].hp,100);
assert.equal(b.allyActions,0);

b=battle([hero("front",100),hero("weak",60)],[foe("ves","tactical")]);
ready(b,2);
assert.equal(choose(b,2).targetIndex,1);

b=battle([hero("front")],[foe("test-self-guard","guardian",100)]);
ready(b,1);
b.fighters[1].hp=50;
assert.deepEqual(choose(b,1),{abilityId:"special",targetIndex:1});
action(b,1);
assert.equal(b.fighters[1].guardHits,2,"guardian guards itself when wounded");
assert.equal(b.fighters[1].specialCooldown,2);
ready(b,1);
assert.deepEqual(choose(b,1),{abilityId:"basic",targetIndex:0},
 "guard not repeated while active or on cooldown");
action(b,1);
assert.equal(b.fighters[1].specialCooldown,1,"cooldown ticks on other action");

b=battle([hero("front")],[foe("medic-demo","support",90),foe("other","ordinary",90)]);
ready(b,1);
b.fighters[2].hp=20;
assert.deepEqual(choose(b,1),{abilityId:"special",targetIndex:2},
 "single ally-targeting heal chooses wounded enemy teammate");
const hp=b.fighters[2].hp;
action(b,1);
assert.ok(b.fighters[2].hp>hp,"heals its own teammate, not player");
assert.equal(b.fighters[0].hp,120);

b=battle([hero("front")],[foe("test-team-heal","support",90),foe("wounded","ordinary",90)]);
ready(b,1);
b.fighters[1].hp=40;
b.fighters[2].hp=50;
assert.equal(choose(b,1).abilityId,"special","AOE heal with multiple wounds");
action(b,1);
assert.ok(b.fighters[1].hp>40&&b.fighters[2].hp>50);
assert.equal(b.allyActions,0);

b=battle([hero("front",120),hero("rear",120)],[foe("test-area-damage","aggressive",100)]);
ready(b,2);
assert.equal(choose(b,2).abilityId,"special","aggressive uses AOE against multiple living heroes");
action(b,2);
assert.ok(b.fighters[0].hp<120&&b.fighters[1].hp<120);

b=battle([hero("front",120),hero("rear",120)],[foe("test-area-damage","tactical",100)]);
ready(b,2);
assert.equal(choose(b,2).abilityId,"special");
b.fighters[0].hp=0;
assert.equal(choose(b,2).abilityId,"powerful","single target powerful is preferable to neutral AOE");
assert.equal(choose(b,2).targetIndex,1);

b=battle([hero("front",120),hero("rear",50)],[foe("lyra","aggressive",100)]);
ready(b,2);
assert.equal(choose(b,2).abilityId,"powerful","stronger tactical mark preferred");
b.fighters[2].powerfulCooldown=2;
assert.equal(choose(b,2).abilityId,"special","weaken when powerful on cooldown");
action(b,2);
assert.ok(b.fighters[1].weakenAttacks>0);
assert.equal(b.fighters[2].specialCooldown,2);

b=battle([hero("front")],[foe("test-self-guard","invalid")]);
ready(b,1);
assert.deepEqual(choose(b,1),{abilityId:"basic",targetIndex:0},
 "unknown profiles inherit the aggressive policy");

b=battle([hero("front",200,100,10),hero("weak",50,100,10)],[foe("ves",null,200,220,12)]);
CombatCore.advanceToPlayerTurn(b);
assert.equal(b.events[0].targetId,"weak","every unconfigured enemy uses weakest-target policy");
assert.equal(b.events[0].abilityId,"basic");

b=battle([hero("front",200,100,10),hero("weak",50,100,10)],[foe("ves","aggressive",200,220,12)]);
CombatCore.advanceToPlayerTurn(b);
assert.equal(b.events[0].targetId,"weak","opt-in tactical profile is used in turn loop");
assert.equal(b.allyActions,0);
assert.equal(b.currentActor,0);

b=battle([hero("front",200,100,10)],[foe("test-self-guard","guardian",100,220,12)]);
b.fighters[1].hp=50;
CombatCore.advanceToPlayerTurn(b);
assert.equal(b.events[0].abilityId,"special","turn loop executes guard via shared engine");
assert.equal(b.fighters[1].guardHits,2);
assert.equal(b.allyActions,0);

b=battle([hero("front",200,100,10),hero("weak",45,100,10)],[foe("ves","bogus",100,220,12)]);
CombatCore.advanceToPlayerTurn(b);
assert.equal(b.events[0].abilityId,"basic","unknown profile uses universal policy");
assert.equal(b.events[0].targetId,"weak");

b=battle([hero("front",8,100,10)],[foe("ves","aggressive",200,220,30)]);
CombatCore.advanceToPlayerTurn(b);
assert.equal(b.active,false);
assert.equal(b.winner,"enemy");
assert.equal(b.events.at(-1).type,"battle-end");

const html=read("index.html");
const scripts=[...html.matchAll(/<script src="([^"]+)"/g)].map(x=>x[1]);
assert.ok(scripts.indexOf("combat-core.js")<scripts.indexOf("enemy-decision.js"));
assert.ok(scripts.indexOf("enemy-decision.js")<scripts.indexOf("game.js"));
assert.match(html,/v0[.]3[.]86 · OPSHELP/);
assert.equal(JSON.parse(read("package.json")).version,"0.3.86");
console.log("Combat-015C-B enemy tactical profiles, live turns, AOE/heal/guard/weaken, fallback and version passed");
