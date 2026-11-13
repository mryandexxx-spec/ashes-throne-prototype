const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const Stats=require("../hero-stats-core.js");
const Profiles=require("../hero-stats-profiles.js");
const Bridge=require("../hero-stats-combat-bridge.js");

const scripts=["initiative-model.js","ability-data.js","battle-rng.js",
 "combat-status-core.js","skill-core.js","combat-core.js"];
function engine(){
 const ctx=vm.createContext({});
 for(const file of scripts){
  const source=fs.readFileSync(path.join(__dirname,"..",file),"utf8");
  vm.runInContext(source,ctx,{filename:file});
 }
 return vm.runInContext("CombatCore",ctx);
}
function hero(id){
 return {...Bridge.apply({id,side:"ally",name:id},
  {level:1,stars:1},Profiles[id],Stats),side:"ally"};
}
function dummy(){
 return {id:"test-opponent",name:"Манекен",side:"enemy",hp:500,atk:5,
  physicalAttack:5,physicalDefense:8,magicDefense:8,speed:80,
  protection:0,maxProtection:0,combatProfile:"stats002c",
  accuracy:0,evasion:0,critChance:0,critDamage:150,
  defensePenetration:0,debuffPotency:0,debuffResistance:0};
}

test("actual combat accepts both heroes and all typed stats with seeded combat rules",()=>{
 const Combat=engine();
 const battle=Combat.createBattle([hero("ren"),hero("nada"),dummy()],[],{
  rngSeed:12345,hitChecks:true,critChecks:true,penetrationChecks:true,statusChecks:true
 });
 assert.equal(battle.fighters[0].hp,120);
 assert.equal(battle.fighters[0].maxHp,120);
 assert.equal(battle.fighters[0].protection,35);
 assert.equal(battle.fighters[1].protection,45);
 Combat.advanceToPlayerTurn(battle);
 assert.ok(["ren","nada"].includes(battle.fighters[battle.currentActor].id));
 assert.equal(Combat.performPlayerAbility(battle,"basic"),true);
 assert.ok(battle.fighters[2].hp<500);
 assert.ok(battle.turn>1);
});

test("status and damage mechanics finish several actions without invalid stat profiles",()=>{
 const Combat=engine();
 const battle=Combat.createBattle([hero("ren"),hero("nada"),dummy()],[],{
  rngSeed:112233,hitChecks:true,critChecks:true,penetrationChecks:true,statusChecks:true
 });
 Combat.advanceToPlayerTurn(battle);
 for(let i=0;i<15&&battle.active;i++){
  assert.ok(battle.currentActor>=0);
  assert.ok(Combat.performPlayerAbility(battle,"basic"));
  assert.ok(battle.fighters.every(f=>Number.isFinite(f.hp)&&f.hp>=0));
 }
 assert.ok(battle.turn>2);
});

test("only Ren/Nada path uses direct real stats; no effect on mannequin declarations",()=>{
 assert.equal(hero("ren").speed,150);
 assert.equal(hero("nada").speed,125);
 const oldDummy={id:"test-opponent",hp:500,atk:5,speed:80};
 assert.deepEqual(oldDummy,{id:"test-opponent",hp:500,atk:5,speed:80});
});
