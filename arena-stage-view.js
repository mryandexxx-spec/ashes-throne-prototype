/* ARENA-ENGINE-002: camera and 3+2 formation extracted into one presentation-only
   contract, based on Dune v94 and owner-reviewed Ashes A/B WebGL previews.
   No gameplay ownership, Babylon dependency or new render loop. */
const ArenaStageView=(()=>{
 "use strict";
 const radians=degrees=>degrees*Math.PI/180;
 // The approved Ashes close-up (PR #278), turned -8 deg after visual review.
 const NEAR_X=-11.5, NEAR_Z=10;
 const AZIMUTH=Math.atan2(NEAR_Z,NEAR_X)-radians(8);
 const RADIUS=15.5;
 const VIEW=Object.freeze({
   alpha:AZIMUTH,
   beta:Math.acos(3.3/RADIUS),
   radius:RADIUS,
   targetY:1.35,
   fov:radians(34),
   minRadius:12,
   maxRadius:21
 });
 const span=Math.hypot(NEAR_X,NEAR_Z);
 const near=Object.freeze({x:NEAR_X/span,z:NEAR_Z/span});
 const tangent=Object.freeze({x:near.z,z:-near.x});

 function formation(side,slot,count){
   if(side!=="ally"&&side!=="enemy")throw Error("arena: invalid team side");
   if(!Number.isInteger(count)||count<1||count>5)throw Error("arena: party size must be 1..5");
   if(!Number.isInteger(slot)||slot<0||slot>=count)throw Error("arena: invalid formation slot");
   const front=Math.min(3,count),back=count-front,isBack=slot>=front;
   const rank=isBack?slot-front:slot,rowSize=isBack?back:front;
   const signed=side==="ally"?1:-1;
   const depth=signed*(2.65+(isBack?1.10:-.55));
   // Give ally and enemy lanes opposite screen-space halves, without crowding.
   const lateral=(side==="ally"?3.45:-3.45)+(rank-(rowSize-1)/2)*2.35;
   return {x:near.x*depth+tangent.x*lateral,z:near.z*depth+tangent.z*lateral};
 }
 // MOBILEQA001 [ПРЕДЛОЖЕНИЕ]: resting GLB heroes stand three-quarter to the
 // viewer, turned toward the opposing lane, instead of world +X (which under the
 // ARENA-ENGINE-003 camera shows their backs). Body-local +X is the model front,
 // matching the existing attack yaw -atan2(dz,dx) in game.js.
 const IDLE_TURN=radians(70);
 const toCamera=Object.freeze({x:Math.cos(VIEW.alpha),z:Math.sin(VIEW.alpha)});
 const screenRight=Object.freeze({x:-toCamera.z,z:toCamera.x});
 function idleFacing(side){
   if(side!=="ally"&&side!=="enemy")throw Error("arena: invalid team side");
   const sign=side==="ally"?1:-1;
   return {x:Math.cos(IDLE_TURN)*toCamera.x+sign*Math.sin(IDLE_TURN)*screenRight.x,
    z:Math.cos(IDLE_TURN)*toCamera.z+sign*Math.sin(IDLE_TURN)*screenRight.z};
 }
 function idleYaw(side){const d=idleFacing(side);return -Math.atan2(d.z,d.x);}
 return Object.freeze({view:VIEW,formation,idleFacing,idleYaw,screenRight,toCamera});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=ArenaStageView;
