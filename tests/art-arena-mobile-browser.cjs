"use strict";
/* ART3D001: simulated iPhone Safari landscape, real touch entry and fallback diagnostics. */
const assert=require("node:assert/strict");
const {webkit,devices}=require("playwright");
(async()=>{
 const browser=await webkit.launch({headless:true});
 try{
  const device=devices["iPhone 13"];
  const context=await browser.newContext({...device,viewport:{width:844,height:390},isMobile:true,hasTouch:true});
  const page=await context.newPage();
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("http://127.0.0.1:8765/",{waitUntil:"load"});
  await page.evaluate(()=>{
   if(!squadSlots().includes("art"))selectedPartyIds[selectedPartyIds.length-1]="art";
   openSquad("home");
  });
  await page.locator("#squadStart").tap();
  await page.waitForFunction(()=>document.getElementById("battle").classList.contains("active")||
   !document.getElementById("battleLoadError").hidden,{timeout:30000});
  const state=await page.evaluate(()=>({
   battle:document.getElementById("battle").classList.contains("active"),
   reason:document.querySelector("#battleLoadError p")?.textContent,
   fighter:!!meshes.art,active:!!state?.active,
   overflow:document.documentElement.scrollWidth>innerWidth+2
  }));
  console.log("ART3D001 iPhone touch entry",JSON.stringify(state));
  assert.equal(state.battle,true,"real tap must enter the arena: "+state.reason);
  assert.equal(state.fighter,true);
  assert.equal(state.active,true);
  assert.equal(state.overflow,false);
  await page.waitForFunction(()=>!!artGlbRuntime,null,{timeout:15000});
  assert.equal(await page.evaluate(async()=>await artGlbRuntime.ready),true,"Art model should load");
  await page.evaluate(()=>{
   // Return to squad and enter again while the same engine survives.
   showScreen("squad");renderSquad();
  });
  await page.locator("#squadStart").tap();
  await page.waitForFunction(()=>document.getElementById("battle").classList.contains("active")||
   !document.getElementById("battleLoadError").hidden,{timeout:30000});
  const retry=await page.evaluate(()=>({
   battle:document.getElementById("battle").classList.contains("active"),
   reason:document.querySelector("#battleLoadError p")?.textContent
  }));
  assert.equal(retry.battle,true,"reentry must succeed: "+retry.reason);
  assert.deepEqual(errors,[]);
  console.log("ART3D001 simulated iPhone Safari real tap PASS");
  await context.close();
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
