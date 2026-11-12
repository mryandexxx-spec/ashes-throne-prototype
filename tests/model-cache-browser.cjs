"use strict";
const assert=require("node:assert/strict");
const {chromium,webkit}=require("playwright");
const HOST="http://127.0.0.1:8765/";
const MODEL_PATHS=["assets/ren-meshy-mixamo-animated.glb","dev/assets/models/nada-mobile-animated.glb"];
async function run(browserName,driver){
 const browser=await driver.launch(browserName==="chromium"
  ?{headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-dev-shm-usage"]}
  :{headless:true});
 try{
  const context=await browser.newContext({viewport:{width:932,height:430},serviceWorkers:"allow"});
  const page=await context.newPage();
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto(HOST,{waitUntil:"load"});
  await page.waitForFunction(()=>!!navigator.serviceWorker?.controller,null,{timeout:45000});
  await page.waitForFunction(()=>document.getElementById("cache002-indicator")!==null);
  const dock=await page.evaluate(()=>({
   ren:document.getElementById("cache002-ren")?.textContent,
   nada:document.getElementById("cache002-nada")?.textContent,
   pointerEvents:getComputedStyle(document.getElementById("cache002-indicator")).pointerEvents,
   overflow:document.documentElement.scrollWidth>window.innerWidth+2
  }));
  assert.match(dock.ren,/Рен/);
  assert.match(dock.nada,/Нада/);
  assert.equal(dock.pointerEvents,"none");
  assert.equal(dock.overflow,false);
  const cached=await page.evaluate(async()=>{
   const channel=new MessageChannel();
   const progress=[];
   const complete=new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(Error("model warmup timed out")),90000);
    channel.port1.onmessage=event=>{
     if(event.data?.type==="CACHE002_ASSET")progress.push(event.data);
     if(event.data?.type==="CACHE001_DONE"||event.data?.type==="CACHE002_ERROR"){
      clearTimeout(timeout);resolve(event.data);
     }
    };
   });
   navigator.serviceWorker.controller.postMessage({type:"CACHE001_WARM"},[channel.port2]);
   const result=await complete;
   const keys=await caches.keys();
   const cacheName=keys.find(n=>n.startsWith("ashes-models-"));
   const cache=await caches.open(cacheName);
   const urls=await cache.keys();
   return {result,progress,cacheName,urls:urls.map(r=>new URL(r.url).pathname)};
  });
  assert.equal(cached.result?.type,"CACHE001_DONE");
  assert.ok(cached.progress.length>=2,"SW must send per-character progress/cache reports");
  assert.ok(cached.progress.some(x=>x.asset==="ren-meshy-mixamo-animated.glb"));
  assert.ok(cached.progress.some(x=>x.asset==="nada-mobile-animated.glb"));
  assert.ok(cached.progress.every(x=>x.type==="CACHE002_ASSET"));
  assert.ok(cached.progress.some(x=>x.status==="cached"||x.status==="stored"),
   "SW must confirm persistent cache when warmup completes");
  assert.ok(cached.cacheName,"missing persistent model cache");
  assert.equal(cached.urls.length,2,"only two model files may be cached");
  assert.ok(cached.result.results.every(e=>e.status==="stored"||e.status==="cached"),
   JSON.stringify(cached.result.results));
  for(const path of MODEL_PATHS)assert.ok(cached.urls.some(p=>p.endsWith("/"+path)));
  // Second page visit: CacheStorage must persist beyond the first page.
  await page.reload({waitUntil:"load"});
  await page.waitForFunction(()=>!!navigator.serviceWorker?.controller);
  // An intentionally disconnected browser must still read the persisted bytes.
  // Chromium proves the full Service Worker fetch path offline. Playwright's
  // headless WebKit offline emulation can reject fetch before SW interception,
  // so for WebKit independently verify the persisted CacheStorage response.
  await context.setOffline(true);
  const offline=await page.evaluate(async({paths,viaCache})=>{
   const results=[];
   const cacheName=(await caches.keys()).find(name=>name.startsWith("ashes-models-"));
   const cache=viaCache?await caches.open(cacheName):null;
   for(const path of paths){
    try{
     const response=viaCache?await cache.match(new URL(path,location.href).href):await fetch(path);
     if(!response)throw Error("cache miss");
     const content=await response.arrayBuffer();
     const header=String.fromCharCode(...new Uint8Array(content,0,4));
     results.push({path,ok:response.ok,size:content.byteLength,header});
    }catch(e){results.push({path,error:String(e)});}
   }
   return results;
  },{paths:MODEL_PATHS,viaCache:browserName==="webkit"});
  for(const item of offline){
   assert.ok(item.ok,"uncached GLB offline "+JSON.stringify(item));
   assert.equal(item.header,"glTF");
   assert.ok(item.size>3000000);
  }
  assert.deepEqual(errors,[]);
  console.log("CACHE001_BROWSER="+JSON.stringify({browser:browserName,cached:cached.urls.length,
   offlineMode:browserName==="webkit"?"CacheStorage direct (headless WebKit)":"service worker fetch",
   offline:offline.map(x=>({path:x.path,size:x.size}))}));
 }finally{await browser.close();}
}
(async()=>{await run("chromium",chromium);await run("webkit",webkit);})()
 .catch(error=>{console.error(error);process.exitCode=1;});
