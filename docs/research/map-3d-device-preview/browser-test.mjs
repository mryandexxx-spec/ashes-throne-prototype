import {chromium,webkit} from 'playwright';
import {createServer} from 'node:http';import {readFile,mkdir,writeFile} from 'node:fs/promises';import {resolve,extname} from 'node:path';import assert from 'node:assert/strict';
const root=resolve(process.argv[2]||'.'),out=resolve(process.argv[3]||'evidence');await mkdir(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.wasm':'application/wasm','.txt':'text/plain'};
const server=createServer(async(req,res)=>{try{let pathname=new URL(req.url,'http://localhost').pathname;if(pathname.endsWith('/'))pathname+='index.html';const p=resolve(root,'.'+pathname);if(!p.startsWith(root+'/'))throw Error('outside site');const data=await readFile(p);res.setHeader('content-type',mime[extname(p)]||'application/octet-stream');res.end(data);}catch{res.statusCode=404;res.end('not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/preview/map-3d/';
const results=[],errors=[];const target=[.2,0,1.7],court=[-2,0,-6.6],spawn=[-3.8,0,1.55];
for(const [name,driver] of [['chromium',chromium],['webkit',webkit]]){let browser;
try{browser=await driver.launch(name==='chromium'?{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{});for(const [width,height] of [[844,390],[932,430],[844,320]]){const label=name+'-'+width+'x'+height,page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true,deviceScaleFactor:1});const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
try{const snap=()=>page.evaluate(()=>window.lab.snapshot()),wait=(f,a)=>page.waitForFunction(f,a,{timeout:35000});
await page.goto(url);await wait(()=>window.lab?.snapshot().ready===true);const initial=await snap();assert.deepEqual(initial.quality,{shadows:true,scale:1});assert.equal(initial.engines,1);
await wait(()=>document.querySelector('#fps').textContent.includes(' FPS'));assert.equal(await page.locator('#build').textContent(),'MAP-3D · DEVICE-01');
const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight);assert(!overflow);
for(const id of ['overview','pace','restart','shadows','resolution']){const b=await page.locator('#'+id).boundingBox();assert(b&&b.x>=0&&b.y>=0&&b.x+b.width<=width&&b.y+b.height<=height,id);}
await page.screenshot({path:out+'/'+label+'-baseline.png'});
await page.locator('#shadows').tap();assert.equal((await snap()).quality.shadows,false);await page.locator('#resolution').tap();assert.equal((await snap()).quality.scale,1.5);assert.deepEqual((await snap()).pos,initial.pos);
const low=await page.evaluate(()=>window.lab.resourceInventory());assert(low.renderSize[0]<width);
await page.locator('#overview').tap();
async function tap(p){const pt=await page.evaluate(p=>window.lab.project(p),p),before=await snap();assert(pt.x>=0&&pt.x<width&&pt.y>=0&&pt.y<height,JSON.stringify(pt));await page.touchscreen.tap(pt.x,pt.y);await wait(n=>window.lab.snapshot().commands>n,before.commands);const s=await snap();assert(s.last.accepted,JSON.stringify(s.last));await wait(()=>!window.lab.snapshot().walking);const end=await snap();assert(Math.hypot(...end.pos.map((v,i)=>v-p[i]))<.75);assert.equal(end.unsafe,0);assert.equal(end.clip,'Idle_4');}
await tap(target);
await page.locator('#resolution').tap();await page.locator('#shadows').tap();assert.deepEqual((await snap()).quality,{shadows:true,scale:1});assert.equal((await snap()).engines,1);
await page.locator('#pace').tap();await tap(court);
await page.screenshot({path:out+'/'+label+'-court.png'});
for(let i=0;i<2;i++){await page.locator('#restart').tap();await wait(()=>window.lab.snapshot().ready===true);const s=await snap();assert.deepEqual(s.pos,spawn);assert.equal(s.engines,1);assert.equal(s.meshes,initial.meshes);assert.equal(s.textures,initial.textures);}
assert.equal(await page.evaluate(()=>window.lab.close()),0);assert.deepEqual(pageErrors,[]);
const credits=await page.request.get(url+'level/ATTRIBUTION.txt');assert(credits.ok());assert((await credits.text()).includes('Wildfire Games'));
results.push({label,passed:true,lowRenderSize:low.renderSize});console.log(label,'PASS');
}catch(e){errors.push({label,error:String(e),pageErrors});await page.screenshot({path:out+'/'+label+'-failure.png'}).catch(()=>{});console.error(label,e);}finally{await page.close();}}}catch(e){errors.push({name,error:String(e)});}finally{await browser?.close();}}
server.close();await writeFile(out+'/preview-report.json',JSON.stringify({results,errors,scope:'public-path simulation local Chromium/WebKit, not physical iPhone or live Pages'},null,2));if(errors.length||results.length!==6)process.exitCode=1;