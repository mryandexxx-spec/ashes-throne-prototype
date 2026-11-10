"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const css=read("styles.css"),html=read("index.html"),js=read("game.js");
const start=css.indexOf("/* UI-SYSTEMS-001B");
const art=css.slice(start,css.indexOf("/* UI-SYSTEMS-001C",start));
test("UIMODES001C uses painted HQ and compact HUD only in daily tasks",()=>{
 assert.ok(start>0);
 assert.match(art,/body:has\(#dailyTasks\.active\)::before/);
 assert.match(art,/url\("assets\/hq-hall-painting-mobile\.webp"\)/);
 assert.match(art,/#app:has\(#dailyTasks\.active\)>.topbar/);
 assert.match(art,/#dailyTasks\.screen\.active/);
 assert.doesNotMatch(art,/#home\.hq-screen|#collection\.roster-screen|#heroDetail|#squad|#battle|#loginCalendar/);
});
test("UIMODES001C retains reward collection, live feedback, and local day",()=>{
 for(const id of ["dailyTasks","dailyDay","dailyClaimAll","dailyTaskList","dailyTaskNotice"]){
  assert.ok(html.includes('id="'+id+'"'),id+" retained");
 }
 assert.match(js,/function renderDailyTasks\(\)/);
 assert.match(js,/const day=dailyDay\(\)/);
 assert.match(js,/DailyCore\.unclaimedCount\(progress,day\)===0/);
 assert.match(js,/DailyCore\.claim\(progress,button\.dataset\.dailyClaim,day\)/);
 assert.match(js,/DailyCore\.claimAll\(progress,day\)/);
 assert.match(js,/if\(!persistProgress\(\)\)/);
 assert.match(js,/renderDailyTasks\(\);renderDailyClaimBadge\(\)/);
 assert.match(art,/#dailyTasks \.daily-task button:disabled/);
 assert.match(art,/#dailyTasks #dailyTaskNotice/);
});
test("UIMODES001C keeps mobile touch, scroll and accessible status",()=>{
 assert.match(art,/@media\(orientation:landscape\) and \(max-height:540px\)/);
 assert.match(art,/min-height:44px/);
 assert.match(art,/#dailyTasks button:focus-visible/);
 assert.match(art,/padding-inline:max\(12px,env\(safe-area-inset-left\)\)/);
 assert.match(art,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(html,/id="dailyTaskNotice"[^>]*role="status" aria-live="polite"/);
});
test("UIMODES001C candidate version matches package and footer",()=>{
 assert.equal(JSON.parse(read("package.json")).version,"0.3.102");
 assert.match(html,/v0\.3\.102 · UISTORY001/);
});
