"use strict";
/* NET-UX-003: real DOM/touch routes, local-day wallet and reload. Browser engines
 * emulate mobile viewports; this is NOT a physical iPhone Safari test. */
const {chromium,webkit}=require("playwright");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
const dest=path.join(process.cwd(),"artifacts","netux003");
fs.mkdirSync(dest,{recursive:true});
async function run(name,engine,viewport){
 const browser=await engine.launch(name==="chromium"?
  {headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader",
   "--enable-webgl","--disable-dev-shm-usage"]}:{headless:true});
 const page=await browser.newPage({viewport,hasTouch:true});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 async function network(){
  await page.locator('#home .hq-bottom [data-screen="network"]').click();
  await page.locator("#netuxCluesPanel").waitFor({state:"visible"});
  await page.locator('#network [data-net-view="daily"]').click();
  await page.locator("#netuxDailyPanel").waitFor({state:"visible"});
 }
 try{
  await page.goto(origin,{waitUntil:"load",timeout:60000});
  await page.waitForFunction(()=>typeof showScreen==="function",null,{timeout:60000});
  if(await page.locator("#loginCalendar").evaluate(x=>x.classList.contains("active")))
   await page.locator('#loginCalendar [data-screen="home"]').click();
  const before=await page.evaluate(()=>({
   wallet:localStorage.getItem("ashes-throne.progress.v3"),
   network:localStorage.getItem("ashes-throne.network.v1")
  }));
  await network();
  assert.equal(await page.locator('#netuxDailyTaskList .netux-daily-task').count(),5);
  assert.equal(await page.locator("#netuxCluesPanel").isVisible(),false);
  assert.match(await page.locator("#netuxDailyProgress").innerText(),/Выполнено 0 из 5/);
  assert.equal(await page.locator("#netuxDailyClaimAll").isDisabled(),true);
  assert.equal(await page.locator('#network [data-net-view="daily"]').getAttribute("aria-pressed"),"true");
  assert.equal(await page.evaluate(()=>localStorage.getItem("ashes-throne.progress.v3")),before.wallet,
   "opening a daily UI must not write the wallet");
  assert.equal(await page.evaluate(()=>localStorage.getItem("ashes-throne.network.v1")),before.network,
   "opening a daily UI must not change network.v1");
  for(const [taskId,screen,heading] of [
   ["hero-level","collection",null],["equip-item","collection",null],
   ["campaign-battle","campaign",null],
   ["tactical-participation","challenges","Тактические задачи"],
   ["onslaught-participation","challenges","Натиск"]]){
   await page.locator('#netuxDailyTaskList [data-daily-go="'+taskId+'"]').click();
   await page.locator("#"+screen).waitFor({state:"visible"});
   if(heading)assert.equal(await page.locator("#challengeModeTitle").innerText(),heading);
   await page.locator("#netuxDailyReturn").click();
   await page.locator("#netuxDailyPanel").waitFor({state:"visible"});
   assert.equal(await page.locator('#network [data-net-view="daily"]').getAttribute("aria-pressed"),"true");
  }
  // A recorded real-activity event is simulated here solely to isolate reward UI
  // from combat balance; production events still come from existing game handlers.
  const seeded=await page.evaluate(()=>{
   const day=DailyCore.localDay();
   const previous=progress.currency;
   if(!recordDailyTask("hero-level")||!recordDailyTask("campaign-battle"))
    throw Error("Test event setup failed");
   if(!persistProgress())throw Error("Test save unavailable");
   return {day,previous};
  });
  await page.locator('#network [data-net-view="clues"]').click();
  await page.locator('#network [data-net-view="daily"]').click();
  assert.match(await page.locator("#netuxDailyProgress").innerText(),/Выполнено 2 из 5/);
  assert.equal(await page.locator("#netuxDailyClaimAll").isDisabled(),false);
  assert.equal(await page.locator("#netuxDailyBadge").innerText(),"2");
  await page.locator('#netuxDailyTaskList [data-daily-claim="hero-level"]').click();
  const once=await page.evaluate(()=>({
   currency:progress.currency,
   count:progress.daily.claimed.length,
   save:JSON.parse(localStorage.getItem("ashes-throne.progress.v3"))
  }));
  assert.equal(once.currency,seeded.previous+200);
  assert.equal(once.count,1);
  assert.equal(await page.locator('#netuxDailyTaskList [data-daily-claim="hero-level"]').isDisabled(),true);
  await page.locator("#netuxDailyClaimAll").click();
  const claimed=await page.evaluate(()=>({
   currency:progress.currency,
   claimed:progress.daily.claimed.slice(),
   network:localStorage.getItem("ashes-throne.network.v1")
  }));
  assert.equal(claimed.currency,seeded.previous+450,"the second eligible reward adds 250");
  assert.equal(claimed.claimed.length,2);
  assert.equal(claimed.network,before.network);
  assert.equal(await page.locator("#netuxDailyClaimAll").isDisabled(),true);
  assert.equal(await page.locator("#netuxDailyBadge").isVisible(),false);
  const touch=await page.evaluate(()=>{
   const ids=['#network [data-net-view="clues"]','#network [data-net-view="threat"]',
    '#network [data-net-view="daily"]','#netuxDailyTaskList [data-daily-go="equip-item"]'];
   return {rects:ids.map(id=>document.querySelector(id)?.getBoundingClientRect().height),
    overflow:document.documentElement.scrollWidth>innerWidth+1,
    scrollable:document.querySelector("#netuxDailyTaskList").scrollHeight>
     document.querySelector("#netuxDailyTaskList").clientHeight};
  });
  assert.equal(touch.overflow,false,"no horizontal viewport overflow");
  assert.ok(touch.rects.every(x=>x>=44),"touch targets are at least 44px: "+JSON.stringify(touch));
  assert.ok(touch.scrollable,"daily rows scroll within the network instead of growing the page");
  await page.screenshot({path:path.join(dest,name+"-"+viewport.width+"-daily.png")});
  await page.reload({waitUntil:"load",timeout:60000});
  await page.waitForFunction(()=>typeof showScreen==="function");
  if(await page.locator("#loginCalendar").evaluate(x=>x.classList.contains("active")))
   await page.locator('#loginCalendar [data-screen="home"]').click();
  await network();
  assert.match(await page.locator("#netuxDailyProgress").innerText(),/Выполнено 2 из 5/);
  assert.equal(await page.locator("#netuxDailyClaimAll").isDisabled(),true);
  assert.equal(await page.locator('#netuxDailyTaskList [data-daily-claim="hero-level"]').isDisabled(),true);
  const restored=await page.evaluate(()=>({
   currency:progress.currency,claimed:progress.daily.claimed,
   day:progress.daily.day,network:localStorage.getItem("ashes-throne.network.v1")
  }));
  assert.equal(restored.currency,claimed.currency);
  assert.equal(restored.claimed.length,2);
  assert.equal(restored.day,seeded.day);
  assert.equal(restored.network,before.network);
  await page.locator('#network [data-net-view="clues"]').click();
  await page.locator('#network [data-net-view="threat"]').click();
  await page.locator('#network [data-net-view="daily"]').click();
  await page.locator('#network [data-net-view="clues"]').click();
  assert.equal(await page.locator("#netuxCluesPanel").isVisible(),true);
  assert.deepEqual(errors.filter(e=>/TypeError|ReferenceError|NETUX/i.test(e)),[]);
  console.log("NETUX003_BROWSER",name,viewport.width+"x"+viewport.height,"PASS");
 }catch(e){
  console.error("NETUX003_BROWSER_FAIL",name,viewport,errors);
  await page.screenshot({path:path.join(dest,name+"-"+viewport.width+"-fail.png"),fullPage:true}).catch(()=>{});
  throw e;
 }finally{await browser.close();}
}
(async()=>{
 for(const [name,engine] of [["chromium",chromium],["webkit",webkit]])
  for(const viewport of [{width:844,height:390},{width:932,height:430}])
   await run(name,engine,viewport);
})().catch(e=>{console.error(e);process.exitCode=1;});
