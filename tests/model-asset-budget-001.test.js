"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

// Read only the GLB JSON header, never decode images or allocate GPU memory.
function auditGlb(name){
 const file=path.join(__dirname,"..",name),fd=fs.openSync(file,"r");
 try{
  const header=Buffer.alloc(20);
  assert.equal(fs.readSync(fd,header,0,20,0),20);
  assert.equal(header.toString("ascii",0,4),"glTF");
  const jsonSize=header.readUInt32LE(12),length=header.readUInt32LE(8);
  assert.equal(fs.statSync(file).size,length);
  const json=Buffer.alloc(jsonSize);
  assert.equal(fs.readSync(fd,json,0,jsonSize,20),jsonSize);
  const gltf=JSON.parse(json.toString("utf8"));
  const referenced={
   textures:new Set(),geometry:new Set(),animations:new Set()
  };
  for(const image of gltf.images||[])if(Number.isInteger(image.bufferView))referenced.textures.add(image.bufferView);
  const addAccessor=(kind,index)=>{
   const accessor=gltf.accessors?.[index];
   if(!accessor)return;
   if(Number.isInteger(accessor.bufferView))referenced[kind].add(accessor.bufferView);
   if(Number.isInteger(accessor.sparse?.indices?.bufferView))referenced[kind].add(accessor.sparse.indices.bufferView);
   if(Number.isInteger(accessor.sparse?.values?.bufferView))referenced[kind].add(accessor.sparse.values.bufferView);
  };
  for(const mesh of gltf.meshes||[])for(const p of mesh.primitives||[]){
   for(const index of Object.values(p.attributes||{}))addAccessor("geometry",index);
   if(Number.isInteger(p.indices))addAccessor("geometry",p.indices);
   for(const target of p.targets||[])for(const index of Object.values(target))addAccessor("geometry",index);
  }
  for(const animation of gltf.animations||[])for(const sampler of animation.samplers||[]){
   addAccessor("animations",sampler.input);addAccessor("animations",sampler.output);
  }
  const bytes=type=>[...referenced[type]].reduce((n,index)=>n+(gltf.bufferViews?.[index]?.byteLength||0),0);
  const info={
   asset:name,totalBytes:length,jsonBytes:jsonSize,
   images:gltf.images?.length||0,
   texturesBytes:bytes("textures"),
   geometryBytes:bytes("geometry"),
   animationBytes:bytes("animations"),
   meshes:gltf.meshes?.length||0,
   animations:gltf.animations?.length||0,
   skins:gltf.skins?.length||0,
   joints:gltf.skins?.reduce((n,s)=>n+(s.joints?.length||0),0)||0
  };
  console.log("MODEL_ASSET_AUDIT="+JSON.stringify(info));
  return info;
 }finally{fs.closeSync(fd);}
}
test("MODELLOAD001: determine texture, geometry and animation transfer budget",()=>{
 const ren=auditGlb("assets/ren-meshy-mixamo-animated.glb");
 const nada=auditGlb("dev/assets/models/nada-mobile-animated.glb");
 assert.ok(ren.totalBytes>nada.totalBytes);
 assert.ok(ren.texturesBytes+ren.geometryBytes+ren.animationBytes>0);
 assert.ok(nada.texturesBytes+nada.geometryBytes+nada.animationBytes>0);
});
