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
  const stone=mat("weathered_stone"),canyon=mat("canyon_shadow"),
   middle=mat("middle_ridge"),back=mat("back_ridge"),horizon=mat("horizon");
  const palette={
   top:[.46,.46,.425],rim:[.34,.37,.37],face:[.285,.32,.337],
   valley:[.18,.24,.27],middle:[.29,.35,.37],
   back:[.375,.435,.45],horizon:[.43,.49,.51]
  };
  const mix=(a,b,t)=>a.map((v,i)=>v*(1-t)+b[i]*t);
  const varying=(col,s)=>col.map(v=>clamp(v*s,0,1));
  // Rock color follows strata and orientation, not random peppered points.
  function color(base,x,z,y,depth){
   const seam=Math.sin(y*2.75+x*.17+z*.085);
   const cleavage=Math.sin(x*.43-z*.23+y*.58);
   const factor=1+.065*seam+.038*cleavage-.035*depth;
   return varying(base,factor);
  }
  function surface(name,rings,sample,shade,material){
   const pos=[],rgba=[],indices=[],normals=[],count=SECTORS+1;
   for(let row=0;row<rings.length;row++){
    for(let i=0;i<=SECTORS;i++){
     const a=i*TAU/SECTORS;
     const [x,y,z]=sample(rings[row],a,row);
     const c=shade(x,y,z,rings[row],row,a);
     pos.push(x,y,z);rgba.push(c[0],c[1],c[2],1);
    }
   }
   for(let j=0;j<rings.length-1;j++)for(let i=0;i<SECTORS;i++){
    const a=j*count+i,b=a+count;
    indices.push(a,b,a+1,a+1,b,b+1);
   }
   B.VertexData.ComputeNormals(pos,indices,normals);
   const mesh=own(new B.Mesh("env009_"+name,scene));
   const data=new B.VertexData();
   data.positions=pos;data.indices=indices;data.normals=normals;data.colors=rgba;
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
    const crest=height*(.34+.78*peaks);
    const y=row===0?base:row===1?crest:
     row===2?crest*.72-1.6:base-1.3;
    return [x,y,z];
   },(x,y,z,r,row,a)=>{
    const face=row===0?mix(palette.valley,tint,.26):
     row===1?tint:row===2?varying(tint,.84):varying(tint,.73);
    const side=(.05*Math.sin(a*19+phase));
    return color(face,x,z,y,.35).map(v=>clamp(v+side,0,1));
   },material);
  }
  ridge("near_escarpment",[2.42,2.59,2.74,2.86],-9.9,6.0,.9,middle,palette.middle);
  ridge("far_ridge",[3.10,3.24,3.42,3.60],-11.0,8.5,2.1,back,palette.back);
  ridge("horizon_ridge",[4.05,4.26,4.47,4.68],-13.0,10.5,3.5,horizon,palette.horizon);
  // Atmospheric perspective stays in the scene, not in a flat sky-card.
  if(typeof B.Color4==="function")scene.clearColor=new B.Color4(.255,.322,.353,1);
  if(B.Scene&&B.Scene.FOGMODE_EXP2!==undefined){
   scene.fogMode=B.Scene.FOGMODE_EXP2;
   scene.fogDensity=.014;
   scene.fogColor=new B.Color3(.31,.375,.398);
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
