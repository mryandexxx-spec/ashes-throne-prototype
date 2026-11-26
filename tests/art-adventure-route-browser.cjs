"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),{chromium,webkit}=require("playwright");
async function run(type,name){
 const browser=await type.launch(name==="chromium"?{headless:true,args:["--no-sandbox","--use-angle=swiftshader","--enable-webgl"]}:{headless:true});
 const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true}),errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 const url="http://127.0.0.1:8765/?skipFirstPlay=1&combat2Pilot=1&artAdventurePilot=1";
 const story=page.locator(".r2a-path [data-field=story]");
 const hold=story.locator('[data-path-mission="hold"]');
 const open=async()=>{await page.evaluate(()=>{selectedHeroId="art";showScreen("heroDetail");});await page.locator("#r2aStory").tap();};
 // Match the established main-campaign launch-seed pattern, but restore
 // Date.now BEFORE the first mocked read returns. Babylon and all later reads
 // see the real wall clock, and no Playwright clock shim is installed.
 const tapWithSeed=async seed=>{
  await page.evaluate(seed=>{
   const original=startArtAdventure;
   startArtAdventure=function(...args){
    const now=Date.now;
    try{Date.now=()=>{Date.now=now;return seed;};return original.apply(this,args);}
    finally{Date.now=now;startArtAdventure=original;}
   };
  },seed);
  await hold.tap();await page.locator("#battle.active").waitFor({state:"visible"});
  await page.waitForFunction(()=>battleIsArtAdventure&&state.active&&!!scene,null,{timeout:60000});
  assert.equal(await page.evaluate(()=>state.rng?.seed),seed,"Actual core received the fixture seed");
 };
 const playBasic=async()=>{
  await page.evaluate(()=>setAutoSpeed(4));
  await page.waitForFunction(()=>!combat2InputBlocked()&&!document.querySelector("#basicAbilityBtn").disabled,null,{timeout:60000,polling:100});
  for(let n=0;n<12;n++){
   if(!await page.evaluate(()=>battleIsArtAdventure&&state.active))break;
   await page.waitForFunction(()=>!state.active||(!visualActionPending()&&!combat2InputBlocked()&&!isVisualTransition()&&!document.querySelector("#basicAbilityBtn").disabled),null,{timeout:60000,polling:100});
   console.log("R2/D2A TURN",name,await page.evaluate(()=>({action:state.allyActions,actor:state.fighters[state.currentActor]?.id,seed:state.rng?.seed,pending:BattleAnimation.pending()})));
   await page.evaluate(()=>{if(!state.active)return;const enemy=state.fighters.map((f,i)=>({f,i})).filter(x=>x.f.side==="enemy"&&x.f.hp>0).sort((a,b)=>a.f.hp+a.f.protection-b.f.hp-b.f.protection)[0];if(!CombatCore.chooseEnemy(state,enemy.i))throw Error("TEST_TARGET");if(!applyManualAbility("basic"))throw Error("TEST_ACTION");});
  }
  await story.waitFor({state:"visible",timeout:90000});
  return page.evaluate(()=>({winner:state.winner,outcome:state.tacticalOutcome,actions:state.allyActions,hp:state.fighters.filter(f=>f.side==="ally").map(f=>[f.id,f.hp]),notice:artAdventureNotice}));
 };
 const snapshot=()=>page.evaluate(()=>({wallet:JSON.stringify(progress),live:localStorage.getItem(ProgressV3Core.KEY),stored:JSON.parse(gameStorage().getItem(ProgressV3Core.KEY)),squad:[selectedLeaderId,...selectedPartyIds],savedSquad:gameStorage().getItem(SQUAD_SAVE_KEY),mode:squadReturnScreen}));
 try{
  await page.goto(url,{waitUntil:"load"});await page.waitForFunction(()=>typeof showScreen==="function"&&typeof artAdventureView==="function");
  assert.equal(await page.evaluate(()=>ART_ADVENTURE_PILOT),true);
  await open();assert.equal(await hold.count(),0);assert.match(await story.innerText(),/глава II|главу II/);
  await page.locator(".r2a-path-back").tap();
  // Fixture only for already-earned campaign prerequisite; no personal adventure proof forged.
  await page.evaluate(()=>{if(!StarCore.directGrant(progress,"nada"))throw Error("TEST_GRANT");progress.rewardReceipts=MainCampaignCore.MISSIONS.map(m=>({id:m.receipt,sourceId:m.id,day:"2026-11-26",count:1}));for(const m of MainCampaignCore.MISSIONS)gameStorage().setItem(m.key,JSON.stringify(m.id===MainCampaignCore.ID?{version:1,best:3}:{version:1,missionId:m.id,best:3}));if(!persistProgress())throw Error("TEST_SAVE");if(!saveSquad())throw Error("TEST_SQUAD_SAVE");});
  // Persist the chosen two-hero formation, rather than compare two different default rosters after Nada joins.
  const baseline=await snapshot();assert.ok(baseline.savedSquad);assert.deepEqual(baseline.squad,["ren","art",null,null,null]);
  await open();await hold.waitFor({state:"visible"});assert.equal(await hold.isEnabled(),true);
  for(const [width,height] of [[844,390],[932,430],[844,320]]){
   await page.setViewportSize({width,height});const bounds=await hold.boundingBox();assert.ok(bounds&&bounds.height>=44);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  }
  await page.setViewportSize({width:844,height:390});
  await hold.tap();await page.locator("#battle").waitFor({state:"visible"});await page.waitForFunction(()=>battleIsArtAdventure&&state?.active&&!!scene);
  assert.deepEqual(await page.evaluate(()=>state.fighters.filter(f=>f.side==="ally").map(f=>f.id).sort()),["art","ren"]);
  assert.equal(await page.evaluate(()=>state.tacticalObjective.allyActionsToHold),8);
  assert.equal((await snapshot()).stored.artPath.phase,"pending");
  assert.equal(await page.evaluate(()=>ArtAdventureCore.view(progress).earned.length),0);
  assert.equal(await page.evaluate(()=>BABYLON.EngineStore.Instances.some(e=>e.getRenderingCanvas()?.id==="renCard3DCanvas")),false);
  await page.locator("#battleMenuBtn").tap();await page.locator("#battleMenuRetreat").tap();await story.waitFor({state:"visible"});
  assert.equal(await page.evaluate(()=>artAdventureSession.active()),false);assert.equal((await snapshot()).stored.artPath.phase,"pending");
  assert.deepEqual((await snapshot()).squad,baseline.squad);assert.equal((await snapshot()).savedSquad,baseline.savedSquad);assert.equal((await snapshot()).mode,baseline.mode);
  // Actual reload leaves pending inert and the mission available.
  await page.reload({waitUntil:"load"});await page.waitForFunction(()=>typeof showScreen==="function");
  assert.deepEqual((await snapshot()).squad,baseline.squad,"Reload restores the explicitly saved formation");assert.equal((await snapshot()).savedSquad,baseline.savedSquad);
  await open();await hold.waitFor({state:"visible"});assert.equal(await page.evaluate(()=>ArtAdventureCore.view(progress).earned.length),0);
  // Preflight native core simulation with real starter hero definitions:
  // 3037 loses at 7 actions, 3061 wins at 8 with both allies alive.
  await tapWithSeed(3037);const loss=await playBasic();
  console.log("R2/D2A LOSS",name,JSON.stringify(loss));
  assert.equal(loss.winner,"enemy",JSON.stringify(loss));assert.equal(loss.outcome,"protected-fallen");
  const failed=await snapshot();assert.equal(failed.stored.artPath.phase,"pending");
  assert.equal(await page.evaluate(()=>ArtAdventureCore.view(progress).earned.length),0);
  assert.equal(await page.evaluate(()=>artAdventureSession.active()),false);
  assert.equal(failed.stored.currency,baseline.stored.currency);assert.deepEqual(failed.stored.rewardReceipts,baseline.stored.rewardReceipts);
  assert.deepEqual(failed.squad,baseline.squad);assert.equal(failed.savedSquad,baseline.savedSquad);
  await hold.waitFor({state:"visible"});assert.equal(await hold.isEnabled(),true);
  await tapWithSeed(3061);const victory=await playBasic();
  console.log("R2/D2A WIN",name,JSON.stringify(victory));
  assert.equal(victory.winner,"ally",JSON.stringify(victory));assert.equal(victory.outcome,"held");assert.equal(victory.actions,8);
  assert.ok(victory.hp.every(([,hp])=>hp>0),JSON.stringify(victory));
  const done=await snapshot();
  assert.equal(done.stored.artPath.phase,"complete",JSON.stringify(victory));assert.equal(done.stored.artPath.selected,null);assert.equal(done.stored.artPath.outcome,"left");
  assert.equal(done.stored.currency,baseline.stored.currency);assert.equal(done.stored.energy.value,baseline.stored.energy.value);assert.deepEqual(done.stored.rewardReceipts,baseline.stored.rewardReceipts);assert.deepEqual(done.squad,baseline.squad);assert.equal(done.savedSquad,baseline.savedSquad);assert.equal(done.live,baseline.live);
  assert.match(await story.innerText(),/Люди вышли в безопасное место/);
  await story.locator('[data-field="storyAction"]').tap();
  assert.equal(await page.locator('.r2a-path [data-node="guardian-2"]').getAttribute("data-locked"),"false");
  assert.equal(await page.locator('.r2a-path [data-node="command-2"]').getAttribute("data-locked"),"false");
  await page.locator('.r2a-path [data-node="guardian-2"]').tap();
  assert.equal(await page.locator('.r2a-path [data-field="equip"]').isDisabled(),true,"D2B slot not released");
  await page.reload({waitUntil:"load"});await page.waitForFunction(()=>typeof showScreen==="function");await open();assert.equal(await hold.count(),0);assert.match(await story.innerText(),/Люди вышли в безопасное место/);
  assert.equal((await snapshot()).stored.artPath.phase,"complete");assert.deepEqual((await snapshot()).squad,baseline.squad);assert.equal((await snapshot()).savedSquad,baseline.savedSquad);assert.deepEqual(errors,[]);
  fs.mkdirSync("artifacts",{recursive:true});await page.screenshot({path:"artifacts/r2d2a-"+name+".png"});console.log("R2/D2A REAL ROUTE",name,"PASS");
 }catch(e){console.error("R2/D2A DIAGNOSTIC",name,await page.evaluate(()=>({screen:document.querySelector(".screen.active")?.id,winner:typeof state!=="undefined"?state?.winner:null,outcome:typeof state!=="undefined"?state?.tacticalOutcome:null,notice:typeof artAdventureNotice!=="undefined"?artAdventureNotice:null,actions:state?.allyActions,seed:state?.rng?.seed,actor:state?.fighters[state.currentActor]?.id,pending:BattleAnimation.pending(),dt:engine?.getDeltaTime(),renderLoopRunning,documentHidden:document.hidden,entry:combat2EntryPending,gate:!!battleAssetGate,transition:visualTransition,activity:state?.fighters.map(f=>({id:f.id,hp:f.hp,activity:BattleAnimation.activity(f.id)})),speed:BattleSpeed.get()})).catch(()=>null),errors);throw e;}finally{await browser.close();}
}
(async()=>{for(const [type,name] of [[chromium,"chromium"],[webkit,"webkit"]])await run(type,name)})().catch(e=>{console.error(e);process.exitCode=1});
