"use strict";
/* NPCMISSION003: opt-in two real waves on Babylon, Chromium and WebKit.
 * A completed pilot must not mutate campaign saves, wallet or daily rewards.
 */
const assert=require("node:assert/strict");
const {chromium,webkit}=require("playwright");
const fs=require("node:fs"),path=require("node:path");
const out=path.join(process.cwd(),"artifacts","npc-mission-waves");
fs.mkdirSync(out,{recursive:true});
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
async function run(name,type){
 const browser=await type.launch(name==="chromium"?
  {headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-dev-shm-usage"]}:
  {headless:true});
 const page=await browser.newPage({viewport:{width:932,height:430},hasTouch:true});
 const pageErrors=[];page.on("pageerror",e=>pageErrors.push(e.message));
 try{
  const url=new URL(origin);
  
  await page.goto(url.toString(),{waitUntil:"load",timeout:60000});
  assert.equal(await page.locator("#buildVersion").innerText(),
   "Прототип · v"+require("../package.json").version+" · LOREACT5001");
  // Simulate only prerequisites in memory, not in storage or user economy.
  await page.evaluate(()=>{
   campaignProgress.completed["black-pass-ambush"]=true;
   campaignProgress.completed["demo-mission-2"]=true;
   campaignProgress.bestStars["black-pass-ambush"]=1;
   campaignProgress.bestStars["demo-mission-2"]=1;
  });
  await page.locator('#home .hq-bottom button[data-screen="campaign"]').evaluate(el=>el.click());
  await page.locator("#campaignHub").waitFor({state:"visible",timeout:15000});
  await page.locator('[data-campaign-path="training"]').click();
  const mission=page.locator('[data-campaign-mission="demo-mission-3"]');
  assert.equal(await mission.isEnabled(),true);
  const before=await page.evaluate(()=>({
   wallet:JSON.stringify(progress),campaign:JSON.stringify(campaignProgress),
   campaignSave:localStorage.getItem(CampaignCore.KEY),
   dailySave:localStorage.getItem("ashes-throne.daily.v1")
  }));
  const card=mission.locator("xpath=ancestor::article");
  assert.doesNotMatch(await card.innerText(),/NPC-ПРОБА/);
  assert.match(await card.innerText(),/двух волн/);
  await mission.click();
  await page.locator("#squad").waitFor({state:"visible",timeout:10000});
  await page.locator("#squadDisband").evaluate(el=>el.click());
  for(const id of ["ren","nada","liora","art","sava"])
   await page.locator('#squadRoster [data-hero-id="'+id+'"]').evaluate(el=>el.click());
  assert.equal(await page.locator("#squadCount").innerText(),"5/5");
  await page.locator("#squadStart").click();
  if(await page.locator("#squad").isVisible())await page.locator("#squadStart").click();
  await page.locator("#battle").waitFor({state:"visible",timeout:30000});
  const first=await page.evaluate(()=>({
   wave:state.wave,totalWaves:state.totalWaves,pilot:battleIsNpcMissionPilot,
   fighters:state.fighters.filter(f=>f.side==="enemy").map(f=>f.id),
   visuals:state.fighters.filter(f=>f.side==="enemy").map(f=>({
    id:f.id,visible:!!meshes[f.id]?.body.isEnabled(),
    pickId:meshes[f.id]?.body.metadata?.fighterId
   })),
   gpu:!!engine&&!!scene,overflow:document.documentElement.scrollWidth>innerWidth+1
  }));
  assert.equal(first.pilot,true);
  assert.equal(first.wave,1);
  assert.equal(first.totalWaves,2);
  assert.deepEqual(first.fighters,["npc-m3-interceptor","npc-m3-signaller"]);
  assert.ok(first.visuals.every(x=>x.visible&&x.pickId===x.id));
  assert.equal(first.gpu,true);
  assert.equal(first.overflow,false);
  await page.screenshot({path:path.join(out,name+"-wave1.png"),fullPage:true});
  await page.locator("#autoSpeedBtn").click();
  await page.locator("#autoSpeedBtn").click();
  await page.locator("#autoBattleBtn").click();
  await page.waitForFunction(()=>state?.wave===2&&
   state.fighters.filter(f=>f.side==="enemy").length===3&&
   state.fighters.filter(f=>f.side==="enemy").every(f=>!!meshes[f.id]?.body.isEnabled()),
   null,{timeout:110000});
  const second=await page.evaluate(()=>({
   wave:state.wave,totalWaves:state.totalWaves,
   enemies:state.fighters.filter(f=>f.side==="enemy").map(f=>f.id),
   visuals:state.fighters.filter(f=>f.side==="enemy").map(f=>({
    id:f.id,pickId:meshes[f.id]?.body.metadata?.fighterId
   }))
  }));
  assert.deepEqual(second.enemies,["npc-m3-guard","npc-m3-slinger","npc-m3-medic"]);
  assert.ok(second.visuals.every(x=>x.id===x.pickId));
  await page.screenshot({path:path.join(out,name+"-wave2.png"),fullPage:true});
  await page.locator("#missionResult").waitFor({state:"visible",timeout:145000});
  const result=await page.evaluate(()=>({
   winner:state.winner,wave:state.wave,actions:state.allyActions,
   stars:document.querySelector("#missionResultStars").textContent,
   text:document.querySelector("#missionResultText").textContent
  }));
  assert.equal(result.winner,"ally");
  assert.equal(result.wave,2);
  assert.match(result.stars,/Оценка: [★☆]{3}/);
  assert.match(result.stars,/Лучший результат/);
  assert.match(result.text,/Получено|Победа|Наград/i);
  
  const after=await page.evaluate(()=>({
   wallet:JSON.stringify(progress),campaign:JSON.stringify(campaignProgress),
   campaignSave:localStorage.getItem(CampaignCore.KEY),
   dailySave:localStorage.getItem("ashes-throne.daily.v1")
  }));
  assert.equal(JSON.parse(after.campaign).completed["demo-mission-3"],true,"wave mission completed");
  assert.ok(JSON.parse(after.campaign).bestStars["demo-mission-3"]>=1);
  assert.notEqual(after.campaignSave,before.campaignSave,"normal campaign stars persisted");
  assert.notEqual(after.wallet,before.wallet,"ordinary campaign payout persisted");
  await page.locator("#missionResultRetry").click();
  await page.locator("#squad").waitFor({state:"visible",timeout:15000});
  await page.locator("#squadBack").click();
  const returned=await page.evaluate(()=>({
   screen:document.querySelector("#campaign").classList.contains("active"),
   running:!!renderLoopRunning,
   overflow:document.documentElement.scrollWidth>innerWidth+1
  }));
  assert.equal(returned.screen,true);
  assert.equal(returned.running,false);
  assert.equal(returned.overflow,false);
  assert.deepEqual(pageErrors.filter(x=>/TypeError|ReferenceError|CombatCore|NpcMissionPilot/.test(x)),[]);
  console.log("NPCMISSION003_BROWSERSMOKE",name,"PASS",JSON.stringify({first,second,result}));
 }catch(err){
  await page.screenshot({path:path.join(out,name+"-failed.png"),fullPage:true}).catch(()=>{});
  console.error("NPCMISSION003_BROWSERSMOKE_FAIL",name,pageErrors);throw err;
 }finally{await browser.close();}
}
(async()=>{
 for(const [name,type] of [["chromium",chromium],["webkit",webkit]])await run(name,type);
})().catch(err=>{console.error(err);process.exitCode=1;});
