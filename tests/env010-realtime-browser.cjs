"use strict";
/* ENV010: same production controls + existing strict fixture, but real wall-clock
 * Playwright in Chromium AND WebKit. No --virtual-time-budget, mocked timers,
 * CombatCore mutations, or production animation overrides. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium,webkit}=require("playwright");
const out=path.join(process.cwd(),"artifacts","env010-realtime");
fs.mkdirSync(out,{recursive:true});
const url=new URL("tests/fixtures/env010-interactive-smoke.html",
 process.env.GAME_ORIGIN||"http://127.0.0.1:8765/").href;

async function run(name,type){
 const options=name==="chromium"?
  {headless:true,args:["--no-sandbox","--use-angle=swiftshader","--enable-webgl","--enable-unsafe-swiftshader","--disable-dev-shm-usage"]}:
  {headless:true};
 const browser=await type.launch(options);
 const errors=[],consoleErrors=[];
 let page,report;
 try{
  const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true});
  page=await context.newPage();
  page.on("pageerror",e=>errors.push(e.message));
  page.on("console",m=>{if(m.type()==="error")consoleErrors.push(m.text());});
  const start=Date.now();
  await page.goto(url,{waitUntil:"domcontentloaded",timeout:60000});
  // Real clock and requestAnimationFrame, unlike --virtual-time-budget.
  // The fixture itself advances only through actual DOM/UI events.
  await page.waitForFunction(()=>["ready","error"].includes(document.documentElement.dataset.visualStatus),
   null,{timeout:115000,polling:200});
  report=await page.evaluate(()=>{
   const d=document.documentElement.dataset;
   const w=document.querySelector("#game")?.contentWindow;
   const read=expr=>{try{return w.eval(expr);}catch(e){return "unavailable: "+e.message;}};
   return {
    status:d.visualStatus,error:d.visualError||null,
    pinch:d.pinchTest||null,speed:d.speedTest||null,
    auto:d.autoTest||null,replay:d.replayTest||null,
    result:d.coreBattleResult||null,
    battle:{
     active:read("state.active"),winner:read("state.winner"),
     turn:read("state.turn"),pending:read("BattleAnimation.pending()"),
     renderLoop:read("renderLoopRunning"),
     frames:read("scene?.getFrameId()"),
     autoTimer:read("autoTimer!==null")
    }
   };
  });
  report.elapsedMs=Date.now()-start;
  report.pageErrors=errors;
  report.consoleErrors=consoleErrors.slice(-8);
  fs.writeFileSync(path.join(out,name+".json"),JSON.stringify(report,null,2));
  assert.equal(report.status,"ready",name+" real-time ENV010 failed: "+JSON.stringify(report));
  assert.equal(report.pinch,"pass");
  assert.equal(report.speed,"4x");
  assert.equal(report.auto,"battle-finished");
  assert.equal(report.replay,"pass");
  assert.ok(report.battle.frames>0,"WebGL scene never rendered frames");
  assert.deepEqual(errors.filter(e=>/TypeError|ReferenceError|CombatCore|BattleAnimation/.test(e)),[]);
  console.log("ENV010_REALTIME_PASS "+name+" "+JSON.stringify(report));
 }catch(error){
  if(page){
   await page.screenshot({path:path.join(out,name+"-failure.png")}).catch(()=>{});
   if(!report){
    report=await page.evaluate(()=>({status:document.documentElement.dataset.visualStatus||"pending",
      error:document.documentElement.dataset.visualError||null})).catch(()=>({status:"unavailable"}));
   }
  }
  console.error("ENV010_REALTIME_FAIL "+name+" "+JSON.stringify({report,errors,consoleErrors:consoleErrors.slice(-8)}));
  throw error;
 }finally{
  await browser.close();
 }
}
(async()=>{
 await run("chromium",chromium);
 await run("webkit",webkit);
})().catch(e=>{console.error(e);process.exitCode=1;});
