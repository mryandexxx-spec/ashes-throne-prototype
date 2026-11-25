"use strict";
// Real touches and read-only probes, no forced combat state or injected outcomes.
const {chromium,webkit}=require("playwright");
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const origin=new URL(process.env.GAME_ORIGIN||"http://127.0.0.1:8765/");
origin.searchParams.set("combat2Pilot","1");origin.searchParams.set("combat2Arena","1");
const browserName=process.env.ARENA_BROWSER||"chromium",group=process.env.ARENA_GROUP||"interaction";
const dest=path.join(process.cwd(),"artifacts","combat2-arena",browserName+"-"+group);fs.mkdirSync(dest,{recursive:true});
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
async function run(){
 const type=browserName==="webkit"?webkit:chromium;
 const browser=await type.launch(type===chromium?{headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-dev-shm-usage"]}:{headless:true});
 const page=await browser.newPage({viewport:browserName==="webkit"?{width:844,height:320}:{width:932,height:430},hasTouch:true,reducedMotion:"reduce"});
 const errors=[],evidence=[];let base=null;
 page.on("pageerror",e=>errors.push(e.message));
 const snapshot=()=>page.evaluate(()=>JSON.stringify(state));
 const wallet=()=>page.evaluate(()=>JSON.stringify({progress,firstPlayState,campaignProgress,operationProgress,signalProgress,live:Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])}));
 const ready=()=>page.waitForFunction(()=>!state.active||(!combat2EntryPending&&!battleAssetGate&&!visualActionPending()&&!isVisualTransition()&&!document.querySelector("#basicAbilityBtn").disabled),null,{timeout:90000});
 const take=async(label)=>{await page.screenshot({path:path.join(dest,label+".png")});};
 const report=(label,data)=>{evidence.push({label,...data});fs.writeFileSync(path.join(dest,"evidence.json"),JSON.stringify({browserName,group,evidence,errors},null,2));console.log("B173B2",label,JSON.stringify(data));};
 async function visual(label){
  await ready();
  await page.waitForFunction(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true)))),null,{timeout:10000});
  const status=await page.evaluate(()=>{
   const f=state.fighters.filter(x=>x.hp>0);
   const rt={ren:renGlbRuntime,art:artGlbRuntime,nada:nadaGlbRuntime,liora:lioraGlbRuntime,sava:savaGlbRuntime};
   return {overflow:document.documentElement.scrollWidth>innerWidth+1,gate:!!battleAssetGate,pending:combat2EntryPending,
    actors:f.map(x=>({id:x.id,rig:!!(rt[x.id]??npcGlbRuntimes.get(x.id))?.isReady,
    geometry:arenaFlashMeshes(x.id).length,indicator:!!indicatorNodes[x.id]&&getComputedStyle(indicatorNodes[x.id]).display!=="none"&&indicatorNodes[x.id].getBoundingClientRect().width>0}))};
  });
  report(label,status);await take(label);
  assert.equal(status.overflow,false);assert.equal(status.pending,false);assert.equal(status.gate,false);
  assert.ok(status.actors.every(x=>x.geometry>0),label+" all living fighters need visible geometry");
  assert.ok(status.actors.every(x=>x.indicator),label+" all living fighters need HUD indicators");
 }
 async function setup(scenario,tier){
  await page.locator("#combat2ArenaSetup.active").waitFor({timeout:90000});
  await page.locator("#combat2ArenaScenario").selectOption(scenario);
  if(await page.locator("#combat2ArenaTier").isEnabled())await page.locator("#combat2ArenaTier").selectOption(tier);
  await page.locator("#combat2ArenaStart").tap();
  await page.locator("#battle.active").waitFor({timeout:90000});
  // Optional download fallback is a normal player action, never an injected state.
  const skip=page.locator("#battleAssetGateSkip");
  await Promise.race([page.waitForFunction(()=>!battleAssetGate&&!combat2EntryPending,null,{timeout:90000}),skip.waitFor({state:"visible",timeout:90000})]);
  if(await skip.isVisible())await skip.tap();
  await ready();assert.equal(await page.evaluate(()=>state.combat2&&battleIsCombat2Arena&&state.active),true);
  assert.equal(await wallet(),base,"no reward or wallet changes entering arena");
  await visual(scenario+"-"+tier+"-entry");
 }
 async function speed(value){
  for(let i=0;i<6&&await page.evaluate(()=>BattleSpeed.get())!==value;i++)await page.locator("#autoSpeedBtn").tap();
  assert.equal(await page.evaluate(()=>BattleSpeed.get()),value);
 }
 async function tapSkill(slot){const id={basic:"#basicAbilityBtn",special:"#specialAbilityBtn",powerful:"#powerfulAbilityBtn"}[slot];await page.locator(id).tap();}
 async function advanceUntilSava(slot){
  for(let i=0;i<20;i++){
   await ready();const info=await page.evaluate(slot=>({active:state.active,actor:state.fighters[state.currentActor]?.id,ready:CombatCore.abilityReady(state,slot),actions:state.allyActions}),slot);
   assert.equal(info.active,true);if(info.actor==="sava"&&info.ready)return;
   await tapSkill("basic");await page.waitForFunction(n=>!state.active||state.allyActions>n,info.actions,{timeout:30000});
  }throw Error("Sava not ready "+slot);
 }
 async function selection(slot){
  await advanceUntilSava(slot);const before=await snapshot(),actions=await page.evaluate(()=>state.allyActions);
  await tapSkill(slot);assert.equal(await page.evaluate(()=>selectedAbility),slot);
  await tapFighter(page,"ren");assert.equal(await page.evaluate(()=>state.fighters[combat2Choice]?.id),"ren");
  assert.equal(await snapshot(),before,"target preview must not mutate core");
  const marks=await page.evaluate(()=>{
   const mark=id=>{const ring=meshes[id]?.base?.av001Ring;return ring?.isEnabled()?ring.material?.name:null;};
   const enemy=state.fighters[state.selectedEnemy]?.id;
   const hint=document.querySelector("#actionHint"),rect=hint.getBoundingClientRect();
   return {ally:mark("ren"),enemy:mark(enemy),hint:getComputedStyle(hint).fontSize,visible:!hint.hidden,overflow:rect.right>innerWidth+1||rect.left<0||rect.top<0};
  });
  assert.equal(marks.ally,"av001_ring_ally","chosen helper uses green ally material, not hostile");
  if(slot==="powerful")assert.equal(marks.enemy,"av001_ring_enemy","enemy keeps red enemy material");
  assert.ok(marks.visible&&parseFloat(marks.hint)>=13&&!marks.overflow,"readable confirmation hint");
  report("sava-"+slot+"-marks",marks);
  await take("sava-"+slot+"-preview");
  await tapSkill("basic");assert.equal(await page.evaluate(()=>selectedAbility),"basic");assert.equal(await snapshot(),before,"cancel must not spend action");
  await tapSkill(slot);await tapFighter(page,"ren");await tapSkill(slot);
  await page.waitForFunction(n=>state.allyActions===n+1,actions,{timeout:30000});
  const events=await page.evaluate(()=>state.events);assert.ok(events.some(e=>slot==="special"?e.type==="combat2-meter":e.assist===true||e.type==="death"),"native signal/assist event");
  report("sava-"+slot,{events:events.filter(e=>e.type.startsWith("combat2-")||e.assist)});
 }
 async function autoEnd(label,winner,expectedWave){
  const button=page.locator("#autoBattleBtn");await ready();if(await page.evaluate(()=>state.active))await button.tap();
  if(expectedWave===2){
   await page.waitForFunction(()=>state.wave===2&&state.active&&!isVisualTransition(),null,{timeout:240000});
   await button.tap();await ready();await visual(label+"-wave2");
   if(await page.evaluate(()=>state.active))await button.tap();
  }
  await page.waitForFunction(()=>!state.active&&!isVisualTransition()&&!visualActionPending(),null,{timeout:240000});
  const result=await page.evaluate(()=>({winner:state.winner,wave:state.wave,actions:state.allyActions,remaining:state.fighters.map(f=>[f.id,f.hp,f.protection]),receipts:progress.rewardReceipts?.length??0}));
  report(label,result);await take(label);assert.equal(result.winner,winner);assert.equal(result.wave,expectedWave);assert.equal(await wallet(),base,"finish cannot grant rewards");
  return result;
 }
 async function retreat(){
  await page.locator("#battleMenuBtn").tap();await page.locator("#battleMenuRetreat").tap();await page.locator("#combat2ArenaSetup.active").waitFor({timeout:30000});assert.equal(await wallet(),base);
 }
 async function repeat(){
  await page.locator("#battleRetryBtn").tap();await page.locator("#battle.active").waitFor();const skip=page.locator("#battleAssetGateSkip");
  await Promise.race([page.waitForFunction(()=>!battleAssetGate&&!combat2EntryPending,null,{timeout:90000}),skip.waitFor({state:"visible",timeout:90000})]);if(await skip.isVisible())await skip.tap();await ready();
  assert.equal(await page.evaluate(()=>state.active&&state.allyActions===0&&state.combat2),true);
 }
 try{
  await page.addInitScript(()=>{localStorage.setItem("ashes-throne.progress.v3","normal-wallet-sentinel");localStorage.setItem("ashes-throne.first-play.v1","normal-firstplay-sentinel");});
  await page.goto(origin.toString(),{waitUntil:"load",timeout:90000});await page.locator("#combat2ArenaSetup.active").waitFor({timeout:90000});
  await page.waitForFunction(()=>document.querySelector("#walletWriterNotice")?.style.display==="none",null,{timeout:90000});
  base=await wallet();
  if(group==="interaction"){
   await setup("full","early");
   await speed(4);await selection("powerful");await selection("special");await autoEnd("full-manual-auto","ally",1);await retreat();
   await setup("loss","early");await speed(4);const first=await autoEnd("defeat","enemy",1);await repeat();await speed(2);const second=await autoEnd("defeat-replay","enemy",1);assert.deepEqual(second,first,"same seed and policy across presentation speeds");await retreat();
  }else if(group==="waves"){
   await setup("waves","mid");await speed(4);await autoEnd("waves-mid-result","ally",2);await retreat();
   await setup("boss","max");await speed(4);await autoEnd("boss-max-result","ally",1);await retreat();
  }else{
   await setup("full","uneven");await speed(4);await autoEnd("uneven-result","ally",1);await retreat();
   await setup("armored","early");await speed(4);await autoEnd("armored-result","ally",1);await retreat();
   await setup("threats","early");await speed(4);await autoEnd("threats-result","ally",1);await retreat();
  }
  assert.deepEqual(errors,[]);report("PASS",{baseUnchanged:await wallet()===base});
 }catch(error){report("FAIL",{error:String(error)});await take("failure").catch(()=>{});throw error;}finally{await browser.close();}
}
run().catch(e=>{console.error(e);process.exitCode=1});
