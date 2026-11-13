"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const read=file=>fs.readFileSync(path.join(__dirname,"..",file),"utf8");
const scripts=["initiative-model.js","battle-rng.js","combat-status-core.js",
 "skill-core.js","ability-data.js","ability-info.js","combat-core.js","combat-log.js"];
const api=vm.runInNewContext(scripts.map(read).join("\n")+
 "\n({AbilityData,SkillCore,AbilityInfo,CombatCore,CombatStatusCore,CombatLog})");
const {CombatCore:Combat,CombatStatusCore:Status}=api;
const actor=(id,level=1)=>({id,combatProfile:"stats002c",
 skillLevels:{basic:level,special:level,powerful:level}});
function fighter(id,side,speed,hp,atk,tags=[]){
 return {id,name:id,side,speed,hp,atk,physicalAttack:atk,physicalDefense:0,
 magicDefense:0,protection:0,maxProtection:0,accuracy:0,evasion:0,
 critChance:0,critDamage:150,defensePenetration:0,debuffPotency:25,
 debuffResistance:0,combatProfile:"stats002c",tags,
 skillLevels:{basic:1,special:1,powerful:1}};
}
test("CHAR002B skill curves have exact six Ren and Nada multipliers",()=>{
 const r=[[1,1.1,1.2,1.2,1.3,1.4],[1.05,1.15,1.15,1.25,1.25,1.35],[1.6,1.75,1.75,1.9,1.9,2.05]];
 const n=[[.8,.9,1,1.1,1.2,1.3],[.7,.8,.8,.9,.9,1],[.6,.65,.65,.7,.7,.75]];
 for(let l=1;l<=6;l++){
  for(const [id,arrays] of [["ren",r],["nada",n]]){
   for(const [i,slot] of ["basic","special","powerful"].entries()){
    const a=api.AbilityData.get(actor(id,l),slot);
    assert.equal(a.multiplier,arrays[i][l-1],id+" "+slot+" "+l);
    assert.equal(a.damageType,"physical");
   }
  }
  const basic=api.AbilityData.get(actor("nada",l),"basic");
  const special=api.AbilityData.get(actor("nada",l),"special");
  const powerful=api.AbilityData.get(actor("nada",l),"powerful");
  assert.equal(basic.onHitStatus.stacks,1);
  assert.equal(special.onHitStatus.stacks,l>=3?3:2);
  assert.equal(powerful.onHitStatus.stacks,l>=5?3:2);
  assert.equal(special.cooldown,l>=5?1:2);
  assert.equal(powerful.target,"all-enemies");
  assert.equal(api.AbilityData.get(actor("ren",l),"powerful").followUpStatusAll,undefined);
 }
});
test("CHAR002B stacks are capped, refresh and decay on own turns, and consume exactly 3",()=>{
 const f={};
 assert.equal(Status.applyReadMove(f,1,2),true);
 assert.equal(Status.applyReadMove(f,2,2),true);
 assert.equal(Status.read(f,"read-move").stacks,3);
 assert.equal(Status.applyReadMove(f,4,1),true);
 assert.equal(Status.read(f,"read-move").stacks,4);
 assert.equal(Status.spendReadMove(f,3),true);
 assert.equal(Status.read(f,"read-move").stacks,1);
 Status.tickOwnTurn(f);
 assert.equal(Status.read(f,"read-move").remaining,1);
 Status.tickOwnTurn(f);
 assert.equal(Status.read(f,"read-move"),null);
 assert.equal(Status.applyReadMove(f,0,2),false);
 assert.equal(Status.apply(f,"read-move",50,2),false);
});
test("CHAR002B Ren bonuses rely exclusively on marks, not generic weaken/slow",()=>{
 const r=fighter("ren","ally",150,120,28,["gardens-over-abyss"]);
 const d=fighter("target","enemy",1,1000,0);
 const b=Combat.createBattle([r,d]);
 Combat.advanceToPlayerTurn(b);
 b.fighters[1].weakenAttacks=2;
 assert.equal(Combat.performPlayerAbility(b,"basic"),true);
 const generic=1000-d.hp;
 const b2=Combat.createBattle([r,d]);
 Combat.advanceToPlayerTurn(b2);
 assert.equal(Status.applyReadMove(b2.fighters[1],4,2),true);
 assert.equal(Combat.performPlayerAbility(b2,"basic"),true);
 assert.equal(1000-b2.fighters[1].hp,Math.round(28*1.48));
 assert.equal(generic,28);
});
test("CHAR002B Nada adds marks in live combat on every enemy hit",()=>{
 const n=fighter("nada","ally",125,110,19,["gardens-over-abyss"]);
 const e=fighter("target","enemy",1,1000,0);
 const b=Combat.createBattle([n,e]);
 Combat.advanceToPlayerTurn(b);
 assert.equal(Combat.performPlayerAbility(b,"special"),true);
 assert.equal(Status.read(b.fighters[1],"read-move").stacks,2);
 assert.equal(Combat.performPlayerAbility(b,"basic"),true);
 assert.equal(Status.read(b.fighters[1],"read-move").stacks,3);
 const logs=api.CombatLog.lines(b.events,b.fighters).join(" ");
 assert.match(logs,/Просчитанный ход/);
});
test("CHAR002B Nada's powerful attacks groups, adding independent marks",()=>{
 const n=fighter("nada","ally",125,110,19,["gardens-over-abyss"]);
 n.skillLevels={basic:6,special:6,powerful:6};
 const b=Combat.createBattle([n,fighter("a","enemy",1,1000,1),fighter("b","enemy",1,1000,1)]);
 Combat.advanceToPlayerTurn(b);
 assert.equal(Combat.performPlayerAbility(b,"powerful"),true);
 assert.equal(Status.read(b.fighters[1],"read-move").stacks,3);
 assert.equal(Status.read(b.fighters[2],"read-move").stacks,3);
 assert.equal(b.fighters[0].powerfulCooldown,3);
});
test("CHAR002B Gardens tags and passives are independent, trial actors unchanged",()=>{
 const ren=api.AbilityData.get(actor("ren"),"passive").combatRules;
 const nada=api.AbilityData.get(actor("nada"),"passive").combatRules;
 assert.equal(ren.readMoveBonusPercentPerStack,12);
 assert.equal(ren.gardensEvasionBonus,8);
 assert.equal(nada.gardensAccuracyBonus,8);
 assert.equal(api.AbilityData.get({id:"trial-nada"},"special").name,"Выверенное действие · проба");
 assert.equal(api.AbilityData.get({id:"trial-ren"},"powerful").followUpStatusAll.amount,15);
 for(const id of ["ren","nada"])assert.equal(api.AbilityData.get(actor(id),"leader"),null);
 assert.match(api.AbilityInfo.format(actor("nada"),"passive").description,/Садов/);
 assert.match(api.AbilityInfo.format(actor("ren"),"passive").description,/зацепку/);
});

