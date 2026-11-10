/* REN-GLB-BATTLE-001: opt-in local GLB visuals for Ren; never touches combat rules.
 * No new save data or server uploads. The existing procedural Ren is the fallback.
 * Test with ?renModel=local and choose the original rigged .glb from the device.
 */
const RenGlbBattle=(()=>{
 "use strict";
 const MAX_BYTES=8*1024*1024;
 const CLIPS=Object.freeze({
  idle:"Ren_Idle_Breathing_3s",
  basic:"Ren_Attack_Unarmed_1p3s",
  special:"Ren_Attack_Unarmed_1p3s",
  powerful:"Ren_Attack_Unarmed_1p3s",
  passive:"Ren_Guard_3s",
  leader:"Ren_Guard_3s",
  guard:"Ren_Guard_3s",
  ward:"Ren_Guard_3s",
  hit:"Ren_Hit_Reaction_0p9s",
  death:"Ren_Hit_Reaction_0p9s"
 });
 function clipFor(slot){return CLIPS[slot]||CLIPS.idle;}
 function enabled(locationLike){
  return /(?:^|[?&])renModel=local(?:&|$)/.test(locationLike?.search||"");
 }
 function validHeader(arrayBuffer,bytes){
  if(!(arrayBuffer instanceof ArrayBuffer)||arrayBuffer.byteLength<12||bytes<20||bytes>MAX_BYTES)return false;
  const v=new DataView(arrayBuffer);
  return v.getUint32(0,true)===0x46546c67&&v.getUint32(4,true)===2&&v.getUint32(8,true)===bytes;
 }
 let loaderPromise=null;
 function ensureLoader(){
  if(typeof window==="undefined")return Promise.reject(Error("Нужен браузер"));
  if(loaderPromise)return loaderPromise;
  loaderPromise=new Promise((resolve,reject)=>{
   if(!window.BABYLON?.SceneLoader)return reject(Error("Babylon.js недоступен"));
   const script=document.createElement("script");
   script.src="https://cdn.babylonjs.com/v9.33.2/loaders/babylonjs.loaders.min.js";
   script.async=true;
   script.onload=resolve;
   script.onerror=()=>reject(Error("Не удалось загрузить модуль GLB"));
   document.head.appendChild(script);
  }).catch(error=>{loaderPromise=null;throw error;});
  return loaderPromise;
 }
 async function load(B,scene,visual,file){
  if(!B?.SceneLoader||!scene||!visual?.body||!file)throw Error("Нет сцены боя или файла");
  if(!/\.glb$/i.test(file.name))throw Error("Выбери файл .glb");
  if(file.size<20||file.size>MAX_BYTES)throw Error("GLB должен быть меньше 8 МБ");
  const header=await file.slice(0,12).arrayBuffer();
  if(!validHeader(header,file.size))throw Error("GLB повреждён или не версии 2.0");
  await ensureLoader();
  const url=URL.createObjectURL(file);
  let result=null,root=null;
  try{
   result=await B.SceneLoader.ImportMeshAsync(null,"",url,scene,undefined,".glb");
   const meshParts=result.meshes.filter(m=>typeof m.getTotalVertices==="function"&&m.getTotalVertices()>0);
   if(!meshParts.length)throw Error("GLB не содержит видимой геометрии");
   const names=result.animationGroups.map(a=>a.name);
   if(!names.includes(CLIPS.idle)||!names.includes(CLIPS.basic))
    throw Error("Нужен именно анимированный GLB Рена v0.2 с клипами Idle и Attack");
   // Record original model geometry before any parenting.
   const oldParts=[...visual.body.getChildMeshes(),...visual.head.getChildMeshes()];
   const topLevel=[...result.meshes,...result.transformNodes].filter(n=>!n.parent);
   root=new B.TransformNode("ren_local_glb_root",scene);
   for(const node of topLevel)node.parent=root;
   // Our GLB is roughly 2m tall, centred at y=0. Body anchor is at y=.8.
   root.parent=visual.body;
   root.position.set(0,.2,0);
   // The source model faces negative Z in its neutral pose.
   root.rotation.set(0,0,0);
   for(const m of result.meshes) m.metadata={...(m.metadata||{}),fighterId:"ren"};
   root.metadata={fighterId:"ren"};
   const rest=result.transformNodes.map(n=>({
    node:n,position:n.position?.clone(),rotationQuaternion:n.rotationQuaternion?.clone(),
    rotation:n.rotation?.clone(),scaling:n.scaling?.clone()
   }));
   const groups=new Map(result.animationGroups.map(g=>[g.name,g]));
   result.animationGroups.forEach(g=>g.stop());
   let lastClip=null;
   const player={
    root,groups,
    update(slot,progress){
     const name=clipFor(slot);
     const group=groups.get(name)||groups.get(CLIPS.idle);
     if(!group)return;
     if(lastClip!==name){
      for(const g of groups.values())g.stop();
      for(const r of rest){
       if(r.position)r.node.position.copyFrom(r.position);
       if(r.rotationQuaternion&&r.node.rotationQuaternion)r.node.rotationQuaternion.copyFrom(r.rotationQuaternion);
       if(r.rotation)r.node.rotation.copyFrom(r.rotation);
       if(r.scaling)r.node.scaling.copyFrom(r.scaling);
      }
      group.start(false,1,group.from,group.to);
      group.pause();
      lastClip=name;
     }
     group.goToFrame(group.from+(group.to-group.from)*Math.max(0,Math.min(1,progress)));
    },
    dispose(){
     result.animationGroups.forEach(g=>g.stop());
     root.dispose(false,true);
     for(const g of result.animationGroups)g.dispose();
     for(const sk of result.skeletons||[])sk.dispose();
     for(const material of result.materials||[])if(material.dispose)material.dispose();
    }
   };
   for(const mesh of oldParts){mesh.isVisible=false;mesh.isPickable=false;}
   return player;
  }catch(error){
   if(root)root.dispose(false,true);
   else if(result){
    for(const m of result.meshes)m.dispose();
    for(const n of result.transformNodes)n.dispose();
   }
   throw error;
  }finally{
   URL.revokeObjectURL(url);
  }
 }
 function mount({B,scene,visual,container,loc}){
  if(!enabled(loc)||!container||!visual?.body)return null;
  const tools=document.getElementById("renGlbBattleTools");
  const input=document.getElementById("renGlbBattleFile");
  const status=document.getElementById("renGlbBattleStatus");
  const reset=document.getElementById("renGlbBattleReset");
  if(!tools||!input||!status||!reset)return null;
  tools.hidden=false;tools.style.display="flex";
  let player=null,busy=false;
  const originalMeshes=[...visual.body.getChildMeshes(),...visual.head.getChildMeshes()];
  const feedback=t=>{status.textContent=t;};
  input.addEventListener("change",async()=>{
   const file=input.files?.[0];
   input.value="";
   if(!file||busy)return;
   busy=true;input.disabled=true;feedback("Загружаю 3D Рена…");
   try{
    const next=await load(B,scene,visual,file);
    if(player)player.dispose();
    player=next;
    reset.disabled=false;
    feedback("Анимированный Рен подключён к этому бою.");
   }catch(error){
    feedback("Ошибка GLB: "+error.message);
    console.warn("REN-GLB-BATTLE-001",error);
    // Restoring the current display is always safe when no GLB is active.
    if(!player)for(const mesh of originalMeshes){mesh.isVisible=true;mesh.isPickable=true;}
   }finally{busy=false;input.disabled=false;}
  });
  reset.addEventListener("click",()=>{
   if(player){player.dispose();player=null;}
   for(const mesh of originalMeshes){mesh.isVisible=true;mesh.isPickable=true;}
   reset.disabled=true;feedback("Возвращена штатная модель Рена.");
  });
  return {
   update(activity){
    if(player&&activity)player.update(activity.slot,activity.progress);
   },
   clear(){
    if(player){player.dispose();player=null;}
    for(const mesh of originalMeshes){mesh.isVisible=true;mesh.isPickable=true;}
   }
  };
 }
 return Object.freeze({enabled,validHeader,clipFor,mount});
})();
if(typeof module!=="undefined")module.exports=RenGlbBattle;
