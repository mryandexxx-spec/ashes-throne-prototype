"use strict";
/* LIORA-SHIELD-006: binary asset regressions for the single Liora GLB, Node built-ins only. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const crypto=require("node:crypto");
const root=path.resolve(__dirname,"..");
const manifest=require("../dev/assets/models/manifest.json");
const registry=require("../dev/src/assets/models.js");
const FILE="liora-mobile-animated.glb";
const CLIPS=["Running","Walking","Alert","Block1","Catching_Breath","Dead",
 "Hit_Reaction","Idle_02","Shield_Push_Left","Squat_Stance",
 "Step_Forward_and_Push","Walk_Fight_Forward",
 "Liora_Shield_Block","Liora_Shield_Bash","Liora_Shield_Death"];
function parse(file){
 const b=fs.readFileSync(path.join(root,"dev/assets/models",file));
 assert.equal(b.toString("ascii",0,4),"glTF","must be GLB");
 assert.equal(b.readUInt32LE(4),2,"must be glTF 2.0");
 assert.equal(b.readUInt32LE(8),b.length,"declared bytes must match");
 assert.equal(b.toString("ascii",16,20),"JSON","JSON chunk");
 const jsonLength=b.readUInt32LE(12);
 const json=JSON.parse(b.subarray(20,20+jsonLength).toString("utf8"));
 const binStart=20+jsonLength+8;
 assert.equal(b.toString("ascii",20+jsonLength+4,binStart),"BIN\0");
 return {buffer:b,json,bin:b.subarray(binStart)};
}
function readAccessor(parsed,index){
 const a=parsed.json.accessors[index],bv=parsed.json.bufferViews[a.bufferView];
 const comps={SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT4:16}[a.type];
 const ctor={5120:Int8Array,5121:Uint8Array,5122:Int16Array,5123:Uint16Array,5125:Uint32Array,5126:Float32Array}[a.componentType];
 const stride=bv.byteStride||comps*ctor.BYTES_PER_ELEMENT;
 const out=[];
 for(let i=0;i<a.count;i++){
  const off=(bv.byteOffset||0)+(a.byteOffset||0)+i*stride;
  out.push(Array.from(new ctor(parsed.bin.buffer,parsed.bin.byteOffset+off,comps)));
 }
 return out;
}
test("Liora GLB: integrity, hash, manifest, registry and WebP",()=>{
 const {buffer,json}=parse(FILE);
 const m=manifest.assets.find(x=>x.id==="liora");
 assert.ok(m,"manifest entry must exist");
 assert.equal(m.file,FILE);
 assert.equal(m.bytes,buffer.length);
 assert.equal(m.sha256,crypto.createHash("sha256").update(buffer).digest("hex"));
 assert.ok(!manifest.assets.some(x=>x.id==="liora-shield"),"separate shield GLB retired");
 assert.ok(!fs.existsSync(path.join(root,"dev/assets/models/liora-shield-mobile.glb")));
 assert.ok(!fs.existsSync(path.join(root,"dev/assets/models/liora_vel_shield_aware_15clips.glb")));
 assert.ok(json.extensionsRequired?.includes("EXT_texture_webp"),"WebP decoder needed");
 assert.ok(json.extensionsRequired?.includes("KHR_mesh_quantization"),"quantized like Ren and Nada");
 assert.ok(!json.extensionsRequired?.some(x=>/draco|meshopt/i.test(x)),"no external decoders");
 assert.ok(buffer.length<2.3e6,"budget: one request under 2.3 MB (was 2 850 224 + 631 488 in two files)");
 assert.deepEqual((json.images||[]).map(i=>i.mimeType),["image/webp","image/webp"]);
 const liora=typeof LioraModelAssets!=="undefined"?LioraModelAssets:null;
 void liora;void registry;
 const src=fs.readFileSync(path.join(root,"dev/src/assets/models.js"),"utf8");
 assert.match(src,new RegExp('url:"dev/assets/models/'+FILE+'"'));
 assert.match(src,new RegExp("bytes:"+buffer.length+","));
 assert.match(src,new RegExp('sha256:"'+m.sha256+'"'));
 assert.match(src,/shieldMesh:"Liora_Shield",shieldJoint:"mixamorig:LeftForeArm"/);
 assert.doesNotMatch(src,/LioraShieldAssets|liora-shield-mobile|liora_vel_shield_aware_15clips/);
});
test("Liora GLB: one skin, 66 joints, 15 clips, shield mesh rigidly skinned to the left forearm",()=>{
 const parsed=parse(FILE);const {json}=parsed;
 assert.equal(json.skins.length,1,"both meshes must share one skin");
 assert.equal(json.skins[0].joints.length,66);
 assert.deepEqual(new Set(json.animations.map(a=>a.name)),new Set(CLIPS));
 const meshNodes=json.nodes.filter(n=>n.mesh!==undefined);
 assert.equal(meshNodes.length,2);
 assert.ok(meshNodes.every(n=>n.skin===0));
 const shieldNode=meshNodes.find(n=>n.name==="Liora_Shield");
 assert.ok(shieldNode,"shield node must be named Liora_Shield");
 const shieldMesh=json.meshes[shieldNode.mesh];
 assert.equal(shieldMesh.primitives.length,1);
 const prim=shieldMesh.primitives[0];
 assert.equal(json.accessors[prim.attributes.POSITION].count,4445);
 assert.equal(json.accessors[prim.indices].count,5056*3);
 assert.equal(json.materials[prim.material].name,"LioraShield");
 const forearm=json.nodes.findIndex(n=>n.name==="mixamorig:LeftForeArm");
 const jointIndex=json.skins[0].joints.indexOf(forearm);
 assert.ok(jointIndex>=0);
 const joints=readAccessor(parsed,prim.attributes.JOINTS_0);
 const weights=readAccessor(parsed,prim.attributes.WEIGHTS_0);
 const wa=json.accessors[prim.attributes.WEIGHTS_0];
 const wmax=wa.componentType===5126?1:wa.componentType===5121?255:65535;
 assert.ok(joints.every(j=>j[0]===jointIndex),"every shield vertex binds the forearm joint");
 assert.ok(weights.every(w=>w[0]===wmax&&w[1]===0&&w[2]===0&&w[3]===0),"rigid 100% weight");
 // Character mesh is untouched in size.
 const body=json.meshes[meshNodes.find(n=>n.name!=="Liora_Shield").mesh].primitives[0];
 assert.equal(json.accessors[body.attributes.POSITION].count,13265);
 assert.equal(json.accessors[body.indices].count,14225*3);
});
test("Liora GLB: every clip still animates the left forearm; rotations are normalized int16",()=>{
 const {json}=parse(FILE);
 const forearm=json.nodes.findIndex(n=>n.name==="mixamorig:LeftForeArm");
 const hips=json.nodes.findIndex(n=>n.name==="mixamorig:Hips");
 for(const a of json.animations){
  assert.ok(a.channels.some(c=>c.target.node===forearm&&c.target.path==="rotation"),a.name+" forearm rotation");
  assert.ok(a.channels.some(c=>c.target.node===hips&&c.target.path==="translation"),a.name+" hips translation");
  for(const c of a.channels){
   const out=json.accessors[a.samplers[c.sampler].output];
   if(c.target.path==="rotation"){assert.equal(out.componentType,5122);assert.equal(out.normalized,true);}
   else assert.equal(out.componentType,5126);
   assert.equal(json.accessors[a.samplers[c.sampler].input].componentType,5126);
  }
 }
 const channels=json.animations.reduce((s,a)=>s+a.channels.length,0);
 assert.ok(channels<1100,"constant channels shared by all clips are baked into node TRS: "+channels);
});
test("LIORA-SHIELD-006 build tool and calibration are in the repository",()=>{
 const tool=fs.readFileSync(path.join(root,"tools/bake-liora-shield.mjs"),"utf8");
 assert.match(tool,/shield_attachment\.json/);
 assert.match(tool,/quantizationVolume: 'scene'/);
 const calib=require("../dev/assets-src/characters/liora/shield_attachment.json");
 assert.equal(calib.joint,"mixamorig:LeftForeArm");
 assert.equal(calib.bakeMatrix_gltfColumnMajor.length,16);
 assert.ok(calib.bakeMatrix_gltfColumnMajor.every(Number.isFinite));
});
