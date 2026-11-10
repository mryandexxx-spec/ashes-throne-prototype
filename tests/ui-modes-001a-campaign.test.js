"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const css=read("styles.css"),html=read("index.html"),js=read("game.js");
const start=css.indexOf("/* UI-MODES-001A");
const art=css.slice(start);

test("UIMODES001B keeps campaign in the accepted HQ visual language",()=>{
 assert.ok(start>0);
 assert.match(art,/body:has\(#campaign\.active\)::before/);
 assert.match(art,/url\("assets\/hq-hall-painting-mobile\.webp"\)/);
 assert.match(art,/#app:has\(#campaign\.active\)>.topbar/);
 assert.match(art,/#campaign\.screen\.active/);
 assert.match(art,/#campaign \.campaign-chapter/);
 assert.match(art,/#campaign \.campaign-route/);
 assert.match(art,/#campaign \.campaign-mission/);
 assert.doesNotMatch(art,/#dailyTasks|#loginCalendar|#playerProfile|#squad|#battle/);
});

test("UIMODES001B preserves mission, energy, unlock, and 3-star simulation contracts",()=>{
 for(const id of ["campaign","campaignMissions","energyStatus","energyRefresh","energyRefreshStatus","campaignSaveStatus","storyDemoOpen"])
  assert.ok(html.includes('id="'+id+'"'),id+" retained");
 assert.match(js,/function renderCampaign\(\)/);
 assert.match(js,/CampaignData\.allChapters\(\)/);
 assert.match(js,/CampaignData\.available\(entry,campaignProgress\)/);
 assert.match(js,/ProgressCore\.missionEnergyCost\(mission\.id\)/);
 assert.match(js,/best===3\?/);
 assert.match(js,/data-campaign-mission/);
 assert.match(js,/data-simulate-mission/);
 assert.match(js,/function energyRefreshFeedback\(/);
 assert.match(art,/#campaign \.campaign-mission-actions button:disabled/);
 assert.match(art,/#campaign #energyStatus/);
 assert.match(art,/#campaign \.mission-criteria-star/);
 assert.ok(html.includes("[ПРЕДЛОЖЕНИЕ]"));
});

test("UIMODES001B supports short landscape, safe-area and touch targets",()=>{
 assert.match(art,/@media\(orientation:landscape\) and \(max-height:540px\)/);
 assert.match(art,/min-height:44px/);
 assert.match(art,/padding-inline:max\(12px,env\(safe-area-inset-left\)\)/);
 assert.match(art,/#campaign button:focus-visible/);
 assert.match(art,/grid-template-columns:32px minmax\(0,1fr\)/);
 assert.match(art,/@media\(prefers-reduced-motion:reduce\)/);
});

test("UIMODES001B candidate version matches package and footer",()=>{
 assert.equal(JSON.parse(read("package.json")).version,"0.3.99");
 assert.match(html,/v0\.3\.99 · UIMODES001B/);
});
