"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");

test("NET-UX-008: decision consequences have stable UI hosts and preserve existing actions",()=>{
 const html=read("index.html"),ui=read("network-pilot-ui.js");
 for(const id of ["netuxSelectedCause","netuxBriefEnemies","netuxDecisionPreview",
  "netuxResultCauses","netuxBriefReward","netuxBriefThreat","net004Choices",
  "net004Fight","net004Cancel","net004Finish"]){
  assert.equal((html.match(new RegExp('id="'+id+'"',"g"))||[]).length,1,id);
 }
 assert.ok(html.includes('aria-label="Оперативная сводка"'));
 assert.ok(html.includes('aria-label="Почему получен такой результат"'));
 for(const action of ["prepare","approach","fight","abandon","finish"])
  assert.ok(ui.includes('"'+action+'"'),action);
 assert.ok(ui.includes("session.change(action,value)"));
 assert.ok(ui.includes("session.collect()"));
});

test("NET-UX-008: copy exposes real effects without inventing reward or intel bonuses",()=>{
 const ui=read("network-pilot-ui.js"),week=read("weekly-threat-ui.js"),html=read("index.html");
 assert.ok(ui.includes("Физическая атака всех врагов −10%"));
 assert.ok(ui.includes("Отдельного бонуса к награде нет"));
 assert.ok(ui.includes("Базовая награда не зависит от подхода"));
 assert.ok(ui.includes("Симуляция: та же базовая награда, но без сведений"));
 assert.ok(ui.includes("Math.max(90,s.config.masteryScore)"));
 assert.ok(ui.includes("дополнительного усиления нет"));
 assert.ok(week.includes('intel>=2?"−24%":"−10%"'));
 assert.ok(week.includes('intel>=2?"−22%":"−10%"'));
 assert.ok(week.includes("третье сведение — запас без дополнительного эффекта"));
 assert.ok(html.includes("СВЕДЕНИЯ · УСИЛЕНИЕ ОТ 2"));
 assert.ok(!ui.includes("NetworkRewardCore.claim("));
});

test("NET-UX-008: S1 receipt uses the existing formula and real wave observations",()=>{
 const ui=read("network-pilot-ui.js"),Score=require("../network-score-core.js");
 assert.ok(ui.includes("25*(1-wave.knockedOut/wave.deployed)"));
 assert.ok(ui.includes("wave.allyActions-wave.paceBudget"));
 assert.ok(ui.includes("wave.objectiveDone?10:0"));
 const summary={version:1,wave:0,deployed:4,knockedOut:1,allyActions:12,
  paceBudget:10,objectiveEnemyId:"npc-test",objectiveDone:false,score:78};
 // 60 + 19 survival + 0 objective + 3 pace = 82; reject a hand-written fake receipt.
 assert.equal(Score.validSummary(summary),false);
 summary.score=82;
 assert.equal(Score.validSummary(summary),true);
 assert.equal(Score.finalScore([summary]),82);
});

test("NET-UX-008: build version and cache keys are synchronized",()=>{
 const html=read("index.html"),pkg=JSON.parse(read("package.json"));
 assert.equal(pkg.version,"0.3.218");
 assert.ok(html.includes('id="buildVersion">Прототип · v0.3.218 · NETUXCLR008'));
 assert.ok(html.includes('src="network-pilot-ui.js?v=0.3.218"'));
 assert.ok(html.includes('src="weekly-threat-ui.js?v=0.3.218"'));
 assert.ok(!html.includes("v=0.3.217"));
});
