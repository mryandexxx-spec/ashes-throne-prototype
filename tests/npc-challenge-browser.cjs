"use strict";
/* NPCCHALLENGE004: real T-01 priority and N-01 two waves in Babylon.js,
 * Chromium/WebKit in iPhone-like landscape, with no save or daily-task writes.
 */
const assert=require("node:assert/strict");
const {chromium,webkit}=require("playwright");
const fs=require("node:fs"),path=require("node:path");
const out=path.join(process.cwd(),"artifacts","npc-challenge-browser");
fs.mkdirSync(out,{recursive:true});
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
async function start(page,id){
 await page.locator('[data-start-challenge="'+id+'"]').click();
 await page.locator("#squad").waitFor({state:"visible",timeout:12000});
 await page.locator("#squadDisband").evaluate(el=>el.click());
 for(const heroId of ["ren","nada","liora","art","sava"])
  await page.locator('#squadRoster [data-hero-id="'+heroId+'"]').evaluate(el=>el.click());
 assert.equal(await page.locator("#squadCount").innerText(),"5/5");
 await page.locator("#squadStart").click();
 if(await page.locator("#squad").isVisible())await page.locator("#squadStart").click();
 await page.locator("#battle").waitFor({state:"visible",timeout:32000});
}
async function contextSnapshot(page){
 return page.evaluate(()=>({
  wallet:JSON.stringify(progress),
  challenges:JSON.stringify(challengeProgress),
  challengeSave:localStorage.getItem(ChallengeCore.KEY),
  progressSave:localStorage.getItem("ashes-throne.progress.v3")
 }));
}
function assertNpcSaved(before,after,id,earned){
 const previous=before.challengeSave?JSON.parse(before.challengeSave).bestStars[id]||0:0;
 const storage=after.challengeSave?JSON.parse(after.challengeSave):null;
 const inMemory=JSON.parse(after.challenges||after.challengeProgress).bestStars[id];
 if(!storage){
  assert.equal(Math.max(previous,earned),0,"only zero-star results need no saved record");
  assert.equal(after.challengeSave,before.challengeSave,"failed battle cannot write progress");
  assert.equal(inMemory,0);
 }else{
  assert.equal(storage.version,1);
  assert.equal(storage.bestStars[id],Math.max(previous,earned));
  assert.equal(inMemory,storage.bestStars[id]);
 }
 const walletBefore=JSON.parse(before.wallet||before.progress);
 const walletAfter=JSON.parse(after.wallet||after.progress);
 for(const key of ["currency","xp","energy"]){
  if(walletBefore[key]!==undefined)assert.deepEqual(walletAfter[key],walletBefore[key],
   "challenge must not grant currency, XP or spend energy");
 }
}
async function check(name,type){
 const browser=await type.launch(name==="chromium"?
  {headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-dev-shm-usage"]}:
  {headless:true});
 const page=await browser.newPage({viewport:{width:932,height:430},hasTouch:true});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 try{
  const url=new URL(origin);
  await page.goto(url.toString(),{waitUntil:"load",timeout:60000});
  assert.equal(await page.locator("#buildVersion").innerText(),
   "Прототип · v"+require("../package.json").version+" · SAVA3D002");
  // In short landscape both the painted hotspot and More button can be
  // visually hidden or animated. Invoke the actual delegated UI click handler
  // on the existing More menu item, as other browser regression tests do.
  await page.locator('#hqMoreMenu [data-screen="challenges"]').evaluate(el=>el.click());
  await page.locator("#challenges").waitFor({state:"visible",timeout:15000});
  assert.match(await page.locator("#challengeSaveStatus").innerText(),/Лучшая оценка сохраняется/);
  await page.locator('[data-challenge-kind="tactical"]').click();
  const tCard=page.locator('[data-start-challenge="T-01"]').locator("xpath=ancestor::article");
  assert.doesNotMatch(await tCard.innerText(),/NPC-ПРОБА/);
  assert.match(await tCard.innerText(),/Сигнальщик обхода/);
  const before=await contextSnapshot(page);
  await start(page,"T-01");
  const first=await page.evaluate(()=>({
   pilot:battleIsNpcChallengePilot,mode:battleIsChallenge,challengeId:activeChallengeId,
   objective:document.querySelector("#battleChallengeGoal").textContent,
   ids:state.fighters.filter(x=>x.side==="enemy").map(x=>x.id),
   meshes:state.fighters.filter(x=>x.side==="enemy").map(x=>({
    id:x.id,active:!!meshes[x.id]?.body.isEnabled(),
    marker:meshes[x.id]?.body.metadata?.fighterId
   })),
   tracker:challengeTracker.priorityId,scene:!!engine&&!!scene,
   overflow:document.documentElement.scrollWidth>innerWidth+1
  }));
  assert.equal(first.pilot,true);
  assert.equal(first.mode,true);
  assert.equal(first.challengeId,"T-01");
  assert.equal(first.scene,true);
  assert.deepEqual(first.ids,["npc-t01-signaller","npc-t01-interceptor"]);
  assert.equal(first.tracker,"npc-t01-signaller");
  assert.match(first.objective,/Сигнальщик обхода/);
  assert.ok(first.meshes.every(x=>x.active&&x.id===x.marker));
  assert.equal(first.overflow,false);
  await page.screenshot({path:path.join(out,name+"-t01-arena.png"),fullPage:true});
  await page.locator("#autoSpeedBtn").click();
  await page.locator("#autoSpeedBtn").click();
  await page.locator("#autoBattleBtn").click();
  await page.locator("#challengeResult").waitFor({state:"visible",timeout:150000});
  const tResult=await page.evaluate(()=>({
   winner:state.winner,stars:challengeLastStars,
   firstKill:challengeTracker.killGroups.find(x=>x.length)?.[0]||null,
   text:document.querySelector("#challengeResultText").textContent,
   label:document.querySelector("#challengeResultStars").textContent
  }));
  assert.equal(tResult.winner,"ally");
  assert.ok([1,3].includes(tResult.stars));
  assert.equal(tResult.stars,tResult.firstKill==="npc-t01-signaller"?3:1,
   "original first-kill scoring must use real NPC ID");
  assert.match(tResult.label,/Лучший результат/);
  assert.match(tResult.text,/Победа|побед|испытан/i);
  assertNpcSaved(before,await contextSnapshot(page),"T-01",tResult.stars);
  await page.locator("#challengeResultBack").click();
  await page.locator("#challenges").waitFor({state:"visible",timeout:10000});
  await page.locator("#challengeModeBack").click();
  await page.locator('[data-challenge-kind="onslaught"]').click();
  const nCard=page.locator('[data-start-challenge="N-01"]').locator("xpath=ancestor::article");
  assert.doesNotMatch(await nCard.innerText(),/NPC-ПРОБА/);
  assert.match(await nCard.innerText(),/2 волны/);
  assert.match(await nCard.innerText(),/лимит действий пока не установлен/);
  const beforeN=await contextSnapshot(page);
  await start(page,"N-01");
  const nFirst=await page.evaluate(()=>({
   pilot:battleIsNpcChallengePilot,wave:state.wave,total:state.totalWaves,
   ids:state.fighters.filter(x=>x.side==="enemy").map(x=>x.id),
   visible:state.fighters.filter(x=>x.side==="enemy").every(x=>!!meshes[x.id]?.body.isEnabled()),
   limit:ChallengeCore.get("N-01").thirdStarActionLimit,
   overflow:document.documentElement.scrollWidth>innerWidth+1
  }));
  assert.equal(nFirst.pilot,true);
  assert.equal(nFirst.wave,1);
  assert.equal(nFirst.total,2);
  assert.deepEqual(nFirst.ids,["npc-n01-guard","npc-n01-medic"]);
  assert.equal(nFirst.visible,true);
  assert.equal(nFirst.limit,null);
  assert.equal(nFirst.overflow,false);
  await page.screenshot({path:path.join(out,name+"-n01-wave1.png"),fullPage:true});
  await page.locator("#autoSpeedBtn").click();
  await page.locator("#autoSpeedBtn").click();
  await page.locator("#autoBattleBtn").click();
  await page.waitForFunction(()=>state?.wave===2&&
   state.fighters.some(x=>x.id==="npc-n01-slinger")&&
   !!meshes["npc-n01-slinger"]?.body.isEnabled(),null,{timeout:115000});
  await page.screenshot({path:path.join(out,name+"-n01-wave2.png"),fullPage:true});
  await page.locator("#challengeResult").waitFor({state:"visible",timeout:150000});
  const nResult=await page.evaluate(()=>({
   winner:state.winner,wave:state.wave,stars:challengeLastStars,
   label:document.querySelector("#challengeResultStars").textContent,
   text:document.querySelector("#challengeResultText").textContent
  }));
  assert.equal(nResult.winner,"ally");
  assert.equal(nResult.wave,2);
  assert.equal(nResult.stars,2,"N-01 has no third-star action limit");
  assert.match(nResult.label,/Лучший результат/);
  assert.match(nResult.text,/Победа|испытан/i);
  assertNpcSaved(beforeN,await contextSnapshot(page),"N-01",nResult.stars);
  await page.locator("#challengeResultRetry").click();
  await page.locator("#squad").waitFor({state:"visible",timeout:15000});
  await page.locator("#squadBack").click();
  const returned=await page.evaluate(()=>({
   visible:document.querySelector("#challenges").classList.contains("active"),
   gpu:!!renderLoopRunning,
   overflow:document.documentElement.scrollWidth>innerWidth+1
  }));
  assert.equal(returned.visible,true);
  assert.equal(returned.gpu,false);
  assert.equal(returned.overflow,false);
  assert.deepEqual(errors.filter(x=>/TypeError|ReferenceError|CombatCore|NpcChallengePilot/.test(x)),[]);
  console.log("NPCCHALLENGE004_BROWSERSMOKE",name,"PASS",JSON.stringify({first,tResult,nFirst,nResult,returned}));
 }catch(error){
  await page.screenshot({path:path.join(out,name+"-failed.png"),fullPage:true}).catch(()=>{});
  console.error("NPCCHALLENGE004_BROWSERSMOKE_FAIL",name,errors);
  throw error;
 }finally{await browser.close();}
}
(async()=>{
 for(const [name,type] of [["chromium",chromium],["webkit",webkit]])await check(name,type);
})().catch(e=>{console.error(e);process.exitCode=1;});
