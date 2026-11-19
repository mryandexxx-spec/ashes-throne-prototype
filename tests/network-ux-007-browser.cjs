"use strict";
/* NET-UX-007: real live network UI + combat in Chromium/WebKit landscape.
 * Browser emulation is not physical iPhone Safari testing.
 */
const {chromium,webkit}=require("playwright");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
const dir=path.join(process.cwd(),"artifacts","netux007");
fs.mkdirSync(dir,{recursive:true});
async function run(name,engine,viewport){
 const browser=await engine.launch(name==="chromium"?{headless:true,args:[
  "--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl",
  "--disable-dev-shm-usage"]}:{headless:true});
 const page=await browser.newPage({viewport,hasTouch:true});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 const login=async()=>{
  if(await page.locator("#loginCalendar").evaluate(el=>el.classList.contains("active")))
   await page.locator('#loginCalendar [data-screen="home"]').click();
 };
 const enter=async()=>{
  await login();
  await page.locator('#home .hq-bottom [data-screen="network"]').click();
  await page.locator("#network").waitFor({state:"visible"});
 };
 const saved=()=>page.evaluate(()=>({
  state:JSON.parse(localStorage.getItem("ashes-throne.network.v1")),
  wallet:localStorage.getItem("ashes-throne.progress.v3")
 }));
 const geometry=()=>page.evaluate(()=>{
  const root=document.querySelector("#network");
  const r=root.getBoundingClientRect();
  const live=[...root.querySelectorAll("button")].filter(el=>!el.disabled&&!el.hidden&&
   getComputedStyle(el).display!=="none"&&el.getBoundingClientRect().height>0);
  return {overflow:document.documentElement.scrollWidth>innerWidth+1,
   left:r.left,right:r.right,
   controls:live.map(el=>({h:el.getBoundingClientRect().height,
    w:el.getBoundingClientRect().width})),
   scroll:[...root.querySelectorAll("*")].filter(el=>
    el.scrollHeight>el.clientHeight+8&&getComputedStyle(el).overflowY==="auto")
    .map(el=>({h:el.clientHeight,max:el.scrollHeight-el.clientHeight}))};
 });
 try{
  await page.goto(origin,{waitUntil:"load",timeout:60000});
  await page.waitForFunction(()=>typeof showScreen==="function",null,{timeout:60000});
  assert.match(await page.locator("#buildVersion").innerText(),/v0\.3\.201 · NETUXVAR007/);
  await enter();
  assert.ok(await page.locator("#net004Clues .netux-clue-pick").count()>=2);
  const scene=await page.evaluate(()=>{
   const s=JSON.parse(localStorage.getItem("ashes-throne.network.v1"));
   const c=s.board[0];return NetworkEncounterData.brief(c.encounterRef);
  });
  assert.ok(scene&&scene.title&&scene.context&&scene.tactic);
  assert.match(await page.locator("#net004Clues .netux-clue-pick").first().innerText(),
   new RegExp(scene.title));
  let g=await geometry();
  assert.equal(g.overflow,false);
  assert.ok(g.left>=-1&&g.right<=viewport.width+1);
  assert.ok(g.controls.every(x=>x.h>=44&&x.w>=44),"touch controls on board");
  await page.screenshot({path:path.join(dir,name+"-"+viewport.width+"-board.png")});
  const walletBefore=(await saved()).wallet;
  await page.locator("#netuxStartSelected").click();
  await page.locator("#net004Active").waitFor({state:"visible"});
  assert.equal((await saved()).state.active.phase,"brief");
  assert.match(await page.locator("#netuxBriefIntel").innerText(),new RegExp(scene.context));
  await page.locator('#net004Choices [data-net-action="prepare"][data-net-value="cover"]').click();
  assert.equal((await saved()).state.active.phase,"approach");
  const quiet=await page.locator('#net004Choices [data-net-action="approach"][data-net-value="quiet"]').innerText();
  const cordon=await page.locator('#net004Choices [data-net-action="approach"][data-net-value="cordon"]').innerText();
  assert.ok(quiet.includes(scene.quiet));
  assert.ok(cordon.includes(scene.cordon));
  g=await geometry();assert.equal(g.overflow,false);
  assert.ok(g.controls.every(x=>x.h>=44&&x.w>=44),"touch controls on briefing");
  await page.screenshot({path:path.join(dir,name+"-"+viewport.width+"-brief.png")});
  await page.locator('#net004Choices [data-net-action="approach"][data-net-value="quiet"]').click();
  await page.locator("#squad").waitFor({state:"visible"});
  await page.locator("#squadBack").click();
  await page.locator("#net004Fight").waitFor({state:"visible"});
  assert.equal((await saved()).state.active.phase,"battle");
  assert.equal((await saved()).wallet,walletBefore);
  await page.reload({waitUntil:"load",timeout:60000});
  await page.waitForFunction(()=>typeof showScreen==="function");
  await enter();
  await page.locator("#net004Fight").click();
  await page.locator("#squad").waitFor({state:"visible"});
  await page.locator("#squadStart").click();
  await page.locator("#battle").waitFor({state:"visible",timeout:30000});
  const formation=await page.evaluate(()=>state.fighters.filter(f=>f.side==="enemy").map(f=>f.archetypeId));
  assert.ok(formation.length===2);
  await page.evaluate(()=>{
   for(const ally of state.fighters.filter(f=>f.side==="ally")){
    ally.hp=40000;ally.maxHp=40000;
    ally.physicalAttack=7000;ally.magicAttack=7000;ally.atk=7000;
    ally.physicalDefense=2000;ally.magicDefense=2000;
   }
  });
  await page.locator("#autoBattleBtn").click();
  await page.locator("#net004Result").waitFor({state:"visible",timeout:125000});
  assert.equal((await saved()).state.active.phase,"result");
  assert.match(await page.locator("#net004ResultDetail").innerText(),new RegExp(scene.success));
  assert.equal((await saved()).wallet,walletBefore,"result preview must not pay before finish");
  g=await geometry();assert.equal(g.overflow,false);
  assert.ok(g.controls.every(x=>x.h>=44&&x.w>=44),"touch controls on result");
  await page.screenshot({path:path.join(dir,name+"-"+viewport.width+"-result.png")});
  await page.locator("#net004Finish").click();
  await page.waitForFunction(()=>!document.querySelector("#net004Board").hidden,null,{timeout:20000});
  const finished=await saved();
  assert.equal(finished.state.completed.length,1);
  assert.equal(finished.state.active,null);
  assert.notEqual(finished.wallet,walletBefore,"real completion pays only after finish");
  await page.reload({waitUntil:"load",timeout:60000});
  await page.waitForFunction(()=>typeof showScreen==="function");
  await enter();
  assert.equal((await saved()).wallet,finished.wallet,"reload cannot duplicate the payment");
  assert.equal((await saved()).state.completed.length,1);
  await page.locator("#netuxStartSelected").click();
  await page.locator("#net004Cancel").click();
  await page.locator("#net004Clues .netux-clue-pick").first().waitFor({state:"visible"});
  assert.equal((await saved()).wallet,finished.wallet,"abandon never pays");
  assert.equal((await saved()).state.active,null);
  assert.deepEqual(errors.filter(x=>/TypeError|ReferenceError|NETUX|NETWORK/i.test(x)),[]);
  console.log("NETUX007_BROWSER",name,viewport.width+"x"+viewport.height,"PASS");
 }catch(e){
  console.error("NETUX007_BROWSER_FAIL",name,viewport,errors);
  await page.screenshot({path:path.join(dir,name+"-"+viewport.width+"-fail.png")}).catch(()=>{});
  throw e;
 }finally{await browser.close()}
}
(async()=>{for(const [name,engine] of [["chromium",chromium],["webkit",webkit]])
 for(const viewport of [{width:844,height:390},{width:932,height:430}])
  await run(name,engine,viewport)})().catch(e=>{console.error(e);process.exitCode=1});
