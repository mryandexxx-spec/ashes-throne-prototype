"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const read=f=>fs.readFileSync(path.join(__dirname,"..",f),"utf8");
test("DOSSIERFIX001: no duplicate old badge for WebP ability icon",()=>{
 const js=read("hero-card-ui.js"), css=read("hero-card.css"),game=read("game.js");
 assert.ok(js.includes('card.querySelector(".hero-card-ability-icon, .hero-ability-thumb")'));
 assert.match(game,/AbilityIconCore\.element\(hero,info\.id,"hero-ability-thumb"\)/);
 assert.match(css,/hero-ability-card:has\(\.hero-ability-thumb\)[^\{]*\{\s*padding:4px 7px/);
 assert.match(css,/hero-ability-title-text[^\{]*\{[^}]*flex:1 1 auto/);
});
test("DOSSIERFIX001: bottom buttons occupy dedicated row on narrow landscape",()=>{
 const css=read("hero-card.css"),html=read("index.html");
 assert.match(css,/hero-detail-reference>\.hero-detail-progression\{[^}]*grid-template-rows:auto minmax\(0,1fr\) auto/);
 assert.match(css,/hero-detail-progression>\.star-panel\{[^}]*overflow-y:auto/);
 assert.match(css,/hero-detail-progression>\.hero-card-links\{[^}]*position:static/);
 for(const id of ["detailBiography","detailUpgrade","starPromoteButton","renCardReset"])assert.ok(html.includes('id="'+id+'"'));
 assert.ok(html.includes('v'+require("../package.json").version+' · DOSSIERFIX001'));
});