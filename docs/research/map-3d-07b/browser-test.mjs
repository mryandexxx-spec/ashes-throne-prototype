import {chromium,webkit} from 'playwright';
import {createServer} from 'node:http';import {readFile,mkdir,writeFile} from 'node:fs/promises';import {resolve,extname} from 'node:path';import assert from 'node:assert/strict';
const root=resolve(process.argv[2]||'.'),out=resolve(process.argv[3]||'evidence');await mkdir(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.wasm':'application/wasm','.txt':'text/plain'};
const server=createServer(async(req,res)=>{try{let pathname=new URL(req.url,'http://localhost').pathname;if(pathname.endsWith('/'))pathname+='index.html';const p=resolve(root,'.'+pathname);if(!p.startsWith(root+'/'))throw Error('outside site');const data=await readFile(p);res.setHeader('content-type',mime[extname(p)]||'application/octet-stream');res.end(data);}catch{res.statusCode=404;res.end('not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/preview/map-3d-07b/';
const results=[],errors=[];
for(const [name,driver,branch] of [['chromium',chromium,'p03'],['webkit',webkit,'p05']]){
 let browser;
 try{browser=await driver.launch(name==='chromium'?{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{});for(const [width,height] of [[844,390],[844,320]]){
 const label=name+'-'+width+'x'+height,page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true,deviceScaleFactor:1});
 const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
 try{
 const snap=()=>page.evaluate(()=>window.lab.snapshot()),wait=(f,a)=>page.waitForFunction(f,a,{timeout:90000});
 await page.goto(url);await wait(()=>window.lab?.snapshot().ready===true);const initial=await snap();assert.equal(initial.engines,1);
 const waypoints=await page.evaluate(()=>window.lab.waypoints());assert.equal(waypoints.length,13);
 assert.equal(await page.locator('#build').textContent(),'MAP-3D · 07B');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));
 await page.screenshot({path:out+'/'+label+'-arrival.png'});
 // Actual terrain touch, not a debug teleport.
 const target=await page.evaluate(()=>{for(const x of [-39.5,-40,-41,-38.5]){const pt=window.lab.project([x,0,.4]);if(document.elementFromPoint(pt.x,pt.y)?.tagName==='CANVAS'&&window.lab.pickDestination(pt.x,pt.y))return pt;}return null;});
 assert(target,'walkable ground visible from spawn');
 await page.touchscreen.tap(target.x,target.y);await wait(n=>window.lab.snapshot().commands>n,initial.commands);
 assert((await snap()).last.accepted);await wait(()=>!window.lab.snapshot().walking);assert.equal((await snap()).unsafe,0);
 await page.locator('#overview').tap();await wait(()=>window.lab.snapshot().cameraSettled);
 await page.screenshot({path:out+'/'+label+'-overview.png'});
 await page.locator('#pace').tap();
 async function go(id){const p=waypoints.find(m=>m.id===id).position,before=await snap();
  const button=page.locator('[data-waypoint="'+id+'"]');assert(await button.isVisible(),id+' marker invisible');
  await button.tap();await wait(n=>window.lab.snapshot().commands>n,before.commands);
  const commanded=await snap();assert(commanded.last.accepted,JSON.stringify(commanded.last));await wait(()=>!window.lab.snapshot().walking);
  const end=await snap();assert(Math.hypot(...end.pos.map((v,i)=>v-p[i]))<.75,JSON.stringify(end.pos));assert.equal(end.unsafe,0);assert.equal(end.clip,'Idle_4');
 }
 await go('fork');await go(branch);await go(branch==='p03'?'p04':'p06');await go('p07');await go('p08');await go('p09');await go('exit');
 await page.locator('#overview').tap();await wait(()=>window.lab.snapshot().cameraSettled);
 await page.screenshot({path:out+'/'+label+'-branch.png'});
 const metrics=await page.evaluate(()=>window.lab.resourceInventory());
 await page.locator('#restart').tap();await wait(()=>window.lab.snapshot().ready===true);const reset=await snap();assert.deepEqual(reset.pos,initial.pos);assert.equal(reset.engines,1);
 assert.equal(await page.evaluate(()=>window.lab.close()),0);assert.deepEqual(pageErrors,[]);
 results.push({label,passed:true,branch,metrics});console.log(label,'PASS');
 }catch(e){errors.push({label,error:String(e),pageErrors});await page.screenshot({path:out+'/'+label+'-failure.png'}).catch(()=>{});console.error(label,e);}finally{await page.close();}
 }}catch(e){errors.push({name,error:String(e)});}finally{await browser?.close();}
}
server.close();await writeFile(out+'/preview-report.json',JSON.stringify({results,errors,scope:'local actual WebGL and touch, not physical iPhone or live Pages'},null,2));if(errors.length||results.length!==4)process.exitCode=1;