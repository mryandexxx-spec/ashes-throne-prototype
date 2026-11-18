"use strict";
/* NET-004: opt-in pilot UI, real Babylon battle and isolated save in two engines. */
const {chromium,webkit}=require("playwright");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const dest=path.join(process.cwd(),"artifacts","net004-pilot");
fs.mkdirSync(dest,{recursive:true});
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
async function run(name,engine,viewport){
 const browser=await engine.launch(name==="chromium"?
  {headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader",
    "--enable-webgl","--disable-dev-shm-usage"]}:{headless:true});
 const context=await browser.newContext({viewport,hasTouch:true});
 const page=await context.newPage(),errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 try{
  await page.goto(origin+"?networkPilot=1",{waitUntil:"load",timeout:60000});
  await page.waitForFunction(()=>typeof showScreen==="function",null,{timeout:60000});
  assert.match(await page.locator("#buildVersion").innerText(),/v0\.3\.188 · NET004PILOT/);
  assert.equal(await page.locator("#net004Entry").getAttribute("hidden"),null);
  if(await page.locator("#loginCalendar").evaluate(el=>el.classList.contains("active")))
   await page.locator('#loginCalendar [data-screen="home"]').click();
  await page.locator("#hqMoreToggle").click();
  await page.locator("#net004Entry").click();
  await page.locator("#network").waitFor({state:"visible"});
  const begin=await page.evaluate(()=>({
   wallet:localStorage.getItem("ashes-throne.progress.v3"),
   liveNetwork:localStorage.getItem("ashes-throne.network.v1"),
   pilot:localStorage.getItem("ashes-throne.network.pilot.v1"),
   overflow:document.documentElement.scrollWidth>innerWidth+1
  }));
  assert.equal(begin.liveNetwork,null);
  assert.ok(begin.pilot&&JSON.parse(begin.pilot).board.length===3);
  assert.equal(begin.overflow,false);
  await page.screenshot({path:path.join(dest,name+"-"+viewport.width+"-board.png")});
  await page.locator('#net004Clues [data-net-action="start"]').first().click();
  await page.locator('[data-net-action="prepare"][data-net-value="survey"]').click();
  await page.locator('[data-net-action="approach"][data-net-value="quiet"]').click();
  await page.locator("#squad").waitFor({state:"visible",timeout:10000});
  const checkpoint=await page.evaluate(()=>{
   const s=JSON.parse(localStorage.getItem("ashes-throne.network.pilot.v1"));
   return {phase:s.active?.phase,wave:s.active?.wave,
    rev:s.revision,other:localStorage.getItem("ashes-throne.network.v1")};
  });
  assert.equal(checkpoint.phase,"battle");
  assert.equal(checkpoint.wave,0);
  assert.equal(checkpoint.other,null);
  const previousSquad=await page.evaluate(()=>
   localStorage.getItem("ashes-throne.squad.v1"));
  await page.locator("#squadDisband").evaluate(el=>el.click());
  for(const id of ["ren","nada","liora","art","sava"])
   await page.locator('#squadRoster [data-hero-id="'+id+'"]').evaluate(el=>el.click());
  assert.equal(await page.evaluate(()=>localStorage.getItem("ashes-throne.squad.v1")),
   previousSquad,"temporary network squad does not rewrite permanent formation");
  await page.locator("#squadStart").click();
  await page.locator("#battle").waitFor({state:"visible",timeout:30000});
  await page.locator("#autoBattleBtn").click();
  await page.locator("#net004Result").waitFor({state:"visible",timeout:125000});
  assert.match(await page.locator("#net004ResultDetail").innerText(),/Пробная оценка: 0/);
  const resultSaved=await page.evaluate(()=>{
   const s=JSON.parse(localStorage.getItem("ashes-throne.network.pilot.v1"));
   return {phase:s.active?.phase,rev:s.revision,
    overflow:document.documentElement.scrollWidth>innerWidth+1,
    wallet:localStorage.getItem("ashes-throne.progress.v3")};
  });
  assert.equal(resultSaved.phase,"result");
  assert.ok(resultSaved.rev>checkpoint.rev);
  assert.equal(resultSaved.wallet,begin.wallet);
  assert.equal(resultSaved.overflow,false);
  await page.screenshot({path:path.join(dest,name+"-"+viewport.width+"-result.png")});
  await page.reload({waitUntil:"load"});
  if(await page.locator("#loginCalendar").evaluate(el=>el.classList.contains("active")))
   await page.locator('#loginCalendar [data-screen="home"]').click();
  await page.locator("#hqMoreToggle").click();
  await page.locator("#net004Entry").click();
  await page.locator("#net004Result").waitFor({state:"visible"});
  assert.match(await page.locator("#net004ResultDetail").innerText(),/Пробная оценка: 0/);
  await page.locator("#net004Finish").click();
  await page.waitForFunction(()=>!document.querySelector("#net004Board").hidden,null,{timeout:10000});
  const final=await page.evaluate(()=>{
   const s=JSON.parse(localStorage.getItem("ashes-throne.network.pilot.v1"));
   return {count:s.completed.length,active:s.active,
    liveNetwork:localStorage.getItem("ashes-throne.network.v1"),
    wallet:localStorage.getItem("ashes-throne.progress.v3"),
    overflow:document.documentElement.scrollWidth>innerWidth+1};
  });
  assert.equal(final.count,1);
  assert.equal(final.active,null);
  assert.equal(final.liveNetwork,null);
  assert.equal(final.wallet,begin.wallet);
  assert.equal(final.overflow,false);
  assert.deepEqual(errors.filter(x=>/TypeError|ReferenceError|Net004|NETWORK_PILOT/i.test(x)),[]);
  console.log("NET004_BROWSER",name,viewport.width+"x"+viewport.height,"PASS",JSON.stringify({
   checkpoint,resultSaved:{phase:resultSaved.phase,rev:resultSaved.rev},final}));
 }catch(e){
  console.error("NET004_BROWSER_FAIL",name,viewport,errors);
  await page.screenshot({path:path.join(dest,name+"-"+viewport.width+"-failed.png"),fullPage:true}).catch(()=>{});
  throw e;
 }finally{await browser.close();}
}
async function disabledByDefault(){
 const browser=await chromium.launch({headless:true,args:["--no-sandbox"]});
 const page=await browser.newPage({viewport:{width:844,height:390}});
 try{
  await page.goto(origin,{waitUntil:"load",timeout:60000});
  await page.waitForFunction(()=>typeof showScreen==="function");
  assert.ok(await page.locator("#net004Entry").getAttribute("hidden")!==null);
  assert.equal(await page.evaluate(()=>localStorage.getItem("ashes-throne.network.pilot.v1")),null);
  console.log("NET004_DEFAULT_OFF PASS");
 }finally{await browser.close();}
}
(async()=>{
 await disabledByDefault();
 for(const [name,engine] of [["chromium",chromium],["webkit",webkit]])
  for(const viewport of [{width:844,height:390},{width:932,height:430}])
   await run(name,engine,viewport);
})().catch(e=>{console.error(e);process.exitCode=1});
