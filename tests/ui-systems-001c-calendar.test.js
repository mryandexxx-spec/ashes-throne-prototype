"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const css=read("styles.css"),html=read("index.html"),js=read("game.js");
const start=css.indexOf("/* UI-SYSTEMS-001C");
const art=css.slice(start,css.indexOf("/* UI-MODES-001A",start));
test("UISYS001C calendar uses the accepted HQ visual system only for its screen",()=>{
 assert.ok(start>0);
 assert.match(art,/body:has\(#loginCalendar\.active\)::before/);
 assert.match(art,/url\("assets\/hq-hall-painting-mobile\.webp"\)/);
 assert.match(art,/#app:has\(#loginCalendar\.active\)>.topbar/);
 assert.match(art,/#loginCalendar\.screen\.active/);
 assert.doesNotMatch(art,/#dailyTasks|#playerProfile|#collection|#heroDetail|#squad|#battle/);
});
test("UISYS001C retains dynamic month, real days, claim state, and failure rollback",()=>{
 for(const id of ["loginCalendar","loginCalendarMonth","loginCalendarGrid","loginClaim","loginCalendarStatus"])
  assert.ok(html.includes('id="'+id+'"'),id+" retained");
 assert.match(js,/function renderLoginCalendar\(\)/);
 assert.match(js,/LoginCore\.current\(progress,day\)/);
 assert.match(js,/LoginCore\.rewardForDay\(i\+1\)/);
 assert.match(js,/claimedThisMonth/);
 assert.match(js,/LoginCore\.claim\(progress,dailyDay\(\)\)/);
 assert.match(js,/if\(!persistProgress\(\)\)/);
 assert.match(js,/Награда не выдана/);
 assert.match(art,/#loginCalendar \.login-day\.claimed/);
 assert.match(art,/#loginCalendar \.login-day\.active/);
 assert.match(art,/#loginCalendar #loginClaim:disabled/);
 assert.match(html,/id="loginCalendarStatus"[^>]*role="status" aria-live="polite"/);
});
test("UISYS001C has narrow landscape, safe-area, touch, and accessibility styles",()=>{
 assert.match(art,/@media\(orientation:landscape\) and \(max-height:540px\)/);
 assert.match(art,/grid-template-columns:repeat\(7,minmax\(0,1fr\)\)/);
 assert.match(art,/min-height:44px/);
 assert.match(art,/padding-inline:max\(12px,env\(safe-area-inset-left\)\)/);
 assert.match(art,/#loginCalendar button:focus-visible/);
 assert.match(art,/@media\(prefers-reduced-motion:reduce\)/);
});
test("UIMODES001B candidate build is synchronized",()=>{
 assert.equal(JSON.parse(read("package.json")).version,"0.3.99");
 assert.match(html,/v0\.3\.99 · UIMODES001B/);
});
