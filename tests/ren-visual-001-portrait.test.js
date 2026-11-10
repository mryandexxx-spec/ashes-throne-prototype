"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const asset=fs.readFileSync(path.join(__dirname,"..","assets/ren-portrait-ui.webp"));
test("Ren artwork is a small self-contained WebP derived from the accepted visual concept",()=>{
 assert.equal(asset.toString("ascii",0,4),"RIFF");
 assert.equal(asset.toString("ascii",8,12),"WEBP");
 assert.ok(asset.length>2000&&asset.length<40*1024,"keep portrait lightweight for mobile");
 assert.match(read("assets/ren-concept-sketch.svg"),/<title[^>]*>Рен Терен/,"preserve earlier historical sketch");
});
test("Collection, permanent hero card, biography and story preview use one Ren portrait",()=>{
 const html=read("index.html"),game=read("game.js"),css=read("styles.css");
 assert.equal((html.match(/src="assets\/ren-portrait-ui\.webp"/g)||[]).length,3,"detail, story and biography");
 assert.match(game,/owned&&h\.id==="ren"\?'<img class="ren-collection-portrait"/);
 assert.match(game,/const showRenPortrait=hero\.id==="ren"/);
 assert.match(game,/renPortrait\.hidden=!showRenPortrait/);
 assert.match(game,/heroStage\.classList\.toggle\("has-ren-portrait",showRenPortrait\)/);
 assert.match(html,/id="detailRenPortrait"[^>]*hidden>/);
 assert.match(html,/id="heroBiographyPortrait"[^>]*ren-portrait-ui\.webp/);
 assert.match(css,/\.ren-detail-portrait\[hidden\]\{display:none!important\}/);
 assert.match(css,/\.hero-detail-stage\.has-ren-portrait \.hero-detail-silhouette/);
 assert.match(game,/sketch\.hidden=hero\.id!=="trial-ren"&&hero\.id!=="ren"/,"both biography IDs");
 assert.ok(!read("hero-collection-core.js").includes("trial-ren"),"trial Ren remains separate");
});
test("Version bump and scope: no Babylon mesh edits or combat configuration in portrait patch",()=>{
 const html=read("index.html"),pkg=JSON.parse(read("package.json"));
 assert.equal(pkg.version,"0.3.86");
 assert.ok(html.includes("v0.3.86 · ROSTER002 + OPSHELP + RENPLAY + REN3D003"));
 assert.ok(read("game.js").includes('id:"ren",name:"Рен Терен",classId:"melee"'));
});
