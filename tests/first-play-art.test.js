"use strict";
// FIRSTPLAY004: ensure production cutscene art never regresses to tiny previews.
// No external decoders/dependencies required: test format headers + dimensions.
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const Story=require("../first-play-story-core.js");
const root=path.join(__dirname,"..");
const expected=Object.freeze({warning:941,conflict:941,decision:941,aftermath:941});
for(const [name,height] of Object.entries(expected)){
 test("FIRSTPLAY004 "+name+" loads sharp replaceable AVIF/WebP art",()=>{
  for(const [kind,extension] of [["AVIF","avif"],["ART","webp"]]){
   const file=Story[kind][name];
   assert.match(file,new RegExp("^assets/cutscenes/first-report/v3/bridge-approach\\."+extension+"$"));
   const bytes=fs.readFileSync(path.join(root,file));
   assert.ok(bytes.length>200_000,kind+" was excessively compressed");
   assert.ok(bytes.length<650_000,kind+" exceeds mobile art budget");
   if(extension==="webp"){
    assert.equal(bytes.toString("ascii",0,4),"RIFF");
    assert.equal(bytes.toString("ascii",8,12),"WEBP");
    assert.equal(bytes.toString("ascii",12,16),"VP8 ");
    assert.equal(bytes.toString("hex",23,26),"9d012a");
    assert.equal(bytes.readUInt16LE(26)&0x3fff,1672);
    assert.equal(bytes.readUInt16LE(28)&0x3fff,height);
   }else{
    assert.equal(bytes.toString("ascii",4,12),"ftypavif");
    const pos=bytes.indexOf(Buffer.from("ispe"));
    assert.ok(pos>=0,"AVIF must include image dimensions");
    assert.equal(bytes.readUInt32BE(pos+8),1672);
    assert.equal(bytes.readUInt32BE(pos+12),height);
   }
  }
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
test("FIRSTPLAY006 keeps a consistent build across entry assets",()=>{
 const index=fs.readFileSync(path.join(root,"index.html"),"utf8");
 const pkg=require("../package.json");
 assert.equal(pkg.version,"0.3.243");
 assert.match(index,/v0\.3\.243 · FIRSTPLAY006/);
 assert.equal(index.includes("?v=0.3.242"),false);
});
