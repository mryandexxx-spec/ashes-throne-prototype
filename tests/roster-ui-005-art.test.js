"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const css=read("styles.css"),js=read("game.js"),html=read("index.html");
const start=css.indexOf("/* ROSTER-UI-005");
const art=css.slice(start,css.indexOf("/* ROSTER-UI-006",start));
test("UIHERO002 artwork enhances only the existing roster",()=>{
 assert.ok(start>0,"art layer is separately scoped");
 assert.match(art,/#collection\.roster-screen\{/);
 assert.match(art,/#collection \.roster-card\{/);
 assert.match(art,/#collection \.roster-card-art\{/);
 assert.match(art,/radial-gradient/);
 assert.match(art,/inset 0 0 0 1px/);
 assert.match(art,/#collection \.roster-identity-tag\{/);
 assert.match(art,/#collection \.roster-leader-indicator\{/);
 assert.match(art,/#collection \.roster-card\.hero-locked/);
 assert.doesNotMatch(art,/#squad|#battle|#heroDetail/);
});
test("UIHERO002 keeps the full Ren portrait and leader/origin labels",()=>{
 assert.match(art,/\.roster-card-art \.ren-collection-portrait\{/);
 assert.match(art,/object-fit:contain/);
 assert.match(js,/const isLeader=owned&&selectedLeaderId===h\.id/);
 assert.match(js,/HeroProfileData\.tagLabels\(profile\.tags\)/);
 assert.match(js,/roster-identity-tags/);
 assert.doesNotMatch(art,/\.roster-squad-badge/);
});
test("UIHERO002 landscape and accessibility avoid mandatory motion",()=>{
 assert.match(art,/@media\(orientation:landscape\) and \(max-height:440px\)/);
 assert.match(art,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(art,/@media\(hover:hover\) and \(pointer:fine\)/);
 assert.match(css,/#collection \.roster-card:focus-visible/);
 assert.match(css,/#collection \.roster-sort-menu\[hidden\]\{display:none\}/);
});
test("UIHERO002 version and marker are aligned",()=>{
 assert.equal(JSON.parse(read("package.json")).version,"0.3.106");
 assert.match(html,/v0\.3\.106 · UIHUD001/);
});
