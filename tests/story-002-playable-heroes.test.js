"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const {StoryTrialData,AbilityData,CombatCore}=vm.runInNewContext(
 ["initiative-model.js","ability-data.js","battle-rng.js","combat-core.js","story-trial-data.js"].map(read).join("\n")+"\n({StoryTrialData,AbilityData,CombatCore})");
const heroes=StoryTrialData.heroes();
assert.equal(heroes.length,3);
assert.deepEqual(Array.from(heroes.map(x=>x.id)),["trial-ren","trial-nada","trial-liora"]);
assert.ok(heroes.every(h=>h.side==="ally"&&h.hp>0&&h.atk>0&&h.speed>0));
assert.notEqual(StoryTrialData.heroes()[0],StoryTrialData.heroes()[0],"trial heroes copied per encounter");
for(const h of heroes){
 assert.equal(AbilityData.get(h,"basic").kind,"damage");
 assert.ok(AbilityData.get(h,"special"));
 assert.ok(AbilityData.get(h,"powerful"));
 assert.ok(AbilityData.get(h,"passive"));
 assert.equal(AbilityData.get(h,"leader"),null);
}
assert.equal(AbilityData.get(heroes[0],"special").weakening,2);
assert.equal(AbilityData.get(heroes[1],"special").weakening,2);
assert.equal(AbilityData.get(heroes[2],"special").target,"ally");
assert.equal(AbilityData.get(heroes[2],"special").kind,"guard");
const foes=[{id:"trial-enemy-a",side:"enemy",name:"Охранник A",hp:70,atk:14,speed:110},
{id:"trial-enemy-b",side:"enemy",name:"Охранник B",hp:70,atk:14,speed:112}];
const battle=CombatCore.createBattle([...heroes,...foes],[],{leaderId:null});
CombatCore.advanceToPlayerTurn(battle);
assert.ok(battle.active);
assert.equal(battle.fighters.filter(f=>f.side==="ally").length,3);
assert.equal(battle.fighters.filter(f=>f.side==="enemy").length,2);
const game=read("game.js"),html=read("index.html"),pkg=JSON.parse(read("package.json"));
assert.match(game,/if\(battleIsStoryDemo&&storyTrialParty\)/);
assert.match(game,/StoryTrialData\.heroes\(\)/);
assert.match(game,/storyTrialParty&&battleIsStoryDemo\?null:selectedLeaderId/);
assert.match(html,/id="storyDemoTrialFight"/);
assert.match(html,/src="story-trial-data.js"/);
assert.ok(!read("hero-collection-core.js").includes("trial-ren"));
assert.ok(!read("progress-v3-core.js").includes("trial-ren"));
assert.ok(!read("campaign-data.js").includes("trial-ren"));
assert.equal(pkg.version,"0.3.92");
assert.match(html,/v0\.3\.92 · UIHERO001/);
console.log("STORY-002: 3 trial-only playable heroes, effects, arena setup and save isolation passed");
