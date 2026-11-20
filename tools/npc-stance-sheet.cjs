"use strict";
/* ARENA-ART-004D — stance yaw sweep and enemy/hero height on the real battle frame.
 * Mission 2 (slinger + medic) with Ren, Nada, Liora, Art, Sava. The render loop is
 * stopped, enemy bodies are set to idleYaw(enemy)+offset and the scene is rendered
 * once per offset: artifacts/npc-glb-004d/yaw_<deg>.png. Heights are measured on
 * skinned bounds in the idle pose (world units, feet to top).
 * Run: python3 -m http.server 8765 & NPC_CHROME=/usr/bin/google-chrome NPC_BABYLON_LOCAL=1
 *      node tools/npc-stance-sheet.cjs [deg,deg,...]
 */
const fs=require("node:fs"),path=require("node:path");
let pw;try{pw=require("playwright");}catch{pw=require("playwright-core");}
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
const out=path.join(process.cwd(),"artifacts","npc-glb-004d");
fs.mkdirSync(out,{recursive:true});
const offsets=(process.argv[2]||"0,-35,35").split(",").map(Number);
(async()=>{
 const browser=await pw.chromium.launch({headless:true,
  ...(process.env.NPC_CHROME?{executablePath:process.env.NPC_CHROME}:{}),
  args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--enable-webgl"]});
 const page=await browser.newPage({viewport:{width:932,height:430},hasTouch:true});
 if(process.env.NPC_BABYLON_LOCAL)await page.route(u=>!/^https?:\/\/127\.0\.0\.1/.test(u.href),route=>{
  const u=new URL(route.request().url());
  const map={"/v9.33.2/babylon.js":"node_modules/babylonjs/babylon.js",
   "/v9.33.2/loaders/babylonjs.loaders.min.js":"node_modules/babylonjs-loaders/babylonjs.loaders.min.js"};
  return u.hostname==="cdn.babylonjs.com"&&map[u.pathname]
   ?route.fulfill({path:path.join(process.cwd(),map[u.pathname]),contentType:"text/javascript"}):route.abort();
 });
 await page.goto(origin,{waitUntil:"load",timeout:60000});
 await page.waitForFunction(()=>typeof showScreen==="function"&&typeof NpcGlbRuntime!=="undefined",null,{timeout:60000});
 await page.evaluate(()=>{campaignProgress.completed["black-pass-ambush"]=true;campaignProgress.bestStars["black-pass-ambush"]=1;});
 await page.locator('#home .hq-bottom button[data-screen="campaign"]').evaluate(el=>el.click());
 await page.locator('[data-campaign-path="training"]').click();
 await page.locator('[data-campaign-mission="demo-mission-2"]').click();
 await page.locator("#squadDisband").evaluate(el=>el.click());
 for(const id of (process.env.NPC_SQUAD||"ren,nada,liora,art,sava").split(","))
  await page.locator('#squadRoster [data-hero-id="'+id+'"]').evaluate(el=>el.click());
 const button=page.locator("#squadStart");await button.click();
 if(await page.locator("#squad").isVisible())await button.click();
 await page.locator("#battle").waitFor({state:"visible",timeout:30000});
 await page.waitForFunction(()=>npcGlbRuntimes.size>0&&[...npcGlbRuntimes.values()].every(r=>r.isReady),null,{timeout:90000});
 await page.waitForTimeout(2500);
 const heights=await page.evaluate(()=>{
  stopBattleRendering();
  const rows=[];
  for(const f of state.fighters){
   const v=meshes[f.id];if(!v)continue;
   let top=-Infinity;
   for(const m of scene.meshes){
    if(m.metadata?.fighterId!==f.id||!m.isEnabled()||!m.isVisible||!(m.getTotalVertices?.()>0))continue;
    if(m===v.base||m.name.includes("base"))continue;
    m.computeWorldMatrix(true);
    m.refreshBoundingInfo?.({applySkeleton:true,applyMorph:true});
    top=Math.max(top,m.getBoundingInfo().boundingBox.maximumWorld.y);
   }
   const root=scene.transformNodes.find(n=>n.name==="npc_glb_"+f.id);
   const head=root?.getChildTransformNodes(false).find(n=>n.name==="Head");
   rows.push({id:f.id,side:f.side,top:+top.toFixed(2),
    ...(root?{scale:+root.scaling.x.toFixed(4),headBone:+head.getAbsolutePosition().y.toFixed(2)}:{})});
  }
  return rows;
 });
 console.log("HEIGHTS",JSON.stringify(heights));
 for(const deg of offsets){
  await page.evaluate(deg=>{
   for(const f of state.fighters)if(f.side==="enemy"&&meshes[f.id])
    meshes[f.id].body.rotation.y=ArenaStageView.idleYaw("enemy")+deg*Math.PI/180;
   scene.render();
  },deg);
  await page.screenshot({path:path.join(out,"yaw_"+deg+".png")});
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
