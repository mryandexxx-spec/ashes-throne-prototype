"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const client=require("../model-cache-client.js");
test("CACHE002: percentage reflects actual byte counters, bounded without fake timer",()=>{
 assert.equal(client.percent(0,14225032),0);
 assert.equal(client.percent(7112516,14225032),50);
 assert.equal(client.percent(3096808,3096808),100);
 assert.equal(client.percent(-2,3096808),0);
 assert.equal(client.percent(900,0),0);
 assert.equal(client.percent(600,100),100);
 assert.equal(client.percent(Number.NaN,100),0);
});
test("CACHE002: UI reports both characters and cache states without stealing touch",()=>{
 const html=read("index.html"),css=read("styles.css"),source=read("model-cache-client.js");
 for(const id of ["cache002-indicator","cache002-caption","cache002-ren","cache002-nada","cache002-ren-bar","cache002-nada-bar"])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/v0\.3\.139 · RENRETREAT001/);
 assert.match(html,/model-cache-client\.js\?v=0\.3\.139/);
 assert.match(css,/\.hq-screen \.hq-model-cache\{[^}]*pointer-events:none/);
 assert.match(css,/safe-area-inset-left/);
 assert.match(source,/CACHE002_STATUS/);
 assert.match(source,/CACHE002_ASSET/);
 assert.match(source,/CACHE001_WARM/);
 assert.match(source,/"cached"\?"в кеше"/);
 assert.match(source,/"stored"\?"сохранено"/);
});
test("CACHE002: worker reports actual chunk bytes and cache status, scoped to models",()=>{
 const worker=read("model-cache-sw.js");
 // NADAOPT001: progress totals must equal the real GLB sizes.
 const size=f=>fs.statSync(path.join(__dirname,"..",f)).size;
 assert.ok(worker.includes("const MODEL_BYTES=["+size("assets/ren-meshy-mixamo-animated.glb")+","+size("dev/assets/models/nada-mobile-animated.glb")+"]"));
 assert.match(worker,/const \{done,value\}=await reader\.read\(\)/);
 assert.match(worker,/loaded\+=value\.byteLength/);
 assert.match(worker,/CACHE002_ASSET/);
 assert.match(worker,/CACHE002_STATUS_DONE/);
 assert.match(worker,/getOrFetch\(url\)/);
 assert.doesNotMatch(worker,/setInterval|setTimeout|requestAnimationFrame/);
 assert.match(worker,/MODEL_URLS\.includes\(url\.href\)/);
});
