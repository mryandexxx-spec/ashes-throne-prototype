/* CACHE002 — visible, truthful background GLB transfer and persistent cache status.
 * The dock is read-only, does not start WebGL and never blocks game startup.
 */
const ModelCache=(()=>{
 "use strict";
 const SW_URL="model-cache-sw.js?v=lioraplay001";
 const REFUSE_TYPES=new Set(["slow-2g","2g","3g"]);
 const HEROES=Object.freeze({
  "ren-meshy-mixamo-animated.glb":"ren",
  "nada-mobile-animated.glb":"nada",
  "liora_vel_shield_aware_15clips.glb":"liora"
 });
 function mayWarm({connection,visible=true}={}){
  return visible&&connection?.saveData!==true&&
   !REFUSE_TYPES.has(connection?.effectiveType)&&connection?.type!=="cellular";
 }
 function percent(loaded,total){
  return Number.isFinite(loaded)&&Number.isFinite(total)&&total>0
   ?Math.max(0,Math.min(100,Math.floor(100*loaded/total))):0;
 }
 let started=false,warmStarted=false,cacheReady=false;
 const current={ren:"pending",nada:"pending",liora:"pending"};
 function update(asset,status,loaded,total){
  const hero=HEROES[asset];
  if(!hero)return;
  const label=typeof document!=="undefined"?document.getElementById("cache002-"+hero):null;
  const bar=typeof document!=="undefined"?document.getElementById("cache002-"+hero+"-bar"):null;
  const state=status==="cached"?"в кеше":status==="stored"?"сохранено":
   status==="downloading"?percent(loaded,total)+"%":
   status==="saving"?"сохраняем…":status==="missing"?"ожидает":
   status==="not-persisted"?"без кеша":status==="unavailable"?"недоступно":"ожидает";
  current[hero]=status;
  if(label)label.textContent=(hero==="ren"?"Рен":hero==="nada"?"Нада":"Лиора")+": "+state;
  if(bar)bar.style.width=(["cached","stored","saving"].includes(status)?100:status==="downloading"?percent(loaded,total):0)+"%";
  const dock=typeof document!=="undefined"?document.getElementById("cache002-indicator"):null;
  if(dock)dock.dataset.state=Object.values(current).every(s=>s==="cached"||s==="stored")?"ready":"active";
 }
 function setMessage(message){
  const target=typeof document!=="undefined"?document.getElementById("cache002-caption"):null;
  if(target)target.textContent=message;
 }
 function talk(controller,type,onComplete){
  if(!controller||typeof MessageChannel==="undefined")return;
  const channel=new MessageChannel();
  channel.port1.onmessage=event=>{
   const data=event.data||{};
   if(data.type==="CACHE002_ASSET")update(data.asset,data.status,data.loaded,data.total);
   if(data.type==="CACHE002_ERROR"){setMessage("Не удалось проверить кеш");channel.port1.close();}
   if(data.type==="CACHE001_DONE"||data.type==="CACHE002_STATUS_DONE"){
    onComplete?.(data.results);
    channel.port1.close();
   }
  };
  controller.postMessage({type},[channel.port2]);
 }
 function start(){
  if(started||typeof window==="undefined")return;
  started=true;
  if(!("serviceWorker" in navigator)||!window.isSecureContext){
   setMessage("Кеш 3D недоступен · загрузка при открытии");
   return;
  }
  window.addEventListener("load",()=>{
   setMessage("Проверяем кеш 3D…");
   void navigator.serviceWorker.register(SW_URL).then(async()=>{
    await navigator.serviceWorker.ready;
    const startWithController=()=>{
     const controller=navigator.serviceWorker.controller;
     if(!controller)return;
     talk(controller,"CACHE002_STATUS",results=>{
      const cached=results?.filter(item=>item.status==="cached").length||0;
      cacheReady=cached===Object.keys(HEROES).length;
      setMessage(cacheReady?"3D готовы · в кеше":"3D · фоновая подготовка");
     });
     const warm=()=>{
      if(warmStarted||cacheReady)return;
      const connection=navigator.connection||navigator.mozConnection||navigator.webkitConnection;
      if(!mayWarm({connection,visible:document.visibilityState==="visible"})){
       setMessage("Фоновая загрузка приостановлена · сеть/экономия");
       return;
      }
      warmStarted=true;
      setMessage("Фоновая загрузка 3D");
      talk(controller,"CACHE001_WARM",results=>{
       const success=results?.filter(item=>["cached","stored"].includes(item.status)).length||0;
       setMessage(success===Object.keys(HEROES).length?"3D готовы · сохранены в кеше":
        "3D · часть файлов не сохранена");
      });
     };
     const schedule=()=>{
      if(typeof window.requestIdleCallback==="function")
       window.requestIdleCallback(warm,{timeout:5000});
      else window.setTimeout(warm,1800);
     };
     schedule();
    };
    const isCurrent=()=>navigator.serviceWorker.controller?.scriptURL===
     new URL(SW_URL,window.location.href).href;
    // Existing visitors may be controlled by CACHE001 during the first
    // CACHE002 visit. Wait for controllerchange instead of messaging the old
    // worker, which cannot report progress or cache status.
    if(isCurrent())startWithController();
    else navigator.serviceWorker.addEventListener("controllerchange",()=>{
     if(isCurrent())startWithController();
    });
   }).catch(()=>setMessage("Кеш недоступен · загрузка при открытии"));
  },{once:true});
 }
 return Object.freeze({start,mayWarm,percent});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=ModelCache;
if(typeof window!=="undefined")ModelCache.start();
