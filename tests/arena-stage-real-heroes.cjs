"use strict";
const {chromium}=require("playwright");
const assert=require("node:assert/strict"),fs=require("node:fs");
(async()=>{
 fs.mkdirSync("artifacts/arena-stage-real-heroes",{recursive:true});
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--use-angle=swiftshader","--enable-webgl","--enable-unsafe-swiftshader"]});
 let page;
 try{
  page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:1});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("http://127.0.0.1:8765/tests/fixtures/env022-full-game.html",{waitUntil:"load",timeout:60000});
  await page.waitForFunction(()=>document.documentElement.dataset.visualStatus==="ready",null,{timeout:65000});
  await page.evaluate(()=>{
   const win=document.querySelector("#game").contentWindow;
   win.eval(`state=CombatCore.createBattle([
    HEROES.find(h=>h.id==="ren"),HEROES.find(h=>h.id==="nada"),
    ...HEROES.filter(h=>h.side==="ally"&&h.id!=="ren"&&h.id!=="nada").slice(0,3),
    ...HEROES.filter(h=>h.side==="enemy").slice(0,5)
   ]);CombatCore.advanceToPlayerTurn(state);syncBattleUI();updateMeshes();`);
  });
  await page.waitForFunction(()=>{
   const win=document.querySelector("#game").contentWindow;
   try{return win.eval("Boolean(renGlbRuntime?.isReady && nadaGlbRuntime?.isReady)");}catch{return false;}
  },null,{timeout:90000});
  const report=[];
  for(const [width,height] of [[844,390],[667,375]]){
   await page.setViewportSize({width,height});
   await page.waitForTimeout(1200);
   const info=await page.evaluate(()=>{
    const w=document.querySelector("#game").contentWindow;
    return w.eval(`(()=>{
     const nodes=[...document.querySelectorAll("#arenaIndicators .arena-indicator")].filter(n=>n.style.display!=="none");
     const r=nodes.map(n=>{const b=n.getBoundingClientRect();return {id:n.dataset.fighterId,x:b.x,y:b.y,w:b.width,h:b.height};});
     const collisions=[];
     for(let i=0;i<r.length;i++)for(let j=i+1;j<r.length;j++){
      const a=r[i],b=r[j];
      if(a.x<b.x+b.w+4&&a.x+a.w+4>b.x&&a.y<b.y+b.h+4&&a.y+a.h+4>b.y)collisions.push([a.id,b.id]);
     }
     return {count:state.fighters.length,visibleHud:r.length,collisions,renReady:renGlbRuntime?.isReady,
      nadaReady:nadaGlbRuntime?.isReady,
      renMeshes:scene.meshes.filter(m=>m.metadata?.fighterId==="ren"&&m.getTotalVertices?.()>0).length,
      nadaMeshes:scene.meshes.filter(m=>m.metadata?.fighterId==="nada"&&m.getTotalVertices?.()>0).length,
      camera:{alpha:arenaCamera.alpha,radius:arenaCamera.radius,fov:arenaCamera.fov},
      webglFrames:scene.getFrameId()};
    })()`);
   });
   report.push({viewport:`${width}x${height}`,...info});
   await page.screenshot({path:`artifacts/arena-stage-real-heroes/ren-nada-${width}x${height}.png`});
   assert.equal(info.count,10);assert.equal(info.visibleHud,10);assert.equal(info.renReady,true);
   assert.equal(info.nadaReady,true);assert.ok(info.renMeshes>0);assert.ok(info.nadaMeshes>0);
   assert.deepEqual(info.collisions,[]);
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync("artifacts/arena-stage-real-heroes/report.json",JSON.stringify({report,errors},null,2));
  console.log(JSON.stringify(report,null,2));
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
