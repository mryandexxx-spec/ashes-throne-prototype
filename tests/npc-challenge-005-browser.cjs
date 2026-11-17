"use strict";
/* NPCCHALLENGE005: live T-02 and N-02 with real WebGL, AI and Save isolation.
 * Fixed 932x430 touch landscape; Chromium + WebKit, no hardware iPhone claim. */
const assert=require("node:assert/strict");
const {chromium,webkit}=require("playwright");
const fs=require("node:fs"),path=require("node:path");
const out=path.join(process.cwd(),"artifacts","npc-challenge-005");
fs.mkdirSync(out,{recursive:true});
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
async function selectFullSquad(page,id){
 await page.locator('[data-start-challenge="'+id+'"]').click();
 await page.locator("#squad").waitFor({state:"visible",timeout:12000});
 await page.locator("#squadDisband").evaluate(el=>el.click());
 for(const hero of ["ren","nada","liora","art","sava"])
  await page.locator('#squadRoster [data-hero-id="'+hero+'"]').evaluate(el=>el.click());
 assert.equal(await page.locator("#squadCount").innerText(),"5/5");
 await page.locator("#squadStart").click();
 if(await page.locator("#squad").isVisible())await page.locator("#squadStart").click();
 await page.locator("#battle").waitFor({state:"visible",timeout:35000});
}
async function snapshot(page){
 return page.evaluate(()=>({
  wallet:JSON.stringify(progress),
  challengeProgress:JSON.stringify(challengeProgress),
  challengeSave:localStorage.getItem(ChallengeCore.KEY),
  progressSave:localStorage.getItem("ashes-throne.progress.v3"),
  daily:JSON.stringify(progress.daily)
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
async function run(name,browserType){
 const browser=await browserType.launch(name==="chromium"?
  {headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-dev-shm-usage"]}:
  {headless:true});
 const page=await browser.newPage({viewport:{width:932,height:430},hasTouch:true});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 try{
  const url=new URL(origin);
  
  await page.goto(url.toString(),{waitUntil:"load",timeout:60000});
  assert.ok((await page.locator("#buildVersion").innerText())
   .startsWith("Прототип · v"+require("../package.json").version+" · "), "footer must match package version");
  // Unlock the preceding original challenges IN MEMORY only; do not synthesize
  // victories, write storage or grant stars in any test scenario.
  await page.evaluate(()=>{
   challengeProgress.bestStars["T-01"]=1;
   challengeProgress.bestStars["N-01"]=1;
  });
  await page.locator('#hqMoreMenu [data-screen="challenges"]').evaluate(el=>el.click());
  await page.locator("#challenges").waitFor({state:"visible",timeout:15000});
  assert.match(await page.locator("#challengeSaveStatus").innerText(),/Лучшая оценка сохраняется/);
  await page.locator('[data-challenge-kind="tactical"]').click();
  const tCard=page.locator('[data-start-challenge="T-02"]').locator("xpath=ancestor::article");
  assert.equal(await page.locator('[data-start-challenge="T-02"]').isEnabled(),true);
  assert.doesNotMatch(await tCard.innerText(),/NPC-ПРОБА/);
  assert.match(await tCard.innerText(),/Перехватчик троп/);
  const before=await snapshot(page);
  await selectFullSquad(page,"T-02");
  const first=await page.evaluate(()=>({
   pilot:battleIsNpcChallengePilot,mode:battleIsChallenge,id:activeChallengeId,
   objective:document.querySelector("#battleChallengeGoal").textContent,
   fighters:state.fighters.filter(f=>f.side==="enemy").map(f=>f.id),
   tracker:challengeTracker.priorityId,
   meshes:state.fighters.filter(f=>f.side==="enemy").map(f=>({
    id:f.id,visible:!!meshes[f.id]?.body.isEnabled(),
    marker:meshes[f.id]?.body.metadata?.fighterId
   })),
   gpu:!!engine&&!!scene,
   overflow:document.documentElement.scrollWidth>innerWidth+1
  }));
  assert.equal(first.pilot,true);assert.equal(first.mode,true);
  assert.equal(first.id,"T-02");assert.equal(first.gpu,true);
  assert.deepEqual(first.fighters,["npc-t02-interceptor","npc-t02-guard"]);
  assert.equal(first.tracker,"npc-t02-interceptor");
  assert.match(first.objective,/Перехватчик троп/);
  assert.ok(first.meshes.every(m=>m.visible&&m.marker===m.id));
  assert.equal(first.overflow,false);
  await page.screenshot({path:path.join(out,name+"-t02-first-target.png"),fullPage:true});
  await page.locator("#autoSpeedBtn").click();
  await page.locator("#autoSpeedBtn").click();
  await page.locator("#autoBattleBtn").click();
  await page.locator("#challengeResult").waitFor({state:"visible",timeout:150000});
  const result=await page.evaluate(()=>({
   won:state.winner,stars:challengeLastStars,
   firstKill:challengeTracker.killGroups.find(g=>g.length)?.[0]||null,
   label:document.querySelector("#challengeResultStars").textContent,
   text:document.querySelector("#challengeResultText").textContent
  }));
  assert.equal(result.won,"ally");
  assert.equal(result.stars,result.firstKill==="npc-t02-interceptor"?3:1);
  assert.match(result.label,/Лучший результат/);
  assert.match(result.text,/Победа|испытан/i);
  assertNpcSaved(before,await snapshot(page),"T-02",result.stars);
  await page.locator("#challengeResultBack").click();
  await page.locator("#challenges").waitFor({state:"visible",timeout:12000});
  await page.locator("#challengeModeBack").click();
  await page.locator('[data-challenge-kind="onslaught"]').click();
  const nCard=page.locator('[data-start-challenge="N-02"]').locator("xpath=ancestor::article");
  assert.equal(await page.locator('[data-start-challenge="N-02"]').isEnabled(),true);
  assert.doesNotMatch(await nCard.innerText(),/NPC-ПРОБА/);
  assert.match(await nCard.innerText(),/2 волны/);
  assert.match(await nCard.innerText(),/лимит действий пока не установлен/);
  const beforeN=await snapshot(page);
  await selectFullSquad(page,"N-02");
  const nFirst=await page.evaluate(()=>({
   pilot:battleIsNpcChallengePilot,id:activeChallengeId,
   wave:state.wave,totalWaves:state.totalWaves,
   enemies:state.fighters.filter(f=>f.side==="enemy").map(f=>f.id),
   meshes:state.fighters.filter(f=>f.side==="enemy").map(f=>({
    id:f.id,visible:!!meshes[f.id]?.body.isEnabled(),
    marker:meshes[f.id]?.body.metadata?.fighterId
   })),
   limit:ChallengeCore.get("N-02").thirdStarActionLimit,
   overflow:document.documentElement.scrollWidth>innerWidth+1
  }));
  assert.equal(nFirst.pilot,true);assert.equal(nFirst.id,"N-02");
  assert.equal(nFirst.wave,1);assert.equal(nFirst.totalWaves,2);
  assert.deepEqual(nFirst.enemies,["npc-n02-slinger","npc-n02-signaller"]);
  assert.equal(nFirst.limit,null);
  assert.ok(nFirst.meshes.every(m=>m.visible&&m.marker===m.id));
  assert.equal(nFirst.overflow,false);
  await page.screenshot({path:path.join(out,name+"-n02-wave1.png"),fullPage:true});
  await page.locator("#autoSpeedBtn").click();
  await page.locator("#autoSpeedBtn").click();
  await page.locator("#autoBattleBtn").click();
  await page.waitForFunction(()=>state?.wave===2&&
   state.fighters.filter(f=>f.side==="enemy").length===2&&
   ["npc-n02-captain","npc-n02-medic"].every(id=>
    state.fighters.some(f=>f.id===id)&&!!meshes[id]?.body.isEnabled()),null,{timeout:120000});
  const nSecond=await page.evaluate(()=>({
   wave:state.wave,totalWaves:state.totalWaves,
   enemies:state.fighters.filter(f=>f.side==="enemy").map(f=>f.id),
   visuals:state.fighters.filter(f=>f.side==="enemy").every(f=>
    meshes[f.id]?.body.metadata?.fighterId===f.id)
  }));
  assert.deepEqual(nSecond.enemies,["npc-n02-captain","npc-n02-medic"]);
  assert.equal(nSecond.visuals,true);
  await page.screenshot({path:path.join(out,name+"-n02-wave2.png"),fullPage:true});
  await page.locator("#challengeResult").waitFor({state:"visible",timeout:160000});
  const nResult=await page.evaluate(()=>({
   won:state.winner,wave:state.wave,stars:challengeLastStars,
   label:document.querySelector("#challengeResultStars").textContent,
   text:document.querySelector("#challengeResultText").textContent
  }));
  assert.equal(nResult.won,"ally");
  assert.equal(nResult.wave,2);
  assert.ok([1,2].includes(nResult.stars),"no third-star action threshold defined");
  assert.match(nResult.label,/Лучший результат/);
  assert.match(nResult.text,/Победа|испытан/i);
  assertNpcSaved(beforeN,await snapshot(page),"N-02",nResult.stars);
  await page.locator("#challengeResultRetry").click();
  await page.locator("#squad").waitFor({state:"visible",timeout:15000});
  await page.locator("#squadBack").click();
  const returned=await page.evaluate(()=>({
   screen:document.querySelector("#challenges").classList.contains("active"),
   gpuActive:!!renderLoopRunning,
   overflow:document.documentElement.scrollWidth>innerWidth+1
  }));
  assert.equal(returned.screen,true);
  assert.equal(returned.gpuActive,false);
  assert.equal(returned.overflow,false);
  assert.deepEqual(errors.filter(x=>/TypeError|ReferenceError|NpcChallengePilot|CombatCore/.test(x)),[]);
  console.log("NPCCHALLENGE005_BROWSERSMOKE",name,"PASS",
   JSON.stringify({first,result,nFirst,nSecond,nResult,returned}));
 }catch(err){
  await page.screenshot({path:path.join(out,name+"-failure.png"),fullPage:true}).catch(()=>{});
  console.error("NPCCHALLENGE005_BROWSERSMOKE_FAIL",name,errors);
  throw err;
 }finally{await browser.close();}
}
(async()=>{
 for(const [name,type] of [["chromium",chromium],["webkit",webkit]])await run(name,type);
})().catch(e=>{console.error(e);process.exitCode=1;});
