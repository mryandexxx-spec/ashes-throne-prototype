"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs");
const motion=require("../ren-motion-retarget.js");
const data=require("../ren-kinemiq-retarget-data.js");
test("RENIDLE015: stationary dossier never transfers root, pelvis or foot motion",()=>{
 const targets=motion.MAPPINGS.map(x=>x[1]);
 for(const banned of ["hips","hipL","hipR","kneeL","kneeR","ankL","ankR"])
  assert.ok(!targets.includes(banned),"Idle may not rock "+banned);
 assert.ok(targets.includes("head"));
 assert.ok(targets.includes("spine"));
 assert.ok(targets.includes("shL")&&targets.includes("shR"));
 assert.ok(motion.MAPPINGS.every(x=>x[2]<=.52),"do not amplify foreign source clip");
});
test("RENIDLE015: shoulders anchored to source first frame and no talking overlay",()=>{
 const source=fs.readFileSync("ren-motion-retarget.js","utf8");
 assert.ok(source.includes("reference:evaluate(relaxed,index,0).slice()"));
 assert.ok(source.includes("vec[0]-ch.reference[0]"));
 assert.ok(!source.includes("evaluate(talking,ch.index"));
 assert.ok(!source.includes("gestureGain=talkStrength(ms)"));
 const clip=motion.decodeClip(data.clips.relaxed,data.bones);
 const left=data.bones.indexOf("upperarm_l"),right=data.bones.indexOf("upperarm_r");
 for(const i of [left,right]){
  const a=motion.evaluate(clip,i,0),b=motion.evaluate(clip,i,clip.durationMs);
  assert.ok(a.every((v,k)=>Math.abs(v-b[k])<1e-6),"no seam discontinuity");
 }
});
test("RENIDLE015: version and cache bust are paired",()=>{
 const html=fs.readFileSync("index.html","utf8");
 const pkg=JSON.parse(fs.readFileSync("package.json","utf8"));
 assert.equal(pkg.version,"0.3.115");
 assert.ok(html.includes("v0.3.115 ·"));
 assert.ok(html.includes("RENIDLE015"));
 assert.ok(html.includes("ren-motion-retarget.js?v=0.3.115"));
});
