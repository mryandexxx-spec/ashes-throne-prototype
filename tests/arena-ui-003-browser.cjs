"use strict";
// ARENA-UI-003: real game, real Babylon. HUD frame geometry and controls in
// Chromium and mobile WebKit at 844×390 and 932×430.
const {chromium,webkit}=require("playwright");
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const out="artifacts/arena-ui-003";
fs.mkdirSync(out,{recursive:true});
async function run(name,type,[W,H]){
 const args=name==="chromium"?["--no-sandbox","--use-angle=swiftshader","--enable-webgl","--enable-unsafe-swiftshader"]:[];
 const browser=await type.launch({headless:true,args});
 const errors=[],failed=[];
 try{
  const page=await browser.newPage({viewport:{width:W,height:H},deviceScaleFactor:name==="webkit"?3:2,
   ...(name==="webkit"?{isMobile:true,hasTouch:true}:{})});
  page.on("pageerror",e=>errors.push(e.message));
  // Aborted model downloads on reset are normal; HTTP errors are not.
  page.on("requestfailed",r=>{if(/assets\/abilities\//.test(r.url()))failed.push(r.url());});
  page.on("response",r=>{if(r.status()>=400)failed.push(r.status()+" "+r.url());});
  await page.goto("http://127.0.0.1:8765/tests/fixtures/env022-full-game.html",{waitUntil:"load",timeout:90000});
  await page.waitForFunction(()=>document.documentElement.dataset.visualStatus==="ready",null,{timeout:150000});
  const ev=code=>page.evaluate(c=>document.querySelector("#game").contentWindow.eval(c),code);
  await ev(`stopBattleRendering();engine.getDeltaTime=()=>16;window.__step=n=>{for(let i=0;i<n;i++)renderBattleFrame();};__step(3);`);
  const layout=await ev(`(()=>{
   const r=s=>{const e=document.querySelector(s);if(!e)return null;const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,r:b.right,b:b.bottom};};
   const hit=(a,b)=>a&&b&&a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
   const zones={menu:r("#battle .battle-menu-btn"),log:r("#battle .combat-log summary"),queue:r("#turnQueueBar"),
    hero:r("#activeHero"),auto:r("#autoBattleBtn"),speed:r("#autoSpeedBtn"),abilities:r("#battle .ability-options"),
    basic:r("#basicAbilityBtn"),special:r("#specialAbilityBtn"),toggle:r("#turnQueueToggle")};
   const names=Object.keys(zones),overlaps=[];
   for(let i=0;i<names.length;i++)for(let j=i+1;j<names.length;j++){
    const a=names[i],b=names[j];
    if(["toggle","basic","special"].includes(a)||["toggle","basic","special"].includes(b))continue;
    if(hit(zones[a],zones[b]))overlaps.push(a+"/"+b);
   }
   const actor=state.fighters[state.currentActor];
   return {zones,overlaps,vw:innerWidth,vh:innerHeight,scrollW:document.documentElement.scrollWidth,
    queue:[...document.querySelectorAll("#turnQueue li")].map(n=>n.dataset.fighterId),actor:actor.id,
    heroName:document.querySelector("#activeHeroName").textContent,
    hidden:["#targetFighterHud","#turnChip","#actionTitle"].filter(s=>document.querySelector(s)),
    visibleService:/Тестовая арена|Действие выполняется|Анимация действия|3D .* загружен/i.test(
     [...document.querySelectorAll("#battle *")].filter(e=>e.offsetWidth>2&&e.offsetHeight>2&&!e.children.length).map(e=>e.textContent).join(" "))};
  })()`);
  const z=layout.zones;
  assert.deepEqual(layout.overlaps,[],"HUD zones overlap");
  assert.ok(layout.scrollW<=layout.vw+1,"no horizontal overflow");
  for(const k of ["menu","log","auto","speed"])assert.ok(z[k].w>=44&&z[k].h>=44,k+" ≥44");
  for(const k of ["basic","special"])assert.ok(z[k].w>=56&&z[k].h>=56,k+" ≥56");
  for(const [k,v] of Object.entries(z))if(v&&v.w)assert.ok(v.x>=0&&v.y>=0&&v.r<=layout.vw+1&&v.b<=layout.vh+1,k+" on screen");
  assert.ok(Math.abs(z.queue.x+z.queue.w/2-layout.vw/2)<4,"queue is centred at the top");
  assert.ok(z.hero.x<layout.vw/3&&z.hero.b>layout.vh*0.75,"hero bottom-left");
  assert.ok(z.abilities.r>layout.vw*0.8&&z.abilities.b>layout.vh*0.75,"abilities bottom-right");
  assert.equal(layout.queue[0],layout.actor,"queue starts with the acting hero");
  assert.equal(layout.queue.length,6);
  assert.equal(layout.hidden.length,0,"old elements removed");
  assert.equal(layout.visibleService,false,"no service text on screen");
  await page.screenshot({path:path.join(out,`${name}-${W}x${H}-ally-turn.png`)});
  // Collapse via the real button; the choice survives a new battle.
  await page.frameLocator("#game").locator("#turnQueueToggle").click();
  assert.equal(await ev(`[...document.querySelectorAll("#turnQueue li")].filter(n=>n.offsetWidth>0).length`),1);
  assert.equal(await ev(`document.querySelector("#turnQueueToggle").getAttribute("aria-expanded")`),"false");
  await ev(`resetBattle();__step(3)`);
  assert.equal(await ev(`document.querySelector("#turnQueueBar").classList.contains("collapsed")`),true,"remembered");
  await page.frameLocator("#game").locator("#turnQueueToggle").click();
  // Long press on the special ability shows its description, not a cast.
  const before=await ev(`state.allyActions`);
  await ev(`showAbilityTooltip("special")`);
  const tip=await ev(`(()=>{const t=document.querySelector("#abilityTooltip"),p=document.querySelector("#abilityTooltipText");const b=t.getBoundingClientRect();
   return {shown:!t.hidden,text:p.textContent,visible:p.offsetHeight>0,r:b.right,x:b.x,y:b.y};})()`);
  assert.equal(tip.shown,true);assert.equal(tip.visible,true,"description visible");assert.ok(tip.text.length>10);
  assert.ok(tip.x>=0&&tip.y>=0&&tip.r<=W+1,"tooltip on screen");
  assert.equal(await ev(`state.allyActions`),before);
  await ev(`hideAbilityTooltip()`);
  // Cooldown is drawn on the icon and dims it.
  await ev(`(()=>{const a=state.fighters[state.currentActor];a.specialCooldown=2;syncBattleUI();})()`);
  const cd=await ev(`(()=>{const b=document.querySelector("#specialAbilityBtn");return {state:b.dataset.state,num:b.querySelector(".ability-cooldown")?.textContent,label:b.getAttribute("aria-label"),filter:getComputedStyle(b).filter};})()`);
  assert.equal(cd.state,"cooldown");assert.equal(cd.num,"2");assert.match(cd.label,/перезарядка 2/);assert.match(cd.filter,/grayscale/);
  await page.screenshot({path:path.join(out,`${name}-${W}x${H}-cooldown.png`)});
  await ev(`(()=>{const a=state.fighters[state.currentActor];a.specialCooldown=0;syncBattleUI();})()`);
  // A real tap on the basic ability performs a turn; the queue moves on.
  await page.frameLocator("#game").locator("#basicAbilityBtn").click();
  assert.equal(await ev(`state.allyActions`),before+1);
  for(let i=0;i<600;i++)if(!(await ev(`(__step(1),BattleAnimation.pending())`)))break;
  await ev(`__step(20)`);
  assert.equal(await ev(`document.querySelector("#turnQueue li").dataset.fighterId===state.fighters[state.currentActor].id`),true);
  // ARENA-UI-003B: labels pinned to fighters; floating numbers never cover a label.
  await ev(`state=CombatCore.createBattle([...HEROES.filter(f=>f.side==="ally").slice(0,5),...HEROES.filter(f=>f.side==="enemy").slice(0,5)]);
   CombatCore.advanceToPlayerTurn(state);syncBattleUI();updateMeshes();__step(6);`);
  await page.waitForTimeout(400);await ev(`__step(4)`);
  const plates=`[...document.querySelectorAll("#arenaIndicators .arena-indicator")].filter(n=>n.style.display!=="none"&&!n.classList.contains("away")).map(n=>{
    const b=n.getBoundingClientRect(),name=n.querySelector(".arena-indicator-name");const nb=name?.getBoundingClientRect();
    return {id:n.dataset.fighterId,x:b.x,y:b.y,w:b.width,h:b.height,named:!!name,name:nb?{x:nb.x,y:nb.y,w:nb.width,h:nb.height}:null,
     ax:parseFloat(n.style.left),ay:parseFloat(n.style.top)};})`;
  const pinned=await ev(`(()=>{const p=${plates};const actor=state.fighters[state.currentActor].id,target=state.fighters[state.selectedEnemy].id;
   return {p,actor,target,named:p.filter(x=>x.named).map(x=>x.id).sort()};})()`);
  assert.equal(pinned.p.length,10);
  assert.deepEqual(pinned.named,[pinned.actor,pinned.target].sort(),"names only over the acting hero and the target");
  for(const r of pinned.p){
   assert.ok(Math.abs(r.x+r.w/2-r.ax)<=17,r.id+" label centred over its fighter");
   assert.ok(r.y+r.h<=r.ay+13,r.id+" label above its head anchor");
  }
  const ov=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  for(let i=0;i<pinned.p.length;i++)for(let j=0;j<i;j++)
   assert.equal(ov(pinned.p[i],pinned.p[j]),false,"labels collide "+pinned.p[i].id+"/"+pinned.p[j].id);
  for(const a of pinned.p)if(a.name)for(const b of pinned.p)if(b!==a)
   assert.equal(ov(a.name,b),false,"name of "+a.id+" covers the label of "+b.id);
  // Target the farthest enemy (the old packer moved its label under the numbers) and strike.
  await ev(`(()=>{const e=state.fighters.map((f,i)=>[f,i]).filter(([f])=>f.side==="enemy"&&f.hp>0);
   const far=e.reduce((a,b)=>(meshes[b[0].id].head.position.z<meshes[a[0].id].head.position.z?b:a));
   CombatCore.chooseEnemy(state,far[1]);syncBattleUI();__step(2);})()`);
  await page.waitForTimeout(200);await ev(`__step(2)`);
  const farLabels=await ev(`${plates}`);
  for(const a of farLabels)if(a.name)for(const b of farLabels)if(b!==a)
   assert.equal(ov(a.name,b),false,"far target name covers "+b.id);
  assert.equal(await ev(`applyManualAbility("basic")`),true);
  let seen=0,away=false;const clashes=[];
  for(let i=0;i<500;i++){
   const f=await ev(`(()=>{__step(1);const fl=[...document.querySelectorAll("#arenaFloaters .arena-floater.on")].map(n=>{const b=n.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,t:n.textContent};});
    return {fl,p:${plates},away:!!document.querySelector("#arenaIndicators .arena-indicator.away"),pending:BattleAnimation.pending()};})()`);
   away=away||f.away;
   for(const n of f.fl){seen++;for(const r of f.p){if(ov(n,r)||(r.name&&ov(n,r.name))){clashes.push(n.t+"/"+r.id);if(process.env.DEBUG_UI003)console.log(JSON.stringify({n,r,target:await ev("state.fighters[state.selectedEnemy]?.id")}));}}}
   if(!f.pending&&seen&&!f.fl.length)break;
  }
  assert.ok(seen>0,"a number was shown");
  assert.deepEqual([...new Set(clashes)],[],"floating numbers cover a label");
  assert.equal(away,true,"the striker's label hides while it is away");
  await ev(`__step(40)`);
  assert.equal(await ev(`document.querySelectorAll("#arenaIndicators .arena-indicator.away").length`),0,"label returns with its fighter");
  await page.screenshot({path:path.join(out,`${name}-${W}x${H}-5v5-labels.png`)});
  assert.deepEqual(errors,[]);
  assert.deepEqual(failed.filter(u=>!/fonts\.g/.test(u)),[],"no failed requests (no icon 404s)");
  console.log("ARENA_UI_003_PASS",name,W+"x"+H,JSON.stringify({queue:layout.queue,hero:layout.heroName}));
 }finally{await browser.close();}
}
(async()=>{
 for(const size of [[844,390],[932,430]]){
  await run("chromium",chromium,size);
  if(process.env.ARENA_UI_003_CHROMIUM_ONLY!=="1")await run("webkit",webkit,size);
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
