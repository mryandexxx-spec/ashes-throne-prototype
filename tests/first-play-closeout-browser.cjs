"use strict";
// AUD003-A: one clean browser context, real UI only. Read-only probes are not player decisions.
// Deterministic seed for campaign battle launches only; no save/HP/winner/phase injection.
const {chromium,webkit}=require("playwright");
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
const dest=path.join(process.cwd(),"artifacts","squad-recovery","first-play","aud003-a");fs.mkdirSync(dest,{recursive:true});
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
 const report=(label,extra={})=>{const e={label,elapsedMs:Date.now()-start,taps,...extra};events.push(e);console.log("AUD003-A",key,JSON.stringify(e));fs.writeFileSync(path.join(dest,key+".json"),JSON.stringify({key,events,errors},null,2));};
 const wait=async(sel)=>page.locator(sel).waitFor({state:"visible",timeout:60000});
 const tap=async sel=>{await wait(sel);await page.locator(sel).tap();taps++;};
 const screenshot=async label=>{assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),"horizontal overflow "+label);await page.screenshot({path:path.join(dest,key+"-"+label+".png")});};
 const inspect=()=>page.evaluate(()=>({phase:firstPlayState.phase,choice:firstPlayState.choice,won:FirstPlayCore.wonProof(firstPlayState),ren:progress.levels.ren,
  owned:ALLIES.filter(h=>heroOwned(h.id)).map(h=>h.id).sort(),nada:StarCore.rankOf(progress,"nada"),currency:progress.currency,xp:progress.accountXp,energy:progress.energy.value,ops:JSON.stringify(operationProgress),
  receipts:[FirstPlayCore.REWARD_RECEIPT,MainCampaignCore.RECEIPT,MainCampaignCore.mission(MainCampaignCore.II_ID).receipt].map(id=>(progress.rewardReceipts||[]).filter(r=>r.id===id).length),
  statuses:[MainCampaignCore.ID,MainCampaignCore.II_ID].map(id=>MainCampaignCore.statusFor(id,()=>localStorage,progress)),
  best:[MainCampaignCore.ID,MainCampaignCore.II_ID].map(id=>MainCampaignCore.proofFor(id,()=>localStorage)?.best)}));
 const ready=async()=>page.waitForFunction(()=>typeof FirstPlayCore!=="undefined"&&typeof MainCampaignCore!=="undefined"&&document.querySelector("#walletWriterNotice")?.style.display==="none",null,{timeout:60000});
 const home=async()=>{await ready();await wait("#home.active, #loginCalendar.active");if(await page.locator("#loginCalendar.active").isVisible())await tap('#loginCalendar [data-screen="home"]');await wait("#home.active");};
 const map=async()=>{await tap('#home .hq-station[data-screen="campaign"]');await tap('[data-campaign-path="main"]');await wait("#mainCampaignMap");};
 const backHome=async()=>{await tap("#campaignBackButton");await tap("#campaignBackButton");await home();};
 const actorReady=async()=>page.waitForFunction(()=>!state.active||(!visualActionPending()&&!isVisualTransition()&&!document.querySelector("#basicAbilityBtn").disabled),null,{timeout:60000});
 const battle=async(label,first=false,automatic=false)=>{
  await wait("#battle.active");await actorReady();assert.equal(await page.evaluate(()=>state.active),true);
  assert.match(await page.locator("#autoSpeedBtn").innerText(),/1×/);assert.equal(await page.locator("#autoBattleBtn").getAttribute("aria-pressed"),"false");
  const launched=await page.evaluate(()=>({seed:state.rng?.seed,mission:state.mainCampaignMissionId,allies:state.fighters.filter(f=>f.side==="ally").map(f=>({id:f.id,level:f.level})),enemies:state.fighters.filter(f=>f.side==="enemy").map(f=>f.id)}));
  assert.deepEqual(launched.allies.map(f=>f.id).sort(),["art","ren"]);if(!first){assert.equal(launched.seed,7);assert.equal(launched.mission,label==="I"?"main-cam-001-m1":"main-cam-002-m1");assert.equal(launched.allies.find(f=>f.id==="ren").level,2);}
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
  await page.goto(origin,{waitUntil:"load",timeout:60000});await ready();await wait("#firstPlay.active");
  const initial=await inspect();assert.deepEqual(initial.owned,["art","ren"]);assert.equal(initial.phase,"briefing");assert.deepEqual(initial.receipts,[0,0,0]);assert.deepEqual(initial.best,[0,0]);report("cold-first-play",initial);await screenshot("opening");
  if(skip){await tap("#firstPlayStorySkip");await wait("#battle.active");await page.reload({waitUntil:"load",timeout:60000});await ready();await wait("#firstPlay.active");assert.equal((await inspect()).phase,"ready");assert.deepEqual((await inspect()).receipts,[0,0,0]);report("skip-reload-ready");await tap("#firstPlayStoryFight");}
  else{for(let i=0;i<4&&!(await page.locator("#firstPlayStoryFight").isVisible());i++)await tap("#firstPlayStoryNext");assert.equal(await page.locator("#firstPlayStoryChoices").isVisible(),false);await screenshot("handoff");await tap("#firstPlayStoryFight");}
  assert.equal((await inspect()).choice,"neutral");await battle("FP",true,skip);assert.equal((await inspect()).phase,"won");
  for(let i=0;i<3&&!(await page.locator("#firstPlayStoryFinish").isVisible());i++)await tap("#firstPlayStoryNext");await tap("#firstPlayStoryFinish");await home();
  assert.equal((await inspect()).won,true);assert.match(await page.locator("#hqFirstSessionAction").innerText(),/Забрать награду/);await screenshot("HQ-reward");
  await tap("#hqFirstSessionAction");await page.waitForFunction(()=>FirstPlayCore.rewardClaimed(progress)&&!firstSessionClaiming,null,{timeout:20000});
  let p=await inspect();assert.deepEqual(p.receipts,[1,0,0]);assert.equal(p.currency,initial.currency+40);assert.match(await page.locator("#hqFirstSessionAction").innerText(),/Усилить Рена/);report("FP-claimed",p);
  await tap("#hqFirstSessionAction");await wait("#heroDetail.active");assert.equal(await page.evaluate(()=>selectedHeroId),"ren");await tap("#detailUpgrade");await page.waitForFunction(()=>progress.levels.ren===2,null,{timeout:20000});if(await page.locator("#gearPromotionDialog").evaluate(n=>n.open))await tap("#gearPromotionClose");await tap("#detailHome");await home();p=await inspect();assert.equal(p.currency,initial.currency+1);report("Ren-L2",p);await screenshot("HQ-campaign");
  if(skip)return;
  await tap("#hqFirstSessionAction");await wait("#mainCampaignMap");assert.equal(await page.locator("#mainCampaignNext").isDisabled(),true);await screenshot("I-map");
  await squad();await battle("I");let won=await inspect();assert.deepEqual(won.statuses,["claimable","locked"]);assert.deepEqual(won.receipts,[1,0,0]);assert.equal(won.currency,p.currency);
  await tap("#mainCampaignResultBack");await wait("#mainCampaignMap");await backHome();assert.match(await page.locator("#hqFirstSessionAction").innerText(),/К награде/);await tap("#hqFirstSessionAction");await tap("#mainCampaignClaim");await page.waitForFunction(()=>MainCampaignCore.claimed(progress)&&!mainCampaignClaiming,null,{timeout:20000});let paid=await inspect();assert.deepEqual(paid.receipts,[1,1,0]);assert.equal(paid.currency,p.currency+40);assert.deepEqual(paid.statuses,["claimed","ready"]);report("I-claimed",paid);
  await tap("#mainCampaignNext");await wait("#mainCampaignMap");assert.equal(await page.locator("#mainCampaignMap").getAttribute("data-mission"),"II");await screenshot("II-map");
  await squad();await battle("II");won=await inspect();assert.deepEqual(won.statuses,["claimed","claimable"]);assert.equal(won.nada,0);assert.deepEqual(won.receipts,[1,1,0]);report("II-proof",won);
  // Reload before the reward: proof and same profile must persist.
  await page.reload({waitUntil:"load",timeout:60000});await home();assert.deepEqual((await inspect()).statuses,["claimed","claimable"]);await map();await tap("#mainCampaignNext");await wait("#mainCampaignClaim");assert.match(await page.locator("#mainCampaignClaim").innerText(),/Принять Наду/);await tap("#mainCampaignClaim");await page.waitForFunction(()=>heroOwned("nada")&&!mainCampaignClaiming,null,{timeout:20000});
  paid=await inspect();assert.equal(paid.nada,1);assert.deepEqual(paid.owned,["art","nada","ren"]);assert.deepEqual(paid.receipts,[1,1,1]);assert.deepEqual(paid.statuses,["claimed","claimed"]);assert.equal(paid.currency,p.currency+40);assert.equal(paid.energy,initial.energy);assert.equal(paid.ops,initial.ops);assert.match(await page.locator("#mainCampaignNotice").innerText(),/глава III готовится/);report("Nada-claimed",paid);await screenshot("II-claimed");
  await tap("#mainCampaignNode");assert.ok(await page.locator('#squadRoster .squad-choice[data-hero-id="nada"]').isEnabled());await tap("#squadBack");await backHome();
  await tap('#home .hq-station[data-screen="collection"]');await wait("#collection.active");await tap('#collection [data-open-hero="nada"]');await wait("#heroDetail.active");assert.equal(await page.evaluate(()=>selectedHeroId),"nada");await screenshot("Nada-card");await tap("#detailHome");await home();
  await page.reload({waitUntil:"load",timeout:60000});await home();const final=await inspect();assert.deepEqual(final.receipts,[1,1,1]);assert.deepEqual(final.statuses,["claimed","claimed"]);assert.equal(final.nada,1);assert.equal(final.ren,2);assert.equal(final.currency,paid.currency);await map();await tap("#mainCampaignNext");assert.equal(await page.locator("#mainCampaignClaim").isVisible(),false);assert.deepEqual(errors,[]);report("PASS",final);await screenshot("persisted-II");
 }catch(e){report("FAIL",{error:String(e)});await page.screenshot({path:path.join(dest,key+"-fail.png")}).catch(()=>{});throw e;}
 finally{await browser.close();}
}
async function closeout(){await run("chromium",chromium,{width:844,height:390});await run("webkit",webkit,{width:844,height:320});await run("chromium",chromium,{width:932,height:430},true);}
module.exports=closeout;
if(require.main===module)closeout().catch(e=>{console.error(e);process.exitCode=1;});
