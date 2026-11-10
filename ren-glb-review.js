/* REN-GLB-REVIEW-002: isolated local-file GLB inspection; gameplay untouched. */
(function(){
"use strict";
const $=id=>document.getElementById(id);
const canvas=$("renderCanvas"),status=$("status"),choose=$("pickGlb");
const originalButton=$("showOriginal"),importedButton=$("showImported");
let engine,scene,camera,reference=null,imported=null,activeUrl=null;
const msg=s=>{status.textContent=s;};
function reset(){
 camera.alpha=-Math.PI/2;
 camera.beta=1.26;
 camera.radius=4.2;
 camera.setTarget(new BABYLON.Vector3(0,1.1,0));
}
function select(which){
 const isImported=which==="imported"&&!!imported;
 if(reference)reference.setEnabled(!isImported);
 if(imported)imported.setEnabled(isImported);
 originalButton.setAttribute("aria-pressed",String(!isImported));
 importedButton.setAttribute("aria-pressed",String(isImported));
}
function disposeImported(){
 if(!imported)return;
 imported.dispose(false,true);
 imported=null;
 importedButton.disabled=true;
}
async function loadFile(file){
 if(!file)return;
 if(!/\.glb$/i.test(file.name)){msg("Нужен файл .glb");return;}
 if(file.size<20||file.size>30*1024*1024){msg("Размер должен быть от 20 байт до 30 МБ");return;}
 const head=await file.slice(0,12).arrayBuffer();
 const v=new DataView(head);
 if(v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||v.getUint32(8,true)!==file.size){
  msg("Файл не прошёл проверку заголовка GLB 2.0 и размера. Скачай его повторно.");
  return;
 }
 choose.disabled=true;msg("Загружаю GLB…");
 let url=null;
 try{
  url=URL.createObjectURL(file);
  const result=await BABYLON.SceneLoader.ImportMeshAsync(null,"",url,scene,undefined,".glb");
  const holder=new BABYLON.TransformNode("uploaded_Ren_GLB",scene);
  const loaded=[...result.meshes,...result.transformNodes];
  for(const n of loaded)if(!n.parent)n.parent=holder;
  for(const m of result.meshes)m.computeWorldMatrix(true);
  let min=new BABYLON.Vector3(Infinity,Infinity,Infinity);
  let max=new BABYLON.Vector3(-Infinity,-Infinity,-Infinity);
  let found=0;
  for(const m of result.meshes){
   if(!m.getTotalVertices||m.getTotalVertices()===0)continue;
   const bounds=m.getBoundingInfo().boundingBox;
   min=BABYLON.Vector3.Minimize(min,bounds.minimumWorld);
   max=BABYLON.Vector3.Maximize(max,bounds.maximumWorld);
   found++;
  }
  if(!found)throw Error("Внутри файла нет отображаемой геометрии");
  const size=max.subtract(min);
  const largest=Math.max(size.x,size.y,size.z);
  if(!Number.isFinite(largest)||largest<=0)throw Error("Некорректные размеры модели");
  const scale=2.12/largest;
  holder.scaling.set(scale,scale,scale);
  const center=min.add(max).scale(.5);
  holder.position.set(-center.x*scale,1.11-center.y*scale,-center.z*scale);
  const previous=imported;
  imported=holder;
  if(previous)previous.dispose(false,true);
  importedButton.disabled=false;
  select("imported");
  reset();
  msg("GLB загружен: "+file.name+" · "+result.meshes.length+" мешей · "+(file.size/1024).toFixed(0)+" КБ. Поворачивай пальцем.");
 }catch(error){
  console.error("REN-GLB-REVIEW-002",error);
  msg("Ошибка импорта GLB: "+(error.message||String(error)));
 }finally{
  if(url)URL.revokeObjectURL(url);
  choose.disabled=false;
 }
}
try{
 if(!window.BABYLON||!window.Ren3DStudio||!BABYLON.SceneLoader)throw Error("Babylon.js и загрузчик GLB недоступны");
 engine=new BABYLON.Engine(canvas,true,{stencil:true});
 scene=new BABYLON.Scene(engine);
 scene.clearColor=new BABYLON.Color4(.10,.12,.12,1);
 camera=new BABYLON.ArcRotateCamera("reviewCam",-Math.PI/2,1.26,4.2,new BABYLON.Vector3(0,1.1,0),scene);
 camera.lowerRadiusLimit=1.5;
 camera.upperRadiusLimit=12;
 camera.attachControl(canvas,true);
 const hemi=new BABYLON.HemisphericLight("fill",new BABYLON.Vector3(0,1,0),scene);
 hemi.intensity=.95;
 const key=new BABYLON.DirectionalLight("key",new BABYLON.Vector3(-.7,-1,-.6),scene);
 key.intensity=1.1;
 reference=Ren3DStudio.create(BABYLON,scene);
 reset();
 scene.render();
 engine.runRenderLoop(()=>{if(!document.hidden)scene.render();});
 window.addEventListener("resize",()=>engine.resize(),{passive:true});
 document.addEventListener("visibilitychange",()=>{if(!document.hidden)engine.resize();});
 choose.addEventListener("change",()=>{const file=choose.files?.[0];void loadFile(file);choose.value="";});
 originalButton.addEventListener("click",()=>{select("original");msg("Показан прежний процедурный макет Рена");});
 importedButton.addEventListener("click",()=>{select("imported");msg("Показана модель из GLB");});
 $("reset").addEventListener("click",reset);
 const dropZone=$("dropZone");
 dropZone.addEventListener("dragover",e=>{e.preventDefault();dropZone.classList.add("dragover");});
 dropZone.addEventListener("dragleave",()=>dropZone.classList.remove("dragover"));
 dropZone.addEventListener("drop",e=>{
  e.preventDefault();dropZone.classList.remove("dragover");
  const file=e.dataTransfer?.files?.[0];
  if(file)void loadFile(file);
 });
 select("original");
 msg("Мастерская готова. Выбери исходный GLB-файл Рена, чтобы открыть его.");
}catch(error){
 console.error(error);
 msg("3D-просмотр недоступен: "+error.message);
}
})();
