"use strict";
/* LC-008D: real browser smoke of first-act reward in mobile landscape. */
const assert=require("node:assert/strict");
const {chromium,webkit}=require("playwright");
const Core=require("../lore-campaign-core.js"),Scenes=require("../lore-campaign-scenes.js");
const SceneCore=require("../lore-campaign-scene-core.js"),Save=require("../lore-campaign-scene-save.js");
const Runtime=require("../lore-campaign-scene-runtime.js"),Act=require("../lore-campaign-act5.js");
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
function savedAct({skipFinalBattle=false}={}){
 const map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,String(v))};
 const graph=Act.data.catalog(),r=Runtime.create({graph,graphCore:Core,pack:Act.pack,
  scriptData:Scenes,sceneCore:SceneCore,saveModule:Save,storage});
 for(let n=1;n<=3;n++){
  const id="five-shadows:fs-"+String(n).padStart(2,"0");
  assert.equal(r.start(id).ok,true);
  for(let i=0;i<200;i++){
   let v=r.current();
   for(const q of v.inspections)if(!q.done)assert.equal(r.inspect(q.id).ok,true);
   v=r.current();
   for(const q of v.comparisons)if(q.ready&&!q.done)assert.equal(r.compare(q.id).ok,true);
   v=r.current();
   if(v.choices.length)assert.equal(r.choose(v.choices[0].id).ok,true);
   else if(v.canContinue)assert.equal(r.next().ok,true);
   else if(v.canFinish){assert.equal(r.finish().ok,true);break;}
   else assert.fail("Stuck "+id);
  }
  const node=graph.nodes[n-1];
  if(node.requiredBattleId&&!(skipFinalBattle&&n===3)){
   const b=r.beginRequiredBattle(id);assert.equal(b.ok,true);
   assert.equal(r.recordBattleVictory(id,b.battleId).ok,true);
  }
 }
 return map.get(Save.KEY);
}
async function opened(browser,storySave){
 const ctx=await browser.newContext({viewport:{width:844,height:390},hasTouch:true});
 await ctx.addInitScript(({key,value})=>{
  if(location.protocol==="http:"&&localStorage.getItem(key)===null)localStorage.setItem(key,value);
 },{key:Save.KEY,value:storySave});
 const page=await ctx.newPage(),errors=[];
 page.on("pageerror",e=>errors.push(e.message));
 await page.goto(origin,{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>typeof LoreActOneRewardCore!=="undefined"&&typeof showScreen==="function",
  null,{timeout:90000});
 await page.locator('#home .hq-bottom button[data-screen="campaign"]').evaluate(el=>el.click());
 await page.locator('[data-campaign-path="lore"]').click();
 await page.locator(".lore-story-cover").click();
 return {ctx,page,errors};
}
async function wallet(page){
 return page.evaluate(()=>JSON.parse(localStorage.getItem("ashes-throne.progress.v3")));
}
// A claim is presented only on the final node; the act tab remains discoverable
// when the campaign naturally opens on the next act.
async function focusReward(page){
 const tab=page.locator('[data-lore-action="choose-layer"]').filter({hasText:"Забрать награду"});
 assert.equal(await tab.count(),1,"only act I can have a live unclaimed reward indicator");
 await tab.click();
 assert.equal(await page.evaluate(()=>LoreCampaignUI.snapshot().nodeId),"five-shadows:fs-03");
 const card=page.locator(".lore-act-one-reward");
 assert.equal(await card.count(),1);
 assert.equal(await card.locator("small").textContent().then(s=>s.includes("опыта аккаунта")),true);
 assert.equal((await card.innerText()).includes("FS-01"),false,"player copy must not expose technical node IDs");
 return card;
}
async function run(name,type){
 const browser=await type.launch({headless:true}),storySave=savedAct();
 try{
  const {ctx,page,errors}=await opened(browser,storySave);
  try{
   const first=await wallet(page);
   const card=await focusReward(page);
   const button=page.locator('[data-lore-action="claim-act-one"]');
   assert.equal(await button.isEnabled(),true,name+" must show earned reward");
   assert.match(await card.innerText(),/Первый акт завершён/);
   // Reward must not be pinned to every node, nor to the other four acts.
   await page.locator('[data-lore-action="choose-node"][data-lore-node="five-shadows:fs-01"]').first().click();
   assert.equal(await page.locator(".lore-act-one-reward").count(),0);
   await page.locator('[data-lore-action="choose-node"][data-lore-node="five-shadows:fs-03"]').first().click();
   assert.equal(await button.isEnabled(),true);
   const tabs=page.locator('[data-lore-action="choose-layer"]');
   assert.equal(await tabs.count(),5);
   for(let i=1;i<5;i++){
    await tabs.nth(i).click();
    assert.equal(await page.locator(".lore-act-one-reward").count(),0,"no act-I banner on layer "+(i+1));
   }
   await focusReward(page);
   await button.click();
   await page.waitForFunction(()=>document.querySelector('[data-lore-action="claim-act-one"]')?.textContent==="Получено",
    null,{timeout:10000});
   const after=await wallet(page);
   assert.equal(after.currency-first.currency,1500);
   assert.equal(after.accountXp-first.accountXp,180);
   assert.equal(after.energy.value,first.energy.value);
   assert.equal(after.rewardReceipts.length,1);
   assert.equal(after.rewardReceipts[0].id,"first-clear:five-shadows-act-1:once");
   for(const [id,count] of Object.entries({Fe:5,Le:6,Cl:8,Wo:1,Fa:3,Th:3,Gl:0}))
    assert.equal(after.materials[id]-first.materials[id],count);
   // Explicit next normal game write must be based on the updated v3 revision.
   assert.equal(await page.evaluate(()=>persistProgress()),true,"next normal save must not be stale");
   const next=await wallet(page);
   assert.equal(next.revision,after.revision+1);
   assert.equal(next.rewardReceipts.length,1);
   await page.reload({waitUntil:"domcontentloaded"});
   await page.waitForFunction(()=>typeof showScreen==="function",null,{timeout:90000});
   await page.locator('#home .hq-bottom button[data-screen="campaign"]').evaluate(el=>el.click());
   await page.locator('[data-campaign-path="lore"]').click();
   await page.locator(".lore-story-cover").click();
   // Claimed rewards do not make a stale "claim" marker on the act tab.
   assert.equal(await page.locator(".lore-layer-reward-ready").count(),0);
   await page.locator('[data-lore-action="choose-layer"]').first().click();
   await page.locator('[data-lore-action="choose-node"][data-lore-node="five-shadows:fs-03"]').first().click();
   assert.equal(await page.locator('[data-lore-action="claim-act-one"]').isEnabled(),false);
   assert.match(await page.locator(".lore-act-one-reward").innerText(),/Награда получена/);
   assert.equal((await wallet(page)).rewardReceipts.length,1);
   // Existing session holds the writer lock; another tab must not start game.
   const second=await ctx.newPage();
   await second.goto(origin,{waitUntil:"domcontentloaded"});
   await second.waitForFunction(()=>document.getElementById("walletWriterMessage")?.textContent?.includes("другой вкладке"),
    null,{timeout:15000});
   assert.equal(await second.evaluate(()=>typeof showScreen),"undefined");
   await second.close();
   assert.deepEqual(errors,[],"no unhandled page errors");
  }finally{await ctx.close();}
  // Failure/reload path: denied wallet writes must not pay, retry only on a fresh session.
  const f=await opened(browser,storySave);
  try{
   await f.page.evaluate(()=>{
    const original=Storage.prototype.setItem;
    Storage.prototype.setItem=function(k,v){
     if(k==="ashes-throne.progress.v3")throw Error("quota-test");
     return original.call(this,k,v);
    };
   });
   const before=await wallet(f.page);
   await focusReward(f.page);
   await f.page.locator('[data-lore-action="claim-act-one"]').click();
   await f.page.waitForFunction(()=>document.getElementById("walletWriterNotice")?.style?.display==="flex",
    null,{timeout:10000});
   assert.equal((await wallet(f.page)).currency,before.currency);
   await f.page.reload({waitUntil:"domcontentloaded"});
   await f.page.waitForFunction(()=>typeof showScreen==="function",null,{timeout:90000});
   await f.page.locator('#home .hq-bottom button[data-screen="campaign"]').evaluate(el=>el.click());
   await f.page.locator('[data-campaign-path="lore"]').click();
   await f.page.locator(".lore-story-cover").click();
   await focusReward(f.page);
   await f.page.locator('[data-lore-action="claim-act-one"]').click();
   await f.page.waitForFunction(()=>document.querySelector('[data-lore-action="claim-act-one"]')?.textContent==="Получено",
    null,{timeout:10000});
   assert.equal((await wallet(f.page)).currency,before.currency+1500);
   assert.deepEqual(f.errors,[]);
  }finally{await f.ctx.close();}
  // Same state as the report: FS-03 narration finished, required combat pending.
  const unfinished=await opened(browser,savedAct({skipFinalBattle:true}));
  try{
   const tab=unfinished.page.locator('[data-lore-action="choose-layer"]').first();
   await tab.click();
   await unfinished.page.locator('[data-lore-action="choose-node"][data-lore-node="five-shadows:fs-03"]').first().click();
   const card=unfinished.page.locator(".lore-act-one-reward");
   assert.equal(await card.count(),1);
   assert.match(await card.innerText(),/победите в бою после «Имя Элы»/i);
   assert.equal((await card.innerText()).includes("FS-03"),false);
   assert.equal(await card.locator("button").isEnabled(),false);
   await unfinished.page.locator('[data-lore-action="choose-layer"]').nth(2).click();
   assert.equal(await unfinished.page.locator(".lore-act-one-reward").count(),0);
   assert.deepEqual(unfinished.errors,[]);
  }finally{await unfinished.ctx.close();}
  process.stdout.write(name+": LC-008E contextual reward, claim, reload, lock and failure passed\n");
 }finally{await browser.close();}
}
(async()=>{await run("chromium",chromium);await run("webkit",webkit);})().catch(e=>{
 console.error(e);process.exitCode=1;
});
