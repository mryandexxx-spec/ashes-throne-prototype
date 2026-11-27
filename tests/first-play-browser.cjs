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
async function probeBattleTargets(page){
 await page.waitForFunction(()=>state.active&&!visualActionPending()&&!isVisualTransition()&&!document.querySelector("#basicAbilityBtn").disabled,null,{timeout:60000});
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const ids=await page.evaluate(()=>state.fighters.filter(f=>f.hp>0).map(f=>f.id));
 for(const id of ids)await tapFighter(page,id,true);
 const overlaps=await page.evaluate(()=>{
  const goal=document.querySelector("#tacticalGoalCard");
  if(!goal||goal.hidden)return [];
  const g=goal.getBoundingClientRect(),intersects=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
  const clashes=[];
  for(const [id,node] of Object.entries(indicatorNodes)){
   if(getComputedStyle(node).display==="none")continue;
   const n=node.getBoundingClientRect();
   if(n.width&&n.height&&intersects(g,n))clashes.push({id,goal:[g.x,g.y,g.width,g.height],label:[n.x,n.y,n.width,n.height]});
  }
  for(const el of document.querySelectorAll("#battleMenuBtn,#autoBattleBtn,#autoSpeedBtn,#battleLog summary")){
   const n=el.getBoundingClientRect();
   if(n.width&&n.height&&intersects(g,n))clashes.push(el.id||el.tagName);
  }
  const canvas=document.querySelector("#renderCanvas"),rect=canvas.getBoundingClientRect();
  const width=engine.getRenderWidth(),height=engine.getRenderHeight(),vp=arenaCamera.viewport.toGlobal(width,height);
  for(const f of state.fighters.filter(f=>f.hp>0)){
   const head=meshes[f.id]?.head;
   if(!head)continue;
   const p=BABYLON.Vector3.Project(head.getAbsolutePosition(),BABYLON.Matrix.Identity(),scene.getTransformMatrix(),vp);
   const x=rect.left+p.x*rect.width/width,y=rect.top+p.y*rect.height/height;
   if(x>=g.left&&x<=g.right&&y>=g.top&&y<=g.bottom)clashes.push(f.id+" head");
  }
  return clashes;
 });
 assert.deepEqual(overlaps,[],"intro objective must not overlap a living fighter head/indicator or battle controls");
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

  const compactStoryFrame=async()=>{
   const bounds=await page.evaluate(()=>{const f=document.querySelector("#firstPlayStory .fp-story-footer").getBoundingClientRect(),h=document.querySelector("#firstPlayStory .fp-story-header").getBoundingClientRect();return {top:f.top,bottom:f.bottom,headerBottom:h.bottom,height:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth+1}});
   assert.equal(bounds.overflow,false);
   assert.ok(bounds.top>bounds.headerBottom,"story art must not be hidden by overlapping header/footer");
   assert.ok(bounds.bottom<=bounds.height+1);
  };
  const next=page.locator("#firstPlayStoryNext"),pause=page.locator("#firstPlayStoryPause");
  const sound=page.locator("#firstPlayStorySound");
  assert.equal(await sound.getAttribute("aria-pressed"),"false");
  assert.equal(await page.locator("#firstPlayStoryDocument").isVisible(),false);
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
  await page.waitForFunction(()=>{const i=document.querySelector("#firstPlayStoryImage");return i?.complete&&i.naturalWidth>0&&i.currentSrc.includes("/v6/conflict.webp");},null,{timeout:12000});
  await compactStoryFrame();
  await page.screenshot({path:path.join(dest,label+"-p1c2-conflict.png")});
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
  await probeBattleTargets(page);
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
   await page.waitForFunction(()=>{const i=document.querySelector("#firstPlayStoryImage");return i?.complete&&i.naturalWidth>0&&i.currentSrc.includes("/v6/rescue.webp");},null,{timeout:12000});
   await compactStoryFrame();
  await page.screenshot({path:path.join(dest,label+"-p1c2-rescue.png")});
   assert.equal(await page.locator("#firstPlayStoryFinish").isVisible(),false);
   assert.equal(await page.locator("#firstPlayStorySpeaker").textContent(),
    choice==="cover"?"РЕН ТЕРЕН":"АРТ");
   if(choice!=="neutral")assert.match(await page.locator("#firstPlayStoryContext").innerText(),/Эффект вашего приказа/);
   else assert.doesNotMatch(await page.locator("#firstPlayStoryContext").innerText(),/Эффект вашего приказа/);
   await page.locator("#firstPlayStoryNext").click();
   assert.equal(await page.locator("#firstPlayStorySpeaker").textContent(),"МАСТЕР УЧАСТКА");
   assert.equal(await page.locator("#firstPlayStoryDocument").isVisible(),true);
   assert.match(await page.locator("#firstPlayStoryDocument").innerText(),/Переход безопасен/);
   assert.match(await page.locator("#firstPlayStoryDocument").innerText(),/Крепления снять/);
   await page.waitForFunction(()=>{const i=document.querySelector("#firstPlayStoryImage");return i?.complete&&i.naturalWidth>0&&i.currentSrc.includes("/v6/document.webp");},null,{timeout:12000});
   await compactStoryFrame();
  await page.screenshot({path:path.join(dest,label+"-p1c2-document.png")});
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
   // Test every visual cache state synchronously; do not alter real loader progress.
   // Hit-testing alone misses a pointer-events:none overlay, so also compare geometry.
   const dockStates=await page.evaluate(()=>{
    const dock=document.getElementById("assetLoadDock");
    const action=document.getElementById("hqFirstSessionAction");
    const strip=document.getElementById("hqFirstSession");
    const pan=document.getElementById("hqPan");
    const nav=document.querySelector("#home .hq-bottom");
    const old=dock.dataset.state;
    const overlaps=(a,b)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
    try{
     return ["active","partial","ready"].map(state=>{
      dock.dataset.state=state;
      const d=dock.getBoundingClientRect(),a=action.getBoundingClientRect();
      const visible=getComputedStyle(dock).display!=="none";
      return {state,visible,overlaps:visible&&[action,strip,pan,nav].some(el=>overlaps(d,el.getBoundingClientRect())),
       actionHit:action.contains(document.elementFromPoint(a.left+a.width/2,a.top+a.height/2)),
       actionHeight:a.height,panHeight:pan.getBoundingClientRect().height,
       overflow:document.documentElement.scrollWidth>innerWidth+1};
     });
    }finally{dock.dataset.state=old;}
   });
   for(const state of dockStates){
    assert.equal(state.visible,state.state!=="ready",label+": cache visibility "+state.state);
    assert.equal(state.overlaps,false,label+": visual cache overlap "+state.state);
    assert.equal(state.actionHit,true,label+": action hit target "+state.state);
    assert.ok(state.actionHeight>=44&&state.panHeight>0,label+": compact HQ layout");
    assert.equal(state.overflow,false,label+": cache state overflow "+state.state);
   }
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
   assert.match(await cta.innerText(),/В кампанию/);
   const wallet=await page.evaluate(()=>({currency:progress.currency,xp:progress.accountXp}));
   const opsBefore=await page.evaluate(()=>JSON.stringify(operationProgress));
   assert.equal(wallet.currency,beforeReward.currency+1);
   const openMap=async()=>{
    await cta.tap();
    await page.locator("#campaign.active").waitFor({state:"visible"});
    await page.locator("#mainCampaignMap").waitFor({state:"visible"});
    assert.equal(await page.evaluate(()=>selectedCampaignPath),"main");
    assert.equal(await page.locator("#campaignHub").isVisible(),false);
    assert.equal(await page.locator("#operations.active").count(),0);
    const startBounds=await page.locator("#mainCampaignNode").boundingBox();
    assert.ok(startBounds&&startBounds.y>=0&&startBounds.height>=44&&startBounds.y+startBounds.height<=viewport.height+1,"M1 start must fit without scrolling");
    assert.equal(await page.locator("#campaignMainContent #storyDemoOpen").count(),0);
   };
   const homeFromMap=async()=>{
    await page.locator("#campaignBackButton").tap();
    await page.locator("#campaignBackButton").tap();
    await page.locator("#home.active").waitFor({state:"visible"});
   };
   await openMap();
   assert.equal(await page.evaluate(()=>MainCampaignCore.load(()=>localStorage).best),0);
   await page.locator("#mainCampaignNode").tap();
   await page.locator("#squad.active").waitFor({state:"visible"});
   await page.locator("#squadBack").tap();
   await page.locator("#mainCampaignMap").waitFor({state:"visible"});
   await homeFromMap();
   assert.match(await cta.innerText(),/В кампанию/);
   assert.deepEqual(await page.evaluate(()=>({currency:progress.currency,xp:progress.accountXp})),wallet);
   await page.screenshot({path:path.join(dest,label+"-"+viewport.width+"x"+viewport.height+"-hq-next.png")});
   await page.reload({waitUntil:"load",timeout:60000});
   await page.waitForFunction(()=>typeof firstPlayState!=="undefined"&&typeof firstSessionFollowUp==="function"&&
    document.querySelector("#walletWriterNotice")?.style.display==="none",null,{timeout:60000});
   if(await page.locator("#loginCalendar.active").count())await page.locator('#loginCalendar [data-screen="home"]').click();
   await page.locator("#home.active").waitFor({state:"visible",timeout:30000});
   assert.match(await cta.innerText(),/В кампанию/);
   assert.equal(await page.evaluate(()=>progress.levels.ren),2);
   assert.equal(await page.evaluate(()=>progress.rewardReceipts.filter(r=>r.id===FirstPlayCore.REWARD_RECEIPT).length),1);
   assert.deepEqual(await page.evaluate(()=>({currency:progress.currency,xp:progress.accountXp})),wallet);
   await openMap();
   if(label==="chromium"){
    // The actual onboarding route reaches a real M1 battle, not just a map.
    await page.locator("#mainCampaignNode").tap();
    await page.locator("#squadDisband").tap();
    for(const id of ["ren","art"])await page.locator('#squadRoster .squad-choice[data-hero-id="'+id+'"]').tap();
    // Seed only the launch, never the winner or progression.
    await page.evaluate(()=>{const original=resetBattle;resetBattle=function(...args){const now=Date.now;try{Date.now=()=>7;return original.apply(this,args);}finally{Date.now=now;resetBattle=original;}};});
    await page.locator("#squadStart").tap();
    if(await page.locator("#squad.active").isVisible())await page.locator("#squadStart").tap();
    await page.locator("#battle.active").waitFor({state:"visible",timeout:60000});
    await page.waitForFunction(()=>state.active&&battleIsMainCampaign&&!visualActionPending()&&!document.querySelector("#basicAbilityBtn").disabled,null,{timeout:60000});
    assert.equal(await page.evaluate(()=>state.fighters.find(f=>f.id==="ren")?.level),2);
    await page.locator("#autoSpeedBtn").tap();await page.locator("#autoSpeedBtn").tap();
    await page.locator("#autoBattleBtn").tap();
    await page.locator("#mainCampaignResult.active").waitFor({timeout:180000});
    assert.equal(await page.evaluate(()=>state.winner),"ally");
    assert.ok(await page.evaluate(()=>MainCampaignCore.load(()=>localStorage).best>0));
    await page.locator("#mainCampaignResultBack").tap();
    await homeFromMap();
    assert.match(await cta.innerText(),/К награде/);
    await cta.tap();
    await page.locator("#mainCampaignClaim").tap();
    await page.waitForFunction(()=>MainCampaignCore.claimed(progress)&&!mainCampaignClaiming,null,{timeout:20000});
    assert.equal(await page.evaluate(()=>progress.currency),wallet.currency+40);
    assert.equal(await page.evaluate(()=>progress.rewardReceipts.filter(r=>r.id===MainCampaignCore.RECEIPT).length),1);
    assert.equal(await page.locator("#mainCampaignNext").getAttribute("data-unlocked"),"true");
    await page.screenshot({path:path.join(dest,"cam001fp-real-m1-result.png")});
    await homeFromMap();
    // The integrated first session now deliberately continues to chapter II.
    assert.equal(await cta.isVisible(),true);
    assert.match(await cta.innerText(),/Глава II/);
    await cta.tap();
    assert.equal(await page.locator("#mainCampaignMap").getAttribute("data-mission"),"II");
    assert.equal(await page.locator("#mainCampaignClaim").isVisible(),false);
    await homeFromMap();
   }else await homeFromMap();
   assert.equal(await page.evaluate(()=>JSON.stringify(operationProgress)),opsBefore,"onboarding must not start or mutate OPS");
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
  console.log("CAM001FP "+label+" "+viewport.width+"x"+viewport.height+
   " verified; battle: "+result.winner+" in "+result.steps+" actions");
 }finally{await browser.close();}
}
// Remaining viewport/browser pairs: a clean skip leads to the real battle, not a synthetic fixture.
async function probeFreshOpening(name,type,viewport){
 const browser=await type.launch(type===chromium?{headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-dev-shm-usage"]}:{headless:true});
 const page=await browser.newPage({viewport,hasTouch:true,reducedMotion:"reduce"});
 try{
  await page.goto(origin,{waitUntil:"load",timeout:60000});
  await page.locator("#firstPlay.active").waitFor({timeout:60000});
  await page.locator("#firstPlayStorySkip").tap();
  await page.locator("#battle.active").waitFor({timeout:60000});
  await probeBattleTargets(page);
  assert.equal(await page.locator("#tacticalGoalText").isVisible(),true);
  await page.screenshot({path:path.join(dest,name+"-"+viewport.width+"x"+viewport.height+"-battle.png")});
 }finally{await browser.close();}
}
(async()=>{
 // Full first-session traversal belongs to aud003-b17-3a.yml, not this suite.
 await run("chromium",chromium,{width:844,height:390});
 await run("webkit",webkit,{width:932,height:430});
 await run("chromium-short",chromium,{width:844,height:320});
 await probeFreshOpening("webkit",webkit,{width:844,height:390});
 await probeFreshOpening("chromium",chromium,{width:932,height:430});
 await probeFreshOpening("webkit",webkit,{width:844,height:320});
})().catch(error=>{console.error(error);process.exitCode=1;});
