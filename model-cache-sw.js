/* CACHE001 — persistent, versioned model-only cache for the browser RPG.
 * Never cache HTML, JS, player data or partial HTTP responses.
 * Bump CACHE_NAME whenever either GLB changes.
 */
"use strict";
const CACHE_PREFIX="ashes-models-";
const CACHE_NAME=CACHE_PREFIX+"ren-a15fd00f_nada-49a695ad_v1";
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
// CACHE002: exact downloadable GLB sizes; progress is based on bytes actually
// consumed from the response stream, not a timer or a simulated percentage.
const MODEL_BYTES=[2862860,3096808];
async function reportCacheStatus(port){
 const cache=await openCache();
 const results=[];
 for(let i=0;i<MODEL_URLS.length;i++){
  const stored=!!(await cache.match(MODEL_URLS[i]));
  const asset=MODEL_PATHS[i].split("/").pop();
  const status=stored?"cached":"missing";
  results.push({asset,status});
  port?.postMessage({type:"CACHE002_ASSET",asset,status,loaded:stored?MODEL_BYTES[i]:0,total:MODEL_BYTES[i]});
 }
 port?.postMessage({type:"CACHE002_STATUS_DONE",results});
}
async function warmCache(port){
 const results=[];
 for(let i=0;i<MODEL_URLS.length;i++){
  const url=MODEL_URLS[i],asset=MODEL_PATHS[i].split("/").pop(),total=MODEL_BYTES[i];
  try{
   const existing=await (await openCache()).match(url);
   if(existing){
    results.push({asset,status:"cached"});
    port?.postMessage({type:"CACHE002_ASSET",asset,status:"cached",loaded:total,total});
    continue;
   }
   port?.postMessage({type:"CACHE002_ASSET",asset,status:"downloading",loaded:0,total});
   const {response,persisted}=await getOrFetch(url);
   if(!response.ok||!response.body)throw Error("Model response unavailable");
   // Read a dedicated cloned stream; CacheStorage writes its own clone in
   // parallel. No extra network request, GPU engine or full-file arrayBuffer.
   const reader=response.body.getReader();
   let loaded=0;
   while(true){
    const {done,value}=await reader.read();
    if(done)break;
    loaded+=value.byteLength;
    port?.postMessage({type:"CACHE002_ASSET",asset,status:"downloading",loaded,total});
   }
   port?.postMessage({type:"CACHE002_ASSET",asset,status:"saving",loaded,total});
   const stored=await persisted;
   const status=stored?"stored":"not-persisted";
   results.push({asset,status});
   port?.postMessage({type:"CACHE002_ASSET",asset,status,loaded,total});
  }catch(error){
   results.push({asset,status:"unavailable"});
   port?.postMessage({type:"CACHE002_ASSET",asset,status:"unavailable",loaded:0,total});
  }
 }
 port?.postMessage({type:"CACHE001_DONE",results});
}
self.addEventListener("message",event=>{
 const type=event.data?.type;
 if(type!=="CACHE001_WARM"&&type!=="CACHE002_STATUS")return;
 const port=event.ports?.[0];
 event.waitUntil((type==="CACHE002_STATUS"?reportCacheStatus(port):warmCache(port))
  .catch(()=>port?.postMessage({type:"CACHE002_ERROR"})));
});
