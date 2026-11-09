"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const buf=fs.readFileSync(path.join(__dirname,"..","assets","env010","gorge-strata-v1.glb"));
const jsonSize=buf.readUInt32LE(12);
const model=JSON.parse(buf.subarray(20,20+jsonSize).toString("utf8"));
const binaryStart=28+jsonSize;
function attribute(mesh,id,index){
 const primitive=mesh.primitives[0],accessor=model.accessors[primitive.attributes[id]];
 const view=model.bufferViews[accessor.bufferView],components=id==="TEXCOORD_0"?2:3;
 assert.equal(accessor.componentType,5126);
 const off=binaryStart+view.byteOffset+(accessor.byteOffset||0)+index*components*4;
 return Array.from({length:components},(_,k)=>buf.readFloatLE(off+k*4));
}
test("ENV010 volumetric cliffs have seamless side UVs and upward-facing sculpted crowns",()=>{
 const SIDE=27,BANDS=18,SEG=26,perBody=SIDE*(BANDS+1)+2*SEG+2;
 assert.equal(model.meshes.length,3);
 for(const mesh of model.meshes){
  const primitive=mesh.primitives[0];
  assert.equal(model.accessors[primitive.attributes.POSITION].count,3*perBody);
  for(let part=0;part<3;part++){
   const start=part*perBody,roof=start+SIDE*(BANDS+1);
   // The duplicated UV seam must occupy the same position on each ring;
   // otherwise the single photogrammetry material stretches over one face.
   for(const level of [0,4,12,18]){
    const a=start+level*SIDE,b=a+SEG;
    const pa=attribute(mesh,"POSITION",a),pb=attribute(mesh,"POSITION",b);
    assert.ok(pa.every((v,k)=>Math.abs(v-pb[k])<.0001),"side seam must be welded spatially");
    const ua=attribute(mesh,"TEXCOORD_0",a),ub=attribute(mesh,"TEXCOORD_0",b);
    assert.ok(ub[0]-ua[0]>2,"texture coordinate resets only across duplicated seam");
   }
   const roofY=[];
   let upward=0;
   for(let i=0;i<SEG;i++){
    const top=attribute(mesh,"POSITION",start+i);
    roofY.push(top[1]);
    const n=attribute(mesh,"NORMAL",roof+i);
    if(n[1]>.15)upward++;
   }
   assert.ok(upward>=20,"roof normals must point towards sky, not create black bowls");
   const center=attribute(mesh,"POSITION",roof+2*SEG);
   const averageTop=roofY.reduce((a,b)=>a+b,0)/SEG;
   assert.ok(center[1]>averageTop+1,"upper ridge must not form a sunken flat cap");
   const bottom=attribute(mesh,"POSITION",roof+2*SEG+1);
   assert.ok(bottom[1]<Math.min(...roofY)-65,"body extends into ravine, not a thin decorative sheet");
   // Each form has width in BOTH horizontal dimensions, not a linear backdrop.
   const cameraX=[],cameraDepth=[];
   for(let i=0;i<SEG;i++){
    const p=attribute(mesh,"POSITION",start+i);
    cameraX.push((p[0]-p[2])*Math.SQRT1_2);
    cameraDepth.push((p[0]+p[2])*Math.SQRT1_2);
   }
   assert.ok(Math.max(...cameraX)-Math.min(...cameraX)>15);
   assert.ok(Math.max(...cameraDepth)-Math.min(...cameraDepth)>15);
  }
 }
});
