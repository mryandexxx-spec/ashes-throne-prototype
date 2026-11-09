"use strict";
/* COMBAT-ENV-010: original authored strata, not real or canonical geography.
 * Exports a standards-compliant, non-animated glTF 2.0 GLB (three COLOR_0
 * meshes) from hand-authored silhouettes and stepped cliff cross-sections.
 * Run: node tools/env010-gorge-export.cjs
 * No npm packages, commercial assets or network calls.
 */
function createEnv010Glb(){


 const SQ=Math.SQRT1_2,STEPS=86,CROSS=23,WIDTH=13,MIN_D=26,MAX_D=181;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const smooth=(a,b,t)=>{t=clamp((t-a)/(b-a),0,1);return t*t*(3-2*t)};
 const interp=(nodes,x)=>{
  if(x<=nodes[0][0])return nodes[0][1];
  for(let i=1;i<nodes.length;i++)if(x<=nodes[i][0]){
   const a=nodes[i-1],b=nodes[i],t=(x-a[0])/(b[0]-a[0]);
   return a[1]+(b[1]-a[1])*t;
  }return nodes[nodes.length-1][1];
 };
 // Hand-positioned river bends, depths and structural lines: no periodic ridge rings.
 const CENTER=[[26,-4],[43,-2],[68,6],[86,10],[105,4],[123,-9],[149,-14],[181,-2]];
 const RAVINE=[[26,-114],[43,-123],[68,-126],[86,-132],[108,-138],[131,-149],[153,-151],[181,-157]];
 const WIDE=[[26,8],[42,10],[70,13],[91,16],[117,19],[146,21],[181,24]];
 const SECTION=[[0,0,0],[.065,7,2],[.14,15,11],[.23,23,29],
  [.32,27,43],[.39,29,62],[.45,33,80],[.52,38,98],
  [.58,45,83],[.66,60,72],[.75,80,62],[.86,111,45],[1,154,3]];
 const BANKS=[
 {name:"front_buttress",side:-1,palette:[.49,.465,.420],heightScale:.79,
  crown:[[26,-9],[39,-7],[58,20],[78,-16],[93,6],[111,24],[131,-12],[151,19],[181,-18]],
  breaks:[[42,2.3,6],[82,2.6,9],[119,3.4,8],[157,3,10]],
  fans:[[50,10,7],[104,12,9],[155,10,6]]},
 {name:"middle_terraces",side:1,palette:[.52,.49,.44],heightScale:.87,
  crown:[[26,5],[45,-12],[62,22],[80,9],[103,-20],[122,23],[145,4],[161,-16],[181,10]],
  breaks:[[54,2.7,7],[97,3.3,11],[137,2.6,7],[171,3.5,9]],
  fans:[[67,9,7],[117,12,8],[171,8,7]]}
 ];
 const palette=a=>a.map(v=>Math.round(255*clamp(v,0,1)));
 const world=(x,d,y)=>[(d+x)*SQ,y,(d-x)*SQ];
 const dAt=j=>MIN_D+(MAX_D-MIN_D)*j/STEPS;
 const floorY=d=>interp(RAVINE,d);
 const centerX=d=>interp(CENTER,d);
 const span=d=>interp(WIDE,d);
 function section(u){
  let p=SECTION[0],q=SECTION[SECTION.length-1];
  for(let k=1;k<SECTION.length;k++)if(u<=SECTION[k][0]){p=SECTION[k-1];q=SECTION[k];break;}
  const t=clamp((u-p[0])/(q[0]-p[0]),0,1);
  return [p[1]+(q[1]-p[1])*t,p[2]+(q[2]-p[2])*t];
 }
 function bankSample(B,u,d){
  const [out,height]=section(u);
  const tectonic=interp(B.crown,d)*(smooth(.21,.53,u)-smooth(.78,1,u)*.46);
  let fracture=0,fan=0;
  for(const [at,width,depth] of B.breaks)
   fracture+=depth*Math.exp(-Math.pow((d-at)/width,2))*
    (smooth(.23,.50,u)-.17*smooth(.65,.9,u));
  for(const [at,width,rise] of B.fans)
   fan+=rise*Math.max(0,1-Math.abs(d-at)/width)*
    Math.max(0,1-Math.abs(u-.19)/.19);
  const rib=.65*Math.sin(d*.19+u*16+B.side*.9)*smooth(.06,.29,u);
  const bedding=1.35*Math.sin((floorY(d)+height)*.26+d*.065)*
    (smooth(.23,.4,u)-smooth(.69,.93,u));
  const shear=1.8*Math.sin(d*.115+B.side*1.6)*smooth(.28,.63,u);
  const x=centerX(d)+B.side*(span(d)+out+shear+.8*fracture*smooth(.30,.55,u));
  const y=floorY(d)+height*B.heightScale+tectonic-fracture+fan+rib+bedding;
  return {x,y,d,fracture,fan,height};
 }
 function bankColor(B,s,u,d){
  const zone=smooth(.14,.30,u)-smooth(.36,.62,u);
  const talus=smooth(.06,.18,u)-smooth(.31,.47,u);
  const strata=.045*Math.sin((s.y+.14*d)*.25)+.025*Math.sin(s.y*.43+d*.072);
  const angle=.055*Math.sin(d*.092+u*9+B.side*2);
  const shade=-s.fracture*.018-.025*zone+.033*talus,warm=.015*zone+.065*talus;
  const haze=.28*smooth(85,178,d)+(B.side===1?.06:0);
  return [...palette(B.palette.map((v,i)=>(v+strata*(i===2?.6:1)+angle+shade+warm*(i===2?.52:1))*(1-haze)+[.65,.69,.71][i]*haze)),255];
 }
 function bankMesh(B){
  const positions=[],uvs=[],colors=[],indices=[],normals=[],ROW=CROSS+1;
  for(let j=0;j<=STEPS;j++){
   const d=dAt(j);
   for(let i=0;i<=CROSS;i++){
    const u=i/CROSS,s=bankSample(B,u,d);
    positions.push(...world(s.x,d,s.y));
    // Rocky wall faces receive altitude-based UV; terraces retain ground UV.
    const steep=smooth(.23,.44,u)-smooth(.57,.82,u);
    uvs.push(s.x*.047+d*.012,(s.y+150)*.059*steep+d*.052*(1-steep));
    colors.push(...bankColor(B,s,u,d));
   }
  }
  for(let j=0;j<STEPS;j++)for(let i=0;i<CROSS;i++){
   const a=j*ROW+i,b=a+1,c=a+ROW,e=c+1;
   if(B.side===-1)indices.push(a,b,c,b,e,c);
   else indices.push(a,c,b,b,c,e);
  }
  // Solid underside: vertical boundary walls and capped bottom strip.
  const lowerStart=positions.length/3;
  for(let j=0;j<=STEPS;j++){
   const d=dAt(j),inner=bankSample(B,0,d),outer=bankSample(B,1,d);
   for(const [u,s] of [[0,inner],[1,outer]]){
    positions.push(...world(s.x,d,-183));
    colors.push(...bankColor(B,s,u,d));
    uvs.push(s.x*.061,d*.063-2);
   }
  }
  for(let j=0;j<STEPS;j++){
   const a=j*ROW,c=a+ROW,A=lowerStart+j*2,C=A+2,last=a+CROSS,clast=c+CROSS;
   indices.push(a,c,A,c,C,A,last,A+1,clast,clast,A+1,C+1,A,C,A+1,A+1,C,C+1);
  }
  for(const j of [0,STEPS]){
   const base=j*ROW,low=lowerStart+j*2;
   for(let i=0;i<CROSS;i++)indices.push(low,base+i,base+i+1);
   indices.push(low,base+CROSS,low+1);
  }
  for(let i=0;i<positions.length;i++)normals.push(0);
  return {name:B.name,positions,normals,colors,uvs,indices};
 }
 function valleyMesh(){
  const positions=[],normals=[],uvs=[],colors=[],indices=[];
  for(let j=0;j<=STEPS;j++){
   const d=dAt(j),center=centerX(d),w=span(d);
   for(let k=0;k<=WIDTH;k++){
    const u=k/WIDTH*2-1,x=center+u*w;
    const y=floorY(d)+(1-u*u)*
      (.5+.8*Math.sin(d*.17+u*4));
    positions.push(...world(x,d,y));
    uvs.push(d*.045,u*.95);
    const sand=.025*Math.sin(d*.14+u*11),mid=Math.max(0,1-Math.abs(u));
    colors.push(...palette([.62+sand+.05*mid,.605+sand+.04*mid,.57+sand+.025*mid]),255);
   }
  }
  const row=WIDTH+1;
  for(let j=0;j<STEPS;j++)for(let i=0;i<WIDTH;i++){
   const a=j*row,b=a+1,c=a+row,e=c+1;
   indices.push(a,c,b,b,c,e);
  }
  // Real far-spanning ridge with a low, asymmetric central saddle.
  // This distant mesh has depth, not a billboard or a separate draw call.
  const FAR=[[-115,-121],[-94,-106],[-80,-89],[-65,-83],
   [-49,-100],[-34,-117],[-18,-132],[0,-142],[15,-127],
   [31,-111],[48,-90],[63,-82],[83,-103],[115,-130]];
  const farStart=positions.length/3,FAR_COLS=62,FAR_ROWS=12;
  for(let j=0;j<=FAR_ROWS;j++){
   const depth=202+j*3.3;
   for(let i=0;i<=FAR_COLS;i++){
    const x=-115+230*i/FAR_COLS,crest=interp(FAR,x);
    const fracture=(2.7*Math.sin(x*.19+j*.47)+1.8*Math.sin(x*.37-j*.31))*(1-j/FAR_ROWS);
    const y=crest-2.25*j+fracture;
    positions.push(...world(x,depth,y));
    uvs.push(x*.025,depth*.028+y*.004);
    const haze=.30+j/FAR_ROWS*.08,grey=[.64,.675,.69],sky=[.73,.765,.77];
    colors.push(...palette(grey.map((v,k)=>v*(1-haze)+sky[k]*haze+
     .018*Math.sin(x*.11+j*.7))),255);
   }
  }
  for(let j=0;j<FAR_ROWS;j++)for(let i=0;i<FAR_COLS;i++){
   const a=farStart+j*(FAR_COLS+1)+i,b=a+1,c=a+FAR_COLS+1,e=c+1;
   indices.push(a,c,b,b,c,e);
  }
  for(let i=0;i<positions.length;i++)normals.push(0);
  return {name:"pale_horizon",positions,normals,colors,uvs,indices};
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
 const assets=[...BANKS.map(bankMesh),valleyMesh()].map(computeNormals);

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
