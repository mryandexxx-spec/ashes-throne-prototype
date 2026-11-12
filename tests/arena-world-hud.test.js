"use strict";
// ARENA-ENGINE-001: pure World HUD contract tests, no Babylon or DOM required.
const test=require("node:test"), assert=require("node:assert/strict");
const {pack,Layout}=require("../arena-world-hud.js");
const overlap=(a,b,gap=5)=>a.x<b.x+b.w+gap&&a.x+a.w+gap>b.x&&a.y<b.y+b.h+gap&&a.y+a.h+gap>b.y;
for(const [width,height] of [[844,390],[667,375],[667,210],[844,210]]){
 test(`packed HUD has no collisions at ${width}x${height}`,()=>{
  const rows=Array.from({length:10},(_,i)=>({id:"f"+i,ax:width/2+(i%5-2)*18,ay:70+Math.floor(i/5)*30,w:70,h:27}));
  pack(rows,width,height);
  for(let i=0;i<rows.length;i++){
   const a=rows[i];assert.ok(a.x>=8&&a.x+a.w<=width-8,`horizontal clipping ${a.id}`);
   assert.ok(a.y>=8&&a.y+a.h<=height-8,`vertical clipping ${a.id}`);
   for(let j=0;j<i;j++)assert.equal(overlap(a,rows[j]),false,`collision ${a.id}/${rows[j].id}`);
  }
 });
}
test("reproducible positions independent of insertion order",()=>{
 const make=()=>Array.from({length:10},(_,i)=>({id:"f"+i,ax:320+(i%5-2)*14,ay:72+(i%2)*20,w:70,h:28}));
 const a=make(),b=make().reverse();
 pack(a,667,210);pack(b,667,210);
 assert.deepEqual(a.map(r=>[r.id,r.x,r.y]).sort(),b.map(r=>[r.id,r.x,r.y]).sort());
});
test("lifecycle disconnects observer and removes dead rows",()=>{
 const overlay={clientWidth:844,clientHeight:200};
 const layout=new Layout(overlay);
 const fake=()=>({style:{setProperty(){}}});
 layout.begin();layout.track("alive",fake(),100,70);layout.track("dead",fake(),200,75);
 layout.place();assert.equal(layout.rows.size,2);
 layout.begin();layout.track("alive",layout.rows.get("alive").el,100,70);
 layout.place();assert.equal(layout.rows.size,1);
 layout.dispose();assert.equal(layout.rows.size,0);
});
