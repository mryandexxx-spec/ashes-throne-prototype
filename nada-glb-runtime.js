/* NADA3D001 — on-demand skinned Nada in combat. No gameplay ownership.
 * Model path follows the Dune dev/assets/models + dev/src/assets convention.
 * Never throw into battle flow: keep the existing capsule fallback.
 */
const NadaGlbRuntime=(()=>{
 "use strict";
 const CLIPS=Object.freeze({
  idle:"Idle_11",basic:"Archery_Shot_3",special:"Archery_Shot_3",
  powerful:"Archery_Shot_3",passive:"Idle_11",leader:"Idle_11",
  guard:"Idle_11",ward:"Hit_Reaction_1",hit:"Hit_Reaction_1",
  death:"Electrocuted_Fall",run:"Running",walk:"Walking"
 });
 const clipFor=slot=>CLIPS[slot]||CLIPS.idle;
 const sceneDisposed=scene=>typeof scene?.isDisposed==="function"
  ?scene.isDisposed():scene?.isDisposed===true;
 const clamp=p=>Math.max(0,Math.min(1,Number.isFinite(p)?p:0));
 const model=()=>typeof NadaModelAssets!=="undefined"?NadaModelAssets:null;
 const assetUrl=()=>model()?.url||"dev/assets/models/nada-mobile-animated.glb";
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
  }catch(error){console.warn("Nada GLB cleanup",error);}
 }
 async function load(B,scene,visual){
  if(!B?.SceneLoader||!visual?.body||!scene)throw Error("Nada scene anchors missing");
  await ensureLoader();
  if(sceneDisposed(scene))throw Error("Scene disposed before Nada import");
  const path=assetUrl(),slash=path.lastIndexOf("/");
  const result=await B.SceneLoader.ImportMeshAsync(
   null,path.slice(0,slash+1),path.slice(slash+1),scene,null,".glb");
  let root=null;
  try{
   if(sceneDisposed(scene))throw Error("Scene disposed during Nada import");
   const visible=result.meshes.filter(mesh=>mesh.getTotalVertices?.()>0);
   if(visible.length<1)throw Error("Nada GLB has no mesh");
   const groups=new Map(result.animationGroups.map(group=>[group.name,group]));
   for(const required of [CLIPS.idle,CLIPS.basic,CLIPS.hit,CLIPS.death]){
    if(!groups.has(required))throw Error("Nada GLB missing clip: "+required);
   }
   root=new B.TransformNode("nada_mobile_glb",scene);
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
   if(!Number.isFinite(height)||height<=0)throw Error("Invalid Nada GLB height");
   const scale=2.1/height;
   // Meshy faces +Z; give the actress the same battlefield facing as Ren.
   root.scaling.set(scale,scale,scale);
   root.rotation.y=Math.PI/2;
   root.position.set(-(min.z+max.z)*.5*scale,.14-.8-min.y*scale,
    (min.x+max.x)*.5*scale);
   root.parent=visual.body;
   root.metadata={fighterId:"nada"};
   for(const mesh of result.meshes){
    mesh.metadata={...(mesh.metadata||{}),fighterId:"nada"};
    mesh.isPickable=true;
   }
   const oldBodyVisible=visual.body.isVisible,oldHeadVisible=visual.head.isVisible;
   // Invisible anchor mesh still moves and enables all descendants.
   // Do not use setEnabled(false) on body: that would hide the imported GLB.
   visual.body.isVisible=false;
   visual.head.isVisible=false;
   const started=new Set();
   const hips=result.transformNodes.find(node=>node.name==="mixamorig:Hips");
   const hipX=hips?.position.x,hipZ=hips?.position.z;
   let disposed=false;
   for(const group of result.animationGroups)group.stop();
   function sample(activity){
    if(disposed||sceneDisposed(scene))return;
    const slot=activity?.slot||"idle";
    const group=groups.get(clipFor(slot))||groups.get(CLIPS.idle);
    const p=clamp(activity?.progress);
    if(!started.has(group)){
     group.start(false,1,group.from,group.to);
     group.pause();
     started.add(group);
    }
    // One pose at a time. Match existing CombatAnimation normalized clock.
    // Idle is driven by the clock; never start an independent render loop.
    group.goToFrame(group.from+(group.to-group.from)*p);
    // Mixamo clips carry translation; combat approach is owned by BattleAnimation.
    // Prevent duplicate horizontal root motion and drifting outside the fighter base.
    if(hips){hips.position.x=hipX;hips.position.z=hipZ;}
   }
   sample({slot:"idle",progress:0});
   return Object.freeze({
    update:sample,
    dispose(){
     if(disposed)return;
     disposed=true;
     visual.body.isVisible=oldBodyVisible;
     visual.head.isVisible=oldHeadVisible;
     cleanup(result,root);
    }
   });
  }catch(error){cleanup(result,root);throw error;}
 }
 function create(B,scene,visual,onStatus){
  let disposed=false,instance=null;
  const report=(state,message)=>{if(!disposed)onStatus?.(state,message);};
  report("loading","Загружаю Наду · 3D…");
  const ready=load(B,scene,visual).then(value=>{
   if(disposed||sceneDisposed(scene)){value.dispose();return false;}
   instance=value;report("ready","3D Нада загружена");return true;
  }).catch(error=>{
   report("error","3D Нада недоступна — показана простая модель");
   if(!disposed)console.warn("NADA3D001: combat fallback",error);
   return false;
  });
  return Object.freeze({
   ready,
   get isReady(){return !disposed&&!!instance;},
   update(activity){instance?.update(activity);},
   dispose(){disposed=true;instance?.dispose();instance=null;}
  });
 }
 return Object.freeze({assetUrl,clipFor,CLIPS,ensureLoader,create});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=NadaGlbRuntime;
