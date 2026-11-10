"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const css=read("styles.css"),html=read("index.html"),js=read("game.js");
const start=css.indexOf("/* UI-HERO-001");
const art=css.slice(start,css.indexOf("/* UI-HERO-002",start));
test("UIHERO002 uses painted HQ background and compact account HUD only in hero dossier",()=>{
 assert.ok(start>0);
 assert.match(art,/body:has\(#heroDetail\.active\)::before/);
 assert.match(art,/url\("assets\/hq-hall-painting-mobile\.webp"\)/);
 assert.match(art,/#app:has\(#heroDetail\.active\)>.topbar/);
 assert.match(art,/#heroDetail\.hero-detail-screen\.active/);
 assert.doesNotMatch(art,/#home\.hq-screen|#collection\.roster-screen|#battle|#squad/);
 assert.match(html,/id="accountStatus"/);
});
test("UIHERO002 preserves hero abilities, stages, rank, gear, and level actions",()=>{
 for(const id of ["detailBack","detailHome","detailBiography","detailTags","detailRenPortrait","heroAbilityList","gearSlots","gearEquipNext","starShardProgress","starPromoteButton","detailUpgrade","detailStats"]){
  assert.ok(html.includes('id="'+id+'"'),id+" retained");
 }
 assert.match(art,/#heroDetail \.hero-detail-stage/);
 assert.match(art,/object-fit:contain/);
 assert.match(art,/#heroDetail \.hero-detail-reference \.hero-ability-card/);
 assert.match(art,/#heroDetail \.gear-slot/);
 assert.match(art,/#heroDetail \.star-panel/);
 assert.match(js,/const restore=rosterRestoreOnReturn&&rosterWasInDossier/);
});
test("UIHERO002 keeps accessible touch and landscape protections",()=>{
 assert.match(art,/@media\(orientation:landscape\) and \(max-height:540px\)/);
 assert.match(art,/#heroDetail button:focus-visible/);
 assert.match(art,/min-height:44px/);
 assert.match(art,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(art,/padding-inline:max\(12px,env\(safe-area-inset-left\)\)/);
});
test("UIHERO002 build version is aligned",()=>{
 assert.equal(JSON.parse(read("package.json")).version,"0.3.94");
 assert.match(html,/v0\.3\.94 · UIHERO002/);
});
