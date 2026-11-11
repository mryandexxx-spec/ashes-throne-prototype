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
 const result={meshes:[mesh],transformNodes:[],skeletons:[{dispose(){this.disposed=true;}}],animationGroups:["Idle_4","Double_Combo_Attack","Slap_Reaction","Dead","Running"].map(name=>({name,from:0,to:1,start(){},stop(){},pause(){},goToFrame(){},dispose(){},targetedAnimations:[{target:{name:"mixamorig:Hips"},animation:{targetProperty:"position",getKeys(){return [{value:{x:0,y:.9,z:-1}},{value:{x:0,y:.8,z:0}}];}}}]}))};
 const B={Vector3:V,GLTFFileLoader:function(){},SceneLoader:{async ImportMeshAsync(...args){requested=args;return result;}},TransformNode:class {
  constructor(){this.scaling=new V(1,1,1);root=this;}
  dispose(){this.disposed=true;}
 }};
 const ctx={module:{exports:{}},window:{BABYLON:B},console};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../ren-glb-runtime.js"),"utf8"),ctx);
 const body={getChildMeshes:()=>[mesh,fallback]},head={getChildMeshes:()=>[]};
 const statuses=[];const actor=ctx.module.exports.create(B,{isDisposed:false},{body,head},(s,msg)=>statuses.push({status:s,message:msg}));
 assert.equal(await actor.ready,true,JSON.stringify(statuses));
 assert.equal(requested[1]+requested[2],"assets/ren-meshy-mixamo-animated.glb");
 assert.deepEqual(statuses.map(x=>x.status),["loading","ready"]);
 assert.equal(fallback.isVisible,false);assert.equal(root.parent,body);
 assert.equal(root.scaling.y*4,2.1);
 assert.ok(Math.abs(.8+root.position.y-root.scaling.y-.14)<1e-9,"feet on base");
 actor.update({slot:"basic",progress:.5});actor.update({slot:"death",progress:1});
 assert.equal(fallback.isVisible,false,"mapped native clips preserve the fallback until import validation");
 actor.dispose();actor.dispose();assert.equal(root.disposed,true);
 assert.equal(result.skeletons[0].disposed,true);assert.equal(fallback.isVisible,true);
});
