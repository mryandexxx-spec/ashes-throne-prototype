/* COMBAT-VISUAL-007/008 — procedural non-canonical arena and impact cues.
 * One Scene, one render loop; never modifies CombatCore or fighter stats.
 * All scenery and FX meshes are non-pickable and owned by the Babylon Scene.
 */
const CombatVisual007=(()=>{
 "use strict";
 const MAX_FX=3,FX_DURATION_MS=160;
 function supported(B){
  return !!(B?.MeshBuilder?.CreateGround&&B.MeshBuilder.CreateBox&&
   B.MeshBuilder.CreateCylinder&&B.MeshBuilder.CreateSphere&&
   B.MeshBuilder.CreateTorus&&B.StandardMaterial&&B.Color3&&B.Vector3);
 }
 function create(B,scene){
  if(!supported(B)||!scene)throw Error("CV007 requires Babylon geometry and a Scene");
  const resources=[],effects=[];
  function owned(value){resources.push(value);return value;}
  function material(name,r,g,b,emission=0){
   const m=owned(new B.StandardMaterial("cv007_mat_"+name,scene));
   m.diffuseColor=new B.Color3(r,g,b);
   m.specularColor=new B.Color3(.035,.035,.035);
   if(emission)m.emissiveColor=new B.Color3(r*emission,g*emission,b*emission);
   return m;
  }
  function decorate(mesh,mat,x,y,z){
   owned(mesh);mesh.material=mat;mesh.isPickable=false;
   mesh.position=new B.Vector3(x,y,z);return mesh;
  }
  function box(name,w,h,d,mat,x,y,z){
   return decorate(B.MeshBuilder.CreateBox("cv007_"+name,{width:w,height:h,depth:d},scene),mat,x,y,z);
  }
  function cyl(name,top,bottom,height,mat,x,y,z){
   return decorate(B.MeshBuilder.CreateCylinder("cv007_"+name,
    {diameterTop:top,diameterBottom:bottom,height,tessellation:7},scene),mat,x,y,z);
  }
  // The CV008 palette remains a safe fallback but is not allocated in ENV009.
  const useEnv009=typeof CombatEnvironment009!=="undefined" && CombatEnvironment009.supported(B);
  const legacyMaterial=(...args)=>useEnv009?null:material(...args);
  const sand=legacyMaterial("deck",.67,.64,.56),edge=legacyMaterial("edge",.23,.26,.28),
   worn=legacyMaterial("wear",.47,.42,.35),joint=legacyMaterial("joint",.17,.19,.20),
   canyon=legacyMaterial("canyon",.12,.17,.20),distant=legacyMaterial("distant",.23,.29,.32),
   pale=legacyMaterial("pale",.57,.52,.43),darkStone=legacyMaterial("dark_stone",.29,.32,.31),
   ochre=legacyMaterial("ochre",.46,.36,.27),farStone=legacyMaterial("far_stone",.18,.24,.29);
  // Canvas-generated texture is optional; no download, persistent network asset or dependency.
  function stoneGrain(){
   if(typeof B.DynamicTexture!=="function")return null;
   let texture=null;
   try{
    texture=new B.DynamicTexture("cv008_grain",{width:256,height:256},scene,false);
    const ctx=texture.getContext();
    if(!ctx||typeof ctx.fillRect!=="function")throw Error("2D texture context unavailable");
    ctx.fillStyle="#bcb7aa";ctx.fillRect(0,0,256,256);
    let seed=81723;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<2400;i++){
     const v=random(),x=random()*256,y=random()*256;
     ctx.fillStyle=v<.43?"rgba(43,55,57,.12)":v<.81?
      "rgba(235,214,173,.13)":"rgba(64,47,37,.12)";
     const d=1+random()*3.4;ctx.fillRect(x,y,d,d);
    }
    for(let i=0;i<13;i++){
     const x=random()*256,y=random()*256;
     ctx.beginPath();ctx.moveTo(x,y);
     ctx.lineTo(x+(random()-.5)*37,y+(random()-.5)*26);
     ctx.lineWidth=.35+random()*.75;ctx.strokeStyle="rgba(35,46,48,.15)";
     ctx.stroke();
    }
    texture.update(false);
    texture.uScale=3;texture.vScale=2;
    if(B.Texture){texture.wrapU=B.Texture.WRAP_ADDRESSMODE;texture.wrapV=B.Texture.WRAP_ADDRESSMODE;}
    owned(texture);
    return texture;
   }catch(error){try{texture?.dispose();}catch(_){}return null;}
  }
  const grain=useEnv009?null:stoneGrain();
  if(grain)sand.diffuseTexture=grain;
  function outcrop(name,x,y,z,w,h,d,mat,lean=0){
   const mesh=decorate(B.MeshBuilder.CreateSphere("cv008_"+name,
    {diameter:1,segments:4},scene),mat,x,y,z);
   mesh.scaling=new B.Vector3(w,h,d);
   mesh.rotation.z=lean;return mesh;
  }
  try{
   if(useEnv009){
    CombatEnvironment009.build(B,scene,owned);
    // ENV011 opens a sightline through the existing rear lip before the
    // ENV010 cap samples the same vertex buffers. No collision/picking changes.
    if(typeof CombatEnvironment011!=="undefined"){
     try{CombatEnvironment011.openRearExit(B,scene);}
     catch(error){console.warn("ENV011 rear lip unavailable",error);}
    }
    // ENV010: fixed-view atmosphere, visually additive to the stable 3D ledge.
    if(typeof CombatEnvironment010!=="undefined"&&CombatEnvironment010.supported(B)){
     CombatEnvironment010.build(B,scene,owned);
    }
   }else{
   // Continuous walkable plane preserves the established combat formation/camera.
   decorate(B.MeshBuilder.CreateGround("cv007_surface",{width:16,height:9},scene),sand,0,.007,0);
   box("shelf",15.6,.32,8.55,edge,0,-.23,0);
   decorate(B.MeshBuilder.CreateGround("cv007_chasm",{width:35,height:27},scene),canyon,0,-4.2,0);
   // Broad worn patches are irregular, almost flush with the main walking plane.
   for(let i=0;i<8;i++){
    const x=-5.5+(i%4)*3.55+(i%2)*.3,z=-2.15+Math.floor(i/4)*4.1;
    const patch=decorate(B.MeshBuilder.CreateCylinder("cv008_patch_"+i,
     {height:.012,diameterTop:1.6+(i%3)*.35,diameterBottom:1.9+(i%3)*.35,
      tessellation:5},scene),i%3===0?darkStone:i%3===1?pale:worn,x,.016,z);
    patch.rotation.y=i*.47;
   }
   // Broken, staggered lip. No long straight barrier resembling manufactured rails.
   for(const side of [-1,1])for(let i=0;i<5;i++){
    const x=-6.4+i*3.05+(i%2)*.19,z=side*(4.23+(i%3)*.11);
    const lip=box("broken_lip_"+side+"_"+i,2.2+(i%3)*.25,
     .12+(i%2)*.05,.34+(i%2)*.13,i%2?worn:edge,x,.016,z);
    lip.rotation.y=(i%2?1:-1)*.07;
   }
   // Small dislodged stones along outer edges; none can be picked as a fighter.
   for(let i=0;i<10;i++){
    const side=i%2===0?-1:1,x=-6.9+(i%5)*3.5;
    const z=side*(4.44+(i%3)*.25);
    outcrop("fallen_"+i,x,-.12,z,.25+(i%3)*.2,.13+(i%2)*.1,
     .3+(i%4)*.13,i%3===0?ochre:darkStone,(i%2?.21:-.18));
   }
   // Sparse cracks, not a Cartesian grid. Very low to avoid fighter clipping.
   for(let i=0;i<7;i++){
    const m=box("hairline_"+i,.016,.01,.57+(i%4)*.2,joint,
     -5.4+i*1.7,.021,(i%2?-1:1)*(1.2+(i%3)*.64));
    m.rotation.y=.17+i*.42;
   }
   // Layered distant rock masses: tapered / faceted irregular silhouettes instead
   // of the six vertical dark cylindrical placeholders visible in CV007.
   for(let i=0;i<12;i++){
    const left=i<6,slot=i%6;
    const x=left?-13.3+slot*2.5:-12.2+slot*2.6;
    const z=left?-(8.4+(i%3)*1.25):(8.6+(i%4)*1.15);
    const h=2.1+(i%5)*.71;
    outcrop("distant_mass_"+i,x,-1.9+(i%3)*.13,z,
     1.4+(i%4)*.35,h,1.1+(i%3)*.3,i%2?farStone:distant,(i%3-1)*.17);
   }
   // Subtle color depth, still one original scene and its two lights.
   if(typeof B.Color4==="function")scene.clearColor=new B.Color4(.105,.145,.175,1);
   if(B.Scene?.FOGMODE_EXP2!==undefined){
    scene.fogMode=B.Scene.FOGMODE_EXP2;scene.fogDensity=.021;
    scene.fogColor=new B.Color3(.19,.25,.29);
   }
   if(Array.isArray(scene.lights)){
    const hemi=scene.lights.find(l=>l.name==="hemi"),key=scene.lights.find(l=>l.name==="key");
    if(hemi){hemi.intensity=.74;hemi.diffuse=new B.Color3(.73,.82,.94);}
    if(key){key.intensity=1.13;key.diffuse=new B.Color3(1,.82,.64);}
   }
   }
   // Three pooled, short-lived impact cues. They never participate in pointer hits.
   for(let i=0;i<MAX_FX;i++){
    const ringMat=material("hit_ring_"+i,.81,.57,.30,.30);
    const glowMat=material("hit_glow_"+i,.89,.68,.37,.40);
    ringMat.alpha=.68;glowMat.alpha=.24;
    ringMat.disableLighting=true;glowMat.disableLighting=true;
    ringMat.backFaceCulling=false;
    const ring=decorate(B.MeshBuilder.CreateTorus("cv007_hit_ring_"+i,
     {diameter:.62,thickness:.055,tessellation:16},scene),ringMat,0,1.2,0);
    ring.rotation.x=Math.PI/2;ring.setEnabled(false);
    const glow=decorate(B.MeshBuilder.CreateSphere("cv007_hit_glow_"+i,
     {diameter:.35,segments:8},scene),glowMat,0,1.2,0);
    glow.setEnabled(false);
    effects.push({ring,glow,age:FX_DURATION_MS});
   }
  }catch(error){
   for(let i=resources.length-1;i>=0;i--)try{resources[i].dispose?.();}catch(_){}
   throw error;
  }
  let cursor=0;
  function clear(){
   cursor=0;
   for(const e of effects){
    e.age=FX_DURATION_MS;e.ring.setEnabled(false);e.glow.setEnabled(false);
   }
  }
  // Started cues come from the existing animation timeline, not from combat math.
  function emit(cues,fighters){
   if(!Array.isArray(cues)||!fighters)return;
   for(const cue of cues){
    if(cue?.slot!=="hit")continue;
    const visual=fighters[cue.id];
    const p=visual?.head?.position;
    if(!p)continue;
    const e=effects[cursor++%effects.length];
    e.age=0;
    e.ring.material.alpha=.68;e.glow.material.alpha=.24;
    for(const mesh of [e.ring,e.glow]){
     mesh.position.x=p.x;mesh.position.y=1.13;mesh.position.z=p.z;
     mesh.setEnabled(true);
    }
   }
  }
  function tick(deltaMs,multiplier=1){
   if(!Number.isFinite(deltaMs)||deltaMs<0||!Number.isFinite(multiplier)||multiplier<=0)return;
   const dt=Math.min(deltaMs,100)*multiplier;
   for(const e of effects){
    if(e.age>=FX_DURATION_MS)continue;
    e.age=Math.min(FX_DURATION_MS,e.age+dt);
    const t=e.age/FX_DURATION_MS;
    if(t>=1){e.ring.setEnabled(false);e.glow.setEnabled(false);continue;}
    const s=.62+t*.92;
    e.ring.scaling.x=s;e.ring.scaling.y=s;e.ring.scaling.z=s;
    const g=.7+t*.5;
    e.glow.scaling.x=g;e.glow.scaling.y=g;e.glow.scaling.z=g;
    e.ring.material.alpha=.68*(1-t);
    e.glow.material.alpha=.24*(1-t);
   }
  }
  return Object.freeze({emit,tick,clear,pending:()=>effects.filter(e=>e.age<FX_DURATION_MS).length});
 }
 return Object.freeze({supported,create,MAX_FX,FX_DURATION_MS});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=CombatVisual007;
