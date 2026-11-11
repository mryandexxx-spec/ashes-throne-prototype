"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const Runtime=require("../ren-glb-runtime.js");
const scripts=["battle-speed.js","animation-profiles.js","battle-animation.js"]
 .map(file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8")).join("\n");
const {Profiles,Battle}=vm.runInNewContext(scripts+"\n({Profiles:AnimationProfiles,Battle:BattleAnimation})");

test("RENPACE018: x1 timings are readable and native Idle_4 runs at its own cadence",()=>{
 const expected={idle:14000,basic:1350,special:1500,powerful:1650,hit:650,death:1850};
 for(const [slot,ms] of Object.entries(expected))
  assert.equal(Profiles.resolve("ren",slot).durationMs,ms,slot);
 assert.equal(Profiles.resolve("kael","basic").durationMs,200);
 assert.equal(Profiles.resolve("shade","hit").durationMs,120);
 assert.equal(Profiles.resolve("kael","death").durationMs,400);
});
test("RENPACE018: x1/x2/x4 share the same motion curve without skipping actions",()=>{
 for(const multiplier of [1,2,4]){
  Battle.clear();
  Battle.enqueue([{type:"ability",actorId:"ren",targetId:"shade",abilityId:"basic"}]);
  const quarter=1350/4/multiplier;
  for(let i=0;i<Math.ceil(quarter/100);i++){
   const ms=Math.min(100,quarter-i*100);
   Battle.tick(ms,multiplier);
  }
  assert.ok(Math.abs(Battle.activity("ren").progress-.25)<.00001,"attack quarter at "+multiplier+"x");
  Battle.clear();
  assert.equal(Battle.activity("ren").slot,"idle","reset restores idle");
 }
});
test("RENPACE018: short defensive cues cannot play 14 seconds of idle in an instant",()=>{
 assert.equal(Runtime.clipProgress("idle",.5),.5);
 for(const slot of ["passive","leader","guard","ward"]){
  assert.equal(Runtime.clipFor(slot),"Idle_4");
  assert.equal(Runtime.clipProgress(slot,.75),0,slot);
 }
 assert.equal(Runtime.clipProgress("basic",.75),.75);
 assert.equal(Runtime.clipProgress("death",1),1);
 assert.equal(Runtime.clipProgress("idle",NaN),0);
});
