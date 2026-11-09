"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const Env=require("../combat-environment-009.js");
const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");
function fixture(){
 class Vec{constructor(x,y,z){this.x=x;this.y=y;this.z=z;}}
 class Color4 extends Vec{constructor(r,g,b,a){super(r,g,b);this.a=a;}}
 class Mat{constructor(name,scene){this.name=name;scene.materials.push(this);}dispose(){this.disposed=true;}}
 class Mesh{
  constructor(name,scene){this.name=name;this.position=new Vec(0,0,0);this.rotation=new Vec(0,0,0);
   this.scaling=new Vec(1,1,1);this.isPickable=true;this.enabled=true;scene.meshes.push(this);}
  setEnabled(value){this.enabled=value;}
  dispose(){this.disposed=true;}
 }
 class VertexData{applyToMesh(mesh){mesh.data={positions:this.positions,indices:this.indices,normals:this.normals,colors:this.colors,uvs:this.uvs};}}
 VertexData.ComputeNormals=(positions,indices,normals)=>{for(let i=0;i<positions.length;i++)normals.push(0);};
 const B={Mesh,VertexData,Vector3:Vec,Color3:Vec,Color4,StandardMaterial:Mat,
  Scene:{FOGMODE_EXP2:2},MeshBuilder:{}};
 for(const method of ["CreateGround","CreateBox","CreateCylinder","CreateSphere","CreateTorus"]){
  B.MeshBuilder[method]=(name,opts,scene)=>new Mesh(name,scene);
 }
 const scene={meshes:[],materials:[],lights:[{name:"hemi"},{name:"key"}]};
 return {B,scene};
}
test("ENV009 builds cohesive textured-by-vertices 3D landscape without legacy slab",()=>{
 const {B,scene}=fixture(),result=Env.build(B,scene,v=>v);
 assert.equal(result.geometry,5);
 assert.equal(scene.meshes.length,5,"one ledge, one ravine, three continuous ridge layers");
 assert.equal(scene.materials.length,5);
 assert.ok(scene.meshes.every(m=>!m.isPickable));
 assert.equal(new Set(scene.meshes.map(m=>m.name)).size,5);
 assert.ok(scene.meshes.some(m=>m.name==="env009_living_ledge"));
 assert.ok(scene.meshes.some(m=>m.name==="env009_horizon_ridge"));
 for(const mesh of scene.meshes){
  const g=mesh.data;
  assert.ok(g.positions.length>0&&g.indices.length>0);
  assert.equal(g.positions.length,g.normals.length);
  assert.equal(g.colors.length,g.positions.length/3*4);
  assert.equal(g.uvs.length,g.positions.length/3*2,"all geometry has stable UVs");
  assert.ok(g.indices.every(i=>i>=0&&i<g.positions.length/3));
  assert.ok(g.positions.every(Number.isFinite));
  assert.ok(g.colors.every(v=>v>=0&&v<=1));
  assert.equal(mesh.material.useVertexColors,true);
  assert.equal(mesh.checkCollisions,false);
 }
 assert.ok(result.triangles>1500&&result.triangles<15000,"bounded geometric detail");
 assert.equal(scene.fogMode,2);
 assert.ok(scene.fogDensity>0&&scene.fogDensity<.03);
 assert.ok(scene.lights[0].diffuse.z>scene.lights[0].diffuse.x);
 assert.ok(scene.lights[1].diffuse.x>scene.lights[1].diffuse.z);
});
test("ENV009 formation footprint remains flat, rim is irregular, cliff drops into ravine",()=>{
 const {B,scene}=fixture();Env.build(B,scene,v=>v);
 const mesa=scene.meshes[0].data.positions,ringWidth=Env.SECTORS+1;
 const yAt=(row,i)=>mesa[(row*ringWidth+i)*3+1];
 for(let row=0;row<6;row++)for(let i=0;i<=Env.SECTORS;i++)
  assert.equal(yAt(row,i),0,"center and deployed fighters remain at the established floor height");
 assert.ok(yAt(13,0)<-4);
 const rim0=Env.rimPoint(1,0),rim1=Env.rimPoint(1,Math.PI/3);
 assert.ok(Math.abs(rim0[0])>7&&Math.abs(rim1[1])>4);
 const valley=scene.meshes[1].data.positions;
 assert.ok(Math.min(...valley.filter((_,i)=>i%3===1))<-8);
});
test("ENV009 integrates with CV007 FX without intercepting hits or changing scene lifecycle",()=>{
 const {B,scene}=fixture();
 const source=read("combat-visual-007.js");
 const Visual=vm.runInNewContext(source+"\nCombatVisual007",{CombatEnvironment009:Env});
 const visual=Visual.create(B,scene);
 const names=scene.meshes.map(m=>m.name);
 assert.equal(names.filter(n=>n.startsWith("env009_")).length,5);
 assert.ok(!names.includes("cv007_surface")&&!names.some(n=>n.startsWith("cv008_patch_")));
 assert.equal(names.filter(n=>n.includes("hit_")).length,6);
 assert.ok(scene.meshes.every(m=>!m.isPickable));
 assert.equal(visual.pending(),0);
 visual.emit([{id:"enemy",slot:"hit"}],{enemy:{head:{position:new B.Vector3(2,1.8,0)}}});
 assert.equal(visual.pending(),1);visual.tick(100,2);assert.equal(visual.pending(),0);
 assert.equal(scene.textures?.length||0,0,"no procedural texture when new environment is active");
 assert.doesNotMatch(read("combat-environment-009.js"),/runRenderLoop|setInterval|setTimeout|fetch\(|XMLHttpRequest|Math\.random/);
});
test("ENV009 constructs one locally generated stratified texture and no network loads",()=>{
 const {B,scene}=fixture();
 let uploads=0;
 B.Texture={WRAP_ADDRESSMODE:1};
 B.DynamicTexture=class {
  constructor(name,size,owner){this.name=name;this.size=size;this.owner=owner;this.updates=0;}
  getContext(){return {
   createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),
   putImageData:(img)=>{uploads++;assert.equal(img.data.length,512*512*4);}
  };}
  update(){this.updates++;}
  dispose(){this.disposed=true;}
 };
 Env.build(B,scene,v=>v);
 assert.equal(uploads,1,"single material bake at arena initialization");
 const stone=scene.materials.find(m=>m.name==="env009_mat_weathered_stone");
 assert.equal(stone.diffuseTexture.size,512);
 assert.equal(stone.diffuseTexture.updates,1);
 assert.equal(stone.diffuseTexture.wrapU,1);
 assert.equal(stone.diffuseTexture.wrapV,1);
});
test("ENV009 keeps no-VertexData/old-browser fallback and candidate version contract",()=>{
 const {B,scene}=fixture();
 assert.equal(Env.supported(B),true);
 delete B.VertexData;
 assert.equal(Env.supported(B),false);
 const html=read("index.html"),pkg=JSON.parse(read("package.json"));
 assert.equal(pkg.version,"0.3.84");
 assert.ok(html.includes("v0.3.84 · OPSHELP + RENPLAY + REN3D003 + ENV010"));
 assert.ok(html.indexOf('src="combat-environment-009.js"')<html.indexOf('src="combat-visual-007.js"'));
 assert.ok(html.indexOf('src="combat-visual-007.js"')<html.indexOf('src="game.js"'));
 assert.ok(pkg.scripts.test.includes("node --check combat-environment-009.js"));
});
