/* COMBAT-VISUAL-007/008 — procedural non-canonical arena and impact cues.
 * ARENA-VIS-002: impact cue is a pooled spark burst (flash + instanced sparks).
 * One Scene, one render loop; never modifies CombatCore or fighter stats.
 * All scenery and FX meshes are non-pickable and owned by the Babylon Scene.
 */
const CombatVisual007=(()=>{
 "use strict";
 // ARENA-VIS-002: spark burst (was a 160 ms ring). Durations are animation time.
 const MAX_FX=3,FX_DURATION_MS=280,SPARKS=9,GRAVITY=9;
 function supported(B){
  return !!(B?.MeshBuilder?.CreateGround&&B.MeshBuilder.CreateBox&&
   B.MeshBuilder.CreateCylinder&&B.MeshBuilder.CreateSphere&&
   B.MeshBuilder.CreateTorus&&B.StandardMaterial&&B.Color3&&B.Vector3);
 }
 function create(B,scene,options={}){
  if(!supported(B)||!scene)throw Error("CV007 requires Babylon geometry and a Scene");
  const resources=[],effects=[];
  const conceptBackdrop=options.conceptBackdrop===true;
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
  const useEnv009=conceptBackdrop || (typeof CombatEnvironment009!=="undefined" && CombatEnvironment009.supported(B));
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
  function billboard(mesh){
   const all=B.AbstractMesh?.BILLBOARDMODE_ALL??B.Mesh?.BILLBOARDMODE_ALL??7;
   mesh.billboardMode=all;return mesh;
  }
  // Billboard quad; a tiny sphere where a minimal Babylon build has no CreatePlane.
  function plane(name,size){
   const mesh=B.MeshBuilder.CreatePlane?B.MeshBuilder.CreatePlane(name,{size},scene):
    B.MeshBuilder.CreateSphere(name,{diameter:size,segments:2},scene);
   return billboard(mesh);
  }
  // Radial hot dot (64 px), generated once per Scene; no download.
  function sparkTex(){
   if(typeof B.DynamicTexture!=="function")return null;
   try{
    const t=owned(new B.DynamicTexture("cv007_spark_tex",{width:64,height:64},scene,false));
    const c=t.getContext();
    if(!c?.createRadialGradient){t.dispose?.();resources.splice(resources.indexOf(t),1);return null;}
    c.clearRect(0,0,64,64);
    // Hot core and a saturated red-orange rim: reads on a pale backdrop too.
    const g=c.createRadialGradient(32,32,1,32,32,31);
    g.addColorStop(0,"rgba(255,248,214,1)");g.addColorStop(.22,"rgba(255,206,86,1)");
    g.addColorStop(.5,"rgba(244,112,24,.9)");g.addColorStop(.78,"rgba(170,36,8,.45)");
    g.addColorStop(1,"rgba(120,20,4,0)");
    c.fillStyle=g;c.fillRect(0,0,64,64);t.hasAlpha=true;t.update();
    return t;
   }catch(_){return null;}
  }
  function billboardMaterial(name,texture,r,g,b){
   // Lighting disabled: Babylon then takes the colour from emissive x texture,
   // so the texture alone defines the burst (same recipe as ArenaVis001 rings).
   const m=material(name,0,0,0);
   m.emissiveColor=new B.Color3(r,g,b);
   m.disableLighting=true;m.backFaceCulling=false;
   if(texture){m.diffuseTexture=texture;m.opacityTexture=texture;m.useAlphaFromDiffuseTexture=true;}
   m.alpha=0;return m;
  }
  try{
   if(conceptBackdrop){
    // 2D concept is painted behind transparent WebGL; only fighters and hit-FX
    // remain in 3D. Do not allocate legacy scenery or interfere with picking.
    if(typeof document!=="undefined"&&document.documentElement)
     document.documentElement.dataset.environment="ENV022-CONCEPT-PREVIEW";
   }else if(useEnv009){
    CombatEnvironment009.build(B,scene,owned);
    // ENV010: fixed-view atmosphere, visually additive to the stable 3D ledge.
    const oldEnvironmentPreview=typeof location!=="undefined" && /(?:^|[?&])environment=env010(?:&|$)/.test(location.search);
    if(!oldEnvironmentPreview&&typeof CombatEnvironment017!=="undefined"&&CombatEnvironment017.supported(B)){
     CombatEnvironment017.build(B,scene,owned);
    }else if(typeof CombatEnvironment010!=="undefined"&&CombatEnvironment010.supported(B)){
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
   // ARENA-VIS-002: three pooled spark bursts replace the 160 ms ring.
   // Each burst = one flash billboard + SPARKS instances of one billboard
   // (hardware instancing: one draw call), one material per pool slot.
   const sparkTexture=sparkTex();
   for(let i=0;i<MAX_FX;i++){
    const flashMat=billboardMaterial("hit_flash_"+i,sparkTexture,1,1,1);
    const sparkMat=billboardMaterial("hit_spark_"+i,sparkTexture,1,1,1);
    // Rendering group 1 draws after the fighters with a fresh depth buffer, so an
    // attacker standing in front of its target (melee contact) cannot hide the burst.
    const flash=decorate(plane("cv007_hit_flash_"+i,1.5),flashMat,0,1.2,0);
    flash.renderingGroupId=1;
    flash.setEnabled(false);
    const master=decorate(plane("cv007_hit_spark_"+i,.3),sparkMat,0,1.2,0);
    master.renderingGroupId=1;
    master.setEnabled(false);
    const sparks=[master];
    for(let k=1;k<SPARKS;k++){
     const spark=typeof master.createInstance==="function"?owned(master.createInstance("cv007_hit_spark_"+i+"_"+k)):
      decorate(plane("cv007_hit_spark_"+i+"_"+k,.3),sparkMat,0,1.2,0);
     if(!(spark.sourceMesh))spark.renderingGroupId=1;
     spark.isPickable=false;billboard(spark);spark.setEnabled(false);sparks.push(spark);
    }
    effects.push({flash,sparks,velocity:sparks.map(()=>({x:0,y:0,z:0})),age:FX_DURATION_MS,strong:false});
   }
  }catch(error){
   for(let i=resources.length-1;i>=0;i--)try{resources[i].dispose?.();}catch(_){}
   throw error;
  }
  let cursor=0,seed=40503;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  function hide(e){e.flash.setEnabled(false);for(const s of e.sparks)s.setEnabled(false);}
  function clear(){
   cursor=0;
   for(const e of effects){e.age=FX_DURATION_MS;hide(e);}
  }
  // Started cues come from the existing animation timeline, not from combat math.
  function emit(cues,fighters){
   if(!Array.isArray(cues)||!fighters)return;
   const toCam=typeof ArenaStageView!=="undefined"&&ArenaStageView.toCamera?ArenaStageView.toCamera:{x:0,z:0};
   for(const cue of cues){
    if(cue?.slot!=="hit")continue;
    const visual=fighters[cue.id];
    const p=visual?.head?.position;
    if(!p)continue;
    const e=effects[cursor++%effects.length];
    e.age=0;e.strong=cue.strong===true;
    // Chest height, a little toward the camera so the body does not hide it.
    const x=p.x+toCam.x*.35,y=Math.max(.9,p.y-.55),z=p.z+toCam.z*.35;
    e.flash.position.x=x;e.flash.position.y=y;e.flash.position.z=z;
    e.flash.material.alpha=.95;e.flash.setEnabled(true);
    const count=e.strong?SPARKS:Math.ceil(SPARKS*.6);
    e.sparks.forEach((s,k)=>{
     s.position.x=x;s.position.y=y;s.position.z=z;
     if(k>=count){s.setEnabled(false);e.velocity[k].x=e.velocity[k].y=e.velocity[k].z=0;return;}
     const a=rand()*Math.PI*2,speed=(e.strong?4.4:3.4)*(.6+rand()*.6);
     e.velocity[k].x=Math.cos(a)*speed*.8;e.velocity[k].z=Math.sin(a)*speed*.8;
     e.velocity[k].y=(.9+rand()*1.6)*(e.strong?1.25:1);
     s.setEnabled(true);
    });
    e.sparks[0].material.alpha=1;
   }
  }
  function tick(deltaMs,multiplier=1){
   if(!Number.isFinite(deltaMs)||deltaMs<0||!Number.isFinite(multiplier)||multiplier<=0)return;
   const dt=Math.min(deltaMs,100)*multiplier,sec=dt/1000;
   for(const e of effects){
    if(e.age>=FX_DURATION_MS)continue;
    e.age=Math.min(FX_DURATION_MS,e.age+dt);
    const t=e.age/FX_DURATION_MS;
    if(t>=1){hide(e);continue;}
    // Flash: quick bloom in the first third of the burst.
    const f=Math.min(1,t*3);
    const fs=(e.strong?1.3:1)*(.6+f*.8);
    e.flash.scaling.x=fs;e.flash.scaling.y=fs;e.flash.scaling.z=fs;
    e.flash.material.alpha=.95*(1-f);
    if(f>=1)e.flash.setEnabled(false);
    e.sparks.forEach((s,k)=>{
     const v=e.velocity[k];
     s.position.x+=v.x*sec;s.position.y+=v.y*sec;s.position.z+=v.z*sec;
     v.y-=GRAVITY*sec;
     const k2=1-t;s.scaling.x=k2;s.scaling.y=k2;s.scaling.z=k2;
    });
    e.sparks[0].material.alpha=Math.min(1,1.6*(1-t));
   }
  }
  return Object.freeze({emit,tick,clear,pending:()=>effects.filter(e=>e.age<FX_DURATION_MS).length});
 }
 return Object.freeze({supported,create,MAX_FX,FX_DURATION_MS,SPARKS});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=CombatVisual007;
