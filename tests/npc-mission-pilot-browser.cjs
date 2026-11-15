"use strict";
/* NPCMISSION002: real WebGL, real mission entry, real auto combat, zero save effect.
 * Chromium + WebKit exercise the opt-in branch in a short landscape viewport. */
const assert=require("node:assert/strict");
const {chromium,webkit}=require("playwright");
const fs=require("node:fs"),path=require("node:path");
const out=path.join(process.cwd(),"artifacts","npc-mission-pilot");
fs.mkdirSync(out,{recursive:true});
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
async function check(name,type){
 const browser=await type.launch(name==="chromium"?
  {headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-dev-shm-usage"]}:
  {headless:true});
 const page=await browser.newPage({viewport:{width:932,height:430},hasTouch:true});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 try{
  const uri=new URL(origin);
  uri.searchParams.set("npcMissionPilot","1");
  await page.goto(uri.toString(),{waitUntil:"load",timeout:60000});
  assert.equal(await page.locator("#buildVersion").innerText(),
   "Прототип · v0.3.165 · NPCMISSION002");
  // Unlock only the prerequisite IN MEMORY. No synthetic victory or local save.
  await page.evaluate(()=>{
   campaignProgress.completed["black-pass-ambush"]=true;
   campaignProgress.bestStars["black-pass-ambush"]=1;
  });
  await page.locator('#home .hq-bottom button[data-screen="campaign"]').evaluate(el=>el.click());
  await page.locator("#campaignHub").waitFor({state:"visible",timeout:15000});
  await page.locator('[data-campaign-path="training"]').click();
  const mission=page.locator('[data-campaign-mission="demo-mission-2"]');
  assert.equal(await mission.isEnabled(),true);
  const before=await page.evaluate(()=>({
   wallet:JSON.stringify(progress),campaign:JSON.stringify(campaignProgress),
   campaignSave:localStorage.getItem(CampaignCore.KEY)
  }));
  await mission.click();
  await page.locator("#squad").waitFor({state:"visible",timeout:10000});
  await page.locator("#squadDisband").evaluate(el=>el.click());
  for(const id of ["ren","nada","liora","art","sava"])
   await page.locator('#squadRoster [data-hero-id="'+id+'"]').evaluate(el=>el.click());
  assert.equal(await page.locator("#squadCount").innerText(),"5/5");
  const start=page.locator("#squadStart");
  await start.click();
  if(await page.locator("#squad").isVisible())await start.click();
  await page.locator("#battle").waitFor({state:"visible",timeout:30000});
  const info=await page.evaluate(()=>({
   pilot:battleIsNpcMissionPilot,campaign:battleIsCampaign,
   label:document.querySelector("#battleMissionLabel").textContent,
   fighters:state.fighters.map(f=>({id:f.id,name:f.name,side:f.side})),
   meshes:state.fighters.filter(f=>f.side==="enemy").map(f=>({
    id:f.id,exists:!!meshes[f.id],enabled:!!meshes[f.id]?.body.isEnabled(),
    metadata:meshes[f.id]?.body.metadata?.fighterId
   })),
   gpu:!!scene&&!!engine,
   width:window.innerWidth,scroll:document.documentElement.scrollWidth
  }));
  assert.equal(info.pilot,true);
  assert.equal(info.campaign,true);
  assert.equal(info.gpu,true);
  assert.ok(info.label.includes("NPC-ПРОБА"));
  assert.equal(info.fighters.length,7);
  assert.deepEqual(info.fighters.filter(f=>f.side==="enemy").map(f=>f.id),
   ["npc-m2-slinger","npc-m2-medic"]);
  assert.ok(info.meshes.every(f=>f.exists&&f.enabled&&f.id===f.metadata));
  assert.ok(info.scroll<=info.width+1,"no horizontal overflow in landscape");
  await page.screenshot({path:path.join(out,name+"-arena.png"),fullPage:true});
  // 4x animation/auto speed shortens the test but uses the production UI.
  await page.locator("#autoSpeedBtn").click();
  await page.locator("#autoSpeedBtn").click();
  await page.locator("#autoBattleBtn").click();
  await page.locator("#missionResult").waitFor({state:"visible",timeout:145000});
  const result=await page.evaluate(()=>({
   title:document.querySelector("#missionResultTitle").textContent,
   stars:document.querySelector("#missionResultStars").textContent,
   text:document.querySelector("#missionResultText").textContent,
   winner:state.winner
  }));
  assert.equal(result.winner,"ally","starter Gardens five should win a light pilot");
  assert.match(result.title,/Пробный бой выигран/);
  assert.match(result.stars,/не сохраняется/);
  assert.match(result.text,/Энергия, задания, награды и сохранённые звёзды не изменены/);
  const after=await page.evaluate(()=>({
   wallet:JSON.stringify(progress),campaign:JSON.stringify(campaignProgress),
   campaignSave:localStorage.getItem(CampaignCore.KEY)
  }));
  assert.deepEqual(after,before,"no wallet, campaign or save modification");
  await page.locator("#missionResultRetry").click();
  await page.locator("#squad").waitFor({state:"visible",timeout:15000});
  await page.locator("#squadBack").click();
  assert.equal(await page.locator("#campaign").isVisible(),true);
  const end=await page.evaluate(()=>({
   wallet:JSON.stringify(progress),campaign:JSON.stringify(campaignProgress),
   gpuRunning:!!renderLoopRunning,
   scroll:document.documentElement.scrollWidth,width:innerWidth
  }));
  assert.equal(end.wallet,before.wallet);
  assert.equal(end.campaign,before.campaign);
  assert.equal(end.gpuRunning,false,"WebGL suspended on return");
  assert.ok(end.scroll<=end.width+1,"no campaign overflow after return");
  assert.deepEqual(errors.filter(e=>/TypeError|ReferenceError|CombatCore|NpcMissionPilot/.test(e)),[]);
  console.log("NPCMISSION002_BROWSERSMOKE",name,"PASS",JSON.stringify({info,result}));
 }catch(err){
  await page.screenshot({path:path.join(out,name+"-failure.png"),fullPage:true}).catch(()=>{});
  console.error("NPCMISSION002_BROWSMOKE_FAIL",name,errors);
  throw err;
 }finally{await browser.close();}
}
(async()=>{
 for(const [name,type] of [["chromium",chromium],["webkit",webkit]])await check(name,type);
})().catch(err=>{console.error(err);process.exitCode=1;});
