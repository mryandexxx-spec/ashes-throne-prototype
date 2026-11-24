"use strict";
// FIRSTPLAY004: ensure production cutscene art never regresses to tiny previews.
// No external decoders/dependencies required: test format headers + dimensions.
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const Story=require("../first-play-story-core.js");
const root=path.join(__dirname,"..");
// Retain the original v5 resolution/budget checks. P1-C2 deliberately uses
// native generated widescreen panels, plus a separate closer document crop;
// do not upscale files merely to meet the retired 1672px v5 art contract.
const expected=Object.freeze({
 warning:["v5/warning",1672,941,150_000,650_000],
 conflict:["v6/conflict",1254,624,100_000,220_000],
 artSupport:["v5/art-support",1672,941,150_000,650_000],
 renRoute:["v5/ren-route",1672,941,150_000,650_000],
 decision:["v5/decision",1672,941,150_000,650_000],
 aftermath:["v6/rescue",1254,630,90_000,220_000],
 document:["v6/document",684,384,30_000,100_000]
});
for(const [name,[slug,width,height,minBytes,maxBytes]] of Object.entries(expected)){
 test("First Play "+name+" loads a native-resolution replaceable WebP",()=>{
  const file=Story.ART[name];
  assert.equal(file,"assets/cutscenes/first-report/"+slug+".webp");
  assert.equal(Story.AVIF[name],null);
  const bytes=fs.readFileSync(path.join(root,file));
  assert.ok(bytes.length>minBytes,"art was excessively compressed");
  assert.ok(bytes.length<maxBytes,"art exceeds mobile budget");
  assert.equal(bytes.toString("ascii",0,4),"RIFF");
  assert.equal(bytes.readUInt32LE(4)+8,bytes.length);
  assert.equal(bytes.toString("ascii",8,12),"WEBP");
  assert.equal(bytes.toString("ascii",12,16),"VP8 ");
  assert.equal(bytes.toString("hex",23,26),"9d012a");
  assert.equal(bytes.readUInt16LE(26)&0x3fff,width);
  assert.equal(bytes.readUInt16LE(28)&0x3fff,height);
 });
}
test("FIRSTPLAY004 permanently eliminates stale HQ overlay markup and renderer",()=>{
 const index=fs.readFileSync(path.join(root,"index.html"),"utf8");
 const game=fs.readFileSync(path.join(root,"game.js"),"utf8");
 const css=fs.readFileSync(path.join(root,"first-play.css"),"utf8");
 assert.equal(index.includes('id="hqFirstPlayCard"'),false);
 assert.equal(game.includes('querySelector("#hqFirstPlayCard")'),false);
 assert.equal(css.includes(".hq-first-play-status"),false);
});
test("First Play keeps a consistent build across entry assets",()=>{
 const index=fs.readFileSync(path.join(root,"index.html"),"utf8");
 const pkg=require("../package.json");
 assert.match(pkg.version,/^\d+\.\d+\.\d+$/);
 assert.ok(index.includes('id="buildVersion">Прототип · v'+pkg.version+' · '));
 for(const file of ["first-play.css","first-play-story.css","first-play-core.js","first-play-story-core.js","game.js"]){
  const refs=[...index.matchAll(/(?:src|href)="([^"]+)"/g)].map(m=>m[1]).filter(ref=>ref.split("?")[0]===file);
  assert.deepEqual(refs,[file+"?v="+pkg.version],file);
 }
});
