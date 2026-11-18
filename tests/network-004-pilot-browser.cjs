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
  assert.match(await page.locator("#buildVersion").innerText(),
   /v0\.3\.(188 · NET004PILOT|189 · NET005PILOT|190 · NET006ASCORE)/);
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
  // Verify the temporary formation truly changes without mutating the player's
  // saved squad; then restore the initial battle-tested team before the smoke.
  // Selecting every 3D story hero at L1 makes this an unrelated balance/perf test.
  const originalIds=await page.evaluate(()=>squadSlots().filter(Boolean));
  const previousSquad=await page.evaluate(()=>
   localStorage.getItem("ashes-throne.squad.v1"));
  assert.equal(originalIds.length,5);
  await page.locator("#squadDisband").evaluate(el=>el.click());
  await page.locator('#squadRoster [data-hero-id="ren"]').evaluate(el=>el.click());
  assert.deepEqual(await page.evaluate(()=>squadSlots().filter(Boolean)),["ren"]);
  assert.equal(await page.evaluate(()=>localStorage.getItem("ashes-throne.squad.v1")),
   previousSquad,"temporary formation must not touch the permanent saved squad");
  await page.locator("#squadDisband").evaluate(el=>el.click());
  for(const id of originalIds)
   await page.locator('#squadRoster [data-hero-id="'+id+'"]').evaluate(el=>el.click());
  assert.deepEqual(await page.evaluate(()=>squadSlots().filter(Boolean)),originalIds);
  assert.equal(await page.evaluate(()=>localStorage.getItem("ashes-throne.squad.v1")),
   previousSquad,"return to original formation also must not save");
  await page.locator("#squadStart").click();
  await page.locator("#battle").waitFor({state:"visible",timeout:30000});
  await page.locator("#autoBattleBtn").click();
  await page.locator("#net004Result").waitFor({state:"visible",timeout:125000});
  assert.match(await page.locator("#net004ResultDetail").innerText(),/Оценка S1: (?:[6-9][0-9]|100)/);
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
  assert.match(await page.locator("#net004ResultDetail").innerText(),/Оценка S1: (?:[6-9][0-9]|100)\\/100/);
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
  // One real two-encounter UI smoke. Only Chromium 844 runs this extra journey:
  // the four-engine baseline above remains fast; the core is covered by Node.
  if(name==="chromium"&&viewport.width===844){
   await page.locator('#net004Clues [data-net-action="start"]').first().click();
   await page.locator('[data-net-action="prepare"][data-net-value="cover"]').click();
   await page.locator('[data-net-action="approach"][data-net-value="cordon"]').click();
   await page.locator("#squad").waitFor({state:"visible",timeout:10000});
   await page.locator("#squadStart").click();
   await page.locator("#battle").waitFor({state:"visible",timeout:30000});
   const firstRoster=await page.evaluate(()=>state.fighters.filter(f=>f.side==="ally")
    .map(f=>({id:f.id,hp:f.hp,maxHp:f.maxHp,protection:f.protection??0})));
   assert.ok(firstRoster.length>0);
   assert.ok(firstRoster.every(f=>f.hp===f.maxHp));
   await page.locator("#autoBattleBtn").click();
   await page.locator("#net004Fight").waitFor({state:"visible",timeout:125000});
   await page.locator("#network").waitFor({state:"visible"});
   const halfway=await page.evaluate(()=>{
    const s=JSON.parse(localStorage.getItem("ashes-throne.network.pilot.v1"));
    return {phase:s.active?.phase,wave:s.active?.wave,completed:s.completed.length,
     revision:s.revision,wallet:localStorage.getItem("ashes-throne.progress.v3")};
   });
   assert.equal(halfway.phase,"battle");
   assert.equal(halfway.wave,1,"first encounter checkpoint must be wave two");
   assert.equal(halfway.completed,1,"first encounter grants no completion");
   assert.equal(halfway.wallet,begin.wallet,"no payouts between encounters");
   // Reload at the checkpoint: encounter two is launched from a fresh squad.
   await page.reload({waitUntil:"load"});
   if(await page.locator("#loginCalendar").evaluate(el=>el.classList.contains("active")))
    await page.locator('#loginCalendar [data-screen="home"]').click();
   await page.locator("#hqMoreToggle").click();
   await page.locator("#net004Entry").click();
   await page.locator("#net004Fight").click();
   await page.locator("#squad").waitFor({state:"visible"});
   await page.locator("#squadStart").click();
   await page.locator("#battle").waitFor({state:"visible",timeout:30000});
   const secondRoster=await page.evaluate(()=>state.fighters.filter(f=>f.side==="ally")
    .map(f=>({id:f.id,hp:f.hp,maxHp:f.maxHp,protection:f.protection??0,
     specialCooldown:f.specialCooldown,effects:Object.keys(f.effects)})));
   assert.deepEqual(secondRoster.map(f=>f.id),firstRoster.map(f=>f.id));
   assert.ok(secondRoster.every(f=>f.hp===f.maxHp&&f.specialCooldown===0&&
    f.effects.length===0),"second encounter starts fully restored, no old effects");
   assert.deepEqual(secondRoster.map(f=>f.protection),firstRoster.map(f=>f.protection));
   assert.equal(await page.evaluate(()=>state.totalWaves),1,
    "second encounter is a separate CombatCore battle");
   await page.locator("#autoBattleBtn").click();
   await page.locator("#net004Result").waitFor({state:"visible",timeout:125000});
   await page.locator("#net004Finish").click();
   await page.waitForFunction(()=>!document.querySelector("#net004Board").hidden);
   const done=await page.evaluate(()=>{
    const s=JSON.parse(localStorage.getItem("ashes-throne.network.pilot.v1"));
    return {completed:s.completed.length,active:s.active,
     wallet:localStorage.getItem("ashes-throne.progress.v3"),
     liveNetwork:localStorage.getItem("ashes-throne.network.v1"),
     overflow:document.documentElement.scrollWidth>innerWidth+1};
   });
   assert.equal(done.completed,2);
   assert.equal(done.active,null);
   assert.equal(done.wallet,begin.wallet);
   assert.equal(done.liveNetwork,null);
   assert.equal(done.overflow,false);
   assert.deepEqual(errors.filter(x=>/TypeError|ReferenceError|Net004|NETWORK_PILOT/i.test(x)),[]);
   console.log("NET004_TWO_SEPARATE_ENCOUNTERS",name,viewport.width+"x"+viewport.height,
    "PASS",JSON.stringify({halfway,done}));
  }
  console.log("NET004_BROWSER",name,viewport.width+"x"+viewport.height,"PASS",JSON.stringify({
   checkpoint,resultSaved:{phase:resultSaved.phase,rev:resultSaved.rev},final}));
 }catch(e){
  const diagnostic=await page.evaluate(()=>({
   screen:document.querySelector(".screen.active")?.id,
   battleActive:typeof state==="undefined"?null:state.active,
   battleWinner:typeof state==="undefined"?null:state.winner,
   battleMessage:typeof state==="undefined"?null:state.message,
   savedPhase:(()=>{try{return JSON.parse(localStorage.getItem(
    "ashes-throne.network.pilot.v1"))?.active?.phase;}catch(_){return "invalid";}})(),
   networkNotice:document.querySelector("#net004Notice")?.textContent,
   squad:typeof squadSlots==="function"?squadSlots():null,
   finished:typeof networkResultRecorded==="undefined"?null:networkResultRecorded
  })).catch(()=>null);
  console.error("NET004_BROWSER_FAIL",name,viewport,{errors,diagnostic});
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
