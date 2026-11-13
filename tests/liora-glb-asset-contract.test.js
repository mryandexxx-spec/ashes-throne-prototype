"use strict";
/* LIORA-SHIELD-002: binary asset regressions, Node built-ins only. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const root=path.resolve(__dirname,"..");
const manifest=require("../dev/assets/models/manifest.json");
function parse(file){
 const b=fs.readFileSync(path.join(root,"dev/assets/models",file));
 assert.equal(b.toString("ascii",0,4),"glTF","must be GLB");
 assert.equal(b.readUInt32LE(4),2,"must be glTF 2.0");
 assert.equal(b.readUInt32LE(8),b.length,"declared bytes must match");
 assert.equal(b.toString("ascii",16,20),"JSON","JSON chunk");
 return {buffer:b,json:JSON.parse(b.subarray(20,20+b.readUInt32LE(12)).toString("utf8"))};
}
for(const [id,file] of [["liora","liora_vel_shield_aware_15clips.glb"],["liora-shield","liora-shield-mobile.glb"]]){
 test("GLB integrity, hash, manifest and WebP: "+id,()=>{
  const {buffer,json}=parse(file);
  const m=manifest.assets.find(x=>x.id===id);
  assert.ok(m,"manifest entry must exist");
  assert.equal(m.file,file);
  assert.equal(m.bytes,buffer.length);
  assert.equal(m.sha256,crypto.createHash("sha256").update(buffer).digest("hex"));
  assert.ok(json.extensionsRequired?.includes("EXT_texture_webp"),"WebP decoder needed");
  assert.equal(json.meshes?.length,1);
 });
}
test("Liora has animated left-hand attachment joint, 12 source clips and 3 shield-aware clips",()=>{
 const {json}=parse("liora_vel_shield_aware_15clips.glb");
 assert.equal(json.skins?.length,1);
 assert.equal(json.skins[0].joints.length,66);
 assert.ok(json.nodes.some(x=>x.name==="mixamorig:LeftHand"));
 assert.deepEqual(new Set((json.animations||[]).map(a=>a.name)),new Set([
  "Running","Walking","Alert","Block1","Catching_Breath","Dead",
  "Hit_Reaction","Idle_02","Shield_Push_Left","Squat_Stance",
  "Step_Forward_and_Push","Walk_Fight_Forward",
  "Liora_Shield_Block","Liora_Shield_Bash","Liora_Shield_Death"
 ]));
 const left=json.nodes.findIndex(x=>x.name==="mixamorig:LeftHand");
 assert.ok(json.animations.every(a=>a.channels.some(c=>c.target.node===left)));
});
test("shield remains separate (unskinned and without baked animation)",()=>{
 const {json}=parse("liora-shield-mobile.glb");
 assert.equal(json.skins?.length||0,0);
 assert.equal(json.animations?.length||0,0);
});
