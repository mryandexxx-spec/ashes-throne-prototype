"use strict";
/* LOREPLAY001 public playable proposal: real 3D battles between FS-01, FS-02, FS-03.
   Owner authorized game-only adaptation; this is NOT literary canon. */
const assert=require("node:assert/strict");
const {chromium,webkit}=require("playwright");
const fs=require("node:fs"),path=require("node:path");
const out=path.join(process.cwd(),"artifacts","lore-public-pilot");
fs.mkdirSync(out,{recursive:true});
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
async function playScene(page){
 let clicks=0,inspections=0,comparisons=0;
 while(await page.locator(".lore-scene").count()){
  if(++clicks>150)throw Error("NARRATIVE_STALLED");
  let used=false;
  const inspect=page.locator('[data-lore-action="scene-inspect"]');
  for(let i=0;i<await inspect.count();i++){
   if(!(await inspect.nth(i).innerText()).trim().startsWith("✓")){
    await inspect.nth(i).click();inspections++;used=true;break;
   }
  }if(used)continue;
  const compare=page.locator('[data-lore-action="scene-compare"]');
  for(let i=0;i<await compare.count();i++){
   if(await compare.nth(i).isEnabled()&&!(await compare.nth(i).innerText()).trim().startsWith("✓")){
    await compare.nth(i).click();comparisons++;used=true;break;
   }
  }if(used)continue;
  const pageNext=page.locator('[data-lore-action="scene-page-next"]:not([disabled])');
  if(await pageNext.count()){await pageNext.first().click();continue;}
  const choice=page.locator('[data-lore-action="scene-choose"]:not([disabled])');
  if(await choice.count()){await choice.first().click();continue;}
  const next=page.locator('[data-lore-action="scene-next"]:not([disabled])');
  if(await next.count()){await next.click();continue;}
  const finish=page.locator('[data-lore-action="scene-finish"]:not([disabled])');
  if(await finish.count()){await finish.click();return {clicks,inspections,comparisons};}
  throw Error("NO_INTERACTIVE_EXIT");
 }
 throw Error("CLOSED_BEFORE_FINISH");
}
async function fight(page,tag,index){
 const ready=page.locator('[data-lore-action="required-battle"]');
 assert.equal(await ready.count(),1,tag+" required battle after scene "+index);
 const bridge=page.locator(".lore-battle-result-brief");
 assert.equal(await bridge.count(),1,"Narrated story bridges must appear before every fight");
 const full=await bridge.innerText();
 assert.ok(full.includes(index===1?"Чужой маршрут":"Право на свидетельство"),"Bridge title identifies encounter");
 assert.equal(await bridge.locator(".lore-battle-voice img").count(),2,"Both existing portraits shown");
 const viewport=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,
  overlay:document.body.classList.contains("lore-scene-open")}));
 assert.ok(viewport.scroll<=viewport.width+1,"No horizontal overflow in narrated landscape");
 assert.equal(viewport.overlay,true,"Battle briefing keeps fullscreen landscape shell");
 const button=await ready.boundingBox();
 assert.ok(button&&button.height>=44,"Mandatory action is thumb-sized");
 await page.screenshot({path:path.join(out,tag+"-gate-"+index+".png"),fullPage:true});
 await ready.click();
 await page.locator("#squad").waitFor({state:"visible",timeout:12000});
 // LC-007: regular picker stays open, Ren + Nada are mandatory (cannot remove)
 // while the player may fill the other three positions normally.
 for(const id of ["ren","nada"]){
  const button=page.locator('#squadRoster [data-hero-id="'+id+'"]');
  assert.equal(await button.getAttribute("data-squad-required"),"true");
  assert.equal(await button.getAttribute("aria-disabled"),"true");
  assert.equal(await button.getAttribute("aria-pressed"),"true");
  assert.equal(await page.evaluate(heroId=>toggleSquadHero(heroId),id),false);
 }
 await page.locator("#squadDisband").click();
 assert.equal(await page.locator("#squadCount").innerText(),"2/5",
  "Disband clears only the optional slots");
 const choices=page.locator("#squadRoster .squad-choice:not([disabled]):not(.chosen)");
 let picked=0;
 while(await choices.count()&&picked++<5)await choices.first().click();
 assert.equal(await page.locator("#squadCount").innerText(),"5/5");
 await page.screenshot({path:path.join(out,tag+"-squad-"+index+".png"),fullPage:true});
 await page.locator("#squadStart").click();
 if(await page.locator("#squad").isVisible())await page.locator("#squadStart").click();
 await page.locator("#battle").waitFor({state:"visible",timeout:30000});
 const combat=await page.evaluate(()=>({
  mandatory:battleIsLoreRequired,training:battleIsLoreTraining,campaign:battleIsCampaign,
  fighters:state.fighters.map(f=>f.name),
  gpu:!!scene&&!!engine,
  label:document.querySelector("#battleMissionLabel").textContent
 }));
 assert.equal(combat.mandatory,true);
 assert.equal(combat.training,false);
 assert.equal(combat.campaign,false);
 assert.equal(combat.gpu,true);
 assert.match(combat.label,/ОБЯЗАТЕЛЬНЫЙ БОЙ/);
 assert.ok(combat.fighters.some(name=>name.startsWith("Игровой противник")));
 await page.screenshot({path:path.join(out,tag+"-arena-"+index+".png"),fullPage:true});
 await page.locator("#autoBattleBtn").click();
 await page.locator("#loreRequiredBattleResult").waitFor({state:"visible",timeout:145000});
 assert.equal(await page.locator("#loreRequiredResultTitle").innerText(),"Бой выигран",
  tag+" must win and save real battle before next node");
 const aftermath=await page.locator("#loreRequiredResultText").innerText();
 assert.ok(aftermath.includes(index===1?"Люди с фонарём отошли":"Под вечер Рен и Нада добрались"),
  "Win has a distinct causal consequence in the game version");
 assert.equal(await page.locator("#loreRequiredResultRetry").isVisible(),true,
  "A cleared story battle can now be replayed for practice");
 const cleared=await page.evaluate(()=>JSON.parse(localStorage.getItem("ashes-throne.lore-campaign.v1"))
  .stories["five-shadows"].battleClearedNodeIds.slice());
 assert.equal(cleared.length,index);
 await page.locator("#loreRequiredResultContinue").click();
 await page.locator(".lore-map-marker").first().waitFor({state:"visible"});
 return {combat,cleared};
}
async function run(name,type){
 const b=await type.launch(name==="chromium"?
  {headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-dev-shm-usage"]}:
  {headless:true});
 const page=await b.newPage({viewport:{width:932,height:430},hasTouch:true});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 try{
  await page.goto(origin,{waitUntil:"load",timeout:60000});
  await page.locator('#home .hq-bottom button[data-screen="campaign"]').evaluate(el=>el.click());
  await page.locator('[data-campaign-path="lore"]').click();
  await page.locator(".lore-story-cover").click();
  assert.equal(await page.locator('[data-lore-action="training-battle"]').count(),1,
   "Optional training remains available but cannot replace mandatory victories");
  const before=await page.evaluate(()=>({
   wallet:JSON.stringify(progress),
   training:JSON.stringify(campaignProgress),
   globalSquad:JSON.stringify([selectedLeaderId,...selectedPartyIds]),
   savedSquad:localStorage.getItem(SQUAD_SAVE_KEY)
  }));
  const steps=[],battles=[];
  for(let i=0;i<3;i++){
   await page.locator(".lore-list-node").nth(i).click();
   if(i>0)assert.ok((await page.locator(".lore-node-detail").innerText()).includes("Доступно"));
   await page.locator('[data-lore-action="start-node"]').click();
   steps.push(await playScene(page));
   if(i<2)battles.push(await fight(page,name,i+1));
   else await page.locator('[data-lore-action="leave-result"]').click();
  }
  const after=await page.evaluate(()=>({
   wallet:JSON.stringify(progress),training:JSON.stringify(campaignProgress),
   globalSquad:JSON.stringify([selectedLeaderId,...selectedPartyIds]),
   savedSquad:localStorage.getItem(SQUAD_SAVE_KEY),
   lore:JSON.parse(localStorage.getItem("ashes-throne.lore-campaign.v1")).stories["five-shadows"],
   scroll:document.documentElement.scrollWidth,width:innerWidth
  }));
  assert.equal(after.wallet,before.wallet,"No wallet or energy effect");
  assert.equal(after.training,before.training,"No normal campaign progress changed");
  assert.equal(after.globalSquad,before.globalSquad,"The ordinary squad remains unchanged");
  assert.equal(after.savedSquad,before.savedSquad,"No changes to normal squad save");
  assert.deepEqual(after.lore.completedNodeIds,
   ["five-shadows:fs-01","five-shadows:fs-02","five-shadows:fs-03"]);
  assert.deepEqual(after.lore.battleClearedNodeIds,
   ["five-shadows:fs-01","five-shadows:fs-02"]);
  assert.ok(after.scroll<=after.width+1);
  await page.screenshot({path:path.join(out,name+"-three-scenes-two-victories.png"),fullPage:true});
  assert.deepEqual(errors.filter(e=>/LoreCampaign|TypeError|ReferenceError/.test(e)),[]);
  console.log("LOREPLAY001 PUBLIC FULL QUEST",name,"PASS",JSON.stringify({steps,battles,cleared:after.lore.battleClearedNodeIds}));
 }catch(e){
  await page.screenshot({path:path.join(out,name+"-failed.png"),fullPage:true}).catch(()=>{});
  console.error("LOREPLAY001 PUBLIC FULL QUEST FAILED",name,errors);throw e;
 }finally{await b.close();}
}
(async()=>{
 for(const [name,type] of [["chromium",chromium],["webkit",webkit]])await run(name,type);
})().catch(e=>{console.error(e);process.exitCode=1;});
