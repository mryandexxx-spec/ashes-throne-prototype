const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const env=require("../combat-environment-017.js");
const visual=fs.readFileSync("combat-visual-007.js","utf8");
const html=fs.readFileSync("index.html","utf8");
const fixture=fs.readFileSync("tests/fixtures/env017-full-game.html","utf8");
test("ENV021 genuinely vendors four CC0 GLB assets, not generated placeholder geometry",()=>{
 assert.deepEqual([...env.SOURCES],["Cliff001","Cliff002","Cliff003","Rock001"]);
 assert.equal(env.PLACEMENTS.length,5);
 let total=0;
 for(const name of env.SOURCES){
  const file=fs.readFileSync(path.join("assets","env021",name+".glb"));
  const copy=file.buffer.slice(file.byteOffset,file.byteOffset+file.byteLength);
  const parsed=env.parse(copy);
  assert.ok(parsed.vertices>=20&&parsed.vertices<15000,"actual mesh vertices");
  assert.equal(parsed.triangles,16,"pinned upstream cliff triangulation");
  assert.ok(parsed.positions.every(Number.isFinite));
  assert.ok(parsed.uvs?.length===parsed.vertices*2);
  assert.ok(parsed.imageBytes?.byteLength>100,"embedded source texture present");
  assert.ok(["image/png","image/jpeg"].includes(parsed.imageMime));
  total+=file.byteLength;
 }
 assert.ok(total>40000&&total<100000,"local asset transfer budget");
});
test("ENV021 rejects malformed GLB instead of silently drawing invented geometry",()=>{
 assert.throws(()=>env.parse(new ArrayBuffer(64)),/GLB header invalid/);
 assert.throws(()=>env.parse(new ArrayBuffer(0)),/GLB header invalid/);
});
test("ENV021 modules avoid near ring walls and preserve core of arena",()=>{
 const ids=new Set(env.PLACEMENTS.map(p=>p.source));
 assert.ok([...ids].every(x=>env.SOURCES.includes(x)));
 assert.ok(env.PLACEMENTS.every(p=>p.scale>0&&p.scale<.05));
 assert.ok(env.PLACEMENTS.some(p=>p.side< -7));
 assert.ok(env.PLACEMENTS.some(p=>p.side>15&&p.away>20));
 const src=fs.readFileSync("combat-environment-017.js","utf8");
 assert.match(src,/dataset\.env021Assets=value/);
 assert.match(src,/Promise\.all\(SOURCES\.map/);
 assert.match(src,/return Object\.freeze\(\{stage:"loading-external-cc0"/);
 assert.match(src,/mark\(disposed\(\)\?"disposed":"fallback"\)/);
 assert.match(src,/scene\.getTransformMatrix\(\)/);
 assert.match(src,/B\.Vector3\.Project/);
 assert.doesNotMatch(src,/requestAnimationFrame|runRenderLoop|new B\.Engine/);
 assert.match(fixture,/env021Assets!=="ready"/);
 assert.match(fixture,/env021_external_/);
});
test("ENV021 retains unchanged game HUD, ENV010 fallback, and build version",()=>{
 assert.match(visual,/CombatEnvironment017\.build\(B,scene,owned\)/);
 assert.match(visual,/else if\(typeof CombatEnvironment010/);
 assert.match(html,/combat-environment-017\.js/);
 assert.match(html,/v0\.3\.84 · OPSHELP.*ENV017-MASSING/);
});
