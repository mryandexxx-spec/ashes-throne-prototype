/* SAVA3D001 — GLB integrity + wiring regression. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const crypto=require("node:crypto");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const get=p=>fs.readFileSync(path.join(root,p));
test("Sava animated GLB is available and optimized",()=>{
 const file=get("dev/assets/models/sava-mobile-animated.glb");
 assert.equal(file.length,1498852);
 assert.equal(crypto.createHash("sha256").update(file).digest("hex"),"f88842d6677b1383e5ac337b1d49704462033a3b6e35498f0ea124ee36d4560b");
 assert.equal(file.toString("ascii",0,4),"glTF");
 assert.equal(file.readUInt32LE(8),file.length);
 const json=JSON.parse(file.subarray(20,20+file.readUInt32LE(12)).toString("utf8"));
 assert.equal(json.skins[0].joints.length,68);
 assert.deepEqual(json.animations.map(a=>a.name),["Running","Walking","Hit_Reaction_to_Waist","Idle","dying_backwards","mage_soell_cast","mage_soell_cast_4","slide_light"]);
 assert.equal(json.images[0].mimeType,"image/webp");
 assert.ok(json.extensionsUsed.includes("KHR_mesh_quantization"));
});
test("Sava presentation is connected to arena and card",()=>{
 const runtime=require("../sava-glb-runtime.js");
 assert.equal(runtime.assetUrl(),"dev/assets/models/sava-mobile-animated.glb");
 assert.equal(runtime.clipFor("idle"),"Idle");
 assert.equal(runtime.clipFor("death"),"dying_backwards");
 const game=get("game.js").toString(),card=get("ren-card-3d.js").toString();
 assert.match(game,/ensureSava3D\(\)/);assert.match(game,/savaGlbRuntime.update\(activity\)/);
 assert.match(card,/isSava/);assert.match(get("index.html").toString(),/sava-glb-runtime.js/);
});