"use strict";
/* LOREACT2001: real six-episode progression from a saved three-episode campaign. */
const assert=require("node:assert/strict");
const {chromium,webkit}=require("playwright");
const Core=require("../lore-campaign-core.js"),Scenes=require("../lore-campaign-scenes.js");
const Engine=require("../lore-campaign-scene-core.js"),Save=require("../lore-campaign-scene-save.js");
const Runtime=require("../lore-campaign-scene-runtime.js"),Pilot=require("../lore-campaign-pilot.js");
const fs=require("node:fs"),path=require("node:path");
const out=path.join(process.cwd(),"artifacts","lore-act2");
fs.mkdirSync(out,{recursive:true});
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
function seed(){
 const map=new Map();
 const storage={getItem:k=>map.has(k)?map.get(k):null,setItem:(k,v)=>map.set(k,v)};
 const r=Runtime.create({graph:Pilot.data.catalog(),graphCore:Core,pack:Pilot.pack,
  scriptData:Scenes,sceneCore:Engine,saveModule:Save,storage});
 function finish(id){
  assert.equal(r.start(id).ok,true);
  for(let i=0;i<130;i++){
   let v=r.current();
   for(const a of v.inspections)if(!a.done)assert.equal(r.inspect(a.id).ok,true);
   v=r.current();
   for(const a of v.comparisons)if(a.ready&&!a.done)assert.equal(r.compare(a.id).ok,true);
   v=r.current();
   if(v.choices.length)assert.equal(r.choose(v.choices[0].id).ok,true);
   else if(v.canContinue)assert.equal(r.next().ok,true);
   else if(v.canFinish){assert.equal(r.finish().ok,true);return;}
   else throw Error("OLD_SEED_STALLED");
  }
  throw Error("OLD_SEED_LOOP");
 }
 finish("five-shadows:fs-01");
 assert.equal(r.beginRequiredBattle("five-shadows:fs-01").ok,true);
 assert.equal(r.recordBattleVictory("five-shadows:fs-01","fs01-approach-combat").ok,true);
 finish("five-shadows:fs-02");
 assert.equal(r.beginRequiredBattle("five-shadows:fs-02").ok,true);
 assert.equal(r.recordBattleVictory("five-shadows:fs-02","fs02-evidence-combat").ok,true);
 finish("five-shadows:fs-03");
 return map.get(Core.KEY);
}
async function enter(page){
 await page.locator('#home .hq-bottom button[data-screen="campaign"]').evaluate(el=>el.click());
 await page.locator("#campaignHub").waitFor({state:"visible",timeout:20000});
 await page.locator('[data-campaign-path="lore"]').click();
 await page.locator(".lore-story-cover").click();
}
async function finish(page){
 for(let i=0;i<170;i++){
  let did=false;
  const inspections=page.locator('[data-lore-action="scene-inspect"]');
  for(let j=0;j<await inspections.count();j++)
   if(!(await inspections.nth(j).innerText()).trim().startsWith("✓")){
    await inspections.nth(j).click();did=true;break;}
  if(did)continue;
  const comparisons=page.locator('[data-lore-action="scene-compare"]');
  for(let j=0;j<await comparisons.count();j++)
   if(await comparisons.nth(j).isEnabled()&&!(await comparisons.nth(j).innerText()).trim().startsWith("✓")){
    await comparisons.nth(j).click();did=true;break;}
  if(did)continue;
  for(const action of ["scene-page-next","scene-choose","scene-next","scene-finish"]){
   const control=page.locator('[data-lore-action="'+action+'"]:not([disabled])');
   if(await control.count()){
    await control.first().click();did=true;
    if(action==="scene-finish")return;
    break;
   }
  }
  if(!did)throw Error("ACT2_STALLED "+(await page.locator(".lore-scene").innerText()).slice(0,150));
 }
 throw Error("ACT2_LOOP");
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
  await page.evaluate(({key,value})=>localStorage.setItem(key,value),{key:Core.KEY,value:seed()});
  await page.reload({waitUntil:"load"});
  await enter(page);
  assert.equal(await page.locator('[data-lore-layer="city-response"][aria-pressed="true"]').count(),1);
  assert.match(await page.locator(".lore-map-heading").innerText(),/Акт II/);
  assert.equal(await page.locator(".lore-map-marker").count(),3);
  for(let i=0;i<3;i++){
   await page.locator('[data-lore-action="start-node"]').click();
   if(i===0){
    await page.locator('[data-lore-action="scene-next"]').click();
    await page.reload({waitUntil:"load"});
    await enter(page);
    assert.equal(await page.locator(".lore-node-detail [data-lore-action='start-node']").count(),1);
    await page.locator('[data-lore-action="start-node"]').click();
    assert.match(await page.locator(".lore-scene-text").innerText(),/Где Нада/);
   }
   await finish(page);
   await page.locator('[data-lore-action="leave-result"]').click();
   if(i<2)assert.match(await page.locator(".lore-node-detail").innerText(),/Доступно/);
  }
  const result=await page.evaluate(()=>({
   p:JSON.parse(localStorage.getItem("ashes-throne.lore-campaign.v1")).stories["five-shadows"],
   width:innerWidth,scroll:document.documentElement.scrollWidth
  }));
  assert.deepEqual(result.p.completedNodeIds,Array.from({length:6},(_,i)=>"five-shadows:fs-0"+(i+1)));
  assert.deepEqual(result.p.battleClearedNodeIds,["five-shadows:fs-01","five-shadows:fs-02"]);
  assert.ok(result.scroll<=result.width+1,"horizontal overflow "+result.scroll+"/"+result.width);
  await page.locator('[data-lore-layer="gardens-route"]').click();
  assert.equal(await page.locator(".lore-map-marker").count(),3);
  assert.deepEqual(errors.filter(e=>/LoreCampaign|TypeError|ReferenceError/.test(e)),[]);
  await page.screenshot({path:path.join(out,tag+"-success.png"),fullPage:true});
  console.log("LOREACT2001",tag,"PASS");
 }catch(error){
  await page.screenshot({path:path.join(out,tag+"-failure.png"),fullPage:true}).catch(()=>{});
  console.error("LOREACT2001",tag,"FAILED",errors);throw error;
 }finally{await browser.close();}
}
(async()=>{await check("chromium",chromium,932,430);await check("webkit",webkit,844,390);})()
 .catch(e=>{console.error(e);process.exitCode=1;});
