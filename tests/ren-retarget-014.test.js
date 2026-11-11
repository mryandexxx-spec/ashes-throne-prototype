"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const data=require("../ren-kinemiq-retarget-data.js"),retarget=require("../ren-motion-retarget.js");
test("RENRETARGET014: source curves are genuinely multi-joint and decode without truncation",()=>{
 assert.equal(data.bones.length,19);
 assert.equal(data.clips.relaxed.durationMs,2500);
 assert.ok(data.clips.talking.durationMs>2900);
 const relaxed=retarget.decodeClip(data.clips.relaxed,data.bones);
 const talking=retarget.decodeClip(data.clips.talking,data.bones);
 assert.equal(relaxed.coeffs.length,19*3*9);
 assert.equal(talking.coeffs.length,19*3*15);
 assert.ok(retarget.MAPPINGS.length>=8);
 for(const clip of [relaxed,talking]){
  for(let bone=0;bone<data.bones.length;bone++){
   for(const ms of [0,234,701,1234,2041,clip.durationMs]){
    const v=retarget.evaluate(clip,bone,ms);
    assert.equal(v.length,3);
    for(const x of v)assert.ok(Number.isFinite(x)&&Math.abs(x)<1,data.bones[bone]);
   }
   const a=retarget.evaluate(clip,bone,0),b=retarget.evaluate(clip,bone,clip.durationMs);
   for(let i=0;i<3;i++)assert.ok(Math.abs(a[i]-b[i])<1e-6,"clip seam");
  }
 }
});
test("RENRETARGET014: real Ren GLB has every target joint and no source toe/finger assumptions",()=>{
 const buffer=fs.readFileSync("assets/ren-wanderer-v1.glb");
 const gltf=JSON.parse(buffer.subarray(20,20+buffer.readUInt32LE(12)).toString("utf8"));
 const names=new Set(gltf.nodes.map(n=>n.name));
 const targets=[...new Set(retarget.MAPPINGS.map(m=>m[1]))];
 assert.deepEqual(targets.filter(name=>!names.has(name)),[]);
 assert.ok(!targets.some(name=>/neck|clavicle|finger|toe/i.test(name)),"missing source bones must be collapsed");
 assert.ok(!retarget.MAPPINGS.some(pair=>pair[1]==="root"),"never transfer root translation");
});
test("RENRETARGET014: rare body gesture fades and core combat is untouched",()=>{
 assert.equal(retarget.talkStrength(0),0);
 assert.equal(retarget.talkStrength(10500),0);
 assert.ok(retarget.talkStrength(12500)>.5);
 assert.equal(retarget.talkStrength(17000),0);
 assert.equal(retarget.talkStrength(26500),0);
 const card=fs.readFileSync("ren-card-3d.js","utf8");
 const game=fs.readFileSync("ren-glb-runtime.js","utf8");
 const html=fs.readFileSync("index.html","utf8");
 const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));
 assert.ok(card.includes("RenMotionRetarget.create(BABYLON,result.transformNodes)"));
 assert.ok(card.includes("if(retargetIdle)retargetIdle(idleMs)"));
 assert.ok(card.includes("else if(kinemiqIdle)kinemiqIdle(idleMs)"));
 assert.doesNotMatch(game,/RenMotionRetarget/);
 assert.ok(/^0\.3\.(?:11[5-9]|1[2-9]\d)$/.test(pkg.version));
 assert.ok(html.includes("v"+pkg.version+" ·"));
 assert.ok(html.includes("RENRETARGET014"));
 assert.ok(html.indexOf("ren-kinemiq-retarget-data.js?v=")<html.indexOf("ren-motion-retarget.js?v="));
 assert.ok(html.indexOf("ren-motion-retarget.js?v=")<html.indexOf("ren-card-3d.js?v="));
});
