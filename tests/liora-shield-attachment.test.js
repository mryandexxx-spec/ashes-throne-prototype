"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const Mount=require("../liora-shield-attachment.js");
class Vector{
 constructor(x=0,y=0,z=0){this.set(x,y,z);}
 set(x,y,z){Object.assign(this,{x,y,z});}
 copyFrom(other){this.set(other.x,other.y,other.z);}
 static TransformCoordinates(v,m){const p=m.origin||new Vector();return new Vector(v.x+p.x,v.y+p.y,v.z+p.z);}
 static Lerp(a,b,t){return new Vector(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t,a.z+(b.z-a.z)*t);}
}
class Quaternion{
 constructor(x=0,y=0,z=0,w=1){Object.assign(this,{x,y,z,w});}
 static Inverse(){return new Quaternion();}
 static FromEulerAngles(){return new Quaternion();}
 multiply(){return new Quaternion();}
}
class TransformNode{
 constructor(name){
  this.name=name;this.parent=null;this.position=new Vector();
  this.scaling={setAll(value){this.value=value;}};this.disposeCount=0;
 }
 computeWorldMatrix(){}
 getWorldMatrix(){return {origin:this.position,decompose(_scale,rotation){
  Object.assign(rotation,{x:0,y:0,z:0,w:1});return true;
 }};}
 dispose(){this.disposeCount++;}
}
const B={Vector3:Vector,Quaternion,TransformNode};
function fixture(){
 const hand=new TransformNode("mixamorig:LeftHand");
 const prop=new TransformNode("shieldGeometry");prop.getTotalVertices=()=>4445;
 const referenceRoot=new TransformNode("root");
 return {hand,prop,referenceRoot,character:{transformNodes:[hand]},
  shield:{meshes:[prop],transformNodes:[]}};
}
test("rigid shield follows LEFT hand position without inheriting bone-chain twists",()=>{
 const f=fixture();
 const a=Mount.attach(B,{},f.character,f.shield,{referenceRoot:f.referenceRoot});
 assert.equal(a.hand,f.hand);
 assert.equal(a.jointName,"mixamorig:LeftHand");
 assert.equal(a.socket.parent,null);
 assert.equal(a.socket.metadata.lioraJoint,"mixamorig:LeftHand");
 assert.equal(f.prop.parent,a.socket);
 assert.equal(a.socket.position.x,-.22055);
 f.hand.position.x=.5;
 a.update();
 assert.ok(Math.abs(a.socket.position.x-(.5-.22055))<1e-7);
 a.pose({offset:{x:0,y:.2,z:.1},rotation:{x:10,y:20,z:30},scale:.9});
 assert.equal(a.socket.position.y,.2);
 assert.equal(a.socket.scaling.value,.9);
 a.pose({stabilize:false});a.update();
 assert.ok(a.socket.rotationQuaternion);
 a.pose({stabilize:true});
 a.setClipProgress("Liora_Shield_Death",.9);
 assert.ok(Math.abs(a.socket.position.x-.26)<1e-7);
 a.setClipProgress("Idle_02",.3);
 assert.equal(a.socket.position.x,f.hand.position.x-.22055);
 a.setClipProgress("Liora_Shield_Block",.5);
 assert.ok(a.socket.position.y>.15,"block must raise shield above neutral hand offset");
 a.setClipProgress("Liora_Shield_Bash",.5);
 assert.ok(a.socket.position.y>.10,"bash must have a small nonzero offset");
 a.setClipProgress("Running",.5);
 assert.equal(a.socket.position.x,f.hand.position.x-.22055,"running preserves baseline socket");
 a.dispose();a.dispose();
 assert.equal(a.socket.disposeCount,1);
});
test("missing joint/geometry and invalid transform fail safely",()=>{
 const f=fixture();
 assert.throws(()=>Mount.attach(B,{}, {transformNodes:[]},f.shield),/LeftHand/);
 assert.throws(()=>Mount.attach(B,{},f.character,{meshes:[]}),/geometry/);
 const a=Mount.attach(B,{},f.character,f.shield);
 assert.throws(()=>a.pose({scale:0}),/Invalid/);
 assert.throws(()=>a.pose({offset:{z:NaN}}),/Invalid/);
 a.dispose();
});
