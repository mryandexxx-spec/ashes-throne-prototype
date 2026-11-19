"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const { chromium, webkit }=require("playwright");

(async()=>{
 const engine=process.env.HERO_BROWSER==="webkit"?webkit:chromium;
 const browser=await engine.launch({headless:true,executablePath:process.env.BROWSER_EXECUTABLE||undefined,
  args:engine===chromium?["--use-angle=swiftshader","--enable-webgl"]:[]});
 const capture=async(page,name)=>{
  fs.mkdirSync("artifacts/gear-materials",{recursive:true});
  await page.screenshot({path:"artifacts/gear-materials/"+engine.name()+"-"+name+".png"});
 };
 try{
  const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true});
  if(process.env.BABYLON_FIXTURE)await page.route("https://cdn.babylonjs.com/v9.33.2/babylon.js",
   route=>route.fulfill({path:process.env.BABYLON_FIXTURE,contentType:"application/javascript"}));
  const errors=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto(process.env.GAME_ORIGIN||"http://127.0.0.1:8765/");
  await page.waitForFunction(()=>typeof showScreen==="function");
  const dialog=page.locator("#materialDialog");
  const open=async(selector)=>{
   const tile=page.locator(selector).first();await tile.tap();
   await dialog.waitFor({state:"visible"});
   assert.ok(await page.locator("#materialIcon").evaluate(async img=>{await img.decode();return img.naturalWidth===160;}));
   assert.equal(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
   const bounds=await dialog.boundingBox();
   assert.ok(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=page.viewportSize().width+1&&
    bounds.y+bounds.height<=page.viewportSize().height+1);
  };
  const close=async()=>{await page.locator("#materialClose").tap();await dialog.waitFor({state:"hidden"});};
  await page.evaluate(()=>showScreen("loginCalendar"));
  const before=await page.evaluate(()=>JSON.stringify(progress));
  for(const key of ["Fe","Le","Cl","Wo","Fa","Th","Gl"]){
   const selector='#loginCalendarGrid [data-material="'+key+'"]';
   await open(selector);
   const body=await page.locator("#materialSources").innerText();
   assert.ok(body.includes("Учебная кампания")&&body.includes("Календарь входа"));
   const awards=await page.evaluate(id=>GearSourceData.findSources(id,campaignProgress,progress.energy.value),key);
   for(const m of awards)assert.ok(body.includes(m.title+" · ×"+m.quantity));
   if(key==="Gl")assert.ok(!body.includes("Акт 1 ·")&&!body.includes("Задания дня"));
   await close();
   assert.equal(await page.locator(selector).first().evaluate(el=>document.activeElement===el),true);
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(progress)),before);
  await page.evaluate(()=>showScreen("dailyTasks"));
  await open("#dailyTaskList [data-material]");await close();
  await page.evaluate(()=>showScreen("campaign"));
  await page.locator('[data-campaign-path="training"]').tap();
  await open("#campaignMissions [data-material]");await close();
  await page.evaluate(()=>openHeroDetail("ren",0));
  await page.setViewportSize({width:667,height:320});
  await capture(page,"recipe");
  await open("#gearUxRight [data-material=Fe]");
  await capture(page,"material");
  assert.match(await page.locator("#materialStock").innerText(),/Нужно 2 · Не хватает 2/);
  await page.locator("#materialFind").tap();
  await page.locator("#gearUxLeft .gear-ux-source-actions .primary").first().tap();
  await page.locator("#squadBack").tap();
  assert.ok(await page.locator("#gearUxRight [data-material=Fe]").isVisible());
  await page.evaluate(()=>showScreen("network"));
  await page.waitForSelector("#net004Clues .net004-clue");
  const boardTile=page.locator("#net004Clues [data-material]").first();
  if(await boardTile.count()){
   const selected=await page.locator('#net004Clues [data-selected="true"] [data-net-value]').getAttribute("data-net-value");
   await open("#net004Clues [data-material]");await close();
   assert.equal(await page.locator('#net004Clues [data-selected="true"] [data-net-value]').getAttribute("data-net-value"),selected);
  }
  const order=await page.evaluate(()=>JSON.stringify(networkPilot.read().order));
  await page.locator("#netuxOrderOpen").tap();
  await open("#net005OrderChoices [data-material=Fe]");
  assert.match(await page.locator("#materialSources").innerText(),/Разведсеть · снабжение/);
  await page.keyboard.press("Escape");
  assert.ok(await page.locator("#netuxOrderDialog").evaluate(el=>el.open));
  assert.equal(await page.evaluate(()=>JSON.stringify(networkPilot.read().order)),order);
  await page.keyboard.press("Escape");
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
  assert.deepEqual(errors,[]);
  console.log("Seven icons, live sources, touch, quantities, focus, nested dialogs and recipe return passed");
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
