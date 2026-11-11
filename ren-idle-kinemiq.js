/* RENIDLE010 — KinemIQ Idle_relaxed (CC0) sampled animation delta overlay.
 * SOURCE: KinemIQ_Free_Animations_CC0_GLB.zip / GLB/Idle_relaxed.glb
 * 14 sampled keys from 76 frames / 2.5 seconds at 30fps. Rotations are local
 * quaternion deltas relative to the source's first frame (not raw bind poses).
 * This is a conservative upper-body motion transfer, NOT a full humanoid
 * retarget: Ren's bones and skinning remain unchanged. Legs stay planted.
 * Source license CC0 1.0, Quaternius / KinemIQ — README of the supplied pack.
 */
const RenKinemIQIdle=(()=>{
 "use strict";
 const DURATION_MS=2500;
 const TIMES=Object.freeze([0,6,12,18,24,30,36,42,48,54,60,66,72,75]);
 // Each triple is quaternion delta x,y,z scaled by 10000.
 const CHANNELS=Object.freeze([
  Object.freeze({source:"spine_02",target:"spine",weight:.65,data:[0,0,0,-75,0,0,-76,0,0,-7,0,0,68,0,0,82,0,0,15,0,0,-66,0,0,-83,0,0,-21,0,0,58,0,0,87,0,0,29,0,0,-15,0,0]}),
  Object.freeze({source:"spine_03",target:"chest",weight:.65,data:[0,0,0,-75,0,0,-76,0,0,-7,0,0,68,0,0,82,0,0,15,0,0,-66,0,0,-83,0,0,-21,0,0,58,0,0,87,0,0,29,0,0,-15,0,0]}),
  Object.freeze({source:"Head",target:"head",weight:.85,data:[0,0,0,-103,0,14,-266,0,15,-334,0,1,-244,0,-13,-81,0,-16,20,0,-3,-47,0,13,-216,0,16,-345,0,4,-298,0,-11,-136,0,-17,19,0,-6,34,0,3]}),
  Object.freeze({source:"upperarm_l",target:"shL",weight:.6,data:[0,0,0,99,68,23,290,197,75,414,281,116,346,235,93,160,109,38,13,9,3,48,33,11,226,154,57,390,264,108,390,264,108,226,154,57,48,33,11,3,2,1]}),
  Object.freeze({source:"upperarm_r",target:"shR",weight:.6,data:[0,0,0,-26,19,-14,71,-52,37,196,-143,98,241,-176,120,149,-109,76,17,-13,9,-33,24,-17,50,-37,26,177,-130,90,244,-178,121,171,-125,86,37,-27,19,-14,11,-8]}),
  Object.freeze({source:"lowerarm_l",target:"elL",weight:.58,data:[0,0,0,-175,-94,58,-339,-277,164,-341,-395,234,-179,-328,201,-3,-151,96,34,-12,8,-110,-46,28,-295,-216,129,-364,-372,219,-242,-369,224,-53,-213,134,46,-45,29,19,-3,2]}),
  Object.freeze({source:"lowerarm_r",target:"elR",weight:.58,data:[0,0,0,0,-18,18,0,50,-47,0,136,-131,0,168,-161,0,104,-100,0,12,-12,0,-23,22,0,35,-33,0,124,-118,0,170,-163,0,119,-114,0,26,-25,0,-10,10]})
 ]);
 const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
 function sample(channel,ms){
  const frame=((ms%DURATION_MS)+DURATION_MS)%DURATION_MS*30/1000;
  let index=TIMES.length-2;
  for(let i=0;i<TIMES.length-1;i++){
   if(frame<TIMES[i+1]){index=i;break;}
  }
  const next=index+1;
  const blend=clamp((frame-TIMES[index])/(TIMES[next]-TIMES[index]),0,1);
  const data=channel.data;
  return [0,1,2].map(k=>(data[index*3+k]*(1-blend)+data[next*3+k]*blend)*channel.weight/10000);
 }
 // A rare look left/right, with smooth falloff and a clear rest state.
 function glance(ms){
  const period=((ms%14000)+14000)%14000;
  const wave=(start,end,direction)=>{
   if(period<start||period>end)return 0;
   const t=(period-start)/(end-start);
   return direction*Math.sin(Math.PI*t)**2;
  };
  return .14*wave(4500,6600,1)+.11*wave(9800,11800,-1);
 }
 function create(B,nodes){
  if(!B?.Quaternion||!Array.isArray(nodes))return null;
  const baseline=new Map(nodes.filter(n=>n.rotationQuaternion).map(n=>[n.name,n.rotationQuaternion.clone()]));
  const found=CHANNELS.filter(c=>baseline.has(c.target));
  if(!found.length)return null;
  const targets=new Map(nodes.filter(n=>baseline.has(n.name)).map(n=>[n.name,n]));
  return ms=>{
   for(const channel of found){
    const node=targets.get(channel.target);
    const [x,y,z]=sample(channel,ms);
    const rot=new B.Quaternion(x,y,z,Math.sqrt(Math.max(0,1-x*x-y*y-z*z)));
    // Keep the source rig's bind posture; only sampled motion is additive.
    let next=baseline.get(channel.target).multiply(rot);
    if(channel.target==="head"){
     next=next.multiply(B.Quaternion.RotationYawPitchRoll(glance(ms),0,0));
    }
    node.rotationQuaternion.copyFrom(next);
   }
  };
 }
 return Object.freeze({DURATION_MS,TIMES,CHANNELS,sample,glance,create});
})();
if(typeof module!=="undefined")module.exports=RenKinemIQIdle;
