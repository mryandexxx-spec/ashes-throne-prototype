const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const env=require("../combat-environment-017.js");
const visual=fs.readFileSync("combat-visual-007.js","utf8");
const html=fs.readFileSync("index.html","utf8");
const fixture=fs.readFileSync("tests/fixtures/env017-full-game.html","utf8");
test("ENV022 uses actual ready-made CC0 mesa and two companion terrain modules",()=>{
 assert.deepEqual([...env.SOURCES],["MesaTerrain","CliffFace","CanyonWall"]);
 assert.equal(env.PLACEMENTS.length,3);
 assert.equal(env.PLACEMENTS[0].source,"MesaTerrain");
 assert.ok(env.PLACEMENTS[0].scale>2);
 assert.ok(env.PLACEMENTS.some(x=>x.source==="CanyonWall"&&x.side>15));
 assert.ok(env.PLACEMENTS.some(x=>x.source==="CliffFace"&&x.side< -10));
 const budgets={MesaTerrain:[9000,11000],CliffFace:[5000,6000],CanyonWall:[6500,7500]};
 let triangles=0,bytes=0;
 for(const name of env.SOURCES){
  const raw=fs.readFileSync(path.join("assets","env022",name+".glb"));
  const glb=raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength);
  const data=env.parse(glb);
  assert.ok(data.positions.length>=data.vertices*3);
  assert.ok(data.vertexColors?.length===data.vertices*4);
  assert.ok(data.triangles>=budgets[name][0]&&data.triangles<=budgets[name][1]);
  assert.ok(data.positions.every(Number.isFinite));
  assert.ok(data.indices.every(i=>i>=0&&i<data.vertices));
  triangles+=data.triangles;bytes+=raw.byteLength;
 }
 assert.ok(triangles>=21000&&triangles<=25000,"total unique source triangle budget");
 assert.ok(bytes>=400000&&bytes<=850000,"total local asset bytes");
});
test("ENV022 rejects corrupt/unsupported GLB",()=>{
 assert.throws(()=>env.parse(new ArrayBuffer(0)),/GLB header invalid/);
 assert.throws(()=>env.parse(new ArrayBuffer(80)),/GLB header invalid/);
});
test("ENV022 preserves fighter/camera/game selection and only hides original island on ready",()=>{
 const src=fs.readFileSync("combat-environment-017.js","utf8");
 assert.match(visual,/CombatEnvironment017\.build\(B,scene,owned\)/);
 assert.match(visual,/else if\(typeof CombatEnvironment010/);
 assert.match(html,/combat-environment-017\.js/);
 assert.match(html,/v0\.3\.84 · OPSHELP.*ENV017-MASSING/);
 assert.match(src,/dataset\.env022Integrated="ready"/);
 assert.match(src,/Promise\.all\(SOURCES\.map/);
 assert.match(src,/mark\(disposed\(\)\?"disposed":"fallback"\)/);
 assert.match(src,/for\(const name of \["living_ledge","ravine"/);
 assert.match(src,/scene\.getTransformMatrix\(\)/);
 assert.match(src,/B\.Vector3\.Project/);
 assert.doesNotMatch(src,/requestAnimationFrame|runRenderLoop|new B\.Engine/);
 assert.match(fixture,/env022Assets!=="ready"/);
 assert.match(fixture,/env022_terrain_/);
});
