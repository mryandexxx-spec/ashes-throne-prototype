/* LIORA-SHIELD-002: independent shield GLB socket, with orientation stabilization.
 * Calibrated against all 12 GLB clips in an OFFLINE textured 3D renderer.
 * Browser/WebGL/Safari hand grip and geometry overlap still require visual QA.
 */
const LioraShieldAttachment=(()=>{
 "use strict";
 const HAND="mixamorig:LeftHand";
 // Wrist-relative grip adjusted from 36 image samples. Shield's vertex centroid
 // (0,0.092,0.026)m is compensated so its visible face is near the forearm.
 const DEFAULT=Object.freeze({
  offset:Object.freeze({x:-0.22055,y:0.05394,z:-0.01236}),
  rotation:Object.freeze({x:0,y:0,z:0}),
  scale:1,stabilize:true
 });
 const rad=deg=>deg*Math.PI/180;
 function findHand(result){
  return (result?.transformNodes||[]).find(node=>node.name===HAND)||null;
 }
 function attach(B,scene,character,shield,options={}){
  if(!B?.TransformNode||!B?.Quaternion||!B?.Vector3||!scene)throw Error("Babylon scene missing");
  const hand=findHand(character);
  if(!hand)throw Error("Liora GLB has no animated "+HAND+" node");
  const roots=[...(shield?.meshes||[]),...(shield?.transformNodes||[])]
   .filter(node=>node&&!node.parent);
  if(!roots.length||!(shield?.meshes||[]).some(mesh=>mesh.getTotalVertices?.()>0))
   throw Error("Shield GLB has no renderable geometry");
  const reference=options.referenceRoot||
   [...(character?.meshes||[]),...(character?.transformNodes||[])]
    .find(node=>node.name==="__root__")||null;
  const socket=new B.TransformNode("lioraShieldSocket",scene);
  socket.parent=hand;
  const rootRotation=roots[0].rotationQuaternion?.clone?.()||
   B.Quaternion.FromEulerAngles(roots[0].rotation?.x||0,
    roots[0].rotation?.y||0,roots[0].rotation?.z||0);
  const importCorrection=B.Quaternion.Inverse(rootRotation);
  for(const root of roots)root.parent=socket;
  let state=DEFAULT,disposed=false;
  function update(){
   if(disposed)return;
   // Preserve the GLTF character's facing while preventing wrist-spin from
   // turning the kite shield flat or backwards during attack/block animations.
   hand.computeWorldMatrix(true);
   const modelRotation=reference?.getAbsoluteRotationQuaternion?.()||
    new B.Quaternion(0,0,0,1);
   const stableWorld=modelRotation.multiply(importCorrection).multiply(
    B.Quaternion.FromEulerAngles(rad(state.rotation.x),
     rad(state.rotation.y),rad(state.rotation.z)));
   if(state.stabilize){
    const worldHand=hand.getAbsoluteRotationQuaternion();
    socket.rotationQuaternion=B.Quaternion.Inverse(worldHand).multiply(stableWorld);
   }else if(!socket.rotationQuaternion){
    socket.rotationQuaternion=B.Quaternion.Inverse(
     hand.getAbsoluteRotationQuaternion()).multiply(stableWorld);
   }
   socket.computeWorldMatrix(true);
  }
  function pose(config={}){
   if(disposed)throw Error("Shield socket already disposed");
   const offset={...DEFAULT.offset,...(config.offset||{})};
   const rotation={...DEFAULT.rotation,...(config.rotation||{})};
   const scale=config.scale??DEFAULT.scale,stabilize=config.stabilize??DEFAULT.stabilize;
   const nums=[offset.x,offset.y,offset.z,rotation.x,rotation.y,rotation.z,scale];
   if(!nums.every(Number.isFinite)||scale<=0||scale>3||
    typeof stabilize!=="boolean")throw Error("Invalid shield transform");
   state={offset,rotation,scale,stabilize};
   socket.position.set(offset.x,offset.y,offset.z);
   socket.scaling.setAll(scale);
   update();
  }
  pose();
  return Object.freeze({
   jointName:HAND,hand,socket,pose,update,
   dispose(){
    if(disposed)return;
    disposed=true;
    socket.dispose(false,true); // includes independently imported shield subtree
   }
  });
 }
 return Object.freeze({HAND,DEFAULT,findHand,attach});
})();
if(typeof module!=="undefined")module.exports=LioraShieldAttachment;
