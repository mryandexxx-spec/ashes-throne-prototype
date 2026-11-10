"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"..","ren-glb-runtime.js"),"utf8");

class V3 {
 constructor(x,y,z){this.x=x;this.y=y;this.z=z;}
 subtract(v){return new V3(this.x-v.x,this.y-v.y,this.z-v.z);}
 static Minimize(a,b){return new V3(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.min(a.z,b.z));}
 static Maximize(a,b){return new V3(Math.max(a.x,b.x),Math.max(a.y,b.y),Math.max(a.z,b.z));}
}
class Root {
 constructor(name){this.name=name;this.scaling={set(x,y,z){this.xyz=[x,y,z];}};}
 dispose(){this.disposed=true;}
}
function makeFixture(fail=false){
 const imported={parent:null,metadata:null,isPickable:false,
  getTotalVertices:()=>100,computeWorldMatrix(){},
  getBoundingInfo:()=>({boundingBox:{minimumWorld:new V3(-.4,0,-.3),maximumWorld:new V3(.4,1.86,.3)}})};
 const old={isVisible:true,isPickable:true};
 const B={Vector3:V3,TransformNode:Root,GLTFFileLoader:function(){},
  SceneLoader:{ImportMeshAsync:async(_x,folder,name)=>{
   assert.equal(folder,"assets/");
   assert.equal(name,"ren-wanderer-v1.glb");
   if(fail)throw Error("missing asset");
   return {meshes:[imported],transformNodes:[],animationGroups:[],skeletons:[]};
  }}};
 const module={exports:{}};
 vm.runInNewContext(source,{module,window:{BABYLON:B},console});
 const statuses=[];
 const visual={body:{getChildMeshes:()=>[old]},head:{getChildMeshes:()=>[]}};
 const instance=module.exports.create(B,{isDisposed:false},visual,(status)=>statuses.push(status));
 return {instance,old,imported,statuses};
}
test("Wanderer static GLB loads without animation groups and retains combat fallback safety",async()=>{
 const {instance,old,imported,statuses}=makeFixture();
 assert.equal(await instance.ready,true);
 assert.equal(old.isVisible,false);
 assert.equal(imported.metadata.fighterId,"ren");
 assert.doesNotThrow(()=>instance.update({slot:"basic",progress:.5}));
 assert.ok(statuses.includes("ready"));
 instance.dispose();
 assert.equal(old.isVisible,true);
});
test("Wanderer import failure leaves the procedural Ren visible",async()=>{
 const {instance,old,statuses}=makeFixture(true);
 assert.equal(await instance.ready,false);
 assert.equal(old.isVisible,true);
 assert.ok(statuses.includes("error"));
 instance.dispose();
});
