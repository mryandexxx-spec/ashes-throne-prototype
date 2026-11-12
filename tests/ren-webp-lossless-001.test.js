"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const file=path.join(__dirname,"../assets/ren-meshy-mixamo-animated.glb");
test("RENWEBP001: production Ren textures use lossless WebP with unchanged rig contract",()=>{
 const bytes=fs.readFileSync(file);
 assert.equal(bytes.toString("ascii",0,4),"glTF");
 assert.equal(bytes.readUInt32LE(8),bytes.length);
 assert.ok(bytes.length<15000000,"the 18 MB original must not remain in the feature branch");
 const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)).toString("utf8"));
 assert.ok(json.extensionsUsed?.includes("EXT_texture_webp"),"WebP must be present in actual GLB");
 assert.equal(json.images?.length,3,"preserve all three Ren texture images");
 for(const image of json.images)assert.equal(image.mimeType,"image/webp");
 assert.equal(json.skins?.[0]?.joints?.length,50);
 assert.equal(json.meshes?.length,1);
 assert.equal(json.animations?.length,9);
 for(const name of ["Idle_4","Walking","Running","Double_Combo_Attack","Axe_Spin_Attack","Slap_Reaction","Dead","Victory_Cheer","Stand_and_Chat"])
  assert.ok(json.animations.some(a=>a.name===name),name);
});
