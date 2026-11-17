"use strict";
/* SAVA3D002: failures in an OPTIONAL skinned GLB must not prevent battle. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const game=fs.readFileSync(path.join(__dirname,"../game.js"),"utf8");
const from=game.indexOf("function ensureSava3D(){");
const to=game.indexOf("function ensureNada3D(){",from);
test("SAVA3D002: synchronous Sava loader failure does not abort arena startup",()=>{
 assert.ok(from>=0&&to>from);
 const details={textContent:""},status={dataset:{},hidden:true};
 let attempts=0;
 const context={
  scene:{id:1},meshes:{sava:{body:{isVisible:true},head:{isVisible:true}}},
  presentationFighters:()=>[{id:"sava",side:"ally"}],
  SavaGlbRuntime:{create(){attempts++;throw Error("simulated WebGL import error");}},
  BABYLON:{},$:id=>id==="#renModelBattleStatus"?status:id==="#renModelBattleStatusText"?details:null,
  console:{warn(){}}
 };
 const api=vm.runInNewContext("let savaGlbRuntime=null;let sava3dDisabledScene=null;\n"+
  game.slice(from,to)+"\n({ensureSava3D, disabled:()=>sava3dDisabledScene})",context);
 assert.doesNotThrow(()=>api.ensureSava3D());
 assert.equal(attempts,1);
 assert.equal(context.meshes.sava.body.isVisible,true,"capsule remains intact");
 assert.equal(status.dataset.status,"error");
 assert.equal(status.hidden,false);
 assert.match(details.textContent,/прост.*модел/);
 api.ensureSava3D();
 assert.equal(attempts,1,"do not retry failing GLB every render frame");
 context.scene={id:2};
 api.ensureSava3D();
 assert.equal(attempts,2,"a later arena scene may retry the model");
});
test("SAVA3D002: arena failure banner contains the actual exception",()=>{
 assert.match(game,/const reason=raw\.trim\(\)\.slice\(0,180\)/);
 assert.match(game,/detail\.textContent="Причина: "\+reason/);
 assert.match(game,/notice\.hidden=false/);
 const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
 assert.match(html,/id="battleLoadError"/);
 assert.match(html,/v0\.3\.179 · SAVA3D002/);
});
