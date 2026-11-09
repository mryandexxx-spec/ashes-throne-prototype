"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const exportGlb=require("../tools/env010-gorge-export.cjs");
const root=path.join(__dirname,"..");
const asset=fs.readFileSync(path.join(root,"assets/env010/gorge-strata-v1.glb"));
test("authored canyon GLB is deterministic valid glTF 2 with material, bounded 3D geometry",()=>{
 const generated=exportGlb();
 assert.deepEqual(Buffer.from(generated.bytes),asset,"exported binary must match committed GLB");
 assert.equal(asset.readUInt32LE(0),0x46546c67);
 assert.equal(asset.readUInt32LE(4),2);
 assert.equal(asset.readUInt32LE(8),asset.length);
 const jsonLength=asset.readUInt32LE(12);
 assert.equal(asset.readUInt32LE(16),0x4e4f534a);
 const json=JSON.parse(asset.subarray(20,20+jsonLength).toString("utf8"));
 const offset=20+jsonLength;
 assert.equal(asset.readUInt32LE(offset+4),0x004e4942);
 assert.equal(asset.readUInt32LE(offset)+offset+8,asset.length);
 assert.equal(json.asset.version,"2.0");
 assert.equal(json.meshes.length,4);
 assert.equal(json.scenes[0].nodes.length,4);
 assert.ok(asset.length<450000,"GLB must remain lightweight on mobile");
 for(const mesh of json.meshes){
  const primitive=mesh.primitives[0];
  assert.equal(primitive.mode,4);
  for(const attr of ["POSITION","NORMAL","COLOR_0","TEXCOORD_0"])
   assert.ok(Number.isInteger(primitive.attributes[attr]));
  const count=json.accessors[primitive.attributes.POSITION].count;
  assert.ok(count>=1000&&count<6000);
  const colors=json.accessors[primitive.attributes.COLOR_0];
  assert.equal(colors.count,count);assert.equal(colors.componentType,5121);
  assert.equal(colors.normalized,true);
  const indices=json.accessors[primitive.indices];
  assert.equal(indices.count%3,0);assert.ok(indices.count>1000);
 }
 const tri=generated.stats.reduce((sum,a)=>sum+a.triangles,0);
 assert.equal(tri,13404);
 assert.deepEqual(generated.stats.map(m=>m.vertices),[2262,2262,1218,1155]);
 assert.deepEqual(generated.stats.map(m=>m.triangles),[4520,4520,2236,2128]);
 // Three closed forms per draw-call group: every volume has a cap,
 // full-depth perimeter, and real thickness in both camera axes.
 assert.ok(generated.stats.every(m=>m.vertices>1200));
 assert.ok(generated.stats.every(a=>a.vertices<=6000));
});
test("authored GLB can replace old scenic geometry without affecting ENV009 or picking",async()=>{
 const source=fs.readFileSync(path.join(root,"combat-environment-010.js"),"utf8");
 class Color{constructor(x,y,z){this.x=x;this.y=y;this.z=z;}}
 class Mesh{
  constructor(name,scene){this.name=name;this.isPickable=true;scene.meshes.push(this);}
  setEnabled(enabled){this.enabled=enabled;}
  dispose(){this.disposed=true;}
 }
 class Material{constructor(name,scene){this.name=name;scene.materials.push(this);}dispose(){this.disposed=true;}}
 class VertexData{applyToMesh(mesh){mesh.data={positions:this.positions,indices:this.indices,uvs:this.uvs,
   normals:this.normals,colors:this.colors};}}
 VertexData.ComputeNormals=(_,__,normals)=>normals.push(0);
 const B={Color3:Color,Mesh,StandardMaterial:Material,VertexData};
 const scene={meshes:[],materials:[],isDisposed:()=>false};
 const status={};
 const requests=[];
 const scope={
  URL,TextDecoder,ArrayBuffer,DataView,Uint8Array,Math,
  document:{currentScript:{src:"http://localhost:8765/combat-environment-010.js"},
   documentElement:{dataset:status}},
  fetch:async url=>{
   requests.push(url);
   return {ok:true,arrayBuffer:async()=>asset.buffer.slice(asset.byteOffset,asset.byteOffset+asset.byteLength)};
  },module:{exports:{}}
 };
 const Env=vm.runInNewContext(source+"\nCombatEnvironment010",scope);
 const legacy=new Mesh("env009_living_ledge",scene);
 const ravine=new Mesh("env009_ravine",scene);
 for(const name of ["env009_near_escarpment","env009_far_ridge","env009_horizon_ridge"])
  new Mesh(name,scene);
 const built=Env.build(B,scene,x=>x);
 assert.equal(built.meshes,4,"unchanged synchronous fallback");
 // Three promise turns: fetch, response.arrayBuffer, asset creation.
 for(let i=0;i<10&&status.env010Rock!=="ready";i++)await new Promise(setImmediate);
 assert.equal(status.env010Rock,"ready");
 assert.deepEqual(requests,["http://localhost:8765/assets/env010/gorge-strata-v1.glb"]);
 const imported=scene.meshes.filter(m=>m.name.startsWith("env010_glb_"));
 assert.equal(imported.length,4);
 assert.ok(imported.every(m=>m.isPickable===false&&m.checkCollisions===false));
 assert.ok(imported.every(m=>m.data.positions.length&&m.data.indices.length&&m.data.colors.length));
 for(const name of ["env010_horizon","env010_midground","env010_escarpment"])
  assert.equal(scene.meshes.find(m=>m.name===name).disposed,true);
 assert.ok(scene.meshes.find(m=>m.name==="env010_sky")&&!scene.meshes.find(m=>m.name==="env010_sky").disposed);
 assert.equal(legacy.disposed,undefined);assert.equal(ravine.disposed,undefined);
});
