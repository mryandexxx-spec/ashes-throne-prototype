"use strict";
/* LIORAANIM001 — Liora's shield clips play at readable speed in combat. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
global.AnimationProfiles=require("../animation-profiles.js");
const runtime=require("../liora-glb-runtime.js");
const P=global.AnimationProfiles;
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
// Clip lengths in dev/assets/models/liora-mobile-animated.glb, seconds.
function clipSeconds(){
 const r=fs.readFileSync(path.join(__dirname,"../dev/assets/models/liora-mobile-animated.glb"));
 const g=JSON.parse(r.subarray(20,20+r.readUInt32LE(12)).toString("utf8"));
 return Object.fromEntries(g.animations.map(a=>[a.name,Math.max(...a.samplers.map(s=>g.accessors[s.input].max[0]))]));
}
const SLOTS=["idle","basic","special","powerful","guard","ward","hit","death"];
test("LIORAANIM001: Liora has her own profile for every combat slot she animates",()=>{
 for(const slot of SLOTS)assert.ok(P.isCustom("liora",slot),slot);
});
test("LIORAANIM001: no Liora clip plays more than 2x faster than authored, none slower than 1x",()=>{
 const sec=clipSeconds();
 for(const slot of SLOTS){
  const clip=runtime.clipFor(slot),[w0,w1]=runtime.windowFor(slot);
  const shownMs=sec[clip]*(w1-w0)*1000,durationMs=P.resolve("liora",slot).durationMs;
  assert.ok(shownMs/durationMs<=2,`${slot}: ${clip} ${Math.round(shownMs)}ms squeezed into ${durationMs}ms`);
  assert.ok(shownMs/durationMs>=.95,`${slot}: ${clip} ${Math.round(shownMs)}ms stretched over ${durationMs}ms`);
 }
});
test("LIORAANIM001: self-guard abilities resolve to guard + ward, which play the block clip end to end",()=>{
 // Both of Liora's active abilities are kind:"guard" on herself (ability-data.js), so
 // BattleAnimation.enqueue maps them to the guard slot and queues a ward cue for the target.
 const abilities=read("ability-data.js");
 assert.match(abilities,/liora:Object\.freeze\(\{id:"special"[^}]*kind:"guard"/);
 assert.match(abilities,/liora:Object\.freeze\(\{id:"powerful"[^}]*kind:"guard"/);
 assert.equal(runtime.clipFor("guard"),"Liora_Shield_Block");
 assert.equal(runtime.clipFor("ward"),"Liora_Shield_Block");
 const [g0,g1]=runtime.windowFor("guard"),[w0,w1]=runtime.windowFor("ward");
 assert.equal(g0,0);assert.equal(g1,w0,"ward continues exactly where guard stops");assert.equal(w1,1);
 assert.ok(g1>=.5&&g1<=.6,"the shield is raised during the first ~55% of the clip");
 // The skinned body must not hop or tilt under the block clip.
 assert.equal(P.resolve("liora","guard").amplitude,0);
 assert.equal(P.resolve("liora","ward").amplitude,0);
});
test("LIORAANIM001: a guard turn lasts longer than a hit reaction and the basic bash keeps the melee approach",()=>{
 const guardMs=P.resolve("liora","guard").durationMs+P.resolve("liora","ward").durationMs;
 assert.ok(guardMs>=2000&&guardMs<=3500,"block raise + hold "+guardMs);
 assert.ok(P.resolve("liora","hit").durationMs>=600);
 assert.ok(P.resolve("liora","basic").durationMs>=1200);
 assert.equal(P.resolve("liora","basic").kind,"lunge");
 assert.ok(P.resolve("liora","basic").amplitude>0,"Liora is melee: keep the lunge toward the target");
 const game=read("game.js");
 assert.doesNotMatch(game,/h\.id==="liora"\?\{x:0,z:0\}/,"no archer-style no-approach exception for Liora");
});
test("LIORAANIM001: the shield workshop stops the loader's auto-played clip",()=>{
 const lab=read("liora-shield-lab.js");
 assert.match(lab,/groups=character\.animationGroups\.slice\(\);\s*\n[^\n]*\n[^\n]*\n\s*for\(const group of groups\)group\.stop\(\);/);
});
test("LIORAANIM001: build version and stage code",()=>{
 const pkg=JSON.parse(read("package.json"));
 assert.equal(pkg.version,"0.3.147");
 assert.match(read("index.html"),/id="buildVersion"[^>]*>Прототип · v0\.3\.147 · HUDSYNC001/);
});
