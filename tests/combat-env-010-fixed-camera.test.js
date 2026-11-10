"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const Env010=require("../combat-environment-010.js");
const Env009=require("../combat-environment-009.js");
function mock(){
 class Vec{constructor(x,y,z){this.x=x;this.y=y;this.z=z;}}
 class Mat{constructor(name,scene){this.name=name;scene.materials.push(this);}dispose(){this.disposed=true;}}
 class Mesh{
  constructor(name,scene){this.name=name;this.isPickable=true;this.position=new Vec(0,0,0);this.rotation=new Vec(0,0,0);
   this.scaling=new Vec(1,1,1);scene.meshes.push(this);}
  setEnabled(value){this.enabled=value;}
  dispose(){this.disposed=true;}
 }
 class VertexData{applyToMesh(mesh){mesh.data={positions:this.positions,indices:this.indices,normals:this.normals,colors:this.colors,uvs:this.uvs};}}
 VertexData.ComputeNormals=(positions,indices,normals)=>{for(let i=0;i<positions.length;i++)normals.push(0);};
 const B={Mesh,VertexData,Vector3:Vec,Color3:Vec,Color4:Vec,StandardMaterial:Mat,Scene:{FOGMODE_EXP2:2},
  MeshBuilder:{}};
 for(const type of ["CreateGround","CreateBox","CreateCylinder","CreateSphere","CreateTorus"])
  B.MeshBuilder[type]=(name,options,scene)=>new Mesh(name,scene);
 const scene={meshes:[],materials:[],lights:[{name:"hemi"},{name:"key"}]};
 return {B,scene};
}
test("ENV010 background retains three sculpted ridges with strata normal UVs and sky; never pickable",()=>{
 const {B,scene}=mock(),result=Env010.build(B,scene,v=>v);
 assert.equal(result.meshes,4);
 assert.ok(result.triangles>6500&&result.triangles<7000);
 assert.ok(scene.meshes.every(m=>m.isPickable===false&&m.checkCollisions===false));
 assert.ok(scene.materials.every(m=>m.fogEnabled===false));
 assert.equal(scene.materials.find(m=>m.name==="env010_mat_atmosphere").disableLighting,false);
 assert.ok(scene.materials.filter(m=>m.name!=="env010_mat_atmosphere").every(m=>m.disableLighting===false));
 assert.ok(scene.meshes.every(m=>m.useVertexColors===true));
 for(const mesh of scene.meshes){
  const g=mesh.data;
  assert.ok(g.positions.length>0&&g.indices.length>0);
  assert.equal(g.colors.length,g.positions.length/3*4);
  assert.equal(g.uvs.length,g.positions.length/3*2);
  assert.equal(g.normals.length,g.positions.length);
  assert.ok(g.positions.every(Number.isFinite));
  assert.ok(g.colors.every(x=>x>=0&&x<=1));
  assert.ok(g.indices.every(x=>x>=0&&x<g.positions.length/3));
 }
 // Layers separate in actual world space, not painted on a single plane.
 const horizon=scene.meshes.find(m=>m.name==="env010_horizon").data.positions;
 const foreground=scene.meshes.find(m=>m.name==="env010_escarpment").data.positions;
 assert.ok(horizon[0]>foreground[0]&&horizon[2]>foreground[2]);
 // Gorge spans multiple actual world-space depths, not a painted billboard.
 const escarpment=scene.meshes.find(m=>m.name==="env010_escarpment");
 const p=escarpment.data.positions;
 const depth=offset=>(p[offset]+p[offset+2])/Math.sqrt(2);
 const worldDepths=Array.from({length:p.length/3},(_,i)=>depth(i*3));
 assert.ok(Math.max(...worldDepths)-Math.min(...worldDepths)>.50);
 // All three scenic ridges are spatial geometry with continuous UVs.
 assert.equal(escarpment.data.positions.length/3,113*11);
 assert.ok(scene.meshes.some(m=>m.name==="env010_midground"));

 assert.equal(scene.meshes[0].name,"env010_sky");
});
test("ENV010 integrates as an additive optional layer without changing ENV009/FX",()=>{
 const {B,scene}=mock();
 const visual=vm.runInNewContext(read("combat-visual-007.js")+"\nCombatVisual007",{
  CombatEnvironment009:Env009,CombatEnvironment010:Env010
 });
 const battle=visual.create(B,scene);
 assert.equal(scene.meshes.filter(m=>m.name.startsWith("env009_")).length,5);
 assert.equal(scene.meshes.filter(m=>m.name.startsWith("env010_")).length,4);
 for(const name of ["env009_near_escarpment","env009_far_ridge","env009_horizon_ridge"]){
  assert.equal(scene.meshes.find(m=>m.name===name).enabled,false,
   "old all-around wall is hidden only when fixed-background composition succeeds");
 }
 assert.ok(scene.meshes.find(m=>m.name==="env009_living_ledge").enabled!==false);
 assert.ok(scene.meshes.find(m=>m.name==="env009_ravine").enabled!==false);
 assert.equal(scene.meshes.filter(m=>m.name.includes("hit_")).length,6);
 assert.ok(scene.meshes.every(m=>!m.isPickable));
 battle.emit([{id:"enemy",slot:"hit"}],{enemy:{head:{position:new B.Vector3(2,1.8,0)}}});
 assert.equal(battle.pending(),1);
 battle.clear();assert.equal(battle.pending(),0);
 assert.doesNotMatch(read("combat-environment-010.js"),/XMLHttpRequest|setInterval|setTimeout|runRenderLoop|Math\.random/);
 assert.match(read("combat-environment-010.js"),/fetch\(ASSET_ROOT\+"gorge-strata-v1\.glb"/);
});
test("ENV010 optional microrelief builds a single deterministic scene-owned normal texture",()=>{
 const {B,scene}=mock(),owned=[];
 const shelf=new B.StandardMaterial("env009_mat_weathered_stone",scene);
 class Texture{
  constructor(name,size){this.name=name;this.size=size;Texture.creations++;}
  getContext(){return {createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
   putImageData:image=>{this.pixels=image.data;}};}
  update(){this.updated=true;}
  dispose(){this.disposed=true;}
 }
 Texture.creations=0;
 B.DynamicTexture=Texture;
 const originalAlbedo=new Texture("existing_env009_texture",512);
 shelf.diffuseTexture=originalAlbedo;
 const beforeCount=Texture.creations;
 Env010.build(B,scene,value=>(owned.push(value),value));
 assert.equal(Texture.creations-beforeCount,1,"ENV010 adds only one normal map");
 assert.equal(shelf.diffuseTexture,originalAlbedo,"reuses ENV009 albedo texture");
 assert.equal(originalAlbedo.pixels,undefined,"fallback albedo stays unchanged");
 assert.equal(originalAlbedo.updated,undefined);
 assert.equal(shelf.bumpTexture.name,"env010_rock_microrelief");
 assert.equal(shelf.bumpTexture.size,256);
 assert.equal(shelf.bumpTexture.pixels.length,256*256*4);
 assert.equal(shelf.bumpTexture.level,.36);
 assert.equal(shelf.bumpTexture.updated,true);
 assert.ok(owned.includes(shelf.bumpTexture));
});
test("CC0 Rock063 material is bundled locally and keeps the procedural fallback",()=>{
 const fs=require("node:fs"),path=require("node:path");
 for(const file of ["rock063-color-512.jpg","rock063-normal-512.jpg"]){
   const data=fs.readFileSync(path.join(__dirname,"..","assets","env010",file));
   assert.ok(data.length>25000&&data.length<250000,"512px optimized asset budget");
   assert.equal(data[0],255);assert.equal(data[1],216);
 }
 const source=read("combat-environment-010.js");
 assert.match(source,/new URL\("assets\/env010\/",document.currentScript.src\)/);
 assert.ok(source.includes('if(!albedoReady||!normalReady||capMade||disposed)return;'));
 assert.doesNotMatch(source,/https?:\/\//);
});
test("fixed camera ignores single-finger rotation, retains 12..21 pinch and clears cancelled pointers",()=>{
 const source=read("game.js");
 const begin=source.indexOf("function installArenaPointerCamera(canvas,camera){");
 const end=source.indexOf("// Reuse the scene rather than re-creating meshes on every battle entry.",begin);
 assert.ok(begin>0&&end>begin);
 const events=new Map(),globals=new Map();
 const canvas={addEventListener:(event,fn)=>events.set(event,fn)};
 const window={addEventListener:(event,fn)=>globals.set(event,fn)};
 const bind=vm.runInNewContext(source.slice(begin,end)+"\ninstallArenaPointerCamera",{window});
 const camera={alpha:-3*Math.PI/4,beta:.96,radius:15,lowerRadiusLimit:12,upperRadiusLimit:21};
 bind(canvas,camera);
 const down=events.get("pointerdown"),move=events.get("pointermove"),up=events.get("pointerup");
 down({pointerId:1,clientX:10,clientY:10,pointerType:"touch"});
 move({pointerId:1,clientX:140,clientY:60,pointerType:"touch"});
 assert.equal(camera.alpha,-3*Math.PI/4);assert.equal(camera.beta,.96);
 assert.equal(camera.radius,15,"single-finger drag never zooms");
 down({pointerId:2,clientX:190,clientY:60,pointerType:"touch"});
 move({pointerId:2,clientX:300,clientY:60,pointerType:"touch"});
 assert.ok(camera.radius>=12&&camera.radius<15,"pinch-out zooms in");
 move({pointerId:2,clientX:142,clientY:60,pointerType:"touch"});
 assert.ok(camera.radius>15&&camera.radius<=21,"pinch-in zooms out");
 up({pointerId:2});
 const old=camera.radius;
 move({pointerId:1,clientX:18,clientY:42,pointerType:"touch"});
 assert.equal(camera.radius,old);
 globals.get("orientationchange")();
 assert.equal(camera.radius,old);
 assert.match(source,/lowerAlphaLimit=ARENA_VIEW.alpha;arenaCamera.upperAlphaLimit=ARENA_VIEW.alpha/);
 assert.match(source,/lowerBetaLimit=ARENA_VIEW.beta;arenaCamera.upperBetaLimit=ARENA_VIEW.beta/);
 assert.match(source,/arenaCamera.lowerRadiusLimit=12;arenaCamera.upperRadiusLimit=21/);
 assert.match(source,/canvas.addEventListener\("pointercancel",cancelInspectionGesture\)/);
});
test("candidate build and visual comparison preserve current game wiring",()=>{
 const html=read("index.html"),pkg=JSON.parse(read("package.json"));
 assert.equal(pkg.version,"0.3.86");
 assert.ok(html.includes("v0.3.86 · ROSTER002 + OPSHELP + RENPLAY + REN3D003 + ENV010"));
 assert.ok(html.indexOf('src="combat-environment-010.js"')<html.indexOf('src="combat-visual-007.js"'));
 assert.ok(pkg.scripts.test.includes("node --check combat-environment-010.js"));
});
