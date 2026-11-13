"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const runtime=require("../ren-glb-runtime.js");
const nadaAssets=require("../dev/src/assets/models.js");

test("NADA-LOAD-002: known manifest bytes show meaningful percentage without HEAD",()=>{
 const messages=[];
 const tracker=runtime.createDownloadTracker(message=>messages.push(message),"Нады");
 tracker.setTotal(nadaAssets.bytes);
 tracker.update({loaded:Math.floor(nadaAssets.bytes/2),lengthComputable:false});
 assert.match(messages.at(-1),/Загружаем Нады: .*50%/);
 tracker.update({loaded:nadaAssets.bytes,lengthComputable:false});
 assert.match(messages.at(-1),/Файл Нады скачан.*Подготавливаем 3D/);
 tracker.done();
 const count=messages.length;
 tracker.update({loaded:nadaAssets.bytes});
 assert.equal(messages.length,count);
});

test("NADA-LOAD-002: Ren progress retains the legacy label",()=>{
 let message="";
 const tracker=runtime.createDownloadTracker(next=>message=next);
 tracker.setTotal(1000);
 tracker.update({loaded:250,lengthComputable:false});
 assert.match(message,/Загружаем Рена: .*25%/);
});

test("NADA-LOAD-002: both card and combat forward real GLB progress events",()=>{
 const card=read("ren-card-3d.js"),nada=read("nada-glb-runtime.js"),game=read("game.js"),html=read("index.html");
 assert.match(card,/tracker\.setTotal\(NadaModelAssets\.bytes\)/);
 assert.doesNotMatch(card,/if\(!isNada&&active&&token===loadingToken\)/);
 assert.match(nada,/ImportMeshAsync\([\s\S]*?scene,onProgress,"\.glb"\)/);
 assert.match(nada,/tracker\?\.update\(event\)/);
 assert.match(game,/nadaGlbRuntime=NadaGlbRuntime\.create[\s\S]*?info\.dataset\.status=kind/);
 for(const name of ["ren-glb-runtime.js","ren-card-3d.js","nada-glb-runtime.js","game.js"])
  assert.ok(html.includes(name+"?v=0.3.145"),name);
});
