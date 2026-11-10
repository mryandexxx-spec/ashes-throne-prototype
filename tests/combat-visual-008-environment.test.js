"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const Visual=require("../combat-visual-007.js");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
function createBabylon(withGrain=true){
 class Vec{constructor(x,y,z){this.x=x;this.y=y;this.z=z;}}
 class Color4{constructor(r,g,b,a){this.r=r;this.g=g;this.b=b;this.a=a;}}
 class Mat{
  constructor(name,scene){this.name=name;this.alpha=1;scene.materials.push(this);}
 }
 class Mesh{
  constructor(name,shape,opts,scene){
   this.name=name;this.shape=shape;this.opts=opts;this.isPickable=true;
   this.position=new Vec(0,0,0);this.rotation=new Vec(0,0,0);
   this.scaling=new Vec(1,1,1);this.enabled=true;scene.meshes.push(this);
  }
  setEnabled(v){this.enabled=v;}
 }
 class DynamicTexture{
  constructor(name,size,scene){
   this.name=name;this.size=size;this.calls=0;this.updated=false;
   scene.textures.push(this);
  }
  getContext(){
   const record=()=>{this.calls++;};
   return {fillRect:record,beginPath:record,moveTo:record,lineTo:record,stroke:record};
  }
  update(){this.updated=true;}
  dispose(){this.disposed=true;}
 }
 const B={Color3:Vec,Color4,Vector3:Vec,StandardMaterial:Mat,
  Scene:{FOGMODE_EXP2:2},Texture:{WRAP_ADDRESSMODE:1},MeshBuilder:{}};
 if(withGrain)B.DynamicTexture=DynamicTexture;
 for(const type of ["CreateGround","CreateBox","CreateCylinder","CreateSphere","CreateTorus"])
  B.MeshBuilder[type]=(name,opts,scene)=>new Mesh(name,type,opts,scene);
 return B;
}
function makeScene(){return {
 meshes:[],materials:[],textures:[],
 lights:[{name:"hemi",intensity:.8},{name:"key",intensity:1.1}]
};}
test("CV008 replaces repetitive concrete beams/grid with finite unpickable layered rock",()=>{
 const B=createBabylon(),scene=makeScene(),arena=Visual.create(B,scene);
 const names=scene.meshes.map(m=>m.name);
 assert.equal(scene.meshes.length,56,"bounded geometry including 3 pooled FX pairs");
 assert.equal(scene.materials.length,16);
 assert.equal(new Set(names).size,names.length,"stable unique Babylon names");
 assert.ok(scene.meshes.every(m=>m.isPickable===false),"arena never steals fighter taps");
 assert.ok(names.includes("cv007_surface")&&names.includes("cv007_chasm"));
 assert.ok(names.some(n=>n.startsWith("cv008_patch_")));
 assert.ok(names.some(n=>n.startsWith("cv008_distant_mass_")));
 assert.ok(names.some(n=>n.startsWith("cv008_fallen_")));
 assert.ok(!names.some(n=>n.startsWith("cv007_far_cliff_")));
 assert.ok(!names.some(n=>n.startsWith("cv007_grid_")));
 assert.equal(scene.meshes.filter(m=>m.name.includes("hit_")).length,6);
 assert.equal(arena.pending(),0);
});
test("CV008 paints one deterministic 256 px texture once with no remote assets",()=>{
 const B=createBabylon(),scene=makeScene();
 Visual.create(B,scene);
 assert.equal(scene.textures.length,1);
 const grain=scene.textures[0];
 assert.deepEqual(grain.size,{width:256,height:256});
 assert.equal(grain.updated,true);
 assert.ok(grain.calls>2400&&grain.calls<2550,"bounded procedural brush operations");
 assert.equal(grain.uScale,3);assert.equal(grain.vScale,2);
 assert.equal(scene.meshes.find(m=>m.name==="cv007_surface").material.diffuseTexture,grain);
 const source=read("combat-visual-007.js");
 assert.doesNotMatch(source,/\bfetch\(|XMLHttpRequest|https?:\/\/|Math\.random\(|runRenderLoop|setInterval|setTimeout/);
 assert.match(source,/Math\.imul\(seed,1664525\)/,"seeded, reproducible texture");
});
test("CV008 works without Canvas DynamicTexture and preserves existing FX contract",()=>{
 const B=createBabylon(false),scene=makeScene(),arena=Visual.create(B,scene);
 assert.equal(scene.textures.length,0);
 assert.equal(scene.meshes.length,56);
 assert.equal(scene.meshes.find(m=>m.name==="cv007_surface").material.diffuseTexture,undefined);
 const target={ren:{head:{position:new B.Vector3(-2,1.8,0)}}};
 arena.emit([{id:"ren",slot:"hit"}],target);
 assert.equal(arena.pending(),1);
 arena.tick(80,2);
 assert.equal(arena.pending(),0);
 arena.clear();
 assert.equal(arena.pending(),0);
});
test("CV008 lighting/fog is presentation only and compatible with old scene mocks",()=>{
 const B=createBabylon(),scene=makeScene();
 Visual.create(B,scene);
 assert.equal(scene.fogMode,2);
 assert.equal(scene.fogDensity,.021);
 assert.ok(scene.clearColor.r>0&&scene.clearColor.r<.3);
 assert.ok(scene.lights[0].diffuse.z>scene.lights[0].diffuse.x,"cool ambient");
 assert.ok(scene.lights[1].diffuse.x>scene.lights[1].diffuse.z,"warm key");
 assert.equal(scene.lights[0].intensity,.74);
 assert.equal(scene.lights[1].intensity,1.13);
 const B2=createBabylon(false);delete B2.Scene;delete B2.Color4;
 const less={meshes:[],materials:[],textures:[]};
 assert.doesNotThrow(()=>Visual.create(B2,less),"no mandatory new API in headless fixture");
});
test("CV008 build and source scope",()=>{
 const pkg=JSON.parse(read("package.json")),html=read("index.html");
 assert.equal(pkg.version,"0.3.85");
 assert.match(html,/v0\.3\.85 · ROSTER001 \+ RENPLAY \+ REN3D003 \+ ENV010/);
 assert.ok(html.indexOf('src="combat-visual-007.js"')<html.indexOf('src="game.js"'));
 const game=read("game.js");
 assert.match(game,/CombatVisual007\.supported\(BABYLON\)/);
 assert.match(game,/if\(!combatVisual007\)\{/,"legacy arena fallback retained");
 assert.match(game,/combatVisual007\?\.clear\(\)/,"effect pool resets across battles");
 assert.ok(read("battle-animation.js").includes("drainStarted"));
});
