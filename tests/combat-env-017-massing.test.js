const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const env=require("../combat-environment-017.js");
const visual=fs.readFileSync("combat-visual-007.js","utf8");
const html=fs.readFileSync("index.html","utf8");
test("ENV017 massing is authored in camera coordinates and has an open right gap",()=>{
 assert.equal(env.MASS.length,3);
 assert.ok(env.MASS[1].lines[0][0][0]>0);
 assert.ok(env.MASS[1].lines[0][0][1]>40);
 assert.ok(env.MASS[0].lines[0].every(v=>v[2]<=0),"no overhead left wing");
 assert.ok(env.MASS[1].lines[0].every(v=>v[1]>=49));
});
test("ENV017 selection retains the old ENV010 fallback and game HUD",()=>{
 assert.match(visual,/CombatEnvironment017\.build\(B,scene,owned\)/);
 assert.match(visual,/else if\(typeof CombatEnvironment010/);
 assert.match(html,/combat-environment-017\.js/);
 assert.match(html,/v0\.3\.93 · UIHERO001.*ENV017-MASSING/);
});
test("ENV017 remains non-pickable and inspectable through real Babylon matrix",()=>{
 const src=fs.readFileSync("combat-environment-017.js","utf8");
 assert.match(src,/mesh\.isPickable=false/);
 assert.match(src,/scene\.getTransformMatrix\(\)/);
 assert.match(src,/B\.Vector3\.Project/);
 assert.match(src,/dataset\.env017Massing="ready"/);
 assert.doesNotMatch(src,/requestAnimationFrame|runRenderLoop|new B\.Engine/);
});