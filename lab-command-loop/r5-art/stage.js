"use strict";
// R5 stand: mesh geometry and textures owned by the existing disposable card Scene.
const R5Stage=(()=>{
 const stages=new WeakMap();
 function texture(B,scene,name,bronze=false){
  const t=new B.DynamicTexture(name,{width:256,height:256},scene,false),c=t.getContext();
  c.fillStyle=bronze?"#896e4f":"#777064";c.fillRect(0,0,256,256);
  let seed=812;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
  for(let i=0;i<2800;i++){const x=rand()*256,y=rand()*256,s=1+rand()*3;c.fillStyle=rand()<.48?"rgba(34,30,26,.10)":"rgba(218,202,162,.07)";c.fillRect(x,y,s,bronze?1:s)}
  if(!bronze){c.strokeStyle="rgba(34,37,35,.18)";c.lineWidth=1;for(let i=0;i<16;i++){const x=rand()*256,y=rand()*256;c.beginPath();c.moveTo(x,y);c.lineTo(x+rand()*35-17,y+rand()*21);c.stroke()}}
  t.update();return t;
 }
 function mat(B,s,id,color,tex){const m=new B.StandardMaterial(id,s);m.diffuseColor=B.Color3.FromHexString(color);m.specularColor=new B.Color3(.12,.11,.09);m.specularPower=24;if(tex)m.diffuseTexture=tex;return m}
 function mount(scene,variant){
  const B=BABYLON,old=stages.get(scene);if(old&&old.variant===variant)return old;
  if(old){for(const m of old.meshes)m.dispose();for(const m of old.materials)m.dispose();for(const t of old.textures)t.dispose()}
  const stone=texture(B,scene,"r5Stone"),metal=texture(B,scene,"r5Bronze",true);
  const base=mat(B,scene,"r5Basalt","#9b8c76",stone),rim=mat(B,scene,"r5BronzeMat","#c6a575",metal),top=mat(B,scene,"r5Top","#a69a87",stone);
  const meshes=[],segments=variant==="a"?8:48;
  const cyl=(id,y,h,bottom,upper,m)=>{const a=B.MeshBuilder.CreateCylinder("r5-"+id,{height:h,diameterBottom:bottom,diameterTop:upper,tessellation:segments},scene);a.position.y=y;a.material=m;a.isPickable=false;meshes.push(a);return a};
  // Card normalizes hero around y=1.08; stand top is y=.025. Native idle stays untouched.
  cyl("foot",-0.115,.05,1.50,1.47,base);
  cyl("body",-0.065,.05,1.47,1.34,base);
  cyl("metal",-0.034,.012,1.34,1.34,rim);
  cyl("tread",-0.002,.054,1.34,1.39,top);
  // Soft contact approximation, not a dynamic shadow map. Scene-local texture.
  const sh=new B.DynamicTexture("r5Contact",{width:128,height:128},scene,false);sh.hasAlpha=true;
  const c=sh.getContext(),g=c.createRadialGradient(64,64,5,64,64,64);g.addColorStop(0,"rgba(8,10,10,.65)");g.addColorStop(.45,"rgba(8,10,10,.38)");g.addColorStop(1,"rgba(8,10,10,0)");c.clearRect(0,0,128,128);c.fillStyle=g;c.fillRect(0,0,128,128);sh.update();
  const sm=new B.StandardMaterial("r5ShadowMat",scene);sm.diffuseTexture=sh;sm.opacityTexture=sh;sm.useAlphaFromDiffuseTexture=true;sm.disableLighting=true;sm.emissiveColor=new B.Color3(0,0,0);sm.specularColor=new B.Color3(0,0,0);sm.zOffset=-1;
  const contact=B.MeshBuilder.CreateGround("r5-contact",{width:1.2,height:1.2},scene);contact.position.y=.031;contact.material=sm;contact.isPickable=false;meshes.push(contact);
  const result={variant,meshes,materials:[base,rim,top,sm],textures:[stone,metal,sh]};stages.set(scene,result);return result;
 }
 return Object.freeze({mount});
})();