"use strict";
/* COMBAT-ENV-010: original authored strata, not real or canonical geography.
 * Exports a standards-compliant, non-animated glTF 2.0 GLB (three COLOR_0
 * meshes) from hand-authored silhouettes and stepped cliff cross-sections.
 * Run: node tools/env010-gorge-export.cjs
 * No npm packages, commercial assets or network calls.
 */
function createEnv010Glb(){

 const RAD=Math.PI/180,SEG=26,SIDE=27,BANDS=18,SQ=Math.SQRT1_2;
 const rock=(name,x,d,rx,rd,top,height,shape,tilt,faults)=>({name,x,d,rx,rd,top,height,shape,tilt,faults});
 // Nine deliberately placed CLOSED 3D cliff volumes; three draw-call groups.
 // x is horizontal in fixed camera view, d recedes into the ravine.
 const LAYERS=[
 {name:"front_buttress",palette:[.52,.47,.395],haze:0,forms:[
 rock("left_gate",-47,52,17,17,-25,102,[.91,1.12,1.04,.74,.86,1.16,.91,.79,1.11,.91,.88,1.20,.99],[-.105,.024],[[205,2.9],[310,2.4]]),
 rock("right_gate",58,55,19,20,-27,100,[.89,1.13,.80,.95,1.20,.88,.71,1.16,.86,1.08,.83,1.19,.93],[.075,-.035],[[130,3.4],[244,2.7]]),
 rock("left_spur",-76,66,23,22,-38,112,[.83,1.15,1.02,.83,1.18,.82,1.00,.78,1.25,.87,1.08,.82,1.01],[-.07,.018],[[95,2.5],[272,3.2]])]},
 {name:"middle_terraces",palette:[.56,.56,.52],haze:.12,forms:[
 rock("west_fork",-43,76,26,22,-42,110,[1.14,.89,1.08,.82,1.15,.85,1.18,.76,.98,1.11,.80,.95,1.23],[.045,.016],[[158,3.0],[296,3.6]]),
 rock("east_shelf",52,75,28,22,-46,114,[.82,.94,1.25,.81,1.17,.94,.75,1.13,.93,1.16,.86,1.06,.82],[-.065,-.014],[[40,2.6],[227,4.1]]),
 rock("gorge_turn",2,94,19,18,-57,92,[1.03,.83,1.24,.88,.92,1.12,.77,1.15,.92,1.03,.86,1.08,1.13],[.022,.032],[[70,2.2],[246,2.7]])]},
 {name:"pale_horizon",palette:[.67,.69,.66],haze:.29,forms:[
 rock("west_crown",-68,111,31,30,-56,115,[.82,1.18,.84,1.03,1.23,.81,1.08,.94,.79,1.21,.90,1.06,1.10],[.035,-.018],[[199,2.6],[320,2.4]]),
 rock("eastern_rampart",64,111,35,29,-59,122,[1.13,.82,.96,1.22,.87,1.09,.80,1.18,.97,.82,1.17,.95,1.04],[-.035,.019],[[98,2.4],[273,2.8]]),
 rock("distant_saddle",-8,130,26,28,-72,103,[.84,1.04,1.20,.79,1.13,.85,1.08,.95,1.17,.85,1.07,.92,1.04],[.012,-.021],[[40,2.4],[206,3.1]])]}
 ];
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const smooth=(a,b,t)=>{t=clamp((t-a)/(b-a),0,1);return t*t*(3-2*t);};
 const angles=Array.from({length:SEG},(_,i)=>i*Math.PI*2/SEG);
 function shapeAt(f,i){
  const u=i/SEG*f.shape.length,k=Math.floor(u),t=u-k;
  return f.shape[k%f.shape.length]+(f.shape[(k+1)%f.shape.length]-f.shape[k%f.shape.length])*(t*t*(3-2*t));
 }
 function sculptRock(f,layer,positions,colors,uvs,indices){
  const first=positions.length/3,[tiltX,tiltD]=f.tilt;
  for(let j=0;j<=BANDS;j++){
   const t=j/BANDS;
   for(let i=0;i<=SEG;i++){
    const a=angles[i%SEG],nx=Math.cos(a),nz=Math.sin(a),radial=shapeAt(f,i%SEG);
    const dip=nx*.055+nz*.032;
    // Inclined geometric benches; their edges are disrupted by cross-cutting joints.
    const bench=.042*Math.exp(-Math.pow((t-.24-dip)/.050,2))+
       .053*Math.exp(-Math.pow((t-.53+dip*.7)/.054,2))+
       .062*Math.exp(-Math.pow((t-.76-dip*.6)/.055,2));
    let fault=0,crevice=0;
    for(const [degrees,reach] of f.faults){
     const da=Math.atan2(Math.sin(a-degrees*RAD-t*.12),Math.cos(a-degrees*RAD-t*.12));
     const notch=Math.exp(-Math.pow(da/.16,2));
     fault+=reach*notch*(1-.63*t);crevice+=notch;
    }
    const lateral=radial*(.74+.48*Math.pow(t,1.4)+bench);
    const shear=(.7*Math.cos(a*5+f.rx*.2)+.5*Math.sin(a*9-f.rd*.11))*(.25+.75*t);
    const x=f.x+nx*f.rx*lateral+shear*nx-fault*nx*.78;
    const d=f.d+nz*f.rd*lateral+shear*nz-fault*nz*.78;
    const rim=tiltX*(x-f.x)+tiltD*(d-f.d);
    const y=f.top-f.height*t+(rim+(radial-1)*8)*Math.pow(1-t,1.18)-fault*(1-t)*.65+
       (i%7===0?-.5:0)*Math.pow(1-t,1.5);
    positions.push((d+x)*SQ,y,(d-x)*SQ);
    const strata=Math.sin((y+.16*x+.07*d)*.25+Math.sin(a*3)*.4);
    const local=.045*strata-.065*crevice*(1-t)+.075*nx-.025*nz;
    const warm=.035*Math.cos((y+.06*x)*.12)+.021*Math.cos(a*5+f.d*.02);
    const low=.08*smooth(.72,1,t),p=layer.palette,h=layer.haze;
    const rgb=[p[0]+warm+local-low,p[1]+warm*.75+local*.65-low,p[2]+warm*.54+local*.48-low];
    colors.push(...rgb.map((v,k)=>Math.round(255*clamp(v*(1-h)+[.69,.73,.73][k]*h,0,1))),255);
    uvs.push(i/SEG*2.2,(y+190)*.052);
   }
  }
  for(let j=0;j<BANDS;j++)for(let i=0;i<SEG;i++){
   const q=first+j*SIDE+i,n=q+1,b=q+SIDE,bn=n+SIDE;
   indices.push(q,n,b,n,bn,b);
  }
  // Discontinuous UV island: the roof MUST NOT inherit the side's angular UV.
  // UVs are planar in world-space; a second uneven inner rim prevents the
  // large flat fan and radial Rock063 streaks seen in the rejected v5 WebGL.
  const outer=positions.length/3;
  const topRing=Array.from({length:SEG},(_,i)=>positions.slice((first+i)*3,(first+i)*3+3));
  const tint=layer.palette.map(n=>Math.round(n*236));
  const uv=(x,z)=>[(x-z)*SQ*.062,(x+z)*SQ*.062];
  for(let i=0;i<SEG;i++){
   const [x,y,z]=topRing[i];
   positions.push(x,y,z); colors.push(...tint,255); uvs.push(...uv(x,z));
  }
  const inner=positions.length/3;
  for(let i=0;i<SEG;i++){
   const [x,y,z]=topRing[i],radius=shapeAt(f,i);
   const centerX=(f.d+f.x)*SQ,centerZ=(f.d-f.x)*SQ;
   const px=centerX+(x-centerX)*.42,pz=centerZ+(z-centerZ)*.42;
   // The crown dips between irregular shoulders; it is not a level roof.
   const py=f.top+6.0+(radius-1)*6+.3*(y-f.top)+Math.cos(angles[i]-.9)*1.7;
   positions.push(px,py,pz);colors.push(...tint,255);uvs.push(...uv(px,pz));
  }
  const center=positions.length/3,xx=(f.d+f.x)*SQ,zz=(f.d-f.x)*SQ;
  positions.push(xx,f.top+7,zz);colors.push(...tint,255);uvs.push(...uv(xx,zz));
  for(let i=0;i<SEG;i++){
   const j=(i+1)%SEG,a=outer+i,b=outer+j,c=inner+i,dd=inner+j;
   indices.push(a,c,b,b,c,dd,center,c,dd);
  }
  // Closed undersurface, below the gorge floor. No visible floating skirts.
  const bottom=positions.length/3,xxBase=(f.d+f.x)*SQ,zzBase=(f.d-f.x)*SQ;
  positions.push(xxBase,f.top-f.height-3,zzBase);
  colors.push(...tint,255);uvs.push(...uv(xxBase,zzBase));
  for(let i=0;i<SEG;i++){
   indices.push(bottom,first+BANDS*SIDE+i,first+BANDS*SIDE+(i+1)%SEG);
  }
 }
 function layerMesh(layer){
  const positions=[],colors=[],uvs=[],indices=[],normals=[];
  for(const form of layer.forms)sculptRock(form,layer,positions,colors,uvs,indices);
  for(let i=0;i<positions.length;i++)normals.push(0);
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
  return {name:layer.name,positions,normals,colors,uvs,indices};
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
