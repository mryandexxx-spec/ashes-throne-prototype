/* LIORAPLAY001 — on-demand skinned Liora in combat. No gameplay ownership.
 * Model path follows the Dune dev/assets/models + dev/src/assets convention.
 * Never throw into battle flow: keep the existing capsule fallback.
 * LIORA-SHIELD-006: the kite shield is baked into the same GLB as mesh "Liora_Shield",
 * skinned to mixamorig:LeftForeArm. Nothing is attached at runtime; the shield follows
 * every clip through the skeleton. Hide that mesh to show Liora unarmed.
 */
const LioraGlbRuntime=(()=>{
 "use strict";
 const CLIPS=Object.freeze({
  idle:"Idle_02",basic:"Liora_Shield_Bash",
  special:"Liora_Shield_Block",powerful:"Squat_Stance",
  passive:"Idle_02",leader:"Idle_02",
  // LIORAANIM001: her self-guard abilities resolve to guard + ward (see BattleAnimation.enqueue),
  // so the block clip lives on those slots: raise the shield, then hold it.
  guard:"Liora_Shield_Block",ward:"Liora_Shield_Block",
  hit:"Hit_Reaction",death:"Liora_Shield_Death",run:"Running",walk:"Walking"
 });
 const clipFor=slot=>CLIPS[slot]||CLIPS.idle;
 // LIORAPLAY001: part of a clip shown for a slot, as fractions of the clip length.
 // Liora_Shield_Death ends lying on the ground with the shield over the arm; stop just before the end.
 // LIORAANIM001: Liora_Shield_Block raises the shield during the first 55% and holds it after.
 const BLOCK_RAISE=.55;
 const WINDOWS=Object.freeze({death:Object.freeze([0,.98]),
  guard:Object.freeze([0,BLOCK_RAISE]),ward:Object.freeze([BLOCK_RAISE,1])});
 const SHIELD_MESH="Liora_Shield";
 // The baked shield sits on the extended arm in bind pose; frame the body only.
 const isBody=mesh=>mesh.name!==SHIELD_MESH;
 const windowFor=slot=>WINDOWS[slot]||[0,1];
 const sceneDisposed=scene=>typeof scene?.isDisposed==="function"
  ?scene.isDisposed():scene?.isDisposed===true;
 const clamp=p=>Math.max(0,Math.min(1,Number.isFinite(p)?p:0));
 const model=()=>typeof LioraModelAssets!=="undefined"?LioraModelAssets:null;
 const assetUrl=()=>model()?.url||"dev/assets/models/liora-mobile-animated.glb";
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
  }catch(error){console.warn("Liora GLB cleanup",error);}
 }
 async function load(B,scene,visual,onProgress){
  if(!B?.SceneLoader||!visual?.body||!scene)throw Error("Liora scene anchors missing");
  await ensureLoader();
  if(sceneDisposed(scene))throw Error("Scene disposed before Liora import");
  const path=assetUrl(),slash=path.lastIndexOf("/");
  const result=await B.SceneLoader.ImportMeshAsync(
   null,path.slice(0,slash+1),path.slice(slash+1),scene,onProgress,".glb");
  let root=null,savedVisibility=null;
  try{
   if(sceneDisposed(scene))throw Error("Scene disposed during Liora import");
   const visible=result.meshes.filter(mesh=>mesh.getTotalVertices?.()>0);
   if(visible.length<1)throw Error("Liora GLB has no mesh");
   const shield=visible.find(mesh=>mesh.name===SHIELD_MESH)||null;
   const groups=new Map(result.animationGroups.map(group=>[group.name,group]));
   for(const required of [CLIPS.idle,CLIPS.basic,CLIPS.powerful,CLIPS.hit,CLIPS.death]){
    if(!groups.has(required))throw Error("Liora GLB missing clip: "+required);
   }
   root=new B.TransformNode("liora_mobile_glb",scene);
   for(const node of [...result.meshes,...result.transformNodes])
    if(!node.parent)node.parent=root;
   let min=new B.Vector3(Infinity,Infinity,Infinity);
   let max=new B.Vector3(-Infinity,-Infinity,-Infinity);
   for(const mesh of visible.filter(isBody)){
    mesh.computeWorldMatrix(true);
    const box=mesh.getBoundingInfo().boundingBox;
    min=B.Vector3.Minimize(min,box.minimumWorld);
    max=B.Vector3.Maximize(max,box.maximumWorld);
   }
   const height=max.y-min.y;
   if(!Number.isFinite(height)||height<=0)throw Error("Invalid Liora GLB height");
   const scale=2.1/height;
   // Meshy faces +Z; give the actress the same battlefield facing as Ren.
   root.scaling.set(scale,scale,scale);
   root.rotation.y=Math.PI/2;
   root.position.set(-(min.z+max.z)*.5*scale,.14-.8-min.y*scale,
    (min.x+max.x)*.5*scale);
   root.parent=visual.body;
   root.metadata={fighterId:"liora"};
   for(const mesh of result.meshes){
    mesh.metadata={...(mesh.metadata||{}),fighterId:"liora",lioraShield:mesh.name===SHIELD_MESH};
    mesh.isPickable=true;
   }
   const oldBodyVisible=visual.body.isVisible,oldHeadVisible=visual.head.isVisible;
   savedVisibility={body:oldBodyVisible,head:oldHeadVisible};
   // Invisible anchor mesh still moves and enables all descendants.
   // Do not use setEnabled(false) on body: that would hide the imported GLB.
   visual.body.isVisible=false;
   visual.head.isVisible=false;
   let activeGroup=null;
   const hips=result.transformNodes.find(node=>node.name==="mixamorig:Hips");
   const hipX=hips?.position.x,hipZ=hips?.position.z;
   let disposed=false;
   for(const group of result.animationGroups)group.stop();
   function sample(activity){
    if(disposed||sceneDisposed(scene))return;
    const slot=activity?.slot||"idle";
    const group=groups.get(clipFor(slot))||groups.get(CLIPS.idle);
    const p=clamp(activity?.progress);
    if(activeGroup!==group){
     // Never leave two paused Mixamo groups fighting over the same rig pose.
     activeGroup?.stop();
     group.start(false,1,group.from,group.to);
     group.pause();
     activeGroup=group;
    }
    // One pose at a time. Match existing CombatAnimation normalized clock.
    // Idle is driven by the clock; never start an independent render loop.
    const [w0,w1]=windowFor(slot);
    group.goToFrame(group.from+(group.to-group.from)*(w0+(w1-w0)*p));
    // Mixamo clips carry translation; combat approach is owned by BattleAnimation.
    // Prevent duplicate horizontal root motion and drifting outside the fighter base.
    if(hips){hips.position.x=hipX;hips.position.z=hipZ;}
   }
   sample({slot:"idle",progress:0});
   return Object.freeze({
    update:sample,
    get shield(){return shield;},
    setShieldVisible(flag){shield?.setEnabled(flag!==false);},
    dispose(){
     if(disposed)return;
     disposed=true;
     visual.body.isVisible=oldBodyVisible;
     visual.head.isVisible=oldHeadVisible;
     cleanup(result,root);
    }
   });
  }catch(error){
   if(savedVisibility){visual.body.isVisible=savedVisibility.body;visual.head.isVisible=savedVisibility.head;}
   cleanup(result,root);
   throw error;
  }
 }
 function create(B,scene,visual,onStatus){
  let disposed=false,instance=null;
  const report=(state,message)=>{if(!disposed)onStatus?.(state,message);};
  report("loading","Загружаю Лиору · 3D…");
  const tracker=typeof RenGlbRuntime!=="undefined"&&RenGlbRuntime.createDownloadTracker
   ?RenGlbRuntime.createDownloadTracker(message=>report("loading",message),"Лиоры"):null;
  if(tracker&&model()?.bytes)tracker.setTotal(model().bytes);
  const ready=load(B,scene,visual,event=>{if(!disposed)tracker?.update(event);}).then(value=>{
   tracker?.done();
   if(disposed||sceneDisposed(scene)){value.dispose();return false;}
   instance=value;report("ready","3D Лиора загружена");return true;
  }).catch(error=>{
   tracker?.done();
   report("error","3D Лиора недоступна — показана простая модель");
   if(!disposed)console.warn("LIORAPLAY001: combat fallback",error);
   return false;
  });
  return Object.freeze({
   ready,
   get isReady(){return !disposed&&!!instance;},
   get shield(){return instance?.shield||null;},
   setShieldVisible(flag){instance?.setShieldVisible(flag);},
   update(activity){instance?.update(activity);},
   dispose(){disposed=true;instance?.dispose();instance=null;}
  });
 }
 return Object.freeze({assetUrl,clipFor,windowFor,CLIPS,WINDOWS,SHIELD_MESH,ensureLoader,create});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=LioraGlbRuntime;
