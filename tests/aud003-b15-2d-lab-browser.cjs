"use strict";
const {chromium,webkit}=require("playwright"),assert=require("node:assert/strict"),fs=require("node:fs");
const out="artifacts/combat2-lab";fs.mkdirSync(out,{recursive:true});
(async()=>{for(const [name,engine] of [["chromium",chromium],["webkit",webkit]]){
 const browser=await engine.launch({headless:true});
 try{for(const [width,height] of [[844,390],[932,430],[844,320],[390,844]]){
 const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 await page.goto("http://127.0.0.1:8765/lab-combat-2/",{waitUntil:"networkidle"});
 await page.waitForFunction(()=>document.documentElement.dataset.ready!==undefined);
 assert.equal(await page.locator("html").getAttribute("data-ready"),"true",await page.locator("#error").textContent());
 assert.equal(await page.locator("#allies .unit").count(),5);assert.equal(await page.locator("#enemies .unit").count(),5);
 const layout=await page.evaluate(()=>{const b=document.querySelector("#skills").getBoundingClientRect(),m=document.querySelector("main").getBoundingClientRect();return {vw:innerWidth,vh:innerHeight,scroll:document.documentElement.scrollWidth,skillTop:b.top,skillBottom:b.bottom,mainBottom:m.bottom};});
 assert.ok(layout.scroll<=layout.vw+1&&layout.skillBottom<=layout.vh+1&&layout.skillTop>=0,JSON.stringify(layout));
 await page.screenshot({path:out+"/"+name+"-"+width+"x"+height+".png"});
 await page.locator("#enemies button").first().tap();await page.locator('[data-ability="basic"]').tap();
 assert.equal(await page.locator("#error").textContent(),"");
 await page.locator("#journalbtn").tap();assert.ok((await page.locator("#loglist").textContent()).length>20);await page.locator('[data-close="journal"]').tap();
 await page.locator("#compare").tap();assert.equal(await page.locator(".compareRow").count(),3);await page.locator('[data-close="comparison"]').tap();
 await page.locator("#setupbtn").tap();await page.locator("#variant").selectOption("art-only");await page.locator("#scenario").selectOption("waves");await page.locator("#start").tap();
 assert.equal(await page.locator("#enemies .unit").count(),3);
 // Actual tactical actions via UI; no direct mutation of engine state.
 for(let i=0;i<120;i++){if(await page.locator("#autostep").isDisabled())break;await page.locator("#autostep").tap();assert.equal(await page.locator("#error").textContent(),"");}
 assert.match(await page.locator("#turn").textContent(),/ПОБЕДА|ПОРАЖЕНИЕ/);
 assert.match(await page.locator("#scenarioLabel").textContent(),/волна 2\/2/);
 await page.screenshot({path:out+"/"+name+"-"+width+"x"+height+"-finish.png"});
 await page.locator("#restart").tap();assert.equal(await page.locator("#enemies .unit").count(),3);assert.match(await page.locator("#turn").textContent(),/Ход:/);
 assert.deepEqual(errors,[]);await page.close();console.log(name,width,height,"PASS");
 }}finally{await browser.close();}
}})().catch(e=>{console.error(e);process.exitCode=1;});
