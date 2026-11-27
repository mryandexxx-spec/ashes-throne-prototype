// Real browser touch input, Babylon rendering, arrival and teardown assertions.
import {chromium,webkit} from 'playwright';
import {createServer} from 'node:http';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import assert from 'node:assert/strict';
const root=resolve('site'),out=resolve('browser-evidence');await mkdir(out,{recursive:true});
const mime={'.html':'text/html','.js':'text/javascript','.wasm':'application/wasm'};
const server=createServer(async(req,res)=>{
 try{const p=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!p.startsWith(root+'/'))throw Error('outside site');res.setHeader('content-type',mime[extname(p)]||'application/octet-stream');res.end(await readFile(p));}catch(e){res.statusCode=404;res.end('not found');}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/index.html';
const results=[],errors=[];
function percentile(a,p){const s=[...a].sort((a,b)=>a-b);return s.length?s[Math.min(s.length-1,Math.ceil(p*s.length)-1)]:null;}
for(const [browserName,driver] of [['chromium',chromium],['webkit',webkit]]){
 let browser;
 try{
 browser=await driver.launch(browserName==='chromium'?{args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}:{}); 
 for(const [width,height] of [[844,390],[932,430],[844,320]]){
  const page=await browser.newPage({viewport:{width,height},hasTouch:true,isMobile:true,deviceScaleFactor:1});
  const label=browserName+'-'+width+'x'+height;const pageErrors=[];page.on('pageerror',e=>pageErrors.push(String(e)));
  try{
   await page.goto(url);await page.waitForFunction(()=>!!window.lab,{timeout:30000});
   for(const name of ['recast-navigation@0.43.1','navcat@0.4.1']){
    const entry={label,name,cases:[],cycles:[]};results.push(entry);
    entry.open=await page.evaluate(n=>window.lab.open(n),name);
    assert.equal(entry.open.engines,entry.open.base+1);
    const cases=await page.evaluate(()=>window.lab.cases);
    for(const c of cases){
     await page.evaluate(from=>window.lab.reset(from),c.from);
     const before=await page.evaluate(()=>window.lab.snapshot());
     const point=await page.evaluate(to=>window.lab.project(to),c.to);
     assert(point.x>=0&&point.x<width&&point.y>=0&&point.y<height,'projected test target outside canvas');
     await page.touchscreen.tap(point.x,point.y);
     await page.waitForFunction(n=>window.lab.snapshot().commands>n,before.commands,{timeout:4000});
     const selected=await page.evaluate(()=>window.lab.snapshot());
     assert.equal(selected.last.accepted,c.want,label+' '+name+' '+c.id+' '+JSON.stringify(selected.last));
     if(c.want){
      if(c.id==='around-hole')await page.screenshot({path:out+'/'+label+'-'+name.split('@')[0]+'-route.png'});
      await page.waitForFunction(()=>!window.lab.snapshot().walking,undefined,{timeout:12000});
      const end=await page.evaluate(()=>window.lab.snapshot());
      assert(Math.hypot(...end.pos.map((v,i)=>v-c.to[i]))<.75,'arrival error');
      assert.equal(end.unsafe,0);assert.equal(end.arrivals,before.arrivals+1);
      entry.cases.push({id:c.id,pass:true,end:end.pos,unsafe:end.unsafe,routeLength:selected.last.length});
     }else{
      assert.equal(selected.walking,false);
      assert.deepEqual(selected.pos,before.pos);
      entry.cases.push({id:c.id,pass:true,reason:selected.last.reason||'partial/unsafe endpoint rejected'});
     }
    }
    const stats=await page.evaluate(()=>window.lab.snapshot());
    entry.frames={count:stats.frames.length,median:percentile(stats.frames,.5),p95:percentile(stats.frames,.95)};
    assert.equal(await page.evaluate(()=>window.lab.close()),entry.open.base);
    for(let i=0;i<2;i++){
      const m=await page.evaluate(n=>window.lab.open(n),name);
      assert.equal(m.engines,m.base+1);assert.equal(m.meshes,entry.open.meshes);
      const n=await page.evaluate(()=>window.lab.close());assert.equal(n,m.base);entry.cycles.push({opened:m.engines,closed:n});
    }
    console.log(JSON.stringify({label,name,passed:entry.cases.length,frames:entry.frames,cycles:entry.cycles,buildMs:entry.open.buildMs}));
   }
   assert.deepEqual(pageErrors,[]);
  }catch(e){errors.push({label,error:String(e),pageErrors});await page.screenshot({path:out+'/'+label+'-failure.png'}).catch(()=>{});}
  finally{await page.evaluate(()=>window.lab?.close()).catch(()=>{});await page.close();}
 }
 }catch(e){errors.push({browserName,error:String(e)});}
 finally{await browser?.close();}
}
server.close();await writeFile(out+'/report.json',JSON.stringify({results,errors,scope:'headless WebGL; not physical iPhone, no final art or camera follow'},null,2));
console.log(JSON.stringify({errors,completed:results.map(x=>({label:x.label,name:x.name,cases:x.cases.length}))},null,2));
if(errors.length||results.length!==12||results.some(x=>x.cases.length!==9))process.exitCode=1;
