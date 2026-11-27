"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const root=path.join(__dirname,".."),S=vm.runInNewContext(fs.readFileSync(path.join(root,"art-adventure-story.js"),"utf8")+"\nArtAdventureStory");
const v={pilot:true,available:true,arc:null,attempted:false};const before=JSON.stringify(v);
assert.equal(S.frame({pilot:false,available:true},0),null);
assert.equal(S.frame({pilot:true,available:false},0),null);
for(let i=0;i<4;i++){const f=S.frame(v,i);assert.equal(f.id,"p"+i);assert.ok(f.text.length>50);assert.ok(f.art.endsWith('.webp'));}
assert.equal(S.frame(v,99).id,"p3");assert.equal(S.frame(v,-1).id,"p0");assert.equal(JSON.stringify(v),before);
assert.equal(S.frame({...v,attempted:true},0).id,"p3");
assert.equal(S.frame({...v,arc:"direct",outcome:"recovered"},0).id,"p4a");
assert.equal(S.frame({...v,arc:"hold",outcome:"recovered"},0).id,"p4a");
assert.equal(S.frame({...v,arc:"hold",outcome:"left"},0).id,"p4b");
assert.equal(S.frame({...v,arc:"hold",outcome:"unknown"},0),null);
assert.equal(new Set(S.frames.map(x=>x.blocking)).size,6);
assert.equal(new Set(S.frames.map(x=>x.art)).size,6);
const expected={"p0":"p0-v2.webp","p1":"p1-v1.webp","p2":"p2-v1.webp","p3":"p3-v1.webp","p4a":"p4a-v1.webp","p4b":"p4b-hybrid-v1.webp"};
for(const f of S.frames){
 assert.equal(f.art,"assets/cutscenes/art-adventure/candidates/"+expected[f.id]);
 const bytes=fs.readFileSync(path.join(root,f.art));
 assert.equal(bytes.toString("ascii",0,4),"RIFF");
 assert.equal(bytes.toString("ascii",8,12),"WEBP");
 assert.ok(bytes.length>10000&&bytes.length<280000);
}
assert.notEqual(S.ending.recovered.art,S.ending.left.art);
for(const f of S.frames){const raw=fs.readFileSync(path.join(root,f.blocking),"utf8");assert.match(raw,/<svg[^>]*width="960" height="540"/);assert.match(raw,/<\/svg>/);assert.ok(raw.length<15000);assert.ok(f.alt);}
assert.match(S.summary,/Кошель остался между героями/);
assert.match(S.ending.left.text,/Кошель остался/);assert.doesNotMatch(S.ending.left.text,/побежд|вернул/);
assert.match(S.ending.recovered.text,/возвращённого кошеля/);
console.log("R2/D3A presentation-only frame map, skip/retry, actual outcome variants, six independent WebP assets and six SVG backups passed");
