"use strict";
/* LIORA-UNARMED-001: actual Babylon WebGL unarmed-model regression.
 * Keep the legacy filename while CI workflow is transitioned.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {chromium,webkit}=require("playwright");
const browserName=process.env.LIORA_BROWSER==="webkit"?"webkit":"chromium";
const clips=["Running","Walking","Alert","Block1","Catching_Breath","Dead",
 "Hit_Reaction","Idle_02","Shield_Push_Left","Squat_Stance",
 "Step_Forward_and_Push","Walk_Fight_Forward",
 "Liora_Shield_Block","Liora_Shield_Bash","Liora_Shield_Death"];
const out=path.join(process.cwd(),"artifacts/liora-unarmed",browserName);
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await (browserName==="webkit"?webkit:chromium).launch(
  browserName==="webkit"?{headless:true}:{headless:true,args:[
   "--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl",
   "--disable-dev-shm-usage"]});
 try{
  const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:1,
   isMobile:true,hasTouch:true});
  const errors=[],glbRequests=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("request",r=>{if(/\\.glb(?:$|\\?)/i.test(r.url()))glbRequests.push(r.url());});
  page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
  const resp=await page.goto("http://127.0.0.1:8765/liora-shield-lab.html",
   {waitUntil:"load",timeout:90000});
  assert.equal(resp.status(),200);
  await page.waitForFunction(()=>{
   const status=document.getElementById("status")?.textContent||"";
   return status.includes("Готово: 15 анимаций")||status.startsWith("Ошибка");
  },null,{timeout:45000});
  const msg=await page.locator("#status").innerText();
  assert.match(msg,/Готово: 15 анимаций/,"viewer should load all clips: "+msg);
  assert.equal(glbRequests.length,1,"must request exactly one GLB (Liora, no shield)");
  assert.match(glbRequests[0],/liora_vel_shield_aware_15clips\\.glb/);
  const state=await page.evaluate(()=>{
   const engine=BABYLON.EngineStore.Instances.at(-1);
   const scene=engine.scenes[0];
   const meshes=scene.meshes.filter(m=>m.getTotalVertices?.()>0);
   return {webgl:engine.webGLVersion,clips:scene.animationGroups.map(g=>g.name),
    meshes:meshes.length,vertices:meshes.map(m=>m.getTotalVertices()),
    shieldSocket:!!scene.getTransformNodeByName("lioraShieldSocket"),
    shieldMesh:meshes.some(m=>m.getTotalVertices()===4445)};
  });
  assert.ok(state.webgl>=1);
  assert.deepEqual(new Set(state.clips),new Set(clips));
  assert.equal(state.meshes,1,"only Liora's mesh should render");
  assert.equal(state.shieldSocket,false);
  assert.equal(state.shieldMesh,false);
  assert.equal(await page.locator("#sliders,#stabilize,#combatCorrection").count(),0);
  await page.click("#play");
  const poses=[];
  for(const clip of clips){
   await page.selectOption("#clip",clip);
   const phases=[];
   for(const percent of [0,25,50,75,100]){
    await page.locator("#frame").evaluate((el,p)=>{
     el.value=String(p);el.dispatchEvent(new Event("input",{bubbles:true}));
    },percent);
    await page.waitForTimeout(35);
    const pose=await page.evaluate(()=>{
     const scene=BABYLON.EngineStore.Instances.at(-1).scenes[0];
     scene.render();
     const hip=scene.getTransformNodeByName("mixamorig:Hips");
     return {x:hip.position.x,y:hip.position.y,z:hip.position.z,
      meshCount:scene.meshes.filter(m=>m.getTotalVertices?.()>0).length};
    });
    assert.ok([pose.x,pose.y,pose.z].every(Number.isFinite),clip+" nonfinite hips");
    assert.equal(pose.meshCount,1,clip+" shield mesh unexpectedly appeared");
    phases.push({percent,...pose});
   }
   const drift=Math.max(...phases.map(p=>Math.hypot(p.x-phases[0].x,
    p.z-phases[0].z)));
   assert.ok(drift<.03,clip+" unwanted horizontal root motion "+drift);
   if(["Idle_02","Liora_Shield_Block","Liora_Shield_Bash","Liora_Shield_Death"].includes(clip))
    await page.locator("#stage").screenshot({path:path.join(out,clip+".png")});
   poses.push({clip,drift});
  }
  await page.selectOption("#clip","Idle_02");
  await page.click("#scan");
  const scan=await page.locator("#checks").innerText();
  for(const clip of clips)assert.ok(scan.includes(clip+": OK"),clip+" scan failed");
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  assert.deepEqual(errors,[],"no page errors");
  const report={browserName,state,glbRequests,poses,errors};
  fs.writeFileSync(path.join(out,"results.json"),JSON.stringify(report,null,2));
  console.log("LIORA-UNARMED-001 PASS",browserName,"clips",poses.length,
   "single GLB, no shield, no root-motion drift");
 }catch(error){
  console.error("LIORA-UNARMED-001 FAIL",error);
  await page?.screenshot?.({path:path.join(out,"error.png")}).catch(()=>{});
  throw error;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
