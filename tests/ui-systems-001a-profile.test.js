"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const css=read("styles.css"),html=read("index.html"),js=read("game.js");
const start=css.indexOf("/* UI-SYSTEMS-001A:");
const art=css.slice(start,css.indexOf("/* UI-SYSTEMS-001B",start));
test("UISYS001A uses HQ painting and compact account HUD on profile only",()=>{
 assert.ok(start>0);
 assert.match(art,/body:has\(#playerProfile\.active\)::before/);
 assert.match(art,/url\("assets\/hq-hall-painting-mobile\.webp"\)/);
 assert.match(art,/#app:has\(#playerProfile\.active\)>.topbar/);
 assert.match(art,/#playerProfile\.player-profile-screen\.active/);
 assert.doesNotMatch(art,/#home\.hq-screen|#collection\.roster-screen|#heroDetail|#squad|#battle/);
});
test("UISYS001A retains nickname saving and actual profile facts",()=>{
 for(const id of ["playerNickname","playerNicknameForm","playerNicknameInput","playerNicknameHint",
   "playerNicknameNotice","playerAccountLevel","playerAccountXpTrack","playerAccountXpFill",
   "playerAccountXpText","playerHeroLevelCap","playerHeroCapNext","playerCompletedMissions",
   "playerCampaignStars","playerHeroCount"]){
  assert.ok(html.includes('id="'+id+'"'),id+" retained");
 }
 assert.match(js,/if\(id==="playerProfile"\)renderPlayerProfile\(\)/);
 assert.match(js,/\$\("#playerNicknameForm"\)\?\.addEventListener\("submit"/);
 assert.match(art,/#playerProfile \.player-profile-editor input/);
 assert.match(art,/#playerProfile \.player-profile-xp-track span/);
 assert.match(art,/#playerProfile \.player-profile-facts>div/);
});
test("UISYS001A keeps compact landscape, touch sizes and keyboard visibility",()=>{
 assert.match(art,/@media\(orientation:landscape\) and \(max-height:540px\)/);
 assert.match(art,/min-height:44px/);
 assert.match(art,/#playerProfile button:focus-visible/);
 assert.match(art,/#playerProfile \.player-profile-editor input:focus-visible/);
 assert.match(art,/padding-inline:max\(12px,env\(safe-area-inset-left\)\)/);
 assert.match(art,/@media\(prefers-reduced-motion:reduce\)/);
});
test("UISYS001A public build is synchronized",()=>{
 assert.equal(JSON.parse(read("package.json")).version,"0.3.100");
 assert.match(html,/v0\.3\.100 · UIMODES001C/);
});
