import {chromium,webkit} from 'playwright';
import {createServer} from 'node:http';import {readFile,mkdir,writeFile} from 'node:fs/promises';import {resolve,extname} from 'node:path';import assert from 'node:assert/strict';
const root=resolve(process.argv[2]||'.'),out=resolve(process.argv[3]||'evidence');await mkdir(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.wasm':'application/wasm','.txt':'text/plain'};
const server=createServer(async(req,res)=>{try{let pathname=new URL(req.url,'http://localhost').pathname;if(pathname.endsWith('/'))pathname+='index.html';const p=resolve(root,'.'+pathname);if(!p.startsWith(root+'/'))throw Error('outside site');const data=await readFile(p);res.setHeader('content-type',mime[extname(p)]||'application/octet-stream');res.end(data);}catch{res.statusCode=404;res.end('not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/preview/map-3d-04/';
const results=[],errors=[];const target=[.2,0,1.7],court=[-2,0,-6.6],spawn=[-3.8,0,1.55];
for(const [name,driver] of [['chromium',chromium],['webkit',webkit]]){let browser;
try{browser=await driver.launch(name==='chromium'?{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{});for(const [width,height] of [[844,390],[932,430],[844,320]]){const label=name+'-'+width+'x'+height,page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true,deviceScaleFactor:1,...(name==='webkit'&&width===932?{recordVideo:{dir:out,size:{width,height}}}:{})});const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
try{const snap=()=>page.evaluate(()=>window.lab.snapshot()),wait=(f,a)=>page.waitForFunction(f,a,{timeout:35000});
await page.goto(url);await wait(()=>window.lab?.snapshot().ready===true);const initial=await snap();assert.deepEqual(initial.quality,{shadows:true,scale:1});assert.equal(initial.engines,1);
await wait(()=>document.querySelector('#fps').textContent.includes(' FPS'));assert.equal(await page.locator('#build').textContent(),'MAP-3D · MOVE-04A');
const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight);assert(!overflow);
for(const id of ['overview','pace','stop','restart','shadows','resolution']){const b=await page.locator('#'+id).boundingBox();assert(b&&b.x>=0&&b.y>=0&&b.x+b.width<=width&&b.y+b.height<=height,id);}
await page.screenshot({path:out+'/'+label+'-baseline.png'});
await page.locator('#shadows').tap();assert.equal((await snap()).quality.shadows,false);await page.locator('#resolution').tap();assert.equal((await snap()).quality.scale,1.5);assert.deepEqual((await snap()).pos,initial.pos);
const low=await page.evaluate(()=>window.lab.resourceInventory());assert(low.renderSize[0]<width);
await page.locator('#overview').tap();await wait(()=>window.lab.snapshot().cameraSettled);
async function tap(p){const pt=await page.evaluate(p=>window.lab.project(p),p),before=await snap();assert(pt.x>=0&&pt.x<width&&pt.y>=0&&pt.y<height,JSON.stringify(pt));await page.touchscreen.tap(pt.x,pt.y);await wait(n=>window.lab.snapshot().commands>n,before.commands);const s=await snap();assert(s.last.accepted,JSON.stringify(s.last));await wait(()=>!window.lab.snapshot().walking);const end=await snap();assert(Math.hypot(...end.pos.map((v,i)=>v-p[i]))<.75);assert.equal(end.unsafe,0);assert.equal(end.clip,'Idle_4');}
await tap(target);
await page.locator('#resolution').tap();await page.locator('#shadows').tap();assert.deepEqual((await snap()).quality,{shadows:true,scale:1});assert.equal((await snap()).engines,1);
await page.locator('#pace').tap();await tap(court);
await page.screenshot({path:out+'/'+label+'-court.png'});
 // Exercise real touch retarget, invalid target preservation and explicit stop.
 const command=async p=>{const before=await snap(),pt=await page.evaluate(p=>window.lab.project(p),p);await page.touchscreen.tap(pt.x,pt.y);await wait(n=>window.lab.snapshot().commands>n,before.commands);return snap();};
 await page.locator('#pace').tap();
 let a=await command(spawn);assert(a.last.accepted&&a.walking);
 const starts=a.events.filter(e=>e.type==='clip').length;
 a=await command(target);assert(a.last.accepted&&a.walking);assert.equal(a.events.filter(e=>e.type==='clip').length,starts,'retarget restarted animation');
 const invalid=await page.evaluate(()=>{for(let y=80;y<innerHeight-85;y+=20)for(let x=10;x<innerWidth-10;x+=20)if(document.elementFromPoint(x,y)?.tagName==='CANVAS'&&!window.lab.pickDestination(x,y))return {x,y};return null;});
 assert(invalid,'invalid target visible');const pre=await snap();await page.touchscreen.tap(invalid.x,invalid.y);await wait(n=>window.lab.snapshot().commands>n,pre.commands);a=await snap();assert(!a.last.accepted&&a.walking,'blocked tap should not cancel current route');
 await page.locator('#stop').tap();a=await snap();assert(!a.walking&&a.clip==='Idle_4');assert(a.events.some(e=>e.type==='cancel'));const stopped=a.pos;
 // Synthetic multi-pointer/cancel covers gesture state machine, not physical pinch.
 const gestures=async kind=>page.evaluate(kind=>{const c=document.querySelector('canvas'),x=innerWidth/2,y=innerHeight/2;const ev=(type,id,dx)=>c.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:x+dx,clientY:y,bubbles:true,button:0}));ev('pointerdown',101,-25);if(kind==='pinch'){ev('pointerdown',102,25);ev('pointermove',102,75);ev('pointerup',102,75);ev('pointerup',101,-25);}else{ev('pointercancel',101,-25);ev('pointerup',101,-25);}},kind);
 const n=a.commands;await gestures('pinch');await gestures('cancel');a=await snap();assert.equal(a.commands,n);assert.equal(a.pointers,0);assert.deepEqual(a.pos,stopped);
 await page.locator('#overview').tap();await wait(()=>window.lab.snapshot().cameraSettled);
 const z=(await snap()).zoomGoal;await gestures('pinch');await wait(v=>window.lab.snapshot().zoomGoal<v,z);assert.equal((await snap()).commands,n);await page.locator('#overview').tap();await wait(()=>window.lab.snapshot().cameraSettled);
 // Synthetic persisted page lifecycle exercises handlers and first-frame delta reset.
 await page.evaluate(()=>{window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));});assert.equal((await snap()).engines,1);
 await tap(spawn);await tap(court);
 await page.screenshot({path:out+'/'+label+'-04.png'});

for(let i=0;i<2;i++){await page.locator('#restart').tap();await wait(()=>window.lab.snapshot().ready===true);const s=await snap();assert.deepEqual(s.pos,spawn);assert.equal(s.engines,1);assert.equal(s.meshes,initial.meshes);assert.equal(s.textures,initial.textures);}
assert.equal(await page.evaluate(()=>window.lab.close()),0);assert.deepEqual(pageErrors,[]);
const credits=await page.request.get(url+'../map-3d/level/ATTRIBUTION.txt');assert(credits.ok());assert((await credits.text()).includes('Wildfire Games'));
results.push({label,passed:true,lowRenderSize:low.renderSize});console.log(label,'PASS');
}catch(e){errors.push({label,error:String(e),pageErrors});await page.screenshot({path:out+'/'+label+'-failure.png'}).catch(()=>{});console.error(label,e);}finally{await page.close();}}}catch(e){errors.push({name,error:String(e)});}finally{await browser?.close();}}
server.close();await writeFile(out+'/preview-report.json',JSON.stringify({results,errors,scope:'public-path simulation local Chromium/WebKit, not physical iPhone or live Pages'},null,2));if(errors.length||results.length!==6)process.exitCode=1;