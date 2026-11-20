"use strict";
// Regression: from the second battle on, fighter shadows turned into light squares.
// clearEncounterNpcVisuals() disposed the NPC base material, which is the one
// ARENA-VIS-001 shadow material shared by every base in the reused scene.
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("fs"),path=require("path");
const ArenaVis001=require("../arena-vis-001.js");

function fakeBabylon(){
 class Material{constructor(name,scene){this.name=name;this.scene=scene;scene.materials.push(this);}
  dispose(){const i=this.scene.materials.indexOf(this);if(i>=0)this.scene.materials.splice(i,1);this.disposed=true;}}
 class Mesh{constructor(name){this.name=name;this.enabled=true;}setEnabled(v){this.enabled=v;}}
 const ctx={clearRect(){},createRadialGradient(){return {addColorStop(){}};},fillRect(){},beginPath(){},arc(){},stroke(){}};
 return {
  StandardMaterial:Material,
  DynamicTexture:class{getContext(){return ctx;}update(){}},
  Color3:class{constructor(r,g,b){Object.assign(this,{r,g,b});}},
  Vector3:class{constructor(x,y,z){Object.assign(this,{x,y,z});}},
  MeshBuilder:{CreateGround:name=>new Mesh(name)}
 };
}

test("ARENA-FIX: shadow materials are flagged as shared",()=>{
 const B=fakeBabylon(),scene={materials:[]};
 const base=ArenaVis001.createBase(B,scene,"b",0,0);
 assert.ok(ArenaVis001.isShared(base.material));
 assert.equal(ArenaVis001.isShared({}),false);
});

test("ARENA-FIX: a base left with a disposed shadow gets a live one back on the next mark",()=>{
 const B=fakeBabylon(),scene={materials:[]};
 const hero=ArenaVis001.createBase(B,scene,"hero",0,0);
 const old=hero.material;
 old.dispose(); // what the old cleanup did after the first battle
 const npc=ArenaVis001.createBase(B,scene,"npc",0,0);
 assert.notEqual(npc.material,old,"no disposed material handed to new bases");
 assert.ok(scene.materials.includes(npc.material));
 ArenaVis001.setMark(hero,null,B,scene);
 assert.equal(hero.material,npc.material);
 ArenaVis001.setMark(hero,"active",B,scene);
 assert.ok(scene.materials.includes(hero.av001Ring.material));
});

test("ARENA-FIX: NPC cleanup in game.js skips shared ARENA-VIS-001 materials",()=>{
 const src=fs.readFileSync(path.join(__dirname,"..","game.js"),"utf8");
 const body=src.slice(src.indexOf("function clearEncounterNpcVisuals"),src.indexOf("function ensureEncounterNpcVisuals"));
 assert.match(body,/filter\(m=>m&&!m\.av001Shared\)/);
});
