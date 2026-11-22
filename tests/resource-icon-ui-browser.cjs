"use strict";
// RESICON001 mobile tap flow: actual game HTML, not synthetic unit-only checks.
const assert=require("node:assert/strict");
const {chromium,webkit}=require("playwright");
const fs=require("node:fs");
const base=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
fs.mkdirSync("artifacts/resource-icons",{recursive:true});
async function run(name,browserType){
 const browser=await browserType.launch(name==="chromium"?
  {headless:true,args:["--no-sandbox","--use-angle=swiftshader","--enable-webgl","--disable-dev-shm-usage"]}:
  {headless:true});
 const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true}),errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 try{
  await page.goto(base,{waitUntil:"load",timeout:60000});
  await page.waitForFunction(()=>typeof showScreen==="function"&&
   typeof ResourceIconUI!=="undefined"&&
   document.getElementById("walletWriterNotice")?.style.display==="none",null,{timeout:60000});
  for(const [width,height] of [[844,390],[932,430],[844,320]]){
   await page.setViewportSize({width,height});
   await page.evaluate(()=>showScreen("home"));
   const krom=page.locator("#home .hq-krom-button[data-resource-id='krom']");
   assert.equal(await krom.count(),1,"HQ uses shared resource icon");
   await krom.tap();
   assert.equal(await page.locator("#resourceDialog").evaluate(n=>n.open),true);
   assert.match(await page.locator("#resourceDialogTitle").textContent(),/Кром/);
   assert.match(await page.locator("#resourceDialogStock").textContent(),/В запасе/);
   assert.match(await page.locator("#resourceDialogSources").textContent(),/Задания дня/);
   const coin=await page.locator("#resourceDialogArt .resource-art--krom").evaluate(el=>{
    const rect=el.getBoundingClientRect(),url=getComputedStyle(el).backgroundImage;
    return {width:rect.width,height:rect.height,url};
   });
   assert.ok(coin.width>=48&&coin.height>=48&&coin.url.includes("krom.webp"));
   await page.locator("#resourceDialogClose").tap();
   assert.equal(await krom.evaluate(n=>document.activeElement===n),true);
   await page.evaluate(()=>showScreen("dailyTasks"));
   const xp=page.locator("#dailyTaskList .resource-chip[data-resource-id='account-xp']").first();
   await xp.tap();
   assert.equal(await page.locator("#resourceDialog").evaluate(n=>n.open),true,"tap opens XP card");
   assert.match(await page.locator("#resourceDialogTitle").textContent(),/Опыт аккаунта/);
   assert.match(await page.locator("#resourceDialogSources").textContent(),/Задания дня/);
   const bounds=await page.locator("#resourceDialog").evaluate(el=>{
    const r=el.getBoundingClientRect();
    return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:innerWidth,height:innerHeight,
     horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1};
   });
   assert.ok(bounds.left>=0&&bounds.right<=bounds.width+1&&bounds.top>=0&&bounds.bottom<=bounds.height+1,
    "XP popup must remain inside landscape "+width+"×"+height);
   assert.equal(bounds.horizontalOverflow,false);
   await page.locator("#resourceDialogClose").tap();
   assert.equal(await page.locator("#resourceDialog").evaluate(n=>n.open),false);
   assert.equal(await xp.evaluate(n=>document.activeElement===n),true,"focus returns to icon");

   await page.evaluate(()=>{
    selectedHeroId="ren";showScreen("heroDetail");openSkillUpgrade("basic");
    // Test the same real event handling with a high-tier cost tile. Do not alter save or balance.
    document.querySelector("#skillCostText").insertAdjacentHTML("beforeend",
     ResourceIconUI.tile("manual1",2,{stock:0,need:2}));
   });
   const manual=page.locator("#skillCostText [data-resource-id='manual1']");
   await manual.tap();
   assert.equal(await page.locator("#resourceDialog").evaluate(n=>n.open),true);
   assert.equal(await page.locator("#skillUpgradeDialog").evaluate(n=>n.open),true);
   assert.match(await page.locator("#resourceDialogStock").textContent(),/В запасе/);
   const source=page.locator("#resourceDialogSources [data-resource-route='dailyTasks']").first();
   await source.tap();
   assert.equal(await page.locator("#resourceDialog").evaluate(n=>n.open),false);
   assert.equal(await page.locator("#skillUpgradeDialog").evaluate(n=>n.open),false);
   assert.equal(await page.locator("#dailyTasks").evaluate(n=>n.classList.contains("active")),true);
   await page.screenshot({path:"artifacts/resource-icons/"+name+"-"+width+"x"+height+".png"});
  }
  assert.deepEqual(errors,[],"No page JS errors");
  console.log("RESICON001_BROWSER_PASS",name);
 }finally{await browser.close();}
}
(async()=>{await run("chromium",chromium);await run("webkit",webkit);})()
.catch(e=>{console.error(e);process.exitCode=1;});
