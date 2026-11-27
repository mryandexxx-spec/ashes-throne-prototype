// Diagnostic only. Do not select or adopt a visual downgrade on CI data alone.
import {chromium,webkit} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('site'),out=resolve('evidence');await mkdir(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.wasm':'application/wasm'};
const server=createServer(async(req,res)=>{try{const p=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+'/'))throw Error('outside site');const data=await readFile(p);res.setHeader('content-type',mime[extname(p)]||'application/octet-stream');res.end(data);}catch{res.statusCode=404;res.end('not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/index.html';
const results=[],errors=[];const target=[.2,0,1.7];
const stats=a=>{assert(a.length>0);const s=[...a].sort((a,b)=>a-b);return{n:s.length,p50:s[Math.floor(s.length/2)],p95:s[Math.ceil(.95*s.length)-1]};};
for(const [name,driver] of [['chromium',chromium],['webkit',webkit]]){
 let browser;
 try{
 browser=await driver.launch(name==='chromium'?{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{}); 
 for(const [round,order] of [[0,['baseline','no-shadows','scale']],[1,['scale','no-shadows','baseline']]]){
 for(const mode of order){
 const label=name+'-'+round+'-'+mode,page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1});
 const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
 try{
 const snap=()=>page.evaluate(()=>window.lab.snapshot()),wait=(f,a)=>page.waitForFunction(f,a,{timeout:45000});
 await page.goto(url+'?profile='+mode);await wait(()=>window.lab?.snapshot().ready===true);
 await wait(()=>window.lab.snapshot().frames.length>=12);
 const start=await snap();await wait(n=>window.lab.snapshot().frames.length>=n+30,start.frames.length);
 const idle=await snap();const measure=(a,b)=>({frameMs:stats(b.frames.slice(a.frames.length)),updateMs:stats(b.updateCosts.slice(a.updateCosts.length)),renderSubmitMs:stats(b.renderCosts.slice(a.renderCosts.length))});
 await page.screenshot({path:out+'/'+label+'.png'});
 const p=await page.evaluate(t=>window.lab.project(t),target),before=await snap();
 await page.touchscreen.tap(p.x,p.y);await wait(n=>window.lab.snapshot().commands>n,before.commands);const selected=await snap();assert(selected.last.accepted,JSON.stringify(selected.last));
 await wait(()=>!window.lab.snapshot().walking);const end=await snap();assert(Math.hypot(...end.pos.map((v,i)=>v-target[i]))<.75);assert.equal(end.unsafe,0);assert.equal(end.clip,'Idle_4');
 const inventory=await page.evaluate(()=>window.lab.resourceInventory());assert.equal(await page.evaluate(()=>window.lab.close()),0);assert.deepEqual(pageErrors,[]);
 results.push({label,mode,name,round,idle:measure(start,idle),walk:measure(before,end),routeCosts:end.routeCosts,inventory,readyMs:start.metrics.readyMs,unsafe:end.unsafe,arrival:end.pos});console.log(JSON.stringify(results.at(-1)));
 }catch(e){errors.push({label,error:String(e),pageErrors});await page.screenshot({path:out+'/'+label+'-failure.png'}).catch(()=>{});console.error(label,e);}
 finally{await page.close();}
 }}
 }catch(e){errors.push({name,error:String(e)});}finally{await browser?.close();}
}
server.close();await writeFile(out+'/profile.json',JSON.stringify({results,errors,scope:'same runner, local headless software WebGL, fixed scene and tap, 2 counterordered rounds each, CPU render submission not GPU timer, no physical iPhone, diagnostic flags not production candidates'},null,2));if(errors.length||results.length!==12)process.exitCode=1;
