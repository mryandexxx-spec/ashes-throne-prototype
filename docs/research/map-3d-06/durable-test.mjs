import {chromium,webkit} from 'playwright';
import {createServer} from 'node:http';import {readFile,mkdir,writeFile} from 'node:fs/promises';import {resolve,extname} from 'node:path';import assert from 'node:assert/strict';
const root=resolve(process.argv[2]||'.'),out=resolve(process.argv[3]||'evidence');await mkdir(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.glb':'model/gltf-binary','.wasm':'application/wasm','.txt':'text/plain','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
const server=createServer(async(req,res)=>{try{let pathname=new URL(req.url,'http://localhost').pathname;if(pathname.endsWith('/'))pathname+='index.html';const p=resolve(root,'.'+pathname);if(!p.startsWith(root+'/'))throw Error('outside site');res.setHeader('content-type',mime[extname(p)]||'application/octet-stream');res.end(await readFile(p));}catch{res.statusCode=404;res.end('not found');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/preview/map-3d-06/';
const results=[],errors=[],wait=(p,f,a)=>p.waitForFunction(f,a,{timeout:90000});
for(const [name,driver] of [['chromium',chromium],['webkit',webkit]]){
 let browser,ctx,page;const pe=[];
 try{
 browser=await driver.launch(name==='chromium'?{args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{});ctx=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:1,reducedMotion:'reduce'});
 const newPage=async()=>{const p=await ctx.newPage();p.on('pageerror',e=>pe.push(String(e)));return p;};
 page=await newPage();
 const durableUrl=url+'?durable=1',snap=()=>page.evaluate(()=>window.lab.snapshot()),ready=()=>wait(page,()=>window.lab?.snapshot().ready===true),tap=s=>page.locator(s).tap(),action=id=>tap('[data-action="'+id+'"]');
 const overview=async()=>{await tap('#overview');await wait(page,()=>window.lab.snapshot().cameraSettled);await tap('#pace');};
 async function go(id){const before=await snap();await tap('[data-poi="'+id+'"]');await wait(page,n=>window.lab.snapshot().commands>n,before.commands);await wait(page,()=>!window.lab.snapshot().walking);assert((await snap()).last.accepted);}
 async function reopen(){await page.close();page=await newPage();await page.goto(durableUrl);await ready();}
 async function route(){await overview();await go('direct');await action('inspect');await go('exit');await action('challenge');}
 async function enter(){await action('fight');await page.locator('#squad.active').waitFor({timeout:90000});await wait(page,()=>mainCampaignCanLaunch(MainCampaignCore.ID));}
 async function choose(ids){await tap('#squadDisband');for(const id of ids)await tap('#squadRoster [data-hero-id="'+id+'"]');}
 async function start(){await page.evaluate(()=>{const original=resetBattle;resetBattle=function(...args){const now=Date.now;try{Date.now=()=>7;return original.apply(this,args);}finally{Date.now=now;resetBattle=original;}};});await tap('#squadStart');if(await page.locator('#squad.active').isVisible())await tap('#squadStart');await page.locator('#battle.active').waitFor({timeout:90000});await wait(page,()=>state.active&&!visualActionPending()&&!document.querySelector('#basicAbilityBtn').disabled);}
 async function auto(){for(let k=0;k<2;k++)await tap('#autoSpeedBtn');await tap('#autoBattleBtn');await page.locator('#mainCampaignResult.active').waitFor({timeout:180000});return page.evaluate(()=>state.winner);}
 const inspect=()=>page.evaluate(()=>({proof:MainCampaignCore.load(()=>gameStorage()),currency:progress.currency,receipts:(progress.rewardReceipts||[]).filter(r=>r.id===MainCampaignCore.RECEIPT).length,live:localStorage.getItem(ProgressV3Core.KEY)}));
 await page.goto(durableUrl);await ready();
 // An actual second tab must not enter the scene or change route while the first owns the writer.
 const contender=await newPage();await contender.goto(durableUrl);await contender.waitForFunction(()=>document.querySelector('#restart').textContent==='Повторить');assert.equal(await contender.evaluate(()=>window.lab?.snapshot().ready),false);await contender.close();
 await route();await reopen();assert.equal((await snap()).exploration.phase,'encounter');await enter();assert(await page.evaluate(()=>!mainCampaignCanLaunch(MainCampaignCore.II_ID)));const before=await inspect();assert.equal(before.proof.best,0);assert.equal(before.receipts,0);assert.equal(before.live,null);
 // Single starter Art against two enemies, deterministic seed; no outcome injection.
 await choose(['art']);await start();assert.equal(await auto(),'enemy');const lost=await inspect();assert.equal(lost.proof.best,0);assert.equal(lost.currency,before.currency);assert.equal(lost.receipts,0);await page.screenshot({path:out+'/'+name+'-loss.png'});
 await tap('#mainCampaignResultBack');await ready();assert.equal((await snap()).exploration.phase,'explore');await action('challenge');await enter();await choose(['ren','art']);await start();
 await tap('#battleMenuBtn');await tap('#battleMenuRetreat');await ready();assert.equal((await snap()).exploration.phase,'explore');await action('challenge');await enter();await choose(['ren','art']);await start();assert.equal(await auto(),'ally');
 // Close the tab after actual win, before claim. Recovery must expose the existing claim.
 const won=await inspect();assert(won.proof.best>0);assert.equal(won.receipts,0);await reopen();assert.equal((await snap()).exploration.won,true);await action('fight');await page.locator('#mainCampaignClaim:visible').waitFor({timeout:90000});await tap('#mainCampaignClaim');await wait(page,()=>mainCampaignStatus(MainCampaignCore.ID)==='claimed'&&!mainCampaignClaiming);const paid=await inspect();assert.equal(paid.currency,before.currency+40);assert.equal(paid.receipts,1);assert.equal(paid.live,null);await page.screenshot({path:out+'/'+name+'-recovered.png'});
 // Close after claim but before return; prior receipt must not grant again.
 await reopen();await action('fight');await page.locator('#campaignBackButton:visible').waitFor({timeout:90000});await wait(page,()=>typeof mainCampaignStatus==='function'&&mainCampaignStatus(MainCampaignCore.ID)==='claimed');await tap('#campaignBackButton');await ready();assert.equal((await snap()).exploration.phase,'return');
 await overview();await go('spawn');await action('finish');await reopen();assert.equal((await snap()).exploration.phase,'complete');
 await tap('#restart');await ready();await route();await enter();await choose(['ren','art']);await start();assert.equal(await auto(),'ally');const replay=await inspect();assert.equal(replay.receipts,1);assert.equal(replay.currency,paid.currency);assert.equal(replay.live,null);assert(await page.locator('#mainCampaignResultClaim').isHidden());await page.screenshot({path:out+'/'+name+'-replay.png'});await tap('#mainCampaignResultBack');await ready();assert.equal((await snap()).exploration.phase,'return');assert.deepEqual(pe,[]);results.push(name);
 }catch(e){errors.push({name,error:String(e),pe});console.error(name,e);await page?.screenshot({path:out+'/'+name+'-failure.png'}).catch(()=>{});}finally{await ctx?.close();await browser?.close();}
}
server.close();await writeFile(out+'/durable-report.json',JSON.stringify({results,errors,scope:'same browser context new tabs, real native defeat/retreat/win/replay, interrupted claim, writer denial; not physical device'},null,2));if(errors.length||results.length!==2)process.exitCode=1;
