"use strict";
/* ARENA-ART-004D — measure enemy clip timing from the skinned poses, not by eye.
 * Loads every manifest GLB in Chromium (Babylon), samples each combat clip at 60 Hz
 * and reports, as fractions of the clip length:
 *  - attacks: peak wrist speed (release/impact) and peak forward reach of the wrists;
 *  - Block1: when the wrists reach their raised plateau;
 *  - dying_backwards: when the hips stop falling (body on the ground);
 *  - Combat_Stance: yaw of the chest relative to the feet axis (profile to camera).
 * Run: python3 -m http.server 8765 & NPC_CHROME=/usr/bin/google-chrome NPC_BABYLON_LOCAL=1
 *      node tools/measure-npc-clips.cjs  → artifacts/npc-glb-004d/clip-measure.json
 */
const fs=require("node:fs"),path=require("node:path");
let pw;try{pw=require("playwright");}catch{pw=require("playwright-core");}
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
const out=path.join(process.cwd(),"artifacts","npc-glb-004d");
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await pw.chromium.launch({headless:true,
  ...(process.env.NPC_CHROME?{executablePath:process.env.NPC_CHROME}:{}),
  args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader"]});
 const page=await browser.newPage();
 if(process.env.NPC_BABYLON_LOCAL)await page.route(u=>!/^https?:\/\/127\.0\.0\.1/.test(u.href),route=>{
  const u=new URL(route.request().url());
  const map={"/v9.33.2/babylon.js":"node_modules/babylonjs/babylon.js",
   "/v9.33.2/loaders/babylonjs.loaders.min.js":"node_modules/babylonjs-loaders/babylonjs.loaders.min.js"};
  return u.hostname==="cdn.babylonjs.com"&&map[u.pathname]
   ?route.fulfill({path:path.join(process.cwd(),map[u.pathname]),contentType:"text/javascript"}):route.abort();
 });
 await page.goto(origin,{waitUntil:"load",timeout:60000});
 await page.waitForFunction(()=>typeof NpcModelAssets!=="undefined"&&typeof BABYLON!=="undefined",null,{timeout:60000});
 const only=process.env.NPC_ONLY?process.env.NPC_ONLY.split(","):null;
 const result=await page.evaluate(async only=>{
  await RenGlbRuntime.ensureLoader();
  const B=BABYLON,canvas=document.createElement("canvas");canvas.width=64;canvas.height=64;
  const engine=new B.Engine(canvas,false),scene=new B.Scene(engine);
  scene.activeCamera=new B.FreeCamera("c",new B.Vector3(0,1,-5),scene);
  const clipsWanted=["Combat_Stance","Thrust_Slash","Over_Shoulder_Throw","Triple_Combo_Attack",
   "Crouch_Charge_and_Throw","Block1","Charged_Spell_Cast","Hit_Reaction","dying_backwards"];
  const models={};
  for(const [id,model] of Object.entries(NpcModelAssets.models).filter(([id])=>!only||only.includes(id))){
   const url=model.url,slash=url.lastIndexOf("/");
   const r=await B.SceneLoader.ImportMeshAsync(null,url.slice(0,slash+1),url.slice(slash+1),scene,null,".glb");
   const node=n=>r.transformNodes.find(t=>t.name===n);
   const hips=node("Hips"),lh=node("LeftHand"),rh=node("RightHand"),
    lf=node("LeftFoot"),rf=node("RightFoot"),ls=node("LeftShoulder")||node("LeftArm"),rs=node("RightShoulder")||node("RightArm"),head=node("Head");
   const all=[...r.transformNodes,...r.meshes];
   const update=()=>{for(const n of all)n.computeWorldMatrix(true);};
   const P=n=>{const p=n.getAbsolutePosition();return [p.x,p.y,p.z];};
   for(const g of r.animationGroups)g.stop();
   const rows={};
   for(const name of clipsWanted){
    const g=r.animationGroups.find(a=>a.name===name);if(!g)continue;
    const fps=g.targetedAnimations[0]?.animation.framePerSecond||30;
    const len=(g.to-g.from)/fps,n=Math.max(2,Math.round(len*60));
    g.start(false,1,g.from,g.to);g.pause();
    const samples=[];
    for(let i=0;i<=n;i++){
     g.goToFrame(g.from+(g.to-g.from)*i/n);update();
     samples.push({h:P(hips),l:P(lh),r:P(rh),lf:P(lf),rf:P(rf),ls:P(ls),rs:P(rs),hd:P(head)});
    }
    g.stop();
    rows[name]={len,n,samples};
   }
   for(const g of r.animationGroups)g.dispose();
   for(const s of r.skeletons)s.dispose();
   for(const m of r.meshes)m.dispose(false,true);
   for(const t of r.transformNodes)t.dispose();
   models[id]=rows;
  }
  scene.dispose();engine.dispose();
  return models;
 },only);
 await browser.close();
 if(process.env.NPC_RAW)fs.writeFileSync(path.join(out,"clip-raw.json"),JSON.stringify(result));
 // ---- analysis (Node side). Units are the GLB's own (Meshy rig, cm under a 0.01 root),
 // only ratios and times matter. Forward is +Z in the asset (glTF convention).
 const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
 const smooth=(arr,k=2)=>arr.map((_,i)=>{let s=0,c=0;for(let j=i-k;j<=i+k;j++)if(arr[j]!==undefined){s+=arr[j];c++;}return s/c;});
 const report={};
 for(const [id,rows] of Object.entries(result)){
  const m=report[id]={};
  for(const [clip,{len,n,samples}] of Object.entries(rows)){
   const t=i=>+(i/n).toFixed(3);
   const speed=smooth(samples.map((s,i)=>i?Math.max(dist(s.l,samples[i-1].l),dist(s.r,samples[i-1].r)):0));
   const reach=samples.map(s=>Math.max(s.l[2]-s.h[2],s.r[2]-s.h[2]));
   const wristY=samples.map(s=>Math.max(s.l[1],s.r[1])-s.h[1]);
   const hipY=samples.map(s=>s.h[1]);
   const peaks=[];// local speed maxima above 60% of the global max
   const vmax=Math.max(...speed);
   for(let i=1;i<speed.length-1;i++)if(speed[i]>=speed[i-1]&&speed[i]>speed[i+1]&&speed[i]>.6*vmax)peaks.push(t(i));
   const reachMaxI=reach.indexOf(Math.max(...reach));
   const entry={len:+len.toFixed(2),speedPeaks:peaks,speedPeak:t(speed.indexOf(vmax)),reachPeak:t(reachMaxI)};
   if(clip==="Block1"||clip==="Charged_Spell_Cast"){
    const lo=Math.min(...wristY),hi=Math.max(...wristY);
    entry.raised90=t(wristY.findIndex(y=>y>=lo+.9*(hi-lo)));
    entry.wristRange=[+lo.toFixed(1),+hi.toFixed(1)];
    // Fraction of the clip after the plateau start where the wrists stay above 80%.
    entry.heldUntil=t(wristY.length-1-[...wristY].reverse().findIndex(y=>y>=lo+.8*(hi-lo)));
   }
   if(clip==="dying_backwards"){
    const lo=Math.min(...hipY),hi=hipY[0];
    entry.hipsDown95=t(hipY.findIndex(y=>y<=hi-.95*(hi-lo)));
    entry.hipsLowest=t(hipY.indexOf(lo));
    entry.headDown95=t((()=>{const hy=samples.map(s=>s.hd[1]);const l=Math.min(...hy),h=hy[0];return hy.findIndex(y=>y<=h-.95*(h-l));})());
   }
   if(clip==="Combat_Stance"){
    // Yaw of shoulders and feet lines around Y, in degrees (0 = line along X, i.e. facing ±Z).
    const yaw=(a,b)=>Math.atan2(b[2]-a[2],b[0]-a[0])*180/Math.PI;
    const s=samples[0];
    entry.shoulderYaw=+yaw(s.ls,s.rs).toFixed(1);entry.feetYaw=+yaw(s.lf,s.rf).toFixed(1);
    // Chest normal yaw: perpendicular to the shoulder line, measured from +Z.
    entry.chestFromForward=+((yaw(s.ls,s.rs))).toFixed(1);
   }
   // Coarse timeline (every 5%): wrist speed, signed forward reach (asset +Z, both signs kept),
   // wrist height over hips, hips height. For review only.
   if(process.env.NPC_TIMELINE)entry.timeline=Array.from({length:21},(_,k)=>{const i=Math.round(k/20*n),s=samples[i];
    return [k*5,+speed[i].toFixed(2),+(s.l[2]-s.h[2]).toFixed(2),+(s.r[2]-s.h[2]).toFixed(2),+(s.l[0]-s.h[0]).toFixed(2),+(s.r[0]-s.h[0]).toFixed(2),+wristY[i].toFixed(2),+hipY[i].toFixed(2)];});
   m[clip]=entry;
  }
 }
 fs.writeFileSync(path.join(out,"clip-measure.json"),JSON.stringify(report,null,1));
 const first=report[Object.keys(report)[0]];
 for(const [clip,e] of Object.entries(first))console.log(clip,JSON.stringify(e));
 // spread across models for the key numbers
 for(const clip of ["Thrust_Slash","Over_Shoulder_Throw","Triple_Combo_Attack","Crouch_Charge_and_Throw","Block1","dying_backwards"]){
  const rows=Object.entries(report).filter(([,m])=>m[clip]).map(([id,m])=>id.replace("npc-","")+":"+m[clip].speedPeak+"/"+m[clip].reachPeak+(m[clip].hipsDown95!==undefined?"/"+m[clip].hipsDown95:"")+(m[clip].raised90!==undefined?"/"+m[clip].raised90:""));
  console.log("SPREAD",clip,rows.join(" "));
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
