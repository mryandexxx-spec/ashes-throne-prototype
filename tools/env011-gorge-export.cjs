"use strict";
/* COMBAT-ENV-011 — authored low-relief canyon in a fixed 3/4 projection.
 * Original, non-canonical composition; not a Blender sculpt.
 * GLB is deterministic; zero extra runtime libraries.
 */
function createEnv011Glb(){

 const SQ=Math.SQRT1_2,N=78,CROSS=23,WIDTH=15,FAR_ROWS=16;
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
 const interp=(pairs,t)=>{for(let i=1;i<pairs.length;i++){const p=pairs[i-1],q=pairs[i];if(t<=q[0])return p[1]+(q[1]-p[1])*clamp((t-p[0])/(q[0]-p[0]),0,1);}return pairs[pairs.length-1][1];};
 const center=d=>interp([[9,0],[21,1.5],[37,-1],[55,-4],[73,-2],[94,3],[120,6]],d);
 const width=d=>interp([[9,4.6],[21,5.5],[37,8.2],[55,11],[73,13.5],[94,16],[120,20]],d);
 const bed=d=>interp([[9,-3.7],[19,-6.1],[37,-12.5],[55,-18.7],[75,-25.5],[95,-32.8],[120,-43]],d);
 const world=(x,d,y)=>[(d+x)*SQ,y,(d-x)*SQ];
 const rowD=j=>9+(120-9)*j/N;
 const palette=c=>c.map(x=>Math.round(255*clamp(x,0,1)));
 const profile=[[0,0,0],[.075,1.3,.3],[.16,3.2,1.1],[.26,5,3.2],[.38,7.2,6.7],[.49,10,11],[.61,13.5,13],[.73,17,12],[.84,21,7],[1,29,-1]];
 function evaluate(side,u,d){
  const found=profile.findIndex((p,i)=>i>0&&p[0]>=u);
  const k=Math.min(profile.length-2,Math.max(0,found-1)),a=profile[k],b=profile[k+1];
  const v=smooth(a[0],b[0],u),dist=a[1]+(b[1]-a[1])*v,elev=a[2]+(b[2]-a[2])*v;
  const fracture=(1.2*Math.sin(d*.13+side*.9)+.7*Math.sin(d*.31+u*4))*Math.sin(u*Math.PI);
  const notch=(Math.exp(-Math.pow((d-(side<0?47:75))/6,2))*2.2+Math.exp(-Math.pow((d-99)/4.5,2))*1.2)*smooth(.18,.65,u);
  const talus=1.2*Math.exp(-Math.pow((d-(side<0?32:68))/15,2))*Math.sin(u*Math.PI)*smooth(.08,.30,u);
  const gain=.19+.75*smooth(9,50,d);
  return {x:center(d)+side*(width(d)+dist+.5*fracture*smooth(.30,.70,u)),
   y:bed(d)+elev*gain+fracture*.35-notch+talus,d};
 }
 function bankColor(side,u,d,y){
  const haze=.04+.38*smooth(18,120,d),shade=.036*Math.sin(y*.44+d*.20+side)+.025*Math.cos(d*.35+u*9);
  const scree=smooth(.03,.17,u)*(1-smooth(.26,.45,u)),stone=side<0?[.55,.47,.365]:[.52,.485,.42];
  return [...palette(stone.map((v,i)=>v*(1-haze)+[.64,.68,.68][i]*haze+shade+.05*scree*(i<2?1:.5))),255];
 }
 function bankMesh(side,name){
  const positions=[],uvs=[],colors=[],indices=[];
  for(let j=0;j<=N;j++){
   const d=rowD(j);
   for(let i=0;i<=CROSS;i++){
    const u=i/CROSS,s=evaluate(side,u,d);
    positions.push(...world(s.x,s.d,s.y));uvs.push(d*.055+u*.08,s.y*.11+u*.48);
    colors.push(...bankColor(side,u,d,s.y));
   }
  }
  for(let j=0;j<N;j++)for(let i=0;i<CROSS;i++){
   const a=j*(CROSS+1)+i,b=a+1,c=a+CROSS+1,e=c+1;
   if(side<0)indices.push(a,b,c,b,e,c);else indices.push(a,c,b,b,c,e);
  }
  return {name,positions,uvs,colors,indices,normals:new Array(positions.length).fill(0)};
 }
 function valleyMesh(){
  const positions=[],uvs=[],colors=[],indices=[];
  for(let j=0;j<=N;j++){
   const d=rowD(j),w=width(d),cx=center(d);
   for(let i=0;i<=WIDTH;i++){
    const u=i/WIDTH*2-1,x=cx+w*u;
    const fine=.38*(1-u*u)*Math.sin(d*.23+u*5)+.12*Math.sin(d*.46+u*10)*(1-u*u);
    const y=bed(d)+fine;
    positions.push(...world(x,d,y));uvs.push(d*.06,u*1.8);
    const haze=.27*smooth(35,120,d),sand=.02*Math.sin(d*.21+u*13);
    colors.push(...palette([.65-sand-.06*haze,.615-sand+.07*haze,.52-sand+.16*haze]),255);
   }
  }
  for(let j=0;j<N;j++)for(let i=0;i<WIDTH;i++){
   const a=j*(WIDTH+1)+i,b=a+1,c=a+WIDTH+1,e=c+1;indices.push(a,c,b,b,c,e);
  }
  return {name:"gorge_floor",positions,uvs,colors,indices,normals:new Array(positions.length).fill(0)};
 }
 function distantMesh(){
  const positions=[],uvs=[],colors=[],indices=[],COLS=52;
  for(let j=0;j<=FAR_ROWS;j++){
   const d=118+j*2.6;
   for(let i=0;i<=COLS;i++){
    const x=-79+i*158/COLS,u=x/79;
    const basin=-44-6*(1-u*u),shoulders=7*Math.exp(-Math.pow((Math.abs(x)-47)/17,2));
    const y=basin+shoulders+2.5*Math.sin(x*.065+j*.17)-1.65*j;
    positions.push(...world(x,d,y));uvs.push(x*.036,y*.09);
    const depth=j/FAR_ROWS,shade=.02*Math.sin(x*.092+j*.54);
    colors.push(...palette([.54+.10*depth+shade,.57+.09*depth+shade,.56+.11*depth+shade]),255);
   }
  }
  for(let j=0;j<FAR_ROWS;j++)for(let i=0;i<COLS;i++){
   const a=j*(COLS+1)+i,b=a+1,c=a+COLS+1,e=c+1;indices.push(a,c,b,b,c,e);
  }
  return {name:"pale_horizon",positions,uvs,colors,indices,normals:new Array(positions.length).fill(0)};
 }
 function computeNormals(asset){
  const {positions,indices,normals}=asset;
  for(let i=0;i<indices.length;i+=3){
   const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
   const ax=positions[b]-positions[a],ay=positions[b+1]-positions[a+1],az=positions[b+2]-positions[a+2];
   const bx=positions[c]-positions[a],by=positions[c+1]-positions[a+1],bz=positions[c+2]-positions[a+2];
   const nx=ay*bz-az*by,ny=az*bx-ax*bz,nz=ax*by-ay*bx;
   for(const k of [a,b,c]){normals[k]+=nx;normals[k+1]+=ny;normals[k+2]+=nz;}
  }
  for(let i=0;i<normals.length;i+=3){
   const len=Math.hypot(normals[i],normals[i+1],normals[i+2])||1;
   normals[i]/=len;normals[i+1]/=len;normals[i+2]/=len;
  }
  return asset;
 }
 const assets=[bankMesh(-1,"front_buttress"),bankMesh(1,"middle_terraces"),valleyMesh(),distantMesh()].map(computeNormals);
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
  asset:{version:"2.0",generator:"Ashes Throne ENV011 open-gorge authored exporter"},
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
 const target=path.join(__dirname,"..","assets","env011","open-gorge-v1.glb");
 const result=createEnv011Glb();
 fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.writeFileSync(target,Buffer.from(result.bytes));
 console.log(JSON.stringify({target,bytes:result.bytes.length,meshes:result.stats}));
}
if(typeof module!=="undefined"&&module.exports)module.exports=createEnv011Glb;
