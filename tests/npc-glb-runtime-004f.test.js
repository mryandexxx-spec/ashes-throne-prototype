"use strict";
// ARENA-ART-004F: Hit_Reaction window, throws blended into the stance, ally stand-in yaw
// (no browser; the real frames are checked by tests/npc-glb-browser.cjs).
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
global.NpcModelAssets=require("../dev/src/assets/npc-models.js");
const runtime=require("../npc-glb-runtime.js");
const profiles=require("../animation-profiles.js");
const ids=Object.keys(NpcModelAssets.models);
const THROW_SLOTS=[["Over_Shoulder_Throw","basic"],["Over_Shoulder_Throw","special"],
 ["Over_Shoulder_Throw","powerful"],["Crouch_Charge_and_Throw","powerful"]];

test("ARENA-ART-004F: Hit_Reaction window puts the measured recoil right after contact",()=>{
 const w=runtime.WINDOWS.Hit_Reaction.hit;
 assert.ok(w,"Hit_Reaction has a window for the hit slot");
 // Measured (docs/evidence/arenaart004f/clip-measure.json): thrown back fastest at .41-.43,
 // furthest back at .48-.54; recovered by .86. The window starts before the recoil and
 // skips the clip's own still start; it ends after the recovery.
 assert.ok(w.keys[0][1]>=.3&&w.keys[0][1]<.41,"starts before the recoil");
 const peak=w.keys.find(([,f])=>f>=.48&&f<=.54);
 assert.ok(peak,"a knot sits on the measured recoil peak");
 assert.ok(peak[0]<=.15,"recoil peaks within the first 15% of the slot");
 assert.ok(w.keys[w.keys.length-1][1]>=.78,"ends after the recovery");
 for(const id of ids){
  assert.equal(runtime.clipFor(id,"hit"),"Hit_Reaction",id);
  const hit=profiles.resolve(id,"hit");
  assert.equal(hit.durationMs,800,id+" pace kept: 800 ms");
  assert.equal(hit.peak,peak[0],id+" template push-back peaks with the clip");
  assert.equal(runtime.stanceBlend(id,"hit",1),0,id+" hit is not blended");
 }
 // Heroes and the capsule fallback keep the 0.42 push-back.
 assert.equal(profiles.resolve("liora","hit").peak,undefined);
 const source=read("battle-animation.js");
 assert.match(source,/Number\.isFinite\(profile\.peak\)&&profile\.peak>0&&profile\.peak<1\?profile\.peak:\.42/);
});

test("ARENA-ART-004F: throws end blended into the stance, the blow is untouched",()=>{
 for(const [clip,slot] of THROW_SLOTS){
  const w=runtime.WINDOWS[clip][slot],name=clip+"."+slot;
  assert.ok(Number.isFinite(w.blendOut),name+" has a blend into the stance");
  assert.ok(w.blendOut>w.contact,name+" blend starts after the release");
  assert.ok(w.blendOut<1,name);
 }
 for(const id of ids)for(const slot of ["basic","special","powerful"]){
  const clip=runtime.clipFor(id,slot),blend=p=>runtime.stanceBlend(id,slot,p);
  if(!/Throw/.test(clip)){assert.equal(blend(1),0,id+" "+slot+" no blend outside throws");continue;}
  const contact=runtime.contactFor(id,slot);
  assert.equal(blend(contact),0,id+" "+slot+" full clip pose at the release");
  assert.equal(blend(1),1,id+" "+slot+" stance pose at the end");
  let prev=0;
  for(let p=0;p<=1.0001;p+=.01){const b=blend(p);assert.ok(b>=prev-1e-12,id+" blend grows");prev=b;}
  // Contact is still the profile's contact fraction (throw leaves the hand on time).
  assert.equal(profiles.resolve(id,slot).contactFraction,contact,id+" "+slot);
 }
});

test("ARENA-ART-004F: ally stand-ins turn toward the camera like enemies (mirrored)",()=>{
 const deg=r=>Math.round(r*180/Math.PI);
 assert.equal(deg(runtime.STANCE_YAW.enemy),-35);
 assert.equal(deg(runtime.STANCE_YAW.ally),35);
 // Only allies with an enemy model get it: heroes have their own GLB runtimes.
 for(const id of ["kael","lyra","darin"])assert.ok(runtime.standIn(id),id);
 const game=read("game.js");
 assert.match(game,/npcGlb\?\.isReady\?NpcGlbRuntime\.STANCE_YAW\?\.\[h\.side\]\|\|0:0/);
});

test("ARENA-ART-004F: browser test and workflow renamed, CI still runs them",()=>{
 assert.ok(fs.existsSync(path.join(root,"tests/npc-glb-browser.cjs")));
 assert.ok(!fs.existsSync(path.join(root,"tests/npc-glb-004c-browser.cjs")));
 const wf=read(".github/workflows/npc-glb-browser.yml");
 assert.match(wf,/node tests\/npc-glb-browser\.cjs/);
 assert.match(wf,/NPC_BROWSER=webkit node tests\/npc-glb-browser\.cjs/);
 assert.match(wf,/'tests\/npc-glb-browser\.cjs'/);
 assert.match(wf,/'\.github\/workflows\/npc-glb-browser\.yml'/);
});
