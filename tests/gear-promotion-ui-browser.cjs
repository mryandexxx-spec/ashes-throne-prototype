"use strict";
// GEARVICTORY001: real Chromium/WebKit layout for the same presentation used by the saved promotion.
const assert=require("node:assert/strict");
const {chromium,webkit}=require("playwright");
const fs=require("node:fs");
fs.mkdirSync("artifacts/gear-victory",{recursive:true});
async function run(name,kind){
 const browser=await kind.launch(name==="chromium"?
  {headless:true,args:["--no-sandbox","--use-angle=swiftshader","--enable-webgl","--disable-dev-shm-usage"]}:
  {headless:true});
 const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 try{
  await page.goto("http://127.0.0.1:8765/",{waitUntil:"load",timeout:60000});
  await page.waitForFunction(()=>typeof GearPromotionUI!=="undefined"&&
   typeof showScreen==="function"&&
   document.getElementById("walletWriterNotice")?.style.display==="none",null,{timeout:60000});
  await page.evaluate(()=>{
   selectedHeroId="ren";showScreen("heroDetail");
   window.__gearVictorySavedState=JSON.stringify(progress);
   GearPromotionUI.show({heroName:"Рен Терен",from:5,to:6,currency:1250,
    before:{hp:505,atk:133,speed:150},after:{hp:515,atk:136,speed:150}});
  });
  assert.equal(await page.locator("#gearPromotionDialog").evaluate(n=>n.open),true);
  assert.equal(await page.locator("#gearPromotionTier").textContent(),"G6");
  assert.equal(await page.locator("#gearPromotionStats .gear-victory-stat").count(),2);
  await page.locator("#gearPromotionPortrait").evaluate(img=>img.decode());
  const portrait=await page.locator("#gearPromotionPortrait").evaluate(img=>({w:img.naturalWidth,h:img.naturalHeight}));
  assert.ok(portrait.w>0&&portrait.h>0,"Real approved portrait must decode");
  for(const [width,height] of [[844,390],[932,430],[844,320]]){
   await page.setViewportSize({width,height});
   await page.waitForTimeout(180);
   const metrics=await page.evaluate(()=>{
    const root=document.documentElement,dlg=document.getElementById("gearPromotionDialog");
    const frame=dlg.querySelector(".gear-victory-frame"),button=document.getElementById("gearPromotionClose");
    const rank=document.querySelector(".gear-victory-medal"),stats=document.getElementById("gearPromotionStats");
    const asRect=node=>{const r=node.getBoundingClientRect();
     return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};
    return {modal:asRect(dlg),frame:asRect(frame),button:asRect(button),rank:asRect(rank),stats:asRect(stats),
     screen:{width:innerWidth,height:innerHeight},
     documentOverflow:root.scrollWidth>innerWidth+1||root.scrollHeight>innerHeight+1,
     internalOverflow:frame.scrollHeight>frame.clientHeight+2||frame.scrollWidth>frame.clientWidth+2};
   });
   console.log("GEARVICTORY001",name,width,height,metrics);
   assert.ok(metrics.modal.left>=0&&metrics.modal.top>=0&&
    metrics.modal.right<=width+1&&metrics.modal.bottom<=height+1,"Dialog viewport");
   assert.ok(metrics.button.height>=43&&metrics.button.width>=100&&
    metrics.button.bottom<=metrics.modal.bottom+1,"Continue stays visible and touch sized");
   assert.ok(metrics.rank.width>=73&&metrics.stats.width>130,"Visible rank and real stats");
   assert.equal(metrics.internalOverflow,false,"Dialog content must fit landscape");
   assert.equal(metrics.documentOverflow,false,"No body overflow");
   await page.screenshot({path:"artifacts/gear-victory/"+name+"-"+width+"x"+height+".png"});
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(progress)===window.__gearVictorySavedState),true,
   "Opening victory UI never changes player progress or wallet");
  await page.locator("#gearPromotionClose").tap();
  assert.equal(await page.locator("#gearPromotionDialog").evaluate(n=>n.open),false);
  await page.evaluate(()=>GearPromotionUI.show({heroName:"Рен Терен",from:6,to:7,currency:1500,
   before:{hp:515,atk:136,speed:150},after:{hp:525,atk:139,speed:150}}));
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#gearPromotionDialog").evaluate(n=>n.open),false);
  assert.deepEqual(errors,[],"No page JS errors");
  console.log("GEARVICTORY001_BROWSER_PASS",name);
 }finally{await browser.close();}
}
(async()=>{await run("chromium",chromium);await run("webkit",webkit);})()
.catch(e=>{console.error(e);process.exitCode=1;});