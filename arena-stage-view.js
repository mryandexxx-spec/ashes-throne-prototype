/* ARENA-VIS-001: SWGOH-style battle shot, owner direction 19.11.2026.
   The camera sits behind and above the player's squad: allies are large in the
   lower half of the frame, facing away from the viewer toward the enemy line,
   enemies stand deeper in the frame in the mirrored squad formation.
   Presentation only: no gameplay ownership, Babylon dependency or render loop.
   Positions are authored in camera space (L = screen-right, D = toward camera)
   and chosen so that no fighter hides another at 844x390. */
const ArenaStageView=(()=>{
 "use strict";
 const radians=degrees=>degrees*Math.PI/180;
 // Same azimuth as ARENA-ENGINE-002 (scene/background orientation unchanged).
 const AZIMUTH=Math.atan2(10,-11.5)-radians(8);
 const VIEW=Object.freeze({
   alpha:AZIMUTH,
   beta:1.12,          // ~26 deg above the horizon: over-the-shoulder view
   radius:7.6,
   targetY:1.0,
   fov:.85,            // vertical field of view, radians
   minRadius:6.6,
   maxRadius:10.5
 });
 const toCamera=Object.freeze({x:Math.cos(VIEW.alpha),z:Math.sin(VIEW.alpha)});
 const screenRight=Object.freeze({x:-toCamera.z,z:toCamera.x});
 // Allies: leader nearest the enemy, then flanks; the nearest fighters stand
 // to the sides so they never cover the enemy line.
 const ALLY_SLOTS=Object.freeze([[.5,.6],[-1.8,.6],[-.5,2.5],[-3.2,2],[1.8,2.8]]);
 // Enemies mirror the ally formation (owner, 20.11.2026): the same two-front /
 // three-back pattern reflected through a point between the teams, so leader
 // faces leader and each flank faces a flank. Width is stretched x1.45 to
 // offset perspective, and the centre sits right of the ally leader so his
 // head never covers the enemy front row. Same slot order as the allies.
 const MIRROR=Object.freeze({L:1.1,D:-1.3,spread:1.45});
 const ENEMY_SLOTS=Object.freeze(ALLY_SLOTS.map(([L,D])=>Object.freeze([
   Math.round((MIRROR.L+(MIRROR.L-L)*MIRROR.spread)*100)/100,
   Math.round((2*MIRROR.D-D)*100)/100])));
 const world=([L,D])=>({x:screenRight.x*L+toCamera.x*D,z:screenRight.z*L+toCamera.z*D});

 function formation(side,slot,count){
   if(side!=="ally"&&side!=="enemy")throw Error("arena: invalid team side");
   if(!Number.isInteger(count)||count<1||count>5)throw Error("arena: party size must be 1..5");
   if(!Number.isInteger(slot)||slot<0||slot>=count)throw Error("arena: invalid formation slot");
   return world((side==="ally"?ALLY_SLOTS:ENEMY_SLOTS)[slot]);
 }
 function centroid(points){
   const p=points.map(world);
   return {x:p.reduce((s,v)=>s+v.x,0)/p.length,z:p.reduce((s,v)=>s+v.z,0)/p.length};
 }
 const allyCenter=centroid(ALLY_SLOTS),enemyCenter=centroid(ENEMY_SLOTS);
 // Each team faces the other team (body-local +X is the model front,
 // matching the attack yaw -atan2(dz,dx) in game.js).
 function idleFacing(side){
   if(side!=="ally"&&side!=="enemy")throw Error("arena: invalid team side");
   const from=side==="ally"?allyCenter:enemyCenter,to=side==="ally"?enemyCenter:allyCenter;
   const dx=to.x-from.x,dz=to.z-from.z,len=Math.hypot(dx,dz);
   return {x:dx/len,z:dz/len};
 }
 function idleYaw(side){const d=idleFacing(side);return -Math.atan2(d.z,d.x);}
 return Object.freeze({view:VIEW,slots:Object.freeze({ally:ALLY_SLOTS,enemy:ENEMY_SLOTS}),formation,idleFacing,idleYaw,screenRight,toCamera});
})();
if(typeof module!=="undefined"&&module.exports)module.exports=ArenaStageView;
