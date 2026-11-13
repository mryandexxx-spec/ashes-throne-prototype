"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const root=path.join(__dirname,"..");
const read=f=>fs.readFileSync(path.join(root,f),"utf8");
test("NADAPORTRAIT002 uses exact approved lightweight replacement",()=>{
 const data=fs.readFileSync(path.join(root,"assets/nada-portrait-ui.webp"));
 assert.equal(data.toString("ascii",0,4),"RIFF");
 assert.equal(data.toString("ascii",8,12),"WEBP");
 assert.equal(data.length,7014);
 assert.equal(crypto.createHash("sha256").update(data).digest("hex"),
  "0b7817b4fde2b53e35be808b6ab0e0a9c4212452c49cbd9dc951d148478d8987");
 assert.ok(data.length<8080,"Nada remains smaller than Ren UI portrait");
});
test("all three Nada UI paths cache-bust the image without changing Ren's",()=>{
 const js=read("game.js");
 assert.equal((js.match(/assets\/nada-portrait-ui\.webp\?v=2/g)||[]).length,2);
 assert.match(js,/assets\/ren-portrait-ui\.webp/);
 assert.match(js,/showNadaPortrait=hero\.id==="nada"/);
});
test("versioned page shell and portrait documentation stay paired",()=>{
 const html=read("index.html"),pkg=JSON.parse(read("package.json"));
 assert.equal(pkg.version,"0.3.142");
 assert.match(html,/v0\.3\.142 · CHAR003/);
 assert.match(read("docs/BUILD_HISTORY.md"),/NADAART001 \+ NADAPLAY001 \+ NADAPORTRAIT002/);
 assert.match(read("docs/NADA_PORTRAIT_002.md"),/Оригинал PNG пока НЕ загружен/);
});
