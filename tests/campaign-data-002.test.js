"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"..");
const sources=["mission-data.js","campaign-core.js","campaign-data.js"].map(f=>fs.readFileSync(path.join(root,f),"utf8")).join("\n");
const {MissionData,CampaignCore,CampaignData}=vm.runInNewContext(sources+"\n({MissionData,CampaignCore,CampaignData})");
const first=CampaignData.getMission("black-pass-ambush");
assert.ok(first);
assert.equal(first.chapterId,"chapter-1");
assert.equal(first.routeId,"main");
assert.equal(CampaignData.allChapters().length,1,"do not invent story chapters");
assert.equal(CampaignData.missions("chapter-1").length,3,"three playable demo missions");
assert.equal(CampaignData.missions("missing").length,0);
assert.equal(CampaignData.catalogIsValid(),true);
const progress=CampaignCore.fresh();
assert.equal(CampaignData.available(first,progress),true);
assert.equal(CampaignData.available(null,progress),false);
assert.equal(CampaignData.chapterProgress("chapter-1",progress).total,3);
assert.equal(CampaignData.chapterProgress("chapter-1",progress).stars,0);
progress.completed[first.missionId]=true;progress.bestStars[first.missionId]=2;
let stats=CampaignData.chapterProgress("chapter-1",progress);
assert.equal(stats.completed,1);assert.equal(stats.stars,2);assert.equal(stats.maxStars,9);
// Model-only validation of future chapter and independent optional route. No such missions are published.
const chapters=[{id:"c1",order:1},{id:"c2",order:2}];
const routes=[{id:"main",chapterId:"c1",kind:"main"},{id:"side",chapterId:"c2",kind:"optional"}];
const entries=[
 {missionId:"a",chapterId:"c1",routeId:"main",requiredMissionIds:[]},
 {missionId:"b",chapterId:"c1",routeId:"main",requiredMissionIds:["a"]},
 {missionId:"c",chapterId:"c2",routeId:"side",requiredMissionIds:["a"]}
];
assert.equal(CampaignData.catalogIsValid(chapters,routes,entries),true);
const a=entries[0],b=entries[1],c=entries[2],future={completed:{a:false,b:false,c:false}};
assert.equal(CampaignData.available(a,future),true);
assert.equal(CampaignData.available(b,future),false);
assert.equal(CampaignData.available(c,future),false);
future.completed.a=true;
assert.equal(CampaignData.available(b,future),true);
assert.equal(CampaignData.available(c,future),true,"optional branch opens independently of main mission b");
assert.equal(CampaignData.catalogIsValid(chapters,routes,[{...entries[0],requiredMissionIds:["b"]},entries[1],entries[2]]),false,"cycles are forbidden");
assert.equal(CampaignData.catalogIsValid(chapters,routes,[entries[0],{...entries[1],requiredMissionIds:["unknown"]},entries[2]]),false);
assert.equal(CampaignData.catalogIsValid(chapters,routes,[entries[0],{...entries[1],routeId:"side"},entries[2]]),false,"route and chapter mismatch");
// Existing saved stars and completion survive opening the generated chapter list.
const storage=new Map();
const api={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
assert.equal(CampaignCore.save(progress,()=>api),true);
const loaded=CampaignCore.load(()=>api).campaign;
assert.equal(CampaignData.chapterProgress("chapter-1",loaded).stars,2);
const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
assert.match(html,/id="campaignMissions"/);
assert.match(html,/src="campaign-data.js"/);
assert.match(html,/id="buildVersion"[^>]*>Прототип · v0[.]3[.]96 · UISYS001C/);
console.log("Campaign-Data-002 catalog, prerequisites, branches, completion and persistence passed");
