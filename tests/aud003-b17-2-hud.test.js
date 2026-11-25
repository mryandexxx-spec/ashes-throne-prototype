"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
const files=["initiative-model.js","ability-data.js","battle-rng.js","combat-status-core.js","combat-core.js","auto-decision.js","enemy-decision.js","npc-enemy-data.js","gear-data.js","hero-stats-core.js","hero-stats-profiles.js","hero-stats-combat-bridge.js","progress-core.js","skill-core.js","star-core.js","progress-v3-core.js","arena-ui-003.js","combat-2-hud/model.js"];
const source=files.map(f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8")).join("\n");
const {H,C,A}=vm.runInNewContext(source+"\n({H:Combat2HUD,C:CombatCore,A:ArenaUI003})");
test("all fifteen native presets complete; read-only queue and valid auto",()=>{
 let actions=0;
 for(const tier of Object.keys(H.tiers))for(const preset of Object.keys(H.presets)){
  const b=H.makeBattle({tier,preset,seed:7}),s=H.create(b);assert.equal(b.combat2,true);
  while(b.active&&b.allyActions<240){
   const snapshot=JSON.stringify(b);assert.ok(A.forecast(b,6,{speedOf:f=>C.effectiveStat(b,f,"speed")}).length);assert.equal(JSON.stringify(b),snapshot);
   assert.ok(s.auto(),tier+" "+preset);
  }
  assert.equal(b.active,false,tier+" "+preset);actions+=b.allyActions;
 }
 assert.equal(actions,335);
});
test("helper selection and cancellation are read-only until explicit confirmation",()=>{
 const b=H.makeBattle({preset:"tempo",seed:7}),s=H.create(b);
 for(let i=0;i<20&&b.active&&(s.actor().id!=="sava"||!s.info("powerful").ready);i++)assert.ok(s.auto());
 assert.equal(s.actor().id,"sava");assert.ok(s.info("powerful").ready);
 const snapshot=JSON.stringify(b);assert.ok(s.skill("powerful"));assert.equal(s.pending,"powerful");assert.equal(s.preview().ok,false);assert.equal(s.confirm(),false);
 assert.equal(s.select("sava"),false);assert.ok(s.select("ren"));assert.ok(s.preview().ok);assert.equal(JSON.stringify(b),snapshot);
 s.cancel();assert.equal(s.pending,null);assert.equal(s.ally,null);assert.equal(JSON.stringify(b),snapshot);
 assert.ok(s.skill("powerful"));assert.ok(s.select("ren"));assert.ok(s.confirm());assert.equal(s.pending,null);assert.equal(b.allyActions,JSON.parse(snapshot).allyActions+1);
 assert.ok(b.events.some(e=>e.type==="damage"&&e.assist)||b.events.some(e=>e.type==="miss"&&e.assist)||b.events.some(e=>e.type==="death"));
});
test("signal preview does not consume an action and zero gain cannot confirm",()=>{
 const b=H.makeBattle({preset:"tempo",seed:7}),s=H.create(b);
 const ren=b.fighters.find(f=>f.id==="ren"),sava=b.fighters.find(f=>f.id==="sava");
 b.fighters.forEach(f=>f.meter=0);sava.meter=1000;ren.meter=600;b.currentActor=b.fighters.indexOf(sava);
 assert.ok(s.skill("special"));assert.ok(s.select("ren"));
 const before=JSON.stringify(b);assert.equal(s.preview().forecast.gain,250);assert.equal(JSON.stringify(b),before);
 ren.meter=1000;const ready=JSON.stringify(b);assert.equal(s.preview().ok,false);assert.equal(s.confirm(),false);assert.equal(JSON.stringify(b),ready);
 s.cancel();assert.equal(s.pending,null);
});
