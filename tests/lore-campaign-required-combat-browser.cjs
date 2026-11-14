"use strict";
/* Synthetic browser fixture: isolated gate UI and persistent win receipt. Real WebGL
   battle is separately exercised by the private full-game integration test. */
const assert=require("node:assert/strict");
const {chromium,webkit}=require("playwright");
const fs=require("node:fs"),path=require("node:path");
const out=path.join(process.cwd(),"artifacts/lore-campaign-required");
fs.mkdirSync(out,{recursive:true});
const origin="http://127.0.0.1:8765";
async function inject(page){
 await page.addScriptTag({url:"/tests/lore-campaign-003-fixture.js"});
 await page.evaluate(()=>{
  const x=LoreCampaign003Fixture.create(LoreCampaignData);
  x.graph.nodes[0].requiredBattleId="fs01-approach-combat";
  x.graph.nodes[0].requiredBattleNarrative={
   title:"Тестовое столкновение",
   intro:"Слышны чужие шаги у поворота. Ничего канонического здесь не утверждается.",
   lines:[
    {speakerId:"Рен Терен",text:"— С прохода сойди."},
    {speakerId:"Нада",text:"— Сумку не трогай."}
   ],
   victory:"Победа на арене записана.",
   defeat:"Без победы следующий узел не откроется."
  };
  x.graph.nodes[1].requiredBattleId="fs02-evidence-combat";
  const old=document.querySelector("#loreCampaignRoot"),root=document.createElement("div");
  root.id="loreCampaignRoot";root.className="lore-map-app";old.replaceWith(root);
  window.__requiredStart=null;
  if(!LoreCampaignUI.mount(root,x.data,LoreCampaignCore,{
   pack:x.pack,scripts:LoreCampaignScenes,engine:LoreCampaignSceneCore,
   save:LoreCampaignSceneSave,runtime:LoreCampaignSceneRuntime,
   storage:window.localStorage,
   onStartRequiredBattle:context=>{window.__requiredStart=context;return true;},
   onStartTraining:()=>{throw Error("Legacy training must be hidden in required-battle pilot");}
  }))throw Error("GATE_FIXTURE_MOUNT_FAILED");
 });
}
async function open(page){
 await page.locator('#home .hq-bottom button[data-screen="campaign"]').evaluate(el=>el.click());
 await page.locator('[data-campaign-path="lore"]').click();
 await inject(page);
 await page.locator(".lore-story-cover").click();
}
async function run(name,type,w,h){
 const b=await type.launch({headless:true});
 const page=await b.newPage({viewport:{width:w,height:h},hasTouch:true});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 const tag=name+"-"+w+"x"+h;
 try{
  await page.goto(origin,{waitUntil:"domcontentloaded"});
  await open(page);
  assert.equal(await page.locator('[data-lore-action="training-battle"]').count(),0);
  assert.equal(await page.locator('[data-lore-action="required-battle"]').count(),0,
   "Cannot enter combat before completing scene");
  await page.locator('[data-lore-action="start-node"]').click();
  await page.locator('[data-lore-action="scene-next"]').click();
  await page.locator('[data-lore-action="scene-next"]').click();
  await page.locator('[data-lore-choice="left"]').click();
  await page.locator('[data-lore-action="scene-next"]').click();
  await page.locator('[data-lore-action="scene-finish"]').click();
  assert.match(await page.locator(".lore-scene-result").innerText(),/Тестовое столкновение/);
  assert.equal(await page.locator(".lore-battle-voice img").count(),2);
  const layout=await page.evaluate(()=>{
   const root=document.querySelector("#campaignLoreContent");
   const rect=document.querySelector(".lore-scene-result").getBoundingClientRect();
   return {lock:document.body.classList.contains("lore-scene-open"),
    fixed:getComputedStyle(root).position,
    width:document.documentElement.scrollWidth,viewport:innerWidth,
    height:rect.height,bottom:rect.bottom};
  });
  assert.equal(layout.lock,true,"Narrated briefing should lock page scrolling");
  assert.equal(layout.fixed,"fixed","Narrated briefing should cover the landscape viewport");
  assert.ok(layout.width<=layout.viewport+1,"No horizontal overflow: "+JSON.stringify(layout));
  assert.ok(layout.bottom<=h+1,"Briefing fits height: "+JSON.stringify(layout));
  const action=page.locator('[data-lore-action="required-battle"]');
  assert.equal(await action.count(),1);
  const box=await action.boundingBox();
  assert.ok(box&&box.height>=44,tag+" combat action touch size");
  await page.screenshot({path:path.join(out,tag+"-mandatory-battle-entry.png"),fullPage:true});
  await action.click();
  const attempt=await page.evaluate(()=>window.__requiredStart);
  assert.equal(attempt.nodeId,"five-shadows:fs-01");
  assert.equal(attempt.battleId,"fs01-approach-combat");
  const denied=await page.evaluate(()=>LoreCampaignUI.recordBattleVictory(
   "five-shadows:fs-01","unknown-encounter"));
  assert.equal(denied.code,"INVALID_BATTLE");
  const unlock=await page.evaluate(()=>LoreCampaignUI.recordBattleVictory(
   "five-shadows:fs-01","fs01-approach-combat"));
  assert.equal(unlock.ok,true);
  assert.equal(await page.locator('[data-lore-action="required-battle"]').count(),0);
  await page.locator('[data-lore-action="leave-result"]').click();
  await page.locator(".lore-list-node").nth(1).click();
  assert.match(await page.locator(".lore-node-detail").innerText(),/Доступно/);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem("ashes-throne.lore-campaign.v1")).stories["five-shadows"].battleClearedNodeIds[0]),"five-shadows:fs-01");
  const viewport=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
  assert.ok(viewport.scroll<=viewport.width+1,tag+" no overflow");
  await page.screenshot({path:path.join(out,tag+"-next-node-unlocked.png"),fullPage:true});
  assert.deepEqual(errors.filter(x=>/GATE_FIXTURE|LoreCampaign/.test(x)),[]);
  console.log("LC005 gate browser",tag,"PASS",JSON.stringify({viewport,attempt}));
 }catch(e){
  await page.screenshot({path:path.join(out,tag+"-failure.png"),fullPage:true}).catch(()=>{});
  console.error("LC005 browser failure",tag,errors);throw e;
 }finally{await b.close();}
}
(async()=>{
 for(const [n,t] of [["chromium",chromium],["webkit",webkit]])
  for(const [w,h] of [[844,390],[932,430]])await run(n,t,w,h);
})().catch(e=>{console.error(e);process.exitCode=1;});
