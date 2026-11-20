"use strict";
/* PR6 mobile Chromium/WebKit emulation, not a physical iPhone. */
const {chromium,webkit}=require("playwright"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
const dir=path.join(process.cwd(),"artifacts","netux006");fs.mkdirSync(dir,{recursive:true});
async function check(name,engine,viewport){
 const browser=await engine.launch(name==="chromium"?{headless:true,args:
  ["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-dev-shm-usage"]}:{headless:true});
 const page=await browser.newPage({viewport,hasTouch:true});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 const saved=()=>page.evaluate(()=>({
  wallet:localStorage.getItem("ashes-throne.progress.v3"),
  network:JSON.parse(localStorage.getItem("ashes-throne.network.v1")),
  weekly:JSON.parse(localStorage.getItem("ashes-throne.weekly.v1"))
 }));
 const login=async()=>{if(await page.locator("#loginCalendar").evaluate(el=>el.classList.contains("active")))
  await page.locator('#loginCalendar [data-screen="home"]').click()};
 const enter=async()=>{await login();await page.locator('#home .hq-bottom [data-screen="network"]').click()};
 const geometry=async selector=>page.evaluate(selector=>{
  const el=document.querySelector(selector),r=el.getBoundingClientRect();
  const buttons=[...el.querySelectorAll("button:not([hidden])")].filter(b=>!b.hidden&&getComputedStyle(b).display!=="none")
   .map(b=>({h:b.getBoundingClientRect().height,w:b.getBoundingClientRect().width}));
  return {overflow:document.documentElement.scrollWidth>innerWidth+1,
   rect:{top:r.top,bottom:r.bottom,left:r.left,right:r.right},
   buttons};},selector);
 try{
  await page.goto(origin,{waitUntil:"load",timeout:60000});
  await page.waitForFunction(()=>typeof showScreen==="function",null,{timeout:60000});
  await enter();
  await page.locator("#net004Clues .netux-clue-pick").first().waitFor({state:"visible"});
  const wallet=(await saved()).wallet;
  await page.locator("#netuxStartSelected").click();
  await page.locator("#net004Active").waitFor({state:"visible"});
  const s0=await saved();
  assert.equal(s0.network.active.phase,"brief");
  assert.match(await page.locator("#netuxBriefStage").innerText(),/ПОДГОТОВКА/);
  assert.ok((await page.locator("#netuxBriefReward").innerText()).length>10);
  assert.ok(await page.locator("#net004Choices [data-net-action='prepare']").count()>=2);
  let g=await geometry("#net004Active");assert.equal(g.overflow,false);
  assert.ok(g.rect.right<=viewport.width+1);
  assert.ok(g.buttons.every(x=>x.h>=44&&x.w>=44));
  await page.screenshot({path:path.join(dir,name+"-"+viewport.width+"-brief.png")});
  await page.locator("#net004Choices [data-net-action='prepare']").first().click();
  await page.waitForFunction(()=>document.querySelector("#netuxBriefStage").textContent.includes("ПОДХОДА"));
  assert.equal((await saved()).network.active.phase,"approach");
  await page.locator("#net004Choices [data-net-action='approach'][data-net-value='quiet']").click();
  await page.locator("#squad").waitFor({state:"visible"});
  await page.locator("#squadBack").click();
  await page.locator("#net004Active").waitFor({state:"visible"});
  assert.match(await page.locator("#netuxBriefStage").innerText(),/ВЫЛАЗКА/);
  assert.equal((await saved()).network.active.phase,"battle");
  assert.equal((await saved()).wallet,wallet);
  // Inject a valid S1 state strictly into isolated browser storage to inspect result UI.
  // This is NOT a combat win, claim, payout or production game action.
  const injected=await page.evaluate(()=>{
   const key="ashes-throne.network.v1",s=JSON.parse(localStorage.getItem(key));
   const c=s.active.clue,summary={version:1,wave:0,deployed:1,knockedOut:0,
    allyActions:1,paceBudget:5,objectiveEnemyId:"npc-test",objectiveDone:true,score:100};
   const next=NetworkCore.battleOutcome(s,c.id,0,true,100,summary);
   if(!next||!NetworkCore.validState(next))return false;
   localStorage.setItem(key,JSON.stringify(next));return true;
  });
  assert.equal(injected,true);
  await page.reload({waitUntil:"load",timeout:60000});
  await page.waitForFunction(()=>typeof showScreen==="function");
  await enter();await page.locator("#net004Result").waitFor({state:"visible"});
  assert.match(await page.locator("#netuxResultRating").innerText(),/3★ · 100\/100/);
  assert.match(await page.locator("#netuxResultMastery").innerText(),/симуляция/);
  assert.ok((await page.locator("#netuxResultReward").innerText()).length>10);
  assert.equal((await saved()).wallet,wallet);
  const sr=(await saved()).network;
  assert.equal(sr.completed.length,0,"viewing a synthetic report pays nothing");
  g=await geometry("#net004Result");
  assert.equal(g.overflow,false);
  assert.ok(g.buttons.every(x=>x.h>=44&&x.w>=44));
  await page.screenshot({path:path.join(dir,name+"-"+viewport.width+"-result.png")});
  await page.locator('#network [data-net-view="threat"]').click();
  await page.locator("#net008aThreat").waitFor({state:"visible"});
  assert.match(await page.locator("#netuxWeeklyIntel").innerText(),/0\/3/);
  assert.equal(await page.locator("#netuxWeeklyTier1").count(),1);
  assert.match(await page.locator("#netuxWeeklyTier1").innerText(),/5000/);
  assert.equal(await page.locator("#netuxWeeklyTier1").getAttribute("data-status"),"locked");
  assert.equal((await saved()).wallet,wallet);
  const details=page.locator(".netux-weekly-prizes details");
  await details.locator("summary").click();
  const icons=details.locator("[data-material]");
  assert.equal(await icons.count(),21);
  await icons.first().click();
  assert.match(await page.locator("#materialName").innerText(),/Железо/);
  await page.locator("#materialClose").click();
  g=await geometry("#net008aThreat");assert.equal(g.overflow,false);
  assert.ok(g.rect.left>=-1&&g.rect.right<=viewport.width+1);
  assert.ok(g.buttons.every(x=>x.h>=44&&x.w>=44));
  await details.locator("summary").click();
  const action=await page.evaluate(()=>{
   const b=document.getElementById("net008aSurvey").getBoundingClientRect(),
    v=document.querySelector(".netux-weekly-plan").getBoundingClientRect();
   return {top:b.top,bottom:b.bottom,containerTop:v.top,containerBottom:v.bottom};
  });
  assert.ok(action.top>=action.containerTop-1&&action.bottom<=action.containerBottom+1,
   "weekly preparation must be visible without scrolling the plan");
  await page.screenshot({path:path.join(dir,name+"-"+viewport.width+"-weekly.png")});
  await page.locator("#net008aSurvey").click();
  await page.locator("#squad").waitFor({state:"visible"});
  await page.locator("#squadBack").click();
  await page.locator("#net008aThreat").waitFor({state:"visible"});
  assert.equal((await saved()).weekly.active.preparation,"survey");
  assert.equal((await saved()).wallet,wallet);
  await page.locator('#network [data-net-view="clues"]').click();
  assert.equal(await page.locator("#net004Result").isVisible(),true);
  assert.deepEqual(errors.filter(x=>/TypeError|ReferenceError|NETUX/i.test(x)),[]);
  console.log("NETUX006_BROWSER",name,viewport.width+"x"+viewport.height,"PASS");
 }catch(e){
  console.error("NETUX006_BROWSER_FAIL",name,viewport,errors);
  await page.screenshot({path:path.join(dir,name+"-"+viewport.width+"-fail.png")}).catch(()=>{});
  throw e;
 }finally{await browser.close()}
}
(async()=>{for(const [name,engine] of [["chromium",chromium],["webkit",webkit]])
 for(const viewport of [{width:844,height:390},{width:932,height:430}])
  await check(name,engine,viewport)})().catch(e=>{console.error(e);process.exitCode=1});
