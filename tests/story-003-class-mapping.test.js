const __BUILD_VERSION_FOR_TESTS=require("../package.json").version;
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const read=name=>fs.readFileSync(path.join(__dirname,"..",name),"utf8");
const {GearData,StoryTrialData}=vm.runInNewContext(
 read("gear-data.js")+"\n"+read("story-trial-data.js")+"\n({GearData,StoryTrialData})");
const classIds=Array.from(GearData.CLASS_IDS);
assert.deepEqual(classIds,["melee","ranged","mage","support","tank"],"only approved five classes");
const heroes=StoryTrialData.heroes();
assert.equal(heroes.length,3);
assert.deepEqual(Array.from(heroes.map(h=>[h.id,h.classId])),[
 ["trial-ren","melee"],["trial-nada","support"],["trial-liora","tank"]
],"test-only characters map to existing class identifiers");
for(const hero of heroes){
 assert.ok(classIds.includes(hero.classId),"no new role/identifier");
 assert.ok(hero.role.includes("· проба"),"provisional role must be visibly labeled");
 assert.ok(hero.hp>0&&hero.atk>0&&hero.speed>0);
 for(const slot of GearData.SLOTS){
  assert.ok(GearData.offered(hero.classId,slot.id,1).length>0,
   "existing G1 compatibility table contains a class-compatible item for "+hero.id+"/"+slot.id);
 }
}
assert.ok(heroes[0].role.includes("Боец ближнего боя"));
assert.ok(heroes[1].role.includes("Поддержка"));
assert.ok(heroes[2].role.includes("Танк"));
assert.deepEqual(Array.from(StoryTrialData.heroes().map(h=>[h.hp,h.atk,h.speed])),[
 [91,27,150],[85,18,120],[116,20,105]
],"class assignment does not rebalance approved STORY002 trial values");
const permanent=read("hero-collection-core.js"),v3=read("progress-v3-core.js");
for(const id of ["trial-ren","trial-nada","trial-liora"]){
 assert.ok(!permanent.includes(id),"do not add literature to permanent collection without save migration");
 assert.ok(!v3.includes(id),"do not add literature IDs to v3 save validation");
}
const pkg=JSON.parse(read("package.json")),html=read("index.html");
assert.equal(pkg.version,`${__BUILD_VERSION_FOR_TESTS}`);
assert.ok(html.includes(`v${__BUILD_VERSION_FOR_TESTS} · UIHUD001`));
console.log("STORY-003: approved class vocabulary, proposed trial mappings, gear compatibility and unchanged saves verified");
