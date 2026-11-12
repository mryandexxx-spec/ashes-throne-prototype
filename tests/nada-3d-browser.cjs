"use strict";
const assert=require("node:assert/strict");
const {chromium,webkit}=require("playwright");
(async()=>{
 const useWebkit=process.env.NADA_BROWSER==="webkit";
 const browser=await (useWebkit?webkit:chromium).launch(
  useWebkit?{headless:true}:{headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-dev-shm-usage"]});
 try{
  const page=await browser.newPage({viewport:{width:932,height:430}});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("http://127.0.0.1:8765/",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof NadaGlbRuntime!=="undefined"&&typeof BABYLON!=="undefined");
  const result=await page.evaluate(async()=>{
   const B=BABYLON,canvas=document.createElement("canvas");
   canvas.width=480;canvas.height=360;document.body.append(canvas);
   const engine=new B.Engine(canvas,true,{preserveDrawingBuffer:false}),scene=new B.Scene(engine);
   scene.activeCamera=new B.ArcRotateCamera("nadaQA",Math.PI/2,1.2,5,new B.Vector3(0,1,0),scene);
   new B.HemisphericLight("nadaQALight",new B.Vector3(0,1,0),scene);
   const body=new B.Mesh("body",scene),head=new B.Mesh("head",scene);
   body.position.y=.8;head.position.y=1.8;
   const cap=B.MeshBuilder.CreateCapsule("nadaFallback",{height:1.5,radius:.42},scene);
   cap.parent=body;
   const instance=NadaGlbRuntime.create(B,scene,{body,head});
   const ready=await instance.ready;
   const groups=scene.animationGroups.map(g=>g.name);
   const renderParts=scene.meshes.filter(m=>m.metadata?.fighterId==="nada"&&m.getTotalVertices?.()>0);
   const hip=scene.transformNodes.find(n=>n.name==="mixamorig:Hips");
   const motions=[];
   for(const slot of ["idle","basic","special","powerful","hit","death"]){
    instance.update({slot,progress:.5});scene.render();
    motions.push({slot,hip:hip?{x:hip.position.x,y:hip.position.y,z:hip.position.z}:null});
   }
   const out={ready,meshes:renderParts.length,groups,motions,
    hidden:body.isVisible===false&&head.isVisible===false,
    enabled:renderParts.every(m=>m.isEnabled()),
    viewportWidth:document.documentElement.scrollWidth};
   instance.dispose();
   out.fallbackRestored=body.isVisible&&head.isVisible;
   scene.dispose();engine.dispose();canvas.remove();
   return out;
  });
  console.log("NADA3D001 isolated 3D",JSON.stringify(result));
  assert.equal(result.ready,true,"real GLB import must succeed");
  assert.ok(result.meshes>0,"model must contain renderable meshes");
  assert.equal(result.hidden,true,"procedural fallback must hide after success");
  assert.equal(result.enabled,true,"model geometry must be enabled");
  assert.equal(result.fallbackRestored,true,"dispose must restore procedural fallback");
  for(const name of ["Idle_11","Archery_Shot_3","Hit_Reaction_1","Electrocuted_Fall"])
   assert.ok(result.groups.includes(name),"missing animation "+name);
  assert.ok(result.motions.every(x=>x.hip&&Object.values(x.hip).every(Number.isFinite)));
  await page.evaluate(()=>{selectedHeroId="nada";showScreen("heroDetail");});
  await page.waitForFunction(()=>document.querySelector("#detailHeroStage")?.classList.contains("has-ren-3d"),null,{timeout:60000});
  const card=await page.evaluate(()=>({
   source:document.querySelector("#renCard3DCanvas")?.dataset.animationSource,
   viewer:!!BABYLON.EngineStore.Instances.find(e=>e.getRenderingCanvas()?.id==="renCard3DCanvas"),
   overflow:document.documentElement.scrollWidth>innerWidth+2,
   loadingHidden:document.querySelector("#renCardLoadIndicator")?.hidden
  }));
  console.log("NADA3D001 hero card",JSON.stringify(card));
  assert.equal(card.source,"nada-mixamo-native-idle");
  assert.equal(card.viewer,true);
  assert.equal(card.loadingHidden,true);
  assert.equal(card.overflow,false);
  await page.evaluate(()=>showScreen("collection"));
  assert.equal(await page.locator("#renCard3DCanvas").isHidden(),true);
  await page.evaluate(()=>{selectedHeroId="nada";showScreen("heroDetail");});
  await page.waitForFunction(()=>document.querySelector("#renCard3DCanvas")?.dataset.animationSource==="nada-mixamo-native-idle",{timeout:60000});
  await page.evaluate(()=>showScreen("battle"));
  await page.waitForFunction(()=>typeof meshes!=="undefined"&&!!meshes.nada&&!!nadaGlbRuntime,null,{timeout:20000});
  const combat=await page.evaluate(async()=>{
   const ok=await nadaGlbRuntime.ready;
   return {ready:ok,
    meshCount:scene.meshes.filter(m=>m.metadata?.fighterId==="nada"&&m.getTotalVertices?.()>0).length,
    loaded:nadaGlbRuntime.isReady,
    visible:meshes.nada.body.isEnabled()};
  });
  console.log("NADA3D001 live arena",JSON.stringify(combat));
  assert.equal(combat.ready,true,"Nada must load in the real combat arena");
  assert.equal(combat.loaded,true);
  assert.ok(combat.meshCount>0);
  assert.deepEqual(errors,[]);
  console.log("NADA3D001 browser smoke PASS",useWebkit?"WebKit":"Chromium");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
