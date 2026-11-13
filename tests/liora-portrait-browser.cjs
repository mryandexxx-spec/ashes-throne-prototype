"use strict";
const assert=require("node:assert/strict");
const {chromium,webkit}=require("playwright");
const fs=require("node:fs"),path=require("node:path");
const browserName=process.env.LIORA_PORTRAIT_BROWSER==="webkit"?"webkit":"chromium";
const output=path.join(process.cwd(),"artifacts/liora-portrait",browserName);
fs.mkdirSync(output,{recursive:true});
(async()=>{
 const browser=await (browserName==="webkit"?webkit:chromium).launch(
  browserName==="webkit"?{headless:true}:{headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-dev-shm-usage"]});
 try{
  for(const [width,height] of [[844,390],[932,430]]){
   const page=await browser.newPage({viewport:{width,height}});
   const errors=[];page.on("pageerror",e=>errors.push(e.message));
   await page.goto("http://127.0.0.1:8765/",{waitUntil:"load"});
   await page.evaluate(()=>showScreen("collection"));
   const image=page.locator('#heroList [data-open-hero="liora"] .liora-collection-portrait');
   await image.waitFor();
   await image.scrollIntoViewIfNeeded(); // loading=lazy must enter viewport before decode
   await page.waitForFunction(()=>{
    const img=document.querySelector('#heroList [data-open-hero="liora"] .liora-collection-portrait');
    return img&&img.complete&&img.naturalWidth===384;
   },null,{timeout:15000});
   const roster=await image.evaluate(img=>{
    const frame=img.closest(".roster-card-art"),box=img.getBoundingClientRect(),f=frame.getBoundingClientRect();
    return {natural:[img.naturalWidth,img.naturalHeight],fit:getComputedStyle(img).objectFit,
      withinFrame:box.left>=f.left-1&&box.right<=f.right+1&&box.top>=f.top-1&&box.bottom<=f.bottom+1};
   });
   assert.deepEqual(roster.natural,[384,192]);
   assert.equal(roster.fit,"cover");
   assert.equal(roster.withinFrame,true,"portrait must fit existing roster frame");
   await page.locator("#collection").screenshot({path:path.join(output,"roster-"+width+".png")});
   await page.evaluate(()=>showHeroBiography(HEROES.find(h=>h.id==="liora")));
   const bio=page.locator("#heroBiographyPortrait");
   await page.waitForFunction(()=>{
    const img=document.querySelector("#heroBiographyPortrait");
    return img&&!img.hidden&&img.complete&&img.naturalWidth===256;
   },null,{timeout:15000});
   assert.equal(await bio.isVisible(),true);
   assert.ok((await bio.getAttribute("src")).includes("liora-portrait-ui.webp"));
   await page.locator("#heroBiographyDialog").evaluate(el=>el.close());
   await page.evaluate(()=>{selectedHeroId="liora";showScreen("heroDetail");});
   await page.waitForFunction(()=>document.querySelector("#detailHeroStage")?.classList.contains("has-ren-3d"),null,{timeout:60000});
   const mode=page.locator("#renCardMode");
   console.log("LIORAPORTRAIT001 controls",await page.evaluate(()=>{
    const el=document.querySelector("#renCardMode"),group=document.querySelector("#renCard3DControls"),hero=document.querySelector("#heroDetail");
    return {modeHidden:el?.hidden,modeDisplay:getComputedStyle(el).display,groupHidden:group?.hidden,
      groupDisplay:getComputedStyle(group).display,heroActive:hero?.classList.contains("active"),
      heroDisplay:getComputedStyle(hero).display,modeVisible:el?.getBoundingClientRect().width};
   }));
   assert.equal(await mode.isVisible(),true);
   await mode.click();
   const detail=page.locator("#detailRenPortrait");
   await page.waitForFunction(()=>{
    const img=document.querySelector("#detailRenPortrait");
    return img&&!img.hidden&&img.complete&&img.naturalWidth===256;
   },null,{timeout:15000});
   assert.equal(await detail.isVisible(),true);
   assert.ok((await detail.getAttribute("src")).includes("liora-portrait-ui.webp"));
   await page.locator("#detailHeroStage").screenshot({path:path.join(output,"dossier-"+width+".png")});
   await mode.click();
   await page.waitForFunction(()=>document.querySelector("#detailHeroStage")?.classList.contains("has-ren-3d"));
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
   assert.equal(overflow,false,"no horizontal overflow in iPhone landscape");
   assert.deepEqual(errors,[],"no page errors");
   await page.close();
   console.log("LIORAPORTRAIT001 "+browserName+" "+width+"x"+height+" PASS");
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
