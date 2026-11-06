"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const source = ["mission-data.js", "campaign-data.js"].map(file =>
  fs.readFileSync(path.join(root, file), "utf8")).join("\n");
const {MissionData, CampaignData} = vm.runInNewContext(
  source + "\n({MissionData, CampaignData})");

assert.equal(CampaignData.catalogIsValid(), true, "campaign graph must be valid");
const entries = CampaignData.allChapters().flatMap(chapter => CampaignData.missions(chapter.id));
const ids = new Set(entries.map(entry => entry.missionId));
assert.equal(ids.size, entries.length, "one catalog entry per mission ID");
assert.ok(entries.length > 0);
for (const entry of entries) {
  const mission = MissionData.get(entry.missionId);
  assert.ok(mission, "catalog mission lacks a playable definition: " + entry.missionId);
  assert.equal(mission.id, entry.missionId);
  assert.equal(mission.chapterId, entry.chapterId, "chapter mismatch: " + entry.missionId);
  assert.equal(mission.branchId, entry.routeId, "route mismatch: " + entry.missionId);
  assert.equal(mission.stars.length, 3, "expected three mission ratings");
  for (const star of mission.stars) {
    assert.ok(Array.isArray(star.conditions) && star.conditions.length > 0);
    assert.ok(star.conditions.some(rule => rule.type === "victory"),
      "a star must require victory");
  }
}
for (const mission of MissionData.all())
  assert.ok(ids.has(mission.id), "playable mission not registered in catalog: " + mission.id);

// Simulate a future second mission WITHOUT adding any content to the shipped catalog.
// A v2 local save from the previous one-mission build must keep its stars and
// initialize the newly registered mission as incomplete.
const fakeMissionData = {
  all: () => [{id:"first"}, {id:"second"}],
  score: (id, battle) => battle && battle.winner === "ally" && !battle.active ? 2 : 0
};
const campaignSource = fs.readFileSync(path.join(root, "campaign-core.js"), "utf8");
const core = vm.runInNewContext(campaignSource + "\nCampaignCore",
  {MissionData:fakeMissionData});
const saved = JSON.stringify({version:2,completed:{first:true},bestStars:{first:3}});
const store = new Map([[core.KEY,saved]]);
const storage = {getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value)};
const restored = core.load(()=>storage);
assert.equal(restored.available,true);
assert.equal(restored.campaign.completed.first,true);
assert.equal(restored.campaign.bestStars.first,3);
assert.equal(restored.campaign.completed.second,false);
assert.equal(restored.campaign.bestStars.second,0);
assert.equal(core.save(restored.campaign,()=>storage),true);
const again = core.load(()=>storage).campaign;
assert.equal(again.bestStars.first,3);
assert.equal(again.bestStars.second,0);
const result = core.recordResult(again,"second",{winner:"ally",active:false});
assert.equal(result.earned,2);
assert.equal(again.completed.second,true);
assert.equal(again.bestStars.first,3,"new completion must not overwrite old stars");
assert.equal(core.save(again,()=>storage),true);
const final = core.load(()=>storage).campaign;
assert.equal(final.bestStars.first,3);
assert.equal(final.bestStars.second,2);
assert.equal(core.KEY,"ashes-throne.campaign.v1","preserve existing storage key");
console.log("Campaign-Content-003 readiness: catalog linkage and save extension passed");
