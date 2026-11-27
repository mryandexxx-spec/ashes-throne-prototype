"use strict";
// CAM001B: exercise the real buttons and CombatCore, no synthetic win injection.
const {chromium,webkit}=require("playwright");
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
const url=origin+(origin.includes("?")?"&":"?")+"skipFirstPlay=1";
const dest=path.join(process.cwd(),"artifacts","main-campaign");fs.mkdirSync(dest,{recursive:true});
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
async function run(name,browserType,viewport){
 const browser=await browserType.launch(name==="chromium"?{headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-dev-shm-usage"]}:{headless:true});
 const page=await browser.newPage({viewport,hasTouch:true,reducedMotion:"reduce"});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 const key=name+"-"+viewport.width+"x"+viewport.height;
 const ready=async()=>{
  await page.waitForFunction(()=>typeof MainCampaignCore!=="undefined"&&typeof openSquad==="function"&&document.querySelector("#walletWriterNotice")?.style.display==="none",null,{timeout:60000});
  // The existing daily login calendar can open on a fresh or reloaded profile.
  await page.locator("#home.active, #loginCalendar.active").waitFor({timeout:30000});
  if(await page.locator("#loginCalendar.active").isVisible())await page.locator('#loginCalendar [data-screen="home"]').tap();
  await page.locator("#home.active").waitFor({timeout:30000});
 };
 const showMap=async()=>{
  await page.locator('#home .hq-station[data-screen="campaign"]').tap();
  await page.locator("#campaign.active").waitFor({timeout:20000});
  await page.locator('[data-campaign-path="main"]').tap();
  await page.locator("#mainCampaignMap").waitFor();
 };
 const inspect=()=>page.evaluate(()=>({proof:MainCampaignCore.load(()=>localStorage),currency:progress.currency,
  receipts:(progress.rewardReceipts||[]).filter(r=>r.id===MainCampaignCore.RECEIPT).length,
  energy:progress.energy.value,training:localStorage.getItem(CampaignCore.KEY),daily:JSON.stringify(progress.daily),first:FirstPlayCore.wonProof(firstPlayState)}));
 const noOverflow=async()=>assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),"horizontal overflow");
 // Playwright tap scrolls a target into view automatically; measure BEFORE tapping.
 const visibleTarget=async selector=>{
  const geometry=await page.locator(selector).evaluate(el=>{
   const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
   return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,hit:el.contains(hit),vw:innerWidth,vh:innerHeight,scrollY};
  });
  assert.ok(geometry.x>=0&&geometry.y>=0&&geometry.right<=geometry.vw+1&&geometry.bottom<=geometry.vh+1&&geometry.width>=44&&geometry.height>=44&&geometry.hit,selector+" must be visible and tappable without scroll: "+JSON.stringify(geometry));
  assert.ok(geometry.scrollY<=1,"route/result should open at the top: "+JSON.stringify(geometry));
 };
 const routeReady=async(selector="#mainCampaignNode")=>{
  await page.locator("#mainCampaignMap").waitFor();
  await noOverflow();
  await visibleTarget(selector);
  assert.equal(await page.locator("#campaignMainContent #storyDemoOpen").count(),0);
 };
 const loadedShot=async(selector,suffix,width=1536,height=512)=>{
  await page.waitForFunction(({selector,suffix,width,height})=>{const im=document.querySelector(selector);return im?.complete&&im.naturalWidth===width&&im.naturalHeight===height&&im.getAttribute("src").endsWith(suffix)&&im.getBoundingClientRect().width>0&&im.getBoundingClientRect().height>0;},{selector,suffix,width,height},{timeout:20000});
  await page.locator(selector).evaluate(async im=>{await im.decode();await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
 };
 const fight=async(manual=false,second=false,expectedIds=["ren","art"])=>{
  // Fix only the launch seed, never combat results, clocks during play or saves.
  // A fixed legacy losing seed is not necessarily a loss under native combat.
  // Choose a real losing seed for the actual solo party in detached memory.
  // The actual browser still has to fight, lose, and preserve its wallet/proof.
  let seed=7;
  if(expectedIds.length===1){
   seed=await page.evaluate(second=>{
    const id=second?MainCampaignCore.II_ID:MainCampaignCore.ID;
    const party=selectedParty(),leaderId=selectedLeaderId;
    for(let n=7;n<407;n++){
     const b=CombatCore.createBattle([...party.map(f=>({...f})),...MainCampaignCore.enemiesFor(id,NpcEnemyData)],[],{
      combat2:FIRST_SESSION_COMBAT2,leaderId,rngSeed:n,hitChecks:true,critChecks:true,penetrationChecks:true,statusChecks:true
     });
     CombatCore.advanceToPlayerTurn(b);
     for(let i=0;i<80&&b.active;i++){
      if(!CombatCore.performAutoAction(b,AutoDecision.chooseAction(b)))throw Error("SOLO_PREFLIGHT_AUTO_FAILED");
     }
     if(!b.active&&b.winner==="enemy")return n;
    }
    return null;
   },second);
   assert.ok(Number.isInteger(seed),"Actual solo party must have a reproducible defeat fixture");
   console.log("CAMPAIGN_NATIVE_SOLO_LOSS_SEED",key,second?"II":"I",seed);
  }
  await page.evaluate(seed=>{
   const original=resetBattle;
   resetBattle=function(...args){
    const now=Date.now;
    try{Date.now=()=>seed;return original.apply(this,args);}
    finally{Date.now=now;resetBattle=original;}
   };
  },seed);
  await page.locator("#squadStart").tap();
  if(await page.locator("#squad.active").isVisible())await page.locator("#squadStart").tap();
  await page.locator("#battle.active").waitFor({timeout:30000});
  await page.waitForFunction(()=>state.active&&battleIsMainCampaign&&!visualActionPending()&&!document.querySelector("#basicAbilityBtn").disabled,null,{timeout:60000});
  const launched=await page.evaluate(()=>({allies:state.fighters.filter(f=>f.side==="ally").map(f=>f.id).sort(),enemies:state.fighters.filter(f=>f.side==="enemy").map(f=>f.id).sort(),mission:state.mainCampaignMissionId,seed:state.rng?.seed}));
  assert.deepEqual(launched.allies,[...expectedIds].sort(),"actual battle party, not only the squad UI");
  assert.deepEqual(launched.enemies,second?["npc-cam-m2-guard","npc-cam-m2-interceptor"]:["npc-cam-m1-guard","npc-cam-m1-interceptor"]);
  assert.equal(launched.mission,second?"main-cam-002-m1":"main-cam-001-m1");
  assert.equal(launched.seed,seed,"real battle must use the reproducible fixture seed");
  for(const id of await page.evaluate(()=>state.fighters.filter(f=>f.hp>0).map(f=>f.id)))await tapFighter(page,id,true);
  await page.screenshot({path:path.join(dest,key+"-"+(second?"II":"I")+"-"+(manual?"manual":"auto")+"-battle.png")});
  for(let i=0;i<2;i++)await page.locator("#autoSpeedBtn").tap();
  if(manual){
   for(let i=0;i<45;i++){
    await page.waitForFunction(()=>!state.active||(!visualActionPending()&&!isVisualTransition()&&!document.querySelector("#basicAbilityBtn").disabled),null,{timeout:30000});
    const turn=await page.evaluate(()=>({active:state.active,actions:state.allyActions,
     target:state.fighters.filter(f=>f.side==="enemy"&&f.hp>0).sort((a,b)=>a.hp+a.protection-b.hp-b.protection)[0]?.id,
     selected:state.fighters[state.selectedEnemy]?.id}));
    if(!turn.active)break;
    if(turn.target&&turn.target!==turn.selected)await tapFighter(page,turn.target);
    await page.locator("#basicAbilityBtn").tap();
    await page.waitForFunction(n=>!state.active||state.allyActions>n,turn.actions,{timeout:15000});
   }
  }else await page.locator("#autoBattleBtn").tap();
  await page.locator("#mainCampaignResult.active").waitFor({timeout:180000});
  return page.evaluate(()=>state.winner);
 };
 try{
  await page.goto(url,{waitUntil:"load",timeout:60000});await ready();
  assert.equal(await page.locator("#hqFirstSessionAction").isVisible(),false,"developer bypass must not create an onboarding quest");
  assert.deepEqual(await page.evaluate(()=>ALLIES.filter(h=>heroOwned(h.id)).map(h=>h.id).sort()),["art","ren"]);
  await showMap();
  await routeReady();assert.equal(await page.locator("#mainCampaignNext").isDisabled(),true);await visibleTarget("#mainCampaignMapPin");await loadedShot("#mainCampaignSceneArt","warehouse-conflict.webp");await page.screenshot({path:path.join(dest,key+"-locked.png")});
  assert.match(await page.locator("#mainCampaignBrief").innerText(),/Мастер просит сохранить снятый крепёж/);
  assert.doesNotMatch(await page.locator("#mainCampaignBrief").innerText(),/спасли|эвакуировали|Крепёж сохранён/);
  const before=await inspect();assert.equal(before.proof.best,0);assert.equal(before.receipts,0);assert.equal(before.first,false);
  await page.locator("#mainCampaignMapPin").tap();
  await page.locator("#squadBack").tap();await routeReady();
  await page.locator("#mainCampaignNode").tap();
  await page.locator("#squadDisband").tap();
  await page.locator('#squadRoster .squad-choice[data-hero-id="art"]').tap();
  assert.match(await page.locator("#squadIntro").innerText(),/Один герой — риск поражения/);
  assert.equal(await page.locator("#squadStart").isEnabled(),true,"advice is not a mandatory lock");
  await visibleTarget("#squadStart");
  assert.equal(await fight(false,false,["art"]),"enemy","one starter vs two NPCs");
  assert.equal((await inspect()).proof.best,0);assert.equal((await inspect()).currency,before.currency);
  assert.equal(await page.locator("#mainCampaignResultClaim").isVisible(),false);
  assert.equal(await page.locator("#mainCampaignResultReward").isVisible(),false);
  assert.equal(await page.locator("#mainCampaignResultArt").isVisible(),false,"no victory shot on defeat");
  assert.doesNotMatch(await page.locator("#mainCampaignResultText").innerText(),/Крепёж сохранён|следующий пункт доставки/);
  await visibleTarget("#mainCampaignResultBack");await visibleTarget("#mainCampaignResultRetry");
  await page.locator("#mainCampaignResultRetry").tap();
  await page.locator("#squadDisband").tap();
  for(const id of ["ren","art"])await page.locator('#squadRoster .squad-choice[data-hero-id="'+id+'"]').tap();
  assert.match(await page.locator("#squadIntro").innerText(),/Рен — атака, Арт — прикрытие/);
  await visibleTarget("#squadStart");
  await page.screenshot({path:path.join(dest,key+"-squad.png")});
  assert.equal(await fight(true),"ally","manual basic attacks with the two fresh starters");
  assert.match(await page.locator("#mainCampaignResultText").innerText(),/Крепёж сохранён для проверки/);
  assert.match(await page.locator("#mainCampaignResultText").innerText(),/следующий пункт доставки/);
  const won=await inspect();assert.ok(won.proof.best>0);assert.equal(won.currency,before.currency);assert.equal(won.receipts,0);
  await noOverflow();await visibleTarget("#mainCampaignResultClaim");await visibleTarget("#mainCampaignResultBack");
  assert.match(await page.locator("#mainCampaignResultRewardAmount").innerText(),/40/);
  await loadedShot("#mainCampaignResultArt img","warehouse-proof.webp");
  await visibleTarget("#mainCampaignResultRetry");
  await page.screenshot({path:path.join(dest,key+"-victory.png")});
  // Reload BEFORE claiming. Proof survives and the next path is still locked.
  await page.reload({waitUntil:"load",timeout:60000});await ready();await showMap();
  assert.equal((await inspect()).proof.best,won.proof.best);
  assert.match(await page.locator("#mainCampaignBrief").innerText(),/Крепёж сохранён/);
  await loadedShot("#mainCampaignSceneArt","warehouse-proof.webp");
  assert.equal(await page.locator("#mainCampaignNext").getAttribute("data-unlocked"),"false");
  await routeReady("#mainCampaignClaim");
  await page.locator("#mainCampaignClaim").tap();
  await page.waitForFunction(()=>MainCampaignCore.claimed(progress)&&!mainCampaignClaiming,null,{timeout:20000});
  const paid=await inspect();assert.equal(paid.currency,before.currency+40);assert.equal(paid.receipts,1);
  assert.equal(await page.locator("#mainCampaignNext").getAttribute("data-unlocked"),"true");
  await routeReady();await page.screenshot({path:path.join(dest,key+"-unlocked.png")});
  await page.locator("#mainCampaignNode").tap();
  assert.equal(await fight(),"ally");
  assert.equal(await page.locator("#mainCampaignResultClaim").isVisible(),false);
  await visibleTarget("#mainCampaignResultBack");
  await page.locator("#mainCampaignResultBack").tap();await routeReady();
  const after=await inspect();assert.equal(after.currency,paid.currency);assert.equal(after.receipts,1);
  assert.equal(after.energy,before.energy);assert.equal(after.training,before.training);assert.equal(after.first,false);
  assert.ok(after.proof.best>=won.proof.best);
  await page.reload({waitUntil:"load",timeout:60000});await ready();await showMap();
  assert.equal((await inspect()).receipts,1);
  assert.equal(await page.locator("#mainCampaignClaim").isVisible(),false);
  assert.equal(await page.locator("#mainCampaignNext").getAttribute("data-unlocked"),"true");
  const inspectII=()=>page.evaluate(()=>({proof:MainCampaignCore.proofFor(MainCampaignCore.II_ID,()=>localStorage),
   status:MainCampaignCore.statusFor(MainCampaignCore.II_ID,()=>localStorage,progress),
   receipts:(progress.rewardReceipts||[]).filter(r=>r.id===MainCampaignCore.mission(MainCampaignCore.II_ID).receipt).length,
   rank:StarCore.rankOf(progress,"nada"),heroes:ALLIES.filter(h=>heroOwned(h.id)).map(h=>h.id).sort(),
   currency:progress.currency,energy:progress.energy.value,m1:MainCampaignCore.load(()=>localStorage).best}));
  const iiBefore=await inspectII();assert.equal(iiBefore.status,"ready");assert.equal(iiBefore.rank,0);
  await visibleTarget("#mainCampaignNext");await page.locator("#mainCampaignNext").tap();await routeReady();
  assert.equal(await page.locator("#mainCampaignMap").getAttribute("data-mission"),"II");
  assert.match(await page.locator("#mainCampaignBrief").innerText(),/Защитите его/);
  await loadedShot("#mainCampaignSceneArt","m2/shelter-conflict.webp",1152,384);
  await visibleTarget("#mainCampaignNode");await visibleTarget("#mainCampaignNext");
  await page.screenshot({path:path.join(dest,key+"-II-map.png")});
  await page.locator("#mainCampaignNode").tap();
  if(viewport.height===320){
   await page.locator("#squadDisband").tap();
   await page.locator('#squadRoster .squad-choice[data-hero-id="art"]').tap();
   assert.equal(await fight(false,true,["art"]),"enemy","actual solo defeat fixture in chapter II");
   assert.equal((await inspectII()).proof.best,0);assert.equal((await inspectII()).rank,0);
   assert.equal(await page.locator("#mainCampaignResultClaim").isVisible(),false);
   assert.equal(await page.locator("#mainCampaignResultArt").isVisible(),false,"II defeat must not show the witness");
   assert.doesNotMatch(await page.locator("#mainCampaignResultText").innerText(),/Рабочий свободен|Нада предлагает/);
   await page.locator("#mainCampaignResultRetry").tap();
  }
  await page.locator("#squadDisband").tap();
  for(const id of ["ren","art"])await page.locator('#squadRoster .squad-choice[data-hero-id="'+id+'"]').tap();
  assert.equal(await page.locator('#squadRoster .squad-choice[data-hero-id="nada"]').isEnabled(),false,"no guest Nada");
  assert.equal(await fight(true,true),"ally","real manual victory with fresh two heroes");
  assert.match(await page.locator("#mainCampaignResultText").innerText(),/Рабочий свободен/);
  await loadedShot("#mainCampaignResultArt img","m2/shelter-witness.webp",1152,384);
  await noOverflow();await visibleTarget("#mainCampaignResultRetry");
  await visibleTarget("#mainCampaignResultClaim");await visibleTarget("#mainCampaignResultBack");
  await page.screenshot({path:path.join(dest,key+"-II-victory.png")});
  const iiWon=await inspectII();assert.equal(iiWon.status,"claimable");assert.ok(iiWon.proof.best>0);assert.equal(iiWon.rank,0);
  await page.reload({waitUntil:"load",timeout:60000});await ready();await showMap();
  assert.equal((await inspectII()).status,"claimable");
  await page.locator("#mainCampaignNext").tap();await routeReady("#mainCampaignClaim");
  await loadedShot("#mainCampaignSceneArt","m2/shelter-witness.webp",1152,384);
  assert.match(await page.locator("#mainCampaignClaim").innerText(),/Принять Наду/);
  await page.locator("#mainCampaignClaim").tap();
  await page.waitForFunction(()=>!mainCampaignClaiming&&heroOwned("nada"),null,{timeout:20000});
  const iiPaid=await inspectII();assert.equal(iiPaid.status,"claimed");assert.equal(iiPaid.rank,1);assert.equal(iiPaid.receipts,1);
  assert.deepEqual(iiPaid.heroes,["art","nada","ren"]);assert.equal(iiPaid.currency,iiBefore.currency);
  assert.equal(iiPaid.energy,iiBefore.energy);assert.equal(iiPaid.m1,iiBefore.m1);
  assert.match(await page.locator("#mainCampaignNotice").innerText(),/глава III готовится/);
  await page.locator("#mainCampaignNode").tap();
  assert.equal(await page.locator('#squadRoster .squad-choice[data-hero-id="nada"]').isEnabled(),true);
  if(viewport.height===320){
   await page.locator("#squadDisband").tap();
   for(const id of ["ren","art","nada"])await page.locator('#squadRoster .squad-choice[data-hero-id="'+id+'"]').tap();
   assert.equal(await fight(false,true,["ren","art","nada"]),"ally");
   await loadedShot("#mainCampaignResultArt img","m2/shelter-witness.webp",1152,384);
   assert.equal(await page.locator("#mainCampaignResultClaim").isVisible(),false);
   await page.locator("#mainCampaignResultBack").tap();
   assert.equal((await inspectII()).receipts,1);
  }else await page.locator("#squadBack").tap();
  await page.reload({waitUntil:"load",timeout:60000});await ready();await showMap();
  assert.equal((await inspectII()).rank,1);assert.equal((await inspectII()).receipts,1);
  assert.equal(await page.locator("#mainCampaignMap").getAttribute("data-mission"),"I");
  await loadedShot("#mainCampaignSceneArt","m1/warehouse-proof.webp");
  await page.locator("#mainCampaignNext").tap();await routeReady();
  await loadedShot("#mainCampaignSceneArt","m2/shelter-witness.webp",1152,384);
  assert.equal(await page.locator("#mainCampaignClaim").isVisible(),false);
  await noOverflow();assert.deepEqual(errors,[]);
  console.log("CAM001B_AND_CAM002B_BROWSER_PASS",key,after,await inspectII());
 }catch(error){console.error("CAM001B_BROWSER_FAIL",key,errors);await page.screenshot({path:path.join(dest,key+"-fail.png"),fullPage:true}).catch(()=>{});throw error;}
 finally{await browser.close();}
}
(async()=>{for(const [name,type] of [["chromium",chromium],["webkit",webkit]])for(const viewport of [{width:844,height:390},{width:932,height:430},{width:844,height:320}])await run(name,type,viewport);})().catch(e=>{console.error(e);process.exitCode=1;});
