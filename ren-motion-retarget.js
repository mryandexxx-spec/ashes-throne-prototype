/* RENRETARGET014: world-axis retarget of actual KinemIQ CC0 GLB motion onto Ren.
 * We have 19 motion source joints, while production Ren has ~15 articulating joints:
 * missing neck, clavicles and finger chains are safely collapsed into their child
 * target joint. Source root translation is intentionally not transferred.
 * NO arbitrary static leg/knee angles: actual source animation deltas in world
 * space are rotated into Ren's *own* rest-pose bone axes.
 * Source data lives in ren-kinemiq-retarget-data.js and is licensed CC0 1.0.
 */
const RenMotionRetarget=(()=>{
 "use strict";
 // Per-channel gain: safeguard against differing limb proportions and pinned
 // feet. Multiple KinemIQ source bones can sensibly contribute to one Ren joint.
 const MAPPINGS=Object.freeze([
  ["pelvis","hips",.38],
  ["spine_02","spine",.7],["spine_03","spine",.7],
  ["neck_01","head",.45],["Head","head",1],
  ["clavicle_l","shL",.75],["upperarm_l","shL",1],
  ["lowerarm_l","elL",.9],["hand_l","handL",.75],
  ["clavicle_r","shR",.75],["upperarm_r","shR",1],
  ["lowerarm_r","elR",.9],["hand_r","handR",.75],
  ["thigh_l","hipL",.34],["calf_l","kneeL",.34],["foot_l","ankL",.28],
  ["thigh_r","hipR",.34],["calf_r","kneeR",.34],["foot_r","ankR",.28]
 ]);
 const CLIP_SOURCE=typeof RenRetargetData!=="undefined"?RenRetargetData:
   (typeof require!=="undefined"?require("./ren-kinemiq-retarget-data.js"):null);
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 function decodeClip(clip,bones){
  if(!clip||!bones?.length)throw Error("KinemIQ clip data missing");
  const str=typeof atob==="function"?atob(clip.encoded):
   Buffer.from(clip.encoded,"base64").toString("binary");
  const buffer=new ArrayBuffer(str.length);
  const bytes=new Uint8Array(buffer);
  for(let i=0;i<str.length;i++)bytes[i]=str.charCodeAt(i);
  const ncoeff=1+2*clip.harmonics;
  const expected=bones.length*ncoeff*3*2;
  if(bytes.byteLength!==expected)throw Error("KinemIQ clip truncated: "+bytes.byteLength+" != "+expected);
  const view=new DataView(buffer);
  const values=new Float32Array(expected/2);
  for(let i=0;i<values.length;i++)values[i]=view.getInt16(i*2,true)/12000;
  return Object.freeze({durationMs:clip.durationMs,harmonics:clip.harmonics,
   coeffs:values,count:ncoeff,boneCount:bones.length});
 }
 function evaluate(clip,boneIndex,ms,out=[0,0,0]){
  const phase=2*Math.PI*((ms%clip.durationMs)+clip.durationMs)% (2*Math.PI*clip.durationMs)/clip.durationMs;
  const offset=boneIndex*clip.count*3,a=clip.coeffs;
  for(let c=0;c<3;c++)out[c]=a[offset+c];
  for(let k=1;k<=clip.harmonics;k++){
   const cv=Math.cos(k*phase),sv=Math.sin(k*phase),ix=offset+(k*2-1)*3,iy=ix+3;
   for(let c=0;c<3;c++)out[c]+=a[ix+c]*cv+a[iy+c]*sv;
  }
  return out;
 }
 function talkStrength(ms){
  const phase=((ms%27000)+27000)%27000;
  const enter=clamp((phase-11000)/1100,0,1);
  const leave=clamp((16600-phase)/1100,0,1);
  const smooth=v=>v*v*(3-2*v);
  return .53*smooth(enter)*smooth(leave);
 }
 function create(B,nodes){
  if(!B?.Quaternion||!B?.Vector3||!CLIP_SOURCE||!Array.isArray(nodes))return null;
  const byName=new Map(nodes.filter(n=>n.rotationQuaternion).map(n=>[n.name,n]));
  const map=MAPPINGS.filter(([src,target])=>byName.has(target)&&CLIP_SOURCE.bones.includes(src));
  const required=["hips","spine","head","shL","shR","elL","elR","hipL","hipR","kneeL","kneeR","ankL","ankR"];
  if(required.some(n=>!byName.has(n))||map.length<14)return null;
  const relaxed=decodeClip(CLIP_SOURCE.clips.relaxed,CLIP_SOURCE.bones);
  const talking=decodeClip(CLIP_SOURCE.clips.talking,CLIP_SOURCE.bones);
  const sourceIndices=new Map(CLIP_SOURCE.bones.map((name,i)=>[name,i]));
  const base=new Map(),worldInverse=new Map();
  for(const [,target] of map){
   if(base.has(target))continue;
   const node=byName.get(target);
   base.set(target,node.rotationQuaternion.clone());
   // World rest rotation includes imported Wanderer rig and all ancestors.
   // Compute before any retarget motion; no bind-pose guesswork.
   node.computeWorldMatrix?.(true);
   const rotation=new B.Quaternion(),scale=new B.Vector3(),position=new B.Vector3();
   node.getWorldMatrix().decompose(scale,rotation,position);
   worldInverse.set(target,rotation.conjugate().normalize());
  }
  // Scratch vectors are reused; no per-frame GLTF loads or new meshes.
  const vec=[0,0,0],gesture=[0,0,0];
  const groups=new Map();
  for(const [src,target,gain] of map){
   if(!groups.has(target))groups.set(target,[]);
   groups.get(target).push({index:sourceIndices.get(src),gain});
  }
  return ms=>{
   const t=ms*.76; // longer, calmer relaxed loop
   const tTalk=ms-11000; // a rare short gesture with eased entry/exit
   const gestureGain=talkStrength(ms);
   for(const [target,channels] of groups){
    const bone=byName.get(target),axis=worldInverse.get(target);
    let x=0,y=0,z=0;
    for(const ch of channels){
     evaluate(relaxed,ch.index,t,vec);
     if(gestureGain>0){
      evaluate(talking,ch.index,tTalk,gesture);
      for(let a=0;a<3;a++)vec[a]=vec[a]*(1-gestureGain)+gesture[a]*gestureGain;
     }
     x+=vec[0]*ch.gain;y+=vec[1]*ch.gain;z+=vec[2]*ch.gain;
    }
    // Change from source (Y-up global) axes to target bone-local axes.
    // No Euler-angle guessing; this preserves direction under Ren's rig axes.
    const v=new B.Vector3(x,y,z);
    const local=B.Vector3.TransformCoordinates(v,
      B.Matrix.FromQuaternion(axis)); // inverse world-rest orientation
    const magnitude=local.length();
    const q=magnitude>1e-9
     ?B.Quaternion.RotationAxis(local.scale(1/magnitude),magnitude)
     :B.Quaternion.Identity();
    bone.rotationQuaternion.copyFrom(base.get(target).multiply(q));
   }
  };
 }
 return Object.freeze({MAPPINGS,decodeClip,evaluate,talkStrength,create});
})();
if(typeof module!=="undefined")module.exports=RenMotionRetarget;
