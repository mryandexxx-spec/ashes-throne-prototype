"use strict";
/* LIORA-SHIELD-004: real Babylon.js + actual GLB playback in Chromium/WebKit.
 * This test deliberately depends on CDN Babylon.js; it is NOT a mock renderer.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium,webkit}=require("playwright");
const engineName=process.env.LIORA_BROWSER==="webkit"?"webkit":"chromium";
const ordered=["Running","Walking","Alert","Block1","Catching_Breath","Dead",
 "Hit_Reaction","Idle_02","Shield_Push_Left","Squat_Stance",
 "Step_Forward_and_Push","Walk_Fight_Forward",
 "Liora_Shield_Block","Liora_Shield_Bash","Liora_Shield_Death"];
const outDir=path.join(process.cwd(),"artifacts/liora-shield",engineName);
fs.mkdirSync(outDir,{recursive:true});
(async()=>{
 const browser=await (engineName==="webkit"?webkit:chromium).launch(
  engineName==="webkit"?{headless:true}:{headless:true,args:[
   "--no-sandbox","--use-gl=angle","--use-angle=swiftshader",
   "--enable-webgl","--disable-dev-shm-usage"
  ]});
 try{
  const page=await browser.newPage({viewport:{width:844,height:390},
   deviceScaleFactor:1,hasTouch:true,isMobile:true});
  const pageErrors=[],consoleErrors=[],assetFailures=[];
  page.on("pageerror",error=>pageErrors.push(error.message));
  page.on("console",message=>{if(message.type()==="error")consoleErrors.push(message.text());});
  page.on("response",response=>{
   if(!response.ok()&&/babylon|\.glb($|\?)/i.test(response.url()))
    assetFailures.push(response.status()+" "+response.url());
  });
  const response=await page.goto("http://127.0.0.1:8765/liora-shield-lab.html",{waitUntil:"load",timeout:90000});
  assert.equal(response.status(),200);
  try {
   await page.waitForFunction(()=>{
    const msg=document.querySelector("#status")?.textContent||"";
    return msg.includes("Готово: 15 анимаций")||msg.startsWith("Ошибка лаборатории:");
   },null,{timeout:35000});
  }catch(error){
   const msg=await page.locator("#status").innerText().catch(()=>"(no status)");
   console.error("LIORA init timeout",JSON.stringify({msg,pageErrors,consoleErrors,assetFailures}));
   await page.screenshot({path:path.join(outDir,"startup-failure.png")}).catch(()=>{});
   throw error;
  }
  const readyMessage=await page.locator("#status").innerText();
  if(!readyMessage.includes("Готово: 15 анимаций")){
   console.error("LIORA init error",JSON.stringify({readyMessage,pageErrors,consoleErrors,assetFailures}));
   await page.screenshot({path:path.join(outDir,"startup-failure.png")}).catch(()=>{});
   throw Error("Liora lab initialization failed: "+readyMessage);
  }
  // Pause autoplay to make each frame deterministic.
  await page.click("#play");
  assert.equal(await page.locator("#play").innerText(),"Воспроизвести");
  const state=await page.evaluate(()=>{
   const engines=BABYLON.EngineStore.Instances, engine=engines.at(-1),
    scene=engine?.scenes?.[0];
   if(!scene)throw Error("No real Babylon Scene");
   const hand=scene.getTransformNodeByName("mixamorig:LeftHand");
   const socket=scene.getTransformNodeByName("lioraShieldSocket");
   const model=scene.meshes.filter(m=>m.getTotalVertices?.()>0);
   return {engineName:engine.getClassName?.()||engine.constructor.name,
    gl:!!engine._gl,hand:!!hand,socket:!!socket,
    attached:socket?.parent===hand,clipNames:scene.animationGroups.map(a=>a.name),
    meshCount:model.length,
    shieldVertices:model.find(m=>m.getTotalVertices()===4445)?.getTotalVertices()||0,
    sceneReady:scene.isReady(),webglVersion:engine.webGLVersion};
  });
  console.log("LIORA Babylon asset load",JSON.stringify(state));
  assert.ok(state.gl,"Must use real WebGL engine");
  assert.ok(state.webglVersion>=1);
  assert.ok(state.meshCount>=2);
  assert.equal(state.hand,true);
  assert.equal(state.socket,true);
  assert.equal(state.attached,true);
  assert.deepEqual(new Set(state.clipNames),new Set(ordered));
  const results=[];
  for(const clip of ordered){
   await page.selectOption("#clip",clip);
   const phases=[];
   for(const percent of [0,25,50,75,100]){
    await page.locator("#frame").evaluate((element,percent)=>{
     element.value=String(percent);element.dispatchEvent(new Event("input",{bubbles:true}));
    },percent);
    await page.waitForTimeout(100);
    const pose=await page.evaluate(()=>{
     const scene=BABYLON.EngineStore.Instances.at(-1).scenes[0];
     scene.render();
     const socket=scene.getTransformNodeByName("lioraShieldSocket");
     const hand=scene.getTransformNodeByName("mixamorig:LeftHand");
     const hips=scene.getTransformNodeByName("mixamorig:Hips");
     const point=v=>({x:v.x,y:v.y,z:v.z});
     const h=hand.getAbsolutePosition(),s=socket.getAbsolutePosition();
     const shield=scene.meshes.find(m=>m.getTotalVertices?.()===4445);
     if(shield){shield.computeWorldMatrix(true);}
     return {hand:point(h),socket:point(s),
      hip:hips?point(hips.position):null,
      dist:BABYLON.Vector3.Distance(h,s),
      shieldMinY:shield?.getBoundingInfo().boundingBox.minimumWorld.y||null,
      // Uses actual Babylon values, not GLB key interpolation in Python.
      rotation:socket.rotationQuaternion?.asArray()};
    });
    assert.ok(Object.values(pose.socket).every(Number.isFinite),clip+" socket NaN");
    assert.ok(Object.values(pose.hand).every(Number.isFinite),clip+" hand NaN");
    assert.ok(pose.dist<1.5,clip+" socket disconnected from hand at "+percent+"%");
    phases.push({...pose,percent});
    if(percent===50){
     await page.locator("#stage").screenshot({
      path:path.join(outDir,clip+".png"),timeout:30000});
    }
   }
   const maxHipXZ=Math.max(...phases.map(p=>Math.hypot(
    p.hip.x-phases[0].hip.x,p.hip.z-phases[0].hip.z)));
   assert.ok(maxHipXZ<.03,clip+" unexpected root-motion: "+maxHipXZ);
   results.push({clip,maxHipXZ,phases});
  }
  // During death the shield must detach visually from the hand and descend
  // toward the model-space floor, then return on a new idle clip.
  const death=results.find(x=>x.clip==="Liora_Shield_Death");
  const yStart=death.phases[0].shieldMinY,yEnd=death.phases[4].shieldMinY;
  const distEnd=death.phases[4].dist;
  console.log("LIORA death",JSON.stringify({yStart,yEnd,distEnd}));
  assert.ok(Number.isFinite(yEnd),"shield must have finite floor coordinate");
  assert.ok(distEnd>death.phases[0].dist+.05,"shield must move away from the wrist");
  await page.selectOption("#clip","Idle_02");
  await page.locator("#frame").evaluate(element=>{
   element.value="50";element.dispatchEvent(new Event("input",{bubbles:true}));
  });
  const reset=await page.evaluate(()=>{
   const s=BABYLON.EngineStore.Instances.at(-1).scenes[0],
    sock=s.getTransformNodeByName("lioraShieldSocket");
   return {x:sock.position.x,y:sock.position.y,z:sock.position.z};
  });
  assert.ok(Math.abs(reset.x+.22055)<.01,"idle must restore calibrated grip");
  await page.click("#scan");
  const scanText=await page.locator("#checks").innerText();
  for(const clip of ordered){
   assert.ok(scanText.includes(clip+": OK"),clip+" scan failure "+scanText);
  }
  assert.deepEqual(pageErrors,[],"page exceptions");
  assert.deepEqual(assetFailures,[],"asset HTTP errors");
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
  assert.equal(overflow,false,"landscape horizontal overflow");
  fs.writeFileSync(path.join(outDir,"results.json"),JSON.stringify({
   engineName,state,results,death:{yStart,yEnd,distEnd},scanText,pageErrors,
   consoleErrors,assetFailures,overflow},null,2));
  console.log("LIORA-SHIELD-004 PASS",engineName,"clips",results.length,
   "screenshots",results.length,"death end shield Y",yEnd);
 }finally{await browser.close();}
})().catch(error=>{console.error("LIORA-SHIELD-004 FAIL",error);process.exitCode=1;});
