"use strict";
const {chromium,webkit}=require("playwright"),assert=require("node:assert/strict"),fs=require("node:fs");
const out="artifacts/combat2-native-hud";fs.mkdirSync(out,{recursive:true});
const url="http://127.0.0.1:8765/combat-2-hud/";
async function layout(page){
 const result=await page.evaluate(()=>{
  const rect=id=>{const r=document.querySelector(id).getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
  const ids=["#screen",".field","footer","#skills","#allies","#enemies"];
  if(!document.querySelector("#selection").hidden)ids.push("#selection");
  return {w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight,boxes:ids.map(rect)};
 });
 assert.ok(result.sw<=result.w+1&&result.sh<=result.h+1,JSON.stringify(result));
 for(const b of result.boxes)assert.ok(b.x>=-1&&b.y>=-1&&b.right<=result.w+1&&b.bottom<=result.h+1&&b.width>0&&b.height>0,JSON.stringify(result));
}
async function setup(page,preset,tier="early"){
 await page.locator("#setupBtn").tap();await page.locator("#preset").selectOption(preset);await page.locator("#tier").selectOption(tier);await page.locator("#start").tap();
 assert.equal(await page.locator("#error").textContent(),"");
}
async function autoUntil(page,predicate,max=120){
 for(let i=0;i<max;i++){
  if(await predicate())return;
  if(await page.locator("#autoStep").isDisabled())break;
  await page.locator("#autoStep").tap();assert.equal(await page.locator("#error").textContent(),"");
 }
 assert.ok(await predicate(),"condition not reached");
}
(async()=>{for(const [name,engine] of [["chromium",chromium],["webkit",webkit]]){
 const browser=await engine.launch({headless:true});
 try{for(const [width,height] of [[844,390],[932,430],[844,320],[390,844]]){
  const page=await browser.newPage({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const errors=[],bad=[];page.on("pageerror",e=>errors.push(e.message));page.on("response",r=>{if(r.status()>=400&&!r.url().endsWith("favicon.ico"))bad.push(r.status()+" "+r.url());});
  await page.goto(url,{waitUntil:"networkidle"});await page.waitForFunction(()=>document.documentElement.dataset.ready!==undefined);
  assert.equal(await page.locator("html").getAttribute("data-ready"),"true",await page.locator("#error").textContent());
  assert.equal(await page.locator("#allies .unit").count(),5);assert.equal(await page.locator("#enemies .unit").count(),5);
  await layout(page);await page.screenshot({path:out+"/"+name+"-"+width+"x"+height+".png"});
  await page.locator("#infoBtn").tap();assert.ok((await page.locator("#descriptions").textContent()).length>50);await page.locator('[data-close="details"]').tap();
  await page.locator("#enemies .unit").first().tap();await page.locator('[data-skill="basic"]').tap();assert.equal(await page.locator("#error").textContent(),"");
  await setup(page,"tempo");
  await autoUntil(page,async()=>await page.locator("#actor").textContent()==="Сава"&&!(await page.locator('[data-skill="powerful"]').isDisabled()),20);
  const before=await page.locator(".unit .numbers").allTextContents();
  if(!(await page.locator('[data-skill="special"]').isDisabled())){await page.locator('[data-skill="special"]').tap();await page.locator('[data-fighter="ren"]').tap();assert.match(await page.locator("#preview").textContent(),/Инициатива/);await page.locator("#cancel").tap();assert.deepEqual(await page.locator(".unit .numbers").allTextContents(),before);}
  await page.locator('[data-skill="powerful"]').tap();assert.equal(await page.locator("#confirm").isDisabled(),true);
  await page.locator('[data-fighter="ren"]').tap();assert.equal(await page.locator("#confirm").isDisabled(),false);
  assert.match(await page.locator("#preview").textContent(),/Сава \+ Рен/);
  await layout(page);
  const boxes=await page.evaluate(()=>({selection:document.querySelector("#selection").getBoundingClientRect().top,field:document.querySelector(".field").getBoundingClientRect().bottom}));
  assert.ok(boxes.selection>=boxes.field-1,JSON.stringify(boxes));
  await page.screenshot({path:out+"/"+name+"-"+width+"x"+height+"-helper.png"});
  await page.locator("#cancel").tap();assert.deepEqual(await page.locator(".unit .numbers").allTextContents(),before);
  assert.equal(await page.locator("#actor").textContent(),"Сава");
  await page.locator('[data-skill="powerful"]').tap();await page.locator('[data-fighter="ren"]').tap();await page.locator("#confirm").tap();
  assert.equal(await page.locator("#selection").isVisible(),false);assert.equal(await page.locator("#error").textContent(),"");
  await page.locator("#logBtn").tap();assert.ok((await page.locator("#log").textContent()).length>20);await page.locator('[data-close="journal"]').tap();
  await setup(page,"waves");assert.equal(await page.locator("#enemies .unit").count(),3);
  await autoUntil(page,async()=>/Победа|Поражение/.test(await page.locator("#actor").textContent()));
  assert.match(await page.locator("#stage").textContent(),/2\/2/);await layout(page);
  await page.screenshot({path:out+"/"+name+"-"+width+"x"+height+"-result.png"});
  await page.locator("#restart").tap();assert.equal(await page.locator("#enemies .unit").count(),3);
  await page.locator("#autoRun").tap();await page.waitForTimeout(200);if(await page.locator("#autoRun").textContent()==="Стоп")await page.locator("#autoRun").tap();assert.equal(await page.locator("#autoRun").textContent(),"Авто");assert.equal(await page.locator("#error").textContent(),"");
  assert.doesNotMatch(await page.locator("#actor").textContent(),/Победа|Поражение/);
  if(width===844&&height===390){await setup(page,"tempo","mid");await autoUntil(page,async()=>/Победа|Поражение/.test(await page.locator("#actor").textContent()));assert.equal(await page.locator("#actor").textContent(),"Поражение");await page.locator("#restart").tap();assert.doesNotMatch(await page.locator("#actor").textContent(),/Победа|Поражение/);}
  assert.deepEqual(errors,[]);assert.deepEqual(bad,[]);await page.close();console.log(name,width,height,"PASS");
 }}finally{await browser.close();}
}})().catch(e=>{console.error(e);process.exitCode=1;});
