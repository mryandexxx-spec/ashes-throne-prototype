"use strict";
/* LC-004: real 3D combat launched from lore map, without a fabricated canonical battle. */
const assert=require("node:assert/strict");
const {chromium,webkit}=require("playwright");
const fs=require("node:fs"),path=require("node:path");
const out=path.join(process.cwd(),"artifacts","lore-training-browser");
fs.mkdirSync(out,{recursive:true});
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765";
async function openLore(page){
 await page.locator('#home .hq-bottom button[data-screen="campaign"]').evaluate(el=>el.click());
 await page.locator("#campaignHub").waitFor({state:"visible",timeout:15000});
 await page.locator('[data-campaign-path="lore"]').click();
 await page.locator(".lore-story-cover").click();
}
async function startFight(page){
 await page.locator('[data-lore-action="training-battle"]').click();
 await page.locator("#squad").waitFor({state:"visible"});
 const choices=page.locator("#squadRoster .squad-choice:not([disabled]):not(.chosen)");
 let attempts=0;
 while(await choices.count()&&attempts++<5)await choices.first().click();
 const start=page.locator("#squadStart");
 await start.click();
 if(await page.locator("#squad").isVisible())await start.click();
 await page.locator("#battle").waitFor({state:"visible",timeout:25000});
 await page.waitForFunction(()=>typeof state!=="undefined"&&state?.fighters?.length>=2&&
  document.querySelector("#battle")?.classList.contains("active"),null,{timeout:25000});
}
async function check(name,type){
 const args=name==="chromium"?["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-dev-shm-usage"]:undefined;
 const browser=await type.launch(args?{headless:true,args}:{headless:true});
 const page=await browser.newPage({viewport:{width:932,height:430},hasTouch:true});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 try{
  await page.goto(origin,{waitUntil:"load",timeout:60000});
  await openLore(page);
  assert.equal(await page.locator('[data-lore-action="training-battle"]').count(),1);
  const original=await page.evaluate(()=>({
   wallet:JSON.stringify(progress),
   campaign:JSON.stringify(campaignProgress),
   lore:window.localStorage.getItem("ashes-throne.lore-campaign.v1")
  }));
  await startFight(page);
  const combat=await page.evaluate(()=>({
   training:battleIsLoreTraining,campaign:battleIsCampaign,story:battleIsStoryDemo,
   label:document.querySelector("#battleMissionLabel").textContent,
   participants:state.fighters.map(f=>({id:f.id,name:f.name,side:f.side})),
   webgl:!!engine&&!!scene,
   arenaVisible:document.querySelector("#battle").classList.contains("active")
  }));
  assert.equal(combat.training,true);
  assert.equal(combat.campaign,false);
  assert.equal(combat.story,false);
  assert.ok(combat.label.includes("ВНЕ КАНОНА"));
  assert.ok(combat.participants.some(f=>f.name==="Учебный противник 1"));
  assert.equal(combat.webgl,true,"actual Babylon.js battle must start");
  await page.screenshot({path:path.join(out,name+"-training-arena.png"),fullPage:true});
  await page.locator("#autoBattleBtn").click();
  await page.waitForFunction(()=>document.querySelector("#loreTrainingResult")?.classList.contains("active"),
   null,{timeout:110000});
  const result=await page.locator("#loreTrainingResultText").innerText();
  assert.match(result,/без наград, энергии и изменений сюжета/);
  const after=await page.evaluate(()=>({
   wallet:JSON.stringify(progress),
   campaign:JSON.stringify(campaignProgress),
   lore:window.localStorage.getItem("ashes-throne.lore-campaign.v1")
  }));
  assert.deepEqual(after,original,name+" never mutates wallet, campaign or lore saves");
  await page.locator("#loreTrainingResultRetry").click();
  await page.locator("#squad").waitFor({state:"visible"});
  await page.locator("#squadBack").click();
  assert.equal(await page.locator("#campaign").isVisible(),true);
  assert.equal(await page.locator("#campaignLoreContent").isVisible(),true);
  assert.equal(await page.locator(".lore-map-marker").count(),3);
  // Verify direct quit midfight returns to the lore map, not main menu.
  await startFight(page);
  await page.locator('#battle .battle-top button[data-screen="home"]').click();
  assert.equal(await page.locator("#campaignLoreContent").isVisible(),true);
  assert.equal(await page.locator(".lore-map-marker").count(),3);
  const last=await page.evaluate(()=>({
   wallet:JSON.stringify(progress),campaign:JSON.stringify(campaignProgress),
   lore:localStorage.getItem("ashes-throne.lore-campaign.v1"),
   gpuRunning:!!renderLoopRunning
  }));
  assert.equal(last.wallet,original.wallet);
  assert.equal(last.campaign,original.campaign);
  assert.equal(last.lore,original.lore);
  assert.equal(last.gpuRunning,false,"arena render loop suspended after return");
  assert.deepEqual(errors.filter(e=>/LoreCampaign|Battle|lore-training/.test(e)),[],
   name+" no battle/lore JS exceptions");
  console.log("LC-004 TRAINING",name,"PASS",JSON.stringify({combat,result}));
 }catch(e){
  await page.screenshot({path:path.join(out,name+"-failure.png"),fullPage:true}).catch(()=>{});
  console.error("LC-004 TRAINING FAILURE",name,errors);
  throw e;
 }finally{await browser.close();}
}
(async()=>{
 for(const [name,type] of [["chromium",chromium],["webkit",webkit]])await check(name,type);
})().catch(e=>{console.error(e);process.exitCode=1;});
