"use strict";
/* ART3D001: failure of an optional Art visual must never stop the arena. */
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const game=fs.readFileSync(path.join(__dirname,"../game.js"),"utf8");
const from=game.indexOf("function ensureArt3D(){");
const to=game.indexOf("function ensureNada3D(){",from);
test("ART3D001: sync failure keeps battle and procedural fighter intact",()=>{
 assert.ok(from>=0&&to>from);
 const status={dataset:{},hidden:true},label={textContent:""};
 let attempts=0;
 const context={
  scene:{id:1},meshes:{art:{body:{isVisible:true},head:{isVisible:true}}},
  presentationFighters:()=>[{id:"art",side:"ally"}],
  ArtGlbRuntime:{create(){attempts++;throw Error("simulated GLB failure");}},
  BABYLON:{},$:id=>id==="#renModelBattleStatus"?status:id==="#renModelBattleStatusText"?label:null,
  console:{warn(){}}
 };
 const api=vm.runInNewContext("let artGlbRuntime=null;let art3dDisabledScene=null;\n"+
  game.slice(from,to)+"\n({ensureArt3D})",context);
 assert.doesNotThrow(()=>api.ensureArt3D());
 assert.equal(attempts,1);
 assert.equal(status.dataset.status,"error");
 assert.equal(status.hidden,false);
 assert.equal(context.meshes.art.body.isVisible,true);
 assert.match(label.textContent,/прост.*модел/);
 api.ensureArt3D();
 assert.equal(attempts,1,"failed model is not retried per frame");
 context.scene={id:2};
 api.ensureArt3D();
 assert.equal(attempts,2,"fresh arena allows a new attempt");
});
