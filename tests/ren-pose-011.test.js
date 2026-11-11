"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const idle=require("../ren-idle-kinemiq.js");
test("RENPOSE011: calm cadence, asymmetric shoulders, soft source seam, sparse glances",()=>{
 assert.ok(idle.PLAYBACK_RATE>=.4&&idle.PLAYBACK_RATE<=.7);
 assert.ok(idle.DURATION_MS/idle.PLAYBACK_RATE>=3500);
 assert.ok(idle.STANCE.shL.z<0&&idle.STANCE.shR.z>0);
 assert.notEqual(idle.STANCE.elL.x,idle.STANCE.elR.x);
 assert.ok(idle.seamWeight(0)<.000001);
 assert.ok(idle.seamWeight(1250)>.99);
 assert.ok(idle.seamWeight(idle.DURATION_MS-1)<.0001);
 assert.equal(idle.glance(0),0);
 assert.equal(idle.glance(10000),0);
 assert.ok(idle.glance(6500)>0);
 assert.ok(idle.glance(14500)<0);
 assert.ok(idle.glance(6500)<.12);
});
test("RENPOSE011: card owns slow pose, combat never uses it, version remains consistent",()=>{
 const card=fs.readFileSync("ren-card-3d.js","utf8"),combat=fs.readFileSync("ren-glb-runtime.js","utf8");
 const html=fs.readFileSync("index.html","utf8"),pkg=JSON.parse(fs.readFileSync("package.json","utf8"));
 assert.match(card,/if\(kinemiqIdle\)kinemiqIdle\(idleMs\)/);
 assert.doesNotMatch(combat,/RenKinemIQIdle/);
 assert.equal(pkg.version,"0.3.111");
 assert.ok(html.includes("v0.3.111 ·"));
 assert.ok(html.includes("RENPOSE011"));
 assert.ok(html.includes("ren-idle-kinemiq.js?v=0.3.111"));
});
