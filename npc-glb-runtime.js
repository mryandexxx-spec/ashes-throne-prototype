/* ARENA-ART-004C — on-demand skinned enemy models in combat. No gameplay ownership.
 * One runtime for every humanoid enemy archetype: url, bytes and clips per slot come
 * from NpcModelAssets.models[archetypeId] (dev/src/assets/npc-models.js, generated).
 * Same contract as NadaGlbRuntime: create(...) -> {ready,isReady,update,dispose}.
 * No manifest entry (sarkh until ARENA-ART-004E) or any load error -> capsule stays.
 * Never throw into battle flow.
 */
const NpcGlbRuntime=(()=>{
 "use strict";
 const SLOTS=Object.freeze(["idle","basic","special","powerful","guard","ward","hit","death","run","walk"]);
 // Slots that must exist in the GLB before the capsule is hidden.
 const REQUIRED=Object.freeze(["idle","basic","special","powerful","guard","ward","hit","death"]);
 // Fighter height in world units, same as the hero GLBs. Scale versus heroes: ARENA-ART-004D.
 const HEIGHT=2.1;
 const manifest=()=>typeof NpcModelAssets!=="undefined"?NpcModelAssets:null;
 const entry=archetypeId=>{
  const models=manifest()?.models;
  return typeof archetypeId==="string"&&models&&Object.prototype.hasOwnProperty.call(models,archetypeId)
   ?models[archetypeId]:null;
 };
 const has=archetypeId=>!!entry(archetypeId)?.url;
 // CLIPS[archetypeId][slot] — read straight from the generated manifest.
 const CLIPS=Object.freeze(Object.fromEntries(Object.entries(manifest()?.models||{})
  .map(([id,model])=>[id,model.clips])));
 // Part of a clip shown for a slot, as fractions of the clip length, keyed by clip name
 // because the same clip serves several archetypes. Measured windows: ARENA-ART-004D.
 const WINDOWS=Object.freeze({});
 const clipFor=(archetypeId,slot)=>{
  const clips=entry(archetypeId)?.clips;
  return clips?.[slot]||clips?.idle||null;
 };
 const windowFor=(archetypeId,slot)=>WINDOWS[clipFor(archetypeId,slot)]?.[slot]||[0,1];
 const assetUrl=archetypeId=>entry(archetypeId)?.url||null;
 const sceneDisposed=scene=>typeof scene?.isDisposed==="function"
  ?scene.isDisposed():scene?.isDisposed===true;
 const clamp=p=>Math.max(0,Math.min(1,Number.isFinite(p)?p:0));
 async function ensureLoader(){
  if(typeof RenGlbRuntime==="undefined"||!RenGlbRuntime.ensureLoader)
   throw Error("Babylon GLB loader unavailable");
  return RenGlbRuntime.ensureLoader();
 }
 function cleanup(result,root){
  try{
   for(const group of result.animationGroups||[]){group.stop();group.dispose();}
   if(root)root.dispose(false,true);
   else for(const mesh of result.meshes||[])mesh.dispose(false,true);
   for(const skeleton of result.skeletons||[])skeleton.dispose();
   if(!root)for(const node of result.transformNodes||[])node.dispose();
  }catch(error){console.warn("NPC GLB cleanup",error);}
 }
 async function load(B,scene,visual,archetypeId,fighterId,onProgress){
  const model=entry(archetypeId);
  if(!model?.url)throw Error("No NPC model for "+archetypeId);
  if(!B?.SceneLoader||!visual?.body||!visual?.head||!scene)throw Error("NPC scene anchors missing");
  await ensureLoader();
  if(sceneDisposed(scene))throw Error("Scene disposed before NPC import");
  const path=model.url,slash=path.lastIndexOf("/");
  const result=await B.SceneLoader.ImportMeshAsync(
   null,path.slice(0,slash+1),path.slice(slash+1),scene,onProgress,".glb");
  let root=null,savedVisibility=null;
  try{
   if(sceneDisposed(scene))throw Error("Scene disposed during NPC import");
   const visible=result.meshes.filter(mesh=>mesh.getTotalVertices?.()>0);
   if(visible.length<1)throw Error("NPC GLB has no mesh: "+archetypeId);
   const groups=new Map(result.animationGroups.map(group=>[group.name,group]));
   for(const slot of REQUIRED){
    const name=model.clips?.[slot];
    if(!name||!groups.has(name))throw Error("NPC GLB missing clip "+slot+": "+archetypeId);
   }
   root=new B.TransformNode("npc_glb_"+fighterId,scene);
   for(const node of [...result.meshes,...result.transformNodes])
    if(!node.parent)node.parent=root;
   let min=new B.Vector3(Infinity,Infinity,Infinity);
   let max=new B.Vector3(-Infinity,-Infinity,-Infinity);
   for(const mesh of visible){
    mesh.computeWorldMatrix(true);
    const box=mesh.getBoundingInfo().boundingBox;
    min=B.Vector3.Minimize(min,box.minimumWorld);
    max=B.Vector3.Maximize(max,box.maximumWorld);
   }
   const height=max.y-min.y;
   if(!Number.isFinite(height)||height<=0)throw Error("Invalid NPC GLB height: "+archetypeId);
   const scale=HEIGHT/height;
   // Meshy faces +Z; body-local +X is the battlefield front (ArenaStageView.idleFacing).
   root.scaling.set(scale,scale,scale);
   root.rotation.y=Math.PI/2;
   root.position.set(-(min.z+max.z)*.5*scale,.14-.8-min.y*scale,(min.x+max.x)*.5*scale);
   root.parent=visual.body;
   root.metadata={fighterId,archetypeId};
   for(const mesh of result.meshes){
    mesh.metadata={...(mesh.metadata||{}),fighterId};
    mesh.isPickable=true;
   }
   savedVisibility={body:visual.body.isVisible,head:visual.head.isVisible};
   // Invisible capsule still moves and enables all descendants (same as heroes).
   visual.body.isVisible=false;
   visual.head.isVisible=false;
   let activeGroup=null,disposed=false;
   // Combat_Stance and Thrust_Slash carry the pelvis forward; approach belongs to
   // BattleAnimation, so pin hips x/z to the bind pose (vertical bob stays).
   const hips=result.transformNodes.find(node=>node.name==="Hips"||node.name==="mixamorig:Hips");
   const hipX=hips?.position.x,hipZ=hips?.position.z;
   for(const group of result.animationGroups)group.stop();
   function sample(activity){
    if(disposed||sceneDisposed(scene))return;
    const slot=SLOTS.includes(activity?.slot)?activity.slot:"idle";
    const group=groups.get(model.clips[slot])||groups.get(model.clips.idle);
    const p=clamp(activity?.progress);
    if(activeGroup!==group){
     // Never leave two paused groups fighting over the same rig pose.
     activeGroup?.stop();
     group.start(false,1,group.from,group.to);
     group.pause();
     activeGroup=group;
    }
    // One pose at a time, driven by the BattleAnimation clock; no own render loop.
    const [w0,w1]=windowFor(archetypeId,slot);
    group.goToFrame(group.from+(group.to-group.from)*(w0+(w1-w0)*p));
    if(hips){hips.position.x=hipX;hips.position.z=hipZ;}
   }
   sample({slot:"idle",progress:0});
   return Object.freeze({
    update:sample,
    dispose(){
     if(disposed)return;
     disposed=true;
     if(!visual.body.isDisposed?.())visual.body.isVisible=savedVisibility.body;
     if(!visual.head.isDisposed?.())visual.head.isVisible=savedVisibility.head;
     cleanup(result,root);
    }
   });
  }catch(error){
   if(savedVisibility){visual.body.isVisible=savedVisibility.body;visual.head.isVisible=savedVisibility.head;}
   cleanup(result,root);
   throw error;
  }
 }
 // options: {archetypeId, fighterId, onStatus(state,message)}.
 // Returns null when the archetype has no model: the caller keeps the capsule.
 function create(B,scene,visual,options){
  const archetypeId=options?.archetypeId,fighterId=options?.fighterId||archetypeId;
  if(!has(archetypeId))return null;
  let disposed=false,instance=null;
  const report=(state,message)=>{if(!disposed)options?.onStatus?.(state,message);};
  report("loading","Загружаю модель врага…");
  const ready=load(B,scene,visual,archetypeId,fighterId).then(value=>{
   if(disposed||sceneDisposed(scene)){value.dispose();return false;}
   instance=value;report("ready","Модель врага загружена");return true;
  }).catch(error=>{
   report("error","Модель врага недоступна — показана капсула");
   if(!disposed)console.warn("ARENA-ART-004C: enemy capsule fallback",archetypeId,error);
   return false;
  });
  return Object.freeze({
   ready,archetypeId,fighterId,
   get isReady(){return !disposed&&!!instance;},
   update(activity){instance?.update(activity);},
   dispose(){disposed=true;instance?.dispose();instance=null;}
  });
 }
 return Object.freeze({SLOTS,HEIGHT,CLIPS,WINDOWS,has,assetUrl,clipFor,windowFor,ensureLoader,create});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=NpcGlbRuntime;
