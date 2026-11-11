"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
test("RENW006: static import succeeds, grounds feet and preserves fallback lifecycle",async()=>{
 class V {
  constructor(x=0,y=0,z=0){Object.assign(this,{x,y,z});}
  set(x,y,z){Object.assign(this,{x,y,z});}
  static Minimize(a,b){return new V(Math.min(a.x,b.x),Math.min(a.y,b.y),Math.min(a.z,b.z));}
  static Maximize(a,b){return new V(Math.max(a.x,b.x),Math.max(a.y,b.y),Math.max(a.z,b.z));}
 }
 let root,requested;
 const fallback={isVisible:true,isPickable:true};
 const mesh={getTotalVertices:()=>3,computeWorldMatrix(){},getBoundingInfo:()=>({boundingBox:{minimumWorld:new V(-2,-1,-1),maximumWorld:new V(2,3,1)}})};
 const result={meshes:[mesh],transformNodes:[],skeletons:[{dispose(){this.disposed=true;}}],animationGroups:[]};
 const B={Vector3:V,GLTFFileLoader:function(){},SceneLoader:{async ImportMeshAsync(...args){requested=args;return result;}},TransformNode:class {
  constructor(){this.scaling=new V(1,1,1);root=this;}
  dispose(){this.disposed=true;}
 }};
 const ctx={module:{exports:{}},window:{BABYLON:B},console};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../ren-glb-runtime.js"),"utf8"),ctx);
 const body={getChildMeshes:()=>[mesh,fallback]},head={getChildMeshes:()=>[]};
 const statuses=[];const actor=ctx.module.exports.create(B,{isDisposed:false},{body,head},s=>statuses.push(s));
 assert.equal(await actor.ready,true);
 assert.equal(requested[1]+requested[2],"assets/ren-wanderer-v1.glb");
 assert.deepEqual(statuses,["loading","ready"]);
 assert.equal(fallback.isVisible,false);assert.equal(root.parent,body);
 assert.equal(root.scaling.y*4,2.1);
 assert.ok(Math.abs(.8+root.position.y-root.scaling.y-.14)<1e-9,"feet on base");
 actor.update({slot:"basic",progress:.5});actor.update({slot:"death",progress:1});
 assert.equal(fallback.isVisible,false,"missing clips must not reject static mesh");
 actor.dispose();actor.dispose();assert.equal(root.disposed,true);
 assert.equal(result.skeletons[0].disposed,true);assert.equal(fallback.isVisible,true);
});
