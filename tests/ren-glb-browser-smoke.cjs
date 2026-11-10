/* REN-GLB-003: real Chromium WebGL import smoke (CI-only).
 * Exercises the production GLB and card, not a mocked loader.
 */
"use strict";
const {chromium}=require("playwright");
const assert=require("node:assert/strict");
(async()=>{
 const browser=await chromium.launch({
  headless:true,
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
   const body=new B.Mesh("test_body",scene);
   const head=new B.Mesh("test_head",scene);
   body.position.set(0,.8,0);
   head.position.set(0,1.8,0);
   const bodyPart=B.MeshBuilder.CreateBox("fallback_cube",{size:1},scene);
   bodyPart.parent=body;
   const statuses=[];
   const actor=RenGlbRuntime.create(B,scene,{body,head},(kind,text)=>statuses.push({kind,text}));
   const imported=await Promise.race([actor.ready,new Promise(resolve=>setTimeout(()=>resolve("timeout"),25000))]);
   const meshCount=scene.meshes.filter(m=>m.name.includes("geometry_0")&&m.getTotalVertices?.()>0).length;
   const clipCount=scene.animationGroups.length;
   const fallbackHidden=bodyPart.isVisible===false;
   actor.update({slot:"basic",progress:.5});
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
   return {imported,meshCount,clipCount,fallbackHidden,statuses,cardStatus,has3D,status};
  });
  console.log("REN WEBGL SMOKE",JSON.stringify(result));
  assert.equal(result.imported,true,"Combat GLB should load; browser errors: "+errors.join(" | "));
  assert.ok(result.meshCount>0,"Combat GLB has actual mesh");
  assert.ok(result.clipCount>=5,"Combat GLB has expected animation groups");
  assert.ok(result.fallbackHidden,"Old procedurally-created mesh is hidden");
  assert.ok(result.statuses.some(s=>s.kind==="ready"),"HUD loading success reported");
  assert.equal(result.has3D,true,"3D card is rendered from GLB: "+result.cardStatus);
  assert.match(result.cardStatus,/3D Рен загружен/);
  console.log("REN-GLB-003: Chromium live import & card passed");
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
