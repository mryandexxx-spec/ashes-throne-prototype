"use strict";
/* LIORA-SHIELD-006: the Liora lab shows the single GLB with the baked shield; no runtime attachment code remains. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const page=fs.readFileSync(path.join(root,"liora-lab.html"),"utf8");
const legacy=fs.readFileSync(path.join(root,"liora-shield-lab.html"),"utf8");
const runtime=fs.readFileSync(path.join(root,"liora-shield-lab.js"),"utf8");
const registry=fs.readFileSync(path.join(root,"dev/src/assets/models.js"),"utf8");
test("published and legacy Liora preview routes show the baked shield and import no attachment code",()=>{
 for(const html of [page,legacy]){
  assert.match(html,/liora-shield-lab\.js\?v=shield006/);
  assert.doesNotMatch(html,/liora-shield-attachment|liora-shield-combat-pose/);
  assert.doesNotMatch(html,/id="(?:sliders|stabilize|combatCorrection)"/);
  assert.match(html,/id="shield" type="checkbox" checked/);
  assert.match(html,/со щитом/);
  assert.doesNotMatch(html,/без щита/);
 }
});
test("lab runtime loads exactly one GLB and frames the body without the shield",()=>{
 assert.match(runtime,/load\(LioraModelAssets\.url\)/);
 assert.equal((runtime.match(/ImportMeshAsync/g)||[]).length,1);
 assert.doesNotMatch(runtime,/LioraShieldAssets|LioraShieldAttachment|LioraShieldCombatPose/);
 assert.match(runtime,/mesh\.name===SHIELD_MESH\)continue/);
 assert.match(runtime,/shieldMesh\?\.setEnabled/);
 assert.match(registry,/liora-mobile-animated\.glb/);
 assert.doesNotMatch(registry,/liora-shield-mobile\.glb/);
});
test("runtime attachment modules and their tests are retired",()=>{
 for(const file of ["liora-shield-attachment.js","liora-shield-combat-pose.js",
  "tests/liora-shield-attachment.test.js","tests/liora-shield-combat-pose.test.js","tests/liora-unarmed-preview.test.js"])
  assert.ok(!fs.existsSync(path.join(root,file)),file+" must be removed");
 const index=fs.readFileSync(path.join(root,"index.html"),"utf8");
 assert.doesNotMatch(index,/liora-shield-attachment|liora-shield-combat-pose/);
});
