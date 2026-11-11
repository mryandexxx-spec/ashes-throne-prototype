/* RENPOSE016 — stable dossier-only arm pose, solved on Ren's actual rig.
 * Hands are placed at the outer hips (never crossed in front of the pelvis).
 * This is a small constrained CCD adjustment of shoulders and elbows, not an
 * animation loop. Legs, root, pelvis and head are never touched.
 * Babylon world geometry, not guesses about bone quaternion axes.
 */
const RenCardPose=(()=>{
 "use strict";
 const MAX_ROTATION=0.24; // ~14 degrees total per arm joint
 const TARGETS=Object.freeze({
  // Per-hand desired world offsets from Ren's hips, metres in imported rig.
  handL:Object.freeze({x:-.34,y:-.11,z:.06}),
  handR:Object.freeze({x:.34,y:.07,z:.10})
 });
 function create(B,nodes){
  if(!B?.Quaternion||!B?.Vector3||!Array.isArray(nodes))return null;
  const byName=new Map(nodes.map(n=>[n.name,n]));
  const hips=byName.get("hips");
  if(!hips)return null;
  const arms=[
   {hand:"handL",joints:["elL","shL"]},
   {hand:"handR",joints:["elR","shR"]}
  ];
  if(arms.some(a=>!byName.get(a.hand)||a.joints.some(j=>!byName.get(j))))return null;
  // World coordinates account for actual imported bind pose and parent chains.
  const position=node=>{
   node.computeWorldMatrix(true);
   return node.getAbsolutePosition().clone();
  };
  const ref=position(hips);
  const start={};
  for(const a of arms)for(const joint of a.joints)
   start[joint]=byName.get(joint).rotationQuaternion.clone();
  // These are restrained side-of-body targets; keep elbow rotation small.
  const fit=(joint,hand,target,budget)=>{
   const pivot=position(joint),tip=position(hand);
   const current=tip.subtract(pivot),desired=target.subtract(pivot);
   if(current.length()<1e-5||desired.length()<1e-5)return 0;
   current.normalize();desired.normalize();
   const cross=B.Vector3.Cross(current,desired);
   if(cross.length()<1e-7)return 0;
   const angle=Math.acos(Math.max(-1,Math.min(1,B.Vector3.Dot(current,desired))));
   const theta=Math.min(.042,angle,budget);
   if(theta<1e-5)return 0;
   cross.normalize();
   // A world rotation mapped into the joint parent coordinate system.
   // Parent may be scaled/turned by the GLB's top-level imported rig.
   const parent=joint.parent;
   const worldParent=new B.Quaternion();
   const scale=new B.Vector3(),translation=new B.Vector3();
   parent.computeWorldMatrix(true);
   parent.getWorldMatrix().decompose(scale,worldParent,translation);
   const inv=worldParent.conjugate().normalize();
   const worldDelta=B.Quaternion.RotationAxis(cross,theta);
   const localDelta=inv.multiply(worldDelta).multiply(worldParent);
   joint.rotationQuaternion.copyFrom(localDelta.multiply(joint.rotationQuaternion).normalize());
   return theta;
  };
  const measurements={};
  for(const a of arms){
   const hand=byName.get(a.hand),offset=TARGETS[a.hand];
   const target=new B.Vector3(ref.x+offset.x,ref.y+offset.y,ref.z+offset.z);
   const used={elL:0,shL:0,elR:0,shR:0};
   // Several small steps prevent the extreme wrist-to-groin folding seen before.
   for(let pass=0;pass<8;pass++){
    for(const name of a.joints){
     const remaining=MAX_ROTATION-used[name];
     if(remaining>1e-5)used[name]+=fit(byName.get(name),hand,target,remaining);
    }
   }
   measurements[a.hand]=B.Vector3.Distance(position(hand),target);
  }
  return Object.freeze({targets:TARGETS,measurements,original:start});
 }
 return Object.freeze({TARGETS,MAX_ROTATION,create});
})();
if(typeof module!=="undefined")module.exports=RenCardPose;
