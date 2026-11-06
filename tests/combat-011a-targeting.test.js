"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
const src=["initiative-model.js","ability-data.js","combat-core.js"]
 .map(p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8")).join("\n");
const core=vm.runInNewContext(src+"\nCombatCore");
const hero=(id,side,hp=100,atk=20,speed=100)=>({id,name:id,side,hp,atk,speed});
const battle=core.createBattle([
 hero("lyra","ally",100,15,300),
 hero("kael","ally",100,10,100),
 hero("enemyA","enemy",100,5,10),
 hero("enemyB","enemy",100,5,10)
]);
const asArray=x=>Array.from(x);
assert.deepEqual(asArray(core.abilityTargetIndices(battle,"self")),[],"no active ally until turn advances");
core.advanceToPlayerTurn(battle);
assert.equal(battle.fighters[battle.currentActor].id,"lyra");
assert.deepEqual(asArray(core.abilityTargetIndices(battle,"self")),[0]);
assert.deepEqual(asArray(core.abilityTargetIndices(battle,"ally")),[0]);
assert.deepEqual(asArray(core.abilityTargetIndices(battle,"enemy")),[2]);
assert.deepEqual(asArray(core.abilityTargetIndices(battle,"all-enemies")),[2,3]);
assert.deepEqual(asArray(core.abilityTargetIndices(battle,"all-allies")),[0,1]);
assert.deepEqual(asArray(core.abilityTargetIndices(battle,"unknown")),[]);
assert.equal(core.chooseEnemy(battle,3),true);
assert.equal(core.chooseAlly(battle,1),true);
assert.deepEqual(asArray(core.abilityTargetIndices(battle,"enemy")),[3]);
assert.deepEqual(asArray(core.abilityTargetIndices(battle,"ally")),[1]);
battle.fighters[2].hp=0;
assert.deepEqual(asArray(core.abilityTargetIndices(battle,"all-enemies")),[3],"dead unit is excluded");
battle.fighters[1].hp=0;
assert.deepEqual(asArray(core.abilityTargetIndices(battle,"all-allies")),[0],"dead ally excluded");
assert.deepEqual(asArray(core.abilityTargetIndices(battle,"ally")),[],"dead selected ally invalid");
assert.equal(core.performPlayerAbility(battle,"special"),true,"existing Lyra single-target skill still works");
assert.equal(battle.fighters[3].hp,85);
assert.deepEqual(asArray(core.abilityTargetIndices(null,"enemy")),[]);
const inactive=core.createBattle([hero("kael","ally"),hero("enemy","enemy")]);
inactive.active=false;
assert.deepEqual(asArray(core.abilityTargetIndices(inactive,"all-enemies")),[]);
console.log("Combat-011A target candidate selection and legacy single-target attacks passed");
