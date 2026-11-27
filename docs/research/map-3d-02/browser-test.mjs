// Real touches, imported hero, exported level and prebaked mesh. No mocks.
import {chromium,webkit} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile,stat} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('site'),out=resolve('evidence');await mkdir(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.wasm':'application/wasm'};
let requests=[];
const server=createServer(async(req,res)=>{try{const p=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+'/'))throw Error('outside site');const data=await readFile(p);res.setHeader('content-type',mime[extname(p)]||'application/octet-stream');res.setHeader('content-length',data.length);res.setHeader('cache-control','public, max-age=3600');requests.push({path:new URL(req.url,'http://localhost').pathname,bytes:data.length});res.end(data);}catch{res.statusCode=404;res.end('not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/index.html';
const results=[],errors=[];const network=()=>({requests:requests.length,bodyBytes:requests.reduce((n,r)=>n+r.bytes,0),files:[...requests]});const dist=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));
const pct=(a,p)=>{const s=[...a].sort((a,b)=>a-b);return s[Math.min(s.length-1,Math.ceil(s.length*p)-1)];};
for(const [name,driver] of [['chromium',chromium],['webkit',webkit]]){
 let browser;
 try{
 browser=await driver.launch(name==='chromium'?{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{}); 
 for(const [width,height] of [[844,390],[932,430],[844,320]]){
 const label=name+'-'+width+'x'+height,video=width===844&&height===390,page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true,deviceScaleFactor:1,...(video?{recordVideo:{dir:out+'/video',size:{width,height}}}:{})});
 const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
 try{
 const snap=()=>page.evaluate(()=>window.lab.snapshot()),wait=(f,a)=>page.waitForFunction(f,a,{timeout:30000});
 const shot=async n=>{await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await page.screenshot({path:out+'/'+label+'-'+n+'.png'});};
 const tap=async(target)=>{
  const p=await page.evaluate(t=>window.lab.project(t),target),before=await snap();
  assert(p.x>=0&&p.x<width&&p.y>=0&&p.y<height,'outside viewport '+JSON.stringify(p));
  await page.touchscreen.tap(p.x,p.y);await wait(n=>window.lab.snapshot().commands>n,before.commands);return snap();
 };
 const arrive=async(target)=>{await wait(()=>!window.lab.snapshot().walking);const end=await snap();assert(dist(end.pos,target)<.75,'arrival '+JSON.stringify(end.pos));assert.equal(end.unsafe,0);assert.equal(end.clip,'Idle_4');assert(end.clipPlaying);return end;};
 requests=[];await page.goto(url);await wait(()=>window.lab?.snapshot().ready===true);const initial=await snap(),cold=network(),inventory=await page.evaluate(()=>window.lab.resourceInventory());assert.equal(initial.engines,1);assert.equal(initial.clip,'Idle_4');
 await page.locator('#overview').tap();await shot('overview');
 let s=await tap([6,0,0]);assert(s.last.accepted);assert.equal(s.clip,'Walking');assert(s.clipPlaying);
 await wait(()=>window.lab.snapshot().walking&&window.lab.snapshot().pos[0]>-4.9);await shot('walk');
 s=await tap([-4,0,4]);assert(s.last.accepted);s=await arrive([-4,0,4]);assert(s.visited.includes('lab.branch.n'));assert.equal(s.arrivals,1);
 await page.locator('#pace').tap();
 s=await tap([15,2,0]);assert(s.last.accepted);assert.equal(s.clip,'Running');assert(s.clipPlaying);
 await wait(()=>window.lab.snapshot().walking&&window.lab.snapshot().pos[0]>9);await shot('ramp-run');
 s=await arrive([15,2,0]);assert(s.visited.includes('lab.exit'));
 s=await tap([22,2,0]);assert.equal(s.last.accepted,false);assert.equal(s.walking,false);
 s=await tap([-6,0,0]);assert(s.last.accepted);await wait(()=>window.lab.snapshot().walking);
 s=await tap([0,0,0]);assert.equal(s.last.accepted,false);assert.equal(s.walking,false);const stopped=s.pos;
 await page.waitForTimeout(150);assert.deepEqual((await snap()).pos,stopped);
 await page.locator('#overview').tap();await wait(()=>{const s=window.lab.snapshot();return s.heroScreen.x>innerWidth*.35&&s.heroScreen.x<innerWidth*.65&&s.heroScreen.y>innerHeight*.25&&s.heroScreen.y<innerHeight*.75;});await shot('follow');
 const end=await snap();assert(end.events.some(e=>e.type==='clip'&&e.name==='Walking'));assert(end.events.some(e=>e.type==='clip'&&e.name==='Running'));assert.equal(end.unsafe,0);
 const cycles=[];for(let i=0;i<2;i++){requests=[];await page.locator('#restart').tap();await wait(()=>window.lab.snapshot().ready===true);const x=await snap();assert.equal(x.engines,1);assert.equal(x.meshes,initial.meshes);assert.equal(x.textures,initial.textures);assert.deepEqual(x.pos,initial.pos);assert.equal(x.visited.length,0);cycles.push({metrics:x.metrics,network:network()});}
 assert.equal(await page.evaluate(()=>window.lab.close()),0);assert.equal(await page.evaluate(()=>window.lab.resourceInventory()),null);
 const heap=[];let warmReload=null;
 if(video){
  const cdp=name==='chromium'?await page.context().newCDPSession(page):null;
  const sample=async phase=>{if(cdp){await cdp.send('HeapProfiler.collectGarbage');heap.push({phase,...await cdp.send('Runtime.getHeapUsage')});}};
  await sample('closed-baseline');requests=[];await page.reload();await wait(()=>window.lab?.snapshot().ready===true);warmReload={network:network(),metrics:(await snap()).metrics};await sample('warm-open');await page.evaluate(()=>window.lab.close());await sample('warm-closed');
  for(let i=0;i<3;i++){await page.evaluate(()=>window.lab.open());await wait(()=>window.lab.snapshot().ready);assert.equal((await snap()).meshes,initial.meshes);assert.equal(await page.evaluate(()=>window.lab.close()),0);await sample('closed-'+i);}
  await cdp?.detach();
 }
 assert.deepEqual(pageErrors,[]);
 const entry={label,initial:initial.metrics,cold,cycles,warmReload,heap,inventory,routeCosts:{median:pct(end.routeCosts,.5),p95:pct(end.routeCosts,.95)},updateCosts:{median:pct(end.updateCosts,.5),p95:pct(end.updateCosts,.95)},frames:{count:end.frames.length,median:pct(end.frames,.5),p95:pct(end.frames,.95)},events:end.events,meshes:initial.meshes,textures:initial.textures,passed:true};results.push(entry);console.log(JSON.stringify(entry));
 }catch(e){errors.push({label,error:String(e),pageErrors});await page.screenshot({path:out+'/'+label+'-failure.png'}).catch(()=>{});}
 finally{const v=page.video();await page.close();if(v)await v.saveAs(out+'/'+label+'-route.webm');}
 }
 }catch(e){errors.push({name,error:String(e)});}
 finally{await browser?.close();}
}
server.close();await writeFile(out+'/report.json',JSON.stringify({results,errors,scope:'local HTTP, headless WebGL; local server response body bytes, Chromium post-GC JS heap only, no physical iPhone/GPU memory or final gait/art acceptance'},null,2));
console.log(JSON.stringify({passed:results.length,errors}));if(errors.length||results.length!==6)process.exitCode=1;
