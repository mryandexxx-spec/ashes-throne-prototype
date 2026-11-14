"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
test("RENAN008 build contract: package, footer, and script cache tokens agree",()=>{
 const version=JSON.parse(read("package.json")).version;
 const html=read("index.html");
 assert.match(version,/^\d+\.\d+\.\d+$/);
 assert.ok(html.includes("v"+version+" · "),"footer matches package");
 const marker=html.match(/id="buildVersion">Прототип · v([0-9]+\.[0-9]+\.[0-9]+) · ([A-Z][A-Z0-9-]*)<\/span>/);
 assert.ok(marker,"release footer must include a nonempty code");
 assert.equal(marker[1],version,"footer version must match package");
 assert.ok(marker[2].length>=5,"build code must be meaningful");
 for(const asset of ["styles.css","animation-profiles.js","battle-animation.js","ren-glb-runtime.js","ren-card-3d.js","game.js"]){
  assert.ok(html.includes(asset+"?v="+version),asset+" must share current cache version");
 }
});
