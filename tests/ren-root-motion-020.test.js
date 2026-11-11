"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const Runtime=require("../ren-glb-runtime.js");

test("RENMOVE020: travel uses Running, attacks use their authored clips",()=>{
 for(const slot of ["basic","special","powerful"]){
  assert.equal(Runtime.choreography({slot,progress:0}).name,"Running");
  assert.equal(Runtime.choreography({slot,progress:.2}).name,"Running");
  assert.equal(Runtime.choreography({slot,progress:.5}).name,Runtime.clipFor(slot));
  assert.equal(Runtime.choreography({slot,progress:.9}).name,"Running");
  assert.ok(Math.abs(Runtime.choreography({slot,progress:1}).progress)<1e-9);
 }
 assert.equal(Runtime.choreography({slot:"idle",progress:.5}).name,"Idle_4");
 assert.equal(Runtime.choreography({slot:"hit",progress:.5}).name,"Slap_Reaction");
 assert.equal(Runtime.choreography({slot:"death",progress:1}).name,"Dead");
});

test("RENMOVE020: imported hip XZ motion is pinned only for combat, death keeps authored fall",()=>{
 const node={name:"mixamorig:Hips"};
 const group=(name,values)=>({name,targetedAnimations:[{
  target:node,
  animation:{targetProperty:"position",getKeys:()=>values.map(value=>({value}))}
 }]});
 const idleKeys=[{x:-.01,y:.93,z:0},{x:.01,y:.94,z:-.03}];
 const attackKeys=[{x:.01,y:.87,z:-1.05},{x:-.1,y:.75,z:0}];
 const deathKeys=[{x:0,y:.89,z:.1},{x:0,y:.31,z:.55}];
 const groups=new Map([["Idle_4",group("Idle_4",idleKeys)],["Double_Combo_Attack",group("Double_Combo_Attack",attackKeys)],["Dead",group("Dead",deathKeys)]]);
 assert.equal(Runtime.stabilizeCombatRoot(groups),4);
 assert.deepEqual(attackKeys.map(k=>[k.x,k.z]),[[-.01,0],[-.01,0]]);
 assert.deepEqual(attackKeys.map(k=>k.y),[.87,.75],"vertical authored motion preserved");
 assert.deepEqual(deathKeys[1],{x:0,y:.31,z:.55},"death fall remains intact");
});
