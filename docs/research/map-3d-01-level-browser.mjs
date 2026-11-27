// Import exported GLB and already shipped Ren in real browsers; not a new game feature.
import {chromium,webkit} from 'playwright';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const site=resolve('site'),out=resolve('level-output');await mkdir(out+'/captures',{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.glb':'model/gltf-binary'};
const server=createServer(async(req,res)=>{try{
 const p=resolve(site,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(site+'/'))throw Error('outside site');
 const data=await readFile(p);res.setHeader('content-type',mime[extname(p)]||'application/octet-stream');res.setHeader('content-length',data.length);res.end(data);
}catch(e){res.statusCode=404;res.end('not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/index.html';
const evidence=[],errors=[];
for(const [name,driver] of [['chromium',chromium],['webkit',webkit]]){
 let browser;
 try{
 browser=await driver.launch(name==='chromium'?{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{}); 
 const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1});
 const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
 await page.goto(url);
 for(const version of ['base','revision']){
  const result=await page.evaluate(async version=>{
   const B=window.BABYLON,base=B.EngineStore.Instances.length;
   const canvas=document.querySelector('canvas'),engine=new B.Engine(canvas,true,{preserveDrawingBuffer:true}),scene=new B.Scene(engine);scene.useRightHandedSystem=true;scene.clearColor=new B.Color4(.11,.15,.18,1);
   const camera=new B.ArcRotateCamera('camera',-Math.PI/2,Math.PI/3,33,new B.Vector3(2,0,0),scene);scene.activeCamera=camera;camera.mode=B.Camera.ORTHOGRAPHIC_CAMERA;camera.orthoLeft=-18;camera.orthoRight=18;camera.orthoTop=18*390/844;camera.orthoBottom=-camera.orthoTop;
   const light=new B.HemisphericLight('light',new B.Vector3(0,1,0),scene);light.intensity=1.5;
   const start=performance.now(),level=await (await fetch(version+'/level.json')).json();
   const asset=await B.SceneLoader.ImportMeshAsync(null,version+'/','level.glb',scene,undefined,'.glb');
   const levelLoadMs=performance.now()-start;
   const floor=asset.meshes.find(m=>m.name==='walkable_visual');
   if(!floor)throw Error('Missing floor');
   floor.computeWorldMatrix(true);const box=floor.getBoundingInfo().boundingBox;
   const bounds={min:box.minimumWorld.asArray(),max:box.maximumWorld.asArray()};
   const markerMeshes=level.markers.map(m=>{
    const mesh=B.MeshBuilder.CreateSphere(m.id,{diameter:.6,segments:12},scene);
    mesh.position.copyFrom(B.Vector3.FromArray(m.position).add(new B.Vector3(0,.35,0)));
    const material=new B.StandardMaterial(m.id+'-material',scene);material.emissiveColor=m.role==='exit'?new B.Color3(.3,1,.4):new B.Color3(.9,.65,.2);mesh.material=material;return mesh;
   });
   const heroStart=performance.now();const hero=await B.SceneLoader.ImportMeshAsync(null,'hero/','ren.glb',scene,undefined,'.glb');
   const heroLoadMs=performance.now()-heroStart;
   const clips=hero.animationGroups.map(g=>g.name),idle=hero.animationGroups.find(g=>g.name==='Idle_4'),run=hero.animationGroups.find(g=>g.name==='Running');
   if(!idle||!run)throw Error('Required existing hero clips missing: '+clips.join(','));
   hero.animationGroups.forEach(g=>g.stop());
   const root=hero.meshes[0];root.computeWorldMatrix(true);
   const b=root.getHierarchyBoundingVectors(true),h=b.max.y-b.min.y;if(!Number.isFinite(h)||h<=0)throw Error('invalid hero height');
   const holder=new B.TransformNode('hero-holder',scene);root.parent=holder;holder.scaling.setAll(1.7/h);holder.position.set(-6,-b.min.y*1.7/h,0);
   idle.start(true);engine.runRenderLoop(()=>scene.render());await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   idle.stop();run.start(true);await new Promise(r=>setTimeout(r,200));
   const running=run.isPlaying;run.stop();idle.start(true);
   await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
   window.disposeLab=()=>{engine.stopRenderLoop();scene.dispose();engine.dispose();return B.EngineStore.Instances.length;};
   return {version,bounds,levelLoadMs,heroLoadMs,heroClips:clips,running,meshes:scene.meshes.length,base,markers:level.markers,markerCount:markerMeshes.length};
  },version);
  for(const [key,expected] of [['min',[-8,0,-6]],['max',[24,2,6]]])for(let i=0;i<3;i++)assert(Math.abs(result.bounds[key][i]-expected[i])<.001,'GLB coordinate mismatch '+JSON.stringify(result.bounds));
  assert.equal(result.markerCount,4);assert(result.running);
  await page.screenshot({path:out+'/captures/'+name+'-'+version+'.png'});
  result.afterClose=await page.evaluate(()=>window.disposeLab());assert.equal(result.afterClose,result.base);
  evidence.push({browser:name,...result});console.log(JSON.stringify({browser:name,...result}));
 }
 assert.deepEqual(pageErrors,[]);await page.close();
 }catch(e){errors.push({browser:name,error:String(e)});}
 finally{await browser?.close();}
}
server.close();await writeFile(out+'/browser-report.json',JSON.stringify({evidence,errors,scope:'neutral GLB and existing Ren clip import; no gait or visual acceptance; local HTTP load timings, not iPhone'},null,2));
if(errors.length||evidence.length!==4){console.error(errors);process.exitCode=1;}
