/* COMBAT-ENV-013C — one experimental continuous chasm, NOT world canon.
 * ENV009 combat plane untouched. Geometry deliberately follows its real rim.
 * Replaces isolated box-cliffs with connected terrain and ONE remote escarpment.
 */
const CombatEnvironment013=(()=>{
 "use strict";
 const TAU=Math.PI*2,CLAMP=(x,a,b)=>Math.max(a,Math.min(b,x));
 const ALPHA=-3*Math.PI/4;
 const AWAY={x:-Math.cos(ALPHA),z:-Math.sin(ALPHA)};
 const RIGHT={x:-Math.sin(ALPHA),z:Math.cos(ALPHA)};
 const ROOT=typeof document!=="undefined"&&document.currentScript?.src?
  new URL("assets/env010/",document.currentScript.src).href:null;
 const ASSET_ROOT=ROOT;
 function supported(B){
  return !!(B?.Mesh&&B?.VertexData&&B.VertexData.ComputeNormals&&
   B.StandardMaterial&&B.Color3);
 }
 function build(B,scene,own){
  if(!supported(B)||!scene||typeof own!=="function")throw Error("ENV013C requires Babylon geometry");
  const resources=[],stats={meshes:0,vertices:0,triangles:0};
  const track=v=>(resources.push(v),v);
  const mix=(a,b,t)=>a+(b-a)*t;
  const ease=t=>t*t*(3-2*t);
  const point=(l,d,y)=>[AWAY.x*d+RIGHT.x*l,y,AWAY.z*d+RIGHT.z*l];
  const rim=(r,a)=>{
   if(typeof CombatEnvironment009!=="undefined"&&typeof CombatEnvironment009.rimPoint==="function")
    return CombatEnvironment009.rimPoint(r,a);
   const rough=1+.045*Math.sin(5*a+.4)+.023*Math.sin(11*a+1.3)+.012*Math.sin(23*a+2.1);
   const fan=1+.065*Math.sin(3*a-.3);
   return [Math.cos(a)*9.15*r*rough*fan,Math.sin(a)*5.85*r*rough];
  };
  const mat=(name,rgb,emission)=>{
   const m=track(new B.StandardMaterial("env013_mat_"+name,scene));
   m.diffuseColor=new B.Color3(1,1,1);
   m.emissiveColor=new B.Color3(emission,emission*1.06,emission*1.12);
   m.specularColor=new B.Color3(.01,.012,.012);
   m.useVertexColors=true;m.backFaceCulling=false;m.fogEnabled=true;
   return m;
  };
  function surface(name,cols,rows,sample,shade,material){
   const pos=[],uv=[],rgba=[],indices=[],normals=[];
   for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++){
    const [x,y,z]=sample(i/cols,j/rows,i,j);
    const c=shade(x,y,z,i,j);
    pos.push(x,y,z);
    uv.push(x*.075+y*.003,z*.075+y*.045);
    rgba.push(...c.map(v=>CLAMP(v,0,1)),1);
   }
   const stride=cols+1;
   for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const a=j*stride+i,b=a+stride;
    indices.push(a,b,a+1,a+1,b,b+1);
   }
   B.VertexData.ComputeNormals(pos,indices,normals);
   const mesh=track(new B.Mesh("env013_"+name,scene));
   const data=new B.VertexData();
   data.positions=pos;data.indices=indices;data.normals=normals;
   data.uvs=uv;data.colors=rgba;data.applyToMesh(mesh,false);
   mesh.material=material;mesh.useVertexColors=true;
   mesh.isPickable=false;mesh.checkCollisions=false;mesh.receiveShadows=false;
   stats.meshes++;stats.vertices+=pos.length/3;stats.triangles+=indices.length/3;
  }
  // A real seam with ENV009: its outer ledge falls at r=.945,1.05,1.25.
  // Left bank re-ascends gently after the first erosion lip and continues
  // far beyond the screen; no top cap, visible ends, or disconnected boulder.
  const radial=[.945,.99,1.05,1.13,1.25,1.43,1.66,1.91,2.17,2.42,2.9,3.7,4.8,6.2,8.0];
  const original=[.04,-.42,-1.3,-2.85,-5.1,-7.05,-8.3,-9.15,-9.7,-9.9];
  const profile=r=>{
   if(r<=radial[9]){
    let i=radial.findIndex(v=>v>=r);
    if(i<1)return original[0];
    return mix(original[i-1],original[i],(r-radial[i-1])/(radial[i]-radial[i-1]));
   }
   return -9.9;
  };
  function bank(left){
   const name=left?"connected_left_bank":"descending_right_wall";
   const material=mat(name,left?[.44,.415,.375]:[.35,.385,.395],left?.09:.06);
   const start=left?Math.PI*.27:Math.PI*1.26;
   const end=left?Math.PI*1.21:Math.PI*2.25;
   surface(name,80,radial.length-1,(u,v)=>{
    const a=mix(start,end,u),index=v*(radial.length-1),
     n=Math.floor(index),p=index-n;
    const r=mix(radial[n],radial[Math.min(n+1,radial.length-1)],p);
    const [x,z]=rim(r,a);
    const l=RIGHT.x*x+RIGHT.z*z,d=AWAY.x*x+AWAY.z*z;
    const transition=CLAMP((r-1.25)/1.55,0,1);
    const outer=left?-5.0-1.5*(r-2.42): -12.0-10.0*(r-2.42);
    const seam=Math.sin(2.1*a+6*r)*.65+Math.sin(7*a-2.2*r)*.26;
    const y=mix(profile(r),outer,ease(transition))+
     seam*Math.min(1,transition)*.7;
    return point(l,d,y);
   },(x,y,z,i,j)=>{
    const bedding=.035*Math.sin(y*.32+x*.08);
    const grain=.032*Math.sin(x*.25-z*.36+y*.14);
    const shade=1+bedding+grain-.15*(j/(radial.length-1));
    const base=left?[.49,.45,.39]:[.39,.42,.425];
    return base.map(v=>v*shade);
   },material);
  }
  try{
  // One continuous far escarpment instead of four separately capped
  // long wedges. An irregular cliff crest is visible through the gap.
  const farMaterial=mat("opposite_escarpment",[.54,.58,.58],.105);
  function crest(l){
   const upland=.52*Math.sin(l*.039+.8)+.22*Math.sin(l*.098-1.2)+
    .09*Math.sin(l*.21+1.3);
   const gouge=Math.pow(Math.max(0,Math.sin(l*.081+.6)),9)*3.4;
   return -44+8*upland-gouge;
  }
  surface("opposite_escarpment",112,36,(u,v)=>{
   const l=-175+350*u,depth=105+6*Math.sin(l*.025+.4);
   // First rows describe the weathered upper shoulder; remaining rows descend
   // into unseen depth, never an upright planar silhouette cut by an endcap.
   const top=crest(l),terrace=Math.min(v/.22,1);
   const fall=v<.22?2.5*terrace:2.5+(v-.22)/.78*155;
   const joint=1.2*Math.sin(l*.18+v*18)*v+
    .55*Math.cos(l*.39-v*34)*v;
   return point(l,depth+v*23+joint,top-fall);
  },(x,y,z,i,j)=>{
   const t=j/36, strata=.025*Math.sin(y*.29+x*.07);
   const tone=1-.26*t+strata;
   return [.55*tone,.58*tone,.60*tone];
  },farMaterial);
  // Faint second escarpment lives much farther away and below the sky.
  // Its slope is fully continuous; no polygon end caps in the viewport.
  const distant=mat("distant_escarpment",[.61,.66,.69],.14);
  surface("distant_escarpment",80,16,(u,v)=>{
   const l=-200+400*u,top=-73+7*Math.sin(l*.022)+3*Math.sin(l*.071);
   return point(l,186+11*v,top-82*v);
  },(x,y,z)=>[.62,.67,.70].map(v=>v*(.98+.015*Math.sin(x*.035+y*.025))),distant);
  // Material skin from ENV010, retained only over the original unchanged
  // walkable top; a missing JPG must never prevent combat or touch selection.
   bank(true);bank(false);
   if(ASSET_ROOT&&typeof B.Texture==="function"){
    const shelf=scene.meshes?.find(m=>m.name==="env009_living_ledge");
    let albedo=null,normal=null,loadedA=false,loadedN=false,capMade=false;
    const isDisposed=()=>typeof scene.isDisposed==="function"?scene.isDisposed():
      Boolean(scene.isDisposed);
    const cap=()=>{
     if(capMade||!loadedA||!loadedN||isDisposed()||!shelf?.getVerticesData)return;
     try{
      const positions=shelf.getVerticesData("position");
      const uvs=shelf.getVerticesData("uv");
      const normals=shelf.getVerticesData("normal");
      const rockColors=shelf.getVerticesData("color");
      const originalIndices=shelf.getIndices();
      const count=97,rows=11,verts=count*rows,idxCount=(rows-1)*96*6;
      if(!positions||!uvs||!normals||!originalIndices||
         positions.length<verts*3||uvs.length<verts*2||
         normals.length<verts*3||originalIndices.length<idxCount)return;
      const data=new B.VertexData();
      data.positions=Array.from(positions.slice(0,verts*3));
      for(let i=1;i<data.positions.length;i+=3)data.positions[i]+=.018;
      data.indices=Array.from(originalIndices.slice(0,idxCount));
      data.normals=Array.from(normals.slice(0,verts*3));
      data.uvs=Array.from(uvs.slice(0,verts*2));
      data.colors=[];
      for(let i=0;i<verts;i++){
       const row=Math.floor(i/count);
       const alpha=row<=5?1:row===6?.94:row===7?.73:row===8?.45:row===9?.18:0;
       const k=i*4;
       data.colors.push(rockColors?.[k]??.56,rockColors?.[k+1]??.46,
         rockColors?.[k+2]??.355,alpha);
      }
      const mesh=track(new B.Mesh("env013_photo_ledge",scene));
      data.applyToMesh(mesh,false);
      const m=track(new B.StandardMaterial("env013_mat_photo_ledge",scene));
      m.diffuseColor=new B.Color3(.86,.81,.73);
      m.emissiveColor=new B.Color3(.025,.027,.022);
      m.specularColor=new B.Color3(.010,.012,.012);
      m.useVertexColors=true;
      m.diffuseTexture=albedo;m.bumpTexture=normal;
      mesh.material=m;mesh.hasVertexAlpha=true;mesh.useVertexColors=true;
      mesh.isPickable=false;mesh.checkCollisions=false;mesh.receiveShadows=false;
      own(mesh);own(m);capMade=true;
     }catch(_){/* ENV009 unchanged and always playable */ }
    };
    try{
     const opts=B.Texture.TRILINEAR_SAMPLINGMODE;
     albedo=track(new B.Texture(ASSET_ROOT+"rock063-color-512.jpg",scene,
      false,false,opts,()=>{loadedA=true;cap();},()=>{}));
     normal=track(new B.Texture(ASSET_ROOT+"rock063-normal-512.jpg",scene,
      false,false,opts,()=>{loadedN=true;cap();},()=>{}));
     for(const tex of [albedo,normal]){
      tex.uScale=1.65;tex.vScale=1.65;
      if(B.Texture.WRAP_ADDRESSMODE!==undefined){
       tex.wrapU=B.Texture.WRAP_ADDRESSMODE;tex.wrapV=B.Texture.WRAP_ADDRESSMODE;
      }
     }
     normal.level=.32;
     for(const name of ["attached_left_shoulder","falling_right_rim","opposing_wall"]){
      const m=scene.materials.find(x=>x.name==="env013_mat_"+name);
      if(m){m.diffuseTexture=albedo;m.bumpTexture=normal;}
     }
    }catch(_){/* vertex-colour fallback */ }
   }

   for(const name of ["env009_near_escarpment","env009_far_ridge","env009_horizon_ridge"]){
    const old=scene.meshes?.find(x=>x.name===name);
    old?.setEnabled?.(false);
   }
   if(typeof B.Color4==="function")scene.clearColor=new B.Color4(.56,.645,.685,1);
   if(B.Scene?.FOGMODE_EXP2!==undefined){
    scene.fogMode=B.Scene.FOGMODE_EXP2;scene.fogDensity=.0072;
    scene.fogColor=new B.Color3(.61,.68,.715);
   }
   if(Array.isArray(scene.lights)){
    const hemi=scene.lights.find(x=>x.name==="hemi");
    const key=scene.lights.find(x=>x.name==="key");
    if(hemi){hemi.intensity=.91;hemi.diffuse=new B.Color3(.85,.90,.94);}
    if(key){key.intensity=1.12;key.diffuse=new B.Color3(1,.90,.79);}
   }
   if(typeof document!=="undefined"&&document.documentElement)
    document.documentElement.dataset.env013Status="ready";
   for(const resource of resources)own(resource);
   return Object.freeze({...stats});
  }catch(error){
   for(let i=resources.length-1;i>=0;i--)try{resources[i].dispose?.();}catch(_){}
   if(typeof document!=="undefined"&&document.documentElement)
    document.documentElement.dataset.env013Status="fallback";
   throw error;
  }
 }
 return Object.freeze({supported,build});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=CombatEnvironment013;
