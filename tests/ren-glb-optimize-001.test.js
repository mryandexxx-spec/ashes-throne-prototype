"use strict";
/* RENOPT001 — mobile download budget for Ren's production GLB.
 * Static gate only: visual acceptance and WebGL behaviour are checked separately. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const file=path.join(__dirname,"../assets/ren-meshy-mixamo-animated.glb");

function readGlb(){
 const bytes=fs.readFileSync(file);
 const jsonLength=bytes.readUInt32LE(12);
 const json=JSON.parse(bytes.toString("utf8",20,20+jsonLength));
 const bin=bytes.subarray(28+jsonLength);
 return {bytes,json,bin};
}
function webpSize(buf){
 // RIFF....WEBP + VP8 / VP8L / VP8X chunk
 assert.equal(buf.toString("ascii",0,4),"RIFF");
 assert.equal(buf.toString("ascii",8,12),"WEBP");
 const kind=buf.toString("ascii",12,16);
 if(kind==="VP8 ")return {w:buf.readUInt16LE(26)&0x3fff,h:buf.readUInt16LE(28)&0x3fff};
 if(kind==="VP8L"){const b=buf.readUInt32LE(21);return {w:(b&0x3fff)+1,h:((b>>14)&0x3fff)+1};}
 if(kind==="VP8X")return {w:1+buf.readUIntLE(24,3),h:1+buf.readUIntLE(27,3)};
 throw new Error("Unknown WebP chunk "+kind);
}

test("RENOPT001: Ren GLB stays within the mobile download budget",()=>{
 const {bytes}=readGlb();
 assert.ok(bytes.length<3500000,`Ren GLB is ${bytes.length} bytes; budget is 3.5 MB (was 14.2 MB before RENOPT001)`);
});

test("RENOPT001: texture resolutions — colour 2048, normal and roughness 1024",()=>{
 const {json,bin}=readGlb();
 const material=json.materials[0];
 const imageOf=info=>{
  const tex=json.textures[info.index];
  const source=tex.extensions?.EXT_texture_webp?.source??tex.source;
  const view=json.bufferViews[json.images[source].bufferView];
  return webpSize(bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength));
 };
 assert.deepEqual(imageOf(material.pbrMetallicRoughness.baseColorTexture),{w:2048,h:2048});
 assert.deepEqual(imageOf(material.normalTexture),{w:1024,h:1024});
 assert.deepEqual(imageOf(material.pbrMetallicRoughness.metallicRoughnessTexture),{w:1024,h:1024});
});

test("RENOPT001: rig, mesh and all nine animation clips are preserved",()=>{
 const {json}=readGlb();
 assert.equal(json.skins.length,1);
 assert.equal(json.skins[0].joints.length,50);
 assert.equal(json.meshes.length,1);
 assert.ok(json.extensionsUsed.includes("KHR_mesh_quantization"),"vertex quantization is natively supported by Babylon.js");
 assert.ok(!json.extensionsUsed.includes("EXT_meshopt_compression"),"no extra decoder download");
 assert.ok(!json.extensionsUsed.includes("KHR_draco_mesh_compression"),"no extra decoder download");
 const names=json.animations.map(a=>a.name).sort();
 assert.deepEqual(names,["Axe_Spin_Attack","Dead","Double_Combo_Attack","Idle_4","Running","Slap_Reaction","Stand_and_Chat","Victory_Cheer","Walking"]);
 for(const anim of json.animations)assert.ok(anim.channels.length>0,anim.name);
});
