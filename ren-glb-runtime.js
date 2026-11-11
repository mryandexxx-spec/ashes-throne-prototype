/* REN-MESHY-017: Render the supplied static Wanderer as Ren as default,
 * when the production asset is available. Existing procedural Ren is a safe fallback.
 * No gameplay, save or progression changes. One scene loader / one model per Scene.
 */
const RenGlbRuntime=(()=>{
 "use strict";
 const ASSET_URL="assets/ren-meshy-mixamo-animated.glb";
 const CLIPS=Object.freeze({
  idle:"Idle_4", basic:"Double_Combo_Attack", special:"Double_Combo_Attack",
  powerful:"Axe_Spin_Attack", passive:"Idle_4", leader:"Idle_4",
  guard:"Idle_4", ward:"Idle_4", hit:"Slap_Reaction", death:"Dead"
 });
 const clipFor=slot=>CLIPS[slot]||CLIPS.idle;
 // Keep progress stable if browser events intermittently omit total.
 // HEAD runs in parallel with the GLB import, so it does not delay the download.
 const formatMb=bytes=>(bytes/1048576).toLocaleString("ru-RU",{minimumFractionDigits:1,maximumFractionDigits:1})+" МБ";
 function createDownloadTracker(onMessage){
  let loaded=0,total=null,finished=false;
  const emit=()=>{
   if(finished)return;
   let message;
   if(total!==null){
    const received=Math.min(loaded,total);
    message=received>=total
     ?"Файл Рена скачан · "+formatMb(total)+". Подготавливаем 3D…"
     :"Рен: "+formatMb(received)+" из "+formatMb(total)+" ("+Math.floor(received/total*100)+"%)";
   }else{
    message=loaded>0?"Рен: скачано "+formatMb(loaded):"Загружаем Рена…";
   }
   onMessage?.(message);
  };
  return Object.freeze({
   update(event){
    const value=Number(event?.loaded);
    if(!Number.isFinite(value)||value<0||finished)return;
    loaded=Math.max(loaded,value);
    const reported=Number(event?.total);
    if(total===null&&event?.lengthComputable===true&&Number.isFinite(reported)&&reported>0&&reported>=loaded)
     total=reported;
    emit();
   },
   setTotal(bytes){
    if(finished)return;
    const value=Number(bytes);
    if(Number.isFinite(value)&&value>0){total=value;emit();}
   },
   done(){finished=true;}
  });
 }
 // A same-origin HEAD may provide the actual GLB size even if Babylon's progress
 // events have lengthComputable=false. Missing headers are a supported fallback.
 async function probeAssetBytes(){
  if(typeof fetch!=="function")return null;
  try{
   const response=await fetch(ASSET_URL,{method:"HEAD",cache:"force-cache"});
   if(!response.ok)return null;
   const length=Number(response.headers.get("content-length"));
   return Number.isSafeInteger(length)&&length>0?length:null;
  }catch{return null;}
 }
 // Legacy one-shot formatter retained for old callers and unit tests.
 function formatDownloadProgress(event){
  let text=null;
  const tracker=createDownloadTracker(value=>{text=value;});
  tracker.update(event);
  return text;
 }

 // Keep combat animation timing unchanged; loading feedback must not alter it.
 const clipProgress=(slot,progress)=>{
  const p=Math.max(0,Math.min(1,Number.isFinite(progress)?progress:0));
  return slot!=="idle"&&clipFor(slot)===CLIPS.idle?0:p;
 };
 function choreography(activity){
  if(activity?.plan&&activity.slot==="basic"&&typeof RenChoreography!=="undefined")
   return RenChoreography.sample(activity.plan,activity.elapsedMs);
  return {name:clipFor(activity?.slot),progress:clipProgress(activity?.slot,activity?.progress)};
 }
 // Babylon exposes isDisposed as a boolean in v9; never call it as a method.
 const sceneDisposed=scene=>typeof scene?.isDisposed==="function"
  ?scene.isDisposed():scene?.isDisposed===true;
 let loaderPromise=null;
 function ensureLoader(){
  if(typeof window==="undefined"||!window.BABYLON)return Promise.reject(Error("Babylon unavailable"));
  if(typeof window.BABYLON.GLTFFileLoader==="function")return Promise.resolve();
  if(loaderPromise)return loaderPromise;
  loaderPromise=new Promise((resolve,reject)=>{
   const script=document.createElement("script");
   script.src="https://cdn.babylonjs.com/v9.33.2/loaders/babylonjs.loaders.min.js";
   script.async=true;
   script.onload=resolve;
   script.onerror=()=>reject(Error("Babylon GLB loader unavailable"));
   document.head.appendChild(script);
  }).catch(error=>{loaderPromise=null;throw error;});
  return loaderPromise;
 }
 function createRigAnimator(B,nodes){
   const baselines=nodes.map(node=>({
    node,
    position:node.position?.clone(),
    rotation:node.rotation?.clone(),
    rotationQuaternion:node.rotationQuaternion?.clone(),
    scaling:node.scaling?.clone()
   }));
   const restore=()=>{
    for(const b of baselines){
     if(b.position&&b.node.position)b.node.position.copyFrom(b.position);
     if(b.rotation&&b.node.rotation)b.node.rotation.copyFrom(b.rotation);
     if(b.rotationQuaternion&&b.node.rotationQuaternion)b.node.rotationQuaternion.copyFrom(b.rotationQuaternion);
     if(b.scaling&&b.node.scaling)b.node.scaling.copyFrom(b.scaling);
    }
   };
   // Additive local rotations on the supplied rig; no retargeting from the
   // incompatible old 19-bone model. Legs/hips keep their authored bind pose.
   const joints=new Map(baselines.filter(b=>b.rotationQuaternion).map(b=>[b.node.name,b]));
   const turn=(name,x=0,y=0,z=0)=>{
    const b=joints.get(name);
    if(b&&B.Quaternion)b.node.rotationQuaternion.copyFrom(
     b.rotationQuaternion.multiply(B.Quaternion.RotationYawPitchRoll(y,x,z)));
   };
   const skeletalPose=activity=>{
    restore();
    const p=Math.max(0,Math.min(1,activity.progress));
    const pulse=Math.sin(Math.PI*p);
    switch(activity.slot){
     case "idle":{
      const breath=Math.sin(2*Math.PI*p);
      turn("spine",.055*breath);turn("head",-.025*breath);
      turn("shR",.035*breath);turn("shL",.035*breath);
      turn("capeA",.055*breath);break;
     }
     case "basic":case "special":case "powerful":{
      const strength=activity.slot==="powerful"?1.2:1;
      turn("spine",.10*pulse, -.18*pulse*strength);
      turn("shR",-.65*pulse*strength,0,-.10*pulse);
      turn("elR",-.55*pulse);turn("shL",-.18*pulse);
      // Walk cycle during approach/retreat; legs reset before contact and idle.
      const gaitPhase=p<.38?p/.38:p>.64?(p-.64)/.36:0;
      if(p<.38||p>.64){
       const stride=Math.sin(gaitPhase*Math.PI*4)*.32;
       turn("hipR",stride);turn("hipL",-stride);
       turn("kneeR",Math.max(0,-stride)*.48);
       turn("kneeL",Math.max(0,stride)*.48);
      }
      turn("head",-.05*pulse,.10*pulse);turn("capeA",.08*pulse);break;
     }
     case "hit":turn("spine",-.13*pulse);turn("head",.12*pulse);break;
     case "death":turn("spine",.28*p);turn("head",.25*p);break;
     default:
      turn("shR",-.38*pulse);turn("shL",-.38*pulse);
      turn("elR",-.65*pulse);turn("elL",-.65*pulse);
    }
   };
   return skeletalPose;
 }
 async function load(B,scene,visual,onProgress){
  if(!B?.SceneLoader||!visual?.body||!scene)throw Error("Ren scene anchors missing");
  await ensureLoader();
  // Babylon SceneLoader resolves the path relative to this web page.
  const result=await B.SceneLoader.ImportMeshAsync(null,"assets/",ASSET_URL.slice(7),scene,onProgress,".glb");
  let root=null;
  try{
   if(sceneDisposed(scene))throw Error("Scene disposed during import");
   const visible=result.meshes.filter(m=>typeof m.getTotalVertices==="function"&&m.getTotalVertices()>0);
   if(!visible.length)throw Error("No Ren geometry in GLB");
   const groups=new Map(result.animationGroups.map(group=>[group.name,group]));
   root=new B.TransformNode("ren_production_glb",scene);
   const all=[...result.meshes,...result.transformNodes];
   for(const node of all)if(!node.parent)node.parent=root;
   // Normalize actual imported bounds before parenting to the moving combat anchor.
   // Feet rest on the base (y=.14); actor height stays comparable to other heroes.
   let min=new B.Vector3(Infinity,Infinity,Infinity);
   let max=new B.Vector3(-Infinity,-Infinity,-Infinity);
   for(const mesh of visible){
    mesh.computeWorldMatrix(true);
    const box=mesh.getBoundingInfo().boundingBox;
    min=B.Vector3.Minimize(min,box.minimumWorld);
    max=B.Vector3.Maximize(max,box.maximumWorld);
   }
   const height=max.y-min.y;
   if(!Number.isFinite(height)||height<=0)throw Error("Invalid Ren GLB bounds");
   const scale=2.1/height;
   root.scaling.set(scale,scale,scale);
   root.position=new B.Vector3(-(min.x+max.x)*.5*scale,.14-.8-min.y*scale,-(min.z+max.z)*.5*scale);
   // Initial facing is provisional; verify against imported Meshy GLB in WebGL.
   if(root.rotation)root.rotation.y=Math.PI/2;
   root.position.x=-(min.z+max.z)*.5*scale;
   root.position.z=(min.x+max.x)*.5*scale;
   root.parent=visual.body;
   root.metadata={fighterId:"ren"};
   for(const mesh of result.meshes){
    mesh.metadata={...(mesh.metadata||{}),fighterId:"ren"};
    mesh.isPickable=true;
   }
   const restoreImported=createRigAnimator(B,result.transformNodes);
   const groupsList=result.animationGroups;
   groupsList.forEach(g=>g.stop());
   if(!groups.has(CLIPS.idle)||!groups.has(CLIPS.basic)||!groups.has(CLIPS.hit)||!groups.has(CLIPS.death)||!groups.has("Running"))throw Error("Meshy animation clips missing");
   const hips=result.transformNodes.find(n=>n.name==="mixamorig:Hips");
   const hipTrack=groups.get(CLIPS.idle).targetedAnimations.find(a=>a.target===hips&&a.animation.targetProperty==="position");
   const hipReference=hipTrack?.animation.getKeys()[0]?.value.clone();
   if(!hips||!hipReference)throw Error("Meshy Hips translation channel missing");
   if(typeof RenChoreography!=="undefined")RenChoreography.calibrate(scale);
   // Do not hide the fallback until the whole GLB has been validated.
   const oldParts=[...visual.body.getChildMeshes(),...visual.head.getChildMeshes()]
    .filter(mesh=>!result.meshes.includes(mesh));
   for(const mesh of oldParts){mesh.isVisible=false;mesh.isPickable=false;}
   const poses=result.transformNodes.map(node=>({node,p:node.position.clone(),q:node.rotationQuaternion?.clone(),s:node.scaling.clone()}));
   let stopped=false;
   const prepared=new Set();
   function samplePose(name,progress,extract){
    restoreImported({slot:"idle",progress:0});
    const group=groups.get(name)||groups.get(CLIPS.idle);
    if(!prepared.has(group)){
     group.start(false,1,group.from,group.to);group.pause();prepared.add(group);
    }
    group.goToFrame(group.from+(group.to-group.from)*progress);
    if(extract&&name===CLIPS.basic){hips.position.x=hipReference.x;hips.position.z=hipReference.z;}
   }
   if(typeof RenChoreography!=="undefined"){
    // Calibrate against the actual transformed hand at the candidate contact.
    // Existing enemy capsules have radius .42; gameplay collision is unaffected.
    samplePose(CLIPS.basic,RenChoreography.SOURCE.contactFrame/170,true);
    const hand=result.transformNodes.find(n=>n.name==="mixamorig:RightHand");
    if(hand){
     hand.computeWorldMatrix(true);
     const point=hand.getAbsolutePosition(),delta=RenChoreography.rootAt(RenChoreography.SOURCE.contactFrame/60*1000,scale);
     RenChoreography.calibrate(scale,{forward:point.x-visual.body.position.x+delta.forward,lateral:point.z-visual.body.position.z+delta.lateral,y:point.y});
    }
    samplePose(CLIPS.idle,0,false);
   }
   return {
    sampleRaw(name,progress){if(!stopped)samplePose(name,Math.max(0,Math.min(1,progress)),false);},
    update(activity){
     if(stopped||!activity)return;
     const phase=choreography(activity);
     if(!phase.a){samplePose(phase.name,phase.progress,false);return;}
     samplePose(phase.a.name,phase.a.progress,true);
     if(phase.weight>0){
      for(const pose of poses){
       pose.p.copyFrom(pose.node.position);pose.s.copyFrom(pose.node.scaling);
       if(pose.q)pose.q.copyFrom(pose.node.rotationQuaternion);
      }
      samplePose(phase.b.name,phase.b.progress,true);
      for(const pose of poses){
       B.Vector3.LerpToRef(pose.p,pose.node.position,phase.weight,pose.node.position);
       B.Vector3.LerpToRef(pose.s,pose.node.scaling,phase.weight,pose.node.scaling);
       if(pose.q)B.Quaternion.SlerpToRef(pose.q,pose.node.rotationQuaternion,phase.weight,pose.node.rotationQuaternion);
      }
     }
    },
    dispose(){
     if(stopped)return;
     stopped=true;
     for(const group of groupsList){group.stop();group.dispose();}
     root.dispose(false,true);
     for(const sk of result.skeletons||[])sk.dispose();
     for(const mesh of oldParts){mesh.isVisible=true;mesh.isPickable=true;}
    }
   };
  }catch(error){
   if(root)root.dispose(false,true);
   else{
    result.animationGroups.forEach(g=>g.dispose());
    result.meshes.forEach(m=>m.dispose());
    result.transformNodes.forEach(n=>n.dispose());
   }
   throw error;
  }
 }
 function create(B,scene,visual,onStatus){
  let disposed=false,instance=null;
  if(typeof onStatus==="function")onStatus("loading","Загружаю 3D Рена…");
  const tracker=createDownloadTracker(message=>{
   if(!disposed&&typeof onStatus==="function")onStatus("loading",message);
  });
  void probeAssetBytes().then(bytes=>{if(!disposed&&bytes!==null)tracker.setTotal(bytes);});
  const promise=load(B,scene,visual,event=>{if(!disposed)tracker.update(event);}).then(next=>{
   tracker.done();
   if(disposed||sceneDisposed(scene)){next.dispose();return false;}
   instance=next;
   if(typeof onStatus==="function")onStatus("ready","3D Рен загружен");
   return true;
  }).catch(error=>{
   tracker.done();
   // Missing/deleted asset must never prevent a playable combat scene.
   if(!disposed){
    console.warn("REN-MESHY-017: fallback Ren used",error);
    if(typeof onStatus==="function")onStatus("error","3D Рен: ошибка загрузки ("+(error.message||String(error))+")");
   }
   return false;
  });
  return Object.freeze({
   ready:promise,
   get isReady(){return !!instance&&!disposed;},
   update(activity){instance?.update(activity);},
   sampleRaw(name,progress){instance?.sampleRaw(name,progress);},
   dispose(){disposed=true;instance?.dispose();instance=null;}
  });
 }
 return Object.freeze({ASSET_URL,clipFor,clipProgress,formatDownloadProgress,createDownloadTracker,probeAssetBytes,choreography,create,ensureLoader,createRigAnimator});
})();
if(typeof module!=="undefined")module.exports=RenGlbRuntime;
