"use strict";
// ARENA-ART-004C: enemy GLB runtime contract, profiles and game.js wiring (no browser).
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
global.NpcModelAssets=require("../dev/src/assets/npc-models.js");
const runtime=require("../npc-glb-runtime.js");
const profiles=require("../animation-profiles.js");
const ids=Object.keys(NpcModelAssets.models);
const glbJson=file=>{
 const b=fs.readFileSync(path.join(root,file)),n=b.readUInt32LE(12);
 return JSON.parse(b.subarray(20,20+n).toString("utf8"));
};
test("ARENA-ART-004C: interface mirrors NadaGlbRuntime and reads the manifest",()=>{
 for(const key of ["create","CLIPS","WINDOWS","clipFor","windowFor","assetUrl","has"])
  assert.ok(key in runtime,"missing "+key);
 assert.equal(ids.length,8);
 for(const id of ids){
  assert.equal(runtime.has(id),true);
  assert.equal(runtime.assetUrl(id),NpcModelAssets.models[id].url);
  assert.deepEqual(runtime.CLIPS[id],NpcModelAssets.models[id].clips);
  for(const slot of runtime.SLOTS)assert.equal(runtime.clipFor(id,slot),NpcModelAssets.models[id].clips[slot]);
  assert.deepEqual(runtime.windowFor(id,"idle"),[0,1]); // windows: ARENA-ART-004D test
 }
 // Sarkh have no model until step 5: create() returns null, the capsule stays.
 for(const id of ["npc-sarkh-convoy-guard","npc-sarkh-land-courier","ves",undefined,"__proto__"]){
  assert.equal(runtime.has(id),false);
  assert.equal(runtime.create({},{},{body:{},head:{}},{archetypeId:id,fighterId:"e1"}),null);
 }
});
test("ARENA-ART-004C: every GLB carries the manifest clips and a Hips bone to pin",()=>{
 for(const id of ids){
  const gltf=glbJson(NpcModelAssets.models[id].url);
  const clips=new Set(gltf.animations.map(a=>a.name));
  for(const slot of runtime.SLOTS)assert.ok(clips.has(NpcModelAssets.models[id].clips[slot]),id+" "+slot);
  assert.ok(gltf.nodes.some(n=>n.name==="Hips"),id+" Hips");
 }
});
test("ARENA-ART-004C: archetype profiles apply only through link() and keep sane timing",()=>{
 const slots=["idle","basic","special","powerful","guard","ward","hit","death"];
 for(const id of ids){
  for(const slot of slots){
   const p=profiles.resolve(id,slot);
   assert.ok(profiles.isCustom(id,slot),id+" "+slot);
   assert.ok(p.durationMs>=700&&p.durationMs<=3000,id+" "+slot+" "+p.durationMs);
  }
  assert.equal(profiles.resolve(id,"idle").amplitude,0);
  for(const slot of ["guard","ward","death"])assert.equal(profiles.resolve(id,slot).amplitude,0);
  assert.ok(Number.isFinite(profiles.resolve(id,"basic").contactFraction)); // measured in 004D
 }
 assert.equal(profiles.resolve("npc-ridge-slinger","basic").rooted,true);
 assert.equal(profiles.resolve("npc-pass-guard","basic").rooted,undefined);
 // Instance id: templates until linked, archetype after, templates again after unlink.
 const template=profiles.resolve("e-test","basic");
 assert.equal(profiles.isCustom("e-test","basic"),false);
 assert.equal(profiles.link("e-test","npc-watch-captain"),true);
 assert.equal(profiles.resolve("e-test","powerful"),profiles.resolve("npc-watch-captain","powerful"));
 profiles.unlink("e-test");
 assert.equal(profiles.resolve("e-test","basic"),template);
 assert.equal(profiles.link("e-test","npc-sarkh-convoy-guard"),false);
});
test("ARENA-ART-004C: game.js keeps the capsule fallback and disposes enemy GLBs",()=>{
 const game=read("game.js"),page=read("index.html");
 const models=page.indexOf('src="dev/src/assets/npc-models.js?v='),rt=page.indexOf('src="npc-glb-runtime.js?v=');
 assert.ok(models>0&&rt>models&&rt<page.indexOf('src="game.js?v='));
 const ensure=game.slice(game.indexOf("function ensureEncounterNpcVisuals"),game.indexOf("function arenaVisReady"));
 assert.match(ensure,/CreateCapsule/); // capsule is always built first
 assert.match(ensure,/ensureEncounterNpcModel\(f,meshes\[f\.id\]\)/);
 assert.match(ensure,/ensureEncounterNpcModel\(\{id:f\.id,archetypeId:standIn\.archetypeId\},meshes\[f\.id\],standIn\.tint\)/);
 assert.match(ensure,/AnimationProfiles\.link\(f\.id,f\.archetypeId\)/);
 const clear=game.slice(game.indexOf("function clearEncounterNpcVisuals"),game.indexOf("function ensureEncounterNpcVisuals"));
 assert.ok(clear.indexOf("disposeNpcGlbRuntimes()")<clear.indexOf("part.dispose()"),"GLB before capsule");
 const dispose=game.slice(game.indexOf("function disposeNpcGlbRuntimes"),game.indexOf("function clearEncounterNpcVisuals"));
 assert.match(dispose,/runtime\.dispose\(\)/);
 assert.match(dispose,/AnimationProfiles\.unlink/);
 const teardown=game.slice(game.indexOf("if(artGlbRuntime){artGlbRuntime.dispose();artGlbRuntime=null;}\n   disposeNpcGlbRuntimes();"));
 assert.ok(teardown.length>0,"load-error teardown releases enemy GLBs");
 assert.match(game,/if\(npcGlb\)npcGlb\.update\(activity\)/);
});
