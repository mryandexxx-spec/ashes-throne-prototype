"use strict";
// Read-only A/B visual review. Changes are made only in the test browser session.
const { chromium } = require("playwright");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const URL = "http://127.0.0.1:8765/tests/fixtures/env022-full-game.html";
(async () => {
  fs.mkdirSync("artifacts/arena-ab", { recursive:true });
  const browser = await chromium.launch({headless:true,args:["--no-sandbox","--use-angle=swiftshader","--enable-webgl","--enable-unsafe-swiftshader"]});
  const report = [];
  try {
    for(const [w,h,profile] of [[844,390,"med"],[667,375,"low"]]){
      const page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:1,hasTouch:true,isMobile:true});
      const errors=[];
      page.on("pageerror",e=>errors.push(e.message));
      await page.goto(URL,{waitUntil:"load",timeout:60000});
      await page.waitForFunction(()=>document.documentElement.dataset.visualStatus==="ready",{timeout:60000});
      const before=await page.evaluate(()=>{
        const win=document.querySelector("#game").contentWindow;
        win.eval(`state=CombatCore.createBattle([...HEROES.filter(f=>f.side==="ally").slice(0,5),...HEROES.filter(f=>f.side==="enemy").slice(0,5)]); CombatCore.advanceToPlayerTurn(state); syncBattleUI(); updateMeshes();`);
        return win.eval(`({fighters:state.fighters.length,camera:{alpha:arenaCamera.alpha,beta:arenaCamera.beta,radius:arenaCamera.radius,fov:arenaCamera.fov},canvas:{width:engine.getRenderWidth(),height:engine.getRenderHeight()}})`);
      });
      assert.equal(before.fighters,10,"5v5 required");
      await page.waitForTimeout(1800);
      await page.screenshot({path:`artifacts/arena-ab/before-${w}x${h}-${profile}.png`,animations:"disabled"});
      // Camera and formations from Dune v94: Babylon axes, test browser only.
      const proposed=await page.evaluate(()=>{
        const win=document.querySelector("#game").contentWindow;
        win.eval(`
          formationPosition=function(side,slot,count){
            const near={x:-11.5/15.24,z:10/15.24}, tangent={x:near.z,z:-near.x};
            const front=Math.min(3,count),back=count-front,isBack=slot>=front;
            const rank=isBack?slot-front:slot,rankCount=isBack?back:front;
            const signed=side==="ally"?1:-1;
            const depth=signed*(2.35+(isBack?.65:-.45));
            // Separate teams horizontally in camera space to avoid ten stacked silhouettes.
            const lateral=(side==="ally"?3.25:-3.25)+(rank-(rankCount-1)/2)*1.65;
            return {x:near.x*depth+tangent.x*lateral,z:near.z*depth+tangent.z*lateral};
          };
          arenaCamera.lowerAlphaLimit=null;arenaCamera.upperAlphaLimit=null;
          arenaCamera.lowerBetaLimit=.5;arenaCamera.upperBetaLimit=1.55;
          arenaCamera.lowerRadiusLimit=9;arenaCamera.upperRadiusLimit=22;
          // Target first: Babylon's setTarget recalculates the current alpha/beta/radius.
          arenaCamera.setTarget(new BABYLON.Vector3(0,1.35,0));
          arenaCamera.alpha=Math.atan2(10,-11.5);
          arenaCamera.radius=Math.hypot(-11.5,10,2.55);
          arenaCamera.beta=Math.acos(2.55/arenaCamera.radius);
          arenaCamera.fov=36*Math.PI/180;
          updateMeshes(); positionArenaIndicators();
        `);
        return win.eval(`({fighters:state.fighters.length,camera:{alpha:arenaCamera.alpha,beta:arenaCamera.beta,radius:arenaCamera.radius,fov:arenaCamera.fov}})`);
      });
      await page.waitForTimeout(1800);
      await page.screenshot({path:`artifacts/arena-ab/proposed-${w}x${h}-${profile}.png`,animations:"disabled"});
      const geometry=await page.evaluate(()=>{
        const win=document.querySelector("#game").contentWindow;
        return win.eval(`(() => {
          const bounds=[...document.querySelectorAll("#arenaIndicators .arena-indicator")].map(n=>{const r=n.getBoundingClientRect();return {id:n.dataset.fighterId,x:r.x,y:r.y,w:r.width,h:r.height}});
          let collisions=0;for(let i=0;i<bounds.length;i++)for(let j=i+1;j<bounds.length;j++){const a=bounds[i],b=bounds[j];if(a.x<b.x+b.w+5&&a.x+a.w+5>b.x&&a.y<b.y+b.h+5&&a.y+a.h+5>b.y)collisions++}
          return {bounds,collisions,renderedFrames:scene.getFrameId(),qualityProfilesAvailable:false};
        })()`);
      });
      report.push({viewport:`${w}x${h}`,requestedProfile:profile,profileNote:"Target game does not yet expose Dune MED/LOW presets; screenshots use its current renderer with software WebGL.",before,proposed,geometry,errors});
      await page.close();
    }
    fs.writeFileSync("artifacts/arena-ab/report.json",JSON.stringify(report,null,2));
    console.log(JSON.stringify(report.map(({viewport,before,geometry,errors})=>({viewport,fighters:before.fighters,collisions:geometry.collisions,renderedFrames:geometry.renderedFrames,errors})),null,2));
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
