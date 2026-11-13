"use strict";
/* LIORA-SHIELD-006: real Babylon WebGL regression for the single Liora GLB with the baked shield.
 * Proves the shield mesh is rigid relative to mixamorig:LeftForeArm in all 15 clips and 5 phases each.
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
const out=path.join(process.cwd(),"artifacts/liora-shield-006",browserName);
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await (browserName==="webkit"?webkit:chromium).launch(
  browserName==="webkit"?{headless:true}:{headless:true,args:[
   "--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl",
   "--disable-dev-shm-usage"]});
 let page=null;
 try{
  page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:1,
   isMobile:true,hasTouch:true});
  const errors=[],glbRequests=[];
  page.on("pageerror",e=>errors.push(e.message));
  page.on("request",r=>{if(/\.glb(?:$|\?)/i.test(r.url()))glbRequests.push(r.url());});
  page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
  const resp=await page.goto("http://127.0.0.1:8765/liora-lab.html",
   {waitUntil:"load",timeout:90000});
  assert.equal(resp.status(),200);
  await page.waitForFunction(()=>{
   const status=document.getElementById("status")?.textContent||"";
   return status.includes("Готово: 15 анимаций")||status.startsWith("Ошибка");
  },null,{timeout:45000});
  const msg=await page.locator("#status").innerText();
  assert.match(msg,/Готово: 15 анимаций/,"viewer should load all clips: "+msg);
  assert.equal(glbRequests.length,1,"must request exactly one GLB (character + shield in one file)");
  assert.match(glbRequests[0],/liora-mobile-animated\.glb/);
  const state=await page.evaluate(()=>{
   const engine=BABYLON.EngineStore.Instances.at(-1);
   const scene=engine.scenes[0];
   const meshes=scene.meshes.filter(m=>m.getTotalVertices?.()>0);
   const shield=scene.getMeshByName("Liora_Shield");
   return {webgl:engine.webGLVersion,clips:scene.animationGroups.map(g=>g.name),
    meshes:meshes.length,vertices:meshes.map(m=>m.getTotalVertices()),
    skeletons:scene.skeletons.length,
    shieldSkinned:!!shield?.skeleton,shieldVertices:shield?.getTotalVertices()||0,
    sameSkeleton:!!shield&&meshes.every(m=>m.skeleton===shield.skeleton),
    oldSocket:!!scene.getTransformNodeByName("lioraShieldSocket")};
  });
  assert.ok(state.webgl>=1);
  assert.deepEqual(new Set(state.clips),new Set(clips));
  assert.equal(state.meshes,2,"body and shield meshes");
  assert.equal(state.skeletons,1,"one shared skeleton");
  assert.equal(state.shieldVertices,4445);
  assert.equal(state.shieldSkinned,true);
  assert.equal(state.sameSkeleton,true);
  assert.equal(state.oldSocket,false);
  assert.equal(await page.locator("#sliders,#stabilize,#combatCorrection").count(),0);
  assert.equal(await page.locator("#shield").count(),1);
  await page.click("#play");
  const poses=[];
  let reference=null;
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
     const forearm=scene.getTransformNodeByName("mixamorig:LeftForeArm");
     const hand=scene.getTransformNodeByName("mixamorig:LeftHand");
     const shield=scene.getMeshByName("Liora_Shield");
     // Skinned vertex centroid of the shield in world space (applies the current skeleton pose);
     // an axis-aligned box centre would move with rotation, the centroid does not.
     const data=shield.getPositionData(true,false);
     const c=new BABYLON.Vector3(0,0,0);const count=data.length/3;
     for(let i=0;i<data.length;i+=3){c.x+=data[i];c.y+=data[i+1];c.z+=data[i+2];}
     c.scaleInPlace(1/count);
     BABYLON.Vector3.TransformCoordinatesToRef(c,shield.getWorldMatrix(),c);
     shield.refreshBoundingInfo(true);
     const box=shield.getBoundingInfo().boundingBox;
     const f=forearm.getAbsolutePosition(),h=hand.getAbsolutePosition();
     const fm=forearm.getWorldMatrix().clone().invert();
     const local=BABYLON.Vector3.TransformCoordinates(c,fm);
     return {x:hip.position.x,y:hip.position.y,z:hip.position.z,
      meshCount:scene.meshes.filter(m=>m.getTotalVertices?.()>0&&m.isEnabled()).length,
      shieldCenter:c.asArray(),forearm:f.asArray(),hand:h.asArray(),
      local:local.asArray(),
      distForearm:BABYLON.Vector3.Distance(c,f),distHand:BABYLON.Vector3.Distance(c,h),
      lowest:box.minimumWorld.y};
    });
    assert.ok([pose.x,pose.y,pose.z].every(Number.isFinite),clip+" nonfinite hips");
    assert.ok(pose.local.every(Number.isFinite),clip+" nonfinite shield");
    assert.equal(pose.meshCount,2,clip+" body and shield must both render");
    // Rigid follow: the shield centre keeps the same forearm-local position in every clip and phase.
    if(!reference)reference=pose.local;
    const slip=Math.hypot(...pose.local.map((v,i)=>v-reference[i]));
    assert.ok(slip<.01,clip+" "+percent+"%: shield slips on the forearm by "+slip.toFixed(4)+" m");
    assert.ok(pose.distForearm<.4&&pose.distHand<.5,clip+" shield too far from the arm");
    phases.push({percent,...pose,slip});
   }
   const drift=Math.max(...phases.map(p=>Math.hypot(p.x-phases[0].x,
    p.z-phases[0].z)));
   assert.ok(drift<.03,clip+" unwanted horizontal root motion "+drift);
   if(["Idle_02","Liora_Shield_Block","Liora_Shield_Bash","Liora_Shield_Death","Running"].includes(clip))
    await page.locator("#stage").screenshot({path:path.join(out,clip+".png")});
   poses.push({clip,drift,maxSlip:Math.max(...phases.map(p=>p.slip)),
    lowest:Math.min(...phases.map(p=>p.lowest))});
  }
  // The shield checkbox only hides the mesh; it never unloads it.
  await page.selectOption("#clip","Idle_02");
  await page.uncheck("#shield");
  await page.waitForTimeout(50);
  const hidden=await page.evaluate(()=>{const s=BABYLON.EngineStore.Instances.at(-1).scenes[0];s.render();
   const m=s.getMeshByName("Liora_Shield");return {enabled:m.isEnabled(),disposed:m.isDisposed()};});
  assert.deepEqual(hidden,{enabled:false,disposed:false});
  await page.locator("#stage").screenshot({path:path.join(out,"Idle_02_unarmed.png")});
  await page.check("#shield");
  await page.click("#scan");
  const scan=await page.locator("#checks").innerText();
  for(const clip of clips)assert.ok(scan.includes(clip+": OK"),clip+" scan failed");
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);
  assert.deepEqual(errors,[],"no page errors");
  const report={browserName,state,glbRequests,reference,poses,errors};
  fs.writeFileSync(path.join(out,"results.json"),JSON.stringify(report,null,2));
  console.log("LIORA-SHIELD-006 PASS",browserName,"clips",poses.length,
   "single GLB, shield rigid on the forearm (max slip "+Math.max(...poses.map(p=>p.maxSlip)).toFixed(4)+" m), no root-motion drift");
 }catch(error){
  console.error("LIORA-SHIELD-006 FAIL",error);
  await page?.screenshot?.({path:path.join(out,"error.png")}).catch(()=>{});
  throw error;
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
