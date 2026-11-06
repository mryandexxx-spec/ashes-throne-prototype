"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"..");
const api=vm.runInNewContext(["battle-speed.js","animation-profiles.js","battle-animation.js"]
 .map(n=>fs.readFileSync(path.join(root,n),"utf8")).join("\n")+
 "\n({BattleSpeed,AnimationProfiles,BattleAnimation})");
const {BattleSpeed:speed,AnimationProfiles:profiles,BattleAnimation:motion}=api;
const hit=(actorId,targetId)=>[
 {type:"ability",actorId,targetId,abilityId:"basic"},
 {type:"damage",actorId,targetId,amount:10}
];
const guard=[
 {type:"ability",actorId:"hero",targetId:"ally",abilityId:"special"},
 {type:"effect",actorId:"hero",targetId:"ally",effect:"guard"}
];
assert.equal(profiles.resolve("hero","idle").kind,"idle");
assert.equal(profiles.resolve("hero","death").kind,"death");
assert.equal(profiles.resolve("hero","powerful").kind,"lunge","future action types have template slots");
assert.equal(profiles.isCustom("hero","guard"),false);
profiles.register("hero",{guard:{kind:"guard",durationMs:480,amplitude:.5}});
assert.equal(profiles.isCustom("hero","guard"),true);
assert.equal(profiles.resolve("hero","guard").durationMs,480);
assert.equal(profiles.resolve("hero","basic").durationMs,200,"missing slot has template");
assert.equal(profiles.resolve("enemy","guard").durationMs,190,"different fighter has template");
assert.throws(()=>profiles.register("bad",{basic:{kind:"unknown",durationMs:1,amplitude:1}}));
assert.equal(profiles.resolve("bad","basic").durationMs,200,"invalid profile cannot replace template");
profiles.register("other",{
 idle:{kind:"idle",durationMs:900,amplitude:.12,assetId:"future-other-model",clipName:"idle_loop"},
 death:{kind:"death",durationMs:600,amplitude:1.1}
});
assert.equal(profiles.resolve("other","idle").clipName,"idle_loop","future animation asset reference can be stored");
assert.equal(profiles.resolve("other","death").durationMs,600,"individual death can override fallback");
assert.equal(profiles.resolve("other","guard").durationMs,190,"unimplemented guard still uses template");
assert.equal(profiles.isCustom("hero","idle"),false,"one character override does not change another");
assert.throws(()=>profiles.register("broken",{idle:{kind:"idle",durationMs:100,amplitude:.1,assetId:"missing-clip"}}));

motion.tick(300,1);
assert.notEqual(motion.pose("hero").y,0,"idle animation runs without combat events");
motion.clear();
motion.enqueue(guard);
assert.equal(motion.pending(),2,"defense animates both caster and protected target");
motion.tick(120,1);
assert.ok(motion.pose("hero").y>0,"custom guard raises the actor");
assert.equal(motion.pose("ally").x,0,"defense never lunges at friendly target");
motion.tick(100,4);
assert.ok(motion.pose("ally").y>0,"guard effect shows a separate ward on the target");
motion.clear();
motion.enqueue(hit("hero","enemy"));
assert.equal(motion.pending(),2,"ability and reaction each get an animation slot");
motion.tick(100,1);
const at100=motion.pose("hero").x;
assert.ok(at100>0,"template attack moves actor");
motion.clear();
motion.enqueue(hit("hero","enemy"));
speed.set(4);
motion.tick(25,speed.multiplier());
assert.equal(motion.pose("hero").x,at100,"4x and 1x use the same presentation progression");
motion.tick(45,speed.multiplier());
assert.equal(motion.pending(),1,"4x finishes attack in 70ms, reaction remains");
motion.tick(58,speed.multiplier());
assert.equal(motion.pending(),0,"reaction completes at shared 4x speed");
speed.reset();
motion.clear();
motion.enqueue([{type:"damage",actorId:"hero",targetId:"enemy",amount:10},
 {type:"death",targetId:"enemy"}]);
assert.equal(motion.isDying("enemy"),true,"dead fighter remains visible for its death animation");
motion.tick(100,1);
assert.equal(motion.pending(),2);
motion.tick(100,1);
motion.tick(100,1);
assert.ok(motion.pose("enemy").y<0,"death animation lowers body");
assert.equal(motion.isDying("enemy"),true);
for(let i=0;i<10;i++)motion.tick(100,4);
assert.equal(motion.pending(),0);
assert.equal(motion.isDying("enemy"),false,"dead model can be hidden after animation");
motion.clear();
motion.enqueue(hit("hero","enemy"));
motion.tick(10,NaN);
assert.equal(motion.pending(),2);
motion.tick(-10,1);
assert.equal(motion.pose("hero").x,0);
motion.clear();
assert.equal(motion.pending(),0,"battle exit/reset clears animations");
assert.equal(motion.isDying("enemy"),false);
console.log("Combat-005 animation: per-fighter fallback, idle, guard, hit, death and speed scaling passed");
