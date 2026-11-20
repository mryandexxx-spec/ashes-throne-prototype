/* ASSETLOAD001 — one loader for all heavy game assets (asset-manifest.js) with a single,
 * truthful progress bar and persistent device cache through model-cache-sw.js.
 * - Lobby: one compact bar «3D-ресурсы» downloads everything in the background.
 * - Battle: game.js asks for the files this fight needs and shows the battle gate.
 * Progress = bytes actually read from the response stream; no timers, no fake percents.
 * Without a service worker (insecure context, old browser) the page fetches directly and
 * still writes the bytes into the same CacheStorage keys the worker serves later.
 */
const AssetLoader=(()=>{
 "use strict";
 const manifest=()=>typeof AssetManifest!=="undefined"?AssetManifest:null;
 const SW_BASE="model-cache-sw.js";
 const CACHE_NAME="ashes-assets-v1";
 const REFUSE_TYPES=new Set(["slow-2g","2g"]);
 const DONE=new Set(["cached","stored","not-persisted","error"]);
 const OK=new Set(["cached","stored","not-persisted"]);
 // Background warming respects Data Saver and very slow links; a battle download never waits for it.
 function mayWarm({connection,visible=true}={}){
  return visible&&connection?.saveData!==true&&!REFUSE_TYPES.has(connection?.effectiveType);
 }
 function percent(loaded,total){
  return Number.isFinite(loaded)&&Number.isFinite(total)&&total>0
   ?Math.max(0,Math.min(100,Math.floor(100*loaded/total))):0;
 }
 function formatMB(bytes){
  const mb=Math.max(0,bytes||0)/1048576;
  return (mb>=10?mb.toFixed(0):mb.toFixed(1)).replace(".",",");
 }
 const state=new Map(); // id -> {status,loaded,total}
 const listeners=new Set();
 function item(id){
  const asset=manifest()?.get(id);
  if(!state.has(id))state.set(id,{status:"pending",loaded:0,total:asset?.bytes||0});
  return state.get(id);
 }
 function set(id,status,loaded,total){
  if(!manifest()?.get(id))return;
  const it=item(id);
  // A finished file never goes back to "downloading" because a second request reported late.
  if(OK.has(it.status)&&!OK.has(status))return;
  it.status=status;
  if(Number.isFinite(total)&&total>0)it.total=total;
  it.loaded=OK.has(status)?it.total:Math.max(0,Math.min(it.total,Number(loaded)||0));
  notify();
 }
 let notifyQueued=false;
 function notify(){
  if(notifyQueued)return;
  notifyQueued=true;
  const run=()=>{notifyQueued=false;for(const fn of listeners){try{fn();}catch(error){console.warn(error);}}};
  if(typeof queueMicrotask==="function")queueMicrotask(run);else Promise.resolve().then(run);
 }
 function subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);}
 // Totals for a set of ids (default: all). Each file counts once.
 function summary(ids){
  const list=[...new Set(ids&&ids.length?ids:(manifest()?.ASSETS||[]).map(a=>a.id))]
   .filter(id=>manifest()?.get(id));
  let loaded=0,total=0,done=0,failed=0;
  const items=list.map(id=>{
   const it=item(id),asset=manifest().get(id);
   loaded+=it.loaded;total+=it.total;
   if(DONE.has(it.status))done++;
   if(it.status==="error")failed++;
   return {id,label:asset.label,kind:asset.kind,status:it.status,loaded:it.loaded,total:it.total};
  });
  return {items,loaded,total,done,failed,count:list.length,complete:done===list.length,
   percent:percent(loaded,total)};
 }

 // ---- service worker plumbing -------------------------------------------------------
 let controllerPromise=null;
 const swUrl=()=>SW_BASE+"?rev="+(manifest()?.REVISION||"dev");
 function swSupported(){
  return typeof window!=="undefined"&&typeof navigator!=="undefined"&&
   "serviceWorker" in navigator&&window.isSecureContext===true;
 }
 function isCurrent(controller){
  try{return !!controller&&controller.scriptURL===new URL(swUrl(),window.location.href).href;}
  catch(_){return false;}
 }
 // Resolves the controlling worker of THIS revision, or null (→ direct fetch fallback).
 function controller(timeout=4000){
  if(!swSupported())return Promise.resolve(null);
  if(!controllerPromise){
   controllerPromise=navigator.serviceWorker.register(swUrl()).then(()=>navigator.serviceWorker.ready)
    .catch(error=>{console.warn("ASSETLOAD001: service worker unavailable",error);return null;});
   // Ask the browser not to evict our cache under storage pressure (Safari ≥ 15.2, Chromium).
   try{void navigator.storage?.persist?.().catch(()=>{});}catch(_){}
  }
  return controllerPromise.then(reg=>{
   if(!reg)return null;
   if(isCurrent(navigator.serviceWorker.controller))return navigator.serviceWorker.controller;
   return new Promise(resolve=>{
    const timer=setTimeout(()=>{navigator.serviceWorker.removeEventListener("controllerchange",check);resolve(null);},timeout);
    function check(){
     if(!isCurrent(navigator.serviceWorker.controller))return;
     clearTimeout(timer);navigator.serviceWorker.removeEventListener("controllerchange",check);
     resolve(navigator.serviceWorker.controller);
    }
    navigator.serviceWorker.addEventListener("controllerchange",check);
   });
  });
 }
 function talk(worker,message,onMessage){
  return new Promise(resolve=>{
   const channel=new MessageChannel();
   channel.port1.onmessage=event=>{
    const data=event.data||{};
    const finished=onMessage(data);
    if(finished||data.type==="ASSET_ERROR"){channel.port1.close();resolve(data);}
   };
   worker.postMessage(message,[channel.port2]);
  });
 }
 // ---- direct fallback (no worker): same cache keys, real stream progress ----------------
 async function directOne(id){
  const asset=manifest().get(id);
  const key=new URL(asset.url,window.location.href).href+"?rev="+asset.rev;
  let cache=null;
  try{cache=typeof caches!=="undefined"?await caches.open(CACHE_NAME):null;}catch(_){cache=null;}
  try{
   if(cache&&await cache.match(key)){set(id,"cached");return;}
   set(id,"downloading",0);
   const response=await fetch(asset.url);
   if(!response.ok||!response.body)throw Error("HTTP "+response.status);
   const reader=response.clone().body.getReader();
   let loaded=0;
   for(;;){const {done,value}=await reader.read();if(done)break;loaded+=value.byteLength;set(id,"downloading",loaded);}
   let stored=false;
   if(cache){try{await cache.put(key,response);stored=true;}catch(_){stored=false;}}
   set(id,stored?"stored":"not-persisted");
  }catch(error){set(id,"error");}
 }
 const running=new Map(); // id -> promise (one download per file per page)
 function load(ids){
  const wanted=[...new Set(ids&&ids.length?ids:(manifest()?.ASSETS||[]).map(a=>a.id))]
   .filter(id=>manifest()?.get(id));
  // A file queued (not yet started) in another batch is requested again so the battle gets it
  // now; the worker shares one network transfer per file, so nothing downloads twice.
  const fresh=wanted.filter(id=>!OK.has(item(id).status)&&
   !(running.has(id)&&["downloading","saving"].includes(item(id).status)));
  if(fresh.length){
   const batch=controller().then(worker=>{
    if(worker)return talk(worker,{type:"ASSET_FETCH",ids:fresh},data=>{
     if(data.type==="ASSET_PROGRESS")set(data.id,data.status,data.loaded,data.total);
     return data.type==="ASSET_DONE";
    });
    // Fallback: two at a time.
    const queue=fresh.slice();
    const lane=async()=>{while(queue.length)await directOne(queue.shift());};
    return Promise.all([lane(),lane()]);
   }).catch(()=>{for(const id of fresh)if(!DONE.has(item(id).status))set(id,"error");})
    .finally(()=>{for(const id of fresh)if(running.get(id)===batch)running.delete(id);});
   for(const id of fresh)running.set(id,batch);
  }
  return Promise.all(wanted.map(id=>running.get(id)||Promise.resolve()))
   .then(()=>summary(wanted));
 }
 function refreshStatus(ids){
  return controller().then(worker=>{
   if(!worker)return null;
   return talk(worker,{type:"ASSET_STATUS",ids},data=>{
    if(data.type!=="ASSET_STATUS_DONE")return false;
    for(const it of data.items||[])if(it.status==="cached")set(it.id,"cached");
    return true;
   });
  }).catch(()=>null);
 }

 // ---- lobby dock: one bar for the whole set ----------------------------------------------
 function renderDock(){
  if(typeof document==="undefined")return;
  const dock=document.getElementById("assetLoadDock");
  if(!dock)return;
  const s=summary();
  const caption=document.getElementById("assetLoadCaption"),bar=document.getElementById("assetLoadBar"),
   detail=document.getElementById("assetLoadDetail");
  const active=s.items.filter(i=>i.status==="downloading"||i.status==="saving").map(i=>i.label);
  const left=s.count-s.done;
  if(bar)bar.style.width=s.percent+"%";
  if(s.complete){
   dock.dataset.state=s.failed?"partial":"ready";
   if(caption)caption.textContent=s.failed?"3D-ресурсы · не загружено: "+s.failed:"3D-ресурсы готовы · сохранены на устройстве";
   if(detail)detail.textContent=formatMB(s.total)+" МБ · "+s.count+" файлов";
  }else{
   dock.dataset.state="active";
   if(caption)caption.textContent="3D-ресурсы · "+s.percent+"%";
   if(detail)detail.textContent=formatMB(s.loaded)+" из "+formatMB(s.total)+" МБ · осталось "+left+
    (active.length?" · сейчас: "+active.slice(0,2).join(", "):"");
  }
 }
 let started=false;
 function start(){
  if(started||typeof window==="undefined")return;
  started=true;
  subscribe(renderDock);
  window.addEventListener("load",()=>{
   renderDock();
   void refreshStatus().then(()=>{
    renderDock();
    if(summary().complete)return;
    const warm=()=>{
     const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
     if(!mayWarm({connection,visible:document.visibilityState==="visible"})){
      const caption=document.getElementById("assetLoadCaption");
      if(caption)caption.textContent="3D-ресурсы · загрузятся перед боем (экономия трафика)";
      return;
     }
     void load();
    };
    if(typeof window.requestIdleCallback==="function")window.requestIdleCallback(warm,{timeout:3000});
    else window.setTimeout(warm,1200);
   });
  },{once:true});
 }
 return Object.freeze({start,load,summary,subscribe,refreshStatus,mayWarm,percent,formatMB,
  isDone:status=>DONE.has(status),isOk:status=>OK.has(status)});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=AssetLoader;
if(typeof window!=="undefined"&&typeof document!=="undefined")AssetLoader.start();
