/* ARENA-ART-004C — on-demand skinned enemy models in combat. No gameplay ownership.
 * One runtime for every enemy archetype: url, bytes and clips per slot come
 * from NpcModelAssets.models[archetypeId] (dev/src/assets/npc-models.js, generated).
 * Same contract as NadaGlbRuntime: create(...) -> {ready,isReady,update,dispose}.
 * ARENA-ART-004E: the sarkh are in the manifest too; their tail wave is baked into the
 * clips (tools/build-sarkh-rig.mjs), so they need no per-frame code here.
 * No manifest entry or any load error -> capsule stays.
 * Never throw into battle flow.
 */
const NpcGlbRuntime=(()=>{
 "use strict";
 const SLOTS=Object.freeze(["idle","basic","special","powerful","guard","ward","hit","death","run","walk"]);
 // Slots that must exist in the GLB before the capsule is hidden.
 const REQUIRED=Object.freeze(["idle","basic","special","powerful","guard","ward","hit","death"]);
 // Fighter height in world units (bind-pose bounding box). Heroes use 2.1, but their
 // idle clips stand upright (top of head 2.04-2.23, mean 2.14 on the battle frame) while
 // Combat_Stance crouches (2.02-2.07 at 2.1). ARENA-ART-004D: 2.2 brings the enemy stance
 // to the heroes' mean; they still read smaller only because they stand deeper in frame.
 const HEIGHT=2.2;
 // Launs are tall non-flying feathered people (PR #339, [ПРЕДЛОЖЕНИЕ]): ~10% taller.
 const HEIGHTS=Object.freeze({"npc-laun-ford-guard":2.45,"npc-laun-physician":2.4});
 const heightFor=archetypeId=>HEIGHTS[archetypeId]||HEIGHT;
 // ARENA-ART-004D: Combat_Stance stands side-on (shoulder line ~46 deg, feet ~65 deg off
 // the facing). Outside attacks the body turns by this much toward the camera so face
 // and gear read; attacks keep facing the target. Picked from the render sweep
 // (docs/evidence/arenaart004d/stance-yaw.webp). Radians, per side.
 const STANCE_YAW=Object.freeze({enemy:-35*Math.PI/180,ally:0});
 const manifest=()=>typeof NpcModelAssets!=="undefined"?NpcModelAssets:null;
 const entry=archetypeId=>{
  const models=manifest()?.models;
  return typeof archetypeId==="string"&&models&&Object.prototype.hasOwnProperty.call(models,archetypeId)
   ?models[archetypeId]:null;
 };
 const has=archetypeId=>!!entry(archetypeId)?.url;
 // ARENA-ART-004D, owner decision 20.11.2026 (plan §8 п. 4): until they get their own
 // models, the training enemies and the capsule heroes borrow an enemy model, tinted
 // so they do not read as that NPC. Model choice is a [ПРЕДЛОЖЕНИЕ] by role and clip set
 // (the profile follows the model, because the clips do). Tint multiplies the albedo.
 const STAND_INS=Object.freeze({
  ves:Object.freeze({archetypeId:"npc-watch-captain",tint:Object.freeze([.78,.7,.95])}),
  shade:Object.freeze({archetypeId:"npc-trail-interceptor",tint:Object.freeze([.55,.55,.68])}),
  kael:Object.freeze({archetypeId:"npc-pass-guard",tint:Object.freeze([.78,.86,1])}),
  lyra:Object.freeze({archetypeId:"npc-ridge-slinger",tint:Object.freeze([.8,1,.82])}),
  darin:Object.freeze({archetypeId:"npc-route-signaller",tint:Object.freeze([1,.84,.7])})
 });
 // Later-wave copies of the training enemies (demo mission 3) look the same.
 const copies={"ves-2":"ves","ves-3":"ves","shade-2":"shade"};
 const standIn=fighterId=>{
  if(typeof fighterId!=="string")return null;
  const id=Object.prototype.hasOwnProperty.call(copies,fighterId)?copies[fighterId]:fighterId;
  return Object.prototype.hasOwnProperty.call(STAND_INS,id)?STAND_INS[id]:null;
 };
 // CLIPS[archetypeId][slot] — read straight from the generated manifest.
 const CLIPS=Object.freeze(Object.fromEntries(Object.entries(manifest()?.models||{})
  .map(([id,model])=>[id,model.clips])));
 // ARENA-ART-004D: part of a clip shown for a slot, keyed by clip name (the same Meshy
 // clip serves several archetypes) and then by slot. keys are [progress, clipFraction]
 // knots, linear between them, so a long wind-up can be compressed while the blow keeps
 // its own speed. contact = slot progress at which the blow lands or the throw leaves the
 // hand; the matching AnimationProfiles entry carries the same contactFraction.
 // Measured by tools/measure-npc-clips.cjs from wrist speed/reach and hip height (60 Hz,
 // identical on all 8 rigs): Thrust_Slash thrust peak .247, full reach .30;
 // Triple_Combo_Attack strikes .18/.36/.52; Over_Shoulder_Throw release .80;
 // Crouch_Charge_and_Throw crouch .15-.60, release .70; Block1 raised by .33, held to .42;
 // Charged_Spell_Cast release .65, held to .83; dying_backwards hips down at .55-.57.
 // Melee approach (BattleAnimation.approach) arrives at progress .38 and holds to .64,
 // so melee contacts sit inside that hold.
 const W=(keys,contact)=>Object.freeze({keys:Object.freeze(keys.map(k=>Object.freeze(k))),
  ...(contact!==undefined?{contact}:{})});
 const slashWindow=W([[0,0],[.42,.30],[1,.82]],.42);
 const castWindow=W([[0,0],[.78,.65],[1,.83]],.78);
 const castHold=W([[0,0],[1,.83]]); // heal/guard cast: no blow to time
 const blockAbility=W([[0,.12],[1,.55]]);
 const WINDOWS=Object.freeze({
  Thrust_Slash:Object.freeze({basic:slashWindow,special:slashWindow}),
  Triple_Combo_Attack:Object.freeze({powerful:W([[0,0],[.3,.15],[.6,.52],[1,.85]],.6)}),
  // powerful: sarkh courier's «Скорый выстрел» (ARENA-ART-004E) reuses the throw.
  Over_Shoulder_Throw:Object.freeze({basic:W([[0,.1],[.78,.8],[1,.9]],.78),
   special:W([[0,.1],[.78,.8],[1,.9]],.78),powerful:W([[0,.1],[.78,.8],[1,.9]],.78)}),
  Crouch_Charge_and_Throw:Object.freeze({powerful:W([[0,0],[.25,.15],[.55,.62],[.75,.70],[1,.92]],.75)}),
  // Guard raises the block and ends raised; the ward cue then holds it (as Liora).
  Block1:Object.freeze({guard:W([[0,.12],[1,.36]]),ward:W([[0,.34],[1,.42]]),
   special:blockAbility,powerful:blockAbility}),
  Charged_Spell_Cast:Object.freeze({special:castWindow,powerful:castHold,guard:castHold}),
  // Ends shortly after the body is down: the fighter is hidden when the slot ends.
  dying_backwards:Object.freeze({death:W([[0,.1],[1,.7]])})
 });
 const FULL=W([[0,0],[1,1]]);
 const clipFor=(archetypeId,slot)=>{
  const clips=entry(archetypeId)?.clips;
  return clips?.[slot]||clips?.idle||null;
 };
 const windowOf=(archetypeId,slot)=>WINDOWS[clipFor(archetypeId,slot)]?.[slot]||FULL;
 // [first, last] clip fraction shown for a slot.
 const windowFor=(archetypeId,slot)=>{const k=windowOf(archetypeId,slot).keys;return [k[0][1],k[k.length-1][1]];};
 const contactFor=(archetypeId,slot)=>windowOf(archetypeId,slot).contact??null;
 // Slot progress 0..1 -> clip fraction 0..1 through the window knots.
 function clipFraction(archetypeId,slot,progress){
  const keys=windowOf(archetypeId,slot).keys,p=clamp(progress);
  for(let i=1;i<keys.length;i++){
   const [p0,f0]=keys[i-1],[p1,f1]=keys[i];
   if(p<=p1||i===keys.length-1)return f0+(f1-f0)*(p1>p0?Math.min(1,Math.max(0,(p-p0)/(p1-p0))):1);
  }
  return keys[0][1];
 }
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
 async function load(B,scene,visual,archetypeId,fighterId,tint,onProgress){
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
   const scale=heightFor(archetypeId)/height;
   // ARENA-ART-004E: a sarkh coil spreads far behind the body, so the fighter's place is its
   // upright body (SnakeBody bone), not the middle of the bounds; humanoids keep the bounds.
   const body=result.transformNodes.find(node=>node.name==="SnakeBody");
   if(body)body.computeWorldMatrix(true);
   const anchor=body?body.getAbsolutePosition():null;
   const cx=anchor?anchor.x:(min.x+max.x)*.5,cz=anchor?anchor.z:(min.z+max.z)*.5;
   // Meshy faces +Z; body-local +X is the battlefield front (ArenaStageView.idleFacing).
   root.scaling.set(scale,scale,scale);
   root.rotation.y=Math.PI/2;
   root.position.set(-cz*scale,.14-.8-min.y*scale,cx*scale);
   root.parent=visual.body;
   root.metadata={fighterId,archetypeId};
   for(const mesh of result.meshes){
    mesh.metadata={...(mesh.metadata||{}),fighterId};
    mesh.isPickable=true;
    // Each load owns its material (disposed with the root), so tinting is local.
    if(tint&&mesh.material?.albedoColor)mesh.material.albedoColor=new B.Color3(tint[0],tint[1],tint[2]);
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
    group.goToFrame(group.from+(group.to-group.from)*clipFraction(archetypeId,slot,p));
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
 // options: {archetypeId, fighterId, tint:[r,g,b]?, onStatus(state,message)}.
 // Returns null when the archetype has no model: the caller keeps the capsule.
 function create(B,scene,visual,options){
  const archetypeId=options?.archetypeId,fighterId=options?.fighterId||archetypeId;
  if(!has(archetypeId))return null;
  let disposed=false,instance=null;
  const report=(state,message)=>{if(!disposed)options?.onStatus?.(state,message);};
  report("loading","Загружаю модель врага…");
  const tint=Array.isArray(options?.tint)&&options.tint.length===3&&options.tint.every(Number.isFinite)?options.tint:null;
  const ready=load(B,scene,visual,archetypeId,fighterId,tint).then(value=>{
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
 return Object.freeze({SLOTS,HEIGHT,HEIGHTS,STANCE_YAW,CLIPS,WINDOWS,STAND_INS,has,standIn,heightFor,assetUrl,
  clipFor,windowFor,contactFor,clipFraction,ensureLoader,create});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=NpcGlbRuntime;
