/* ENV022 — integrated ready-made CC0 terrain from Grab3D Cozy Terrain Kit.
 * The genuine Mesa plateau replaces the visible ENV009 walking island only
 * after all authentic downloaded GLBs validate. The original scene stays
 * intact as safe fallback on loading/parse failure; no new render loop.
 */
const CombatEnvironment017=(()=>{
 "use strict";
 const ALPHA=-3*Math.PI/4;
 const AWAY={x:-Math.cos(ALPHA),z:-Math.sin(ALPHA)};
 const RIGHT={x:-Math.sin(ALPHA),z:Math.cos(ALPHA)};
 const p=(side,away,y)=>[RIGHT.x*side+AWAY.x*away,y,RIGHT.z*side+AWAY.z*away];
 const SOURCES=Object.freeze(["MesaTerrain","CliffFace","CanyonWall"]);
 // Preserving the natural ready-made plateau is the key experiment.
 // x maps to camera-right, z to camera-away; old ENV009 ground is hidden
 // only after *all* external meshes load and validate.
 const PLACEMENTS=Object.freeze([
  {source:"MesaTerrain",side:0,away:1.2,y:-6.8,scale:2.65,heightScale:.48,angle:0},
  {source:"CliffFace",side:-12.6,away:5.0,y:-9.2,scale:2.65,heightScale:.68,angle:-.12},
  {source:"CanyonWall",side:20.0,away:25.0,y:-17.5,scale:2.60,heightScale:1.00,angle:.20}
 ]);
 const ROOT=typeof document!=="undefined"&&document.currentScript?.src?
  new URL("assets/env022/",document.currentScript.src).href:null;
 function supported(B){return !!(B?.Mesh&&B.VertexData?.ComputeNormals&&B.StandardMaterial&&B.Color3);}
 // Small strict glTF2 subset, matched to the four pinned Gobkit GLBs:
 // Float32 attributes, uint16/uint32 triangle indices, an embedded image.
 function parse(buffer){
  if(!(buffer instanceof ArrayBuffer))throw Error("ENV022 GLB buffer required");
  const dv=new DataView(buffer);
  if(buffer.byteLength<60||buffer.byteLength>1200000||
   dv.getUint32(0,true)!==0x46546c67||dv.getUint32(4,true)!==2||
   dv.getUint32(8,true)!==buffer.byteLength)throw Error("ENV022 GLB header invalid");
  const jLength=dv.getUint32(12,true),jType=dv.getUint32(16,true);
  const bHead=20+jLength;
  if(jType!==0x4e4f534a||jLength>30000||bHead+8>buffer.byteLength||
    dv.getUint32(bHead+4,true)!==0x004e4942)throw Error("ENV022 GLB chunks invalid");
  const json=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,jLength)));
  const binStart=bHead+8,binLength=dv.getUint32(bHead,true);
  if(binStart+binLength!==buffer.byteLength||json.asset?.version!=="2.0"||
    json.meshes?.length!==1||json.meshes[0]?.primitives?.length!==1)
   throw Error("ENV022 unexpected glTF topology");
  const prim=json.meshes[0].primitives[0];
  if((prim.mode??4)!==4)throw Error("ENV022 non triangle mesh");
  function read(accessorId,type,allowed,allowNormalized=false){
   const a=json.accessors?.[accessorId],v=json.bufferViews?.[a?.bufferView];
   if(!a||!v||a.type!==type||!allowed.includes(a.componentType)||a.count<3||
      a.count>(type==="SCALAR"?120000:25000)||a.sparse||(a.normalized&&!allowNormalized))throw Error("ENV022 accessor schema");
   const components=type==="SCALAR"?1:type==="VEC2"?2:type==="VEC4"?4:3;
   const bytes=a.componentType===5126||a.componentType===5125?4:a.componentType===5123?2:1;
   const step=v.byteStride||components*bytes;
   const offset=(v.byteOffset||0)+(a.byteOffset||0);
   if(step<components*bytes||offset<0||offset+(a.count-1)*step+components*bytes>
     (v.byteOffset||0)+v.byteLength||offset+(a.count-1)*step+components*bytes>binLength)
    throw Error("ENV022 accessor range");
   const out=[];
   for(let i=0;i<a.count;i++)for(let j=0;j<components;j++){
    const address=binStart+offset+i*step+j*bytes;
    const n=a.componentType===5126?dv.getFloat32(address,true):
     a.componentType===5125?dv.getUint32(address,true):
     a.componentType===5123?dv.getUint16(address,true):dv.getUint8(address);
    if(!Number.isFinite(n))throw Error("ENV022 nonfinite mesh");
    out.push(a.normalized&&allowNormalized?n/(a.componentType===5121?255:65535):n);
   }
   return out;
  }
  const pos=read(prim.attributes.POSITION,"VEC3",[5126]);
  const normals=prim.attributes.NORMAL===undefined?null:
    read(prim.attributes.NORMAL,"VEC3",[5126]);
  const uv=prim.attributes.TEXCOORD_0===undefined?null:
    read(prim.attributes.TEXCOORD_0,"VEC2",[5126]);
  const indices=read(prim.indices,"SCALAR",[5123,5125]);
  const vertexColors=prim.attributes.COLOR_0===undefined?null:
   read(prim.attributes.COLOR_0,"VEC4",[5121,5123,5126],true);
  const count=pos.length/3;
  if(indices.length%3||indices.some(i=>i>=count)||count>25000)
   throw Error("ENV022 invalid indices");
  const image=json.images?.[0],view=json.bufferViews?.[image?.bufferView];
  let imageBytes=null,imageMime=null;
  if(image&&view&&["image/png","image/jpeg"].includes(image.mimeType)){
   const start=binStart+(view.byteOffset||0);
   if(view.byteLength>200000||start+view.byteLength>buffer.byteLength)
    throw Error("ENV022 image bounds");
   imageBytes=new Uint8Array(buffer,start,view.byteLength);
   imageMime=image.mimeType;
  }
  return {positions:pos,normals,uvs:uv,indices,vertexColors,imageBytes,imageMime,vertices:count,
   triangles:indices.length/3};
 }
 function build(B,scene,own){
  if(!supported(B)||!scene||typeof own!=="function")throw Error("ENV022 Babylon geometry required");
  const mark=value=>{
   if(typeof document!=="undefined"&&document.documentElement){
    document.documentElement.dataset.environment="ENV017";
    document.documentElement.dataset.env017Massing="ready";
    document.documentElement.dataset.env022Assets=value;
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
   if(!response.ok)throw Error("ENV022 HTTP "+response.status+" "+name);
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
      const y=(source[j*3+1]-minY)*def.scale*(def.heightScale||1);
      const z=(source[j*3+2]-cZ)*def.scale*(def.depthScale||1);
      const world=p(def.side+co*x-si*z,def.away+si*x+co*z,def.y+y);
      pos.push(...world);
      // Preserve real external mesh facets rather than paint broad fake walls.
      if(model.vertexColors)colors.push(...model.vertexColors.slice(j*4,j*4+4));
      else colors.push(1,1,1,1);
     }
     const mesh=new B.Mesh("env022_terrain_"+def.source+"_"+i,scene);
     created.push(mesh);
     const vd=new B.VertexData(),normal=[];
     B.VertexData.ComputeNormals(pos,indices,normal);
     vd.positions=pos;vd.indices=indices;vd.normals=normal;vd.colors=colors;
     if(model.uvs)vd.uvs=model.uvs;
     vd.applyToMesh(mesh,false);
     mesh.isPickable=false;mesh.checkCollisions=false;mesh.receiveShadows=false;
     mesh.useVertexColors=true;
     const mat=new B.StandardMaterial("env022_terrain_mat_"+def.source+"_"+i,scene);
     created.push(mat);
     mat.diffuseColor=new B.Color3(1,1,1);
     mat.emissiveColor=new B.Color3(.20,.21,.21);
     mat.specularColor=new B.Color3(0,0,0);
     mat.backFaceCulling=false;mat.useVertexColors=true;mat.fogEnabled=false;
     if(def.source==="PolyCliff01"&&model.imageBytes&&B.Texture?.CreateFromBase64String){
      let binary="";
      for(let k=0;k<model.imageBytes.length;k+=8192)
       binary+=String.fromCharCode(...model.imageBytes.subarray(k,k+8192));
      const texture=B.Texture.CreateFromBase64String(
       btoa(binary),"env022_tex_"+def.source+"_"+i,scene,false,false);
      mat.diffuseTexture=texture;created.push(texture);
     }
     mesh.material=mat;
    }
    if(disposed())throw Error("ENV022 scene disposed before commit");
    created.forEach(x=>own(x));
    for(const name of ["living_ledge","ravine","near_escarpment","far_ridge","horizon_ridge"]){
     const old=scene.meshes?.find(m=>m.name==="env009_"+name);
     old?.setEnabled?.(false);
    }
    if(typeof document!=="undefined"&&document.documentElement)
     document.documentElement.dataset.env022Integrated="ready";
    mark("ready");
   }catch(error){
    created.reverse().forEach(x=>{try{x.dispose?.();}catch(_){}});
    throw error;
   }
  }).catch(()=>mark(disposed()?"disposed":"fallback"));
  return Object.freeze({stage:"loading-authentic-cc0-terrain",assets:SOURCES.length,placements:PLACEMENTS.length});
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
   ledgeRightEdge:project([8,0,0]),gapSample:project([14,16,-12]),
   bankNear:project([17,23,-10]),bankFar:project([29,27,-8]),
   leftRoot:project([-15,7,-6])};
 }
 return Object.freeze({supported,build,parse,inspect,SOURCES,PLACEMENTS});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=CombatEnvironment017;
