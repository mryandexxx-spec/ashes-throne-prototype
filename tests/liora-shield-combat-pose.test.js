"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const Pose=require("../liora-shield-combat-pose.js");
class Q{
 constructor(v=0){this.v=v;}
 clone(){return new Q(this.v);}
 static Slerp(a,b,t){return new Q(a.v*(1-t)+b.v*t);}
}
function make(){
 const joints=Pose.NAMES.map(name=>({name,rotationQuaternion:new Q(.8),computeWorldMatrix(){}}));
 const idle={from:0,to:100,start(){},pause(){},stop(){},
  goToFrame(){for(const n of joints)n.rotationQuaternion=new Q(0);}};
 const pose=Pose.create({Quaternion:Q},{transformNodes:joints},idle);
 for(const n of joints)n.rotationQuaternion=new Q(.8);
 return {pose,joints};
}
test("only shield block and bash alter four left-arm joint poses",()=>{
 const {pose,joints}=make();
 for(const clip of ["Running","Idle_02","Walking","Liora_Shield_Death","Hit_Reaction"]){
  assert.equal(pose.apply(clip,.5),false);
  assert.ok(joints.every(n=>n.rotationQuaternion.v===.8));
 }
 assert.equal(pose.apply("Liora_Shield_Block",0),false);
 assert.equal(pose.apply("Liora_Shield_Block",.5),true);
 assert.ok(joints.some(n=>n.rotationQuaternion.v<.8));
 const block=joints[1].rotationQuaternion.v;
 for(const n of joints)n.rotationQuaternion=new Q(.8);
 assert.equal(pose.apply("Liora_Shield_Bash",.5),true);
 assert.ok(joints[1].rotationQuaternion.v<block,"bash arm must be more compact");
});
test("correction preserves keyframe endpoints and is deterministic",()=>{
 const {pose,joints}=make();
 assert.equal(pose.apply("Liora_Shield_Bash",1),false);
 assert.ok(joints.every(n=>n.rotationQuaternion.v===.8));
 pose.apply("Liora_Shield_Bash",.25);
 const v=joints.map(n=>n.rotationQuaternion.v);
 for(const n of joints)n.rotationQuaternion=new Q(.8);
 pose.apply("Liora_Shield_Bash",.75);
 for(let i=0;i<joints.length;i++)assert.ok(Math.abs(joints[i].rotationQuaternion.v-v[i])<1e-12);
});
