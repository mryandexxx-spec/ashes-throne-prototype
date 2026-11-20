"use strict";
/* ARENA-ENV-006 (experiment): the projected 3D terrace in the real game, flag ?environment=env3d.
 * 1) Battle opens, the environment mesh becomes ready, the 3D frame matches the 2D ENV-005 frame
 *    at the reference shot, and its own cost is measured (draw calls, triangles, texture).
 * 2) Pinch range: radius 6.6 / 10.5 render without errors; fighters stay on the floor y=0.
 * 3) Auto battle to victory, retry -> squad (environment disposed) -> battle again:
 *    scene meshes/materials/textures return to the same numbers, no ENV006 leftovers.
 * 4) Without the flag nothing from ENV006 is created (default ENV-005 2D stays).
 * Local cloud run: ENV006_CHROME=/usr/bin/google-chrome ENV006_BABYLON_LOCAL=1 (Babylon from
 * node_modules via page.route), server: python3 -m http.server 8765.
 * ENV006_SHOTS=dir writes the evidence frames (2D, 2D far, 3D, 3D far) as PNG into dir. */
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
let pw;try{pw=require("playwright");}catch{pw=require("playwright-core");}
const out=path.join(process.cwd(),"artifacts","arena-env-006");
fs.mkdirSync(out,{recursive:true});
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
const useWebkit=process.env.ENV006_BROWSER==="webkit";
const shots=process.env.ENV006_SHOTS||"";
async function routeBabylon(page){
 if(!process.env.ENV006_BABYLON_LOCAL)return;
 const local={
  "/v9.33.2/babylon.js":"node_modules/babylonjs/babylon.js",
  "/v9.33.2/loaders/babylonjs.loaders.min.js":"node_modules/babylonjs-loaders/babylonjs.loaders.min.js"
 };
 await page.route(url=>!/^https?:\/\/127\.0\.0\.1/.test(url.href),route=>{
  const u=new URL(route.request().url()),file=u.hostname==="cdn.babylonjs.com"&&local[u.pathname];
  if(file)return route.fulfill({path:path.join(process.cwd(),file),contentType:"text/javascript"});
  return route.abort();
 });
}
const census=()=>({meshes:scene.meshes.length,materials:scene.materials.length,textures:scene.textures.length,
 env006:scene.meshes.filter(m=>/^env006/.test(m.name)).length+scene.materials.filter(m=>/^env006/.test(m.name)).length+
  scene.textures.filter(t=>/env006/.test(t.name||t.url||"")).length});

