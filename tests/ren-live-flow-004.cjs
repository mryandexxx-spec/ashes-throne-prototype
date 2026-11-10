/* REN-LIVE-004: use actual game navigation, not isolated GLB scene.
 * Detects whether game.js enters dossier and battle and actually replaces Ren.
 */
"use strict";
const {chromium,webkit}=require("playwright");
const assert=require("node:assert/strict");
(async()=>{
 const browserType=process.env.REN_BROWSER==="webkit"?webkit:chromium;
 const browser=await browserType.launch(browserType===webkit?{headless:true}:{headless:true,args:["--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-dev-shm-usage","--no-sandbox"]});
 try{
  const page=await browser.newPage({viewport:{width:956,height:440}});
  const errors=[];
  page.on("pageerror",e=>errors.push("pageerror: "+e.message));
  page.on("console",m=>{if(m.type()==="error"||m.type()==="warning")errors.push("console: "+m.text());});
  page.on("requestfailed",r=>errors.push("request: "+r.url()+" "+r.failure()?.errorText));
  const origin=process.env.REN_ORIGIN||"http://127.0.0.1:8765/";
  await page.goto(origin,{waitUntil:"load",timeout:60000});
  console.log("REN LIVE SOURCE",JSON.stringify({browser:browserType.name(),origin,footer:await page.locator("#buildVersion").textContent()}));
  await page.evaluate(()=>{
   if(typeof showScreen!=="function")throw Error("game.js showScreen missing");
   selectedHeroId="ren";
   showScreen("heroDetail");
  });
  await page.waitForTimeout(1000);
  const cardEarly=await page.evaluate(()=>({
   active:document.querySelector("#heroDetail")?.classList.contains("active"),
   portraitHidden:document.getElementById("detailRenPortrait")?.hidden,
   controlsHidden:document.getElementById("renCard3DControls")?.hidden,
   canvasHidden:document.getElementById("renCard3DCanvas")?.hidden,
   status:document.getElementById("renCard3DStatus")?.textContent,
   modelClass:document.getElementById("detailHeroStage")?.className,
   moduleType:typeof RenCard3D
  }));
  console.log("LIVE CARD EARLY",JSON.stringify(cardEarly),"ERR",JSON.stringify(errors));
  await page.waitForTimeout(5500);
  const card=await page.evaluate(()=>({
   portraitHidden:document.getElementById("detailRenPortrait")?.hidden,
   controlsHidden:document.getElementById("renCard3DControls")?.hidden,
   canvasHidden:document.getElementById("renCard3DCanvas")?.hidden,
   status:document.getElementById("renCard3DStatus")?.textContent,
   modelClass:document.getElementById("detailHeroStage")?.className,
   canvasDisplay:getComputedStyle(document.getElementById("renCard3DCanvas")).display,
   canvasOpacity:getComputedStyle(document.getElementById("renCard3DCanvas")).opacity,
   canvasRect:document.getElementById("renCard3DCanvas")?.getBoundingClientRect().toJSON(),
  }));
  console.log("LIVE CARD",JSON.stringify(card),"ERR",JSON.stringify(errors));
  await page.screenshot({path:"/tmp/ren-live-card.png"});
  await page.evaluate(()=>showScreen("battle"));
  await page.waitForTimeout(6500);
  const battle=await page.evaluate(()=>({
   active:document.getElementById("battle")?.classList.contains("active"),
   status:document.getElementById("renModelBattleStatus")?.textContent,
   hidden:document.getElementById("renModelBattleStatus")?.hidden,
   sceneExists:typeof scene!=="undefined"&&!!scene,
   meshExists:typeof meshes!=="undefined"&&!!meshes.ren,
   glbMeshCount:typeof scene!=="undefined"&&scene?scene.meshes.filter(m=>m.name.includes("geometry")&&m.getTotalVertices?.()>0).length:0,
   proceduralVisible:typeof meshes!=="undefined"&&meshes.ren?meshes.ren.body.getChildMeshes().filter(m=>m.name.includes("ren_")&&m.isVisible).length:null,
   isRenVisible:typeof meshes!=="undefined"&&meshes.ren?meshes.ren.body.isEnabled():null,
  }));
  console.log("LIVE BATTLE",JSON.stringify(battle),"ERR",JSON.stringify(errors));
  await page.screenshot({path:"/tmp/ren-live-battle.png"});
  // Reopen dossier AFTER a battle has created a persistent WebGL Engine.
  await page.evaluate(()=>{selectedHeroId="ren";showScreen("heroDetail");});
  await page.waitForTimeout(5500);
  const returnCard=await page.evaluate(()=>({
   status:document.getElementById("renCard3DStatus")?.textContent,
   modelClass:document.getElementById("detailHeroStage")?.className,
   controlsHidden:document.getElementById("renCard3DControls")?.hidden,
   canvasHidden:document.getElementById("renCard3DCanvas")?.hidden,
   canvasDisplay:getComputedStyle(document.getElementById("renCard3DCanvas")).display
  }));
  console.log("LIVE CARD AFTER BATTLE",JSON.stringify(returnCard),"ERR",JSON.stringify(errors));
  assert.equal(returnCard.controlsHidden,false,"Dossier controls remain visible after battle");
  assert.match(returnCard.status||"",/3D Рен загружен/,"WebGL card must work after battle");
  assert.match(returnCard.modelClass||"",/has-ren-3d/);
  assert.equal(card.controlsHidden,false,"Card controls should appear during game navigation");
  assert.equal(card.canvasHidden,false,"Card canvas should be present");
  assert.match(card.status||"",/3D Рен загружен/,"Card model imported in real navigation");
  assert.match(card.modelClass||"",/has-ren-3d/,"Card GLB actually shown");
  assert.equal(battle.active,true,"Battle screen opens");
  assert.match(battle.status||"",/3D Рен загружен/,"GLB imported in real battle");
  assert.ok(battle.glbMeshCount>0,"Real battle scene contains GLB geometry");
  console.log("REN-LIVE-004 actual game flow passed");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
