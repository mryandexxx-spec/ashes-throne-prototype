"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const runtime=require("../ren-glb-runtime.js");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const game=read("game.js"),html=read("index.html"),battle=read("battle-animation.js");
test("REN-GLB-DEFAULT-002: standard game loads GLB adapter, without opt-in flag or file chooser",()=>{
 assert.equal(runtime.ASSET_URL,"assets/ren-meshy-mixamo-animated.glb");
 assert.match(html,/ren-glb-runtime\.js/);
 assert.match(game,/RenGlbRuntime\.create\(BABYLON,scene,meshes\.ren,/);
 assert.match(game,/renGlbRuntime\.update\(BattleAnimation\.activity\("ren"\)\)/);
 assert.doesNotMatch(game,/renModel=local/);
 assert.doesNotMatch(html,/renGlbBattleFile|renGlbBattleTools/);
});
test("REN-GLB-DEFAULT-002: animated GLB is mapped to existing combat slots",()=>{
 assert.equal(runtime.clipFor("idle"),"Idle_4");
 assert.equal(runtime.clipFor("basic"),"Double_Combo_Attack");
 assert.equal(runtime.clipFor("special"),"Double_Combo_Attack");
 assert.equal(runtime.clipFor("powerful"),"Axe_Spin_Attack");
 assert.equal(runtime.clipFor("guard"),"Idle_4");
 assert.equal(runtime.clipFor("hit"),"Slap_Reaction");
 assert.match(battle,/function activity\(heroId\)/);
 assert.match(battle,/return Object\.freeze\(\{enqueue,clear,tick,pose,activity/);
});
test("REN-GLB-DEFAULT-002: fallback retains gameplay if asset unavailable",()=>{
 const src=read("ren-glb-runtime.js");
 assert.match(game,/RenVisualModel\.create/);
 assert.match(src,/ImportMeshAsync/);
 assert.match(src,/\.catch\(error=>\{/);
 assert.match(src,/oldParts.*isVisible=false/);
 assert.match(src,/mesh\.metadata=.*fighterId:"ren"/);
 assert.doesNotMatch(src,/localStorage|sessionStorage|CombatCore\.|ProgressCore\.|fetch\(/);
});
test("REN-GLB-DEFAULT-002: binary is exactly the previously tested rigged source when shipped",()=>{
 const file=path.join(__dirname,"../assets/ren-animated-v02.glb");
 if(!fs.existsSync(file)){
  assert.fail("REN-GLB-DEFAULT-002 BLOCKED: binary GLB missing; do not merge this PR.");
 }
 const crypto=require("node:crypto");
 const binary=fs.readFileSync(file);
 assert.equal(binary.readUInt32LE(0),0x46546c67);
 assert.equal(binary.readUInt32LE(8),binary.length);
 assert.equal(crypto.createHash("sha256").update(binary).digest("hex"),
  "563766990d2ba4437ff264c2acaa9498d610cc22a268b6d52d4ea464b1fb7b5f");
});
