"use strict";
/* Browser-only synthetic evidence. NO story text from the private world repository. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium,webkit}=require("playwright");
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765";
const out=path.join(__dirname,"..","artifacts","lore-campaign-004");
fs.mkdirSync(out,{recursive:true});
async function campaign(page){
 await page.locator('#home .hq-bottom button[data-screen="campaign"]').evaluate(el=>el.click());
 await page.locator("#campaignHub").waitFor({state:"visible",timeout:15000});
 await page.locator('[data-campaign-path="lore"]').click();
 await page.locator("#campaignLoreContent").waitFor({state:"visible"});
}
async function inject(page){
 await page.addScriptTag({url:"/tests/lore-campaign-003-fixture.js"});
 await page.addScriptTag({url:"/tests/lore-campaign-004-fixture.js"});
 await page.evaluate(()=>{
  const data=LoreCampaign004Fixture.create(LoreCampaignData);
  const old=document.getElementById("loreCampaignRoot");
  const next=document.createElement("div");
  next.id="loreCampaignRoot";
  next.className="lore-map-app";
  old.replaceWith(next);
  if(!LoreCampaignUI.mount(next,data.data,LoreCampaignCore,{
   scripts:LoreCampaignScenes,engine:LoreCampaignSceneCore,
   save:LoreCampaignSceneSave,runtime:LoreCampaignSceneRuntime,
   storage:window.localStorage,pack:data.pack
  }))throw Error("FIXTURE_MOUNT_FAILED");
 });
}
async function check(browserName,browserType,width,height){
 const b=await browserType.launch({headless:true});
 const page=await b.newPage({viewport:{width,height},hasTouch:true});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 const tag=browserName+"-"+width+"x"+height;
 try{
  await page.goto(origin,{waitUntil:"domcontentloaded",timeout:60000});
  await campaign(page);
  await inject(page);
  await page.locator(".lore-story-cover").click();
  await page.locator('[data-lore-action="start-node"]').click();
  await page.locator('[data-lore-action="scene-next"]').click();
  const next=page.locator('[data-lore-action="scene-next"]');
  assert.equal(await next.isDisabled(),true,tag+" cannot advance before observing");
  assert.equal(await page.locator('[data-lore-action="scene-compare"]').isDisabled(),true,
    tag+" compare initially disabled");
  let cards=page.locator('[data-lore-action="scene-inspect"]');
  assert.equal(await cards.count(),2);
  let first=await cards.first().boundingBox();
  assert.ok(first&&first.height>=44,tag+" >=44px touch control");
  await cards.first().click();
  assert.ok((await page.locator(".lore-scene-evidence-text").innerText()).includes("<img"),
    tag+" malicious markup displayed literally");
  assert.equal(await page.locator(".lore-scene-evidence-text img").count(),0,
    tag+" no HTML execution");
  assert.equal(await next.isDisabled(),true);
  await page.screenshot({path:path.join(out,tag+"-inspection.png"),fullPage:true});
  // Test a genuine persistent checkpoint at the same beat, after partial inspection.
  const before=await page.evaluate(()=>JSON.parse(localStorage.getItem("ashes-throne.lore-campaign.v1")));
  assert.ok(before.stories["five-shadows"].seenEvidenceIds.includes("five-shadows:fs-01/material-a"));
  await page.reload({waitUntil:"domcontentloaded"});
  await campaign(page);
  await inject(page);
  await page.locator(".lore-story-cover").click();
  await page.locator('[data-lore-action="start-node"]').click();
  assert.equal(await page.locator(".lore-scene-inspect-btn").first().innerText().then(s=>s.includes("✓")),true);
  assert.equal(await page.locator('[data-lore-action="scene-next"]').isDisabled(),true);
  cards=page.locator('[data-lore-action="scene-inspect"]');
  await cards.nth(1).click();
  assert.equal(await page.locator('[data-lore-action="scene-compare"]').isEnabled(),true,
    tag+" compare enabled after both inspections");
  assert.equal(await page.locator('[data-lore-action="scene-next"]').isDisabled(),true,
    tag+" viewing two items does not auto-compare");
  await page.locator('[data-lore-action="scene-compare"]').click();
  assert.ok((await page.locator(".lore-scene-evidence-text").innerText()).includes("расхождение"),
    tag+" explicit comparison revealed");
  assert.equal(await page.locator('[data-lore-action="scene-next"]').isEnabled(),true);
  const geometry=await page.evaluate(()=>({
   document:document.documentElement.scrollWidth,viewport:innerWidth,
   content:document.querySelector(".lore-scene").getBoundingClientRect().right
  }));
  assert.ok(geometry.document<=geometry.viewport+1&&geometry.content<=geometry.viewport+1,
   tag+" no horizontal overflow: "+JSON.stringify(geometry));
  await page.screenshot({path:path.join(out,tag+"-compared.png"),fullPage:true});
  await page.locator('[data-lore-action="scene-next"]').click();
  await page.locator('[data-lore-choice="left"]').click();
  await page.locator('[data-lore-action="scene-next"]').click();
  await page.locator('[data-lore-action="scene-finish"]').click();
  assert.ok((await page.locator(".lore-scene-result").innerText()).includes("Просмотр сцены завершён"));
  await page.locator('[data-lore-action="leave-result"]').click();
  const primary=await page.evaluate(()=>localStorage.getItem("ashes-throne.lore-campaign.v1"));
  await page.locator('[data-lore-action="start-node"]').click();
  await page.locator('[data-lore-action="scene-next"]').click();
  await page.locator('[data-lore-action="scene-next"]').click(); // already collected on primary
  await page.locator('[data-lore-choice="right"]').click();
  await page.locator('[data-lore-action="scene-next"]').click();
  await page.locator('[data-lore-action="scene-finish"]').click();
  assert.equal(await page.evaluate(()=>localStorage.getItem("ashes-throne.lore-campaign.v1")),
    primary,tag+" replay never changes primary decision or inspection data");
  assert.deepEqual(errors.filter(e=>/LoreCampaign|lore-campaign|FIXTURE/.test(e)),[],
   tag+" no lore runtime errors");
  console.log("LC-004 browser",tag,"PASS",JSON.stringify(geometry));
 }catch(err){
  await page.screenshot({path:path.join(out,tag+"-failure.png"),fullPage:true}).catch(()=>{});
  console.error("LC-004 browser failure",tag,errors);
  throw err;
 }finally{await b.close();}
}
(async()=>{
 for(const [name,type] of [["chromium",chromium],["webkit",webkit]])
  for(const [w,h] of [[844,390],[932,430]])await check(name,type,w,h);
})().catch(err=>{console.error(err);process.exitCode=1;});
