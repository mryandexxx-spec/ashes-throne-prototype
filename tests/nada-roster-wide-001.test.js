"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const root=path.join(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
test("NADAROSTER001: separate wide image fits 2:1 artwork slot without stretching",()=>{
 const data=fs.readFileSync(path.join(root,"assets/nada-portrait-roster.webp"));
 assert.equal(data.toString("ascii",0,4),"RIFF");
 assert.equal(data.toString("ascii",8,12),"WEBP");
 assert.equal(data.toString("ascii",12,16),"VP8 ");
 assert.equal(data.readUInt16LE(26)&0x3fff,384);
 assert.equal(data.readUInt16LE(28)&0x3fff,192);
 assert.equal(data.length,6188);
 assert.equal(crypto.createHash("sha256").update(data).digest("hex"),
 "1328590c2eec5113e4162a9615be6fb988a92fdb16781402d1da826f92f494c4");
});
test("NADAROSTER001: only collection uses wide WebP; details retain v2 square",()=>{
 const js=read("game.js");
 const roster=js.slice(js.indexOf("function renderHeroes()"),js.indexOf('document.querySelectorAll("[data-roster-filter]").forEach(button=>button.addEventListener'));
 assert.match(roster,/class="nada-collection-portrait" src="assets\/nada-portrait-roster\.webp\?v=1"/);
 assert.match(roster,/width="384" height="192"/);
 assert.equal((js.match(/assets\/nada-portrait-roster\.webp\?v=1/g)||[]).length,1);
 assert.equal((js.match(/assets\/nada-portrait-ui\.webp\?v=2/g)||[]).length,2);
 assert.match(js,/sketch\.src="assets\/nada-portrait-ui\.webp\?v=2"/);
 assert.match(js,/renPortrait\.src=showNadaPortrait\?"assets\/nada-portrait-ui\.webp\?v=2"/);
 assert.match(roster,/owned&&h\.id==="ren"\?'<img class="ren-collection-portrait"/);
});
test("NADAROSTER001: no legacy cover crop or viewport width overflows",()=>{
 const css=read("styles.css");
 const rule=css.slice(css.indexOf("/* NADAROSTER001:"));
 assert.match(rule,/#collection \.roster-card-art\.hero-avatar-nada/);
 assert.match(rule,/#collection \.hero-avatar-nada \.nada-collection-portrait\{[^}]*width:100%;height:100%;[^}]*object-fit:cover;object-position:center 42%/);
 assert.doesNotMatch(rule,/\bmin-width:600px\b|\btransform:scale\(/);
 const pkg=JSON.parse(read("package.json")),html=read("index.html");
 assert.equal(pkg.version,"0.3.141");
 assert.match(html,/v0\.3\.141 · CHAR002B/);
 assert.match(read("docs/BUILD_HISTORY.md"),/NADAPORTRAIT002 \+ NADAROSTER001/);
});
