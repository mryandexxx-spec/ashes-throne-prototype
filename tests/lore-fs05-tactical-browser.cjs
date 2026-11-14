"use strict";
/* FS-05 browser end-to-end: REAL 3D battle, roster, gate and durable victory. */
const assert=require("node:assert/strict");
const {chromium,webkit}=require("playwright");
const fs=require("node:fs"),path=require("node:path");
const Core=require("../lore-campaign-core.js");
const Scripts=require("../lore-campaign-scenes.js"),Engine=require("../lore-campaign-scene-core.js");
const Runtime=require("../lore-campaign-scene-runtime.js"),Save=require("../lore-campaign-scene-save.js");
const Act2=require("../lore-campaign-act2.js");
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
const out=path.join(process.cwd(),"artifacts","lore-fs05-tactical");fs.mkdirSync(out,{recursive:true});
function seed(){
 const map=new Map(),storage={getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,String(v))};
 const r=Runtime.create({graph:Act2.data.catalog(),graphCore:Core,
  pack:Act2.pack,scriptData:Scripts,sceneCore:Engine,saveModule:Save,storage});
 const ids=Act2.data.catalog().nodes.map(n=>n.id);
 function play(id){
  assert.equal(r.start(id).ok,true,"start "+id);
  for(let i=0;i<160;i++){
   let v=r.current();
   for(const o of v.inspections)if(!o.done)assert.equal(r.inspect(o.id).ok,true);
   v=r.current();
   for(const o of v.comparisons)if(o.ready&&!o.done)assert.equal(r.compare(o.id).ok,true);
   v=r.current();
   if(v.choices.length)assert.equal(r.choose(v.choices[0].id).ok,true);
   else if(v.canContinue)assert.equal(r.next().ok,true);
   else if(v.canFinish){assert.equal(r.finish().ok,true);return;}
   else throw Error("Tactical seed scene stalled: "+id);
  }
  throw Error("Tactical seed exceeded limit");
 }
 for(let i=0;i<5;i++){
  play(ids[i]);
  if(i===0||i===1){
   assert.equal(r.beginRequiredBattle(ids[i]).ok,true);
   assert.equal(r.recordBattleVictory(ids[i],i===0?"fs01-approach-combat":"fs02-evidence-combat").ok,true);
  }
 }
 assert.equal(Core.available(Act2.data.catalog(),r.progress(),ids[5]),false);
 return map.get(Core.KEY);
}
async function finishManually(page){
 for(let i=0;i<35;i++){
  if(await page.locator("#loreRequiredBattleResult").isVisible())return;
  await page.waitForFunction(()=>{
   const result=document.querySelector("#loreRequiredBattleResult");
   return result?.classList.contains("active")||
    (document.querySelector("#battle")?.classList.contains("active")&&
      !document.querySelector("#basicAbilityBtn")?.disabled);
  },{timeout:25000});
  if(await page.locator("#loreRequiredBattleResult").isVisible())return;
  await page.locator("#basicAbilityBtn").click({timeout:12000});
 }
 throw Error("TACTICAL_MANUAL_BATTLE_DID_NOT_END");
}
async function run(name,browserType,width,height){
 const browser=await browserType.launch(name==="chromium"?
  {headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-dev-shm-usage"]}:{headless:true});
 const page=await browser.newPage({viewport:{width,height},hasTouch:true});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 const tag=name+"-"+width+"x"+height;
 try{
  await page.goto(origin,{waitUntil:"load",timeout:60000});
  await page.evaluate(value=>localStorage.setItem("ashes-throne.lore-campaign.v1",value),seed());
  await page.reload({waitUntil:"load"});
  await page.locator('#home .hq-bottom button[data-screen="campaign"]').evaluate(el=>el.click());
  await page.locator('[data-campaign-path="lore"]').click();
  await page.locator(".lore-story-cover").click();
  await page.locator('.lore-list-node[data-lore-node="five-shadows:fs-05"]').click();
  assert.equal(await page.locator('[data-lore-action="required-battle"]').count(),1);
  assert.match(await page.locator(".lore-node-detail").innerText(),/Обязательный бой/);
  assert.equal(await page.locator('.lore-list-node[data-lore-node="five-shadows:fs-06"]').evaluate(el=>el.classList.contains("lore-state-locked")),true);
  await page.locator('[data-lore-action="required-battle"]').click();
  await page.locator("#squad").waitFor({state:"visible",timeout:15000});
  assert.equal(await page.locator("#squadRoster [data-squad-required=true]").count(),2);
  assert.equal(await page.locator("#squadTacticalBrief").isVisible(),true);
  assert.match(await page.locator("#squadTacticalBrief").innerText(),/12 действий союзников/);
  assert.match(await page.locator("#squadTacticalBrief").innerText(),/Автобой отключён/);
  await page.locator("#squadDisband").click();
  const available=page.locator('#squadRoster .squad-choice:not(.chosen):not([disabled])');
  let count=0;while(await available.count()&&count++<3)await available.first().click();
  assert.equal(await page.locator("#squadCount").innerText(),"5/5");
  await page.locator("#squadStart").click();
  if(await page.locator("#squad").isVisible())await page.locator("#squadStart").click();
  await page.locator("#battle").waitFor({state:"visible",timeout:30000});
  const setup=await page.evaluate(()=>({
   objective:state.tacticalObjective,
   protectedHp:state.fighters.find(x=>x.id==="ren")?.hp,
   enemyCount:state.fighters.filter(x=>x.side==="enemy").length,
   goal:document.querySelector("#tacticalGoalCard").textContent,
   goalBounds:(()=>{const r=document.querySelector("#tacticalGoalCard").getBoundingClientRect();return {top:r.top,left:r.left,bottom:r.bottom,right:r.right}})(),
   goalStyle:getComputedStyle(document.querySelector("#tacticalGoalCard")).backgroundColor,
   topGoalHidden:document.querySelector("#battleChallengeGoal").hidden,
   autoHidden:document.querySelector("#autoBattleBtn").hidden,
   gpu:!!engine&&!!scene
  }));
  assert.equal(setup.objective.kind,"hold-or-defeat");
  assert.equal(setup.objective.protectAllyId,"ren");
  assert.equal(setup.objective.allyActionsToHold,12);
  assert.equal(setup.enemyCount,3);assert.equal(setup.gpu,true);
  assert.match(setup.goal,/РЕНА/);
  assert.equal(setup.topGoalHidden,true);
  assert.equal(setup.autoHidden,true,"manual tactical mission, autoplay not available");
  assert.notEqual(setup.goalStyle,"rgba(0, 0, 0, 0)");
  assert.ok(setup.goalBounds.left>=0&&setup.goalBounds.right<=width+1);
  assert.ok(setup.goalBounds.top>=0&&setup.goalBounds.bottom<=height+1);
  await page.screenshot({path:path.join(out,tag+"-battle.png"),fullPage:true});
  await finishManually(page);
  await page.locator("#loreRequiredBattleResult").waitFor({state:"visible",timeout:145000});
  assert.equal(await page.locator("#loreRequiredResultTitle").innerText(),"Бой выигран");
  const battle=await page.evaluate(()=>({
    winner:state.winner,outcome:state.tacticalOutcome,actions:state.allyActions,
    protectedHp:state.fighters.find(x=>x.id==="ren")?.hp,
    cleared:JSON.parse(localStorage.getItem("ashes-throne.lore-campaign.v1")).stories["five-shadows"].battleClearedNodeIds
  }));
  assert.equal(battle.winner,"ally");assert.ok(battle.protectedHp>0);
  assert.ok(["held","defeated-attackers"].includes(battle.outcome));
  assert.deepEqual(battle.cleared,["five-shadows:fs-01","five-shadows:fs-02","five-shadows:fs-05"]);
  // A victory must leave a repeat action, and replay must use the real squad.
  assert.equal(await page.locator("#loreRequiredResultRetry").isVisible(),true);
  const storedBeforeRepeat=await page.evaluate(()=>localStorage.getItem("ashes-throne.lore-campaign.v1"));
  await page.locator("#loreRequiredResultRetry").click();
  await page.locator("#squad").waitFor({state:"visible",timeout:15000});
  assert.equal(await page.locator("#squadTacticalBrief").isVisible(),true);
  await page.locator("#squadBack").click();
  await page.locator('.lore-list-node[data-lore-node="five-shadows:fs-05"]').click();
  assert.equal(await page.locator('.lore-node-detail [data-lore-action="replay-battle"]').count(),1);
  assert.equal(await page.evaluate(()=>localStorage.getItem("ashes-throne.lore-campaign.v1")),storedBeforeRepeat,
   "Replay cancel must not touch the lore save");
  assert.equal(await page.locator('.lore-list-node[data-lore-node="five-shadows:fs-06"]').evaluate(el=>el.classList.contains("lore-state-available")),true);
  await page.reload({waitUntil:"load"});
  await page.locator('#home .hq-bottom button[data-screen="campaign"]').evaluate(el=>el.click());
  await page.locator('[data-campaign-path="lore"]').click();
  await page.locator(".lore-story-cover").click();
  assert.equal(await page.locator('.lore-list-node[data-lore-node="five-shadows:fs-06"]').evaluate(el=>el.classList.contains("lore-state-available")),true);
  await page.locator('.lore-list-node[data-lore-node="five-shadows:fs-05"]').click();
  assert.equal(await page.locator('.lore-node-detail [data-lore-action="replay-battle"]').count(),1);
  const size=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(size.scroll<=size.width+1);
  assert.deepEqual(errors.filter(e=>/LoreCampaign|TypeError|ReferenceError/.test(e)),[]);
  console.log("FS05 real tactical battle",tag,"PASS",JSON.stringify({setup,battle,size}));
 }catch(e){
  await page.screenshot({path:path.join(out,tag+"-failed.png"),fullPage:true}).catch(()=>{});
  console.error("FS05 real tactical battle",tag,"FAIL",errors);throw e;
 }finally{await browser.close();}
}
(async()=>{
 await run("chromium",chromium,932,430);
 await run("webkit",webkit,844,390);
})().catch(e=>{console.error(e);process.exitCode=1;});
