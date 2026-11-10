"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const css=read("styles.css"),html=read("index.html"),js=read("game.js");
const start=css.indexOf("/* UI-HERO-002");
const art=css.slice(start,css.indexOf("/* UI-SYSTEMS-001A:",start));
test("UIHERO002 applies HQ scene and compact HUD to squad only",()=>{
 assert.ok(start>0);
 assert.match(art,/body:has\(#squad\.active\)::before/);
 assert.match(art,/url\("assets\/hq-hall-painting-mobile\.webp"\)/);
 assert.match(art,/#app:has\(#squad\.active\)>.topbar/);
 assert.match(art,/#squad\.squad-screen\.active/);
 assert.doesNotMatch(art,/#home\.hq-screen|#collection\.roster-screen|#heroDetail|#battle/);
 assert.match(html,/id="accountStatus"/);
});
test("UIHERO002 maintains five slots, the actual leader, disabled locked heroes and squad controls",()=>{
 for(const id of ["squadBack","squadRoster","squadSlots","squadCount","squadHint","squadWarning","squadDisband","squadStart","battleLoadError","retryBattleLoad"]){
  assert.ok(html.includes('id="'+id+'"'),id+" retained");
 }
 assert.match(js,/const isLeader=selectedLeaderId===h\.id/);
 assert.match(js,/aria-pressed="\$\{active\}"/);
 assert.match(js,/\$\{owned\?"":"disabled"\}/);
 assert.match(js,/if\(i===0\)return \`<div class="squad-slot squad-slot-leader/);
 assert.match(js,/slots\[occupied\]=null/);
 assert.match(js,/selectedLeaderId=slots\[0\]/);
 assert.match(js,/selectedPartyIds=slots\.slice\(1\)/);
 assert.match(js,/saveSquad\(\)/);
 assert.match(js,/\$\("#squadStart"\)\.disabled=chosen\.length===0/);
});
test("UIHERO002 visibly separates leader, selected, empty and locked states",()=>{
 assert.match(art,/#squad \.squad-slot-leader\.filled/);
 assert.match(art,/#squad \.squad-choice\.chosen/);
 assert.match(art,/#squad \.squad-choice\.hero-locked:disabled/);
 assert.match(art,/#squad \.squad-start:disabled/);
 assert.match(art,/#squad \.squad-warning/);
});
test("UIHERO002 keeps touch, landscape and reduced motion rules",()=>{
 assert.match(art,/@media\(orientation:landscape\) and \(max-height:540px\)/);
 assert.match(art,/min-height:44px/);
 assert.match(art,/#squad button:focus-visible/);
 assert.match(art,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(art,/padding-inline:max\(12px,env\(safe-area-inset-left\)\)/);
});
test("UIHERO002 candidate version matches build",()=>{
 assert.equal(JSON.parse(read("package.json")).version,"0.3.100");
 assert.match(html,/v0\.3\.100 · UIMODES001C/);
});
