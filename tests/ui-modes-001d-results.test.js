"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
const css=read("styles.css"),html=read("index.html"),game=read("game.js");
const art=css.slice(css.indexOf("/* UI-MODES-001D"),css.indexOf("/* UI-STORY-001"));
const ids=["missionResult","challengeResult","operationResult","signalOperationResult"];

test("UIMODES001D gives four results a common, contained HQ scene",()=>{
 assert.ok(css.includes("/* UI-MODES-001D"));
 for(const id of ids){
  assert.match(html,new RegExp('<section id="'+id+'" class="screen mission-result-screen"'));
  assert.ok(html.includes('id="'+id+'"'),id+" is not lost");
  assert.ok(art.includes("#"+id),id+" is scoped");
 }
 assert.match(art,/url\("assets\/hq-hall-painting-mobile\.webp"\)/);
 assert.match(art,/\.mission-result-card h2/);
 assert.match(art,/\.mission-result-actions button/);
 assert.doesNotMatch(art,/function render|data-ops-order|data-sig-prep/);
});
test("UIMODES001D preserves real mission and challenge rewards, stars, retry links",()=>{
 for(const id of ["missionResultText","missionResultStars","missionResultBack","missionResultRetry","missionResultHome",
                  "challengeResultText","challengeResultStars","challengeResultBack","challengeResultRetry","challengeResultHome"])
  assert.ok(html.includes('id="'+id+'"'),id+" retained");
 assert.match(game,/function renderMissionResult\(\)/);
 assert.match(game,/lastMissionFarmReward/);
 assert.match(game,/lastMissionReward/);
 assert.match(game,/missionResultSaveFailed/);
 assert.match(game,/campaignProgress\.bestStars\[activeMissionId\]/);
 assert.match(game,/function renderChallengeResult\(\)/);
 assert.match(game,/challengeProgress\.bestStars\[activeChallengeId\]/);
 assert.match(game,/openCampaignMission\(activeMissionId\)/);
 assert.match(game,/openChallenge\(activeChallengeId\)/);
 assert.match(game,/showScreen\("campaign"\)/);
 assert.match(game,/showScreen\("challenges"\)/);
});
test("UIMODES001D preserves distinct operation outcomes and controls",()=>{
 for(const id of ["operationResultTitle","operationResultText","operationResultStatus","operationResultAgain",
                  "operationResultBack","operationResultHome","sigResultTitle","sigResultText","sigResultStatus",
                  "sigResultAgain","sigResultBack","sigResultHome"])
  assert.ok(html.includes('id="'+id+'"'),id+" retained");
 assert.match(game,/function renderOperationResult\(\)/);
 assert.match(game,/function renderSignalOperationResult\(\)/);
 assert.match(game,/operationProgress\.history/);
 assert.match(game,/signalProgress\.history/);
 assert.match(game,/showScreen\("operations"\)/);
 assert.match(game,/showScreen\("signalOperations"\)/);
 assert.match(html,/УЧЕБНАЯ ОПЕРАЦИЯ/);
});
test("UIMODES001D preserves short landscape, touch, focus, and version",()=>{
 assert.match(art,/@media\(orientation:landscape\) and \(max-height:540px\)/);
 assert.match(art,/padding-inline:max\(12px,env\(safe-area-inset-left\)\)/);
 assert.match(art,/min-height:44px/);
 assert.match(art,/button:focus-visible/);
 assert.match(art,/@media\(prefers-reduced-motion:reduce\)/);
 assert.equal(JSON.parse(read("package.json")).version,"0.3.107");
 assert.match(html,/v0\.3\.107 · UIHUD001/);
});
