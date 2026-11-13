"use strict";
/* RENRETREAT001 — Ren runs back after the strike instead of a long backwards walk. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const C=require("../ren-choreography.js");
test("RENRETREAT001: return trip takes about as long as the approach, not 3x longer",()=>{
 C.calibrate(1.24);
 for(const d of [5,7.4,9.05]){
  const p=C.plan(d);
  assert.ok(p.retreatMs<p.approachMs*1.25,`${d}m: retreat ${Math.round(p.retreatMs)}ms vs approach ${Math.round(p.approachMs)}ms`);
  assert.ok(p.durationMs<5000,`${d}m: whole action ${Math.round(p.durationMs)}ms`);
 }
});
test("RENRETREAT001: pivots away, runs forward with the Running clip, pivots back to the enemy",()=>{
 C.calibrate(1.24);const p=C.plan(7.4);
 assert.equal(C.sample(p,p.attackEnd-1).heading,0,"faces the enemy through the whole strike");
 assert.equal(C.sample(p,p.contactMs).heading,0);
 const mid=C.sample(p,p.retreatStart+p.retreatMs/2);
 assert.equal(mid.phase,"retreat");assert.equal(mid.a.name,"Running");
 assert.ok(Math.abs(Math.abs(mid.heading)-Math.PI)<.05,"runs facing home");
 const end=C.sample(p,p.durationMs);
 assert.ok(Math.abs(end.heading)<1e-12);assert.equal(end.forward,0);assert.equal(end.b.name,"Idle_4");assert.equal(end.weight,1);
 let prev=C.sample(p,0);
 for(let t=5;t<=p.durationMs;t+=5){const s=C.sample(p,t);
  assert.ok(Math.abs(s.heading-prev.heading)<.12,"no yaw snap at "+t);prev=s;}
});
test("RENRETREAT001: run cycle follows covered distance (no foot sliding) and strike timing is untouched",()=>{
 C.calibrate(1);const p=C.plan(6),t=p.retreatStart+p.retreatMs*.6,s=C.sample(p,t);
 const covered=p.retreatDistance-Math.hypot(s.forward,s.lateral);
 const cycles=covered/C.SOURCE.runStrideSpeed/(C.SOURCE.runMs/1000);
 assert.ok(Math.abs(s.a.progress-(cycles%1))<1e-6);
 assert.ok(Math.abs(p.attackEnd-p.attackStart-1000)<1e-9);
 assert.ok(Math.abs(p.contactMs-p.attackStart-37/60*1000)<1e-9);
});
test("RENRETREAT001: target already in reach keeps the short recover without pivots",()=>{
 C.calibrate(1);const p=C.plan(.5);
 assert.equal(p.travel,0);assert.equal(p.pivotMs,0);
 for(let t=0;t<=p.durationMs;t+=20)assert.ok(Math.abs(C.sample(p,t).heading)<1e-12);
});
test("RENRETREAT001: game and lab apply the heading to the body anchor",()=>{
 const read=f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8");
 assert.match(read("game.js"),/RenChoreography\.sample\(activity\.plan,activity\.elapsedMs\)\.heading/);
 assert.match(read("ren-combat-lab.js"),/phase\.heading/);
});
