"use strict";
/* LC-002 real browser smoke: landscape Chromium + WebKit, no mock DOM. */
const assert=require("node:assert/strict");
const path=require("node:path");
const fs=require("node:fs");
const {chromium,webkit}=require("playwright");
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765";
const out=path.join(__dirname,"..","artifacts","lore-campaign-002");
fs.mkdirSync(out,{recursive:true});

async function check(engineName,browserType,width,height){
 const browser=await browserType.launch({headless:true});
 const page=await browser.newPage({viewport:{width,height},hasTouch:true,deviceScaleFactor:1});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 const tag=engineName+"-"+width+"x"+height;
 try{
  await page.goto(origin,{waitUntil:"domcontentloaded",timeout:60000});
  // HQ bottom navigation is hidden in short landscape. Invoke its existing
  // real click handler without an offscreen pointer target or panorama animation.
  await page.locator('#home .hq-bottom button[data-screen="campaign"]').evaluate(el=>el.click());
  await page.locator("#campaignHub").waitFor({state:"visible",timeout:15000});
  assert.equal(await page.locator("#campaignHub").isVisible(),true,tag+" hub visible");
  await page.locator('[data-campaign-path="lore"]').click();
  assert.equal(await page.locator("#campaignLoreContent").isVisible(),true,tag+" lore content visible");
  assert.equal(await page.locator(".lore-story-cover").count(),1,tag+" one real story");
  await page.locator(".lore-story-cover").click();
  assert.equal(await page.locator(".lore-map-marker").count(),3,tag+" node markers");
  assert.equal(await page.locator(".lore-list-node").count(),3,tag+" accessible node list");
  assert.ok((await page.locator(".lore-node-detail").innerText()).includes("Другая сторона"));
  assert.ok((await page.locator(".lore-node-detail").innerText()).includes("Доступно"));
  const first=await page.locator(".lore-map-marker").first().boundingBox();
  assert.ok(first&&first.width>=44&&first.height>=44,tag+" touch hit box >=44");
  const within=await page.evaluate(()=>{
   const el=document.getElementById("campaignLoreContent");
   const rect=el.getBoundingClientRect();
   const map=document.querySelector(".lore-map-layout").getBoundingClientRect();
   return {
    page:document.documentElement.scrollWidth <= window.innerWidth+1,
    lore:rect.left>=-1&&rect.right<=window.innerWidth+1,
    map:map.left>=-1&&map.right<=window.innerWidth+1
   };
  });
  assert.ok(within.page&&within.lore&&within.map,tag+" no horizontal overflow: "+JSON.stringify(within));
  await page.screenshot({path:path.join(out,tag+"-map.png"),fullPage:true});
  await page.locator(".lore-map-marker").nth(1).click();
  assert.ok((await page.locator(".lore-node-detail").innerText()).includes("Неизвестный узел"),tag+" locked title concealed");
  assert.equal(await page.locator(".lore-node-detail button[disabled]").count(),1,tag+" scene not falsely playable");
  await page.locator(".lore-map-marker").last().focus();
  await page.keyboard.press("Escape");
  assert.equal(await page.locator(".lore-story-cover").isVisible(),true,tag+" escape returns to stories");
  await page.locator(".lore-story-cover").click();
  await page.locator("#campaignBackButton").click();
  assert.equal(await page.locator(".lore-story-cover").isVisible(),true,tag+" outer back returns to stories");
  await page.locator("#campaignBackButton").click();
  assert.equal(await page.locator("#campaignHub").isVisible(),true,tag+" outer back returns to hub");
  assert.equal(await page.locator("#campaignMissions").isVisible(),false,tag+" training list stays hidden");
  assert.deepEqual(errors.filter(message=>/LoreCampaign|lore-campaign/i.test(message)),[],tag+" no lore runtime errors");
  console.log("LC-002 browser",tag,"PASS",JSON.stringify(within));
 }catch(err){
  await page.screenshot({path:path.join(out,tag+"-failure.png"),fullPage:true}).catch(()=>{});
  console.error("LC-002 browser failure",tag,"pageErrors",errors);
  throw err;
 }finally{
  await browser.close();
 }
}
(async()=>{
 for(const [name,type] of [["chromium",chromium],["webkit",webkit]]){
  for(const [w,h] of [[844,390],[932,430]])await check(name,type,w,h);
 }
})().catch(err=>{console.error(err);process.exitCode=1;});
