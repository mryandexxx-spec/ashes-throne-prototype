"use strict";
/* ENV016 — offline fractured rock erosion sculpture, not runtime piles.
 * The first surface is a radial C0 continuation of ENV009's exact r=2.42
 * erosion profile; other layers are physically thick cliffs far across the
 * gorge. No random placement, symmetric wings, floating rock caps or river.
 * This is a non-canonical combat prototype, not regional world geography.
 */
function createEnv016Glb(){
 const TAU=Math.PI*2,SQ=Math.SQRT1_2,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 const mix=(a,b,t)=>a+(b-a)*t;
 const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
 const world=(l,d,y)=>[(l+d)*SQ,y,(d-l)*SQ];
 const color3=(a,b,t)=>a.map((v,i)=>mix(v,b[i],t));
 const geo=(name,cols,rows,point,col)=>{
  const asset={name,positions:[],uvs:[],colors:[],indices:[],normals:[]};
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
   const u=i/cols,v=j/rows;
   const [x,y,z]=point(u,v,i,j);
   asset.positions.push(x,y,z);
   asset.uvs.push(x*.067+z*.017,y*.074+z*.012);
   const shade=col(x,y,z,u,v);
   asset.colors.push(...shade.map(t=>Math.round(clamp(t,0,1)*255)),255);
   asset.normals.push(0,0,0);
  }
  const stride=cols+1;
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
   const a=j*stride+i,b=a+stride;
   asset.indices.push(a,b,a+1,a+1,b,b+1);
  }
  return asset;
 };
 const rimPoint=(r,a)=>{
  const rough=1+.045*Math.sin(5*a+.4)+.023*Math.sin(11*a+1.3)+.012*Math.sin(23*a+2.1);
  const fan=1+.065*Math.sin(3*a-.3);
  return [Math.cos(a)*9.15*r*rough*fan,Math.sin(a)*5.85*r*rough];
 };
 // Cohesive, spatially varying strata: geology follows coherent 3D
 // contour systems, not a repeating sawtooth, square grid or flat plate.
 const strain=(x,y,z)=>.57*Math.sin(x*.26+z*.13)+
  .27*Math.sin(x*.63-z*.41+y*.08)+.16*Math.sin(x*1.13+z*.81+y*.14);
 const strat=(l,d,y)=>.065*Math.sin(y*.23+l*.035)+
  .030*Math.sin(y*.53+d*.045)+.025*Math.sin(l*.19+d*.17);
 function rockTint(base,x,y,z,v,fog=0){
  const relief=1+strat(x,z,y)-.14*v;
  const f=clamp(fog,0,.83);
  return base.map((c,i)=>mix(c*relief,[.65,.72,.76][i],f));
 }
 // The *entire* original outer r=2.42 is welded by exact positions and
 // height -9.9; no sudden separate band, platform, seam or visible end cap.
 function mantleHeight(r,a){
  const t=clamp((r-2.42)/(10.8-2.42),0,1);
  const right=Math.cos(a+Math.PI/4),away=Math.cos(a-Math.PI/4);
  const leftRear=smooth((-.18-right)/.85)*smooth((away+.10)/.75);
  const rightDrop=smooth((right+.06)/.95)*smooth((away+.18)/.70);
  const foreground=smooth((-away+.05)/.75);
  // Multi-scale fault network: joints wander with depth instead of making
  // a continuous smooth ring or a repeating mountain ridge.
  const band=Math.sin(10.5*t+1.8*Math.sin(a*4.2))*
    Math.sin(a*7.5+1.4*t);
  const faults=Math.abs(Math.sin(a*6.1+2.5*t+.5*Math.sin(a*13.3)));
  const incision=Math.pow(faults,18)*7.5*smooth(t)*(.65+.35*Math.sin(7*t)**2);
  const benches=(smooth((t-.18)/.10)-smooth((t-.29)/.10))*1.8+
    (smooth((t-.46)/.08)-smooth((t-.58)/.10))*2.7;
  const erosion=(1.3*Math.sin(a*9.2+r*.47)+.85*Math.sin(a*19.1-r*.81)+
    .42*Math.sin(a*31.0+3.4*t))*t*(1-.4*t);
  const contactChannel=(.75*Math.sin(a*6+.4)+.42*Math.sin(a*13-1.1))*(1-smooth(t));
  // No high left wall: low rising shoulder with beds and gullies.
  return -9.9+contactChannel-23*t+5.4*leftRear*smooth(t)-
    29*rightDrop*t-11*foreground*t+erosion+benches+
    1.1*band*t-incision;
 }
 function makeAttachedMass(){
  return geo("attached_living_rock",96,22,(u,v)=>{
   const a=u*TAU,r=2.42+8.38*v;
   const [x,z]=rimPoint(r,a);
   return [x,mantleHeight(r,a),z];
  },(x,y,z,u,v)=>rockTint([.54,.49,.42],x,y,z,v,.06+.22*v));
 }
 // A broad, irregular *volume* with front/back cliff faces and a rough
 // top: unlike old strip planes it keeps geometric thickness and relief.
 const ridge=[
  [-200,-111,98],[-145,-96,101],[-80,-84,106],[-15,-70,111],
  [35,-68,116],[72,-59,119],[115,-64,123],
  [164,-75,131],[221,-92,140],[290,-126,153]
 ];
 function crest(l){
  for(let i=1;i<ridge.length;i++)if(l<=ridge[i][0]){
   const a=ridge[i-1],b=ridge[i],t=smooth((l-a[0])/(b[0]-a[0]));
   return [mix(a[1],b[1],t)+
     1.5*Math.sin(l*.094)+.65*Math.sin(l*.23),
     mix(a[2],b[2],t)+2*Math.sin(l*.055)];
  }
  return ridge[ridge.length-1].slice(1);
 }
 function makeOppositeMass(){
  const name="far_opposite_mass",cols=92,rows=17;
  const a=geo(name,cols,rows,(u,v)=>{
   const l=mix(-200,290,u),[top,d]=crest(l);
   const joints=Math.abs(Math.sin(l*.083+2.7*v+.45*Math.sin(l*.19)));
   const notch=Math.pow(joints,22)*3.5*v;
   const pocket=Math.sin(l*.10-v*11)*1.8+
     Math.sin(l*.35+v*29)*.75;
   const ledge=(2.2*Math.sin(v*24+l*.035)+.65*Math.sin(v*47+l*.08))*v-
     notch;
   const drop=(2*v+107*v*v)+3*Math.sin(6*v)*v;
   return world(l+(ledge*.18),d+5.0*v+ledge+pocket*v,top-drop);
  },(x,y,z,u,v)=>rockTint([.54,.57,.56],x,y,z,v,.30+.38*v));
  // Put a genuinely deep rear rock face in the same GLB mesh.
  const offset=a.positions.length/3;
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
   const u=i/cols,v=j/rows,l=mix(-200,290,u),[top,d]=crest(l);
   const y=top-3-108*v*v-5*v;
   const xyz=world(l+10+2*Math.sin(l*.09+v*3),d+19+7*v,y);
   a.positions.push(...xyz);
   a.uvs.push(xyz[0]*.075+xyz[2]*.017,y*.075);
   a.colors.push(...rockTint([.48,.54,.55],...xyz,v,.45+.40*v).map(t=>Math.round(clamp(t,0,1)*255)),255);
   a.normals.push(0,0,0);
  }
  const stride=cols+1;
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
   const x=offset+j*stride+i,y=x+stride;
   a.indices.push(x+1,y,x,x+1,y+1,y);
  }
  for(let i=0;i<cols;i++){
   const front=i,back=offset+i;
   a.indices.push(front,front+1,back,front+1,back+1,back);
  }
  // End caps are outside fixed field of view; rock mass is not a curtain.
  for(const col of [0,cols])for(let j=0;j<rows;j++){
   const p=j*stride+col,q=p+stride;
   a.indices.push(p,offset+p,q,q,offset+p,offset+q);
  }
  return a;
 }
 // Solid angular collapse blocks: closed irregular polyhedra derived from
 // mapped fault lines, not a smooth cloth-like strip over the cliff.
 // All positions are evaluated against the same real near-bank mantle.
 function makeTalus(){
  const mesh={name:"fractured_talus",positions:[],uvs:[],colors:[],indices:[],normals:[]};
  const radialBands=[2.84,3.29,3.78,4.25,4.82,5.46,6.24,7.10];
  const azimuths=[.24,.43,.61,.80,1.04,1.23,1.46,1.67,1.89,2.12,
    2.37,2.61,2.86,3.11,3.36,3.61,3.88,4.10,4.34,4.58,4.82,5.07,5.31,5.56,5.82];
  let count=0;
  for(let j=0;j<radialBands.length;j++)for(let k=0;k<azimuths.length;k++){
   // Sparse clusters follow alternating joint sets. Each piece has its own
   // oriented bounding volume, bevel ring and physical underside.
   if((k*7+j*11)%9>2)continue;
   const angle=azimuths[k]+.032*Math.sin(k*2.9+j),r=radialBands[j];
   const [cx,cz]=rimPoint(r,angle),cy=mantleHeight(r,angle);
   const radius=.56+.38*((j*3+k*5)%7)/6;
   const rise=.52+.62*((k+j*2)%5)/4;
   const base=mesh.positions.length/3;
   const n=7,skew=.3*Math.sin(k+j*2.7);
   for(let ring=0;ring<2;ring++)for(let e=0;e<n;e++){
    const a=e*TAU/n+skew;
    const wobble=1+.16*Math.sin(e*2.4+k*.71+j*2.3);
    const rad=radius*wobble*(ring===0?1:.73);
    const vx=cx+Math.cos(a)*rad;
    const vz=cz+Math.sin(a)*rad*.82;
    const vy=cy+(ring===0?-.22:rise)+.20*Math.sin(a*3+k);
    mesh.positions.push(vx,vy,vz);
    mesh.uvs.push(vx*.09+vz*.03,vy*.09);
    mesh.colors.push(...rockTint([.57,.525,.465],vx,vy,vz,ring,.10+.07*j).map(t=>Math.round(clamp(t,0,1)*255)),255);
    mesh.normals.push(0,0,0);
   }
   for(let e=0;e<n;e++){
    const q=(e+1)%n;
    mesh.indices.push(base+e,base+q,base+n+e,base+q,base+n+q,base+n+e);
   }
   for(let e=1;e<n-1;e++){
    mesh.indices.push(base+n,base+n+e,base+n+e+1);
    mesh.indices.push(base,base+e+1,base+e);
   }
   count++;
  }
  if(count<20)throw Error("missing fractured clusters");
  return mesh;
 }
 function makeFarWall(){
  return geo("distant_layered_ridge",72,9,(u,v)=>{
   const l=mix(-250,350,u);
   const top=-125+11*Math.sin(l*.024)+3*Math.sin(l*.057+1);
   const d=225+25*Math.sin(l*.005+.5)+16*v;
   const y=top-90*v*v;
   return world(l+4*Math.sin(l*.04)*v,d,y);
  },(x,y,z,u,v)=>rockTint([.62,.65,.65],x,y,z,v,.67+.22*v));
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
 const assets=[makeAttachedMass(),makeOppositeMass(),makeTalus(),makeFarWall()].map(computeNormals);

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
 const target=path.join(__dirname,"..","assets","env016","fractured-gorge-v1.glb");
 const result=createEnv016Glb();
 fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.writeFileSync(target,Buffer.from(result.bytes));
 console.log(JSON.stringify({target,bytes:result.bytes.length,meshes:result.stats}));
}
if(typeof module!=="undefined"&&module.exports)module.exports=createEnv016Glb;
