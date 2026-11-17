"use strict";
/* Chromium/WebKit: REAL two-page Web Locks arbitration on the game origin. */
const assert=require("node:assert/strict");
const {chromium,webkit}=require("playwright");
const engine=process.env.WALLET_BROWSER==="webkit"?webkit:chromium;
const url="http://127.0.0.1:8765/";
(async()=>{
 const browser=await engine.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:844,height:390}});
  const first=await context.newPage();
  await first.goto(url,{waitUntil:"domcontentloaded"});
  await first.waitForFunction(()=>document.getElementById("walletWriterNotice")?.style.display==="none",
   null,{timeout:60000});
  const initial=await first.evaluate(()=>{
   const stored=JSON.parse(localStorage.getItem("ashes-throne.progress.v3"));
   if(!stored)throw Error("wallet not staged");
   const prior=stored.currency;
   progress.currency+=1;
   if(!SaveCore.save(progress,()=>localStorage))throw Error("first-tab save refused");
   return {prior,current:JSON.parse(localStorage.getItem("ashes-throne.progress.v3")).currency};
  });
  assert.equal(initial.current,initial.prior+1);
  const second=await context.newPage();
  await second.goto(url,{waitUntil:"domcontentloaded"});
  await second.waitForFunction(()=>document.getElementById("walletWriterMessage")?.textContent.includes("другой вкладке"),
   null,{timeout:15000});
  const busy=await second.evaluate(()=>({
   overlay:document.getElementById("walletWriterNotice").style.display,
   gameLoaded:typeof progress!=="undefined",
   hasLock:ProgressWriterCore.isOwner(),
   currency:JSON.parse(localStorage.getItem("ashes-throne.progress.v3")).currency
  }));
  assert.equal(busy.overlay,"flex");
  assert.equal(busy.gameLoaded,false);
  assert.equal(busy.hasLock,false);
  assert.equal(busy.currency,initial.current);
  await first.close();
  await second.click("#walletWriterRetry");
  await second.waitForFunction(()=>document.getElementById("walletWriterNotice").style.display==="none",
   null,{timeout:60000});
  const recovered=await second.evaluate(()=>{
   const before=progress.currency;
   progress.currency+=1;
   const persisted=SaveCore.save(progress,()=>localStorage);
   return {before,persisted,after:JSON.parse(localStorage.getItem("ashes-throne.progress.v3")).currency};
  });
  assert.equal(recovered.before,initial.current,"second page must restore latest wallet");
  assert.equal(recovered.persisted,true);
  assert.equal(recovered.after,initial.current+1);
  await second.close();
  await context.close();

  // Missing browser API must block game bootstrap with no new v3 record.
  const other=await browser.newContext();
  await other.addInitScript(()=>Object.defineProperty(navigator,"locks",{configurable:true,value:undefined}));
  const noApi=await other.newPage();
  await noApi.goto(url,{waitUntil:"domcontentloaded"});
  await noApi.waitForFunction(()=>document.getElementById("walletWriterMessage")?.textContent.includes("Web Locks"),
   null,{timeout:10000});
  assert.equal(await noApi.evaluate(()=>localStorage.getItem("ashes-throne.progress.v3")),null);
  assert.equal(await noApi.evaluate(()=>typeof progress),"undefined");
  await other.close();
  console.log(engine.name()+" LC-008B two-tab writer, retry and missing Web Locks: passed");
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
