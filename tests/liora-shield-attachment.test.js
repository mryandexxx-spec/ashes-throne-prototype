"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Mount=require("../liora-shield-attachment.js");
class Vector{constructor(x=0,y=0,z=0){this.set(x,y,z);}set(x,y,z){this.x=x;this.y=y;this.z=z;}}
class Quaternion{
 static Inverse(){return new Quaternion();}
 static FromEulerAngles(){return new Quaternion();}
 multiply(){return new Quaternion();}
}
class TransformNode{
 constructor(name){this.name=name;this.position=new Vector();this.scaling={setAll(value){this.value=value;}};this.disposeCount=0;}
 computeWorldMatrix(){}
 getAbsoluteRotationQuaternion(){return new Quaternion();}
 dispose(){this.disposeCount++;}
}
const B={Vector3:Vector,Quaternion,TransformNode};
const scene={};
function fixture(){
 const hand=new TransformNode("mixamorig:LeftHand");
 const prop=new TransformNode("shieldGeometry");
 prop.getTotalVertices=()=>4445;
 return {hand,prop,character:{transformNodes:[hand]},shield:{meshes:[prop],transformNodes:[]}};
}
test("shield is parented to the animated LEFT hand joint, independently of character mesh",()=>{
 const f=fixture();
 const attachment=Mount.attach(B,scene,f.character,f.shield);
 assert.equal(attachment.hand,f.hand);
 assert.equal(attachment.socket.parent,f.hand);
 assert.equal(f.prop.parent,attachment.socket);
 assert.equal(attachment.jointName,"mixamorig:LeftHand");
 assert.equal(attachment.socket.position.z,.17);
 attachment.pose({offset:{x:0,y:.2,z:.1},rotation:{x:10,y:0,z:20},scale:.9});
 assert.equal(attachment.socket.position.y,.2);
 assert.equal(attachment.socket.scaling.value,.9);
 attachment.dispose();
 attachment.dispose();
 assert.equal(attachment.socket.disposeCount,1);
});
test("missing hand, missing geometry and invalid transforms fail safely",()=>{
 const f=fixture();
 assert.throws(()=>Mount.attach(B,scene,{transformNodes:[]},f.shield),/LeftHand/);
 assert.throws(()=>Mount.attach(B,scene,f.character,{meshes:[],transformNodes:[]}),/geometry/);
 const attachment=Mount.attach(B,scene,f.character,f.shield);
 assert.throws(()=>attachment.pose({scale:0}),/Invalid/);
 assert.throws(()=>attachment.pose({offset:{z:NaN}}),/Invalid/);
 attachment.dispose();
});
