"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const Visual=require("../combat-visual-007.js");
function fakeBabylon(){
 class Vec{constructor(x,y,z){this.x=x;this.y=y;this.z=z;}}
 class Mat{constructor(name,scene){this.name=name;this.alpha=1;this.disposed=false;scene.materials.push(this);}dispose(){this.disposed=true;}}
 class Mesh{constructor(name,shape,options,scene){this.name=name;this.shape=shape;this.options=options;this.isPickable=true;this.enabled=true;this.position=new Vec(0,0,0);this.rotation=new Vec(0,0,0);this.scaling=new Vec(1,1,1);this.disposed=false;scene.meshes.push(this);}setEnabled(v){this.enabled=v;}dispose(){this.disposed=true;}}
 const B={Color3:Vec,Vector3:Vec,StandardMaterial:Mat,MeshBuilder:{}};
 for(const type of ["CreateGround","CreateBox","CreateCylinder","CreateSphere","CreateTorus"])
  B.MeshBuilder[type]=(name,opts,scene)=>new Mesh(name,type,opts,scene);
 return B;
}
test("CV007 static arena is bounded, self-contained, unpickable and can fall back",()=>{
 const B=fakeBabylon(),scene={meshes:[],materials:[]};
 assert.equal(Visual.supported(B),true);
 assert.equal(Visual.supported({MeshBuilder:{CreateGround(){}}}),false);
 const arena=Visual.create(B,scene);
 assert.equal(scene.meshes.length,56,"bounded CV008 stone scenery + 3x2 impact pieces");
 assert.equal(scene.materials.length,16,"CV008 palette + per-FX fade materials");
 assert.ok(scene.meshes.every(m=>m.isPickable===false),"no arena prop intercepts fighter selection");
 assert.ok(scene.meshes.some(m=>m.name==="cv007_surface"));
 assert.ok(scene.meshes.some(m=>m.name==="cv007_chasm"));
 assert.ok(scene.meshes.some(m=>m.name.startsWith("cv008_distant_mass")),"new irregular distant rocks replace old cylinders");
 assert.ok(scene.meshes.every(m=>!m.material.diffuseTexture),"no texture downloads");
 assert.equal(arena.pending(),0);
 assert.equal(scene.meshes.filter(m=>m.name.includes("hit_")&&m.enabled).length,0);
 assert.throws(()=>Visual.create({},scene),/requires Babylon/);
});
test("CV007 impact is emitted only for a timed hit, uses a bounded pool and expires",()=>{
 const B=fakeBabylon(),scene={meshes:[],materials:[]},arena=Visual.create(B,scene);
 const fighters={ves:{head:{position:new B.Vector3(3,1.8,-1)}},ren:{head:{position:new B.Vector3(-3,1.8,1)}}};
 arena.emit([{id:"ves",slot:"basic"},{id:"unknown",slot:"hit"}],fighters);
 assert.equal(arena.pending(),0,"no invented combat hits");
 arena.emit([{id:"ves",slot:"hit"}],fighters);
 assert.equal(arena.pending(),1);
 const ring=scene.meshes.find(m=>m.name==="cv007_hit_ring_0");
 assert.equal(ring.position.x,3);assert.equal(ring.position.z,-1);
 assert.equal(ring.enabled,true);assert.equal(ring.isPickable,false);
 arena.tick(40,1);
 assert.ok(ring.material.alpha<.68&&ring.material.alpha>0,"fade via existing frame delta");
 arena.emit([{id:"ren",slot:"hit"},{id:"ves",slot:"hit"},{id:"ren",slot:"hit"}],fighters);
 assert.ok(arena.pending()<=Visual.MAX_FX,"bounded pool even under heavy damage");
 assert.equal(ring.material.alpha,.68,"reused slot opacity must reset");
 arena.tick(90,4);
 assert.equal(arena.pending(),0);
 assert.equal(ring.enabled,false);
 arena.emit([{id:"ves",slot:"hit"}],fighters);
 assert.equal(arena.pending(),1);
 arena.clear();
 assert.equal(arena.pending(),0);assert.equal(ring.enabled,false);
});
test("existing animation timeline supplies hit cues once, even at accelerated speed",()=>{
 const source=read("battle-animation.js");
 const AnimationProfiles={slots:["basic","special","powerful"],resolve:(id,slot)=>{
  const durations={idle:1200,basic:200,hit:120,death:400};
  return {kind:slot==="idle"?"idle":"hit",durationMs:durations[slot]||200,amplitude:.1};
 }};
 const A=vm.runInNewContext(source+"\nBattleAnimation",{AnimationProfiles});
 A.enqueue([{type:"ability",actorId:"ren",abilityId:"basic",targetId:"ves"},{type:"damage",targetId:"ves"}]);
 A.tick(70,1);
 assert.equal(A.drainStarted().length,0);
 A.tick(100,4); // Can consume both actions inside one accelerated frame.
 const cues=Array.from(A.drainStarted());
 assert.deepEqual(cues.map(c=>({id:c.id,slot:c.slot})),[{id:"ves",slot:"hit"}]);
 assert.equal(A.drainStarted().length,0,"drained cues cannot retrigger every frame");
 A.enqueue([{type:"damage",targetId:"ren"}]);
 A.clear();A.tick(50,1);
 assert.equal(A.drainStarted().length,0,"no stale cues after replay");
});
test("CV007 is only a presentation layer wired into the existing lifecycle",()=>{
 const visual=read("combat-visual-007.js"),game=read("game.js"),html=read("index.html"),pkg=JSON.parse(read("package.json"));
 assert.doesNotMatch(visual,/runRenderLoop|setInterval|setTimeout|\bfetch\(|new\s+B\.Scene|new\s+B\.Engine/);
 assert.match(game,/typeof CombatVisual007!=="undefined"&&CombatVisual007\.supported\(BABYLON\)/);
 assert.match(game,/CombatVisual007\.create\(BABYLON,scene\)/);
 assert.match(game,/BattleAnimation\.drainStarted\(\)/);
 assert.match(game,/combatVisual007\.emit\(visualCues,meshes\)/);
 assert.match(game,/combatVisual007\.tick\(dt,BattleSpeed\.multiplier\(\)\)/);
 assert.match(game,/combatVisual007\?\.clear\(\)/);
 assert.match(game,/if\(!combatVisual007\)\{[\s\S]*CreateGround\("ground"/,"legacy fallback retained");
 assert.match(game,/scene\.dispose\(\)/);
 assert.ok(html.indexOf('src="combat-visual-007.js"')<html.indexOf('src="game.js"'));
 assert.equal(pkg.version,"0.3.86");
 assert.ok(html.includes("v0.3.86 · ROSTER002 + OPSHELP + RENPLAY + REN3D003 + ENV010"));
 assert.ok(pkg.scripts.test.includes("node --check combat-visual-007.js"));
});
