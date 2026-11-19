"use strict";
/* NET-008A real UI + CombatCore + wallet receipt smoke. No claims about physical iPhone. */
const {chromium,webkit}=require("playwright");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
const dest=path.join(process.cwd(),"artifacts","net008a");
fs.mkdirSync(dest,{recursive:true});
async function run(name,engine,viewport){
 const browser=await engine.launch(name==="chromium"?
  {headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader",
   "--enable-webgl","--disable-dev-shm-usage"]}:{headless:true});
 const page=await browser.newPage({viewport,hasTouch:true});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 try{
  await page.goto(origin,{waitUntil:"load",timeout:60000});
  await page.waitForFunction(()=>typeof showScreen==="function",null,{timeout:60000});
  await page.waitForFunction(()=>!!localStorage.getItem("ashes-throne.weekly.v1"),null,{timeout:15000});
  if(await page.locator("#loginCalendar").evaluate(e=>e.classList.contains("active")))
   await page.locator('#loginCalendar [data-screen="home"]').click();
  await page.locator('#home .hq-bottom [data-screen="network"]').click();
  await page.locator("#netuxCluesPanel").waitFor({state:"visible"});
  // Existing tutorial operations remain reachable, but no longer gate daily play.
  await page.locator('#network [data-screen="operations"]').click();
  await page.locator("#operations").waitFor({state:"visible"});
  await page.locator('#operations [data-screen="network"]').click();
  await page.locator("#netuxCluesPanel").waitFor({state:"visible"});
  await page.locator('#network [data-net-view="threat"]').click();
  await page.locator("#net008aThreat").waitFor({state:"visible"});
  assert.equal(await page.locator("#netuxCluesPanel").isVisible(),false);
  assert.match(await page.locator("#net008aTitle").innerText(),/неделя с \d{1,2} [а-яё]+/i);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  await page.screenshot({path:path.join(dest,name+"-"+viewport.width+"-threat.png")});
  // A real browser battle; boosting the demo party isolates the lifecycle
  // contract from the still-provisional strength/balance tuning.
  await page.locator("#net008aSurvey").click();
  await page.locator("#squad").waitFor({state:"visible",timeout:10000});
  const checkpoint=await page.evaluate(()=>JSON.parse(
   localStorage.getItem("ashes-throne.weekly.v1")));
  assert.equal(checkpoint.active.preparation,"survey");
  await page.locator("#squadBack").click();
  await page.locator("#net008aThreat").waitFor({state:"visible",timeout:10000});
  assert.equal(await page.locator("#netuxCluesPanel").isVisible(),false);
  await page.locator("#net008aFight").click();
  await page.locator("#squad").waitFor({state:"visible",timeout:10000});
  const originalSquad=await page.evaluate(()=>localStorage.getItem("ashes-throne.squad.v1"));
  await page.reload({waitUntil:"load"});
  if(await page.locator("#loginCalendar").evaluate(e=>e.classList.contains("active")))
   await page.locator('#loginCalendar [data-screen="home"]').click();
  await page.locator('#home .hq-bottom [data-screen="network"]').click();
  await page.locator('#network [data-net-view="threat"]').click();
  await page.locator("#net008aFight").click();
  await page.locator("#squad").waitFor({state:"visible"});
  await page.locator("#squadStart").click();
  await page.locator("#battle").waitFor({state:"visible",timeout:35000});
  await page.evaluate(()=>{
   for(const ally of state.fighters.filter(x=>x.side==="ally")){
    ally.hp=40000;ally.maxHp=40000;
    ally.physicalAttack=7000;ally.atk=7000;ally.magicAttack=7000;
    ally.physicalDefense=2000;ally.magicDefense=2000;
   }
  });
  await page.locator("#autoBattleBtn").click();
  await page.waitForFunction(()=>{
   try{return JSON.parse(localStorage.getItem("ashes-throne.weekly.v1")).bestScore>=60;}
   catch(_){return false;}
  },null,{timeout:125000});
  // The wallet receipt is committed at battle termination; the visible screen
  // changes only after Babylon has drawn the final attack/death animations.
  // Real five-hero WebGL in SwiftShader may take longer than a fixed 15s.
  await page.locator("#network").waitFor({state:"visible",timeout:60000});
  const paid=await page.evaluate(()=>{
   const week=JSON.parse(localStorage.getItem("ashes-throne.weekly.v1"));
   const wallet=JSON.parse(localStorage.getItem("ashes-throne.progress.v3"));
   return {week,balance:wallet.currency,receipts:wallet.rewardReceipts||[],
    squad:localStorage.getItem("ashes-throne.squad.v1"),
    overflow:document.documentElement.scrollWidth>innerWidth+1};
  });
  const rewards=paid.receipts.filter(x=>x.sourceId.startsWith("net008a-stage-"));
  const earned=[60,75,90].filter(score=>paid.week.bestScore>=score).length;
  assert.equal(rewards.length,earned,"only achieved S1 reward tiers are payable");
  assert.ok(earned>=1,"the test must establish a real winning result");
  assert.equal(paid.squad,originalSquad,"weekly lineup must not mutate default squad");
  assert.equal(paid.overflow,false);
  await page.reload({waitUntil:"load"});
  await page.waitForFunction(()=>typeof showScreen==="function");
  const duplicate=await page.evaluate(()=>{
   const wallet=JSON.parse(localStorage.getItem("ashes-throne.progress.v3"));
   return (wallet.rewardReceipts||[]).filter(x=>x.sourceId.startsWith("net008a-stage-")).length;
  });
  assert.equal(duplicate,rewards.length,"reload never grants another weekly payout");
  await page.screenshot({path:path.join(dest,name+"-"+viewport.width+"-final.png")});
  assert.deepEqual(errors.filter(x=>/TypeError|ReferenceError|NET008A|weekly/i.test(x)),[]);
  console.log("NET008A_BROWSER",name,viewport.width+"x"+viewport.height,"PASS",
   JSON.stringify({score:paid.week.bestScore,paid:rewards.length}));
 }catch(e){
  const diagnostic=await page.evaluate(()=>({
   screen:document.querySelector(".screen.active")?.id,
   active:typeof state!=="undefined"?state.active:null,
   winner:typeof state!=="undefined"?state.winner:null,
   weeklyReady:typeof weeklyResultReady!=="undefined"?weeklyResultReady:null,
   transition:typeof visualTransition!=="undefined"?visualTransition:null,
   pending:typeof BattleAnimation!=="undefined"?BattleAnimation.pending():null,
   renderLoop:typeof renderLoopRunning!=="undefined"?renderLoopRunning:null,
   display:document.querySelector("#battleMessage")?.textContent
  })).catch(()=>null);
  console.error("NET008A_BROWSER_FAIL",name,viewport,errors,diagnostic);
  await page.screenshot({path:path.join(dest,name+"-"+viewport.width+"-fail.png"),
   fullPage:true}).catch(()=>{});
  throw e;
 }finally{await browser.close();}
}
(async()=>{
 for(const [name,engine] of [["chromium",chromium],["webkit",webkit]])
  for(const viewport of [{width:844,height:390},{width:932,height:430}])
   await run(name,engine,viewport);
})().catch(e=>{console.error(e);process.exitCode=1});
