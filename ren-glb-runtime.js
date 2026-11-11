/* REN-GLB-DEFAULT-002: Render the supplied static Wanderer as Ren as default,
 * when the production asset is available. Existing procedural Ren is a safe fallback.
 * No gameplay, save or progression changes. One scene loader / one model per Scene.
 */
const RenGlbRuntime=(()=>{
 "use strict";
 const ASSET_URL="assets/ren-wanderer-v1.glb";
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
 const clipFor=slot=>CLIPS[slot]||CLIPS.idle;
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
 async function load(B,scene,visual){
  if(!B?.SceneLoader||!visual?.body||!scene)throw Error("Ren scene anchors missing");
  await ensureLoader();
  // Babylon SceneLoader resolves the path relative to this web page.
  const result=await B.SceneLoader.ImportMeshAsync(null,"assets/",ASSET_URL.slice(7),scene,undefined,".glb");
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
   // Wanderer faces +Z in Babylon; allies attack toward +X.
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
   // Do not hide the fallback until the whole GLB has been validated.
   const oldParts=[...visual.body.getChildMeshes(),...visual.head.getChildMeshes()]
    .filter(mesh=>!result.meshes.includes(mesh));
   for(const mesh of oldParts){mesh.isVisible=false;mesh.isPickable=false;}
   const skeletalPose=createRigAnimator(B,result.transformNodes);
   let lastName=null,stopped=false;
   return {
    update(activity){
     if(stopped||!activity)return;
     const name=clipFor(activity.slot);
     const clip=groups.get(name)||groups.get(CLIPS.idle);
     if(!clip){skeletalPose(activity);return;}
     if(lastName!==name){
      for(const group of groupsList)group.stop();
      restoreImported({slot:"idle",progress:0});
      clip.start(false,1,clip.from,clip.to);
      clip.pause();
      lastName=name;
     }
     // Pose follows the authoritative Combat-005 timeline and battle speed.
     clip.goToFrame(clip.from+(clip.to-clip.from)*Math.max(0,Math.min(1,activity.progress)));
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
  const promise=load(B,scene,visual).then(next=>{
   if(disposed||sceneDisposed(scene)){next.dispose();return false;}
   instance=next;
   if(typeof onStatus==="function")onStatus("ready","3D Рен загружен");
   return true;
  }).catch(error=>{
   // Missing/deleted asset must never prevent a playable combat scene.
   if(!disposed){
    console.warn("REN-GLB-DEFAULT-002: old Ren used as fallback",error);
    if(typeof onStatus==="function")onStatus("error","3D Рен: ошибка загрузки ("+(error.message||String(error))+")");
   }
   return false;
  });
  return Object.freeze({
   ready:promise,
   update(activity){instance?.update(activity);},
   dispose(){disposed=true;instance?.dispose();instance=null;}
  });
 }
 return Object.freeze({ASSET_URL,clipFor,create,ensureLoader,createRigAnimator});
})();
if(typeof module!=="undefined")module.exports=RenGlbRuntime;
