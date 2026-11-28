import {chromium,webkit} from 'playwright';
import {createServer} from 'node:http';import {readFile,mkdir,writeFile} from 'node:fs/promises';import {resolve,extname} from 'node:path';import assert from 'node:assert/strict';
const root=resolve(process.argv[2]),out=resolve(process.argv[3]);await mkdir(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.glb':'model/gltf-binary'};
const server=createServer(async(req,res)=>{try{let pathname=new URL(req.url,'http://localhost').pathname;if(pathname.endsWith('/'))pathname+='index.html';const file=resolve(root,'.'+pathname);if(!file.startsWith(root+'/'))throw Error('outside');res.setHeader('content-type',mime[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.statusCode=404;res.end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/preview/map-3d-07b-spatial/';
const results=[],errors=[];
for(const [name,driver] of [['chromium',chromium],['webkit',webkit]]){
 let browser;try{browser=await driver.launch(name==='chromium'?{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{});for(const [width,height] of [[844,390],[844,320]]){
 const label=name+'-'+width+'x'+height,page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true,deviceScaleFactor:1});const errs=[];page.on('pageerror',e=>errs.push(String(e)));
 try{await page.goto(url);await page.waitForFunction(()=>window.spatialReview?.snapshot().ready,{},{timeout:60000});
 const read=()=>page.evaluate(()=>window.spatialReview.snapshot()),initial=await read();assert.equal(initial.triangles,2464);assert.equal(initial.engines,1);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));
 for(const key of ['overview','upper','work','garden','east']){const el=page.locator('[data-view="'+key+'"]');const bounds=await el.boundingBox();assert(bounds&&bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width&&bounds.y+bounds.height<=height);const before=(await read()).frames;await el.tap();await page.waitForFunction(([k,f])=>{const s=window.spatialReview.snapshot();return s.active===k&&s.frames>f},[key,before]);await page.screenshot({path:out+'/'+label+'-'+key+'.png'});}
 const before=await read();await page.mouse.move(width*.5,height*.45);await page.mouse.down();await page.mouse.move(width*.65,height*.48,{steps:10});await page.mouse.up();await page.waitForFunction(a=>Math.abs(window.spatialReview.snapshot().alpha-a)>.03,before.alpha,{timeout:10000});
 assert.deepEqual(errs,[]);await page.evaluate(()=>window.spatialReview.close());assert.equal((await read()).engines,0);results.push({label,passed:true,initial});
 }catch(e){errors.push({label,error:String(e),pageErrors:errs});await page.screenshot({path:out+'/'+label+'-failure.png'}).catch(()=>{});}finally{await page.close();}
 }}catch(e){errors.push({name,error:String(e)});}finally{await browser?.close();}
}
server.close();await writeFile(out+'/report.json',JSON.stringify({results,errors,scope:'Local WebGL viewer only, not playability or physical iPhone'},null,2));if(errors.length||results.length!==4)process.exitCode=1;