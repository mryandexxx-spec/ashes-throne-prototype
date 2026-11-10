"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const css=read("styles.css"),html=read("index.html"),game=read("game.js");
const start=css.indexOf("/* UI-MODES-001C");
const art=css.slice(start);
test("UIMODES001C applies the established HQ visual language to both operational screens",()=>{
 assert.ok(start>0);
 assert.match(art,/body:has\(#operations\.active\),body:has\(#signalOperations\.active\)/);
 assert.match(art,/url\("assets\/hq-hall-painting-mobile\.webp"\)/);
 assert.match(art,/#app:has\(#operations\.active\)>.topbar/);
 assert.match(art,/#app:has\(#signalOperations\.active\)>.topbar/);
 assert.match(art,/#operations\.screen\.active,#signalOperations\.screen\.active/);
 assert.match(art,/#operations \.ops-node/);
 assert.match(art,/#signalOperations \.sig-guard/);
 assert.match(art,/#signalOperations \.sig-beacon/);
 assert.doesNotMatch(art,/#campaign\s|#challenges\s|#battle\s|#home\s/);
});
test("UIMODES001C retains both independent route maps, actions, and local outcomes",()=>{
 for(const id of ["operations","opsGuide","opsNorth","opsSouth","opsJunction","opsActions","opsSaveStatus","operationResult","signalOperations","signalGuide","sigActions","sigSaveStatus","signalOperationResult"])
  assert.ok(html.includes('id="'+id+'"'),id+" retained");
 assert.match(game,/function renderOperations\(\)/);
 assert.match(game,/function renderSignalOperations\(\)/);
 assert.match(game,/OperationCore\.availableOrders\(run\)/);
 assert.match(game,/OperationCore\.targetAssessment\(run,/);
 assert.match(game,/SignalOperationCore\.chooseAssault\(run,/);
 assert.match(game,/openSquad\("operations"\)/);
 assert.match(game,/openSquad\("signalOperations"\)/);
 assert.match(game,/function renderOperationResult\(\)/);
 assert.match(game,/function renderSignalOperationResult\(\)/);
 assert.match(game,/operationSaveBlocked/);
 assert.match(game,/signalSaveBlocked/);
});
test("UIMODES001C keeps training labels, accessible help and mobile safeguards",()=>{
 assert.match(html,/НЕКАНОНИЧЕСКИЙ ПИЛОТ/);
 assert.match(html,/без расхода энергии и без экономических наград/);
 assert.match(html,/<details class="ops-guide" id="opsGuide"/);
 assert.match(html,/<details class="ops-guide" id="signalGuide"/);
 assert.match(art,/@media\(orientation:landscape\) and \(max-height:540px\)/);
 assert.match(art,/padding-inline:max\(12px,env\(safe-area-inset-left\)\)/);
 assert.match(art,/min-height:44px/);
 assert.match(art,/:is\(#operations,#signalOperations\) button:focus-visible/);
 assert.match(art,/@media\(prefers-reduced-motion:reduce\)/);
});
test("UIMODES001C build identifier is synchronized",()=>{
 assert.equal(JSON.parse(read("package.json")).version,"0.3.103");
 assert.match(html,/v0\.3\.103 · UIHUD001/);
});
