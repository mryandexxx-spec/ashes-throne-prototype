"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const html=read("index.html"),css=read("styles.css"),game=read("game.js");
test("ROSTER005 retains collection and unlocked/locked hero navigation",()=>{
 const roster=html.split('<section id="collection"')[1]?.split('<section id="heroDetail"')[0];
 assert.ok(roster);
 assert.match(roster,/id="heroList"/);
 assert.match(roster,/id="rosterCount"/);
 assert.match(roster,/data-screen="home"/);
 assert.match(game,/if\(heroOwned\(id\)\)openHeroDetail\(id\);else showLockedHero\(id\)/);
 assert.match(game,/StarCore\.shardsOf\(progress,h\.id\)/);
 assert.match(game,/ProgressCore\.gearState\(progress,h\.id\)/);
 assert.match(game,/assets\/ren-portrait-ui\.webp/);
});
test("ROSTER005 uses HQ palette and a landscape-responsive grid",()=>{
 assert.match(css,/#collection\.roster-screen/);
 assert.match(css,/#201c1a/);
 assert.match(css,/#a78348/);
 assert.match(css,/#collection \.roster-grid/);
 assert.match(css,/minmax\(min\(100%,148px\),1fr\)/);
 assert.match(css,/#collection \.roster-card:focus-visible/);
 assert.match(css,/#collection \.roster-card-art\.hero-avatar-ren::after\{display:none\}/);
});
test("ROSTER005 version is consistent",()=>{
 assert.equal(JSON.parse(read("package.json")).version,"0.3.89");
 assert.match(html,/v0\.3\.89 · ROSTER005/);
});
