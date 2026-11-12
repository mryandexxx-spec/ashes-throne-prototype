/* CACHE001 — best-effort, model-only persistent caching for returning players.
 * Never downloads large 3D assets synchronously with game startup.
 */
const ModelCache=(()=>{
 "use strict";
 const SW_URL="model-cache-sw.js?v=0.3.130";
 const REFUSE_TYPES=new Set(["slow-2g","2g","3g"]);
 function mayWarm({connection,visible=true}={}){
  return visible&&connection?.saveData!==true&&
   !REFUSE_TYPES.has(connection?.effectiveType)&&connection?.type!=="cellular";
 }
 let started=false;
 function start(){
  if(started||typeof window==="undefined"||!("serviceWorker" in navigator)||
     !window.isSecureContext)return;
  started=true;
  window.addEventListener("load",()=>{
   void navigator.serviceWorker.register(SW_URL).then(async()=>{
    // Service worker claims this page even on its first registration.
    await navigator.serviceWorker.ready;
    const warm=()=>{
     const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
     if(!mayWarm({connection,visible:document.visibilityState==="visible"}))return;
     const controller=navigator.serviceWorker.controller;
     if(!controller)return;
     controller.postMessage({type:"CACHE001_WARM"});
    };
    // Wait until the initial game UI and scripts have finished their work.
    const schedule=()=>{
     if(typeof window.requestIdleCallback==="function")
      window.requestIdleCallback(warm,{timeout:5000});
     else window.setTimeout(warm,1800);
    };
    if(navigator.serviceWorker.controller)schedule();
    else navigator.serviceWorker.addEventListener("controllerchange",schedule,{once:true});
   }).catch(()=>{/* Private browsing or blocked storage: normal GLB loading stays available. */});
  },{once:true});
 }
 return Object.freeze({start,mayWarm});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=ModelCache;
if(typeof window!=="undefined")ModelCache.start();
