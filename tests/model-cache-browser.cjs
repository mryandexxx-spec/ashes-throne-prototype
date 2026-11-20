"use strict";
/* ASSETLOAD001 browser check (replaces the CACHE001/002 five-hero check).
 * 1) Lobby: one bar downloads every asset of asset-manifest.js into CacheStorage
 *    (keys url?rev=sha8), the bar reaches «готовы», nothing intercepts touches.
 * 2) Reload offline: every asset is read back with its exact size (Chromium via the worker,
 *    headless WebKit via CacheStorage — its offline emulation fails before SW interception).
 * 3) Battle on a fresh profile with background warming off (Data Saver): the gate is shown,
 *    lists the fight's heroes/enemies/arena, the percentage only grows, and it closes only when
 *    every model of the fight is in the scene. A second battle opens from the device cache.
 * Local: ASSET_CHROME=/usr/bin/google-chrome ASSET_BABYLON_LOCAL=1 (Babylon from node_modules),
 * server: python3 -m http.server 8765. ASSET_SHOTS=dir saves the gate screenshot.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
let pw;try{pw=require("playwright");}catch{pw=require("playwright-core");}
const HOST=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
const Manifest=require(path.join(__dirname,"..","asset-manifest.js"));
const shots=process.env.ASSET_SHOTS||"";
async function routeBabylon(page){
 if(!process.env.ASSET_BABYLON_LOCAL)return;
 const local={
  "/v9.33.2/babylon.js":"node_modules/babylonjs/babylon.js",
  "/v9.33.2/loaders/babylonjs.loaders.min.js":"node_modules/babylonjs-loaders/babylonjs.loaders.min.js"
 };
 const base=process.env.ASSET_NODE_MODULES_ROOT||process.cwd();
 await page.route(url=>!/^https?:\/\/127\.0\.0\.1/.test(url.href),route=>{
  const u=new URL(route.request().url()),file=u.hostname==="cdn.babylonjs.com"&&local[u.pathname];
  if(file)return route.fulfill({path:path.join(base,file),contentType:"text/javascript"});
  return route.abort();
 });
}
function launchOptions(name){
 if(name==="webkit")return {headless:true};
 return {headless:true,executablePath:process.env.ASSET_CHROME||undefined,
  args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--enable-unsafe-swiftshader","--disable-dev-shm-usage"]};
}
async function lobbyAndCache(name,driver){
 const browser=await driver.launch(launchOptions(name));
 try{
  const context=await browser.newContext({viewport:{width:932,height:430},serviceWorkers:"allow"});
  const page=await context.newPage();
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await routeBabylon(page);
  await page.goto(HOST,{waitUntil:"load"});
  await page.waitForFunction(()=>!!navigator.serviceWorker?.controller,null,{timeout:45000});
  const dock=await page.evaluate(()=>({
   rows:document.querySelectorAll("#assetLoadDock .hq-cache-track").length,
   pointerEvents:getComputedStyle(document.getElementById("assetLoadDock")).pointerEvents,
   overflow:document.documentElement.scrollWidth>window.innerWidth+2}));
  assert.equal(dock.rows,1,"one bar for all assets");
  assert.equal(dock.pointerEvents,"none");
  assert.equal(dock.overflow,false);
  const percents=[];
  const poll=setInterval(()=>{void page.evaluate(()=>AssetLoader.summary().percent).then(p=>percents.push(p)).catch(()=>{});},150);
  await page.waitForFunction(()=>document.getElementById("assetLoadDock").dataset.state==="ready",null,{timeout:180000});
  clearInterval(poll);
  for(let i=1;i<percents.length;i++)assert.ok(percents[i]>=percents[i-1],"lobby bar never goes back");
  const caption=await page.textContent("#assetLoadCaption");
  assert.match(caption,/готовы/);
  const keys=await page.evaluate(async()=>{
   const cache=await caches.open("ashes-assets-v1");
   return (await cache.keys()).map(r=>{const u=new URL(r.url);return u.pathname.slice(1)+u.search;});
  });
  const prefix=new URL(HOST).pathname.slice(1);
  const expected=Manifest.ASSETS.map(a=>prefix+a.url+"?rev="+a.rev).sort();
  assert.deepEqual(keys.sort(),expected,"exactly the manifest, keyed by revision");
  await page.reload({waitUntil:"load"});
  await page.waitForFunction(()=>!!navigator.serviceWorker?.controller);
  await context.setOffline(true);
  const offline=await page.evaluate(async({assets,viaCache})=>{
   const cache=await caches.open("ashes-assets-v1"),out=[];
   for(const a of assets){
    try{
     const r=viaCache?await cache.match(new URL(a.url,location.href).href+"?rev="+a.rev):await fetch(a.url);
     if(!r)throw Error("miss");
     out.push({id:a.id,ok:r.ok,size:(await r.arrayBuffer()).byteLength});
    }catch(e){out.push({id:a.id,error:String(e)});}
   }
   return out;
  },{assets:Manifest.ASSETS,viaCache:name==="webkit"});
  for(const o of offline){
   assert.ok(o.ok,"offline "+JSON.stringify(o));
   assert.equal(o.size,Manifest.get(o.id).bytes,o.id);
  }
  assert.deepEqual(errors,[]);
  console.log("ASSETLOAD001_CACHE="+JSON.stringify({browser:name,cached:keys.length,
   bytes:Manifest.totalBytes(),samples:percents.length}));
 }finally{await browser.close();}
}
// A throttled copy of the site (~3 MB/s for .glb/.webp) so the battle download is observable,
// like a phone on mobile data. Same files, separate origin => a fresh device cache.
function throttledServer(port){
 const http=require("node:http");
 const root=path.join(__dirname,"..");
 const types={".html":"text/html; charset=utf-8",".js":"text/javascript",".css":"text/css",".webp":"image/webp",
  ".glb":"model/gltf-binary",".json":"application/json",".svg":"image/svg+xml",".png":"image/png",".woff2":"font/woff2"};
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,"http://x");
  let file=path.normalize(path.join(root,decodeURIComponent(url.pathname)));
  if(!file.startsWith(root)){res.writeHead(403);return res.end();}
  if(fs.existsSync(file)&&fs.statSync(file).isDirectory())file=path.join(file,"index.html");
  if(!fs.existsSync(file)){res.writeHead(404);return res.end();}
  const ext=path.extname(file),body=fs.readFileSync(file);
  res.writeHead(200,{"Content-Type":types[ext]||"application/octet-stream","Content-Length":body.length,"Cache-Control":"no-store"});
  if(![".glb",".webp"].includes(ext))return res.end(body);
  let at=0;
  const step=()=>{if(at>=body.length)return res.end();const n=Math.min(49152,body.length-at);res.write(body.subarray(at,at+n));at+=n;setTimeout(step,16);};
  step();
 });
 return new Promise(resolve=>server.listen(port,"127.0.0.1",()=>resolve(server)));
}
async function openSquad(page){
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
async function battleGate(name,driver){
 const browser=await driver.launch(launchOptions(name));
 const port=Number(process.env.ASSET_THROTTLE_PORT||8771);
 const server=await throttledServer(port);
 const HOST="http://127.0.0.1:"+port+"/";
 try{
  const context=await browser.newContext({viewport:{width:844,height:390},serviceWorkers:"allow"});
  // Data Saver: lobby does not pre-download, so the battle itself must load everything.
  await context.addInitScript(()=>{
   try{Object.defineProperty(Navigator.prototype,"connection",{configurable:true,get:()=>({saveData:true})});}catch(_){}
  });
  const page=await context.newPage();
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await routeBabylon(page);
  await page.goto(HOST,{waitUntil:"load"});
  await page.waitForFunction(()=>!!navigator.serviceWorker?.controller,null,{timeout:45000});
  assert.equal(await page.evaluate(()=>AssetLoader.summary().done),0,"Data Saver: nothing pre-downloaded");
  await openSquad(page);
  // Record what the gate shows, every frame, from inside the page.
  await page.evaluate(()=>{
   window.__gate=[];
   const tick=()=>{
    const el=document.getElementById("battleAssetGate");
    if(el&&!el.hidden)window.__gate.push({pct:parseInt(document.getElementById("battleAssetGatePercent").textContent,10),
     caption:document.getElementById("battleAssetGateCaption").textContent,
     rows:[...document.querySelectorAll("#battleAssetGateList li")].map(li=>li.textContent),
     npcReady:typeof npcGlbRuntimes!=="undefined"?[...npcGlbRuntimes.values()].filter(r=>r.isReady).length:0});
    requestAnimationFrame(tick);
   };
   requestAnimationFrame(tick);
  });
  const button=page.locator("#squadStart");await button.click();
  if(await page.locator("#squad").isVisible())await button.click();
  await page.locator("#battle").waitFor({state:"visible",timeout:30000});
  await page.waitForFunction(()=>!document.getElementById("battleAssetGate").hidden,null,{timeout:5000});
  if(shots){
   fs.mkdirSync(shots,{recursive:true});
   await page.waitForFunction(()=>window.__gate.some(g=>g.pct>=30),null,{timeout:60000}).catch(()=>{});
   await page.screenshot({path:path.join(shots,"battle-gate-"+name+".png")});
  }
  await page.waitForFunction(()=>document.getElementById("battleAssetGate").hidden,null,{timeout:180000});
  const after=await page.evaluate(()=>({
   gate:window.__gate,
   npc:[...npcGlbRuntimes.values()].map(r=>r.isReady),
   heroes:[renGlbRuntime,nadaGlbRuntime,lioraGlbRuntime,savaGlbRuntime,artGlbRuntime].map(r=>!!r?.isReady),
   summary:AssetLoader.summary()}));
  assert.ok(after.gate.length>3,"gate was visible during the download");
  const rows=after.gate[0].rows.join(" | ");
  for(const label of ["Рен","Нада","Лиора","Арт","Сава"])assert.ok(rows.includes(label),label+" in gate: "+rows);
  assert.ok(after.gate.some(g=>/МБ/.test(g.caption)),"caption shows megabytes");
  for(let i=1;i<after.gate.length;i++)assert.ok(after.gate[i].pct>=after.gate[i-1].pct,"gate never goes back");
  assert.ok(after.npc.length>0&&after.npc.every(Boolean),"enemy models placed before the gate closed");
  assert.ok(after.heroes.every(Boolean),"hero models placed before the gate closed");
  // Second battle: same fight, everything from the device cache.
  await page.evaluate(()=>showScreen("squad"));
  await page.evaluate(()=>{window.__gate=[];});
  const t0=Date.now();
  await button.click();
  if(await page.locator("#squad").isVisible())await button.click();
  await page.locator("#battle").waitFor({state:"visible",timeout:30000});
  await page.waitForFunction(()=>document.getElementById("battleAssetGate").hidden&&
   [...npcGlbRuntimes.values()].every(r=>r.isReady),null,{timeout:60000});
  const second=await page.evaluate(()=>({frames:window.__gate.length,
   statuses:AssetLoader.summary().items.filter(i=>i.status!=="pending").map(i=>i.status)}));
  assert.ok(second.statuses.every(s=>s==="cached"||s==="stored"),JSON.stringify(second.statuses));
  assert.deepEqual(errors,[]);
  console.log("ASSETLOAD001_GATE="+JSON.stringify({browser:name,frames:after.gate.length,
   first:after.gate[0],last:after.gate.at(-1),secondBattleMs:Date.now()-t0,secondGateFrames:second.frames}));
 }finally{await browser.close();server.close();}
}
(async()=>{
 const only=process.env.ASSET_BROWSER;
 for(const [name,driver] of [["chromium",pw.chromium],["webkit",pw.webkit]]){
  if(only&&only!==name)continue;
  await lobbyAndCache(name,driver);
  if(process.env.ASSET_SKIP_BATTLE!=="1")await battleGate(name,driver);
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
