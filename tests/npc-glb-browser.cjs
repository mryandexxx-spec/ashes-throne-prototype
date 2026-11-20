"use strict";
/* ARENA-ART-004C: enemy GLBs in real WebGL.
 * 1) All 8 manifest models load on a capsule, hide it, pin the hips, and leave no
 *    meshes/textures/materials/skeletons/animation groups after dispose.
 * 2) Real campaign mission 2 (slinger + medic): models replace capsules, auto battle
 *    to victory, retry reopens the battle without growth of scene resources.
 * 3) ARENA-ART-004D: shown frames follow the measured clip windows; an enemy blow puts
 *    the damage number at its contact moment; tinted stand-ins on permanent capsules.
 * 4) ARENA-ART-004E: the sarkh go through part 1 like everyone else; in addition their baked
 *    tail moves between slots while the coil base stays, and they stand on their upright body.
 * 5) ARENA-ART-004F: Hit_Reaction follows its window too; a throw (Over_Shoulder_Throw,
 *    Crouch_Charge_and_Throw) ends blended into the stance, so the first idle frame after it
 *    does not jump (head gap at slot end vs idle). Renamed from npc-glb-004c-browser.cjs.
 * Local cloud run: NPC_CHROME=/usr/bin/google-chrome NPC_BABYLON_LOCAL=1 (Babylon from
 * node_modules via page.route). CI uses the Playwright image and the real CDN. */
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
let pw;try{pw=require("playwright");}catch{pw=require("playwright-core");}
const out=path.join(process.cwd(),"artifacts","npc-glb-browser");
fs.mkdirSync(out,{recursive:true});
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
const useWebkit=process.env.NPC_BROWSER==="webkit";
async function routeBabylon(page){
 if(!process.env.NPC_BABYLON_LOCAL)return;
 const local={
  "/v9.33.2/babylon.js":"node_modules/babylonjs/babylon.js",
  "/v9.33.2/loaders/babylonjs.loaders.min.js":"node_modules/babylonjs-loaders/babylonjs.loaders.min.js"
 };
 await page.route(url=>!/^https?:\/\/127\.0\.0\.1/.test(url.href),route=>{
  const u=new URL(route.request().url()),file=u.hostname==="cdn.babylonjs.com"&&local[u.pathname];
  if(file)return route.fulfill({path:path.join(process.cwd(),file),contentType:"text/javascript"});
  return route.abort();
 });
}
// Resource census of the live arena scene.
const census=()=>({meshes:scene.meshes.length,materials:scene.materials.length,textures:scene.textures.length,
 skeletons:scene.skeletons.length,groups:scene.animationGroups.length,nodes:scene.transformNodes.length,
 npcGlb:npcGlbRuntimes.size});
