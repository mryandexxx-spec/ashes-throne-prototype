/* COMBAT-ENV-009 — original non-canonical geological environment.
 * Geometry-only, camera-independent 3D. No remote assets, textures, animation,
 * gameplay rules, picking, timers, shadow maps or extra render loops.
 * Intentionally separate from the CV007 hit-FX pool and CV008 fallback.
 */
const CombatEnvironment009=(()=>{
 "use strict";
 const SECTORS=96;
 const TAU=Math.PI*2;
 const RADII=Object.freeze([0,.13,.29,.44,.58,.69,.77,.84,.90,.945,.99,1.05,1.13,1.25]);
 const HEIGHTS=Object.freeze([0,0,0,0,0,0,.028,.085,.13,.04,-.42,-1.30,-2.85,-5.1]);
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const wave=(a,k,phase=0)=>Math.sin(a*k+phase);
 // The formation footprint remains on y=0; erosion is confined to the rim.
 function rimPoint(r,a){
  const rough=1+.045*wave(a,5,.4)+.023*wave(a,11,1.3)+.012*wave(a,23,2.1);
  const fan=1+.065*wave(a,3,-.3);
  return [Math.cos(a)*9.15*r*rough*fan,Math.sin(a)*5.85*r*rough];
 }
 function supported(B){
  return !!(B&&typeof B.Mesh==="function"&&typeof B.VertexData==="function"&&
   typeof B.VertexData.ComputeNormals==="function"&&typeof B.StandardMaterial==="function"&&
   typeof B.Color3==="function");
 }
 function build(B,scene,own){
  if(!supported(B)||!scene||typeof own!=="function")throw Error("ENV009 requires Babylon VertexData");
  const created=[];
  const stats={geometry:0,vertices:0,triangles:0};
  function mat(name){
   const value=own(new B.StandardMaterial("env009_mat_"+name,scene));
   value.diffuseColor=new B.Color3(1,1,1);
   value.specularColor=new B.Color3(.018,.023,.025);
   value.backFaceCulling=false;
   value.useVertexColors=true;
   value.emissiveColor=new B.Color3(.095,.105,.105);
   return value;
  }
  // Geologically banded local material: one 512px canvas allocated at scene creation,
  // with continuous strata, erosion paths and mineral veins (not salt-and-pepper dots).
  function lithologyTexture(){
   if(typeof B.DynamicTexture!=="function")return null;
   let tex=null;
   try{
    tex=new B.DynamicTexture("env009_sedimentary_albedo",512,scene,false);
    const ctx=tex.getContext();
    if(!ctx?.createImageData||!ctx?.putImageData)throw Error("Canvas image API missing");
    const w=512,img=ctx.createImageData(w,w),px=img.data;
    const grid=new Float32Array(65*65);
    let seed=204881;
    for(let j=0;j<65;j++)for(let i=0;i<65;i++){
     seed=(Math.imul(seed,1664525)+1013904223)>>>0;
     grid[j*65+i]=seed/4294967296;
    }
    const noise=(u,v,cells)=>{
     // Wrap lattice indices so UV tiling cannot expose straight seams.
     const x=((u%1)+1)%1*cells,y=((v%1)+1)%1*cells;
     const i=Math.floor(x),j=Math.floor(y);
     const a=x-i,b=y-j,fa=a*a*(3-2*a),fb=b*b*(3-2*b);
     const sample=(ix,iy)=>grid[(iy%cells)*65+(ix%cells)];
     const n0=sample(i,j)*(1-fa)+sample(i+1,j)*fa;
     const n1=sample(i,j+1)*(1-fa)+sample(i+1,j+1)*fa;
     return n0*(1-fb)+n1*fb;
    };
    for(let y=0;y<w;y++)for(let x=0;x<w;x++){
     const u=x/w,v=y/w;
     // Cohesive erosion mosaics, disrupted seams and veins. No repeated
     // parallel bands on the walkable surface or rectangular UV borders.
     const broad=noise(u,v,5),mid=noise(u,v,14),fine=noise(u,v,35);
     const warp=(noise(u+.19,v-.12,7)-.5)*.21+(mid-.5)*.075;
     const mineral=Math.sin((v*3.4+u*2.1+warp)*TAU);
     const vein=(noise(u+.16,v+.08,11)-.5);
     const shale=Math.abs(Math.sin((v*2.7+u*1.33+warp)*TAU))<.08;
     const tone=clamp(.835+.29*(broad-.5)+.20*(mid-.5)+.13*(fine-.5)+
      .025*mineral+.032*vein-(shale?.045:0),.52,1.0);
     const k=(y*w+x)*4;
     px[k]=Math.round(228*tone);px[k+1]=Math.round(222*tone);
     px[k+2]=Math.round(207*tone);px[k+3]=255;
    }
    ctx.putImageData(img,0,0);
    tex.update(false);
    if(B.Texture){tex.wrapU=B.Texture.WRAP_ADDRESSMODE;tex.wrapV=B.Texture.WRAP_ADDRESSMODE;}
    own(tex);
    return tex;
   }catch(error){try{tex?.dispose();}catch(_){}return null;}
  }
  const stone=mat("weathered_stone"),canyon=mat("canyon_shadow"),
   middle=mat("middle_ridge"),back=mat("back_ridge"),horizon=mat("horizon");
  const lithology=lithologyTexture();
  if(lithology)stone.diffuseTexture=lithology;
  const palette={
   top:[.56,.46,.355],rim:[.43,.36,.295],face:[.31,.33,.32],
   valley:[.22,.28,.30],middle:[.31,.365,.375],
   back:[.41,.46,.475],horizon:[.48,.53,.55]
  };
  const mix=(a,b,t)=>a.map((v,i)=>v*(1-t)+b[i]*t);
  const varying=(col,s)=>col.map(v=>clamp(v*s,0,1));
  // Rock color follows strata and orientation, not random peppered points.
  function color(base,x,z,y,depth){
   const seam=Math.sin(y*2.75+x*.17+z*.085);
   const cleavage=Math.sin(x*.43-z*.23+y*.58);
   // Broad sediment beds, pressure fractures and oxidised bands: no pepper noise.
   const lamina=.12*Math.sin(x*.53+z*.37+.65*Math.sin(z*.32));
   const erosion=.067*Math.sin(x*1.14-z*.91+.4*Math.cos(x*.33));
   const fracture=Math.abs(Math.sin(x*.42-z*.56+.33*Math.sin(z*.65)))>.985?-.18:0;
   const factor=1+.06*seam+.045*cleavage+lamina+erosion+fracture-.035*depth;
   return varying(base,factor);
  }
  function surface(name,rings,sample,shade,material){
   const pos=[],rgba=[],uv=[],indices=[],normals=[],count=SECTORS+1;
   for(let row=0;row<rings.length;row++){
    for(let i=0;i<=SECTORS;i++){
     const a=i*TAU/SECTORS;
     const [x,y,z]=sample(rings[row],a,row);
     const c=shade(x,y,z,rings[row],row,a);
     pos.push(x,y,z);rgba.push(c[0],c[1],c[2],1);
     const cliffBlend=name==="living_ledge"?clamp((row-8)/5,0,1):0;
     uv.push(x*.12, z*.12*(1-cliffBlend)+y*.19*cliffBlend);
    }
   }
   for(let j=0;j<rings.length-1;j++)for(let i=0;i<SECTORS;i++){
    const a=j*count+i,b=a+count;
    indices.push(a,b,a+1,a+1,b,b+1);
   }
   B.VertexData.ComputeNormals(pos,indices,normals);
   const mesh=own(new B.Mesh("env009_"+name,scene));
   const data=new B.VertexData();
   data.positions=pos;data.indices=indices;data.normals=normals;data.colors=rgba;data.uvs=uv;
   data.applyToMesh(mesh,false);
   mesh.material=material;
   mesh.isPickable=false;
   mesh.useVertexColors=true;
   mesh.checkCollisions=false;
   mesh.receiveShadows=false;
   mesh.alwaysSelectAsActiveMesh=false;
   created.push(mesh);
   stats.geometry++;stats.vertices+=pos.length/3;stats.triangles+=indices.length/3;
   return mesh;
  }
  // One uninterrupted sculpted mass: flat contact zone, weathered shoulder,
  // irregular rim and physically descending rock face (no rectangular box).
  surface("living_ledge",RADII,(r,a,row)=>{
   const [x,z]=rimPoint(r,a);
   const fracture=Math.sin(a*7-.8)*.07+Math.sin(a*17+1.8)*.037;
   const erosion=r>.69?(r-.69)*fracture:0;
   return [x,HEIGHTS[row]+erosion,z];
  },(x,y,z,r,row)=>{
   const band=row<7?palette.top:row<10?
    mix(palette.top,palette.rim,(row-6)/4):
    mix(palette.rim,palette.face,clamp((row-9)/4,0,1));
   return color(band,x,z,y,row>9?.4:0);
  },stone);
  // A deep continuous ravine follows the same rock perimeter: no exposed
  // edge of a square ground plane or isolated decorative boulders.
  const ravineRings=[1.25,1.43,1.66,1.91,2.17,2.42];
  surface("ravine",ravineRings,(r,a,row)=>{
   const [x,z]=rimPoint(r,a);
   const channel=.75*Math.sin(a*6+.4)+.42*Math.sin(a*13-1.1);
   return [x,[-5.1,-7.05,-8.3,-9.15,-9.7,-9.9][row]+channel*(row/5),z];
  },(x,y,z,r,row)=>color(mix(palette.face,palette.valley,row/5),x,z,y,.8),canyon);
  // The following are spatial 3D annular rock formations, NOT camera-facing
  // billboards: silhouettes, scale and parallax survive arbitrary orbit.
  function ridge(name,rings,base,height,phase,material,tint){
   surface(name,rings,(r,a,row)=>{
    const [x,z]=rimPoint(r,a);
    const shape=.55*wave(a,3,phase)+.34*wave(a,7,phase*.7)+
     .18*wave(a,15,phase+1.9)+.08*wave(a,29,phase*2);
    // Peaks have broad valleys, ledges and secondary carved faces.
    const peaks=Math.max(0,shape+.48);
    // Only the opposite valley wall rises above the shelf; the camera-side
    // ravine stays open. This is real 3D, never billboard orientation.
    const facing=Math.cos(a+3*Math.PI/4);
    const distantSide=clamp((.24-facing)/1.10,0,1);
    const crest=base+distantSide*(10.8+height*(.19+.30*peaks));
    const mid=base+distantSide*(7.5+height*(.11+.18*peaks));
    const y=row===0?base:row===1?crest:row===2?mid:base-1.3;
    return [x,y,z];
   },(x,y,z,r,row,a)=>{
    const face=row===0?mix(palette.valley,tint,.26):
     row===1?tint:row===2?varying(tint,.84):varying(tint,.73);
    const side=(.05*Math.sin(a*19+phase));
    return color(face,x,z,y,.35).map(v=>clamp(v+side,0,1));
   },material);
  }
  ridge("near_escarpment",[2.42,2.60,2.91,3.28],-9.9,6.0,.9,middle,palette.middle);
  ridge("far_ridge",[3.55,3.84,4.16,4.55],-11.0,8.5,2.1,back,palette.back);
  ridge("horizon_ridge",[4.95,5.25,5.61,6.08],-13.0,10.5,3.5,horizon,palette.horizon);
  // Atmospheric perspective stays in the scene, not in a flat sky-card.
  if(typeof B.Color4==="function")scene.clearColor=new B.Color4(.49,.55,.57,1);
  if(B.Scene&&B.Scene.FOGMODE_EXP2!==undefined){
   scene.fogMode=B.Scene.FOGMODE_EXP2;
   scene.fogDensity=.011;
   scene.fogColor=new B.Color3(.52,.57,.585);
  }
  if(Array.isArray(scene.lights)){
   const hemi=scene.lights.find(l=>l.name==="hemi");
   const key=scene.lights.find(l=>l.name==="key");
   if(hemi){hemi.intensity=.84;hemi.diffuse=new B.Color3(.78,.86,.92);}
   if(key){key.intensity=1.05;key.diffuse=new B.Color3(1,.89,.75);}
  }
  return Object.freeze({...stats,meshes:created.length});
 }
 return Object.freeze({supported,build,SECTORS,RADII,HEIGHTS,rimPoint});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=CombatEnvironment009;