async function openBattle(page,query){
 await page.goto(origin+query,{waitUntil:"load",timeout:60000});
 await page.waitForFunction(()=>typeof showScreen==="function"&&typeof BABYLON!=="undefined",null,{timeout:60000});
 await page.locator('#home .hq-bottom button[data-screen="campaign"]').evaluate(el=>el.click());
 await page.locator("#campaignHub").waitFor({state:"visible",timeout:15000});
 await page.locator('[data-campaign-path="training"]').click();
 await page.locator('[data-campaign-mission="black-pass-ambush"]').click();
 await page.locator("#squad").waitFor({state:"visible",timeout:10000});
 await page.locator("#squadDisband").evaluate(el=>el.click());
 for(const id of ["ren","nada","liora","art","sava"])
  await page.locator('#squadRoster [data-hero-id="'+id+'"]').evaluate(el=>el.click());
}
async function start(page,env3d){
 const button=page.locator("#squadStart");await button.click();
 if(await page.locator("#squad").isVisible())await button.click();
 await page.locator("#battle").waitFor({state:"visible",timeout:30000});
 if(env3d)await page.waitForFunction(()=>document.documentElement.dataset.env006==="ready",null,{timeout:60000});
 await page.waitForFunction(()=>npcGlbRuntimes.size===0||[...npcGlbRuntimes.values()].every(r=>r.isReady),null,{timeout:90000});
 await page.waitForTimeout(2500); // hero GLBs settle
}
// Freeze a comparable frame: same camera, no animation, HUD hidden (backdrop + fighters only).
async function still(page,radius,hud){
 await page.evaluate(([radius,hud])=>{
  stopBattleRendering();arenaCamera.radius=radius;
  document.querySelectorAll("#battle .arena-wrap > :not(canvas)").forEach(el=>el.style.visibility=hud?"":"hidden");
  scene.render();positionArenaIndicators();scene.render();
 },[radius,hud]);
}
async function resume(page){
 await page.evaluate(()=>{resetArenaCamera();
  document.querySelectorAll("#battle .arena-wrap > :not(canvas)").forEach(el=>el.style.visibility="");
  startBattleRendering();});
}
(async()=>{
 const type=useWebkit?pw.webkit:pw.chromium;
 const browser=await type.launch(useWebkit?{headless:true}:{headless:true,
  ...(process.env.ENV006_CHROME?{executablePath:process.env.ENV006_CHROME}:{}),
  args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--enable-webgl","--disable-dev-shm-usage"]});
 const ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:1,hasTouch:true});
 const page=await ctx.newPage();
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 const bytes={};
 page.on("response",async r=>{if(/arena-env00[56]|combat-environment-006/.test(r.url()))
  try{bytes[r.url().replace(/^.*\//,"")]=(await r.body()).length;}catch(_){}});
 try{
  await routeBabylon(page);
  // --- 4. Default (no flag): 2D ENV-005, no ENV006 objects. Reference frame for 1).
  await openBattle(page,"");
  await start(page,false);
  const plain=await page.evaluate(()=>({flag:ARENA_ENV006_3D,env:arenaEnv006,c:{meshes:scene.meshes.filter(m=>/^env006/.test(m.name)).length},
   css:getComputedStyle(document.querySelector("#battle .arena-wrap")).backgroundImage.includes("arena-env005-terrace")}));
  assert.equal(plain.flag,false);assert.equal(plain.env,null);assert.equal(plain.c.meshes,0);assert.equal(plain.css,true);
  await still(page,7.6,false);
  const flat2d=await page.screenshot();
  if(shots){
   await still(page,7.6,true);await page.screenshot({path:path.join(shots,"2d-844x390.png")});
   await still(page,10.5,true);await page.screenshot({path:path.join(shots,"2d-844x390-far.png")});
  }
  // ENV-005 finding: transparent WebGL keeps clearColor rgb at alpha 0, and premultiplied
  // compositing ADDS it over the CSS art (+9/+11/+17). Measure against the art without it too.
  await page.evaluate(()=>{scene.clearColor.r=scene.clearColor.g=scene.clearColor.b=0;});
  await still(page,7.6,false);
  const flat2dClean=await page.screenshot();
  // --- 1. Flag on.
  await openBattle(page,"?environment=env3d");
  await start(page,true);
  const first=await page.evaluate(census);
  const info=await page.evaluate(()=>{
   const m=scene.getMeshByName("env006_terrace"),t=m.material.diffuseTexture,size=t.getSize();
   const fighters=Object.values(meshes).filter(v=>v.base?.isEnabled?.()).map(v=>+v.base.position.y.toFixed(3));
   return {state:arenaEnv006.state(),stats:arenaEnv006.stats,pickable:m.isPickable,tex:size,
    env:document.documentElement.dataset.environment,fighters,
    alpha:engine.getCreationOptions?.().alpha??null};
  });
  assert.equal(info.state,"ready");assert.equal(info.pickable,false);assert.equal(info.env,"ENV006-3D");
  assert.ok(info.tex.width<=2048&&info.tex.height<=2048,"texture ≤2048");
  assert.ok(info.stats.triangles<=30000,"≤30k triangles: "+info.stats.triangles);
  assert.ok(info.fighters.every(y=>y<.1),"fighter bases on the floor");
  // Draw calls / active indices of the environment = with minus without (same frame).
  const cost=await page.evaluate(()=>{
   const inst=new BABYLON.SceneInstrumentation(scene);inst.captureDrawCalls=true;
   const sample=()=>{scene.render();inst.drawCallsCounter.fetchNewFrame?.();scene.render();
    return {calls:inst.drawCallsCounter.current,indices:scene.getActiveIndices()};};
   stopBattleRendering();
   const m=scene.getMeshByName("env006_terrace");
   const on=sample();m.setEnabled(false);const off=sample();m.setEnabled(true);
   inst.dispose();startBattleRendering();
   return {calls:on.calls-off.calls,triangles:(on.indices-off.indices)/3,total:on.calls};
  });
  assert.ok(cost.calls>=1&&cost.calls<=30,"draw calls "+cost.calls);
  await still(page,7.6,false);
  const flat3d=await page.screenshot();
  // Reference frame: compare 2D vs 3D (fighters idle in both; differences = poses + resampling).
  const compare=(a,b)=>page.evaluate(async([a,b])=>{
   const load=src=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src="data:image/png;base64,"+src;});
   const [ia,ib]=await Promise.all([load(a),load(b)]);
   const c=document.createElement("canvas");c.width=ia.width;c.height=ia.height;const x=c.getContext("2d");
   x.drawImage(ia,0,0);const da=x.getImageData(0,0,c.width,c.height).data;
   x.drawImage(ib,0,0);const db=x.getImageData(0,0,c.width,c.height).data;
   let sum=0,n=0,big=0;
   for(let i=0;i<da.length;i+=4){const d=(Math.abs(da[i]-db[i])+Math.abs(da[i+1]-db[i+1])+Math.abs(da[i+2]-db[i+2]))/3;sum+=d;n++;if(d>40)big++;}
   return {mean:+(sum/n).toFixed(2),over40:+(big/n*100).toFixed(2)};
  },[a.toString("base64"),b.toString("base64")]);
  const diff={asShipped:await compare(flat2d,flat3d),artOnly:await compare(flat2dClean,flat3d)};
  assert.ok(diff.artOnly.mean<diff.asShipped.mean,"the clear-colour lift explains part of the gap");
  assert.ok(diff.artOnly.mean<10,"3D reference frame ≈ 2D art, mean diff "+diff.artOnly.mean);
  if(shots){await still(page,7.6,true);await page.screenshot({path:path.join(shots,"3d-844x390.png")});}
  // --- 2. Pinch range.
  for(const r of [6.6,10.5]){
   await still(page,r,true);
   if(shots&&r===10.5)await page.screenshot({path:path.join(shots,"3d-844x390-far.png")});
  }
  await resume(page);
  // --- 3. Victory, retry, re-entry without growth.
  await page.locator("#autoSpeedBtn").click();await page.locator("#autoSpeedBtn").click();
  await page.locator("#autoBattleBtn").click();
  await page.locator("#missionResult").waitFor({state:"visible",timeout:180000});
  assert.equal(await page.evaluate(()=>state.winner),"ally");
  await page.locator("#missionResultRetry").click();
  await page.locator("#squad").waitFor({state:"visible",timeout:15000});
  const away=await page.evaluate(census);
  assert.equal(away.env006,0,"environment disposed on leaving the battle");
  assert.equal(await page.evaluate(()=>arenaEnv006),null);
  await start(page,true);
  const second=await page.evaluate(census);
  assert.deepEqual(second,first,"re-entered battle: same meshes/materials/textures");
  await page.locator("#missionResult").waitFor({state:"hidden",timeout:5000}).catch(()=>{});
  assert.deepEqual(errors.filter(e=>/TypeError|ReferenceError|ENV006/.test(e)),[]);
  console.log("ARENAENV006_BROWSER PASS",JSON.stringify({plain,info,cost,diff,first,away,second,bytes}));
 }catch(err){
  await page.screenshot({path:path.join(out,"failure.png")}).catch(()=>{});
  console.error("ARENAENV006_BROWSER FAIL",errors);
  throw err;
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
