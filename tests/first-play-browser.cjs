"use strict";
// FIRSTPLAY001: actual first boot, normal controls, recovery and confirmed debug reset.
// Chromium/WebKit emulation is not a physical iPhone Safari test.
const {chromium,webkit}=require("playwright");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
const dest=path.join(process.cwd(),"artifacts","squad-recovery","first-play");
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
   scene:(()=>{const r=document.querySelector("#firstPlayStory").getBoundingClientRect();
    return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}})(),
   height:innerHeight,width:innerWidth
  }));
  assert.equal(bounds.overflow,false,label+": no horizontal overflow");
  assert.ok(bounds.scene.left>=0&&bounds.scene.right<=bounds.width+1&&
   bounds.scene.top>=0&&bounds.scene.bottom<=bounds.height+1,
   label+": story viewport within landscape screen");
  await page.waitForFunction(()=>document.querySelector("#firstPlayStoryImage")?.naturalWidth>=1600,null,{timeout:12000});
  await page.waitForFunction(()=>{
   const img=document.querySelector("#firstPlayStoryImage");
   return img?.naturalWidth>=1600&&!img.hidden&&
    getComputedStyle(img).display!=="none"&&getComputedStyle(img).visibility!=="hidden";
  },null,{timeout:12000});
  assert.equal(await page.locator("#firstPlayStoryImage").isVisible(),true);
  assert.match(await page.locator("#firstPlayStoryImage").evaluate(n=>n.currentSrc),/\/v3\/bridge-approach\.(?:avif|webp)$/);
  assert.equal(await page.locator("#firstPlayStoryChoices").isVisible(),false);
  assert.equal(await page.locator("#firstPlayStoryFight").isVisible(),false);
  assert.equal(await page.locator("#firstPlayStoryCharacter").isVisible(),false,
   label+": worker must not be represented by a random hero portrait");
  assert.equal(await page.locator("#firstPlayStory").getAttribute("data-shot"),"workers");
  assert.equal(await page.locator("#firstPlayStoryVoice").isVisible(),false,
   label+": offscreen worker has no fake portrait or emoji icon");
  assert.equal(await page.locator("#firstPlayStorySpeaker").textContent(),"РАБОЧИЙ");
  await page.screenshot({path:path.join(dest,label+"-"+viewport.width+"x"+viewport.height+"-opening.png")});
  // Regular dialogue navigation and interruption/resume before the commander choice.
  await page.locator("#firstPlayStoryNext").click();
  assert.equal(await page.locator("#firstPlayStorySpeaker").textContent(),"МАСТЕР УЧАСТКА");
  await page.locator("#firstPlayStoryNext").click();
  assert.equal(await page.locator("#firstPlayStorySpeaker").textContent(),"АРТ");
  assert.equal(await page.locator("#firstPlayStoryCharacter").isVisible(),true);
  assert.equal(await page.locator("#firstPlayStoryVoice").isVisible(),true);
  assert.match(await page.locator("#firstPlayStoryCharacterPortrait").getAttribute("src"),/assets\/art-portrait-ui\.webp\?v=2$/);
  assert.equal(await page.locator("#firstPlayStory").getAttribute("data-shot"),"supports");
  assert.equal(await page.locator("#firstPlayStoryCharacter").evaluate(n=>n.closest(".fp-story-dialogue")!==null),true);
  const portraitBounds=await page.locator("#firstPlayStoryCharacter").boundingBox();
  const dialogueBounds=await page.locator("#firstPlayStory .fp-story-dialogue").boundingBox();
  assert.ok(portraitBounds.width<=80&&portraitBounds.height<=80,
   label+": speaking portrait must be compact, not a pasted poster");
  assert.ok(portraitBounds.x>=dialogueBounds.x-1&&
   portraitBounds.x+portraitBounds.width<=dialogueBounds.x+dialogueBounds.width+1&&
   portraitBounds.y>=dialogueBounds.y-1&&
   portraitBounds.y+portraitBounds.height<=dialogueBounds.y+dialogueBounds.height+1,
   label+": speaker portrait belongs inside dialogue panel");
  await page.waitForFunction(()=>document.querySelector("#firstPlayStoryCharacterPortrait")?.naturalWidth>0);
  await page.screenshot({path:path.join(dest,label+"-"+viewport.width+"x"+viewport.height+"-art.png")});
  await page.locator("#firstPlayStoryNext").click();
  assert.equal(await page.locator("#firstPlayStorySpeaker").textContent(),"РЕН ТЕРЕН");
  assert.equal(await page.locator("#firstPlayStory").getAttribute("data-shot"),"route");
  assert.match(await page.locator("#firstPlayStoryCharacterPortrait").getAttribute("src"),/assets\/ren-portrait-ui\.webp$/);
  await page.waitForFunction(()=>document.querySelector("#firstPlayStoryCharacterPortrait")?.complete&&
   document.querySelector("#firstPlayStoryCharacterPortrait")?.naturalWidth>0);
  await page.screenshot({path:path.join(dest,label+"-"+viewport.width+"x"+viewport.height+"-ren.png")});
  // The cutscene cursor is restored independently of wallet state.
  await page.reload({waitUntil:"load",timeout:60000});
  await page.locator("#firstPlay.active").waitFor({state:"visible",timeout:30000});
  assert.equal(await page.locator("#firstPlayStorySpeaker").textContent(),"РЕН ТЕРЕН");
  // Skip the remaining *cutscene*, never the mandatory order or battle.
  await page.locator("#firstPlayStorySkip").click();
  await page.screenshot({path:path.join(dest,label+"-"+viewport.width+"x"+viewport.height+"-decision.png")});
  assert.equal(await page.locator("#firstPlayStoryChoices").isVisible(),true);
  assert.equal(await page.locator("#firstPlayStoryFight").isVisible(),false);
  assert.equal(await page.locator("#firstPlayStoryCharacter").isVisible(),false,
   label+": master must not borrow Ren or Art portrait");
  assert.equal(await page.locator("#firstPlayStory").getAttribute("data-shot"),"wide");
  const choice=label==="chromium"?"survey":"cover";
  await page.locator(choice==="survey"?"#firstPlayStorySurvey":"#firstPlayStoryCover").click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem(FirstPlayCore.KEY)).choice),choice);
  assert.equal(await page.locator("#firstPlayStoryFight").isVisible(),true);
  assert.equal(await page.locator("#firstPlayStoryCharacter").isVisible(),true);
  assert.equal(await page.locator("#firstPlayStorySpeaker").textContent(),choice==="survey"?"АРТ":"РЕН ТЕРЕН");
  // Reload must offer the same actual choice and retry, not silently skip onboarding.
  await page.reload({waitUntil:"load",timeout:60000});
  await page.waitForFunction(()=>typeof FirstPlayCore!=="undefined"&&
   document.querySelector("#firstPlay")?.classList.contains("active"),null,{timeout:60000});
  assert.equal(await page.locator("#firstPlayStoryFight").isVisible(),true);
  await page.locator("#firstPlayStoryFight").click();
  await page.locator("#battle.active").waitFor({state:"visible",timeout:60000});
  const detail=await page.evaluate(()=>({
   lineup:state.fighters.map(f=>({id:f.id,hp:f.hp,speed:f.speed})),
   tactical:state.tacticalObjective,
   wallet:localStorage.getItem("ashes-throne.progress.v3"),
   choice:JSON.parse(localStorage.getItem(FirstPlayCore.KEY)).choice
  }));
  assert.deepEqual(detail.lineup.map(f=>f.id),["art","ren","npc-first-guard","npc-first-interceptor"]);
  assert.equal(detail.tactical.kind,"hold-or-defeat");
  assert.equal(detail.choice,choice);
  if(choice==="survey")assert.ok(detail.lineup[0].speed>118,label+": survey bonus changes combat speed");
  else assert.ok(await page.evaluate(()=>state.fighters.find(f=>f.id==="ren").protection>=35),
   label+": cover order changes Ren protection");
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
   assert.equal(await page.locator("#firstPlayStoryFinish").isVisible(),false);
   assert.equal(await page.locator("#firstPlayStoryFight").isVisible(),true);
   // Only for test cleanup: the hidden legacy whole-flow skip remains intentional
   // infrastructure; the user-visible Skip never bypasses the actual encounter.
   await page.evaluate(()=>document.querySelector("#firstPlaySkip").click());
  }else{
   assert.equal(await page.evaluate(()=>firstPlayState.phase),"won");
   assert.equal(await page.locator("#firstPlayStoryFinish").isVisible(),false);
   assert.equal(await page.locator("#firstPlayStorySpeaker").textContent(),"АРТ");
   await page.locator("#firstPlayStoryNext").click();
   assert.equal(await page.locator("#firstPlayStorySpeaker").textContent(),"МАСТЕР УЧАСТКА");
   assert.equal(await page.locator("#firstPlayStoryFinish").isVisible(),true);
   await page.locator("#firstPlayStoryFinish").click();
  }
  if(await page.locator("#loginCalendar.active").count())
   await page.locator('#loginCalendar [data-screen="home"]').click();
  await page.locator("#home.active").waitFor({state:"visible",timeout:12000});
  assert.equal(await page.locator("#hqFirstPlayCard").count(),0,
   label+": completed operation must not cover HQ");
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
   JSON.parse(localStorage.getItem(FirstPlayCore.KEY)||"null")?.phase==="briefing"
   &&JSON.parse(localStorage.getItem(FirstPlayCore.KEY)||"null")?.choice===null,
   null,{timeout:60000});
  assert.equal(await page.locator("#firstPlayStoryChoices").isVisible(),false);
  assert.equal(await page.locator("#firstPlayStoryFight").isVisible(),false);
  assert.equal(await page.locator("#firstPlayStoryNext").isVisible(),true);
  assert.equal(await page.locator("#firstPlayStorySpeaker").textContent(),"РАБОЧИЙ");
  assert.equal(await page.evaluate(()=>localStorage.getItem("ashes-throne.campaign.v1")),null);
  assert.deepEqual(errors,[]);
  console.log("FIRSTPLAY002 "+label+" "+viewport.width+"x"+viewport.height+
   " verified; battle: "+result.winner+" in "+result.steps+" actions");
 }finally{await browser.close();}
}
(async()=>{
 await run("chromium",chromium,{width:844,height:390});
 await run("webkit",webkit,{width:932,height:430});
})().catch(error=>{console.error(error);process.exitCode=1;});
