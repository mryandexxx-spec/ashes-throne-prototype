'use strict';
/* COMBAT-ENV-012A: dependency-free offline composition probe.
 * Not an artistic verdict; measures visibility/occlusion for the fixed
 * 3/4 Babylon camera, using glTF geometry plus ENV009's actual ledge.
 * Usage: node tools/env-composition-audit.cjs [path-to-compatible.glb] [--enforce]
 * Reports relative geometric pixel coverage at default/far camera distances.
 * --enforce is OPT-IN because the accepted main art does not pass the
 * proposed floor visibility threshold. Screenshot review remains mandatory.
 */
const fs=require('node:fs');
const path=require('node:path');
const L=require('../combat-environment-009.js');
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const norm=v=>{const l=Math.hypot(...v);return v.map(n=>n/l)};
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
function readGlb(filename){
 const buf=fs.readFileSync(filename);
 if(buf.readUInt32LE(0)!==0x46546c67||buf.readUInt32LE(4)!==2||buf.readUInt32LE(8)!==buf.length)
  throw Error('invalid GLB header');
 const jsonSize=buf.readUInt32LE(12);
 if(buf.readUInt32LE(16)!==0x4e4f534a||buf.readUInt32LE(20+jsonSize+4)!==0x004e4942)
  throw Error('invalid GLB chunks');
 const gltf=JSON.parse(buf.subarray(20,20+jsonSize).toString('utf8'));
 const bin=buf.subarray(20+jsonSize+8);
 if(gltf.asset?.version!=='2.0'||!Array.isArray(gltf.meshes))throw Error('invalid glTF mesh layout');
 const get=(id)=>{
  const a=gltf.accessors?.[id],v=a?gltf.bufferViews?.[a.bufferView]:null;
  if(!a||!v||v.byteStride||a.sparse)throw Error('unsupported accessor');
  const count={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],size={5121:1,5123:2,5126:4}[a.componentType];
  if(!count||!size)throw Error('unsupported component');
  const out=[],start=v.byteOffset+(a.byteOffset||0);
  for(let i=0;i<a.count*count;i++){
   const off=start+i*size;
   if(off+size>bin.length)throw Error('accessor out of range');
   out.push(size===1?bin.readUInt8(off):size===2?bin.readUInt16LE(off):bin.readFloatLE(off));
  }
  return out;
 };
 return gltf.meshes.map(mesh=>{
  const primitive=mesh.primitives[0];
  return {name:mesh.name,positions:get(primitive.attributes.POSITION),indices:get(primitive.indices)};
 });
}
function ledge(){
 const positions=[],indices=[],n=97;
 for(let row=0;row<L.RADII.length;row++)for(let i=0;i<=96;i++){
  const a=i*2*Math.PI/96,[x,z]=L.rimPoint(L.RADII[row],a);
  const fracture=Math.sin(a*7-.8)*.07+Math.sin(a*17+1.8)*.037;
  positions.push(x,L.HEIGHTS[row]+(L.RADII[row]>.69?(L.RADII[row]-.69)*fracture:0),z);
 }
 for(let j=0;j<L.RADII.length-1;j++)for(let i=0;i<96;i++){
  const a=j*n+i,b=a+n;indices.push(a,b,a+1,a+1,b,b+1);
 }
 return {name:'living_ledge',positions,indices};
}
function ravine(){
 const positions=[],indices=[],radii=[1.25,1.43,1.66,1.91,2.17,2.42];
 for(let row=0;row<radii.length;row++)for(let i=0;i<=96;i++){
  const a=i*2*Math.PI/96,[x,z]=L.rimPoint(radii[row],a);
  const channel=.75*Math.sin(a*6+.4)+.42*Math.sin(a*13-1.1);
  positions.push(x,[-5.1,-7.05,-8.3,-9.15,-9.7,-9.9][row]+channel*(row/5),z);
 }
 for(let j=0;j<radii.length-1;j++)for(let i=0;i<96;i++){
  const a=j*97+i,b=a+97;indices.push(a,b,a+1,a+1,b,b+1);
 }
 return {name:'ravine',positions,indices};
}
function audit(meshes,radius,width=160,height=74){
 const alpha=-3*Math.PI/4,beta=.96,target=[0,.9,0];
 const eye=[target[0]+radius*Math.sin(beta)*Math.cos(alpha),
 target[1]+radius*Math.cos(beta),target[2]+radius*Math.sin(beta)*Math.sin(alpha)];
 const forward=norm(target.map((x,i)=>x-eye[i])),right=norm(cross(forward,[0,1,0])),up=cross(right,forward);
 const fy=height/(2*Math.tan(.8/2)),fx=fy; // vertical field-of-view and square pixel aspect
 const zbuf=new Float64Array(width*height).fill(Infinity);
 const group=new Uint8Array(width*height);
 const names=['sky',...meshes.map(m=>m.name)];
 let checked=0;
 for(let id=0;id<meshes.length;id++){
  const m=meshes[id],v=m.positions,indices=m.indices,proj=[];
  for(let i=0;i<v.length;i+=3){
   const d=[v[i]-eye[0],v[i+1]-eye[1],v[i+2]-eye[2]];
   const z=dot(d,forward);
   proj.push(z>.10?[width/2+fx*dot(d,right)/z,height/2-fy*dot(d,up)/z,z]:null);
  }
  for(let t=0;t<indices.length;t+=3){
   const a=proj[indices[t]],b=proj[indices[t+1]],c=proj[indices[t+2]];
   if(!a||!b||!c)continue;
   const twice=(b[0]-a[0])*(c[1]-a[1])-(c[0]-a[0])*(b[1]-a[1]);
   if(Math.abs(twice)<.001)continue;
   const x0=clamp(Math.floor(Math.min(a[0],b[0],c[0])),0,width-1),
    x1=clamp(Math.ceil(Math.max(a[0],b[0],c[0])),0,width-1),
    y0=clamp(Math.floor(Math.min(a[1],b[1],c[1])),0,height-1),
    y1=clamp(Math.ceil(Math.max(a[1],b[1],c[1])),0,height-1);
   if(x0>x1||y0>y1)continue;
   checked++;
   for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const px=x+.5,py=y+.5;
    const w0=((b[0]-px)*(c[1]-py)-(c[0]-px)*(b[1]-py))/twice;
    const w1=((c[0]-px)*(a[1]-py)-(a[0]-px)*(c[1]-py))/twice;
    const w2=1-w0-w1;
    if(w0<-.00001||w1<-.00001||w2<-.00001)continue;
    const inv=w0/a[2]+w1/b[2]+w2/c[2],z=1/inv;
    const pixel=y*width+x;
    if(z<zbuf[pixel]){zbuf[pixel]=z;group[pixel]=id+1;}
   }
  }
 }
 const counts=Object.fromEntries(names.map(n=>[n,0]));
 for(const p of group)counts[names[p]]++;
 const pct=Object.fromEntries(Object.entries(counts).map(([k,v])=>[k,Math.round(v/width/height*10000)/100]));
 return {radius,screen:{width,height},coverage_percent:pct,triangles_examined:checked};
}
function main(){
 const fileArg=process.argv.slice(2).find(a=>!a.startsWith("--"));
 const filename=fileArg||path.join(__dirname,"../assets/env010/gorge-strata-v1.glb");
 const meshes=[ledge(),ravine(),...readGlb(filename)];
 const report=[12,19].map(radius=>audit(meshes,radius));
 const threshold=5; // [ПРЕДЛОЖЕНИЕ], not an approved art-quality metric.
 const fails=report.filter(r=>(r.coverage_percent.gorge_floor||0)<threshold);
 console.log(JSON.stringify({file:path.basename(filename),floor_min_percent:threshold,
   status:fails.length?"GEOMETRY_OCCLUDED":"FLOOR_VISIBLE",report},null,2));
 if(process.argv.includes("--enforce")&&fails.length)process.exitCode=2;
}
if(require.main===module)main();
module.exports={readGlb,ledge,ravine,audit};