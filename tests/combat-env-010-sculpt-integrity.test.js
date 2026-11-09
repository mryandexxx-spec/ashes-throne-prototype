"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const bin=fs.readFileSync(path.join(__dirname,"..","assets","env010","gorge-strata-v1.glb"));
const jsonLen=bin.readUInt32LE(12),g=JSON.parse(bin.subarray(20,20+jsonLen).toString("utf8")),start=28+jsonLen;
function get(mesh,name,i){
 const attr=g.meshes[mesh].primitives[0].attributes[name],acc=g.accessors[attr],v=g.bufferViews[acc.bufferView];
 const n=name==="TEXCOORD_0"?2:3,offset=start+v.byteOffset+(acc.byteOffset||0)+i*n*4;
 return Array.from({length:n},(_,k)=>bin.readFloatLE(offset+k*4));
}
test("two solid banks have a continuous winding common valley floor",()=>{
 const S=86,C=23,W=13,top=(S+1)*(C+1),per=top+(S+1)*2;
 assert.equal(g.meshes.length,4);
 for(const side of [0,1]){
  assert.equal(g.accessors[g.meshes[side].primitives[0].attributes.POSITION].count,per);
  let normalsUp=0;
  for(let j=0;j<=S;j+=7){
   const crown=get(side,"NORMAL",j*(C+1)+Math.round(C*.58));
   if(crown[1]>.05)normalsUp++;
  }
  assert.ok(normalsUp>=8,"surface crest normals should face sky");
 }
 assert.equal(g.accessors[g.meshes[2].primitives[0].attributes.POSITION].count,(S+1)*(W+1));
 assert.ok(g.accessors[g.meshes[3].primitives[0].attributes.POSITION].count>1000,"distant ridge is a separate 3D material group");
 for(let j=0;j<=S;j+=6){
  const left=get(0,"POSITION",j*(C+1)),right=get(1,"POSITION",j*(C+1));
  const f0=get(2,"POSITION",j*(W+1)),f1=get(2,"POSITION",j*(W+1)+W);
  const close=(a,b)=>a.every((v,k)=>Math.abs(v-b[k])<.002);
  assert.ok(close(left,f0),"left floor join at row "+j);
  assert.ok(close(right,f1),"right floor join at row "+j);
 }
 const centers=[];
 for(let j=0;j<=S;j+=11){
  const p=get(2,"POSITION",j*(W+1)+Math.floor(W/2));
  centers.push((p[0]-p[2])*Math.SQRT1_2);
 }
 assert.ok(Math.max(...centers)-Math.min(...centers)>9,"gorge centerline bends");
 // All geometry must lie in FRONT of the fixed sky plane; otherwise Babylon
 // depth-testing hides the distant landforms behind the opaque sky material.
 for(let m=0;m<4;m++){
  const accessor=g.accessors[g.meshes[m].primitives[0].attributes.POSITION];
  let maxDepth=-Infinity;
  for(let i=0;i<accessor.count;i++){
   const p=get(m,"POSITION",i);
   maxDepth=Math.max(maxDepth,(p[0]+p[2])*Math.SQRT1_2);
  }
  assert.ok(maxDepth<187,"scenic landform must not be occluded by sky plane");
 }

});
