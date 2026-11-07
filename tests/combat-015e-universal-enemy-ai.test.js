"use strict";
// Combat-015E: the same tactical default applies to every enemy identity,
// including roster copies and enemies on future waves; no mission wiring.
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const read=n=>fs.readFileSync(path.join(__dirname,"..",n),"utf8");
const {CombatCore,EnemyDecision,MissionData}=vm.runInNewContext(
 ["initiative-model.js","ability-data.js","combat-core.js",
  "enemy-decision.js","mission-data.js"].map(read).join("\n")+
 "\n({CombatCore,EnemyDecision,MissionData})");
const game=read("game.js");
const roster=vm.runInNewContext(game.slice(0,game.indexOf("const $="))+"\nHEROES");
const enemies=roster.filter(f=>f.side==="enemy");
assert.equal(enemies.length,5,"all currently playable enemy templates are covered");
assert.ok(enemies.every(f=>!Object.hasOwn(f,"aiProfile")),
 "production enemy templates require no profile flag");
assert.ok(MissionData.all().every(m=>!Object.hasOwn(m,"enemyAiProfiles")),
 "no mission-specific AI table is allowed");
assert.ok(!game.includes("enemyForMission("),
 "game creation no longer branches on mission AI profiles");
const ally=(id,hp,speed=100)=>({id,name:id,side:"ally",hp,speed,atk:12});
for(const enemy of enemies){
 const b=CombatCore.createBattle([ally("front",200),ally("weak",60),
  {...enemy,speed:200}]);
 const plan=EnemyDecision.chooseAction(b,2);
 assert.equal(plan,null,"enemy cannot act before its initiative meter is ready");
 CombatCore.advanceToPlayerTurn(b);
 assert.equal(b.events[0].actorId,enemy.id);
 assert.equal(b.events[0].targetId,"weak",
  "every enemy focuses the same weakest living target, without an ID switch");
 assert.equal(b.events[0].abilityId,"basic");
 assert.equal(b.allyActions,0,"enemy turns never consume ally actions");
}
let b=CombatCore.createBattle([ally("front",200),ally("weak",60),
 {...enemies[0],speed:200}]);
b.fighters[1].hp=0;
CombatCore.advanceToPlayerTurn(b);
assert.equal(b.events[0].targetId,"front","dead heroes are not selected");
b=CombatCore.createBattle([ally("front",200),ally("rear",200),
 {...enemies[1],speed:200}]);
CombatCore.advanceToPlayerTurn(b);
assert.equal(b.events[0].targetId,"front","equal HP breaks by stable battle roster order");

b=CombatCore.createBattle([ally("front",200),ally("weak",60),
 {...enemies[0],speed:200}],[[{...enemies[3],speed:200}]]);
b.fighters[2].hp=0;
CombatCore.advanceToPlayerTurn(b);
assert.equal(b.wave,2);
assert.equal(b.totalWaves,2);
assert.equal(b.fighters.find(f=>f.id==="shade-2").side,"enemy");
const waveActor=b.fighters.findIndex(f=>f.id==="shade-2");
b.currentActor=waveActor;
b.fighters[waveActor].meter=1000;
assert.deepEqual(JSON.parse(JSON.stringify(EnemyDecision.chooseAction(b,waveActor))),
 {abilityId:"basic",targetIndex:1},
 "future wave enemy inherits the global policy without mission data");

const explicit=CombatCore.createBattle([ally("front",200),ally("weak",60),
 {...enemies[0],aiProfile:"ordinary",speed:200}]);
explicit.currentActor=2;
explicit.fighters[2].meter=1000;
assert.equal(EnemyDecision.chooseAction(explicit,2).targetIndex,0,
 "technical explicit profile remains available for historical tests only");
assert.match(read("index.html"),/v0\.3\.44 · GEAR003B1/);
assert.equal(JSON.parse(read("package.json")).version,"0.3.44");
console.log("Combat-015E universal enemy tactical policy and wave inheritance passed");
