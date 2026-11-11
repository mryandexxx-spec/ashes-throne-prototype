"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const idle=require("../ren-idle-kinemiq.js");
test("RENSTANCE012: deliberately readable silhouette instead of sub-5-degree changes",()=>{
 const p=idle.STANCE;
 assert.ok(Math.abs(p.shL.z)>=.14);
 assert.ok(Math.abs(p.shR.z)>=.12);
 assert.ok(Math.abs(p.elL.x)>=.2);
 assert.ok(Math.abs(p.hipL.z)>=.08&&Math.abs(p.hipR.z)>=.07);
 assert.ok(p.hipL.x*p.hipR.x<0,"one leg forward, one back");
 assert.ok(p.ankL.z*p.hipL.z<0&&p.ankR.z*p.hipR.z<0,"ankles counter thigh roll");
 assert.ok(idle.PLAYBACK_RATE<=.55,"base movement slower than before");
});
test("RENSTANCE012: real GLB contains all articulated stance joints",()=>{
 const bytes=fs.readFileSync("assets/ren-wanderer-v1.glb");
 assert.equal(bytes.toString("ascii",0,4),"glTF");
 const gltf=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString("utf8"));
 const nodes=new Set(gltf.nodes.map(n=>n.name));
 const missing=Object.keys(idle.STANCE).filter(name=>!nodes.has(name));
 assert.deepEqual(missing,[],"all natural stance joints must exist in production GLB");
});
test("RENSTANCE012: build and browser include new stance",()=>{
 const html=fs.readFileSync("index.html","utf8");
 const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));
 assert.equal(pkg.version,"0.3.112");
 assert.ok(html.includes("v0.3.112 ·"));
 assert.ok(html.includes("RENSTANCE012"));
 assert.ok(html.includes("ren-idle-kinemiq.js?v=0.3.112"));
});
