/* COMBAT-ENV-013 — one authored, non-canonical gorge composition.
 * The ENV009 contact ledge and ravine are retained. This background is NOT
 * a map of the Gardens over the Abyss. No gameplay, picking, camera or loops.
 * Four asymmetric, closed 3D rock masses, not screen-facing billboards.
 */
const CombatEnvironment013=(()=>{
 "use strict";
 const ALPHA=-3*Math.PI/4;
 const AWAY={x:-Math.cos(ALPHA),z:-Math.sin(ALPHA)};
 const RIGHT={x:-Math.sin(ALPHA),z:Math.cos(ALPHA)};
 const CLAMP=(n,a,b)=>Math.max(a,Math.min(b,n));
 const ASSET_ROOT=typeof document!=="undefined"&&document.currentScript?.src?
  new URL("assets/env010/",document.currentScript.src).href:null;
 function supported(B){
  return !!(B&&B.Mesh&&B.VertexData&&B.VertexData.ComputeNormals&&
    B.StandardMaterial&&B.Color3);
 }
 function build(B,scene,own){
  if(!supported(B)||!scene||typeof own!=="function")throw Error("ENV013 needs Babylon VertexData");
  const resources=[],stats={meshes:0,vertices:0,triangles:0};
  // Ownership is local until a complete geometry set has been constructed.
  // On failure, dispose only our resources and let CV007 fall back to ENV010.
  function track(resource){resources.push(resource);return resource;}
  const point=(l,d,y)=>[AWAY.x*d+RIGHT.x*l,y,AWAY.z*d+RIGHT.z*l];
  const mix=(a,b,t)=>a+(b-a)*t;
  function between(knots,t){
   const k=CLAMP(t,0,1)*(knots.length-1),i=Math.min(knots.length-2,Math.floor(k)),f=k-i;
   return knots[i].map((v,j)=>mix(v,knots[i+1][j],f));
  }
  function rockMaterial(name,shade){
   const m=track(new B.StandardMaterial("env013_mat_"+name,scene));
   m.diffuseColor=new B.Color3(1,1,1);
   m.specularColor=new B.Color3(.012,.013,.014);
   m.emissiveColor=new B.Color3(shade,shade*1.06,shade*1.1);
   m.backFaceCulling=false;
   m.useVertexColors=true;
   m.fogEnabled=true;
   return m;
  }
  // Each authored knot is [screen-right offset, distance away, upper crest,
  // vertical base]. The upper boundary sits below the fighters on the right.
  // Geometry has a real 3D front, back, upper bench, underside and end caps.
  const formations=[
   {name:"attached_left_shoulder",base:[.58,.49,.39],glow:.055,width:17,steps:40,
    knots:[[-94,42,-6,-74],[-70,34,-3,-69],[-46,29,-4,-66],[-31,24,-1,-63],
     [-19,20,-4,-62],[-11,17,-6,-58]]},
   {name:"falling_right_rim",base:[.50,.43,.355],glow:.040,width:13,steps:32,
    knots:[[8,17,-12,-75],[18,20,-17,-80],[27,27,-14,-88],
     [40,33,-25,-94],[53,40,-22,-96],[73,52,-28,-105]]},
   {name:"opposing_wall",base:[.50,.52,.52],glow:.060,width:23,steps:48,
    knots:[[16,68,-32,-120],[30,73,-27,-124],[46,79,-36,-126],
     [65,82,-34,-131],[80,88,-42,-138],[96,92,-35,-137],[123,105,-43,-143]]},
   {name:"distant_strata",base:[.59,.63,.66],glow:.070,width:32,steps:48,
    knots:[[-51,132,-58,-155],[-25,137,-50,-163],[4,144,-55,-168],
     [34,153,-44,-171],[55,162,-54,-175],[85,176,-49,-180],[120,192,-61,-190]]}
  ];
  // Draw the cliff as a single indexed solid. Deliberately split rock
  // benches, irregular talus, and erosion seams; never random rock placement.
  function createFormation(cfg){
   const material=rockMaterial(cfg.name,cfg.glow);
   const positions=[],uvs=[],colors=[],indices=[],bands=10,columns=cfg.steps;
   function vertex(l,d,y,row,t,roof=false){
    const p=point(l,d,y);positions.push(...p);
    uvs.push(roof?l*.085:l*.085+.08*Math.sin(y*.061),roof?d*.085:y*.083);
    const seam=Math.sin(y*.19+l*.064+d*.023);
    const joints=Math.abs(Math.sin(l*.11+y*.075+d*.018));
    const bed=.035*Math.sin(y*.38+l*.045);
    const rough=1+.052*seam+bed-(joints>.965?.065:0);
    const shade=(1-row*.30)*(roof?1.06:1)*rough;
    const c=cfg.base.map(x=>CLAMP(x*shade,0,1));
    colors.push(c[0],c[1],c[2],1);
    return positions.length/3-1;
   }
   const front=[],back=[];
   for(let side=0;side<2;side++){
    const collection=side?back:front;
    for(let row=0;row<=bands;row++){
     const u=row/bands;
     for(let i=0;i<=columns;i++){
      const t=i/columns;
      const [l,d,crest,bottom]=between(cfg.knots,t);
      // A shallow angular warp adds uneven rock strata without moving
      // the contact plane or erecting towers over the 3/4 view.
      const cleavage=.60*Math.sin(l*.33+row*.41)+.31*Math.sin(l*.79-row*.51);
      const dip=side?2.4:0;
      const y=mix(crest-dip,bottom,u)+cleavage*(1-u)*.68;
      const sideDepth=side?cfg.width:0;
      const strata=2.1*Math.sin(u*11.3+l*.047)+
       1.0*Math.sin(u*21.7+l*.14)+.55*Math.cos(l*.25+row*.61);
      const cut=(u>.12&&u<.85)?strata:0;
      const d2=d+sideDepth+cut*(side?.45:1.0)*(1-u*.30);
      collection.push(vertex(l,d2,y,u,t));
     }
    }
   }
   const stride=columns+1,count=(bands+1)*stride;
   for(let row=0;row<bands;row++)for(let i=0;i<columns;i++){
    const a=row*stride+i,b=a+stride;
    indices.push(front[a],front[b],front[a+1],front[a+1],front[b],front[b+1]);
    indices.push(back[a+1],back[b],back[a],back[b+1],back[b],back[a+1]);
   }
   for(let i=0;i<columns;i++){
    const a=i,b=i+1,last=bands*stride;
    indices.push(front[a],front[b],back[a],front[b],back[b],back[a]);
    indices.push(front[last+a],back[last+a],front[last+b],
     front[last+b],back[last+a],back[last+b]);
   }
   for(let row=0;row<bands;row++){
    const a=row*stride,b=(row+1)*stride,last=columns;
    indices.push(front[a],back[a],front[b],front[b],back[a],back[b]);
    indices.push(front[b+last],back[a+last],front[a+last],
     front[b+last],back[b+last],back[a+last]);
   }
   // Separate horizontal UVs on the upper rock bench; no radial stretch.
   const roofFront=[],roofBack=[];
   for(let i=0;i<=columns;i++){
    const t=i/columns,[l,d,y]=between(cfg.knots,t);
    roofFront.push(vertex(l,d,y,0,t,true));
    roofBack.push(vertex(l,d+cfg.width,y-2.4,0,t,true));
   }
   for(let i=0;i<columns;i++)
    indices.push(roofFront[i],roofBack[i],roofFront[i+1],
      roofFront[i+1],roofBack[i],roofBack[i+1]);
   const normals=[];
   B.VertexData.ComputeNormals(positions,indices,normals);
   const mesh=track(new B.Mesh("env013_"+cfg.name,scene)),data=new B.VertexData();
   data.positions=positions;data.indices=indices;data.normals=normals;
   data.colors=colors;data.uvs=uvs;data.applyToMesh(mesh,false);
   mesh.material=material;mesh.useVertexColors=true;
   mesh.isPickable=false;mesh.checkCollisions=false;mesh.receiveShadows=false;
   stats.meshes++;stats.vertices+=positions.length/3;stats.triangles+=indices.length/3;
  }
  try{
   formations.forEach(createFormation);
   // Texture is the existing local CC0 Rock063 pair used by ENV010, not a
   // new download, library, shader, GLB importer or per-frame operation.
   // The vertex colours and baked relief remain a usable texture fallback.
   if(ASSET_ROOT&&typeof B.Texture==="function"){
    try{
     const color=track(new B.Texture(ASSET_ROOT+"rock063-color-512.jpg",scene));
     const normal=track(new B.Texture(ASSET_ROOT+"rock063-normal-512.jpg",scene));
     for(const tex of [color,normal]){
      tex.uScale=1.42;tex.vScale=1.42;
      if(B.Texture.WRAP_ADDRESSMODE!==undefined){
       tex.wrapU=B.Texture.WRAP_ADDRESSMODE;tex.wrapV=B.Texture.WRAP_ADDRESSMODE;
      }
     }
     normal.level=.23;
     for(const name of ["attached_left_shoulder","falling_right_rim","opposing_wall"]){
      const m=scene.materials.find(x=>x.name==="env013_mat_"+name);
      if(m){m.diffuseTexture=color;m.bumpTexture=normal;}
     }
    }catch(error){
     // Meshes remain usable without optional photo maps.
    }
   }
   // Never remove or move the actual ENV009 fighter contact ledge or ravine.
   // Only the three redundant circular horizon walls are retired.
   for(const name of ["env009_near_escarpment","env009_far_ridge","env009_horizon_ridge"]){
    const old=scene.meshes?.find(x=>x.name===name);
    old?.setEnabled?.(false);
   }
   if(typeof B.Color4==="function")scene.clearColor=new B.Color4(.55,.635,.68,1);
   if(B.Scene?.FOGMODE_EXP2!==undefined){
    scene.fogMode=B.Scene.FOGMODE_EXP2;scene.fogDensity=.0065;
    scene.fogColor=new B.Color3(.59,.655,.69);
   }
   if(Array.isArray(scene.lights)){
    const hemi=scene.lights.find(x=>x.name==="hemi");
    const key=scene.lights.find(x=>x.name==="key");
    if(hemi){hemi.intensity=.98;hemi.diffuse=new B.Color3(.87,.89,.92);}
    if(key){key.intensity=1.22;key.diffuse=new B.Color3(1,.88,.75);}
   }
   if(typeof document!=="undefined"&&document.documentElement)
    document.documentElement.dataset.env013Status="ready";
   for(const r of resources)own(r);
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
