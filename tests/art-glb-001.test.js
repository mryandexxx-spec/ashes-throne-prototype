"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p));
test("ART3D001: optimized GLB integrity, rig, clips and image",()=>{
 const f=read("dev/assets/models/art-mobile-animated.glb");
 assert.equal(f.length,2032788);
 assert.equal(crypto.createHash("sha256").update(f).digest("hex"),"c7a25c48dbd9117baec08e3ff1612f4b52ece8516a521571b9b1f1b3852b2860");
 assert.equal(f.toString("ascii",0,4),"glTF");
 assert.equal(f.readUInt32LE(8),f.length);
 const gltf=JSON.parse(f.subarray(20,20+f.readUInt32LE(12)).toString("utf8"));
 assert.equal(gltf.skins[0].joints.length,66);
 assert.deepEqual(gltf.animations.map(a=>a.name),[
  "Running","Walking","Hit_Reaction_1","Idle_5",
  "Right_Hand_Sword_Slash","Roundhouse_Kick","RunFast",
  "dying_backwards","mage_soell_cast_7"
 ]);
 assert.equal(gltf.images[0].mimeType,"image/webp");
 assert.ok(gltf.extensionsUsed.includes("KHR_mesh_quantization"));
 assert.ok(gltf.extensionsUsed.includes("EXT_texture_webp"));
});
test("ART3D001: Art is wired to card, arena and cache",()=>{
 const runtime=require("../art-glb-runtime.js");
 assert.equal(runtime.assetUrl(),"dev/assets/models/art-mobile-animated.glb");
 assert.equal(runtime.clipFor("idle"),"Idle_5");
 assert.equal(runtime.clipFor("death"),"dying_backwards");
 const game=read("game.js").toString(),card=read("ren-card-3d.js").toString(),html=read("index.html").toString();
 assert.match(game,/ensureArt3D\(\)/);assert.match(game,/artGlbRuntime\.update\(activity\)/);
 assert.match(card,/isArt/);assert.match(html,/art-glb-runtime\.js/);
 assert.ok(require("../asset-manifest.js").forPath("dev/assets/models/art-mobile-animated.glb"),"Art GLB is in the device cache list");
});
