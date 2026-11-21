"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const read=pathName=>fs.readFileSync(path.join(__dirname,"..",pathName),"utf8");
const Core=require("../network-core.js"),Data=require("../network-data.js"),
 Score=require("../network-score-core.js"),Weekly=require("../weekly-threat-core.js");
test("NET-UX-006: briefing, result and weekly layouts retain existing actions and phase ids",()=>{
 const html=read("index.html"),ui=read("network-pilot-ui.js"),
  weekUi=read("weekly-threat-ui.js"),css=read("network-pilot.css");
 for(const id of ["net004Active","net004ActiveTitle","net004ActiveDetail","net004Choices",
  "netuxBriefStage","netuxBriefMeta","netuxBriefIntel","netuxBriefReward","netuxBriefThreat",
  "net004Result","net004ResultDetail","netuxResultRating","netuxResultMastery",
  "netuxResultIntel","netuxResultReward","net004Finish","net008aThreat",
  "net008aSurvey","net008aCover","net008aFight","net008aAbandon","net008aCollect",
  "net008aDevelop","net008aStatus","net008aRewards","netuxWeeklyIntel","netuxWeeklyIntelMeter",
  "netuxWeeklyAttempts","netuxWeeklyBest","netuxWeeklyTier1","netuxWeeklyTier2","netuxWeeklyTier3"]){
  assert.equal((html.match(new RegExp('id="'+id+'"',"g"))||[]).length,1,id);
 }
 assert.match(html,/class="netux-brief-grid"/);
 assert.match(html,/class="netux-result-grid"/);
 assert.match(html,/class="netux-weekly-grid"/);
 assert.match(ui,/session\.change\(action,value\)/);
 assert.match(ui,/session\.canSimulate\(selected\.id\)/);
 assert.match(ui,/a\.phase==="brief"/);
 assert.match(ui,/a\.phase==="approach"/);
 assert.match(ui,/a\.phase!=="battle"/);
 assert.match(ui,/s\.active\?\.phase==="result"/);
 assert.match(weekUi,/WeeklyThreatCore\.TIERS\.forEach/);
 assert.match(weekUi,/session\.pending\(\)/);
 assert.match(css,/\.netux-brief-grid/);
 assert.match(css,/\.netux-weekly-facts/);
 assert.match(css,/min-height:44px/);
 assert.match(css,/overflow-y:auto/);
 assert.equal(JSON.parse(read("package.json")).version,"0.3.221");
 assert.ok(html.includes('id="buildVersion">Прототип · v0.3.221 · SQUADUX001'));
});
test("NET-UX-006: reward and combat engine files remain unchanged by UI workflow",()=>{
 const ui=read("network-pilot-ui.js"),week=read("weekly-threat-ui.js");
 assert.ok(ui.includes("session.collect()"));
 assert.ok(ui.includes('void change(action,arg)'));
 assert.ok(week.includes("session.finish(battle)"));
 assert.ok(week.includes("session.collect()"));
 assert.ok(!ui.includes("NetworkRewardCore.claim("));
 assert.ok(!week.includes("RewardPolicyCore.claim("));
 assert.equal(Weekly.TIERS.length,3);
 const first=Weekly.TIERS[0];
 assert.equal(first.score,60);
 assert.equal(first.currency,5000);
});
test("NET-UX-006: real existing clue state machine and S1 checkpoint support report",()=>{
 const region=["gardens-over-abyss"],config={...require("../network-pilot-session.js").LIVE_CONFIG};
 let s=Core.fresh(123,0,config,Data.LIVE_CATALOG);
 s=Core.accrue(s,4*config.intervalMs,Data.LIVE_CATALOG,region);
 const c=s.board[0],before=JSON.stringify(s.board);
 s=Core.start(s,c.id);
 assert.equal(s.active.phase,"brief");
 const p=s.active.clue.preparationIds[0],a=s.active.clue.approaches.find(x=>x.waves===1);
 assert.ok(a);
 s=Core.prepare(s,p);assert.equal(s.active.phase,"approach");
 s=Core.approach(s,a.id);assert.equal(s.active.phase,"battle");
 const summary={version:1,wave:0,deployed:1,knockedOut:0,allyActions:1,
  paceBudget:5,objectiveEnemyId:"npc-test",objectiveDone:true,score:100};
 assert.equal(Score.validSummary(summary),true);
 s=Core.battleOutcome(s,c.id,0,true,100,summary);
 assert.equal(s.active.phase,"result");
 assert.equal(s.active.score,100);
 assert.equal(s.active.waveSummaries.length,1);
 assert.equal(Core.validState(s),true);
 assert.equal(s.completed.length,0,"report is not yet an awarded completion");
 assert.equal(s.board.length,JSON.parse(before).length-1,"one clue held as active");
});
