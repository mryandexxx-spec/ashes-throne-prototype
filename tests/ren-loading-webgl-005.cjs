/* REN-LOAD-005: browser-level pending/load/error states, on actual game screens.
 * Use a deliberately paused GLB response: this proves the spinner is visible
 * while the model is not yet ready. No simulated percentage is asserted.
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
  page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/assets/ren-animated-v02.glb",async route=>{
   await new Promise(resolve=>setTimeout(resolve,2200));
   await route.continue();
  });
  await page.goto("http://127.0.0.1:8765/",{waitUntil:"load"});
  await page.evaluate(()=>{selectedHeroId="ren";showScreen("heroDetail");});
  await page.waitForFunction(()=>!document.querySelector("#renCardLoadIndicator")?.hidden,{timeout:10000});
  let loading=await page.evaluate(()=>({
   text:document.getElementById("renCardLoadingText")?.textContent,
   visible:!document.getElementById("renCardLoadIndicator")?.hidden,
   progressHidden:document.getElementById("renCardLoadingProgress")?.hidden,
   spinner: getComputedStyle(document.querySelector("#renCardLoadIndicator .ren-loading-spinner")).display,
   width:document.documentElement.scrollWidth,viewport:window.innerWidth
  }));
  console.log("CARD LOADING",loading);
  assert.equal(loading.visible,true);
  assert.match(loading.text,/Загружаем Рена/);
  assert.equal(loading.progressHidden,true,"no fictional download percentage");
  assert.notEqual(loading.spinner,"none");
  assert.ok(loading.width<=loading.viewport+2,"no horizontal overflow");
  await page.waitForFunction(()=>typeof window.RenGlbRuntime!=="undefined");
  await page.waitForFunction(()=>document.getElementById("renCard3DStatus")?.textContent?.includes("3D Рен загружен"),{timeout:30000});
  assert.equal(await page.locator("#renCardLoadIndicator").isHidden(),true);
  await page.evaluate(()=>showScreen("battle"));
  await page.waitForFunction(()=>document.getElementById("renModelBattleStatus")?.dataset.status==="loading",{timeout:10000});
  const state=await page.evaluate(()=>({
   status:document.getElementById("renModelBattleStatusText")?.textContent,
   hidden:document.getElementById("renModelBattleStatus")?.hidden,
   barHidden:document.getElementById("renModelBattleProgress")?.hidden,
   spinner:getComputedStyle(document.querySelector("#renModelBattleStatus .ren-loading-spinner")).display,
   width:document.documentElement.scrollWidth,viewport:window.innerWidth
  }));
  console.log("BATTLE LOADING",state);
  assert.equal(state.hidden,false);
  assert.match(state.status,/Загружаю 3D Рена/);
  assert.equal(state.barHidden,true);
  assert.notEqual(state.spinner,"none");
  assert.ok(state.width<=state.viewport+2);
  await page.waitForFunction(()=>document.getElementById("renModelBattleStatus")?.dataset.status==="ready",{timeout:30000});
  assert.ok((await page.locator("#renModelBattleStatusText").textContent()).includes("загружен"));
  assert.equal(errors.length,0,"JS errors "+errors.join(" | "));
  console.log("REN-LOAD-005: pending -> ready in card and battle passed, "+(useWebkit?"WebKit":"Chromium"));
 }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
