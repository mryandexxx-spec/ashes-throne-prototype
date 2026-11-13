/* LIORA-SHIELD-004: hand-position tracking with rigid shield world orientation.
 * The Mixamo hierarchy contains non-rigid parent transforms: parenting
 * the shield mesh to LeftHand and "undoing" its quaternion causes a 170°
 * visual flip across clips in real Babylon WebGL. Instead sample LeftHand's
 * world transform each frame and keep the shield rigid in scene coordinates.
 */
const LioraShieldAttachment=(()=>{
 "use strict";
 const HAND="mixamorig:LeftHand";
 const DEFAULT=Object.freeze({
  offset:Object.freeze({x:-0.22055,y:0.05394,z:-0.01236}),
  rotation:Object.freeze({x:0,y:180,z:0}),
  scale:1,stabilize:true
 });
 const rad=deg=>deg*Math.PI/180;
 function findHand(result){
  return (result?.transformNodes||[]).find(n=>n.name===HAND)||null;
 }
 function worldRotation(B,node){
  if(!node)return new B.Quaternion(0,0,0,1);
  node.computeWorldMatrix(true);
  const quaternion=new B.Quaternion();
  if(!node.getWorldMatrix().decompose(undefined,quaternion))
   throw Error("Cannot decompose Liora model root");
  return quaternion;
 }
 function attach(B,scene,character,shield,options={}){
  if(!B?.TransformNode||!B?.Quaternion||!B?.Vector3||!scene)
   throw Error("Babylon scene missing");
  const hand=findHand(character);
  if(!hand)throw Error("Liora GLB has no animated "+HAND+" joint");
  const roots=[...(shield?.meshes||[]),...(shield?.transformNodes||[])]
   .filter(n=>n&&!n.parent);
  const visible=(shield?.meshes||[]).filter(m=>m.getTotalVertices?.()>0);
  if(!roots.length||!visible.length)throw Error("Shield GLB has no renderable geometry");
  const reference=options.referenceRoot||
   [...(character?.meshes||[]),...(character?.transformNodes||[])]
    .find(n=>n.name==="__root__")||null;
  const imported=roots[0].rotationQuaternion?.clone?.()||
   B.Quaternion.FromEulerAngles(roots[0].rotation?.x||0,
    roots[0].rotation?.y||0,roots[0].rotation?.z||0);
  const importCorrection=B.Quaternion.Inverse(imported);
  // Scene-rooted to prevent bone-chain shears and twists rotating the shield.
  const socket=new B.TransformNode("lioraShieldSocket",scene);
  socket.metadata={lioraJoint:HAND,trackingMode:"world-position"};
  for(const root of roots)root.parent=socket;
  let state=DEFAULT,activity={clip:"",progress:0},disposed=false;
  const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
  function update(){
   if(disposed)return;
   hand.computeWorldMatrix(true);
   const baseWorld=B.Vector3.TransformCoordinates(
    new B.Vector3(state.offset.x,state.offset.y,state.offset.z),
    hand.getWorldMatrix());
   const falling=activity.clip==="Liora_Shield_Death"||activity.clip==="Dead";
   const drop=falling?smooth((activity.progress-.4)/.4):0;
   let point=baseWorld;
   if(drop>0&&reference?.getWorldMatrix){
    reference.computeWorldMatrix(true);
    const landing=B.Vector3.TransformCoordinates(new B.Vector3(.26,.12,.20),
     reference.getWorldMatrix());
    point=B.Vector3.Lerp(baseWorld,landing,drop);
   }
   // Two short shield-aware pose biases: lift the guard to the upper chest,
   // and bring the bash shield slightly toward the body. All other clips,
   // including death, receive exactly zero bias.
   const poseBias=activity.clip==="Liora_Shield_Block"
    ?new B.Vector3(.06,.13,0)
    :activity.clip==="Liora_Shield_Bash"
     ?new B.Vector3(-.18,.15,0):null;
   if(poseBias){
    const envelope=Math.sin(Math.PI*activity.progress)**2;
    if(envelope>0){
     const worldBias=reference?.getWorldMatrix&&B.Vector3.TransformNormal
      ?B.Vector3.TransformNormal(poseBias,reference.getWorldMatrix()):poseBias;
     point=new B.Vector3(point.x+worldBias.x*envelope,
      point.y+worldBias.y*envelope,point.z+worldBias.z*envelope);
    }
   }
   socket.position.copyFrom(point);
   const modelRotation=worldRotation(B,reference);
   const userRotation=B.Quaternion.FromEulerAngles(
    rad(state.rotation.x),rad(state.rotation.y),rad(state.rotation.z));
   let rotation=modelRotation.multiply(importCorrection).multiply(userRotation);
   if(!state.stabilize&&!drop){
    // Diagnostic comparison: preserve original hand rotation when requested.
    rotation=worldRotation(B,hand).multiply(importCorrection).multiply(userRotation);
   }
   if(drop)rotation=rotation.multiply(
    B.Quaternion.FromEulerAngles(rad(-80*drop),0,0));
   socket.rotationQuaternion=rotation;
   socket.scaling.setAll(state.scale);
   socket.computeWorldMatrix(true);
   if(drop>0&&Number.isFinite(options.groundY)){
    let bottom=Infinity;
    for(const mesh of visible){
     mesh.computeWorldMatrix(true);
     bottom=Math.min(bottom,mesh.getBoundingInfo().boundingBox.minimumWorld.y);
    }
    if(Number.isFinite(bottom)&&bottom<options.groundY+.01){
     socket.position.y+=options.groundY+.01-bottom;
     socket.computeWorldMatrix(true);
    }
   }
  }
  function setClipProgress(clip,progress){
   if(disposed)return;
   activity={clip:String(clip||""),
    progress:Math.max(0,Math.min(1,Number(progress)||0))};
   update();
  }
  function pose(config={}){
   if(disposed)throw Error("Shield socket already disposed");
   const offset={...DEFAULT.offset,...(config.offset||{})};
   const rotation={...DEFAULT.rotation,...(config.rotation||{})};
   const scale=config.scale??DEFAULT.scale;
   const stabilize=config.stabilize??DEFAULT.stabilize;
   const values=[offset.x,offset.y,offset.z,rotation.x,rotation.y,rotation.z,scale];
   if(!values.every(Number.isFinite)||scale<=0||scale>3||typeof stabilize!=="boolean")
    throw Error("Invalid shield transform");
   state={offset,rotation,scale,stabilize};
   update();
  }
  pose();
  return Object.freeze({
   jointName:HAND,hand,socket,pose,update,setClipProgress,
   dispose(){
    if(disposed)return;
    disposed=true;
    socket.dispose(false,true);
   }
  });
 }
 return Object.freeze({HAND,DEFAULT,findHand,attach});
})();
if(typeof module!=="undefined")module.exports=LioraShieldAttachment;
