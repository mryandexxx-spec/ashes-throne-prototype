/* COMBAT-VISUAL-007 — procedural, non-canonical cliffside arena and impact cues.
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
  const sand=material("deck",.29,.29,.29),edge=material("edge",.22,.23,.25),
   worn=material("wear",.36,.33,.29),joint=material("joint",.17,.18,.20),
   canyon=material("canyon",.09,.115,.14),distant=material("distant",.14,.16,.18);
  try{
   // Solid training platform, not a declared district or map of Gardens over the Abyss.
   decorate(B.MeshBuilder.CreateGround("cv007_surface",{width:16,height:9},scene),sand,0,.007,0);
   box("shelf",16,.38,9,edge,0,-.24,0);
   decorate(B.MeshBuilder.CreateGround("cv007_chasm",{width:35,height:27},scene),canyon,0,-4.2,0);
   for(const z of [-4.16,4.16]){
    for(let i=0;i<3;i++){
     const x=(i-1)*5.4;
     box("rim_"+z+"_"+i,4.15,.22,.32,worn,x,.09,z);
     box("rim_shadow_"+z+"_"+i,4.15,.05,.36,joint,x,-.045,z);
    }
   }
   // Worn stone seams, shallow and non-pickable; never become collision blockers.
   for(const x of [-5.5,-2.7,.15,3.1,5.8])
    box("cross_seam_"+String(x).replace(".","_"),.045,.012,7.15,joint,x,.018,0);
   for(const z of [-2.6,2.7])
    box("long_seam_"+String(z).replace(".","_"),13.8,.012,.045,joint,0,.019,z);
   // Low distant silhouettes, outside the playable footprint; no lore claims.
   for(let i=0;i<6;i++){
    const x=-12+i*4.7,z=i%2===0?8.7:-9.1;
    cyl("far_cliff_"+i,1.25+(i%3)*.48,1.7+(i%3)*.5,
     2.2+(i%3)*.72,distant,x,-2.2,z);
   }
   for(let i=0;i<3;i++){
    const x=-7+i*7;
    box("ledge_end_"+i,2.7,.36,.55,worn,x,-.26,4.5);
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