test("CHAR002B predicted enemy special still executes, but loses 30% damage",()=>{
 const source=["initiative-model.js","battle-rng.js","combat-status-core.js",
  "skill-core.js","ability-data.js","ability-info.js",
  "const EnemyDecision={chooseAction:()=>({abilityId:\"special\",targetIndex:0})};",
  "combat-core.js","combat-log.js"].map(name=>name.startsWith("const ")?name:read(name)).join("\n");
 const forced=vm.runInNewContext(source+"\n({CombatCore,CombatStatusCore})");
 const ally=fighter("ren","ally",120,500,4,["gardens-over-abyss"]);
 const enemy=fighter("test-physical-strike","enemy",180,1000,100);
 const fight=stacks=>{
  const battle=forced.CombatCore.createBattle([ally,enemy]);
  if(stacks)assert.equal(forced.CombatStatusCore.applyReadMove(battle.fighters[1],stacks,2),true);
  forced.CombatCore.advanceToPlayerTurn(battle);
  return battle;
 };
 const plain=fight(0),predicted=fight(4);
 assert.equal(500-plain.fighters[0].hp,100);
 assert.equal(500-predicted.fighters[0].hp,70);
 assert.equal(predicted.events.find(e=>e.type==="ability").abilityId,"special");
 assert.equal(predicted.events.filter(e=>e.type==="read-move-predicted").length,1);
 assert.equal(predicted.events.find(e=>e.type==="read-move-predicted").damageReduction,30);
 assert.equal(forced.CombatStatusCore.read(predicted.fighters[1],"read-move").stacks,1);
 assert.equal(predicted.fighters[1].specialCooldown,2);
 assert.equal(fight(2).events.some(e=>e.type==="read-move-predicted"),false);
 assert.equal(fight(0).events.some(e=>e.type==="read-move-predicted"),false);
});
test("CHAR002B mitigation covers group special, all original targets still attacked",()=>{
 const source=["initiative-model.js","battle-rng.js","combat-status-core.js",
  "skill-core.js","ability-data.js","ability-info.js",
  "const EnemyDecision={chooseAction:()=>({abilityId:\"special\",targetIndex:0})};",
  "combat-core.js"].map(name=>name.startsWith("const ")?name:read(name)).join("\n");
 const forced=vm.runInNewContext(source+"\n({CombatCore,CombatStatusCore})");
 const party=[fighter("ren","ally",120,500,4),fighter("nada","ally",119,500,4),
  fighter("test-area-damage","enemy",180,1000,100)];
 const battle=forced.CombatCore.createBattle(party);
 assert.equal(forced.CombatStatusCore.applyReadMove(battle.fighters[2],3,2),true);
 forced.CombatCore.advanceToPlayerTurn(battle);
 assert.equal(battle.events.find(e=>e.type==="ability").abilityId,"special");
 assert.equal(battle.events.filter(e=>e.type==="damage").length,2);
 assert.equal(battle.fighters[0].hp,430);
 assert.equal(battle.fighters[1].hp,430);
 assert.equal(forced.CombatStatusCore.read(battle.fighters[2],"read-move"),null);
});
test("CHAR002B prediction lowers seeded hit chance, not the action ID",()=>{
 const source=["initiative-model.js","battle-rng.js","combat-status-core.js",
  "skill-core.js","ability-data.js","ability-info.js",
  "const EnemyDecision={chooseAction:()=>({abilityId:\"special\",targetIndex:0})};",
  "combat-core.js"].map(name=>name.startsWith("const ")?name:read(name)).join("\n");
 const forced=vm.runInNewContext(source+"\n({CombatCore,CombatStatusCore})");
 const ally=fighter("ren","ally",120,500,4);
 const enemy=fighter("test-physical-strike","enemy",180,1000,100);
 const run=stacks=>{
  const battle=forced.CombatCore.createBattle([ally,enemy],[],{
   rngSeed:1456,hitChecks:true
  });
  if(stacks)forced.CombatStatusCore.applyReadMove(battle.fighters[1],stacks,2);
  forced.CombatCore.advanceToPlayerTurn(battle);
  return battle;
 };
 const normal=run(0),marked=run(3);
 assert.equal(normal.events.find(e=>e.type==="ability").abilityId,"special");
 assert.equal(marked.events.find(e=>e.type==="ability").abilityId,"special");
 assert.equal(500-normal.fighters[0].hp,100);
 assert.equal(marked.events.find(e=>e.type==="miss").hitChance,80);
 assert.equal(marked.fighters[0].hp,500);
 assert.equal(marked.events.find(e=>e.type==="read-move-predicted").damageReduction,30);
 assert.equal(forced.CombatStatusCore.read(marked.fighters[1],"read-move"),null);
});
test("CHAR002B both permanent heroes have regional Gardens tags, not a claim of birthplace",()=>{
 const profiles=vm.runInNewContext(read("hero-profile-data.js")+"\nHeroProfileData");
 assert.ok(profiles.get("ren").tags.includes("gardens-over-abyss"));
 assert.ok(profiles.get("nada").tags.includes("gardens-over-abyss"));
 assert.equal(profiles.tag("gardens-over-abyss").kind,"region");
 const game=read("game.js");
 assert.match(game,/id:"nada",name:"Нада",classId:"support",tags:\["gardens-over-abyss"\]/);
});
