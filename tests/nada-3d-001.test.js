"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),vm=require("node:vm");
const root=path.join(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const map=require("../dev/src/assets/models.js");
const runtime=require("../nada-glb-runtime.js");
const manifest=JSON.parse(read("dev/assets/models/manifest.json"));
test("NADA3D001: Dune dev layout and mobile GLB contract",t=>{
 assert.equal(map.url,"dev/assets/models/nada-mobile-animated.glb");
 assert.equal(map.bytes,1462284);
 assert.equal(map.sha256,"5bbd34c2db189d1831c213b02ac31f49342f8b7773cc283589ece8249a5a016d");
 assert.equal(manifest.assets[0].file,map.filename);
 assert.equal(runtime.assetUrl(),map.url);
 assert.equal(runtime.clipFor("idle"),"Idle_11");
 assert.equal(runtime.clipFor("basic"),"Archery_Shot_3");
 assert.equal(runtime.clipFor("special"),"Archery_Shot_3");
 assert.equal(runtime.clipFor("powerful"),"mage_soell_cast"); // PROG085
 assert.equal(runtime.clipFor("hit"),"Hit_Reaction_1");
 assert.equal(runtime.clipFor("death"),"Electrocuted_Fall");
 const file=path.join(root,map.url);
 if(!fs.existsSync(file)){
  assert.fail("BINARY PENDING: upload dev/assets/models/nada-mobile-animated.glb before merge");
 }
 const buffer=fs.readFileSync(file);
 assert.equal(buffer.length,map.bytes);
 assert.equal(crypto.createHash("sha256").update(buffer).digest("hex"),map.sha256);
 assert.equal(buffer.toString("ascii",0,4),"glTF");
 assert.equal(buffer.readUInt32LE(4),2);
 assert.equal(buffer.readUInt32LE(8),buffer.length);
 const jsonLength=buffer.readUInt32LE(12);
 const gltf=JSON.parse(buffer.subarray(20,20+jsonLength).toString("utf8"));
 assert.equal(gltf.meshes.length,1);
 assert.equal(gltf.animations.length,8);
 assert.equal(gltf.skins.length,1);
 assert.equal(gltf.skins[0].joints.length,66);
 const clips=gltf.animations.map(a=>a.name);
 for(const name of [map.clips.idle,map.clips.basic,map.clips.hit,map.clips.death])assert.ok(clips.includes(name));
 assert.equal(gltf.images[0].mimeType,"image/webp"); // NADAOPT001
});
test("NADA3D001: game and card load the same asset without new engine in combat",()=>{
 const page=read("index.html"),game=read("game.js"),card=read("ren-card-3d.js");
 assert.match(page,/dev\/src\/assets\/models\.js\?v=\d+\.\d+\.\d+/);
 assert.match(page,/nada-glb-runtime\.js\?v=\d+\.\d+\.\d+/);
 assert.match(game,/function ensureNada3D\(\)/);
 // The scene may exist before the chosen squad is materialized.
 // Never inject Nada's Mixamo rig into a Ren-only fight at initBabylon().
 const init=game.slice(game.indexOf("function initBabylon(){"),game.indexOf("function updateMeshes(){"));
 assert.doesNotMatch(init,/ensureNada3D\(\)/);
 assert.match(game,/resetBattle\(\);\s*updateMeshes\(\)/);
 assert.match(game,/function updateMeshes\(\)\{\s*if\(!scene\)return;\s*ensureNada3D\(\);/);
 assert.match(game,/if\(!selected\)\{[\s\S]*?nadaGlbRuntime\.dispose\(\)/);

 assert.match(game,/nadaGlbRuntime=NadaGlbRuntime\.create\(BABYLON,scene,meshes\.nada/);
 assert.match(game,/if\(h\.id==="nada"&&nadaGlbRuntime\)nadaGlbRuntime\.update\(activity\)/);
 assert.match(game,/if\(nadaGlbRuntime\)\{nadaGlbRuntime\.dispose\(\);nadaGlbRuntime=null;\}/);
 assert.match(card,/isNada\?NadaGlbRuntime\.assetUrl\(\):RenGlbRuntime\.ASSET_URL/);
 assert.match(card,/isNada\?groups\.find\(g=>g\.name==="Idle_11"\)/);
 assert.match(card,/if\(isNada\|\|isLiora\)throw Error\("В GLB героя отсутствует анимация ожидания"\)/);
 assert.match(game,/assets\/nada-portrait-ui\.webp\?v=2/);
 assert.match(game,/const showRenPortrait=hero\.id==="ren"/);
 assert.equal((game.match(/new BABYLON\.Engine/g)||[]).length,1,
  "combat still has exactly one Engine");
});
test("NADA3D001: failed load retains a simple fighter and reports fallback",async()=>{
 const source=read("nada-glb-runtime.js");
 const context={console:{warn(){}},Error,Promise,Number,Math,
  RenGlbRuntime:{ensureLoader:()=>Promise.reject(Error("offline"))},
  NadaModelAssets:map};
 const simulated=vm.runInNewContext(source+"\nNadaGlbRuntime",context);
 const visual={body:{isVisible:true},head:{isVisible:true}};
 let kind=null;
 const loader=simulated.create({SceneLoader:{}},{isDisposed:false},visual,(k)=>{kind=k;});
 assert.equal(await loader.ready,false);
 assert.equal(loader.isReady,false);
 assert.equal(kind,"error");
 assert.equal(visual.body.isVisible,true);
 assert.equal(visual.head.isVisible,true);
 loader.dispose();
});
test("NADA3D001: short footer and versioned scripts",()=>{
 const html=read("index.html"),pkg=JSON.parse(read("package.json"));
 assert.match(pkg.version,/^\d+\.\d+\.\d+$/);
 assert.match(html,/id="buildVersion">Прототип · v\d+\.\d+\.\d+ · [A-Z][A-Z0-9-]*/);
 assert.match(html,/ren-card-3d\.js\?v=\d+\.\d+\.\d+/);
 assert.ok(read("dev/assets-src/characters/nada/README.md").includes("Meshy_AI_model_20261112"));
});
