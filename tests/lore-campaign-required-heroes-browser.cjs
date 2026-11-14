"use strict";
/* LC-007: real squad picker + Babylon battle with Ren and Nada mandatory.
   Synthetic narrative data avoids leaking the private FS-01 story to public CI. */
const assert=require("node:assert/strict");
const {chromium,webkit}=require("playwright");
const fs=require("node:fs"),path=require("node:path");
const out=path.join(process.cwd(),"artifacts","lore-required-heroes");
fs.mkdirSync(out,{recursive:true});
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765";
async function inject(page){
 await page.addScriptTag({url:"/tests/lore-campaign-003-fixture.js"});
 await page.evaluate(()=>{
  const x=LoreCampaign003Fixture.create(LoreCampaignData);
  x.graph.nodes[0].requiredBattleId="fs01-squad-lock-test";
  const old=document.querySelector("#loreCampaignRoot"),root=document.createElement("div");
  root.id="loreCampaignRoot";root.className="lore-map-app";old.replaceWith(root);
  if(!LoreCampaignUI.mount(root,x.data,LoreCampaignCore,{
   pack:x.pack,scripts:LoreCampaignScenes,engine:LoreCampaignSceneCore,
   save:LoreCampaignSceneSave,runtime:LoreCampaignSceneRuntime,
   storage:localStorage,
   onStartRequiredBattle:openLoreRequiredBattle,
  }))throw Error("LORE_SQUAD_FIXTURE_MOUNT_FAILED");
 });
}
async function enterRequiredSquad(page){
 await page.locator('[data-lore-action="required-battle"]').click();
 await page.locator("#squad").waitFor({state:"visible",timeout:12000});
}
async function prepareStory(page){
 await page.locator('#home .hq-bottom button[data-screen="campaign"]').evaluate(el=>el.click());
 await page.locator('[data-campaign-path="lore"]').click();
 await inject(page);
 await page.locator(".lore-story-cover").click();
 await page.locator('[data-lore-action="start-node"]').click();
 await page.locator('[data-lore-action="scene-next"]').click();
 await page.locator('[data-lore-action="scene-next"]').click();
 await page.locator('[data-lore-choice="left"]').click();
 await page.locator('[data-lore-action="scene-next"]').click();
 await page.locator('[data-lore-action="scene-finish"]').click();
}
async function state(page){
 return page.evaluate(()=>({
  normal:[selectedLeaderId,...selectedPartyIds],
  lore:loreSquadSlots?.slice()||null,
  squadReturnScreen,
  savedFormation:localStorage.getItem(SQUAD_SAVE_KEY),
  wallet:JSON.stringify(progress),
  campaign:JSON.stringify(campaignProgress),
  loreSave:localStorage.getItem("ashes-throne.lore-campaign.v1")
 }));
}
async function run(name,type,w,h){
 const args=name==="chromium"?{headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-dev-shm-usage"]}:{headless:true};
 const browser=await type.launch(args);
 const page=await browser.newPage({viewport:{width:w,height:h},hasTouch:true});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 const tag=name+"-"+w+"x"+h;
 try{
  await page.goto(origin,{waitUntil:"load",timeout:60000});
  await prepareStory(page);
  const baseline=await state(page);
  await enterRequiredSquad(page);
  assert.equal(await page.locator("#squadIntro").innerText(),
   "«Пять теней»: Рен и Нада обязательны. Остальных героев выбираешь ты.");
  const mandatory=page.locator("#squadRoster [data-squad-required=true]");
  assert.equal(await mandatory.count(),2,"Exactly Ren/Nada mandatory");
  for(const id of ["ren","nada"]){
   const button=page.locator('#squadRoster [data-hero-id="'+id+'"]');
   assert.equal(await button.getAttribute("aria-disabled"),"true");
   assert.equal(await button.getAttribute("aria-pressed"),"true");
   assert.match(await button.innerText(),/ОБЯЗАТЕЛЬНЫЙ/);
   await button.click();
   assert.equal(await button.getAttribute("aria-pressed"),"true",
    "Click cannot deselect mandatory hero "+id);
  }
  assert.deepEqual((await state(page)).normal,baseline.normal);
  // Clearing all optional slots must never remove the two mandatory heroes.
  await page.locator("#squadDisband").click();
  const empty=await state(page);
  assert.deepEqual(empty.lore.filter(Boolean).sort(),["nada","ren"]);
  assert.deepEqual(empty.normal,baseline.normal,"Normal formation is untouched");
  assert.equal(empty.savedFormation,baseline.savedFormation,"Never write normal squad save");
  assert.equal(await page.locator("#squadCount").innerText(),"2/5");
  // Optional allies are still freely selectable.
  const extras=page.locator('#squadRoster .squad-choice:not(.chosen):not([disabled])');
  let added=0;
  while(await extras.count()&&added++<3)await extras.first().click();
  assert.equal(await page.locator("#squadCount").innerText(),"5/5");
  const chosen=await state(page);
  assert.ok(chosen.lore.includes("ren")&&chosen.lore.includes("nada"));
  const geometry=await page.evaluate(()=>({
   width:innerWidth,scroll:document.documentElement.scrollWidth,
   renHeight:document.querySelector('[data-hero-id="ren"].squad-choice').getBoundingClientRect().height,
   nadaHeight:document.querySelector('[data-hero-id="nada"].squad-choice').getBoundingClientRect().height
  }));
  assert.ok(geometry.scroll<=geometry.width+1,"No horizontal overflow: "+JSON.stringify(geometry));
  assert.ok(geometry.renHeight>=44&&geometry.nadaHeight>=44,"Mandatory targets touch-sized");
  await page.screenshot({path:path.join(out,tag+"-required-squad.png"),fullPage:true});
  // Back out, return to story, repeat: the same two heroes must be inserted.
  await page.locator("#squadBack").click();
  assert.equal(await page.locator("#campaignLoreContent").isVisible(),true);
  assert.equal((await state(page)).lore,null);
  assert.deepEqual((await state(page)).normal,baseline.normal);
  await page.locator(".lore-list-node").first().click();
  await enterRequiredSquad(page);
  assert.equal(await page.locator("#squadRoster [data-squad-required=true]").count(),2);
  assert.equal(await page.locator("#squadCount").innerText(),"5/5");
  await page.locator("#squadStart").click();
  await page.locator("#battle").waitFor({state:"visible",timeout:30000});
  const combat=await page.evaluate(()=>({
   mandatory:battleIsLoreRequired,
   fighters:state.fighters.filter(f=>f.side==="ally").map(f=>f.id),
   gpu:!!engine&&!!scene
  }));
  assert.equal(combat.mandatory,true);
  assert.equal(combat.gpu,true);
  assert.ok(combat.fighters.includes("ren")&&combat.fighters.includes("nada"));
  assert.equal(new Set(combat.fighters).size,combat.fighters.length);
  await page.locator("#autoBattleBtn").click();
  await page.locator("#loreRequiredBattleResult").waitFor({state:"visible",timeout:145000});
  assert.equal(await page.locator("#loreRequiredResultTitle").innerText(),"Бой выигран");
  await page.locator("#loreRequiredResultContinue").click();
  assert.equal(await page.locator("#campaignLoreContent").isVisible(),true);
  const after=await state(page);
  assert.deepEqual(after.normal,baseline.normal);
  assert.equal(after.savedFormation,baseline.savedFormation);
  assert.equal(after.wallet,baseline.wallet);
  assert.equal(after.campaign,baseline.campaign);
  assert.deepEqual(JSON.parse(after.loreSave).stories["five-shadows"].battleClearedNodeIds,
   ["five-shadows:fs-01"]);
  // Ordinary battle: no required badges, saved global formation still applied.
  await page.evaluate(()=>openSquad("home"));
  assert.equal(await page.locator("#squadRoster [data-squad-required]").count(),0);
  assert.equal((await state(page)).lore,null);
  assert.deepEqual((await state(page)).normal,baseline.normal);
  assert.deepEqual(errors.filter(e=>/LORE_SQUAD|TypeError|ReferenceError/.test(e)),[],
   "No JS exceptions in narrative / squad / real Babylon battle");
  console.log("LC007 REAL REQUIRED SQUAD",tag,"PASS",JSON.stringify({combat,geometry}));
 }catch(error){
  await page.screenshot({path:path.join(out,tag+"-failure.png"),fullPage:true}).catch(()=>{});
  console.error("LC007 FAILURE",tag,errors);
  throw error;
 }finally{await browser.close();}
}
(async()=>{
 for(const [name,type] of [["chromium",chromium],["webkit",webkit]])
  for(const [w,h] of [[844,390],[932,430]])await run(name,type,w,h);
})().catch(e=>{console.error(e);process.exitCode=1;});
