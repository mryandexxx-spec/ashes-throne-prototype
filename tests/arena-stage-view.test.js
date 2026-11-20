"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {view,formation}=require("../arena-stage-view.js");
test("ARENA-VIS-001: over-the-shoulder SWGOH shot keeps the established azimuth",()=>{
 assert.equal(view.radius,7.6);assert.equal(view.beta,1.12);assert.equal(view.fov,.85);
 assert.ok(view.minRadius<view.radius&&view.radius<view.maxRadius);
 const delta=(Math.atan2(10,-11.5)-view.alpha)*180/Math.PI;
 assert.ok(Math.abs(delta-8)<1e-10);
});
test("ARENA-VIS-001: distinct positions for every party size",()=>{
 for(const side of ["ally","enemy"])for(let count=1;count<=5;count++){
  const result=Array.from({length:count},(_,slot)=>formation(side,slot,count));
  assert.equal(new Set(result.map(p=>p.x.toFixed(6)+","+p.z.toFixed(6))).size,count);
 }
});
test("ARENA-VIS-001: allies stand near the camera, enemies deeper in the frame",()=>{
 const {toCamera}=require("../arena-stage-view.js");
 const depth=p=>p.x*toCamera.x+p.z*toCamera.z;
 for(let count=1;count<=5;count++){
  const a=Array.from({length:count},(_,i)=>formation("ally",i,count));
  const e=Array.from({length:count},(_,i)=>formation("enemy",i,count));
  assert.ok(Math.min(...a.map(depth))>Math.max(...e.map(depth))+2.5,"teams separated in depth");
 }
});
test("ARENA-VIS-001: no fighter hides another in the 844x390 shot",()=>{
 // Pinhole projection of feet and head with the real view; bodies ~1 m wide (shield, cloak).
 const {toCamera,screenRight}=require("../arena-stage-view.js");
 const cam={x:toCamera.x*Math.sin(view.beta)*view.radius,y:view.targetY+Math.cos(view.beta)*view.radius,z:toCamera.z*Math.sin(view.beta)*view.radius};
 const fwd=(()=>{const v={x:-cam.x,y:view.targetY-cam.y,z:-cam.z},l=Math.hypot(v.x,v.y,v.z);return {x:v.x/l,y:v.y/l,z:v.z/l};})();
 const right={x:screenRight.x,y:0,z:screenRight.z};
 let up={x:right.y*fwd.z-right.z*fwd.y,y:right.z*fwd.x-right.x*fwd.z,z:right.x*fwd.y-right.y*fwd.x};
 if(up.y<0)up={x:-up.x,y:-up.y,z:-up.z}; // screen up must point to world +Y
 const f=195/Math.tan(view.fov/2);
 const project=(x,y,z)=>{const d={x:x-cam.x,y:y-cam.y,z:z-cam.z};const k=d.x*fwd.x+d.y*fwd.y+d.z*fwd.z;
  return {sx:422+f*(d.x*right.x+d.z*right.z)/k,sy:195+f*-(d.x*up.x+d.y*up.y+d.z*up.z)/k,k};};
 const box=p=>{const feet=project(p.x,0,p.z),head=project(p.x,2.1,p.z),w=f*1/feet.k/2;
  return {x0:feet.sx-w,x1:feet.sx+w,y0:Math.min(feet.sy,head.sy),y1:Math.max(feet.sy,head.sy)};};
 for(let count=1;count<=5;count++){
  const all=[...Array.from({length:count},(_,i)=>formation("ally",i,count)),
   ...Array.from({length:count},(_,i)=>formation("enemy",i,count))].map(box);
  for(const b of all)assert.ok(b.x0>20&&b.x1<824&&b.y0>60&&b.y1<390,"inside frame");
  for(let i=0;i<all.length;i++)for(let j=i+1;j<all.length;j++){
   const a=all[i],b=all[j];
   const ox=Math.max(0,Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0)),oy=Math.max(0,Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0));
   const small=Math.min((a.x1-a.x0)*(a.y1-a.y0),(b.x1-b.x0)*(b.y1-b.y0));
   assert.ok(ox*oy<=small*.05,"fighters "+i+" and "+j+" overlap too much at count "+count);
  }
 }
});
test("ARENA-FIX: enemy formation mirrors the ally formation through one point",()=>{
 const {slots}=require("../arena-stage-view.js");
 assert.equal(slots.enemy.length,slots.ally.length);
 // Point reflection: every pairwise offset is reversed (width scaled, depth kept).
 const k=(slots.enemy[1][0]-slots.enemy[0][0])/(slots.ally[1][0]-slots.ally[0][0]);
 assert.ok(k<-1&&k>-2,"lateral stretch "+k);
 for(let i=1;i<slots.ally.length;i++){
  const a=[slots.ally[i][0]-slots.ally[0][0],slots.ally[i][1]-slots.ally[0][1]];
  const e=[slots.enemy[i][0]-slots.enemy[0][0],slots.enemy[i][1]-slots.enemy[0][1]];
  assert.ok(Math.abs(e[0]-k*a[0])<.03,"slot "+i+" width");
  assert.ok(Math.abs(e[1]+a[1])<1e-9,"slot "+i+" depth");
 }
 // Leaders face each other: both are the front of their team.
 assert.equal(slots.enemy[0][1],Math.max(...slots.enemy.map(p=>p[1])));
});
test("ARENA-ENGINE-002: rejects invalid slots and parties",()=>{
 assert.throws(()=>formation("ally",-1,5));
 assert.throws(()=>formation("ally",5,5));
 assert.throws(()=>formation("ally",0,0));
 assert.throws(()=>formation("ally",0,6));
 assert.throws(()=>formation("unknown",0,5));
});
