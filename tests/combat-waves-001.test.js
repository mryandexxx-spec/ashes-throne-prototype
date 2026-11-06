"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"..");
const read=n=>fs.readFileSync(path.join(root,n),"utf8");
const {CombatCore,ProgressCore,CombatLog}=vm.runInNewContext(
 ["initiative-model.js","ability-data.js","combat-core.js","progress-core.js","combat-log.js"].map(read).join("\n")+
 "\n({CombatCore,ProgressCore,CombatLog})"
);
const hero={id:"hero",name:"Герой",side:"ally",hp:300,atk:20,speed:200};
const foe=(id,hp=5)=>({id,name:id,side:"enemy",hp,atk:1,speed:100});
const reward=ProgressCore.createProgress([hero]);
const first=foe("first"),second=foe("second"),third=foe("third");
const fight=CombatCore.createBattle([hero,first],[[second,third]]);
assert.equal(fight.wave,1);
assert.equal(fight.totalWaves,2);
assert.equal(fight.pendingWaves.length,1);
assert.equal(fight.allyActions,0);
CombatCore.advanceToPlayerTurn(fight);
assert.equal(CombatCore.performPlayerAbility(fight,"basic"),true);
assert.equal(fight.wave,2,"defeating wave one must advance, not win");
assert.equal(fight.active,true);
assert.equal(fight.winner,null);
assert.equal(fight.allyActions,1,"actions accumulate across waves");
assert.equal(fight.fighters.filter(f=>f.side==="enemy").length,2);
assert.equal(fight.fighters[0].maxHp,hero.hp,"hero survives the wave transition");
assert.ok(fight.fighters[0].hp>0);
assert.equal(fight.fighters.every((f,i)=>f.index===i),true,"fighter indices reset");
assert.ok(fight.fighters.some(f=>f.side==="enemy"&&f.id==="third"));
assert.ok(fight.events.some(e=>e.type==="wave-start"&&e.wave===2&&e.total===2));
assert.equal(ProgressCore.awardVictory(reward,fight),0,"no reward between waves");
assert.ok(CombatLog.lines(fight.events,fight.fighters).some(line=>line.includes("Волна 2/2")));
let actions=0;
while(fight.active&&actions++<15){
 assert.equal(CombatCore.performPlayerAbility(fight,"basic"),true);
}
assert.ok(actions<15,"second wave must be completable");
assert.equal(fight.active,false);
assert.equal(fight.winner,"ally");
assert.equal(fight.wave,2);
assert.equal(fight.allyActions,3);
assert.ok(fight.events.some(e=>e.type==="battle-end"&&e.winner==="ally"));
assert.equal(ProgressCore.awardVictory(reward,fight),1,"reward once at final victory");
assert.equal(ProgressCore.awardVictory(reward,fight),0,"repeat UI sync cannot duplicate reward");
// No-wave mode keeps the old contract and win at first encounter.
const legacy=CombatCore.createBattle([hero,first]);
assert.equal(legacy.totalWaves,1);
CombatCore.advanceToPlayerTurn(legacy);
CombatCore.performPlayerAbility(legacy,"basic");
assert.equal(legacy.winner,"ally");
assert.equal(legacy.wave,1);
// Losing during wave one must never spawn wave two or give rewards.
const loss=CombatCore.createBattle([{...hero,hp:1},foe("strong",150)],[[second]]);
CombatCore.advanceToPlayerTurn(loss);
let lossSteps=0;
while(loss.active&&lossSteps++<20){
 CombatCore.performPlayerAbility(loss,"basic");
}
assert.ok(lossSteps<20);
assert.equal(loss.winner,"enemy");
assert.equal(loss.wave,1);
assert.equal(loss.pendingWaves.length,1);
assert.equal(ProgressCore.awardVictory(reward,loss),0);
// Three-wave sequence and mixed wave sizes.
const triple=CombatCore.createBattle([hero,first],[[second,third],[foe("final")]]);
CombatCore.advanceToPlayerTurn(triple);
let count=0;
while(triple.active&&count++<20)CombatCore.performPlayerAbility(triple,"basic");
assert.ok(count<20);
assert.equal(triple.winner,"ally");
assert.equal(triple.wave,3);
assert.equal(triple.allyActions,4);
// Reject invalid wave payloads before any turn runs.
assert.throws(()=>CombatCore.createBattle([hero,first],[[]]),/future wave/i);
assert.throws(()=>CombatCore.createBattle([hero,first],[[hero]]),/future wave/i);
assert.throws(()=>CombatCore.createBattle([hero,first],[[foe("a"),foe("a")]]),/unique id/i);
assert.throws(()=>CombatCore.createBattle([hero,first],[[foe("hero")]]),/collides with ally/i);
// Existing two missions remain single-wave; the third demonstrates 2+3 enemies.
const definitions=vm.runInNewContext(read("mission-data.js")+"\nMissionData");
assert.equal(definitions.get("black-pass-ambush").futureEnemyWaves,undefined);
assert.equal(definitions.get("demo-mission-2").futureEnemyWaves,undefined);
const demo=definitions.get("demo-mission-3");
assert.equal(demo.title,"Демонстрационная миссия #3");
assert.deepEqual(Array.from(demo.futureEnemyWaves[0]),["ves-2","shade-2","ves-3"]);
assert.equal(demo.stars[2].conditions[2].limit,18);
const {CampaignCore,CampaignData}=vm.runInNewContext(
 ["mission-data.js","campaign-data.js","campaign-core.js"].map(read).join("\n")+
 "\n({CampaignCore,CampaignData})");
const progress=CampaignCore.fresh();
assert.equal(CampaignData.available(CampaignData.getMission("demo-mission-3"),progress),false);
progress.completed["black-pass-ambush"]=true;progress.bestStars["black-pass-ambush"]=1;
assert.equal(CampaignData.available(CampaignData.getMission("demo-mission-3"),progress),false);
progress.completed["demo-mission-2"]=true;progress.bestStars["demo-mission-2"]=1;
assert.equal(CampaignData.available(CampaignData.getMission("demo-mission-3"),progress),true);
assert.equal(CampaignData.chapterProgress("chapter-1",progress).total,3);
assert.equal(CampaignData.chapterProgress("chapter-1",progress).maxStars,9);

const game=read("game.js");
assert.match(game,/battleFutureWaves\(\)/);
assert.match(game,/CombatCore\\.createBattle\\(battleLineup\\(\\),battleFutureWaves\\(\\),\\{leaderId:selectedLeaderId\\}\\)/);
console.log("Combat-Waves-001: 1/2/3 waves, varied counts, win/loss, reward, actions and legacy behavior passed");
