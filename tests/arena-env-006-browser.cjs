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
 * 5) ENV-006B animation: with the clock 2 s apart the leaf/mist/flower zones change, the
 *    fighters' bodies and the rest of the floor do not; under prefers-reduced-motion the
 *    frames are equal and the mask is not downloaded.
 * ENV006_SHOTS=dir writes the evidence frames (2D, 2D far, 3D, 3D far) as PNG into dir,
 * plus anim-NN.png (16 frames, 0.25 s apart, HUD on) and anim-motion.png (where it moves). */
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
 particleSystems:scene.particleSystems.length,
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
// Two frames with the background clock 0 s and 2 s (scene otherwise frozen, HUD hidden) and a
// fighter-body mask (environment, ground shadows and rings hidden, opaque magenta clear).
// Returns per-zone change (% of pixels with diff > 6, mean diff), the max diff on fighter
// bodies (mask eroded by 2 px for anti-aliased edges) and the change outside the zones.
async function measureMotion(page){
 const shot=async t=>{await page.evaluate(t=>arenaEnv006.setClock(t),t);await still(page,7.6,false);return page.screenshot();};
 const a=await shot(0),b=await shot(2);
 // Static identity: the shader with effects off vs the ENV-006 StandardMaterial on the same mesh.
 await page.evaluate(()=>{scene.getMeshByName("env006_terrace").material.setFloat("uOn",0);});
 await still(page,7.6,false);const shaderOff=await page.screenshot();
 await page.evaluate(()=>{
  const mesh=scene.getMeshByName("env006_terrace"),shader=mesh.material;
  const mat=new BABYLON.StandardMaterial("env006b_probe",scene);
  mat.disableLighting=true;mat.emissiveColor=new BABYLON.Color3(1,1,1);mat.specularColor=new BABYLON.Color3(0,0,0);
  mat.fogEnabled=false;mat.backFaceCulling=false;
  const ip=new BABYLON.ImageProcessingConfiguration();ip.toneMappingEnabled=false;ip.contrast=1;ip.exposure=1;ip.vignetteEnabled=false;
  mat.imageProcessingConfiguration=ip;mat.diffuseTexture=shader.getActiveTextures()[0];
  window.__env006bShader=shader;window.__env006bProbe=mat;mesh.material=mat;
 });
 await page.waitForFunction(()=>window.__env006bProbe.isReady(scene.getMeshByName("env006_terrace")),null,{timeout:15000});
 await still(page,7.6,false);const standard=await page.screenshot();
 await page.evaluate(()=>{const mesh=scene.getMeshByName("env006_terrace");mesh.material=window.__env006bShader;
  window.__env006bProbe.dispose();window.__env006bShader.setFloat("uOn",1);delete window.__env006bProbe;delete window.__env006bShader;});
 await page.evaluate(()=>{
  const env=scene.getMeshByName("env006_terrace");env.setEnabled(false);
  const floor=new Set();for(const v of Object.values(meshes)){if(v.base){floor.add(v.base);if(v.base.av001Ring)floor.add(v.base.av001Ring);}}
  window.__env006bHidden=[...floor].filter(m=>m.isEnabled());window.__env006bHidden.forEach(m=>m.setEnabled(false));
  window.__env006bClear=scene.clearColor.clone();scene.clearColor.set(1,0,1,1);scene.render();
 });
 const m=await page.screenshot();
 await page.evaluate(()=>{scene.clearColor.copyFrom(window.__env006bClear);window.__env006bHidden.forEach(m=>m.setEnabled(true));
  scene.getMeshByName("env006_terrace").setEnabled(true);scene.render();});
 const pair=(p,q)=>page.evaluate(async([p,q])=>{
  const load=src=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src="data:image/png;base64,"+src;});
  const [ia,ib]=await Promise.all([load(p),load(q)]);const c=document.createElement("canvas");c.width=ia.width;c.height=ia.height;
  const x=c.getContext("2d");x.drawImage(ia,0,0);const da=x.getImageData(0,0,c.width,c.height).data;x.drawImage(ib,0,0);const db=x.getImageData(0,0,c.width,c.height).data;
  let s=0,n=0,max=0;for(let i=0;i<da.length;i+=4){const d=(Math.abs(da[i]-db[i])+Math.abs(da[i+1]-db[i+1])+Math.abs(da[i+2]-db[i+2]))/3;s+=d;n++;if(d>max)max=d;}
  return {mean:+(s/n).toFixed(3),max:+max.toFixed(1)};},[p.toString("base64"),q.toString("base64")]);
 const identity={shaderOffVsStandard:await pair(shaderOff,standard),animatedT0VsOff:await pair(a,shaderOff)};
 const result=await page.evaluate(async([a,b,m])=>{
  const load=src=>new Promise(r=>{const i=new Image();i.onload=()=>r(i);i.src="data:image/png;base64,"+src;});
  const imgs=await Promise.all([a,b,m].map(load));const W=imgs[0].width,H=imgs[0].height;
  const c=document.createElement("canvas");c.width=W;c.height=H;const x=c.getContext("2d",{willReadFrequently:true});
  const px=imgs.map(i=>{x.drawImage(i,0,0);return x.getImageData(0,0,W,H).data;});
  const body=new Uint8Array(W*H);
  for(let i=0;i<W*H;i++){const r=px[2][i*4],g=px[2][i*4+1],bl=px[2][i*4+2];body[i]=(r>200&&g<60&&bl>200)?0:1;}
  const eroded=new Uint8Array(W*H);
  for(let y=2;y<H-2;y++)for(let xx=2;xx<W-2;xx++){let ok=1;for(let dy=-2;dy<=2&&ok;dy++)for(let dx=-2;dx<=2;dx++)if(!body[(y+dy)*W+xx+dx]){ok=0;break;}eroded[y*W+xx]=ok;}
  const E=CombatEnvironment006,Z=E.ZONES;
  const boxOf=([cx,cy,rx,ry])=>{const p=E.imageToScreen(cx-rx,cy-ry),q=E.imageToScreen(cx+rx,cy+ry);return [p.x,p.y,q.x,q.y];};
  const zones={leaf:[boxOf(Z.leaf.ellipse)],mist:[boxOf(Z.mist.ellipse)],flowers:Z.flowers.map(boxOf)};
  const inZone=(xx,y,list)=>list.some(([x0,y0,x1,y1])=>xx>=x0&&xx<x1&&y>=y0&&y<y1);
  const diff=new Float32Array(W*H);
  for(let i=0;i<W*H;i++){const k=i*4;diff[i]=(Math.abs(px[0][k]-px[1][k])+Math.abs(px[0][k+1]-px[1][k+1])+Math.abs(px[0][k+2]-px[1][k+2]))/3;}
  const stat=pred=>{let n=0,ch=0,sum=0,max=0;for(let y=0;y<H;y++)for(let xx=0;xx<W;xx++){const i=y*W+xx;if(!pred(xx,y,i))continue;
   n++;sum+=diff[i];if(diff[i]>6)ch++;if(diff[i]>max)max=diff[i];}
   return {pixels:n,changed:n?+(ch/n*100).toFixed(2):0,mean:n?+(sum/n).toFixed(2):0,max:+max.toFixed(1)};};
  const all=[...zones.leaf,...zones.mist,...zones.flowers];
  const out={zones:{},fighters:stat((xx,y,i)=>eroded[i]===1),rest:stat((xx,y,i)=>!body[i]&&!inZone(xx,y,all))};
  for(const [k,list] of Object.entries(zones))out.zones[k]=stat((xx,y,i)=>!body[i]&&inZone(xx,y,list));
  // Motion map for the evidence: the 0 s frame, dimmed, with changed pixels in amber.
  const img=x.createImageData(W,H);
  for(let i=0;i<W*H;i++){const k=i*4,d=Math.min(1,diff[i]/24);
   img.data[k]=px[0][k]*.45*(1-d)+255*d;img.data[k+1]=px[0][k+1]*.45*(1-d)+176*d;img.data[k+2]=px[0][k+2]*.45*(1-d)+32*d;img.data[k+3]=255;}
  x.putImageData(img,0,0);out.map=c.toDataURL("image/png").split(",")[1];
  return out;
 },[a.toString("base64"),b.toString("base64"),m.toString("base64")]);
 result.identity=identity;return result;
}
// prefers-reduced-motion: the static ENV-006 frame, no mask download, frames 2 s apart equal.
async function reducedRun(browser){
 const ctx=await browser.newContext({viewport:{width:844,height:390},deviceScaleFactor:1,hasTouch:true,reducedMotion:"reduce"});
 const page=await ctx.newPage();const urls=[];page.on("request",r=>urls.push(r.url()));
 try{
  await routeBabylon(page);
  await openBattle(page,"?environment=env3d");await start(page,true);
  const info=await page.evaluate(()=>({animation:arenaEnv006.animation(),stats:arenaEnv006.stats,
   material:scene.getMeshByName("env006_terrace").material.getClassName()}));
  const shot=async ms=>{await page.evaluate(ms=>{arenaEnv006.tick(ms);arenaEnv006.setClock(ms/1000);},ms);await still(page,7.6,false);return page.screenshot();};
  const a=await shot(0),b=await shot(2000);
  const same=Buffer.compare(a,b)===0;
  return {info,same,mask:urls.some(u=>/arena-env006b-anim-mask/.test(u))};
 }finally{await ctx.close();}
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
   const m=scene.getMeshByName("env006_terrace"),sizes=m.material.getActiveTextures().map(t=>t.getSize());
   const size={width:Math.max(...sizes.map(s=>s.width)),height:Math.max(...sizes.map(s=>s.height))};
   const fighters=Object.values(meshes).filter(v=>v.base?.isEnabled?.()).map(v=>+v.base.position.y.toFixed(3));
   return {state:arenaEnv006.state(),animation:arenaEnv006.animation(),stats:arenaEnv006.stats,pickable:m.isPickable,tex:size,
    textures:sizes.length,material:m.material.getClassName(),
    env:document.documentElement.dataset.environment,fighters,
    alpha:engine.getCreationOptions?.().alpha??null};
  });
  assert.equal(info.state,"ready");assert.equal(info.pickable,false);assert.equal(info.env,"ENV006-3D");
  assert.equal(info.animation,"running");assert.equal(info.material,"ShaderMaterial");assert.equal(info.textures,2);
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
  // --- 5. ENV-006B motion: same frozen scene, only the background clock differs by 2 s.
  const motion=await measureMotion(page);
  if(shots){
   for(let k=0;k<16;k++){
    await page.evaluate(k=>{arenaEnv006.setClock(k*.25);},k);await still(page,7.6,true);
    await page.screenshot({path:path.join(shots,"anim-"+String(k).padStart(2,"0")+".png")});
   }
   fs.writeFileSync(path.join(shots,"anim-motion.png"),Buffer.from(motion.map,"base64"));
  }
  assert.ok(motion.zones.leaf.changed>=5,"leaf shade moves: "+JSON.stringify(motion.zones.leaf));
  assert.ok(motion.zones.mist.changed>=2,"mist drifts: "+JSON.stringify(motion.zones.mist));
  assert.ok(motion.zones.flowers.changed>=2,"flowers sway: "+JSON.stringify(motion.zones.flowers));
  assert.ok(motion.fighters.pixels>3000,"fighter mask found: "+motion.fighters.pixels);
  // Bodies stay still. A handful of anti-aliased/translucent edge pixels left after the 2 px
  // erosion may show the moving shade behind them (CI Chromium: 2 px of ~19.5k, max 8/255);
  // motion reaching a fighter would change tens of percent of the mask.
  assert.ok(motion.fighters.changed<=.1&&motion.fighters.mean<.05,"fighters do not change: "+JSON.stringify(motion.fighters));
  assert.ok(motion.rest.changed<.05,"no motion outside the zones: "+JSON.stringify(motion.rest));
  assert.ok(motion.identity.shaderOffVsStandard.max<=2,"shader with effects off = ENV-006 frame: "+JSON.stringify(motion.identity));
  delete motion.map;
  await page.evaluate(()=>arenaEnv006.setClock(0));
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
  // Budget of the 3D environment with animation (download): projection + mask + module.
  const download=Object.entries(bytes).filter(([k])=>/arena-env006|combat-environment-006/.test(k)).reduce((s,[,v])=>s+v,0);
  assert.ok(bytes["arena-env006b-anim-mask.webp"]>0,"mask downloaded");
  assert.ok(download<=1.5*1024*1024,"download "+download);
  assert.equal(second.particleSystems,first.particleSystems,"no particle systems added");
  const reduced=await reducedRun(browser);
  assert.equal(reduced.info.animation,"reduced");assert.equal(reduced.info.material,"StandardMaterial");
  assert.equal(reduced.mask,false,"reduced motion: mask not downloaded");
  assert.equal(reduced.same,true,"reduced motion: frames 2 s apart are identical");
  console.log("ARENAENV006_BROWSER PASS",JSON.stringify({plain,info,cost,diff,motion,reduced,first,away,second,bytes,download}));
 }catch(err){
  await page.screenshot({path:path.join(out,"failure.png")}).catch(()=>{});
  console.error("ARENAENV006_BROWSER FAIL",errors);
  throw err;
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
