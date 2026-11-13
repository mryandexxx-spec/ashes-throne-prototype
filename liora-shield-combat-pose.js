/* LIORA-SHIELD-005: local, reversible arm-pose correction for two combat clips.
 * No GLB changes. At every sampled animation frame, blend the four left-arm
 * joints toward the real Idle_02 reference with a smooth bell envelope.
 * Never applied to the other 13 clips, including death.
 */
const LioraShieldCombatPose=(()=>{
 "use strict";
 const NAMES=["mixamorig:LeftShoulder","mixamorig:LeftArm",
  "mixamorig:LeftForeArm","mixamorig:LeftHand"];
 const WEIGHTS=Object.freeze({
  Liora_Shield_Block:Object.freeze([.12,.36,.27,.10]),
  Liora_Shield_Bash:Object.freeze([.22,.54,.43,.17])
 });
 function create(B,character,idleGroup){
  if(!B?.Quaternion?.Slerp||!idleGroup)throw Error("Babylon animation pose reference unavailable");
  const nodes=NAMES.map(name=>(character.transformNodes||[]).find(n=>n.name===name));
  if(nodes.some(n=>!n))throw Error("Left arm joints missing");
  // Initialization occurs before the lab starts playback; snapshot is never
  // recalculated from altered poses.
  idleGroup.start(false,1,idleGroup.from,idleGroup.to);
  idleGroup.pause();
  idleGroup.goToFrame(idleGroup.from+(idleGroup.to-idleGroup.from)*.5);
  const neutral=nodes.map(n=>n.rotationQuaternion?.clone?.());
  idleGroup.stop();
  if(neutral.some(q=>!q))throw Error("Liora arm nodes lack quaternion rotation");
  function apply(clip,progress){
   const weights=WEIGHTS[clip];
   if(!weights)return false;
   const p=Math.min(1,Math.max(0,Number(progress)||0));
   const envelope=Math.sin(Math.PI*p)**2;
   if(envelope<1e-6)return false;
   for(let i=0;i<nodes.length;i++){
    const node=nodes[i],original=node.rotationQuaternion;
    node.rotationQuaternion=B.Quaternion.Slerp(original,neutral[i],weights[i]*envelope);
    node.computeWorldMatrix(true);
   }
   return true;
  }
  return Object.freeze({apply,controlledClips:Object.freeze(Object.keys(WEIGHTS))});
 }
 return Object.freeze({create,NAMES,WEIGHTS});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=LioraShieldCombatPose;
