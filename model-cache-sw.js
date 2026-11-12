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
 if(hit)return hit;
 if(inflight.has(url))return inflight.get(url);
 const pending=(async()=>{
  const response=await fetch(url,{cache:"no-store"});
  if(!response.ok||response.type==="opaque"||response.status!==200)return response;
  // CacheStorage can be unavailable or full on private/low-storage iPhones.
  // A cache failure must never prevent the model from loading normally.
  try{await cache.put(url,response.clone());}catch(error){
   console.warn("CACHE001: model not persisted",error);
  }
  return response;
 })();
 inflight.set(url,pending);
 try{return await pending;}finally{inflight.delete(url);}
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
 event.respondWith(getOrFetch(url).catch(()=>fetch(event.request)));
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
    const response=await getOrFetch(url);
    results.push({asset:url.split("/").pop(),status:response.ok?"stored":"http-error"});
   }catch(error){results.push({asset:url.split("/").pop(),status:"unavailable"});}
  }
  port?.postMessage({type:"CACHE001_DONE",results});
 })());
});
