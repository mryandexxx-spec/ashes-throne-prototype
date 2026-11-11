/* REN-GLB-003: real Chromium WebGL import smoke (CI-only).
 * Exercises the production GLB and card, not a mocked loader.
 */
"use strict";
const {chromium}=require("playwright");
const assert=require("node:assert/strict");
(async()=>{
 const browser=await chromium.launch({
  headless:true,
  ...(process.env.REN_CHROMIUM_PATH?{executablePath:process.env.REN_CHROMIUM_PATH}:{}),
  args:["--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-dev-shm-usage","--no-sandbox"]
 });
 const errors=[];
 try{
  const page=await browser.newPage({viewport:{width:960,height:540}});
  page.on("pageerror",e=>errors.push("JS: "+e.message));
  page.on("console",msg=>{if(msg.type()==="error")errors.push("console: "+msg.text());});
  page.on("requestfailed",r=>errors.push("request: "+r.url()+" "+r.failure()?.errorText));
  await page.goto("http://127.0.0.1:8765/",{waitUntil:"load",timeout:60000});
  await page.waitForFunction(()=>typeof BABYLON!=="undefined"&&typeof RenGlbRuntime!=="undefined"&&typeof RenCard3D!=="undefined",{timeout:30000});
  const result=await page.evaluate(async()=>{
   const B=BABYLON;
   const canvas=document.createElement("canvas");
   canvas.style.cssText="width:640px;height:400px";
   document.body.appendChild(canvas);
   const engine=new B.Engine(canvas,true);
   const scene=new B.Scene(engine);
   scene.activeCamera=new B.ArcRotateCamera("testCam",-Math.PI/2,1.2,4,new B.Vector3(0,1,0),scene);
   new B.HemisphericLight("light",new B.Vector3(0,1,0),scene);
   const body=new B.Mesh("test_body",scene);
   const head=new B.Mesh("test_head",scene);
   body.position.set(0,.8,0);
   head.position.set(0,1.8,0);
   const bodyPart=B.MeshBuilder.CreateBox("fallback_cube",{size:1},scene);
   bodyPart.parent=body;
   const statuses=[];
   const actor=RenGlbRuntime.create(B,scene,{body,head},(kind,text)=>statuses.push({kind,text}));
   const imported=await Promise.race([actor.ready,new Promise(resolve=>setTimeout(()=>resolve("timeout"),25000))]);
   const meshCount=scene.meshes.filter(m=>m.metadata?.fighterId==="ren"&&m.getTotalVertices?.()>0).length;
   const clipCount=scene.animationGroups.length;
   const fallbackHidden=bodyPart.isVisible===false;
   const spine=scene.transformNodes.find(n=>n.name==="spine");
   const hips=scene.transformNodes.find(n=>n.name==="hips");
   const spineRest=spine.rotationQuaternion.clone();
   const hipsRest=hips.rotationQuaternion.clone();
   actor.update({slot:"basic",progress:.5});
   const arm=scene.transformNodes.find(n=>n.name==="shR");
   const armAttack=arm.rotationQuaternion.clone();
   const skeletalAttack=!spine.rotationQuaternion.equalsWithEpsilon(spineRest);
   const plantedHips=hips.rotationQuaternion.equalsWithEpsilon(hipsRest);
   actor.update({slot:"idle",progress:0});
   const restoredSpine=spine.rotationQuaternion.equalsWithEpsilon(spineRest);
   actor.update({slot:"basic",progress:.5});
   const repeatStable=arm.rotationQuaternion.equalsWithEpsilon(armAttack);
   const facing=scene.transformNodes.find(n=>n.name==="ren_production_glb").rotation.y;
   actor.update({slot:"idle",progress:0});
   // RENIDLE010: exercise the donated animation on the actual game rig in WebGL.
   const headBone=scene.transformNodes.find(n=>n.name==="head");
   const shoulderBone=scene.transformNodes.find(n=>n.name==="shR");
   const neutralHead=headBone.rotationQuaternion.clone();
   const neutralShoulder=shoulderBone.rotationQuaternion.clone();
   const hipsPosBefore=hips.position.clone();
   const originalBoneRotations=scene.transformNodes
    .filter(n=>n.rotationQuaternion).map(n=>({node:n,q:n.rotationQuaternion.clone()}));
   const kinMotion=RenKinemIQIdle.create(B,scene.transformNodes);
   const usesRealRig=typeof kinMotion==="function";
   if(kinMotion)kinMotion(5600);
   const kinHeadMoves=!headBone.rotationQuaternion.equalsWithEpsilon(neutralHead);
   const kinShoulderMoves=!shoulderBone.rotationQuaternion.equalsWithEpsilon(neutralShoulder);
   const kinHipsStance=!hips.rotationQuaternion.equalsWithEpsilon(hipsRest);
   const kinHipsPositionStable=hips.position.equalsWithEpsilon(hipsPosBefore);
   const kinOnceHead=headBone.rotationQuaternion.clone();
   if(kinMotion)kinMotion(5600);
   const kinStable=headBone.rotationQuaternion.equalsWithEpsilon(kinOnceHead);
   // Restore the original GLB bind pose before creating a *separate*
   // retarget instance: real game does not stack previous pseudo-poses.
   for(const {node,q} of originalBoneRotations)node.rotationQuaternion.copyFrom(q);
   // RENRETARGET014: verify the actual bone-axis retargeter, not just source samples.
   const boneWorld=name=>{
    const node=scene.transformNodes.find(n=>n.name===name);
    node.computeWorldMatrix(true);
    return node.getAbsolutePosition().clone();
   };
   const prePoseHandL=boneWorld("handL"),prePoseHandR=boneWorld("handR");
   const poseBeforeCoords={hips:boneWorld("hips").asArray(),shL:boneWorld("shL").asArray(),shR:boneWorld("shR").asArray(),elL:boneWorld("elL").asArray(),elR:boneWorld("elR").asArray(),handL:prePoseHandL.asArray(),handR:prePoseHandR.asArray()};
   const pose=RenCardPose.create(B,scene.transformNodes);
   const poseReady=!!pose;
   const poseHandL=boneWorld("handL"),poseHandR=boneWorld("handR");
   const poseDisplacement=Math.max(B.Vector3.Distance(prePoseHandL,poseHandL),
    B.Vector3.Distance(prePoseHandR,poseHandR));
   const poseSeparation=B.Vector3.Distance(poseHandL,poseHandR);
   const poseAfterCoords={handL:poseHandL.asArray(),handR:poseHandR.asArray()};
   const poseLegOrigin=[boneWorld("ankL"),boneWorld("ankR")];
   const ankLeftBefore=boneWorld("ankL"),ankRightBefore=boneWorld("ankR");
   const targetRig=RenMotionRetarget.create(B,scene.transformNodes);
   const targetRetargetReady=typeof targetRig==="function";
   const headBeforeRetarget=headBone.rotationQuaternion.clone();
   const shoulderBeforeRetarget=shoulderBone.rotationQuaternion.clone();
   const hipsBeforeRetarget=hips.position.clone();
   if(targetRig)targetRig(13000);
   const retargetHeadMoves=!headBone.rotationQuaternion.equalsWithEpsilon(headBeforeRetarget);
   const retargetShoulderMoves=!shoulderBone.rotationQuaternion.equalsWithEpsilon(shoulderBeforeRetarget);
   const retargetRootPinned=hips.position.equalsWithEpsilon(hipsBeforeRetarget);
   const ankLeftAfter=boneWorld("ankL"),ankRightAfter=boneWorld("ankR");
   const retargetFootDrift=Math.max(
    B.Vector3.Distance(ankLeftBefore,ankLeftAfter),
    B.Vector3.Distance(ankRightBefore,ankRightAfter));
   const retargetHandsApart=B.Vector3.Distance(boneWorld("handL"),boneWorld("handR"));
   const retargetHeadFirst=headBone.rotationQuaternion.clone();
   if(targetRig)targetRig(13000);
   const retargetStable=headBone.rotationQuaternion.equalsWithEpsilon(retargetHeadFirst);
   // RENIDLE015 regression: test the full timeline, not just one snapshot.
   const angleBetween=(a,b)=>{
    const dot=Math.min(1,Math.abs(a.x*b.x+a.y*b.y+a.z*b.z+a.w*b.w));
    return 2*Math.acos(dot);
   };
   targetRig(0);
   let shoulderPeak=0,shoulderJerk=0,spinePeak=0,legDrift=0;
   const shoulderStart=shoulderBone.rotationQuaternion.clone();
   const spineCheck=scene.transformNodes.find(n=>n.name==="spine");
   const spineStart=spineCheck.rotationQuaternion.clone();
   const ankLeftHome=boneWorld("ankL"),ankRightHome=boneWorld("ankR");
   let previousShoulder=shoulderStart.clone();
   for(let t=100;t<=20000;t+=100){
    targetRig(t);
    const q=shoulderBone.rotationQuaternion;
    shoulderPeak=Math.max(shoulderPeak,angleBetween(q,shoulderStart));
    shoulderJerk=Math.max(shoulderJerk,angleBetween(q,previousShoulder));
    previousShoulder=q.clone();
    spinePeak=Math.max(spinePeak,angleBetween(spineCheck.rotationQuaternion,spineStart));
    legDrift=Math.max(legDrift,B.Vector3.Distance(ankLeftHome,boneWorld("ankL")),
      B.Vector3.Distance(ankRightHome,boneWorld("ankR")));
   }
   scene.render();
   actor.dispose();
   scene.dispose();engine.dispose();canvas.remove();
   // The card must also use the same bundled model and support rotation.
   const dossier=document.getElementById("heroDetail");
   dossier?.classList.add("active");
   const cardCanvas=document.getElementById("renCard3DCanvas");
   if(cardCanvas)cardCanvas.hidden=false;
   await RenCard3D.activate("ren");
   const status=document.getElementById("renCard3DStatus")?.textContent||"";
   const end=Date.now()+25000;
   while(Date.now()<end && !/загружен|Не удалось/.test(document.getElementById("renCard3DStatus")?.textContent||"")){
    await new Promise(r=>setTimeout(r,200));
   }
   const cardStatus=document.getElementById("renCard3DStatus")?.textContent||"";
   const has3D=document.getElementById("detailHeroStage")?.classList.contains("has-ren-3d");
   const cardSource=cardCanvas?.dataset.animationSource;
   const cardPoseSource=cardCanvas?.dataset.poseSource;
   return {skeletalAttack,plantedHips,restoredSpine,repeatStable,facing,imported,meshCount,clipCount,fallbackHidden,statuses,cardStatus,has3D,cardSource,cardPoseSource,status,usesRealRig,kinHeadMoves,kinShoulderMoves,kinHipsStance,kinHipsPositionStable,kinStable,targetRetargetReady,retargetHeadMoves,retargetShoulderMoves,retargetRootPinned,retargetStable,retargetFootDrift,retargetHandsApart,poseReady,poseDisplacement,poseSeparation,poseMetrics:pose?.measurements,poseBeforeCoords,poseAfterCoords,shoulderPeak,shoulderJerk,spinePeak,legDrift};
  });
  // Visual review artifact: screenshot the actual card, not a guessed stick figure.
  const cardImage=await page.locator("#renCard3DCanvas").screenshot({type:"jpeg",quality:32,timeout:15000});
  console.log("RENPOSE016_VIEW "+cardImage.toString("base64"));
  const stage=await page.locator("#renCard3DCanvas").boundingBox();
  if(stage){
   await page.mouse.move(stage.x+stage.width*.60,stage.y+stage.height*.5);
   await page.mouse.down();
   await page.mouse.move(stage.x+stage.width*.20,stage.y+stage.height*.5,{steps:9});
   await page.mouse.up();
   await page.waitForTimeout(200);
   const sideImage=await page.locator("#renCard3DCanvas").screenshot({type:"jpeg",quality:30,timeout:15000});
   console.log("RENPOSE016_SIDE "+sideImage.toString("base64"));
  }
  await page.evaluate(()=>RenCard3D.dispose());
  console.log("REN WEBGL SMOKE",JSON.stringify(result));
  assert.equal(result.skeletalAttack,true,"attack moves the actual supplied rig");
  assert.equal(result.usesRealRig,true,"KinemIQ connects to actual Ren GLB transform nodes");
  assert.equal(result.poseReady,true,"RENPOSE016 runs on actual GLB skeleton");
  assert.ok(result.poseDisplacement>.008,"RENPOSE016 must visibly move at least one hand: "+result.poseDisplacement);
  assert.ok(result.poseSeparation>.4,"RENPOSE016 must not bring the hands toward the groin");
  assert.ok(result.poseDisplacement<.31,"RENPOSE016 should be a deliberate arm pose, not an arm swing");
  assert.ok(result.poseMetrics.handL<.10&&result.poseMetrics.handR<.15,"RENPOSE016 hands must approach rig-relative side targets: "+JSON.stringify(result.poseMetrics));
  assert.equal(result.targetRetargetReady,true,"RETARGET014 connects to the actual Ren GLB");
  assert.equal(result.retargetHeadMoves,true,"RETARGET014 moves head on real GLB");
  assert.equal(result.retargetShoulderMoves,true,"RETARGET014 moves shoulder on real GLB");
  assert.equal(result.retargetRootPinned,true,"RETARGET014 must not translate pelvis");
  assert.equal(result.retargetStable,true,"RETARGET014 poses must not accumulate drift");
  assert.ok(result.retargetFootDrift<.08,"RETARGET014 should not visibly slide ankles: "+result.retargetFootDrift);
  assert.ok(result.retargetHandsApart>.18,"RETARGET014 should not clasp hands in front of groin: "+result.retargetHandsApart);
  assert.ok(result.shoulderPeak<.16,"RENIDLE015 no exaggerated shoulder motion: "+result.shoulderPeak);
  assert.ok(result.shoulderJerk<.045,"RENIDLE015 no shoulder twitch over 100ms: "+result.shoulderJerk);
  assert.ok(result.spinePeak<.12,"RENIDLE015 no fighter anticipation rocking: "+result.spinePeak);
  assert.ok(result.legDrift<.005,"RENIDLE015 planted feet over 20s: "+result.legDrift);
  assert.equal(result.kinHeadMoves,true,"KinemIQ moves actual Ren head");
  assert.equal(result.kinShoulderMoves,true,"KinemIQ moves actual Ren shoulder");
  assert.equal(result.kinHipsStance,true,"Ren has intended slight pelvis tilt for relaxed stance");
  assert.equal(result.kinHipsPositionStable,true,"Ren pelvis does not translate vertically");
  assert.equal(result.kinStable,true,"KinemIQ pose is idempotent");
  assert.equal(result.plantedHips,true,"no vertical root animation");
  assert.equal(result.restoredSpine,true,"idle restores the authored pose");
  assert.equal(result.repeatStable,true,"repeated frames cannot accumulate joint rotation");
  assert.equal(result.facing,Math.PI/2,"Wanderer faces toward enemy formation");
  assert.equal(result.imported,true,"Combat GLB should load; browser errors: "+errors.join(" | "));
  assert.ok(result.meshCount>0,"Combat GLB has actual mesh");
  assert.equal(result.clipCount,0,"Wanderer loads without animation groups");
  assert.ok(result.fallbackHidden,"Old procedurally-created mesh is hidden");
  assert.ok(result.statuses.some(s=>s.kind==="ready"),"HUD loading success reported");
  assert.equal(result.has3D,true,"3D card is rendered from GLB: "+result.cardStatus);
  assert.equal(result.cardSource,"kinemiq-retarget","Card must select actual retarget, not silent fallback");
  assert.equal(result.cardPoseSource,"balanced-016","Card must actually apply RENPOSE016");
  assert.match(result.cardStatus,/3D Рен загружен/);
  console.log("REN-GLB-003: Chromium live import & card passed");
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
