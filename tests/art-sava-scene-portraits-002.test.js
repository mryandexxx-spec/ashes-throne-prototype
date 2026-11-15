"use strict";
// ARTSAVAPORTRAIT002: exact owner-provided cinematic references, not A-pose crops.
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),crypto=require("node:crypto"),path=require("node:path");
const root=path.join(__dirname,"..");
const expected={
 "art-portrait-ui.webp":{bytes:16000,sha256:"a9b4821b7de7ff861ee2b6c5035d863832946e3fbfef0f3fd9c5f532b1943959",size:[256,256]},
 "art-portrait-roster.webp":{bytes:16432,sha256:"ec87f79a78c80267c3dd9af0a268feb559e4d4f13188c64085d5c514c8910d31",size:[384,192]},
 "sava-portrait-ui.webp":{bytes:14106,sha256:"783b8ffeb1c69346cbe4f1d2f77a016962a0f2e95318448d09fb00e6c9c098d5",size:[256,256]},
 "sava-portrait-roster.webp":{bytes:15548,sha256:"966226feeec1b4e11e592b09c85663077b9220e20ae15df718c3dc2aa533dfc4",size:[384,192]}
};
test("approved narrative portraits replace the former A-pose crops byte-for-byte",()=>{
 for(const [name,e] of Object.entries(expected)){
  const b=fs.readFileSync(path.join(root,"assets",name));
  assert.equal(b.length,e.bytes,name+" bytes");
  assert.equal(b.toString("ascii",0,4),"RIFF",name);
  assert.equal(b.toString("ascii",8,12),"WEBP",name);
  assert.equal(b.toString("ascii",12,16),"VP8 ",name);
  assert.equal(b.readUInt16LE(26)&0x3fff,e.size[0],name+" width");
  assert.equal(b.readUInt16LE(28)&0x3fff,e.size[1],name+" height");
  assert.equal(crypto.createHash("sha256").update(b).digest("hex"),e.sha256,name+" hash");
 }
});
test("roster, biography and dossier reference the refreshed images; 3D stays a placeholder",()=>{
 const game=fs.readFileSync(path.join(root,"game.js"),"utf8");
 for(const id of ["art","sava"]){
  assert.ok(game.includes(`assets/${id}-portrait-ui.webp?v=2`));
  assert.ok(game.includes(`assets/${id}-portrait-roster.webp?v=2`));
  assert.ok(!game.includes(`assets/${id}-portrait-ui.webp?v=1`));
  assert.ok(!game.includes(`assets/${id}-portrait-roster.webp?v=1`));
 }
 const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
 const version=JSON.parse(fs.readFileSync(path.join(root,"package.json"),"utf8")).version;
 assert.equal(version,"0.3.161");
 assert.ok(html.includes("v0.3.161 · ARTSAVAPORTRAIT002"));
 assert.ok(html.includes("game.js?v="+version));
});
