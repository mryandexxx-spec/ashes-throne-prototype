const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const env=require("../combat-environment-017.js");
const visual=fs.readFileSync("combat-visual-007.js","utf8");
const html=fs.readFileSync("index.html","utf8");
const fixture=fs.readFileSync("tests/fixtures/env017-full-game.html","utf8");
test("ENV025 authentic 40k-triangle CC0 cliff remains a single natural scanned rock",()=>{
 assert.deepEqual([...env.SOURCES],["CoastalCliff04Mobile"]);
 assert.equal(env.PLACEMENTS.length,1);
 const file=fs.readFileSync("assets/env025/CoastalCliff04Mobile.glb");
 assert.ok(file.byteLength>=500000&&file.byteLength<2200000);
 const model=env.parse(file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength));
 assert.equal(model.triangles,40000);
 assert.ok(model.vertices>10000&&model.vertices<25000);
 assert.equal(model.vertexColors?.length,model.vertices*4);
 assert.ok(model.indices.every(i=>i>=0&&i<model.vertices));
 assert.ok(model.positions.every(Number.isFinite));
});
test("ENV025 scene transform targets measured source-derived upper crown, never a fake platform",()=>{
 const src=fs.readFileSync("combat-environment-017.js","utf8");
 assert.match(src,/const world=p\(\(sourceZ\+6\)\*1\.0,\(sourceX-22\)\*\.65,sourceY-8\.329\)/);
 assert.match(src,/return \[world\[0\]-1\.0,world\[1\],world\[2\]\+0\.5\]/);
 assert.match(src,/pos\.push\(\.\.\.placeSource/);
 assert.match(src,/dataset\.env025NaturalCrown="ready"/);
 assert.match(src,/Promise\.all\(SOURCES\.map/);
 assert.match(src,/mark\(disposed\(\)\?"disposed":"fallback"\)/);
 assert.match(src,/for\(const name of \["living_ledge","ravine"/);
 assert.doesNotMatch(src,/requestAnimationFrame|runRenderLoop|new B\.Engine/);
});
test("ENV025 does not change existing combat/HUD/camera/ENV010 fallback",()=>{
 assert.match(visual,/CombatEnvironment017\.build\(B,scene,owned\)/);
 assert.match(visual,/else if\(typeof CombatEnvironment010/);
 assert.match(html,/combat-environment-017\.js/);
 assert.match(html,/v0\.3\.84 · OPSHELP.*ENV017-MASSING/);
 assert.match(fixture,/env025Assets!=="ready"/);
 assert.match(fixture,/env025_external_/);
});
