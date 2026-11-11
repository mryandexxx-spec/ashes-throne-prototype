"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8");
const html=read("index.html"),js=read("game.js"),css=read("styles.css"),cardSource=read("ren-card-3d.js");
const runtime=read("ren-glb-runtime.js");
test("REN-GLB-003: production footer and package identify the new build",()=>{
 assert.match(html,/id="buildVersion"[^>]*>Прототип · v0\.3\.106 · UIHUD001/);
 assert.equal(JSON.parse(read("package.json")).version,"0.3.106");
 assert.match(html,/ENV022-DEFAULT \+ RENGLB003/);
 assert.match(html,/styles\.css\?v=0\.3\.106/);
 assert.match(html,/game\.js\?v=0\.3\.106/);
});
test("REN-GLB-003: dossier shows a touch-rotatable canvas only for Ren",()=>{
 assert.match(html,/id="renCard3DCanvas"[^>]*hidden/);
 assert.match(html,/id="renCardMode"/);
 assert.match(html,/id="renCardReset"/);
 assert.match(html,/id="renCard3DStatus"/);
 assert.match(html,/ren-card-3d\.js\?v=0\.3\.106/);
 assert.match(js,/RenCard3D\.activate\(hero\.id\)/);
 assert.match(js,/RenCard3D\.dispose\(\)/);
 assert.match(cardSource,/camera\.attachControl\(canvas,true\)/);
 assert.match(css,/ren-card-3d-canvas[^\{]*\{[^}]*touch-action:none/);
 assert.match(cardSource,/engine\.stopRenderLoop\(render\)/);
 assert.match(cardSource,/scene\?\.dispose\(\)/);
 assert.match(cardSource,/engine\.dispose\(\)/);
});
test("REN-GLB-003: GLB loading is visible to player, errors retain old Ren",()=>{
 assert.match(html,/id="renModelBattleStatus"/);
 assert.match(js,/RenGlbRuntime\.create\(BABYLON,scene,meshes\.ren,\(kind,message\)=>/);
 assert.match(runtime,/onStatus\("ready","3D Рен загружен"\)/);
 assert.match(runtime,/onStatus\("error","3D Рен: ошибка загрузки/);
 assert.match(runtime,/oldParts.*isVisible=false/);
 assert.match(runtime,/if\(!disposed\)\{/);
 assert.match(cardSource,/renCardGlbRoot/);
 assert.match(cardSource,/ImportMeshAsync/);
 assert.match(cardSource,/holder\.scaling\.set/);
});
test("REN-GLB-003: card and battle share the same immutable GLB",()=>{
 const crypto=require("node:crypto");
 const b=fs.readFileSync(path.join(__dirname,"../assets/ren-wanderer-v1.glb"));
 assert.equal(b.readUInt32LE(0),0x46546c67);
 assert.equal(crypto.createHash("sha256").update(b).digest("hex"),
  "bf017f6dbd4467a749642f0fcea88dce970da85e39d5f00359b4b603b94f29fb");
 assert.match(runtime,/ren-wanderer-v1\.glb/);
 assert.match(cardSource,/RenGlbRuntime\.ASSET_URL/);
 assert.doesNotMatch(cardSource,/localStorage|sessionStorage|CombatCore\.|ProgressCore\./);
});
