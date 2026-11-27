"use strict";
// AUD003-A: one clean browser context, real UI only. Read-only probes are not player decisions.
// Deterministic seed for campaign battle launches only; no save/HP/winner/phase injection.
const {chromium,webkit}=require("playwright");
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const pilot=process.env.COMBAT2_PILOT==="1";
const origin=new URL(process.env.GAME_ORIGIN||"http://127.0.0.1:8765/");if(pilot){origin.searchParams.set("combat2Pilot","1");origin.searchParams.set("artAdventurePilot","1");}
const dest=path.join(process.cwd(),"artifacts","squad-recovery","first-play",pilot?"aud003-b17-3a":"aud003-a");fs.mkdirSync(dest,{recursive:true});
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

async function run(name,type,viewport,skip=false){
 const browser=await type.launch(type===chromium?{headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-dev-shm-usage"]}:{headless:true});
 const page=await browser.newPage({viewport,hasTouch:true,reducedMotion:"reduce"});
 const key=name+"-"+viewport.width+"x"+viewport.height+(skip?"-skip-auto":"-manual");
 const start=Date.now(),events=[],errors=[];let taps=0;
 page.on("pageerror",e=>errors.push(e.message));
 const liveUntouched=async()=>{if(pilot)assert.deepEqual(await page.evaluate(()=>["ashes-throne.first-play.v1","ashes-throne.progress.v3"].map(key=>localStorage.getItem(key))),["pilot-live-sentinel","pilot-live-sentinel"]);};
 const report=(label,extra={})=>{const e={label,elapsedMs:Date.now()-start,taps,...extra};events.push(e);console.log("AUD003-A",key,JSON.stringify(e));fs.writeFileSync(path.join(dest,key+".json"),JSON.stringify({key,events,errors},null,2));};
 const wait=async(sel)=>page.locator(sel).waitFor({state:"visible",timeout:60000});
 const tap=async sel=>{await wait(sel);await page.locator(sel).tap();taps++;};
 // The production story intentionally ignores Next taps within 350 ms.
 // Respect that input guard and prove each tap actually advanced the cursor.
 const storyNext=async()=>{
  const previous=await page.evaluate(()=>firstPlayStoryCursor.step);
  await page.waitForFunction(()=>Date.now()-firstPlayStoryManualAt>=350,null,{timeout:5000});
  await tap("#firstPlayStoryNext");
  await page.waitForFunction(step=>firstPlayStoryCursor.step===step+1,previous,{timeout:5000});
 };
 const screenshot=async label=>{assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"horizontal overflow "+label);await page.screenshot({path:path.join(dest,key+"-"+label+".png")});};
 const inspect=()=>page.evaluate(()=>({phase:firstPlayState.phase,choice:firstPlayState.choice,won:FirstPlayCore.wonProof(firstPlayState),ren:progress.levels.ren,
  owned:ALLIES.filter(h=>heroOwned(h.id)).map(h=>h.id).sort(),nada:StarCore.rankOf(progress,"nada"),currency:progress.currency,xp:progress.accountXp,energy:progress.energy.value,ops:JSON.stringify(operationProgress),
  receipts:[FirstPlayCore.REWARD_RECEIPT,MainCampaignCore.RECEIPT,MainCampaignCore.mission(MainCampaignCore.II_ID).receipt].map(id=>(progress.rewardReceipts||[]).filter(r=>r.id===id).length),
  statuses:[MainCampaignCore.ID,MainCampaignCore.II_ID].map(id=>MainCampaignCore.statusFor(id,()=>gameStorage(),progress)),
  best:[MainCampaignCore.ID,MainCampaignCore.II_ID].map(id=>MainCampaignCore.proofFor(id,()=>gameStorage())?.best)}));
 const ready=async()=>page.waitForFunction(()=>typeof FirstPlayCore!=="undefined"&&typeof MainCampaignCore!=="undefined"&&document.querySelector("#walletWriterNotice")?.style.display==="none",null,{timeout:60000});
 const home=async()=>{await ready();await wait("#home.active, #loginCalendar.active");if(await page.locator("#loginCalendar.active").isVisible())await tap('#loginCalendar [data-screen="home"]');await wait("#home.active");};
 const map=async()=>{await tap('#home .hq-station[data-screen="campaign"]');await tap('[data-campaign-path="main"]');await wait("#mainCampaignMap");};
 const backHome=async()=>{await tap("#campaignBackButton");await tap("#campaignBackButton");await home();};
 const actorReady=async()=>page.waitForFunction(()=>!state.active||(!visualActionPending()&&!isVisualTransition()&&!document.querySelector("#basicAbilityBtn").disabled),null,{timeout:60000});
 const battle=async(label,first=false,automatic=false)=>{
  await wait("#battle.active");await actorReady();assert.equal(await page.evaluate(()=>state.active),true);
  assert.match(await page.locator("#autoSpeedBtn").innerText(),/1×/);assert.equal(await page.locator("#autoBattleBtn").getAttribute("aria-pressed"),"false");
  const launched=await page.evaluate(()=>({combat2:state.combat2===true,seed:state.rng?.seed,mission:state.mainCampaignMissionId,allies:state.fighters.filter(f=>f.side==="ally").map(f=>({id:f.id,level:f.level})),enemies:state.fighters.filter(f=>f.side==="enemy").map(f=>f.id)}));
  assert.equal(launched.combat2,pilot);assert.deepEqual(launched.allies.map(f=>f.id).sort(),["art","ren"]);if(!first){assert.equal(launched.seed,7);assert.equal(launched.mission,label==="I"?"main-cam-001-m1":"main-cam-002-m1");assert.equal(launched.allies.find(f=>f.id==="ren").level,2);}
  report(label+"-interactive",launched);await screenshot(label+"-battle");
  const before=Date.now(),t0=taps;let firstActionMs=null,seen=new Set();
  if(automatic){await tap("#autoBattleBtn");}
  else for(let i=0;i<45;i++){
   await actorReady();
   const turn=await page.evaluate(()=>({active:state.active,actor:state.fighters[state.currentActor]?.id,actions:state.allyActions,target:state.fighters.filter(f=>f.side==="enemy"&&f.hp>0).sort((a,b)=>a.hp+a.protection-b.hp-b.protection)[0]?.id,selected:state.fighters[state.selectedEnemy]?.id}));
   if(!turn.active)break;
   if(first&&turn.actor==="art"&&!seen.has("art")){
    await tap("#specialAbilityBtn");await tapFighter(page,"ren");taps++;
   }else{
    if(turn.target&&turn.target!==turn.selected){await tapFighter(page,turn.target);taps++;}
    await tap(first&&turn.actor==="ren"&&!seen.has("ren")?"#specialAbilityBtn":"#basicAbilityBtn");
   }
   seen.add(turn.actor);
   await page.waitForFunction(n=>!state.active||state.allyActions>n,turn.actions,{timeout:30000});if(firstActionMs===null)firstActionMs=Date.now()-before;
  }
  await wait(first?"#firstPlay.active":"#mainCampaignResult.active");
  const result=await page.evaluate(()=>({winner:state.winner,actions:state.allyActions,active:state.active,hp:state.fighters.map(f=>({id:f.id,hp:f.hp,maxHp:f.maxHp}))}));
  report(label+"-result",{...result,battleMs:Date.now()-before,battleTaps:taps-t0,automationFirstActionMs:firstActionMs});
  assert.equal(result.active,false);assert.equal(result.winner,"ally",label+" real victory required");await screenshot(label+"-result");return result;
 };
 const squad=async()=>{await tap("#mainCampaignNode");await wait("#squad.active");await tap("#squadDisband");for(const id of ["ren","art"])await tap('#squadRoster .squad-choice[data-hero-id="'+id+'"]');assert.equal(await page.locator('#squadRoster .squad-choice[data-hero-id="nada"]').isEnabled(),false);
  await page.evaluate(()=>{const original=resetBattle;resetBattle=function(...args){const now=Date.now;try{Date.now=()=>7;return original.apply(this,args);}finally{Date.now=now;resetBattle=original;}};});
  await tap("#squadStart");if(await page.locator("#squad.active").isVisible())await tap("#squadStart");
 };
 try{
  if(pilot)await page.addInitScript(()=>{for(const key of ["ashes-throne.first-play.v1","ashes-throne.progress.v3"])if(localStorage.getItem(key)===null)localStorage.setItem(key,"pilot-live-sentinel");});
  await page.goto(origin.toString(),{waitUntil:"load",timeout:60000});await ready();await wait("#firstPlay.active");
  if(pilot)assert.equal(await page.evaluate(()=>gameStorage()===sessionStorage),true);
  const initial=await inspect();assert.deepEqual(initial.owned,["art","ren"]);assert.equal(initial.phase,"briefing");assert.deepEqual(initial.receipts,[0,0,0]);assert.deepEqual(initial.best,[0,0]);report("cold-first-play",initial);await screenshot("opening");
  if(skip){await tap("#firstPlayStorySkip");await wait("#battle.active");await liveUntouched();await page.reload({waitUntil:"load",timeout:60000});await ready();await wait("#firstPlay.active");assert.equal((await inspect()).phase,"ready");assert.deepEqual((await inspect()).receipts,[0,0,0]);report("skip-reload-ready");await tap("#firstPlayStoryFight");}
  else{for(let i=0;i<4&&!(await page.locator("#firstPlayStoryFight").isVisible());i++)await storyNext();assert.equal(await page.locator("#firstPlayStoryChoices").isVisible(),false);await screenshot("handoff");await tap("#firstPlayStoryFight");}
  assert.equal((await inspect()).choice,"neutral");await battle("FP",true,skip);assert.equal((await inspect()).phase,"won");
  for(let i=0;i<3&&!(await page.locator("#firstPlayStoryFinish").isVisible());i++)await storyNext();await tap("#firstPlayStoryFinish");await home();
  assert.equal((await inspect()).won,true);assert.match(await page.locator("#hqFirstSessionAction").innerText(),/Забрать награду/);await screenshot("HQ-reward");
  await tap("#hqFirstSessionAction");await page.waitForFunction(()=>FirstPlayCore.rewardClaimed(progress)&&!firstSessionClaiming,null,{timeout:20000});
  let p=await inspect();assert.deepEqual(p.receipts,[1,0,0]);assert.equal(p.currency,initial.currency+40);assert.match(await page.locator("#hqFirstSessionAction").innerText(),/Усилить Рена/);report("FP-claimed",p);
  await tap("#hqFirstSessionAction");await wait("#heroDetail.active");assert.equal(await page.evaluate(()=>selectedHeroId),"ren");await tap("#detailUpgrade");await page.waitForFunction(()=>progress.levels.ren===2,null,{timeout:20000});if(await page.locator("#gearPromotionDialog").evaluate(n=>n.open))await tap("#gearPromotionClose");await tap("#detailHome");await home();p=await inspect();assert.equal(p.currency,initial.currency+1);report("Ren-L2",p);await screenshot("HQ-campaign");
  if(skip){if(pilot)assert.equal(await page.evaluate(()=>localStorage.getItem("ashes-throne.progress.v3")),"pilot-live-sentinel");assert.deepEqual(errors,[]);report("PASS-skip-auto-reload",p);return;}
  await tap("#hqFirstSessionAction");await wait("#mainCampaignMap");assert.equal(await page.locator("#mainCampaignNext").isDisabled(),true);await screenshot("I-map");
  await squad();await battle("I");let won=await inspect();assert.deepEqual(won.statuses,["claimable","locked"]);assert.deepEqual(won.receipts,[1,0,0]);assert.equal(won.currency,p.currency);
  await tap("#mainCampaignResultBack");await wait("#mainCampaignMap");await backHome();assert.match(await page.locator("#hqFirstSessionAction").innerText(),/К награде/);await tap("#hqFirstSessionAction");await tap("#mainCampaignClaim");await page.waitForFunction(()=>MainCampaignCore.claimed(progress)&&!mainCampaignClaiming,null,{timeout:20000});let paid=await inspect();assert.deepEqual(paid.receipts,[1,1,0]);assert.equal(paid.currency,p.currency+40);assert.deepEqual(paid.statuses,["claimed","ready"]);report("I-claimed",paid);
  await tap("#mainCampaignNext");await wait("#mainCampaignMap");assert.equal(await page.locator("#mainCampaignMap").getAttribute("data-mission"),"II");await screenshot("II-map");
  await squad();await battle("II");won=await inspect();assert.deepEqual(won.statuses,["claimed","claimable"]);assert.equal(won.nada,0);assert.deepEqual(won.receipts,[1,1,0]);report("II-proof",won);
  // Reload before the reward: proof and same profile must persist.
  await liveUntouched();await page.reload({waitUntil:"load",timeout:60000});await home();assert.deepEqual((await inspect()).statuses,["claimed","claimable"]);await map();await tap("#mainCampaignNext");await wait("#mainCampaignClaim");assert.match(await page.locator("#mainCampaignClaim").innerText(),/Принять Наду/);await tap("#mainCampaignClaim");await page.waitForFunction(()=>heroOwned("nada")&&!mainCampaignClaiming,null,{timeout:20000});
  paid=await inspect();assert.equal(paid.nada,1);assert.deepEqual(paid.owned,["art","nada","ren"]);assert.deepEqual(paid.receipts,[1,1,1]);assert.deepEqual(paid.statuses,["claimed","claimed"]);assert.equal(paid.currency,p.currency+40);assert.equal(paid.energy,initial.energy);assert.equal(paid.ops,initial.ops);assert.match(await page.locator("#mainCampaignNotice").innerText(),/глава III готовится/);report("Nada-claimed",paid);await screenshot("II-claimed");
  await tap("#mainCampaignNode");assert.ok(await page.locator('#squadRoster .squad-choice[data-hero-id="nada"]').isEnabled());await tap("#squadBack");await backHome();
  await tap('#home .hq-station[data-screen="collection"]');await wait("#collection.active");await tap('#collection [data-open-hero="nada"]');await wait("#heroDetail.active");assert.equal(await page.evaluate(()=>selectedHeroId),"nada");await screenshot("Nada-card");await tap("#detailHome");await home();
  if(pilot){
   await tap('#home .hq-station[data-screen="collection"]');await wait("#collection.active");
   await tap('#collection [data-open-hero="art"]');await wait("#heroDetail.active");
   const abilityText=slot=>page.locator('#heroAbilityList [data-hero-ability="'+slot+'"]').textContent();
   assert.match(await abilityText("special"),/65%.*физической атаки/);
   assert.match(await abilityText("passive"),/40%.*85%/);
   assert.match(await abilityText("leader"),/Не назначена/);
   assert.match(await page.locator("#heroAbilityList").getAttribute("aria-label"),/Тест Combat 2.0/);
   const abilityLayout=await page.evaluate(()=>{
    const list=document.querySelector("#heroAbilityList"),cards=[...list.children];
    const footer=document.querySelector("#app>footer");
    return {count:cards.length,allCards:cards.every(n=>n.matches(".hero-ability-card")),
     bottom:Math.max(...cards.map(n=>n.getBoundingClientRect().bottom)),
     limit:Math.min(innerHeight,footer?.getBoundingClientRect().top??innerHeight)};
   });
   assert.equal(abilityLayout.count,5);assert.equal(abilityLayout.allCards,true);
   assert.ok(abilityLayout.bottom<=abilityLayout.limit+1,"all five skill rows fit above footer: "+JSON.stringify(abilityLayout));
   await screenshot("Art-candidate-card");await tap("#detailHome");await home();
  }
  await liveUntouched();await page.reload({waitUntil:"load",timeout:60000});await home();const final=await inspect();assert.deepEqual(final.receipts,[1,1,1]);assert.deepEqual(final.statuses,["claimed","claimed"]);assert.equal(final.nada,1);assert.equal(final.ren,2);assert.equal(final.currency,paid.currency);await map();await tap("#mainCampaignNext");assert.equal(await page.locator("#mainCampaignClaim").isVisible(),false);await screenshot("persisted-II");
  if(pilot){
   await backHome();
   assert.match(await page.locator("#hqFirstSessionAction").innerText(),/К приключению/);
   await screenshot("HQ-art-next");await tap("#hqFirstSessionAction");
   const story=page.locator(".r2a-path [data-field=story]");
   await story.waitFor({state:"visible"});
   const shot=async id=>{await page.waitForFunction(id=>{const h=document.querySelector(".r2a-path .story-art"),im=h?.querySelector("img");return h?.dataset.shot===id&&h.dataset.loadState==="ready"&&im.complete&&im.naturalWidth===1280&&im.naturalHeight===720;},id,{timeout:15000});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await screenshot("Art-"+id);};
   for(const id of ["p0","p1","p2"]){await shot(id);await tap('.r2a-path [data-field="storyAction"]');}await shot("p3");
   const beforeAdventure=await inspect();
   assert.deepEqual(beforeAdventure,final,"Viewing actual unlocked adventure cannot change progress");
   // Choose a deterministic route using the same actual profile and core in
   // detached memory; never grant a prerequisite or inject an outcome.
   const seed=await page.evaluate(()=>{
    const keys=[ProgressV3Core.KEY,...MainCampaignCore.MISSIONS.map(m=>m.key)],original=keys.map(k=>[k,gameStorage().getItem(k)]);
    for(let n=3001;n<3401;n++){
     const copy=new Map(original),storage={getItem:k=>copy.get(k)??null,setItem:(k,v)=>copy.set(k,v)};
     const isolated=ArtAdventureCore.create({heroes:ALLIES,storageProvider:()=>storage});
     const launched=isolated.start("direct",n);if(!launched.ok)throw Error("UNIFIED_DIRECT_PREFLIGHT "+launched.code);
     const b=launched.battle;CombatCore.advanceToPlayerTurn(b);
     for(let i=0;i<40&&b.active;i++){
      const actor=b.fighters[b.currentActor],target=b.fighters.map((f,i)=>({f,i})).filter(x=>x.f.side==="enemy"&&x.f.hp>0).sort((a,b)=>a.f.hp+a.f.protection-b.f.hp-b.f.protection)[0];
      const id=["powerful","special"].find(k=>CombatCore.abilityReady(b,k)&&AbilityData.get(actor,k)?.kind==="damage"&&AbilityData.get(actor,k)?.target==="enemy")||"basic";
      if(!CombatCore.chooseEnemy(b,target.i)||!CombatCore.performPlayerAbility(b,id))throw Error("UNIFIED_DIRECT_ACTION");
     }
     if(ArtAdventureCore.terminal(b,"direct")?.outcome==="recovered")return n;
    }
    return null;
   });
   assert.ok(Number.isInteger(seed));assert.deepEqual(await inspect(),beforeAdventure);
   await page.evaluate(seed=>{const original=startArtAdventure;startArtAdventure=function(...args){const now=Date.now;try{Date.now=()=>{Date.now=now;return seed};return original.apply(this,args);}finally{Date.now=now;startArtAdventure=original;}};},seed);
   await tap('.r2a-path [data-path-mission="direct"]');await wait("#battle.active");
   await page.waitForFunction(()=>battleIsArtAdventure&&state.active&&!!scene,null,{timeout:60000});await actorReady();
   assert.equal(await page.evaluate(()=>state.rng.seed),seed);
   report("Art-adventure-interactive",{seed});
   // The same native commands as the proven D3C test; deterministic technical
   // traversal, not a human playtest or injected damage/outcome.
   for(let i=0;i<40;i++){
    await actorReady();
    if(!await page.evaluate(()=>state.active))break;
    await page.waitForFunction(()=>!state.active||!combat2InputBlocked(),null,{timeout:60000});
    const action=await page.evaluate(()=>{if(!state.active)return null;const f=state.fighters[state.currentActor],target=state.fighters.map((f,i)=>({f,i})).filter(x=>x.f.side==="enemy"&&x.f.hp>0).sort((a,b)=>a.f.hp+a.f.protection-b.f.hp-b.f.protection)[0];const id=["powerful","special"].find(k=>CombatCore.abilityReady(state,k)&&AbilityData.get(f,k)?.kind==="damage"&&AbilityData.get(f,k)?.target==="enemy")||"basic";const before=state.allyActions;if(!CombatCore.chooseEnemy(state,target.i)||!applyManualAbility(id))throw Error("UNIFIED_DIRECT_LIVE_ACTION "+id);return {id,before};});
    if(action){await page.waitForFunction(n=>!state.active||state.allyActions>n,action.before,{timeout:30000});report("Art-adventure-command",{ability:action.id});}
   }
   await story.waitFor({state:"visible",timeout:90000});await shot("p4a");
   const outcome=await page.evaluate(()=>({path:ArtAdventureCore.view(progress),winner:state.winner,goal:state.tacticalOutcome}));
   assert.equal(outcome.winner,"ally");assert.equal(outcome.goal,"protected-victory");assert.equal(outcome.path.outcome,"recovered");assert.deepEqual(outcome.path.earned,["guardian-2","command-2"]);
   assert.deepEqual(await inspect(),beforeAdventure);report("Art-adventure-earned",outcome);
   await tap('.r2a-path [data-field="storyAction"]');await tap('.r2a-path [data-node="guardian-2"]');await tap('.r2a-path [data-field="equip"]');assert.equal(await page.evaluate(()=>ArtAdventureCore.view(progress).selected),"guardian-2");
   await screenshot("Art-specialization");await tap(".r2a-path-back");await tap("#detailHome");await home();
   await page.reload({waitUntil:"load",timeout:60000});await home();
   assert.equal(await page.evaluate(()=>ArtAdventureCore.view(progress).selected),"guardian-2");
   assert.match(await page.locator("#hqFirstSessionAction").innerText(),/Собрать отряд/);
   await screenshot("HQ-new-squad");await tap("#hqFirstSessionAction");await wait("#squad.active");
   await tap('#squadRoster .squad-choice[data-hero-id="nada"]');
   assert.deepEqual(await page.evaluate(()=>selectedParty().map(x=>x.id).sort()),["art","nada","ren"]);
   await screenshot("Three-hero-squad");
   await page.evaluate(()=>{const original=resetBattle;resetBattle=function(...args){const now=Date.now;try{Date.now=()=>7;return original.apply(this,args);}finally{Date.now=now;resetBattle=original;}};});
   await tap("#squadStart");if(await page.locator("#squad.active").isVisible())await tap("#squadStart");
   await wait("#battle.active");await actorReady();
   assert.deepEqual(await page.evaluate(()=>({heroes:state.fighters.filter(f=>f.side==="ally").map(f=>f.id).sort(),personal:state.trustPersonal})),{heroes:["art","nada","ren"],personal:["art-intercept"]});
   let used=false,nadaActed=false;
   for(let i=0;i<40;i++){
    await actorReady();const turn=await page.evaluate(()=>({active:state.active,actor:state.fighters[state.currentActor]?.id,actions:state.allyActions,target:state.fighters.filter(f=>f.side==="enemy"&&f.hp>0).sort((a,b)=>a.hp+a.protection-b.hp-b.protection)[0]?.id,selected:state.fighters[state.selectedEnemy]?.id}));
    if(!turn.active)break;
    if(turn.actor==="art"&&!used&&await page.locator("#personalAbilityBtn").isVisible()&&await page.locator("#personalAbilityBtn").isEnabled()){
     await screenshot("Personal-slot");await tap("#personalAbilityBtn");await tapFighter(page,"ren");taps++;
     await page.waitForFunction(n=>state.allyActions>n,turn.actions,{timeout:30000});assert.ok(await page.evaluate(()=>state.events.some(e=>e.type==="trust-intercept-armed"&&e.targetId==="ren")));used=true;
    }else{
     if(turn.target&&turn.target!==turn.selected){await tapFighter(page,turn.target);taps++;}
     await tap("#basicAbilityBtn");await page.waitForFunction(n=>!state.active||state.allyActions>n,turn.actions,{timeout:30000});
     if(turn.actor==="nada")nadaActed=true;
    }
   }
   await wait("#mainCampaignResult.active");assert.equal(await page.evaluate(()=>state.winner),"ally");assert.ok(used&&nadaActed,"The new hero and learned personal technique must actually act in the same battle");
   assert.deepEqual((await inspect()).receipts,[1,1,1]);assert.equal((await inspect()).currency,final.currency);report("New-squad-real-battle",{used,nadaActed});await screenshot("New-squad-result");
   await tap("#mainCampaignResultBack");await backHome();assert.match(await page.locator("#hqFirstSessionAction").innerText(),/В разведсеть/);await screenshot("HQ-network-next");
   await tap("#hqFirstSessionAction");await wait("#network.active");await screenshot("Network-entry");
   assert.deepEqual((await inspect()).receipts,[1,1,1]);assert.equal(await page.evaluate(()=>ArtAdventureCore.view(progress).selected),"guardian-2");await liveUntouched();report("UNIFIED-PASS",{...await inspect(),art:await page.evaluate(()=>ArtAdventureCore.view(progress))});
  }
  assert.deepEqual(errors,[]);report("PASS",await inspect());
 }catch(e){report("FAIL",{error:String(e)});await page.screenshot({path:path.join(dest,key+"-fail.png")}).catch(()=>{});throw e;}
 finally{await browser.close();}
}
async function closeout(){await run("chromium",chromium,{width:844,height:390});await run("webkit",webkit,{width:844,height:320});await run("chromium",chromium,{width:932,height:430},true);}
module.exports=closeout;
if(require.main===module)closeout().catch(e=>{console.error(e);process.exitCode=1;});
