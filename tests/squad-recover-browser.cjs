"use strict";
/* RECOVER3D: end-to-end checks use actual Babylon GLBs, not PNG previews.
 * WebKit emulation in CI is not a test on physical iPhone Safari.
 */
const assert=require("node:assert/strict");
const {chromium,webkit}=require("playwright");
const fs=require("node:fs"),path=require("node:path");
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
fs.mkdirSync(path.join(process.cwd(),"artifacts","squad-recovery"),{recursive:true});
async function check(browserName,engine,viewport){
 const browser=await engine.launch(browserName==="chromium"?{
  headless:true,args:["--no-sandbox","--use-angle=swiftshader","--enable-webgl","--disable-dev-shm-usage"]
 }:{headless:true});
 const page=await browser.newPage({viewport,hasTouch:true}),errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 try{
  await page.goto(origin,{waitUntil:"load",timeout:60000});
  await page.waitForFunction(()=>typeof openSquad==="function"&&typeof SquadStage3D!=="undefined",null,{timeout:60000});
  await page.evaluate(()=>{
   setSquadSlots(["ren","nada","liora","art","sava"]);
   openSquad("home");
  });
  await page.locator("#squad.active").waitFor({state:"visible"});
  await page.waitForFunction(()=>{
   const slots=document.querySelectorAll("#squadSlots .squad-slot[data-model-id]");
   return slots.length===5&&[...slots].every(el=>el.classList.contains("squad-model-live"));
  },null,{timeout:90000});
  const stats=await page.evaluate(()=>{
   const canvas=document.querySelector("#squad .squad-stage-canvas");
   const engines=BABYLON.EngineStore.Instances.filter(e=>e.getRenderingCanvas?.()===canvas);
   const squad=document.querySelector("#squad").getBoundingClientRect();
   const main=document.querySelector("#squadSlots").getBoundingClientRect();
   const roster=document.querySelector("#squadRoster").getBoundingClientRect();
   return {
    engines:engines.length,
    canvas:canvas?.width||0,
    meshes:engines[0]?.scenes?.[0]?.meshes?.filter(m=>m.getTotalVertices?.()>0).length||0,
    models:[...document.querySelectorAll("#squadSlots [data-model-id]")].map(el=>el.dataset.modelId),
    horizontal:document.documentElement.scrollWidth>innerWidth+1,
    vertical:document.documentElement.scrollHeight>innerHeight+1,
    main:{x:main.x,w:main.width,h:main.height},
    roster:{x:roster.x,w:roster.width,h:roster.height},
    squad:{top:squad.top,bottom:squad.bottom}
   };
  });
  assert.equal(stats.engines,1,"exactly one Babylon engine for all five models");
  assert.ok(stats.canvas>100&&stats.meshes>=5,"actual five GLBs, not image-only presentation");
  assert.deepEqual(stats.models,["ren","nada","liora","art","sava"]);
  assert.equal(stats.horizontal,false,"no horizontal overflow");
  assert.equal(stats.vertical,false,"squad fits landscape without page scroll");
  assert.ok(stats.main.x>stats.roster.x+stats.roster.w*.7,"five model slots to right of roster");
  assert.ok(stats.main.h>=95&&stats.squad.bottom<=viewport.height+1);
  const file=path.join("artifacts","squad-recovery",browserName+"-"+viewport.width+"x"+viewport.height+".png");
  await page.screenshot({path:file});
  await page.evaluate(()=>showScreen("home"));
  await page.waitForFunction(()=>!document.querySelector("#squad").classList.contains("active"));
  assert.equal(await page.locator("#squad").isVisible(),false,"inactive squad is hidden");
  const freed=await page.evaluate(()=>!BABYLON.EngineStore.Instances.some(e=>e.getRenderingCanvas?.()?.classList?.contains("squad-stage-canvas")));
  assert.equal(freed,true,"squad 3D disposed on exit");
  await page.evaluate(()=>showScreen("network"));
  assert.equal(await page.locator("#network").isVisible(),true,"network appears normally after squad");
  assert.equal(await page.locator("#squad").isVisible(),false,"network is not covered by squad");
  assert.deepEqual(errors,[],"page errors");
  console.log("RECOVER3D_BROWSER_PASS",browserName,viewport,stats);
 }catch(error){
  console.error("RECOVER3D_BROWSER_FAIL",browserName,viewport,errors);
  await page.screenshot({path:path.join("artifacts","squad-recovery",browserName+"-"+viewport.width+"-fail.png"),fullPage:true}).catch(()=>{});
  throw error;
 }finally{await browser.close();}
}
(async()=>{
 for(const [name,engine] of [["chromium",chromium],["webkit",webkit]])
  for(const viewport of [{width:844,height:390},{width:932,height:430}])
   await check(name,engine,viewport);
})().catch(error=>{console.error(error);process.exitCode=1;});
