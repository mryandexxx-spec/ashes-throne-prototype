"use strict";
/* LC-008F: all five live rewards in the actual gated mobile game (Chromium/WebKit). */
const assert=require("node:assert/strict");
const {chromium,webkit}=require("playwright");
const Core=require("../lore-campaign-core.js"),Scenes=require("../lore-campaign-scenes.js");
const Engine=require("../lore-campaign-scene-core.js"),Save=require("../lore-campaign-scene-save.js");
const Runtime=require("../lore-campaign-scene-runtime.js"),Act=require("../lore-campaign-act5.js");
const url=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
const expected=[
 [1500,180,{Fe:5,Le:6,Cl:8,Wo:1,Fa:3,Th:3,Gl:0}],
 [2000,230,{Fe:5,Le:5,Cl:10,Wo:1,Fa:4,Th:3,Gl:1}],
 [3000,280,{Fe:8,Le:7,Cl:8,Wo:2,Fa:5,Th:4,Gl:1}],
 [4000,350,{Fe:8,Le:8,Cl:10,Wo:2,Fa:6,Th:5,Gl:2}],
 [5000,460,{Fe:9,Le:10,Cl:10,Wo:2,Fa:6,Th:5,Gl:2}]
];
function complete(rt,nodeId){
 assert.equal(rt.start(nodeId).ok,true);
 for(let i=0;i<220;i++){
  let view=rt.current();
  for(const item of view.inspections)if(!item.done)assert.equal(rt.inspect(item.id).ok,true);
  view=rt.current();
  for(const item of view.comparisons)if(item.ready&&!item.done)
   assert.equal(rt.compare(item.id).ok,true);
  view=rt.current();
  if(view.choices.length)assert.equal(rt.choose(view.choices[0].id).ok,true);
  else if(view.canContinue)assert.equal(rt.next().ok,true);
  else if(view.canFinish){assert.equal(rt.finish().ok,true);return;}
  else assert.fail("Stalled at "+nodeId);
 }
 assert.fail("Nonterminating: "+nodeId);
}
function fullLore(){
 const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v))};
 const graph=Act.data.catalog(),rt=Runtime.create({graph,graphCore:Core,pack:Act.pack,
  scriptData:Scenes,sceneCore:Engine,saveModule:Save,storage});
 for(let i=0;i<15;i++){
  const node=graph.nodes[i];
  complete(rt,node.id);
  if(node.requiredBattleId){
   const battle=rt.beginRequiredBattle(node.id);
   assert.equal(battle.ok,true);
   assert.equal(rt.recordBattleVictory(node.id,battle.battleId).ok,true);
  }
 }
 return map.get(Save.KEY);
}
async function start(browser,loreSave){
 const ctx=await browser.newContext({viewport:{width:844,height:390},hasTouch:true});
 await ctx.addInitScript(({key,value})=>{
  if(location.protocol==="http:"&&localStorage.getItem(key)===null)
   localStorage.setItem(key,value);
 },{key:Save.KEY,value:loreSave});
 const page=await ctx.newPage(),errors=[];
 page.on("pageerror",error=>errors.push(error.message));
 await page.goto(url,{waitUntil:"domcontentloaded"});
 await page.waitForFunction(()=>typeof LoreActOneRewardCore==="object"&&typeof showScreen==="function",
  null,{timeout:90000});
 await enter(page);
 return {ctx,page,errors};
}
async function enter(page){
 await page.locator('#home .hq-bottom button[data-screen="campaign"]').evaluate(el=>el.click());
 await page.locator('[data-campaign-path="lore"]').click();
 await page.locator(".lore-story-cover").click();
}
async function wallet(page){
 return page.evaluate(()=>JSON.parse(localStorage.getItem("ashes-throne.progress.v3")));
}
async function focus(page,act,{eligible=true}={}){
 const tab=page.locator('[data-lore-action="choose-layer"]').nth(act-1);
 if(eligible)assert.match(await tab.innerText(),/Забрать награду/);
 await tab.click();
 const finalId="five-shadows:fs-"+String(act*3).padStart(2,"0");
 if(!eligible)await page.locator('[data-lore-action="choose-node"][data-lore-node="'+finalId+'"]').first().click();
 assert.equal(await page.evaluate(()=>LoreCampaignUI.snapshot().nodeId),finalId);
 const card=page.locator(".lore-act-one-reward");
 assert.equal(await card.count(),1,"exactly one reward at act "+act+" finale");
 assert.equal(await card.locator('[data-lore-action="claim-act-reward"]').getAttribute("data-lore-act"),String(act));
 return card;
}
async function run(name,engine){
 const browser=await engine.launch({headless:true}),lore=fullLore();
 try{
  const f=await start(browser,lore);
  try{
   assert.equal(await f.page.locator(".lore-layer-reward-ready").count(),5,
    "all five eligible old saves expose a tab for each reward");
   const initial=await wallet(f.page),order=[5,2,4,1,3];
   const seen=new Set(),sum={currency:0,xp:0,materials:Object.fromEntries(
    ["Fe","Le","Cl","Wo","Fa","Th","Gl"].map(k=>[k,0]))};
   for(const act of order){
    const card=await focus(f.page,act);
    const text=await card.innerText(),[currency,xp,materials]=expected[act-1];
    assert.match(text,new RegExp("Награда за акт "+["I","II","III","IV","V"][act-1]));
    assert.equal(text.includes("FS-"),false,"no internal IDs in player text");
    assert.match(text,/Забрать награду/);
    assert.equal(await card.locator("button").isEnabled(),true);
    // Only its finale shows the card; ordinary nodes must not carry it.
    const firstNode="five-shadows:fs-"+String(act*3-2).padStart(2,"0");
    await f.page.locator('[data-lore-action="choose-node"][data-lore-node="'+firstNode+'"]').first().click();
    assert.equal(await f.page.locator(".lore-act-one-reward").count(),0);
    await f.page.locator('[data-lore-action="choose-node"][data-lore-node="five-shadows:fs-'+String(act*3).padStart(2,"0")+'"]').first().click();
    const before=await wallet(f.page);
    await f.page.locator('[data-lore-action="claim-act-reward"]').click();
    await f.page.waitForFunction(()=>document.querySelector('[data-lore-action="claim-act-reward"]')?.textContent==="Награда получена",
     null,{timeout:12000});
    const after=await wallet(f.page);
    assert.equal(after.currency-before.currency,currency);
    assert.equal(after.accountXp-before.accountXp,xp);
    assert.equal(after.energy.value,before.energy.value);
    for(const [k,n] of Object.entries(materials))assert.equal(after.materials[k]-before.materials[k],n);
    assert.equal(after.rewardReceipts.length,seen.size+1);
    const receipt="first-clear:five-shadows-act-"+act+":once";
    assert.equal(after.rewardReceipts.filter(row=>row.id===receipt).length,1);
    seen.add(receipt);sum.currency+=currency;sum.xp+=xp;
    for(const [k,n] of Object.entries(materials))sum.materials[k]+=n;
    assert.equal(await f.page.locator(".lore-layer-reward-ready").count(),5-seen.size);
    assert.equal(await f.page.evaluate(()=>persistProgress()),true,"regular save after act "+act);
    assert.equal((await wallet(f.page)).rewardReceipts.length,seen.size);
   }
   const final=await wallet(f.page);
   assert.equal(seen.size,5);
   assert.equal(sum.currency,15500);assert.equal(sum.xp,1500);
   assert.equal(final.currency-initial.currency,15500);
   assert.equal(final.accountXp-initial.accountXp,1500);
   for(const [k,n] of Object.entries(sum.materials))
    assert.equal(final.materials[k]-initial.materials[k],n);
   await f.page.reload({waitUntil:"domcontentloaded"});
   await f.page.waitForFunction(()=>typeof showScreen==="function",null,{timeout:90000});
   await enter(f.page);
   assert.equal(await f.page.locator(".lore-layer-reward-ready").count(),0);
   for(let act=1;act<=5;act++){
    const card=await focus(f.page,act,{eligible:false});
    assert.match(await card.innerText(),/Награда получена/);
    assert.equal(await card.locator("button").isEnabled(),false);
   }
   const reloaded=await wallet(f.page);
   assert.equal(reloaded.rewardReceipts.length,5);
   assert.equal(reloaded.currency,final.currency);
   assert.deepEqual(f.errors,[]);
  }finally{await f.ctx.close();}
  // Ambiguous storage write: no payout until fresh session and proof revalidation.
  const failure=await start(browser,lore);
  try{
   const {page}=failure;
   const before=await wallet(page);
   await focus(page,4);
   await page.evaluate(()=>{
    const prior=Storage.prototype.setItem;
    Storage.prototype.setItem=function(key,value){
     if(key==="ashes-throne.progress.v3")throw Error("quota-test");
     return prior.call(this,key,value);
    };
   });
   await page.locator('[data-lore-action="claim-act-reward"]').click();
   await page.waitForFunction(()=>document.getElementById("walletWriterNotice")?.style?.display==="flex",
    null,{timeout:10000});
   assert.equal((await wallet(page)).currency,before.currency);
   await page.reload({waitUntil:"domcontentloaded"});
   await page.waitForFunction(()=>typeof showScreen==="function",null,{timeout:90000});
   await enter(page);
   await focus(page,4);
   await page.locator('[data-lore-action="claim-act-reward"]').click();
   await page.waitForFunction(()=>document.querySelector('[data-lore-action="claim-act-reward"]')?.textContent==="Награда получена",
    null,{timeout:12000});
   assert.equal((await wallet(page)).currency,before.currency+4000);
   assert.equal((await wallet(page)).rewardReceipts.length,1);
   assert.deepEqual(failure.errors,[]);
  }finally{await failure.ctx.close();}
  process.stdout.write(name+": five act rewards, ordering, reload and failed wallet write passed\n");
 }finally{await browser.close();}
}
(async()=>{await run("chromium",chromium);await run("webkit",webkit);})().catch(err=>{
 console.error(err);process.exitCode=1;
});
