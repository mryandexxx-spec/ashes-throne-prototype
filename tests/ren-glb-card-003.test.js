"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8");
const html=read("index.html"),js=read("game.js"),css=read("styles.css"),module=read("ren-card-3d.js");
const runtime=read("ren-glb-runtime.js");
test("REN-GLB-003: production footer and package identify the new build",()=>{
 assert.match(html,/id="buildVersion"[^>]*>Прототип · v0\.3\.104 · RENGLB003/);
 assert.equal(JSON.parse(read("package.json")).version,"0.3.104");
 assert.match(html,/styles\.css\?v=0\.3\.104/);
 assert.match(html,/game\.js\?v=0\.3\.104/);
});
test("REN-GLB-003: dossier shows a touch-rotatable canvas only for Ren",()=>{
 assert.match(html,/id="renCard3DCanvas"[^>]*hidden/);
 assert.match(html,/id="renCardMode"/);
 assert.match(html,/id="renCardReset"/);
 assert.match(html,/id="renCard3DStatus"/);
 assert.match(html,/ren-card-3d\.js\?v=0\.3\.104/);
 assert.match(js,/RenCard3D\.activate\(hero\.id\)/);
 assert.match(js,/RenCard3D\.dispose\(\)/);
 assert.match(module,/camera\.attachControl\(canvas,true\)/);
 assert.match(css,/ren-card-3d-canvas[^\{]*\{[^}]*touch-action:none/);
 assert.match(module,/engine\.stopRenderLoop\(render\)/);
 assert.match(module,/scene\?\.dispose\(\)/);
 assert.match(module,/engine\.dispose\(\)/);
});
test("REN-GLB-003: GLB loading is visible to player, errors retain old Ren",()=>{
 assert.match(html,/id="renModelBattleStatus"/);
 assert.match(js,/RenGlbRuntime\.create\(BABYLON,scene,meshes\.ren,\(kind,message\)=>/);
 assert.match(runtime,/onStatus\("ready","3D Рен загружен"\)/);
 assert.match(runtime,/onStatus\("error","3D Рен: ошибка загрузки/);
 assert.match(runtime,/oldParts.*isVisible=false/);
 assert.match(runtime,/if\(!disposed\)\{/);
 assert.match(module,/3D-модель Рена Терена/);
 assert.match(module,/ImportMeshAsync/);
 assert.match(module,/holder\.scaling\.set/);
});
test("REN-GLB-003: card and battle share the same immutable GLB",()=>{
 const crypto=require("node:crypto");
 const b=fs.readFileSync(path.join(__dirname,"../assets/ren-animated-v02.glb"));
 assert.equal(b.readUInt32LE(0),0x46546c67);
 assert.equal(crypto.createHash("sha256").update(b).digest("hex"),
  "563766990d2ba4437ff264c2acaa9498d610cc22a268b6d52d4ea464b1fb7b5f");
 assert.match(runtime,/ren-animated-v02\.glb/);
 assert.match(module,/ren-animated-v02\.glb/);
 assert.doesNotMatch(module,/localStorage|sessionStorage|CombatCore\.|ProgressCore\./);
});
