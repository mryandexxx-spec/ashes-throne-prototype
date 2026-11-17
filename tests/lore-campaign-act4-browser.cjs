"use strict";
/* LOREACT4001: real published game navigation on restored nine-scene saves. */
const assert=require("node:assert/strict");
const {chromium,webkit}=require("playwright");
const fs=require("node:fs"),path=require("node:path");
const Core=require("../lore-campaign-core.js");
const Scripts=require("../lore-campaign-scenes.js");
const Engine=require("../lore-campaign-scene-core.js");
const Runtime=require("../lore-campaign-scene-runtime.js");
const Save=require("../lore-campaign-scene-save.js");
const Act3=require("../lore-campaign-act3.js");
const out=path.join(process.cwd(),"artifacts","lore-act4");fs.mkdirSync(out,{recursive:true});
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
function seed(){
 const map=new Map(),storage={getItem:k=>map.has(k)?map.get(k):null,
  setItem:(k,v)=>map.set(k,String(v))};
 const r=Runtime.create({graph:Act3.data.catalog(),graphCore:Core,pack:Act3.pack,
  scriptData:Scripts,sceneCore:Engine,saveModule:Save,storage});
 for(let i=1;i<=9;i++){
  const id="five-shadows:fs-"+String(i).padStart(2,"0");
  assert.equal(r.start(id).ok,true,"start "+id);
  for(let step=0;step<90;step++){
   let view=r.current(),moved=false;
   for(const o of view.inspections)if(!o.done){assert.equal(r.inspect(o.id).ok,true);moved=true;}
   view=r.current();
   for(const o of view.comparisons)if(o.ready&&!o.done){assert.equal(r.compare(o.id).ok,true);moved=true;}
   view=r.current();
   if(view.choices.length){assert.equal(r.choose(view.choices[0].id).ok,true);moved=true;}
   else if(view.canContinue){assert.equal(r.next().ok,true);moved=true;}
   else if(view.canFinish){assert.equal(r.finish().ok,true);moved=true;break;}
   assert.equal(moved,true,"cannot stall "+id);
  }
  assert.equal(r.stateFor("five-shadows").completedNodeIds.includes(id),true);
  if(i<=6){
   const battle=r.beginRequiredBattle(id);
   assert.equal(battle.ok,true);
   assert.equal(r.recordBattleVictory(id,battle.battleId).ok,true);
  }
 }
 return map.get(Core.KEY);
}
async function enter(page){
 await page.locator('#home .hq-bottom button[data-screen="campaign"]').evaluate(el=>el.click());
 await page.locator('[data-campaign-path="lore"]').click();
 await page.locator(".lore-story-cover").click();
}
async function finish(page){
 for(let i=0;i<130;i++){
  let done=false;
  const inspections=page.locator('[data-lore-action="scene-inspect"]');
  for(let j=0;j<await inspections.count();j++){
   if(!(await inspections.nth(j).innerText()).trim().startsWith("✓")){
    await inspections.nth(j).click();done=true;break;
   }
  }
  if(done)continue;
  const compares=page.locator('[data-lore-action="scene-compare"]');
  for(let j=0;j<await compares.count();j++){
   if(await compares.nth(j).isEnabled()&&
     !(await compares.nth(j).innerText()).trim().startsWith("✓")){
    await compares.nth(j).click();done=true;break;
   }
  }
  if(done)continue;
  for(const action of ["scene-page-next","scene-choose","scene-next","scene-finish"]){
   const control=page.locator('[data-lore-action="'+action+'"]:not([disabled])');
   if(await control.count()){
    await control.first().click();done=true;
    if(action==="scene-finish")return;
    break;
   }
  }
  if(!done)throw Error("ACT4_STALLED "+(await page.locator(".lore-scene").innerText()).slice(0,160));
 }
 throw Error("ACT4_LOOP");
}
async function check(name,browserType,width,height){
 const browser=await browserType.launch(name==="chromium"?
  {headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl"]}:
  {headless:true});
 const page=await browser.newPage({viewport:{width,height},hasTouch:true});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 const tag=name+"-"+width+"x"+height;
 try{
  await page.goto(origin,{waitUntil:"load",timeout:60000});
  await page.waitForFunction(()=>typeof showScreen==="function",null,{timeout:60000});
  await page.evaluate(value=>localStorage.setItem("ashes-throne.lore-campaign.v1",value),seed());
  await page.reload({waitUntil:"load"});
  await page.waitForFunction(()=>typeof showScreen==="function",null,{timeout:60000});
  await enter(page);
  assert.equal(await page.locator('[data-lore-layer="two-banks"][aria-pressed="true"]').count(),1);
  assert.match(await page.locator(".lore-map-heading").innerText(),/Акт IV/);
  assert.equal(await page.locator(".lore-map-marker").count(),3);
  for(let i=10;i<=12;i++){
   const id="five-shadows:fs-"+String(i).padStart(2,"0");
   if(i!==10)await page.locator('.lore-list-node[data-lore-node="'+id+'"]').click();
   assert.match(await page.locator(".lore-node-detail").innerText(),/Доступно/);
   await page.locator('[data-lore-action="start-node"]').click();
   if(i===10){
    // A checkpoint resumes after reload, without accidentally unlocking FS-11.
    await page.reload({waitUntil:"load"});
    await page.waitForFunction(()=>typeof showScreen==="function",null,{timeout:60000});
    await enter(page);
    await page.locator('[data-lore-action="start-node"]').click();
    assert.match(await page.locator(".lore-scene-text").innerText(),/В школе на одной доске/);
   }
   await finish(page);
   assert.equal(await page.locator('[data-lore-action="required-battle"]').count(),0,
    "Parts 8–10 contain no fabricated tactical battles");
   await page.locator('[data-lore-action="leave-result"]').click();
   const record=await page.evaluate(()=>JSON.parse(localStorage.getItem(
     "ashes-throne.lore-campaign.v1")).stories["five-shadows"]);
   assert.ok(record.completedNodeIds.includes(id),"recorded "+id);
   assert.equal(record.battleClearedNodeIds.length,6,"never fabricate new combat receipt");
   if(i<12)assert.equal(record.completedNodeIds.includes("five-shadows:fs-"+String(i+1).padStart(2,"0")),false);
  }
  await page.reload({waitUntil:"load"});
  await page.waitForFunction(()=>typeof showScreen==="function",null,{timeout:60000});
  await enter(page);
  // With Act V unlocked, switch back to the Act IV layer explicitly.
  await page.locator('[data-lore-layer="two-banks"]').click();
  await page.locator('.lore-list-node[data-lore-node="five-shadows:fs-12"]').click();
  assert.match(await page.locator(".lore-node-detail").innerText(),/Пройдено/);
  const current=await page.evaluate(()=>({
   p:JSON.parse(localStorage.getItem("ashes-throne.lore-campaign.v1")).stories["five-shadows"],
   scroll:document.documentElement.scrollWidth,width:innerWidth
  }));
  assert.deepEqual(current.p.completedNodeIds,
   Array.from({length:12},(_,i)=>"five-shadows:fs-"+String(i+1).padStart(2,"0")));
  assert.deepEqual(current.p.battleClearedNodeIds,
   Array.from({length:6},(_,i)=>"five-shadows:fs-"+String(i+1).padStart(2,"0")));
  assert.equal(current.p.keyDecisionLog.filter(x=>/^five-shadows:fs-(10|11|12)$/.test(x.nodeId)).length,3);
  assert.ok(current.scroll<=current.width+1,"horizontal scroll "+JSON.stringify(current));
  assert.equal(await page.locator('[data-lore-layer="city-response"]').count(),1);
  assert.equal(await page.locator('[data-lore-layer="gardens-route"]').count(),1);
  await page.locator('[data-lore-layer="city-response"]').click();
  assert.equal(await page.locator(".lore-map-marker").count(),3);
  await page.locator('[data-lore-layer="two-banks"]').click();
  assert.deepEqual(errors.filter(e=>/ReferenceError|TypeError|LoreCampaign|Act4/.test(e)),[]);
  await page.screenshot({path:path.join(out,tag+"-pass.png"),fullPage:true});
  console.log("LOREACT4001",tag,"PASS");
 }catch(e){
  await page.screenshot({path:path.join(out,tag+"-failure.png"),fullPage:true}).catch(()=>{});
  console.error("LOREACT4001",tag,"JS errors",errors);throw e;
 }finally{await browser.close();}
}
(async()=>{
 await check("chromium",chromium,932,430);
 await check("webkit",webkit,844,390);
})().catch(e=>{console.error(e);process.exitCode=1;});
