"use strict";
/* COMBAT-ENV-010: original authored strata, not real or canonical geography.
 * Exports a standards-compliant, non-animated glTF 2.0 GLB (three COLOR_0
 * meshes) from hand-authored silhouettes and stepped cliff cross-sections.
 * Run: node tools/env010-gorge-export.cjs
 * No npm packages, commercial assets or network calls.
 */
function createEnv010Glb(){
 const LAYERS=[
 {name:"front_buttress",d:43,span:116,columns:96,scale:1,palette:[.345,.365,.354],haze:0,
  profile:[[-116,-56],[-103,-44],[-91,-30],[-83,-24],[-76,-23],[-71,-28],[-64,-29],[-58,-34],[-52,-39],[-46,-47],[-33,-52],[-22,-56],[-11,-64],[2,-66],[14,-60],[24,-54],[33,-46],[42,-34],[49,-31],[56,-32],[62,-35],[69,-41],[77,-43],[89,-49],[101,-57],[116,-64]],
  gullies:[[-94,4,4],[-67,3,5],[-47,5,4],[21,6,3],[72,5,5]]},
 {name:"middle_terraces",d:68,span:135,columns:80,scale:.92,palette:[.45,.47,.455],haze:.09,
  profile:[[-135,-67],[-119,-61],[-110,-44],[-97,-39],[-87,-39],[-79,-45],[-71,-46],[-61,-43],[-53,-42],[-46,-48],[-38,-52],[-27,-64],[-11,-70],[3,-70],[19,-60],[33,-48],[43,-47],[52,-53],[66,-49],[75,-42],[88,-45],[99,-51],[113,-56],[135,-65]],
  gullies:[[-115,5,4],[-73,5,5],[-32,5,3],[32,6,6],[92,5,4]]},
 {name:"pale_horizon",d:97,span:150,columns:64,scale:.82,palette:[.56,.585,.573],haze:.22,
  profile:[[-150,-81],[-135,-74],[-122,-68],[-115,-58],[-102,-58],[-94,-62],[-80,-67],[-67,-56],[-56,-54],[-45,-60],[-30,-70],[-11,-77],[8,-79],[25,-73],[45,-66],[59,-58],[72,-56],[85,-61],[104,-65],[119,-70],[150,-77]],
  gullies:[[-97,5,3],[-59,5,2],[49,6,3],[111,7,3]]}
 ];
 const OFFSETS=[0,-1.4,-3.2,-6.4,-9.3,-13.7,-17.3,-21.0,-26.2,-32.7,-39.5,-47.5,-57.8,-71.0,-89.0,-112.0];
 const DEPTH=[-1.7,-1.5,-1.8,-.2,.65,-.65,-1.2,.9,1.8,.05,-1.5,.25,1.15,2.2,4.1,7.5];
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function ridgeHeight(profile,x){
  for(let k=1;k<profile.length;k++)if(x<=profile[k][0]){
   const a=profile[k-1],b=profile[k],t=clamp((x-a[0])/(b[0]-a[0]),0,1);
   // Rock has broad, asymmetric, hand-positioned shoulders, NOT sine-wave peaks.
   return a[1]+(b[1]-a[1])*t;
  }return profile[profile.length-1][1];
 }
 function ridgeVertex(L,x,row){
  let cut=0,fracture=0;
  for(const [at,width,depth] of L.gullies){
   const q=Math.abs(x-at)/width;
   const s=q<1?(1-q)*(1-q):0;
   cut+=depth*s;
   fracture+=s;
  }
  const t=row/(OFFSETS.length-1);
  const beds=DEPTH[row]*L.scale;
  // Alternate high ledges and recessed faces. Real thickness in depth,
  // asymmetric buttresses and narrow eroded gullies form meaningful relief.
  const elbow=1.55*Math.max(0,1-Math.abs((x+35)/17))+
   1.1*Math.max(0,1-Math.abs((x-57)/14));
  const weather=(Math.sin(x*.16+row*.58)+.37*Math.sin(x*.41-row*.91))*
      (.38+1.45*t)*L.scale;
  const y=ridgeHeight(L.profile,x)-cut*(1-.65*t)+OFFSETS[row]*L.scale+
       .55*Math.sin(x*.28+row*.7)*(.2+.8*t);
  const d=L.d+beds+weather+elbow*(1-.6*t)+
     cut*(1-.15*t)*.72;
  return [d*Math.SQRT1_2+x*Math.SQRT1_2,y,d*Math.SQRT1_2-x*Math.SQRT1_2,fracture];
 }
 function stoneColor(L,row,x,fracture,lower){
  const p=L.palette;
  // Broad geological colour bands follow *horizontal* strata, not random
  // speckles. Dark undercuts are paired with real geometry ledges.
  const strata=[1.12,1.1,.96,.89,1.10,.91,.80,1.04,.86,1.02,.91,1.08,.88,.85,.8][Math.min(row,14)];
  const ribs=.045*Math.sin(x*.087+row*.41)+.023*Math.cos(x*.22-row*.51);
  const tonal=strata+ribs-.21*fracture+ (lower?-.045:.025);
  const warmth=row===3||row===8?.024:0;
  const haze=L.haze;
  return [
   clamp((p[0]*tonal+warmth)*(1-haze)+.60*haze,0,1),
   clamp((p[1]*tonal+warmth*.48)*(1-haze)+.64*haze,0,1),
   clamp(p[2]*tonal*(1-haze)+.64*haze,0,1),255
  ].map((v,i)=>i===3?255:Math.round(v*255));
 }
 function layerMesh(L){
  const positions=[],colors=[],uvs=[],indices=[],normals=[];
  function vertex(x,row,isLower){
   const [px,py,pz,fracture]=ridgeVertex(L,x,row);
   positions.push(px,py,pz);
   const c=stoneColor(L,Math.min(row,14),x,fracture,isLower);
   colors.push(...c);
   uvs.push(x*.075,(py+90)*.056);
  }
  // Independent strips deliberately split the hard edges of each bed.
  // Computing normals on separate strips makes ledges *look like stone*,
  // rather than silently smoothing the whole cliff into an oval.
  const xAt=i=>(i/L.columns*2-1)*L.span;
  for(let j=0;j<OFFSETS.length-1;j++){
   const start=positions.length/3;
   for(let i=0;i<=L.columns;i++){
    const x=xAt(i);vertex(x,j,false);vertex(x,j+1,true);
   }
   for(let i=0;i<L.columns;i++){
    const a=start+2*i,b=a+2;
    indices.push(a,b,a+1,b,b+1,a+1);
   }
  }
  // Broad receding ridge cap: actual volume behind the skyline, not a
  // screen-facing sheet. Only one cap strip, for low draw and vertex cost.
  const start=positions.length/3;
  for(let i=0;i<=L.columns;i++){
   const x=xAt(i),f=ridgeVertex(L,x,0);
   vertex(x,0,false);
   positions.push(f[0]+Math.SQRT1_2*9.5,f[1]-2.2,f[2]+Math.SQRT1_2*9.5);
   colors.push(...stoneColor(L,0,x,0,true));
   uvs.push(x*.075,1);
  }
  for(let i=0;i<L.columns;i++){
   const a=start+i*2,b=a+2;indices.push(a,a+1,b,b,a+1,b+1);
  }
  // Normal accumulation stays within each purposefully hard-edged strip.
  for(let i=0;i<positions.length;i++)normals.push(0);
  for(let i=0;i<indices.length;i+=3){
   const ia=indices[i]*3,ib=indices[i+1]*3,ic=indices[i+2]*3;
   const ax=positions[ib]-positions[ia],ay=positions[ib+1]-positions[ia+1],az=positions[ib+2]-positions[ia+2];
   const bx=positions[ic]-positions[ia],by=positions[ic+1]-positions[ia+1],bz=positions[ic+2]-positions[ia+2];
   const nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;
   for(const k of [ia,ib,ic]){normals[k]+=nx;normals[k+1]+=ny;normals[k+2]+=nz;}
  }
  for(let i=0;i<normals.length;i+=3){
   const length=Math.hypot(normals[i],normals[i+1],normals[i+2])||1;
   normals[i]/=length;normals[i+1]/=length;normals[i+2]/=length;
  }
  return {name:L.name,positions,normals,colors,uvs,indices};
 }
 const assets=LAYERS.map(layerMesh);
 const bin=[],bufferViews=[],accessors=[],meshes=[],nodes=[];
 const pad=()=>{while(bin.length%4)bin.push(0);};
 const bufferView=(bytes,target)=>{
  pad();const offset=bin.length;for(const b of bytes)bin.push(b);
  const ix=bufferViews.length;bufferViews.push({buffer:0,byteOffset:offset,byteLength:bytes.length,target});return ix;
 };
 const f32=(values)=>{const bytes=new Uint8Array(values.length*4),v=new DataView(bytes.buffer);values.forEach((a,i)=>v.setFloat32(i*4,a,true));return bytes;};
 const u16=(values)=>{const bytes=new Uint8Array(values.length*2),v=new DataView(bytes.buffer);values.forEach((a,i)=>v.setUint16(i*2,a,true));return bytes;};
 const accessor=(view,componentType,count,type,options={})=>{
  const i=accessors.length;accessors.push({bufferView:view,componentType,count,type,...options});return i;
 };
 for(const a of assets){
  const count=a.positions.length/3;
  if(count>65535)throw Error("vertex count exceeds UINT16");
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(let k=0;k<a.positions.length;k++)min[k%3]=Math.min(min[k%3],a.positions[k]),max[k%3]=Math.max(max[k%3],a.positions[k]);
  const attr={
   POSITION:accessor(bufferView(f32(a.positions),34962),5126,count,"VEC3",{min,max}),
   NORMAL:accessor(bufferView(f32(a.normals),34962),5126,count,"VEC3"),
   COLOR_0:accessor(bufferView(new Uint8Array(a.colors),34962),5121,count,"VEC4",{normalized:true}),
   TEXCOORD_0:accessor(bufferView(f32(a.uvs),34962),5126,count,"VEC2")
  };
  const ix=accessor(bufferView(u16(a.indices),34963),5123,a.indices.length,"SCALAR");
  meshes.push({name:a.name,primitives:[{attributes:attr,indices:ix,material:0,mode:4}]});
  nodes.push({mesh:meshes.length-1,name:a.name});
 }
 pad();
 const gltf={
  asset:{version:"2.0",generator:"Ashes Throne original authored geological strata exporter"},
  scene:0,scenes:[{nodes:nodes.map((_,i)=>i)}],nodes,meshes,
  buffers:[{byteLength:bin.length}],bufferViews,accessors,
  materials:[{name:"layered-stone-vertex-colors",doubleSided:true,
   pbrMetallicRoughness:{baseColorFactor:[1,1,1,1],metallicFactor:0,roughnessFactor:1}}]
 };
 const json=JSON.stringify(gltf),jsonBytes=[];
 for(let i=0;i<json.length;i++){const code=json.charCodeAt(i);if(code>127)throw Error("GLB JSON must be ASCII");jsonBytes.push(code);}
 while(jsonBytes.length%4)jsonBytes.push(32);
 const total=12+8+jsonBytes.length+8+bin.length;
 const out=new Uint8Array(total),head=new DataView(out.buffer);
 head.setUint32(0,0x46546c67,true);head.setUint32(4,2,true);head.setUint32(8,total,true);
 head.setUint32(12,jsonBytes.length,true);head.setUint32(16,0x4e4f534a,true);
 out.set(jsonBytes,20);
 let at=20+jsonBytes.length;
 head.setUint32(at,bin.length,true);head.setUint32(at+4,0x004e4942,true);
 out.set(bin,at+8);
 return {bytes:out,stats:assets.map(a=>({name:a.name,vertices:a.positions.length/3,triangles:a.indices.length/3})),json:gltf};
}
if(typeof require==="function"&&typeof module!=="undefined"&&require.main===module){
 const fs=require("node:fs"),path=require("node:path");
 const target=path.join(__dirname,"..","assets","env010","gorge-strata-v1.glb");
 const result=createEnv010Glb();
 fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.writeFileSync(target,Buffer.from(result.bytes));
 console.log(JSON.stringify({target,bytes:result.bytes.length,meshes:result.stats}));
}
if(typeof module!=="undefined"&&module.exports)module.exports=createEnv010Glb;
