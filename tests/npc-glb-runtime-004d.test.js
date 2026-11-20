"use strict";
// ARENA-ART-004D: measured clip windows, contact moments, death without double fall,
// stance yaw, per-archetype height and tinted stand-ins (no browser).
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.join(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
global.NpcModelAssets=require("../dev/src/assets/npc-models.js");
const runtime=require("../npc-glb-runtime.js");
const profiles=require("../animation-profiles.js");
const ids=Object.keys(NpcModelAssets.models);
const ACTIVE=["basic","special","powerful"];

test("ARENA-ART-004D: windows are monotonic knots inside the clip",()=>{
 for(const [clip,slots] of Object.entries(runtime.WINDOWS))for(const [slot,w] of Object.entries(slots)){
  const k=w.keys,name=clip+"."+slot;
  assert.ok(k.length>=2,name);
  assert.equal(k[0][0],0,name);assert.equal(k[k.length-1][0],1,name);
  for(let i=1;i<k.length;i++){
   assert.ok(k[i][0]>k[i-1][0],name+" progress grows");
   assert.ok(k[i][1]>=k[i-1][1],name+" clip never runs backwards");
  }
  for(const [,f] of k)assert.ok(f>=0&&f<=1,name);
  if(w.contact!==undefined)assert.ok(k.some(([p])=>p===w.contact),name+" contact is a knot");
 }
 // Interpolation hits the knots exactly and clamps outside 0..1.
 assert.equal(runtime.clipFraction("npc-pass-guard","basic",.42),.3);
 assert.equal(runtime.clipFraction("npc-pass-guard","basic",-1),0);
 assert.ok(Math.abs(runtime.clipFraction("npc-pass-guard","basic",2)-.82)<1e-9);
 assert.equal(runtime.clipFraction("npc-pass-guard","idle",.5),.5);
 assert.deepEqual(runtime.windowFor("npc-ridge-slinger","death"),[.1,.7]);
 assert.deepEqual(runtime.windowFor("npc-pass-guard","guard"),[.12,.36]);
 assert.deepEqual(runtime.windowFor("npc-pass-guard","ward"),[.34,.42]);
});

test("ARENA-ART-004D: contactFraction of every profile equals the measured window contact",()=>{
 for(const id of ids)for(const slot of ACTIVE){
  const p=profiles.resolve(id,slot),contact=runtime.contactFor(id,slot);
  assert.equal(p.contactFraction??null,contact,id+" "+slot);
  // Every damaging clip has a contact moment; guard-kind slots (block, cast) have none.
  if(p.kind==="lunge")assert.ok(Number.isFinite(contact),id+" "+slot+" needs contact");
  // Melee contact must land while the visual approach holds at the target (.38-.64).
  if(p.kind==="lunge"&&!p.rooted)assert.ok(contact>=.38&&contact<=.64,id+" "+slot+" contact "+contact);
 }
 // The four attack clips named in the plan.
 assert.equal(runtime.contactFor("npc-trail-interceptor","basic"),.42); // Thrust_Slash
 assert.equal(runtime.contactFor("npc-ridge-slinger","basic"),.78);     // Over_Shoulder_Throw
 assert.equal(runtime.contactFor("npc-watch-captain","powerful"),.6);   // Triple_Combo_Attack
 assert.equal(runtime.contactFor("npc-ridge-slinger","powerful"),.75);  // Crouch_Charge_and_Throw
});

test("ARENA-ART-004D: battle pace is not slower than 004C",()=>{
 const before={basic:1800,special:1800,powerful:2600,guard:1500,ward:900,hit:800,death:2000};
 for(const id of ids)for(const [slot,max] of Object.entries(before))
  assert.ok(profiles.resolve(id,slot).durationMs<=max,id+" "+slot);
 assert.equal(profiles.resolve("npc-pass-guard","guard").durationMs,900);
 assert.equal(profiles.resolve("npc-pass-guard","death").durationMs,1400);
});

test("ARENA-ART-004D: enemy death has no template tilt over dying_backwards; heroes keep it",()=>{
 const ctx=vm.createContext({AnimationProfiles:profiles,Math,Number,Array,Set,Map,Object,console});
 vm.runInContext(read("battle-animation.js")+";this.BA=BattleAnimation;",ctx);
 const BA=ctx.BA;
 const tiltAtEnd=id=>{
  BA.clear();BA.enqueue([{type:"death",targetId:id}],null,null);
  BA.tick(0);BA.tick(100);BA.tick(100); // 200 ms into the death cue
  return BA.pose(id).tilt;
 };
 assert.equal(profiles.link("e-death","npc-pass-guard"),true);
 assert.equal(tiltAtEnd("e-death"),0);
 profiles.unlink("e-death");
 assert.ok(tiltAtEnd("e-death")>0,"capsule fallback keeps the template fall");
 assert.ok(tiltAtEnd("liora")>0,"heroes unchanged");
 assert.equal(profiles.resolve("liora","death").clipFall,undefined);
 for(const id of ids)assert.equal(profiles.resolve(id,"death").clipFall,true);
});

test("ARENA-ART-004D: stance yaw, height and stand-ins",()=>{
 const deg=r=>r*180/Math.PI;
 assert.ok(Math.abs(deg(runtime.STANCE_YAW.enemy))>=25&&Math.abs(deg(runtime.STANCE_YAW.enemy))<=45);
 assert.equal(runtime.heightFor("npc-pass-guard"),runtime.HEIGHT);
 assert.ok(runtime.heightFor("npc-laun-ford-guard")>runtime.HEIGHT);
 assert.ok(runtime.heightFor("npc-laun-physician")>runtime.HEIGHT);
 for(const [id,s] of Object.entries(runtime.STAND_INS)){
  assert.equal(runtime.has(id),false,id+" has no model of its own");
  assert.equal(runtime.has(s.archetypeId),true,id);
  assert.equal(runtime.standIn(id),s);
  assert.ok(s.tint.length===3&&s.tint.every(v=>v>0&&v<=1),id+" tint");
 }
 assert.deepEqual(Object.keys(runtime.STAND_INS).sort(),["darin","kael","lyra","shade","ves"]);
 assert.equal(runtime.standIn("ves-3"),runtime.STAND_INS.ves);assert.equal(runtime.standIn("shade-2"),runtime.STAND_INS.shade);
 assert.equal(runtime.standIn("ren"),null);assert.equal(runtime.standIn("__proto__"),null);
 const game=read("game.js");
 const frame=game.slice(game.indexOf("MOBILEQA001: GLB heroes rest"),game.indexOf("if(npcGlb)npcGlb.update(activity)"));
 assert.match(frame,/NpcGlbRuntime\.STANCE_YAW\?\.\[h\.side\]/);
 // Attacks keep the aim branch (turn to target); only the rest branch gets the offset.
 assert.ok(frame.indexOf("nadaAim&&")<frame.indexOf("STANCE_YAW"));
});
