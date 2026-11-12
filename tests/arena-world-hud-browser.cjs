"use strict";
const {chromium}=require("playwright");
const fs=require("node:fs"),assert=require("node:assert/strict");
(async()=>{
 fs.mkdirSync("artifacts/arena-world-hud",{recursive:true});
 const browser=await chromium.launch({headless:true,args:["--no-sandbox","--use-angle=swiftshader","--enable-webgl","--enable-unsafe-swiftshader"]});
 const report=[];
 try{
  for(const [width,height] of [[844,390],[667,375]]){
   const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,hasTouch:true,isMobile:true});
   const errors=[];page.on("pageerror",e=>errors.push(e.message));
   await page.goto("http://127.0.0.1:8765/tests/fixtures/env022-full-game.html",{waitUntil:"load",timeout:60000});
   await page.waitForFunction(()=>document.documentElement.dataset.visualStatus==="ready",{timeout:65000});
   await page.evaluate(()=>{
    const win=document.querySelector("#game").contentWindow;
    win.eval(`state=CombatCore.createBattle([...HEROES.filter(f=>f.side==="ally").slice(0,5),...HEROES.filter(f=>f.side==="enemy").slice(0,5)]);CombatCore.advanceToPlayerTurn(state);syncBattleUI();updateMeshes();`);
   });
   await page.waitForTimeout(1600);
   const result=await page.evaluate(()=>{
    const win=document.querySelector("#game").contentWindow;
    return win.eval(`(()=>{
      const hud=document.querySelector("#arenaIndicators");
      const bounds=[...hud.querySelectorAll(".arena-indicator")].filter(e=>e.style.display!=="none").map(e=>{
       const r=e.getBoundingClientRect();return {id:e.dataset.fighterId,x:r.x,y:r.y,w:r.width,h:r.height};
      });
      const overlap=[];
      for(let i=0;i<bounds.length;i++)for(let j=i+1;j<bounds.length;j++){
       const a=bounds[i],b=bounds[j];
       if(a.x<b.x+b.w+4&&a.x+a.w+4>b.x&&a.y<b.y+b.h+4&&a.y+a.h+4>b.y)overlap.push([a.id,b.id]);
      }
      return {fighters:state.fighters.length,engineFrames:scene.getFrameId(),tracked:arenaHudLayout?.rows.size||0,
       overlay:{width:hud.clientWidth,height:hud.clientHeight},overlap,bounds};
    })()`);
   });
   await page.screenshot({path:`artifacts/arena-world-hud/5v5-${width}x${height}.png`});
   report.push({viewport:`${width}x${height}`,...result,errors});
   assert.equal(result.fighters,10);
   assert.equal(result.tracked,10);
   assert.ok(result.engineFrames>2);
   assert.deepEqual(errors,[]);
   await page.close();
  }
 }finally{await browser.close();}
 fs.writeFileSync("artifacts/arena-world-hud/report.json",JSON.stringify(report,null,2));
 console.log(JSON.stringify(report.map(({viewport,tracked,overlap,overlay})=>({viewport,tracked,overlap,overlay})),null,2));
 assert.ok(report.every(x=>x.overlap.length===0),"HUD labels should not overlap: see artifacts/arena-world-hud/report.json");
})().catch(error=>{console.error(error);process.exitCode=1;});
