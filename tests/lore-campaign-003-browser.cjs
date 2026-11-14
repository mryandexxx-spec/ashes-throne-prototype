"use strict";
/* LC-003: real DOM scene smoke. Injects only test fixture, not published literary content. */
const assert=require("node:assert/strict");
const {chromium,webkit}=require("playwright");
const path=require("node:path");
const fs=require("node:fs");
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765";
const out=path.join(__dirname,"..","artifacts","lore-campaign-003");
fs.mkdirSync(out,{recursive:true});
async function openCampaign(page){
 await page.locator('#home .hq-bottom button[data-screen="campaign"]').evaluate(el=>el.click());
 await page.locator("#campaignHub").waitFor({state:"visible",timeout:15000});
 await page.locator('[data-campaign-path="lore"]').click();
 await page.locator("#campaignLoreContent").waitFor({state:"visible"});
}
async function mountFixture(page){
 await page.addScriptTag({url:"/tests/lore-campaign-003-fixture.js"});
 await page.evaluate(()=>{
  const fixture=LoreCampaign003Fixture.create(LoreCampaignData);
  const old=document.getElementById("loreCampaignRoot");
  const root=document.createElement("div");
  root.id="loreCampaignRoot";
  root.className="lore-map-app";
  old.replaceWith(root);
  const result=LoreCampaignUI.mount(root,fixture.data,LoreCampaignCore,{
   scripts:LoreCampaignScenes,engine:LoreCampaignSceneCore,save:LoreCampaignSceneSave,
   runtime:LoreCampaignSceneRuntime,storage:window.localStorage,pack:fixture.pack
  });
  if(!result)throw Error("LC003_FIXTURE_MOUNT_FAILED");
 });
}
async function check(engine,browserType,width,height){
 const browser=await browserType.launch({headless:true});
 const page=await browser.newPage({viewport:{width,height},hasTouch:true});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 const tag=engine+"-"+width+"x"+height;
 try{
  await page.goto(origin,{waitUntil:"domcontentloaded",timeout:60000});
  await openCampaign(page);
  assert.equal(await page.locator('.lore-scene').count(),0,"no story launched by default");
  assert.equal(await page.locator('.lore-map-app').count(),1);
  await mountFixture(page);
  await page.locator('.lore-story-cover').click();
  await page.locator('[data-lore-action="start-node"]').click();
  assert.equal(await page.locator('.lore-scene').count(),1);
  const text=await page.locator('.lore-scene-text').innerText();
  assert.ok(text.includes("<script>alert"),tag+" script shown literally");
  assert.equal(await page.locator('.lore-scene-text script').count(),0,tag+" no injected script");
  const box=await page.locator('.lore-scene-card').boundingBox();
  assert.ok(box&&box.width>260,tag+" scene readable");
  const widths=await page.evaluate(()=>({
   viewport:window.innerWidth,document:document.documentElement.scrollWidth,
   scene:document.querySelector(".lore-scene").getBoundingClientRect().right
  }));
  assert.ok(widths.document<=widths.viewport+1&&widths.scene<=widths.viewport+1,
   tag+" no horizontal overflow "+JSON.stringify(widths));
  await page.screenshot({path:path.join(out,tag+"-scene.png"),fullPage:true});
  await page.locator('[data-lore-action="scene-next"]').click();
  const checkpoint=await page.evaluate(()=>{
   const progress=JSON.parse(localStorage.getItem("ashes-throne.lore-campaign.v1"));
   return progress.stories["five-shadows"].checkpointBeatId;
  });
  assert.equal(checkpoint,"notes",tag+" saved checkpoint");
  // Reload simulates Safari refresh: the authored fixture remains test-only.
  await page.reload({waitUntil:"domcontentloaded"});
  await openCampaign(page);
  await mountFixture(page);
  await page.locator(".lore-story-cover").click();
  assert.equal(await page.locator('[data-lore-action="start-node"]').innerText(),"Продолжить");
  await page.locator('[data-lore-action="start-node"]').click();
  assert.ok((await page.locator('.lore-scene-text').innerText()).includes("второй источник"));
  await page.locator('[data-lore-action="scene-next"]').click();
  await page.locator('[data-lore-choice="left"]').click();
  await page.locator('[data-lore-action="scene-next"]').click();
  await page.locator('[data-lore-action="scene-finish"]').click();
  assert.ok((await page.locator('.lore-scene-result').innerText()).includes("Просмотр сцены завершён"));
  await page.locator('[data-lore-action="leave-result"]').click();
  assert.ok((await page.locator('.lore-node-list').innerText()).includes("Пройдено"));
  assert.ok((await page.locator(".lore-decision-log").innerText()).includes("Сначала журнал"),tag+" primary decision journal");
  const primary=await page.evaluate(()=>localStorage.getItem("ashes-throne.lore-campaign.v1"));
  await page.locator('[data-lore-action="start-node"]').click();
  assert.match(await page.locator('.lore-scene-header').innerText(),/ПОВТОР/);
  await page.locator('[data-lore-action="scene-next"]').click();
  await page.locator('[data-lore-action="scene-next"]').click();
  await page.locator('[data-lore-choice="right"]').click();
  await page.locator('[data-lore-action="scene-next"]').click();
  await page.locator('[data-lore-action="scene-finish"]').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem("ashes-throne.lore-campaign.v1")),primary,
   tag+" replay cannot overwrite primary choice");
  await page.locator('[data-lore-action="leave-result"]').click();
  await page.locator('[data-lore-action="start-node"]').click();
  await page.keyboard.press("Escape");
  assert.equal(await page.locator('.lore-map-marker').count(),3,tag+" Escape returns to map");
  assert.deepEqual(errors.filter(e=>/LoreCampaign|lore-campaign/i.test(e)),[],tag+" no runtime errors");
  console.log("LC-003 browser",tag,"PASS",JSON.stringify(widths));
 }catch(error){
  await page.screenshot({path:path.join(out,tag+"-failure.png"),fullPage:true}).catch(()=>{});
  console.error("LC-003 browser failure",tag,errors);
  throw error;
 }finally{await browser.close();}
}
(async()=>{for(const [engine,type] of [["chromium",chromium],["webkit",webkit]])
 for(const [w,h] of [[844,390],[932,430]])await check(engine,type,w,h);
})().catch(e=>{console.error(e);process.exitCode=1;});
