"use strict";
// FIRSTPLAY001: actual first boot, normal controls, recovery and confirmed debug reset.
// Chromium/WebKit emulation is not a physical iPhone Safari test.
const {chromium,webkit}=require("playwright");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
const dest=path.join(process.cwd(),"artifacts","first-play");
fs.mkdirSync(dest,{recursive:true});
async function run(label,engine,viewport){
 const browser=await engine.launch(label==="chromium"?{
  headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader",
   "--enable-webgl","--disable-dev-shm-usage"]
 }:{headless:true});
 const page=await browser.newPage({viewport,hasTouch:true});
 const errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 try{
  await page.goto(origin,{waitUntil:"load",timeout:60000});
  await page.waitForFunction(()=>typeof FirstPlayCore!=="undefined"&&
   typeof showScreen==="function"&&
   document.querySelector("#walletWriterNotice")?.style.display==="none",null,{timeout:60000});
  await page.locator("#firstPlay.active").waitFor({state:"visible",timeout:12000});
  assert.equal(await page.locator("#loginCalendar").evaluate(n=>n.classList.contains("active")),false);
  const bounds=await page.evaluate(()=>({
   overflow:document.documentElement.scrollWidth>innerWidth+1,
   panel:(()=>{const r=document.querySelector("#firstPlay .first-play-panel").getBoundingClientRect();
    return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}})(),
   height:innerHeight,width:innerWidth
  }));
  assert.equal(bounds.overflow,false,label+": no horizontal overflow");
  assert.ok(bounds.panel.left>=0&&bounds.panel.right<=bounds.width+1&&
   bounds.panel.top>=0&&bounds.panel.bottom<=bounds.height+1,
   label+": first play panel within landscape viewport");
  assert.equal(await page.locator("#firstPlayBattle").isDisabled(),true);
  await page.locator("#firstPlaySurvey").click();
  assert.equal(await page.locator("#firstPlaySurvey").getAttribute("aria-pressed"),"true");
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem(FirstPlayCore.KEY)).choice),"survey");
  // Reload must offer the same actual choice and retry, not silently skip onboarding.
  await page.reload({waitUntil:"load",timeout:60000});
  await page.waitForFunction(()=>typeof FirstPlayCore!=="undefined"&&
   document.querySelector("#firstPlay")?.classList.contains("active"),null,{timeout:60000});
  assert.equal(await page.locator("#firstPlayBattle").isDisabled(),false);
  await page.locator("#firstPlayBattle").click();
  await page.locator("#battle.active").waitFor({state:"visible",timeout:60000});
  const detail=await page.evaluate(()=>({
   lineup:state.fighters.map(f=>({id:f.id,hp:f.hp,speed:f.speed})),
   tactical:state.tacticalObjective,
   wallet:localStorage.getItem("ashes-throne.progress.v3"),
   choice:JSON.parse(localStorage.getItem(FirstPlayCore.KEY)).choice
  }));
  assert.deepEqual(detail.lineup.map(f=>f.id),["art","ren","npc-first-guard","npc-first-interceptor"]);
  assert.equal(detail.tactical.kind,"hold-or-defeat");
  assert.equal(detail.choice,"survey");
  assert.ok(detail.lineup[0].speed>118,label+": survey bonus changes combat speed");
  await page.screenshot({path:path.join(dest,label+"-"+viewport.width+"x"+viewport.height+"-battle.png")});
  // Resolve through the real combat core; UI receives the result through syncBattleUI.
  // No synthetic force-victory or checkpoint mutation.
  const result=await page.evaluate(()=>{
   let count=0;
   while(state.active&&count++<100){
    const plan=AutoDecision.chooseAction(state);
    if(!CombatCore.performAutoAction(state,plan))break;
   }
   syncBattleUI();
   return {active:state.active,winner:state.winner,
    phase:firstPlayState.phase,steps:count};
  });
  assert.equal(result.active,false,label+": battle must end through combat rules: "+JSON.stringify(result));
  await page.locator("#firstPlay.active").waitFor({state:"visible",timeout:30000});
  // If enemy wins, user can retry. Never show a fictitious success.
  if(result.winner==="enemy"){
   assert.equal(await page.evaluate(()=>firstPlayState.phase),"ready");
   assert.equal(await page.locator("#firstPlayOutcome").isVisible(),false);
   // Start a new battle and enforce win via player tactical actions? For this
   // regression, reset flow is reachable through the explicit Skip in briefing.
   await page.locator("#firstPlaySkip").click();
  }else{
   assert.equal(await page.evaluate(()=>firstPlayState.phase),"won");
   assert.equal(await page.locator("#firstPlayOutcome").isVisible(),true);
   await page.locator("#firstPlayContinue").click();
  }
  if(await page.locator("#loginCalendar.active").count())
   await page.locator('#loginCalendar [data-screen="home"]').click();
  await page.locator("#home.active").waitFor({state:"visible",timeout:12000});
  await page.locator("#hqMoreToggle").click();
  await page.locator("#home .hq-test-menu summary").click();
  await page.locator("#devStartOver").click();
  assert.equal(await page.locator("#devRestartDialog").evaluate(n=>n.open),true);
  await page.locator("#devRestartCancel").click();
  assert.equal(await page.locator("#devRestartDialog").evaluate(n=>n.open),false);
  assert.ok(await page.evaluate(()=>localStorage.getItem(FirstPlayCore.KEY)!==null));
  await page.locator("#hqMoreToggle").click();
  if(!(await page.locator("#home .hq-test-menu").evaluate(n=>n.open)))
   await page.locator("#home .hq-test-menu summary").click();
  await page.locator("#devStartOver").click();
  await page.locator("#devRestartConfirm").click();
  await page.waitForFunction(()=>document.querySelector("#firstPlay")?.classList.contains("active")
   &&typeof FirstPlayCore!=="undefined"&&
   localStorage.getItem(FirstPlayCore.KEY)===null,null,{timeout:60000});
  assert.equal(await page.locator("#firstPlayBattle").isDisabled(),true);
  assert.equal(await page.evaluate(()=>localStorage.getItem("ashes-throne.campaign.v1")),null);
  assert.deepEqual(errors,[]);
  console.log("FIRSTPLAY001 "+label+" "+viewport.width+"x"+viewport.height+
   " verified; battle: "+result.winner+" in "+result.steps+" actions");
 }finally{await browser.close();}
}
(async()=>{
 await run("chromium",chromium,{width:844,height:390});
 await run("webkit",webkit,{width:932,height:430});
})().catch(error=>{console.error(error);process.exitCode=1;});
