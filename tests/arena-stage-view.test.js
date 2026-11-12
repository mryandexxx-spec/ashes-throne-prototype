"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const {view,formation}=require("../arena-stage-view.js");
test("ARENA-ENGINE-002: approved shot retains portrait scale and -8deg azimuth",()=>{
 assert.ok(Math.abs(view.radius-15.5)<1e-10);
 assert.ok(Math.abs(view.fov*180/Math.PI-34)<1e-10);
 const delta=(Math.atan2(10,-11.5)-view.alpha)*180/Math.PI;
 assert.ok(Math.abs(delta-8)<1e-10);
});
test("ARENA-ENGINE-002: 3 front + 2 rear on both teams, distinct positions",()=>{
 for(const side of ["ally","enemy"])for(let count=1;count<=5;count++){
  const result=Array.from({length:count},(_,slot)=>formation(side,slot,count));
  assert.equal(new Set(result.map(p=>p.x.toFixed(6)+","+p.z.toFixed(6))).size,count);
 }
});
test("ARENA-ENGINE-002: allies and enemies stay in opposite camera-space halves",()=>{
 const a=Array.from({length:5},(_,i)=>formation("ally",i,5));
 const e=Array.from({length:5},(_,i)=>formation("enemy",i,5));
 const near={x:-11.5/Math.hypot(-11.5,10),z:10/Math.hypot(-11.5,10)};
 const lateral=p=>p.x*near.z-p.z*near.x;
 assert.ok(a.every(p=>lateral(p)>0),"ally lane is positive in screen-space tangent");
 assert.ok(e.every(p=>lateral(p)<0),"enemy lane is negative in screen-space tangent");
});
test("ARENA-ENGINE-002: rejects invalid slots and parties",()=>{
 assert.throws(()=>formation("ally",-1,5));
 assert.throws(()=>formation("ally",5,5));
 assert.throws(()=>formation("ally",0,0));
 assert.throws(()=>formation("ally",0,6));
 assert.throws(()=>formation("unknown",0,5));
});
