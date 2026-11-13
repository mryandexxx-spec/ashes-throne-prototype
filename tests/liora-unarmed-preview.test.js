"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const page=fs.readFileSync(path.join(root,"liora-lab.html"),"utf8");
const legacy=fs.readFileSync(path.join(root,"liora-shield-lab.html"),"utf8");
const runtime=fs.readFileSync(path.join(root,"liora-shield-lab.js"),"utf8");
const registry=fs.readFileSync(path.join(root,"dev/src/assets/models.js"),"utf8");
test("published and legacy Liora preview routes import no shield code",()=>{
 for(const html of [page,legacy]){
  assert.match(html,/liora-shield-lab\.js/);
  assert.doesNotMatch(html,/<script[^>]+(?:liora-shield-attachment|liora-shield-combat-pose)/);
  assert.doesNotMatch(html,/id="(?:sliders|stabilize|combatCorrection)"/);
  assert.match(html,/без щита/);
 }
});
test("Liora runtime imports only character GLB; shield kept as dormant asset",()=>{
 assert.match(runtime,/load\(LioraModelAssets\.url\)/);
 assert.doesNotMatch(runtime,/LioraShieldAssets|LioraShieldAttachment|LioraShieldCombatPose|attachment\.setClipProgress/);
 assert.match(registry,/liora_vel_shield_aware_15clips\.glb/);
 assert.match(registry,/liora-shield-mobile\.glb/,"preserve separate shield for future developer");
});
