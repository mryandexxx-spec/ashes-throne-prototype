/* RENPOSE016 — stable dossier-only arm pose, solved on Ren's actual rig.
 * Hands are placed at the outer hips (never crossed in front of the pelvis).
 * This is a small constrained CCD adjustment of shoulders and elbows, not an
 * animation loop. Legs, root, pelvis and head are never touched.
 * Babylon world geometry, not guesses about bone quaternion axes.
 */
const RenCardPose=(()=>{
 "use strict";
 const MAX_ROTATION=Object.freeze({elL:.12,shL:.18,elR:.85,shR:.30});
 // Right elbow has room to bend so that the hand can rest near the belt.
 const TARGETS=Object.freeze({
  // Per-hand desired world offsets from Ren's hips, metres in imported rig.
  // x: lateral/right, y: vertical, z: character forward.
  handL:Object.freeze({x:-.345,y:-.12,z:.10}),
  handR:Object.freeze({x:.36,y:.10,z:.20})
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
  // Derive natural axes from the actual transformed shoulders, not world X/Z.
  // In the battle scene Ren is rotated 90 degrees relative to the card.
  const right=position(byName.get("shR")).subtract(position(byName.get("shL"))).normalize();
  const up=position(byName.get("head")).subtract(ref).normalize();
  const forward=B.Vector3.Cross(up,right).normalize();
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
   const original=joint.rotationQuaternion.clone();
   const before=B.Vector3.Distance(tip,target);
   let best=before,bestQ=original;
   for(const sign of [1,-1]){
    const attempt=B.Quaternion.RotationAxis(cross,theta*sign);
    const local=inv.multiply(attempt).multiply(worldParent);
    const q=local.multiply(original).normalize();
    joint.rotationQuaternion.copyFrom(q);
    const error=B.Vector3.Distance(position(hand),target);
    if(error+1e-7<best){best=error;bestQ=q.clone();}
   }
   joint.rotationQuaternion.copyFrom(bestQ);
   return best<before-1e-7?theta:0;
  };
  const measurements={};
  for(const a of arms){
   const hand=byName.get(a.hand),offset=TARGETS[a.hand];
   const target=ref.add(right.scale(offset.x)).add(up.scale(offset.y)).add(forward.scale(offset.z));
   const used={elL:0,shL:0,elR:0,shR:0};
   // Several small steps prevent the extreme wrist-to-groin folding seen before.
   for(let pass=0;pass<16;pass++){
    for(const name of a.joints){
     const remaining=MAX_ROTATION[name]-used[name];
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
