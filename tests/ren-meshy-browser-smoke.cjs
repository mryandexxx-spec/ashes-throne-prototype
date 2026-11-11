"use strict";
const assert=require("node:assert/strict");
const {chromium}=require("playwright");
(async()=>{
 const browser=await chromium.launch({headless:true,args:["--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-dev-shm-usage","--no-sandbox"]});
 try{
  const page=await browser.newPage({viewport:{width:932,height:430}});
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto("http://127.0.0.1:8765/",{waitUntil:"load"});
  await page.waitForFunction(()=>typeof BABYLON!=="undefined"&&typeof RenGlbRuntime!=="undefined");
  const res=await page.evaluate(async()=>{
   const B=BABYLON,canvas=document.createElement("canvas");
   canvas.width=640;canvas.height=360;document.body.append(canvas);
   const engine=new B.Engine(canvas,true),scene=new B.Scene(engine);
   scene.activeCamera=new B.ArcRotateCamera("cam",0,1,5,new B.Vector3(0,1,0),scene);
   new B.HemisphericLight("light",new B.Vector3(0,1,0),scene);
   const body=new B.Mesh("body",scene),head=new B.Mesh("head",scene);
   body.position.y=.8;head.position.y=1.8;
   const fallback=B.MeshBuilder.CreateBox("fallback",{size:1},scene);fallback.parent=body;
   const actor=RenGlbRuntime.create(B,scene,{body,head});
   const ready=await actor.ready;
   const groups=scene.animationGroups.map(g=>g.name);
   const meshCount=scene.meshes.filter(m=>m.metadata?.fighterId==="ren"&&m.getTotalVertices?.()>0).length;
   const hips=scene.transformNodes.find(n=>n.name==="mixamorig:Hips");
   const track=scene.animationGroups.find(g=>g.name==="Double_Combo_Attack")
    ?.targetedAnimations.find(a=>a.target?.name==="mixamorig:Hips"&&a.animation?.targetProperty==="position")
    ?.animation.getKeys();
   const hipXZ=(track||[]).map(k=>({x:k.value.x,z:k.value.z}));
   const hipRange=hipXZ.length?Math.max(
    ...hipXZ.map(v=>Math.abs(v.x-hipXZ[0].x)),
    ...hipXZ.map(v=>Math.abs(v.z-hipXZ[0].z))):Infinity;
   const poses=[];
   for(const p of [.10,.50,.85]){
    actor.update({slot:"basic",progress:p});scene.render();
    poses.push({progress:p,hips:hips?{x:hips.position.x,z:hips.position.z}:null});
   }
   const slots=["idle","hit","death"];
   for(const slot of slots){actor.update({slot,progress:.5});scene.render();}
   actor.update({slot:"idle",progress:.2});scene.render();
   const result={ready,groups,meshCount,fallbackHidden:!fallback.isVisible,hipRange,poses};
   actor.dispose();scene.dispose();engine.dispose();canvas.remove();
   return result;
  });
  console.log("RENMESH017 WebGL",JSON.stringify(res));
  assert.equal(res.ready,true);
  assert.ok(res.meshCount>0);
  assert.equal(res.fallbackHidden,true);
  assert.ok(res.hipRange>1,"Original Meshy keys must remain immutable: "+res.hipRange);
  assert.ok(res.poses.every(p=>p.hips),"Actual Mixamo hips must exist");
  for(const n of ["Idle_4","Double_Combo_Attack","Slap_Reaction","Dead"])assert.ok(res.groups.includes(n),n);
  assert.deepEqual(errors,[]);
  console.log("RENMESH017 WebGL: passed");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
