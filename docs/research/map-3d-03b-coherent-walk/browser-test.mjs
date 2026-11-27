import {chromium,webkit} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('site'),out=resolve('evidence');await mkdir(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.wasm':'application/wasm'};
const server=createServer(async(req,res)=>{try{const p=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+'/'))throw Error('outside site');const data=await readFile(p);res.setHeader('content-type',mime[extname(p)]||'application/octet-stream');res.end(data);}catch{res.statusCode=404;res.end('not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/index.html';
const results=[],errors=[];const dist=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
const spawn=[-3.8,0,1.55],direct=[.2,0,1.7],court=[-2,0,-6.6],exit=[5.3,0,.9];
for(const [name,driver] of [['chromium',chromium],['webkit',webkit]]){
 let browser;
 try{
 browser=await driver.launch(name==='chromium'?{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{}); 
 for(const [width,height] of [[844,390],[932,430],[844,320]]){
 const label=name+'-'+width+'x'+height,video=width===844&&height===390,page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true,deviceScaleFactor:1,...(video?{recordVideo:{dir:out+'/video',size:{width,height}}}:{})});
 const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
 try{
 const snap=()=>page.evaluate(()=>window.lab.snapshot()),wait=(f,a)=>page.waitForFunction(f,a,{timeout:35000});
 const shot=async n=>{await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:out+'/'+label+'-'+n+'.png'});};
 const tap=async(target)=>{
  const p=await page.evaluate(t=>window.lab.project(t),target),before=await snap();
  assert(p.x>=0&&p.x<width&&p.y>=0&&p.y<height,'outside viewport '+JSON.stringify(p));
  await page.touchscreen.tap(p.x,p.y);await wait(n=>window.lab.snapshot().commands>n,before.commands);return snap();
 };
 const arrive=async(target)=>{await wait(()=>!window.lab.snapshot().walking);const end=await snap();assert(dist(end.pos,target)<.75,'arrival '+JSON.stringify(end.pos));assert.equal(end.unsafe,0);assert.equal(end.clip,'Idle_4');assert(end.clipPlaying);return end;};
 await page.goto(url);await wait(()=>window.lab?.snapshot().ready===true);const initial=await snap();assert.equal(initial.engines,1);assert.equal(initial.clip,'Idle_4');
 await shot('follow-start');
 await page.locator('#overview').tap();await shot('overview');
 let s=await tap(direct);assert(s.last.accepted,JSON.stringify(s.last));assert.equal(s.clip,'Walking');await shot('walk-direct');s=await arrive(direct);assert(s.visited.includes('direct'));
 s=await tap(exit);assert(s.last.accepted,JSON.stringify(s.last));s=await arrive(exit);assert(s.visited.includes('exit'));
 await page.locator('#pace').tap();
 s=await tap(court);assert(s.last.accepted,JSON.stringify(s.last));assert.equal(s.clip,'Running');await shot('run-court');s=await arrive(court);assert(s.visited.includes('court'));
 // An arbitrary point outside the limited walkable patch must not start a walk.
 s=await tap([0,0,4.4]);assert(!s.last.accepted);assert(!s.walking);
 s=await tap(spawn);assert(s.last.accepted,JSON.stringify(s.last));await wait(()=>window.lab.snapshot().walking);
 s=await tap(direct);assert(s.last.accepted,JSON.stringify(s.last));s=await arrive(direct);
 await page.locator('#overview').tap();await wait(()=>{const s=window.lab.snapshot();return s.heroScreen.x>innerWidth*.35&&s.heroScreen.x<innerWidth*.65&&s.heroScreen.y>innerHeight*.25&&s.heroScreen.y<innerHeight*.75;});await shot('follow-end');
 const end=await snap();assert.equal(end.unsafe,0);assert(end.visited.includes('court'));assert(end.visited.includes('direct'));assert(end.visited.includes('exit'));
 const cycles=[];for(let i=0;i<2;i++){await page.locator('#restart').tap();await wait(()=>window.lab.snapshot().ready===true);const x=await snap();assert.equal(x.engines,1);assert.equal(x.meshes,initial.meshes);assert.equal(x.textures,initial.textures);assert.deepEqual(x.pos,initial.pos);assert.equal(x.visited.length,0);cycles.push(x.metrics);}
 assert.equal(await page.evaluate(()=>window.lab.close()),0);assert.deepEqual(pageErrors,[]);
 results.push({label,passed:true,initial:initial.metrics,cycles,events:end.events,frames:end.frames,routeCosts:end.routeCosts,meshes:initial.meshes,textures:initial.textures,unsafe:end.unsafe,arrivals:end.arrivals,visited:end.visited});console.log(label,'PASS');
 }catch(e){errors.push({label,error:String(e),pageErrors});await page.screenshot({path:out+'/'+label+'-failure.png'}).catch(()=>{});console.error(label,e);}
 finally{const v=page.video();await page.close();if(v)await v.saveAs(out+'/'+label+'-route.webm');}
 }
 }catch(e){errors.push({name,error:String(e)});}finally{await browser?.close();}
}
server.close();await writeFile(out+'/report.json',JSON.stringify({results,errors,scope:'headless local Chromium/WebKit, research movement only; no physical iPhone or final artistic acceptance'},null,2));if(errors.length||results.length!==6)process.exitCode=1;
