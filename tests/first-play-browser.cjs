"use strict";
// FIRSTPLAY001: actual first boot, normal controls, recovery and confirmed debug reset.
// Chromium/WebKit emulation is not a physical iPhone Safari test.
const {chromium,webkit}=require("playwright");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
const dest=path.join(process.cwd(),"artifacts","squad-recovery","first-play");
fs.mkdirSync(dest,{recursive:true});
// Read-only projection and picking identify a real tappable point on the canvas.
// The touchscreen tap itself follows the same pointer path as a player's tap.
async function tapFighter(page,id){
 const point=await page.evaluate(id=>{
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
  return null;
 },id);
 assert.ok(point,"real visible pickable canvas point for "+id);
 await page.touchscreen.tap(point.x,point.y);
}
async function manualFirstBattle(page,label){
 const special=page.locator("#specialAbilityBtn"),basic=page.locator("#basicAbilityBtn"),hint=page.locator("#actionHint");
 const seen=new Set();
 let steps=0;
 while(await page.evaluate(()=>state.active)&&steps++<20){
  await page.waitForFunction(()=>!state.active||(!visualActionPending()&&!isVisualTransition()&&
   !document.querySelector("#basicAbilityBtn").disabled),null,{timeout:30000});
  const turn=await page.evaluate(()=>({active:state.active,id:state.fighters[state.currentActor]?.id,actions:state.allyActions}));
  if(!turn.active)break;
  const first=!seen.has(turn.id);
  if(first){
   assert.match(await hint.innerText(),/Выберите способность/);
   assert.ok(await special.evaluate(n=>n.classList.contains("fp-recommended")));
   if(turn.id==="art"){
    await special.tap();
    assert.match(await hint.innerText(),/Коснитесь Рена/);
    assert.equal(await page.evaluate(()=>state.allyActions),turn.actions);
    await tapFighter(page,"art"); // illegal self target
    assert.equal(await page.evaluate(()=>state.allyActions),turn.actions);
    await special.tap(); // cancel without consuming the turn
    assert.equal(await page.evaluate(()=>selectedAbility),"basic");
    assert.equal(await page.evaluate(()=>state.allyActions),turn.actions);
    await special.tap();
    await tapFighter(page,"ren");
    await page.waitForFunction(n=>state.allyActions>n,turn.actions,{timeout:10000});
   }else{
    const other=await page.evaluate(()=>state.fighters.find((f,i)=>f.side==="enemy"&&f.hp>0&&i!==state.selectedEnemy)?.id);
    if(other){
     await tapFighter(page,other);
     assert.equal(await page.evaluate(()=>state.fighters[state.selectedEnemy]?.id),other);
     assert.equal(await page.evaluate(()=>state.allyActions),turn.actions);
    }
    if(label==="webkit")await basic.tap(); // suggested skill is not mandatory
    else await special.tap();
   }
   seen.add(turn.id);
  }else{
   assert.equal(await special.evaluate(n=>n.classList.contains("fp-recommended")),false);
   await basic.tap();
  }
  await page.waitForFunction(n=>!state.active||state.allyActions>n,turn.actions,{timeout:15000});
 }
 return page.evaluate(()=>({active:state.active,winner:state.winner,phase:firstPlayState.phase,steps:state.allyActions}));
}
async function run(label,engine,viewport){
 const browser=await engine.launch(engine===chromium?{
  headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader",
   "--enable-webgl","--disable-dev-shm-usage"]
 }:{headless:true});
 const page=await browser.newPage({viewport,hasTouch:true,reducedMotion:"reduce"});
 const errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 try{
  await page.goto(origin,{waitUntil:"load",timeout:60000});
  await page.waitForFunction(()=>typeof FirstPlayCore!=="undefined"&&
   typeof showScreen==="function"&&
   document.querySelector("#walletWriterNotice")?.style.display==="none",null,{timeout:60000});
  await page.locator("#firstPlay.active").waitFor({state:"visible",timeout:12000});
  assert.equal(await page.locator("#loginCalendar").evaluate(n=>n.classList.contains("active")),false);
  const bounds=await page.evaluate(()=>({
   overflow:document.documentElement.scrollWidth>innerWidth+1,
   scene:(()=>{const r=document.querySelector("#firstPlayStory").getBoundingClientRect();
    return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}})(),
   height:innerHeight,width:innerWidth
  }));
  assert.equal(bounds.overflow,false,label+": no horizontal overflow");
  assert.ok(bounds.scene.left>=0&&bounds.scene.right<=bounds.width+1&&
   bounds.scene.top>=0&&bounds.scene.bottom<=bounds.height+1,
   label+": story viewport within landscape screen");
  const next=page.locator("#firstPlayStoryNext"),pause=page.locator("#firstPlayStoryPause");
  await page.waitForFunction(()=>document.querySelector("#firstPlayStoryImage")?.naturalWidth>=1600,null,{timeout:12000});
  assert.equal(await pause.getAttribute("aria-pressed"),"true",label+": reduced motion defaults to manual reading");
  assert.equal(await page.locator("#firstPlayStorySpeaker").textContent(),"РАБОЧИЙ");
  assert.equal(await page.locator("#firstPlayStoryChoices").isVisible(),false);
  assert.equal(await page.locator("#firstPlayStoryFight").isVisible(),false);
  // Autoplay, suspension on a hidden document, and explicit pause.
  if(label==="chromium"){
   await pause.click();
   await page.evaluate(()=>{Object.defineProperty(document,"visibilityState",{configurable:true,value:"hidden"});document.dispatchEvent(new Event("visibilitychange"));});
   await page.waitForTimeout(4200);
   assert.equal(await page.locator("#firstPlayStorySpeaker").textContent(),"РАБОЧИЙ");
   await page.evaluate(()=>{delete document.visibilityState;document.dispatchEvent(new Event("visibilitychange"));});
   await page.waitForFunction(()=>document.querySelector("#firstPlayStorySpeaker").textContent==="МАСТЕР УЧАСТКА",null,{timeout:10000});
   await pause.click();
  }else await next.click();
  assert.equal(await page.locator("#firstPlayStorySpeaker").textContent(),"МАСТЕР УЧАСТКА");
  assert.match(await page.locator("#firstPlayStoryCue").innerText(),/охранник/);
  await page.reload({waitUntil:"load",timeout:60000});
  await page.locator("#firstPlay.active").waitFor({state:"visible",timeout:30000});
  assert.equal(await page.locator("#firstPlayStorySpeaker").textContent(),"МАСТЕР УЧАСТКА");
  await next.dblclick();
  assert.equal(await page.locator("#firstPlayStorySpeaker").textContent(),"АРТ");
  await page.waitForTimeout(400);
  await next.click();
  assert.equal(await page.locator("#firstPlayStorySpeaker").textContent(),"РЕН ТЕРЕН");
  assert.match(await page.locator("#firstPlayStoryContext").innerText(),/командуете.*Прикройте/);
  assert.equal(await page.locator("#firstPlayStoryChoices").isVisible(),false);
  assert.equal(await page.locator("#firstPlayStoryFight").isVisible(),true);
  await page.screenshot({path:path.join(dest,label+"-handoff.png")});
  const choice=label==="chromium"?"survey":label==="webkit"?"cover":"neutral";
  if(choice!=="neutral"){
   // Restore a real v1 legacy checkpoint rather than offering a new bonus choice.
   await page.evaluate(choice=>localStorage.setItem(FirstPlayCore.KEY,JSON.stringify({version:1,phase:"ready",choice})),choice);
   await page.reload({waitUntil:"load",timeout:60000});
   await page.locator("#firstPlay.active").waitFor({state:"visible",timeout:30000});
   assert.equal(await page.locator("#firstPlayStoryOrderSignal").isVisible(),true);
   assert.match(await page.locator("#firstPlayStoryContext").innerText(),choice==="survey"?/Арт.*30.*скорости/:/Рен.*Protection/);
   await page.locator("#firstPlayStoryFight").click();
  }else{
   // The final shot's own command enters the real neutral encounter.
   await page.locator("#firstPlayStoryFight").click();
  }
  await page.locator("#battle.active").waitFor({state:"visible",timeout:60000});
  const detail=await page.evaluate(()=>({
   lineup:state.fighters.map(f=>({id:f.id,hp:f.hp,speed:f.speed})),
   tactical:state.tacticalObjective,
   wallet:localStorage.getItem("ashes-throne.progress.v3"),
   choice:JSON.parse(localStorage.getItem(FirstPlayCore.KEY)).choice
  }));
  assert.deepEqual(detail.lineup.map(f=>f.id),["art","ren","npc-first-guard","npc-first-interceptor"]);
  assert.equal(detail.tactical.kind,"hold-or-defeat");
  assert.equal(await page.locator("#tacticalGoalToggle").getAttribute("aria-expanded"),"true");
  assert.equal(await page.locator("#tacticalGoalText").isVisible(),true);
  assert.match(await page.locator("#tacticalGoalText").innerText(),/6 действий союзников/);
  assert.match(await page.locator("#tacticalGoalCounter").innerText(),/0\/6 · эвакуация/);
  await page.locator("#tacticalGoalToggle").click();
  assert.equal(await page.locator("#tacticalGoalToggle").getAttribute("aria-expanded"),"false");
  await page.locator("#tacticalGoalToggle").click();
  assert.equal(await page.locator("#tacticalGoalToggle").getAttribute("aria-expanded"),"true");
  assert.equal(detail.choice,choice);
  if(choice==="survey")assert.ok(detail.lineup[0].speed>118,label+": survey bonus changes combat speed");
  else if(choice==="cover")assert.ok(await page.evaluate(()=>state.fighters.find(f=>f.id==="ren").protection>=35),
   label+": cover order changes Ren protection");
  await page.screenshot({path:path.join(dest,label+"-"+viewport.width+"x"+viewport.height+"-battle.png")});
  // Real manual taps, including target/cancel and an alternative ability.
  // Accelerate subsequent animations with the existing user control.
  await page.locator("#autoSpeedBtn").tap();
  await page.locator("#autoSpeedBtn").tap();
  const result=await manualFirstBattle(page,label);
  assert.equal(result.active,false,label+": battle must end through combat rules: "+JSON.stringify(result));
  await page.locator("#firstPlay.active").waitFor({state:"visible",timeout:30000});
  // If enemy wins, user can retry. Never show a fictitious success.
  if(result.winner==="enemy"){
   assert.equal(await page.evaluate(()=>firstPlayState.phase),"ready");
   assert.equal(await page.locator("#firstPlayStoryFinish").isVisible(),false);
   assert.equal(await page.locator("#firstPlayStoryFight").isVisible(),true);
   // Only for test cleanup: the hidden legacy whole-flow skip remains intentional
   // infrastructure; the user-visible Skip never bypasses the actual encounter.
   await page.evaluate(()=>document.querySelector("#firstPlaySkip").click());
  }else{
   assert.equal(await page.evaluate(()=>firstPlayState.phase),"won");
   assert.equal(await page.locator("#firstPlayStoryFinish").isVisible(),false);
   assert.equal(await page.locator("#firstPlayStorySpeaker").textContent(),
    choice==="cover"?"РЕН ТЕРЕН":"АРТ");
   if(choice!=="neutral")assert.match(await page.locator("#firstPlayStoryContext").innerText(),/Эффект вашего приказа/);
   else assert.doesNotMatch(await page.locator("#firstPlayStoryContext").innerText(),/Эффект вашего приказа/);
   await page.locator("#firstPlayStoryNext").click();
   assert.equal(await page.locator("#firstPlayStorySpeaker").textContent(),"МАСТЕР УЧАСТКА");
   assert.match(await page.locator("#firstPlayStoryLine").innerText(),/безопасен/);
   assert.match(await page.locator("#firstPlayStoryLine").innerText(),/снять крепления/);
   assert.equal(await page.locator("#firstPlayStoryCue").isVisible(),true);
   assert.match(await page.locator("#firstPlayStoryContext").innerText(),/установить источник распоряжения/);
   assert.doesNotMatch(await page.locator("#firstPlayStoryContext").innerText(),/Эффект вашего приказа/);
   assert.equal(await page.locator("#firstPlayStoryFinish").isVisible(),true);
   await page.locator("#firstPlayStoryFinish").click();
  }
  await page.locator("#home.active").waitFor({state:"visible",timeout:12000});
  assert.equal(await page.locator("#loginCalendar.active").count(),0,
   label+": no automatic calendar interruption after first play");
  await page.evaluate(()=>document.dispatchEvent(new Event("visibilitychange")));
  assert.equal(await page.locator("#loginCalendar.active").count(),0,
   label+": returning focus must not interrupt first-session HQ");
  await page.locator('#home .hq-quick-actions [data-screen="loginCalendar"]').click();
  await page.locator("#loginCalendar.active").waitFor({state:"visible",timeout:12000});
  await page.locator('#loginCalendar [data-screen="home"]').click();
  await page.locator("#home.active").waitFor({state:"visible",timeout:12000});
  assert.equal(await page.locator("#hqFirstPlayCard").count(),0,
   label+": completed operation must not cover HQ");
  const cta=page.locator("#hqFirstSessionAction");
  assert.equal(await cta.isVisible(),result.winner==="ally");
  if(result.winner==="ally"){
   const rect=await cta.boundingBox();
   assert.ok(rect&&rect.height>=44&&rect.x>=0&&rect.x+rect.width<=viewport.width+1&&rect.y+rect.height<=viewport.height+1);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
   const beforeReward=await page.evaluate(()=>({currency:progress.currency,xp:progress.accountXp}));
   assert.match(await cta.innerText(),/Забрать награду/);
   await cta.tap();
   await page.waitForFunction(()=>FirstPlayCore.rewardClaimed(progress)&&!firstSessionClaiming,null,{timeout:15000});
   assert.equal(await page.evaluate(()=>progress.currency),beforeReward.currency+40);
   assert.equal(await page.evaluate(()=>progress.accountXp),beforeReward.xp);
   assert.equal(await page.evaluate(()=>progress.rewardReceipts.filter(r=>r.id===FirstPlayCore.REWARD_RECEIPT).length),1);
   assert.match(await cta.innerText(),/Усилить Рена/);
   await cta.tap();
   await page.locator("#heroDetail.active").waitFor({state:"visible",timeout:30000});
   assert.equal(await page.evaluate(()=>selectedHeroId),"ren");
   const beforeLevel=await page.evaluate(()=>progressedHero(ALLIES.find(h=>h.id==="ren")).level);
   const beforeStats=await page.evaluate(()=>{const h=progressedHero(ALLIES.find(h=>h.id==="ren"));return {hp:h.maxHp??h.hp,attack:h.physicalAttack??h.atk};});
   await page.locator("#detailUpgrade").tap();
   await page.waitForFunction(()=>progress.levels.ren===2,null,{timeout:15000});
   assert.equal(beforeLevel,1);
   const afterStats=await page.evaluate(()=>{const h=progressedHero(ALLIES.find(h=>h.id==="ren"));return {hp:h.maxHp??h.hp,attack:h.physicalAttack??h.atk};});
   assert.ok(afterStats.hp>beforeStats.hp||afterStats.attack>beforeStats.attack,"real stat increase");
   if(await page.locator("#gearPromotionDialog").evaluate(n=>n.open))await page.locator("#gearPromotionClose").tap();
   await page.locator("#detailHome").tap();
   await page.locator("#home.active").waitFor({state:"visible"});
   assert.match(await cta.innerText(),/По следу/);
   const wallet=await page.evaluate(()=>({currency:progress.currency,xp:progress.accountXp}));
   assert.equal(wallet.currency,beforeReward.currency+1);
   await cta.tap();
   await page.locator("#operations.active").waitFor({state:"visible"});
   await page.locator("[data-ops-new]").tap();
   assert.equal(await page.evaluate(()=>operationProgress.active.operationId),"first-report-02");
   await page.locator('[data-ops-order="register"]').tap();
   assert.equal(await page.evaluate(()=>operationProgress.active.orders[0]),"register");
   await page.locator("#opsFirstSessionHome").tap();
   await page.locator("#home.active").waitFor({state:"visible"});
   assert.match(await cta.innerText(),/Продолжить/);
   assert.deepEqual(await page.evaluate(()=>({currency:progress.currency,xp:progress.accountXp})),wallet);
   await page.screenshot({path:path.join(dest,label+"-"+viewport.width+"x"+viewport.height+"-hq-next.png")});
   await page.reload({waitUntil:"load",timeout:60000});
   await page.waitForFunction(()=>typeof firstPlayState!=="undefined"&&typeof firstSessionFollowUp==="function",null,{timeout:60000});
   if(await page.locator("#loginCalendar.active").count())await page.locator('#loginCalendar [data-screen="home"]').click();
   await page.locator("#home.active").waitFor({state:"visible",timeout:30000});
   assert.match(await cta.innerText(),/Продолжить/);
   assert.equal(await page.evaluate(()=>progress.levels.ren),2);
   assert.equal(await page.evaluate(()=>progress.rewardReceipts.filter(r=>r.id===FirstPlayCore.REWARD_RECEIPT).length),1);
   assert.deepEqual(await page.evaluate(()=>({currency:progress.currency,xp:progress.accountXp})),wallet);
   await cta.tap();
   await page.locator("#operations.active").waitFor({state:"visible"});
   assert.equal(await page.evaluate(()=>operationProgress.active.orders[0]),"register");
   assert.equal(await page.evaluate(()=>operationProgress.active.operationId),"first-report-02");
   if(label==="chromium"){
    // Complete the real second operation with ordinary player inputs.
    await page.locator('[data-ops-order="observe"]').tap();
    const mark=await page.locator("#opsAuthentic").innerText();
    const north=await page.locator("#opsNorthMark").innerText();
    await page.locator(mark===north?"#opsNorth":"#opsSouth").tap();
    await page.locator("#squad.active").waitFor({state:"visible",timeout:30000});
    await page.locator("#squadStart").tap();
    await page.locator("#battle.active").waitFor({state:"visible",timeout:60000});
    assert.equal(await page.evaluate(()=>state.fighters.find(f=>f.id==="ren")?.level),2);
    await page.locator("#autoSpeedBtn").tap();await page.locator("#autoSpeedBtn").tap();
    for(let i=0;i<70&&await page.evaluate(()=>state.active);i++){
     await page.waitForFunction(()=>!state.active||(!visualActionPending()&&!isVisualTransition()&&
      !document.querySelector("#basicAbilityBtn").disabled),null,{timeout:30000});
     if(!await page.evaluate(()=>state.active))break;
     const actions=await page.evaluate(()=>state.allyActions);
     await page.locator("#basicAbilityBtn").tap();
     await page.waitForFunction(n=>!state.active||state.allyActions>n,actions,{timeout:15000});
    }
    assert.equal(await page.evaluate(()=>state.winner),"ally");
    await page.locator("#operations.active").waitFor({state:"visible",timeout:30000});
    await page.locator('[data-ops-finish="ledger"]').tap();
    await page.locator("#operationResult.active").waitFor({state:"visible"});
    assert.match(await page.locator("#operationResultText").innerText(),/нет имени отправителя/);
    assert.equal(await page.evaluate(()=>operationProgress.history.at(-1).operationId),"first-report-02");
    assert.equal(await page.evaluate(()=>operationProgress.history.at(-1).ledgerSecured),true);
    assert.equal(await page.locator("#operationResultNetwork").isVisible(),true);
    await page.screenshot({path:path.join(dest,"p1b-real-operation-result.png")});
    await page.locator("#operationResultNetwork").tap();
    await page.locator("#network.active").waitFor({state:"visible"});
    await page.evaluate(()=>showScreen("home")); // return check; all mission actions above used real taps
    await page.locator("#home.active").waitFor({state:"visible"});
    assert.equal(await cta.isVisible(),false);
   }else{
    await page.locator("#opsFirstSessionHome").tap();
    await page.locator("#home.active").waitFor({state:"visible"});
   }
  }
  await page.locator("#hqMoreToggle").click();
  await page.locator("#home .hq-test-menu summary").click();
  await page.locator("#devStartOver").click();
  assert.equal(await page.locator("#devRestartDialog").evaluate(n=>n.open),true);
  await page.locator("#devRestartCancel").click();
  assert.equal(await page.locator("#devRestartDialog").evaluate(n=>n.open),false);
  assert.ok(await page.evaluate(()=>localStorage.getItem(FirstPlayCore.KEY)!==null));
  await page.locator("#hqMoreToggle").click();
  if(!(await page.locator("#home .hq-test-menu").evaluate(n=>n.open)))
   await page.locator("#home .hq-test-menu summary").click();
  await page.locator("#devStartOver").click();
  await page.locator("#devRestartConfirm").click();
  await page.waitForFunction(()=>document.querySelector("#firstPlay")?.classList.contains("active")
   &&typeof FirstPlayCore!=="undefined"&&
   JSON.parse(localStorage.getItem(FirstPlayCore.KEY)||"null")?.phase==="briefing"
   &&JSON.parse(localStorage.getItem(FirstPlayCore.KEY)||"null")?.choice===null,
   null,{timeout:60000});
  assert.equal(await page.locator("#firstPlayStoryChoices").isVisible(),false);
  assert.equal(await page.locator("#firstPlayStoryFight").isVisible(),false);
  assert.equal(await page.locator("#firstPlayStoryNext").isVisible(),true);
  const control=await page.locator("#firstPlayStoryNext").boundingBox();
  assert.ok(control&&control.y+control.height<=viewport.height+1,
   label+": dialogue and next button must stay within landscape screen");
  assert.equal(await page.locator("#firstPlayStorySpeaker").textContent(),"РАБОЧИЙ");
  assert.equal(await page.evaluate(()=>localStorage.getItem("ashes-throne.campaign.v1")),null);
  if(choice==="neutral"){
   // A fresh restart offers the same neutral encounter through Skip.
   await page.locator("#firstPlayStorySkip").click();
   await page.locator("#battle.active").waitFor({state:"visible",timeout:60000});
   assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem(FirstPlayCore.KEY))),
    {version:1,phase:"battle",choice:"neutral"});
   assert.equal(await page.locator("#tacticalGoalText").isVisible(),true);
   // Reload while a real battle is in progress: recover at the ready checkpoint,
   // never falsely mark the operation won or reuse the taught-actor flags.
   await page.reload({waitUntil:"load",timeout:60000});
   await page.locator("#firstPlay.active").waitFor({state:"visible",timeout:30000});
   assert.equal(await page.evaluate(()=>firstPlayState.phase),"ready");
   await page.locator("#firstPlayStoryFight").tap();
   await page.locator("#battle.active").waitFor({state:"visible",timeout:60000});
   await page.waitForFunction(()=>!visualActionPending()&&!document.querySelector("#basicAbilityBtn").disabled,null,{timeout:30000});
   assert.match(await page.locator("#actionHint").innerText(),/Выберите способность/);
   // Test-only adverse combat fixture: weaken Ren, strengthen enemies, guarantee
   // hits. Do NOT assign winner/phase or invoke a synthetic outcome. Real manual
   // taps and the ordinary enemy AI must produce defeat through CombatCore.
   await page.evaluate(()=>{
    const ren=state.fighters.find(f=>f.id==="ren");
    ren.hp=1;ren.protection=0;
    state.hitChecks=false;
    for(const f of state.fighters.filter(f=>f.side==="enemy")){
     f.hp=f.maxHp=10000;f.atk=f.physicalAttack=1000;f.assaultFocus=true;
    }
    syncBattleUI();
   });
   for(let i=0;i<6&&await page.evaluate(()=>state.active);i++){
    await page.waitForFunction(()=>!state.active||(!visualActionPending()&&!document.querySelector("#basicAbilityBtn").disabled),null,{timeout:30000});
    if(await page.evaluate(()=>state.active))await page.locator("#basicAbilityBtn").tap();
   }
   assert.equal(await page.evaluate(()=>state.winner),"enemy");
   await page.locator("#firstPlay.active").waitFor({state:"visible",timeout:30000});
   assert.equal(await page.evaluate(()=>firstPlayState.phase),"ready");
   assert.equal(await page.locator("#firstPlayStoryFinish").isVisible(),false);
   assert.match(await page.locator("#firstPlayStoryFight").innerText(),/Повторить бой/);
   await page.locator("#firstPlayStoryFight").tap();
   await page.locator("#battle.active").waitFor({state:"visible",timeout:60000});
   await page.waitForFunction(()=>!visualActionPending()&&!document.querySelector("#basicAbilityBtn").disabled,null,{timeout:30000});
   assert.ok(await page.evaluate(()=>state.fighters.find(f=>f.id==="ren").hp>1));
   assert.match(await page.locator("#actionHint").innerText(),/Выберите способность/);
   const auto=page.locator("#autoBattleBtn");
   await auto.tap();
   assert.equal(await auto.getAttribute("aria-pressed"),"true");
   assert.equal(await page.locator("#specialAbilityBtn").evaluate(n=>n.classList.contains("fp-recommended")),false);
   await auto.tap();
   assert.equal(await auto.getAttribute("aria-pressed"),"false");
   await page.waitForFunction(()=>!state.active||!document.querySelector("#basicAbilityBtn").disabled,null,{timeout:30000});
  }
  assert.deepEqual(errors,[]);
  console.log("FIRSTSESSIONP1B "+label+" "+viewport.width+"x"+viewport.height+
   " verified; battle: "+result.winner+" in "+result.steps+" actions");
 }finally{await browser.close();}
}
(async()=>{
 await run("chromium",chromium,{width:844,height:390});
 await run("webkit",webkit,{width:932,height:430});
 await run("chromium-short",chromium,{width:844,height:320});
})().catch(error=>{console.error(error);process.exitCode=1;});
