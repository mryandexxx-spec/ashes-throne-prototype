"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),{chromium,webkit}=require("playwright");
async function tapFighter(page,id,probeOnly=false){
 const handle=await page.waitForFunction(id=>{
  const canvas=document.querySelector("#renderCanvas"),rect=canvas.getBoundingClientRect();
  const camera=arenaCamera,m=meshes[id];
  if(!m||!scene||!camera)return null;
  const width=engine.getRenderWidth(),height=engine.getRenderHeight();
  const vp=camera.viewport.toGlobal(width,height);
  const fighterId=mesh=>{while(mesh&&!mesh.metadata?.fighterId)mesh=mesh.parent;return mesh?.metadata?.fighterId;};
  for(const part of [m.body,m.head,m.base]){
   const p=BABYLON.Vector3.Project(part.getAbsolutePosition(),BABYLON.Matrix.Identity(),scene.getTransformMatrix(),vp);
   const x=p.x*rect.width/width,y=p.y*rect.height/height;
   for(const dy of [0,-8,8,-16,16,-24,24])for(const dx of [0,-8,8,-16,16]){
    const sx=x+dx,sy=y+dy;
    if(sx<0||sy<0||sx>=rect.width||sy>=rect.height)continue;
    if(document.elementFromPoint(rect.left+sx,rect.top+sy)!==canvas)continue;
    if(fighterId(scene.pick(sx,sy)?.pickedMesh)===id)return {x:rect.left+sx,y:rect.top+sy};
   }
  }
  // Imported GLB geometry can extend beyond its invisible capsule anchors.
  // Sample the live, visible pickable meshes' projected bounds as well.
  for(const part of scene.meshes.filter(p=>p.isPickable&&p.isVisible&&p.isEnabled()&&p.getTotalVertices()>0&&fighterId(p)===id)){
   const box=part.getBoundingInfo().boundingBox;
   const corners=box.vectorsWorld.map(v=>BABYLON.Vector3.Project(v,BABYLON.Matrix.Identity(),scene.getTransformMatrix(),vp));
   const xs=corners.map(p=>p.x*rect.width/width),ys=corners.map(p=>p.y*rect.height/height);
   const left=Math.max(0,Math.min(...xs)),right=Math.min(rect.width-1,Math.max(...xs));
   const top=Math.max(0,Math.min(...ys)),bottom=Math.min(rect.height-1,Math.max(...ys));
   if(right<left||bottom<top)continue;
   for(const fy of [.5,.25,.75,.1,.9])for(const fx of [.5,.25,.75,.1,.9]){
    const sx=left+(right-left)*fx,sy=top+(bottom-top)*fy;
    if(document.elementFromPoint(rect.left+sx,rect.top+sy)!==canvas)continue;
    if(fighterId(scene.pick(sx,sy)?.pickedMesh)===id)return {x:rect.left+sx,y:rect.top+sy};
   }
  }
  return null;
 },id,{timeout:12000,polling:250});
 const point=await handle.jsonValue();await handle.dispose();
 assert.ok(point,"real visible pickable canvas point for "+id);
 if(!probeOnly)await page.touchscreen.tap(point.x,point.y);
 return point;
}
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
  const equip=page.locator('.r2a-path [data-field="equip"]');
  const select=async id=>{await page.locator('.r2a-path [data-node="'+id+'"]').tap();assert.equal(await equip.isEnabled(),true);await equip.tap();assert.equal(await page.locator('.r2a-path [data-node="'+id+'"]').getAttribute("data-equipped"),"true");assert.equal((await snapshot()).stored.artPath.selected,id==="base"?null:id);};
  await select("guardian-2");
  await page.reload({waitUntil:"load"});await page.waitForFunction(()=>typeof showScreen==="function");await open();assert.equal(await hold.count(),0);assert.match(await story.innerText(),/Люди вышли в безопасное место/);
  assert.equal((await snapshot()).stored.artPath.phase,"complete");assert.equal((await snapshot()).stored.artPath.selected,"guardian-2");assert.deepEqual((await snapshot()).squad,baseline.squad);assert.equal((await snapshot()).savedSquad,baseline.savedSquad);
  await page.locator(".r2a-path-back").tap();
  const personal=page.locator("#personalAbilityBtn"),slot=page.locator("#personalAbilitySlot");
  const readyTurn=()=>page.waitForFunction(()=>state.active&&!visualActionPending()&&!combat2InputBlocked()&&!isVisualTransition()&&!document.querySelector("#basicAbilityBtn").disabled,null,{timeout:60000,polling:100});
  const launch=async expected=>{
   assert.equal(await page.evaluate(()=>openMainCampaignMission(MainCampaignCore.II_ID)),true);
   await page.evaluate(()=>{const original=resetBattle;resetBattle=function(...args){const now=Date.now;try{Date.now=()=>{Date.now=now;return 7;};return original.apply(this,args);}finally{Date.now=now;resetBattle=original;}};});
   await page.locator("#squadStart").tap();if(await page.locator("#squad.active").isVisible())await page.locator("#squadStart").tap();
   await page.locator("#battle.active").waitFor({timeout:30000});await readyTurn();
   const actual=await page.evaluate(()=>({ids:state.trustPersonal??[],seed:state.rng?.seed,actor:state.fighters[state.currentActor].id}));
   assert.deepEqual(actual.ids,expected?[expected]:[]);assert.equal(actual.seed,7);
   assert.equal(actual.actor,"ren");assert.equal(await slot.isVisible(),false,"No Art slot on another hero turn");
  };
  const basic=async()=>{await readyTurn();await page.locator("#basicAbilityBtn").tap();await readyTurn();};
  const retreat=async()=>{await page.locator("#battleMenuBtn").tap();await page.locator("#battleMenuRetreat").tap();await page.locator("#campaign.active").waitFor();await page.evaluate(()=>{selectedHeroId="art";showScreen("heroDetail");});await page.locator("#r2aTree").tap();};
  await launch("art-intercept");await basic();
  assert.equal(await page.evaluate(()=>state.fighters[state.currentActor].id),"art");assert.equal(await personal.isEnabled(),true);
  assert.match(await personal.getAttribute("aria-label"),/Перехват/);
  for(const [width,height] of [[844,390],[932,430],[844,320]]){
   await page.setViewportSize({width,height});
   const geo=await page.evaluate(()=>{const buttons=[...document.querySelectorAll("#abilityOptions .ability-slot:not([hidden]) button")];return buttons.map(b=>{const r=b.getBoundingClientRect();return {w:r.width,h:r.height,inside:r.left>=0&&r.top>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1};});});
   assert.equal(geo.length,4);assert.ok(geo.every(x=>x.w>=44&&x.h>=44&&x.inside),JSON.stringify(geo));
  }
  await page.setViewportSize({width:844,height:390});
  const beforeActions=await page.evaluate(()=>state.allyActions);await personal.tap();
  assert.equal(await page.evaluate(()=>selectedAbility),"art-intercept");
  assert.equal(await page.evaluate(()=>selectArenaTarget(meshes.art.body)),false,"Self-target rejected by real selection handler");
  assert.equal(await page.evaluate(()=>state.allyActions),beforeActions);
  await page.locator("#basicAbilityBtn").tap();assert.equal(await page.evaluate(()=>selectedAbility),"basic");assert.equal(await page.evaluate(()=>state.allyActions),beforeActions);
  await personal.tap();await tapFighter(page,"ren");
  await page.waitForFunction(n=>state.allyActions===n+1,beforeActions,{timeout:15000});
  const intercept=await page.evaluate(()=>({events:state.events,cd:state.trustPersonalCooldown["art-intercept"]}));
  assert.ok(intercept.events.some(e=>e.type==="trust-intercept-armed"&&e.targetId==="ren"));assert.equal(intercept.cd,2);
  await readyTurn();await retreat();await select("command-2");
  await page.locator(".r2a-path-back").tap();await launch("art-reserve");
  await basic();
  assert.equal(await page.evaluate(()=>state.fighters[state.currentActor].id),"art");assert.equal(await slot.isVisible(),true);assert.equal(await personal.isDisabled(),true,"No transfer to full Protection");
  for(let i=0;i<8;i++){if(await personal.isEnabled())break;await basic();}
  assert.equal(await personal.isEnabled(),true);assert.match(await personal.getAttribute("aria-label"),/Переброска резерва/);
  const preview=await page.evaluate(()=>CombatCore.personalPreview(state,"art-reserve",state.fighters.findIndex(f=>f.id==="ren")).amount);
  assert.ok(preview>0);await personal.tap();await tapFighter(page,"ren");
  const transfer=await page.evaluate(()=>({events:state.events,cd:state.trustPersonalCooldown["art-reserve"]}));
  assert.ok(transfer.events.some(e=>e.type==="trust-reserve-transferred"&&e.amount===preview&&e.targetId==="ren"));assert.equal(transfer.cd,2);
  await readyTurn();await retreat();await select("base");
  await page.locator(".r2a-path-back").tap();await launch(null);
  await basic();assert.equal(await slot.isVisible(),false,"No equipped specialization, no extra button");
  await retreat();assert.equal((await snapshot()).stored.artPath.selected,null);
  assert.deepEqual((await snapshot()).squad,baseline.squad);assert.equal((await snapshot()).savedSquad,baseline.savedSquad);assert.deepEqual(errors,[]);
  console.log("R2/D2B PERSONAL SLOT",name,"PASS");
  fs.mkdirSync("artifacts",{recursive:true});await page.screenshot({path:"artifacts/r2d2a-"+name+".png"});console.log("R2/D2A REAL ROUTE",name,"PASS");
 }catch(e){console.error("R2/D2A DIAGNOSTIC",name,await page.evaluate(()=>({screen:document.querySelector(".screen.active")?.id,winner:typeof state!=="undefined"?state?.winner:null,outcome:typeof state!=="undefined"?state?.tacticalOutcome:null,notice:typeof artAdventureNotice!=="undefined"?artAdventureNotice:null,actions:state?.allyActions,seed:state?.rng?.seed,actor:state?.fighters[state.currentActor]?.id,pending:BattleAnimation.pending(),dt:engine?.getDeltaTime(),renderLoopRunning,documentHidden:document.hidden,entry:combat2EntryPending,gate:!!battleAssetGate,transition:visualTransition,activity:state?.fighters.map(f=>({id:f.id,hp:f.hp,activity:BattleAnimation.activity(f.id)})),speed:BattleSpeed.get()})).catch(()=>null),errors);throw e;}finally{await browser.close();}
}
(async()=>{for(const [type,name] of [[chromium,"chromium"],[webkit,"webkit"]])await run(type,name)})().catch(e=>{console.error(e);process.exitCode=1});
