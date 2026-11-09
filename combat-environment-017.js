/* ENV021 — real CC0 Gobkit GLB cliffs, static Babylon Mesh/VertexData loader.
 * External assets vendored locally (pinned upstream). No network requests to
 * third parties at game runtime, new npm dependencies, or second render loop.
 * The original ENV009 arena remains the safe walkable fallback.
 */
const CombatEnvironment017=(()=>{
 "use strict";
 const ALPHA=-3*Math.PI/4;
 const AWAY={x:-Math.cos(ALPHA),z:-Math.sin(ALPHA)};
 const RIGHT={x:-Math.sin(ALPHA),z:Math.cos(ALPHA)};
 const p=(side,away,y)=>[RIGHT.x*side+AWAY.x*away,y,RIGHT.z*side+AWAY.z*away];
 const SOURCES=Object.freeze(["Cliff001","Cliff002","Cliff003","Rock001"]);
 // Hand-composed positions in fixed-camera side/away/y, not a procedurally
 // invented wall; no large ground plane is constructed here.
 const PLACEMENTS=Object.freeze([
  {source:"Cliff001",side:-12,away:2,y:-5.2,scale:.012,angle:.25},
  {source:"Cliff002",side:-12,away:9,y:-6.3,scale:.016,angle:-.38},
  {source:"Cliff003",side:21,away:25,y:-12.5,scale:.021,angle:.45},
  {source:"Cliff001",side:35,away:33,y:-13.8,scale:.020,angle:-.35},
  {source:"Rock001",side:-10,away:-5,y:-1.8,scale:.014,angle:.2}
 ]);
 const ROOT=typeof document!=="undefined"&&document.currentScript?.src?
  new URL("assets/env021/",document.currentScript.src).href:null;
 function supported(B){return !!(B?.Mesh&&B.VertexData?.ComputeNormals&&B.StandardMaterial&&B.Color3);}
 // Small strict glTF2 subset, matched to the four pinned Gobkit GLBs:
 // Float32 attributes, uint16/uint32 triangle indices, an embedded image.
 function parse(buffer){
  if(!(buffer instanceof ArrayBuffer))throw Error("ENV021 GLB buffer required");
  const dv=new DataView(buffer);
  if(buffer.byteLength<60||buffer.byteLength>250000||
   dv.getUint32(0,true)!==0x46546c67||dv.getUint32(4,true)!==2||
   dv.getUint32(8,true)!==buffer.byteLength)throw Error("ENV021 GLB header invalid");
  const jLength=dv.getUint32(12,true),jType=dv.getUint32(16,true);
  const bHead=20+jLength;
  if(jType!==0x4e4f534a||jLength>30000||bHead+8>buffer.byteLength||
    dv.getUint32(bHead+4,true)!==0x004e4942)throw Error("ENV021 GLB chunks invalid");
  const json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,jLength)));
  const binStart=bHead+8,binLength=dv.getUint32(bHead,true);
  if(binStart+binLength!==buffer.byteLength||json.asset?.version!=="2.0"||
    json.meshes?.length!==1||json.meshes[0]?.primitives?.length!==1)
   throw Error("ENV021 unexpected glTF topology");
  const prim=json.meshes[0].primitives[0];
  if((prim.mode??4)!==4)throw Error("ENV021 non triangle mesh");
  function read(accessorId,type,allowed){
   const a=json.accessors?.[accessorId],v=json.bufferViews?.[a?.bufferView];
   if(!a||!v||a.type!==type||!allowed.includes(a.componentType)||a.count<3||
      a.count>20000||a.sparse||a.normalized)throw Error("ENV021 accessor schema");
   const components=type==="SCALAR"?1:type==="VEC2"?2:3;
   const bytes=a.componentType===5126||a.componentType===5125?4:2;
   const step=v.byteStride||components*bytes;
   const offset=(v.byteOffset||0)+(a.byteOffset||0);
   if(step<components*bytes||offset<0||offset+(a.count-1)*step+components*bytes>
     (v.byteOffset||0)+v.byteLength||offset+(a.count-1)*step+components*bytes>binLength)
    throw Error("ENV021 accessor range");
   const out=[];
   for(let i=0;i<a.count;i++)for(let j=0;j<components;j++){
    const address=binStart+offset+i*step+j*bytes;
    const n=a.componentType===5126?dv.getFloat32(address,true):
     a.componentType===5125?dv.getUint32(address,true):dv.getUint16(address,true);
    if(!Number.isFinite(n))throw Error("ENV021 nonfinite mesh");
    out.push(n);
   }
   return out;
  }
  const pos=read(prim.attributes.POSITION,"VEC3",[5126]);
  const normals=prim.attributes.NORMAL===undefined?null:
    read(prim.attributes.NORMAL,"VEC3",[5126]);
  const uv=prim.attributes.TEXCOORD_0===undefined?null:
    read(prim.attributes.TEXCOORD_0,"VEC2",[5126]);
  const indices=read(prim.indices,"SCALAR",[5123,5125]);
  const count=pos.length/3;
  if(indices.length%3||indices.some(i=>i>=count)||count>5000)
   throw Error("ENV021 invalid indices");
  const image=json.images?.[0],view=json.bufferViews?.[image?.bufferView];
  let imageBytes=null,imageMime=null;
  if(image&&view&&["image/png","image/jpeg"].includes(image.mimeType)){
   const start=binStart+(view.byteOffset||0);
   if(view.byteLength>200000||start+view.byteLength>buffer.byteLength)
    throw Error("ENV021 image bounds");
   imageBytes=new Uint8Array(buffer,start,view.byteLength);
   imageMime=image.mimeType;
  }
  return {positions:pos,normals,uvs:uv,indices,imageBytes,imageMime,vertices:count,
   triangles:indices.length/3};
 }
 function build(B,scene,own){
  if(!supported(B)||!scene||typeof own!=="function")throw Error("ENV021 Babylon geometry required");
  const mark=value=>{
   if(typeof document!=="undefined"&&document.documentElement){
    document.documentElement.dataset.environment="ENV017";
    document.documentElement.dataset.env017Massing="ready";
    document.documentElement.dataset.env021Assets=value;
   }
  };
  mark("loading");
  const disposed=()=>typeof scene.isDisposed==="function"?
   scene.isDisposed():Boolean(scene.isDisposed);
  if(!ROOT||typeof fetch!=="function"||typeof TextDecoder!=="function"){
   mark("fallback");return Object.freeze({stage:"external-assets-unavailable",meshes:0});
  }
  // Load every module before creating meshes. On failure keep all ENV009
  // terrain enabled, preserving the original battle and ability to retry.
  Promise.all(SOURCES.map(async name=>{
   const response=await fetch(ROOT+name+".glb",{credentials:"same-origin"});
   if(!response.ok)throw Error("ENV021 HTTP "+response.status+" "+name);
   const buffer=await response.arrayBuffer();
   return [name,parse(buffer)];
  })).then(entries=>{
   if(disposed())return;
   const map=new Map(entries),created=[];
   try{
    for(let i=0;i<PLACEMENTS.length;i++){
     const def=PLACEMENTS[i],model=map.get(def.source);
     const pos=[],indices=model.indices.slice(),colors=[];
     const n=model.vertices,source=model.positions;
     let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,minY=Infinity;
     for(let j=0;j<n;j++){
      const x=source[j*3],y=source[j*3+1],z=source[j*3+2];
      minX=Math.min(minX,x);maxX=Math.max(maxX,x);
      minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z);minY=Math.min(minY,y);
     }
     const cX=(minX+maxX)/2,cZ=(minZ+maxZ)/2;
     const center=p(def.side,def.away,def.y);
     const co=Math.cos(def.angle),si=Math.sin(def.angle);
     for(let j=0;j<n;j++){
      const x=(source[j*3]-cX)*def.scale;
      const y=(source[j*3+1]-minY)*def.scale;
      const z=(source[j*3+2]-cZ)*def.scale;
      pos.push(center[0]+co*x-si*z,center[1]+y,center[2]+si*x+co*z);
      // Preserve real external mesh facets rather than paint broad fake walls.
      colors.push(1,1,1,1);
     }
     const mesh=new B.Mesh("env021_external_"+def.source+"_"+i,scene);
     created.push(mesh);
     const vd=new B.VertexData(),normal=[];
     B.VertexData.ComputeNormals(pos,indices,normal);
     vd.positions=pos;vd.indices=indices;vd.normals=normal;vd.colors=colors;
     if(model.uvs)vd.uvs=model.uvs;
     vd.applyToMesh(mesh,false);
     mesh.isPickable=false;mesh.checkCollisions=false;mesh.receiveShadows=false;
     mesh.useVertexColors=true;
     const mat=new B.StandardMaterial("env021_external_mat_"+def.source+"_"+i,scene);
     created.push(mat);
     mat.diffuseColor=new B.Color3(.79,.81,.81);
     mat.emissiveColor=new B.Color3(.12,.13,.14);
     mat.specularColor=new B.Color3(0,0,0);
     mat.backFaceCulling=false;mat.useVertexColors=true;mat.fogEnabled=false;
     if(model.imageBytes&&B.Texture?.CreateFromBase64String){
      let binary="";
      for(let k=0;k<model.imageBytes.length;k+=8192)
       binary+=String.fromCharCode(...model.imageBytes.subarray(k,k+8192));
      const texture=B.Texture.CreateFromBase64String(
       btoa(binary),"env021_tex_"+def.source+"_"+i,scene,false,false);
      mat.diffuseTexture=texture;created.push(texture);
     }
     mesh.material=mat;
    }
    if(disposed())throw Error("ENV021 scene disposed before commit");
    created.forEach(x=>own(x));
    for(const name of ["near_escarpment","far_ridge","horizon_ridge"]){
     const old=scene.meshes?.find(m=>m.name==="env009_"+name);
     old?.setEnabled?.(false);
    }
    mark("ready");
   }catch(error){
    created.reverse().forEach(x=>{try{x.dispose?.();}catch(_){}});
    throw error;
   }
  }).catch(()=>mark(disposed()?"disposed":"fallback"));
  return Object.freeze({stage:"loading-external-cc0",assets:SOURCES.length,placements:PLACEMENTS.length});
 }
 function inspect(B,scene,camera,width,height){
  if(!B?.Vector3?.Project||!scene?.getTransformMatrix||!camera)return null;
  const transform=scene.getTransformMatrix();
  const viewport=camera.viewport?.toGlobal?
   camera.viewport.toGlobal(width,height):{x:0,y:0,width,height};
  const project=q=>{
   const v=B.Vector3.Project(new B.Vector3(...p(...q)),B.Matrix.Identity(),transform,viewport);
   return [Number(v.x.toFixed(1)),Number(v.y.toFixed(1)),Number(v.z.toFixed(3))];
  };
  return {alpha:camera.alpha,beta:camera.beta,radius:camera.radius,
   fov:camera.fov,target:[camera.target.x,camera.target.y,camera.target.z],viewport,
   ledgeRightEdge:project([6,0,0]),gapSample:project([12,14,-8]),
   bankNear:project([21,25,-9]),bankFar:project([35,33,-10]),
   leftRoot:project([-12,9,-5])};
 }
 return Object.freeze({supported,build,parse,inspect,SOURCES,PLACEMENTS});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=CombatEnvironment017;
