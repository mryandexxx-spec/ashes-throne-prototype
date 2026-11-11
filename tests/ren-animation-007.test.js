"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const runtime=require("../ren-glb-runtime.js");
test("RENAN007: additive rig motion resets each frame and preserves hips and legs",()=>{
 class Q {
  constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}
  clone(){return new Q(this.x,this.y,this.z);}
  copyFrom(q){Object.assign(this,q);}
  multiply(q){return new Q(this.x+q.x,this.y+q.y,this.z+q.z);}
  static RotationYawPitchRoll(y,x,z){return new Q(x,y,z);}
 }
 const names=["hips","hipR","kneeR","ankR","spine","head","shR","shL","elR","elL","capeA"];
 const nodes=names.map(name=>({name,rotationQuaternion:new Q()}));
 const pose=runtime.createRigAnimator({Quaternion:Q},nodes);
 const joint=name=>nodes.find(n=>n.name===name).rotationQuaternion;
 for(const slot of ["idle","basic","special","powerful","guard","hit","death"]){
  pose({slot,progress:.5});
  const first=joint("spine").clone();
  pose({slot,progress:.5});assert.deepEqual(joint("spine"),first);
  for(const name of ["hips","hipR","kneeR","ankR"])assert.deepEqual(joint(name),new Q(),slot+" keeps legs planted");
 }
 pose({slot:"basic",progress:.5});assert.notEqual(joint("shR").x,0);
 pose({slot:"idle",progress:.25});
 assert.ok(Math.abs(joint("spine").x)>=.05,"idle breathing should be perceptible");
 assert.ok(Math.abs(joint("shR").x)>=.03,"shoulders move with breathing");
 pose({slot:"idle",progress:0});assert.deepEqual(joint("shR"),new Q());
});

test("RENAN008: Ren action durations remain readable at normal battle speed",()=>{
 const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
 const source=fs.readFileSync(path.join(__dirname,"../animation-profiles.js"),"utf8");
 const ctx={};vm.runInNewContext(source+";this.profiles=AnimationProfiles;",ctx);
 for(const [slot,minMs] of [["basic",400],["special",500],["powerful",600],["hit",250]]){
  assert.ok(ctx.profiles.resolve("ren",slot).durationMs>=minMs,slot+" must be readable at 1x");
 }
 assert.equal(ctx.profiles.resolve("kael","basic").durationMs,200,"other fighters unchanged");
});
