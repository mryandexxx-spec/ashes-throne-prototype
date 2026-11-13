"use strict";
// MOBILEQA001: regressions found by Playwright iPhone-landscape QA on 13.11.2026.
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const Stage=require("../arena-stage-view.js");
const Hud=require("../arena-world-hud.js");
const dot=(a,b)=>a.x*b.x+a.z*b.z;
const centre=side=>{const ps=Array.from({length:5},(_,i)=>Stage.formation(side,i,5));
 return {x:ps.reduce((s,p)=>s+p.x,0)/5,z:ps.reduce((s,p)=>s+p.z,0)/5};};

test("MOBILEQA001: enemies are on the allies' screen-right under the arena camera",()=>{
 const a=centre("ally"),e=centre("enemy");
 assert.ok(dot({x:e.x-a.x,z:e.z-a.z},Stage.screenRight)>0);
});
test("MOBILEQA001: resting GLB heroes face the camera three-quarter, toward the opposing lane",()=>{
 for(const side of ["ally","enemy"]){
  const f=Stage.idleFacing(side);
  assert.ok(Math.abs(Math.hypot(f.x,f.z)-1)<1e-9);
  assert.ok(dot(f,Stage.toCamera)>0.2,side+" must not show its back to the camera");
  const lane=dot(f,Stage.screenRight);
  assert.ok(side==="ally"?lane>0.8:lane<-0.8,side+" turned toward opponents");
  // game.js maps body yaw y to body-local +X direction (cos y, -sin y).
  const y=Stage.idleYaw(side);
  assert.ok(Math.abs(Math.cos(y)-f.x)<1e-9&&Math.abs(-Math.sin(y)-f.z)<1e-9);
 }
 assert.throws(()=>Stage.idleYaw("neutral"));
});
test("MOBILEQA001: game.js applies idle facing to Ren and Nada GLB bodies only when not attacking",()=>{
 const g=read("game.js");
 assert.match(g,/ArenaStageView\.idleYaw\(h\.side\)/);
 assert.match(g,/\(h\.id==="ren"&&renGlbRuntime\)\|\|\(h\.id==="nada"&&nadaGlbRuntime\)/);
 assert.match(g,/!\(h\.id==="ren"&&targetPosition&&activity\.plan\)/);
});
test("MOBILEQA001: world HUD packing avoids fixed control rectangles",()=>{
 // Indicator anchored exactly under an "Автобой"-like control at the top right.
 const control={x:480,y:76,w:63,h:44};
 const rows=[{id:"ves",ax:511,ay:150,w:96,h:30},{id:"shade",ax:420,ay:150,w:96,h:30}];
 Hud.pack(rows,734,343,{left:8,right:8,top:8,bottom:8},[control]);
 const hit=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
 for(const r of rows)assert.equal(hit(r,control),false,r.id);
 assert.equal(hit(rows[0],rows[1]),false);
 // Without obstacles the original behaviour is unchanged.
 const plain=[{id:"a",ax:300,ay:200,w:90,h:30}];
 Hud.pack(plain,734,343);
 assert.equal(plain[0].x,255);assert.equal(plain[0].y,162);
});
test("MOBILEQA001: arena layout registers fixed controls as obstacles",()=>{
 const g=read("game.js");
 const m=g.match(/arenaHudLayout\.avoid\?\.\(document\.querySelectorAll\(\s*"([^"]+)"/);
 assert.ok(m,"avoid() call present");
 for(const s of ["#autoBattleBtn","#autoSpeedBtn","#turnChip","#targetFighterHud","#battleMessage",".action-panel"])
  assert.ok(m[1].includes(s),s);
 assert.match(read("arena-world-hud.js"),/measureObstacles\(\)/);
});
test("MOBILEQA001: a new screen opens scrolled to top except the roster return",()=>{
 const g=read("game.js");
 assert.match(g,/previousScreenId!==id&&!restoresRoster[^\n]*\n\s*window\.scrollTo\(0,0\)/);
});
test("MOBILEQA001: landscape CSS keeps message beside the panel, 44px controls and fading cache monitor",()=>{
 const css=read("styles.css");
 const block=css.slice(css.indexOf("/* MOBILEQA001"));
 assert.ok(block.length>0);
 assert.match(block,/\.battle-screen \.battle-message,[\s\S]*?transform:none;[\s\S]*?max-width:calc\(100vw - min\(370px,61vw\)/);
 assert.match(block,/auto-speed-btn\{min-width:44px\}/);
 assert.match(block,/\.hq-screen \.hq-model-cache\{[\s\S]*?top:calc\(env\(safe-area-inset-top,0px\) \+ 50px\);bottom:auto;/);
 assert.match(block,/hq-model-cache\[data-state="ready"\]\{animation:mobileqa001-cache-out \.4s ease 4s forwards\}/);
 assert.match(block,/prefers-reduced-motion/);
});
test("MOBILEQA001: long gear caption gets a soft hyphen only in display",()=>{
 const g=read("game.js");
 assert.match(g,/function gearSlotCaption\(label\)\{return label==="Снаряжение"\?"Снаря&shy;жение":label;\}/);
 assert.match(read("gear-data.js"),/\["utility","Снаряжение"/);
});
test("MOBILEQA001: build marker",()=>{
 const version=JSON.parse(read("package.json")).version;
 assert.match(version,/^\d+\.\d+\.\d+$/);
 assert.ok(read("index.html").includes(`Прототип · v${version} · GEAR013`));
});
test("MOBILEQA001: Ren choreography calibration is measured in the yaw-0 body frame",()=>{
 const r=read("ren-glb-runtime.js");
 assert.match(r,/const savedYaw=visual\.body\.rotation\?visual\.body\.rotation\.y:0;\s*if\(visual\.body\.rotation\)visual\.body\.rotation\.y=0;/);
 assert.ok(r.indexOf("visual.body.rotation.y=savedYaw")>r.indexOf("getAbsolutePosition()"));
});
