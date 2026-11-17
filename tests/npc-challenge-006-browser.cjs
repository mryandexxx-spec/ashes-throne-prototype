"use strict";
/* NPCCHALLENGE006: opt-in T-03 reversed priority and N-03 three-wave HP rating.
 * Real Babylon 3D in Chromium/WebKit, 932×430 touch landscape, no saved progress. */
const assert=require("node:assert/strict");
const {chromium,webkit}=require("playwright");
const fs=require("node:fs"),path=require("node:path");
const artifacts=path.join(process.cwd(),"artifacts","npc-challenge-006");
fs.mkdirSync(artifacts,{recursive:true});
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
const party=["ren","nada","liora","art","sava"];
async function battleEntry(page,id){
 await page.locator('[data-start-challenge="'+id+'"]').click();
 await page.locator("#squad").waitFor({state:"visible",timeout:15000});
 await page.locator("#squadDisband").evaluate(el=>el.click());
 for(const heroId of party)
  await page.locator('#squadRoster [data-hero-id="'+heroId+'"]').evaluate(el=>el.click());
 assert.equal(await page.locator("#squadCount").innerText(),"5/5");
 await page.locator("#squadStart").click();
 if(await page.locator("#squad").isVisible())await page.locator("#squadStart").click();
 await page.locator("#battle").waitFor({state:"visible",timeout:30000});
}
const snapshot=page=>page.evaluate(()=>({
 wallet:JSON.stringify(progress),
 challenges:JSON.stringify(challengeProgress),
 challengeSave:localStorage.getItem(ChallengeCore.KEY),
 progressSave:localStorage.getItem("ashes-throne.progress.v3"),
 daily:JSON.stringify(progress.daily)
}));
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
async function smoke(name,kind){
 const browser=await kind.launch(name==="chromium"?
  {headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-dev-shm-usage"]}:
  {headless:true});
 const page=await browser.newPage({viewport:{width:932,height:430},hasTouch:true});
 const errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 try{
  const url=new URL(origin);
  await page.goto(url.toString(),{waitUntil:"load",timeout:60000});
  assert.equal(await page.locator("#buildVersion").innerText(),
   "Прототип · v"+require("../package.json").version+" · LOREACT5001");
  // Unlock only in-memory prerequisites; never mutate localStorage.
  await page.evaluate(()=>{
   for(const id of ["T-01","T-02","N-01","N-02"])
    challengeProgress.bestStars[id]=1;
  });
  await page.locator('#hqMoreMenu [data-screen="challenges"]').evaluate(el=>el.click());
  await page.locator("#challenges").waitFor({state:"visible",timeout:12000});
  assert.match(await page.locator("#challengeSaveStatus").innerText(),/Лучшая оценка сохраняется/);
  await page.locator('[data-challenge-kind="tactical"]').click();
  const tCard=page.locator('[data-start-challenge="T-03"]').locator("xpath=ancestor::article");
  assert.equal(await page.locator('[data-start-challenge="T-03"]').isEnabled(),true);
  assert.doesNotMatch(await tCard.innerText(),/NPC-ПРОБА/);
  assert.match(await tCard.innerText(),/перевязчика последним/i);
  const beforeT=await snapshot(page);
  await battleEntry(page,"T-03");
  const first=await page.evaluate(()=>({
   pilot:battleIsNpcChallengePilot,id:activeChallengeId,
   objective:document.querySelector("#battleChallengeGoal").textContent,
   enemies:state.fighters.filter(f=>f.side==="enemy").map(f=>f.id),
   tracker:challengeTracker.priorityId,
   meshes:state.fighters.filter(f=>f.side==="enemy").map(f=>({
    id:f.id,visible:!!meshes[f.id]?.body.isEnabled(),
    marker:meshes[f.id]?.body.metadata?.fighterId
   })),
   webgl:!!scene&&!!engine,
   overflow:document.documentElement.scrollWidth>innerWidth+1
  }));
  assert.equal(first.pilot,true);assert.equal(first.id,"T-03");
  assert.deepEqual(first.enemies,["npc-t03-slinger","npc-t03-guard","npc-t03-medic"]);
  assert.equal(first.tracker,"npc-t03-medic");
  assert.match(first.objective,/последним/);
  assert.ok(first.meshes.every(m=>m.visible&&m.id===m.marker));
  assert.equal(first.webgl,true);assert.equal(first.overflow,false);
  await page.screenshot({path:path.join(artifacts,name+"-T03-arena.png"),fullPage:true});
  await page.locator("#autoSpeedBtn").click();
  await page.locator("#autoSpeedBtn").click();
  await page.locator("#autoBattleBtn").click();
  await page.locator("#challengeResult").waitFor({state:"visible",timeout:150000});
  const tResult=await page.evaluate(()=>({
   winner:state.winner,
   stars:challengeLastStars,
   lastGroup:challengeTracker.killGroups.filter(x=>x.length).at(-1)||[],
   text:document.querySelector("#challengeResultText").textContent,
   label:document.querySelector("#challengeResultStars").textContent
  }));
  assert.equal(tResult.winner,"ally");
  assert.equal(tResult.stars,1,
   "auto strategy eliminates the healer early; reversed objective must not give 3 stars");
  assert.notDeepEqual(tResult.lastGroup,["npc-t03-medic"]);
  assert.match(tResult.label,/Лучший результат/);
  assert.match(tResult.text,/оставь лекаря последним/i);
  assertNpcSaved(beforeT,await snapshot(page),"T-03",tResult.stars);
  await page.locator("#challengeResultBack").click();
  await page.locator("#challenges").waitFor({state:"visible",timeout:12000});
  await page.locator("#challengeModeBack").click();
  await page.locator('[data-challenge-kind="onslaught"]').click();
  const nCard=page.locator('[data-start-challenge="N-03"]').locator("xpath=ancestor::article");
  assert.equal(await page.locator('[data-start-challenge="N-03"]').isEnabled(),true);
  assert.doesNotMatch(await nCard.innerText(),/NPC-ПРОБА/);
  assert.match(await nCard.innerText(),/3 волны/);
  assert.match(await nCard.innerText(),/95%/);
  const beforeN=await snapshot(page);
  await battleEntry(page,"N-03");
  const nFirst=await page.evaluate(()=>({
   pilot:battleIsNpcChallengePilot,id:activeChallengeId,
   wave:state.wave,total:state.totalWaves,
   enemies:state.fighters.filter(f=>f.side==="enemy").map(f=>f.id),
   visible:state.fighters.filter(f=>f.side==="enemy").every(f=>
    !!meshes[f.id]?.body.isEnabled()&&meshes[f.id]?.body.metadata?.fighterId===f.id),
   objective:document.querySelector("#battleChallengeGoal").textContent,
   overflow:document.documentElement.scrollWidth>innerWidth+1
  }));
  assert.equal(nFirst.pilot,true);assert.equal(nFirst.id,"N-03");
  assert.equal(nFirst.wave,1);assert.equal(nFirst.total,3);
  assert.deepEqual(nFirst.enemies,["npc-n03-slinger","npc-n03-guard"]);
  assert.equal(nFirst.visible,true);assert.equal(nFirst.overflow,false);
  assert.match(nFirst.objective,/95%/);
  await page.screenshot({path:path.join(artifacts,name+"-N03-wave1.png"),fullPage:true});
  await page.locator("#autoSpeedBtn").click();
  await page.locator("#autoSpeedBtn").click();
  await page.locator("#autoBattleBtn").click();
  await page.waitForFunction(()=>state?.wave===2&&
   ["npc-n03-medic","npc-n03-signaller"].every(id=>
    state.fighters.some(f=>f.id===id)&&!!meshes[id]?.body.isEnabled()),
   null,{timeout:115000});
  const nSecond=await page.evaluate(()=>({
   wave:state.wave,enemies:state.fighters.filter(f=>f.side==="enemy").map(f=>f.id)
  }));
  assert.deepEqual(nSecond.enemies,["npc-n03-medic","npc-n03-signaller"]);
  await page.screenshot({path:path.join(artifacts,name+"-N03-wave2.png"),fullPage:true});
  await page.waitForFunction(()=>state?.wave===3&&
   state.fighters.some(f=>f.id==="npc-n03-captain")&&
   !!meshes["npc-n03-captain"]?.body.isEnabled(),
   null,{timeout:115000});
  const nThird=await page.evaluate(()=>({
   wave:state.wave,enemies:state.fighters.filter(f=>f.side==="enemy").map(f=>f.id),
   marker:meshes["npc-n03-captain"]?.body.metadata?.fighterId
  }));
  assert.deepEqual(nThird.enemies,["npc-n03-captain"]);
  assert.equal(nThird.marker,"npc-n03-captain");
  await page.screenshot({path:path.join(artifacts,name+"-N03-wave3.png"),fullPage:true});
  await page.locator("#challengeResult").waitFor({state:"visible",timeout:165000});
  const nResult=await page.evaluate(()=>({
   won:state.winner,stars:challengeLastStars,wave:state.wave,
   remaining:NpcChallengePilot.healthPercent(state)?.percent,
   allAlive:state.fighters.filter(f=>f.side==="ally").every(f=>f.hp>0),
   label:document.querySelector("#challengeResultStars").textContent,
   text:document.querySelector("#challengeResultText").textContent
  }));
  assert.equal(nResult.won,"ally");assert.equal(nResult.wave,3);
  assert.equal(nResult.stars,nResult.allAlive?(nResult.remaining>=95?3:2):1);
  assert.match(nResult.label,/Лучший результат/);
  assert.match(nResult.text,/Суммарное HP отряда в финале/);
  assert.match(nResult.text,/95%/);
  assertNpcSaved(beforeN,await snapshot(page),"N-03",nResult.stars);
  await page.locator("#challengeResultRetry").click();
  await page.locator("#squad").waitFor({state:"visible",timeout:14000});
  await page.locator("#squadBack").click();
  const returned=await page.evaluate(()=>({
   back:document.querySelector("#challenges").classList.contains("active"),
   running:!!renderLoopRunning,
   overflow:document.documentElement.scrollWidth>innerWidth+1
  }));
  assert.equal(returned.back,true);assert.equal(returned.running,false);
  assert.equal(returned.overflow,false);
  assert.deepEqual(errors.filter(x=>/TypeError|ReferenceError|NpcChallengePilot|CombatCore/.test(x)),[]);
  console.log("NPCCHALLENGE006_BROWSER",name,"PASS",JSON.stringify({
   first,tResult,nFirst,nSecond,nThird,nResult,returned
  }));
 }catch(error){
  await page.screenshot({path:path.join(artifacts,name+"-failed.png"),fullPage:true}).catch(()=>{});
  console.error("NPCCHALLENGE006_BROWSER_FAIL",name,errors);throw error;
 }finally{await browser.close();}
}
(async()=>{
 for(const [name,type] of [["chromium",chromium],["webkit",webkit]])
  await smoke(name,type);
})().catch(err=>{console.error(err);process.exitCode=1;});
