"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
test("MODELLOAD001: entering roster warms only loader, never downloads heavy GLB",()=>{
 const game=read("game.js");
 const chunk=game.slice(game.indexOf("function showScreen(id){"),game.indexOf('if(id==="playerProfile")renderPlayerProfile();'));
 assert.match(chunk,/if\(id==="collection"\)\{[\s\S]*?RenGlbRuntime\.ensureLoader\(\)\.catch\(\(\)=>\{\}\)/);
 assert.doesNotMatch(chunk,/ImportMeshAsync|fetch\(.+\.glb|preload.*\.glb/);
});
test("MODELLOAD001: card stops empty render loop until model is usable",()=>{
 const card=read("ren-card-3d.js");
 const section=card.slice(card.indexOf("async function activate(heroId){"));
 const setup=section.indexOf("render=()=>");
 const importAt=section.indexOf("ImportMeshAsync");
 const loopAt=section.indexOf("engine.runRenderLoop(render)");
 assert.ok(setup>=0&&importAt>setup&&loopAt>importAt);
 assert.equal((section.match(/engine\.runRenderLoop\(render\)/g)||[]).length,1);
 assert.match(section,/canvas\.dataset\.modelLoaderMs/);
 assert.match(section,/canvas\.dataset\.modelImportMs/);
 assert.match(section,/canvas\.dataset\.modelTotalMs/);
 assert.match(section,/canvas\.dataset\.modelPrepareMs/);
});
