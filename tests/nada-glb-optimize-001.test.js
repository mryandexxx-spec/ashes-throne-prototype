"use strict";
/* NADAOPT001 — mobile download budget for Nada's production GLB.
 * Static gate only: visual acceptance and WebGL behaviour are checked separately. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const file=path.join(__dirname,"../dev/assets/models/nada-mobile-animated.glb");

function readGlb(){
 const bytes=fs.readFileSync(file);
 const jsonLength=bytes.readUInt32LE(12);
 const json=JSON.parse(bytes.toString("utf8",20,20+jsonLength));
 const bin=bytes.subarray(28+jsonLength);
 return {bytes,json,bin};
}
function webpSize(buf){
 assert.equal(buf.toString("ascii",0,4),"RIFF");
 assert.equal(buf.toString("ascii",8,12),"WEBP");
 const kind=buf.toString("ascii",12,16);
 if(kind==="VP8 ")return {w:buf.readUInt16LE(26)&0x3fff,h:buf.readUInt16LE(28)&0x3fff};
 if(kind==="VP8L"){const b=buf.readUInt32LE(21);return {w:(b&0x3fff)+1,h:((b>>14)&0x3fff)+1};}
 if(kind==="VP8X")return {w:1+buf.readUIntLE(24,3),h:1+buf.readUIntLE(27,3)};
 throw new Error("Unknown WebP chunk "+kind);
}

test("NADAOPT001: Nada GLB stays within the mobile download budget",()=>{
 const {bytes}=readGlb();
 assert.ok(bytes.length<1800000,`Nada GLB is ${bytes.length} bytes; budget is 1.8 MB (was 3.1 MB before NADAOPT001)`);
});

test("NADAOPT001: colour texture stays 2048 WebP (owner-approved variant B)",()=>{
 const {json,bin}=readGlb();
 assert.equal(json.images.length,1);
 const info=json.materials[0].pbrMetallicRoughness.baseColorTexture;
 const tex=json.textures[info.index];
 const source=tex.extensions?.EXT_texture_webp?.source??tex.source;
 assert.equal(json.images[source].mimeType,"image/webp");
 const view=json.bufferViews[json.images[source].bufferView];
 assert.deepEqual(webpSize(bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength)),{w:2048,h:2048});
});

test("NADAOPT001: rig, mesh and all eight animation clips are preserved",()=>{
 const {json}=readGlb();
 assert.equal(json.skins.length,1);
 assert.equal(json.skins[0].joints.length,66);
 assert.equal(json.meshes.length,1);
 assert.ok(json.extensionsUsed.includes("KHR_mesh_quantization"),"vertex quantization is natively supported by Babylon.js");
 assert.ok(!json.extensionsUsed.includes("EXT_meshopt_compression"),"no extra decoder download");
 assert.ok(!json.extensionsUsed.includes("KHR_draco_mesh_compression"),"no extra decoder download");
 assert.deepEqual(json.animations.map(a=>a.name).sort(),["Archery_Shot_3","Electrocuted_Fall","Hit_Reaction_1","Idle_11","Lean_Forward_Sprint_inplace","Running","Walking","mage_soell_cast"]);
 for(const anim of json.animations)assert.equal(anim.channels.length,67,anim.name);
});
