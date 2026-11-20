"use strict";
/* NET-005: opt-in command UI, persisted orders, honest Finder round trip. */
const {chromium,webkit}=require("playwright");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const dest=path.join(process.cwd(),"artifacts","net005");
fs.mkdirSync(dest,{recursive:true});
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
async function run(name,engine,viewport){
 const browser=await engine.launch(name==="chromium"?
  {headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader",
   "--enable-webgl","--disable-dev-shm-usage"]}:{headless:true});
 const page=await browser.newPage({viewport,hasTouch:true}),errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 try{
  await page.goto(origin+"?networkPilot=1",{waitUntil:"load",timeout:60000});
  await page.waitForFunction(()=>typeof showScreen==="function");
  assert.match(await page.locator("#buildVersion").innerText(),/v0\.3\.(190 · NET006ASCORE|192 · NET007LIVE|193 · NET008AWEEKLY|194 · ARENAVIS001|195 · NETUXFIX001|196 · NETUXNAV002|197 · NETUXDAILY003|198 · NETUXBOARD004|199 · NETUXORDER005|200 · NETUXFLOW006|201 · NETUXVAR007|202 · NETUXFIT|203 · GEARMAT001|204 · ARENAVIS002|205 · ARENAUI003A|206 · ARENAUI003B|207 · ARENAART004C|208 · ARENAART004D|209 · ARENAART004E|210 · ARENAART004F|211 · ARENAART004G|212 · ARENAENV005|213 · ARENAFIX001|214 · ARENAENV006)/);
  if(await page.locator("#loginCalendar").evaluate(el=>el.classList.contains("active")))
   await page.locator('#loginCalendar [data-screen="home"]').click();
  await page.locator('#home .hq-bottom [data-screen="network"]').click();
  await page.locator("#network").waitFor({state:"visible"});
  const before=await page.evaluate(()=>({
   wallet:localStorage.getItem("ashes-throne.progress.v3"),
   network:localStorage.getItem("ashes-throne.network.v1"),
   squad:localStorage.getItem("ashes-throne.squad.v1"),
   board:JSON.parse(localStorage.getItem("ashes-throne.network.pilot.v1")).board.length
  }));
  assert.equal(before.board,3);
  assert.equal(before.network,null);
  assert.equal(await page.locator("#net004Clues .netux-clue-pick").count(),3);
  assert.equal(await page.locator("#netuxSimulateSelected").isDisabled(),true);
  await page.locator("#netuxOrderOpen").click();
  await page.locator('#netuxOrderTabs [data-net-value="type"]').click();
  const desired=page.locator('[data-net-action="select-order"][data-net-value="type:trophies"]');
  await desired.click();
  await page.locator("#netuxOrderApply").click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem(
   "ashes-throne.network.pilot.v1"))?.order?.targetId==="trophies");
  assert.match(await page.locator("#net005OrderStatus").innerText(),/Трофеи/);
  const orderBefore=await page.evaluate(()=>{
   const s=JSON.parse(localStorage.getItem("ashes-throne.network.pilot.v1"));
   return {rev:s.revision,misses:s.order.misses,board:s.board};
  });
  assert.equal(orderBefore.misses,0);
  await page.locator("#net004Refresh").click();
  await page.waitForTimeout(200);
  const orderAfter=await page.evaluate(()=>{
   const s=JSON.parse(localStorage.getItem("ashes-throne.network.pilot.v1"));
   return {rev:s.revision,misses:s.order.misses,board:s.board};
  });
  assert.equal(orderAfter.misses,0);
  assert.deepEqual(orderAfter.board,orderBefore.board,"full board is not rerolled");
  await page.reload({waitUntil:"load"});
  if(await page.locator("#loginCalendar").evaluate(el=>el.classList.contains("active")))
   await page.locator('#loginCalendar [data-screen="home"]').click();
  await page.locator('#home .hq-bottom [data-screen="network"]').click();
  await page.locator("#network").waitFor({state:"visible"});
  assert.match(await page.locator("#net005OrderStatus").innerText(),/Трофеи/);
  await page.locator("#netuxOrderOpen").click();
  await page.locator('[data-net-action="clear-order"]').click();
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem(
   "ashes-throne.network.pilot.v1"))?.order===null);
  assert.equal(await page.locator("#netuxSimulateSelected").isDisabled(),true);
  // Use the real itemized Gear Finder UI, not direct screen switching.
  assert.equal(await page.evaluate(()=>openHeroDetail("ren",0)),true);
  await page.locator("#heroDetail").waitFor({state:"visible"});
  const find=page.locator("#gearUxRight .gear-ux-find").first();
  await find.waitFor({state:"visible",timeout:10000});
  await find.click();
  assert.match(await page.locator("#gearUxLeft").innerText(),/Где добыть/);
  assert.match(await page.locator("#gearUxRight").innerText(),/Разведсеть пока не подтверждена/);
  const preview=page.locator("#gearUxRight button").filter({hasText:"Посмотреть пробную разведсеть"});
  const previewCount=await preview.count();
  assert.equal(previewCount,1,"Finder pilot preview control exists: "+
   JSON.stringify(await page.evaluate(()=>({
    pilotFlag:typeof NETWORK_PILOT_ENABLED==="undefined"?null:NETWORK_PILOT_ENABLED,
    networkNav:document.querySelector('#home .hq-bottom [data-screen="network"]')?.textContent,
    buttonTexts:[...document.querySelectorAll("#gearUxRight button")]
     .map(x=>({text:x.textContent,hidden:x.hidden,display:getComputedStyle(x).display})),
    visibleGearPanel:getComputedStyle(document.getElementById("gearUxRight")).display
   }))));
  await preview.click();
  await page.locator("#network").waitFor({state:"visible"});
  await page.locator("#net005FinderBack").waitFor({state:"visible"});
  assert.match(await page.locator("#net004Notice").innerText(),/нет подтверждённого источника/);
  await page.locator("#net005FinderBack").click();
  await page.locator("#heroDetail").waitFor({state:"visible"});
  assert.match(await page.locator("#gearUxLeft").innerText(),/Где добыть/,
   "Finder material context is retained on return");
  const final=await page.evaluate(()=>({
   wallet:localStorage.getItem("ashes-throne.progress.v3"),
   network:localStorage.getItem("ashes-throne.network.v1"),
   squad:localStorage.getItem("ashes-throne.squad.v1"),
   overflow:document.documentElement.scrollWidth>innerWidth+1
  }));
  assert.equal(final.wallet,before.wallet);
  assert.equal(final.network,before.network);
  assert.equal(final.squad,before.squad);
  assert.equal(final.overflow,false);
  assert.deepEqual(errors.filter(x=>/TypeError|ReferenceError|NET005|NETWORK_PILOT/i.test(x)),[]);
  console.log("NET005_BROWSER",name,viewport.width+"x"+viewport.height,"PASS");
 }catch(e){
  console.error("NET005_BROWSER_FAIL",name,viewport,errors);
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
