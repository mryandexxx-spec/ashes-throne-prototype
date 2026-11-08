"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"..");
const read=name=>fs.readFileSync(path.join(root,name),"utf8");
const {MissionData,CampaignData,CampaignCore,ProgressCore}=vm.runInNewContext(
 ["mission-data.js","campaign-data.js","campaign-core.js","progress-core.js"].map(read).join("\n")+
 "\n({MissionData,CampaignData,CampaignCore,ProgressCore})"
);
const first="black-pass-ambush",second="demo-mission-2";
assert.equal(CampaignData.catalogIsValid(),true);
assert.equal(MissionData.all().length,3);
assert.equal(CampaignData.getMission(second).order,2);
assert.deepEqual(Array.from(CampaignData.getMission(second).requiredMissionIds),[first]);
assert.equal(MissionData.get(second).title,"Демонстрационная миссия #2");
assert.equal(CampaignData.getMission(second).description,"Заглушка под описание сюжета миссии #2");
const progress=CampaignCore.fresh();
assert.equal(CampaignData.available(CampaignData.getMission(second),progress),false);
const allies=[{side:"ally",hp:10},{side:"ally",hp:10}];
const battle=(actions,dead=false)=>({active:false,winner:"ally",allyActions:actions,
 fighters:dead?[{side:"ally",hp:0},allies[1]]:allies});
assert.equal(MissionData.score(second,battle(9)),3);
assert.equal(MissionData.score(second,battle(10)),2);
assert.equal(MissionData.score(second,battle(9,true)),1);
assert.equal(MissionData.score(first,battle(9)),2);
assert.equal(MissionData.score(first,battle(8)),3);
assert.equal(MissionData.score(second,{...battle(9),winner:"enemy"}),0);
let result=CampaignCore.recordResult(progress,first,battle(8));
assert.equal(result.earned,3);
assert.equal(CampaignData.available(CampaignData.getMission(second),progress),true);
result=CampaignCore.recordResult(progress,second,battle(10));
assert.equal(result.best,2);
result=CampaignCore.recordResult(progress,second,battle(9));
assert.equal(result.best,3);
result=CampaignCore.recordResult(progress,second,battle(10));
assert.equal(result.best,3,"replay must not lower stars");
assert.equal(CampaignData.chapterProgress("chapter-1",progress).completed,2);
assert.equal(CampaignData.chapterProgress("chapter-1",progress).stars,6);
const oldSave=JSON.stringify({version:2,completed:{[first]:true},bestStars:{[first]:3}});
const storage=new Map([[CampaignCore.KEY,oldSave]]);
const adapter={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
const restored=CampaignCore.load(()=>adapter).campaign;
assert.equal(restored.bestStars[first],3);
assert.equal(restored.bestStars[second],0);
assert.equal(CampaignCore.save(restored,()=>adapter),true);
assert.equal(CampaignCore.load(()=>adapter).campaign.bestStars[first],3);
assert.equal(CampaignCore.load(()=>adapter).campaign.bestStars[second],0);
// New first-clear reward is idempotent and separate from campaign star evaluation.
const economy=ProgressCore.createProgress([{id:"ally",side:"ally"}]);
const simulated={winner:"ally",active:false};
assert.equal(ProgressCore.claimFirstClear(economy,first,simulated).currency,500);
assert.equal(ProgressCore.claimFirstClear(economy,first,simulated),null);
assert.equal(economy.currency,500);
assert.equal(progress.bestStars[second],3);
// Confirm the original first encounter retains exactly two enemies.
const game=read("game.js");
assert.match(game,/activeMissionId==="demo-mission-2"\?ENEMIES:ENEMIES\.slice\(0,2\)/);
assert.equal((game.match(/side:"enemy",glyph:/g)||[]).length,5);
assert.match(game,/campaignProgress\.bestStars\[id\]!==3/);
assert.match(game,/data-simulate-mission/);
const html=read("index.html");
assert.match(html,/id="simulationDialog"/);
assert.match(html,/v0[.]3[.]67 · CHAL001B/);
console.log("Campaign-Content-003 demo: catalog, stars, save, reward and roster assertions passed");
