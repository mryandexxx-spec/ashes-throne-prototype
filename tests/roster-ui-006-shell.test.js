"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=x=>fs.readFileSync(path.join(__dirname,"..",x),"utf8");
const css=read("styles.css"),html=read("index.html"),js=read("game.js");
const start=css.indexOf("/* ROSTER-UI-006");
const shell=css.slice(start,css.indexOf("/* UI-HERO-001",start));
test("UIHERO002 shows existing HQ painting only when roster is active",()=>{
 assert.ok(start>0);
 assert.match(shell,/body:has\(#collection\.active\)::before/);
 assert.match(shell,/url\("assets\/hq-hall-painting-mobile\.webp"\)/);
 assert.match(shell,/#app:has\(#collection\.active\)>.topbar/);
 assert.match(shell,/#collection\.roster-screen\.active/);
 assert.doesNotMatch(shell,/#home\.hq-screen|#battle|#squad|#heroDetail/);
});
test("UIHERO002 integrates old topbar into scene HUD without removing account",()=>{
 assert.match(html,/<header class="topbar">/);
 assert.match(html,/id="accountStatus"/);
 assert.match(shell,/background:linear-gradient\(180deg,#14181bea/);
 assert.match(shell,/max-width:none/);
 assert.match(shell,/#app:has\(#collection\.active\)>footer/);
 assert.doesNotMatch(shell,/>\.topbar\{[^}]*display:none/);
});
test("UIHERO002 preserves cards, filters, marker and return navigation",()=>{
 assert.match(js,/const isLeader=owned&&selectedLeaderId===h\.id/);
 assert.match(js,/HeroProfileData\.tagLabels\(profile\.tags\)/);
 assert.match(html,/id="rosterSortTrigger"/);
 assert.match(html,/data-roster-filter="locked"/);
 assert.match(js,/const restore=rosterRestoreOnReturn&&rosterWasInDossier/);
 assert.match(shell,/#collection \.roster-grid/);
 assert.match(shell,/@media\(orientation:landscape\) and \(max-height:540px\)/);
});
test("UIHERO002 candidate build matches package",()=>{
 assert.equal(JSON.parse(read("package.json")).version,"0.3.96");
 assert.match(html,/v0\.3\.96 · UISYS001B/);
});
