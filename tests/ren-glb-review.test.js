"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const html=fs.readFileSync(path.join(__dirname,"../ren-glb-review.html"),"utf8");
const js=fs.readFileSync(path.join(__dirname,"../ren-glb-review.js"),"utf8");
test("REN-GLB-REVIEW page is separated from battle and supports iPhone local GLB",()=>{
 assert.match(html,/type="file"[^>]*accept="\.glb,model\/gltf-binary"/);
 assert.match(html,/babylonjs\.loaders\.min\.js/);
 assert.match(html,/ren-3d-studio\.js/);
 assert.match(html,/ren-glb-review\.js/);
 assert.match(html,/touch-action:none/);
 assert.match(html,/viewport-fit=cover/);
 assert.match(html,/safe-area-inset-left/);
 assert.doesNotMatch(html,/game\.js|save-core\.js|combat-core\.js/);
});
test("REN-GLB-REVIEW verifies GLB header, imports via Babylon and preserves old preview",()=>{
 assert.match(js,/0x46546c67/);
 assert.match(js,/getUint32\(4,true\)!==2/);
 assert.match(js,/getUint32\(8,true\)!==file\.size/);
 assert.match(js,/BABYLON\.SceneLoader\.ImportMeshAsync/);
 assert.match(js,/getBoundingInfo\(\)\.boundingBox/);
 assert.match(js,/Ren3DStudio\.create/);
 assert.match(js,/select\("imported"\)/);
 assert.match(js,/URL\.revokeObjectURL/);
 assert.doesNotMatch(js,/localStorage|fetch\(|XMLHttpRequest|save|BattleState/);
});
