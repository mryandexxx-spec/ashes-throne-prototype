import { chromium,webkit } from 'playwright';
import {createServer} from 'node:http';import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';import {resolve,extname,sep} from 'node:path';
const site=resolve(process.argv[2]),out=resolve(process.argv[3]);await mkdir(out,{recursive:true});
const mime={'.html':'text/html','.js':'application/javascript','.json':'application/json','.glb':'model/gltf-binary'};
const server=createServer(async(req,res)=>{try{const p=resolve(site,'.'+(req.url==='/'?'/index.html':decodeURIComponent(req.url.split('?')[0])));if(!p.startsWith(site+sep))throw Error('path');const b=await readFile(p);res.writeHead(200,{'content-type':mime[extname(p)]||'application/octet-stream'});res.end(b)}catch(e){res.writeHead(404);res.end('not found')}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
const results=[];
try{for(const [name,type] of [['chromium',chromium],['webkit',webkit]]){
 let browser;try{
 browser=await type.launch({headless:true,...(name==='chromium'?{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}: {})});
 for(const [width,height] of [[844,390],[932,430],[844,320]]){
 const row={browser:name,viewport:[width,height],state:'FAIL',errors:[]};results.push(row);
 const page=await browser.newPage({viewport:{width,height},deviceScaleFactor:1,hasTouch:true});page.on('pageerror',e=>row.errors.push(String(e)));
 try{await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForFunction(()=>window.pilot!==undefined,{},{timeout:120000});row.report=await page.evaluate(()=>window.pilot);if(!row.report.ready||row.errors.length)throw Error(JSON.stringify(row.report));if(row.report.heroScreen.some((v,i)=>!Number.isFinite(v)||v<0||v>row.report.renderSize[i]))throw Error('Hero off-screen');
 await page.screenshot({path:out+'/'+name+'-'+width+'x'+height+'.png',timeout:60000});row.state='PASS'}catch(e){row.error=String(e);await page.screenshot({path:out+'/'+name+'-'+width+'x'+height+'-failure.png',timeout:10000}).catch(()=>{})}finally{await page.close();await writeFile(out+'/browser-review.json',JSON.stringify(results,null,2))}
 }
 }catch(e){results.push({browser:name,state:'FAIL',error:String(e)})}finally{await browser?.close()}
}}finally{server.close();await writeFile(out+'/browser-review.json',JSON.stringify(results,null,2))}
if(results.length!==6||results.some(r=>r.state!=='PASS'))process.exitCode=1;
