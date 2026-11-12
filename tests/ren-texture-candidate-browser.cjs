"use strict";
const assert=require("node:assert/strict");
const {chromium,webkit}=require("playwright");
const file="build/model-candidates/ren-webp92-preview.glb";
(async()=>{
 for(const [name,driver] of [["chromium",chromium],["webkit",webkit]]){
  const browser=await driver.launch(name==="chromium"
   ?{headless:true,args:["--no-sandbox","--use-gl=angle","--use-angle=swiftshader","--enable-webgl","--disable-dev-shm-usage"]}
   :{headless:true});
  try{
   const page=await browser.newPage({viewport:{width:932,height:430}});
   const errors=[];page.on("pageerror",e=>errors.push(e.message));
   await page.goto("http://127.0.0.1:8765/",{waitUntil:"load"});
   const result=await page.evaluate(async()=>{
    await RenGlbRuntime.ensureLoader();
    async function inspect(url){
     const B=BABYLON,canvas=document.createElement("canvas");
     canvas.width=420;canvas.height=330;document.body.append(canvas);
     const engine=new B.Engine(canvas,true),scene=new B.Scene(engine);
     scene.activeCamera=new B.ArcRotateCamera("qa",Math.PI/2,1.2,5,new B.Vector3(0,1,0),scene);
     new B.HemisphericLight("light",new B.Vector3(0,1,0),scene);
     try{
      const slash=url.lastIndexOf("/");
      const asset=await B.SceneLoader.ImportMeshAsync(null,url.slice(0,slash+1),url.slice(slash+1),scene,null,".glb");
      for(const group of asset.animationGroups)group.stop();
      scene.render();
      return {
       vertices:asset.meshes.reduce((n,m)=>n+(m.getTotalVertices?.()||0),0),
       animations:asset.animationGroups.map(g=>g.name).sort(),
       bones:asset.skeletons.reduce((n,s)=>n+s.bones.length,0),
       materials:scene.materials.length,
       textures:scene.textures.filter(t=>t.name&&!t.name.includes("environment")).map(t=>({name:t.name,ready:t.isReady()}))
      };
     }finally{scene.dispose();engine.dispose();canvas.remove();}
    }
    return {original:await inspect("assets/ren-meshy-mixamo-animated.glb"),
     candidate:await inspect("build/model-candidates/ren-webp92-preview.glb"),
     lossless:await inspect("build/model-candidates/ren-webp-lossless-preview.glb")};
   });
   for(const variant of [result.candidate,result.lossless]){
    assert.ok(variant.vertices>0);
    assert.equal(variant.vertices,result.original.vertices,"mesh geometry changed");
    assert.equal(variant.bones,result.original.bones,"skeleton changed");
    assert.deepEqual(variant.animations,result.original.animations,"animation clips changed");
    assert.ok(variant.textures.length>0,"no loaded textures");
    assert.ok(variant.textures.every(t=>t.ready),"unready WebP texture");
   }
   assert.deepEqual(errors,[]);
   console.log("REN_TEXTURE_WEBP_BROWSER="+JSON.stringify({browser:name,original:result.original.vertices,
    candidate:result.candidate.vertices,bones:result.candidate.bones,
    clips:result.candidate.animations.length,textures:result.candidate.textures.length}));
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1});
