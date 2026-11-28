import { chromium, webkit } from 'playwright';
import { createServer } from 'node:http';
import { readFile,mkdir,writeFile } from 'node:fs/promises';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const [rootArg,glbArg,manifestArg,outArg]=process.argv.slice(2);
if(!outArg)throw Error('Usage: runner.mjs REPO GLB MANIFEST OUTPUT');
const root=resolve(rootArg),out=resolve(outArg),here=dirname(fileURLToPath(import.meta.url));
await mkdir(out,{recursive:true});
const manifest=JSON.parse(await readFile(manifestArg,'utf8')),bytes=await readFile(glbArg);
const sha=createHash('sha256').update(bytes).digest('hex');
assert.equal(sha,manifest.sha256,'INPUT: wrong hash');assert.equal(bytes.toString('ascii',0,4),'glTF');assert.equal(bytes.readUInt32LE(4),2);assert.equal(bytes.readUInt32LE(8),bytes.length);
if(manifest.bytes!=null)assert.equal(bytes.length,manifest.bytes);manifest.bytes=bytes.length;
assert(Array.isArray(manifest.views)&&manifest.views.length&&manifest.views.every(v=>v.id&&v.target?.length===3&&v.offset?.length===3&&[...v.target,...v.offset,v.span].every(Number.isFinite)&&v.span>0));
const files=new Map([['/',[await readFile(resolve(here,'index.html')),'text/html']],['/viewer.js',[await readFile(resolve(here,'viewer.js')),'text/javascript']],['/babylon.js',[await readFile(resolve(root,'preview/map-3d/babylon.js')),'text/javascript']],['/loader.js',[await readFile(resolve(root,'preview/map-3d/babylonjs.loaders.min.js')),'text/javascript']],['/map.glb',[bytes,'model/gltf-binary']],['/manifest.json',[JSON.stringify(manifest),'application/json']],['/probe',['<!doctype html><canvas></canvas>','text/html']]]);
const server=createServer((req,res)=>{const entry=files.get(new URL(req.url,'http://127.0.0.1').pathname);if(!entry){res.writeHead(404);res.end();return;}res.setHeader('content-type',entry[1]);res.end(entry[0]);});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
const results=[],errors=[];const percentile=(a,p)=>{const b=[...a].sort((x,y)=>x-y);return b[Math.min(b.length-1,Math.floor(b.length*p))]??null;};
try{for(const [name,driver] of [['chromium',chromium],['webkit',webkit]]){let browser;try{
browser=await driver.launch(name==='chromium'?{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{});const probe=await browser.newPage();await probe.goto(url+'/probe');const ok=await probe.evaluate(()=>!!document.querySelector('canvas').getContext('webgl2'));await probe.close();if(!ok)throw Error('ENVIRONMENT_BLOCKED: blank WebGL2 unavailable');
for(const [width,height] of [[844,390],[844,320]]){const label=name+'-'+width+'x'+height,page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true,deviceScaleFactor:1}),errs=[];
const snap=()=>page.evaluate(()=>window.qa?.snapshot());
page.on('pageerror',e=>errs.push(String(e)));page.on('console',m=>{if(m.type()==='error')errs.push(m.text());});
try{
await page.goto(url);await page.waitForFunction(()=>window.qa?.snapshot().ready||window.qa?.snapshot().error,{},{timeout:60000});
const initial=await snap();assert(initial.ready,JSON.stringify(initial));assert.equal(initial.engines,1);
for(const v of manifest.views){const before=(await snap()).frames;const button=page.locator('[data-view='+JSON.stringify(v.id)+']');const b=await button.boundingBox();assert(b&&b.x>=0&&b.y>=0&&b.x+b.width<=width&&b.y+b.height<=height);await button.tap();await page.waitForFunction(([id,f])=>window.qa.snapshot().active===id&&window.qa.snapshot().frames>f+2,[v.id,before]);
const spread=await page.evaluate(()=>{const c=document.querySelector('canvas'),g=c.getContext('webgl2')||c.getContext('webgl');if(!g)return 0;const p=new Uint8Array(4),colors=new Set();for(let x=1;x<10;x++)for(let y=1;y<10;y++){g.readPixels(Math.floor(c.width*x/10),Math.floor(c.height*y/10),1,1,g.RGBA,g.UNSIGNED_BYTE,p);colors.add(p[0]+','+p[1]+','+p[2]);}return colors.size;});assert(spread>2,'Blank or uniform sampled canvas '+v.id);
await page.screenshot({path:resolve(out,label+'-'+v.id+'.png')});}
assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));const s=await snap();assert.deepEqual(errs,[]);await page.evaluate(()=>window.qa.close());assert.equal((await snap()).engines,0);
await page.reload();await page.waitForFunction(()=>window.qa?.snapshot().ready||window.qa?.snapshot().error,{},{timeout:60000});assert((await snap()).ready);await page.evaluate(()=>window.qa.close());assert.equal((await snap()).engines,0);assert.deepEqual(errs,[]);
results.push({label,passed:true,initial,final:s,frameMedianMs:percentile(s.frameMs,.5),frameP95Ms:percentile(s.frameMs,.95)});
}catch(e){errors.push({label,error:String(e),snapshot:await snap().catch(()=>null),pageErrors:errs});await page.screenshot({path:resolve(out,label+'-failure.png')}).catch(()=>{});}finally{await page.close();}
}
}catch(e){errors.push({name,error:String(e)});}finally{await browser?.close();}}}finally{server.close();await writeFile(resolve(out,'report.json'),JSON.stringify({scope:'Art import/render only; not movement or physical device',manifest,results,errors},null,2));}
if(errors.length||results.length!==4)process.exitCode=1;