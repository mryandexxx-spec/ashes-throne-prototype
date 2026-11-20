"use strict";
/* ARENA-ART-004D — stance yaw sweep and enemy/hero height on the real battle frame.
 * Mission 2 (slinger + medic) with Ren, Nada, Liora, Art, Sava. The render loop is
 * stopped, enemy bodies are set to idleYaw(enemy)+offset and the scene is rendered
 * once per offset: artifacts/npc-glb-004d/yaw_<deg>.png. Heights are measured on
 * skinned bounds in the idle pose (world units, feet to top).
 * Run: python3 -m http.server 8765 & NPC_CHROME=/usr/bin/google-chrome NPC_BABYLON_LOCAL=1
 *      node tools/npc-stance-sheet.cjs [deg,deg,...]
 * ARENA-ART-004E — pose sheet in an isolated scene (no battle): NPC_POSES=<id|url>,… renders every
 * combat clip at a few fractions, front 3/4 and side, one PNG per model plus a contact sheet:
 *   NPC_POSES=npc-sarkh-convoy-guard,npc-sarkh-land-courier node tools/npc-stance-sheet.cjs
 * NPC_POSE_CLIPS / NPC_POSE_FRACTIONS / NPC_POSE_VIEWS (front,side,top) override the defaults. Needs sharp (npm i --no-save sharp).
 */
