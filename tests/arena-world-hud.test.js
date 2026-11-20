"use strict";
// ARENA-ENGINE-001 → ARENA-UI-003B: pure World HUD contract tests, no Babylon or DOM.
// Labels are pinned to their fighter and may move only a few pixels; the former
// free packer that carried labels away from their owners was removed on purpose.
const test=require("node:test"), assert=require("node:assert/strict");
const {anchor,Layout,MAX_SHIFT_X,MAX_SHIFT_Y,LIFT,NAME_BELOW}=require("../arena-world-hud.js");
const overlap=(a,b,gap=4)=>a.x<b.x+b.w+gap&&a.x+a.w+gap>b.x&&a.y<b.y+b.h+gap&&a.y+a.h+gap>b.y;
const hit=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
// Head anchors projected with the real ARENA-VIS-001 camera and 5v5 formation
// (ArenaStageView.formation + BABYLON.Vector3.Project in Chromium, 20.11.2026).
const REAL={
 "844x390":{allies:[[456,114],[300,114],[376,161],[151,145],[599,172]],enemies:[[510,73],[570,71],[627,69],[681,66],[733,64]]},
 "932x430":{allies:[[503,126],[331,126],[415,177],[168,160],[661,189]],enemies:[[563,81],[629,78],[692,76],[752,73],[808,71]]},
 "667x375":{allies:[[366,109],[216,109],[289,155],[73,140],[504,165]],enemies:[[418,70],[476,68],[531,66],[583,64],[632,62]]}
};
const plateW=w=>Math.max(44,Math.min(58,w*.062));
for(const [size,{allies,enemies}] of Object.entries(REAL)){
 const [width,height]=size.split("x").map(Number);
 test(`ARENAUI003B: real 5v5 anchors at ${size} — labels stay on their fighter, no collisions`,()=>{
  const w=plateW(width);
  // Ally labels: protection, HP, initiative; the acting one also has a name (+13 px).
  const rows=[...allies.map(([ax,ay],i)=>({id:"a"+i,ax,ay,w,h:i===0?28:15})),
   // Enemy labels: HP, initiative; the target adds the cursor (+14 px); its name
   // hangs under the bars out of flow, so it does not grow the box.
   ...enemies.map(([ax,ay],i)=>({id:"e"+i,ax,ay,w,h:i===0?26:12}))];
  // Turn queue at the top centre (ARENA-UI-003A, 46 px tall, ~250 px wide).
  const queue={x:width/2-125,y:6,w:250,h:46};
  anchor(rows,width,height,{left:8,right:8,top:8,bottom:8},[{...queue,block:true}]);
  for(const r of rows){
   assert.ok(Math.abs(r.shiftX)<=MAX_SHIFT_X&&Math.abs(r.shiftY)<=MAX_SHIFT_Y,`${r.id} pinned: ${r.shiftX},${r.shiftY}`);
   assert.equal(r.crowded,false,r.id+" found a clear spot");
   assert.equal(hit(r,queue),false,r.id+" under the queue");
   // The label stays over its fighter: centre within a few px of the head anchor.
   assert.ok(Math.abs(r.x+r.w/2-r.ax)<=MAX_SHIFT_X&&r.y+r.h<=r.ay+MAX_SHIFT_Y,r.id+" above its head");
  }
  for(let i=0;i<rows.length;i++)for(let j=0;j<i;j++)
   assert.equal(overlap(rows[i],rows[j]),false,`collision ${rows[i].id}/${rows[j].id}`);
 });
}
test("ARENAUI003B: with room, a label sits exactly over its anchor",()=>{
 const rows=[{id:"a",ax:300,ay:200,w:56,h:20}];
 anchor(rows,844,390);
 assert.equal(rows[0].x,272);assert.equal(rows[0].y,200-20-LIFT);
 assert.equal(rows[0].shiftX,0);assert.equal(rows[0].shiftY,0);
});
test("ARENAUI003B: a crowd is never carried away — shifts are bounded and the best effort is reported",()=>{
 // Ten labels on top of each other (the old packer moved them into a shelf
 // far from their owners). Now each stays within the shift limit.
 const rows=Array.from({length:10},(_,i)=>({id:"f"+i,ax:400+(i%5-2)*6,ay:120,w:56,h:14}));
 anchor(rows,844,390);
 for(const r of rows)assert.ok(Math.abs(r.shiftX)<=MAX_SHIFT_X&&Math.abs(r.shiftY)<=MAX_SHIFT_Y,r.id);
 assert.ok(rows.some(r=>r.crowded),"impossible layouts are flagged, not hidden");
});
test("ARENAUI003B: neighbours clear the name hanging under an enemy target's bars",()=>{
 // Real 844×390 case: the far-right target sits a little higher than its neighbour.
 const rows=[{id:"e3",ax:681,ay:66,w:47,h:12},{id:"e4",ax:733,ay:64,w:47,h:26,nameW:120}];
 anchor(rows,844,390);
 const t=rows[1],band={x:t.x+t.w/2-60,y:t.y+t.h,w:120,h:NAME_BELOW};
 assert.equal(overlap(rows[0],band),false,"neighbour under the target's name");
 assert.equal(overlap(rows[0],rows[1]),false);
 assert.ok(Math.abs(rows[0].shiftY)<=MAX_SHIFT_Y&&Math.abs(rows[0].shiftX)<=MAX_SHIFT_X);
});
test("ARENAUI003B: a hidden label (fighter away) takes no room from the others",()=>{
 const rows=[{id:"target",ax:500,ay:80,w:52,h:24},{id:"runner",ax:500,ay:80,w:52,h:15,ghost:true}];
 anchor(rows,844,390);
 assert.equal(rows[0].shiftX,0);assert.equal(rows[0].shiftY,0);assert.equal(rows[0].crowded,false);
});
test("ARENAUI003B: labels stay inside the safe area and are reproducible",()=>{
 const rows=[{id:"edge",ax:20,ay:90,w:56,h:14},{id:"right",ax:660,ay:90,w:56,h:14}];
 anchor(rows,667,375,{left:59,right:12,top:8,bottom:8});
 assert.ok(rows[0].x>=59,"label behind the notch");
 assert.ok(rows[1].x+rows[1].w<=667-12,"label behind the right safe area");
 const make=()=>REAL["844x390"].enemies.map(([ax,ay],i)=>({id:"e"+i,ax,ay,w:52,h:12}));
 const a=make(),b=make().reverse();
 anchor(a,844,390);anchor(b,844,390);
 assert.deepEqual(a.map(r=>[r.id,r.x,r.y]).sort(),b.map(r=>[r.id,r.x,r.y]).sort());
});
test("ARENAUI003B: a fixed control moves the label down a little, not across the screen",()=>{
 const control={x:480,y:20,w:120,h:46,block:true};
 const rows=[{id:"ves",ax:540,ay:78,w:52,h:12}];
 anchor(rows,844,390,undefined,[control]);
 assert.equal(hit(rows[0],control),false);
 assert.ok(rows[0].shiftY>0&&rows[0].shiftY<=MAX_SHIFT_Y);
 assert.equal(rows[0].shiftX,0);
});
test("lifecycle disconnects observer, removes dead rows and reports label bottoms",()=>{
 const overlay={clientWidth:844,clientHeight:200};
 const layout=new Layout(overlay);
 const fake=()=>({style:{setProperty(){}}});
 layout.begin();layout.track("alive",fake(),100,70);layout.track("dead",fake(),200,75);
 layout.place();assert.equal(layout.rows.size,2);
 assert.equal(layout.bottomOf("alive"),70-LIFT,"bottom of the label just above the head");
 assert.equal(layout.bottomOf("nobody"),null);
 // An enemy target's name hangs below the bars: numbers start under it.
 const named={style:{setProperty(){}},classList:{contains:c=>c==="enemy"||c==="named"}};
 layout.begin();layout.track("alive",layout.rows.get("alive").el,100,70);layout.track("dead",layout.rows.get("dead").el,200,75);
 layout.track("target",named,300,80);layout.place();
 assert.equal(layout.bottomOf("target"),80-LIFT+NAME_BELOW);
 layout.begin();layout.track("alive",layout.rows.get("alive").el,100,70);
 layout.place();assert.equal(layout.rows.size,1,"dead and target rows retired");
 layout.dispose();assert.equal(layout.rows.size,0);
});
