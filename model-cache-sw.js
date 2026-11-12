/* CACHE001 — persistent, versioned model-only cache for the browser RPG.
 * Never cache HTML, JS, player data or partial HTTP responses.
 * Bump CACHE_NAME whenever either GLB changes.
 */
"use strict";
const CACHE_PREFIX="ashes-models-";
const CACHE_NAME=CACHE_PREFIX+"ren-59fd4a16_nada-49a695ad_v1";
const MODEL_PATHS=[
 "assets/ren-meshy-mixamo-animated.glb",
 "dev/assets/models/nada-mobile-animated.glb"
];
const MODEL_URLS=MODEL_PATHS.map(path=>new URL(path,self.registration.scope).href);
const inflight=new Map();

function modelUrl(request){
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||url.search||url.hash)return null;
 return MODEL_URLS.includes(url.href)?url.href:null;
}
async function openCache(){return caches.open(CACHE_NAME);}
async function getOrFetch(url){
 const cache=await openCache();
 const hit=await cache.match(url);
 if(hit)return {response:hit,persisted:Promise.resolve(true)};
 if(!inflight.has(url)){
  const pending=(async()=>{
   // Do not block Babylon's download progress on CacheStorage writing the GLB.
   const response=await fetch(url,{cache:"no-store"});
   const persisted=response.ok&&response.type!=="opaque"&&response.status===200
    ?cache.put(url,response.clone()).then(()=>true).catch(error=>{
      console.warn("CACHE001: model not persisted",error);return false;
     })
    :Promise.resolve(false);
   return {response,persisted};
  })();
  inflight.set(url,pending);
  // Share a single network transfer even if Babylon opens the model while
  // background warming is in progress. Every caller gets its own body stream.
  void pending.then(({persisted})=>persisted).catch(()=>{})
   .finally(()=>{if(inflight.get(url)===pending)inflight.delete(url);});
 }
 const {response,persisted}=await inflight.get(url);
 return {response:response.clone(),persisted};
}
self.addEventListener("install",event=>event.waitUntil(self.skipWaiting()));
self.addEventListener("activate",event=>event.waitUntil((async()=>{
 const names=await caches.keys();
 await Promise.all(names.filter(name=>name.startsWith(CACHE_PREFIX)&&name!==CACHE_NAME)
  .map(name=>caches.delete(name)));
 await self.clients.claim();
})()));
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET"||event.request.headers.has("range"))return;
 const url=modelUrl(event.request);
 if(!url)return;
 const task=getOrFetch(url);
 event.respondWith(task.then(item=>item.response).catch(()=>fetch(event.request)));
 event.waitUntil(task.then(item=>item.persisted).catch(()=>{}));
});
self.addEventListener("message",event=>{
 if(event.data?.type!=="CACHE001_WARM")return;
 // The page requests this only after startup and network policy checks.
 const port=event.ports?.[0];
 event.waitUntil((async()=>{
  const results=[];
  for(const url of MODEL_URLS){
   try{
    const existing=await (await openCache()).match(url);
    if(existing){results.push({asset:url.split("/").pop(),status:"cached"});continue;}
    const {response,persisted}=await getOrFetch(url);
    const stored=await persisted;
    results.push({asset:url.split("/").pop(),status:stored?"stored":response.ok?"not-persisted":"http-error"});
   }catch(error){results.push({asset:url.split("/").pop(),status:"unavailable"});}
  }
  port?.postMessage({type:"CACHE001_DONE",results});
 })());
});
