"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const idle=require("../ren-idle-kinemiq.js");
test("RENSTANCE013: upright stance corrects bent-knee and crotch-hand pose",()=>{
 const p=idle.STANCE;
 for(const leg of ["hipL","hipR","kneeL","kneeR","ankL","ankR"])
  assert.equal(p[leg],undefined,"do not rotate "+leg+" in card pose");
 for(const arm of ["shL","shR","elL","elR"])
  assert.ok(Math.abs(p[arm].x)<.04,"do not force "+arm+" into front-clasp");
 assert.ok(p.shL.z<0&&p.shR.z>0,"natural mild asymmetry remains");
 assert.ok(Math.abs(p.hips.z)<.025,"pelvis upright rather than crouched");
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
 assert.equal(pkg.version,"0.3.113");
 assert.ok(html.includes("v0.3.113 ·"));
 assert.ok(html.includes("RENSTANCE012"));
 assert.ok(html.includes("RENSTANCE013"));
 assert.ok(html.includes("ren-idle-kinemiq.js?v=0.3.113"));
});