const fs=require("node:fs"),path=require("node:path");
let pw;try{pw=require("playwright");}catch{pw=require("playwright-core");}
const origin=process.env.GAME_ORIGIN||"http://127.0.0.1:8765/";
const out=path.join(process.cwd(),"artifacts",process.env.NPC_OUT||"npc-glb-004d");
fs.mkdirSync(out,{recursive:true});
const offsets=(process.argv[2]||"0,-35,35").split(",").map(Number);
async function poseSheet(page){
 const models=process.env.NPC_POSES.split(",");
 const clips=(process.env.NPC_POSE_CLIPS||"Combat_Stance,Thrust_Slash,Over_Shoulder_Throw,Block1,Charged_Spell_Cast,Hit_Reaction,dying_backwards").split(",");
 const fractions=(process.env.NPC_POSE_FRACTIONS||"0,0.3,0.55,0.8,1").split(",").map(Number);
 const VIEWS={front:{alpha:Math.PI/2-.6,beta:1.25},side:{alpha:0,beta:1.25},top:{alpha:Math.PI/2,beta:.25}};
 const views=(process.env.NPC_POSE_VIEWS||"front,side").split(",").map(name=>({name,...VIEWS[name]}));
 const cell=240;
 const shots=await page.evaluate(async({models,clips,fractions,views,cell})=>{
  await RenGlbRuntime.ensureLoader();
  const B=BABYLON,canvas=document.createElement("canvas");canvas.width=cell;canvas.height=cell;
  document.body.appendChild(canvas);
  const engine=new B.Engine(canvas,true,{preserveDrawingBuffer:true}),scene=new B.Scene(engine);
  scene.clearColor=new B.Color4(.33,.33,.42,1);
  new B.HemisphericLight("h",new B.Vector3(.3,1,-.4),scene).intensity=1.1;
  const ground=B.MeshBuilder.CreateGround("g",{width:4,height:4},scene);
  const gm=new B.StandardMaterial("gm",scene);gm.diffuseColor=new B.Color3(.24,.24,.3);ground.material=gm;
  const cam=new B.ArcRotateCamera("c",0,1.25,3.3,new B.Vector3(0,.8,0),scene);scene.activeCamera=cam;
  const out={};
  for(const id of models){
   const url=id.endsWith(".glb")?id:NpcModelAssets.models[id].url,slash=url.lastIndexOf("/");
   const r=await B.SceneLoader.ImportMeshAsync(null,url.slice(0,slash+1),url.slice(slash+1),scene,null,".glb");
   for(const g of r.animationGroups)g.stop();
   const vis=r.meshes.filter(m=>m.getTotalVertices?.()>0);
   let min=new B.Vector3(Infinity,Infinity,Infinity),max=min.scale(-1);
   for(const m of vis){m.computeWorldMatrix(true);const b=m.getBoundingInfo().boundingBox;min=B.Vector3.Minimize(min,b.minimumWorld);max=B.Vector3.Maximize(max,b.maximumWorld);}
   const s=1.8/(max.y-min.y);r.meshes[0].scaling.scaleInPlace(s);r.meshes[0].position.y=-min.y*s;
   cam.target.set((min.x+max.x)/2*s,.85,(min.z+max.z)/2*s);
   await scene.whenReadyAsync();
   const rows=[];
   for(const clip of clips){
    const g=r.animationGroups.find(a=>a.name===clip);if(!g)continue;
    g.start(false,1,g.from,g.to);g.pause();
    for(const view of views){
     const row=[];
     for(const f of fractions){
      g.goToFrame(g.from+(g.to-g.from)*f);
      for(const m of vis)m.refreshBoundingInfo?.({applySkeleton:true});
      cam.alpha=view.alpha;cam.beta=view.beta;scene.render();scene.render();
      row.push(canvas.toDataURL("image/png"));
     }
     rows.push({clip,view:view.name,row});
    }
    g.stop();
   }
   out[id]=rows;
   for(const g of r.animationGroups)g.dispose();
   for(const sk of r.skeletons)sk.dispose();
   for(const m of r.meshes)m.dispose(false,true);
   for(const t of r.transformNodes)t.dispose();
  }
  scene.dispose();engine.dispose();
  return out;
 },{models,clips,fractions,views,cell});
 const sharp=require("sharp");
 const label=(text,w,h)=>Buffer.from(`<svg width="${w}" height="${h}"><rect width="100%" height="100%" fill="#222"/><text x="6" y="${h-7}" font-family="sans-serif" font-size="14" fill="#eee">${text}</text></svg>`);
 const files=[];
 for(const [id,rows] of Object.entries(shots)){
  const W=fractions.length*cell,H=rows.length*(cell+20)+24,parts=[{input:label(id+" · frac "+fractions.join(" / "),W,24),top:0,left:0}];
  rows.forEach((r,i)=>{const top=24+i*(cell+20);parts.push({input:label(r.clip+" · "+r.view,W,20),top,left:0});
   r.row.forEach((d,j)=>parts.push({input:Buffer.from(d.split(",")[1],"base64"),top:top+20,left:j*cell}));});
  const file=path.join(out,"poses_"+path.basename(id).replace(/\.glb$/,"")+".png");
  await sharp({create:{width:W,height:H,channels:3,background:"#222"}}).composite(parts).png().toFile(file);
  files.push(file);console.log("POSES",file);
 }
}
(async()=>{
 const browser=await pw.chromium.launch({headless:true,
  ...(process.env.NPC_CHROME?{executablePath:process.env.NPC_CHROME}:{}),
  args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--enable-webgl"]});
 const page=await browser.newPage({viewport:{width:932,height:430},hasTouch:true});
 if(process.env.NPC_BABYLON_LOCAL)await page.route(u=>!/^https?:\/\/127\.0\.0\.1/.test(u.href),route=>{
  const u=new URL(route.request().url());
  const map={"/v9.33.2/babylon.js":"node_modules/babylonjs/babylon.js",
   "/v9.33.2/loaders/babylonjs.loaders.min.js":"node_modules/babylonjs-loaders/babylonjs.loaders.min.js"};
  return u.hostname==="cdn.babylonjs.com"&&map[u.pathname]
   ?route.fulfill({path:path.join(process.cwd(),map[u.pathname]),contentType:"text/javascript"}):route.abort();
 });
 await page.goto(origin,{waitUntil:"load",timeout:60000});
 await page.waitForFunction(()=>typeof showScreen==="function"&&typeof NpcGlbRuntime!=="undefined",null,{timeout:60000});
 if(process.env.NPC_POSES){await poseSheet(page);await browser.close();return;}
 await page.evaluate(()=>{campaignProgress.completed["black-pass-ambush"]=true;campaignProgress.bestStars["black-pass-ambush"]=1;});
 await page.locator('#home .hq-bottom button[data-screen="campaign"]').evaluate(el=>el.click());
 await page.locator('[data-campaign-path="training"]').click();
 await page.locator('[data-campaign-mission="demo-mission-2"]').click();
 await page.locator("#squadDisband").evaluate(el=>el.click());
 for(const id of (process.env.NPC_SQUAD||"ren,nada,liora,art,sava").split(","))
  await page.locator('#squadRoster [data-hero-id="'+id+'"]').evaluate(el=>el.click());
 const button=page.locator("#squadStart");await button.click();
 if(await page.locator("#squad").isVisible())await button.click();
 await page.locator("#battle").waitFor({state:"visible",timeout:30000});
 await page.waitForFunction(()=>npcGlbRuntimes.size>0&&[...npcGlbRuntimes.values()].every(r=>r.isReady),null,{timeout:90000});
 // ARENA-ART-004E: no mission has sarkh yet, so NPC_SWAP=<enemy index>:<archetypeId>,… re-skins
 // enemies on the real battle frame (visual only, like a load of that archetype on that spot).
 if(process.env.NPC_SWAP)await page.evaluate(async pairs=>{
  const enemies=state.fighters.filter(f=>f.side==="enemy");
  for(const [i,id] of pairs.split(",").map(p=>p.split(":"))){
   const f=enemies[Number(i)];if(!f)continue;
   npcGlbRuntimes.get(f.id)?.dispose();npcGlbRuntimes.delete(f.id);
   const rt=NpcGlbRuntime.create(BABYLON,scene,meshes[f.id],{archetypeId:id,fighterId:f.id});
   npcGlbRuntimes.set(f.id,rt);
   if(await rt.ready)AnimationProfiles.link(f.id,id);
  }
 },process.env.NPC_SWAP);
 await page.waitForTimeout(2500);
 const heights=await page.evaluate(()=>{
  stopBattleRendering();
  const rows=[];
  for(const f of state.fighters){
   const v=meshes[f.id];if(!v)continue;
   let top=-Infinity;
   for(const m of scene.meshes){
    if(m.metadata?.fighterId!==f.id||!m.isEnabled()||!m.isVisible||!(m.getTotalVertices?.()>0))continue;
    if(m===v.base||m.name.includes("base"))continue;
    m.computeWorldMatrix(true);
    m.refreshBoundingInfo?.({applySkeleton:true,applyMorph:true});
    top=Math.max(top,m.getBoundingInfo().boundingBox.maximumWorld.y);
   }
   const root=scene.transformNodes.find(n=>n.name==="npc_glb_"+f.id);
   const head=root?.getChildTransformNodes(false).find(n=>n.name==="Head");
   // ARENA-ART-004E: sarkh stand on their upright body; report how far it is from the fighter's spot.
   const snake=root?.getChildTransformNodes(false).find(n=>n.name==="SnakeBody");
   const spot=v.body.getAbsolutePosition(),sb=snake?.getAbsolutePosition();
   rows.push({id:f.id,side:f.side,top:+top.toFixed(2),
    ...(root?{scale:+root.scaling.x.toFixed(4),headBone:+head.getAbsolutePosition().y.toFixed(2)}:{}),
    ...(sb?{bodyOffset:+Math.hypot(sb.x-spot.x,sb.z-spot.z).toFixed(2),archetype:root.metadata?.archetypeId}:{})});
  }
  return rows;
 });
 console.log("HEIGHTS",JSON.stringify(heights));
 for(const deg of offsets){
  await page.evaluate(deg=>{
   for(const f of state.fighters)if(f.side==="enemy"&&meshes[f.id])
    meshes[f.id].body.rotation.y=ArenaStageView.idleYaw("enemy")+deg*Math.PI/180;
   scene.render();
  },deg);
  await page.screenshot({path:path.join(out,"yaw_"+deg+".png")});
 }
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
