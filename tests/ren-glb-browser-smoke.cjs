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
   if(kinMotion)kinMotion(0);
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
   RenCard3D.dispose();
   return {skeletalAttack,plantedHips,restoredSpine,repeatStable,facing,imported,meshCount,clipCount,fallbackHidden,statuses,cardStatus,has3D,status,usesRealRig,kinHeadMoves,kinShoulderMoves,kinHipsStance,kinHipsPositionStable,kinStable};
  });
  console.log("REN WEBGL SMOKE",JSON.stringify(result));
  assert.equal(result.skeletalAttack,true,"attack moves the actual supplied rig");
  assert.equal(result.usesRealRig,true,"KinemIQ connects to actual Ren GLB transform nodes");
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
  assert.match(result.cardStatus,/3D Рен загружен/);
  console.log("REN-GLB-003: Chromium live import & card passed");
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
