/* ASSETLOAD001 — persistent device cache for every heavy game asset (3D models + arena art).
 * The list lives in asset-manifest.js (generated from the real files). Never caches HTML,
 * JS, player data, third-party or partial (Range) responses.
 * Cache keys carry the file's sha256 prefix (url?rev=xxxxxxxx): a changed GLB gets a new key,
 * old bytes are deleted on activate, and unchanged files survive updates without re-download.
 * History: CACHE001 (persistent hero GLBs), CACHE002 (byte progress) — superseded here.
 */
"use strict";
const SELF_REV=new URL(self.location.href).searchParams.get("rev")||"dev";
importScripts("asset-manifest.js?rev="+encodeURIComponent(SELF_REV));
const CACHE_NAME="ashes-assets-v1";
const LEGACY_PREFIX="ashes-models-"; // CACHE001/002 caches: plain URL keys, hero GLBs only
const SCOPE=self.registration.scope;
const ENTRIES=AssetManifest.ASSETS.map(asset=>{
 const url=new URL(asset.url,SCOPE).href;
 return Object.freeze({...asset,absolute:url,key:url+"?rev="+asset.rev});
});
const BY_URL=new Map(ENTRIES.map(e=>[e.absolute,e]));
const BY_ID=new Map(ENTRIES.map(e=>[e.id,e]));
const inflight=new Map();
const PARALLEL=3;

function entryFor(request){
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||url.search||url.hash)return null;
 return BY_URL.get(url.href)||null;
}
const openCache=()=>caches.open(CACHE_NAME);
async function cached(entry){return (await (await openCache()).match(entry.key))||null;}
// One network transfer per file, shared by Babylon/CSS requests and the loading bar.
async function getOrFetch(entry){
 const hit=await cached(entry);
 if(hit)return {response:hit,persisted:Promise.resolve(true),fromCache:true};
 if(!inflight.has(entry.key)){
  const pending=(async()=>{
   const response=await fetch(entry.absolute,{cache:"no-store"});
   const persisted=response.ok&&response.status===200&&response.type!=="opaque"
    ?openCache().then(cache=>cache.put(entry.key,response.clone())).then(()=>true).catch(error=>{
      console.warn("ASSETLOAD001: not persisted",entry.id,error);return false;
     })
    :Promise.resolve(false);
   return {response,persisted,fromCache:false};
  })();
  inflight.set(entry.key,pending);
  void pending.then(({persisted})=>persisted).catch(()=>{})
   .finally(()=>{if(inflight.get(entry.key)===pending)inflight.delete(entry.key);});
 }
 const item=await inflight.get(entry.key);
 return {...item,response:item.response.clone()};
}
async function sha8(buffer){
 const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",buffer));
 return Array.from(digest.slice(0,4),b=>b.toString(16).padStart(2,"0")).join("");
}
self.addEventListener("install",event=>event.waitUntil(self.skipWaiting()));
self.addEventListener("activate",event=>event.waitUntil((async()=>{
 const current=await openCache();
 const names=await caches.keys();
 // Migrate CACHE001/002 hero GLBs only if their bytes still match the current revision.
 for(const name of names.filter(n=>n.startsWith(LEGACY_PREFIX))){
  const old=await caches.open(name);
  for(const entry of ENTRIES){
   if(await current.match(entry.key))continue;
   const hit=await old.match(entry.absolute);
   if(!hit)continue;
   try{
    const buffer=await hit.clone().arrayBuffer();
    if(buffer.byteLength===entry.bytes&&await sha8(buffer)===entry.rev)
     await current.put(entry.key,new Response(buffer,{status:200,headers:hit.headers}));
   }catch(error){console.warn("ASSETLOAD001: legacy migration skipped",entry.id,error);}
  }
  await caches.delete(name);
 }
 // Drop every key that is not a current asset revision (changed or removed files).
 const valid=new Set(ENTRIES.map(e=>e.key));
 for(const request of await current.keys())if(!valid.has(request.url))await current.delete(request);
 await self.clients.claim();
})()));
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET"||event.request.headers.has("range"))return;
 const entry=entryFor(event.request);
 if(!entry)return;
 const task=getOrFetch(entry);
 event.respondWith(task.then(item=>item.response).catch(()=>fetch(event.request)));
 event.waitUntil(task.then(item=>item.persisted).catch(()=>{}));
});

// Status of the requested ids (default: all). No network.
async function reportStatus(port,ids){
 const items=[];
 for(const entry of select(ids)){
  const status=(await cached(entry))?"cached":"missing";
  items.push({id:entry.id,status,loaded:status==="cached"?entry.bytes:0,total:entry.bytes});
 }
 port?.postMessage({type:"ASSET_STATUS_DONE",items});
}
function select(ids){
 return Array.isArray(ids)&&ids.length?ids.map(id=>BY_ID.get(id)).filter(Boolean):ENTRIES;
}
// Download + store; progress = bytes actually read from the response stream.
async function fetchOne(entry,port){
 const send=(status,loaded)=>port?.postMessage({type:"ASSET_PROGRESS",id:entry.id,status,loaded,total:entry.bytes});
 try{
  const {response,persisted,fromCache}=await getOrFetch(entry);
  if(fromCache){send("cached",entry.bytes);return {id:entry.id,status:"cached"};}
  if(!response.ok||!response.body)throw Error("HTTP "+response.status);
  send("downloading",0);
  const reader=response.body.getReader();
  let loaded=0,lastSent=0;
  for(;;){
   const {done,value}=await reader.read();
   if(done)break;
   loaded+=value.byteLength;
   // ~64 KB granularity keeps the message rate low on slow phones.
   if(loaded-lastSent>=65536){lastSent=loaded;send("downloading",loaded);}
  }
  send("saving",loaded);
  const status=(await persisted)?"stored":"not-persisted";
  send(status,loaded);
  return {id:entry.id,status};
 }catch(error){
  send("error",0);
  return {id:entry.id,status:"error"};
 }
}
async function fetchAll(port,ids){
 const queue=select(ids).slice(),results=[];
 const worker=async()=>{while(queue.length){const entry=queue.shift();results.push(await fetchOne(entry,port));}};
 await Promise.all(Array.from({length:Math.min(PARALLEL,queue.length)},worker));
 port?.postMessage({type:"ASSET_DONE",results});
}
self.addEventListener("message",event=>{
 const type=event.data?.type,ids=event.data?.ids,port=event.ports?.[0];
 if(type!=="ASSET_STATUS"&&type!=="ASSET_FETCH")return;
 event.waitUntil((type==="ASSET_STATUS"?reportStatus(port,ids):fetchAll(port,ids))
  .catch(()=>port?.postMessage({type:"ASSET_ERROR"})));
});
