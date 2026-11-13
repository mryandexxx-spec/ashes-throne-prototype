"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const client=require("../model-cache-client.js");
test("CACHE001: background prefetch stays off on metered networks and hidden tabs",()=>{
 assert.equal(client.mayWarm({visible:false}),false);
 assert.equal(client.mayWarm({connection:{saveData:true}}),false);
 assert.equal(client.mayWarm({connection:{effectiveType:"slow-2g"}}),false);
 assert.equal(client.mayWarm({connection:{effectiveType:"2g"}}),false);
 assert.equal(client.mayWarm({connection:{effectiveType:"3g"}}),false);
 assert.equal(client.mayWarm({connection:{type:"cellular"}}),false);
 assert.equal(client.mayWarm({connection:{effectiveType:"4g"},visible:true}),true);
 assert.equal(client.mayWarm({visible:true}),true);
});
test("CACHE001: only the three current, versioned GLB URLs can be stored",()=>{
 const worker=read("model-cache-sw.js"),html=read("index.html");
 assert.match(worker,/assets\/ren-meshy-mixamo-animated\.glb/);
 assert.match(worker,/dev\/assets\/models\/nada-mobile-animated\.glb/);
 assert.match(worker,/dev\/assets\/models\/liora-mobile-animated\.glb/);
 // RENOPT001: the cache name must follow the actual GLB bytes, otherwise devices keep a stale model.
 const blob=f=>{const b=fs.readFileSync(path.join(__dirname,"..",f));return require("node:crypto").createHash("sha1").update(Buffer.concat([Buffer.from("blob "+b.length+"\0"),b])).digest("hex").slice(0,8);};
 assert.match(worker,new RegExp('CACHE_PREFIX\\+"ren-'+blob("assets/ren-meshy-mixamo-animated.glb")+"_nada-"+blob("dev/assets/models/nada-mobile-animated.glb")+"_liora-"+blob("dev/assets/models/liora-mobile-animated.glb")+'_v1"'));
 assert.match(worker,/event\.request\.method!=="GET"/);
 assert.match(worker,/event\.request\.headers\.has\("range"\)/);
 assert.match(worker,/cache\.put\(url,response\.clone\(\)\)/);
 assert.match(worker,/event\.waitUntil\(task\.then/);
 assert.match(worker,/response\.clone\(\),persisted/);
 assert.match(html,/model-cache-client\.js\?v=0\.3\.146/);
 assert.match(html,/v0\.3\.146 · LIORAANIM001/);
 assert.equal(JSON.parse(read("package.json")).version,"0.3.146");
});
test("CACHE001: never save documents, scripts, game state or third-party requests",()=>{
 const src=read("model-cache-sw.js");
 assert.doesNotMatch(src,/localStorage|indexedDB|document\.cookie|addAll\(|caches\.match\(event\.request/);
 assert.match(src,/url\.origin!==self\.location\.origin\|\|url\.search\|\|url\.hash/);
 assert.match(src,/MODEL_URLS\.includes\(url\.href\)/);
 assert.match(src,/name\.startsWith\(CACHE_PREFIX\)&&name!==CACHE_NAME/);
});
