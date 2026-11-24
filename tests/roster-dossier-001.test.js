"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const active=["ren","nada","liora","art","sava"];
const retired=["kael","lyra","darin","medic-demo","test-area-damage"];

test("ROSTERDOSSIER001: playable roster does not contain five retired test fighters",()=>{
 const game=read("game.js");
 const heroBlock=game.slice(game.indexOf("const HEROES = ["),game.indexOf("// NPCDATA001:"));
 const allyIds=[...heroBlock.matchAll(/\{id:"([^"]+)",[^\n]*side:"ally"/g)].map(m=>m[1]);
 assert.deepEqual(allyIds,active);
 for(const id of retired)assert.ok(!allyIds.includes(id));
 const collection=read("hero-collection-core.js");
 assert.match(collection,/const PLAYABLE=Object\.freeze\(\["ren","nada","liora","art","sava"\]\)/);
 assert.match(collection,/const MISSION_UNLOCKS=Object\.freeze\(\{\}\)/);
});
test("ROSTERDOSSIER001: legacy glyph never stacks atop atlas art",()=>{
 const logic=read("hero-card-ui.js"),game=read("game.js"),css=read("hero-card.css");
 assert.match(game,/AbilityIconCore\.element\(hero,info\.id,"hero-ability-thumb"\)/);
 assert.ok(logic.includes('card.querySelector(".hero-card-ability-icon, .hero-ability-thumb")'));
 assert.match(css,/hero-ability-card:has\(\.hero-ability-thumb\)[^\{]*\{\s*padding:4px 7px/);
 assert.match(css,/hero-ability-title-text[^\{]*\{[^}]*flex:1 1 auto/);
});
test("ROSTERDOSSIER001: compact landscape keeps action buttons fixed and star body scrollable",()=>{
 const css=read("hero-card.css"),html=read("index.html");
 assert.match(css,/hero-detail-reference>\.hero-detail-progression\{[^}]*grid-template-rows:auto minmax\(0,1fr\) auto/);
 assert.match(css,/hero-detail-progression>\.star-panel\{[^}]*overflow-y:auto/);
 assert.match(css,/hero-detail-progression>\.hero-card-links\{[^}]*position:static/);
 for(const id of ["detailBiography","detailUpgrade","starPromoteButton","renCardReset"])
  assert.ok(html.includes('id="'+id+'"'),id);
 const build=html.match(/id="buildVersion">Прототип · v([\d.]+) · ([A-Z\d]+)/);
 assert.equal(build?.[1],require("../package.json").version,'published version must match package');
 assert.ok(build?.[2],'build must retain a visible feature code');
});
