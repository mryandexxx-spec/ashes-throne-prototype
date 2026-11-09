const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const env=require("../combat-environment-017.js");
const visual=fs.readFileSync("combat-visual-007.js","utf8");
const html=fs.readFileSync("index.html","utf8");
const fixture=fs.readFileSync("tests/fixtures/env017-full-game.html","utf8");
test("ENV024 uses only matching publisher-made CC0 shelf, cliff top, and face",()=>{
 assert.deepEqual([...env.SOURCES],["RockShelf","CliffTop","CliffFace"]);
 assert.equal(env.PLACEMENTS.length,21);
 const counts={RockShelf:468,CliffTop:700,CliffFace:432};
 let triangles=0,bytes=0;
 for(const name of env.SOURCES){
  const file=fs.readFileSync("assets/env024/"+name+".glb");
  bytes+=file.length;
  const data=env.parse(file.buffer.slice(file.byteOffset,file.byteOffset+file.length));
  assert.equal(data.triangles,counts[name]);
  assert.ok(data.positions.every(Number.isFinite));
  assert.equal(data.vertexColors?.length,data.vertices*4);
  assert.ok(data.indices.every(i=>i>=0&&i<data.vertices));
 }
 for(const part of env.PLACEMENTS){
  assert.ok(env.SOURCES.includes(part.source));
  assert.equal(part.scale,1);
  triangles+=counts[part.source];
 }
 assert.ok(triangles>=10000&&triangles<15000,"scene triangle budget");
 assert.ok(bytes>=50000&&bytes<=150000,"local source download budget");
});
test("ENV024 genuinely connects source tiles and leaves visible open gulf",()=>{
 const rock=env.PLACEMENTS.filter(p=>p.source==="RockShelf");
 assert.equal(rock.length,9);
 assert.deepEqual([...new Set(rock.map(p=>p.side))].sort((a,b)=>a-b),[-6,0,6]);
 assert.deepEqual([...new Set(rock.map(p=>p.away))].sort((a,b)=>a-b),[-6,0,6]);
 const roots=env.PLACEMENTS.filter(p=>p.source==="CliffTop"&&p.side<0);
 assert.equal(roots.length,3);
 assert.ok(roots.every(p=>p.side===-12));
 const nearFaces=env.PLACEMENTS.filter(p=>p.source==="CliffFace"&&p.side===9);
 assert.equal(nearFaces.length,3);
 const farFaces=env.PLACEMENTS.filter(p=>p.source==="CliffFace"&&p.side>=24);
 assert.equal(farFaces.length,3);
 assert.ok(env.PLACEMENTS.every(p=>p.side<=9||p.side>=24),"no fake gorge floor");
});
test("ENV024 safely hides prior arena after loading, preserves combat camera and HUD",()=>{
 const src=fs.readFileSync("combat-environment-017.js","utf8");
 assert.match(src,/dataset\.env024Matched="ready"/);
 assert.match(src,/Promise\.all\(SOURCES\.map/);
 assert.match(src,/mark\(disposed\(\)\?"disposed":"fallback"\)/);
 assert.match(src,/for\(const name of \["living_ledge","ravine"/);
 assert.match(src,/scene\.getTransformMatrix\(\)/);
 assert.match(src,/B\.Vector3\.Project/);
 assert.doesNotMatch(src,/requestAnimationFrame|runRenderLoop|new B\.Engine/);
 assert.match(visual,/CombatEnvironment017\.build\(B,scene,owned\)/);
 assert.match(visual,/else if\(typeof CombatEnvironment010/);
 assert.match(html,/combat-environment-017\.js/);
 assert.match(fixture,/env024Assets!=="ready"/);
});
