/* LIORA-SHIELD-002: independent shield GLB socket, no edits to character mesh or rig.
 * The GLTF joint is an animated Babylon TransformNode, not a legacy Babylon Bone.
 * Bind pose is only a starting point: evaluate alignment on all 12 clips in the lab.
 */
const LioraShieldAttachment=(()=>{
 "use strict";
 const HAND="mixamorig:LeftHand";
 const DEFAULT=Object.freeze({
  offset:Object.freeze({x:-0.09,y:0.03,z:0.17}),
  rotation:Object.freeze({x:0,y:0,z:0}),
  scale:1
 });
 const rad=deg=>deg*Math.PI/180;
 function findHand(result){
  return (result?.transformNodes||[]).find(node=>node.name===HAND)||null;
 }
 function attach(B,scene,character,shield){
  if(!B?.TransformNode||!B?.Quaternion||!B?.Vector3||!scene)throw Error("Babylon scene missing");
  const hand=findHand(character);
  if(!hand)throw Error("Liora GLB has no animated "+HAND+" node");
  const roots=[...(shield?.meshes||[]),...(shield?.transformNodes||[])]
   .filter(node=>node&&!node.parent);
  if(!roots.length||!(shield?.meshes||[]).some(mesh=>mesh.getTotalVertices?.()>0))
   throw Error("Shield GLB has no renderable geometry");
  hand.computeWorldMatrix(true);
  const socket=new B.TransformNode("lioraShieldSocket",scene);
  socket.parent=hand;
  // Neutralize the hand's REST rotation so the shield is upright at bind pose.
  const absolute=hand.getAbsoluteRotationQuaternion();
  const neutral=B.Quaternion.Inverse(absolute);
  for(const root of roots)root.parent=socket;
  function pose(config={}){
   const offset={...DEFAULT.offset,...(config.offset||{})};
   const rotation={...DEFAULT.rotation,...(config.rotation||{})};
   const scale=config.scale??DEFAULT.scale;
   const nums=[offset.x,offset.y,offset.z,rotation.x,rotation.y,rotation.z,scale];
   if(!nums.every(Number.isFinite)||scale<=0||scale>3)throw Error("Invalid shield transform");
   socket.position.set(offset.x,offset.y,offset.z);
   socket.rotationQuaternion=neutral.multiply(B.Quaternion.FromEulerAngles(
    rad(rotation.x),rad(rotation.y),rad(rotation.z)));
   socket.scaling.setAll(scale);
   socket.computeWorldMatrix(true);
  }
  pose();
  let disposed=false;
  return Object.freeze({
   jointName:HAND,hand,socket,pose,
   dispose(){
    if(disposed)return;
    disposed=true;
    // Free independently loaded shield meshes, geometry and materials.
    socket.dispose(false,true);
   }
  });
 }
 return Object.freeze({HAND,DEFAULT,findHand,attach});
})();
if(typeof module!=="undefined")module.exports=LioraShieldAttachment;
