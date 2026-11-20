"use strict";
// ARENA-ART-004E: sarkh (snake-bodied) enemy models — rig roles, baked tail, profiles by role.
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.join(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
global.NpcModelAssets=require("../dev/src/assets/npc-models.js");
const runtime=require("../npc-glb-runtime.js");
const profiles=require("../animation-profiles.js");
const SARKH=["npc-sarkh-convoy-guard","npc-sarkh-land-courier"];
const COMBAT=["Combat_Stance","Thrust_Slash","Over_Shoulder_Throw","Block1","Charged_Spell_Cast","Hit_Reaction","dying_backwards"];
const glb=file=>{
 const b=fs.readFileSync(path.join(root,file)),n=b.readUInt32LE(12);
 return JSON.parse(b.subarray(20,20+n).toString("utf8"));
};

test("ARENA-ART-004E: sarkh manifest entries name the SmartRig source and the clip donor",()=>{
 const want={"npc-sarkh-convoy-guard":"01-MTJAAr","npc-sarkh-land-courier":"05-u89dFh"};
 for(const id of SARKH){
  const m=NpcModelAssets.models[id];
  assert.equal(m.source,"assets/npc-source/"+want[id]+"/model.glb");
  assert.match(m.clipDonor,/^assets\/npc-source\/\d\d-\w+\/model\.glb$/);
  assert.ok(m.bytes<1.5*1024*1024,id+" budget");
  // Snakes do not walk: run/walk fall back to the stance.
  assert.equal(m.clips.run,"Combat_Stance");assert.equal(m.clips.walk,"Combat_Stance");
 }
 const g=NpcModelAssets.models["npc-sarkh-convoy-guard"].clips,c=NpcModelAssets.models["npc-sarkh-land-courier"].clips;
 assert.deepEqual([g.basic,g.special,g.powerful,g.guard],["Thrust_Slash","Block1","Block1","Block1"]); // tank
 assert.deepEqual([c.basic,c.special,c.powerful,c.guard],["Over_Shoulder_Throw","Over_Shoulder_Throw","Over_Shoulder_Throw","Block1"]);
});

test("ARENA-ART-004E: rig carries role bones, a tail and no legs; tail is animated in every clip",()=>{
 for(const id of SARKH){
  const g=glb(NpcModelAssets.models[id].url),names=g.nodes.map(n=>n.name||"");
  for(const role of ["Hips","Spine","neck","Head","LeftArm","LeftForeArm","LeftHand","RightArm","RightForeArm","RightHand","SnakeBody"])
   assert.ok(names.includes(role),id+" "+role);
  for(const leg of ["LeftUpLeg","LeftFoot","RightUpLeg","RightFoot"])assert.ok(!names.includes(leg),id+" no "+leg);
  const tail=g.nodes.map((n,i)=>[n.name||"",i]).filter(([n])=>/^Tail_\d_\d\d$/.test(n));
  assert.ok(tail.length>=8,id+" tail bones "+tail.length);
  const tailIdx=new Set(tail.map(([,i])=>i));
  assert.deepEqual(g.animations.map(a=>a.name).sort(),[...COMBAT].sort());
  for(const a of g.animations){
   // rotation only: the coil never slides, nothing is translated or scaled
   assert.ok(a.channels.every(ch=>ch.target.path==="rotation"),id+" "+a.name+" rotation only");
   const animated=new Set(a.channels.map(ch=>ch.target.node));
   assert.ok([...tailIdx].filter(i=>animated.has(i)).length===tailIdx.size,id+" "+a.name+" drives the whole tail");
  }
 }
});

test("ARENA-ART-004E: profiles by role; measured windows and contacts apply unchanged",()=>{
 const tank=profiles.resolve("npc-pass-guard","basic");
 assert.equal(profiles.resolve("npc-sarkh-convoy-guard","basic"),tank);
 assert.equal(profiles.resolve("npc-sarkh-convoy-guard","special").kind,"guard");
 for(const slot of ["basic","special","powerful"]){
  const p=profiles.resolve("npc-sarkh-land-courier",slot);
  assert.equal(p.rooted,true,"courier "+slot+" thrown from its place");
  assert.equal(p.contactFraction,runtime.contactFor("npc-sarkh-land-courier",slot),"contact = window knot "+slot);
 }
 assert.deepEqual(runtime.windowFor("npc-sarkh-land-courier","powerful"),runtime.windowFor("npc-ridge-slinger","basic"));
 for(const id of SARKH){
  assert.equal(runtime.heightFor(id),runtime.HEIGHT);
  assert.equal(profiles.resolve(id,"death").clipFall,true);
 }
});

test("ARENA-ART-004E: runtime anchors a sarkh on its upright body, not the coil bounds",()=>{
 const src=read("npc-glb-runtime.js");
 assert.match(src,/node\.name==="SnakeBody"/);
 assert.match(src,/root\.position\.set\(-cz\*scale,\.14-\.8-min\.y\*scale,cx\*scale\)/);
 const tool=read("tools/build-npc-models.mjs");
 assert.match(tool,/buildSarkhRig\(input, sourceGlb\(npc\.donor\)/);
});
