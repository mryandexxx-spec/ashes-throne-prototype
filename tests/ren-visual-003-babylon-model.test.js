"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const RenVisualModel=require("../ren-visual-model.js");
function mockBabylon(){
 class Vector3{constructor(x,y,z){this.x=x;this.y=y;this.z=z;}}
 class Color3{constructor(r,g,b){this.r=r;this.g=g;this.b=b;}}
 class Mesh{
  constructor(name,scene){this.name=name;this.scene=scene;this.position=new Vector3(0,0,0);this.rotation=new Vector3(0,0,0);this.enabled=true;scene.meshes.push(this);}
  setEnabled(value){this.enabled=value;}
 }
 class StandardMaterial{constructor(name,scene){this.name=name;scene.materials.push(this);}}
 const MeshBuilder={};
 for(const type of ["CreateBox","CreateCylinder","CreateSphere","CreateTorus"])
  MeshBuilder[type]=(name,options,scene)=>{const mesh=new Mesh(name,scene);mesh.shape=type;mesh.options=options;return mesh;};
 return {Vector3,Color3,Mesh,StandardMaterial,MeshBuilder};
}
test("Ren 3D factory produces bounded texture-free cliff-guide outfit with two motion anchors",()=>{
 const B=mockBabylon(),scene={meshes:[],materials:[]};
 const actor=RenVisualModel.create(B,scene,-2.5,1.2,4);
 assert.equal(actor.body.position.x,-2.5);assert.equal(actor.body.position.y,.8);
 assert.equal(actor.head.position.y,1.8);assert.equal(actor.body.position.z,1.2);
 assert.equal(actor.head.position.z,1.2);
 assert.equal(actor.body.metadata.fighterId,"ren");assert.equal(actor.head.metadata.fighterId,"ren");
 assert.ok(actor.parts.length>=25&&actor.parts.length<=45,"bounded mobile geometry");
 assert.equal(scene.materials.length,9,"palette materials shared across 3D parts");
 assert.equal(scene.meshes.length,actor.parts.length+2,"no hidden duplicate fighters");
 assert.equal(new Set(scene.meshes.map(x=>x.name)).size,scene.meshes.length,"unique mesh IDs");
 assert.ok(actor.parts.every(m=>m.material&&[actor.body,actor.head].includes(m.parent)));
 assert.ok(actor.parts.every(m=>m.isPickable));
 for(const name of ["rope_loop_one","neck_wrap","scarf_tail","harness_left","hair_cap","side_pouch","boot_L","boot_R"])
  assert.ok(actor.parts.some(m=>m.name.endsWith(name)),name);
 assert.ok(actor.parts.every(m=>!/weapon|blade|sword|gun|faction/i.test(m.name)),"no canonical weapon or faction invented");
 assert.ok(actor.parts.every(m=>!m.material.diffuseTexture),"zero textures, external assets or GLB downloads");
 const piece=actor.parts.find(m=>m.name.endsWith("rope_loop_one"));
 let picked=piece;
 while(picked&&!picked.metadata?.fighterId)picked=picked.parent;
 assert.equal(picked?.metadata?.fighterId,"ren","arena picking/long-press finds fighter through parent");
 actor.body.position.x=42;actor.head.position.x=42;actor.body.rotation.z=.2;
 assert.equal(actor.parts.find(m=>m.name.endsWith("jacket")).parent,actor.body,"body animation moves attachments");
 assert.equal(actor.parts.find(m=>m.name.endsWith("face")).parent,actor.head,"head animation remains independent");
 actor.body.setEnabled(false);actor.head.setEnabled(false);
 assert.equal(actor.body.enabled,false);assert.equal(actor.head.enabled,false);
});
test("Ren factory does not create render loops or separate Engine / Scene",()=>{
 const source=read("ren-visual-model.js");
 assert.doesNotMatch(source,/new\s+B\.Engine|new\s+B\.Scene|runRenderLoop|setInterval|setTimeout|fetch\(/);
 assert.match(source,/Babylon Scene\.dispose owns all meshes\/materials/);
 assert.throws(()=>RenVisualModel.create({},null,0,0,0),/Babylon\.js/);
});
test("Only permanent ren uses custom geometry; all other fighters keep generic capsule",()=>{
 const game=read("game.js"),html=read("index.html");
 const createStart=game.indexOf("function initBabylon()");
 const createEnd=game.indexOf("function updateMeshes()",createStart);
 const build=game.slice(createStart,createEnd);
 assert.ok(build.includes('if(h.id==="ren"&&typeof RenVisualModel!=="undefined")'));
 assert.ok(build.includes('RenVisualModel.create(BABYLON,scene,x,z,i)'));
 assert.ok(build.includes('BABYLON.MeshBuilder.CreateCapsule("body_"+i'));
 assert.match(build,/for\(const part of \[body,head,base\]\)part\.metadata=\{fighterId:h\.id\}/);
 assert.match(build,/meshes\[h\.id\]=\{body,head,base\}/);
 assert.ok(html.indexOf('src="ren-visual-model.js"')>0);
 assert.ok(html.indexOf('src="ren-visual-model.js"')<html.indexOf('src="game.js"'));
 assert.match(game,/visual\.body\.setEnabled\(visible\);[\s\S]*visual\.head\.setEnabled\(visible\)/);
 assert.match(game,/visual\.body\.position\.y=\.8\+pose\.y/);
 assert.match(game,/visual\.head\.position\.y=1\.8\+pose\.y/);
 assert.match(game,/scene\.dispose\(\)/);
});
test("New 3D build is marked without modifying ability/progression files",()=>{
 const html=read("index.html"),pkg=JSON.parse(read("package.json"));
 assert.equal(pkg.version,"0.3.86");
 assert.ok(html.includes("v0.3.86 · OPSHELP + RENPLAY + REN3D003"));
 assert.ok(pkg.scripts.test.includes("node --check ren-visual-model.js"));
 assert.ok(read("game.js").includes('id:"ren",name:"Рен Терен",classId:"melee"'));
});
