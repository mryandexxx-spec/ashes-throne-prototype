"use strict";
// CI-only: prove that the lossless WebP experiment preserves every pixel of
// the original three PNG textures. Never runs in the browser or game bundle.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const crypto=require("node:crypto");
const sharp=require("/tmp/ren-glb-tools/node_modules/sharp");

function readImages(file){
 const raw=fs.readFileSync(file);
 assert.equal(raw.toString("ascii",0,4),"glTF");
 let json=null,binStart=-1,offset=12;
 while(offset+8<=raw.length){
  const size=raw.readUInt32LE(offset),type=raw.readUInt32LE(offset+4);
  const start=offset+8;
  if(type===0x4e4f534a)json=JSON.parse(raw.subarray(start,start+size).toString("utf8"));
  if(type===0x004e4942)binStart=start;
  offset=start+size;
 }
 assert.ok(json&&binStart>=0);
 const images=(json.images||[]).map(image=>{
  assert.ok(Number.isInteger(image.bufferView),"image must be embedded");
  const view=json.bufferViews[image.bufferView];
  return raw.subarray(binStart+(view.byteOffset||0),binStart+(view.byteOffset||0)+view.byteLength);
 });
 return {json,images};
}
async function pixelKeys(images){
 const keys=[];
 for(const image of images){
  const {data,info}=await sharp(image).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  keys.push(info.width+"x"+info.height+":"+crypto.createHash("sha256").update(data).digest("hex"));
 }
 return keys.sort();
}
(async()=>{
 const original=readImages("build/ren-original-before-webp.glb");
 const lossless=readImages("build/ren-webp-lossless.glb");
 assert.equal(original.images.length,lossless.images.length);
 assert.deepEqual(await pixelKeys(lossless.images),await pixelKeys(original.images));
 assert.deepEqual((lossless.json.animations||[]).map(a=>a.name).sort(),
  (original.json.animations||[]).map(a=>a.name).sort());
 assert.equal(lossless.json.skins?.[0]?.joints?.length,original.json.skins?.[0]?.joints?.length);
 console.log("REN_LOSSLESS_PIXEL_CHECK="+JSON.stringify({matchedTextures:original.images.length,
  joints:lossless.json.skins[0].joints.length,animations:lossless.json.animations.length,pixelExact:true}));
})().catch(error=>{console.error(error);process.exitCode=1;});