(async()=>{
 const type=useWebkit?pw.webkit:pw.chromium;
 const browser=await type.launch(useWebkit?{headless:true}:{headless:true,
  ...(process.env.NPC_CHROME?{executablePath:process.env.NPC_CHROME}:{}),
  args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--enable-webgl","--disable-dev-shm-usage"]});
 const page=await browser.newPage({viewport:{width:932,height:430},hasTouch:true});
 const errors=[];page.on("pageerror",e=>errors.push(e.message));
 try{
  await routeBabylon(page);
  await page.goto(origin,{waitUntil:"load",timeout:60000});
  await page.waitForFunction(()=>typeof showScreen==="function"&&typeof NpcGlbRuntime!=="undefined"&&typeof BABYLON!=="undefined",null,{timeout:60000});
  // --- 1. Isolated: every archetype, own engine, leak census around dispose.
  const isolated=await page.evaluate(async()=>{
   const B=BABYLON,canvas=document.createElement("canvas");
   canvas.width=320;canvas.height=240;document.body.append(canvas);
   const engine=new B.Engine(canvas,true),scene=new B.Scene(engine);
   scene.activeCamera=new B.ArcRotateCamera("npcQA",Math.PI/2,1.2,5,new B.Vector3(0,1,0),scene);
   new B.HemisphericLight("npcQALight",new B.Vector3(0,1,0),scene);
   const count=()=>[scene.meshes.length,scene.materials.length,scene.textures.length,
    scene.skeletons.length,scene.animationGroups.length,scene.transformNodes.length].join("/");
   const rows=[];
   // PBR creates one scene-wide BRDF lookup texture on first use; it is not per model.
   const extra=()=>scene.textures.filter(t=>t!==scene.environmentBRDFTexture).map(t=>t.name);
   for(const id of Object.keys(NpcModelAssets.models)){
    const body=B.MeshBuilder.CreateCapsule("cap_"+id,{height:1.5,radius:.42},scene);
    const head=B.MeshBuilder.CreateSphere("head_"+id,{diameter:.6},scene);
    body.position.y=.8;head.position.y=1.8;
    const before=count();
    const rt=NpcGlbRuntime.create(B,scene,{body,head},{archetypeId:id,fighterId:"qa-"+id});
    const ok=await rt.ready;
    const hips=scene.transformNodes.find(n=>n.name==="Hips"&&n.parent);
    const bind=hips?{x:hips.position.x,z:hips.position.z}:null;
    let drift=0;
    for(const slot of ["idle","basic","special","powerful","guard","ward","hit","death"])
     for(const p of [.25,.6,.95]){rt.update({slot,progress:p});scene.render();
      drift=Math.max(drift,Math.abs(hips.position.x-bind.x),Math.abs(hips.position.z-bind.z));}
    // ARENA-ART-004D: the frame shown at slot progress p is the window's clip fraction.
    const windows=[];
    for(const slot of ["basic","powerful","guard","ward","hit","death"]){
     const contact=NpcGlbRuntime.contactFor(id,slot);
     for(const p of [0,contact??.5,1]){
      rt.update({slot,progress:p});
      const g=scene.animationGroups.find(a=>a.name===NpcGlbRuntime.clipFor(id,slot)&&a.animatables.length>0);
      const frame=g?.animatables[0]?.masterFrame;
      const want=g.from+(g.to-g.from)*NpcGlbRuntime.clipFraction(id,slot,p);
      windows.push({slot,p,err:Math.abs(frame-want)});
     }
    }
    // ARENA-ART-004F: head gap between the end of an attack slot and the next idle frame.
    const headNode=scene.transformNodes.find(n=>n.name==="Head"&&n.parent);
    const headAt=(slot,p)=>{rt.update({slot,progress:p});scene.render();headNode.computeWorldMatrix(true);return headNode.getAbsolutePosition().clone();};
    const exits={};
    for(const slot of ["basic","powerful"]){
     const clip=NpcGlbRuntime.clipFor(id,slot);
     const end=headAt(slot,1),pre=headAt(slot,.78),idle=headAt("idle",0);
     exits[slot]={clip,blend:NpcGlbRuntime.stanceBlend(id,slot,1),gap:+B.Vector3.Distance(end,idle).toFixed(4),
      lunge:+B.Vector3.Distance(pre,idle).toFixed(4)};
    }
    // ARENA-ART-004E: tail tip turns between idle and the attack contact; the coil base barely moves.
    let tail=null;
    const tailNodes=scene.transformNodes.filter(n=>/^Tail_0_/.test(n.name)).sort((a,b)=>a.name.localeCompare(b.name));
    if(tailNodes.length){
     const tip=tailNodes[tailNodes.length-1],base=tailNodes[0];
     const pose=(slot,p)=>{rt.update({slot,progress:p});return [base,tip].map(n=>n.rotationQuaternion.clone());};
     const ang=(a,b)=>2*Math.acos(Math.min(1,Math.abs(B.Quaternion.Dot(a,b))));
     const idle=pose("idle",0),idleLater=pose("idle",.25),hit=pose("basic",NpcGlbRuntime.contactFor(id,"basic")??.5);
     const snake=scene.transformNodes.find(n=>n.name==="SnakeBody");
     snake.computeWorldMatrix(true);const at=snake.getAbsolutePosition();
     tail={bones:tailNodes.length,idleTip:ang(idle[1],idleLater[1]),attackTip:ang(idle[1],hit[1]),
      attackBase:ang(idle[0],hit[0]),bodyOffset:Math.hypot(at.x-body.position.x,at.z-body.position.z)};
    }
    const parts=scene.meshes.filter(m=>m.metadata?.fighterId==="qa-"+id&&m.getTotalVertices?.()>0);
    const box=parts.reduce((a,m)=>{m.computeWorldMatrix(true);const b=m.getBoundingInfo().boundingBox;
     return {min:Math.min(a.min,b.minimumWorld.y),max:Math.max(a.max,b.maximumWorld.y)};},{min:Infinity,max:-Infinity});
    const hidden=!body.isVisible&&!head.isVisible;
    const loaded=count();
    rt.dispose();
    rows.push({id,ok,hidden,tail,exits,drift:+drift.toFixed(5),height:+(box.max-box.min).toFixed(2),
     windowErr:Math.max(...windows.map(w=>w.err)),wantHeight:NpcGlbRuntime.heightFor(id),
     restored:body.isVisible&&head.isVisible,before,loaded,after:count(),leftover:extra(),
     brdf:scene.environmentBRDFTexture?.name||null});
    body.dispose();head.dispose();
   }
   scene.dispose();engine.dispose();canvas.remove();
   return rows;
  });
  for(const r of isolated){
   assert.equal(r.ok,true,r.id+" must load");
   assert.equal(r.hidden,true,r.id+" capsule hidden");
   assert.equal(r.restored,true,r.id+" capsule restored on dispose");
   assert.ok(r.drift<1e-6,r.id+" hips x/z pinned, drift "+r.drift);
   assert.ok(r.windowErr<.51,r.id+" shown frame follows the clip window, err "+r.windowErr);
   assert.notEqual(r.loaded,r.before,r.id+" model actually added resources");
   assert.deepEqual(r.leftover,[],r.id+" no model texture survives dispose");
   const [a,b]=[r.after,r.before].map(x=>x.split("/").filter((_,i)=>i!==2).join("/"));
   assert.equal(a,b,r.id+" dispose leaves no meshes/materials/skeletons/groups/nodes");
  }
  // ARENA-ART-004F: throws hand over to the stance without a jump of the head.
  for(const r of isolated)for(const [slot,e] of Object.entries(r.exits)){
   if(!/Throw/.test(e.clip))continue;
   assert.equal(e.blend,1,r.id+" "+slot+" "+e.clip+" ends fully in the stance pose");
   assert.ok(e.gap<.01,r.id+" "+slot+" head gap at the hand-over "+e.gap);
  }
  console.log("ARENAART004F exits",isolated.map(r=>r.id.replace("npc-","")+":"+Object.entries(r.exits).filter(([,e])=>/Throw/.test(e.clip)).map(([s,e])=>s+"="+e.lunge+"→"+e.gap).join(",")).filter(x=>!x.endsWith(":")).join(" "));
  // ARENA-ART-004E: both sarkh are loaded models with a living tail on a still coil base.
  for(const id of ["npc-sarkh-convoy-guard","npc-sarkh-land-courier"]){
   const r=isolated.find(x=>x.id===id);
   assert.ok(r&&r.tail,id+" is in the manifest and has Tail_* bones");
   assert.ok(r.tail.idleTip>.002,id+" idle tail tip moves, "+r.tail.idleTip);
   assert.ok(r.tail.attackTip>.01,id+" tail tip moves on the attack, "+r.tail.attackTip);
   assert.ok(r.tail.attackBase<r.tail.attackTip,id+" coil base moves less than the tip");
   assert.ok(r.tail.bodyOffset<.02,id+" stands on its upright body, offset "+r.tail.bodyOffset);
  }
  // Texture count grows by the shared BRDF only once, never per model.
  assert.ok(isolated.slice(1).every(r=>r.after===isolated[1].after),"no growth across "+isolated.length+" load/dispose cycles");
  console.log("ARENAART004C isolated brdf="+isolated[0].brdf,isolated.map(r=>r.id.replace("npc-","")+" h="+r.height+" "+r.before+"→"+r.loaded+"→"+r.after+(r.tail?" tail="+JSON.stringify(Object.fromEntries(Object.entries(r.tail).map(([k,v])=>[k,+v.toFixed(3)]))):"")).join("; "));
  // --- 2. Real mission: slinger + medic.
  await page.evaluate(()=>{campaignProgress.completed["black-pass-ambush"]=true;campaignProgress.bestStars["black-pass-ambush"]=1;});
  await page.locator('#home .hq-bottom button[data-screen="campaign"]').evaluate(el=>el.click());
  await page.locator("#campaignHub").waitFor({state:"visible",timeout:15000});
  await page.locator('[data-campaign-path="training"]').click();
  await page.locator('[data-campaign-mission="demo-mission-2"]').click();
  await page.locator("#squad").waitFor({state:"visible",timeout:10000});
  await page.locator("#squadDisband").evaluate(el=>el.click());
  for(const id of ["ren","nada","liora","art","sava"])
   await page.locator('#squadRoster [data-hero-id="'+id+'"]').evaluate(el=>el.click());
  const start=async()=>{
   const button=page.locator("#squadStart");await button.click();
   if(await page.locator("#squad").isVisible())await button.click();
   await page.locator("#battle").waitFor({state:"visible",timeout:30000});
   await page.waitForFunction(()=>npcGlbRuntimes.size>0&&[...npcGlbRuntimes.values()].every(r=>r.isReady),null,{timeout:90000});
   // Let hero GLBs settle too before counting.
   await page.waitForTimeout(1500);
  };
  await start();
  const first=await page.evaluate(census);
  const arena=await page.evaluate(()=>state.fighters.filter(f=>f.side==="enemy").map(f=>({id:f.id,archetype:f.archetypeId,
   glb:!!npcGlbRuntimes.get(f.id)?.isReady,capsuleHidden:meshes[f.id].body.isVisible===false,
   linked:AnimationProfiles.isCustom(f.id,"basic")})));
  assert.ok(arena.length>=2);
  for(const f of arena){assert.equal(f.glb,true,f.id);assert.equal(f.capsuleHidden,true,f.id);assert.equal(f.linked,true,f.id);}
  await page.screenshot({path:path.join(out,(useWebkit?"webkit":"chromium")+"-arena.png")});
  // ARENA-ART-004D: an enemy blow is timed by its profile's contactFraction (= window
  // contact): the target's hit cue and the HUD number start at that moment.
  const contact=await page.evaluate(()=>{
   const slinger=state.fighters.find(f=>f.archetypeId==="npc-ridge-slinger");
   const hero=state.fighters.find(f=>f.side==="ally"&&f.hp>0);
   const profile=AnimationProfiles.resolve(slinger.id,"basic");
   BattleAnimation.clear();BattleAnimation.drainFeedback();
   BattleAnimation.enqueue([{type:"ability",actorId:slinger.id,targetId:hero.id,abilityId:"basic"},
    {type:"damage",actorId:slinger.id,targetId:hero.id,amount:1,remainingHp:hero.hp}],null,null);
   const step=20,seen=[];let t=0,numberAt=null;
   BattleAnimation.tick(0);
   while(t<profile.durationMs+200){
    BattleAnimation.tick(step);t+=step;
    if(numberAt===null&&BattleAnimation.drainFeedback().some(f=>f.kind==="damage"&&f.id===hero.id))numberAt=t;
   }
   BattleAnimation.clear();
   return {numberAt,contactMs:profile.durationMs*profile.contactFraction,duration:profile.durationMs,
    window:NpcGlbRuntime.contactFor("npc-ridge-slinger","basic"),fraction:profile.contactFraction};
  });
  assert.equal(contact.fraction,contact.window,"profile contact equals window contact");
  assert.ok(contact.numberAt!==null&&Math.abs(contact.numberAt-contact.contactMs)<=20,"number at contact: "+JSON.stringify(contact));
  assert.ok(contact.numberAt<contact.duration-100,"number before the clip ends");
  await page.locator("#autoSpeedBtn").click();await page.locator("#autoSpeedBtn").click();
  await page.locator("#autoBattleBtn").click();
  await page.locator("#missionResult").waitFor({state:"visible",timeout:180000});
  assert.equal(await page.evaluate(()=>state.winner),"ally");
  await page.locator("#missionResultRetry").click();
  await page.locator("#squad").waitFor({state:"visible",timeout:15000});
  await start();
  const second=await page.evaluate(census);
  assert.deepEqual(second,first,"reopened battle must not grow scene resources");
  // ARENA-ART-004D: stand-ins on permanent capsules (training enemies, capsule heroes):
  // tinted model replaces the capsule, profile linked; dispose hands the capsule back.
  const standIns=await page.evaluate(async()=>{
   const ids=["ves","shade","kael","lyra","darin"].filter(id=>meshes[id]);
   const count=()=>[scene.meshes.length,scene.materials.length,scene.textures.length,scene.skeletons.length,
    scene.animationGroups.length,scene.transformNodes.length].join("/");
   const before=count();
   ensureEncounterNpcVisuals(ids.map(id=>({id,side:"enemy"})));
   await Promise.all(ids.map(id=>npcGlbRuntimes.get(id)?.ready));
   const rows=ids.map(id=>{
    const mat=scene.meshes.find(m=>m.metadata?.fighterId===id&&m.material?.albedoColor)?.material;
    return {id,ready:!!npcGlbRuntimes.get(id)?.isReady,hidden:meshes[id].body.isVisible===false,
     linked:AnimationProfiles.isCustom(id,"basic"),tint:mat?[mat.albedoColor.r,mat.albedoColor.g,mat.albedoColor.b].map(v=>+v.toFixed(2)):null,
     want:NpcGlbRuntime.standIn(id).tint};
   });
   const loaded=count();
   for(const id of ids){npcGlbRuntimes.get(id)?.dispose();npcGlbRuntimes.delete(id);AnimationProfiles.unlink(id);}
   return {rows,before,loaded,after:count(),restored:ids.every(id=>meshes[id].body.isVisible)};
  });
  assert.ok(standIns.rows.length===5,"all five stand-in capsules exist");
  for(const r of standIns.rows){
   assert.equal(r.ready,true,r.id);assert.equal(r.hidden,true,r.id);assert.equal(r.linked,true,r.id);
   assert.deepEqual(r.tint,r.want,r.id+" tint");
  }
  assert.equal(standIns.restored,true,"capsules restored");
  const strip=x=>x.split("/").filter((_,i)=>i!==2).join("/");
  assert.equal(strip(standIns.after),strip(standIns.before),"stand-ins leave no resources");
  assert.deepEqual(errors.filter(e=>/TypeError|ReferenceError|NpcGlb|AnimationProfiles/.test(e)),[]);
  console.log("ARENAART004C_BROWSER PASS",JSON.stringify({arena,contact,first,second,standIns:{before:standIns.before,loaded:standIns.loaded,after:standIns.after}}));
 }catch(err){
  await page.screenshot({path:path.join(out,"failure.png")}).catch(()=>{});
  console.error("ARENAART004C_BROWSER FAIL",errors);
  throw err;
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
