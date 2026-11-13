"use strict";
/* NADAANIM001 — Nada's GLB clips play at readable speed in combat. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
global.AnimationProfiles=require("../animation-profiles.js");
const runtime=require("../nada-glb-runtime.js");
const P=global.AnimationProfiles;
// Clip lengths in dev/assets/models/nada-mobile-animated.glb, seconds.
function clipSeconds(){
 const r=fs.readFileSync(path.join(__dirname,"../dev/assets/models/nada-mobile-animated.glb"));
 const g=JSON.parse(r.subarray(20,20+r.readUInt32LE(12)).toString("utf8"));
 return Object.fromEntries(g.animations.map(a=>[a.name,Math.max(...a.samplers.map(s=>g.accessors[s.input].max[0]))]));
}
test("NADAANIM001: Nada has her own profile for every combat slot she animates",()=>{
 for(const slot of ["idle","basic","special","powerful","hit","death"])assert.ok(P.isCustom("nada",slot),slot);
});
test("NADAANIM001: no Nada clip plays more than 2x faster than authored",()=>{
 const sec=clipSeconds();
 for(const slot of ["idle","basic","special","powerful","hit","death"]){
  const clip=runtime.clipFor(slot),[w0,w1]=runtime.windowFor(slot);
  const shownMs=sec[clip]*(w1-w0)*1000,durationMs=P.resolve("nada",slot).durationMs;
  assert.ok(shownMs/durationMs<=2,`${slot}: ${clip} ${Math.round(shownMs)}ms squeezed into ${durationMs}ms`);
 }
});
test("NADAANIM001: powerful uses mage_soell_cast; death shows the fall, not the long lying tail",()=>{
 assert.equal(runtime.clipFor("powerful"),"mage_soell_cast");
 assert.equal(runtime.clipFor("basic"),"Archery_Shot_3");
 const [a,b]=runtime.windowFor("death");
 assert.ok(a>0&&b<1&&b*clipSeconds().Electrocuted_Fall>=5.0,"window must end after the fall lands (~5.0s)");
});
test("NADAANIM001: Nada shoots from her place without a melee lunge",()=>{
 const game=fs.readFileSync(path.join(__dirname,"../game.js"),"utf8");
 assert.match(game,/const approach=h\.id==="nada"\?\{x:0,z:0\}:BattleAnimation\.approach\(/);
 for(const slot of ["basic","special","powerful"])assert.equal(P.resolve("nada",slot).amplitude,0,slot);
});
