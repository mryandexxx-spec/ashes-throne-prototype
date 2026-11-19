/* ARENA-VIS-001: presentation-only helpers for the SWGOH-style arena.
   - soft contact shadow under every fighter instead of the yellow disc;
   - one ground ring: gold for the acting fighter, red/green for the chosen target;
   - render resolution follows the device pixel ratio (cap 2) and steps down
     once if the frame rate stays low;
   - warm key / cool fill light with ACES tone mapping.
   No combat state, no extra render loop. Every function is safe to skip. */
const ArenaVis001=(()=>{
 "use strict";
 const MAX_DPR=2,LOW_FPS=38,SAMPLE_MS=2500;
 const cache=new WeakMap(); // Scene -> shared materials
 function supported(B){
  return !!(B?.MeshBuilder?.CreateGround&&B.DynamicTexture&&B.StandardMaterial&&B.Color3);
 }
 function radialTexture(B,scene,name,paint){
  const t=new B.DynamicTexture(name,{width:128,height:128},scene,false);
  const c=t.getContext();c.clearRect(0,0,128,128);paint(c);t.hasAlpha=true;t.update();return t;
 }
 function flatMaterial(B,scene,name,texture){
  const m=new B.StandardMaterial(name,scene);
  m.diffuseTexture=texture;m.useAlphaFromDiffuseTexture=true;m.disableLighting=true;
  m.emissiveColor=new B.Color3(1,1,1);m.backFaceCulling=false;return m;
 }
 function materials(B,scene){
  let m=cache.get(scene);if(m)return m;
  const shadow=new B.StandardMaterial("av001_shadow",scene);
  shadow.diffuseTexture=radialTexture(B,scene,"av001_shadow_tex",c=>{
   const g=c.createRadialGradient(64,64,4,64,64,62);
   g.addColorStop(0,"rgba(0,0,0,.62)");g.addColorStop(.55,"rgba(0,0,0,.32)");g.addColorStop(1,"rgba(0,0,0,0)");
   c.fillStyle=g;c.fillRect(0,0,128,128);
  });
  shadow.useAlphaFromDiffuseTexture=true;shadow.disableLighting=true;shadow.backFaceCulling=false;
  const ring=(name,color)=>flatMaterial(B,scene,"av001_ring_"+name,radialTexture(B,scene,"av001_ring_tex_"+name,c=>{
   c.strokeStyle=color;c.lineWidth=7;c.shadowColor=color;c.shadowBlur=10;
   c.beginPath();c.arc(64,64,50,0,Math.PI*2);c.stroke();
  }));
  m={shadow,active:ring("active","#f2c46a"),enemy:ring("enemy","#ff4b3a"),ally:ring("ally","#6fe08a")};
  cache.set(scene,m);return m;
 }
 // Returns the fighter "base": a pickable ground decal carrying fighter metadata.
 function createBase(B,scene,name,x,z){
  const mats=materials(B,scene);
  const base=B.MeshBuilder.CreateGround(name,{width:1.7,height:1.7},scene);
  base.position=new B.Vector3(x,.025,z);base.material=mats.shadow;
  const ring=B.MeshBuilder.CreateGround(name+"_ring",{width:1.75,height:1.75},scene);
  ring.parent=base;ring.position=new B.Vector3(0,.01,0);ring.isPickable=false;ring.setEnabled(false);
  base.av001Ring=ring; // game.js replaces base.metadata with {fighterId}
  return base;
 }
 // kind: null | "active" | "enemy" | "ally"
 function setMark(base,kind,B,scene){
  const ring=base?.av001Ring;
  if(!ring)return false;
  if(!kind){ring.setEnabled(false);return true;}
  ring.material=materials(B,scene)[kind];ring.setEnabled(true);return true;
 }
 function configureEngine(engine,win){
  const dpr=Math.max(1,Math.min(MAX_DPR,Number(win?.devicePixelRatio)||1));
  const state={level:1/dpr,steps:dpr>1.5?[1/1.5,1]:dpr>1?[1]:[],elapsed:0,frames:0};
  if(typeof engine?.setHardwareScalingLevel==="function")engine.setHardwareScalingLevel(state.level);
  return state;
 }
 // Called once per rendered frame. Lowers resolution, never raises it again,
 // so a busy phone does not oscillate between sharp and blurry.
 function adapt(engine,state,dtMs){
  if(!state||!state.steps.length||!(dtMs>0))return false;
  state.elapsed+=Math.min(dtMs,250);state.frames++;
  if(state.elapsed<SAMPLE_MS)return false;
  const fps=state.frames*1000/state.elapsed;state.elapsed=0;state.frames=0;
  if(fps>=LOW_FPS)return false;
  state.level=state.steps.shift();
  engine.setHardwareScalingLevel(state.level);
  if(typeof engine.resize==="function")engine.resize();
  return true;
 }
 function configureLighting(B,scene,hemi,key){
  if(hemi){hemi.intensity=.7;hemi.diffuse=new B.Color3(.72,.8,.95);hemi.groundColor=new B.Color3(.22,.2,.22);}
  if(key){key.direction=new B.Vector3(.45,-1,.35);key.intensity=2;key.diffuse=new B.Color3(1,.9,.78);}
  const ip=scene?.imageProcessingConfiguration;
  if(ip){
   ip.toneMappingEnabled=true;
   ip.toneMappingType=B.ImageProcessingConfiguration?.TONEMAPPING_ACES??1;
   ip.contrast=1.15;ip.exposure=1.25;
  }
 }
 return Object.freeze({supported,createBase,setMark,configureEngine,adapt,configureLighting,
  constants:Object.freeze({MAX_DPR,LOW_FPS,SAMPLE_MS})});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=ArenaVis001;
