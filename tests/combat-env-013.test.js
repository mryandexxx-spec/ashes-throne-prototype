"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const Env013=require("../combat-environment-013.js");
const Env009=require("../combat-environment-009.js");
const Env010=require("../combat-environment-010.js");
function mock(){
 class Vector{constructor(x,y,z){this.x=x;this.y=y;this.z=z;}}
 class Material{
  constructor(name,scene){this.name=name;scene.materials.push(this);}
  dispose(){this.disposed=true;}
 }
 class Mesh{
  constructor(name,scene){
   this.name=name;this.position=new Vector(0,0,0);
   this.scaling=new Vector(1,1,1);this.rotation=new Vector(0,0,0);
   this.isPickable=true;scene.meshes.push(this);
  }
  setEnabled(value){this.enabled=value;}
  dispose(){this.disposed=true;}
 }
 class VertexData{
  applyToMesh(mesh){mesh.data={positions:this.positions,indices:this.indices,
   normals:this.normals,colors:this.colors,uvs:this.uvs};}
 }
 VertexData.ComputeNormals=(positions,indices,normals)=>{
  for(let i=0;i<positions.length;i++)normals.push(0);
 };
 const B={Vector3:Vector,Color3:Vector,Color4:Vector,Mesh,StandardMaterial:Material,
  VertexData,Scene:{FOGMODE_EXP2:2},MeshBuilder:{}};
 for(const type of ["CreateGround","CreateBox","CreateCylinder","CreateSphere","CreateTorus"])
  B.MeshBuilder[type]=(name,options,scene)=>new Mesh(name,scene);
 const scene={meshes:[],materials:[],lights:[{name:"hemi"},{name:"key"}]};
 return {B,scene};
}
test("ENV013 is a bounded solid 3D composition with unique asymmetrical lateral masses",()=>{
 const {B,scene}=mock(),owned=[];
 const r=Env013.build(B,scene,v=>(owned.push(v),v));
 assert.equal(r.meshes,4);assert.ok(r.vertices<6000);
 assert.ok(r.triangles<11000&&r.triangles>4500);
 assert.equal(scene.meshes.length,4);
 assert.ok(scene.meshes.every(m=>m.isPickable===false&&m.checkCollisions===false));
 assert.ok(scene.meshes.every(m=>m.data.positions.length===m.data.normals.length));
 assert.ok(scene.meshes.every(m=>m.data.colors.length===m.data.positions.length/3*4));
 assert.ok(scene.meshes.every(m=>m.data.uvs.length===m.data.positions.length/3*2));
 for(const mesh of scene.meshes){
  const p=mesh.data.positions,i=mesh.data.indices;
  assert.ok(p.every(Number.isFinite)&&i.every(n=>n>=0&&n<p.length/3));
  const ys=p.filter((_,j)=>j%3===1);
  assert.ok(Math.max(...ys)-Math.min(...ys)>35,"cliff should have real vertical relief");
  const xs=p.filter((_,j)=>j%3===0),zs=p.filter((_,j)=>j%3===2);
  assert.ok(Math.max(...xs)-Math.min(...xs)>3);
  assert.ok(Math.max(...zs)-Math.min(...zs)>3,
   "cliff must have depth (not a flat painting)");
 }
 assert.ok(owned.length>=8,"materials and meshes belong to the same scene");
 assert.ok(!read("combat-environment-013.js").match(/setInterval|setTimeout|runRenderLoop|Math\.random/));
 assert.match(read("combat-environment-013.js"),/rock063-color-512\.jpg/);
});
test("ENV013 leaves exact combat ledge and ravine, disables only ENV009 back rings",()=>{
 const {B,scene}=mock();
 Env009.build(B,scene,v=>v);
 const ledge=scene.meshes.find(m=>m.name==="env009_living_ledge");
 const ravine=scene.meshes.find(m=>m.name==="env009_ravine");
 const ledgePoints=ledge.data.positions.slice(),ravinePoints=ravine.data.positions.slice();
 Env013.build(B,scene,v=>v);
 assert.deepEqual(ledge.data.positions,ledgePoints);
 assert.deepEqual(ravine.data.positions,ravinePoints);
 assert.equal(ledge.enabled,undefined);assert.equal(ravine.enabled,undefined);
 for(const n of ["near_escarpment","far_ridge","horizon_ridge"])
  assert.equal(scene.meshes.find(m=>m.name==="env009_"+n).enabled,false);
 assert.equal(scene.fogDensity,.0065);
 assert.ok(scene.meshes.filter(m=>m.name.startsWith("env013_")).length===4);
});
test("CV007 prefers ENV013 but explicit comparison flag and build failure retain ENV010",()=>{
 const src=read("combat-visual-007.js")+"\nCombatVisual007";
 const run=(opts={})=>{
  const {B,scene}=mock();
  const scope={CombatEnvironment009:Env009,CombatEnvironment010:Env010,
   CombatEnvironment013:opts.fail?{supported:()=>true,build:()=>{throw Error("device error");}}:Env013,
   location:{search:opts.baseline?"?arena=env010":""},URLSearchParams,
   console:{warn:()=>{}}};
  vm.runInNewContext(src,scope).create(B,scene);
  return scene;
 };
 const latest=run();
 assert.equal(latest.meshes.filter(m=>m.name.startsWith("env013_")).length,4);
 assert.equal(latest.meshes.filter(m=>m.name.startsWith("env010_")).length,0);
 const baseline=run({baseline:true});
 assert.equal(baseline.meshes.filter(m=>m.name.startsWith("env013_")).length,0);
 assert.ok(baseline.meshes.filter(m=>m.name.startsWith("env010_")).length>=4);
 const recovered=run({fail:true});
 assert.ok(recovered.meshes.filter(m=>m.name.startsWith("env010_")).length>=4);
 assert.equal(recovered.meshes.filter(m=>m.name.startsWith("env013_")).length,0);
});
test("full game loads ENV013 before CV007 and retains Babylon engine/camera",()=>{
 const html=read("index.html"),game=read("game.js");
 const packageJson=JSON.parse(read("package.json"));
 assert.equal(packageJson.version,"0.3.84");
 assert.ok(html.includes("v0.3.84 · OPSHELP + RENPLAY + REN3D003 + ENV013"));
 assert.ok(html.indexOf('src="combat-environment-013.js"')<
  html.indexOf('src="combat-visual-007.js"'));
 assert.equal((game.match(/new BABYLON.Engine\(/g)||[]).length,1);
 assert.match(game,/lowerAlphaLimit=ARENA_VIEW\.alpha/);
 assert.match(game,/lowerBetaLimit=ARENA_VIEW\.beta/);
 assert.match(game,/arenaCamera\.lowerRadiusLimit=12;arenaCamera\.upperRadiusLimit=21/);
 assert.ok(read("tests/fixtures/env010-full-game.html").includes("arena="));
});
