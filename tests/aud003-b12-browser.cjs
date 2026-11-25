"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {chromium,webkit}=require("playwright");
const M=require("../combat-lab/session.js");
const url=process.env.LAB_URL||"http://127.0.0.1:8765/combat-lab/";
const out=path.resolve("artifacts/aud003-b12-browser");fs.mkdirSync(out,{recursive:true});
async function layout(page){
 const metrics=await page.evaluate(()=>{const r=id=>{const x=document.getElementById(id).getBoundingClientRect();return {top:x.top,bottom:x.bottom,left:x.left,right:x.right,height:x.height};};const buttons=[...document.querySelectorAll("#battle button:not(:disabled)")].map(x=>({h:x.getBoundingClientRect().height,w:x.getBoundingClientRect().width}));return {w:innerWidth,h:innerHeight,scroll:document.documentElement.scrollWidth,arena:r("arena"),battle:r("battle"),buttons,skills:r("skills")};});
 assert.ok(metrics.scroll<=metrics.w+1,JSON.stringify(metrics));assert.ok(metrics.battle.bottom<=metrics.h+1,JSON.stringify(metrics));assert.ok(metrics.arena.height>=80,JSON.stringify(metrics));assert.ok(metrics.skills.bottom<=metrics.h+1,JSON.stringify(metrics));assert.ok(metrics.buttons.every(x=>x.h>=43&&x.w>=25),JSON.stringify(metrics));return metrics;
}
async function importConfig(page,c){
 await page.locator("#researchTab").click();await page.locator("#importText").fill(JSON.stringify(c));await page.locator("#import").click();await page.locator("#setup").waitFor({state:"visible"});await page.locator("#start").click();await page.locator("#battle").waitFor({state:"visible"});assert.equal(await page.locator("#setupError").textContent(),"");
}
(async()=>{
 for(const [name,engine] of [["chromium",chromium],["webkit",webkit]]){
  const browser=await engine.launch({headless:true});
  try{
   for(const [width,height] of [[844,320],[844,390],[932,430]]){
    const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,acceptDownloads:true});const page=await context.newPage();const errors=[];
    page.on("pageerror",e=>errors.push(String(e)));await page.goto(url);await page.locator("#allies .fighter").first().waitFor();const initial=await page.locator("#turn").textContent();assert.match(initial,/ваш ход/);
    const metrics=await layout(page);await page.screenshot({path:path.join(out,name+"-"+width+"x"+height+"-opening.png")});
    await page.locator("#researchTab").click();await page.locator("#forecast").click();assert.ok(await page.locator("#forecastResults tr").count()>2);await page.locator("#playTab").click();
    await page.locator("#skills button").first().click();await page.locator("#enemies .eligible").first().click();await page.locator("#logTab").click();assert.ok(await page.locator("#events .event").count()>=1);assert.ok(await page.locator("#events .trace").count()>0);
    await page.locator("#playTab").click();await page.locator("#restart").click();assert.equal(await page.locator("#turn").textContent(),initial);
    await page.locator("#setupTab").click();await page.locator("#teamPresets button").nth(2).click();assert.equal(await page.locator("#order button").count(),5);
    await page.locator("#mode").selectOption("hold");await page.locator("#advanced > summary").click();await page.locator("#advancedControls input").first().fill(".1");await page.locator("#advancedControls input").first().press("Tab");
    await page.locator("#start").click();await page.locator("#battle").waitFor({state:"visible"});assert.equal(await page.locator("#allies .fighter").count(),6);assert.match(await page.locator("#objective").textContent(),/Оборона/);await layout(page);
    await page.screenshot({path:path.join(out,name+"-"+width+"x"+height+"-five.png")});
    await page.locator("#auto").click();await page.waitForTimeout(400);await page.locator("#auto").click();await page.locator("#restart").click();assert.match(await page.locator("#auto").textContent(),/выкл/);
    if(height===390){
      const c=M.defaults();c.mode="waves";c.team=["ren","art"];c.enemyTeam=["raider"];c.ext={units:{a0:{atk:4},a1:{atk:4},e0:{hp:.25}},waves:[["guard"]],openingGuard:.2,tie:"seeded",trust:{art:"base",sava:"base"}};
      await importConfig(page,c);assert.match(await page.locator("#objective").textContent(),/Волна 1\/2/);await page.locator("#auto").click();await page.waitForFunction(()=>document.querySelector("#turn").textContent==="ПОБЕДА",{},{timeout:30000});assert.match(await page.locator("#objective").textContent(),/Волна 2\/2/);
      await page.screenshot({path:path.join(out,name+"-waves-win.png")});await page.locator("#researchTab").click();await page.locator("#count").fill("2");await page.locator("#save").click();await page.locator("#batch").click();await page.waitForFunction(()=>document.querySelector("#batchStatus").textContent.startsWith("Готово"),{},{timeout:30000});assert.equal(await page.locator("#results tr").count(),5);assert.equal(await page.locator("#batchStatus").getAttribute("data-engine"),"worker");
      await page.locator("#compare").click();await page.waitForFunction(()=>document.querySelector("#batchStatus").textContent.startsWith("Готово"),{},{timeout:30000});assert.equal(await page.locator("#results tr").count(),3);assert.equal(await page.locator("#batchStatus").getAttribute("data-engine"),"worker");
      const downloadPromise=page.waitForEvent("download",{timeout:15000});await page.locator("#export").click();const download=await downloadPromise;const file=path.join(out,name+"-export.json");await download.saveAs(file);const payload=JSON.parse(fs.readFileSync(file,"utf8"));assert.equal(payload.config.mode,"waves");assert.equal(payload.result.reason,"win");assert.ok(payload.batch.rows);assert.ok(payload.events.some(x=>x.type==="damage"));assert.ok(payload.events.some(x=>x.type==="wave"));
      const loss=M.defaults();loss.team=["ren","art"];loss.enemyTeam=["charger","raider"];loss.opt.eatk=2;loss.ext={units:{a0:{hp:.25},a1:{hp:.25},e0:{atk:4,hp:4},e1:{atk:4,hp:4}},waves:[],openingGuard:0,tie:"slot",trust:{art:"base",sava:"base"}};
      await importConfig(page,loss);await page.locator("#auto").click();await page.waitForFunction(()=>document.querySelector("#turn").textContent==="ПОРАЖЕНИЕ",{},{timeout:30000});await page.locator("#restart").click();assert.match(await page.locator("#turn").textContent(),/ваш ход|противник/);
      await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.setViewportSize({width,height});await layout(page);
    }
    assert.deepEqual(errors,[]);console.log(name,width,height,JSON.stringify(metrics),"PASS");await context.close();
   }
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});