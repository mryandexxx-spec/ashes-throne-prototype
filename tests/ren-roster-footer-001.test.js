"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const base=path.join(__dirname,".."),read=p=>fs.readFileSync(path.join(base,p),"utf8");
test("RENROSTER001: wide artwork is compact and exactly matches imported reference",()=>{
 const data=fs.readFileSync(path.join(base,"assets/ren-portrait-roster.webp"));
 assert.equal(data.toString("ascii",0,4),"RIFF");
 assert.equal(data.toString("ascii",8,12),"WEBP");
 assert.equal(data.toString("ascii",12,16),"VP8 ");
 assert.equal(data.readUInt16LE(26)&0x3fff,384);
 assert.equal(data.readUInt16LE(28)&0x3fff,192);
 assert.equal(data.length,4976);
 assert.equal(crypto.createHash("sha256").update(data).digest("hex"),
  "9c46c055a9ba9efabee40a904fab0144996f8e3ee6ac68b495989bdcf72ea096");
 assert.ok(data.length<8000,"lightweight for mobile");
});
test("RENROSTER001: roster uses wide Ren, biography and detail keep original Ren",()=>{
 const js=read("game.js");
 const roster=js.slice(js.indexOf("function renderHeroes()"),
  js.indexOf('document.querySelectorAll("[data-roster-filter]").forEach(button=>button.addEventListener'));
 assert.match(roster,/owned&&h\.id==="ren"\?'<img class="ren-collection-portrait" src="assets\/ren-portrait-roster\.webp\?v=1"/);
 assert.match(roster,/width="384" height="192"/);
 assert.equal((js.match(/assets\/ren-portrait-roster\.webp\?v=1/g)||[]).length,1);
 assert.match(js,/sketch\.src="assets\/ren-portrait-ui\.webp"/);
 assert.match(js,/renPortrait\.src=showNadaPortrait\?"assets\/nada-portrait-ui\.webp\?v=2":"assets\/ren-portrait-ui\.webp"/);
 assert.equal((js.match(/assets\/nada-portrait-roster\.webp\?v=1/g)||[]).length,1);
});
test("RENROSTER001: wide artwork stays in collection and footer is compact",()=>{
 const css=read("styles.css"),rule=css.slice(css.indexOf("/* RENROSTER001:"));
 assert.match(rule,/#collection \.roster-card-art\.hero-avatar-ren \.ren-collection-portrait/);
 assert.match(rule,/width:100%;height:100%;[^}]*object-fit:cover;object-position:center 42%/);
 assert.match(rule,/#app>footer\{gap:4px 12px;flex-wrap:wrap;min-width:0\}/);
 const html=read("index.html"),pkg=JSON.parse(read("package.json"));
 assert.equal(pkg.version,"0.3.132");
 const footer=html.match(/id="buildVersion">([^<]*)<\/span>/)?.[1];
 assert.equal(footer,"Прототип · v0.3.132 · CACHE002");
 assert.ok(footer.length<50);
 assert.match(read("docs/BUILD_HISTORY.md"),/NADAROSTER001/);
});
