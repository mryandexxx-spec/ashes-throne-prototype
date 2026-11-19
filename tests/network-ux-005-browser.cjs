"use strict";
/* Chromium/WebKit landscape emulation, not physical iPhone Safari. */
const {chromium,webkit}=require("playwright"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
const dest=path.join(process.cwd(),"artifacts","netux005");fs.mkdirSync(dest,{recursive:true});
async function run(name,engine,viewport){
 const browser=await engine.launch(name==="chromium"?{headless:true,
  args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader",
   "--enable-webgl","--disable-dev-shm-usage"]}:{headless:true});
 const page=await browser.newPage({viewport,hasTouch:true});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 const getState=()=>page.evaluate(()=>JSON.parse(localStorage.getItem("ashes-throne.network.v1")));
 const login=async()=>{
  if(await page.locator("#loginCalendar").evaluate(x=>x.classList.contains("active")))
   await page.locator('#loginCalendar [data-screen="home"]').click();
 };
 const open=async()=>{await page.locator("#netuxOrderOpen").click();
  assert.equal(await page.locator("#netuxOrderDialog").evaluate(x=>x.open),true)};
 try{
  await page.goto(origin,{waitUntil:"load",timeout:60000});
  await page.waitForFunction(()=>typeof showScreen==="function",null,{timeout:60000});
  await login();await page.locator('#home .hq-bottom [data-screen="network"]').click();
  await page.locator("#net004Clues .netux-clue-pick").first().waitFor({state:"visible"});
  const original=await getState(),board=JSON.stringify(original.board);
  const wallet=await page.evaluate(()=>localStorage.getItem("ashes-throne.progress.v3"));
  for(const [i,kind] of ["material","hero","type","region"].entries()){
   await open();
   if(i===0)assert.equal(await page.locator("#netuxOrderApply").isDisabled(),true);
   await page.locator('#netuxOrderTabs [data-net-value="'+kind+'"]').click();
   const choice=page.locator("#net005OrderChoices [data-net-action='select-order']").first();
   assert.ok(await choice.isVisible());
   const id=(await choice.getAttribute("data-net-value")).split(":")[1];
   await choice.click();
   assert.equal(await choice.getAttribute("aria-pressed"),"true");
   await page.locator("#netuxOrderApply").click();
   await page.waitForFunction(()=>!document.querySelector("#netuxOrderDialog").open);
   const now=await getState();
   assert.equal(now.order.kind,kind);assert.equal(now.order.targetId,id);
   assert.equal(JSON.stringify(now.board),board,"no reroll");
   assert.equal(await page.evaluate(()=>localStorage.getItem("ashes-throne.progress.v3")),wallet);
  }
  await open();
  const current=JSON.stringify((await getState()).order);
  await page.locator('#netuxOrderTabs [data-net-value="hero"]').click();
  await page.locator("#net005OrderChoices button").first().click();
  await page.keyboard.press("Escape");
  assert.equal(JSON.stringify((await getState()).order),current,"cancel does not persist");
  await open();
  const geometry=await page.evaluate(()=>{
   const q=s=>document.querySelector(s).getBoundingClientRect(),d=q("#netuxOrderDialog");
   return {overflow:document.documentElement.scrollWidth>innerWidth+1,
    left:d.left,right:d.right,top:d.top,bottom:d.bottom,
    confirm:q("#netuxOrderApply").bottom,
    close:q("#netuxOrderDialog .netux-order-close").height,
    open:q("#netuxOrderOpen").height,
    tabs:q("#netuxOrderTabs").height,
    choices:[...document.querySelectorAll("#net005OrderChoices button")].map(x=>x.getBoundingClientRect().height)};
  });
  assert.equal(geometry.overflow,false);
  assert.ok(geometry.left>=-1&&geometry.right<=viewport.width+1);
  assert.ok(geometry.top>=-1&&geometry.bottom<=viewport.height+1);
  assert.ok(geometry.confirm<=geometry.bottom+1);
  assert.ok(geometry.open>=44&&geometry.close>=44&&geometry.tabs>=44);
  assert.ok(geometry.choices.every(h=>h>=44));
  await page.screenshot({path:path.join(dest,name+"-"+viewport.width+"-order.png")});
  await page.locator("#netuxOrderClear").click();
  await page.waitForFunction(()=>!document.querySelector("#netuxOrderDialog").open);
  assert.equal((await getState()).order,null);
  await page.locator('#network [data-net-view="daily"]').click();
  assert.equal(await page.locator("#netuxDailyPanel").isVisible(),true);
  await page.locator('#network [data-net-view="clues"]').click();
  await open();
  await page.locator('#netuxOrderTabs [data-net-value="material"]').click();
  await page.locator("#net005OrderChoices button").first().click();
  await page.locator("#netuxOrderApply").click();
  await page.waitForFunction(()=>!document.querySelector("#netuxOrderDialog").open);
  await page.reload({waitUntil:"load",timeout:60000});
  await page.waitForFunction(()=>typeof showScreen==="function");await login();
  await page.locator('#home .hq-bottom [data-screen="network"]').click();
  await page.locator("#netuxOrderOpen").waitFor({state:"visible"});
  assert.match(await page.locator("#net005OrderStatus").innerText(),/Материал/);
  assert.match(await page.locator("#netuxOrderProgress").innerText(),/0\/3/);
  // Synthetic but valid persisted miss count: the UI must read the live guarantee.
  await page.evaluate(()=>{
   const key="ashes-throne.network.v1",state=JSON.parse(localStorage.getItem(key));
   state.order.misses=2;localStorage.setItem(key,JSON.stringify(state));
  });
  await page.reload({waitUntil:"load",timeout:60000});
  await page.waitForFunction(()=>typeof showScreen==="function");await login();
  await page.locator('#home .hq-bottom [data-screen="network"]').click();
  await page.locator("#netuxOrderOpen").waitFor({state:"visible"});
  assert.match(await page.locator("#netuxOrderProgress").innerText(),/2\/3/);
  assert.match(await page.locator("#netuxOrderProgress").innerText(),/1 нов/);
  assert.equal(JSON.stringify((await getState()).board),board);
  assert.equal(await page.evaluate(()=>localStorage.getItem("ashes-throne.progress.v3")),wallet);
  assert.deepEqual(errors.filter(e=>/TypeError|ReferenceError|NETUX/i.test(e)),[]);
  console.log("NETUX005_BROWSER",name,viewport.width+"x"+viewport.height,"PASS");
 }catch(e){
  console.error("NETUX005_BROWSER_FAIL",name,viewport,errors);
  await page.screenshot({path:path.join(dest,name+"-"+viewport.width+"-fail.png")}).catch(()=>{});
  throw e;
 }finally{await browser.close()}
}
(async()=>{for(const [name,engine] of [["chromium",chromium],["webkit",webkit]])
 for(const size of [{width:844,height:390},{width:932,height:430}])
  await run(name,engine,size)})().catch(e=>{console.error(e);process.exitCode=1});
