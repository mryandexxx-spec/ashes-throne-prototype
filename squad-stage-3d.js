/* SQUAD-RECOVERY-001. Real in-game GLB heroes in one disposable Babylon scene.
 * Does not own the squad state, combat, navigation or saves. Portraits stay as fallbacks.
 * One WebGL context, sequential asset loading, capped 24 FPS; no work offscreen.
 */
const SquadStage3D=(()=>{
 "use strict";
 const $=id=>document.getElementById(id);
 const IDLE=Object.freeze({ren:"Idle_4",nada:"Idle_11",liora:"Idle_02",art:"Idle_5",sava:"Idle"});
 let host=null,screen=null,canvas=null,engine=null,scene=null,camera=null;
 let ro=null,hostObserver=null,screenObserver=null,epoch=0,lastFrame=0;
 let render=null,loadQueue=Promise.resolve(),scheduled=false;
 const models=new Map(),loading=new Set(),failed=new Set();
 const isShown=()=>!!screen?.classList.contains("active")&&!document.hidden;
 const status=text=>{const el=$("squad3dStatus");if(el)el.textContent=text;};
 function asset(id){
  switch(id){
   case "ren":return typeof RenGlbRuntime!=="undefined"?RenGlbRuntime.ASSET_URL:null;
   case "nada":return typeof NadaGlbRuntime!=="undefined"?NadaGlbRuntime.assetUrl():null;
   case "liora":return typeof LioraGlbRuntime!=="undefined"?LioraGlbRuntime.assetUrl():null;
   case "art":return typeof ArtGlbRuntime!=="undefined"?ArtGlbRuntime.assetUrl():null;
   case "sava":return typeof SavaGlbRuntime!=="undefined"?SavaGlbRuntime.assetUrl():null;
   default:return null;
  }
 }
 function slots(){
  return [...(host?.querySelectorAll(".squad-slot[data-model-id]")||[])].map(el=>({
   id:el.dataset.modelId,index:Number(el.dataset.squadIndex),el
  })).filter(x=>IDLE[x.id]&&Number.isInteger(x.index)&&x.index>=0&&x.index<5);
 }
 function size(){
  if(!camera||!engine||!host)return;
  engine.resize();
  const {width,height}=host.getBoundingClientRect();
  const aspect=Math.max(1,width/Math.max(1,height));
  camera.orthoTop=1.47;
  camera.orthoBottom=-1.47;
  camera.orthoLeft=-1.47*aspect;
  camera.orthoRight=1.47*aspect;
  for(const rec of models.values())position(rec);
 }
 function position(rec){
  if(!camera||!rec.holder)return;
  const width=camera.orthoRight-camera.orthoLeft;
  rec.holder.position.x=((rec.index+.5)/5-.5)*width-rec.centerX*rec.scale;
 }
 function clearResult(result){
  if(!result)return;
  for(const group of result.animationGroups||[]){try{group.stop();group.dispose();}catch(_){}}
  for(const node of result.meshes||[]){try{node.dispose(false,true);}catch(_){}}
  for(const node of result.transformNodes||[]){try{node.dispose();}catch(_){}}
 }
 function remove(id){
  const rec=models.get(id);
  if(!rec)return;
  for(const group of rec.groups)try{group.stop();group.dispose();}catch(_){}
  try{rec.holder.dispose(false,true)}catch(_){}
  models.delete(id);
 }
 function dispose(){
  ++epoch;
  for(const id of [...models.keys()])remove(id);
  loading.clear();failed.clear();
  if(engine){
   engine.stopRenderLoop(render);
   scene?.dispose();
   engine.dispose();
  }
  ro?.disconnect();ro=null;
  engine=null;scene=null;camera=null;render=null;lastFrame=0;
  for(const el of host?.querySelectorAll(".squad-slot.squad-model-live")||[])
   el.classList.remove("squad-model-live");
 }
 function ensureCanvas(){
  if(!host)return;
  if(!canvas){
   canvas=document.createElement("canvas");
   canvas.className="squad-stage-canvas";
   canvas.setAttribute("aria-hidden","true");
   canvas.tabIndex=-1;
   canvas.style.pointerEvents="none";
  }
  if(!host.contains(canvas))host.insertBefore(canvas,host.firstChild);
 }
 function create(){
  if(engine)return true;
  if(!isShown()||typeof BABYLON==="undefined"||!BABYLON.Engine){
   status("3D недоступно — показаны портреты");return false;
  }
  ensureCanvas();
  try{
   engine=new BABYLON.Engine(canvas,true,{
    alpha:true,stencil:false,preserveDrawingBuffer:false,powerPreference:"low-power"
   });
   scene=new BABYLON.Scene(engine);
   scene.clearColor=new BABYLON.Color4(0,0,0,0);
   camera=new BABYLON.FreeCamera("squadCamera",new BABYLON.Vector3(0,1.28,9),scene);
   camera.setTarget(new BABYLON.Vector3(0,1.1,0));
   camera.mode=BABYLON.Camera.ORTHOGRAPHIC_CAMERA;
   scene.activeCamera=camera;
   const fill=new BABYLON.HemisphericLight("squadFill",new BABYLON.Vector3(0,1,0),scene);
   fill.intensity=1.15;
   const key=new BABYLON.DirectionalLight("squadKey",new BABYLON.Vector3(-.6,-1,-.8),scene);
   key.intensity=1.1;
   size();
   render=()=>{
    if(!isShown()||!scene)return;
    const now=performance.now();
    if(now-lastFrame<42)return; // <= 24 FPS; no continuous high-FPS mobile load
    lastFrame=now;
    scene.render();
   };
   engine.runRenderLoop(render);
   if(typeof ResizeObserver!=="undefined"){
    ro=new ResizeObserver(()=>size());ro.observe(host);
   }
   return true;
  }catch(error){
   console.warn("SQUAD-RECOVERY: WebGL unavailable",error);
   dispose();status("3D недоступно — показаны портреты");return false;
  }
 }
 async function importHero(id,requestEpoch){
  if(requestEpoch!==epoch||!isShown()||!scene)return;
  const url=asset(id);if(!url){failed.add(id);return;}
  let result=null;
  try{
   if(typeof RenGlbRuntime==="undefined"||!RenGlbRuntime.ensureLoader)
    throw Error("GLB loader not ready");
   await RenGlbRuntime.ensureLoader();
   if(requestEpoch!==epoch||!isShown()||!scene)return;
   const slash=url.lastIndexOf("/");
   result=await BABYLON.SceneLoader.ImportMeshAsync(
    null,url.slice(0,slash+1),url.slice(slash+1),scene,undefined,".glb"
   );
   if(requestEpoch!==epoch||!isShown()||!scene){clearResult(result);return;}
   const target=slots().find(x=>x.id===id);
   if(!target){clearResult(result);return;}
   const parts=result.meshes.filter(mesh=>mesh.getTotalVertices?.()>0);
   if(!parts.length)throw Error("GLB contains no mesh");
   const frame=id==="liora"&&typeof LioraGlbRuntime!=="undefined"
    ?parts.filter(m=>m.name!==LioraGlbRuntime.SHIELD_MESH):parts;
   const holder=new BABYLON.TransformNode("squadHero-"+id,scene);
   for(const node of [...result.meshes,...result.transformNodes])
    if(!node.parent)node.parent=holder;
   let min=new BABYLON.Vector3(Infinity,Infinity,Infinity);
   let max=new BABYLON.Vector3(-Infinity,-Infinity,-Infinity);
   for(const mesh of frame.length?frame:parts){
    mesh.computeWorldMatrix(true);
    const bounds=mesh.getBoundingInfo().boundingBox;
    min=BABYLON.Vector3.Minimize(min,bounds.minimumWorld);
    max=BABYLON.Vector3.Maximize(max,bounds.maximumWorld);
   }
   const extent=max.subtract(min);
   const largest=Math.max(extent.x,extent.y,extent.z);
   if(!Number.isFinite(largest)||largest<=0)throw Error("Invalid GLB bounds");
   const scale=2.24/largest,center=min.add(max).scale(.5);
   holder.scaling.set(scale,scale,scale);
   holder.position.y=1.12-center.y*scale;
   holder.position.z=-center.z*scale;
   const groups=result.animationGroups||[];
   groups.forEach(g=>g.stop());
   const idle=groups.find(g=>g.name===IDLE[id]);
   if(idle&&!window.matchMedia("(prefers-reduced-motion: reduce)").matches)
    idle.start(true,.65);
   const rec={id,index:target.index,holder,groups,centerX:center.x,scale};
   models.set(id,rec);
   position(rec);
   target.el.classList.add("squad-model-live");
   status("Объёмные модели героев");
  }catch(error){
   console.warn("SQUAD-RECOVERY: portrait fallback for "+id,error);
   failed.add(id);
   clearResult(result);
   status("Часть моделей недоступна — показаны портреты");
  }
 }
 function sync(){
  scheduled=false;
  if(!screen||!host)return;
  if(!isShown()){if(engine)dispose();return;}
  ensureCanvas();
  const wanted=slots();
  for(const id of [...models.keys()])if(!wanted.some(x=>x.id===id))remove(id);
  for(const x of wanted){
   const rec=models.get(x.id);
   if(rec){rec.index=x.index;position(rec);x.el.classList.add("squad-model-live");}
  }
  if(!wanted.length){status("Выберите героев");return;}
  if(!create())return;
  const requestEpoch=epoch;
  for(const x of wanted){
   if(models.has(x.id)||loading.has(x.id)||failed.has(x.id))continue;
   loading.add(x.id);
   loadQueue=loadQueue.catch(()=>{}).then(()=>importHero(x.id,requestEpoch))
    .finally(()=>{loading.delete(x.id);if(requestEpoch===epoch)requestSync();});
  }
  if(loading.size)status("Подготовка настоящих 3D-моделей…");
 }
 function requestSync(){
  if(scheduled)return;scheduled=true;
  queueMicrotask(sync);
 }
 function init(){
  screen=$("squad");host=$("squadSlots");
  if(!screen||!host)return;
  hostObserver=new MutationObserver(()=>requestSync());
  hostObserver.observe(host,{childList:true});
  screenObserver=new MutationObserver(()=>requestSync());
  screenObserver.observe(screen,{attributes:true,attributeFilter:["class"]});
  document.addEventListener("visibilitychange",()=>requestSync());
  requestSync();
 }
 if(typeof document!=="undefined"){
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
 }
 return Object.freeze({sync:requestSync,dispose});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=SquadStage3D;
