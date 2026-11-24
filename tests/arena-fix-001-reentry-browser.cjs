"use strict";
/* ARENA-FIX-001: shadows stay soft after re-entering battle; enemy formation mirrors allies.
 * Three battles in a row in one page (scene reused), 844x390, Chromium + SwiftShader. */
const {chromium}=require("playwright");
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const out=path.join(process.cwd(),"artifacts","arena-fix-001");fs.mkdirSync(out,{recursive:true});
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
(async()=>{
 const browser=await chromium.launch({...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{}),headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--enable-unsafe-swiftshader","--disable-dev-shm-usage"]});
 const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto(origin+(origin.includes("?")?"&":"?")+"skipFirstPlay=1",{waitUntil:"load",timeout:60000});
 await page.waitForFunction(()=>typeof showScreen==="function",null,{timeout:60000});
 await page.evaluate(()=>{challengeProgress.bestStars["T-01"]=1;challengeProgress.bestStars["N-01"]=1;});
 const enter=async(id,kind,ids=["ren","nada","liora","art","sava"])=>{
  await page.evaluate(()=>showScreen("challenges"));
  await page.locator("#challenges").waitFor({state:"visible"});
  if(await page.locator("#challengeModeBack").isVisible())await page.locator("#challengeModeBack").click();
  await page.locator('[data-challenge-kind="'+kind+'"]').click();
  await page.locator('[data-start-challenge="'+id+'"]').click();
  await page.locator("#squad").waitFor({state:"visible"});
  await page.locator("#squadDisband").evaluate(el=>el.click());
  for(const h of ids)await page.locator('#squadRoster [data-hero-id="'+h+'"]').evaluate(el=>el.click());
  await page.locator("#squadStart").click();
  if(await page.locator("#squad").isVisible())await page.locator("#squadStart").click();
  await page.locator("#battle").waitFor({state:"visible",timeout:35000});
  await page.waitForFunction(()=>[...npcGlbRuntimes.values()].every(r=>r.isReady)&&renGlbRuntime?.isReady,null,{timeout:90000}).catch(()=>{});
  await page.waitForTimeout(1500);
  return page.evaluate(()=>{
   const bySide={ally:[],enemy:[]};for(const f of state.fighters)bySide[f.side].push(f);
   return state.fighters.map(f=>{const b=meshes[f.id]?.base,team=bySide[f.side],slot=team.indexOf(f);
    const want=ArenaStageView.formation(f.side,slot,team.length);
    return {id:f.id,side:f.side,alive:!!b&&scene.materials.includes(b.material),
     shared:!!b?.material?.av001Shared,offset:b?Math.hypot(b.position.x-want.x,b.position.z-want.z):99};});
  });
 };
 assert.deepEqual(await page.evaluate(()=>ALLIES.filter(h=>heroOwned(h.id)).map(h=>h.id).sort()),["art","ren"]);
 const fresh=await enter("T-02","tactical",["ren","art"]);
 assert.deepEqual(fresh.filter(f=>f.side==="ally").map(f=>f.id).sort(),["art","ren"]);
 await page.evaluate(()=>document.querySelector("#battleMenuRetreat").click());
 await page.waitForTimeout(800);
 // Retain the original five-hero formation and three consecutive re-entry checks.
 await page.evaluate(()=>{
  for(const id of ["nada","liora","sava"])if(!StarCore.directGrant(progress,id))throw Error("TEST_GRANT_FAILED");
  if(!persistProgress())throw Error("TEST_FIXTURE_SAVE_FAILED");
 });
 const r1=await enter("T-02","tactical");
 await page.screenshot({path:path.join(out,"battle1-844x390.png")});
 await page.evaluate(()=>document.querySelector("#battleMenuRetreat").click());
 await page.waitForTimeout(800);
 const r2=await enter("N-02","onslaught");
 await page.screenshot({path:path.join(out,"battle2-844x390.png")});
 await page.evaluate(()=>document.querySelector("#battleMenuRetreat").click());
 await page.waitForTimeout(800);
 const r3=await enter("T-02","tactical");
 await page.screenshot({path:path.join(out,"battle3-844x390.png")});
 for(const [n,r] of [["fresh",fresh],["first",r1],["second",r2],["third",r3]]){
  assert.equal(r.length,n==="fresh"?4:7,n+": expected heroes + 2 enemies");
  for(const f of r){
   assert.equal(f.alive,true,n+" battle: "+f.id+" shadow material was disposed (renders as a square)");
   assert.equal(f.shared,true,n+" battle: "+f.id+" uses the shared soft shadow");
   assert.ok(f.offset<.01,n+" battle: "+f.id+" stands in its formation slot");
  }
 }
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(out,"report.json"),JSON.stringify({fresh,r1,r2,r3},null,1));
 console.log("ARENA-FIX-001 re-entry: OK");
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
