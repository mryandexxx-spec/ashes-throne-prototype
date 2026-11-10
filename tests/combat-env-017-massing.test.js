const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const env=require("../combat-environment-017.js");
const visual=fs.readFileSync("combat-visual-007.js","utf8");
const html=fs.readFileSync("index.html","utf8");
const fixture=fs.readFileSync("tests/fixtures/env017-full-game.html","utf8");

test("ENV026: a real edited Blender GLB assembles original CC0 photo scans",()=>{
 assert.deepEqual([...env.SOURCES],["ENV026_authored_gorge"]);
 assert.equal(env.PLACEMENTS.length,1);
 const bytes=fs.readFileSync("assets/env026/ENV026_authored_gorge.glb");
 assert.ok(bytes.length>100000&&bytes.length<8000000);
 const model=env.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.length));
 assert.ok(model.triangles>15000&&model.triangles<100000);
 assert.ok(model.vertices>10000&&model.vertices<160000);
 assert.ok(model.positions.every(Number.isFinite));
 assert.ok(model.indices.every(i=>i>=0&&i<model.vertices));
 assert.equal(model.vertexColors?.length,model.vertices*4);
 assert.ok(fs.statSync("assets/env026/ENV026_authored_gorge.blend").size>100000);
});
test("ENV026: the authored source scene is not constructed procedurally during gameplay",()=>{
 const blender=fs.readFileSync("tools/env026-author-gorge.blend.py","utf8");
 assert.match(blender,/import_scene\.gltf/);
 assert.match(blender,/export_scene\.gltf/);
 assert.match(blender,/bpy\.ops\.wm\.save_as_mainfile/);
 assert.match(blender,/A_near_integrated_shelf_and_cliff_root/);
 assert.match(blender,/B_far_opposite_bank_with_actual_thickness/);
 const src=fs.readFileSync("combat-environment-017.js","utf8");
 assert.match(src,/dataset\.env026AuthoredBlender="ready"/);
 assert.match(src,/return \[x,y,z\]/);
 assert.match(src,/Promise\.all\(SOURCES\.map/);
 assert.match(src,/for\(const name of \["living_ledge","ravine"/);
 assert.match(src,/mark\(disposed\(\)\?"disposed":"fallback"\)/);
 assert.doesNotMatch(src,/requestAnimationFrame|runRenderLoop|new B\.Engine/);
});
test("ENV026: preserves existing HUD camera and ENV010 safety path",()=>{
 assert.match(visual,/CombatEnvironment017\.build\(B,scene,owned\)/);
 assert.match(visual,/else if\(typeof CombatEnvironment010/);
 assert.match(html,/combat-environment-017\.js/);
 assert.match(html,/v0\.3\.87 · ROSTER003.*ENV017-MASSING/);
 assert.match(fixture,/env026Assets!=="ready"/);
 assert.match(fixture,/env026AuthoredBlender/);
 assert.match(fixture,/data\.contactStatus/);
 const src=fs.readFileSync("combat-environment-017.js","utf8");
 assert.match(src,/B\.Vector3\.Project/);
 assert.match(src,/mesh\.isPickable=false/);
 assert.throws(()=>env.parse(new ArrayBuffer(0)),/GLB header invalid/);
});
