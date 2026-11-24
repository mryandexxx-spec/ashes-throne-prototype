"use strict";
/* RECOVER3D: end-to-end checks use actual Babylon GLBs, not PNG previews.
 * WebKit emulation in CI is not a test on physical iPhone Safari.
 */
const assert=require("node:assert/strict");
const {chromium,webkit}=require("playwright");
const fs=require("node:fs"),path=require("node:path");
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
fs.mkdirSync(path.join(process.cwd(),"artifacts","squad-recovery"),{recursive:true});
async function check(browserName,engine,viewport){
 const browser=await engine.launch(browserName==="chromium"?{
  headless:true,args:["--no-sandbox","--use-angle=swiftshader","--enable-webgl","--disable-dev-shm-usage"]
 }:{headless:true});
 const page=await browser.newPage({viewport,hasTouch:true}),errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 try{
  await page.goto(origin+(origin.includes("?")?"&":"?")+"skipFirstPlay=1",{waitUntil:"load",timeout:60000});
  await page.waitForFunction(()=>typeof openSquad==="function"&&typeof SquadStage3D!=="undefined",null,{timeout:60000});
  await page.evaluate(()=>{
   setSquadSlots(["ren","nada","liora","art","sava"]);
   openSquad("home");
  });
  await page.locator("#squad.active").waitFor({state:"visible"});
  await page.waitForFunction(()=>{
   const slots=document.querySelectorAll("#squadSlots .squad-slot[data-model-id]");
   return slots.length===5&&[...slots].every(el=>el.classList.contains("squad-model-live"));
  },null,{timeout:90000});
  const stats=await page.evaluate(()=>{
   const canvas=document.querySelector("#squad .squad-stage-canvas");
   const engines=BABYLON.EngineStore.Instances.filter(e=>e.getRenderingCanvas?.()===canvas);
   const squad=document.querySelector("#squad").getBoundingClientRect();
   const main=document.querySelector("#squadSlots").getBoundingClientRect();
   const roster=document.querySelector("#squadRoster").getBoundingClientRect();
   return {
    engines:engines.length,
    canvas:canvas?.width||0,
    meshes:engines[0]?.scenes?.[0]?.meshes?.filter(m=>m.getTotalVertices?.()>0).length||0,
    models:[...document.querySelectorAll("#squadSlots [data-model-id]")].map(el=>el.dataset.modelId),
    horizontal:document.documentElement.scrollWidth>innerWidth+1,
    vertical:document.documentElement.scrollHeight>innerHeight+1,
    main:{x:main.x,w:main.width,h:main.height},
    roster:{x:roster.x,w:roster.width,h:roster.height},
    squad:{top:squad.top,bottom:squad.bottom}
   };
  });
  assert.equal(stats.engines,1,"exactly one Babylon engine for all five models");
  assert.ok(stats.canvas>100&&stats.meshes>=5,"actual five GLBs, not image-only presentation");
  assert.deepEqual(stats.models,["ren","nada","liora","art","sava"]);
  assert.equal(stats.horizontal,false,"no horizontal overflow");
  assert.equal(stats.vertical,false,"squad fits landscape without page scroll");
  assert.ok(stats.main.x>stats.roster.x+stats.roster.w*.7,"five model slots to right of roster");
  assert.ok(stats.main.h>=95&&stats.squad.bottom<=viewport.height+1);
  // Regression: the old test only counted GLBs, so a hero visible in
  // slot FIVE while assigned to slot ONE could falsely pass.
  async function checkVisualSlotAlignment(){
   const centers=await page.evaluate(()=>{
    const stage=document.querySelector("#squadSlots");
    const engine=BABYLON.EngineStore.Instances.find(e=>e.getRenderingCanvas?.()===stage.querySelector("canvas"));
    const scene=engine?.scenes?.[0],camera=scene?.activeCamera;
    if(!scene||!camera)return [];
    scene.render();
    const stageRect=stage.getBoundingClientRect();
    return [...stage.querySelectorAll(".squad-slot[data-model-id]")].map(slot=>{
     const holder=scene.getTransformNodeByName("squadHero-"+slot.dataset.modelId);
     const meshes=holder?.getChildMeshes?.(false).filter(m=>m.getTotalVertices?.()>0)||[];
     if(!meshes.length)return {id:slot.dataset.modelId,error:Infinity,width:0};
     let low=new BABYLON.Vector3(Infinity,Infinity,Infinity);
     let high=new BABYLON.Vector3(-Infinity,-Infinity,-Infinity);
     for(const mesh of meshes){
      mesh.computeWorldMatrix(true);
      const box=mesh.getBoundingInfo().boundingBox;
      low=BABYLON.Vector3.Minimize(low,box.minimumWorld);
      high=BABYLON.Vector3.Maximize(high,box.maximumWorld);
     }
     const centre=low.add(high).scale(.5);
     const pixel=BABYLON.Vector3.Project(centre,BABYLON.Matrix.Identity(),
      scene.getTransformMatrix(),camera.viewport.toGlobal(engine.getRenderWidth(),engine.getRenderHeight()));
     const projectedX=stageRect.left+pixel.x/engine.getRenderWidth()*stageRect.width;
     const viewport=camera.viewport.toGlobal(engine.getRenderWidth(),engine.getRenderHeight());
     const top=BABYLON.Vector3.Project(new BABYLON.Vector3(centre.x,high.y,centre.z),
      BABYLON.Matrix.Identity(),scene.getTransformMatrix(),viewport);
     const bottom=BABYLON.Vector3.Project(new BABYLON.Vector3(centre.x,low.y,centre.z),
      BABYLON.Matrix.Identity(),scene.getTransformMatrix(),viewport);
     const rect=slot.getBoundingClientRect();
     return {id:slot.dataset.modelId,index:Number(slot.dataset.squadIndex),
      projectedX,slotX:rect.left+rect.width/2,error:Math.abs(projectedX-(rect.left+rect.width/2)),width:rect.width,
      projectedHeight:Math.abs(top.y-bottom.y)*stageRect.height/engine.getRenderHeight(),stageHeight:stageRect.height};
    });
   });
   console.log("SQUADUX_MODEL_PROJECTIONS",browserName,viewport,centers);
   assert.ok(centers.length>0&&centers.every(x=>Number.isFinite(x.error)&&x.error<x.width*.7),
    "each real GLB must visually occupy its designated slot, not another card");
   assert.ok(centers.every(x=>x.projectedHeight>x.stageHeight*1.2),
    "full 3D figure extends beyond the viewport: torso fills the card, legs are cropped");
  }
  await checkVisualSlotAlignment();
  const bottomLabels=await page.evaluate(()=>[...document.querySelectorAll("#squadSlots .squad-slot.filled")].map(slot=>{
   const p=slot.querySelector(".squad-slot-progress")?.getBoundingClientRect();
   const name=slot.querySelector(".squad-slot-content")?.getBoundingClientRect();
   const rect=slot.getBoundingClientRect();
   return {bottomOffset:p?rect.bottom-p.bottom:999,belowName:Boolean(p&&name&&p.top>=name.bottom-2)};
  }));
  assert.equal(bottomLabels.length,5);
  assert.ok(bottomLabels.every(x=>x.bottomOffset>=0&&x.bottomOffset<12&&x.belowName),
   "level, stars and gear tier are aligned below the hero name at card bottom");
  await page.screenshot({path:path.join("artifacts","squad-recovery",
   browserName+"-"+viewport.width+"x"+viewport.height+"-busts.png")});
  for(const id of ["ren","nada","liora","art","sava"])
   assert.equal(await page.locator('#squadRoster .squad-choice[data-hero-id="'+id+'"]').count(),0,
    "selected hero "+id+" must disappear from roster");
  assert.match(await page.locator("#squadHint").innerText(),/бонуса лидера нет/i,
   "Ren has no leader skill: show truthful warning");
  assert.equal(await page.locator("#squadLeaderSkillButton").isVisible(),false);
  await page.locator('#squadSlots .squad-slot[data-squad-index="0"]').tap();
  assert.equal(await page.locator('#squadRoster .squad-choice[data-hero-id="ren"]').count(),1,
   "tapping occupied slot returns hero to roster");
  assert.equal(await page.locator('#squadSlots .squad-slot[data-model-id="ren"]').count(),0);
  assert.equal(await page.locator('#squadSlots .squad-slot[data-squad-index="1"][data-model-id="nada"]').count(),1,
   "removing a leader does not shift remaining formation");
  await page.locator('#squadRoster .squad-choice[data-hero-id="ren"]').tap();
  assert.equal(await page.locator('#squadRoster .squad-choice[data-hero-id="ren"]').count(),0);
  assert.equal(await page.locator('#squadSlots .squad-slot[data-squad-index="0"][data-model-id="ren"]').count(),1);
  await page.locator("#squadDisband").tap();
  assert.equal(await page.locator("#squadRoster .squad-choice[data-hero-id='liora']").count(),1);
  await page.locator('#squadRoster .squad-choice[data-hero-id="liora"]').tap();
  assert.equal(await page.locator('#squadSlots .squad-slot[data-squad-index="0"][data-model-id="liora"]').count(),1);
  assert.equal(await page.locator('#squadSlots .squad-slot[data-squad-index="4"][data-model-id]').count(),0,
   "selecting first hero must not fill last slot");
  assert.equal(await page.locator('#squadRoster .squad-choice[data-hero-id="liora"]').count(),0);
  assert.match(await page.locator('#squadSlots .squad-slot[data-model-id="liora"]').innerText(),/Ур\.\s*\d+.*★\d+.*G\d+/);
  assert.equal(await page.locator("#squadLeaderSkillName").innerText(),"Опора отряда");
  await page.locator("#squadLeaderSkillButton").dispatchEvent("pointerdown",{pointerType:"touch"});
  // A busy WebGL frame can delay the 500 ms long-press timer. Wait for the
  // real DOM state instead of sampling once at exactly 560 ms.
  await page.waitForFunction(()=>!document.querySelector("#squadLeaderTooltip").hidden,null,{timeout:10000});
  assert.equal(await page.locator("#squadLeaderTooltip").isVisible(),true,
   "long touch opens actual leader description");
  assert.match(await page.locator("#squadLeaderTooltipDescription").innerText(),/Protection/);
  await page.locator("#squadLeaderSkillButton").dispatchEvent("pointerup",{pointerType:"touch"});
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#squadLeaderTooltip").isVisible(),false);
  await page.waitForFunction(()=>{
   const slot=document.querySelector('#squadSlots .squad-slot[data-model-id="liora"]');
   return slot?.classList.contains("squad-model-live");
  },null,{timeout:90000});
  await checkVisualSlotAlignment();
  await page.locator('#squadSlots .squad-slot[data-model-id="liora"]').tap();
  assert.equal(await page.locator('#squadRoster .squad-choice[data-hero-id="liora"]').count(),1);
  const file=path.join("artifacts","squad-recovery",browserName+"-"+viewport.width+"x"+viewport.height+".png");
  await page.screenshot({path:file});
  await page.evaluate(()=>showScreen("home"));
  await page.waitForFunction(()=>!document.querySelector("#squad").classList.contains("active"));
  assert.equal(await page.locator("#squad").isVisible(),false,"inactive squad is hidden");
  const freed=await page.evaluate(()=>!BABYLON.EngineStore.Instances.some(e=>e.getRenderingCanvas?.()?.classList?.contains("squad-stage-canvas")));
  assert.equal(freed,true,"squad 3D disposed on exit");
  await page.evaluate(()=>showScreen("network"));
  assert.equal(await page.locator("#network").isVisible(),true,"network appears normally after squad");
  assert.equal(await page.locator("#squad").isVisible(),false,"network is not covered by squad");
  assert.deepEqual(errors,[],"page errors");
  console.log("RECOVER3D_BROWSER_PASS",browserName,viewport,stats);
 }catch(error){
  console.error("RECOVER3D_BROWSER_FAIL",browserName,viewport,errors);
  await page.screenshot({path:path.join("artifacts","squad-recovery",browserName+"-"+viewport.width+"-fail.png"),fullPage:true}).catch(()=>{});
  throw error;
 }finally{await browser.close();}
}
(async()=>{
 for(const [name,engine] of [["chromium",chromium],["webkit",webkit]])
  for(const viewport of [{width:844,height:390},{width:932,height:430}])
   await check(name,engine,viewport);
 // FIRSTPLAY001: independent real first-boot/hold/reset coverage, using the
 // existing squad browser job to preserve the selective CI workflow.
 require("node:child_process").execFileSync(process.execPath,
  [require.resolve("./first-play-browser.cjs")],
  {stdio:"inherit",timeout:480000});
})().catch(error=>{console.error(error);process.exitCode=1;});
