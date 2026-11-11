/* REN-LOAD-005: browser-level pending/load/error states, on actual game screens.
 * Delay actual ImportMeshAsync start to inspect the UI before loading.
 * The standard WebGL smoke separately checks the unmodified GLB load.
 */
"use strict";
const assert=require("node:assert/strict");
const {chromium,webkit}=require("playwright");
async function main(){
 const useWebkit=process.env.REN_BROWSER==="webkit";
 const browser=await (useWebkit?webkit:chromium).launch(useWebkit?{headless:true}:{headless:true,args:["--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--no-sandbox"]});
 try{
  const page=await browser.newPage({viewport:{width:932,height:430}});
  const errors=[];
  page.on("pageerror",e=>errors.push("JS "+e.message));
  page.on("console",m=>{
   if(m.type()==="error"&&!m.text().includes("Automatic fallback to software WebGL"))
    errors.push("console "+m.text());
  });
  page.on("requestfailed",r=>{
   // Navigation can cancel non-blocking HEAD metadata probes; not a GLB download failure.
   if(r.method()==="HEAD"&&r.url().endsWith("/assets/ren-meshy-mixamo-animated.glb")&&r.failure()?.errorText==="net::ERR_ABORTED")return;
   errors.push("request "+r.url()+" "+r.failure()?.errorText);
  });
  await page.goto("http://127.0.0.1:8765/",{waitUntil:"load"});
  // Deliberately never resolve import in this separate pending-state test.
  // The existing ren-glb-browser-smoke.cjs independently verifies real success.
  await page.evaluate(()=>{
   BABYLON.SceneLoader.ImportMeshAsync=()=>new Promise(()=>{});
  });
  await page.evaluate(()=>{selectedHeroId="ren";showScreen("heroDetail");});
  await page.waitForFunction(()=>!document.querySelector("#renCardLoadIndicator")?.hidden,{timeout:10000});
  let loading=await page.evaluate(()=>({
   text:document.getElementById("renCardLoadingText")?.textContent,
   visible:!document.getElementById("renCardLoadIndicator")?.hidden,
   noFakeProgress:!document.getElementById("renCardLoadingProgress"),
   spinner: getComputedStyle(document.querySelector("#renCardLoadIndicator .ren-loading-spinner")).display,
   width:document.documentElement.scrollWidth,viewport:window.innerWidth
  }));
  console.log("CARD LOADING",loading);
  assert.equal(loading.visible,true);
  assert.match(loading.text,/Загружаем Рена/);
  assert.equal(loading.noFakeProgress,true,"no fictional download percentage");
  assert.notEqual(loading.spinner,"none");
  assert.ok(loading.width<=loading.viewport+2,"no horizontal overflow");
  // Navigation while still loading must release the card WebGL context.
  await page.evaluate(()=>showScreen("battle"));
  await page.waitForFunction(()=>document.getElementById("renModelBattleStatus")?.dataset.status==="loading",{timeout:10000});
  const state=await page.evaluate(()=>({
   status:document.getElementById("renModelBattleStatusText")?.textContent,
   hidden:document.getElementById("renModelBattleStatus")?.hidden,
   noFakeProgress:!document.getElementById("renModelBattleProgress"),
   spinner:getComputedStyle(document.querySelector("#renModelBattleStatus .ren-loading-spinner")).display,
   width:document.documentElement.scrollWidth,viewport:window.innerWidth
  }));
  console.log("BATTLE LOADING",state);
  assert.equal(state.hidden,false);
  assert.match(state.status,/Загружаю 3D Рена|Загружаем Рена(?:: (?:скачано )?\d|…)/);
  assert.equal(state.noFakeProgress,true);
  assert.notEqual(state.spinner,"none");
  assert.ok(state.width<=state.viewport+2);
  assert.equal(errors.length,0,"JS errors "+errors.join(" | "));
  console.log("REN-LOAD-005: pending UI in card and battle passed, "+(useWebkit?"WebKit":"Chromium"));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
