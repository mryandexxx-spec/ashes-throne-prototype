"use strict";
/* NPCROLLOUT001: real WebGL Chromium/WebKit, touch 932x430, T-04 hold and N-04 no active healing. */
const assert=require("node:assert/strict");
const {chromium,webkit}=require("playwright");
const fs=require("node:fs"),path=require("node:path");
const artifacts=path.join(process.cwd(),"artifacts","npc-challenge-007");
fs.mkdirSync(artifacts,{recursive:true});
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
const party=["sava","ren","nada","liora","art"];
const snapshot=page=>page.evaluate(()=>({
 progress:JSON.stringify(progress),
 challengeProgress:JSON.stringify(challengeProgress),
 challengeSave:localStorage.getItem(ChallengeCore.KEY),
 walletSave:localStorage.getItem("ashes-throne.progress.v3"),
 daily:JSON.stringify(progress.daily)
}));
async function enter(page,id){
 await page.locator('[data-start-challenge="'+id+'"]').click();
 await page.locator("#squad").waitFor({state:"visible",timeout:15000});
 await page.locator("#squadDisband").evaluate(el=>el.click());
 for(const hero of party)
  await page.locator('#squadRoster [data-hero-id="'+hero+'"]').evaluate(el=>el.click());
 assert.equal(await page.locator("#squadCount").innerText(),"5/5");
 if(id==="T-04"){
  assert.match(await page.locator("#squadTacticalBrief").innerText(),/Сава/);
  assert.match(await page.locator("#squadTacticalBrief").innerText(),/8 действий/);
 }
 await page.locator("#squadStart").click();
 if(await page.locator("#squad").isVisible())await page.locator("#squadStart").click();
 await page.locator("#battle").waitFor({state:"visible",timeout:30000});
}
function assertNpcSaved(before,after,id,earned){
 const previous=before.challengeSave?JSON.parse(before.challengeSave).bestStars[id]||0:0;
 const storage=JSON.parse(after.challengeSave);
 assert.equal(storage.version,1);
 assert.equal(storage.bestStars[id],Math.max(previous,earned));
 assert.equal(JSON.parse(after.challenges||after.challengeProgress).bestStars[id],storage.bestStars[id]);
 const walletBefore=JSON.parse(before.wallet||before.progress);
 const walletAfter=JSON.parse(after.wallet||after.progress);
 for(const key of ["currency","xp","energy"]){
  if(walletBefore[key]!==undefined)assert.deepEqual(walletAfter[key],walletBefore[key],
   "challenge must not grant currency, XP or spend energy");
 }
}
async function smoke(name,kind){
 const browser=await kind.launch(name==="chromium"?
  {headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader",
   "--enable-webgl","--disable-dev-shm-usage"]}:{headless:true});
 const page=await browser.newPage({viewport:{width:932,height:430},hasTouch:true});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 try{
  const url=new URL(origin);
  await page.goto(url.toString(),{waitUntil:"load",timeout:60000});
  assert.equal(await page.locator("#buildVersion").innerText(),
   "Прототип · v0.3.171 · NPCROLLOUT001");
  // Earlier completed stages are a memory-only prerequisite. Do not write saves.
  await page.evaluate(()=>{
   for(const id of ["T-01","T-02","T-03","N-01","N-02","N-03"])
    challengeProgress.bestStars[id]=1;
  });
  await page.locator('#hqMoreMenu [data-screen="challenges"]').evaluate(el=>el.click());
  await page.locator("#challenges").waitFor({state:"visible",timeout:12000});
  assert.match(await page.locator("#challengeSaveStatus").innerText(),/Лучшая оценка сохраняется/);
  await page.locator('[data-challenge-kind="tactical"]').click();
  const tCard=page.locator('[data-start-challenge="T-04"]').locator("xpath=ancestor::article");
  assert.match(await tCard.innerText(),/Прикрыть отход/);
  assert.match(await tCard.innerText(),/8 союзных действий/);
  assert.equal(await page.locator('[data-start-challenge="T-04"]').isEnabled(),true);
  const beforeT=await snapshot(page);
  await enter(page,"T-04");
  const tFirst=await page.evaluate(()=>({
   id:activeChallengeId,pilot:battleIsNpcChallengePilot,goal:state.tacticalObjective,
   label:document.querySelector("#battleMissionLabel").textContent,
   objective:document.querySelector("#battleChallengeGoal").textContent,
   counter:document.querySelector("#tacticalGoalCounter").textContent,
   cardVisible:!document.querySelector("#tacticalGoalCard").hidden,
   enemies:state.fighters.filter(f=>f.side==="enemy").map(f=>f.id),
   meshes:state.fighters.filter(f=>f.side==="enemy").map(f=>
    !!meshes[f.id]?.body.isEnabled()&&meshes[f.id]?.body.metadata?.fighterId===f.id),
   webgl:!!scene&&!!engine,
   overflow:document.documentElement.scrollWidth>innerWidth+1
  }));
  assert.equal(tFirst.id,"T-04");assert.equal(tFirst.pilot,true);
  assert.equal(tFirst.goal.kind,"hold-or-defeat");
  assert.equal(tFirst.goal.protectAllyId,"sava");
  assert.equal(tFirst.goal.allyActionsToHold,8);
  assert.match(tFirst.label,/Прикрыть отход/);
  assert.match(tFirst.objective,/Сава/);
  assert.match(tFirst.counter,/0\/8/);
  assert.equal(tFirst.cardVisible,true);
  assert.deepEqual(tFirst.enemies,["npc-t04-interceptor","npc-t04-slinger","npc-t04-guard"]);
  assert.ok(tFirst.meshes.every(Boolean));assert.equal(tFirst.webgl,true);
  assert.equal(tFirst.overflow,false);
  await page.screenshot({path:path.join(artifacts,name+"-T04-arena.png"),fullPage:true});
  await page.locator("#autoSpeedBtn").click();await page.locator("#autoSpeedBtn").click();
  await page.locator("#autoBattleBtn").click();
  await page.locator("#challengeResult").waitFor({state:"visible",timeout:150000});
  const tResult=await page.evaluate(()=>({
   won:state.winner,stars:challengeLastStars,outcome:state.tacticalOutcome,
   turns:state.allyActions,alive:state.fighters.filter(f=>f.side==="ally").every(f=>f.hp>0),
   resultName:document.querySelector("#challengeResultName").textContent,
   text:document.querySelector("#challengeResultText").textContent,
   status:document.querySelector("#challengeResultStars").textContent
  }));
  assert.equal(tResult.stars,tResult.won==="ally"?
   tResult.outcome==="held"?(tResult.alive?3:2):1:0);
  assert.match(tResult.resultName,/Прикрыть отход/);
  assert.match(tResult.status,/Лучший результат/);
  assertNpcSaved(beforeT,await snapshot(page),"T-04",tResult.stars);
  await page.locator("#challengeResultBack").click();
  await page.locator("#challengeModeBack").click();
  await page.locator('[data-challenge-kind="onslaught"]').click();
  const nCard=page.locator('[data-start-challenge="N-04"]').locator("xpath=ancestor::article");
  assert.match(await nCard.innerText(),/Без передышки/);
  assert.match(await nCard.innerText(),/активное лечение/i);
  assert.equal(await page.locator('[data-start-challenge="N-04"]').isEnabled(),true);
  const beforeN=await snapshot(page);
  await enter(page,"N-04");
  const nFirst=await page.evaluate(()=>({
   wave:state.wave,total:state.totalWaves,
   label:document.querySelector("#battleMissionLabel").textContent,
   enemies:state.fighters.filter(f=>f.side==="enemy").map(f=>f.id),
   goal:document.querySelector("#battleChallengeGoal").textContent,
   visible:state.fighters.filter(f=>f.side==="enemy").every(f=>
    !!meshes[f.id]?.body.isEnabled()&&meshes[f.id]?.body.metadata?.fighterId===f.id),
   overflow:document.documentElement.scrollWidth>innerWidth+1
  }));
  assert.equal(nFirst.wave,1);assert.equal(nFirst.total,3);
  assert.deepEqual(nFirst.enemies,["npc-n04-interceptor","npc-n04-slinger"]);
  assert.match(nFirst.label,/Без передышки/);
  assert.match(nFirst.goal,/лечение/i);
  assert.equal(nFirst.visible,true);assert.equal(nFirst.overflow,false);
  await page.screenshot({path:path.join(artifacts,name+"-N04-wave1.png"),fullPage:true});
  await page.locator("#autoSpeedBtn").click();await page.locator("#autoSpeedBtn").click();
  await page.locator("#autoBattleBtn").click();
  await page.waitForFunction(()=>state?.wave===2&&
   state.fighters.some(f=>f.id==="npc-n04-medic")&&
   !!meshes["npc-n04-medic"]?.body.isEnabled(),null,{timeout:125000});
  await page.screenshot({path:path.join(artifacts,name+"-N04-wave2.png"),fullPage:true});
  await page.waitForFunction(()=>state?.wave===3&&
   ["npc-n04-captain","npc-n04-signaller"].every(id=>
    state.fighters.some(f=>f.id===id)&&!!meshes[id]?.body.isEnabled()),null,{timeout:125000});
  await page.screenshot({path:path.join(artifacts,name+"-N04-wave3.png"),fullPage:true});
  await page.locator("#challengeResult").waitFor({state:"visible",timeout:160000});
  const nResult=await page.evaluate(()=>({
   won:state.winner,stars:challengeLastStars,wave:state.wave,total:state.totalWaves,
   alive:state.fighters.filter(f=>f.side==="ally").every(f=>f.hp>0),
   activeHeals:challengeTracker.pilotActiveHealUsed===true,
   verified:challengeTracker.pilotCapturedActions===state.allyActions,
   text:document.querySelector("#challengeResultText").textContent,
   label:document.querySelector("#challengeResultStars").textContent
  }));
  assert.equal(nResult.won,"ally");assert.equal(nResult.wave,3);
  assert.equal(nResult.stars,nResult.alive?(nResult.activeHeals||!nResult.verified?2:3):1);
  assert.match(nResult.text,/Активное лечение союзников/);
  assert.match(nResult.label,/Лучший результат/);
  assertNpcSaved(beforeN,await snapshot(page),"N-02",nResult.stars);
  await page.locator("#challengeResultRetry").click();
  await page.locator("#squad").waitFor({state:"visible",timeout:14000});
  await page.locator("#squadBack").click();
  assert.equal(await page.evaluate(()=>renderLoopRunning),false);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  assert.deepEqual(errors.filter(x=>/TypeError|ReferenceError|CombatCore|NpcChallengePilot/.test(x)),[]);
  console.log("NPCROLLOUT001_BROWSER",name,"PASS",
   JSON.stringify({tFirst,tResult,nFirst,nResult}));
 }catch(error){
  await page.screenshot({path:path.join(artifacts,name+"-failed.png"),fullPage:true}).catch(()=>{});
  console.error("NPCROLLOUT001_BROWSER_FAIL",name,errors);
  throw error;
 }finally{await browser.close();}
}
(async()=>{for(const [name,kind] of [["chromium",chromium],["webkit",webkit]])
 await smoke(name,kind);})().catch(error=>{console.error(error);process.exitCode=1;});
