"use strict";
/* ASSETLOAD001: one asset list, one loading bar, persistent device cache. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const crypto=require("node:crypto");
const root=path.join(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const Manifest=require("../asset-manifest.js");

test("manifest = real files: size and sha256 prefix of every asset",()=>{
 assert.ok(Manifest.ASSETS.length>=18);
 for(const a of Manifest.ASSETS){
  const buf=fs.readFileSync(path.join(root,a.url));
  assert.equal(a.bytes,buf.length,a.id+" bytes");
  assert.equal(a.rev,crypto.createHash("sha256").update(buf).digest("hex").slice(0,8),a.id+" rev (run tools/build-asset-manifest.cjs)");
  assert.ok(a.label&&["hero","enemy","arena"].includes(a.kind),a.id);
 }
 assert.equal(new Set(Manifest.ASSETS.map(a=>a.id)).size,Manifest.ASSETS.length);
 assert.match(Manifest.REVISION,/^[0-9a-f]{8}$/);
 assert.equal(Manifest.totalBytes(),Manifest.ASSETS.reduce((s,a)=>s+a.bytes,0));
 assert.equal(Manifest.forPath("./assets/arena-env005-terrace.webp")?.id,"arena:env005");
});

test("manifest covers every file the game actually loads (heroes, all NPC archetypes, arena art)",()=>{
 const urls=new Set(Manifest.ASSETS.map(a=>a.url));
 assert.ok(urls.has(require("../ren-glb-runtime.js").ASSET_URL));
 for(const name of ["nada","liora","sava","art"])
  assert.ok(urls.has(require("../"+name+"-glb-runtime.js").assetUrl()),name);
 const models=require("../dev/src/assets/models.js");
 void models;
 const npc=require("../dev/src/assets/npc-models.js");
 for(const m of Object.values(npc.models)){
  assert.ok(urls.has(m.url),m.id);
  assert.equal(Manifest.get("npc:"+m.id)?.url,m.url,"game.js maps runtime.archetypeId -> npc:<id>");
 }
 const env=require("../combat-environment-006.js");
 assert.ok(urls.has(env.TEXTURE_URL)&&urls.has(env.ANIM_MASK_URL));
 assert.match(read("styles.css"),/url\("assets\/arena-env005-terrace\.webp"\)/);
 assert.ok(urls.has("assets/arena-env005-terrace.webp"));
 // Labels are the in-game names (e.g. the screenshot's «Сигнальщик обхода»).
 assert.equal(Manifest.get("npc:npc-route-signaller").label,"Сигнальщик обхода");
});

function freshLoader(globals){
 const file=require.resolve("../model-cache-client.js");
 delete require.cache[file];
 const saved={};
 for(const [k,v] of Object.entries(globals)){saved[k]=Object.getOwnPropertyDescriptor(globalThis,k);Object.defineProperty(globalThis,k,{value:v,configurable:true,writable:true});}
 global.AssetManifest=Manifest;
 try{return require(file);}
 finally{
  for(const k of Object.keys(globals)){if(saved[k])Object.defineProperty(globalThis,k,saved[k]);else delete globalThis[k];}
 }
}
function memoryCaches(){
 const stores=new Map();
 return {stores,open:async name=>{
  if(!stores.has(name))stores.set(name,new Map());
  const m=stores.get(name);
  const key=r=>typeof r==="string"?r:r.url;
  return {match:async r=>m.get(key(r))?.clone()||undefined,put:async(r,res)=>{m.set(key(r),new Response(await res.arrayBuffer(),{status:200}));},
   keys:async()=>[...m.keys()].map(url=>({url})),delete:async r=>m.delete(key(r))};
 },keys:async()=>[...stores.keys()],delete:async n=>stores.delete(n)};
}
function chunkedResponse(size,chunk=40000){
 let sent=0;
 return new Response(new ReadableStream({pull(c){if(sent>=size){c.close();return;}const n=Math.min(chunk,size-sent);sent+=n;c.enqueue(new Uint8Array(n));}}),{status:200});
}

test("loader: real stream bytes, one bar summary, stored in the device cache (no service worker)",async()=>{
 const caches=memoryCaches();
 let requests=0;
 const fetch=async url=>{requests++;const a=Manifest.forPath(url);return chunkedResponse(a.bytes);};
 const L=freshLoader({window:{location:{href:"https://game.test/"},isSecureContext:false},caches,fetch});
 globalThis.window={location:{href:"https://game.test/"},isSecureContext:false};
 globalThis.caches=caches;globalThis.fetch=fetch;
 try{
  const ids=["hero:nada","npc:npc-route-signaller","arena:env005"];
  const seen=[];
  const off=L.subscribe(()=>seen.push(L.summary(ids).percent));
  const before=L.summary(ids);
  assert.equal(before.percent,0);assert.equal(before.complete,false);
  assert.equal(before.total,Manifest.totalBytes(ids));
  const done=await L.load(ids);
  off();
  assert.equal(done.complete,true);assert.equal(done.percent,100);assert.equal(done.loaded,done.total);
  assert.ok(done.items.every(i=>i.status==="stored"),JSON.stringify(done.items));
  assert.ok(seen.some(p=>p>0&&p<100),"intermediate byte progress is reported");
  for(let i=1;i<seen.length;i++)assert.ok(seen[i]>=seen[i-1],"bar never goes backwards");
  const store=caches.stores.get("ashes-assets-v1");
  for(const id of ids){const a=Manifest.get(id);assert.ok(store.has("https://game.test/"+a.url+"?rev="+a.rev),id);}
  assert.equal(requests,3);
  // Second page life: everything comes from the cache, zero network.
  const L2=freshLoader({window:globalThis.window,caches,fetch});
  const again=await L2.load(ids);
  assert.ok(again.items.every(i=>i.status==="cached"));
  assert.equal(requests,3);
 }finally{delete globalThis.window;delete globalThis.caches;delete globalThis.fetch;}
});

test("loader: failed file is reported, bar still completes; formatting and warm policy",async()=>{
 const caches=memoryCaches();
 const fetch=async url=>url.includes("sava")?new Response("no",{status:404}):chunkedResponse(Manifest.forPath(url).bytes);
 globalThis.window={location:{href:"https://game.test/"},isSecureContext:false};globalThis.caches=caches;globalThis.fetch=fetch;
 try{
  const L=freshLoader({window:globalThis.window,caches,fetch});
  const s=await L.load(["hero:sava","hero:art"]);
  assert.equal(s.complete,true);assert.equal(s.failed,1);
  assert.equal(s.items.find(i=>i.id==="hero:sava").status,"error");
  assert.equal(L.percent(7112516,14225032),50);
  assert.equal(L.percent(5,0),0);
  assert.equal(L.formatMB(1572864),"1,5");
  assert.equal(L.formatMB(18630000),"18");
  assert.equal(L.mayWarm({visible:false}),false);
  assert.equal(L.mayWarm({connection:{saveData:true}}),false);
  assert.equal(L.mayWarm({connection:{effectiveType:"2g"}}),false);
  assert.equal(L.mayWarm({connection:{effectiveType:"4g"}}),true);
  assert.equal(L.mayWarm({}),true); // iPhone Safari has no navigator.connection
 }finally{delete globalThis.window;delete globalThis.caches;delete globalThis.fetch;}
});

// Runs the real worker file in a sandbox with fake CacheStorage/fetch.
function workerSandbox(fetchImpl){
 const listeners={};
 const caches=memoryCaches();
 const ctx={
  console,URL,Response,ReadableStream,Uint8Array,Map,Set,Promise,Array,Error,crypto:globalThis.crypto,
  caches,fetch:fetchImpl,
  self:null,
 };
 ctx.self={location:{href:"https://game.test/model-cache-sw.js?rev="+Manifest.REVISION,origin:"https://game.test"},
  registration:{scope:"https://game.test/"},addEventListener:(t,fn)=>{listeners[t]=fn;},skipWaiting:async()=>{},clients:{claim:async()=>{}}};
 ctx.importScripts=url=>{
  assert.match(url,/^asset-manifest\.js\?rev=/);
  vm.runInContext(read("asset-manifest.js").replace("const AssetManifest=","self.AssetManifest=globalThis.AssetManifest="),ctx);
 };
 vm.createContext(ctx);
 vm.runInContext(read("model-cache-sw.js"),ctx);
 return {listeners,caches,ctx};
}
test("worker: serves/stores only listed assets under rev keys, shares one download, reports progress",async()=>{
 let network=0;
 const sw=workerSandbox(async url=>{network++;return chunkedResponse(Manifest.forPath(new URL(url).pathname.slice(1))?.bytes||10);});
 const fire=async(url,headers={})=>{
  let responded=null;const waits=[];
  sw.listeners.fetch({request:{method:"GET",url,headers:{has:h=>h in headers}},respondWith:p=>{responded=p;},waitUntil:p=>waits.push(p)});
  const res=responded?await responded:null;
  await Promise.all(waits);
  return res;
 };
 const a=Manifest.get("npc:npc-watch-captain"),url="https://game.test/"+a.url;
 const [r1,r2]=await Promise.all([fire(url),fire(url)]);
 assert.equal((await r1.arrayBuffer()).byteLength,a.bytes);
 assert.equal((await r2.arrayBuffer()).byteLength,a.bytes);
 assert.equal(network,1,"concurrent requests share one transfer");
 const store=sw.caches.stores.get("ashes-assets-v1");
 assert.ok(store.has(url+"?rev="+a.rev));
 await fire(url);
 assert.equal(network,1,"second visit is served from the device cache");
 // Not ours: HTML, JS, query strings, Range, other origins.
 for(const u of ["https://game.test/index.html","https://game.test/game.js","https://game.test/"+a.url+"?x=1","https://cdn.babylonjs.com/v9.33.2/babylon.js"])
  assert.equal(await fire(u),null,u);
 assert.equal(await fire(url,{range:1}),null);
 // Message API: progress for each file, then done.
 const messages=[];
 const port={postMessage:m=>messages.push(m)};
 let wait;
 sw.listeners.message({data:{type:"ASSET_FETCH",ids:["npc:npc-watch-captain","hero:nada"]},ports:[port],waitUntil:p=>{wait=p;}});
 await wait;
 const done=messages.at(-1);
 assert.equal(done.type,"ASSET_DONE");
 assert.equal(JSON.stringify(done.results.map(r=>r.status).sort()),JSON.stringify(["cached","stored"]));
 const nada=messages.filter(m=>m.id==="hero:nada");
 assert.ok(nada.some(m=>m.status==="downloading"&&m.loaded>0&&m.loaded<m.total));
 assert.equal(nada.at(-1).status,"stored");
 messages.length=0;
 sw.listeners.message({data:{type:"ASSET_STATUS"},ports:[port],waitUntil:p=>{wait=p;}});
 await wait;
 const status=messages[0].items;
 assert.equal(status.length,Manifest.ASSETS.length);
 assert.equal(status.filter(i=>i.status==="cached").length,2);
});
test("worker: on activate keeps matching legacy hero bytes, drops stale revisions",async()=>{
 const sw=workerSandbox(async()=>chunkedResponse(10));
 const nada=Manifest.get("hero:nada"),ren=Manifest.get("hero:ren");
 const legacy=await sw.caches.open("ashes-models-ren-old_v1");
 await legacy.put("https://game.test/"+nada.url,new Response(fs.readFileSync(path.join(root,nada.url))));
 await legacy.put("https://game.test/"+ren.url,new Response(new Uint8Array(100))); // wrong bytes
 const current=await sw.caches.open("ashes-assets-v1");
 await current.put("https://game.test/"+nada.url+"?rev=deadbeef",new Response("old"));
 let wait;sw.listeners.activate({waitUntil:p=>{wait=p;}});await wait;
 const keys=[...sw.caches.stores.get("ashes-assets-v1").keys()];
 assert.deepEqual([...keys],["https://game.test/"+nada.url+"?rev="+nada.rev]);
 assert.equal(sw.caches.stores.has("ashes-models-ren-old_v1"),false);
});

test("worker source: no game data, scripts or documents; versioned registration",()=>{
 const src=read("model-cache-sw.js"),client=read("model-cache-client.js");
 assert.doesNotMatch(src,/localStorage|indexedDB|document\.cookie|addAll\(|caches\.match\(event\.request/);
 assert.match(src,/url\.origin!==self\.location\.origin\|\|url\.search\|\|url\.hash/);
 assert.match(src,/event\.request\.headers\.has\("range"\)/);
 assert.match(client,/SW_BASE\+"\?rev="\+\(manifest\(\)\?\.REVISION/);
 assert.match(client,/navigator\.storage\?\.persist/);
});

test("UI: one lobby bar and one battle gate, wired into battle entry and exit",()=>{
 const html=read("index.html"),css=read("styles.css"),game=read("game.js");
 for(const id of ["assetLoadDock","assetLoadCaption","assetLoadBar","assetLoadDetail",
  "battleAssetGate","battleAssetGateBar","battleAssetGatePercent","battleAssetGateCaption","battleAssetGateList","battleAssetGateSkip"])
  assert.ok(html.includes('id="'+id+'"'),id);
 assert.doesNotMatch(html,/cache002-/,"per-hero rows replaced by one bar");
 const m=html.indexOf('src="asset-manifest.js'),c=html.indexOf('src="model-cache-client.js');
 assert.ok(m>0&&m<c);
 assert.match(css,/\.hq-screen \.hq-model-cache\{[^}]*pointer-events:none/);
 assert.match(css,/\.battle-screen \.battle-asset-gate\{[^}]*pointer-events:auto/);
 assert.match(css,/\.battle-asset-gate-skip\{[^}]*min-height:44px/);
 assert.ok(game.includes("startBattleRendering();\n   openBattleAssetGate();"));
 assert.match(game,/closeBattleAssetGate\(\);stopBattleRendering\(\);disposeArenaEnv006\(\);\}/);
 assert.match(game,/console\.error\("Не удалось запустить 3D-арену:",error\);\n   closeBattleAssetGate\(\);/);
 assert.match(game,/add\("npc:"\+runtime\.archetypeId/);
 assert.match(game,/add\("hero:"\+f\.id/);
});
