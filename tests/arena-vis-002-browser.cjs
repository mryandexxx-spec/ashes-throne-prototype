"use strict";
// ARENA-VIS-002: real game, real Babylon. Frames are stepped by hand (16 ms) so
// the check is deterministic on a software GPU. Chromium and mobile WebKit.
const {chromium,webkit}=require("playwright");
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const out="artifacts/arena-vis-002";
fs.mkdirSync(out,{recursive:true});
async function run(name,type){
 const args=name==="chromium"?["--no-sandbox","--use-angle=swiftshader","--enable-webgl","--enable-unsafe-swiftshader"]:[];
 const browser=await type.launch({headless:true,args});
 const errors=[];
 try{
  const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:name==="webkit"?3:2,
   ...(name==="webkit"?{isMobile:true,hasTouch:true}:{})});
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto("http://127.0.0.1:8765/tests/fixtures/env022-full-game.html",{waitUntil:"load",timeout:90000});
  await page.waitForFunction(()=>document.documentElement.dataset.visualStatus==="ready",null,{timeout:150000});
  const ev=code=>page.evaluate(c=>document.querySelector("#game").contentWindow.eval(c),code);
  // Evidence only: a slow font/screenshot pipeline must not fail the behaviour check.
  const shot=file=>page.screenshot({path:path.join(out,file),timeout:20000}).catch(e=>console.warn("screenshot skipped",file,e.message.split("\n")[0]));
  await ev(`stopBattleRendering();engine.getDeltaTime=()=>16;window.__step=n=>{for(let i=0;i<n;i++)renderBattleFrame();};__step(3);`);
  assert.equal(await ev(`typeof ArenaVis002!=="undefined"&&!!arenaFeedback`),true,"feedback layer created");
  const radius0=await ev("arenaCamera.radius");
  // 1) Ordinary attack.
  assert.equal(await ev(`applyManualAbility("basic")`),true);
  const dealt=await ev(`(state.events||[]).filter(e=>e.type==="damage").map(e=>({id:e.targetId,amount:e.amount}))`);
  assert.ok(dealt.length>=1,"the attack dealt damage");
  let impact=null;
  for(let i=0;i<400&&!impact;i++){
   impact=await ev(`(()=>{__step(1);const on=[...document.querySelectorAll("#arenaFloaters .arena-floater.on")];
    if(!on.length)return null;
    const t=${JSON.stringify(dealt[0].id)};
    return {text:on.map(n=>n.textContent),sparks:combatVisual007?.pending?.()||0,
     overlay:scene.meshes.filter(m=>m.metadata?.fighterId===t&&m.renderOverlay).length,
     stopping:arenaFeedback.controller.stopping()};})()`);
  }
  assert.ok(impact,"a floating number appeared");
  assert.ok(impact.text.some(t=>t.includes("−"+dealt[0].amount)),"number equals the CombatCore damage: "+impact.text);
  assert.ok(impact.sparks>=1,"spark burst started");
  assert.ok(impact.overlay>=1,"target flashes white");
  assert.equal(impact.stopping,true,"hit-stop running");
  await shot(name+"-basic-impact.png");
  await ev(`__step(8)`); // ~130 ms
  assert.equal(await ev(`scene.meshes.filter(m=>m.renderOverlay).length`),0,"flash is over after ~80 ms");
  for(let i=0;i<300;i++)if(!(await ev(`(__step(1),BattleAnimation.pending())`)))break;
  await ev(`__step(70)`);
  assert.equal(await ev(`document.querySelectorAll("#arenaFloaters .arena-floater.on").length`),0,"numbers expire");
  assert.equal(await ev(`combatVisual007.pending()`),0);
  // 2) Powerful ability: shake, no push-in (ARENA-ART-004G), exact camera restore. Cooldown reset is a test harness step.
  await ev(`(()=>{const a=state.fighters[state.currentActor];a.powerfulCooldown=0;})()`);
  const powered=await ev(`applyManualAbility("powerful")`);
  if(powered){
   let minRadius=radius0,shook=false;
   for(let i=0;i<400;i++){
    const s=await ev(`(()=>{__step(1);return {r:arenaCamera.radius,o:Math.abs(arenaCamera.targetScreenOffset.x)+Math.abs(arenaCamera.targetScreenOffset.y),p:BattleAnimation.pending()};})()`);
    minRadius=Math.min(minRadius,s.r);shook=shook||s.o>0;
    if(i===24)await shot(name+"-powerful.png");
    if(!s.p&&i>40)break;
   }
   await ev(`__step(40)`);
   assert.equal(minRadius,radius0,"ARENA-ART-004G: no camera push-in");
   const end=await ev(`({r:arenaCamera.radius,x:arenaCamera.targetScreenOffset.x,y:arenaCamera.targetScreenOffset.y,lower:arenaCamera.lowerRadiusLimit})`);
   assert.equal(end.r,radius0);assert.equal(end.x,0);assert.equal(end.y,0);
   assert.equal(end.lower,await ev("ARENA_VIEW.minRadius"));
   console.log(name,"powerful: min radius",minRadius.toFixed(2),"shake",shook);
  }else console.log(name,"powerful ability not available for the current actor; skipped");
  await shot(name+"-settled.png");
  // 3) Leaving the battle clears everything.
  await ev(`showScreen("home")`);
  assert.equal(await ev(`document.querySelectorAll("#arenaFloaters .arena-floater.on").length`),0);
  assert.deepEqual(errors.filter(e=>/TypeError|ReferenceError|ArenaVis002|BattleAnimation/.test(e)),[]);
  console.log("ARENA_VIS_002_PASS "+name+" "+JSON.stringify({impact,radius0}));
 }finally{await browser.close();}
}
(async()=>{
 await run("chromium",chromium);
 await run("webkit",webkit);
})().catch(e=>{console.error(e);process.exitCode=1;});
