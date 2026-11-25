"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const {chromium,webkit}=require("playwright");
const M=require("../combat-lab/session.js");
const fixtures=require("./aud003-b12-b13-playtest-fixtures.json");
const url=process.env.LAB_URL||"http://127.0.0.1:8765/combat-lab/";
const out=path.resolve("artifacts/aud003-b12-browser/b13-4");fs.mkdirSync(out,{recursive:true});
async function importConfig(page,c){
 await page.locator("#researchTab").tap();await page.locator("#importText").fill(JSON.stringify(c));
 await page.locator("#import").tap();await page.locator("#setup").waitFor({state:"visible"});
 await page.locator("#start").tap();await page.locator("#battle").waitFor({state:"visible"});
}
async function ready(page,x){
 await page.waitForFunction(({turn,active})=>{let b=document.querySelector("#battle");return +b.dataset.turn===turn&&+b.dataset.active===active&&document.querySelector("#turn").textContent.includes("ваш ход")},x,{timeout:20000});
}
const card=(page,slot)=>page.locator('#arena .fighter[data-slot="'+slot+'"]');
const skill=(page,j)=>page.locator("#skills button").nth(j);
async function targetFirst(page,x){
 await ready(page,x);await card(page,x.command.b).tap();await skill(page,x.command.j).tap();
}
async function evidence(page,id){
 const m=await page.evaluate(()=>{let b=document.querySelector("#battle"),t=document.querySelector("#threat"),a=document.querySelector("#arena"),r=x=>{let z=x.getBoundingClientRect();return {x:z.x,y:z.y,w:z.width,h:z.height,bottom:z.bottom,right:z.right};};
 return {w:innerWidth,h:innerHeight,scroll:document.documentElement.scrollWidth,arena:r(a),threat:r(t),threatText:t.textContent,threatHidden:t.hidden,turn:document.querySelector("#turn").textContent,skills:[...document.querySelectorAll("#skills button")].map(x=>({text:x.innerText,disabled:x.disabled,rect:r(x)})),cards:[...document.querySelectorAll("#arena .fighter")].map(x=>({slot:x.dataset.slot,label:x.getAttribute("aria-label"),text:x.innerText,rect:r(x)})),feedback:document.querySelector("#feedback").innerText,turnNumber:b.dataset.turn};});
 assert.ok(m.scroll<=m.w+1&&m.arena.h>=80,JSON.stringify(m));assert.ok(m.skills.every(x=>x.rect.bottom<=m.h+1&&x.rect.right<=m.w+1&&x.rect.h>=43),JSON.stringify(m));if(!m.threatHidden)assert.ok(m.threat.bottom<=m.h+1&&m.threat.right<=m.w+1&&m.threat.h>0,JSON.stringify(m));
 await page.screenshot({path:path.join(out,id+".png")});fs.writeFileSync(path.join(out,id+".json"),JSON.stringify(m,null,2));return m;
}
async function exportState(page,id){
 await page.locator("#researchTab").tap();const promise=page.waitForEvent("download",{timeout:15000});await page.locator("#export").tap();const d=await promise,file=path.join(out,id+"-export.json");await d.saveAs(file);return JSON.parse(fs.readFileSync(file,"utf8"));
}
(async()=>{
 for(const [name,engine] of [["chromium",chromium],["webkit",webkit]]){
 const browser=await engine.launch({headless:true});
 try{
 for(const f of fixtures){
 const context=await browser.newContext({viewport:{width:844,height:320},isMobile:true,hasTouch:true,acceptDownloads:true});
 try{
 const page=await context.newPage(),errors=[];page.on("pageerror",e=>errors.push(String(e)));await page.goto(url);await page.locator("#allies .fighter").first().waitFor();
 await importConfig(page,f.config);for(const x of f.plan)await targetFirst(page,x);await ready(page,f.before);
 const id=name+"-"+f.id,m=await evidence(page,id+"-before");
 if(f.before.threats.length){assert.ok(!m.threatHidden);assert.match(m.threatText,/⚠/);for(const t of f.before.threats){assert.match(await card(page,t.slot).getAttribute("aria-label"),/⚠/);assert.match(await card(page,t.target).getAttribute("aria-label"),/Цель/);}}
 if(f.id==="guard-multi"){assert.match(m.threatText,/2 × → Подопечный/);assert.notEqual(await card(page,4).getAttribute("aria-label"),await card(page,5).getAttribute("aria-label"));}
 if(f.id==="cooldown"){assert.ok(await skill(page,2).isDisabled());assert.match(await skill(page,2).innerText(),/КД 1/);}
 if(f.id==="signal"){assert.equal(await skill(page,f.before.command.j).getAttribute("data-recipient"),String(f.before.recipient.slot));assert.match(await skill(page,f.before.command.j).innerText(),/Ускорит: Арт/);}
 const started=Date.now();await skill(page,f.before.command.j).tap();
 // The chosen skill has several legal targets in each fixture. Confirm actual highlighted destination.
 await card(page,f.before.command.b).and(page.locator(".eligible")).waitFor({state:"visible"});
 await card(page,f.before.command.b).tap();
 await page.waitForFunction(n=>+document.querySelector("#battle").dataset.turn>n||/ПОБЕДА|ПОРАЖЕНИЕ|ЛИМИТ/.test(document.querySelector("#turn").textContent),f.before.turn);
 await evidence(page,id+"-after");
 const elapsedMs=Date.now()-started;
 const payload=await exportState(page,id);
 assert.deepEqual(payload.commands[f.before.commandCount],f.expected.command);
 const actual=payload.log[f.before.commandCount].events;
 for(const event of f.expected.events){
  const got=actual.find(x=>x.type===event.type&&x.source?.slot===event.source?.slot&&x.target?.slot===event.target?.slot);
  assert.ok(got,JSON.stringify({f:f.id,event,actual}));
  for(const k of ["amount","requested","hpLoss","hpAfter"])if(event[k]!==undefined)assert.ok(Math.abs(got[k]-event[k])<1e-6,JSON.stringify({got,event,k}));
 }
 assert.deepEqual(errors,[]);
 console.log("B13.4",name,f.id,"PASS",JSON.stringify({turn:f.before.turn,prefixActions:f.plan.length,responseTaps:2,automationElapsedMs:elapsedMs,events:actual.map(x=>x.type)}));
 }finally{await context.close();}
 }
 // Regression: an already selected incompatible enemy must not silently redirect a singleton skill.
 const context=await browser.newContext({viewport:{width:932,height:430},isMobile:true,hasTouch:true,acceptDownloads:true});
 try{const page=await context.newPage();await page.goto(url);await page.locator("#allies .fighter").first().waitFor();
 const c=M.defaults();c.team=["liora","ren"];c.enemyTeam=["guard","charger"];c.ext={units:{a0:{speed:1.5},a1:{speed:.5},e0:{speed:.5},e1:{speed:.5}},tie:"seeded"};
 const x=M.create(c);assert.equal(x.state.active,0);const o=x.legal().find(o=>o.k==="teamcover");assert.ok(o);await importConfig(page,c);await ready(page,{turn:x.state.turns,active:0});
 await card(page,2).tap();await skill(page,o.j).tap();assert.equal(await page.locator("#battle").getAttribute("data-turn"),String(x.state.turns));assert.ok(await card(page,0).evaluate(e=>e.classList.contains("eligible")));
 await card(page,0).tap();const p=await exportState(page,name+"-invalid-target");assert.deepEqual(p.commands[0],o);console.log("B13.4",name,"invalid-target PASS");
 }finally{await context.close();}
 }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
