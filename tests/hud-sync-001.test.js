"use strict";
/* HUDSYNC001 — HP shown in the HUD waits for the blow to be drawn. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
function load(){
 return vm.runInNewContext(["battle-speed.js","animation-profiles.js","battle-animation.js"]
  .map(read).join("\n")+"\n({AnimationProfiles,BattleAnimation})");
}
const snapshot=()=>[
 {id:"hero",side:"ally",hp:100,maxHp:100,protection:30,maxProtection:30},
 {id:"foe",side:"enemy",hp:80,maxHp:80,protection:20,maxProtection:20},
 {id:"foe2",side:"enemy",hp:60,maxHp:60}
];
const live=(fighters,id,patch)=>Object.assign(fighters.find(f=>f.id===id),patch);
// tick() caps one step at 100ms (tab wake-up guard), so advance in small steps.
const advance=(m,ms)=>{for(let t=0;t<ms;t+=10)m.tick(Math.min(10,ms-t));};
test("HUDSYNC001: a hit holds the target's HP until its reaction starts, then snaps to the event value",()=>{
 const {BattleAnimation:m}=load();
 const before=snapshot(),now=snapshot();
 live(now,"foe",{hp:70,protection:12});
 m.enqueue([
  {type:"ability",actorId:"hero",targetId:"foe",abilityId:"basic"},
  {type:"damage",actorId:"hero",targetId:"foe",amount:18,remainingHp:70,remainingProtection:12}
 ],{},before);
 const foe=now.find(f=>f.id==="foe");
 assert.deepEqual({...m.displayed(foe)},{hp:80,protection:20},"nothing drawn yet: pre-action values");
 advance(m,150); // template lunge is 200ms: still swinging
 assert.equal(m.displayed(foe).hp,80);
 const r0=m.displayRevision();
 advance(m,60); // attack finished, hit cue begins
 assert.deepEqual({...m.displayed(foe)},{hp:70,protection:12});
 assert.notEqual(m.displayRevision(),r0,"HUD is told to redraw when the number changes");
 advance(m,1000);
 assert.equal(m.pending(),0);
 live(now,"foe",{hp:65});
 assert.equal(m.displayed(foe).hp,65,"override is dropped once every pending blow was shown");
});
test("HUDSYNC001: several blows on one target in a batch step the HUD down one at a time",()=>{
 const {BattleAnimation:m}=load();
 const before=snapshot(),now=snapshot();
 live(now,"hero",{hp:40});
 m.enqueue([
  {type:"ability",actorId:"foe",targetId:"hero",abilityId:"basic"},
  {type:"damage",actorId:"foe",targetId:"hero",amount:30,remainingHp:70},
  {type:"ability",actorId:"foe2",targetId:"hero",abilityId:"basic"},
  {type:"damage",actorId:"foe2",targetId:"hero",amount:30,remainingHp:40}
 ],{},before);
 const hero=now.find(f=>f.id==="hero");
 assert.equal(m.displayed(hero).hp,100);
 advance(m,210);assert.equal(m.displayed(hero).hp,70,"first hit drawn");
 advance(m,120);assert.equal(m.displayed(hero).hp,70,"second attacker still swinging");
 advance(m,210);assert.equal(m.displayed(hero).hp,40,"second hit drawn");
 assert.equal(m.displayed(hero).protection,30,"legacy damage leaves protection untouched");
});
test("HUDSYNC001: a heal also waits for its cue; killing blows show 0 before the death clip",()=>{
 const {BattleAnimation:m}=load();
 const before=snapshot(),now=snapshot();
 live(now,"hero",{hp:100});live(now,"foe",{hp:0});
 m.enqueue([
  {type:"ability",actorId:"hero",targetId:"hero",abilityId:"special"},
  {type:"heal",actorId:"hero",targetId:"hero",amount:0,remainingHp:100},
  {type:"ability",actorId:"foe2",targetId:"foe",abilityId:"basic"},
  {type:"damage",actorId:"foe2",targetId:"foe",amount:80,remainingHp:0},
  {type:"death",targetId:"foe"}
 ],{},before.map(f=>f.id==="hero"?{...f,hp:60}:f));
 const hero=now.find(f=>f.id==="hero"),foe=now.find(f=>f.id==="foe");
 assert.equal(m.displayed(hero).hp,60,"pre-heal value from the snapshot");
 advance(m,195);assert.equal(m.displayed(hero).hp,100,"ward cue started: healed value");
 assert.equal(m.displayed(foe).hp,80);
 advance(m,150);advance(m,210);
 assert.equal(m.displayed(foe).hp,0,"killing blow drawn");
 assert.ok(m.isDying("foe"),"death clip still to play");
});
test("HUDSYNC001: without a snapshot nothing is held back (legacy callers see real values)",()=>{
 const {BattleAnimation:m}=load();
 const now=snapshot();live(now,"foe",{hp:70});
 m.enqueue([{type:"ability",actorId:"hero",targetId:"foe",abilityId:"basic"},
  {type:"damage",actorId:"hero",targetId:"foe",amount:10,remainingHp:70}]);
 assert.equal(m.displayed(now.find(f=>f.id==="foe")).hp,70);
 assert.equal(m.pending(),2,"queue shape unchanged for template fighters");
});
test("HUDSYNC001: clear() drops every held value",()=>{
 const {BattleAnimation:m}=load();
 const before=snapshot(),now=snapshot();live(now,"foe",{hp:70});
 m.enqueue([{type:"ability",actorId:"hero",targetId:"foe",abilityId:"basic"},
  {type:"damage",actorId:"hero",targetId:"foe",amount:10,remainingHp:70}],{},before);
 assert.equal(m.displayed(now.find(f=>f.id==="foe")).hp,80);
 m.clear();
 assert.equal(m.displayed(now.find(f=>f.id==="foe")).hp,70);
});
test("HUDSYNC001: Liora's bash lands mid-clip — reaction and HUD move at the contact moment",()=>{
 const {AnimationProfiles:P,BattleAnimation:m}=load();
 const basic=P.resolve("liora","basic");
 assert.equal(basic.contactFraction,.5);
 const before=snapshot(),now=snapshot();live(now,"foe",{hp:70});
 m.enqueue([{type:"ability",actorId:"liora",targetId:"foe",abilityId:"basic"},
  {type:"damage",actorId:"liora",targetId:"foe",amount:10,remainingHp:70},
  {type:"damage",actorId:"liora",targetId:"foe2",amount:10,remainingHp:50}],{},before);
 assert.equal(m.pending(),1,"reactions ride on the attack instead of queueing after it");
 const foe=now.find(f=>f.id==="foe");
 advance(m,700);
 assert.equal(m.displayed(foe).hp,80);
 assert.equal(m.activity("foe").slot,"idle");
 advance(m,60); // 760ms: past 50% of 1500ms
 assert.equal(m.displayed(foe).hp,70,"HUD advances at contact, not at the end of the swing");
 assert.equal(m.activity("foe").slot,"hit","target flinches while Liora is still in the thrust");
 assert.equal(m.activity("foe2").slot,"hit","group targets react together");
 assert.equal(m.activity("liora").slot,"basic");
 assert.ok(m.pose("foe").x<0,"capsule knock-back pose for the reacting target");
 advance(m,800);
 assert.equal(m.pending(),0);
});
test("HUDSYNC001: Ren's choreography keeps its own contact moment",()=>{
 const game=read("game.js");
 const src=["battle-speed.js","animation-profiles.js","ren-choreography.js","battle-animation.js"].map(read).join("\n");
 const {BattleAnimation:m}=vm.runInNewContext(src+"\n({BattleAnimation})");
 const positions={ren:{x:-3,z:0,choreographyReady:true},foe:{x:3,z:0}};
 m.enqueue([{type:"ability",actorId:"ren",targetId:"foe",abilityId:"basic"},
  {type:"damage",actorId:"ren",targetId:"foe",amount:10,remainingHp:70}],positions,snapshot());
 assert.equal(m.pending(),1);
 const plan=m.activity("ren").plan||(m.tick(1),m.activity("ren").plan);
 assert.ok(plan&&Number.isFinite(plan.contactMs));
 const foe={id:"foe",hp:70};
 advance(m,plan.contactMs-5);assert.equal(m.displayed(foe).hp,80);
 advance(m,10);assert.equal(m.displayed(foe).hp,70);
 assert.match(game,/BattleAnimation\.enqueue\(state\.events,positions,beforeFighters\|\|null\)/);
});
test("HUDSYNC001: the HUD draws displayed values and redraws when they change",()=>{
 const game=read("game.js");
 assert.match(game,/const view=BattleAnimation\.displayed\(h\);\s*\n\s*const health=Math\.min\(100,Math\.max\(0,view\.hp/);
 assert.match(game,/title="HP \$\{Math\.max\(0,view\.hp\)\}/);
 assert.match(game,/const view=BattleAnimation\.displayed\(target\);\s*\n\s*hp\.textContent="HP "\+Math\.max\(0,view\.hp\)/);
 assert.match(game,/BattleAnimation\.displayRevision\(\)!==hudDisplayRevision/);
 assert.match(game,/if\(landed\)renderTargetFighterHud\(\);/);
 assert.doesNotMatch(game,/arena-health" title="HP \$\{Math\.max\(0,h\.hp\)\}/);
});
