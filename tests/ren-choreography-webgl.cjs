'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 fs.mkdirSync('artifacts/ren-choreography',{recursive:true});
 const browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-webgl','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width:932,height:430},recordVideo:{dir:'artifacts/ren-choreography/video',size:{width:932,height:430}}});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
  await page.goto('http://127.0.0.1:8765/ren-combat-lab.html');
  await page.waitForFunction(()=>window.RenLab,{timeout:90000});
  await page.getByRole('button',{name:'Атака',exact:true}).click();
  await page.waitForTimeout(900);await page.getByRole('button',{name:'Пауза',exact:true}).click();
  const result=await page.evaluate(()=>{
   const L=RenLab,B=BABYLON,results=[];L.engine.stopRenderLoop();
   const hips=L.scene.transformNodes.find(n=>n.name==='mixamorig:Hips');
   const group=L.scene.animationGroups.find(g=>g.name==='Double_Combo_Attack');
   const keys=group.targetedAnimations.find(a=>a.target===hips&&a.animation.targetProperty==='position').animation.getKeys();
   const firstZ=keys[0].value.z,count=L.scene.meshes.length;
   for(const distance of [2.5,4.9,8]){
    document.getElementById('distance').value=distance;L.reset();
    for(const speed of [1,2,4]){
     let last=null,maxStep=0;const p=L.plan;
     for(let t=0;t<=p.durationMs;t+=1000/60*speed){L.seek(t,false);hips.computeWorldMatrix(true);const pos=hips.getAbsolutePosition().clone();if(last)maxStep=Math.max(maxStep,B.Vector3.Distance(last,pos));last=pos;}
     L.seek(p.contactMs);const hand=L.hand.getAbsolutePosition();
     const contactError=Math.abs(Math.hypot(hand.x-L.target.position.x,hand.z-L.target.position.z)-.42);
     L.seek(p.durationMs);results.push({distance,speed,maxStep,contactError,returnX:L.body.position.x,returnZ:L.body.position.z});
    }
   }
   for(let i=0;i<8;i++){L.seek(L.plan.contactMs);L.seek(L.plan.durationMs);L.reset();}
   return {results,firstZ,lastZ:keys[0].value.z,meshes:count,meshesAfter:L.scene.meshes.length,engine:L.engine.webGLVersion,groups:L.scene.animationGroups.length};
  });
  assert.equal(result.engine,2);assert.equal(result.groups,9);assert.equal(result.firstZ,result.lastZ);assert.ok(result.firstZ<-1,'source keys must remain original');assert.equal(result.meshes,result.meshesAfter);
  for(const r of result.results){assert.ok(r.maxStep<.6,JSON.stringify(r));assert.ok(r.contactError<.04,JSON.stringify(r));assert.ok(Math.abs(r.returnX+r.distance/2)<1e-6);assert.ok(Math.abs(r.returnZ)<1e-6);}
  await page.evaluate(()=>{document.getElementById('distance').value='4.9';RenLab.reset();});
  for(const phase of ['0','brake','windup','contact','recover','retreat','end']){
   await page.locator('#phase').selectOption(phase);await page.evaluate(()=>RenLab.seek(RenLab.time));await page.screenshot({path:`artifacts/ren-choreography/${phase}.png`});
  }
  for(const view of ['front','top']){await page.locator('#phase').selectOption('contact');await page.locator(`[data-view=${view}]`).click();await page.evaluate(()=>RenLab.seek(RenLab.time));await page.screenshot({path:`artifacts/ren-choreography/contact-${view}.png`});}
  await page.locator('[data-view=side]').click();
  await page.evaluate(()=>RenLab.engine.runRenderLoop(()=>RenLab.draw(RenLab.engine.getDeltaTime())));
  for(const speed of ['1','2','4']){await page.locator('#speed').selectOption(speed);await page.locator('#reset').click();await page.locator('#play').click();await page.waitForFunction(()=>RenLab.time>=RenLab.plan.durationMs,{},{timeout:15000});}
  for(const width of [844,932]){await page.setViewportSize({width,height:width===844?390:430});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);}
  assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/ren-choreography/measurements.json',JSON.stringify(result,null,2));console.log('RENCHOR021 WebGL',JSON.stringify(result));
 }finally{await context.close();await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
