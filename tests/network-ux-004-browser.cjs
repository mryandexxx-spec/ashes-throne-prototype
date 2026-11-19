"use strict";
/* NET-UX-004: mobile Chromium + WebKit emulation, NOT a physical iPhone. */
const {chromium,webkit}=require("playwright");
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
const dest=path.join(process.cwd(),"artifacts","netux004");
fs.mkdirSync(dest,{recursive:true});
async function check(name,engine,viewport){
 const browser=await engine.launch(name==="chromium"?{
  headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader",
   "--enable-webgl","--disable-dev-shm-usage"]
 }:{headless:true});
 const page=await browser.newPage({viewport,hasTouch:true});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 try{
  await page.goto(origin,{waitUntil:"load",timeout:60000});
  await page.waitForFunction(()=>typeof showScreen==="function",null,{timeout:60000});
  if(await page.locator("#loginCalendar").evaluate(el=>el.classList.contains("active")))
   await page.locator('#loginCalendar [data-screen="home"]').click();
  await page.locator('#home .hq-bottom [data-screen="network"]').click();
  await page.locator("#net004Clues .netux-clue-pick").first().waitFor({state:"visible"});
  const board=page.locator("#net004Clues");
  assert.ok(await board.locator(".netux-clue-pick").count()>=2,"first live board offers clues");
  const geom=await page.evaluate(()=>{
   const rect=id=>{const r=document.querySelector(id).getBoundingClientRect();return {
    x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
   return {windowWidth:innerWidth,windowHeight:innerHeight,
    overflow:document.documentElement.scrollWidth>innerWidth+1,
    rail:rect("#network .netux-rail"),board:rect("#net004Clues"),
    tabs:rect("#network .netux-tabs"),action:rect("#network .netux-board-selection"),
    picks:[...document.querySelectorAll("#net004Clues .netux-clue-pick")]
     .map(el=>({height:el.getBoundingClientRect().height,width:el.getBoundingClientRect().width})),
    controls:[...document.querySelectorAll("#network .netux-tabs button:not([hidden]), #netuxStartSelected, #netuxSimulateSelected, #netuxThreatShortcut, #netuxOrderDetails summary")]
     .filter(el=>!el.hidden).map(el=>el.getBoundingClientRect().height)
   };
  });
  assert.equal(geom.overflow,false,"no horizontal overflow");
  assert.ok(geom.rail.x>=-1&&geom.board.x>geom.rail.right,"separate rail and board");
  assert.ok(geom.tabs.bottom<=geom.board.y+3,"tabs must not overlap clue board");
  assert.ok(geom.board.width>300&&geom.board.height>=90,"board occupies useful landscape space");
  assert.ok(geom.action.bottom<=viewport.height+1,"primary action remains visible");
  assert.ok(geom.picks.every(rect=>rect.height>=44&&rect.width>=44),"cards have touch targets");
  assert.ok(geom.controls.every(h=>h>=28),"refresh may be compact; primary touch controls remain 44");
  assert.ok((await page.locator("#netuxOrderDetails").evaluate(x=>x.open))===false,
   "order options should be collapsed by default");
  await page.locator("#netuxOrderDetails summary").click();
  assert.ok(await page.locator("#net005OrderChoices button").count()>0,
   "original order controls remain available");
  await page.locator("#netuxOrderDetails summary").click();
  const saved=await page.evaluate(()=>({
   wallet:localStorage.getItem("ashes-throne.progress.v3"),
   network:localStorage.getItem("ashes-throne.network.v1")
  }));
  const second=board.locator(".netux-clue-pick").nth(1);
  await second.click();
  assert.equal(await second.getAttribute("aria-pressed"),"true");
  assert.equal(await board.locator(".netux-clue-pick").first().getAttribute("aria-pressed"),"false");
  assert.equal(await page.evaluate(()=>localStorage.getItem("ashes-throne.network.v1")),saved.network,
   "clue selection cannot write a network save");
  assert.equal(await page.evaluate(()=>localStorage.getItem("ashes-throne.progress.v3")),saved.wallet,
   "clue selection cannot touch the wallet");
  assert.equal(await page.locator("#netuxStartSelected").isDisabled(),false);
  assert.equal(await page.locator("#netuxSimulateSelected").isDisabled(),true,
   "first-time clue cannot be simulated");
  await page.locator('#network [data-net-view="daily"]').click();
  assert.equal(await page.locator("#netuxDailyPanel").isVisible(),true);
  assert.equal(await page.locator("#netuxDailyTaskList .netux-daily-task").count(),5);
  await page.locator('#network .netux-tabs [data-net-view="threat"]').click();
  assert.equal(await page.locator("#net008aThreat").isVisible(),true);
  await page.locator('#network .netux-tabs [data-net-view="clues"]').click();
  assert.equal(await second.getAttribute("aria-pressed"),"true","clue selection survives tab navigation");
  await page.screenshot({path:path.join(dest,name+"-"+viewport.width+"-board.png")});
  await page.locator("#netuxStartSelected").click();
  await page.waitForFunction(()=>document.querySelector("#net004Active")?.hidden===false,
   null,{timeout:20000});
  assert.equal(await page.locator("#net004Board").isVisible(),false);
  const active=await page.evaluate(()=>JSON.parse(localStorage.getItem("ashes-throne.network.v1")).active);
  assert.equal(active.phase,"brief");
  assert.equal(await page.evaluate(()=>localStorage.getItem("ashes-throne.progress.v3")),saved.wallet,
   "starting the briefing must not credit rewards");
  await page.reload({waitUntil:"load",timeout:60000});
  await page.waitForFunction(()=>typeof showScreen==="function");
  if(await page.locator("#loginCalendar").evaluate(el=>el.classList.contains("active")))
   await page.locator('#loginCalendar [data-screen="home"]').click();
  await page.locator('#home .hq-bottom [data-screen="network"]').click();
  await page.locator("#net004Active").waitFor({state:"visible"});
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("ashes-throne.network.v1")).active.phase),
   "brief","briefing persists on reload");
  assert.equal(await page.evaluate(()=>localStorage.getItem("ashes-throne.progress.v3")),saved.wallet);
  await page.locator('#net004Choices [data-net-action="prepare"]').first().click();
  await page.waitForFunction(()=>document.querySelector('#net004Choices [data-net-action="approach"]')!==null);
  await page.locator('#net004Choices [data-net-action="approach"]').first().click();
  await page.locator("#squad").waitFor({state:"visible"});
  await page.locator("#squadBack").click();
  await page.locator("#net004Active").waitFor({state:"visible"});
  assert.equal(await page.locator('#network .netux-tabs [data-net-view="clues"]').getAttribute("aria-pressed"),"true");
  assert.deepEqual(errors.filter(e=>/TypeError|ReferenceError|NETUX/i.test(e)),[]);
  console.log("NETUX004_BROWSER",name,viewport.width+"x"+viewport.height,"PASS");
 }catch(e){
  console.error("NETUX004_BROWSER_FAIL",name,viewport,errors);
  await page.screenshot({path:path.join(dest,name+"-"+viewport.width+"-fail.png"),fullPage:true}).catch(()=>{});
  throw e;
 }finally{await browser.close()}
}
(async()=>{for(const [name,engine] of [["chromium",chromium],["webkit",webkit]]){
 for(const viewport of [{width:844,height:390},{width:932,height:430}])
  await check(name,engine,viewport);
}})().catch(e=>{console.error(e);process.exitCode=1});