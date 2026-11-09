"use strict";
/* COMBAT-ENV-014 — authored geological cliff sculpture.
 * One deterministic glTF2 GLB built OFFLINE from explicit hand-positioned
 * rock contour lines. No random rocks, no runtime terrain generator, no
 * topology assumptions from an overhead camera; 3D forms have true depth.
 * A non-canonical demo environment, not a map of the Gardens.
 * Run: node tools/env014-gorge-export.cjs
 */
function createEnv014Glb(){
 const SQ=Math.SQRT1_2,clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
 const lerp=(a,b,t)=>a*(1-t)+b*t;
 const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
 const world=(x,d,y)=>[(d+x)*SQ,y,(d-x)*SQ];
 // Every row is a human-drawn [screen-right coordinate, away distance,
 // crest altitude, main fold offset]. Different lengths and profiles are
 // intentional — there are no symmetric mountain wings or repeating rings.
 const RIGHT_BANK={
  // Beneath and to the RIGHT of the fighters, never a second battle island.
  // Crest remains below sightline; this bank falls into the gorge.
  name:"front_buttress",color:[.56,.53,.48],haze:.05,sign:1,
  cols:94,rows:22,
  outline:[[10,23,-14,0],[16,27,-20,1.8],[25,34,-26,-1.7],
   [36,43,-33,2.8],[51,55,-41,-2.1],[69,72,-54,1.6],
   [90,94,-69,-1.1],[123,118,-86,0]]
 };
 const OPPOSITE_WALL={
  // The first truly opposite cliff is WELL beyond the foreground lip,
  // and only its upper weathered shoulders appear in the top of the void.
  name:"middle_terraces",color:[.68,.67,.62],haze:.36,sign:1,
  cols:116,rows:25,
  outline:[[-125,142,-148,0],[-79,140,-115,1.0],[-26,139,-96,-1.8],
   [0,143,-87,2.1],[26,149,-79,-2.0],[52,155,-71,1.8],
   [82,161,-75,-1.7],[111,168,-70,1.0],[151,183,-91,-1.2],
   [198,202,-114,1.0],[275,236,-171,0]]
 };
 const LEFT_BANK={
  // A low geological shoulder, almost entirely below the left frame rim:
  // no giant left wing or overhead canopy.
  name:"gorge_floor",color:[.54,.55,.53],haze:.29,sign:-1,
  cols:82,rows:19,
  outline:[[-160,130,-122,0],[-127,109,-89,1.1],[-93,76,-63,-1.8],
   [-63,49,-38,1.6],[-43,35,-26,-1.5],[-26,27,-17,1.2],
   [-12,20,-10,0]]
 };
 const FAR_HORIZON={
  // A pale far massif, visibly softened by distance rather than dark rock.
  name:"pale_horizon",color:[.67,.71,.73],haze:.70,sign:1,
  cols:90,rows:14,
  outline:[[-110,235,-164,0],[-72,230,-153,1.1],
   [-35,230,-144,-1.0],[0,235,-135,2.1],[41,240,-143,-1.6],
   [79,247,-137,1.5],[115,252,-143,-1.7],[158,264,-151,1.4],
   [213,275,-168,0]]
 };
 // Hand-designed cross-sections give each cliff a jagged crest, weathered
 // shoulder, stepped bedding, undercut, talus and an unseen low base.
 // [fraction, sideways width, additional depth, altitude drop]
 const CLIFF_SIDE=[
  [0,0,0,0],[.06,1.7,1.3,1.0],[.13,4.0,1.6,3.4],
  [.20,4.7,3.7,5.2],[.28,5.9,5.1,10.0],[.36,6.2,6.0,19.0],
  [.44,6.7,7.5,31.0],[.53,7.9,6.8,41.0],[.63,10.6,8.5,51.0],
  [.73,15.4,9.7,60.0],[.84,20.5,12.0,70.0],[1,30,17,83]
 ];
 const CLIFF_OPPOSITE=[
  [0,0,0,0],[.08,2.2,1.3,2.0],[.16,6.5,2.5,6.4],
  [.25,7.1,3.2,11.0],[.33,8.6,5.1,20.0],[.42,9.3,6.0,34.0],
  [.53,10.1,7.4,49.0],[.63,14.6,11.1,66.0],[.74,19.4,14,85.0],
  [.87,24.5,17.1,106.0],[1,32,20,123]
 ];
 const CLIFF_DISTANT=[
  [0,0,0,0],[.10,4.1,1.6,4],[.22,7.4,4.2,12],
  [.36,10.6,7.7,28],[.52,14,11,49],[.69,18,16,68],
  [.85,23,20,86],[1,30,25,104]
 ];
 // Smooth contour subdivision rather than coarse triangles or random peaks.
 // Knot positions are not mirrored, resampled or re-rolled at runtime.
 function curve(nodes,t){
  const k=clamp(t,0,1)*(nodes.length-1),i=Math.min(nodes.length-2,Math.floor(k));
  const f=k-i,lo=nodes[Math.max(0,i-1)],a=nodes[i],b=nodes[i+1],hi=nodes[Math.min(nodes.length-1,i+2)];
  const interp=(p0,p1,p2,p3,u)=>.5*((2*p1)+(-p0+p2)*u+
   (2*p0-5*p1+4*p2-p3)*u*u+(-p0+3*p1-3*p2+p3)*u*u*u);
  return a.map((x,j)=>interp(lo[j],x,b[j],hi[j],f));
 }
 function section(nodes,t){
  const u=clamp(t,0,1);
  let k=1;while(k<nodes.length-1&&nodes[k][0]<u)k++;
  const a=nodes[k-1],b=nodes[k],f=smooth((u-a[0])/(b[0]-a[0]));
  return a.slice(1).map((x,j)=>lerp(x,b[j+1],f));
 }
 function sculpt(name,design,shape,scale){
  const positions=[],colors=[],uvs=[],indices=[],normals=[];
  const n=design.cols,m=design.rows;
  for(let j=0;j<=m;j++)for(let i=0;i<=n;i++){
   const u=i/n,v=j/m,[l,d,crest,fold]=curve(design.outline,u);
   const [spread,dist,drop]=section(shape,v);
   // Weathering is low-amplitude and sculpted into the offline asset.
   // It cannot move the view silhouettes or create a repeated barcode.
   const relief=(.44*Math.sin(l*.11+v*8.7)+.20*Math.sin(l*.31-v*13.1))*
    Math.sin(Math.PI*v)*(.1+.42*Math.sin(v*2.7));
   const shear=fold*Math.sin(Math.PI*v)*.38;
   const x=l+design.sign*spread*scale+shear;
   const y=crest-drop*scale+relief;
   const depth=d+dist*scale+.8*Math.sin(l*.083+v*6.3)*v;
   positions.push(...world(x,depth,y));
   // Strata UV: local stone photo 512 px, not stretched across the sky.
   uvs.push(l*.055+v*.04,y*.057+depth*.006);
   const sediment=.035*Math.sin(y*.16+l*.031)+.016*Math.sin(y*.39+l*.091);
   const cleft=Math.abs(Math.sin(l*.128+v*5.3))>.987?-.07:0;
   const tonal=1-.15*v+sediment+cleft;
   const atmosphere=design.haze+.16*v;
   const fog=[.66,.73,.77];
   const pal=design.color.map((c,q)=>clamp(c*tonal*(1-atmosphere)+fog[q]*atmosphere,0,1));
   colors.push(...pal.map(c=>Math.round(c*255)),255);
  }
  for(let j=0;j<m;j++)for(let i=0;i<n;i++){
   const a=j*(n+1)+i,b=a+n+1;
   // Keep a consistent mesh winding and avoid duplicate overlapping faces.
   if(design.sign<0)indices.push(a,a+1,b,a+1,b+1,b);
   else indices.push(a,b,a+1,a+1,b,b+1);
  }
  for(let k=0;k<positions.length;k++)normals.push(0);
  return {name,positions,uvs,colors,indices,normals};
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
 const assets=[
  sculpt("front_buttress",RIGHT_BANK,CLIFF_SIDE,.97),
  sculpt("middle_terraces",OPPOSITE_WALL,CLIFF_OPPOSITE,1),
  sculpt("gorge_floor",LEFT_BANK,CLIFF_SIDE,.92),
  sculpt("pale_horizon",FAR_HORIZON,CLIFF_DISTANT,.96)
 ].map(computeNormals);

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
 const target=path.join(__dirname,"..","assets","env014","gorge-sculpt-v1.glb");
 const result=createEnv014Glb();
 fs.mkdirSync(path.dirname(target),{recursive:true});
 fs.writeFileSync(target,Buffer.from(result.bytes));
 console.log(JSON.stringify({target,bytes:result.bytes.length,meshes:result.stats}));
}
if(typeof module!=="undefined"&&module.exports)module.exports=createEnv014Glb;
