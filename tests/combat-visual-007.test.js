const __BUILD_VERSION_FOR_TESTS=require("../package.json").version;
"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const Visual=require("../combat-visual-007.js");
function fakeBabylon(options={}){
 class Vec{constructor(x,y,z){this.x=x;this.y=y;this.z=z;}}
 class Mat{constructor(name,scene){this.name=name;this.alpha=1;this.disposed=false;scene.materials.push(this);}dispose(){this.disposed=true;}}
 class Mesh{constructor(name,shape,options,scene){this.name=name;this.shape=shape;this.options=options;this.scene=scene;this.isPickable=true;this.enabled=true;this.position=new Vec(0,0,0);this.rotation=new Vec(0,0,0);this.scaling=new Vec(1,1,1);this.disposed=false;scene.meshes.push(this);}setEnabled(v){this.enabled=v;}dispose(){this.disposed=true;}}
 if(options.instancing)Mesh.prototype.createInstance=function(name){
  const m=new Mesh(name,"instance",{},this.scene);m.sourceMesh=this;
  Object.defineProperty(m,"material",{get:()=>this.material});return m;
 };
 const B={Color3:Vec,Vector3:Vec,StandardMaterial:Mat,MeshBuilder:{}};
 for(const type of ["CreateGround","CreateBox","CreateCylinder","CreateSphere","CreateTorus","CreatePlane"])
  B.MeshBuilder[type]=(name,opts,scene)=>new Mesh(name,type,opts,scene);
 return B;
}
test("CV007 static arena is bounded, self-contained, unpickable and can fall back",()=>{
 const B=fakeBabylon(),scene={meshes:[],materials:[]};
 assert.equal(Visual.supported(B),true);
 assert.equal(Visual.supported({MeshBuilder:{CreateGround(){}}}),false);
 const arena=Visual.create(B,scene);
 // ARENA-VIS-002: 3 pooled spark bursts (flash + SPARKS dots) replace 3 ring/glow pairs.
 assert.equal(scene.meshes.length,50+Visual.MAX_FX*(1+Visual.SPARKS),"bounded CV008 stone scenery + 3 spark bursts");
 assert.equal(scene.materials.length,16,"CV008 palette + per-burst flash/spark materials");
 assert.ok(scene.meshes.every(m=>m.isPickable===false),"no arena prop intercepts fighter selection");
 assert.ok(scene.meshes.some(m=>m.name==="cv007_surface"));
 assert.ok(scene.meshes.some(m=>m.name==="cv007_chasm"));
 assert.ok(scene.meshes.some(m=>m.name.startsWith("cv008_distant_mass")),"new irregular distant rocks replace old cylinders");
 assert.ok(scene.meshes.every(m=>!m.material.diffuseTexture),"no texture downloads");
 assert.ok(!scene.meshes.some(m=>/hit_(ring|glow)/.test(m.name)),"the 160 ms ring is gone");
 assert.equal(arena.pending(),0);
 assert.equal(scene.meshes.filter(m=>m.name.includes("hit_")&&m.enabled).length,0);
 assert.throws(()=>Visual.create({},scene),/requires Babylon/);
});
test("ARENA-VIS-002 sparks: instanced, billboarded, drawn over fighters, bounded and expiring",()=>{
 const B=fakeBabylon({instancing:true}),scene={meshes:[],materials:[]},arena=Visual.create(B,scene);
 const masters=scene.meshes.filter(m=>/^cv007_hit_spark_\d$/.test(m.name));
 const instances=scene.meshes.filter(m=>m.sourceMesh);
 const flashes=scene.meshes.filter(m=>/^cv007_hit_flash_\d$/.test(m.name));
 assert.equal(masters.length,Visual.MAX_FX);assert.equal(flashes.length,Visual.MAX_FX);
 assert.equal(instances.length,Visual.MAX_FX*(Visual.SPARKS-1),"one draw call per burst: sparks are instances");
 assert.ok([...masters,...flashes,...instances].every(m=>m.billboardMode===7&&m.isPickable===false));
 assert.ok([...masters,...flashes].every(m=>m.renderingGroupId===1),"melee attacker in front cannot hide the burst");
 const fighters={ves:{head:{position:new B.Vector3(3,1.8,-1)}},ren:{head:{position:new B.Vector3(-3,1.8,1)}}};
 arena.emit([{id:"ves",slot:"basic"},{id:"unknown",slot:"hit"}],fighters);
 assert.equal(arena.pending(),0,"no invented combat hits");
 arena.emit([{id:"ves",slot:"hit"}],fighters);
 assert.equal(arena.pending(),1);
 const flash=flashes[0];
 assert.ok(Math.abs(flash.position.x-3)<.5&&Math.abs(flash.position.z+1)<.5,"burst at the target");
 assert.ok(flash.position.y>=.9&&flash.position.y<1.8,"chest height, not the head");
 const active=[masters[0],...instances.filter(m=>m.sourceMesh===masters[0])].filter(m=>m.enabled);
 assert.ok(active.length>=3&&active.length<Visual.SPARKS,"ordinary hit uses part of the pool");
 const y0=active.map(m=>m.position.y);
 arena.tick(40,1);
 assert.ok(active.some((m,i)=>m.position.y!==y0[i]),"sparks fly");
 assert.ok(flash.material.alpha<.95&&flash.material.alpha>0,"flash fades by frame delta");
 arena.emit([{id:"ren",slot:"hit",strong:true},{id:"ves",slot:"hit"},{id:"ren",slot:"hit",strong:true}],fighters);
 assert.ok(arena.pending()<=Visual.MAX_FX,"bounded pool even under heavy damage");
 assert.equal(flash.material.alpha,.95,"reused slot opacity must reset");
 assert.equal([masters[1],...instances.filter(m=>m.sourceMesh===masters[1])].filter(m=>m.enabled).length,Visual.SPARKS,"strong hit uses the full burst");
 for(let i=0;i<4;i++)arena.tick(90,1);
 assert.equal(arena.pending(),0);
 assert.equal(scene.meshes.filter(m=>m.name.includes("hit_")&&m.enabled).length,0);
 arena.emit([{id:"ves",slot:"hit"}],fighters);
 assert.equal(arena.pending(),1);
 arena.clear();
 assert.equal(arena.pending(),0);
 assert.equal(scene.meshes.filter(m=>m.name.includes("hit_")&&m.enabled).length,0);
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
 assert.match(game,/CombatVisual007\.create\(BABYLON,scene,\{conceptBackdrop:ENV022_CONCEPT_PREVIEW\}\)/);
 assert.match(game,/BattleAnimation\.drainStarted\(\)/);
 assert.match(game,/combatVisual007\.emit\(visualCues,meshes\)/);
 assert.match(game,/combatVisual007\.tick\(dt,BattleSpeed\.multiplier\(\)\)/);
 assert.match(game,/combatVisual007\?\.clear\(\)/);
 assert.match(game,/if\(!combatVisual007 && !ENV022_CONCEPT_PREVIEW\)\{[\s\S]*CreateGround\("ground"/,"legacy fallback retained");
 assert.match(game,/scene\.dispose\(\)/);
 assert.ok(html.indexOf('src="combat-visual-007.js"')<html.indexOf(`src="game.js?v=${__BUILD_VERSION_FOR_TESTS}"`));
 assert.equal(pkg.version,`${__BUILD_VERSION_FOR_TESTS}`);
 assert.ok(html.includes(`v${__BUILD_VERSION_FOR_TESTS} · `));
 assert.ok(pkg.scripts.test.includes("node --check combat-visual-007.js"));
});
